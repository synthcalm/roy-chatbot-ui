// ✅ script.js - SynthCalm Roy Chatbot Logic

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

let audioContext, analyser, dataArray, source, mediaRecorder, stream;
let isRecording = false;
let isRantMode = false;
let chunks = [], volumeData = [];

function resetButtons() {
  royToggle.className = 'btn';
  randyToggle.className = 'btn';
  speakToggle.className = 'btn speak-standby';
  speakToggle.textContent = 'Speak';
  speakToggle.style.animation = 'none';
}

function activateRoy() {
  resetButtons();
  royToggle.classList.add('active-roy');
  speakToggle.classList.add('speak-standby');
  isRantMode = false;
}

function activateRandy() {
  resetButtons();
  randyToggle.classList.add('active-randy');
  speakToggle.classList.add('speak-standby');
  isRantMode = true;
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
  userCtx.strokeStyle = 'cyan';
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
  chunks = [];
  volumeData = [];

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

    try {
      const res = await fetch('/api/transcribe', { method: 'POST', body: formData });
      const { text } = await res.json();

      const userMsg = document.createElement('p');
      userMsg.className = 'user';
      userMsg.textContent = `You: ${text}`;
      messagesDiv.appendChild(userMsg);

      addThinkingDots();
      sendToRoy(text);
    } catch (err) {
      console.error('Transcription failed:', err);
    }
  };

  isRecording = true;
  updateSpeakButtonRecordingState();
  drawUserScope();
}

function stopRecording() {
  isRecording = false;
  mediaRecorder.stop();
  stream.getTracks().forEach(track => track.stop());
  source.disconnect();
  audioContext.close();
}

function addThinkingDots() {
  const p = document.createElement('p');
  p.className = 'roy';
  p.innerHTML = `<em>${isRantMode ? 'Randy' : 'Roy'}:</em> <span class="dots"></span>`;
  p.id = 'thinking';
  messagesDiv.appendChild(p);
}

function sendToRoy(text) {
  fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: text,
      persona: isRantMode ? 'randy' : 'default',
      volumeData
    })
  })
    .then(res => res.json())
    .then(({ text: replyText, audio }) => {
      document.getElementById('thinking')?.remove();

      const msg = document.createElement('p');
      msg.className = 'roy';
      msg.innerHTML = `<em>${isRantMode ? 'Randy' : 'Roy'}:</em> ${replyText}`;
      messagesDiv.appendChild(msg);

      if (audio) playRoyAudio(audio);
    })
    .catch(err => console.error('Chat failed:', err));
}

function playRoyAudio(base64) {
  const audio = new Audio(`data:audio/mp3;base64,${base64}`);
  audio.play();
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
    royCtx.strokeStyle = 'cyan';
    royCtx.stroke();
    requestAnimationFrame(draw);
  }
  draw();
}

function saveConversation() {
  const text = messagesDiv.innerText;
  const blob = new Blob([text], { type: 'text/plain' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'chat.txt';
  link.click();
  resetButtons();
}

royToggle.addEventListener('click', activateRoy);
randyToggle.addEventListener('click', activateRandy);
speakToggle.addEventListener('click', () => isRecording ? stopRecording() : startRecording());
saveButton.addEventListener('click', saveConversation);
homeButton.addEventListener('click', () => location.href = 'https://synthcalm.com');

window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    const intro = document.createElement('p');
    intro.className = 'roy';
    intro.textContent = "Roy: Hey there. You showed up. That means something.";
    messagesDiv.appendChild(intro);
  }, 500);
});
