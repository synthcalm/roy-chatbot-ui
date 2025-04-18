const timeEl = document.getElementById('current-time');
const chatBox = document.getElementById('chat');
const thinkingDots = document.getElementById('thinking-dots');
const micBtn = document.getElementById('mic-toggle');
const homeBtn = document.getElementById('home-button');
const userCanvas = document.getElementById('userWaveform');
const royCanvas = document.getElementById('royWaveform');
const userCtx = userCanvas.getContext('2d');
const royCtx = royCanvas.getContext('2d');
const royAudio = new Audio();
royAudio.setAttribute('playsinline', 'true');
document.body.appendChild(royAudio);

let isRecording = false;
let recognition = null;
let audioContext = null;
let analyser = null;
let microphone = null;

// Update timestamp
function updateTime() {
  const now = new Date();
  timeEl.textContent = now.toISOString().replace('T', ' ').slice(0, 19);
}
setInterval(updateTime, 1000);

// Initialize speech recognition
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
  recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US';

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    appendMessage('You', transcript);
    fetchRoyResponse(transcript);
  };

  recognition.onerror = (event) => {
    appendMessage('Roy', 'Error processing speech: ' + event.error);
    stopRecording();
  };
}

// Waveform visualization
function startWaveform() {
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;

  navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
    microphone = audioContext.createMediaStreamSource(stream);
    microphone.connect(analyser);
    drawWaveform();
  }).catch((err) => {
    appendMessage('Roy', 'Microphone access denied: ' + err);
  });
}

function drawWaveform() {
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  const canvasWidth = userCanvas.width;
  const canvasHeight = userCanvas.height;

  function draw() {
    requestAnimationFrame(draw);
    analyser.getByteTimeDomainData(dataArray);

    userCtx.clearRect(0, 0, canvasWidth, canvasHeight);
    userCtx.beginPath();
    userCtx.strokeStyle = '#0FF';
    userCtx.lineWidth = 2;

    const sliceWidth = canvasWidth / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * canvasHeight) / 2;

      if (i === 0) userCtx.moveTo(x, y);
      else userCtx.lineTo(x, y);

      x += sliceWidth;
    }

    userCtx.stroke();
  }
  draw();
}

function stopWaveform() {
  if (microphone) microphone.disconnect();
  if (audioContext) audioContext.close();
  userCtx.clearRect(0, 0, userCanvas.width, userCanvas.height);
}

// Simulate Roy's waveform
function simulateRoyWaveform() {
  const canvasWidth = royCanvas.width;
  const canvasHeight = royCanvas.height;
  let phase = 0;

  function draw() {
    royCtx.clearRect(0, 0, canvasWidth, canvasHeight);
    royCtx.beginPath();
    royCtx.strokeStyle = '#0FF';
    royCtx.lineWidth = 2;

    for (let x = 0; x < canvasWidth; x++) {
      const y = canvasHeight / 2 + Math.sin(x * 0.05 + phase) * (canvasHeight / 4);
      if (x === 0) royCtx.moveTo(x, y);
      else royCtx.lineTo(x, y);
    }

    royCtx.stroke();
    phase += 0.1;
    if (thinkingDots.style.display !== 'none') requestAnimationFrame(draw);
  }
  draw();
}

// Chat handling
function appendMessage(speaker, message) {
  const msg = document.createElement('div');
  msg.textContent = `${speaker}: ${message}`;
  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight;
}

async function fetchRoyResponse(transcript) {
  thinkingDots.style.display = 'block';
  simulateRoyWaveform();
  console.log('Fetching Roy response for:', transcript);

  try {
    // Placeholder for actual API call
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate delay
    const response = `It's great that you're looking for suggestions. Let's explore some options together.`;
    console.log('Roy response received:', response);
    appendMessage('Roy', response);
  } catch (error) {
    console.error('Error fetching Roy response:', error);
    appendMessage('Roy', 'Error generating response.');
  } finally {
    thinkingDots.style.display = 'none';
  }
}

// Button controls
function startRecording() {
  isRecording = true;
  micBtn.textContent = 'Stop';
  micBtn.classList.add('active');
  recognition.start();
  startWaveform();
}

function stopRecording() {
  isRecording = false;
  micBtn.textContent = 'Speak';
  micBtn.classList.remove('active');
  recognition.stop();
  stopWaveform();
}

micBtn.addEventListener('click', () => {
  if (!recognition) {
    appendMessage('Roy', 'Speech recognition not supported.');
    return;
  }
  isRecording ? stopRecording() : startRecording();
});
micBtn.addEventListener('touchstart', (e) => {
  e.preventDefault();
  if (!recognition) return;
  isRecording ? stopRecording() : startRecording();
});

homeBtn.addEventListener('click', () => {
  window.location.href = 'https://synthcalm.com';
});
homeBtn.addEventListener('touchstart', (e) => {
  e.preventDefault();
  window.location.href = 'https://synthcalm.com';
});
