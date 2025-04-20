// ✅ Updated Roy Chatbot frontend logic with reliable audio playback on all platforms

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

// 🔓 iOS and Safari interaction unlock
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

async function startRecording() {
  isRecording = true;
  speakToggle.textContent = 'STOP';
  speakToggle.classList.remove('ready-to-speak');
  speakToggle.classList.add('recording');
  sessionStartTime = new Date();
  chunks = [];
  volumeData = [];

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioContext.createAnalyser();
  source = audioContext.createMediaStreamSource(stream);
  source.connect(analyser);
  analyser.fftSize = 2048;
  dataArray = new Uint8Array(analyser.frequencyBinCount);

  const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
  mediaRecorder = new MediaRecorder(stream, { mimeType });
  mediaRecorder.start(1000);

  if (isRantMode) {
    const checkSilence = () => {
      analyser.getByteFrequencyData(dataArray);
      const avgVolume = dataArray.reduce((sum, val) => sum + val, 0) / dataArray.length;
      if (avgVolume < 10 && isRecording) {
        const msg = document.createElement('p');
        msg.className = 'roy randy';
        msg.innerHTML = `<em>Randy:</em> I’m here—don’t hold back! Let the storm rage on!`;
        messagesDiv.appendChild(msg);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
      }
      if (isRecording) silenceTimeout = setTimeout(checkSilence, 5000);
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
    const extension = mediaRecorder.mimeType.includes('webm') ? 'webm' : 'mp4';
    const blob = new Blob(chunks, { type: mediaRecorder.mimeType });
    const formData = new FormData();
    formData.append('audio', blob, `audio.${extension}`);

    const res = await fetch(`${BACKEND_URL}/api/transcribe`, {
      method: 'POST',
      body: formData
    });

    const { text } = await res.json();
    const userMsg = document.createElement('p');
    userMsg.className = 'user';
    userMsg.textContent = `You: ${text || '[could not transcribe audio]'}`;
    messagesDiv.appendChild(userMsg);

    const thinking = document.createElement('p');
    thinking.className = 'roy';
    if (isRantMode) thinking.classList.add('randy');
    thinking.innerHTML = `<em>${isRantMode ? 'Randy' : 'Roy'}:</em> Thinking <span class="dots"></span>`;
    messagesDiv.appendChild(thinking);

    const payload = {
      message: text,
      mode: 'both',
      persona: isRantMode ? 'randy' : 'default',
      volumeData
    };

    const replyRes = await fetch(`${BACKEND_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const { text: reply, audio: audioBase64 } = await replyRes.json();
    thinking.remove();

    const msg = document.createElement('p');
    msg.className = 'roy';
    if (isRantMode) msg.classList.add('randy');
    msg.innerHTML = `<em>${isRantMode ? 'Randy' : 'Roy'}:</em> ${reply}`;
    messagesDiv.appendChild(msg);

    if (audioBase64) {
      const audio = new Audio(`data:audio/mp3;base64,${audioBase64}`);
      audio.setAttribute('playsinline', '');
      audio.setAttribute('autoplay', '');
      audio.load();
      audio.onloadeddata = () => {
        audio.play().then(() => {
          visualizeAudio(audio, royWaveform, royCtx, 'yellow');
        }).catch(err => {
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
  };

  userWaveform.classList.toggle('rant-mode', isRantMode);
  visualizeAudio(null, userWaveform, userCtx, isRantMode ? 'red' : 'cyan', analyser, dataArray);
}

function stopRecording() {
  isRecording = false;
  speakToggle.textContent = 'Speak';
  speakToggle.classList.remove('recording');
  speakToggle.classList.add('ready-to-speak');
  mediaRecorder.stop();
  if (source) source.disconnect();
  if (audioContext && audioContext.state !== 'closed') audioContext.suspend();
  if (silenceTimeout) clearTimeout(silenceTimeout);
}

function visualizeAudio(audioElement, canvas, ctx, color, externalAnalyser, externalDataArray) {
  let analyser = externalAnalyser;
  let dataArray = externalDataArray;
  if (audioElement) {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    const source = audioCtx.createMediaElementSource(audioElement);
    source.connect(analyser);
    analyser.connect(audioCtx.destination);
    analyser.fftSize = 2048;
    dataArray = new Uint8Array(analyser.frequencyBinCount);
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
    if (isRecording || audioElement) requestAnimationFrame(draw);
  }
  draw();
}
