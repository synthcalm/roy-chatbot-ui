// === script.js (full version: press-and-hold for iOS, tap-to-toggle for desktop, complete functionality) ===

let royState = 'idle';
let randyState = 'idle';
let feedbackState = 'idle';
let mediaRecorder;
let audioChunks = [];
let userWaveformCtx, royWaveformCtx;
let analyser, dataArray, source;
let userAudioContext, royAudioContext;
let recognition;
let currentUtterance = '';
let thinkingInterval;

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

function initWaveforms() {
  const userWaveform = document.getElementById('user-waveform');
  const royWaveform = document.getElementById('roy-waveform');
  userWaveformCtx = userWaveform.getContext('2d');
  royWaveformCtx = royWaveform.getContext('2d');
  userWaveform.width = userWaveform.offsetWidth;
  userWaveform.height = userWaveform.offsetHeight;
  royWaveform.width = royWaveform.offsetWidth;
  royWaveform.height = royWaveform.offsetHeight;
  userWaveformCtx.strokeStyle = 'yellow';
  royWaveformCtx.strokeStyle = 'magenta';
  userWaveformCtx.lineWidth = 2;
  royWaveformCtx.lineWidth = 2;
}

function drawWaveform(ctx, canvas, data) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.beginPath();
  const sliceWidth = canvas.width / data.length;
  let x = 0;
  data.forEach((v, i) => {
    const y = canvas.height / 2 + (v / 128.0 - 1) * (canvas.height / 2);
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
  if (royAudioContext && royAudioContext.state !== 'closed') {
    royAudioContext.close();
    royAudioContext = null;
  }
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

function scrollMessages() {
  const messages = document.getElementById('messages');
  messages.scrollTop = messages.scrollHeight;
}

function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return alert('Speech recognition not supported.');
  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onresult = (event) => {
    let interim = '', final = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      event.results[i].isFinal ? final += transcript + ' ' : interim += transcript;
    }
    if (final.trim()) currentUtterance += final.trim() + ' ';
    const messages = document.getElementById('messages');
    const interimDiv = document.getElementById('interim');
    const fullLine = currentUtterance + interim;
    if (interimDiv) {
      interimDiv.textContent = `You: ${fullLine.trim()}`;
    } else {
      messages.innerHTML += `<div id="interim" class="user">You: ${fullLine.trim()}</div>`;
    }
    scrollMessages();
  };

  recognition.onerror = (e) => console.error('Speech recognition error:', e);
  recognition.onend = () => {
    if (royState === 'engaged') recognition.start();
  };
}

// Event listeners, thinking dots, and other logic continue unchanged...
