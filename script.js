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
  audio.play().catch(err => console.error('Audio play failed:', err));
}

// Scroll messages upward as new messages are added
function scrollMessages() {
  const messages = document.getElementById('messages');
  messages.scrollTop = messages.scrollHeight;
}

// Initialize speech recognition
function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.error('Speech Recognition API not supported in this browser.');
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US';

  recognition.onresult = (event) => {
    userTranscript = event.results[0][0].transcript.trim();
    console.log('Transcribed:', userTranscript);
  };

  recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
  };

  recognition.onend = () => {
    console.log('Speech recognition ended');
  };
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
    messages.innerHTML += `<div class="user">You: ${userTranscript || 'Are you there?'}</div>`;
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
    messages.innerHTML += '<div class="roy">Roy: Hey, so… like… I hear you, yeah? I’m right here for you, man.</div>';
    scrollMessages();

    // Generate Roy's audio response
    const audio = new Audio(generateSpeechLikeAudio());
    animateRoyWaveform(audio);
  }
});

// Start recording
async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.start();
    mediaRecorder.ondataavailable = (event) => {
      audioChunks.push(event.data);
    };

    userAudioContext = new AudioContext();
    analyser = userAudioContext.createAnalyser();
    analyser.fftSize = 2048;
    dataArray = new Uint8Array(analyser.fftSize);
    source = userAudioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    animateUserWaveform();

    // Start speech recognition
    recognition.start();
  } catch (err) {
    console.error('Error starting recording:', err);
  }
}

// Stop recording
function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  audioChunks = [];
  if (source && analyser) {
    source.disconnect();
    analyser.disconnect();
  }
  if (userAudioContext) {
    userAudioContext.close();
  }
  if (recognition) {
    recognition.stop();
  }
}

// Generate a speech-like audio for Roy's response
function generateSpeechLikeAudio() {
  const sampleRate = 44100;
  const duration = 3; // 3 seconds
  const numSamples = sampleRate * duration;
  const numChannels = 1;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;

  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');

  // fmt subchunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk size
  view.setUint16(20, 1, true); // Audio format (PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // Bits per sample

  // data subchunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Generate a speech-like waveform by combining multiple frequencies
  let t = 0;
  for (let i = 0; i < numSamples; i++) {
    // Simulate formants (speech-like frequencies: 500Hz, 1500Hz, 2500Hz)
    const formant1 = Math.sin(2 * Math.PI * 500 * t) * 0.4;  // Low frequency (vowel-like)
    const formant2 = Math.sin(2 * Math.PI * 1500 * t) * 0.3; // Mid frequency
    const formant3 = Math.sin(2 * Math.PI * 2500 * t) * 0.1; // High frequency (consonant-like)

    // Modulate amplitude to simulate speech envelope
    const envelope = Math.sin(Math.PI * (i / numSamples)) * 0.8; // Fade in and out
    const sample = (formant1 + formant2 + formant3) * envelope;

    const sampleValue = Math.round(sample * 32767);
    view.setInt16(44 + i * 2, sampleValue, true);
    t += 1 / sampleRate;
  }

  const blob = new Blob([buffer], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
}

// Helper to write string to DataView
function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

// Initialize on page load
window.onload = function() {
  updateDateTime();
  updateCountdownTimer();
  initWaveforms();
  initSpeechRecognition();
};
