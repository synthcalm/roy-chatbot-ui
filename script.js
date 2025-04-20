// ✅ script.js - Handles button states, waveform visuals, chat logic, and save functionality

const royToggle = document.getElementById('roy-toggle');
const randyToggle = document.getElementById('randy-toggle');
const speakToggle = document.getElementById('speak-toggle');
const saveButton = document.getElementById('save-button');
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

function isiOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

function updateDateTime() {
  const now = new Date();
  const year = now.getFullYear().toString().slice(2);
  currentDate.textContent = `${year}/${(now.getMonth()+1).toString().padStart(2,'0')}/${now.getDate().toString().padStart(2,'0')}`;
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
  speakToggle.style.animation = 'blinker 1s linear infinite';
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
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    analyser.fftSize = 2048;
    dataArray = new Uint8Array(analyser.frequencyBinCount);

    const mimeType = isiOS() ? 'audio/mp4' : 'audio/webm';
    mediaRecorder = new MediaRecorder(stream, { mimeType });
    mediaRecorder.start();
    chunks = [];
    volumeData = [];

    mediaRecorder.ondataavailable = (e) => {
      chunks.push(e.data);
      analyser.getByteFrequencyData(dataArray);
      const avgVolume = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      volumeData.push(avgVolume);
    };

    mediaRecorder.onstop = async () => {
      const format = isiOS() ? 'audio.mp4' : 'audio.webm';
      const blob = new Blob(chunks, { type: mimeType });
      const formData = new FormData();
      formData.append('audio', blob, format);

      try {
        const transcribeRes = await fetch('/api/transcribe', {
          method: 'POST',
          body: formData
        });
        if (!transcribeRes.ok) throw new Error(`Transcription failed with status ${transcribeRes.status}`);
        const { text } = await transcribeRes.json();
        if (!text || !text.trim()) return;
        const userMsg = document.createElement('p');
        userMsg.className = 'user';
        userMsg.textContent = `You: ${text}`;
        messagesDiv.appendChild(userMsg);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        addThinkingDots();
        sendToRoy(text);
      } catch (e) {
        console.error('Transcription failed:', e);
      }
    };

    sessionStartTime = new Date();
    isRecording = true;
    updateSpeakButtonRecordingState();
    drawUserScope();
  } catch (err) {
    console.error('Recording failed to start:', err);
  }
}

function stopRecording() {
  isRecording = false;
  resetButtons();
  mediaRecorder.stop();
  stream.getTracks().forEach(t => t.stop());
  source.disconnect();
  audioContext.close();
  isRantMode ? activateRandy() : activateRoy();
}

function addThinkingDots() {
  const el = document.createElement('p');
  el.className = 'roy';
  el.id = 'thinking';
  el.innerHTML = `<em>${isRantMode ? 'Randy' : 'Roy'}:</em> <span class="dots">...</span>`;
  messagesDiv.appendChild(el);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function sendToRoy(text) {
  const body = {
    message: text,
    persona: isRantMode ? 'randy' : 'default',
    volumeData
  };
  fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
    .then(r => r.json())
    .then(({ text: replyText, audio }) => {
      document.getElementById('thinking')?.remove();
      const quoteChance = Math.random();
      const royMsg = document.createElement('p');
      royMsg.className = 'roy';
      royMsg.textContent = quoteChance > 0.75 ? `Roy: "${replyText}"` : `Roy: ${replyText}`;
      messagesDiv.appendChild(royMsg);
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
      if (audio) playRoyAudio(audio);
    })
    .catch(e => console.error('Chat failed:', e));
}

function playRoyAudio(base64) {
  const audio = new Audio(`data:audio/mp3;base64,${base64}`);
  audio.setAttribute('playsinline', '');
  audio.play().catch(e => console.error("Audio play error:", e));
  drawRoyScope(audio);
}

function drawRoyScope(audio) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const source = ctx.createMediaElementSource(audio);
  const analyser = ctx.createAnalyser();
  source.connect(analyser);
  analyser.connect(ctx.destination);
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
  speakToggle.classList.remove('btn');
  speakToggle.classList.add('speak-standby');
  speakToggle.textContent = 'Speak';
  speakToggle.style.animation = 'none';
}

function activateRandy() {
  resetButtons();
  randyToggle.classList.add('active-randy');
  isRantMode = true;
  speakToggle.classList.remove('btn');
  speakToggle.classList.add('speak-standby');
  speakToggle.textContent = 'Speak';
  speakToggle.style.animation = 'none';
}

function saveConversation() {
  const text = messagesDiv.innerText;
  const blob = new Blob([text], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'roy_conversation.txt';
  a.click();
  resetButtons();
}

royToggle.addEventListener('click', activateRoy);
randyToggle.addEventListener('click', activateRandy);
speakToggle.addEventListener('click', () => !isRecording ? startRecording() : stopRecording());
saveButton.addEventListener('click', saveConversation);
homeButton.addEventListener('click', () => window.location.href = "https://synthcalm.com");

window.addEventListener('DOMContentLoaded', () => activateRoy());
