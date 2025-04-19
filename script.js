// Roy Whisper Integration with MIA Input Logic - Updated with MIA's Real-Time Transcription

window.addEventListener('DOMContentLoaded', async () => {
  let audioContext;
  let analyser;
  let stream;
  let socket;
  let workletNode;
  const sessionStart = Date.now();

  const royAudio = new Audio();
  royAudio.setAttribute('playsinline', 'true');
  document.body.appendChild(royAudio);

  const micBtn = document.getElementById('mic-toggle');
  const messagesEl = document.getElementById('messages');
  const userCanvas = document.getElementById('userWaveform');
  const royCanvas = document.getElementById('royWaveform');
  const userCtx = userCanvas.getContext('2d');
  const royCtx = royCanvas.getContext('2d');
  const dateSpan = document.getElementById('current-date');
  const timeSpan = document.getElementById('current-time');
  const timerSpan = document.getElementById('countdown-timer');

  updateClock();
  setInterval(updateClock, 1000);

  function updateClock() {
    const now = new Date();
    if (dateSpan) dateSpan.textContent = now.toISOString().split('T')[0];
    if (timeSpan) timeSpan.textContent = now.toTimeString().split(' ')[0];
    if (timerSpan) {
      const elapsed = Math.floor((Date.now() - sessionStart) / 1000);
      const remaining = Math.max(0, 3600 - elapsed);
      timerSpan.textContent = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
    }
  }

  function appendMessage(sender, text) {
    const p = document.createElement('p');
    p.className = sender.toLowerCase();
    const color = sender === 'Roy' ? 'yellow' : 'white';
    p.innerHTML = `<strong style='color: ${color}'>${sender}:</strong> <span style='color: ${color}'>${text}</span>`;
    messagesEl.appendChild(p);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  async function startRecording() {
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const source = audioContext.createMediaStreamSource(stream);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      drawWaveform(userCtx, userCanvas, analyser, 'yellow');

      await audioContext.audioWorklet.addModule('https://cdn.jsdelivr.net/gh/AssemblyAI/real-time-sdk/audio-processor.js');
      workletNode = new AudioWorkletNode(audioContext, 'pcm-processor');
      source.connect(workletNode);
      workletNode.connect(audioContext.destination);

      const res = await fetch('https://roy-chatbo-backend.onrender.com/api/assembly/token');
      const { token } = await res.json();

      socket = new WebSocket(`wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000`);
      socket.onopen = () => socket.send(JSON.stringify({ auth_token: token }));
      socket.onmessage = async (msg) => {
        const { text, message_type } = JSON.parse(msg.data);
        if (message_type === 'FinalTranscript' && text) {
          appendMessage('You', text);
          await fetchRoyResponse(text);
        }
      };

      workletNode.port.onmessage = (e) => {
        if (socket.readyState === WebSocket.OPEN) socket.send(e.data);
      };

      micBtn.textContent = 'Stop';
      micBtn.classList.add('recording');
    } catch (err) {
      console.error('Mic or WS error', err);
      appendMessage('Roy', 'Mic or connection error.');
    }
  }

  function stopRecording() {
    if (stream) stream.getTracks().forEach(t => t.stop());
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ terminate_session: true }));
      socket.close();
    }
    micBtn.textContent = 'Speak';
    micBtn.classList.remove('recording');
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
      if (data.text) appendMessage('Roy', data.text);
      if (data.audio) {
        royAudio.src = `data:audio/mp3;base64,${data.audio}`;
        royAudio.play().catch(e => console.warn('Autoplay error', e));
        drawWaveformRoy(royAudio);
      }
    } catch (err) {
      console.error('Roy response failed:', err);
      appendMessage('Roy', 'Roy was silent.');
    }
  }

  function drawWaveform(ctx, canvas, analyser, color) {
    const buffer = new Uint8Array(analyser.frequencyBinCount);
    function draw() {
      requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(buffer);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 0.5;
      for (let i = 0; i <= canvas.width; i += 20) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, canvas.height);
        ctx.stroke();
      }
      for (let j = 0; j <= canvas.height; j += 20) {
        ctx.beginPath();
        ctx.moveTo(0, j);
        ctx.lineTo(canvas.width, j);
        ctx.stroke();
      }
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

  function drawWaveformRoy(audio) {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = ac.createAnalyser();
    const source = ac.createMediaElementSource(audio);
    source.connect(analyser);
    analyser.connect(ac.destination);
    analyser.fftSize = 2048;
    const buffer = new Uint8Array(analyser.frequencyBinCount);
    function draw() {
      requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(buffer);
      royCtx.fillStyle = '#000';
      royCtx.fillRect(0, 0, royCanvas.width, royCanvas.height);
      royCtx.strokeStyle = '#333';
      royCtx.lineWidth = 0.5;
      for (let i = 0; i <= royCanvas.width; i += 20) {
        royCtx.beginPath();
        royCtx.moveTo(i, 0);
        royCtx.lineTo(i, royCanvas.height);
        royCtx.stroke();
      }
      for (let j = 0; j <= royCanvas.height; j += 20) {
        royCtx.beginPath();
        royCtx.moveTo(0, j);
        royCtx.lineTo(royCanvas.width, j);
        royCtx.stroke();
      }
      royCtx.strokeStyle = 'magenta';
      royCtx.beginPath();
      const slice = royCanvas.width / buffer.length;
      let x = 0;
      for (let i = 0; i < buffer.length; i++) {
        const y = (buffer[i] / 128.0) * royCanvas.height / 2;
        i === 0 ? royCtx.moveTo(x, y) : royCtx.lineTo(x, y);
        x += slice;
      }
      royCtx.stroke();
    }
    draw();
  }

  document.body.addEventListener('touchstart', () => {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume();
  }, { once: true });

  micBtn?.addEventListener('click', () => {
    isRecording ? stopRecording() : startRecording();
  });

  appendMessage('Roy', "Welcome. I'm Roy. Speak when ready.");
});
