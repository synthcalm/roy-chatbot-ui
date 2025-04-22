const royBtn = document.getElementById('royBtn');
const randyBtn = document.getElementById('randyBtn');
const speakBtn = document.getElementById('speakBtn');
const saveBtn = document.getElementById('saveBtn');
const homeBtn = document.getElementById('homeBtn');
const messagesDiv = document.getElementById('messages');
const userCanvas = document.getElementById('userWaveform');
const royCanvas = document.getElementById('royWaveform');
const scopesContainer = document.getElementById('scopes-container');
const userCtx = userCanvas.getContext('2d');
const royCtx = royCanvas.getContext('2d');
const dateTimeSpan = document.getElementById('date-time');
const countdownTimerSpan = document.getElementById('countdown-timer');

let mediaRecorder, audioChunks = [], isRecording = false;
let selectedPersona = null;
let userAudioContext = null;
let royAudioContext = null;
let royAudioSource = null;
let stream = null;

function initButtonStyles() {
  royBtn.style.border = '1px solid cyan';
  randyBtn.style.border = '1px solid cyan';
  saveBtn.style.border = '1px solid cyan';
  speakBtn.style.backgroundColor = 'black';
  speakBtn.style.color = 'cyan';
  speakBtn.style.border = '1px solid cyan';
  speakBtn.textContent = 'SPEAK';
  speakBtn.classList.remove('blinking');
}

function addMessage(text, sender, isThinking = false) {
  const msg = document.createElement('p');
  msg.className = sender;
  msg.textContent = isThinking ? `${text} Thinking` : text;

  if (isThinking) {
    const dotsSpan = document.createElement('span');
    dotsSpan.className = 'thinking-dots';
    msg.appendChild(dotsSpan);
  }

  messagesDiv.appendChild(msg);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
  return msg;
}

function drawWaveform(ctx, canvas, data, color, isUser) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.beginPath();
  const sliceWidth = canvas.width / data.length;
  const centerY = canvas.height / 2;
  const scale = isUser ? 50 : 80;

  for (let i = 0; i < data.length; i++) {
    const normalized = (data[i] / 128.0) - 1;
    const y = centerY + (normalized * scale);
    const x = i * sliceWidth;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function setupUserVisualization(stream) {
  if (userAudioContext) userAudioContext.close();
  userAudioContext = new (window.AudioContext || window.webkitAudioContext)();
  const source = userAudioContext.createMediaStreamSource(stream);
  const analyser = userAudioContext.createAnalyser();
  analyser.fftSize = 2048;
  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  source.connect(analyser);

  function animate() {
    if (!isRecording) {
      userCtx.clearRect(0, 0, userCanvas.width, userCanvas.height);
      return;
    }
    analyser.getByteTimeDomainData(dataArray);
    drawWaveform(userCtx, userCanvas, dataArray, 'yellow', true);
    requestAnimationFrame(animate);
  }
  animate();
}

function playRoyAudio(base64Audio) {
  const audioEl = new Audio(`data:audio/mp3;base64,${base64Audio}`);
  audioEl.setAttribute('playsinline', '');

  if (royAudioContext) royAudioContext.close();
  royAudioContext = new (window.AudioContext || window.webkitAudioContext)();

  audioEl.addEventListener('loadedmetadata', () => {
    try {
      royAudioSource = royAudioContext.createMediaElementSource(audioEl);
      const analyser = royAudioContext.createAnalyser();
      analyser.fftSize = 2048;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      royAudioSource.connect(analyser);
      analyser.connect(royAudioContext.destination);

      function animate() {
        analyser.getByteTimeDomainData(dataArray);
        const color = selectedPersona === 'randy' ? 'orange' : 'magenta';
        drawWaveform(royCtx, royCanvas, dataArray, color, false);
        if (!audioEl.paused) requestAnimationFrame(animate);
      }
      animate();

      royAudioContext.resume().then(() => audioEl.play().catch(console.warn));
      audioEl.addEventListener('ended', () => {
        royCtx.clearRect(0, 0, royCanvas.width, royCanvas.height);
        resetSpeakButton();
      });
    } catch (e) {
      console.error('Roy audio playback failed:', e);
    }
  });

  audioEl.load();
}

function resetSpeakButton() {
  speakBtn.textContent = 'SPEAK';
  speakBtn.classList.remove('blinking');
  speakBtn.style.backgroundColor = 'red';
  speakBtn.style.color = 'white';
  speakBtn.style.border = '1px solid red';
}

function updateDateTime() {
  const now = new Date();
  const date = now.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
  const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  dateTimeSpan.textContent = `${date}  ${time}`;
  setTimeout(updateDateTime, 60000);
}

function startCountdownTimer() {
  let seconds = 60 * 60;
  const timer = setInterval(() => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    countdownTimerSpan.textContent = `${m}:${s < 10 ? '0' : ''}${s}`;
    seconds--;
    if (seconds < 0) clearInterval(timer);
  }, 1000);
}

