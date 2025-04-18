window.addEventListener('DOMContentLoaded', () => {
  console.log('Whisper mode initialized');

  const royAudio = new Audio();
  royAudio.setAttribute('playsinline', 'true');
  document.body.appendChild(royAudio);

  const micBtn = document.getElementById('mic-toggle');
  const chatBox = document.getElementById('chat');
  const userCanvas = document.getElementById('userWaveform');
  const royCanvas = document.getElementById('royWaveform');
  const userCtx = userCanvas.getContext('2d');
  const royCtx = royCanvas.getContext('2d');
  const dateEl = document.getElementById('current-date');
  const timeEl = document.getElementById('current-time');
  const countdownEl = document.getElementById('countdown-timer');

  userCanvas.height = 52;
  royCanvas.height = 52;

  let audioContext = null;
  let analyser = null;
  let stream = null;
  let mediaRecorder = null;
  let isRecording = false;
  let recordedChunks = [];
  let sessionStart = Date.now();
  let thinkingDotsEl = null;

  function updateClock() {
    const now = new Date();
    dateEl.textContent = now.toISOString().split('T')[0];
    timeEl.textContent = now.toTimeString().split(' ')[0];
    const elapsed = Math.floor((Date.now() - sessionStart) / 1000);
    const remaining = Math.max(0, 3600 - elapsed);
    countdownEl.textContent = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
  }
  updateClock();
  setInterval(updateClock, 1000);

  function appendMessage(sender, text = '', animate = false) {
    const p = document.createElement('p');
    p.className = sender.toLowerCase();
    const color = sender === 'Roy' ? 'yellow' : 'white';
    p.innerHTML = `<strong style='color: ${color}'>${sender}:</strong> <span style='color: ${color}'></span>`;
    chatBox.appendChild(p);
    chatBox.scrollTop = chatBox.scrollHeight;

    const span = p.querySelector('span');
    if (animate && text) {
      let index = 0;
      const interval = setInterval(() => {
        if (index < text.length) {
          span.textContent += text.charAt(index++);
        } else {
          clearInterval(interval);
        }
      }, 50);
    } else {
      span.textContent = text;
    }
    return p;
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
        const emotionalTone = analyzeEmotion(analyser);
        const blob = new Blob(recordedChunks, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('audio', blob);
        formData.append('tone', emotionalTone);

        thinkingDotsEl = appendMessage('Roy', '<span id="thinking-dots">...</span>');
        animateDots();

        try {
          const res = await fetch('https://roy-chatbo-backend.onrender.com/api/transcribe', {
            method: 'POST',
            body: formData
          });
          const data = await res.json();
          if (thinkingDotsEl) thinkingDotsEl.remove();
          if (data.text) {
            const modifiedText = transformRoyPersona(data.text, emotionalTone);
            appendMessage('Roy', modifiedText, true);
          }
          if (data.audio) {
            royAudio.src = `data:audio/mp3;base64,${data.audio}`;
            setTimeout(() => {
              royAudio.play().catch(e => console.warn('Autoplay error', e));
              drawWaveformRoy(royAudio);
            }, 200);
          }
        } catch (err) {
          console.error('Roy response failed:', err);
          appendMessage('Roy', 'Error generating response.');
        }
      };

      mediaRecorder.start();
      isRecording = true;
    } catch (err) {
      console.error('Mic error:', err);
    }
  }

  function animateDots() {
    let dots = 1;
    const interval = setInterval(() => {
      if (!thinkingDotsEl || !thinkingDotsEl.parentNode) {
        clearInterval(interval);
        return;
      }
      thinkingDotsEl.innerHTML = '.'.repeat((dots++ % 3) + 1);
    }, 500);
  }

  function drawWaveform(ctx, canvas, analyser, color) {
    const buffer = new Uint8Array(analyser.frequencyBinCount);
    function draw() {
      requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(buffer);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = '#333';
      ctx.lineWidth = 0.25;
      for (let i = 0; i <= canvas.width; i += 20) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke();
      }
      for (let j = 0; j <= canvas.height; j += 20) {
        ctx.beginPath(); ctx.moveTo(0, j); ctx.lineTo(canvas.width, j); ctx.stroke();
      }

      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
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
    drawWaveformRoy.source = ac.createMediaElementSource(audio);
    drawWaveformRoy.source.connect(analyser);
    analyser.connect(ac.destination);
    analyser.fftSize = 2048;
    const buffer = new Uint8Array(analyser.frequencyBinCount);
    function draw() {
      requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(buffer);
      royCtx.fillStyle = '#000';
      royCtx.fillRect(0, 0, royCanvas.width, royCanvas.height);
      royCtx.strokeStyle = '#333';
      royCtx.lineWidth = 0.25;
      for (let i = 0; i <= royCanvas.width; i += 20) {
        royCtx.beginPath(); royCtx.moveTo(i, 0); royCtx.lineTo(i, royCanvas.height); royCtx.stroke();
      }
      for (let j = 0; j <= royCanvas.height; j += 20) {
        royCtx.beginPath(); royCtx.moveTo(0, j); royCtx.lineTo(royCanvas.width, j); royCtx.stroke();
      }
      royCtx.strokeStyle = 'magenta';
      royCtx.lineWidth = 1;
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

  if (micBtn) {
    micBtn.addEventListener('click', () => {
      isRecording ? stopRecording() : startRecording();
    });
  }

  appendMessage('Roy', "Welcome. I'm Roy. Speak when ready.");

  function analyzeEmotion(analyser) {
    const buffer = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(buffer);
    const avg = buffer.reduce((a, b) => a + b, 0) / buffer.length;

    if (avg > 140) return 'angry';
    if (avg > 100) return 'tense';
    if (avg > 60) return 'neutral';
    return 'sad';
  }

  function transformRoyPersona(text, tone = 'neutral') {
    const cbtPatterns = [
      { pattern: /i(?:'|’)m a failure/gi, replace: "That sounds like a heavy conclusion. Is it truly accurate?" },
      { pattern: /nobody cares/gi, replace: "Are you sure that's not a distortion? Let's examine the evidence." },
      { pattern: /i always (fail|get it wrong)/gi, replace: "'Always' is a strong word. Could we explore that more rationally?" },
    ];

    let output = text;
    for (const { pattern, replace } of cbtPatterns) {
      if (pattern.test(output)) {
        output += ' ' + replace;
      }
    }

    const poeticLayer = [
      "Let’s take this thought apart together.",
      "A mind in motion is not a mind broken.",
      "Where there is confusion, there’s usually a question worth asking.",
      "Even shadows come from light. Let’s look closer."
    ];

    if (Math.random() < 0.6) {
      output = poeticLayer[Math.floor(Math.random() * poeticLayer.length)] + ' ' + output;
    }

    if (tone === 'sad') {
      output += ' It sounds like you’re carrying something heavy. Let’s slow down and look at it together.';
    } else if (tone === 'tense') {
      output += ' I hear a lot of energy in your voice. Let’s find the thought beneath that intensity.';
    } else if (tone === 'angry') {
      output += ' Strong feelings can hide softer truths. I’m here to explore them with you.';
    }

    return output;
  }
});
