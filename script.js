const royToggle = document.getElementById('roy-toggle');
const randyToggle = document.getElementById('randy-toggle');
const saveButton = document.getElementById('saveButton');
const userWaveform = document.getElementById('userWaveform');
const royWaveform = document.getElementById('royWaveform');
const messagesDiv = document.getElementById('messages');
const userCtx = userWaveform.getContext('2d');
const royCtx = royWaveform.getContext('2d');
const currentDate = document.getElementById('current-date');
const currentTime = document.getElementById('current-time');
const countdownTimer = document.getElementById('countdown-timer');

// Replace this with your actual deployed backend URL (e.g., Render URL)
const BACKEND_URL = 'https://synthcalm-a2n7.onrender.com';

let audioContext, analyser, dataArray, source, mediaRecorder, chunks = [];
let isRecording = false;
let isRantMode = false;
let volumeData = [];
let sessionStartTime;

// Update date and time
function updateDateTime() {
  const now = new Date();
  currentDate.textContent = now.toLocaleDateString();
  currentTime.textContent = now.toLocaleTimeString();
  if (sessionStartTime) {
    const elapsed = Math.floor((now - sessionStartTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    countdownTimer.textContent = `Session: ${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  }
}
setInterval(updateDateTime, 1000);

// Start recording (shared logic for both Roy and Randy)
async function startRecording(mode) {
  isRecording = true;
  isRantMode = mode === 'randy';
  royToggle.textContent = 'Roy';
  randyToggle.textContent = 'Randy';
  if (mode === 'roy') {
    royToggle.textContent = 'Stop';
    royToggle.classList.add('recording');
    randyToggle.classList.remove('recording');
  } else {
    randyToggle.textContent = 'Stop';
    randyToggle.classList.add('recording');
    royToggle.classList.remove('recording');
  }
  sessionStartTime = new Date();

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioContext.createAnalyser();
  source = audioContext.createMediaStreamSource(stream);
  source.connect(analyser);
  analyser.fftSize = 2048;
  dataArray = new Uint8Array(analyser.frequencyBinCount);

  mediaRecorder = new MediaRecorder(stream);
  mediaRecorder.start(1000); // Send chunks every second for real-time analysis
  chunks = [];
  volumeData = [];

  mediaRecorder.ondataavailable = async (e) => {
    chunks.push(e.data);
    // Simplified volume analysis
    analyser.getByteFrequencyData(dataArray);
    const avgVolume = dataArray.reduce((sum, val) => sum + val, 0) / dataArray.length;
    volumeData.push(avgVolume);

    // Transcribe chunk
    const formData = new FormData();
    formData.append('audio', e.data, 'audio.webm');
    let transcribeRes;
    try {
      transcribeRes = await fetch(`${BACKEND_URL}/api/transcribe`, {
        method: 'POST',
        body: formData
      });
      if (!transcribeRes.ok) {
        throw new Error(`HTTP error! status: ${transcribeRes.status}`);
      }
    } catch (err) {
      console.error('Transcription fetch error:', err);
      const msg = document.createElement('p');
      msg.className = 'roy';
      msg.innerHTML = `<em>${isRantMode ? 'Randy' : 'Roy'}:</em> Hmm, I’m having trouble hearing you—let’s try again.`;
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

    // Send to chat for interim response
    let chatRes;
    try {
      chatRes = await fetch(`${BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: transcription.text || '',
          mode: 'both',
          persona: isRantMode ? 'randy' : 'default',
          volumeData: volumeData.slice(-5) // Last 5 seconds
        })
      });
      if (!chatRes.ok) {
        throw new Error(`HTTP error! status: ${chatRes.status}`);
      }
    } catch (err) {
      console.error('Chat fetch error:', err);
      return;
    }

    const { text: royText, audio: audioBase64 } = await chatRes.json();

    // Display interim response
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
      if (!transcribeRes.ok) {
        throw new Error(`HTTP error! status: ${transcribeRes.status}`);
      }
    } catch (err) {
      console.error('Final transcription fetch error:', err);
      return;
    }

    const { text } = await transcribeRes.json();

    let chatRes;
    try {
      chatRes = await fetch(`${BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          mode: 'both',
          persona: isRantMode ? 'randy' : 'default',
          volumeData
        })
      });
      if (!chatRes.ok) {
        throw new Error(`HTTP error! status: ${chatRes.status}`);
      }
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

// Stop recording (shared logic)
function stopRecording() {
  isRecording = false;
  royToggle.textContent = 'Roy';
  randyToggle.textContent = 'Randy';
  royToggle.classList.remove('recording');
  randyToggle.classList.remove('recording');
  mediaRecorder.stop();
  source.disconnect();
  audioContext.close();
}

// Roy button toggle
royToggle.addEventListener('click', async () => {
  if (!isRecording) {
    await startRecording('roy');
  } else {
    stopRecording();
  }
});

// Randy button toggle
randyToggle.addEventListener('click', async () => {
  if (!isRecording) {
    await startRecording('randy');
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
