let mediaRecorder, audioChunks = [], audioContext, sourceNode;
let isRecording = false;
let stream;

const recordButton = document.getElementById('recordButton');
const saveButton = document.getElementById('saveButton');
const chat = document.getElementById('chat');
const userScope = document.getElementById('userScope');
const royScope = document.getElementById('royScope');
const clock = document.getElementById('clock');
const date = document.getElementById('date');
const countdown = document.getElementById('countdown');

const duration = 60;
let countdownInterval;

function updateDateTime() {
  const now = new Date();
  clock.textContent = now.toTimeString().split(' ')[0];
  date.textContent = now.toISOString().split('T')[0];
}
function startCountdown() {
  let remaining = duration;
  countdown.textContent = `59:59`;
  clearInterval(countdownInterval);
  countdownInterval = setInterval(() => {
    if (remaining <= 0) {
      clearInterval(countdownInterval);
    } else {
      const minutes = String(Math.floor(remaining / 60)).padStart(2, '0');
      const seconds = String(remaining % 60).padStart(2, '0');
      countdown.textContent = `${minutes}:${seconds}`;
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
  chat.appendChild(message);
  chat.scrollTop = chat.scrollHeight;
}

displayMessage("Roy", "Welcome. I'm Roy. Speak when ready.");

async function startRecording() {
  stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(stream);
  audioChunks = [];

  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const source = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();
  source.connect(analyser);
  sourceNode = source;

  drawWaveform(userScope, analyser);

  mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
  mediaRecorder.onstop = async () => {
    stopStream();
    const audioBlob = new Blob(audioChunks);
    const userText = await transcribeAudio(audioBlob);
    displayMessage('You', userText);
    const royText = await getRoyResponse(userText);
    displayMessage('Roy', royText);
    speakRoy(royText);
  };

  mediaRecorder.start();
  isRecording = true;
  recordButton.textContent = 'Stop';
  recordButton.style.borderColor = 'magenta';
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
    isRecording = false;
    recordButton.textContent = 'Speak';
    recordButton.style.borderColor = '#0ff';
  }
}

function stopStream() {
  if (stream) stream.getTracks().forEach(track => track.stop());
  if (sourceNode) sourceNode.disconnect();
}

recordButton.addEventListener('click', () => {
  if (!isRecording) {
    startRecording();
  } else {
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
    requestAnimationFrame(draw);
    analyser.getByteTimeDomainData(dataArray);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'yellow';
    ctx.beginPath();
    const sliceWidth = canvas.width * 1.0 / bufferLength;
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
    setTimeout(() => resolve("I feel weird today."), 1000);
  });
}

async function getRoyResponse(userText) {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve("It's okay to feel weird sometimes. Let's talk about it.");
    }, 1500);
  });
}

function speakRoy(text) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.pitch = 0.7;
  utterance.rate = 0.88;
  utterance.volume = 1;
  utterance.lang = 'en-US';

  // Optional: Insert strategic pauses
  utterance.text = text.replace(/([.,!?])/g, '$1...');

  utterance.onstart = () => console.log("Roy is speaking...");
  utterance.onend = () => console.log("Roy finished.");
  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
}
