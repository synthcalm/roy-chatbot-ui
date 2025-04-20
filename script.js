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

const BACKEND_URL = 'https://roy-chatbot-backend.onrender.com';

let audioContext, analyser, dataArray, source, mediaRecorder, chunks = [];
let isRecording = false;
let isRantMode = false;
let isModeSelected = false;
let volumeData = [];
let sessionStartTime;

// Update date and time
function updateDateTime() {
  const now = new Date();
  currentDate.textContent = now.toLocaleDateString();
  currentTime.textContent = now.toLocaleTimeString();
  if (sessionStartTime) {
    const elapsed = Math.floor((now - sessionStartTime) / 1000);
    const remaining = 3600 - elapsed; // 60 minutes = 3600 seconds
    if (remaining <= 0) {
      stopRecording();
      countdownTimer.textContent = 'Session: 60:00';
    } else {
      const minutes = Math.floor(remaining / 60);
      const seconds = remaining % 60;
      countdownTimer.textContent = `Session: ${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    }
  }
}
setInterval(updateDateTime, 1000);

// Clear messages and show greeting
function clearMessagesAndShowGreeting(mode) {
  messagesDiv.innerHTML = '';
  const msg = document.createElement('p');
  msg.className = 'roy';
  if (mode === 'roy') {
    msg.innerHTML = `<em>Roy:</em> Greetings, my friend—like a weary traveler, you’ve arrived. What weighs on your soul today?`;
  } else {
    msg.innerHTML = `<em>Randy:</em> Unleash the chaos—what’s burning you up?`;
  }
  messagesDiv.appendChild(msg);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Select Roy mode
royToggle.addEventListener('click', () => {
  if (isRecording) return; // Prevent mode change while recording
  isModeSelected = true;
  isRantMode = false;
  royToggle.classList.add('active-roy');
  randyToggle.classList.remove('active-randy');
  speakToggle.classList.add('ready-to-speak');
  speakToggle.textContent = 'Speak';
  clearMessagesAndShowGreeting('roy');
});

// Select Randy mode
randyToggle.addEventListener('click', () => {
  if (isRecording) return; // Prevent mode change while recording
  isModeSelected = true;
  isRantMode = true;
  randyToggle.classList.add('active-randy');
  royToggle.classList.remove('active-roy');
  speakToggle.classList.add('ready-to-speak');
  speakToggle.textContent = 'Speak';
  clearMessagesAndShowGreeting('randy');
});

// Start recording
async function startRecording() {
  if (!isModeSelected) return;

  isRecording = true;
  speakToggle.textContent = 'Stop';
  speakToggle.classList.remove('ready-to-speak');
  speakToggle.classList.add('recording');
  sessionStartTime = new Date();

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioContext.createAnalyser();
  source = audioContext.createMediaStreamSource(stream);
  source.connect(analyser);
  analyser.fftSize = 2048;
  dataArray = new Uint8Array(analyser.frequencyBinCount);

  mediaRecorder = new MediaRecorder(stream);
  mediaRecorder.start(1000);
  chunks = [];
  volumeData = [];

  mediaRecorder.ondataavailable = async (e) => {
    chunks.push(e.data);
    analyser.getByteFrequencyData(dataArray);
    const avgVolume = dataArray.reduce((sum, val) => sum + val, 0) / dataArray.length;
    volumeData.push(avgVolume);

    const formData = new FormData();
    formData.append('audio', e.data, 'audio.webm');
    let transcribeRes;
    try {
      transcribeRes = await fetch(`${BACKEND_URL}/api/transcribe`, {
        method: 'POST',
        body: formData
      });
      if (!transcribeRes.ok) throw new Error(`HTTP error! status: ${transcribeRes.status}`);
    } catch (err) {
      console.error('Transcription fetch error:', err);
      const msg = document.createElement('p');
      msg.className = 'roy';
      msg.innerHTML = `<em>${isRantMode ? 'Randy' : 'Roy'}:</em> Hmm, I’m having trouble hearing you—check the backend connection and try again.`;
      messagesDiv.appendChild(msg);
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
      return;
    }

    let transcription;
    try {
      transcription = await transcribeRes.json();
    } catch (err) {
      console.error('Transcription JSON parse error:', err);
      return;
    }

    const chatPayload = {
      message: transcription.text || '',
      mode: 'both',
      persona: isRantMode ? 'randy' : 'default',
      volumeData: volumeData.slice(-5)
    };
    let chatRes;
    try {
      chatRes = await fetch(`${BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chatPayload)
      });
      if (!chatRes.ok) throw new Error(`HTTP error! status: ${chatRes.status}`);
    } catch (err) {
      console.error('Chat fetch error:', err);
      return;
    }

    const { text: royText, audio: audioBase64 } = await chatRes.json();
    const msg = document.createElement('p');
    msg.className = 'roy';
    msg.innerHTML = `<em>${isRantMode ? 'Randy' : 'Roy'}:</em> ${royText}`;
    messagesDiv.appendChild(msg);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

    if (audioBase64) {
      const audio = new Audio(`data:audio/mp3;base64,${audioBase64}`);
      audio.play();
      visualizeAudio(audio, royWaveform, royCtx, 'yellow');
    }
  };

  mediaRecorder.onstop = async () => {
    const blob = new Blob(chunks, { type: 'audio/webm' });
    const formData = new FormData();
    formData.append('audio', blob, 'audio.webm');

    let transcribeRes;
    try {
      transcribeRes = await fetch(`${BACKEND_URL}/api/transcribe`, {
        method: 'POST',
        body: formData
      });
      if (!transcribeRes.ok) throw new Error(`HTTP error! status: ${transcribeRes.status}`);
    } catch (err) {
      console.error('Final transcription fetch error:', err);
      return;
    }

    const { text } = await transcribeRes.json();
    const chatPayload = {
      message: text,
      mode: 'both',
      persona: isRantMode ? 'randy' : 'default',
      volumeData
    };
    let chatRes;
    try {
      chatRes = await fetch(`${BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chatPayload)
      });
      if (!chatRes.ok) throw new Error(`HTTP error! status: ${chatRes.status}`);
    } catch (err) {
      console.error('Final chat fetch error:', err);
      return;
    }

    const { text: royText, audio: audioBase64 } = await chatRes.json();
    const msg = document.createElement('p');
    msg.className = 'roy';
    msg.innerHTML = `<em>${isRantMode ? 'Randy' : 'Roy'}:</em> ${royText}`;
    messagesDiv.appendChild(msg);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

    if (audioBase64) {
      const audio = new Audio(`data:audio/mp3;base64,${audioBase64}`);
      audio.play();
      visualizeAudio(audio, royWaveform, royCtx, 'yellow');
    }
  };

  userWaveform.classList.toggle('rant-mode', isRantMode);
  visualizeAudio(null, userWaveform, userCtx, isRantMode ? 'red' : 'cyan', analyser, dataArray);
}

// Stop recording
function stopRecording() {
  isRecording = false;
  speakToggle.textContent = 'Speak';
  speakToggle.classList.remove('recording');
  speakToggle.classList.add('ready-to-speak');
  mediaRecorder.stop();
  source.disconnect();
  audioContext.close();
}

// Speak button toggle
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

function visualizeAudio(audioElement, canvas, ctx, color, externalAnalyser, externalDataArray) {
  let audioCtx, analyser, dataArray, source;
  if (audioElement) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    source = audioCtx.createMediaElementSource(audioElement);
    source.connect(analyser);
    analyser.connect(audioCtx.destination);
    analyser.fftSize = 2048;
    dataArray = new Uint8Array(analyser.frequencyBinCount);
  } else {
    analyser = externalAnalyser;
    dataArray = externalDataArray;
  }

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
    if (isRecording || audioElement) {
      requestAnimationFrame(draw);
    }
  }
  draw();
}
