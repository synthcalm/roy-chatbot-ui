let royState = 'idle'; // idle, pre-engage, engaged
let randyState = 'idle'; // idle, pre-engage, engaged
let feedbackState = 'idle'; // idle, engaged
let mediaRecorder;
let audioChunks = [];
let userWaveformCtx, royWaveformCtx;

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
  royWaveformCtx.strokeStyle = 'yellow';
  userWaveformCtx.lineWidth = 2;
  royWaveformCtx.lineWidth = 2;
}

// Draw waveform (placeholder for audio visualization)
function drawWaveform(ctx, canvas) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.beginPath();
  const width = canvas.width;
  const height = canvas.height;
  const midY = height / 2;
  let x = 0;
  for (let i = 0; i < width; i++) {
    const y = midY + Math.sin(x) * (height / 4);
    if (i === 0) ctx.moveTo(i, y);
    else ctx.lineTo(i, y);
    x += 0.1;
  }
  ctx.stroke();
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
    drawWaveform(userWaveformCtx, document.getElementById('user-waveform'));
  } else if (royState === 'engaged') {
    royState = 'idle';
    royBtn.textContent = 'ROY';
    royBtn.classList.remove('engaged');
    stopRecording();
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
    messages.innerHTML += '<div class="user">You: Testing, one, two, check</div>';
    setTimeout(() => {
      messages.innerHTML += '<div class="roy">Roy: Hey, so… like… I hear you testing things out, yeah? Sounds good, man.</div>';
      drawWaveform(royWaveformCtx, document.getElementById('roy-waveform'));
    }, 1000);
  }
});

// Start recording (placeholder)
async function startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(stream);
  mediaRecorder.start();
  mediaRecorder.ondataavailable = (event) => {
    audioChunks.push(event.data);
  };
}

// Stop recording (placeholder)
function stopRecording() {
  mediaRecorder.stop();
  audioChunks = [];
}

// Initialize on page load
window.onload = function() {
  updateDateTime();
  updateCountdownTimer();
  initWaveforms();
};
