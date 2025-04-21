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

function initButtonStyles() {
  royBtn.style.border = '1px solid cyan';
  randyBtn.style.border = '1px solid cyan';
  saveBtn.style.border = '1px solid cyan';

  speakBtn.style.backgroundColor = 'black';
  speakBtn.style.color = 'cyan';
  speakBtn.style.border = '1px solid cyan';
}

function addMessage(text, sender, isThinking = false) {
  const msg = document.createElement('p');
  msg.className = sender;

  if (isThinking) {
    msg.classList.add('thinking');
    const baseText = text.endsWith('Thinking') ? text : `${text} Thinking`;
    msg.textContent = baseText;

    const dotsSpan = document.createElement('span');
    dotsSpan.className = 'thinking-dots';
    msg.appendChild(dotsSpan);
  } else {
    msg.textContent = text;
  }

  messagesDiv.appendChild(msg);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
  return msg;
}

function drawWaveform(canvasCtx, canvas, data, color, isUserWaveform) {
  canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
  canvasCtx.beginPath();

  const sliceWidth = canvas.width / data.length;
  const centerY = canvas.height / 2;
  const scale = isUserWaveform ? 50 : 80;

  for (let i = 0; i < data.length; i++) {
    const normalized = (data[i] / 128.0) - 1;
    const y = centerY + (normalized * scale);
    const x = i * sliceWidth;

    if (i === 0) canvasCtx.moveTo(x, y);
    else canvasCtx.lineTo(x, y);
  }

  canvasCtx.strokeStyle = color;
  canvasCtx.lineWidth = 2;
  canvasCtx.stroke();
}

function setupUserVisualization(stream) {
  if (userAudioContext && userAudioContext.state !== 'closed') userAudioContext.close();

  userAudioContext = new (window.AudioContext || window.webkitAudioContext)();
  const source = userAudioContext.createMediaStreamSource(stream);
  const analyser = userAudioContext.createAnalyser();
  analyser.fftSize = 2048;
  const dataArray = new Uint8Array(analyser.frequencyBinCount);

  source.connect(analyser);

  function animate() {
    if (!isRecording) return;
    analyser.getByteTimeDomainData(dataArray);
    drawWaveform(userCtx, userCanvas, dataArray, 'yellow', true);
    requestAnimationFrame(animate);
  }

  animate();
}

function playRoyAudio(base64Audio) {
  const audioEl = new Audio(`data:audio/mp3;base64,${base64Audio}`);
  audioEl.setAttribute('playsinline', '');

  if (royAudioContext && royAudioContext.state !== 'closed') {
    try {
      if (royAudioSource) royAudioSource.disconnect();
      royAudioContext.close();
    } catch (e) {
      console.log('Error closing previous audio context:', e);
    }
  }

  royAudioContext = new (window.AudioContext || window.webkitAudioContext)();

  audioEl.addEventListener('canplaythrough', () => {
    try {
      royAudioSource = royAudioContext.createMediaElementSource(audioEl);
      const analyser = royAudioContext.createAnalyser();
      analyser.fftSize = 2048;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      royAudioSource.connect(analyser);
      analyser.connect(royAudioContext.destination);

      let animationId;

      function animate() {
        analyser.getByteTimeDomainData(dataArray);
        const waveformColor = selectedPersona === 'randy' ? 'orange' : 'magenta';
        drawWaveform(royCtx, royCanvas, dataArray, waveformColor, false);
        animationId = requestAnimationFrame(animate);
      }

      animate();
      audioEl.play();

      audioEl.addEventListener('ended', () => {
        cancelAnimationFrame(animationId);
        royCtx.clearRect(0, 0, royCanvas.width, royCanvas.height);
        speakBtn.textContent = 'SPEAK';
        speakBtn.classList.remove('blinking');
        speakBtn.style.backgroundColor = 'red';
        speakBtn.style.color = 'white';
        speakBtn.style.border = '1px solid red';
      });

    } catch (error) {
      console.error('Audio visualization failed, playing fallback');
      audioEl.play();
    }
  });

  audioEl.load();
}

function resetButtonColors() {
  royBtn.style.backgroundColor = 'black';
  royBtn.style.color = 'cyan';
  royBtn.style.border = '1px solid cyan';

  randyBtn.style.backgroundColor = 'black';
  randyBtn.style.color = 'cyan';
  randyBtn.style.border = '1px solid cyan';

  speakBtn.style.backgroundColor = 'black';
  speakBtn.style.color = 'cyan';
  speakBtn.style.border = '1px solid cyan';
  speakBtn.textContent = 'SPEAK';
  speakBtn.classList.remove('blinking');

  isRecording = false;
  selectedPersona = null;

  userCtx.clearRect(0, 0, userCanvas.width, userCanvas.height);
  royCtx.clearRect(0, 0, royCanvas.width, royCanvas.height);
}

