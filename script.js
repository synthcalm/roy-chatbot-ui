// script.js – Frontend logic for Roy Chatbot (Auto transcription, mobile-friendly, dual waveform)
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
let royAudioContext, royAnalyser, royDataArray;

const greetings = [
  "Hello.",
  "Hi there.",
  "Welcome.",
  "How are you today?",
  "Glad you're here.",
  "Nice to see you.",
  "We begin whenever you're ready."
];

const sessionId = `session-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
let autoSubmitToggle = true; // Enable auto submission after transcription

function drawUserWaveform() {
  if (!userAnalyser) return;
  requestAnimationFrame(drawUserWaveform);
  userAnalyser.getByteTimeDomainData(userDataArray);
  userCtx.fillStyle = '#000';
  userCtx.fillRect(0, 0, userCanvas.width, userCanvas.height);
  userCtx.lineWidth = 2;
  userCtx.strokeStyle = 'yellow';
  userCtx.beginPath();
  const sliceWidth = userCanvas.width / userDataArray.length;
  let x = 0;
  for (let i = 0; i < userDataArray.length; i++) {
    const v = userDataArray[i] / 128.0;
    const y = v * userCanvas.height / 2;
    i === 0 ? userCtx.moveTo(x, y) : userCtx.lineTo(x, y);
    x += sliceWidth;
  }
  userCtx.lineTo(userCanvas.width, userCanvas.height / 2);
  userCtx.stroke();
}

function drawRoyWaveform() {
  if (!royAnalyser) return;
  requestAnimationFrame(drawRoyWaveform);
  royAnalyser.getByteTimeDomainData(royDataArray);
  royCtx.fillStyle = '#000';
  royCtx.fillRect(0, 0, royCanvas.width, royCanvas.height);
  royCtx.lineWidth = 2;
  royCtx.strokeStyle = 'magenta';
  royCtx.beginPath();
  const sliceWidth = royCanvas.width / royDataArray.length;
  let x = 0;
  for (let i = 0; i < royDataArray.length; i++) {
    const v = royDataArray[i] / 128.0;
    const y = v * royCanvas.height / 2;
    i === 0 ? royCtx.moveTo(x, y) : royCtx.lineTo(x, y);
    x += sliceWidth;
  }
  royCtx.lineTo(royCanvas.width, royCanvas.height / 2);
  royCtx.stroke();
}

micBtn.addEventListener('click', async () => {
  autoSubmitToggle = !autoSubmitToggle; // Toggle between modes
  micBtn.textContent = autoSubmitToggle ? 'Stop' : 'Speak';
  micBtn.style.borderColor = autoSubmitToggle ? 'red' : '#0ff';

  if (!isRecording) {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      chunks = [];

      userAudioContext = new (window.AudioContext || window.webkitAudioContext)();
      userAnalyser = userAudioContext.createAnalyser();
      userSource = userAudioContext.createMediaStreamSource(stream);
      userSource.connect(userAnalyser);
      userAnalyser.fftSize = 2048;
      userDataArray = new Uint8Array(userAnalyser.frequencyBinCount);
      drawUserWaveform();

      mediaRecorder.ondataavailable = e => chunks.push(e.data);
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('audio', blob);
        const res = await fetch('https://roy-chatbo-backend.onrender.com/api/transcribe', {
          method: 'POST',
          body: formData
        });

        if (!res.ok) {
          console.error('Transcribe error:', await res.text());
          return;
        }

        const data = await res.json();
        inputEl.value = data.text || '';

        if (autoSubmitToggle && inputEl.value.trim()) {
          sendBtn.click();
        } else {
          micBtn.textContent = 'Speak';
          micBtn.style.borderColor = '#0ff';
        }
      };

      mediaRecorder.start();
      isRecording = true;
    } catch (err) {
      console.error('Mic error:', err);
    }
  } else {
    mediaRecorder.stop();
    stream.getTracks().forEach(track => track.stop());
    isRecording = false;
  }
});

sendBtn.addEventListener('click', async () => {
  const message = inputEl.value.trim();
  if (!message) return;

  const mode = modeSelect.value;
  appendMessage('You', message);
  inputEl.value = '';

  const res = await fetch('https://roy-chatbo-backend.onrender.com/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sessionId })
  });

  if (!res.ok) {
    console.error('Chat error:', await res.text());
    return;
  }

  const data = await res.json();

  if (mode === 'both' || mode === 'text') {
    appendMessage('Roy', data.text);
  }

  if (mode === 'both' || mode === 'voice') {
    audioEl.src = `data:audio/mp3;base64,${data.audio}`;
    audioEl.style.display = 'block';
    audioEl.play();

    royAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    royAnalyser = royAudioContext.createAnalyser();
    royAnalyser.fftSize = 2048;
    royDataArray = new Uint8Array(royAnalyser.frequencyBinCount);

    const source = royAudioContext.createMediaElementSource(audioEl);
    source.connect(royAnalyser);
    royAnalyser.connect(royAudioContext.destination);
    drawRoyWaveform();
  } else {
    audioEl.pause();
    audioEl.style.display = 'none';
  }
});

function appendMessage(sender, text) {
  const p = document.createElement('p');
  p.innerHTML = `<strong>${sender}:</strong> ${text}`;
  messagesEl.appendChild(p);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

window.addEventListener('DOMContentLoaded', () => {
  const greeting = greetings[Math.floor(Math.random() * greetings.length)];
  appendMessage('Roy', `${greeting} You can either speak into the mic or type in the text box.`);
});
