// Full SynthCalm Roy script with CBT persona, emotion detection, waveform, typing, and voice
window.addEventListener('DOMContentLoaded', () => {
  const micBtn = document.getElementById('mic-toggle');
  const chatBox = document.getElementById('chat');
  const userCanvas = document.getElementById('userWaveform');
  const royCanvas = document.getElementById('royWaveform');
  const userCtx = userCanvas.getContext('2d');
  const royCtx = royCanvas.getContext('2d');
  const dateEl = document.getElementById('current-date');
  const timeEl = document.getElementById('current-time');
  const countdownEl = document.getElementById('countdown-timer');
  const royAudio = new Audio();
  let audioContext, mediaRecorder, analyser, stream;
  let isRecording = false, recordedChunks = [], sessionStart = Date.now();

  royAudio.setAttribute('playsinline', 'true');
  document.body.appendChild(royAudio);

  function updateClock() {
    const now = new Date();
    dateEl.textContent = now.toISOString().split('T')[0];
    timeEl.textContent = now.toTimeString().split(' ')[0];
    const elapsed = Math.floor((Date.now() - sessionStart) / 1000);
    const remaining = Math.max(0, 3600 - elapsed);
    countdownEl.textContent = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
  }
  setInterval(updateClock, 1000);
  updateClock();

  function appendMessage(sender, text, isTyping = false) {
    const p = document.createElement('p');
    const color = sender === 'Roy' ? 'yellow' : 'white';
    p.innerHTML = `<strong style='color:${color}'>${sender}:</strong> <span style='color:${color}'></span>`;
    chatBox.appendChild(p);
    chatBox.scrollTop = chatBox.scrollHeight;
    if (isTyping) typeRoyMessage(p.querySelector('span'), text);
    else p.querySelector('span').textContent = text;
  }

  function typeRoyMessage(el, text, i = 0) {
    if (i < text.length) {
      el.textContent += text.charAt(i);
      setTimeout(() => typeRoyMessage(el, text, i + 1), 35);
    }
  }

  function speakWithRoyPersona(text) {
    const u = new SpeechSynthesisUtterance(text);
    u.voice = speechSynthesis.getVoices().find(v => v.name.includes("Daniel") || v.lang === "en-US");
    u.pitch = 0.7;
    u.rate = 0.85;
    u.volume = 1;
    speechSynthesis.speak(u);
  }

  function analyzeEmotion(text) {
    const t = text.toLowerCase();
    if (/hate|angry|stupid/.test(t)) return "anger";
    if (/sad|upset|depressed/.test(t)) return "sadness";
    if (/happy|grateful|thank/.test(t)) return "joy";
    return "neutral";
  }

  function generateRoyResponse(userText) {
    const tone = analyzeEmotion(userText);
    if (tone === 'anger') return "Anger masks truth. What part of that pain speaks loudest to you?";
    if (tone === 'sadness') return "Even stillness holds meaning. Sit with me in this shadow, just for a moment.";
    if (tone === 'joy') return "A moment of clarity. Let’s keep that light in your hands a little longer.";
    return "Say it again—but slower. I want to hear what you’re not saying out loud.";
  }

  function showThinkingDots() {
    const p = document.createElement('p');
    p.innerHTML = "<strong style='color: yellow'>Roy:</strong> <span id='dots' style='color: yellow'>.</span>";
    chatBox.appendChild(p);
    let count = 1;
    const interval = setInterval(() => {
      const span = document.getElementById('dots');
      if (!span) return clearInterval(interval);
      span.textContent = '.'.repeat((count % 3) + 1);
      count++;
    }, 400);
    return { p, interval };
  }

  async function fetchRoyResponse(text) {
    const { p, interval } = showThinkingDots();
    const reply = generateRoyResponse(text);
    setTimeout(() => {
      clearInterval(interval);
      p.remove();
      appendMessage('Roy', reply, true);
      speakWithRoyPersona(reply);
    }, 1400);
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

      mediaRecorder = new MediaRecorder(stream);
      recordedChunks = [];
      mediaRecorder.ondataavailable = e => recordedChunks.push(e.data);

      mediaRecorder.onstop = async () => {
        const blob = new Blob(recordedChunks, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('audio', blob);
        try {
          const res = await fetch('https://roy-chatbo-backend.onrender.com/api/transcribe', {
            method: 'POST', body: formData
          });
          const data = await res.json();
          if (data.text) {
            appendMessage('You', data.text);
            fetchRoyResponse(data.text);
          } else {
            appendMessage('Roy', 'I couldn’t quite catch that.');
          }
        } catch (err) {
          console.error('Transcription error:', err);
          appendMessage('Roy', 'Transcription failed.');
        }
      };

      mediaRecorder.start();
      isRecording = true;
      micBtn.textContent = 'Stop';
      micBtn.classList.add('recording');
    } catch (err) {
      console.error('Mic access error:', err);
      appendMessage('Roy', 'Mic error.');
    }
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
    if (stream) stream.getTracks().forEach(t => t.stop());
    micBtn.textContent = 'Speak';
    micBtn.classList.remove('recording');
    isRecording = false;
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

  micBtn.addEventListener('click', () => {
    isRecording ? stopRecording() : startRecording();
  });

  appendMessage('Roy', "Welcome. I'm Roy. Speak when ready.");
});
