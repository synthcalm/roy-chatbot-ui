// script.js (full working version with integrated design and behavior)

const royBtn = document.getElementById('royBtn');
const randyBtn = document.getElementById('randyBtn');
const speakBtn = document.getElementById('speakBtn');
const saveBtn = document.getElementById('saveBtn');
const homeBtn = document.getElementById('homeBtn');
const messagesDiv = document.getElementById('messages');
const userCanvas = document.getElementById('userWaveform');
const royCanvas = document.getElementById('royWaveform');
const userCtx = userCanvas.getContext('2d');
const royCtx = royCanvas.getContext('2d');

let selectedPersona = null;
let mediaRecorder, audioChunks = [], isRecording = false;
let userAudioContext = null;
let royAudioContext = null;
let royAudioSource = null;
let stream = null;

function resetButtonColors() {
  royBtn.style.backgroundColor = 'black';
  royBtn.style.color = 'cyan';
  randyBtn.style.backgroundColor = 'black';
  randyBtn.style.color = 'cyan';
  speakBtn.style.backgroundColor = 'black';
  speakBtn.style.color = 'cyan';
  speakBtn.style.border = '1px solid cyan';
  speakBtn.textContent = 'SPEAK';
  speakBtn.classList.remove('blinking');
  isRecording = false;
  userCtx.clearRect(0, 0, userCanvas.width, userCanvas.height);
  royCtx.clearRect(0, 0, royCanvas.width, royCanvas.height);
}

