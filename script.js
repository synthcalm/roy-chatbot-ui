// script.js - Logic for Roy Chatbot UI

const royToggle = document.getElementById('roy-toggle');
const randyToggle = document.getElementById('randy-toggle');
const speakToggle = document.getElementById('speak-toggle');
const homeButton = document.getElementById('home-button');
const messagesDiv = document.getElementById('messages');
const userCanvas = document.getElementById('userWaveform');
const royCanvas = document.getElementById('royWaveform');
const userCtx = userCanvas.getContext('2d');
const royCtx = royCanvas.getContext('2d');
const currentDate = document.getElementById('current-date');
const currentTime = document.getElementById('current-time');
const countdownTimer = document.getElementById('countdown-timer');

let audioContext, analyser, dataArray, source, mediaRecorder, stream;
let isRecording = false;
let isRantMode = false;
let sessionStartTime = null;
let chunks = [], volumeData = [];

function updateDateTime() {
  const now = new Date();
  const year = now.getFullYear().toString().slice(2);
  const formatted = `${year}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getDate().toString().padStart(2, '0')}`;
  currentDate.textContent = formatted;
  currentTime.textContent = now.toLocaleTimeString();

  if (isRecording && sessionStartTime) {
    const elapsed = Math.floor((now - sessionStartTime) / 1000);
    const maxTime = isRantMode ? 1800 : 3600;
    const remaining = maxTime - elapsed;
    const min = Math.floor(remaining / 60);
    const sec = remaining % 60;
    countdownTimer.textContent = `Session: ${min}:${sec < 10 ? '0' : ''}${sec}`;
  }
}
setInterval(updateDateTime, 1000);

function resetButtons() {
  royToggle.className = 'btn';
  randyToggle.className = 'btn';
  speakToggle.className = 'btn';
  speakToggle.textContent = 'Speak';
  speakToggle.style.animation = 'none';
}

function activateSpeakButton() {
  speakToggle.className = 'btn speak-ready';
  speakToggle.textContent = 'Speak';
  speakToggle.style.animation = 'none';
}

function updateSpeakButtonRecordingState() {
  speakToggle.className = 'btn speak-active';
  speakToggle.textContent = 'STOP';
}

function drawUserScope() {
  if (!isRecording) return;
  analyser.getByteFrequencyData(dataArray);
  userCtx.clearRect(0, 0, userCanvas.width, userCanvas.height);
  userCtx.beginPath();
  for (let i = 0; i < dataArray.length; i++) {
    userCtx.lineTo(i * (userCanvas.width / dataArray.length), userCanvas.height - dataArray[i]);
  }
  userCtx.strokeStyle = 'yellow';
  userCtx.stroke();
  requestAnimationFrame(drawUserScope);
}

async function startRecording() {
  stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioContext.createAnalyser();
  source = audioContext.createMediaStreamSource(stream);
  source.connect(analyser);
  analyser.fftSize = 2048;
  dataArray = new Uint8Array(analyser.frequencyBinCount);

  mediaRecorder = new MediaRecorder(stream);
  mediaRecorder.start();

  mediaRecorder.ondataavailable = (e) => {
    chunks.push(e.data);
    analyser.getByteFrequencyData(dataArray);
    const avgVolume = dataArray.reduce((sum, val) => sum + val, 0) / dataArray.length;
    volumeData.push(avgVolume);
  };

  mediaRecorder.onstop = async () => {
    const blob = new Blob(chunks, { type: 'audio/webm' });
    const formData = new FormData();
    formData.append('audio', blob, 'audio.webm');

    const res = await fetch('https://roy-chatbo-backend.onrender.com/api/transcribe', {
      method: 'POST',
      body: formData
    });

    const { text } = await res.json();
    const userMsg = document.createElement('p');
    userMsg.className = 'user';
    userMsg.textContent = `You: ${text}`;
    messagesDiv.appendChild(userMsg);
    addThinkingDots();
    sendToRoy(text);
  };

  sessionStartTime = new Date();
  isRecording = true;
  chunks = [];
  volumeData = [];
  updateSpeakButtonRecordingState();
  drawUserScope();
}

function stopRecording() {
  isRecording = false;
  resetButtons();
  mediaRecorder.stop();
  stream.getTracks().forEach(track => track.stop());
  source.disconnect();
  audioContext.close();
  isRantMode ? activateRandy() : activateRoy();
}

function addThinkingDots() {
  const thinking = document.createElement('p');
  thinking.className = 'roy';
  thinking.id = 'thinking';
  thinking.innerHTML = `<em>${isRantMode ? 'Randy' : 'Roy'}:</em> <span class="dots">...</span>`;
  messagesDiv.appendChild(thinking);
}

function sendToRoy(text) {
  const chatPayload = {
    message: text,
    persona: isRantMode ? 'randy' : 'default',
    poeticLevel: 0.1,
    disfluencyLevel: 0.45,
    jobsStyleLevel: 0.25,
    volumeData
  };

  fetch('https://roy-chatbo-backend.onrender.com/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(chatPayload)
  })
    .then(res => res.json())
    .then(({ text: replyText, audio: audioBase64 }) => {
      const thinkingEl = document.getElementById('thinking');
      if (thinkingEl) thinkingEl.remove();

      const msg = document.createElement('p');
      msg.className = 'roy';
      msg.innerHTML = `<em>${isRantMode ? 'Randy' : 'Roy'}:</em> ${replyText}`;
      messagesDiv.appendChild(msg);

      if (audioBase64) playRoyAudio(audioBase64);
    });
}

function playRoyAudio(base64) {
  const audio = new Audio(`data:audio/mp3;base64,${base64}`);
  audio.setAttribute('playsinline', '');
  audio.play().catch(e => console.error("Audio play error:", e));
  drawRoyScope(audio);
}

function drawRoyScope(audio) {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  let source;
  try {
    source = audioCtx.createMediaElementSource(audio);
  } catch (e) {
    console.error("Roy audio source error:", e);
    return;
  }
  const analyser = audioCtx.createAnalyser();
  source.connect(analyser);
  analyser.connect(audioCtx.destination);
  analyser.fftSize = 2048;
  const dataArray = new Uint8Array(analyser.frequencyBinCount);

  function draw() {
    analyser.getByteFrequencyData(dataArray);
    royCtx.clearRect(0, 0, royCanvas.width, royCanvas.height);
    royCtx.beginPath();
    for (let i = 0; i < dataArray.length; i++) {
      royCtx.lineTo(i * (royCanvas.width / dataArray.length), royCanvas.height - dataArray[i]);
    }
    royCtx.strokeStyle = 'magenta';
    royCtx.stroke();
    requestAnimationFrame(draw);
  }
  draw();
}

function activateRoy() {
  resetButtons();
  royToggle.classList.add('active-roy');
  isRantMode = false;
  activateSpeakButton();
}

function activateRandy() {
  resetButtons();
  randyToggle.classList.add('active-randy');
  isRantMode = true;
  activateSpeakButton();
}

royToggle.addEventListener('click', activateRoy);
randyToggle.addEventListener('click', activateRandy);

speakToggle.addEventListener('click', () => {
  if (!isRecording) {
    startRecording();
  } else {
    stopRecording();
  }
});

homeButton.addEventListener('click', () => {
  window.location.href = "https://synthcalm.com";
});

window.addEventListener('DOMContentLoaded', () => {
  activateRoy();
});
