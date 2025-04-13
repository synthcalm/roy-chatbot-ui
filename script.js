window.addEventListener('DOMContentLoaded', () => {
  const micBtn = document.getElementById('mic-toggle');
  const sendBtn = document.getElementById('send-button');
  const saveBtn = document.getElementById('save-log');
  const inputEl = document.getElementById('user-input');
  const messagesEl = document.getElementById('messages');
  const audioEl = document.getElementById('roy-audio');
  const modeSelect = document.getElementById('responseMode');
  const dateSpan = document.getElementById('current-date');
  const timeSpan = document.getElementById('current-time');
  const timerSpan = document.getElementById('countdown-timer');

  const sessionId = `session-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const greetings = ["Welcome. I'm Roy. You may speak using 'Speak' mode or type below."];

  let isRecording = false;
  let stream, mediaRecorder, chunks = [];
  let sessionStart = Date.now();

  const userCanvas = document.getElementById('userWaveform');
  const userCtx = userCanvas.getContext('2d');
  let userAudioContext, userAnalyser, userDataArray;

  const royCanvas = document.getElementById('royWaveform');
  const royCtx = royCanvas.getContext('2d');
  let royAudioContext, royAnalyser, royDataArray;

  appendMessage('Roy', greetings[0]);

  function updateClockAndTimer() {
    const now = new Date();
    const elapsed = Math.floor((Date.now() - sessionStart) / 1000);
    const remaining = Math.max(0, 3600 - elapsed);
    const min = String(Math.floor(remaining / 60)).padStart(2, '0');
    const sec = String(remaining % 60).padStart(2, '0');
    dateSpan.textContent = now.toISOString().split('T')[0];
    timeSpan.textContent = now.toTimeString().split(' ')[0];
    timerSpan.textContent = `Session Ends In: ${min}:${sec}`;
  }
  setInterval(updateClockAndTimer, 1000);

  function appendMessage(sender, text) {
    const p = document.createElement('p');
    p.classList.add(sender.toLowerCase());
    p.innerHTML = `<strong>${sender}:</strong> `;
    messagesEl.appendChild(p);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    if (sender === 'Roy') {
      let i = 0;
      const typeInterval = setInterval(() => {
        if (i < text.length) {
          p.innerHTML += text.charAt(i++);
          messagesEl.scrollTop = messagesEl.scrollHeight;
        } else {
          clearInterval(typeInterval);
        }
      }, 12);
    } else {
      p.innerHTML += text;
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  }

  async function fetchRoyResponse(message) {
    appendMessage('You', message);
    inputEl.value = '';

    const thinking = document.createElement('p');
    thinking.textContent = 'Roy is thinking...';
    thinking.className = 'roy';
    messagesEl.appendChild(thinking);

    const res = await fetch('https://roy-chatbo-backend.onrender.com/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        sessionId,
        tone: "Short, grounded, emotionally intelligent with variation. Use natural interjections like 'Right', 'Hmm', 'Exactly', 'That's what I thought', etc. Avoid overusing any single phrase."
      })
    });

    thinking.remove();

    const data = await res.json();

    if (modeSelect.value !== 'voice') appendMessage('Roy', data.text);

    if (modeSelect.value !== 'text') {
      audioEl.src = `data:audio/mp3;base64,${data.audio}`;
      audioEl.play();

      audioEl.onplay = () => {
        royAudioContext = new (window.AudioContext || window.webkitAudioContext)();
        royAnalyser = royAudioContext.createAnalyser();
        royAnalyser.fftSize = 2048;
        royDataArray = new Uint8Array(royAnalyser.frequencyBinCount);
        const source = royAudioContext.createMediaElementSource(audioEl);
        source.connect(royAnalyser);
        royAnalyser.connect(royAudioContext.destination);
        drawRoyWaveform();
      };
    }
  }

  async function startRecording() {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    chunks = [];

    userAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    await userAudioContext.resume(); // ✅ iOS fix
    userAnalyser = userAudioContext.createAnalyser();
    const source = userAudioContext.createMediaStreamSource(stream);
    source.connect(userAnalyser);
    userAnalyser.fftSize = 2048;
    userDataArray = new Uint8Array(userAnalyser.frequencyBinCount);
    drawUserWaveform();

    mediaRecorder.ondataavailable = e => chunks.push(e.data);
    mediaRecorder.onstop = async () => {
      const blob = new Blob(chunks, { type: 'audio/webm' });
      const formData = new FormData();
      formData.append('audio', blob);
      const res = await fetch('https://roy-chatbo-backend.onrender.com/api/transcribe', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.text) await fetchRoyResponse(data.text);
    };

    mediaRecorder.start();
  }

  function drawUserWaveform() {
    if (!userAnalyser) return;
    requestAnimationFrame(drawUserWaveform);
    userAnalyser.getByteTimeDomainData(userDataArray);
    userCtx.fillStyle = '#000';
    userCtx.fillRect(0, 0, userCanvas.width, userCanvas.height);
    drawGrid(userCtx, userCanvas.width, userCanvas.height, 'rgba(0,255,255,0.3)');
    userCtx.strokeStyle = 'yellow';
    userCtx.beginPath();
    const sliceWidth = userCanvas.width / userDataArray.length;
    let x = 0;
    for (let i = 0; i < userDataArray.length; i++) {
      const y = (userDataArray[i] / 128.0) * userCanvas.height / 2;
      i === 0 ? userCtx.moveTo(x, y) : userCtx.lineTo(x, y);
      x += sliceWidth;
    }
    userCtx.lineTo(userCanvas.width, userCanvas.height / 2);
    userCtx.stroke();
  }

  function drawRoyWaveform() {
    if (!royAnalyser) return;
    requestAnimationFrame(drawRoyWaveform);
    royAnalyser.getByteTimeDomainData(royDataArray);
    royCtx.fillStyle = '#000';
    royCtx.fillRect(0, 0, royCanvas.width, royCanvas.height);
    drawGrid(royCtx, royCanvas.width, royCanvas.height, 'rgba(0,255,255,0.3)');
    royCtx.strokeStyle = 'magenta';
    royCtx.beginPath();
    const sliceWidth = royCanvas.width / royDataArray.length;
    let x = 0;
    for (let i = 0; i < royDataArray.length; i++) {
      const y = (royDataArray[i] / 128.0) * royCanvas.height / 2;
      i === 0 ? royCtx.moveTo(x, y) : royCtx.lineTo(x, y);
      x += sliceWidth;
    }
    royCtx.lineTo(royCanvas.width, royCanvas.height / 2);
    royCtx.stroke();
  }

  function drawGrid(ctx, width, height, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.5;
    for (let x = 0; x < width; x += 20) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    for (let y = 0; y < height; y += 20) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }
  }

  sendBtn.addEventListener('click', () => {
    const msg = inputEl.value.trim();
    if (msg) fetchRoyResponse(msg);
  });

  micBtn.addEventListener('click', () => {
    if (!isRecording) {
      micBtn.textContent = 'Stop';
      micBtn.classList.add('active');
      isRecording = true;
      startRecording();
    } else {
      micBtn.textContent = 'Speak';
      micBtn.classList.remove('active');
      isRecording = false;
      mediaRecorder.stop();
      stream.getTracks().forEach(t => t.stop());
    }
  });

  saveBtn.addEventListener('click', () => {
    console.log('TODO: Save log to Supabase');
  });
});
