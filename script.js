// script.js – Roy frontend with Whisper transcription, typing effect, and synced waveform/audio

window.addEventListener('DOMContentLoaded', () => {
  const micBtn = document.getElementById('mic-toggle');
  const sendBtn = document.getElementById('send-button');
  const inputEl = document.getElementById('user-input');
  const messagesEl = document.getElementById('messages');
  const modeSelect = document.getElementById('responseMode');
  const userCanvas = document.getElementById('userWaveform');
  const royCanvas = document.getElementById('royWaveform');
  const userCtx = userCanvas.getContext('2d');
  const royCtx = royCanvas.getContext('2d');

  let stream = null;
  let mediaRecorder = null;
  let recordedChunks = [];
  let audioContext = null;
  let analyser = null;
  let isRecording = false;
  let sessionStart = Date.now();

  appendMessage('Roy', "Welcome. I'm Roy. Speak when ready — your thoughts hold weight.");
  updateClock();
  setInterval(updateClock, 1000);

  function updateClock() {
    const now = new Date();
    const dateSpan = document.getElementById('current-date');
    const timeSpan = document.getElementById('current-time');
    const timerSpan = document.getElementById('countdown-timer');
    if (!dateSpan || !timeSpan || !timerSpan) return;
    dateSpan.textContent = now.toISOString().split('T')[0];
    timeSpan.textContent = now.toTimeString().split(' ')[0];
    const elapsed = Math.floor((Date.now() - sessionStart) / 1000);
    const remaining = Math.max(0, 3600 - elapsed);
    timerSpan.textContent = `Session Ends In: ${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
  }

  micBtn.addEventListener('click', () => {
    isRecording ? stopRecording() : startRecording();
  });

  async function startRecording() {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recordedChunks = [];
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = e => recordedChunks.push(e.data);
    mediaRecorder.onstop = async () => {
      const thinkingEl = document.createElement('p');
      thinkingEl.className = 'roy';
      thinkingEl.innerHTML = '<em>Roy is reflecting...</em>';
      messagesEl.appendChild(thinkingEl);

      const blob = new Blob(recordedChunks, { type: 'audio/webm' });
      const formData = new FormData();
      formData.append('audio', blob);

      const res = await fetch('https://roy-chatbo-backend.onrender.com/api/transcribe', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      thinkingEl.remove();

      if (data.text) {
        appendMessage('You', data.text);
        fetchRoyResponse(data.text);
      } else {
        appendMessage('Roy', 'I didn’t catch that. Can you try again?');
      }
    };

    mediaRecorder.start();
    isRecording = true;
    micBtn.textContent = 'Stop';
    micBtn.classList.add('recording');

    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    drawWaveform(userCtx, userCanvas, analyser, 'yellow');
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
    if (stream) stream.getTracks().forEach(track => track.stop());
    micBtn.textContent = 'Speak';
    micBtn.classList.remove('recording');
    isRecording = false;
  }

  function appendMessage(sender, text, animate = false) {
    const p = document.createElement('p');
    p.className = sender.toLowerCase();
    const color = sender === 'Roy' ? 'yellow' : 'white';
    p.innerHTML = `<strong style='color: ${color}'>${sender}:</strong> <span style='color: ${color}'></span>`;
    messagesEl.appendChild(p);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    if (animate && sender === 'Roy') {
      const span = p.querySelector('span');
      let i = 0;
      const interval = setInterval(() => {
        span.textContent += text[i++];
        messagesEl.scrollTop = messagesEl.scrollHeight;
        if (i >= text.length) clearInterval(interval);
      }, 50);
    } else {
      p.querySelector('span').textContent = text;
    }
  }

  async function fetchRoyResponse(message) {
    const thinking = document.createElement('p');
    thinking.className = 'roy';
    thinking.innerHTML = '<em>Roy is reflecting...</em>';
    messagesEl.appendChild(thinking);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    try {
      const res = await fetch('https://roy-chatbo-backend.onrender.com/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, mode: modeSelect.value })
      });

      const data = await res.json();
      thinking.remove();

      appendMessage('Roy', data.text, true);

    if ((modeSelect.value === 'voice' || modeSelect.value === 'both') && data.audio) {
        const audio = new Audio(`data:audio/mp3;base64,${data.audio}`);
        audio.play();
        drawWaveform(royCtx, royCanvas, audio, 'magenta');
      }
    } catch (err) {
      thinking.remove();
      appendMessage('Roy', 'Roy was silent. Try again.');
    }
  }

  function drawWaveform(ctx, canvas, source, color) {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = audioCtx.createAnalyser();
    const srcNode = audioCtx.createMediaElementSource(source);
    srcNode.connect(analyser);
    analyser.connect(audioCtx.destination);
    analyser.fftSize = 2048;
    const buffer = new Uint8Array(analyser.frequencyBinCount);

    function draw() {
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
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
    }

    draw();
  }
});
