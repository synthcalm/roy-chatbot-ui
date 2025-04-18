// SynthCalm Roy: Full-featured script.js

window.addEventListener('DOMContentLoaded', () => {
  const dateEl = document.getElementById('current-date');
  const timeEl = document.getElementById('current-time');
  const countdownEl = document.getElementById('countdown-timer');
  const chatBox = document.getElementById('chat');
  const micBtn = document.getElementById('mic-toggle');
  const saveBtn = document.getElementById('save-log');
  const royCanvas = document.getElementById('royWaveform');
  const userCanvas = document.getElementById('userWaveform');
  const royCtx = royCanvas.getContext('2d');
  const userCtx = userCanvas.getContext('2d');
  const royAudio = new Audio();
  let audioContext, mediaRecorder, analyser, stream;
  let recording = false;
  let sessionStart = Date.now();
  let recordedChunks = [];

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
      setTimeout(() => typeRoyMessage(el, text, i + 1), 30);
    }
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

      recordedChunks = [];
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = e => e.data.size > 0 && recordedChunks.push(e.data);
      mediaRecorder.onstop = async () => {
        const blob = new Blob(recordedChunks, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('audio', blob);

        let dots = document.createElement('p');
        dots.innerHTML = "<strong style='color:yellow'>Roy:</strong> <span class='thinking-dots'>.</span>";
        chatBox.appendChild(dots);
        let dotCount = 1;
        const dotTimer = setInterval(() => {
          dotCount = (dotCount % 3) + 1;
          dots.querySelector('span').textContent = '.'.repeat(dotCount);
        }, 400);

        try {
          const res = await fetch('https://roy-chatbo-backend.onrender.com/api/transcribe', {
            method: 'POST', body: formData
          });
          const data = await res.json();
          chatBox.removeChild(dots);
          if (data.text) {
            appendMessage('You', data.text);
            fetchRoyResponse(data.text);
          } else {
            appendMessage('Roy', "Couldn't understand that.");
          }
        } catch (err) {
          console.error('Whisper transcription error:', err);
          appendMessage('Roy', 'Transcription failed.');
        } finally {
          clearInterval(dotTimer);
        }
      };

      mediaRecorder.start();
      micBtn.textContent = 'Stop';
      micBtn.style.borderColor = 'magenta';
      recording = true;
    } catch (err) {
      console.error('Mic error:', err);
      appendMessage('Roy', 'Mic permission error.');
    }
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
    if (stream) stream.getTracks().forEach(t => t.stop());
    micBtn.textContent = 'Speak';
    micBtn.style.borderColor = 'cyan';
    recording = false;
  }

  async function fetchRoyResponse(text) {
    try {
      const emotion = analyzeEmotion(text); // mock emotion handler
      const res = await fetch('https://roy-chatbo-backend.onrender.com/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, emotion, mode: 'both' })
      });
      const data = await res.json();
      if (data.text) appendMessage('Roy', data.text, true);
      if (data.audio) {
        royAudio.src = `data:audio/mp3;base64,${data.audio}`;
        royAudio.play().catch(e => console.warn('Audio play error:', e));
        drawWaveformRoy(royAudio);
      }
    } catch (err) {
      console.error('Roy response failed:', err);
      appendMessage('Roy', 'Error generating response.');
    }
  }

  function analyzeEmotion(text) {
    if (/hate|angry|stupid/.test(text.toLowerCase())) return 'anger';
    if (/sad|upset|depressed/.test(text.toLowerCase())) return 'sadness';
    if (/happy|grateful|thank/.test(text.toLowerCase())) return 'joy';
    return 'neutral';
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
      for (let x = 0; x <= canvas.width; x += 20) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
      }
      for (let y = 0; y <= canvas.height; y += 20) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
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
      for (let x = 0; x <= royCanvas.width; x += 20) {
        royCtx.beginPath(); royCtx.moveTo(x, 0); royCtx.lineTo(x, royCanvas.height); royCtx.stroke();
      }
      for (let y = 0; y <= royCanvas.height; y += 20) {
        royCtx.beginPath(); royCtx.moveTo(0, y); royCtx.lineTo(royCanvas.width, y); royCtx.stroke();
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
    recording ? stopRecording() : startRecording();
  });

  appendMessage('Roy', "Welcome. I'm Roy. Speak when ready.");
});
