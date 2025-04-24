// === script.js (FULL WORKING VERSION INCLUDING INITIALIZATION) ===

let royState = 'idle';
let feedbackState = 'idle';
let mediaRecorder;
let audioChunks = [];
let userWaveformCtx, royWaveformCtx;
let analyser, dataArray, source;
let userAudioContext, royAudioContext;
let recognition;
let currentUtterance = '';
let thinkingInterval;
let feedbackBlinkInterval;

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

function updateDateTime() {
  const dateTimeDiv = document.getElementById('date-time');
  if (dateTimeDiv) dateTimeDiv.textContent = new Date().toLocaleString();
}

function updateCountdownTimer() {
  const countdownDiv = document.getElementById('countdown-timer');
  let timeLeft = 60 * 60;
  setInterval(() => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    countdownDiv.textContent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    timeLeft = (timeLeft - 1 + 3600) % 3600;
  }, 1000);
}

function scrollMessages() {
  const messages = document.getElementById('messages');
  messages.scrollTop = messages.scrollHeight;
}

function generateRandomRoyResponse(baseText) {
  const variations = [
    `${baseText}`,
    `Hmm... ${baseText}`,
    `You know, I was just thinking — ${baseText}`,
    `Alright, so here’s the thing: ${baseText}`,
    `Yeah, man... ${baseText}`
  ];
  return variations[Math.floor(Math.random() * variations.length)];
}

function initWaveforms() {
  const container = document.getElementById('grid-area');
  container.style.background = `repeating-linear-gradient(0deg, rgba(0,255,255,0.2) 0 1px, transparent 1px 20px), repeating-linear-gradient(90deg, rgba(255,255,0,0.2) 0 1px, transparent 1px 20px)`;
  container.style.border = '2px solid cyan';
  container.style.padding = '10px';
  container.style.boxSizing = 'border-box';
  container.style.maxWidth = '900px';
  container.style.margin = '0 auto';

  const userWaveform = document.getElementById('user-waveform');
  const royWaveform = document.getElementById('roy-waveform');
  userWaveformCtx = userWaveform.getContext('2d');
  royWaveformCtx = royWaveform.getContext('2d');
  userWaveform.width = userWaveform.offsetWidth;
  userWaveform.height = 100;
  royWaveform.width = royWaveform.offsetWidth;
  royWaveform.height = 100;
  userWaveformCtx.strokeStyle = 'yellow';
  royWaveformCtx.strokeStyle = 'magenta';
  userWaveformCtx.lineWidth = 6;
  royWaveformCtx.lineWidth = 2;
}

function drawWaveform(ctx, canvas, data) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.beginPath();
  const sliceWidth = canvas.width / data.length;
  let x = 0;
  data.forEach((v, i) => {
    const y = canvas.height / 2 + (Math.sin(x * 0.1) * (v / 128.0 - 1) * (canvas.height / 2));
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    x += sliceWidth;
  });
  ctx.stroke();
}

function animateUserWaveform() {
  if (royState !== 'engaged') return;
  analyser.getByteTimeDomainData(dataArray);
  drawWaveform(userWaveformCtx, document.getElementById('user-waveform'), dataArray);
  requestAnimationFrame(animateUserWaveform);
}

function animateRoyWaveform(audio) {
  if (royAudioContext) royAudioContext.close();
  royAudioContext = new AudioContext();
  const analyser = royAudioContext.createAnalyser();
  const dataArray = new Uint8Array(analyser.fftSize);
  const source = royAudioContext.createMediaElementSource(audio);
  const gainNode = royAudioContext.createGain();
  gainNode.gain.value = 4.5;

  source.connect(gainNode);
  gainNode.connect(analyser);
  analyser.connect(royAudioContext.destination);

  audio.onplay = () => {
    function draw() {
      if (audio.paused) return royAudioContext.close();
      analyser.getByteTimeDomainData(dataArray);
      drawWaveform(royWaveformCtx, document.getElementById('roy-waveform'), dataArray);
      requestAnimationFrame(draw);
    }
    draw();
  };
  audio.play().catch(console.error);
}

function showThinkingDots() {
  const messages = document.getElementById('messages');
  const thinkingDiv = document.createElement('div');
  thinkingDiv.id = 'thinking';
  thinkingDiv.classList.add('roy');
  thinkingDiv.textContent = 'Roy: thinking';
  messages.appendChild(thinkingDiv);
  scrollMessages();
  let dotCount = 0;
  thinkingInterval = setInterval(() => {
    dotCount = (dotCount + 1) % 4;
    thinkingDiv.textContent = `Roy: thinking${'.'.repeat(dotCount)}`;
    scrollMessages();
  }, 500);
}

function stopThinkingDots() {
  clearInterval(thinkingInterval);
  const thinkingDiv = document.getElementById('thinking');
  if (thinkingDiv) thinkingDiv.remove();
}
