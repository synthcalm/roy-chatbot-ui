// FULLY WIRED script.js with updated button logic

const royBtn = document.getElementById('royBtn');
const randyBtn = document.getElementById('randyBtn');
const feedbackBtn = document.getElementById('feedbackBtn');
const saveBtn = document.getElementById('saveBtn');
const homeBtn = document.getElementById('homeBtn');
const messagesDiv = document.getElementById('messages');
const userCanvas = document.getElementById('userWaveform');
const royCanvas = document.getElementById('royWaveform');
const userCtx = userCanvas.getContext('2d');
const royCtx = royCanvas.getContext('2d');
const dateTimeSpan = document.getElementById('date-time');
const countdownTimerSpan = document.getElementById('countdown-timer');

let mediaRecorder, audioChunks = [], isRecording = false;
let selectedPersona = null;
let userAudioContext = null;
let userAnalyser = null;
let userSource = null;
let userStream = null;

function updateClock() {
  const now = new Date();
  dateTimeSpan.textContent = now.toLocaleString();
}
setInterval(updateClock, 1000);

let countdown = 60 * 60;
setInterval(() => {
  countdown--;
  const minutes = String(Math.floor(countdown / 60)).padStart(2, '0');
  const seconds = String(countdown % 60).padStart(2, '0');
  countdownTimerSpan.textContent = `${minutes}:${seconds}`;
}, 1000);

function drawUserWaveform(dataArray) {
  userCtx.clearRect(0, 0, userCanvas.width, userCanvas.height);
  userCtx.beginPath();
  for (let i = 0; i < dataArray.length; i++) {
    const x = (i / dataArray.length) * userCanvas.width;
    const y = userCanvas.height / 2 + dataArray[i] - 128;
    userCtx.lineTo(x, y);
  }
  userCtx.strokeStyle = 'yellow';
  userCtx.stroke();
}

function setupUserVisualization(stream) {
  userAudioContext = new (window.AudioContext || window.webkitAudioContext)();
  userAnalyser = userAudioContext.createAnalyser();
  userSource = userAudioContext.createMediaStreamSource(stream);
  userSource.connect(userAnalyser);

  const bufferLength = userAnalyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  function animate() {
    requestAnimationFrame(animate);
    userAnalyser.getByteTimeDomainData(dataArray);
    drawUserWaveform(dataArray);
  }
  animate();
}

royBtn.addEventListener('click', async () => {
  if (!isRecording) {
    selectedPersona = 'roy';
    royBtn.style.backgroundColor = 'lime';
    royBtn.textContent = 'STOP';
    audioChunks = [];
    userStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(userStream);
    setupUserVisualization(userStream);
    mediaRecorder.start();

    mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
    mediaRecorder.onstop = async () => {
      const blob = new Blob(audioChunks, { type: 'audio/webm' });
      const formData = new FormData();
      formData.append('audio', blob);
      try {
        const response = await fetch('https://roy-chatbo-backend.onrender.com/api/transcribe', {
          method: 'POST',
          body: formData
        });
        const data = await response.json();
        if (data.text) {
          displayMessage('You', data.text, 'white');
          thinkingDots();
          feedbackBtn.classList.add('blinking-red');
        }
      } catch (err) {
        console.error('Transcription failed:', err);
      }
    };
    isRecording = true;
  } else {
    mediaRecorder.stop();
    userStream.getTracks().forEach(track => track.stop());
    royBtn.style.backgroundColor = '';
    royBtn.textContent = 'ROY';
    isRecording = false;
  }
});

feedbackBtn.addEventListener('click', async () => {
  const lastUser = [...messagesDiv.querySelectorAll('.user')].pop();
  if (!lastUser) return;
  const text = lastUser.textContent.replace('You: ', '');
  feedbackBtn.classList.remove('blinking-red');
  feedbackBtn.style.backgroundColor = 'red';
  feedbackBtn.textContent = 'FEEDBACK';

  try {
    const res = await fetch('https://roy-chatbo-backend.onrender.com/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, persona: selectedPersona })
    });
    const data = await res.json();
    if (data.text) displayMessage(capitalize(selectedPersona), data.text, 'yellow');
    if (data.audio) playRoyAudio(data.audio);
  } catch (err) {
    console.error('Error during feedback:', err);
  } finally {
    feedbackBtn.style.backgroundColor = '';
    royBtn.style.backgroundColor = 'lime';
    royBtn.textContent = 'ROY';
  }
});

function playRoyAudio(base64Audio) {
  const audio = new Audio(`data:audio/mp3;base64,${base64Audio}`);
  audio.play();
}

function thinkingDots() {
  const msg = document.createElement('div');
  msg.className = 'roy';
  msg.textContent = 'Roy thinking';
  messagesDiv.appendChild(msg);
  let count = 0;
  const interval = setInterval(() => {
    if (count >= 3) count = 0;
    msg.textContent = 'Roy thinking' + '.'.repeat(count++);
  }, 500);
  setTimeout(() => {
    clearInterval(interval);
    messagesDiv.removeChild(msg);
  }, 3000);
}

function displayMessage(role, text, color) {
  const msg = document.createElement('div');
  msg.className = role.toLowerCase();
  msg.textContent = `${role}: ${text}`;
  msg.style.color = color;
  messagesDiv.appendChild(msg);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
