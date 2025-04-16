window.addEventListener('DOMContentLoaded', () => {
  // Initialize a single AudioContext globally
  let audioContext = null;
  function initializeAudioContext() {
    if (!audioContext) {
      try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        console.error('AudioContext error:', e);
      }
    }
    // Resume AudioContext if suspended
    if (audioContext.state === 'suspended') {
      audioContext.resume().then(() => console.log('AudioContext resumed'));
    }
    return audioContext;
  }

  // Unlock AudioContext on iOS
  document.body.addEventListener('touchstart', () => {
    initializeAudioContext();
  }, { once: true });

  // Reusable audio element for Roy
  const royAudio = new Audio();
  royAudio.id = 'roy-audio';
  royAudio.setAttribute('playsinline', 'true');
  document.body.appendChild(royAudio);

  const micBtn = document.getElementById('mic-toggle');
  const messagesEl = document.getElementById('messages');
  const modeSelect = document.getElementById('responseMode');
  const userCanvas = document.getElementById('userWaveform');
  const royCanvas = document.getElementById('royWaveform');
  const userCtx = userCanvas.getContext('2d');
  const royCtx = royCanvas.getContext('2d');

  let stream = null;
  let mediaRecorder = null;
  let recordedChunks = [];
  let analyser = null;
  let isRecording = false;
  let sessionStart = Date.now();

  appendMessage('Roy', "Welcome. I'm Roy. Speak when ready — your thoughts hold weight.");
  updateClock();
  setInterval(updateClock, 1000);

  // ... (updateClock function unchanged) ...

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

    // Use the global audioContext
    audioContext = initializeAudioContext();
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

    // Ensure AudioContext is resumed
    initializeAudioContext();
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
        // Ensure AudioContext is resumed
        initializeAudioContext();

        // Reset audio element carefully
        royAudio.pause();
        royAudio.currentTime = 0;
        royAudio.src = `data:audio/mp3;base64,${data.audio}`;
        royAudio.volume = 1.0;

        const playAudio = () => {
          royAudio.play()
            .then(() => drawWaveformRoy(royAudio))
            .catch(err => {
              console.error('Audio playback error:', err);
              appendMessage('Roy', 'Audio playback failed. Try again.');
            });
        };

        // Slightly longer delay to ensure iOS is ready
        setTimeout(playAudio, 1000);
      }
    } catch (err) {
      thinking.remove();
      appendMessage('Roy', 'Roy was silent. Try again.');
      console.error('Fetch error:', err);
    }
  }

  function drawWaveform(ctx, canvas, source, color) {
    const buffer = new Uint8Array(source.frequencyBinCount);

    function draw() {
      requestAnimationFrame(draw);
      source.getByteTimeDomainData(buffer);
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
    // Use the global audioContext
    const audioCtx = initializeAudioContext();
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

  // Clean up on page unload
  window.addEventListener('unload', () => {
    if (audioContext) {
      audioContext.close().then(() => console.log('AudioContext closed'));
    }
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
  });
});
