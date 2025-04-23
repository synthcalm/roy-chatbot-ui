let royState = 'idle'; // idle, pre-engage, engaged
let randyState = 'idle'; // idle, pre-engage, engaged
let feedbackState = 'idle'; // idle, engaged
let mediaRecorder;
let audioChunks = [];
let userWaveformCtx, royWaveformCtx;
let analyser, dataArray, source;
let userAudioContext, royAudioContext;
let recognition; // For speech recognition
let userTranscript = ''; // Store user speech

// Update date and time
function updateDateTime() {
  const dateTimeDiv = document.getElementById('date-time');
  if (!dateTimeDiv) {
    console.error('date-time element not found');
    return;
  }
  const now = new Date();
  dateTimeDiv.textContent = now.toLocaleString();
}

// Update countdown timer
function updateCountdownTimer() {
  const countdownDiv = document.getElementById('countdown-timer');
  if (!countdownDiv) {
    console.error('countdown-timer element not found');
    return;
  }
  let timeLeft = 60 * 60; // 60 minutes in seconds
  setInterval(() => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    countdownDiv.textContent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    timeLeft--;
    if (timeLeft < 0) timeLeft = 60 * 60;
  }, 1000);
}

// Initialize waveforms
function initWaveforms() {
  const userWaveform = document.getElementById('user-waveform');
  const royWaveform = document.getElementById('roy-waveform');
  if (!userWaveform || !royWaveform) {
    console.error('Waveform canvases not found');
    return;
  }
  userWaveformCtx = userWaveform.getContext('2d');
  royWaveformCtx = royWaveform.getContext('2d');

  userWaveform.width = userWaveform.offsetWidth;
  userWaveform.height = userWaveform.offsetHeight;
  royWaveform.width = royWaveform.offsetWidth;
  royWaveform.height = royWaveform.offsetHeight;

  userWaveformCtx.strokeStyle = 'yellow';
  royWaveformCtx.strokeStyle = 'magenta';
  userWaveformCtx.lineWidth = 2;
  royWaveformCtx.lineWidth = 2;
}

// Draw waveform based on audio data
function drawWaveform(ctx, canvas, data) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.beginPath();
  const width = canvas.width;
  const height = canvas.height;
  const midY = height / 2;
  const sliceWidth = width / data.length;

  let x = 0;
  for (let i = 0; i < data.length; i++) {
    const v = data[i] / 128.0;
    const y = midY + (v * midY);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
    x += sliceWidth;
  }
  ctx.stroke();
}

// Animate waveform for user input
function animateUserWaveform() {
  if (royState !== 'engaged') return;
  analyser.getByteTimeDomainData(dataArray);
  drawWaveform(userWaveformCtx, document.getElementById('user-waveform'), dataArray);
  requestAnimationFrame(animateUserWaveform);
}

// Animate Roy's waveform synchronized with audio
function animateRoyWaveform(audio) {
  royAudioContext = new AudioContext();
  const royAnalyser = royAudioContext.createAnalyser();
  royAnalyser.fftSize = 2048;
  const royDataArray = new Uint8Array(royAnalyser.fftSize);
  const roySource = royAudioContext.createMediaElementSource(audio);
  roySource.connect(royAnalyser);
  royAnalyser.connect(royAudioContext.destination);

  function draw() {
    if (audio.paused) {
      royAudioContext.close();
      return;
    }
    royAnalyser.getByteTimeDomainData(royDataArray);
    drawWaveform(royWaveformCtx, document.getElementById('roy-waveform'), royDataArray);
    requestAnimationFrame(draw);
  }

  audio.onplay = () => {
    draw();
  };
  audio.onerror = () => {
    console.error('Error playing Roy audio');
  };
  audio.playsInline = true; // For iOS
  audio.play().catch(err => console.error('Audio play failed:', err));
}

// Scroll messages upward as new messages are added
function scrollMessages() {
  const messages = document.getElementById('messages');
  if (!messages) {
    console.error('messages element not found');
    return;
  }
  messages.scrollTop = messages.scrollHeight;
}

// Initialize speech recognition
function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.error('Speech Recognition API not supported in this browser.');
    alert('Speech recognition is not supported. Please use Chrome or Safari.');
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onresult = (event) => {
    let interimTranscript = '';
    let finalTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += transcript + ' ';
      } else {
        interimTranscript = transcript;
      }
    }

    userTranscript = finalTranscript + interimTranscript;
    const messages = document.getElementById('messages');
    if (messages) {
      messages.innerHTML = `<div class="user">You: ${userTranscript || '...'}</div>`;
      scrollMessages();
    } else {
      console.error('messages element not found');
    }
    console.log('Transcribed:', userTranscript);
  };

  recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
    if (['no-speech', 'network'].includes(event.error)) {
      setTimeout(() => {
        if (royState === 'engaged') recognition.start();
      }, 1000); // Delay to avoid rapid restarts
    } else {
      alert('Speech recognition failed: ' + event.error);
    }
  };

  recognition.onend = () => {
    console.log('Speech recognition ended');
    if (royState === 'engaged') {
      setTimeout(() => recognition.start(), 1000); // Delay for stability
