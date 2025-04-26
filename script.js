// === script.js (Fully Assembled with AssemblyAI WebSocket and Roy GPT Integration) ===

let socket;
let isRecording = false;
let speakBtn = document.getElementById('speakBtn');
let currentTranscript = '';
let lastTranscript = '';

// === Waveform Setup ===
let audioContext, analyser, dataArray, source;
let royAudioContext, royAnalyser, royDataArray, roySource;

function updateDateTime() {
  const dateTimeDiv = document.getElementById('date-time');
  if (dateTimeDiv) {
    dateTimeDiv.textContent = new Date().toLocaleString();
    setInterval(() => {
      dateTimeDiv.textContent = new Date().toLocaleString();
    }, 1000);
  }
}

function updateCountdownTimer() {
  const countdownDiv = document.getElementById('countdown-timer');
  let timeLeft = 3600;
  const updateTimer = () => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    countdownDiv.textContent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    timeLeft = (timeLeft - 1 + 3600) % 3600;
  };
  updateTimer();
  setInterval(updateTimer, 1000);
}

function drawMergedWaveform(ctx, canvas) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (analyser && dataArray) {
    analyser.getByteTimeDomainData(dataArray);
    ctx.beginPath();
    const sliceWidth = canvas.width / dataArray.length;
    let x = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * canvas.height) / 4;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      x += sliceWidth;
    }
    ctx.strokeStyle = '#66CCFF';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  if (royAnalyser && royDataArray) {
    royAnalyser.getByteTimeDomainData(royDataArray);
    ctx.beginPath();
    const sliceWidth = canvas.width / royDataArray.length;
    let x = 0;
    for (let i = 0; i < royDataArray.length; i++) {
      const v = royDataArray[i] / 128.0;
      const y = (v * canvas.height) / 4 + canvas.height / 2;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      x += sliceWidth;
    }
    ctx.strokeStyle = '#CCCCCC';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  if (isRecording || royAnalyser) {
    requestAnimationFrame(() => drawMergedWaveform(ctx, canvas));
  }
}

function initWaveform() {
  const waveform = document.getElementById('waveform');
  const container = waveform.parentElement;
  waveform.width = container.offsetWidth;
  waveform.height = container.offsetHeight;
  const ctx = waveform.getContext('2d');
  return { waveform, ctx };
}

function appendUserMessage(message) {
  const messages = document.getElementById('messages');
  messages.innerHTML += `<div class="user">You: ${message}</div>`;
  messages.scrollTop = messages.scrollHeight;
}

function appendRoyMessage(message) {
  const messages = document.getElementById('messages');
  messages.innerHTML += `<div class="roy">Roy: ${message}</div>`;
  messages.scrollTop = messages.scrollHeight;
}

// === Secure Token Fetch ===
async function getAssemblyToken() {
  const res = await fetch('/api/get-assembly-token', { method: 'POST' });
  const data = await res.json();
  return data.token;
}

// === Setup WebSocket and Transcription ===
async function startWebSocketTranscription() {
  const token = await getAssemblyToken();
  socket = new WebSocket(`wss://api.assemblyai.com/v2/realtime/ws?token=${token}`);

  socket.onopen = () => {
    console.log('WebSocket connected');
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      source = audioContext.createMediaStreamSource(stream);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      dataArray = new Uint8Array(analyser.frequencyBinCount);
      source.connect(analyser);
      isRecording = true;
      const { waveform, ctx } = initWaveform();
      drawMergedWaveform(ctx, waveform);

      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      source.connect(processor);
      processor.connect(audioContext.destination);

      processor.onaudioprocess = e => {
        const inputData = e.inputBuffer.getChannelData(0);
        const int16Array = convertFloat32ToInt16(inputData);
        socket.send(int16Array);
      };
    });
  };

  socket.onmessage = msg => {
    const res = JSON.parse(msg.data);
    if (res.text && res.text !== lastTranscript) {
      currentTranscript = res.text;
      lastTranscript = res.text;
    }
  };

  socket.onerror = err => console.error('WebSocket Error:', err);
}

function convertFloat32ToInt16(buffer) {
  let l = buffer.length;
  const buf = new Int16Array(l);
  while (l--) buf[l] = Math.min(1, buffer[l]) * 0x7FFF;
  return buf;
}

// === Stop Recording ===
function stopRecording() {
  isRecording = false;
  if (socket) socket.close();
  speakBtn.classList.remove('active');
  speakBtn.innerText = 'SPEAK';
  if (currentTranscript.trim() !== '') sendToRoy(currentTranscript);
  currentTranscript = '';
}

// === Send to Roy Backend ===
function sendToRoy(transcript) {
  appendUserMessage(transcript);
  document.getElementById('thinking-indicator').style.display = 'block';
  fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: transcript })
  })
    .then(response => response.json())
    .then(data => {
      document.getElementById('thinking-indicator').style.display = 'none';
      if (data.text) appendRoyMessage(data.text);
      if (data.audio) playRoyAudio(data.audio);
    })
    .catch(err => {
      document.getElementById('thinking-indicator').style.display = 'none';
      appendRoyMessage('Error: Could not get Roy’s response.');
      console.error('Roy API Error:', err);
    });
}

// === Roy Audio Playback ===
function playRoyAudio(audioData) {
  if (royAudioContext && royAudioContext.state !== 'closed') {
    try { royAudioContext.close(); } catch (e) {}
  }
  const audio = new Audio(audioData);
  royAudioContext = new (window.AudioContext || window.webkitAudioContext)();
  royAnalyser = royAudioContext.createAnalyser();
  royAnalyser.fftSize = 2048;
  royDataArray = new Uint8Array(royAnalyser.frequencyBinCount);
  roySource = royAudioContext.createMediaElementSource(audio);
  roySource.connect(royAnalyser);
  royAnalyser.connect(royAudioContext.destination);
  const { waveform, ctx } = initWaveform();
  drawMergedWaveform(ctx, waveform);
  audio.play().catch(err => console.error('Audio playback error:', err));
}

// === DOM Ready ===
document.addEventListener('DOMContentLoaded', () => {
  updateDateTime();
  updateCountdownTimer();
  speakBtn = document.getElementById('speakBtn');

  appendRoyMessage("Hey, man... I'm Roy, your chill companion here to listen. Whenever you're ready, just hit SPEAK and let's talk, yeah?");

  speakBtn.addEventListener('click', () => {
    if (!isRecording) {
      isRecording = true;
      speakBtn.classList.add('active');
      speakBtn.innerText = 'STOP';
      startWebSocketTranscription();
    } else {
      stopRecording();
    }
  });
});
