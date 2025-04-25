// === FULL WORKING Roy Chatbot SCRIPT ===

// GLOBAL VARIABLES
let royState = 'idle';
let randyState = 'idle';
let mediaRecorder, audioChunks = [];
let userWaveformCtx, royWaveformCtx, analyser, dataArray, source, userAudioContext, royAudioContext;
let recognition;

// === iOS CHECK ===
function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

// === INFO BAR: DATE/TIME + COUNTDOWN TIMER ===
function updateDateTime() {
  const dateTimeDiv = document.getElementById('date-time');
  if (dateTimeDiv) {
    dateTimeDiv.textContent = new Date().toLocaleString();
    setInterval(() => {
      dateTimeDiv.textContent = new Date().toLocaleString();
    }, 1000);
  }
}

function updateCountdownTimer() {
  const countdownDiv = document.getElementById('countdown-timer');
  let timeLeft = 3600;
  const updateTimer = () => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    countdownDiv.textContent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    timeLeft = (timeLeft - 1 + 3600) % 3600;
  };
  updateTimer();
  setInterval(updateTimer, 1000);
}

// === WAVEFORM SETUP ===
function initWaveforms() {
  const container = document.getElementById('grid-area');
  container.style.background = `repeating-linear-gradient(0deg, rgba(0,255,255,0.2) 0 1px, transparent 1px 20px),
                                repeating-linear-gradient(90deg, rgba(255,255,0,0.2) 0 1px, transparent 1px 20px)`;
  container.style.border = '2px solid cyan';
  container.style.padding = '10px';
  container.style.boxSizing = 'border-box';
  container.style.maxWidth = '900px';
  container.style.margin = '0 auto';
  container.style.minHeight = '150px';

  const userWaveform = document.getElementById('user-waveform');
  const royWaveform = document.getElementById('roy-waveform');
  userWaveformCtx = userWaveform.getContext('2d');
  royWaveformCtx = royWaveform.getContext('2d');
  userWaveform.width = userWaveform.offsetWidth;
  userWaveform.height = 100;
  royWaveform.width = royWaveform.offsetWidth;
  royWaveform.height = 100;
}

function drawWaveform(ctx, canvas, data) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.beginPath();
  const sliceWidth = canvas.width / data.length;
  let x = 0;
  for (let i = 0; i < data.length; i++) {
    const v = data[i] / 128.0;
    const y = (v * canvas.height) / 2;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    x += sliceWidth;
  }
  ctx.strokeStyle = 'yellow';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function animateUserWaveform() {
  if (royState !== 'engaged' && randyState !== 'engaged') return;
  if (analyser && dataArray) {
    analyser.getByteTimeDomainData(dataArray);
    drawWaveform(userWaveformCtx, document.getElementById('user-waveform'), dataArray);
    requestAnimationFrame(animateUserWaveform);
  }
}

function animateRoyWaveform(audio) {
  if (royAudioContext) {
    try { royAudioContext.close(); } catch (e) {}
  }
  royAudioContext = new (window.AudioContext || window.webkitAudioContext)();
  const analyser = royAudioContext.createAnalyser();
  analyser.fftSize = 2048;
  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  const source = royAudioContext.createMediaElementSource(audio);
  const gainNode = royAudioContext.createGain();
  gainNode.gain.value = 4.5;

  source.connect(gainNode);
  gainNode.connect(analyser);
  analyser.connect(royAudioContext.destination);

  function draw() {
    if (audio.paused || audio.ended) {
      royAudioContext.close();
      return;
    }
    analyser.getByteTimeDomainData(dataArray);
    drawWaveform(royWaveformCtx, document.getElementById('roy-waveform'), dataArray);
    requestAnimationFrame(draw);
  }

  audio.onplay = () => draw();
  audio.play().catch(console.error);
}

// === MESSAGE HANDLING ===
function scrollMessages() {
  const messages = document.getElementById('messages');
  messages.scrollTop = messages.scrollHeight;
}

function appendUserMessage(message) {
  const messages = document.getElementById('messages');
  messages.innerHTML += `<div class="user">You: ${message}</div>`;
  scrollMessages();
}

function appendRoyMessage(message) {
  const messages = document.getElementById('messages');
  messages.innerHTML += `<div class="roy">Roy: ${message}</div>`;
  scrollMessages();
}

// === BUTTON LOGIC ===
document.addEventListener('DOMContentLoaded', () => {
  updateDateTime();
  updateCountdownTimer();
  initWaveforms();

  const royBtn = document.getElementById('royBtn');
  const randyBtn = document.getElementById('randyBtn');
  const speakBtn = document.getElementById('speakBtn');

  function resetButtons() {
    royBtn.style.backgroundColor = '';
    randyBtn.style.backgroundColor = '';
    speakBtn.style.backgroundColor = '';
    speakBtn.textContent = 'SPEAK';
    speakBtn.classList.remove('blinking');
    royState = 'idle';
    randyState = 'idle';
  }

  royBtn.addEventListener('click', () => {
    if (royState === 'idle') {
      royState = 'engaged';
      randyState = 'idle';
      royBtn.style.backgroundColor = 'green';
      randyBtn.style.backgroundColor = '';
      speakBtn.style.backgroundColor = 'red';
      speakBtn.textContent = 'STOP';
      speakBtn.classList.add('blinking');
      startRecording();
    } else {
      stopRecording();
      resetButtons();
    }
  });

  randyBtn.addEventListener('click', () => {
    if (randyState === 'idle') {
      randyState = 'engaged';
      royState = 'idle';
      randyBtn.style.backgroundColor = 'orange';
      royBtn.style.backgroundColor = '';
      speakBtn.style.backgroundColor = 'red';
      speakBtn.textContent = 'STOP';
      speakBtn.classList.add('blinking');
      startRecording();
    } else {
      stopRecording();
      resetButtons();
    }
  });

  speakBtn.addEventListener('click', () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      stopRecording();
      resetButtons();
    }
  });
});

// === RECORDING ===
async function startRecording() {
  userAudioContext = new (window.AudioContext || window.webkitAudioContext)();
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  source = userAudioContext.createMediaStreamSource(stream);
  analyser = userAudioContext.createAnalyser();
  analyser.fftSize = 2048;
  dataArray = new Uint8Array(analyser.frequencyBinCount);
  source.connect(analyser);
  mediaRecorder = new MediaRecorder(stream);
  audioChunks = [];
  mediaRecorder.ondataavailable = event => audioChunks.push(event.data);
  mediaRecorder.onstop = handleStop;
  mediaRecorder.start();
  animateUserWaveform();
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
  }
}

// === HANDLE STOP ===
function handleStop() {
  const blob = new Blob(audioChunks, { type: 'audio/webm' });
  const audioURL = URL.createObjectURL(blob);
  const audio = new Audio(audioURL);
  animateRoyWaveform(audio);
  appendUserMessage('...sending your message...');

  const formData = new FormData();
  formData.append('audio', blob, 'recording.webm');
  formData.append('persona', royState === 'engaged' ? 'roy' : 'randy');

  fetch('https://roy-chatbo-backend.onrender.com/api/chat', {
    method: 'POST',
    body: formData
  })
  .then(response => response.json())
  .then(data => {
    if (data.text) {
      appendRoyMessage(data.text);
    }
    if (data.audioUrl) {
      const royReplyAudio = new Audio(data.audioUrl);
      animateRoyWaveform(royReplyAudio);
      royReplyAudio.play();
    }
  })
  .catch(error => {
    appendRoyMessage('Oops, something went wrong...');
    console.error('Error during feedback:', error);
  });
}
