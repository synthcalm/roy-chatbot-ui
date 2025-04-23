let royState = 'idle'; // idle, pre-engage, engaged
let randyState = 'idle'; // idle, pre-engage, engaged
let feedbackState = 'idle'; // idle, engaged
let mediaRecorder;
let audioChunks = [];
let userWaveformCtx, royWaveformCtx;
let analyser, dataArray, source;
let audioContext;

// Update date and time
function updateDateTime() {
  const dateTimeDiv = document.getElementById('date-time');
  const now = new Date();
  dateTimeDiv.textContent = now.toLocaleString();
}

// Update countdown timer
function updateCountdownTimer() {
  const countdownDiv = document.getElementById('countdown-timer');
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
  const royAnalyser = audioContext.createAnalyser();
  royAnalyser.fftSize = 2048;
  const royDataArray = new Uint8Array(royAnalyser.fftSize);
  const roySource = audioContext.createMediaElementSource(audio);
  roySource.connect(royAnalyser);
  royAnalyser.connect(audioContext.destination);

  function draw() {
    if (audio.paused) return;
    royAnalyser.getByteTimeDomainData(royDataArray);
    drawWaveform(royWaveformCtx, document.getElementById('roy-waveform'), royDataArray);
    requestAnimationFrame(draw);
  }

  audio.onplay = () => {
    draw();
  };
  audio.play();
}

// Scroll messages upward as new messages are added
function scrollMessages() {
  const messages = document.getElementById('messages');
  messages.scrollTop = messages.scrollHeight;
}

// Handle Roy button click
document.getElementById('royBtn').addEventListener('click', () => {
  const royBtn = document.getElementById('royBtn');
  if (royState === 'idle') {
    royState = 'pre-engage';
    royBtn.textContent = 'START';
    royBtn.classList.add('pre-engage');
  } else if (royState === 'pre-engage') {
    royState = 'engaged';
    royBtn.textContent = 'STOP';
    royBtn.classList.remove('pre-engage');
    royBtn.classList.add('engaged');
    startRecording();
  } else if (royState === 'engaged') {
    royState = 'idle';
    royBtn.textContent = 'ROY';
    royBtn.classList.remove('engaged');
    stopRecording();
    const messages = document.getElementById('messages');
    messages.innerHTML += '<div class="user">You: Testing, one, two, check</div>';
    scrollMessages();
    document.getElementById('feedbackBtn').classList.add('engaged');
    feedbackState = 'engaged';
  }
});

// Handle Randy button click
document.getElementById('randyBtn').addEventListener('click', () => {
  const randyBtn = document.getElementById('randyBtn');
  if (randyState === 'idle') {
    randyState = 'pre-engage';
    randyBtn.textContent = 'START';
    randyBtn.classList.add('pre-engage');
  } else if (randyState === 'pre-engage') {
    randyState = 'engaged';
    randyBtn.textContent = 'STOP';
    randyBtn.classList.remove('pre-engage');
    randyBtn.classList.add('engaged');
  } else if (randyState === 'engaged') {
    randyState = 'idle';
    randyBtn.textContent = 'RANDY';
    randyBtn.classList.remove('engaged');
  }
});

// Handle Feedback button click
document.getElementById('feedbackBtn').addEventListener('click', () => {
  if (feedbackState === 'engaged') {
    feedbackState = 'idle';
    const feedbackBtn = document.getElementById('feedbackBtn');
    feedbackBtn.classList.remove('engaged');
    const messages = document.getElementById('messages');
    messages.innerHTML += '<div class="roy">Roy: Hey, so… like… I hear you testing things out, yeah? Sounds good, man.</div>';
    scrollMessages();

    // Simulate Roy's audio response
    const audio = new Audio();
    audio.src = 'data:audio/wav;base64,' + btoa(generateWaveform()); // Placeholder for audio data
    animateRoyWaveform(audio);
  }
});

// Start recording
async function startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(stream);
  mediaRecorder.start();
  mediaRecorder.ondataavailable = (event) => {
    audioChunks.push(event.data);
  };

  audioContext = new AudioContext();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;
  dataArray = new Uint8Array(analyser.fftSize);
  source = audioContext.createMediaStreamSource(stream);
  source.connect(analyser);
  animateUserWaveform();
}

// Stop recording
function stopRecording() {
  mediaRecorder.stop();
  audioChunks = [];
  source.disconnect();
  analyser.disconnect();
  audioContext.close();
}

// Placeholder for generating a simple waveform audio (simulated)
function generateWaveform() {
  // This is a simplified placeholder for generating a WAV audio file
  // In a real scenario, this would be a server-side generated audio or a pre-recorded file
  return 'RIFF' + String.fromCharCode(0x24, 0x00, 0x00, 0x00) + 'WAVEfmt ' + 
         String.fromCharCode(0x10, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 
         0x44, 0xAC, 0x00, 0x00, 0x88, 0x58, 0x01, 0x00, 0x02, 0x00, 0x10, 0x00) + 
         'data' + String.fromCharCode(0x00, 0x00, 0x00, 0x00);
}

// Initialize on page load
window.onload = function() {
  updateDateTime();
  updateCountdownTimer();
  initWaveforms();
};
