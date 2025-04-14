// script.js – Updated Roy frontend with polished UX
// Deepgram references removed, thinking.mp3 path fixed, error handling improved

window.addEventListener('DOMContentLoaded', async () => {
  const micBtn = document.getElementById('mic-toggle');
  const sendBtn = document.getElementById('send-button');
  const saveLogBtn = document.getElementById('save-log');
  const homeBtn = document.getElementById('home-btn');
  const inputEl = document.getElementById('user-input');
  const messagesEl = document.getElementById('messages');
  const modeSelect = document.getElementById('responseMode');
  const dateSpan = document.getElementById('current-date');
  const timeSpan = document.getElementById('current-time');
  const timerSpan = document.getElementById('countdown-timer');
  const userCanvas = document.getElementById('userWaveform');
  const royCanvas = document.getElementById('royWaveform');
  const userCtx = userCanvas.getContext('2d');
  const royCtx = royCanvas.getContext('2d');
  const audioEl = document.getElementById('roy-audio');
  const thinkingSound = document.getElementById('thinking-sound');

  let sessionStart = Date.now();
  let audioContext = null;
  let analyser = null;
  let dataArray = null;
  let stream = null;
  let isRecording = false;
  let lastWaveformUpdate = 0;
  const WAVEFORM_UPDATE_INTERVAL = 150;

  updateClock();
  setInterval(updateClock, 1000);
  appendMessage('Roy', "Welcome. I'm Roy. Speak when ready — your thoughts hold weight.");

  function updateClock() {
    const now = new Date();
    dateSpan.textContent = now.toISOString().split('T')[0];
    timeSpan.textContent = now.toTimeString().split(' ')[0];
    const elapsed = Math.floor((Date.now() - sessionStart) / 1000);
    const remaining = Math.max(0, 3600 - elapsed);
    timerSpan.textContent = `Session Ends In: ${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
  }

  function appendMessage(sender, text, animate = false) {
    const p = document.createElement('p');
    p.classList.add(sender.toLowerCase());
    if (animate && sender === 'Roy') {
      p.innerHTML = `<strong>${sender}:</strong> <span class="typing-text"></span>`;
      const span = p.querySelector('.typing-text');
      let i = 0;
      const type = () => {
        if (i < text.length) {
          span.textContent += text[i];
          i++;
          setTimeout(type, 50);
        } else {
          span.classList.remove('typing-text');
        }
      };
      type();
    } else {
      p.innerHTML = `<strong>${sender}:</strong> ${text}`;
    }
    messagesEl.appendChild(p);
    messagesEl.scrollTop = messagesEl.scrollHeight;
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
      drawWaveform('user');

      isRecording = true;
      micBtn.textContent = 'Stop';
      micBtn.classList.add('recording');
      appendMessage('Roy', 'Recording started... (transcription disabled)');
    } catch (err) {
      console.error('Recording error:', err);
      appendMessage('Roy', 'Could not access your microphone.');
    }
  }

  function stopRecording() {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }
    if (audioContext) {
      audioContext.close();
      audioContext = null;
      analyser = null;
    }

    appendMessage('Roy', 'Recording stopped. Transcription unavailable.');
    isRecording = false;
    micBtn.textContent = 'Speak';
    micBtn.classList.remove('recording');
  }

  async function fetchRoyResponse(message) {
    const thinkingEl = document.createElement('p');
    thinkingEl.className = 'roy typing';
    thinkingEl.textContent = 'Roy is reflecting...';
    messagesEl.appendChild(thinkingEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    try {
      thinkingSound.src = '/thinking.mp3'; // Adjusted path for GitHub Pages
      await thinkingSound.play();
    } catch (err) {
      console.error('Error playing thinking sound:', err);
      appendMessage('Roy', 'Thinking sound failed to play.');
    }

    let attempts = 0;
    const maxAttempts = 3;
    while (attempts < maxAttempts) {
      try {
        const mode = modeSelect.value || 'both';
        const apiMode = mode === 'text' ? 'text' : 'audio';
        const res = await fetch(`https://roy-chatbo-backend.onrender.com/api/chat?mode=${apiMode}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message })
        });
        const data = await res.json();
        thinkingEl.remove();

        if (mode === 'text' || mode === 'both') {
          appendMessage('Roy', data.text, true);
        }
        if ((mode === 'voice' || mode === 'both') && data.audio) {
          audioEl.src = `data:audio/mp3;base64,${data.audio}`;
          audioEl.style.display = 'block';
          audioEl.play();

          const audioContext = new (window.AudioContext || window.webkitAudioContext)();
          const source = audioContext.createMediaElementSource(audioEl);
          analyser = audioContext.createAnalyser();
          analyser.fftSize = 2048;
          dataArray = new Uint8Array(analyser.frequencyBinCount);
          source.connect(analyser);
          analyser.connect(audioContext.destination);
          drawWaveform('roy');

          audioEl.onended = () => {
            audioContext.close();
            analyser = null;
            royCtx.clearRect(0, 0, royCanvas.width, royCanvas.height);
          };
        }
        return;
      } catch (err) {
        attempts++;
        if (attempts === maxAttempts) {
          thinkingEl.remove();
          appendMessage('Roy', 'A storm clouded my voice. Please try again.');
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
      }
    }
  }

  function drawWaveform(type) {
    if ((type === 'user' && !isRecording) || !analyser) return;
    const now = Date.now();
    if (now - lastWaveformUpdate < WAVEFORM_UPDATE_INTERVAL) {
      requestAnimationFrame(() => drawWaveform(type));
      return;
    }
    lastWaveformUpdate = now;

    const canvas = type === 'user' ? userCanvas : royCanvas;
    const ctx = type === 'user' ? userCtx : royCtx;

    analyser.getByteTimeDomainData(dataArray);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = type === 'user' ? 'yellow' : '#0ff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const sliceWidth = canvas.width / dataArray.length;
    let x = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const y = (dataArray[i] / 128.0) * canvas.height / 2;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      x += sliceWidth;
    }
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();

    requestAnimationFrame(() => drawWaveform(type));
  }

  function saveConversationLog() {
    const messages = Array.from(messagesEl.getElementsByTagName('p')).map(p => p.textContent);
    const logText = messages.join('\n');
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `roy-conversation-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
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

  saveLogBtn.addEventListener('click', saveConversationLog);

  homeBtn.addEventListener('click', () => {
    window.location.href = 'https://synthcalm.com';
  });
});
