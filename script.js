let mediaRecorder, audioChunks = [], audioContext, sourceNode;
let state = 'idle';
let stream;
const logHistory = [];

const elements = {
  recordButton: document.getElementById('recordButton'),
  saveButton: document.getElementById('saveButton'),
  chat: document.getElementById('chat'),
  userScope: document.getElementById('userScope'),
  royScope: document.getElementById('royScope'),
  clock: document.getElementById('clock'),
  date: document.getElementById('date'),
  countdown: document.getElementById('countdown')
};

const config = {
  duration: 3600,
  maxRecordingTime: 60000
};

let countdownInterval;

function updateDateTime() {
  const now = new Date();
  elements.clock.textContent = now.toTimeString().split(' ')[0];
  elements.date.textContent = now.toISOString().split('T')[0];
}

function startCountdown() {
  let remaining = config.duration;
  clearInterval(countdownInterval);
  countdownInterval = setInterval(() => {
    if (remaining <= 0) {
      clearInterval(countdownInterval);
      if (state === 'recording') stopRecording();
    } else {
      const minutes = String(Math.floor(remaining / 60)).padStart(2, '0');
      const seconds = String(remaining % 60).padStart(2, '0');
      elements.countdown.textContent = `${minutes}:${seconds}`;
      remaining--;
    }
  }, 1000);
}

setInterval(updateDateTime, 1000);
updateDateTime();
startCountdown();

displayMessage("Therapist", "Hello, I'm your CBT chatbot. What's on your mind today?");

function displayMessage(role, text) {
  const message = document.createElement('div');
  message.innerHTML = `<strong>${role}:</strong> ${text}`;
  message.style.color = role === 'Therapist' ? 'yellow' : 'white';
  elements.chat.appendChild(message);
  elements.chat.scrollTop = elements.chat.scrollHeight;
  logHistory.push({ role, text });
}

elements.recordButton.addEventListener('click', () => {
  state === 'idle' ? startRecording() : stopRecording();
});

elements.saveButton.addEventListener('click', () => {
  const blob = new Blob([logHistory.map(m => `${m.role}: ${m.text}`).join("\n")], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'chat_log.txt';
  a.click();
  URL.revokeObjectURL(url);
});

async function startRecording() {
  if (state !== 'idle') return;
  state = 'recording';
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];

    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    sourceNode = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    sourceNode.connect(analyser);
    drawWaveform(elements.userScope, analyser);

    mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
    mediaRecorder.onstop = async () => {
      state = 'processing';
      cleanupStream();
      try {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const userText = await transcribeAudio(audioBlob);
        displayMessage('You', userText);
        const responseText = await getCBTResponse(userText);
        await typeCBTMessage(responseText);
        await speakCBT(responseText);
      } catch (error) {
        displayMessage('System', `Error: ${error.message}`);
      } finally {
        state = 'idle';
        updateRecordButton();
      }
    };

    mediaRecorder.start();
    updateRecordButton();
    setTimeout(() => {
      if (state === 'recording') stopRecording();
    }, config.maxRecordingTime);
  } catch (error) {
    displayMessage('System', `Recording error: ${error.message}`);
    state = 'idle';
    updateRecordButton();
  }
}

function stopRecording() {
  if (state === 'recording') mediaRecorder.stop();
}

function cleanupStream() {
  if (stream) stream.getTracks().forEach(track => track.stop());
  if (sourceNode) sourceNode.disconnect();
  if (audioContext) audioContext.close();
}

function updateRecordButton() {
  elements.recordButton.textContent = state === 'recording' ? 'Stop' : 'Speak';
  elements.recordButton.style.borderColor = state === 'recording' ? 'magenta' : '#0ff';
  elements.recordButton.disabled = state === 'processing';
}

function drawWaveform(canvas, analyser) {
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;
  analyser.fftSize = 256;
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  function draw() {
    if (state !== 'recording') return;
    requestAnimationFrame(draw);
    analyser.getByteTimeDomainData(dataArray);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'yellow';
    ctx.beginPath();
    const sliceWidth = canvas.width / bufferLength;
    let x = 0;
    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = v * canvas.height / 2;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      x += sliceWidth;
    }
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
  }
  draw();
}

async function transcribeAudio(blob) {
  return new Promise(resolve => {
    setTimeout(() => resolve("I feel weird today."), 500);
  });
}

async function getCBTResponse(userText) {
  const responses = [
    "Let's try identifying the thought behind that feeling.",
    "Can you tell me what triggered that reaction?",
    "It might help to challenge that belief. What evidence supports it?",
    "How would you respond if a friend told you that?",
    "You're doing well. Just take it one step at a time."
  ];
  return responses[Math.floor(Math.random() * responses.length)];
}

async function speakCBT(text) {
  return new Promise((resolve, reject) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.pitch = 1;
    utterance.rate = 1;
    utterance.volume = 1;
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
    utterance.onend = resolve;
    utterance.onerror = e => reject(new Error(e.message));
  });
}

async function typeCBTMessage(text) {
  return new Promise(resolve => {
    let i = 0;
    const msg = document.createElement('div');
    msg.innerHTML = `<strong>Therapist:</strong> `;
    msg.style.color = 'yellow';
    elements.chat.appendChild(msg);
    const interval = setInterval(() => {
      if (i <= text.length) {
        msg.innerHTML = `<strong>Therapist:</strong> ${text.slice(0, i)}`;
        i++;
      } else {
        clearInterval(interval);
        resolve();
      }
    }, 25);
  });
}

window.addEventListener('unload', cleanupStream);
