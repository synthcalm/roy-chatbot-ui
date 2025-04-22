const CONFIG = {
  API_URL: 'https://roy-chatbo-backend.onrender.com/api/transcribe',
  COLORS: {
    DEFAULT_BG: 'black',
    DEFAULT_FG: 'cyan',
    ROY_ACTIVE_BG: '#00FF00',
    RANDY_ACTIVE_BG: 'orange',
    ACTIVE_FG: 'black',
    WAVEFORM_USER: 'yellow',
    WAVEFORM_ROY: 'cyan',
    FEEDBACK_BLINK: 'red'
  },
  COUNTDOWN_SECONDS: 3600,
  WAVEFORM_SCALE: 50,
  ANALYSER_FFT_SIZE: 2048,
  ROY_RESPONSE_DURATION: 5000 // Simulated Roy audio duration in ms
};

const elements = {
  royBtn: document.getElementById('royBtn'),
  randyBtn: document.getElementById('randyBtn'),
  feedbackBtn: document.getElementById('speakBtn'),
  saveBtn: document.getElementById('saveBtn'),
  messagesDiv: document.getElementById('messages'),
  userCanvas: document.getElementById('userWaveform'),
  royCanvas: document.getElementById('royWaveform'),
  dateTimeSpan: document.getElementById('date-time'),
  countdownTimerSpan: document.getElementById('countdown-timer')
};

// Validate DOM elements
Object.entries(elements).forEach(([key, el]) => {
  if (!el) console.error(`Element ${key} not found in DOM`);
});

let state = {
  selectedPersona: null,
  isRecording: false,
  audioChunks: [],
  mediaRecorder: null,
  stream: null,
  userAudioContext: null,
  royAudioContext: null,
  animationFrameId: null,
  countdown: CONFIG.COUNTDOWN_SECONDS,
  lastTranscription: null // Store the last transcribed text
};

const { userCanvas, royCanvas, messagesDiv } = elements;
const userCtx = userCanvas?.getContext('2d');
const royCtx = royCanvas?.getContext('2d');

// Utility functions
const formatDateTime = () => {
  const now = new Date();
  const date = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}`;
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${date} ${time}`;
};

const formatCountdown = seconds => {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
};

const updateUI = () => {
  elements.dateTimeSpan.textContent = formatDateTime();
  elements.countdownTimerSpan.textContent = formatCountdown(state.countdown);
  if (state.countdown > 0) state.countdown--;
};

const resetButtonStyles = () => {
  const { DEFAULT_BG, DEFAULT_FG } = CONFIG.COLORS;
  elements.royBtn.style.cssText = `background-color: ${DEFAULT_BG}; color: ${DEFAULT_FG}`;
  elements.randyBtn.style.cssText = `background-color: ${DEFAULT_BG}; color: ${DEFAULT_FG}`;
  elements.feedbackBtn.style.cssText = `background-color: ${DEFAULT_BG}; color: ${DEFAULT_FG}; border: none`;
  elements.feedbackBtn.classList.remove('blinking');
  elements.feedbackBtn.textContent = 'FEEDBACK';
  elements.royBtn.textContent = 'ROY';
  elements.randyBtn.textContent = 'RANDY';
  state.isRecording = false;
};

const addMessage = (sender, text) => {
  const msg = document.createElement('p');
  msg.className = sender;
  msg.textContent = `${sender === 'user' ? 'You' : sender.charAt(0).toUpperCase() + sender.slice(1)}: ${text}`;
  messagesDiv.appendChild(msg);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
};

const drawWaveform = (ctx, canvas, data, color) => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.beginPath();
  const sliceWidth = canvas.width / data.length;
  const centerY = canvas.height / 2;
  for (let i = 0; i < data.length; i++) {
    const normalized = (data[i] / 128.0) - 1;
    const y = centerY + (normalized * CONFIG.WAVEFORM_SCALE);
    const x = i * sliceWidth;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
};

const cleanupAudio = () => {
  if (state.stream) {
    state.stream.getTracks().forEach(track => track.stop());
    state.stream = null;
  }
  if (state.userAudioContext) {
    state.userAudioContext.close().catch(err => console.warn('Audio context close error:', err));
    state.userAudioContext = null;
  }
  if (state.royAudioContext) {
    state.royAudioContext.close().catch(err => console.warn('Roy audio context close error:', err));
    state.royAudioContext = null;
  }
  if (state.animationFrameId) {
    cancelAnimationFrame(state.animationFrameId);
    state.animationFrameId = null;
  }
  userCtx?.clearRect(0, 0, userCanvas.width, userCanvas.height);
  royCtx?.clearRect(0, 0, royCanvas.width, royCanvas.height);
};

// Simulate Roy's audio waveform (since we don't have actual audio)
const simulateRoyAudio = () => {
  state.royAudioContext = new (window.AudioContext || window.webkitAudioContext)();
  const analyser = state.royAudioContext.createAnalyser();
  analyser.fftSize = CONFIG.ANALYSER_FFT_SIZE;
  const dataArray = new Uint8Array(analyser.frequencyBinCount);

  // Simulate audio data with a simple sine wave
  let time = 0;
  const simulateWaveform = () => {
    for (let i = 0; i < dataArray.length; i++) {
      const value = Math.sin(time + i * 0.05) * 50 + 128; // Simulate audio wave
      dataArray[i] = value;
    }
    time += 0.1;
    drawWaveform(royCtx, royCanvas, dataArray, CONFIG.COLORS.WAVEFORM_ROY);
    state.animationFrameId = requestAnimationFrame(simulateWaveform);
  };

  simulateWaveform();

  // Stop after a set duration
  setTimeout(() => {
    cancelAnimationFrame(state.animationFrameId);
    royCtx?.clearRect(0, 0, royCanvas.width, royCanvas.height);
    state.royAudioContext.close().catch(err => console.warn('Roy audio context close error:', err));
    state.royAudioContext = null;
  }, CONFIG.ROY_RESPONSE_DURATION);
};

