// script.js – Roy frontend with reusable audio element and iOS-safe playback

window.addEventListener('DOMContentLoaded', () => {
  // Unlock AudioContext on iOS
  document.body.addEventListener('touchstart', () => {
    if (!audioContext) {
      try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        console.error('AudioContext error:', e);
      }
    }
  }, { once: true });

  // Create and append a reusable audio element for Roy
  const royAudio = new Audio();
  royAudio.id = 'roy-audio';
  royAudio.setAttribute("playsinline", "true");
  document.body.appendChild(royAudio);

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
    const mimeType = 'audio/webm;codecs=opus';

    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mediaRecorder = new MediaRecorder(stream);
    } else {
      mediaRecorder = new MediaRecorder(stream, { mimeType });
    }

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

  function appendMessage(sender, text) {
    const p = document.createElement('p');
    p.className = sender.toLowerCase();
    const color = sender === 'Roy' ? 'yellow' : 'white';
    p.innerHTML = `<strong style='color: ${color}'>${sender}:</strong> <span style='color: ${color}'>${text}</span>`;
    messagesEl.appendChild(p);
    messagesEl.scrollTop = messagesEl.scrollHeight;
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
      appendMessage('Roy', data.text);

      if ((modeSelect.value === 'voice' || modeSelect.value === 'both') && data.audio) {
        royAudio.src = `data:audio/mp3;base64,${data.audio}`;

        const playAudio = () => {
          royAudio.play()
            .then(() => {
              drawWaveformRoy(royAudio);
            })
            .catch(err => {
              console.warn('Audio blocked or delayed:', err);
              document.body.addEventListener('touchend', () => {
                royAudio.play().then(() => drawWaveformRoy(royAudio));
              }, { once: true });
            });
        };

        setTimeout(playAudio, 500);
      }
    } catch (err) {
      thinking.remove();
      appendMessage('Roy', 'Roy was silent. Try again.');
    }
  }

  function drawWaveform(ctx, canvas, source, color) {
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

  function drawWaveformRoy(audio) {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = audioCtx.createAnalyser();
    const source = audioCtx.createMediaElementSource(audio);
    source.connect(analyser);
    analyser.connect(audioCtx.destination);
    analyser.fftSize = 2048;
    const buffer = new Uint8Array(analyser.frequencyBinCount);

    function draw() {
      requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(buffer);
      royCtx.fillStyle = '#000';
      royCtx.fillRect(0, 0, royCanvas.width, royCanvas.height);
      royCtx.strokeStyle = 'magenta';
      royCtx.beginPath();
      const slice = royCanvas.width / buffer.length;
      let x = 0;
      for (let i = 0; i < buffer.length; i++) {
        const y = (buffer[i] / 128.0) * royCanvas.height / 2;
        i === 0 ? royCtx.moveTo(x, y) : royCtx.lineTo(x, y);
        x += slice;
      }
      royCtx.lineTo(royCanvas.width, royCanvas.height / 2);
      royCtx.stroke();
    }

    draw();
  }
});
