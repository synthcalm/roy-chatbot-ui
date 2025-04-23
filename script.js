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
  audio.playsInline = true; // For iOS
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
    alert('Speech recognition is not supported. Please use a compatible browser like Chrome or Safari.');
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = true; // Enable continuous recognition
  recognition.interimResults = true; // Show partial results
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
    messages.innerHTML = `<div class="user">You: ${userTranscript || '...'}</div>`;
    scrollMessages();
    console.log('Transcribed:', userTranscript);
  };

  recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
    if (['no-speech', 'network'].includes(event.error)) {
      recognition.start(); // Retry on transient errors
    } else {
      alert('Speech recognition failed: ' + event.error);
    }
  };

  recognition.onend = () => {
    console.log('Speech recognition ended');
    if (royState === 'engaged') {
      recognition.start(); // Restart if still recording
    }
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
    messages.innerHTML = `<div class="user">You: ${userTranscript || 'Are you there?'}</div>`;
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
    // TODO: Implement Randy recording logic
  } else if (randyState === 'engaged') {
    randyState = 'idle';
    randyBtn.textContent = 'RANDY';
    randyBtn.classList.remove('engaged');
    // TODO: Implement Randy stop logic
  }
});

// Handle Feedback button click
document.getElementById('feedbackBtn').addEventListener('click', async () => {
  if (feedbackState === 'engaged') {
    feedbackState = 'idle';
    const feedbackBtn = document.getElementById('feedbackBtn');
    feedbackBtn.classList.remove('engaged');
    const messages = document.getElementById('messages');

    try {
      // Send30] Send transcription to backend for Roy's response
      const response = await fetch('https://roy-chatbo-backend.onrender.com/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: userTranscript || 'Are you there?' })
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const data = await response.json();
      messages.innerHTML += `<div class="roy">Roy: ${data.text}</div>`;
      scrollMessages();

      // Play audio if provided
      if (data.audio) {
        const audio = new Audio(data.audio); // Base64 audio
        audio.playsInline = true;
        animateRoyWaveform(audio);
      } else {
        console.warn('No audio data received');
      }
    } catch (err) {
      console.error('Backend request error:', err);
      messages.innerHTML += '<div class="roy">Roy: Sorry, I’m having trouble responding right now.</div>';
      scrollMessages();
    }
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
    alert('Failed to access microphone. Please check permissions.');
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

// Initialize on page load
window.onload = function() {
  updateDateTime();
  updateCountdownTimer();
  initWaveforms();
  initSpeechRecognition();

  // Check microphone permission for iOS
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then((stream) => {
      console.log('Microphone access granted');
      stream.getTracks().forEach(track => track.stop());
    })
    .catch((err) => {
      console.error('Microphone access denied:', err);
      alert('Please allow microphone access in browser settings.');
    });
};
