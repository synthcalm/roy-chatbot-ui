/* script.js – Fixed AssemblyAI WebSocket, audio cutoff, delays with caching, waveforms */

window.addEventListener('DOMContentLoaded', async () => {
  const micBtn = document.getElementById('mic-toggle');
  const sendBtn = document.getElementById('send-button');
  const inputEl = document.getElementById('user-input');
  const messagesEl = document.getElementById('messages');
  const modeSelect = document.getElementById('responseMode');
  let isRecording = false;
  let stream = null;
  let liveTranscriptEl = null;
  let thinkingEl = null;
  let socket = null;
  let audioContext = null;
  let source = null;
  let workletNode = null;
  let isAudioPlaying = false;
  let currentAudioEl = null;
  let royAudioContext = null;
  let royAnalyser = null;
  let royDataArray = null;
  let roySource = null;

  const ASSEMBLYAI_SOCKET_URL = 'wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000';
  const ASSEMBLYAI_API_KEY = 'eeee5d1982444610a670bd17152a8e4a';
  const sessionId = `session-${Date.now()}`;
  const apiBase = 'http://localhost:3001'; // Switch to 'https://roy-chatbo-backend.onrender.com' for prod

  // Cache for instant replies
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

  const userCanvas = document.getElementById('userWaveform');
  const userCtx = userCanvas.getContext('2d');
  const royCanvas = document.getElementById('royWaveform');
  const royCtx = royCanvas.getContext('2d');

  appendMessage('Roy', "Welcome. I'm Roy. Speak when ready — your thoughts hold weight.");

  async function startRecording() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
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
      const userAnalyser = audioContext.createAnalyser();
      userAnalyser.fftSize = 2048;
      const userDataArray = new Uint8Array(userAnalyser.frequencyBinCount);
      source.connect(userAnalyser);
      drawUserWaveform(userAnalyser, userDataArray);

      workletNode = new AudioWorkletNode(audioContext, 'pcm-processor');
      workletNode.port.onmessage = (e) => {
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(e.data);
        }
      };

      source.connect(workletNode).connect(audioContext.destination);
      connectToAssemblyAI();

      liveTranscriptEl = document.createElement('p');
      liveTranscriptEl.className = 'you live-transcript';
      liveTranscriptEl.innerHTML = '<strong>You (speaking):</strong> <span style="color: yellow">...</span>';
      messagesEl.appendChild(liveTranscriptEl);
      messagesEl.scrollTop = messagesEl.scrollHeight;

      isRecording = true;
      micBtn.textContent = 'Stop';
      micBtn.classList.add('active');
    } catch (error) {
      console.error('Recording error:', error);
      appendMessage('Roy', 'Microphone blocked. Please allow access and try again.');
      stopRecording();
    }
  }

  function connectToAssemblyAI(retryCount = 0) {
    if (retryCount > 3) {
      appendMessage('Roy', 'Cannot connect to transcription service. Try again later.');
      stopRecording();
      return;
    }

    socket = new WebSocket(ASSEMBLYAI_SOCKET_URL);
    socket.binaryType = 'arraybuffer';

    socket.onopen = () => {
      console.log('AssemblyAI WebSocket opened');
      socket.send(JSON.stringify({ token: ASSEMBLYAI_API_KEY }));
    };

    socket.onmessage = (message) => {
      try {
        const res = JSON.parse(message.data);
        if (res.error) {
          console.error('AssemblyAI error:', res.error);
          appendMessage('Roy', 'Transcription failed. Please try again.');
          stopRecording();
        } else if (res.text && liveTranscriptEl) {
          const transcriptSpan = liveTranscriptEl.querySelector('span');
          transcriptSpan.textContent = res.text || '...';
          messagesEl.scrollTop = messagesEl.scrollHeight;
        }
      } catch (e) {
        console.error('AssemblyAI message parse error:', e);
      }
    };

    socket.onerror = (e) => {
      console.error('AssemblyAI WebSocket error:', e);
      appendMessage('Roy', 'Transcription service issue. Retrying...');
    };

    socket.onclose = () => {
      console.warn('AssemblyAI WebSocket closed.');
      if (isRecording) {
        console.log(`Retrying AssemblyAI connection (attempt ${retryCount + 1})...`);
        setTimeout(() => connectToAssemblyAI(retryCount + 1), 1000);
      }
    };
  }

  async function stopRecording() {
    if (workletNode) {
      workletNode.disconnect();
      workletNode = null;
    }
    if (source) {
      source.disconnect();
      source = null;
    }
    if (audioContext) {
      await audioContext.close();
      audioContext = null;
    }
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ terminate_session: true }));
      socket.close();
      socket = null;
    }

    if (liveTranscriptEl) {
      const finalMessage = liveTranscriptEl.querySelector('span')?.textContent?.trim();
      liveTranscriptEl.remove();
      liveTranscriptEl = null;

      if (finalMessage && finalMessage !== '...') {
        appendMessage('You', finalMessage);
        inputEl.value = '';
        thinkingEl = document.createElement('p');
        thinkingEl.textContent = 'Roy is reflecting...';
        thinkingEl.className = 'roy';
        messagesEl.appendChild(thinkingEl);
        messagesEl.scrollTop = messagesEl.scrollHeight;
        fetchRoyResponse(finalMessage).finally(() => {
          if (thinkingEl) {
            thinkingEl.remove();
            thinkingEl = null;
          }
        });
      } else {
        appendMessage('Roy', 'Your words slipped through the silence. Speak again.');
      }
    }

    isRecording = false;
    micBtn.textContent = 'Speak';
    micBtn.classList.remove('active');
  }

  async function cleanupAudioResources() {
    console.log('Cleaning up audio resources...');
    if (currentAudioEl) {
      currentAudioEl.pause();
      currentAudioEl.src = '';
      currentAudioEl.load();
      currentAudioEl.remove();
      currentAudioEl = null;
    }
    if (roySource) {
      try {
        roySource.disconnect();
      } catch (e) {
        console.warn('Error disconnecting roySource:', e);
      }
      roySource = null;
    }
    if (royAnalyser) {
      try {
        royAnalyser.disconnect();
      } catch (e) {
        console.warn('Error disconnecting royAnalyser:', e);
      }
      royAnalyser = null;
    }
    if (royAudioContext) {
      try {
        await royAudioContext.close();
      } catch (e) {
        console.warn('Error closing royAudioContext:', e);
      }
      royAudioContext = null;
    }
  }

  async function fetchRoyResponse(text) {
    const startTime = Date.now();
    let thinkingInterval = null;

    try {
      // Update thinking timer
      if (thinkingEl) {
        thinkingInterval = setInterval(() => {
          const seconds = Math.floor((Date.now() - startTime) / 1000);
          thinkingEl.textContent = `Roy is reflecting... [${seconds}s]`;
          messagesEl.scrollTop = messagesEl.scrollHeight;
        }, 1000);
      }

      // Check cache
      const normalizedText = text.toLowerCase().trim();
      if (responseCache[normalizedText] && modeSelect.value !== 'voice') {
        console.log('Using cached response for:', normalizedText);
        appendMessage('Roy', responseCache[normalizedText].text);
        if (modeSelect.value !== 'text') {
          fetchAudio(responseCache[normalizedText].text);
        }
        return;
      }

      // Fetch text
      const textRes = await Promise.race([
        fetch(`${apiBase}/api/chat/text`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            sessionId,
            tone: `You are Roy Batty, a therapeutic counselor. Your voice burns with poetic defiance. Speak with imagery, insight, and vivid human emotion.`
          })
        }).then(res => res.ok ? res.json() : Promise.reject(`Text response failed: ${res.status}`)),
        new Promise((_, reject) => setTimeout(() => reject('Text fetch timeout'), 10000))
      ]);

      // Display text
      if (modeSelect.value !== 'voice') {
        appendMessage('Roy', textRes.text);
      }

      // Fetch audio if needed
      if (modeSelect.value !== 'text') {
        await fetchAudio(textRes.text);
      }
    } catch (err) {
      console.error('Fetch error:', err);
      appendMessage('Roy', 'Something disrupted my voice. Try again.');
    } finally {
      if (thinkingInterval) clearInterval(thinkingInterval);
    }
  }

  async function fetchAudio(royText) {
    if (isAudioPlaying) {
      console.log('Audio still playing, waiting...');
      await new Promise(resolve => {
        currentAudioEl.onended = () => {
          isAudioPlaying = false;
          currentAudioEl.onended = null;
          resolve();
        };
      });
    }

    await cleanupAudioResources();

    try {
      console.log('Creating new audio element...');
      currentAudioEl = document.createElement('audio');
      currentAudioEl.style.display = 'none';
      document.body.appendChild(currentAudioEl);

      console.log('Creating new AudioContext...');
      royAudioContext = new (window.AudioContext || window.webkitAudioContext)();

      const audioRes = await Promise.race([
        fetch(`${apiBase}/api/chat/audio`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: royText })
        }).then(res => res.ok ? res.json() : Promise.reject(`Audio response failed: ${res.status}`)),
        new Promise((_, reject) => setTimeout(() => reject('Audio fetch timeout'), 10000))
      ]);

      console.log('Setting up audio playback...');
      currentAudioEl.src = `data:audio/mp3;base64,${audioRes.audio}`;
      roySource = royAudioContext.createMediaElementSource(currentAudioEl);
      royAnalyser = royAudioContext.createAnalyser();
      royAnalyser.fftSize = 2048;
      royDataArray = new Uint8Array(royAnalyser.frequencyBinCount);
      roySource.connect(royAnalyser);
      royAnalyser.connect(royAudioContext.destination);
      drawRoyWaveform();

      isAudioPlaying = true;
      await currentAudioEl.play();
      console.log('Audio playback started successfully');
      currentAudioEl.onended = () => {
        isAudioPlaying = false;
        cleanupAudioResources();
      };
    } catch (error) {
      console.error('Audio fetch error:', error);
      isAudioPlaying = false;
      await cleanupAudioResources();
      appendMessage('Roy', 'My voice faltered. Let me try again.');
    }
  }

  function drawUserWaveform(analyser, dataArray) {
    if (!analyser) return;
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

  micBtn.addEventListener('click', () => {
    if (!isRecording) {
      startRecording();
    } else {
      stopRecording();
    }
  });

  sendBtn.addEventListener('click', () => {
    const msg = inputEl.value.trim();
    if (msg) {
      appendMessage('You', msg);
      inputEl.value = '';
      thinkingEl = document.createElement('p');
      thinkingEl.textContent = 'Roy is reflecting...';
      thinkingEl.className = 'roy';
      messagesEl.appendChild(thinkingEl);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      fetchRoyResponse(msg).finally(() => {
        if (thinkingEl) {
          thinkingEl.remove();
          thinkingEl = null;
        }
      });
    }
  });

  window.addEventListener('unload', () => {
    stopRecording();
    cleanupAudioResources();
  });
});
