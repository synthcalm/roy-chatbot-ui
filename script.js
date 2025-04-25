// === Roy Chatbot script.js (Final Fixed Version) ===

// Global Variables
let royState = 'idle';
let randyState = 'idle';
let recognition, audioContext, analyser, dataArray, source;
let isRecording = false;

// === INFO BAR ===
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

// === WAVEFORM ===
function initWaveform() {
  const waveform = document.getElementById('waveform');
  waveform.width = waveform.offsetWidth;
  waveform.height = 100;
  const ctx = waveform.getContext('2d');
  return { waveform, ctx };
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

function animateWaveform(ctx, canvas) {
  if (!isRecording) return;
  analyser.getByteTimeDomainData(dataArray);
  drawWaveform(ctx, canvas, dataArray);
  requestAnimationFrame(() => animateWaveform(ctx, canvas));
}

// === MESSAGES ===
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

// === SEND TO ROY ===
function sendToRoy(transcript) {
  appendUserMessage(transcript);
  fetch('https://roy-chatbo-backend.onrender.com/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: transcript,
      persona: royState === 'engaged' ? 'roy' : 'randy'
    })
  })
  .then(response => response.json())
  .then(data => {
    if (data.text) appendRoyMessage(data.text);
    if (data.audioUrl) {
      const replyAudio = new Audio(data.audioUrl);
      replyAudio.play();
    }
  })
  .catch(error => {
    appendRoyMessage('Error: Could not get Roy’s response.');
    console.error('Roy API Error:', error);
  });
}

// === TRANSCRIPTION ===
function startTranscription(ctx, canvas) {
  if (!('webkitSpeechRecognition' in window)) {
    alert('Speech recognition not supported in this browser.');
    return;
  }
  recognition = new webkitSpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.lang = 'en-US';

  navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    source = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    dataArray = new Uint8Array(analyser.frequencyBinCount);
    source.connect(analyser);
    isRecording = true;
    animateWaveform(ctx, canvas);

    recognition.start();
    recognition.onresult = event => {
      const transcript = Array.from(event.results)
        .map(result => result[0].transcript)
        .join('');
      recognition.stop();
      isRecording = false;
      audioContext.close();
      sendToRoy(transcript);
    };
    recognition.onerror = () => {
      appendRoyMessage('Transcription error.');
      isRecording = false;
      recognition.stop();
    };
  });
}

// === BUTTON LOGIC ===
document.addEventListener('DOMContentLoaded', () => {
  updateDateTime();
  updateCountdownTimer();
  const { waveform, ctx } = initWaveform();

  const royBtn = document.getElementById('royBtn');
  const randyBtn = document.getElementById('randyBtn');
  const speakBtn = document.getElementById('speakBtn');
  const saveBtn = document.getElementById('saveBtn');
  const homeBtn = document.getElementById('homeBtn');

  appendRoyMessage("Hey, man... I'm Roy, your chill companion here to listen. Whenever you're ready, just hit the ROY button and let's talk, yeah?");

  function resetButtons() {
    royBtn.style.backgroundColor = '';
    randyBtn.style.backgroundColor = '';
  }

  royBtn.addEventListener('click', () => {
    if (royState === 'idle') {
      royState = 'engaged';
      randyState = 'idle';
      royBtn.style.backgroundColor = 'green';
      randyBtn.style.backgroundColor = '';
      startTranscription(ctx, waveform);
    } else {
      royState = 'idle';
      resetButtons();
    }
  });

  randyBtn.addEventListener('click', () => {
    if (randyState === 'idle') {
      randyState = 'engaged';
      royState = 'idle';
      randyBtn.style.backgroundColor = 'orange';
      royBtn.style.backgroundColor = '';
      startTranscription(ctx, waveform);
    } else {
      randyState = 'idle';
      resetButtons();
    }
  });
});