// Audio visualization setup for user
const setupVisualization = async stream => {
  cleanupAudio();
  state.userAudioContext = new (window.AudioContext || window.webkitAudioContext)();
  const source = state.userAudioContext.createMediaStreamSource(stream);
  const analyser = state.userAudioContext.createAnalyser();
  analyser.fftSize = CONFIG.ANALYSER_FFT_SIZE;
  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  source.connect(analyser);

  const animate = () => {
    if (!state.isRecording) {
      userCtx?.clearRect(0, 0, userCanvas.width, userCanvas.height);
      return;
    }
    analyser.getByteTimeDomainData(dataArray);
    drawWaveform(userCtx, userCanvas, dataArray, CONFIG.COLORS.WAVEFORM_USER);
    state.animationFrameId = requestAnimationFrame(animate);
  };
  animate();
};

// Persona button handler
const handlePersonaClick = async (persona, button, activeBg) => {
  if (state.isRecording && state.selectedPersona === persona) {
    state.mediaRecorder?.stop();
    resetButtonStyles();
    elements.feedbackBtn.classList.add('blinking');
    elements.feedbackBtn.style.cssText = `background-color: ${CONFIG.COLORS.FEEDBACK_BLINK}; color: ${CONFIG.COLORS.ACTIVE_FG}; border: none`;
    return;
  }

  if (state.isRecording) return; // Prevent multiple recordings
  resetButtonStyles();
  state.selectedPersona = persona;
  button.style.cssText = `background-color: ${activeBg}; color: ${CONFIG.COLORS.ACTIVE_FG}`;
  button.textContent = 'STOP';

  try {
    state.isRecording = true;
    state.audioChunks = [];
    state.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    await setupVisualization(state.stream);
    state.mediaRecorder = new MediaRecorder(state.stream);
    state.mediaRecorder.ondataavailable = e => e.data.size > 0 && state.audioChunks.push(e.data);
    state.mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(state.audioChunks, { type: 'audio/webm' });
      const formData = new FormData();
      formData.append('audio', audioBlob);
      formData.append('bot', state.selectedPersona);

      try {
        const response = await fetch(CONFIG.API_URL, { method: 'POST', body: formData });
        const { text = 'undefined' } = await response.json();
        state.lastTranscription = text; // Store for feedback use
        addMessage('user', text);
        elements.feedbackBtn.classList.add('blinking');
        elements.feedbackBtn.style.cssText = `background-color: ${CONFIG.COLORS.FEEDBACK_BLINK}; color: ${CONFIG.COLORS.ACTIVE_FG}; border: none`;
      } catch (error) {
        console.error('Transcription failed:', error);
        addMessage('system', 'Error: Transcription failed');
      } finally {
        cleanupAudio();
        resetButtonStyles();
        button.style.cssText = `background-color: ${activeBg}; color: ${CONFIG.COLORS.ACTIVE_FG}`;
        button.textContent = persona.toUpperCase();
      }
    };
    state.mediaRecorder.start();
  } catch (error) {
    console.error('Microphone error:', error);
    alert('Could not access microphone. Please allow access.');
    resetButtonStyles();
    state.isRecording = false;
  }
};

// Event listeners
elements.royBtn.addEventListener('click', () => handlePersonaClick('roy', elements.royBtn, CONFIG.COLORS.ROY_ACTIVE_BG));
elements.randyBtn.addEventListener('click', () => handlePersonaClick('randy', elements.randyBtn, CONFIG.COLORS.RANDY_ACTIVE_BG));

elements.feedbackBtn.addEventListener('click', async () => {
  if (!state.selectedPersona) {
    alert('Please select a persona (Roy or Randy) first.');
    return;
  }
  elements.feedbackBtn.classList.remove('blinking');
  elements.feedbackBtn.style.cssText = `background-color: ${CONFIG.COLORS.DEFAULT_FG}; color: ${CONFIG.COLORS.ACTIVE_FG}; border: none`;
  
  // Simulate Roy's response (audio waveform and text)
  if (state.selectedPersona === 'roy') {
    simulateRoyAudio();
    // Mock Roy's response based on the last transcription
    const royResponse = state.lastTranscription === 'undefined'
      ? "Sorry, I didn't catch that. Could you repeat?"
      : `I heard you say: "${state.lastTranscription}". How can I assist you further?`;
    addMessage('roy', royResponse);
  } else {
    // Placeholder for Randy's response
    addMessage('randy', 'Randy response placeholder');
  }
  resetButtonStyles();
});

elements.saveBtn.addEventListener('click', () => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${state.selectedPersona || 'conversation'}-${timestamp}.txt`;
  const blob = new Blob([messagesDiv.innerText], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  resetButtonStyles();
});

// Initialize UI updates
setInterval(updateUI, 1000);
updateUI();
