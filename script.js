// script.js – Updated Roy frontend with polished UX

window.addEventListener('DOMContentLoaded', async () => {
  const micBtn = document.getElementById('mic-toggle');
  const sendBtn = document.getElementById('send-button');
  const saveLogBtn = document.getElementById('save-log');
  const homeBtn = document.getElementById('home-btn');
  const inputEl = document.getElementById('user-input');
  const messagesEl = document.getElementById('messages');
  const modeSelect = document.getElementById('responseMode');
  const dateSpan = document.getElementById('current-date');
  const timeSpan = document.getElementById('current-time');
  const timerSpan = document.getElementById('countdown-timer');
  const userCanvas = document.getElementById('userWaveform');
  const royCanvas = document.getElementById('royWaveform');
  const userCtx = userCanvas.getContext('2d');
  const royCtx = royCanvas.getContext('2d');
  const audioEl = document.getElementById('roy-audio');
  const thinkingSound = document.getElementById('thinking-sound');

  let sessionStart = Date.now();
  let audioContext = null;
  let analyser = null;
  let dataArray = null;
  let stream = null;
  let isRecording = false;
  let socket = null;
  let liveTranscript = '';
  let transcriptEl = null;
  let lastWaveformUpdate = 0;
  let lastTranscriptUpdate = 0;
  const WAVEFORM_UPDATE_INTERVAL = 150;
  const TRANSCRIPT_UPDATE_INTERVAL = 200;

  updateClock();
  setInterval(updateClock, 1000);
  appendMessage('Roy', "Welcome. I'm Roy. Speak when ready — your thoughts hold weight.");

  function updateClock() {
    const now = new Date();
    dateSpan.textContent = now.toISOString().split('T')[0];
    timeSpan.textContent = now.toTimeString().split(' ')[0];
    const elapsed = Math.floor((Date.now() - sessionStart) / 1000);
    const remaining = Math.max(0, 3600 - elapsed);
    timerSpan.textContent = `Session Ends In: ${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
  }

  function appendMessage(sender, text, animate = false) {
    const p = document.createElement('p');
    p.classList.add(sender.toLowerCase());
    if (animate && sender === 'Roy') {
      p.innerHTML = `<strong>${sender}:</strong> <span class="typing-text"></span>`;
      const span = p.querySelector('.typing-text');
      let i = 0;
      const type = () => {
        if (i < text.length) {
          span.textContent += text[i];
          i++;
          setTimeout(type, 50);
        } else {
          span.classList.remove('typing-text');
        }
      };
      type();
    } else {
      p.innerHTML = `<strong>${sender}:</strong> ${text}`;
    }
    messagesEl.appendChild(p);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  async function startRecording() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      dataArray = new Uint8Array(analyser.frequencyBinCount);
      source.connect(analyser);
      drawWaveform('user');

      let attempts = 0;
      const maxAttempts = 3;
      while (attempts < maxAttempts) {
        try {
          socket = new WebSocket('wss://api.deepgram.com/v1/listen?encoding=linear16&sample_rate=16000&channels=1', [
            'token',
            'DEEPGRAM_API_KEY'
          ]);
          socket.binaryType = 'arraybuffer';
          break;
        } catch (err) {
          attempts++;
          if (attempts === maxAttempts) throw err;
          await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
        }
      }

      socket.onopen = () => {
        console.log('Deepgram WebSocket connection opened');
      };

      socket.onmessage = (msg) => {
        const data = JSON.parse(msg.data);
        if (data.channel && data.channel.alternatives && data.channel.alternatives[0].transcript) {
          liveTranscript = data.channel.alternatives[0].transcript;
          updateLiveTranscript();
        }
      };

      socket.onerror = (err) => {
        console.error('Deepgram WebSocket error:', err);
        appendMessage('Roy', 'A storm disrupted the transcription. Falling back to local recognition.');
        startLocalTranscription();
      };

      socket.onclose = () => {
        console.log('Deepgram WebSocket connection closed');
      };

      transcriptEl = document.createElement('p');
      transcriptEl.className = 'you live-transcript';
      transcriptEl.innerHTML = '<strong>You (speaking):</strong> <span style="color: yellow">...</span>';
      messagesEl.appendChild(transcriptEl);

      const worklet = `
        class PCMProcessor extends AudioWorkletProcessor {
          process(inputs) {
            const input = inputs[0][0];
            if (!input) return true;
            const int16 = new Int16Array(input.length);
            for (let i = 0; i < input.length; i++) {
              int16[i] = Math.max(-1, Math.min(1, input[i])) * 32767;
            }
            this.port.postMessage(int16.buffer);
            return true;
          }
        }
        registerProcessor('pcm-processor', PCMProcessor);
      `;

      await audioContext.audioWorklet.addModule('data:application/javascript;base64,' + btoa(worklet));
      const workletNode = new AudioWorkletNode(audioContext, 'pcm-processor');
      workletNode.port.onmessage = (e) => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(e.data);
        }
      };
      source.connect(workletNode).connect(audioContext.destination);

      isRecording = true;
      micBtn.textContent = 'Stop';
      micBtn.classList.add('recording');
    } catch (err) {
      console.error('Recording error:', err);
      appendMessage('Roy', 'Could not access your microphone.');
    }
  }

  function startLocalTranscription() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      appendMessage('Roy', 'Local transcription not supported in this browser.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(result => result[0].transcript)
        .join('');
      liveTranscript = transcript;
      updateLiveTranscript();
    };

    recognition.onerror = (err) => {
      console.error('Local transcription error:', err);
      appendMessage('Roy', 'Local transcription failed. Please try again.');
    };

    recognition.onend = () => {
      if (isRecording) recognition.start();
    };

    recognition.start();
  }

  function updateLiveTranscript() {
    const now = Date.now();
    if (now - lastTranscriptUpdate < TRANSCRIPT_UPDATE_INTERVAL) return;
    lastTranscriptUpdate = now;
    if (transcriptEl) {
      transcriptEl.querySelector('span').textContent = liveTranscript || '...';
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  }

  function stopRecording() {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.close();
    }
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }
    if (audioContext) {
      audioContext.close();
      audioContext = null;
      analyser = null;
    }

    if (liveTranscript.trim()) {
      appendMessage('You', liveTranscript);
      fetchRoyResponse(liveTranscript);
    } else {
      appendMessage('Roy', 'Your words didn’t make it through the static. Try again.');
    }

    if (transcriptEl) {
      transcriptEl.remove();
      transcriptEl = null;
    }
    liveTranscript = '';
    isRecording = false;
    micBtn.textContent = 'Speak';
    micBtn.classList.remove('recording');
  }

  async function fetchRoyResponse(message) {
    const thinkingEl = document.createElement('p');
    thinkingEl.className = 'roy typing';
    thinkingEl.textContent = 'Roy is reflecting...';
    messagesEl.appendChild(thinkingEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    thinkingSound.play();

    let attempts = 0;
    const maxAttempts = 3;
    while (attempts < maxAttempts) {
      try {
        const mode = modeSelect.value || 'both';
        const apiMode = mode === 'text' ? 'text' : 'audio';
        const res = await fetch(`https://roy-chatbo-backend.onrender.com/api/chat?mode=${apiMode}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message })
        });
        const data = await res.json();
        thinkingEl.remove();

        if (mode === 'text' || mode === 'both') {
          appendMessage('Roy', data.text, true);
        }
        if ((mode === 'voice' || mode === 'both') && data.audio) {
          audioEl.src = `data:audio/mp3;base64,${data.audio}`;
          audioEl.style.display = 'block';
          audioEl.play();

          const audioContext = new (window.AudioContext || window.webkitAudioContext)();
          const source = audioContext.createMediaElementSource(audioEl);
          analyser = audioContext.createAnalyser();
          analyser.fftSize = 2048;
          dataArray = new Uint8Array(analyser.frequencyBinCount);
          source.connect(analyser);
          analyser.connect(audioContext.destination);
          drawWaveform('roy');

          audioEl.onended = () => {
            audioContext.close();
            analyser = null;
            royCtx.clearRect(0, 0, royCanvas.width, royCanvas.height);
          };
        }
        return;
      } catch (err) {
        attempts++;
        if (attempts === maxAttempts) {
          thinkingEl.remove();
          appendMessage('Roy', 'A storm clouded my voice. Please try again.');
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
      }
    }
  }

  function drawWaveform(type) {
    if ((type === 'user' && !isRecording) || !analyser) return;
    const now = Date.now();
    if (now - lastWaveformUpdate < WAVEFORM_UPDATE_INTERVAL) {
      requestAnimationFrame(() => drawWaveform(type));
      return;
    }
    lastWaveformUpdate = now;

    const canvas = type === 'user' ? userCanvas : royCanvas;
    const ctx = type === 'user' ? userCtx : royCtx;

    analyser.getByteTimeDomainData(dataArray);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = type === 'user' ? 'yellow' : '#0ff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const sliceWidth = canvas.width / dataArray.length;
    let x = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const y = (dataArray[i] / 128.0) * canvas.height / 2;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      x += sliceWidth;
    }
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();

    requestAnimationFrame(() => drawWaveform(type));
  }

  function saveConversationLog() {
    const messages = Array.from(messagesEl.getElementsByTagName('p')).map(p => p.textContent);
    const logText = messages.join('\n');
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `roy-conversation-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  sendBtn.addEventListener('click', () => {
    const msg = inputEl.value.trim();
    if (msg) {
      appendMessage('You', msg);
      inputEl.value = '';
      fetchRoyResponse(msg);
    }
  });

  micBtn.addEventListener('click', () => {
    isRecording ? stopRecording() : startRecording();
  });

  saveLogBtn.addEventListener('click', saveConversationLog);

  homeBtn.addEventListener('click', () => {
    window.location.href = 'https://synthcalm.com';
  });
});
