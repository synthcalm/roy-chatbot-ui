/* Updated script.js – Fixed audio cutoff and added robust error handling */

window.addEventListener('DOMContentLoaded', () => {
  const micBtn = document.getElementById('mic-toggle');
  const sendBtn = document.getElementById('send-button');
  const saveBtn = document.getElementById('save-log');
  const inputEl = document.getElementById('user-input');
  const messagesEl = document.getElementById('messages');
  const audioEl = document.getElementById('roy-audio');
  const modeSelect = document.getElementById('responseMode');
  const dateSpan = document.getElementById('current-date');
  const timeSpan = document.getElementById('current-time');
  const timerSpan = document.getElementById('countdown-timer');

  const sessionId = `session-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const greetings = ["Welcome. I'm Roy. Speak when ready — your thoughts hold weight."];

  let isRecording = false;
  let recognition, userAudioContext, userAnalyser, userDataArray, stream;
  let royAudioContext = null; // Initialize globally to reuse
  let royAnalyser = null;
  let royDataArray = null;
  let roySource = null;
  let sessionStart = Date.now();
  let finalTranscript = '';

  const userCanvas = document.getElementById('userWaveform');
  const userCtx = userCanvas.getContext('2d');
  const royCanvas = document.getElementById('royWaveform');
  const royCtx = royCanvas.getContext('2d');

  appendMessage('Roy', greetings[0]);
  updateClockAndTimer();
  setInterval(updateClockAndTimer, 1000);

  function updateClockAndTimer() {
    const now = new Date();
    const elapsed = Math.floor((Date.now() - sessionStart) / 1000);
    const remaining = Math.max(0, 3600 - elapsed);
    dateSpan.textContent = now.toISOString().split('T')[0];
    timeSpan.textContent = now.toTimeString().split(' ')[0];
    timerSpan.textContent = `Session Ends In: ${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
  }

  function appendMessage(sender, text) {
    const p = document.createElement('p');
    p.classList.add(sender.toLowerCase());
    p.innerHTML = `<strong>${sender}:</strong> `;
    messagesEl.appendChild(p);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    if (sender === 'Roy') {
      let i = 0;
      const typeInterval = setInterval(() => {
        if (i < text.length) {
          p.innerHTML += text.charAt(i++);
          messagesEl.scrollTop = messagesEl.scrollHeight;
        } else {
          clearInterval(typeInterval);
        }
      }, 12);
    } else {
      p.innerHTML += `<span style="color: yellow">${text}</span>`;
    }
  }

  async function fetchRoyResponse(message) {
    appendMessage('You', message);
    inputEl.value = '';
    const thinking = document.createElement('p');
    thinking.textContent = 'Roy is thinking...';
    thinking.className = 'roy';
    messagesEl.appendChild(thinking);

    try {
      const res = await fetch('https://roy-chatbo-backend.onrender.com/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          sessionId,
          tone: `You are Roy Batty, a therapeutic counselor whose voice burns with poetic defiance. You speak not in clichés, but in vivid metaphor and emotional precision. Avoid repetition and weak phrasing. Your speech is electric with imagery — grounded in humanity, forged from pain. You do not mention Blade Runner or artificial life. Speak as if every word might be your last.`
        })
      });

      if (!res.ok) {
        throw new Error(`HTTP error! Status: ${res.status}`);
      }

      const data = await res.json();
      thinking.remove();

      // Always append text response
      appendMessage('Roy', data.text);

      // Handle audio if mode is not text and audio data exists
      if (modeSelect.value !== 'text' && data.audio) {
        // Clean up previous audio nodes
        if (roySource) {
          roySource.disconnect();
          roySource = null;
        }
        if (royAnalyser) {
          royAnalyser.disconnect();
          royAnalyser = null;
        }
        // Reset audio element
        audioEl.pause();
        audioEl.currentTime = 0;
        audioEl.src = '';

        // Initialize or reuse AudioContext
        if (!royAudioContext || royAudioContext.state === 'closed') {
          royAudioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        try {
          audioEl.src = `data:audio/mp3;base64,${data.audio}`;
          roySource = royAudioContext.createMediaElementSource(audioEl);
          const gainNode = royAudioContext.createGain();
          gainNode.gain.value = 2.0;
          royAnalyser = royAudioContext.createAnalyser();
          royAnalyser.fftSize = 2048;
          royDataArray = new Uint8Array(royAnalyser.frequencyBinCount);
          roySource.connect(gainNode);
          gainNode.connect(royAnalyser);
          royAnalyser.connect(royAudioContext.destination);
          drawRoyWaveform();
          await audioEl.play();
        } catch (audioError) {
          console.error('Audio playback error:', audioError);
          appendMessage('Roy', 'My voice falters in song, but my words endure.');
        }
      }
    } catch (error) {
      thinking.remove();
      appendMessage('Roy', 'A storm clouds my voice. Please speak again.');
      console.error('Fetch error:', error.message);
    }
  }

  async function startRecording() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      userAudioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = userAudioContext.createMediaStreamSource(stream);
      userAnalyser = userAudioContext.createAnalyser();
      source.connect(userAnalyser);
      userAnalyser.fftSize = 2048;
      userDataArray = new Uint8Array(userAnalyser.frequencyBinCount);
      drawUserWaveform();

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.interimResults = true;
      recognition.continuous = false;

      finalTranscript = '';

      recognition.onresult = (event) => {
        finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          finalTranscript += event.results[i][0].transcript;
        }
      };

      recognition.onend = () => {
        if (stream) {
          stream.getTracks().forEach(t => t.stop());
          stream = null;
        }
        if (userAudioContext) {
          userAudioContext.close();
          userAudioContext = null;
        }
        if (finalTranscript.trim()) {
          fetchRoyResponse(finalTranscript.trim());
        }
      };

      recognition.start();
    } catch (error) {
      console.error('Recording error:', error);
      appendMessage('Roy', 'The winds steal my ears. Try speaking again.');
      micBtn.textContent = 'Speak';
      micBtn.classList.remove('active');
      isRecording = false;
    }
  }

  function drawUserWaveform() {
    if (!userAnalyser) return;
    requestAnimationFrame(drawUserWaveform);
    userAnalyser.getByteTimeDomainData(userDataArray);
    userCtx.fillStyle = '#000';
    userCtx.fillRect(0, 0, userCanvas.width, userCanvas.height);
    drawGrid(userCtx, userCanvas.width, userCanvas.height, 'rgba(0,255,255,0.2)');
    userCtx.strokeStyle = 'yellow';
    userCtx.lineWidth = 1.5;
    userCtx.beginPath();
    const sliceWidth = userCanvas.width / userDataArray.length;
    let x = 0;
    for (let i = 0; i < userDataArray.length; i++) {
      const y = (userDataArray[i] / 128.0) * userCanvas.height / 2;
      i === 0 ? userCtx.moveTo(x, y) : userCtx.lineTo(x, y);
      x += sliceWidth;
    }
    userCtx.lineTo(userCanvas.width, userCanvas.height / 2);
    userCtx.stroke();
  }

  function drawRoyWaveform() {
    if (!royAnalyser) return;
    requestAnimationFrame(drawRoyWaveform);
    royAnalyser.getByteTimeDomainData(royDataArray);
    royCtx.fillStyle = '#000';
    royCtx.fillRect(0, 0, royCanvas.width, royCanvas.height);
    drawGrid(royCtx, royCanvas.width, royCanvas.height, 'rgba(0,255,255,0.2)');
    royCtx.strokeStyle = 'magenta';
    royCtx.lineWidth = 1.5;
    royCtx.beginPath();
    const sliceWidth = royCanvas.width / royDataArray.length;
    let x = 0;
    for (let i = 0; i < royDataArray.length; i++) {
      const y = (royDataArray[i] / 128.0) * royCanvas.height / 2;
      i === 0 ? royCtx.moveTo(x, y) : royCtx.lineTo(x, y);
      x += sliceWidth;
    }
    royCtx.lineTo(royCanvas.width, royCanvas.height / 2);
    royCtx.stroke();
  }

  function drawGrid(ctx, width, height, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.3;
    for (let x = 0; x < width; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }

  sendBtn.addEventListener('click', () => {
    const msg = inputEl.value.trim();
    if (msg) fetchRoyResponse(msg);
  });

  micBtn.addEventListener('click', () => {
    if (!isRecording) {
      micBtn.textContent = 'Stop';
      micBtn.classList.add('active');
      isRecording = true;
      startRecording();
    } else {
      micBtn.textContent = 'Speak';
      micBtn.classList.remove('active');
      isRecording = false;
      if (recognition) recognition.stop();
    }
  });

  saveBtn.addEventListener('click', () => {
    console.log('TODO: Save chat log to Supabase.');
  });
});
