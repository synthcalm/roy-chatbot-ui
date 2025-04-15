// script.js – Finalized Roy frontend using SynthCalm architecture

window.addEventListener('DOMContentLoaded', () => {
  const micBtn = document.getElementById('mic-toggle');
  const sendBtn = document.getElementById('send-button');
  const inputEl = document.getElementById('user-input');
  const messagesEl = document.getElementById('messages');
  const modeSelect = document.getElementById('responseMode');
  const royAudio = document.getElementById('roy-audio');
  const dateSpan = document.getElementById('current-date');
  const timeSpan = document.getElementById('current-time');
  const timerSpan = document.getElementById('countdown-timer');
  const userCanvas = document.getElementById('userWaveform');
  const royCanvas = document.getElementById('royWaveform');
  const userCtx = userCanvas.getContext('2d');
  const royCtx = royCanvas.getContext('2d');

  let sessionStart = Date.now();
  let stream = null;
  let audioContext = null;
  let analyser = null;
  let dataArray = null;
  let socket = null;
  let token = null;
  let isRecording = false;
  let liveTranscript = '';
  let transcriptEl = null;

  appendMessage('Roy', "Welcome. I'm Roy. Speak when ready — your thoughts hold weight.");
  updateClock();
  setInterval(updateClock, 1000);

  function updateClock() {
    const now = new Date();
    dateSpan.textContent = now.toISOString().split('T')[0];
    timeSpan.textContent = now.toTimeString().split(' ')[0];
    const elapsed = Math.floor((Date.now() - sessionStart) / 1000);
    const remaining = Math.max(0, 3600 - elapsed);
    timerSpan.textContent = `Session Ends In: ${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
  }

  function appendMessage(sender, text) {
    const p = document.createElement('p');
    p.className = sender.toLowerCase();
    p.innerHTML = `<strong>${sender}:</strong> ${text}`;
    messagesEl.appendChild(p);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  async function getToken() {
    const res = await fetch('https://roy-chatbo-backend.onrender.com/api/assembly/token');
    const data = await res.json();
    token = data.token;
  }

  async function startRecording() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      dataArray = new Uint8Array(analyser.frequencyBinCount);
      source.connect(analyser);
      drawWaveform(userCtx, userCanvas, analyser, 'yellow');

      await getToken();

      socket = new WebSocket(`wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000`);
      socket.binaryType = 'arraybuffer';
      socket.onopen = () => socket.send(JSON.stringify({ token }));

      socket.onmessage = (msg) => {
        const res = JSON.parse(msg.data);
        if (res.text) {
          transcriptEl.querySelector('span').textContent = res.text;
          liveTranscript = res.text;
        }
      };

      transcriptEl = document.createElement('p');
      transcriptEl.className = 'you live-transcript';
      transcriptEl.innerHTML = '<strong>You (speaking):</strong> <span style="color: yellow">...</span>';
      messagesEl.appendChild(transcriptEl);

      const worklet = `class PCMProcessor extends AudioWorkletProcessor {
        process(inputs) {
          const input = inputs[0][0];
          if (!input) return true;
          const int16 = new Int16Array(input.length);
          for (let i = 0; i < input.length; i++) int16[i] = Math.max(-1, Math.min(1, input[i])) * 32767;
          this.port.postMessage(int16.buffer);
          return true;
        }
      }
      registerProcessor('pcm-processor', PCMProcessor);`;

      await audioContext.audioWorklet.addModule('data:application/javascript;base64,' + btoa(worklet));
      const workletNode = new AudioWorkletNode(audioContext, 'pcm-processor');
      workletNode.port.onmessage = (e) => {
        if (socket.readyState === WebSocket.OPEN) socket.send(e.data);
      };
      source.connect(workletNode).connect(audioContext.destination);

      isRecording = true;
      micBtn.textContent = 'Stop';
      micBtn.classList.add('recording');
    } catch (err) {
      appendMessage('Roy', 'Could not access your microphone.');
    }
  }

  function stopRecording() {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ terminate_session: true }));
      socket.close();
    }
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }
    if (audioContext) {
      audioContext.close();
      audioContext = null;
    }

    if (liveTranscript.trim()) {
      appendMessage('You', liveTranscript);
      fetchRoyResponse(liveTranscript);
    } else {
      appendMessage('Roy', 'Your words didn’t make it through the static. Try again.');
    }

    if (transcriptEl) transcriptEl.remove();
    isRecording = false;
    micBtn.textContent = 'Speak';
    micBtn.classList.remove('recording');
  }

  async function fetchRoyResponse(message) {
    const thinkingEl = document.createElement('p');
    thinkingEl.textContent = 'Roy is reflecting...';
    thinkingEl.className = 'roy';
    messagesEl.appendChild(thinkingEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    try {
      const res = await fetch('https://roy-chatbo-backend.onrender.com/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, mode: modeSelect.value })
      });
      const data = await res.json();

      thinkingEl.remove();
      appendMessage('Roy', data.text);

      if ((modeSelect.value === 'voice' || modeSelect.value === 'both') && data.audio) {
        royAudio.src = `data:audio/mp3;base64,${data.audio}`;
        royAudio.style.display = 'block';
        royAudio.play();
        drawWaveform(royCtx, royCanvas, royAudio, '#0ff');
      }
    } catch (err) {
      thinkingEl.remove();
      appendMessage('Roy', 'A storm clouded my voice. Try again.');
    }
  }

  function drawWaveform(ctx, canvas, source, color) {
    const draw = () => {
      requestAnimationFrame(draw);
      if (!source) return;
      const buffer = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteTimeDomainData(buffer);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const sliceWidth = canvas.width / buffer.length;
      let x = 0;
      for (let i = 0; i < buffer.length; i++) {
        const y = (buffer[i] / 128.0) * canvas.height / 2;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        x += sliceWidth;
      }
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
    };
    draw();
  }

  sendBtn.addEventListener('click', () => {
    const msg = inputEl.value.trim();
    if (msg) {
      appendMessage('You', msg);
      inputEl.value = '';
      fetchRoyResponse(msg);
    }
  });

  micBtn.addEventListener('click', () => {
    isRecording ? stopRecording() : startRecording();
  });

  document.getElementById('save-log').addEventListener('click', () => {
    const log = Array.from(messagesEl.children).map(c => c.textContent).join('\n');
    const blob = new Blob([log], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `roy-session-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById('home-btn').addEventListener('click', () => {
    window.location.href = 'https://synthcalm.com';
  });
});
