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
let silenceTimeout;

// Update date and time display
function updateDateTime() {
  const now = new Date();
  currentDate.textContent = now.toLocaleDateString();
  currentTime.textContent = now.toLocaleTimeString();
  if (sessionStartTime) {
    const elapsed = Math.floor((now - sessionStartTime) / 1000);
    const maxTime = isRantMode ? 1800 : 3600; // 30 min for Randy, 60 min for Roy
    const remaining = maxTime - elapsed;
    if (remaining <= 0) {
      stopRecording();
      countdownTimer.textContent = `Session: ${maxTime / 60}:00`;
    } else {
      const minutes = Math.floor(remaining / 60);
      const seconds = remaining % 60;
      countdownTimer.textContent = `Session: ${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    }
  }
}
setInterval(updateDateTime, 1000);

// Clear messages and show greeting for Roy or Randy
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
}

// Select Roy mode
royToggle.addEventListener('click', () => {
  if (isRecording) return;
  isModeSelected = true;
  isRantMode = false;
  royToggle.classList.add('active-roy');
  randyToggle.classList.remove('active-randy');
  speakToggle.textContent = 'Speak';
  clearMessagesAndShowGreeting('roy');
});

// Select Randy mode
randyToggle.addEventListener('click', () => {
  if (isRecording) return;
  isModeSelected = true;
  isRantMode = true;
  randyToggle.classList.add('active-randy');
  royToggle.classList.remove('active-roy');
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
  chunks = [];
  volumeData = [];

  // Show recording icon in browser tab
  let link = document.querySelector("link[rel*='icon']") || document.createElement('link');
  link.type = 'image/x-icon';
  link.rel = 'shortcut icon';
  link.href = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="red"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm5.5 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.47 6 6.93V21h2v-2.07c3.39-.46 6-3.4 6-6.93h-1.5z"/></svg>';
  document.getElementsByTagName('head')[0].appendChild(link);

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioContext.createAnalyser();
  source = audioContext.createMediaStreamSource(stream);
  source.connect(analyser);
  analyser.fftSize = 2048;
  dataArray = new Uint8Array(analyser.frequencyBinCount);

  mediaRecorder = new MediaRecorder(stream);
  mediaRecorder.start(1000);

  // Check for silence in Randy mode
  if (isRantMode) {
    const checkSilence = () => {
      analyser.getByteFrequencyData(dataArray);
      const avgVolume = dataArray.reduce((sum, val) => sum + val, 0) / dataArray.length;
      if (avgVolume < 10 && isRecording) { // Silence threshold
        const msg = document.createElement('p');
        msg.className = 'roy randy';
        msg.innerHTML = `<em>Randy:</em> I’m here—don’t hold back! Let the storm rage on!`;
        messagesDiv.appendChild(msg);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
      }
      if (isRecording) {
        silenceTimeout = setTimeout(checkSilence, 5000);
      }
    };
    silenceTimeout = setTimeout(checkSilence, 5000);
  }

  mediaRecorder.ondataavailable = async (e) => {
    chunks.push(e.data);
    analyser.getByteFrequencyData(dataArray);
    const avgVolume = dataArray.reduce((sum, val) => sum + val, 0) / dataArray.length;
    volumeData.push(avgVolume);
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
      console.error('Transcription fetch error:', err);
      const msg = document.createElement('p');
      msg.className = 'roy';
      if (isRantMode) msg.classList.add('randy');
      msg.innerHTML = `<em>${isRantMode ? 'Randy' : 'Roy'}:</em> Hmm, I’m having trouble hearing you—check the backend connection and try again.`;
      messagesDiv.appendChild(msg);
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
      return;
    }

    const { text } = await transcribeRes.json();
    const userMsg = document.createElement('p');
    userMsg.className = 'user';
    userMsg.textContent = `You: ${text}`;
    messagesDiv.appendChild(userMsg);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

    const thinkingMsg = document.createElement('p');
    thinkingMsg.className = 'roy';
    if (isRantMode) thinkingMsg.classList.add('randy');
    thinkingMsg.innerHTML = `<em>${isRantMode ? 'Randy' : 'Roy'}:</em> Thinking <span class="dots"></span>`;
    messagesDiv.appendChild(thinkingMsg);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

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
      console.error('Chat fetch error:', err);
      thinkingMsg.remove();
      const msg = document.createElement('p');
      msg.className = 'roy';
      if (isRantMode) msg.classList.add('randy');
      msg.innerHTML = `<em>${isRantMode ? 'Randy' : 'Roy'}:</em> I couldn’t connect—please check the backend and try again.`;
      messagesDiv.appendChild(msg);
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
      return;
    }

    const { text: royText, audio: audioBase64 } = await chatRes.json();
    thinkingMsg.remove();
    const msg = document.createElement('p');
    msg.className = 'roy';
    if (isRantMode) msg.classList.add('randy');
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
  if (silenceTimeout) clearTimeout(silenceTimeout);

  let link = document.querySelector("link[rel*='icon']") || document.createElement('link');
  link.type = 'image/x-icon';
  link.rel = 'shortcut icon';
  link.href = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="gray"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm5.5 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.47 6 6.93V21h2v-2.07c3.39-.46 6-3.4 6-6.93h-1.5z"/></svg>';
  document.getElementsByTagName('head')[0].appendChild(link);
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

// Save log button
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

// Visualize waveform
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