function addMessage(text, sender) {
  const msg = document.createElement('p');
  msg.className = sender;
  msg.textContent = text;
  messagesDiv.appendChild(msg);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function drawWaveform(canvasCtx, canvas, data, color) {
  canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
  canvasCtx.beginPath();
  const sliceWidth = canvas.width / data.length;
  const centerY = canvas.height / 2;
  const scale = 50;
  for (let i = 0; i < data.length; i++) {
    const normalized = (data[i] / 128.0) - 1;
    const y = centerY + (normalized * scale);
    const x = i * sliceWidth;
    if (i === 0) canvasCtx.moveTo(x, y);
    else canvasCtx.lineTo(x, y);
  }
  canvasCtx.strokeStyle = color;
  canvasCtx.lineWidth = 2;
  canvasCtx.stroke();
}

function setupUserVisualization(stream) {
  if (userAudioContext && userAudioContext.state !== 'closed') userAudioContext.close();
  userAudioContext = new (window.AudioContext || window.webkitAudioContext)();
  const source = userAudioContext.createMediaStreamSource(stream);
  const analyser = userAudioContext.createAnalyser();
  analyser.fftSize = 2048;
  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  source.connect(analyser);
  function animate() {
    if (!isRecording) {
      userCtx.clearRect(0, 0, userCanvas.width, userCanvas.height);
      return;
    }
    analyser.getByteTimeDomainData(dataArray);
    drawWaveform(userCtx, userCanvas, dataArray, 'yellow');
    requestAnimationFrame(animate);
  }
  animate();
}

function playRoyAudio(base64Audio) {
  const audioEl = new Audio(`data:audio/mp3;base64,${base64Audio}`);
  audioEl.setAttribute('playsinline', '');
  if (royAudioContext && royAudioContext.state !== 'closed') {
    try { if (royAudioSource) royAudioSource.disconnect(); royAudioContext.close(); } catch (e) { console.log('Audio context error:', e); }
  }
  royAudioContext = new (window.AudioContext || window.webkitAudioContext)();
  audioEl.addEventListener('loadedmetadata', () => {
    try {
      royAudioSource = royAudioContext.createMediaElementSource(audioEl);
      const analyser = royAudioContext.createAnalyser();
      analyser.fftSize = 2048;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      royAudioSource.connect(analyser);
      analyser.connect(royAudioContext.destination);
      function animate() {
        analyser.getByteTimeDomainData(dataArray);
        drawWaveform(royCtx, royCanvas, dataArray, 'magenta');
        requestAnimationFrame(animate);
      }
      animate();
      royAudioContext.resume().then(() => audioEl.play().catch(err => console.warn('Audio play failed:', err)));
      audioEl.addEventListener('ended', () => {
        royCtx.clearRect(0, 0, royCanvas.width, royCanvas.height);
        speakBtn.textContent = 'SPEAK';
        speakBtn.classList.remove('blinking');
        speakBtn.style.backgroundColor = 'red';
        speakBtn.style.color = 'white';
        speakBtn.style.border = '1px solid red';
      });
    } catch (error) { console.error('Audio playback failed:', error); }
  });
  audioEl.load();
}

// Persona selection logic
royBtn.addEventListener('click', () => {
  resetButtonColors();
  selectedPersona = 'roy';
  royBtn.style.backgroundColor = 'green';
  royBtn.style.color = 'white';
  speakBtn.style.backgroundColor = 'red';
  speakBtn.style.color = 'white';
  speakBtn.style.border = '1px solid red';
  addMessage('Roy: Greetings, my friend. What weighs on your soul today?', 'roy');
});

randyBtn.addEventListener('click', () => {
  resetButtonColors();
  selectedPersona = 'randy';
  randyBtn.style.backgroundColor = '#FFC107';
  randyBtn.style.color = 'white';
  speakBtn.style.backgroundColor = 'red';
  speakBtn.style.color = 'white';
  speakBtn.style.border = '1px solid red';
  addMessage('Randy: Unleash the chaos—what's burning you up?', 'randy');
});

// Speak button logic
speakBtn.addEventListener('click', async () => {
  if (!selectedPersona) { alert('Please choose Roy or Randy first.'); return; }
  if (isRecording) {
    if (mediaRecorder && (mediaRecorder.state === 'recording' || mediaRecorder.state === 'paused')) mediaRecorder.stop();
    return;
  }
  try {
    isRecording = true;
    speakBtn.textContent = 'STOP';
    speakBtn.classList.add('blinking');
    audioChunks = [];
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    setupUserVisualization(stream);
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
    mediaRecorder.onstop = async () => {
      speakBtn.textContent = 'SPEAK';
      speakBtn.classList.remove('blinking');
      speakBtn.style.backgroundColor = 'red';
      speakBtn.style.color = 'white';
      speakBtn.style.border = '1px solid red';
      isRecording = false;
      userCtx.clearRect(0, 0, userCanvas.width, userCanvas.height);
      if (audioChunks.length === 0) return;
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      const formData = new FormData();
      formData.append('audio', audioBlob);
      const transcribingMessage = addMessage('You: Transcribing...', 'user');
      const thinkingMessage = addMessage(`${selectedPersona === 'randy' ? 'Randy' : 'Roy'} Thinking...`, selectedPersona);
      try {
        const transcribeRes = await fetch('https://roy-chatbo-backend.onrender.com/api/transcribe', { method: 'POST', body: formData });
        const transcribeJson = await transcribeRes.json();
        const userText = transcribeJson.text || 'undefined';
        transcribingMessage.textContent = `You: ${userText}`;
        const chatRes = await fetch('https://roy-chatbo-backend.onrender.com/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: userText, persona: selectedPersona }) });
        const chatJson = await chatRes.json();
        thinkingMessage.remove();
        addMessage(`${selectedPersona === 'randy' ? 'Randy' : 'Roy'}: ${chatJson.text}`, selectedPersona);
        if (chatJson.audio) playRoyAudio(chatJson.audio);
      } catch (error) {
        console.error('Transcription or chat failed:', error);
        transcribingMessage.textContent = 'You: Transcription failed';
        thinkingMessage.remove();
        addMessage(`${selectedPersona === 'randy' ? 'Randy' : 'Roy'}: undefined`, selectedPersona);
      }
    };
    mediaRecorder.start();
  } catch (error) {
    console.error('Microphone error:', error);
    alert('Could not access your microphone. Please allow access.');
    speakBtn.textContent = 'SPEAK';
    speakBtn.classList.remove('blinking');
    speakBtn.style.backgroundColor = 'red';
    speakBtn.style.color = 'white';
    speakBtn.style.border = '1px solid red';
    isRecording = false;
  }
});

// Save log and home button logic
saveBtn.addEventListener('click', () => {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-');
  const filename = `${selectedPersona || 'conversation'}-${timestamp}.txt`;
  const blob = new Blob([messagesDiv.innerText], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
});

homeBtn.addEventListener('click', () => {
  window.location.href = 'https://synthcalm.com';
});
