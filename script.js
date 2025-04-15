// Global variables
let micActive = false;
let token = null;
let socket = null;
let mediaRecorder = null;
let audioContext = null;
let analyser = null;
let liveTranscript = '';
let isTyping = false;

// DOM elements
const messages = document.getElementById('messages');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');
const micToggle = document.getElementById('mic-toggle');
const responseMode = document.getElementById('responseMode');
const saveLogButton = document.getElementById('save-log');
const homeButton = document.getElementById('home-btn');
const royAudio = document.getElementById('roy-audio');
const currentDate = document.getElementById('current-date');
const currentTime = document.getElementById('current-time');
const countdownTimer = document.getElementById('countdown-timer');
const userWaveform = document.getElementById('userWaveform');
const royWaveform = document.getElementById('royWaveform');

function updateDateTime() {
  const now = new Date();
  currentDate.textContent = now.toISOString().split('T')[0];
  currentTime.textContent = now.toTimeString().split(' ')[0];
}

function startCountdown() {
  let timeLeft = 60 * 60;
  const timerInterval = setInterval(() => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    countdownTimer.textContent = `Session Ends In: ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    timeLeft--;
    if (timeLeft < 0) {
      clearInterval(timerInterval);
      countdownTimer.textContent = 'Session Ended';
      appendMessage('Roy', 'Your session has ended. Thank you for sharing.');
    }
  }, 1000);
}

async function getToken() {
  try {
    const res = await fetch('https://roy-chatbo-backend.onrender.com/api/assembly/token');
    if (!res.ok) throw new Error('Failed to fetch token');
    const data = await res.json();
    if (!data.token) throw new Error('No token in response');
    token = data.token;
    return token;
  } catch (err) {
    appendMessage('Roy', 'Unable to connect to speech service. Try typing instead.');
    return null;
  }
}

async function startRecording() {
  if (micActive) return stopRecording();
  const fetchedToken = await getToken();
  if (!fetchedToken) return;

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    appendMessage('Roy', 'Mic access denied.');
    return;
  }

  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    analyser.fftSize = 2048;
    visualizeWaveform('userWaveform');
    userWaveform.classList.add('recording');
  } catch {
    appendMessage('Roy', 'Audio setup failed.');
    return;
  }

  try {
    micActive = true;
    toggleMicButton();
    socket = new WebSocket('wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000');
    socket.onopen = () => {
      socket.send(JSON.stringify({ auth: { token: fetchedToken }, sample_rate: 16000 }));
    };
    socket.onerror = () => stopRecording();
    socket.onclose = () => stopRecording();
    socket.onmessage = (message) => {
      const data = JSON.parse(message.data);
      if (data.message_type === 'FinalTranscript' && data.text) {
        liveTranscript = data.text;
        userInput.value = liveTranscript;
        sendMessage(liveTranscript);
      } else if (data.message_type === 'PartialTranscript') {
        userInput.value = data.text || '';
      }
    };
  } catch {
    appendMessage('Roy', 'WebSocket failed.');
    stopRecording();
  }

  try {
    mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0 && socket.readyState === WebSocket.OPEN) {
        const reader = new FileReader();
        reader.onload = () => {
          const audioData = reader.result.split(',')[1];
          socket.send(JSON.stringify({ audio_data: audioData }));
        };
        reader.readAsDataURL(event.data);
      }
    };
    mediaRecorder.start(250);
  } catch {
    appendMessage('Roy', 'Recording failed.');
    stopRecording();
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
  if (audioContext) audioContext.close();
  if (socket && socket.readyState === WebSocket.OPEN) socket.close();
  if (mediaRecorder?.stream) mediaRecorder.stream.getTracks().forEach(track => track.stop());
  micActive = false;
  toggleMicButton();
  stopWaveform();
  userWaveform.classList.remove('recording');
}

async function sendMessage(message) {
  if (!message.trim()) return;
  appendMessage('You', message);
  userInput.value = '';
  liveTranscript = '';

  const mode = responseMode.value;
  const typingMsg = document.createElement('div');
  typingMsg.className = 'message roy typing';
  typingMsg.textContent = 'Roy';
  messages.appendChild(typingMsg);
  messages.scrollTop = messages.scrollHeight;
  isTyping = true;

  try {
    const res = await fetch('https://roy-chatbo-backend.onrender.com/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, mode })
    });
    if (!res.ok) throw new Error();
    const data = await res.json();
    messages.removeChild(typingMsg);
    isTyping = false;
    if (mode === 'text' || mode === 'both') appendMessage('Roy', data.response);
    if ((mode === 'voice' || mode === 'both') && data.audioUrl) {
      royAudio.src = data.audioUrl;
      royAudio.style.display = 'block';
      royAudio.play();
      visualizeWaveform('royWaveform', royAudio);
      royWaveform.classList.add('playing');
    }
  } catch {
    if (isTyping) messages.removeChild(typingMsg);
    isTyping = false;
    appendMessage('Roy', 'Sorry, I couldn’t process your request.');
  }
}

function appendMessage(sender, message) {
  const p = document.createElement('p');
  p.className = sender.toLowerCase();
  p.innerHTML = `<strong>${sender}:</strong> ${message}`;
  messages.appendChild(p);
  messages.scrollTop = messages.scrollHeight;
}

function toggleMicButton() {
  micToggle.textContent = micActive ? 'Stop' : 'Speak';
  micToggle.classList.toggle('recording', micActive);
}

let waveformInterval;
function visualizeWaveform(canvasId, audioElement = null) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || (!analyser && !audioElement)) return;
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  let dataArray, bufferLength;

  if (audioElement) {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioCtx.createMediaElementSource(audioElement);
    const analyserNode = audioCtx.createAnalyser();
    source.connect(analyserNode);
    analyserNode.connect(audioCtx.destination);
    analyserNode.fftSize = 2048;
    bufferLength = analyserNode.fftSize;
    dataArray = new Uint8Array(bufferLength);
    analyser = analyserNode;
  } else {
    bufferLength = analyser.fftSize;
    dataArray = new Uint8Array(bufferLength);
  }

  function draw() {
    analyser.getByteTimeDomainData(dataArray);
    ctx.clearRect(0, 0, width, height);
    ctx.lineWidth = 2;
    ctx.strokeStyle = canvasId === 'userWaveform' ? '#ff0' : '#0ff';
    ctx.beginPath();

    const sliceWidth = width / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * height) / 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      x += sliceWidth;
    }

    ctx.lineTo(width, height / 2);
    ctx.stroke();
  }

  waveformInterval = setInterval(draw, 50);
}

function stopWaveform() {
  if (waveformInterval) clearInterval(waveformInterval);
  ['userWaveform', 'royWaveform'].forEach(id => {
    const c = document.getElementById(id);
    if (c) c.getContext('2d').clearRect(0, 0, c.width, c.height);
    c?.classList.remove('recording', 'playing');
  });
}

function saveLog() {
  const log = Array.from(messages.children).map(child => child.textContent).join('\n');
  const blob = new Blob([log], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `roy-session-${new Date().toISOString().split('T')[0]}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

document.addEventListener('DOMContentLoaded', () => {
  updateDateTime();
  setInterval(updateDateTime, 1000);
  startCountdown();
  appendMessage('Roy', 'Hello. I’m listening. Speak or type your thoughts.');

  sendButton?.addEventListener('click', () => sendMessage(userInput.value));
  micToggle?.addEventListener('click', startRecording);
  userInput?.addEventListener('keypress', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(userInput.value);
    }
  });
  saveLogButton?.addEventListener('click', saveLog);
  homeButton?.addEventListener('click', () => window.location.href = 'https://synthcalm.com');
  royAudio?.addEventListener('ended', () => {
    royAudio.style.display = 'none';
    stopWaveform();
  });
});
