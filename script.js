let recognition, audioContext, analyser, dataArray, source;
let isRecording = false;
let userStream, royAudioContext, royAnalyser, royDataArray, roySource;
let currentTranscript = '';

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

function showThinkingIndicator() {
  const indicator = document.getElementById('thinking-indicator');
  indicator.innerHTML = 'Roy is thinking<span class="dots">...</span>';
  indicator.style.display = 'block';
}

function hideThinkingIndicator() {
  document.getElementById('thinking-indicator').style.display = 'none';
}

function sendToRoy(transcript) {
  if (!transcript || transcript.trim() === '') {
    console.warn('Transcript is empty, not sending to backend.');
    appendRoyMessage("Hmm... didn't catch that. Try saying something?");
    return;
  }

  appendUserMessage(transcript);
  showThinkingIndicator();

  fetch('https://roy-chatbo-backend.onrender.com/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: transcript })
  })
    .then(response => response.json())
    .then(data => {
      hideThinkingIndicator();
      if (data.text) appendRoyMessage(data.text);

      if (data.audio) {
        const replyAudio = new Audio(data.audio); // Always create new Audio instance
        replyAudio.setAttribute('playsinline', 'true'); // iOS compatibility
        replyAudio.play().catch(err => console.error('Playback error:', err));
        setupRoyWaveform(replyAudio);
        replyAudio.onended = () => {
          speakBtn.classList.remove('active');
          speakBtn.innerText = 'SPEAK';
        };
      }
    })
    .catch(error => {
      hideThinkingIndicator();
      appendRoyMessage('Error: Could not get Roy’s response.');
      console.error('Roy API Error:', error);
    });
}

// Remaining functions (startTranscription, stopUserRecording, setupRoyWaveform, document ready) remain unchanged except for applying the user color to buttons

// Apply user color to buttons
const allButtons = document.querySelectorAll('button');
allButtons.forEach(button => button.style.color = '#66CCFF');
