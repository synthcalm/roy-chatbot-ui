const royBtn = document.getElementById('royBtn');
const randyBtn = document.getElementById('randyBtn');
const speakBtn = document.getElementById('speakBtn');
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
let audioContext, analyser, dataArray, source;

function addMessage(text, sender) {
  const msg = document.createElement('p');
  msg.className = sender;
  msg.textContent = text;
  messagesDiv.appendChild(msg);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function drawScope(canvasCtx, canvas, data, color) {
  canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
  canvasCtx.beginPath();
  const sliceWidth = canvas.width / data.length;
  for (let i = 0; i < data.length; i++) {
    const x = i * sliceWidth;
    const y = (data[i] / 128.0) * (canvas.height / 2) + (canvas.height / 2);
    if (i === 0) {
      canvasCtx.moveTo(x, y);
    } else {
      canvasCtx.lineTo(x, y);
    }
  }
  canvasCtx.strokeStyle = color;
  canvasCtx.stroke();
}

function setupAudioVisualization(stream, canvasCtx, canvas, color) {
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;
  dataArray = new Uint8Array(analyser.frequencyBinCount);
  source = audioContext.createMediaStreamSource(stream);
  source.connect(analyser);

  function animate() {
    analyser.getByteTimeDomainData(dataArray);
    drawScope(canvasCtx, canvas, dataArray, color);
    requestAnimationFrame(animate);
  }
  animate();
}

function resetButtonColors() {
  royBtn.style.backgroundColor = 'black'; // Default background
  royBtn.style.borderColor = 'cyan';
  royBtn.style.color = 'cyan'; // Default text color
  randyBtn.style.backgroundColor = 'black';
  randyBtn.style.borderColor = 'cyan';
  randyBtn.style.color = 'cyan';
  speakBtn.style.backgroundColor = 'black';
  speakBtn.style.borderColor = 'cyan';
  speakBtn.style.color = 'cyan';
  speakBtn.textContent = 'SPEAK';
  speakBtn.classList.remove('blinking');
  isRecording = false;
  selectedPersona = null;
}

function updateDateTime() {
  const now = new Date();
  const date = now.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
  const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true });
  dateTimeSpan.textContent = `${date}   ${time}`;
}

function startCountdownTimer() {
  let timeLeft = 5 * 60; // 5 minutes in seconds
  const timer = setInterval(() => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    countdownTimerSpan.textContent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    timeLeft--;
    if (timeLeft < 0) {
      clearInterval(timer);
      countdownTimerSpan.textContent = '0:00';
    }
  }, 1000);
}

royBtn.addEventListener('click', () => {
  resetButtonColors();
  selectedPersona = 'roy';
  royBtn.style.backgroundColor = 'green';
  royBtn.style.borderColor = 'green';
  royBtn.style.color = 'white'; // Engaged text color
  speakBtn.style.backgroundColor = 'red';
  speakBtn.style.borderColor = 'red';
  speakBtn.style.color = 'white';
});

randyBtn.addEventListener('click', () => {
  resetButtonColors();
  selectedPersona = 'randy';
  randyBtn.style.backgroundColor = '#FFC107';
  randyBtn.style.borderColor = '#FFC107';
  randyBtn.style.color = 'white';
  speakBtn.style.backgroundColor = 'red';
  speakBtn.style.borderColor = 'red';
  speakBtn.style.color = 'white';
});

speakBtn.addEventListener('click', async () => {
  if (!selectedPersona) return alert('Please choose Roy or Randy.');
  if (isRecording) return;
  isRecording = true;
  speakBtn.textContent = 'STOP';
  speakBtn.classList.add('blinking');

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(stream);
  audioChunks = [];

  setupAudioVisualization(stream, userCtx, userCanvas, 'yellow');

  mediaRecorder.ondataavailable = (e) => {
    audioChunks.push(e.data);
  };

  mediaRecorder.onstop = async () => {
    speakBtn.textContent = 'SPEAK';
    speakBtn.classList.remove('blinking');
    isRecording = false;
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
    const formData = new FormData();
    formData.append('audio', audioBlob);

    try {
      const transcribeRes = await fetch('https://roy-chatbo-backend.onrender.com/api/transcribe', {
        method: 'POST',
        body: formData
      });
      const { text } = await transcribeRes.json();
      addMessage('You: ' + text, 'user');

      const chatRes = await fetch('https://roy-chatbo-backend.onrender.com/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, persona: selectedPersona })
      });
      const { text: reply, audio } = await chatRes.json();
      addMessage(`${selectedPersona === 'randy' ? 'Randy' : 'Roy'}: ${reply}`, selectedPersona);

      const audioEl = new Audio('data:audio/mp3;base64,' + audio);
      audioEl.onplay = () => {
        const audioStream = audioContext.createMediaElementSource(audioEl);
        setupAudioVisualization({ getTracks: () => [audioStream] }, royCtx, royCanvas, 'cyan');
      };
      audioEl.play();
    } catch (e) {
      console.error('Transcription failed:', e);
    }
  };

  mediaRecorder.start();
  setTimeout(() => {
    mediaRecorder.stop();
  }, 5000);
});

saveBtn.addEventListener('click', () => {
  const blob = new Blob([messagesDiv.innerText], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'conversation.txt';
  a.click();
  resetButtonColors();
});

homeBtn.addEventListener('click', () => {
  window.location.href = 'https://synthcalm.com';
});

window.onload = () => {
  addMessage('Roy: Greetings, my friend—like a weary traveler, you’ve arrived. What weighs on your soul today?', 'roy');
  addMessage('Randy: Unleash the chaos—what’s burning you up?', 'randy');
  updateDateTime();
  startCountdownTimer();
};
