window.addEventListener('DOMContentLoaded', () => {
  let audioContext = null;
  function initializeAudioContext() {
    if (!audioContext) {
      try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        console.error('AudioContext error:', e);
        appendMessage('Roy', 'Audio system failed.');
        return false;
      }
    }
    if (audioContext.state === 'suspended') {
      audioContext.resume().catch(err => {
        console.error('AudioContext resume error:', err);
        appendMessage('Roy', 'Audio system blocked. Tap to enable.');
      });
    }
    return true;
  }

  document.body.addEventListener('touchstart', initializeAudioContext, { once: true });

  const royAudio = new Audio();
  royAudio.id = 'roy-audio';
  royAudio.setAttribute('playsinline', 'true');
  document.body.appendChild(royAudio);

  const micBtn = document.getElementById('mic-toggle');
  const sendBtn = document.getElementById('send-button');
  const inputEl = document.getElementById('user-input');
  const messagesEl = document.getElementById('messages');
  const modeSelect = document.getElementById('responseMode');
  const userCanvas = document.getElementById('userWaveform');
  const royCanvas = document.getElementById('royWaveform');
  const userCtx = userCanvas.getContext('2d');
  const royCtx = royCanvas.getContext('2d');

  let stream = null;
  let mediaRecorder = null;
  let recordedChunks = [];
  let analyser = null;
  let isRecording = false;

  appendMessage('Roy', "Welcome. I'm Roy. Speak when ready.");
  updateClock();
  setInterval(updateClock, 1000);

  function updateClock() {
    const now = new Date();
    const dateSpan = document.getElementById('current-date');
    const timeSpan = document.getElementById('current-time');
    if (!dateSpan || !timeSpan) return;
    dateSpan.textContent = now.toISOString().split('T')[0];
    timeSpan.textContent = now.toTimeString().split(' ')[0];
  }

  micBtn.addEventListener('click', () => {
    isRecording ? stopRecording() : startRecording();
  });

  async function startRecording() {
    try {
      audioContext = initializeAudioContext();
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordedChunks = [];
      const mimeType = 'audio/webm;codecs=opus';
      mediaRecorder = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported(mimeType) ? mimeType : undefined });

      mediaRecorder.ondataavailable = e => recordedChunks.push(e.data);
      mediaRecorder.onstop = async () => {
        const thinkingEl = document.createElement('p');
        thinkingEl.className = 'roy';
        thinkingEl.innerHTML = '<em>Roy is reflecting...</em>';
        messagesEl.appendChild(thinkingEl);

        const blob = new Blob(recordedChunks, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('audio', blob);

        try {
          const res = await fetch('https://roy-chatbo-backend.onrender.com/api/transcribe', { method: 'POST', body: formData });
          const data = await res.json();
          thinkingEl.remove();
          if (data.text) {
            appendMessage('You', data.text);
            fetchRoyResponse(data.text);
          } else {
            appendMessage('Roy', 'I didn’t catch that. Try again.');
          }
        } catch (err) {
          thinkingEl.remove();
          appendMessage('Roy', 'Error processing audio.');
          console.error('Transcription error:', err);
        }
      };

      mediaRecorder.start();
      isRecording = true;
      micBtn.textContent = 'Stop';
      micBtn.classList.add('recording');

      const source = audioContext.createMediaStreamSource(stream);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      drawWaveform(userCtx, userCanvas, analyser, 'yellow');
    } catch (err) {
      appendMessage('Roy', 'Microphone access denied. Allow in Settings > Safari > Microphone.');
      console.error('Recording error:', err);
    }
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }
    micBtn.textContent = 'Speak';
    micBtn.classList.remove('recording');
    isRecording = false;
    initializeAudioContext();
  }

  function appendMessage(sender, text) {
    const p = document.createElement('p');
    p.className = sender.toLowerCase();
    const color = sender === 'Roy' ? 'yellow' : 'white';
    p.innerHTML = `<strong style='color: ${color}'>${sender}:</strong> <span style='color: ${color}'>${text}</span>`;
    messagesEl.appendChild(p);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  async function fetchRoyResponse(message) {
    const thinking = document.createElement('p');
    thinking.className = 'roy';
    thinking.innerHTML = '<em>Roy is reflecting...</em>';
    messagesEl.appendChild(thinking);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    try {
      const res = await fetch('https://roy-chatbo-backend.onrender.com/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, mode: modeSelect.value })
      });
      const data = await res.json();
      thinking.remove();
      if (!data.text) {
        throw new Error('No text response from backend');
      }
      appendMessage('Roy', data.text);

      if ((modeSelect.value === 'voice' || modeSelect.value === 'both') && data.audio) {
        if (!initializeAudioContext()) {
          appendMessage('Roy', 'Audio system unavailable.');
          return;
        }
        try {
          royAudio.pause();
          royAudio.currentTime = 0;
          royAudio.src = `data:audio/mp3;base64,${data.audio}`;
          royAudio.volume = 1.0;
          console.log('Attempting to play Roy audio...');
          await royAudio.play();
          console.log('Roy audio playing successfully');
          drawWaveformRoy(royAudio);
        } catch (err) {
          console.error('Audio playback error:', err);
          appendMessage('Roy', 'Unable to play audio response.');
        }
      } else if (modeSelect.value === 'voice' || modeSelect.value === 'both') {
        console.warn('No audio data received from backend');
        appendMessage('Roy', 'Audio response missing.');
      }
    } catch (err) {
      thinking.remove();
      appendMessage('Roy', 'Roy was silent. Try again.');
      console.error('Fetch error:', err);
    }
  }

  function drawWaveform(ctx, canvas, analyser, color) {
    const buffer = new Uint8Array(analyser.frequencyBinCount);
    function draw() {
      if (!isRecording) return;
      requestAnimationFrame(draw);
      analyser.getByteTime
