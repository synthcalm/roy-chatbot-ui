// === script.js (Revised: Stronger User Waveform, Roy Chatbot Fully Working) ===

let royState = 'idle';
let feedbackState = 'idle';
let mediaRecorder;
let audioChunks = [];
let userWaveformCtx, royWaveformCtx;
let analyser, dataArray, source;
let userAudioContext, royAudioContext;
let recognition;
let currentUtterance = '';
let thinkingInterval;

function updateDateTime() {
  const dateTimeDiv = document.getElementById('date-time');
  if (dateTimeDiv) dateTimeDiv.textContent = new Date().toLocaleString();
}

function updateCountdownTimer() {
  const countdownDiv = document.getElementById('countdown-timer');
  let timeLeft = 60 * 60;
  setInterval(() => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    countdownDiv.textContent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    timeLeft = (timeLeft - 1 + 3600) % 3600;
  }, 1000);
}

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
  userWaveformCtx.lineWidth = 6; // Boosted line width for stronger user waveform
  royWaveformCtx.lineWidth = 2;
}

function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert('Speech recognition not supported.');
    return;
  }
  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onresult = (event) => {
    let interim = '', final = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      event.results[i].isFinal ? final += transcript + ' ' : interim += transcript;
    }
    if (final.trim()) currentUtterance += final.trim() + ' ';
    const messages = document.getElementById('messages');
    const interimDiv = document.getElementById('interim');
    const fullLine = currentUtterance + interim;
    if (interimDiv) {
      interimDiv.textContent = `You: ${fullLine.trim()}`;
    } else {
      messages.innerHTML += `<div id="interim" class="user">You: ${fullLine.trim()}</div>`;
    }
    scrollMessages();
  };

  recognition.onerror = (e) => console.error('Speech recognition error:', e);
  recognition.onend = () => {
    if (royState === 'engaged') recognition.start();
  };
}

function startRecording() {
  navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.start();
    mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
    userAudioContext = new AudioContext();
    analyser = userAudioContext.createAnalyser();
    dataArray = new Uint8Array(analyser.fftSize);
    source = userAudioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    animateUserWaveform();
    recognition.start();
  }).catch(err => {
    console.error('Error accessing microphone:', err);
    alert('Microphone access denied or unavailable.');
  });
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
  audioChunks = [];
  if (source) source.disconnect();
  if (analyser) analyser.disconnect();
  if (userAudioContext) userAudioContext.close();
  recognition.stop();
}

function animateUserWaveform() {
  if (royState !== 'engaged') return;
  analyser.getByteTimeDomainData(dataArray);
  drawWaveform(userWaveformCtx, document.getElementById('user-waveform'), dataArray);
  requestAnimationFrame(animateUserWaveform);
}

function animateRoyWaveform(audio) {
  if (royAudioContext && royAudioContext.state !== 'closed') {
    royAudioContext.close();
  }
  royAudioContext = new AudioContext();
  const analyser = royAudioContext.createAnalyser();
  const dataArray = new Uint8Array(analyser.fftSize);
  const source = royAudioContext.createMediaElementSource(audio);
  const gainNode = royAudioContext.createGain();
  gainNode.gain.value = 2.0;

  source.connect(gainNode);
  gainNode.connect(analyser);
  analyser.connect(royAudioContext.destination);

  audio.onplay = () => {
    function draw() {
      if (audio.paused) return royAudioContext.close();
      analyser.getByteTimeDomainData(dataArray);
      drawWaveform(royWaveformCtx, document.getElementById('roy-waveform'), dataArray);
      requestAnimationFrame(draw);
    }
    draw();
  };
  audio.play().catch(console.error);
}

function drawWaveform(ctx, canvas, data) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.beginPath();
  const sliceWidth = canvas.width / data.length;
  let x = 0;
  data.forEach((v, i) => {
    const y = canvas.height / 2 + (v / 128.0 - 1) * (canvas.height / 2);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    x += sliceWidth;
  });
  ctx.stroke();
}

