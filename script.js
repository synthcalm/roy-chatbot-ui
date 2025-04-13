// Revised Roy's script.js — imports reliable microphone streaming from MIA and ensures compatibility across iOS/desktop with AssemblyAI.

window.addEventListener('DOMContentLoaded', async () => {
  const micBtn = document.getElementById('mic-toggle');
  const sendBtn = document.getElementById('send-button');
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

  const apiBase = 'https://roy-chatbo-backend.onrender.com';
  const ASSEMBLYAI_SOCKET_URL = 'wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000';
  const sessionId = `session-${Date.now()}`;

  let stream, audioContext, source, workletNode, socket;
  let royAudioContext, roySource, royAnalyser, royDataArray, currentAudioEl;
  let isRecording = false;
  let thinkingEl = null;
  let sessionStart = Date.now();

  const responseCache = {
    'how is your health today': {
      text: 'My health is a steady flame, friend. How fares your spirit?',
      audio: null
    },
    'to be honest i\'m not well': {
      text: 'A heavy heart dims the brightest spark. Share your burden—what weighs you down?',
      audio: null
    },
    'how are you today': {
      text: 'I’m a spark in the void, burning steady. How’s your flame holding up?',
      audio: null
    }
  };

  appendMessage('Roy', "Welcome. I'm Roy. Speak when ready — your thoughts hold weight.");
  updateClock();
  setInterval(updateClock, 1000);

  function updateClock() {
    const now = new Date();
    const elapsed = Math.floor((Date.now() - sessionStart) / 1000);
    const remaining = Math.max(0, 3600 - elapsed);
    dateSpan.textContent = now.toISOString().split('T')[0];
    timeSpan.textContent = now.toTimeString().split(' ')[0];
    timerSpan.textContent = `Session Ends In: ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;
  }

  async function startRecording() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContext = new AudioContext({ sampleRate: 16000 });
      await audioContext.resume();

      await audioContext.audioWorklet.addModule('data:application/javascript;base64,' + btoa(`
        class PCMProcessor extends AudioWorkletProcessor {
          process(inputs) {
            const input = inputs[0][0];
            if (!input) return true;
            const int16 = new Int16Array(input.length);
            for (let i = 0; i < input.length; i++) {
              int16[i] = Math.max(-1, Math.min(1, input[i])) * 0x7fff;
            }
            this.port.postMessage(int16.buffer);
            return true;
          }
        }
        registerProcessor('pcm-processor', PCMProcessor);
      `));

      source = audioContext.createMediaStreamSource(stream);
      workletNode = new AudioWorkletNode(audioContext, 'pcm-processor');

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      source.connect(analyser);
      drawUserWaveform(analyser, dataArray);

      const tokenRes = await fetch(`${apiBase}/api/assembly/token`);
      const { token } = await tokenRes.json();
      socket = new WebSocket(ASSEMBLYAI_SOCKET_URL);
      socket.binaryType = 'arraybuffer';
      socket.onopen = () => socket.send(JSON.stringify({ token }));

      let transcriptEl = document.createElement('p');
      transcriptEl.className = 'you live-transcript';
      transcriptEl.innerHTML = '<strong>You (speaking):</strong> <span style="color: yellow">...</span>';
      messagesEl.appendChild(transcriptEl);

      socket.onmessage = (msg) => {
        const { text } = JSON.parse(msg.data);
        if (text) {
          const span = transcriptEl.querySelector('span');
          span.textContent = text;
        }
      };

      workletNode.port.onmessage = (e) => {
        if (socket.readyState === WebSocket.OPEN) socket.send(e.data);
      };

      source.connect(workletNode).connect(audioContext.destination);

      micBtn.textContent = 'Stop';
      micBtn.classList.add('active');
      isRecording = true;

      micBtn.onclick = stopRecording;
    } catch (e) {
      console.error('Mic error:', e);
      appendMessage('Roy', 'Could not access your microphone.');
    }
  }

  async function stopRecording() {
    if (workletNode) workletNode.disconnect();
    if (source) source.disconnect();
    if (audioContext) await audioContext.close();
    if (stream) stream.getTracks().forEach(t => t.stop());
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ terminate_session: true }));
      socket.close();
    }

    const liveEl = document.querySelector('.live-transcript span');
    const finalText = liveEl?.textContent?.trim();
    if (finalText && finalText !== '...') {
      appendMessage('You', finalText);
      inputEl.value = '';
      thinkingEl = document.createElement('p');
      thinkingEl.textContent = 'Roy is reflecting...';
      thinkingEl.className = 'roy';
      messagesEl.appendChild(thinkingEl);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      fetchRoyResponse(finalText).finally(() => {
        if (thinkingEl) thinkingEl.remove();
      });
    } else {
      appendMessage('Roy', 'Your words slipped through the silence. Speak again.');
    }

    const live = document.querySelector('.live-transcript');
    if (live) live.remove();

    isRecording = false;
    micBtn.textContent = 'Speak';
    micBtn.classList.remove('active');
    micBtn.onclick = startRecording;
  }

  function drawUserWaveform(analyser, dataArray) {
    requestAnimationFrame(() => drawUserWaveform(analyser, dataArray));
    analyser.getByteTimeDomainData(dataArray);
    userCtx.fillStyle = '#000';
    userCtx.fillRect(0, 0, userCanvas.width, userCanvas.height);
    drawGrid(userCtx, userCanvas.width, userCanvas.height, 'rgba(0,255,255,0.2)');
    userCtx.strokeStyle = 'yellow';
    userCtx.lineWidth = 1.5;
    userCtx.beginPath();
    const sliceWidth = userCanvas.width / dataArray.length;
    let x = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const y = (dataArray[i] / 128.0) * userCanvas.height / 2;
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

  function appendMessage(sender, text) {
    const p = document.createElement('p');
    p.classList.add(sender.toLowerCase());
    p.innerHTML = `<strong>${sender}:</strong> ${text}`;
    messagesEl.appendChild(p);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  async function fetchRoyResponse(text) {
    try {
      const res = await fetch(`${apiBase}/api/chat/text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          sessionId,
          tone: `You are Roy Batty, a therapeutic counselor. Your voice burns with poetic defiance. Speak with imagery, insight, and vivid human emotion.`
        })
      });
      const data = await res.json();
      if (modeSelect.value !== 'voice') appendMessage('Roy', data.text);
      if (modeSelect.value !== 'text') await fetchAudio(data.text);
    } catch (err) {
      console.error('Roy fetch error:', err);
      appendMessage('Roy', 'My thoughts were lost in static. Try again.');
    }
  }

  async function fetchAudio(royText) {
    try {
      await cleanupAudioResources();
      currentAudioEl = document.createElement('audio');
      document.body.appendChild(currentAudioEl);
      royAudioContext = new AudioContext();
      roySource = royAudioContext.createMediaElementSource(currentAudioEl);
      royAnalyser = royAudioContext.createAnalyser();
      royAnalyser.fftSize = 2048;
      royDataArray = new Uint8Array(royAnalyser.frequencyBinCount);
      roySource.connect(royAnalyser);
      royAnalyser.connect(royAudioContext.destination);
      drawRoyWaveform();

      const res = await fetch(`${apiBase}/api/chat/audio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: royText })
      });
      const audioData = await res.json();
      currentAudioEl.src = `data:audio/mp3;base64,${audioData.audio}`;
      currentAudioEl.play();
      currentAudioEl.onended = () => cleanupAudioResources();
    } catch (e) {
      console.error('Audio error:', e);
      appendMessage('Roy', 'My voice failed. Try again.');
    }
  }

  async function cleanupAudioResources() {
    if (currentAudioEl) {
      currentAudioEl.pause();
      currentAudioEl.remove();
      currentAudioEl = null;
    }
    if (roySource) roySource.disconnect();
    if (royAnalyser) royAnalyser.disconnect();
    if (royAudioContext) await royAudioContext.close();
  }

  micBtn.onclick = startRecording;
  sendBtn.onclick = () => {
    const text = inputEl.value.trim();
    if (text) {
      appendMessage('You', text);
      thinkingEl = document.createElement('p');
      thinkingEl.textContent = 'Roy is reflecting...';
      thinkingEl.className = 'roy';
      messagesEl.appendChild(thinkingEl);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      fetchRoyResponse(text).finally(() => thinkingEl?.remove());
    }
  };
});
