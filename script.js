// ✅ Roy Chatbot frontend logic with iOS fix, responsive buttons, and audio playback

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

  function resetButtons() {
    royToggle.style.background = 'cyan';
    royToggle.style.color = 'black';
    randyToggle.style.background = 'cyan';
    randyToggle.style.color = 'black';
  }

  function clearMessagesAndShowGreeting(mode) {
    messagesDiv.innerHTML = '';
    const msg = document.createElement('p');
    msg.className = 'roy';
    resetButtons();
    if (mode === 'randy') {
      msg.classList.add('randy');
      msg.innerHTML = `<em>Randy:</em> Unleash the chaos—what’s burning you up?`;
      randyToggle.style.background = 'orange';
      randyToggle.style.color = 'black';
    } else {
      msg.innerHTML = `<em>Roy:</em> Greetings, my friend—like a weary traveler, you’ve arrived. What weighs on your soul today?`;
      royToggle.style.background = 'lime';
      royToggle.style.color = 'black';
    }
    messagesDiv.appendChild(msg);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    speakToggle.classList.add('ready-to-speak');
    speakToggle.style.background = 'black';
    speakToggle.style.color = 'red';
    speakToggle.style.borderColor = 'red';
    speakToggle.style.animation = 'blinker 1s linear infinite';
    speakToggle.textContent = 'Speak';
  }

  royToggle.addEventListener('click', () => {
    if (isRecording) return;
    isModeSelected = true;
    isRantMode = false;
    clearMessagesAndShowGreeting('roy');
  });

  randyToggle.addEventListener('click', () => {
    if (isRecording) return;
    isModeSelected = true;
    isRantMode = true;
    clearMessagesAndShowGreeting('randy');
  });

  speakToggle.addEventListener('click', async () => {
    if (!isModeSelected) return;
    if (!isRecording) {
      speakToggle.textContent = 'Stop';
      speakToggle.style.background = 'red';
      speakToggle.style.color = 'black';
      speakToggle.style.borderColor = 'red';
      speakToggle.style.animation = 'none';
      await startRecording();
    } else {
      stopRecording();
      speakToggle.textContent = 'Speak';
      speakToggle.style.background = 'black';
      speakToggle.style.color = 'red';
      speakToggle.style.borderColor = 'red';
      speakToggle.style.animation = 'blinker 1s linear infinite';
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

  function visualizeAudio(audioElement, canvas, ctx, color) {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = audioCtx.createAnalyser();
    const source = audioCtx.createMediaElementSource(audioElement);
    source.connect(analyser);
    analyser.connect(audioCtx.destination);
    analyser.fftSize = 2048;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    function draw() {
      analyser.getByteFrequencyData(dataArray);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.beginPath();
      for (let i = 0; i < dataArray.length; i++) {
        const value = dataArray[i];
        ctx.lineTo(i * (canvas.width / dataArray.length), canvas.height - value);
      }
      ctx.strokeStyle = color;
      ctx.stroke();
      requestAnimationFrame(draw);
    }

    draw();
  }

  function playRoyAudio(base64) {
    const audio = new Audio(`data:audio/mp3;base64,${base64}`);
    audio.setAttribute('playsinline', '');
    audio.setAttribute('autoplay', '');
    audio.load();
    audio.onloadeddata = () => {
      audio.play().then(() => {
        visualizeAudio(audio, royWaveform, royCtx, 'yellow');
      }).catch(() => {
        const resume = () => {
          audio.play().then(() => visualizeAudio(audio, royWaveform, royCtx, 'yellow'));
          document.body.removeEventListener('click', resume);
          document.body.removeEventListener('touchstart', resume);
        };
        document.body.addEventListener('click', resume, { once: true });
        document.body.addEventListener('touchstart', resume, { once: true });
      });
    };
  }
});
