// === FULL WORKING SCRIPT ===

// GLOBAL VARIABLES
let royState = 'idle';
let randyState = 'idle';
let mediaRecorder, audioChunks = [];
let userWaveformCtx, royWaveformCtx, analyser, dataArray, source, userAudioContext, royAudioContext;
let recognition, thinkingInterval;

// iOS Check
function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

// DATE/TIME INFO BAR
function updateDateTime() {
  const dateTimeDiv = document.getElementById('date-time');
  if (dateTimeDiv) {
    dateTimeDiv.textContent = new Date().toLocaleString();
    setInterval(() => {
      dateTimeDiv.textContent = new Date().toLocaleString();
    }, 1000);
  }
}

// COUNTDOWN TIMER (60 minutes)
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

// INITIALIZE WAVEFORMS
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

// DRAW WAVEFORMS
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

// ANIMATE USER WAVEFORM (Input)
function animateUserWaveform() {
  if (royState !== 'engaged') return;
  if (analyser && dataArray) {
    analyser.getByteTimeDomainData(dataArray);
    drawWaveform(userWaveformCtx, document.getElementById('user-waveform'), dataArray);
    requestAnimationFrame(animateUserWaveform);
  }
}

// ANIMATE ROY WAVEFORM (Output)
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

// SCROLL MESSAGES
function scrollMessages() {
  const messages = document.getElementById('messages');
  messages.scrollTop = messages.scrollHeight;
}

// APPEND USER MESSAGE
function appendUserMessage(message) {
  const messages = document.getElementById('messages');
  messages.innerHTML += `<div class="user">You: ${message}</div>`;
  scrollMessages();
}

// APPEND ROY MESSAGE
function appendRoyMessage(message) {
  const messages = document.getElementById('messages');
  messages.innerHTML += `<div class="roy">Roy: ${message}</div>`;
  scrollMessages();
}

// BUTTON LOGIC
document.addEventListener('DOMContentLoaded', () => {
  updateDateTime();
  updateCountdownTimer();
  initWaveforms();

  const royBtn = document.getElementById('royBtn');
  const randyBtn = document.getElementById('randyBtn');
  const speakBtn = document.getElementById('speakBtn');

  royBtn.addEventListener('click', () => {
    if (royState === 'idle') {
      royState = 'engaged';
      randyState = 'idle';
      royBtn.style.backgroundColor = 'green';
      randyBtn.style.backgroundColor = '';
      speakBtn.style.backgroundColor = 'red';
      speakBtn.textContent = 'STOP';
      startRecording();
    } else {
      royState = 'idle';
      royBtn.style.backgroundColor = '';
      speakBtn.style.backgroundColor = '';
      speakBtn.textContent = 'SPEAK';
      stopRecording();
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
      startRecording();
    } else {
      randyState = 'idle';
      randyBtn.style.backgroundColor = '';
      speakBtn.style.backgroundColor = '';
      speakBtn.textContent = 'SPEAK';
      stopRecording();
    }
  });

  speakBtn.addEventListener('click', () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      stopRecording();
    }
  });
});

// RECORDING SETUP
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

// STOP RECORDING
function stopRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
  }
}

// HANDLE STOP
function handleStop() {
  const blob = new Blob(audioChunks, { type: 'audio/webm' });
  const audioURL = URL.createObjectURL(blob);
  const audio = new Audio(audioURL);
  animateRoyWaveform(audio);
  appendUserMessage('...sending your message...');
  // Here: Add your API call to send audio to Roy and handle Roy's reply!
}
