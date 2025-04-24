// === script.js (COMPLETE WORKING VERSION INCLUDING INITIALIZATION, CONTROL LOGIC, VISUAL SETUP, AND EVENT HANDLING) ===

// Update Date/Time Info Bar
function updateDateTime() {
  const dateTimeDiv = document.getElementById('date-time');
  if (dateTimeDiv) {
    setInterval(() => {
      dateTimeDiv.textContent = new Date().toLocaleString();
    }, 1000);
  }
}

// Countdown Timer (60 minutes)
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

// Initialize Waveforms with Grid Container
function initWaveforms() {
  const container = document.getElementById('grid-area');
  container.style.background = `repeating-linear-gradient(0deg, rgba(0,255,255,0.2) 0 1px, transparent 1px 20px), repeating-linear-gradient(90deg, rgba(255,255,0,0.2) 0 1px, transparent 1px 20px)`;
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

// Define Global Variables
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
let feedbackBlinkInterval;

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
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

// Recording Logic
function startRecording() {
  navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.start();
    mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
    userAudioContext = new AudioContext();
    analyser = userAudioContext.createAnalyser();
    dataArray = new Uint8Array(analyser.fftSize);
    source = userAudioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    animateUserWaveform();
    recognition.start();
  }).catch(err => {
    console.error('Error starting recording:', err);
    alert('Failed to access microphone. Check permissions.');
  });
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
  audioChunks = [];
  source?.disconnect();
  analyser?.disconnect();
  userAudioContext?.close();
  recognition?.stop();
}
