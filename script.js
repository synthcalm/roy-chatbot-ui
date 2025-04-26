// === FULLY REVISED SCRIPT.JS WITH RELIABLE AUDIO PLAYBACK, INPUT, DUAL WAVEFORM, INFO BAR, AND GREETING ===

let recognition, audioContext, analyser, dataArray, source;
let outputAudioContext, outputAnalyser, outputDataArray, outputSource;
let isRecording = false;
let userStream;
let currentTranscript = '';
let lastTranscript = ''; // NEW: To prevent duplicates
let speakBtn;

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
  if (outputAnalyser && outputDataArray) {
    outputAnalyser.getByteTimeDomainData(outputDataArray);
    ctx.beginPath();
    const sliceWidth = canvas.width / outputDataArray.length;
    let x = 0;
    for (let i = 0; i < outputDataArray.length; i++) {
      const v = outputDataArray[i] / 128.0;
      const y = (v * canvas.height) / 4 + canvas.height / 2;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      x += sliceWidth;
    }
    ctx.strokeStyle = '#CCCCCC';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  if (isRecording || outputAnalyser) {
    requestAnimationFrame(() => drawMergedWaveform(ctx, canvas));
  }
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

function scrollMessages() {
  const messages = document.getElementById('messages');
  messages.scrollTop = messages.scrollHeight;
}

function showThinkingIndicator() {
  const indicator = document.getElementById('thinking-indicator');
  indicator.innerHTML = 'Roy is thinking<span class="dots"></span>';
  indicator.style.display = 'block';
}

function hideThinkingIndicator() {
  document.getElementById('thinking-indicator').style.display = 'none';
}

function sendToRoy(transcript) {
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
      if (data.audio) playAudioBuffer(data.audio);
    })
    .catch(error => {
      hideThinkingIndicator();
      appendRoyMessage('Error: Could not get Roy’s response.');
      console.error('Roy API Error:', error);
    });
}

document.addEventListener('DOMContentLoaded', () => {
  updateDateTime();
  updateCountdownTimer();
  const { waveform, ctx } = initWaveform();
  speakBtn = document.getElementById('speakBtn');

  appendRoyMessage("Hey, man... I'm Roy, your chill companion here to listen. Whenever you're ready, just hit SPEAK and let's talk, yeah?");

  speakBtn.addEventListener('click', () => {
    if (!isRecording) {
      isRecording = true;
      speakBtn.classList.add('active');
      speakBtn.innerText = 'STOP';
      startTranscription(ctx, waveform);
    } else {
      stopUserRecording();
    }
  });

  const allButtons = document.querySelectorAll('button');
  allButtons.forEach(button => button.style.color = '#66CCFF');
});
