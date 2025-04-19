let mediaRecorder, audioChunks = [], audioContext, sourceNode;
let state = 'idle';
let stream;
const logHistory = [];
let recognition;

const elements = {
  recordButton: document.getElementById('recordButton'),
  saveButton: document.getElementById('saveButton'),
  chat: document.getElementById('chat'),
  userScope: document.getElementById('userScope'),
  royScope: document.getElementById('royScope'),
  clock: document.getElementById('clock'),
  date: document.getElementById('date'),
  countdown: document.getElementById('countdown')
};

const config = {
  duration: 3600,
  maxRecordingTime: 60000
};

let countdownInterval;

function updateDateTime() {
  const now = new Date();
  if (elements.clock) elements.clock.textContent = now.toTimeString().split(' ')[0];
  if (elements.date) elements.date.textContent = now.toISOString().split('T')[0];
}

function startCountdown() {
  let remaining = config.duration;
  if (elements.countdown) elements.countdown.textContent = '60:00';
  clearInterval(countdownInterval);
  countdownInterval = setInterval(() => {
    if (remaining <= 0) {
      clearInterval(countdownInterval);
      if (state === 'recording') stopRecording();
      if (elements.countdown) elements.countdown.textContent = '00:00';
    } else {
      const minutes = String(Math.floor(remaining / 60)).padStart(2, '0');
      const seconds = String(remaining % 60).padStart(2, '0');
      if (elements.countdown) elements.countdown.textContent = `${minutes}:${seconds}`;
      remaining--;
    }
  }, 1000);
}

function initialize() {
  const missingElements = Object.keys(elements).filter(key => !elements[key]);
  if (missingElements.length > 0) {
    console.error('Missing DOM elements:', missingElements);
    displayMessage('System', 'Error: Some page elements are missing. Please check the console.');
    return;
  }
  setInterval(updateDateTime, 1000);
  updateDateTime();
  startCountdown();
  displayMessage('Therapist', "Hello, I'm your CBT chatbot. What's on your mind today?");
  speakCBT("Hello, I'm your CBT chatbot. What's on your mind today?");
}

function displayMessage(role, text) {
  if (!elements.chat) {
    console.error('Chat element not found');
    return;
  }
  const message = document.createElement('div');
  message.innerHTML = `<strong>${role}:</strong> ${text}`;
  message.style.color = role === 'Therapist' ? 'yellow' : 'white';
  elements.chat.appendChild(message);
  elements.chat.scrollTop = elements.chat.scrollHeight;
  logHistory.push({ role, text });
}

elements.recordButton.addEventListener('click', async () => {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    displayMessage('System', 'Microphone access not supported in this browser.');
    console.error('MediaDevices API not supported');
    return;
  }
  if (state === 'idle') {
    await startRecording();
  } else if (state === 'recording') {
    stopRecording();
  }
});

elements.saveButton.addEventListener('click', () => {
  const blob = new Blob([logHistory.map(m => `${m.role}: ${m.text}`).join("\n")], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'chat_log.txt';
  a.click();
  URL.revokeObjectURL(url);
});

async function startRecording() {
  if (state !== 'idle') return;
  state = 'recording';
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];

    // Initialize speech recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('SpeechRecognition API not supported');
      displayMessage('System', 'Speech transcription not supported in this browser.');
    } else {
      recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.start();
    }

    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    sourceNode = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    sourceNode.connect(analyser);
    drawWaveform(elements.userScope, analyser);

    mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
    mediaRecorder.onstop = async () => {
      state = 'processing';
      if (recognition) recognition.stop();
      cleanupStream();
      try {
        const userText = await new Promise((resolve) => {
          if (!recognition) return resolve('');
          recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            resolve(transcript);
          };
          recognition.onerror = () => resolve('');
          recognition.onend = () => resolve('');
        });
        if (userText) {
          displayMessage('User', userText);
        } else {
          displayMessage('System', 'No transcription available.');
        }
        const responseText = "Thanks for sharing. I'm here to listen.";
        displayMessage('Therapist', responseText);
        await speakCBT(responseText);
      } catch (error) {
        console.error('Processing error:', error);
        displayMessage('System', `Error: ${error.message}`);
      } finally {
        state = 'idle';
        updateRecordButton();
      }
    };

    mediaRecorder.start();
    updateRecordButton();
    setTimeout(() => {
      if (state === 'recording') stopRecording();
    }, config.maxRecordingTime);
  } catch (error) {
    console.error('Recording error:', error);
    displayMessage('System', `Recording error: ${error.message}. Please ensure microphone access is allowed.`);
    state = 'idle';
    updateRecordButton();
  }
}

function stopRecording() {
  if (state === 'recording' && mediaRecorder) {
    mediaRecorder.stop();
  }
}

function cleanupStream() {
  if (stream) stream.getTracks().forEach(track => track.stop());
  if (sourceNode) sourceNode.disconnect();
  if (audioContext) audioContext.close();
  stream = null;
  sourceNode = null;
  audioContext = null;
  if (recognition) recognition = null;
}

function updateRecordButton() {
  if (!elements.recordButton) return;
  elements.recordButton.textContent = state === 'recording' ? 'Stop' : 'Speak';
  elements.recordButton.style.borderColor = state === 'recording' ? 'magenta' : '#0ff';
  elements.recordButton.disabled = state === 'processing';
  elements.recordButton.classList.toggle('recording', state === 'recording');
}

function drawWaveform(canvas, analyser) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;
  analyser.fftSize = 256;
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  function draw() {
    if (state !== 'recording') return;
    requestAnimationFrame(draw);
    analyser.getByteTimeDomainData(dataArray);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'yellow';
    ctx.beginPath();
    const sliceWidth = canvas.width / bufferLength;
    let x = 0;
    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = v * canvas.height / 2;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      x += sliceWidth;
    }
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
  }
  draw();
}

async function speakCBT(text) {
  return new Promise((resolve, reject) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-GB';
    utterance.volume = 1;
    utterance.rate = 0.9;
    utterance.pitch = 0.8;

    const voices = speechSynthesis.getVoices();
    const britishVoice = voices.find(voice => voice.lang === 'en-GB' && voice.name.toLowerCase().includes('male')) || 
                        voices.find(voice => voice.lang === 'en-GB');
    if (britishVoice) {
      utterance.voice = britishVoice;
    } else {
      console.warn('No British male voice found, using default en-GB voice');
    }

    if (voices.length === 0) {
      speechSynthesis.onvoiceschanged = () => {
        const voices = speechSynthesis.getVoices();
        const britishVoice = voices.find(voice => voice.lang === 'en-GB' && voice.name.toLowerCase().includes('male')) || 
                            voices.find(voice => voice.lang === 'en-GB');
        if (britishVoice) {
          utterance.voice = britishVoice;
        }
        speechSynthesis.cancel();
        speechSynthesis.speak(utterance);
      };
    } else {
      speechSynthesis.cancel();
      speechSynthesis.speak(utterance);
    }

    utterance.onend = resolve;
    utterance.onerror = e => reject(new Error(e.message));
  });
}

window.addEventListener('unload', cleanupStream);
document.addEventListener('DOMContentLoaded', initialize);
