const micToggle = document.getElementById('mic-toggle');
const saveButton = document.getElementById('saveButton');
const userWaveform = document.getElementById('userWaveform');
const royWaveform = document.getElementById('royWaveform');
const messagesDiv = document.getElementById('messages');
const userCtx = userWaveform.getContext('2d');
const royCtx = royWaveform.getContext('2d');
const currentDate = document.getElementById('current-date');
const currentTime = document.getElementById('current-time');
const countdownTimer = document.getElementById('countdown-timer');

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

// Toggle recording and Rant Mode
micToggle.addEventListener('click', async () => {
  if (!isRecording) {
    isRecording = true;
    isRantMode = !isRantMode;
    micToggle.textContent = `Stop (Rant Mode: ${isRantMode ? 'On' : 'Off'})`;
    micToggle.classList.add('recording');
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
      const transcribeRes = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData
      });
      const { text } = await transcribeRes.json();

      // Send to chat for interim response
      const chatRes = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          mode: 'both',
          persona: isRantMode ? 'randy' : 'default',
          volumeData: volumeData.slice(-5) // Last 5 seconds
        })
      });
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

      const transcribeRes = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData
      });
      const { text } = await transcribeRes.json();

      const chatRes = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          mode: 'both',
          persona: isRantMode ? 'randy' : 'default',
          volumeData
        })
      });
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
    visualizeAudio(null, userWaveform, userCtx, isRantMode ? 'red' : 'cyan');
  } else {
    isRecording = false;
    micToggle.textContent = `Speak (Rant Mode: ${isRantMode ? 'On' : 'Off'})`;
    micToggle.classList.remove('recording');
    mediaRecorder.stop();
    source.disconnect();
    audioContext.close();
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
  let audioCtx, analyser, dataArray, source;
  if (audioElement) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    source = audioCtx.createMediaElementSource(audioElement);
    source.connect(analyser);
    analyser.connect(audioCtx.destination);
  } else {
    audioCtx = audioContext;
    analyser = this.analyser;
    dataArray = this.dataArray;
  }
  analyser.fftSize = 2048;
  dataArray = dataArray || new Uint8Array(analyser.frequencyBinCount);

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
