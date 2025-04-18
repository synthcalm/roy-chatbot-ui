window.addEventListener('DOMContentLoaded', () => {
  const royAudio = new Audio();
  royAudio.setAttribute('playsinline', 'true');
  document.body.appendChild(royAudio);

  const micBtn = document.getElementById('mic-toggle');
  const messagesEl = document.getElementById('chat');
  const userCanvas = document.getElementById('userWaveform');
  const royCanvas = document.getElementById('royWaveform');
  const userCtx = userCanvas.getContext('2d');
  const royCtx = royCanvas.getContext('2d');
  const dateSpan = document.getElementById('current-date');
  const timeSpan = document.getElementById('current-time');
  const timerSpan = document.getElementById('countdown-timer');

  let audioContext = null;
  let analyser = null;
  let stream = null;
  let mediaRecorder = null;
  let isRecording = false;
  let recordedChunks = [];
  let sessionStart = Date.now();

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
  updateClock();
  setInterval(updateClock, 1000);

  function appendMessage(sender, text) {
    const p = document.createElement('p');
    p.className = sender.toLowerCase();
    const color = sender === 'Roy' ? 'yellow' : 'white';
    p.innerHTML = `<strong style='color: ${color}'>${sender}:</strong> <span style='color: ${color}'>${text}</span>`;
    messagesEl.appendChild(p);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function showThinkingDots() {
    const dotsEl = document.createElement('p');
    dotsEl.innerHTML = "<strong style='color: yellow'>Roy:</strong> <span id='dots' style='color: yellow'>.</span>";
    messagesEl.appendChild(dotsEl);
    let count = 1;
    const interval = setInterval(() => {
      const dotsSpan = document.getElementById('dots');
      if (!dotsSpan) return clearInterval(interval);
      dotsSpan.textContent = '.'.repeat((count % 3) + 1);
      count++;
    }, 500);
    return dotsEl;
  }

  async function startRecording() {
    try {
      if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        await audioContext.resume();
      }

      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const source = audioContext.createMediaStreamSource(stream);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      drawWaveform(userCtx, userCanvas, analyser, 'yellow');

      mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      recordedChunks = [];

      mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) recordedChunks.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(recordedChunks, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('audio', blob);

        const thinkingEl = showThinkingDots();

        try {
          const res = await fetch('https://roy-chatbo-backend.onrender.com/api/transcribe', {
            method: 'POST',
            body: formData
          });
          const data = await res.json();
          if (data.text) {
            appendMessage('You', data.text);
            thinkingEl.remove();
            await fetchRoyResponse(data.text);
          } else {
            appendMessage('Roy', 'Sorry, I didn’t catch that.');
          }
        } catch (err) {
          console.error('Whisper transcription error:', err);
          appendMessage('Roy', 'Transcription failed.');
        }
      };

      mediaRecorder.start();
      isRecording = true;
      micBtn.textContent = 'Stop';
      micBtn.classList.add('recording');
    } catch (err) {
      console.error('Mic error:', err);
      appendMessage('Roy', 'Mic permission error.');
    }
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
    if (stream) stream.getTracks().forEach(t => t.stop());
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
      const poeticPrefaces = [
        "There’s something delicate in the air…",
        "Even fire can illuminate. Let’s look closer.",
        "Energy like yours often hides something deeper…",
        "Let’s reflect on that together."
      ];
      const intro = poeticPrefaces[Math.floor(Math.random() * poeticPrefaces.length)];
      appendMessage('Roy', `${intro} ${data.text}`);
      if (data.audio) {
        royAudio.src = `data:audio/mp3;base64,${data.audio}`;
        royAudio.play().catch(e => console.warn('Autoplay error', e));
        drawWaveformRoy(royAudio);
      }
    } catch (err) {
      console.error('Roy response failed:', err);
      appendMessage('Roy', 'Error generating response.');
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
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
      }
      for (let j = 0; j <= canvas.height; j += 20) {
        ctx.beginPath(); ctx.moveTo(0, j); ctx.lineTo(canvas.width, j); ctx.stroke();
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
    if (drawWaveformRoy.source) drawWaveformRoy.source.disconnect();
    const source = ac.createMediaElementSource(audio);
    drawWaveformRoy.source = source;
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
        royCtx.beginPath(); royCtx.moveTo(i, 0); royCtx.lineTo(i, royCanvas.height); royCtx.stroke();
      }
      for (let j = 0; j <= royCanvas.height; j += 20) {
        royCtx.beginPath(); royCtx.moveTo(0, j); royCtx.lineTo(royCanvas.width, j); royCtx.stroke();
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

  micBtn.addEventListener('click', () => {
    isRecording ? stopRecording() : startRecording();
  });

  appendMessage('Roy', "Welcome. I'm Roy. Speak when ready.");
});
