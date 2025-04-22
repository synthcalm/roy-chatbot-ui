// script.js (fully aligned with your requested design)

const royBtn = document.getElementById('royBtn');
const randyBtn = document.getElementById('randyBtn');
const speakBtn = document.getElementById('speakBtn');
const saveBtn = document.getElementById('saveBtn');
const homeBtn = document.getElementById('homeBtn');
const messagesDiv = document.getElementById('messages');
const userCanvas = document.getElementById('userWaveform');
const royCanvas = document.getElementById('royWaveform');
const userCtx = userCanvas.getContext('2d');
const royCtx = royCanvas.getContext('2d');
const dateTimeSpan = document.getElementById('date-time');
const countdownTimerSpan = document.getElementById('countdown-timer');

// === DATE / TIME / COUNTDOWN ===
function updateDateTime() {
  const now = new Date();
  const date = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}`;
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  dateTimeSpan.textContent = `${date} ${time}`;
}
setInterval(updateDateTime, 1000);
updateDateTime();

let countdown = 60 * 60;
function updateCountdown() {
  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;
  countdownTimerSpan.textContent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  if (countdown > 0) countdown--;
}
setInterval(updateCountdown, 1000);
updateCountdown();

// === BUTTON LOGIC ===
function resetButtonColors() {
  royBtn.classList.remove('active');
  randyBtn.classList.remove('active');
  speakBtn.classList.remove('blinking');
  speakBtn.textContent = 'SPEAK';
  isRecording = false;
  userCtx.clearRect(0, 0, userCanvas.width, userCanvas.height);
  royCtx.clearRect(0, 0, royCanvas.width, royCanvas.height);
}

function addMessage(sender, text) {
  const msg = document.createElement('p');
  msg.className = sender;
  msg.textContent = `${sender === 'user' ? 'You' : sender.charAt(0).toUpperCase() + sender.slice(1)}: ${text}`;
  messagesDiv.appendChild(msg);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function drawWaveform(ctx, canvas, data, color) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.beginPath();
  const sliceWidth = canvas.width / data.length;
  const centerY = canvas.height / 2;
  const scale = 50;
  for (let i = 0; i < data.length; i++) {
    const normalized = (data[i] / 128.0) - 1;
    const y = centerY + (normalized * scale);
    const x = i * sliceWidth;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function setupUserVisualization(stream) {
  if (userAudioContext && userAudioContext.state !== 'closed') userAudioContext.close();
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
  const audioEl = new Audio(`data:audio/mp3;base64,${base64Audio}`);
  audioEl.setAttribute('playsinline', '');
  if (royAudioContext && royAudioContext.state !== 'closed') {
    try { if (royAudioSource) royAudioSource.disconnect(); royAudioContext.close(); } catch (e) { console.log('Audio context error:', e); }
  }
  royAudioContext = new (window.AudioContext || window.webkitAudioContext)();
  audioEl.addEventListener('loadedmetadata', () => {
    try {
      royAudioSource = royAudioContext.createMediaElementSource(audioEl);
      const analyser = royAudioContext.createAnalyser();
      analyser.fftSize = 2048;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      royAudioSource.connect(analyser);
      analyser.connect(royAudioContext.destination);
      function animate() {
        analyser.getByteTimeDomainData(dataArray);
        drawWaveform(royCtx, royCanvas, dataArray, 'magenta');
        requestAnimationFrame(animate);
      }
      animate();
      royAudioContext.resume().then(() => audioEl.play().catch(err => console.warn('Audio play failed:', err)));
      audioEl.addEventListener('ended', () => {
        royCtx.clearRect(0, 0, royCanvas.width, royCanvas.height);
        speakBtn.textContent = 'SPEAK';
        speakBtn.classList.remove('blinking');
      });
    } catch (error) { console.error('Audio playback failed:', error); }
  });
  audioEl.load();
}

// Greet on page load
window.addEventListener('DOMContentLoaded', () => {
  addMessage('roy', 'Hey there, my friend. Roy here, fully operational and ready for action. What’s on your mind today?');
  updateDateTime();
  updateCountdown();
});