function scrollMessages() {
  const messages = document.getElementById('messages');
  messages.scrollTop = messages.scrollHeight;
}

function commitUtterance() {
  const messages = document.getElementById('messages');
  const interimDiv = document.getElementById('interim');
  if (interimDiv) interimDiv.remove();
  if (currentUtterance.trim()) {
    messages.innerHTML += `<div class="user">You: ${currentUtterance.trim()}</div>`;
    scrollMessages();
    currentUtterance = '';
  }
}

function showThinkingDots() {
  const messages = document.getElementById('messages');
  const thinkingDiv = document.createElement('div');
  thinkingDiv.id = 'thinking';
  thinkingDiv.classList.add('roy');
  thinkingDiv.textContent = 'Roy: thinking';
  messages.appendChild(thinkingDiv);
  scrollMessages();
  let dotCount = 0;
  thinkingInterval = setInterval(() => {
    dotCount = (dotCount + 1) % 4;
    thinkingDiv.textContent = `Roy: thinking${'.'.repeat(dotCount)}`;
    scrollMessages();
  }, 500);
}

function stopThinkingDots() {
  clearInterval(thinkingInterval);
  const thinkingDiv = document.getElementById('thinking');
  if (thinkingDiv) thinkingDiv.remove();
}

async function sendToRoy() {
  commitUtterance();
  const messages = document.getElementById('messages');
  const lastUserMsg = Array.from(messages.querySelectorAll('.user')).pop()?.textContent.replace('You: ', '') || '';
  if (!lastUserMsg.trim()) return;
  showThinkingDots();
  try {
    const response = await fetch('https://roy-chatbo-backend.onrender.com/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: lastUserMsg })
    });
    const data = await response.json();
    stopThinkingDots();
    messages.innerHTML += `<div class="roy">Roy: ${data.text}</div>`;
    scrollMessages();
    if (data.audio) {
      const royAudio = new Audio(data.audio);
      animateRoyWaveform(royAudio);
    }
  } catch (err) {
    stopThinkingDots();
    messages.innerHTML += '<div class="roy">Roy: Sorry, I’m having trouble responding right now.</div>';
    scrollMessages();
  }
}

function handleStart() {
  if (royState === 'idle') {
    royState = 'engaged';
    royBtn.classList.add('engaged');
    royBtn.textContent = 'STOP';
    startRecording();
  }
}

function handleStop() {
  if (royState === 'engaged') {
    royState = 'idle';
    royBtn.classList.remove('engaged');
    royBtn.textContent = 'SPEAK';
    stopRecording();
    sendToRoy();
  }
}

const royBtn = document.getElementById('royBtn');
function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

if (isIOS()) {
  royBtn?.addEventListener('touchstart', (e) => { e.preventDefault(); handleStart(); });
  royBtn?.addEventListener('touchend', (e) => { e.preventDefault(); handleStop(); });
} else {
  royBtn?.addEventListener('click', () => { if (royState === 'idle') handleStart(); else handleStop(); });
}

const feedbackBtn = document.getElementById('feedbackBtn');
feedbackBtn?.addEventListener('click', () => {
  if (feedbackState === 'idle') {
    feedbackState = 'engaged';
    feedbackBtn.classList.add('engaged');
    sendToRoy().finally(() => {
      feedbackState = 'idle';
      feedbackBtn.classList.remove('engaged');
    });
  }
});

document.getElementById('saveBtn')?.addEventListener('click', () => {
  const messages = document.getElementById('messages');
  const text = Array.from(messages.querySelectorAll('div')).map(div => div.textContent).join('\n');
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `synthcalm_chat_${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('homeBtn')?.addEventListener('click', () => {
  window.location.href = 'https://synthcalm.com';
});

document.addEventListener('DOMContentLoaded', () => {
  try {
    updateDateTime();
    updateCountdownTimer();
    initWaveforms();
    initSpeechRecognition();
  } catch (err) {
    console.error('Initialization error:', err);
  }
});
