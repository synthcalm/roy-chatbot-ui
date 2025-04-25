// === Roy Chatbot Script (Complete Package with CBT Strategy and Adaptive Detection) ===

let recognition, audioContext, analyser, dataArray, source;
let isRecording = false;
let userStream, royAudioContext, royAnalyser, royDataArray, roySource;
let currentTranscript = '';
let sessionStartTime = null;

function updateDateTime() {
  const dateTimeDiv = document.getElementById('date-time');
  if (dateTimeDiv) {
    dateTimeDiv.textContent = new Date().toLocaleString();
    setInterval(() => {
      dateTimeDiv.textContent = new Date().toLocaleString();
    }, 1000);
  }
}

function updateCountdownTimer() {
  const countdownDiv = document.getElementById('countdown-timer');
  let timeLeft = 3600;
  const updateTimer = () => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    countdownDiv.textContent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    timeLeft = (timeLeft - 1 + 3600) % 3600;
  };
  updateTimer();
  setInterval(updateTimer, 1000);
}

function initWaveform() {
  const waveform = document.getElementById('waveform');
  const container = waveform.parentElement;
  waveform.width = container.offsetWidth;
  waveform.height = container.offsetHeight;
  const ctx = waveform.getContext('2d');
  return { waveform, ctx };
}

function drawMergedWaveform(ctx, canvas) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (analyser && dataArray) {
    analyser.getByteTimeDomainData(dataArray);
    ctx.beginPath();
    const sliceWidth = canvas.width / dataArray.length;
    let x = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * canvas.height) / 4;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      x += sliceWidth;
    }
    ctx.strokeStyle = '#66CCFF';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  if (royAnalyser && royDataArray) {
    royAnalyser.getByteTimeDomainData(royDataArray);
    ctx.beginPath();
    const sliceWidth = canvas.width / royDataArray.length;
    let x = 0;
    for (let i = 0; i < royDataArray.length; i++) {
      const v = royDataArray[i] / 128.0;
      const y = (v * canvas.height) / 4 + canvas.height / 2;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      x += sliceWidth;
    }
    ctx.strokeStyle = '#CCCCCC';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  if (isRecording || royAnalyser) {
    requestAnimationFrame(() => drawMergedWaveform(ctx, canvas));
  }
}

function scrollMessages() {
  const messages = document.getElementById('messages');
  messages.scrollTop = messages.scrollHeight;
}

function appendUserMessage(message) {
  const messages = document.getElementById('messages');
  messages.innerHTML += `<div class="user">You: ${message}</div>`;
  scrollMessages();
}

function appendRoyMessage(message) {
  const messages = document.getElementById('messages');
  messages.innerHTML += `<div class="roy">Roy: ${message}</div>`;
  scrollMessages();
}

function detectUserStyle(transcript) {
  const intellectualWords = ["dissonance", "existential", "ontological", "framework", "empirical", "methodology", "intersectionality"];
  return intellectualWords.some(word => transcript.toLowerCase().includes(word)) ? 'intellectual' : 'everyday';
}

function sendToRoy(transcript) {
  const userType = detectUserStyle(transcript);
  appendUserMessage(transcript);
  document.getElementById('thinking-indicator').style.display = 'block';

  fetch('https://roy-chatbo-backend.onrender.com/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: transcript, userType: userType })
  })
    .then(response => response.json())
    .then(data => {
      document.getElementById('thinking-indicator').style.display = 'none';
      if (data.text) appendRoyMessage(data.text);

      if (data.audio) {
        if (royAudioContext && royAudioContext.state !== 'closed') {
          try { royAudioContext.close(); } catch (e) {}
        }
        const replyAudio = new Audio(data.audio);
        replyAudio.play().catch(err => console.error('Playback error:', err));
        setupRoyWaveform(replyAudio);
        replyAudio.onended = () => {
          speakBtn.classList.remove('active');
          speakBtn.innerText = 'SPEAK';
        };
      }
    })
    .catch(error => {
      document.getElementById('thinking-indicator').style.display = 'none';
      appendRoyMessage('Error: Could not get Roy’s response.');
      console.error('Roy API Error:', error);
    });
}
