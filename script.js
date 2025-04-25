// === Roy Chatbot Script ===

// Global Variables
let royState = 'idle';
let recognition, audioContext, analyser, dataArray, source;
let isRecording = false;
let userStream, royAudioContext, royAnalyser, royDataArray, roySource;

// === INFO BAR ===
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

// === WAVEFORM ===
function initWaveform() {
  const waveform = document.getElementById('waveform');
  const container = waveform.parentElement;
  waveform.width = container.offsetWidth;
  waveform.height = container.offsetHeight;
  const ctx = waveform.getContext('2d');
  return { waveform, ctx };
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
      const y = (v * canvas.height) / 2;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      x += sliceWidth;
    }
    ctx.strokeStyle = 'yellow';
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
      const y = (v * canvas.height) / 2;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      x += sliceWidth;
    }
    ctx.strokeStyle = 'magenta';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  if (isRecording || royAnalyser) {
    requestAnimationFrame(() => drawMergedWaveform(ctx, canvas));
  }
}

// === MESSAGES ===
function scrollMessages() {
  const messages = document.getElementById('messages');
  messages.scrollTop = messages.scrollHeight;
}

function appendUserMessage(message) {
  const messages = document.getElementById('messages');
  messages.innerHTML += `<div class="user">You: ${message}</div>`;
  scrollMessages();
}

function appendRoyMessage(message) {
  const messages = document.getElementById('messages');
  messages.innerHTML += `<div class="roy">Roy: ${message}</div>`;
  scrollMessages();
}

// === SEND TO ROY ===
function sendToRoy(transcript) {
  appendUserMessage(transcript);
  fetch('https://roy-chatbo-backend.onrender.com/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: transcript })
  })
  .then(response => response.json())
  .then(data => {
    if (data.text) appendRoyMessage(data.text);
    if (data.audio) {
      const replyAudio = new Audio(data.audio);
      setupRoyWaveform(replyAudio);
      replyAudio.play();
      replyAudio.onended = () => {
        document.getElementById('speakBtn').classList.remove('active');
        document.getElementById('speakBtn').innerText = 'SPEAK';
      };
    }
  })
  .catch(error => {
    appendRoyMessage('Error: Could not get Roy’s response.');
    console.error('Roy API Error:', error);
  });
}

// === TRANSCRIPTION ===
function startTranscription(ctx, canvas) {
  if (!('webkitSpeechRecognition' in window)) {
    alert('Speech recognition not supported in this browser.');
    return;
  }
  recognition = new webkitSpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = false;
  recognition.lang = 'en-US';

  navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
    userStream = stream;
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    source = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    dataArray = new Uint8Array(analyser.frequencyBinCount);
    source.connect(analyser);
    isRecording = true;
    drawMergedWaveform(ctx, canvas);
    recognition.start();

    recognition.onresult = event => {
      const transcript = Array.from(event.results)
        .map(result => result[0].transcript)
        .join('');
      stopUserRecording();
      sendToRoy(transcript);
    };

    recognition.onerror = () => {
      appendRoyMessage('Transcription error.');
      stopUserRecording();
    };
  });
}

function stopUserRecording() {
  isRecording = false;
  if (recognition) recognition.stop();
  if (userStream) userStream.getTracks().forEach(track => track.stop());
  if (audioContext && audioContext.state !== 'closed') audioContext.close();
  document.getElementById('speakBtn').classList.remove('active');
  document.getElementById('speakBtn').innerText = 'SPEAK';
}

// === ROY WAVEFORM ===
function setupRoyWaveform(audio) {
  if (royAudioContext && royAudioContext.state !== 'closed') {
    try { royAudioContext.close(); } catch (e) {}
  }
  royAudioContext = new (window.AudioContext || window.webkitAudioContext)();
  royAnalyser = royAudioContext.createAnalyser();
  royAnalyser.fftSize = 2048;
  royDataArray = new Uint8Array(royAnalyser.frequencyBinCount);
  roySource = royAudioContext.createMediaElementSource(audio);
  roySource.connect(royAnalyser);
  royAnalyser.connect(royAudioContext.destination);
  drawMergedWaveform(document.getElementById('waveform').getContext('2d'), document.getElementById('waveform'));
}

// === BUTTON LOGIC ===
document.addEventListener('DOMContentLoaded', () => {
  updateDateTime();
  updateCountdownTimer();
  const { waveform, ctx } = initWaveform();

  const royBtn = document.getElementById('royBtn');
  const speakBtn = document.getElementById('speakBtn');

  appendRoyMessage("Hey, man... I'm Roy, your chill companion here to listen. Whenever you're ready, just hit the ROY button and let's talk, yeah?");

  function resetButtons() {
    royBtn.classList.remove('active');
    speakBtn.classList.remove('active');
    speakBtn.innerText = 'SPEAK';
  }

  royBtn.addEventListener('click', () => {
    if (royState === 'idle') {
      royState = 'engaged';
      royBtn.classList.add('active');
      speakBtn.classList.add('active');
      speakBtn.innerText = 'STOP';
      startTranscription(ctx, waveform);
    } else {
      royState = 'idle';
      stopUserRecording();
      resetButtons();
    }
  });

  speakBtn.addEventListener('click', () => {
    if (isRecording) {
      stopUserRecording();
      speakBtn.classList.remove('active');
      speakBtn.innerText = 'SPEAK';
    }
  });
});
