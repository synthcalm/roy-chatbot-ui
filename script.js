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

function drawWaveform(ctx, dataArray, color) {
  ctx.clearRect(0, 0, userCanvas.width, userCanvas.height);
  ctx.beginPath();
  for (let i = 0; i < dataArray.length; i++) {
    const x = (i / dataArray.length) * userCanvas.width;
    const y = userCanvas.height / 2 + dataArray[i] - 128;
    ctx.lineTo(x, y);
  }
  ctx.strokeStyle = color;
  ctx.stroke();
}

function setupUserVisualization(stream) {
  userAudioContext = new (window.AudioContext || window.webkitAudioContext)();
  userAnalyser = userAudioContext.createAnalyser();
  userSource = userAudioContext.createMediaStreamSource(stream);
  userSource.connect(userAnalyser);
  const dataArray = new Uint8Array(userAnalyser.frequencyBinCount);
  function animate() {
    if (!isRecording) return;
    requestAnimationFrame(animate);
    userAnalyser.getByteTimeDomainData(dataArray);
    drawWaveform(userCtx, dataArray, 'yellow');
  }
  animate();
}

function playRoyAudio(base64Audio) {
  const audio = new Audio(`data:audio/mp3;base64,${base64Audio}`);
  const royAudioContext = new (window.AudioContext || window.webkitAudioContext)();
  const royAudioSource = royAudioContext.createMediaElementSource(audio);
  const analyser = royAudioContext.createAnalyser();
  royAudioSource.connect(analyser);
  analyser.connect(royAudioContext.destination);
  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  function animate() {
    analyser.getByteTimeDomainData(dataArray);
    drawWaveform(royCtx, dataArray, 'magenta');
    requestAnimationFrame(animate);
  }
  animate();
  audio.play();
}

function addMessage(text, sender) {
  const msg = document.createElement('p');
  msg.className = sender;
  msg.textContent = text;
  messagesDiv.appendChild(msg);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
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
        const response = await fetch('https://roy-chatbo-backend.onrender.com/api/transcribe', { method: 'POST', body: formData });
        const data = await response.json();
        if (data.text) {
          addMessage(`You: ${data.text}`, 'user');
          addMessage(`Roy thinking...`, 'roy');
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
  const lastUserMsg = [...messagesDiv.querySelectorAll('.user')].pop();
  if (!lastUserMsg) return;
  const text = lastUserMsg.textContent.replace('You: ', '');
  feedbackBtn.classList.remove('blinking-red');
  feedbackBtn.style.backgroundColor = 'red';
  try {
    const res = await fetch('https://roy-chatbo-backend.onrender.com/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, persona: selectedPersona })
    });
    const data = await res.json();
    if (data.text) addMessage(`Roy: ${data.text}`, 'roy');
    if (data.audio) playRoyAudio(data.audio);
  } catch (err) {
    console.error('Error during feedback:', err);
  } finally {
    feedbackBtn.style.backgroundColor = '';
    royBtn.style.backgroundColor = 'lime';
    royBtn.textContent = 'ROY';
  }
});

saveBtn.addEventListener('click', () => {
  const blob = new Blob([messagesDiv.innerText], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'conversation-log.txt';
  a.click();
});

homeBtn.addEventListener('click', () => {
  window.location.href = 'https://synthcalm.com';
});
