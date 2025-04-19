// Roy Chatbot | Speak functionality with Whisper + AssemblyAI fallback

window.addEventListener('DOMContentLoaded', () => {
  const micBtn = document.getElementById('mic-toggle');
  const messagesEl = document.getElementById('messages');
  const userCanvas = document.getElementById('userWaveform');
  const royCanvas = document.getElementById('royWaveform');
  const royAudio = new Audio();
  royAudio.setAttribute('playsinline', 'true');
  document.body.appendChild(royAudio);

  let isRecording = false;
  let mediaRecorder, audioContext, source, analyser, stream;
  let ws = null;
  let sessionStart = Date.now();

  updateClock();
  setInterval(updateClock, 1000);

  function updateClock() {
    const now = new Date();
    document.getElementById('current-date').textContent = now.toISOString().split('T')[0];
    document.getElementById('current-time').textContent = now.toLocaleTimeString();
    const elapsed = Math.floor((Date.now() - sessionStart) / 1000);
    const remaining = Math.max(0, 3600 - elapsed);
    document.getElementById('countdown-timer').textContent = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
  }

  micBtn.addEventListener('click', () => {
    isRecording ? stopRecording() : startRecording();
  });

  function appendMessage(sender, text) {
    const p = document.createElement('p');
    p.className = sender.toLowerCase();
    p.innerHTML = `<strong>${sender}:</strong> ${text}`;
    messagesEl.appendChild(p);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  async function startRecording() {
    try {
      if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
      await audioContext.resume();
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      source = audioContext.createMediaStreamSource(stream);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      drawWaveform(userCanvas, analyser, 'yellow');

      ws = new WebSocket("wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000", ['assemblyai-realtime']);
      ws.onopen = () => {
        ws.send(JSON.stringify({ auth_token: 'c204c69052074ce98287a515e68da0c4' }));
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
        mediaRecorder.ondataavailable = e => {
          if (ws.readyState === WebSocket.OPEN) ws.send(e.data);
        };
        mediaRecorder.start(500);
        isRecording = true;
        micBtn.textContent = 'Stop';
      };

      ws.onmessage = async e => {
        const msg = JSON.parse(e.data);
        if (msg.text && msg.message_type === 'FinalTranscript') {
          appendMessage('You', msg.text);
          await fetchRoyResponse(msg.text);
        }
      };

      ws.onerror = err => stopRecording();
      ws.onclose = () => stopRecording();
    } catch (err) {
      appendMessage('Roy', 'Mic access error.');
      console.error(err);
    }
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
    if (stream) stream.getTracks().forEach(track => track.stop());
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ terminate_session: true }));
      ws.close();
    }
    micBtn.textContent = 'Speak';
    isRecording = false;
  }

  async function fetchRoyResponse(text) {
    appendMessage('Roy', '<em>Roy is reflecting...</em>');
    try {
      const res = await fetch('https://roy-chatbo-backend.onrender.com/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, mode: 'both' })
      });
      const data = await res.json();
      if (data.text) {
        appendMessage('Roy', data.text);
        royAudio.src = `data:audio/mp3;base64,${data.audio}`;
        royAudio.play();
        drawWaveformRoy(royCanvas, royAudio);
      }
    } catch (err) {
      appendMessage('Roy', 'Roy failed to respond.');
      console.error(err);
    }
  }

  function drawWaveform(canvas, analyser, color) {
    const ctx = canvas.getContext('2d');
    const buffer = new Uint8Array(analyser.frequencyBinCount);
    function draw() {
      if (!isRecording) return;
      requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(buffer);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = color;
      ctx.beginPath();
      const slice = canvas.width / buffer.length;
      let x = 0;
      for (let i = 0; i < buffer.length; i++) {
        const y = (buffer[i] / 128.0) * canvas.height / 2;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        x += slice;
      }
      ctx.stroke();
    }
    draw();
  }

  function drawWaveformRoy(canvas, audio) {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = ac.createAnalyser();
    const source = ac.createMediaElementSource(audio);
    source.connect(analyser);
    analyser.connect(ac.destination);
    analyser.fftSize = 2048;
    const ctx = canvas.getContext('2d');
    const buffer = new Uint8Array(analyser.frequencyBinCount);
    function draw() {
      requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(buffer);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = 'magenta';
      ctx.beginPath();
      const slice = canvas.width / buffer.length;
      let x = 0;
      for (let i = 0; i < buffer.length; i++) {
        const y = (buffer[i] / 128.0) * canvas.height / 2;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        x += slice;
      }
      ctx.stroke();
    }
    draw();
  }
});
