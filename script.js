let mediaRecorder, audioChunks = [], audioContext, sourceNode;
let state = 'idle'; // idle, recording, processing
let stream;

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
  duration: 60,
  maxRecordingTime: 60000 // 60 seconds max
};

let countdownInterval;

function updateDateTime() {
  const now = new Date();
  elements.clock.textContent = now.toTimeString().split(' ')[0];
  elements.date.textContent = now.toISOString().split('T')[0];
}

function startCountdown() {
  let remaining = config.duration;
  elements.countdown.textContent = `59:59`;
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

function displayMessage(role, text) {
  const message = document.createElement('div');
  message.innerHTML = `<strong>${role}:</strong> ${text}`;
  elements.chat.appendChild(message);
  elements.chat.scrollTop = elements.chat.scrollHeight;
}

displayMessage("Roy", "Welcome. I'm Roy. Speak when ready.");

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
        const royText = await getRoyResponse(userText);
        displayMessage('Roy', royText);
        await speakRoy(royText);
      } catch (error) {
        displayMessage('System', `Error processing audio: ${error.message}`);
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
    displayMessage('System', `Failed to start recording: ${error.message}`);
    state = 'idle';
    updateRecordButton();
  }
}

function stopRecording() {
  if (state !== 'recording' || !mediaRecorder || mediaRecorder.state === 'inactive') return;
  mediaRecorder.stop();
}

function cleanupStream() {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }
  if (sourceNode) {
    sourceNode.disconnect();
    sourceNode = null;
  }
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
}

function updateRecordButton() {
  elements.recordButton.textContent = state === 'recording' ? 'Stop' : 'Speak';
  elements.recordButton.style.borderColor = state === 'recording' ? 'magenta' : '#0ff';
  elements.recordButton.disabled = state === 'processing';
}

elements.recordButton.addEventListener('click', () => {
  if (state === 'idle') {
    startRecording();
  } else if (state === 'recording') {
    stopRecording();
  }
});

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
  return new Promise((resolve, reject) => {
    setTimeout(() => resolve("I feel weird today."), 1000);
  });
}

async function getRoyResponse(userText) {
  return new Promise((resolve, reject) => {
    setTimeout(() => resolve("It's okay to feel weird sometimes. Let's talk about it."), 1500);
  });
}

async function speakRoy(text) {
  return new Promise((resolve, reject) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.pitch = 0.7;
    utterance.rate = 0.88;
    utterance.volume = 1;
    utterance.lang = 'en-US';
    utterance.text = text.replace(/([.,!?])/g, '$1...');
    utterance.onstart = () => console.log("Roy is speaking...");
    utterance.onend = () => {
      console.log("Roy finished.");
      resolve();
    };
    utterance.onerror = (e) => reject(new Error(`Speech synthesis error: ${e.error}`));
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  });
}

// Cleanup on page unload
window.addEventListener('unload', cleanupStream);
