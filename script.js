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

// Update clock and timer
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

// Draw waveform for both user and Roy
function drawWaveform(ctx, canvas, dataArray, color) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.beginPath();
  for (let i = 0; i < dataArray.length; i++) {
    const x = (i / dataArray.length) * canvas.width;
    const y = canvas.height / 2 + (dataArray[i] - 128) * (canvas.height / 256);
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.strokeStyle = color;
  ctx.stroke();
}

// Set up user waveform visualization
function setupUserVisualization(stream) {
  try {
    userAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (userAudioContext.state === 'suspended') {
      userAudioContext.resume();
    }

    userAnalyser = userAudioContext.createAnalyser();
    userSource = userAudioContext.createMediaStreamSource(stream);
    userSource.connect(userAnalyser);

    userCanvas.width = userCanvas.offsetWidth || 900;
    userCanvas.height = 200;

    const dataArray = new Uint8Array(userAnalyser.frequencyBinCount);
    function animate() {
      if (!isRecording) return;
      requestAnimationFrame(animate);
      userAnalyser.getByteTimeDomainData(dataArray);
      drawWaveform(userCtx, userCanvas, dataArray, 'yellow');
    }
    animate();
  } catch (err) {
    addOrUpdateMessage('Error: Could not set up waveform. Try again or check your browser settings.', 'roy');
  }
}

// Play Roy's audio and show waveform
function playRoyAudio(base64Audio) {
  const audio = new Audio(`data:audio/mp3;base64,${base64Audio}`);
  const royAudioContext = new (window.AudioContext || window.webkitAudioContext)();
  if (royAudioContext.state === 'suspended') {
    royAudioContext.resume();
  }

  const royAudioSource = royAudioContext.createMediaElementSource(audio);
  const analyser = royAudioContext.createAnalyser();
  royAudioSource.connect(analyser);
  analyser.connect(royAudioContext.destination);

  royCanvas.width = royCanvas.offsetWidth || 900;
  royCanvas.height = 200;

  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  function animate() {
    requestAnimationFrame(animate);
    analyser.getByteTimeDomainData(dataArray);
    drawWaveform(royCtx, royCanvas, dataArray, 'magenta');
  }
  animate();
  audio.play();
}

// Add or update message in chat
function addOrUpdateMessage(text, sender, isThinking = false) {
  let msg;
  if (isThinking) {
    msg = [...messagesDiv.querySelectorAll('.roy')].pop();
    if (msg && msg.textContent.includes('Roy thinking...')) {
      msg.textContent = `Roy: ${text}`;
    } else {
      msg = document.createElement('p');
      msg.className = sender;
      msg.textContent = `Roy: ${text}`;
      messagesDiv.appendChild(msg);
    }
  } else {
    msg = document.createElement('p');
    msg.className = sender;
    msg.textContent = text;
    messagesDiv.appendChild(msg);
  }
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Display Roy's greeting when app opens
window.addEventListener('load', () => {
  const greeting = document.createElement('p');
  greeting.className = 'roy';
  greeting.textContent = "Roy: Hey, man… I’m Roy, your chill companion here to listen. Whenever you’re ready, just hit the ROY button and let’s talk, yeah?";
  messagesDiv.appendChild(greeting);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
});

// ROY button event listener
royBtn.addEventListener('click', async () => {
  if (!isRecording) {
    selectedPersona = 'roy';
    royBtn.style.backgroundColor = 'lime';
    royBtn.textContent = 'STOP';
    audioChunks = [];
    try {
      userStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(userStream);
      isRecording = true;
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
            addOrUpdateMessage(`You: ${data.text}`, 'user');
            addOrUpdateMessage('Roy thinking...', 'roy');
            feedbackBtn.classList.add('blinking-red');
          }
        } catch (err) {
          addOrUpdateMessage('Error: Transcription failed.', 'roy');
        }
      };
    } catch (err) {
      addOrUpdateMessage('Error: Could not access microphone. Check permissions or try a different browser.', 'roy');
      royBtn.style.backgroundColor = '';
      royBtn.textContent = 'ROY';
      isRecording = false;
    }
  } else {
    mediaRecorder.stop();
    userStream.getTracks().forEach(track => track.stop());
    royBtn.style.backgroundColor = '';
    royBtn.textContent = 'ROY';
    isRecording = false;
  }
});

// FEEDBACK button event listener
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
    if (data.text) addOrUpdateMessage(data.text, 'roy', true);
    if (data.audio) playRoyAudio(data.audio);
  } catch (err) {
    addOrUpdateMessage('Error: Roy could not respond.', 'roy');
  } finally {
    feedbackBtn.style.backgroundColor = '';
    royBtn.style.backgroundColor = 'lime';
    royBtn.textContent = 'ROY';
  }
});

// SAVE LOG button
saveBtn.addEventListener('click', () => {
  const blob = new Blob([messagesDiv.innerText], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'conversation-log.txt';
  a.click();
});

// HOME button
homeBtn.addEventListener('click', () => {
  window.location.href = 'https://synthcalm.com';
});
