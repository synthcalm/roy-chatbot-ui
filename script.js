// Updated Roy script using MIA's transcription + waveform method
let audioContext, analyser, dataArray, animationFrameId;
let recognition, finalTranscript = '';
let isRecording = false;
let stream;

const elements = {
  recordButton: document.getElementById('recordButton'),
  saveButton: document.getElementById('saveButton'),
  chat: document.getElementById('chat'),
  userScope: document.getElementById('userScope'),
  royScope: document.getElementById('royScope'),
  clock: document.getElementById('clock'),
  date: document.getElementById('date'),
  countdown: document.getElementById('countdown'),
  royAudio: document.getElementById('royAudio')
};

const config = {
  duration: 3600
};

let countdownInterval;

function updateDateTime() {
  const now = new Date();
  elements.clock.textContent = now.toTimeString().split(' ')[0];
  elements.date.textContent = now.toISOString().split('T')[0];
}

function startCountdown() {
  let remaining = config.duration;
  clearInterval(countdownInterval);
  countdownInterval = setInterval(() => {
    if (remaining <= 0) {
      clearInterval(countdownInterval);
    } else {
      const minutes = String(Math.floor(remaining / 60)).padStart(2, '0');
      const seconds = String(remaining % 60).padStart(2, '0');
      elements.countdown.textContent = `${minutes}:${seconds}`;
      remaining--;
    }
  }, 1000);
}

setInterval(updateDateTime, 1000);
updateDateTime();
startCountdown();

displayMessage("Roy", "Welcome. I'm Roy. Speak when ready.");

function displayMessage(role, text) {
  const message = document.createElement('div');
  message.innerHTML = `<strong>${role}:</strong> ${text}`;
  message.style.color = role === 'Roy' ? 'yellow' : 'white';
  elements.chat.appendChild(message);
  elements.chat.scrollTop = elements.chat.scrollHeight;
}

function drawWaveform(canvas, analyser) {
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;
  analyser.fftSize = 2048;
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  function draw() {
    if (!isRecording) {
      cancelAnimationFrame(animationFrameId);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
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
    animationFrameId = requestAnimationFrame(draw);
  }
  draw();
}

async function startRecording() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    source.connect(analyser);
    drawWaveform(elements.userScope, analyser);

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' ';
          displayMessage("You", transcript);
          simulateRoyResponse(transcript);
        } else {
          interimTranscript = transcript;
        }
      }
    };

    recognition.onerror = (event) => {
      displayMessage("System", `Error: ${event.error}`);
    };

    recognition.onend = () => {
      stopRecording();
    };

    recognition.start();
    isRecording = true;
    updateRecordButton();
  } catch (err) {
    displayMessage("System", `Mic error: ${err.message}`);
  }
}

function stopRecording() {
  if (recognition) recognition.stop();
  if (stream) stream.getTracks().forEach(track => track.stop());
  if (audioContext) audioContext.close();
  isRecording = false;
  updateRecordButton();
}

function updateRecordButton() {
  elements.recordButton.textContent = isRecording ? 'Stop' : 'Speak';
  elements.recordButton.style.borderColor = isRecording ? 'magenta' : '#0ff';
}

elements.recordButton.addEventListener('click', () => {
  isRecording ? stopRecording() : startRecording();
});

elements.saveButton.addEventListener('click', () => {
  const log = Array.from(elements.chat.children).map(m => m.innerText).join('\n');
  const blob = new Blob([log], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'chat_log.txt';
  a.click();
  URL.revokeObjectURL(url);
});

function simulateRoyResponse(userText) {
  const responses = [
    "You're not alone in this.",
    "Let’s break that thought down.",
    "Can you tell me more about that feeling?",
    "That sounds heavy. I'm here with you."
  ];
  const reply = responses[Math.floor(Math.random() * responses.length)];
  displayMessage("Roy", reply);
  elements.royAudio.play();
}
