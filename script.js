const royBtn = document.getElementById('royBtn');
const randyBtn = document.getElementById('randyBtn');
const speakBtn = document.getElementById('speakBtn');
const saveBtn = document.getElementById('saveBtn');
const homeBtn = document.getElementById('homeBtn');
const messagesDiv = document.getElementById('messages');
const userCanvas = document.getElementById('userWaveform');
const royCanvas = document.getElementById('royWaveform');
const scopesContainer = document.getElementById('scopes-container');
const userCtx = userCanvas.getContext('2d');
const royCtx = royCanvas.getContext('2d');
const dateTimeSpan = document.getElementById('date-time');
const countdownTimerSpan = document.getElementById('countdown-timer');

let mediaRecorder, audioChunks = [], isRecording = false;
let selectedPersona = null;
let audioContext, analyser, dataArray, source;

function addMessage(text, sender, isThinking = false) {
  const msg = document.createElement('p');
  msg.className = sender;
  if (isThinking) msg.classList.add('thinking-dots');
  msg.textContent = text;
  messagesDiv.appendChild(msg);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
  return msg;
}

function drawScope(canvasCtx, canvas, data, color, isUserWaveform) {
  canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
  canvasCtx.beginPath();
  const sliceWidth = canvas.width / data.length;
  const offset = isUserWaveform ? 20 : 60; // User: center at 20px, Roy/Randy: center at 60px
  for (let i = 0; i < data.length; i++) {
    const x = i * sliceWidth;
    const y = (data[i] / 128.0) * (canvas.height / 4) + offset; // Adjusted scaling for better visibility
    if (i === 0) {
      canvasCtx.moveTo(x, y);
    } else {
      canvasCtx.lineTo(x, y);
    }
  }
  canvasCtx.strokeStyle = color;
  canvasCtx.stroke();
}

function setupAudioVisualization(source, canvasCtx, canvas, color, isUserWaveform) {
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;
  dataArray = new Uint8Array(analyser.frequencyBinCount);

  if (source instanceof MediaStream) {
    const mediaStreamSource = audioContext.createMediaStreamSource(source);
    mediaStreamSource.connect(analyser);
  } else {
    source.connect(analyser); // For MediaElementAudioSourceNode
  }

  function animate() {
    analyser.getByteTimeDomainData(dataArray);
    drawScope(canvasCtx, canvas, dataArray, color, isUserWaveform);
    requestAnimationFrame(animate);
  }
  animate();
}

function resetButtonColors() {
  royBtn.style.backgroundColor = 'black';
  royBtn.style.borderColor = 'none';
  royBtn.style.color = 'cyan';
  randyBtn.style.backgroundColor = 'black';
  randyBtn.style.borderColor = 'none';
  randyBtn.style.color = 'cyan';
  speakBtn.style.backgroundColor = 'black';
  speakBtn.style.borderColor = 'none';
  speakBtn.style.color = 'cyan';
  speakBtn.textContent = 'SPEAK';
  speakBtn.classList.remove('blinking');
  scopesContainer.style.borderColor = 'cyan';
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
  let timeLeft = 5 * 60;
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
  royBtn.style.color = 'white';
  speakBtn.style.backgroundColor = 'red';
  speakBtn.style.color = 'white';
  scopesContainer.style.borderColor = 'cyan';
  addMessage('Roy: Greetings, my friend—like a weary traveler, you’ve arrived. What weighs on your soul today?', 'roy');
});

randyBtn.addEventListener('click', () => {
  resetButtonColors();
  selectedPersona = 'randy';
  randyBtn.style.backgroundColor = '#FFC107';
  randyBtn.style.color = 'white';
  speakBtn.style.backgroundColor = 'red';
  speakBtn.style.color = 'white';
  scopesContainer.style.borderColor = 'red';
  addMessage('Randy: Unleash the chaos—what’s burning you up?', 'randy');
});

speakBtn.addEventListener('click', async () => {
  if (!selectedPersona) return alert('Please choose Roy or Randy.');
  if (isRecording) {
    mediaRecorder.stop(); // Stop recording when STOP is pressed
    return;
  }
  isRecording = true;
  speakBtn.textContent = 'STOP';
  speakBtn.classList.add('blinking');

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(stream);
  audioChunks = [];

  setupAudioVisualization(stream, userCtx, userCanvas, 'yellow', true);

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

      const thinkingMsg = addMessage(`${selectedPersona === 'randy' ? 'Randy' : 'Roy'}: Thinking`, selectedPersona, true);
      
      const chatRes = await fetch('https://roy-chatbo-backend.onrender.com/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, persona: selectedPersona })
      });
      const { text: reply, audio } = await chatRes.json();
      
      thinkingMsg.remove(); // Remove thinking message
      addMessage(`${selectedPersona === 'randy' ? 'Randy' : 'Roy'}: ${reply}`, selectedPersona);

      const audioEl = new Audio('data:audio/mp3;base64,' + audio);
      audioEl.onplay = () => {
        const audioSource = audioContext.createMediaElementSource(audioEl);
        const waveformColor = selectedPersona === 'randy' ? 'white' : 'magenta';
        setupAudioVisualization(audioSource, royCtx, royCanvas, waveformColor, false);
      };
      audioEl.play();
    } catch (e) {
      console.error('Transcription failed:', e);
      thinkingMsg.remove();
      addMessage(`${selectedPersona === 'randy' ? 'Randy' : 'Roy'}: Sorry, something went wrong.`, selectedPersona);
    }
  };

  mediaRecorder.start();
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
  updateDateTime();
  startCountdownTimer();
};
