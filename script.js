// ✅ Roy Chatbot frontend logic with iOS fix AND reliable button response

document.addEventListener('DOMContentLoaded', () => {
  const royToggle = document.getElementById('roy-toggle');
  const randyToggle = document.getElementById('randy-toggle');
  const speakToggle = document.getElementById('speak-toggle');
  const saveButton = document.getElementById('saveButton');
  const userWaveform = document.getElementById('userWaveform');
  const royWaveform = document.getElementById('royWaveform');
  const messagesDiv = document.getElementById('messages');
  const userCtx = userWaveform.getContext('2d');
  const royCtx = royWaveform.getContext('2d');
  const currentDate = document.getElementById('current-date');
  const currentTime = document.getElementById('current-time');
  const countdownTimer = document.getElementById('countdown-timer');

  const BACKEND_URL = 'https://roy-chatbo-backend.onrender.com';

  let audioContext, analyser, dataArray, source, mediaRecorder, chunks = [];
  let isRecording = false;
  let isRantMode = false;
  let isModeSelected = false;
  let volumeData = [];
  let sessionStartTime;
  let silenceTimeout;

  function unlockAudioContext() {
    if (!audioContext || audioContext.state !== 'running') {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      audioContext.resume();
    }
  }

  ['click', 'touchstart'].forEach(evt => {
    document.body.addEventListener(evt, unlockAudioContext, { once: true });
  });

  function updateDateTime() {
    const now = new Date();
    currentDate.textContent = now.toLocaleDateString();
    currentTime.textContent = now.toLocaleTimeString();
    if (sessionStartTime) {
      const elapsed = Math.floor((now - sessionStartTime) / 1000);
      const maxTime = isRantMode ? 1800 : 3600;
      const remaining = maxTime - elapsed;
      const minutes = Math.floor(remaining / 60);
      const seconds = remaining % 60;
      countdownTimer.textContent = `Session: ${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    }
  }
  setInterval(updateDateTime, 1000);

  function clearMessagesAndShowGreeting(mode) {
    messagesDiv.innerHTML = '';
    const msg = document.createElement('p');
    msg.className = 'roy';
    if (mode === 'randy') {
      msg.classList.add('randy');
      msg.innerHTML = `<em>Randy:</em> Unleash the chaos—what’s burning you up?`;
    } else {
      msg.innerHTML = `<em>Roy:</em> Greetings, my friend—like a weary traveler, you’ve arrived. What weighs on your soul today?`;
    }
    messagesDiv.appendChild(msg);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    speakToggle.classList.add('ready-to-speak');
    speakToggle.textContent = 'Speak';
  }

  royToggle.addEventListener('click', () => {
    if (isRecording) return;
    isModeSelected = true;
    isRantMode = false;
    royToggle.classList.add('active-roy');
    randyToggle.classList.remove('active-randy');
    clearMessagesAndShowGreeting('roy');
  });

  randyToggle.addEventListener('click', () => {
    if (isRecording) return;
    isModeSelected = true;
    isRantMode = true;
    randyToggle.classList.add('active-randy');
    royToggle.classList.remove('active-roy');
    clearMessagesAndShowGreeting('randy');
  });

  speakToggle.addEventListener('click', async () => {
    if (!isModeSelected) return;
    if (!isRecording) {
      await startRecording();
    } else {
      stopRecording();
    }
  });

  saveButton.addEventListener('click', () => {
    const messages = messagesDiv.innerHTML;
    const blob = new Blob([messages], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'chat-log.html';
    a.click();
    URL.revokeObjectURL(url);
  });

  // ⏺️ Audio logic continues below — keep as-is from prior working version...
});
