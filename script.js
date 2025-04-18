window.addEventListener('DOMContentLoaded', () => {
  console.log('Whisper mode initialized');

  const royAudio = new Audio();
  royAudio.setAttribute('playsinline', 'true');
  const container = document.createElement('div');
  container.id = 'synth-wrapper';
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.alignItems = 'center';
  container.style.justifyContent = 'center';
  container.style.padding = '1rem';
  container.style.maxWidth = '100%';
  container.style.boxSizing = 'border-box';
  document.body.appendChild(container);

  // Inject missing DOM elements
  container.innerHTML += `
    <div style="display:flex; justify-content:space-between; width:100%; font-size:0.9rem;">
      <div id="current-date"></div>
      <div id="current-time"></div>
      <div id="countdown-timer"></div>
    </div>
    <canvas id="userWaveform"></canvas>
    <canvas id="royWaveform"></canvas>
    <button id="mic-toggle">Speak</button>
    <div id="chat"></div>
  `;

  // Mobile-first layout style
  const style = document.createElement('style');
  style.textContent = `
    html, body {
      margin: 0;
      padding: 0;
      background: #000;
      color: #0ff;
      font-family: 'Courier New', monospace;
      display: flex;
      justify-content: center;
      align-items: center;
      flex-direction: column;
      min-height: 100vh;
      overflow-x: hidden;
    }
    #synth-wrapper {
      width: 100vw;
      max-width: 480px;
      padding: 1rem;
      box-sizing: border-box;
    }
    canvas {
      width: 100%;
      height: auto;
    }
    #mic-toggle {
      width: 100%;
      max-width: 300px;
      border: 2px solid cyan;
      color: cyan;
      background: black;
      font-family: inherit;
      font-size: 1.2rem;
      padding: 10px;
      margin: 1rem auto;
      display: block;
    }
    #chat {
      width: 100%;
      max-height: 40vh;
      overflow-y: auto;
      font-size: 1rem;
      padding: 1rem 0;
    }
    @media (max-width: 480px) {
      #mic-toggle {
        font-size: 1rem;
        padding: 12px;
      }
      #chat {
        font-size: 0.9rem;
      }
    }
  `;
  document.head.appendChild(style);
  container.appendChild(royAudio);

  const micBtn = document.getElementById('mic-toggle');
  micBtn.style.minWidth = '60px';
  micBtn.style.minHeight = '60px';
  micBtn.style.fontSize = '1rem';
  micBtn.style.borderRadius = '6px';
  micBtn.style.padding = '10px';
  micBtn.style.marginTop = '10px';
  const chatBox = document.getElementById('chat');
  const userCanvas = document.getElementById('userWaveform');
  const royCanvas = document.getElementById('royWaveform');
  const userCtx = userCanvas.getContext('2d');
  const royCtx = royCanvas.getContext('2d');
  const dateEl = document.getElementById('current-date');
  const timeEl = document.getElementById('current-time');
  const countdownEl = document.getElementById('countdown-timer');

  userCanvas.height = Math.floor(window.innerHeight * 0.15);
  royCanvas.height = Math.floor(window.innerHeight * 0.15);

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

        showThinkingDots();

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
          console.error('Whisper transcription error:', err);
          appendMessage('Roy', 'Transcription failed.');
        }
      };

      mediaRecorder.start();
      isRecording = true;
      micBtn.textContent = 'Stop';
      micBtn.classList.add('recording');
      micBtn.style.borderColor = 'magenta';
    } catch (err) {
      console.error('Mic error:', err);
      appendMessage('Roy', 'Mic permission error.');
    }
  }

  async function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
    if (stream) stream.getTracks().forEach(t => t.stop());
    micBtn.textContent = 'Speak';
    micBtn.classList.remove('recording');
    micBtn.style.borderColor = 'cyan';
    isRecording = false;
  }

  function appendMessage(sender, text) {
    if (!chatBox) return;
    const p = document.createElement('p');
    p.className = sender.toLowerCase();
    const color = sender === 'Roy' ? 'yellow' : 'white';
    p.innerHTML = `<strong style='color: ${color}'>${sender}:</strong> <span style='color: ${color}'>${text}</span>`; 
  }

  function typeRoyMessage(text, tone = 'neutral') {
    const prefaces = {
      sad: [
        "There’s something delicate in the air…",
        "This feels like a moment worth sitting with…",
        "Let’s tread gently here."
      ],
      tense: [
        "Energy like yours often hides something deeper…",
        "You’re carrying a lot. Let’s place it down together.",
        "Take a breath — let’s navigate this steadily."
      ],
      angry: [
        "Even fire can illuminate. Let’s look closer.",
        "Anger can speak in riddles. Let’s translate together.",
        "Sharp emotions often protect soft truths."
      ],
      neutral: [
        "Let’s reflect on that together.",
        "Here’s a thought worth exploring…",
        "Let’s unravel that gently."
      ]
    };
    const prefixPool = prefaces[tone] || prefaces.neutral;
    const intro = prefixPool[Math.floor(Math.random() * prefixPool.length)];
    text = intro + ' ' + text;
    const p = document.createElement('p');
    p.className = 'roy';
    const label = document.createElement('strong');
    label.style.color = 'yellow';
    label.textContent = 'Roy:';
    const span = document.createElement('span');
    span.style.color = 'yellow';
    span.textContent = '';
    p.appendChild(label);
    p.appendChild(document.createTextNode(' '));
    p.appendChild(span);
    chatBox.appendChild(p);
    let index = 0;
    const delay = tone === 'sad' ? 80 : tone === 'tense' ? 40 : tone === 'angry' ? 30 : 50;
    const interval = setInterval(() => {
      if (index < text.length) {
        span.textContent += text.charAt(index);
        index++;
      } else {
        clearInterval(interval);
      }
    }, delay);
    chatBox.appendChild(p);
  chatBox.scrollTop = chatBox.scrollHeight;
  }

  function showThinkingDots() {
    if (!chatBox) return;
    thinkingDotsEl = document.createElement('p');
    thinkingDotsEl.className = 'roy';
    thinkingDotsEl.innerHTML = "<strong style='color: yellow'>Roy:</strong> <span id='dots' style='color: yellow'>.</span>";
    chatBox.appendChild(thinkingDotsEl);
    let dots = 1;
    const interval = setInterval(() => {
      if (!thinkingDotsEl) return clearInterval(interval);
      const dotStr = '.'.repeat((dots % 3) + 1);
      document.getElementById('dots').textContent = dotStr;
      dots++;
    }, 500);
  }

  async function fetchRoyResponse(text, tone = 'neutral') {
    try {
      const res = await fetch('https://roy-chatbo-backend.onrender.com/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, mode: 'both' })
      });
      const data = await res.json();
      if (thinkingDotsEl) thinkingDotsEl.remove();
      thinkingDotsEl = null;
      if (data.text) typeRoyMessage(data.text, tone);
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
});
