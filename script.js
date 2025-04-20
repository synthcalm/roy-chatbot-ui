const royToggle = document.getElementById('roy-toggle');
const randyToggle = document.getElementById('randy-toggle');
const speakToggle = document.getElementById('speak-toggle');
const messagesDiv = document.getElementById('messages');
const royWaveform = document.getElementById('royWaveform');
const userWaveform = document.getElementById('userWaveform');
const royCtx = royWaveform.getContext('2d');
const userCtx = userWaveform.getContext('2d');
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
  currentDate.textContent = now.toLocaleDateString();
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
  royToggle.style.background = 'cyan';
  royToggle.style.color = 'black';
  randyToggle.style.background = 'cyan';
  randyToggle.style.color = 'black';
  speakToggle.textContent = 'Speak';
  speakToggle.style.background = 'black';
  speakToggle.style.color = 'red';
  speakToggle.style.borderColor = 'red';
  speakToggle.style.animation = 'blinker 1s linear infinite';
}

function updateSpeakButtonRecordingState() {
  speakToggle.textContent = 'Stop';
  speakToggle.style.background = 'red';
  speakToggle.style.color = 'black';
  speakToggle.style.animation = 'none';
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

    sendToRoy(text);
  };

  sessionStartTime = new Date();
  isRecording = true;
  chunks = [];
  volumeData = [];
  updateSpeakButtonRecordingState();
  drawUserWaveform(); // 👈 start drawing live
}

function stopRecording() {
  isRecording = false;
  resetButtons();
  mediaRecorder.stop();
  stream.getTracks().forEach(track => track.stop());
  source.disconnect();
  audioContext.close();
}

function drawUserWaveform() {
  if (!isRecording) return;
  analyser.getByteFrequencyData(dataArray);
  userCtx.clearRect(0, 0, userWaveform.width, userWaveform.height);
  userCtx.beginPath();
  for (let i = 0; i < dataArray.length; i++) {
    userCtx.lineTo(i * (userWaveform.width / dataArray.length), userWaveform.height - dataArray[i]);
  }
  userCtx.strokeStyle = 'yellow';
  userCtx.stroke();
  requestAnimationFrame(drawUserWaveform);
}

function sendToRoy(text) {
  const chatPayload = {
    message: text,
    mode: 'both',
    persona: isRantMode ? 'randy' : 'default',
    volumeData
  };

  fetch('https://roy-chatbo-backend.onrender.com/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(chatPayload)
  })
    .then(res => res.json())
    .then(({ text: replyText, audio: audioBase64 }) => {
      const msg = document.createElement('p');
      msg.className = 'roy';
      if (isRantMode) msg.classList.add('randy');
      msg.innerHTML = `<em>${isRantMode ? 'Randy' : 'Roy'}:</em> ${replyText}`;
      messagesDiv.appendChild(msg);
      if (audioBase64) playRoyAudio(audioBase64);
    });
}

function playRoyAudio(base64) {
  const audio = new Audio(`data:audio/mp3;base64,${base64}`);
  audio.setAttribute('playsinline', '');
  audio.play().catch(e => console.error("Audio play error:", e));
  visualizeAudio(audio);
}

function visualizeAudio(audio) {
  const canvas = royWaveform;
  const ctx = royCtx;
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  let source;

  try {
    source = audioCtx.createMediaElementSource(audio);
  } catch (e) {
    console.error("Roy audio source already used:", e);
    return;
  }

  const analyser = audioCtx.createAnalyser();
  source.connect(analyser);
  analyser.connect(audioCtx.destination);
  analyser.fftSize = 2048;
  const dataArray = new Uint8Array(analyser.frequencyBinCount);

  function draw() {
    analyser.getByteFrequencyData(dataArray);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    for (let i = 0; i < dataArray.length; i++) {
      ctx.lineTo(i * (canvas.width / dataArray.length), canvas.height - dataArray[i]);
    }
    ctx.strokeStyle = 'yellow';
    ctx.stroke();
    requestAnimationFrame(draw);
  }

  draw();
}

royToggle.addEventListener('click', () => {
  isRantMode = false;
  resetButtons();
  royToggle.style.background = 'lime';
  royToggle.style.color = 'black';
});

randyToggle.addEventListener('click', () => {
  isRantMode = true;
  resetButtons();
  randyToggle.style.background = 'orange';
  randyToggle.style.color = 'black';
});

speakToggle.addEventListener('click', () => {
  if (!isRecording) {
    startRecording();
  } else {
    stopRecording();
  }
});

// ✅ Trigger Roy greeting on load
window.addEventListener('DOMContentLoaded', () => {
  const greeting = isRantMode ? "Yo Randy. What's on your mind?" : "Hello Roy. You there?";
  sendToRoy(greeting);
});
