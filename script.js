// This new script turns the ROY button into the Speak/Stop button
// and converts the old SPEAK button into a fallback Play Reply button.

const royBtn = document.getElementById('royBtn');
const randyBtn = document.getElementById('randyBtn');
const playBtn = document.getElementById('speakBtn'); // now the play button
const saveBtn = document.getElementById('saveBtn');
const homeBtn = document.getElementById('homeBtn');
const messagesDiv = document.getElementById('messages');
const userCanvas = document.getElementById('userWaveform');
const royCanvas = document.getElementById('royWaveform');
const scopesContainer = document.getElementById('scopes-container');
const userCtx = userCanvas.getContext('2d');
const royCtx = royCanvas.getContext('2d');
const dateTimeSpan = document.getElementById('date-time');
const countdownTimerSpan = document.getElementById('countdown-timer');

let mediaRecorder, audioChunks = [], isRecording = false;
let selectedPersona = 'roy';
let userAudioContext = null;
let royAudioContext = null;
let royAudioSource = null;
let stream = null;
let cachedAudioEl = null;

function resetRoyButton() {
  royBtn.textContent = 'ROY';
  royBtn.style.backgroundColor = 'green';
  royBtn.style.color = 'white';
  royBtn.style.border = '1px solid green';
  royBtn.classList.remove('blinking');
}

function activateRoyButtonRecording() {
  royBtn.textContent = 'STOP';
  royBtn.classList.add('blinking');
  royBtn.style.backgroundColor = 'red';
  royBtn.style.color = 'white';
  royBtn.style.border = '1px solid red';
}

function drawWaveform(ctx, canvas, data, color) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.beginPath();
  const sliceWidth = canvas.width / data.length;
  const centerY = canvas.height / 2;
  for (let i = 0; i < data.length; i++) {
    const normalized = (data[i] / 128.0) - 1;
    const y = centerY + normalized * 70;
    const x = i * sliceWidth;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function setupUserMic(stream) {
  if (userAudioContext) userAudioContext.close();
  userAudioContext = new (window.AudioContext || window.webkitAudioContext)();
  const source = userAudioContext.createMediaStreamSource(stream);
  const analyser = userAudioContext.createAnalyser();
  analyser.fftSize = 2048;
  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  source.connect(analyser);
  function animate() {
    if (!isRecording) {
      userCtx.clearRect(0, 0, userCanvas.width, userCanvas.height);
      return;
    }
    analyser.getByteTimeDomainData(dataArray);
    drawWaveform(userCtx, userCanvas, dataArray, 'yellow');
    requestAnimationFrame(animate);
  }
  animate();
}

function playRoyAudio(base64Audio) {
  const audioEl = new Audio(`data:audio/wav;base64,${base64Audio}`);
  audioEl.setAttribute('playsinline', '');
  cachedAudioEl = audioEl;
  royAudioContext = new (window.AudioContext || window.webkitAudioContext)();
  audioEl.addEventListener('loadedmetadata', () => {
    try {
      const source = royAudioContext.createMediaElementSource(audioEl);
      const analyser = royAudioContext.createAnalyser();
      analyser.fftSize = 2048;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      source.connect(analyser);
      analyser.connect(royAudioContext.destination);
      function animate() {
        analyser.getByteTimeDomainData(dataArray);
        drawWaveform(royCtx, royCanvas, dataArray, 'magenta');
        if (!audioEl.paused) requestAnimationFrame(animate);
      }
      animate();
      royAudioContext.resume().then(() => audioEl.play().catch(() => {
        playBtn.style.display = 'inline-block';
      }));
      audioEl.onended = () => royCtx.clearRect(0, 0, royCanvas.width, royCanvas.height);
    } catch (e) {
      console.error('Roy waveform error:', e);
      playBtn.style.display = 'inline-block';
    }
  });
  audioEl.load();
}

royBtn.addEventListener('click', async () => {
  if (isRecording) {
    mediaRecorder?.stop();
    return;
  }

  isRecording = true;
  activateRoyButtonRecording();
  audioChunks = [];
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    setupUserMic(stream);
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = e => e.data.size > 0 && audioChunks.push(e.data);
    mediaRecorder.onstop = async () => {
      resetRoyButton();
      userCtx.clearRect(0, 0, userCanvas.width, userCanvas.height);
      const blob = new Blob(audioChunks, { type: 'audio/wav' });
      const formData = new FormData();
      formData.append('audio', blob);
      formData.append('bot', 'roy');
      const userMsg = document.createElement('p');
      userMsg.textContent = 'You: ...';
      userMsg.className = 'user';
      messagesDiv.appendChild(userMsg);
      const botMsg = document.createElement('p');
      botMsg.textContent = 'Roy: ...';
      botMsg.className = 'roy';
      messagesDiv.appendChild(botMsg);

      try {
        const tRes = await fetch('https://roy-chatbo-backend.onrender.com/api/transcribe', { method: 'POST', body: formData });
        const tData = await tRes.json();
        console.log('[iOS DEBUG] Transcription response:', tData);
        userMsg.textContent = 'You: ' + (tData.text || '(transcription failed)');

        const cRes = await fetch('https://roy-chatbo-backend.onrender.com/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: tData.text, persona: 'roy' })
        });
        const cData = await cRes.json();
        console.log('[iOS DEBUG] Chat response:', cData);
        botMsg.textContent = 'Roy: ' + (cData.text || '(no reply)');

        if (cData.audio) playRoyAudio(cData.audio);
        else playBtn.style.display = 'none';

      } catch (error) {
        console.error('[Roy Error] Transcribe or chat failed:', error);
        userMsg.textContent = 'You: (network error)';
        botMsg.textContent = 'Roy: (no reply)';
        playBtn.style.display = 'none';
      }

      isRecording = false;
    };
    mediaRecorder.start();
  } catch (e) {
    alert('Microphone access denied.');
    resetRoyButton();
    isRecording = false;
  }
});

playBtn.addEventListener('click', () => {
  if (cachedAudioEl) {
    cachedAudioEl.play();
    playBtn.style.display = 'none';
  }
});

homeBtn.addEventListener('click', () => {
  window.location.href = 'https://synthcalm.com';
});

saveBtn.addEventListener('click', () => {
  const blob = new Blob([messagesDiv.innerText], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'conversation.txt';
  a.click();
});

window.addEventListener('load', () => {
  playBtn.textContent = '▶️ Play Roy';
  playBtn.style.display = 'none';
  resetRoyButton();
});

document.head.insertAdjacentHTML('beforeend', `
  <style>
    .blinking {
      animation: blink 1s step-start infinite;
    }
    @keyframes blink {
      50% { opacity: 0.3; }
    }
  </style>
`);