function cleanupRecording() {
  if (stream) stream.getTracks().forEach(t => t.stop());
  if (userAudioContext) userAudioContext.close();
  if (royAudioContext) royAudioContext.close();
  userAudioContext = null;
  royAudioContext = null;
  stream = null;
  mediaRecorder = null;
  audioChunks = [];
  isRecording = false;
}

royBtn.addEventListener('click', () => {
  selectedPersona = 'roy';
  initButtonStyles();
  royBtn.style.backgroundColor = 'green';
  royBtn.style.color = 'white';
  speakBtn.style.backgroundColor = 'red';
  speakBtn.style.color = 'white';
  speakBtn.style.border = '1px solid red';
  addMessage("Roy: Greetings, traveler. What brings you here?", 'roy');
});

randyBtn.addEventListener('click', () => {
  selectedPersona = 'randy';
  initButtonStyles();
  randyBtn.style.backgroundColor = '#FFC107';
  randyBtn.style.color = 'white';
  speakBtn.style.backgroundColor = 'red';
  speakBtn.style.color = 'white';
  speakBtn.style.border = '1px solid red';
  addMessage("Randy: Alright, shoot. What’s bugging you?", 'randy');
});

speakBtn.addEventListener('click', async () => {
  if (!selectedPersona) {
    alert("Please choose Roy or Randy.");
    return;
  }

  if (isRecording) {
    mediaRecorder?.stop();
    return;
  }

  speakBtn.textContent = 'STOP';
  speakBtn.classList.add('blinking');
  speakBtn.style.backgroundColor = 'red';
  speakBtn.style.border = '1px solid red';
  speakBtn.style.color = 'white';

  try {
    isRecording = true;
    audioChunks = [];
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    setupUserVisualization(stream);
    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      resetSpeakButton();
      userCtx.clearRect(0, 0, userCanvas.width, userCanvas.height);

      const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
      const formData = new FormData();
      formData.append('audio', audioBlob);
      formData.append('bot', selectedPersona);

      const userLine = addMessage("You: Transcribing...", 'user');
      const botLine = addMessage(`${selectedPersona === 'randy' ? 'Randy' : 'Roy'}`, selectedPersona, true);

      try {
        const res1 = await fetch('https://roy-chatbo-backend.onrender.com/api/transcribe', {
          method: 'POST', body: formData
        });
        const data1 = await res1.json();
        userLine.textContent = "You: " + (data1.text || '...');

        const res2 = await fetch('https://roy-chatbo-backend.onrender.com/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: data1.text, persona: selectedPersona })
        });
        const data2 = await res2.json();
        botLine.remove();
        addMessage(`${selectedPersona === 'randy' ? 'Randy' : 'Roy'}: ${data2.text || '...'}`, selectedPersona);

        if (data2.audio) playRoyAudio(data2.audio);
        else cleanupRecording();

      } catch (err) {
        console.error('Error:', err);
        userLine.textContent = "You: Transcription failed";
        botLine.remove();
        addMessage(`${selectedPersona === 'randy' ? 'Randy' : 'Roy'}: I couldn’t catch that.`, selectedPersona);
        cleanupRecording();
      }
    };

    mediaRecorder.start();
  } catch (err) {
    console.error('Mic error:', err);
    alert('Microphone access is needed.');
    resetSpeakButton();
    isRecording = false;
  }
});

saveBtn.addEventListener('click', () => {
  const blob = new Blob([messagesDiv.innerText], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'conversation.txt';
  a.click();
});

homeBtn.addEventListener('click', () => {
  window.location.href = 'https://synthcalm.com';
});

window.addEventListener('load', () => {
  initButtonStyles();
  updateDateTime();
  startCountdownTimer();
  userCtx.clearRect(0, 0, userCanvas.width, userCanvas.height);
  royCtx.clearRect(0, 0, royCanvas.width, royCanvas.height);
});

document.head.insertAdjacentHTML('beforeend', `
  <style>
    .blinking {
      animation: blink 1s step-start infinite;
    }
    @keyframes blink {
      50% { opacity: 0.3; }
    }
    .thinking-dots::after {
      content: '';
      animation: thinking-dots 1.4s infinite steps(4, end);
    }
    @keyframes thinking-dots {
      0% { content: ''; }
      25% { content: '.'; }
      50% { content: '..'; }
      75% { content: '...'; }
      100% { content: ''; }
    }
  </style>
`);
