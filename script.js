// === Roy Chatbot with Dual Waveforms + Session Tracking ===
const micBtn = document.getElementById('mic-toggle');
const sendBtn = document.getElementById('send-button');
const inputEl = document.getElementById('user-input');
const messagesEl = document.getElementById('messages');
const audioEl = document.getElementById('roy-audio');
const modeSelect = document.getElementById('responseMode');
const userCanvas = document.getElementById('userWaveform');
const royCanvas = document.getElementById('royWaveform');
const userCtx = userCanvas.getContext('2d');
const royCtx = royCanvas.getContext('2d');

let isRecording = false;
let mediaRecorder, stream, chunks = [];
let userAudioContext, userAnalyser, userDataArray, userSource;
let royAudioContext, royAnalyser, royDataArray, roySource;

const greetings = [
  "Hello.",
  "Hi there.",
  "Welcome.",
  "How are you today?",
  "Glad you're here.",
  "Nice to see you again.",
  "Let's take a breath and begin."
];

// Generate session ID
const sessionId = `session-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

// Add session countdown timer
const timerDisplay = document.createElement('div');
timerDisplay.id = 'session-timer';
timerDisplay.style.color = '#0ff';
timerDisplay.style.textAlign = 'center';
timerDisplay.style.margin = '10px 0';
document.body.insertBefore(timerDisplay, document.body.firstChild);

let sessionStart = Date.now();
let sessionInterval = setInterval(() => {
  const elapsed = Math.floor((Date.now() - sessionStart) / 60000);
  const remaining = Math.max(0, 60 - elapsed);
  timerDisplay.textContent = `Session ends in ${remaining} minute(s)`;

  if (remaining <= 0) {
    clearInterval(sessionInterval);
    appendMessage('Roy', "This session has reached the 60-minute limit. Let's pause here. You're always welcome to return when you're ready.");
    micBtn.disabled = true;
    sendBtn.disabled = true;
    inputEl.disabled = true;
  }
}, 60000);

// Clock
setInterval(() => {
  const now = new Date();
  document.getElementById('current-date').textContent = now.toISOString().split('T')[0];
  document.getElementById('current-time').textContent = now.toTimeString().split(' ')[0];
}, 1000);

// Initial Greeting
window.addEventListener('DOMContentLoaded', () => {
  const greeting = greetings[Math.floor(Math.random() * greetings.length)];
  appendMessage('Roy', `${greeting} You can either speak into the mic or type in the text box.`);
});