function updateDateTime() {
  const now = new Date();
  const date = now.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
  const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true });
  dateTimeSpan.textContent = `${date}   ${time}`;
  setTimeout(updateDateTime, 60000);
}

function startCountdownTimer() {
  let timeLeft = 60 * 60;

  const timer = setInterval(() => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    countdownTimerSpan.textContent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    timeLeft--;

    if (timeLeft < 0) {
      clearInterval(timer);
      countdownTimerSpan.textContent = '0:00';
    }
  }, 1000);
}

royBtn.addEventListener('click', () => {
  resetButtonColors();
  selectedPersona = 'roy';

  royBtn.style.backgroundColor = 'green';
  royBtn.style.color = 'white';
  royBtn.style.border = '1px solid green';

  speakBtn.style.backgroundColor = 'red';
  speakBtn.style.color = 'white';
  speakBtn.style.border = '1px solid red';

  scopesContainer.style.borderColor = 'cyan';
  addMessage('Roy: Greetings, my friend—like a weary traveler, you\'ve arrived. What weighs on your soul today?', 'roy');
});

randyBtn.addEventListener('click', () => {
  resetButtonColors();
  selectedPersona = 'randy';

  randyBtn.style.backgroundColor = '#FFC107';
  randyBtn.style.color = 'white';
  randyBtn.style.border = '1px solid #FFC107';

  speakBtn.style.backgroundColor = 'red';
  speakBtn.style.color = 'white';
  speakBtn.style.border = '1px solid red';

  scopesContainer.style.borderColor = 'red';
  addMessage('Randy: Unleash the chaos—what\'s burning you up?', 'randy');
});

speakBtn.addEventListener('click', async () => {
  if (!selectedPersona) {
    alert('Please choose Roy or Randy first.');
    return;
  }

  if (isRecording) {
    mediaRecorder.stop();
    return;
  }

  try {
    isRecording = true;
    speakBtn.textContent = 'STOP';
    speakBtn.classList.add('blinking');
    audioChunks = [];

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    setupUserVisualization(stream);
    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);

    mediaRecorder.onstop = async () => {
      speakBtn.textContent = 'SPEAK';
      speakBtn.classList.remove('blinking');
      speakBtn.style.backgroundColor = 'red';
      speakBtn.style.color = 'white';
      speakBtn.style.border = '1px solid red';
      isRecording = false;

      userCtx.clearRect(0, 0, userCanvas.width, userCanvas.height);
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      const formData = new FormData();
      formData.append('audio', audioBlob);

      try {
        const transcribeRes = await fetch('https://roy-chatbo-backend.onrender.com/api/transcribe', {
          method: 'POST',
          body: formData
        });

        const { text } = await transcribeRes.json();
        addMessage('You: ' + text, 'user');

        const thinkingMsg = addMessage(`${selectedPersona === 'randy' ? 'Randy' : 'Roy'}`, selectedPersona, true);

        const chatRes = await fetch('https://roy-chatbo-backend.onrender.com/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            persona: selectedPersona,
            mode: 'both'
          })
        });

        const { text: reply, audio } = await chatRes.json();

        thinkingMsg.remove();
        addMessage(`${selectedPersona === 'randy' ? 'Randy' : 'Roy'}: ${reply}`, selectedPersona);
        if (audio) playRoyAudio(audio);

      } catch (error) {
        console.error('Transcription or response error:', error);
        addMessage(`${selectedPersona === 'randy' ? 'Randy' : 'Roy'}: Sorry, I couldn't process your request.`, selectedPersona);
      }
    };

    mediaRecorder.start();

  } catch (error) {
    console.error('Microphone access error:', error);
    alert('Microphone permission denied or unavailable.');
    isRecording = false;
    speakBtn.textContent = 'SPEAK';
    speakBtn.classList.remove('blinking');
  }
});

saveBtn.addEventListener('click', () => {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-');
  const filename = `${selectedPersona || 'conversation'}-${timestamp}.txt`;
  const blob = new Blob([messagesDiv.innerText], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
});

homeBtn.addEventListener('click', () => {
  window.location.href = 'https://synthcalm.com';
});

window.addEventListener('load', () => {
  initButtonStyles();
  updateDateTime();
  startCountdownTimer();

  if (userAudioContext && userAudioContext.state !== 'closed') userAudioContext.close();
  if (royAudioContext && royAudioContext.state !== 'closed') royAudioContext.close();

  userCtx.clearRect(0, 0, userCanvas.width, userCanvas.height);
  royCtx.clearRect(0, 0, royCanvas.width, royCanvas.height);
});

document.head.insertAdjacentHTML('beforeend', `
  <style>
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
