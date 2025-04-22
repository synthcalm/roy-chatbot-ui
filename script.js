// Updated script.js with new button logic and auto-scroll behavior

const royBtn = document.getElementById('royBtn');
const randyBtn = document.getElementById('randyBtn');
const feedbackBtn = document.getElementById('speakBtn');
const saveBtn = document.getElementById('saveBtn');
const homeBtn = document.getElementById('homeBtn');
const messagesDiv = document.getElementById('messages');
const userCanvas = document.getElementById('userWaveform');
const royCanvas = document.getElementById('royWaveform');
const userCtx = userCanvas.getContext('2d');
const royCtx = royCanvas.getContext('2d');
const dateTimeSpan = document.getElementById('date-time');
const countdownTimerSpan = document.getElementById('countdown-timer');

let selectedPersona = null;
let mediaRecorder, audioChunks = [], isRecording = false;
let userAudioContext = null;
let royAudioContext = null;
let royAudioSource = null;
let stream = null;

// Date, time, countdown
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

// Button color reset
function resetButtonColors() {
  royBtn.style.backgroundColor = 'black';
  royBtn.style.color = 'cyan';
  randyBtn.style.backgroundColor = 'black';
  randyBtn.style.color = 'cyan';
  feedbackBtn.style.backgroundColor = 'black';
  feedbackBtn.style.color = 'cyan';
  feedbackBtn.classList.remove('blinking');
  feedbackBtn.textContent = 'FEEDBACK';
  isRecording = false;
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

// ROY button logic
royBtn.addEventListener('click', async () => {
  if (isRecording && selectedPersona === 'roy') {
    mediaRecorder.stop();
    royBtn.style.backgroundColor = 'black';
    royBtn.style.color = 'cyan';
    royBtn.textContent = 'ROY';
    feedbackBtn.classList.add('blinking');
    return;
  }
  resetButtonColors();
  selectedPersona = 'roy';
  royBtn.style.backgroundColor = '#00FF00'; // Cyber green
  royBtn.style.color = 'black';
  royBtn.textContent = 'STOP';
  try {
    isRecording = true;
    audioChunks = [];
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    setupUserVisualization(stream);
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
    mediaRecorder.onstop = async () => {
  const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
  const formData = new FormData();
  formData.append('audio', audioBlob);
  formData.append('bot', selectedPersona);

  try {
    const transcribeRes = await fetch('https://roy-chatbo-backend.onrender.com/api/transcribe', { method: 'POST', body: formData });
    const transcribeJson = await transcribeRes.json();
    const userText = transcribeJson.text || 'undefined';
    addMessage('user', userText);
    feedbackBtn.classList.add('blinking');
  } catch (error) {
    console.error('Transcription failed:', error);
  } finally {
    if (selectedPersona === 'roy') {
      royBtn.style.backgroundColor = '#00FF00';
      royBtn.style.color = 'black';
      royBtn.textContent = 'ROY';
    } else if (selectedPersona === 'randy') {
      randyBtn.style.backgroundColor = 'orange';
      randyBtn.style.color = 'black';
      randyBtn.textContent = 'RANDY';
    }
  }
};
    mediaRecorder.start();
  } catch (error) {
    console.error('Microphone error:', error);
    alert('Could not access your microphone. Please allow access.');
  }
});

// RANDY button logic
randyBtn.addEventListener('click', async () => {
  if (isRecording && selectedPersona === 'randy') {
    mediaRecorder.stop();
    randyBtn.style.backgroundColor = 'black';
    randyBtn.style.color = 'cyan';
    feedbackBtn.classList.add('blinking');
    return;
  }
  resetButtonColors();
  selectedPersona = 'randy';
  randyBtn.style.backgroundColor = 'orange';
  randyBtn.style.color = 'black';
  try {
    isRecording = true;
    audioChunks = [];
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    setupUserVisualization(stream);
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
    mediaRecorder.onstop = async () => { /* Transcription logic here */ };
    mediaRecorder.start();
  } catch (error) {
    console.error('Microphone error:', error);
    alert('Could not access your microphone. Please allow access.');
  }
});

// Feedback button logic

// Save Log button logic
saveBtn.addEventListener('click', () => {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-');
  const filename = `${selectedPersona || 'conversation'}-${timestamp}.txt`;
  const blob = new Blob([messagesDiv.innerText], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();

  // Reset all buttons to default state
  resetButtonColors();
  royBtn.textContent = 'ROY';
  randyBtn.textContent = 'RANDY';
  feedbackBtn.textContent = 'FEEDBACK';
});
feedbackBtn.addEventListener('click', async () => {
);
