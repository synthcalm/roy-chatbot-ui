// ✅ Roy Chatbot frontend logic upgraded to AssemblyAI real-time transcription with waveform and playback support

import { AssemblyAI } from 'https://cdn.jsdelivr.net/npm/assemblyai@1.0.0/+esm';

const API_KEY = 'your-assemblyai-api-key'; // Replace with actual key or import securely
const ASSEMBLY_ENDPOINT = 'wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000';

let audioContext, processor, sourceNode, stream;
let socket, transcript = '', isRecording = false;

const royToggle = document.getElementById('roy-toggle');
const randyToggle = document.getElementById('randy-toggle');
const speakToggle = document.getElementById('speak-toggle');
const messagesDiv = document.getElementById('messages');
const royWaveform = document.getElementById('royWaveform');
const royCtx = royWaveform.getContext('2d');

let isRantMode = false;

function resetButtons() {
  royToggle.style.background = 'cyan';
  royToggle.style.color = 'black';
  randyToggle.style.background = 'cyan';
  randyToggle.style.color = 'black';
}

function updateButtonStates() {
  speakToggle.textContent = isRecording ? 'Stop' : 'Speak';
  speakToggle.style.background = isRecording ? 'red' : 'black';
  speakToggle.style.color = isRecording ? 'black' : 'red';
  speakToggle.style.borderColor = 'red';
  speakToggle.style.animation = isRecording ? 'none' : 'blinker 1s linear infinite';
}

function startRealtimeTranscription() {
  socket = new WebSocket(`${ASSEMBLY_ENDPOINT}&token=${API_KEY}`);
  socket.onmessage = (msg) => {
    const res = JSON.parse(msg.data);
    if (res.text) {
      transcript += res.text + ' ';
    }
  };
}

async function startRecording() {
  isRecording = true;
  updateButtonStates();
  transcript = '';

  stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const input = audioContext.createMediaStreamSource(stream);
  processor = audioContext.createScriptProcessor(4096, 1, 1);

  input.connect(processor);
  processor.connect(audioContext.destination);

  const sampleRate = 16000;
  const encoder = new TextEncoder();

  startRealtimeTranscription();

  processor.onaudioprocess = (e) => {
    const raw = e.inputBuffer.getChannelData(0);
    const int16 = convertFloat32ToInt16(raw);
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(int16);
    }
  };
}

function stopRecording() {
  isRecording = false;
  updateButtonStates();

  processor.disconnect();
  sourceNode?.disconnect();
  stream.getTracks().forEach(track => track.stop());
  socket?.close();

  const userMsg = document.createElement('p');
  userMsg.className = 'user';
  userMsg.textContent = `You: ${transcript.trim()}`;
  messagesDiv.appendChild(userMsg);

  sendToRoy(transcript.trim());
}

function sendToRoy(text) {
  const chatPayload = {
    message: text,
    mode: 'both',
    persona: isRantMode ? 'randy' : 'default',
    volumeData: []
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

function convertFloat32ToInt16(buffer) {
  const l = buffer.length;
  const buf = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    buf[i] = Math.min(1, buffer[i]) * 0x7FFF;
  }
  return buf.buffer;
}

function playRoyAudio(base64) {
  const audio = new Audio(`data:audio/mp3;base64,${base64}`);
  audio.setAttribute('playsinline', '');
  audio.load();
  audio.onloadeddata = () => {
    audio.play().then(() => visualizeAudio(audio)).catch(() => {
      const resume = () => {
        audio.play().then(() => visualizeAudio(audio));
        document.body.removeEventListener('click', resume);
      };
      document.body.addEventListener('click', resume, { once: true });
    });
  };
}

function visualizeAudio(audio) {
  const ctx = royCtx;
  const canvas = royWaveform;
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const source = audioCtx.createMediaElementSource(audio);
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
