// script.js (patched to fix double MediaElementSource connection for Roy waveform)

window.addEventListener('DOMContentLoaded', () => {
  const micBtn = document.getElementById('mic-toggle');
  const messagesEl = document.getElementById('messages');
  const userCanvas = document.getElementById('userWaveform');
  const royCanvas = document.getElementById('royWaveform');
  const userCtx = userCanvas.getContext('2d');
  const royCtx = royCanvas.getContext('2d');

  const royAudio = new Audio();
  royAudio.setAttribute('playsinline', 'true');
  document.body.appendChild(royAudio);

  let isRecording = false;
  let mediaRecorder, audioContext, analyser, stream;
  let recordedChunks = [];
  const sessionStart = Date.now();

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

  async function startRecording() {
    micBtn.textContent = 'Stop';
    micBtn.classList.add('recording');
    isRecording = true;

    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      await audioContext.resume();
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const source = audioContext.createMediaStreamSource(stream);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      drawWaveform(userCtx, userCanvas, analyser, 'yellow');

      mediaRecorder = new MediaRecorder(stream);
      recordedChunks = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(recordedChunks, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('audio', blob);

        const dots = document.createElement('p');
        dots.className = 'roy';
        dots.id = 'typing';
        dots.innerHTML = "<strong style='color: yellow'>Roy:</strong> <span style='color: yellow'><em>typing</em><span class='dots'>...</span></span>";
        messagesEl.appendChild(dots);

        try {
          const res = await fetch('https://roy-chatbo-backend.onrender.com/api/transcribe', {
            method: 'POST',
            body: formData
          });
          const data = await res.json();
          if (data.text) {
            appendMessage('You', data.text);
            await fetchRoyResponse(data.text);
          } else {
            appendMessage('Roy', 'Sorry, I didn’t catch that.');
          }
        } catch (err) {
          console.error('Transcription error:', err);
          appendMessage('Roy', 'Transcription failed.');
        }
      };

      mediaRecorder.start();
    } catch (err) {
      console.error('Mic error:', err);
      appendMessage('Roy', 'Mic permission error.');
      stopRecording();
    }
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
    if (stream) stream.getTracks().forEach(track => track.stop());
    micBtn.textContent = 'Speak';
    micBtn.classList.remove('recording');
    isRecording = false;
  }

  async function fetchRoyResponse(text) {
    try {
      const res = await fetch('https://roy-chatbo-backend.onrender.com/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, mode: 'both' })
      });
      const data = await res.json();
      const typingEl = document.getElementById('typing');
      if (typingEl) typingEl.remove();
      if (data.text) appendMessage('Roy', infuseNaturalSpeech(addCBTResponse(data.text, text)));
      if (data.audio) {
        royAudio.src = `data:audio/mp3;base64,${data.audio}`;
        royAudio.play().catch(err => console.warn('Autoplay error:', err));
        if (!royAudio._sourceConnected) {
          const ac = new (window.AudioContext || window.webkitAudioContext)();
          const analyser = ac.createAnalyser();
          const source = ac.createMediaElementSource(royAudio);
          source.connect(analyser);
          analyser.connect(ac.destination);
          royAudio._sourceConnected = true;
          drawWaveformRoy(royAudio, analyser);
        }
      }
    } catch (err) {
      console.error('Roy response failed:', err);
      appendMessage('Roy', 'Error generating response.');
    }
  }

  function infuseNaturalSpeech(original) {
    const naturalPhrases = [
      "You know...",
      "How should I say this...",
      "Let me think about this...",
      "Mmm, alright...",
      "Honestly...",
      "If I can be real with you...",
      "Let me be straight with you...",
      "Okay, here's the thing..."
    ];
    return Math.random() < 0.7 ? `${naturalPhrases[Math.floor(Math.random() * naturalPhrases.length)]} ${original}` : original;
  }

  function addCBTResponse(original, userText) {
    const stressors = ['loss', 'divorce', 'illness', 'financial difficulty', 'isolation', 'failure', 'betrayal', 'identity crisis', 'violence', 'trauma'];
    const detected = stressors.find(s => userText.toLowerCase().includes(s));
    const affirmations = [
      "You are allowed to feel this.",
      "Let’s work through this together.",
      "You’re here, and that’s a strong first step.",
      "Let’s explore why this affects you."
    ];
    return `${original} ${detected ? '\n\n' + affirmations[Math.floor(Math.random() * affirmations.length)] : ''}`;
  }

  function drawWaveform(ctx, canvas, analyser, color) {
    const buffer = new Uint8Array(analyser.frequencyBinCount);
    function draw() {
      if (!isRecording) return;
      requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(buffer);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = '#333';
      ctx.lineWidth = 0.5;
      for (let x = 0; x <= canvas.width; x += 20) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y <= canvas.height; y += 20) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
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
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
    }
    draw();
  }

  function drawWaveformRoy(audio, analyser) {
    const buffer = new Uint8Array(analyser.frequencyBinCount);
    function draw() {
      requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(buffer);
      royCtx.fillStyle = '#000';
      royCtx.fillRect(0, 0, royCanvas.width, royCanvas.height);

      royCtx.strokeStyle = '#333';
      royCtx.lineWidth = 0.5;
      for (let x = 0; x <= royCanvas.width; x += 20) {
        royCtx.beginPath();
        royCtx.moveTo(x, 0);
        royCtx.lineTo(x, royCanvas.height);
        royCtx.stroke();
      }
      for (let y = 0; y <= royCanvas.height; y += 20) {
        royCtx.beginPath();
        royCtx.moveTo(0, y);
        royCtx.lineTo(royCanvas.width, y);
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
      royCtx.lineTo(royCanvas.width, royCanvas.height / 2);
      royCtx.stroke();
    }
    draw();
  }

  function appendMessage(sender, text) {
    const p = document.createElement('p');
    const color = sender === 'Roy' ? 'yellow' : 'white';
    p.innerHTML = `<strong style="color: ${color}">${sender}:</strong> <span style="color: ${color}">${text}</span>`;
    messagesEl.appendChild(p);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  appendMessage('Roy', "Welcome. I'm Roy. Speak when ready.");
});
