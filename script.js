// script.js (updated for natural flow and retro UI)
const royBtn = document.getElementById('royBtn');
const randyBtn = document.getElementById('randyBtn');
const speakBtn = document.getElementById('speakBtn');
const messagesDiv = document.getElementById('messages');
const userCanvas = document.getElementById('userWaveform');
const royCanvas = document.getElementById('royWaveform');
const userCtx = userCanvas.getContext('2d');
const royCtx = royCanvas.getContext('2d');

let selectedPersona = null;
let mediaRecorder, audioChunks = [], isRecording = false;
let userAudioContext = null;
let royAudioContext = null;
let royAudioSource = null;
let stream = null;

function initButtonStyles() {
  royBtn.style.border = '1px solid cyan';
  randyBtn.style.border = '1px solid cyan';
  speakBtn.style.backgroundColor = 'black';
  speakBtn.style.color = 'cyan';
  speakBtn.style.border = '1px solid cyan';
}

function addMessage(text, sender) {
  const msg = document.createElement('p');
  msg.className = sender;
  msg.textContent = text;
  messagesDiv.appendChild(msg);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function drawWaveform(canvasCtx, canvas, data, color) {
  canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
  canvasCtx.beginPath();
  const sliceWidth = canvas.width / data.length;
  const centerY = canvas.height / 2;
  const scale = 50;
  for (let i = 0; i < data.length; i++) {
    const normalized = (data[i] / 128.0) - 1;
    const y = centerY + (normalized * scale);
    const x = i * sliceWidth;
    if (i === 0) canvasCtx.moveTo(x, y);
    else canvasCtx.lineTo(x, y);
  }
  canvasCtx.strokeStyle = color;
  canvasCtx.lineWidth = 2;
  canvasCtx.stroke();
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
        speakBtn.style.backgroundColor = 'red';
        speakBtn.style.color = 'white';
        speakBtn.style.border = '1px solid red';
      });
    } catch (error) { console.error('Audio playback failed:', error); }
  });
  audioEl.load();
}

// Persona selection and recording logic remain unchanged from the working version.
// The visual style, waveform drawing, and button interactions have been restored to your preferred retro neon look.
