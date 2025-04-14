// script.js – Finalized Roy frontend with real-time transcription, reduced lag, typewriter effect, and fixed waveform

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
  const userCtx = userCanvas.getContext('2d');

  let sessionStart = Date.now();
  let audioContext = null;
  let analyser = null;
  let dataArray = null;
  let stream = null;
  let isRecording = false;
  let socket = null;
  let token = null;
  let liveTranscript = '';
  let transcriptEl = null;
  let mediaRecorder = null;
  let audioChunks = [];
  let rafId = null;

  updateClock();
  setInterval(updateClock, 1000);
  appendMessage('Roy', "Dress rehearsal. It’s de main act. Let’s hear your story. Unvarnished. Raw. Real.");

  function updateClock() {
    const now = new Date();
    dateSpan.textContent = now.toISOString().split('T')[0];
    timeSpan.textContent = now.toTimeString().split(' ')[0];
    const elapsed = Math.floor((Date.now() - sessionStart) / 1000);
    const remaining = Math.max(0, 3600 - elapsed);
    timerSpan.textContent = `Session Ends In: ${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
  }

  function appendMessage(sender, text) {
    const p = document.createElement('p');
    p.classList.add(sender.toLowerCase());
    p.innerHTML = `<strong>${sender}:</strong> ${text}`;
    messagesEl.appendChild(p);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  async function getToken() {
    try {
      const res = await fetch('https://roy-chatbo-backend.onrender.com/api/assembly/token');
      if (!res.ok) throw new Error(`Token fetch failed: ${res.status} - ${await res.text()}`);
      const data = await res.json();
      if (!data.token) throw new Error('Token missing in response');
      token = data.token;
      console.log('AssemblyAI token acquired:', token);
      return token;
    } catch (err) {
      console.error('Token error:', err);
      appendMessage('Roy', 'Failed to connect to transcription service. Using fallback.');
      throw err;
    }
  }

  async function fallbackTranscription() {
    if (!audioChunks.length) {
      appendMessage('Roy', 'No audio recorded for transcription. Please speak louder or check your microphone.');
      return;
    }

    try {
      const loadingEl = document.createElement('p');
      loadingEl.textContent = 'Transcribing...';
      loadingEl.className = 'roy';
      messagesEl.appendChild(loadingEl);
      messagesEl.scrollTop = messagesEl.scrollHeight;

      console.log('Fallback: Audio chunks length:', audioChunks.length);
      const blob = new Blob(audioChunks, { type: 'audio/webm' });
      console.log('Fallback: Audio blob size:', blob.size);
      const formData = new FormData();
      formData.append('audio', blob, 'recording.webm');

      const startTime = Date.now();
      const res = await fetch('https://roy-chatbo-backend.onrender.com/api/transcribe', {
        method: 'POST',
        body: formData
      });
      console.log('Fallback transcription time:', Date.now() - startTime, 'ms');

      if (!res.ok) throw new Error(`Transcription failed: ${res.status} - ${await res.text()}`);
      const data = await res.json();
      if (data.text && data.text.trim()) {
        liveTranscript = data.text;
        appendMessage('You', liveTranscript);
        fetchRoyResponse(liveTranscript);
      } else {
        appendMessage('Roy', 'Your words were too faint. Speak louder and try again.');
      }
    } catch (err) {
      console.error('Fallback transcription error:', err);
      appendMessage('Roy', 'Transcription failed. Try again or type your message.');
    } finally {
      messagesEl.removeChild(loadingEl);
    }
  }

  async function startRecording() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('Microphone stream acquired:', stream.getAudioTracks());

      audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      console.log('AudioContext sample rate:', audioContext.sampleRate);

      const source = audioContext.createMediaStreamSource(stream);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      dataArray = new Uint8Array(analyser.frequencyBinCount);
      source.connect(analyser);
      drawWaveform();

      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunks.push(e.data);
          console.log('MediaRecorder data received:', e.data.size);
        }
      };
      mediaRecorder.onstop = () => console.log('MediaRecorder stopped, chunks:', audioChunks.length);
      mediaRecorder.start(1000);

      if (window.AudioWorklet) {
        try {
          await getToken();

          const wordBoost = encodeURIComponent(JSON.stringify(["begin", "check", "test", "where", "shall", "we"]));
          socket = new WebSocket(`wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000&token=${token}&word_boost=${wordBoost}`);
          socket.binaryType = 'arraybuffer';

          socket.onopen = () => {
            console.log('WebSocket opened');
          };

          socket.onerror = (err) => {
            console.error('WebSocket error:', err);
            appendMessage('Roy', 'Transcription connection failed. Using fallback.');
            fallbackTranscription();
          };

          socket.onclose = (event) => {
            console.log('WebSocket closed:', event.code, event.reason);
          };

          socket.onmessage = (msg) => {
            try {
              const res = JSON.parse(msg.data);
              console.log('WebSocket message received:', res);
              if (res.error) {
                console.error('AssemblyAI error:', res.error);
                appendMessage('Roy', 'Transcription error. Using fallback.');
                fallbackTranscription();
                return;
              }
              if (res.message_type === 'PartialTranscript' || res.message_type === 'FinalTranscript') {
                console.log('Transcript text:', res.text, 'Confidence:', res.confidence);
                if (res.text && res.text.trim()) {
                  liveTranscript = res.text;
                  if (transcriptEl) {
                    transcriptEl.querySelector('span').textContent = res.text;
                    // Force DOM repaint
                    transcriptEl.style.display = 'none';
                    transcriptEl.offsetHeight; // Trigger reflow
                    transcriptEl.style.display = 'block';
                    messagesEl.scrollTop = messagesEl.scrollHeight;
                  }
                } else {
                  if (transcriptEl) {
                    transcriptEl.querySelector('span').textContent = 'Listening... (low confidence)';
                  }
                }
              }
            } catch (err) {
              console.error('WebSocket message parse error:', err);
            }
          };

          transcriptEl = document.createElement('p');
          transcriptEl.className = 'you live-transcript';
          transcriptEl.innerHTML = '<strong>You (speaking):</strong> <span style="color: yellow">...</span>';
          messagesEl.appendChild(transcriptEl);
          messagesEl.scrollTop = messagesEl.scrollHeight;

          const worklet = `class PCMProcessor extends AudioWorkletProcessor {
            process(inputs) {
              const input = inputs[0][0];
              if (!input) return true;
              const int16 = new Int16Array(input.length);
              for (let i = 0; i < input.length; i++) int16[i] = Math.max(-1, Math.min(1, input[i])) * 32767;
              this.port.postMessage(int16.buffer);
              return true;
            }
          }
          registerProcessor('pcm-processor', PCMProcessor);`;

          await audioContext.audioWorklet.addModule('data:application/javascript;base64,' + btoa(worklet)).catch(err => {
            console.error('Worklet error:', err);
            appendMessage('Roy', 'Audio processing failed. Using fallback.');
            throw err;
          });

          const workletNode = new AudioWorkletNode(audioContext, 'pcm-processor');
          workletNode.port.onmessage = (e) => {
            if (socket.readyState === WebSocket.OPEN) {
              const int16 = new Int16Array(e.data);
              console.log('Sending PCM data:', e.data.byteLength, 'Sample values:', int16[0], int16[int16.length - 1]);
              socket.send(e.data);
            }
          };
          source.connect(workletNode).connect(audioContext.destination);
        } catch (err) {
          console.error('Live transcription setup error:', err);
          appendMessage('Roy', 'Live transcription setup failed. Using fallback.');
          fallbackTranscription();
        }
      } else {
        appendMessage('Roy', 'Live transcription unavailable in your browser. Recording audio instead.');
      }

      isRecording = true;
      micBtn.textContent = 'Stop';
      micBtn.classList.add('active');
    } catch (err) {
      console.error('Microphone error:', err.name, err.message);
      if (err.name === 'NotAllowedError') {
        appendMessage('Roy', 'Please allow microphone access to speak.');
      } else if (err.name === 'NotFoundError') {
        appendMessage('Roy', 'No microphone found. Check your device.');
      } else {
        appendMessage('Roy', `Could not access your microphone: ${err.message}`);
      }
    }
  }

  function stopRecording() {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ terminate_session: true }));
      setTimeout(() => {
        socket.close();
      }, 2000);
    }
    if (mediaRecorder) {
      mediaRecorder.stop();
    }
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }
    if (audioContext) {
      audioContext.close();
      audioContext = null;
    }
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
      userCtx.clearRect(0, 0, userCanvas.width, userCanvas.height);
    }

    if (liveTranscript.trim()) {
      appendMessage('You', liveTranscript);
      fetchRoyResponse(liveTranscript);
    } else if (window.AudioWorklet) {
      appendMessage('Roy', 'Your words didn’t make it through the static. Using fallback.');
      fallbackTranscription();
    } else {
      fallbackTranscription();
    }

    if (transcriptEl) transcriptEl.remove();
    isRecording = false;
    micBtn.textContent = 'Speak';
    micBtn.classList.remove('active');
  }

  async function fetchRoyResponse(message) {
    const thinkingEl = document.createElement('p');
    thinkingEl.textContent = 'Roy is reflecting...';
    let dots = 0;
    const thinkingInterval = setInterval(() => {
      dots = (dots + 1) % 4;
      thinkingEl.textContent = 'Roy is reflecting' + '.'.repeat(dots);
    }, 500);
    messagesEl.appendChild(thinkingEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    try {
      const startTime = Date.now();
      const res = await fetch('https://roy-chatbo-backend.onrender.com/api/chat/text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });
      console.log('Text generation time:', Date.now() - startTime, 'ms');
      if (!res.ok) throw new Error(`Chat request failed: ${res.status} - ${await res.text()}`);
      const data = await res.json();
      clearInterval(thinkingInterval);

      if (modeSelect.value !== 'text') {
        const speakingEl = document.createElement('p');
        speakingEl.textContent = 'Roy is speaking...';
        messagesEl.appendChild(speakingEl);
        messagesEl.scrollTop = messagesEl.scrollHeight;

        const audioStartTime = Date.now();
        const audioRes = await fetch('https://roy-chatbo-backend.onrender.com/api/chat/audio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: data.text })
        });
        console.log('Audio generation time:', Date.now() - audioStartTime, 'ms');
        if (!audioRes.ok) throw new Error(`Audio request failed: ${audioRes.status} - ${await audioRes.text()}`);
        const audioData = await audioRes.json();
        const audioEl = new Audio(`data:audio/mp3;base64,${audioData.audio}`);

        // Typewriter effect synchronized with audio
        const royMessageEl = document.createElement('p');
        royMessageEl.className = 'roy';
        royMessageEl.innerHTML = '<strong>Roy:</strong> <span></span>';
        messagesEl.appendChild(royMessageEl);
        messagesEl.scrollTop = messagesEl.scrollHeight;

        const textSpan = royMessageEl.querySelector('span');
        const fullText = data.text;
        let currentIndex = 0;
        const audioDuration = 10000; // Estimate 10 seconds for now; ideally, get this from audio metadata
        const charInterval = audioDuration / fullText.length;

        const typeText = () => {
          if (currentIndex < fullText.length) {
            textSpan.textContent += fullText[currentIndex];
            currentIndex++;
            messagesEl.scrollTop = messagesEl.scrollHeight;
            setTimeout(typeText, charInterval);
          }
        };

        audioEl.onplay = () => typeText();
        await audioEl.play();

        messagesEl.removeChild(speakingEl);
      } else {
        appendMessage('Roy', data.text);
      }
    } catch (err) {
      console.error('Fetch Roy response error:', err);
      appendMessage('Roy', 'A storm clouded my voice. Try again.');
    } finally {
      clearInterval(thinkingInterval);
      messagesEl.removeChild(thinkingEl);
    }
  }

  function drawWaveform() {
    if (!analyser || !isRecording) return;
    rafId = requestAnimationFrame(drawWaveform);
    analyser.getByteTimeDomainData(dataArray);
    userCtx.fillStyle = '#000';
    userCtx.fillRect(0, 0, userCanvas.width, userCanvas.height);
    userCtx.strokeStyle = 'yellow';
    userCtx.lineWidth = 1.5;
    userCtx.beginPath();
    const sliceWidth = userCanvas.width / dataArray.length;
    let x = 0;

    // Scale based on PCM values (max observed ~9700)
    let min = 128, max = 128;
    for (let i = 0; i < dataArray.length; i++) {
      min = Math.min(min, dataArray[i]);
      max = Math.max(max, dataArray[i]);
    }
    const range = Math.max(1, max - min);
    const scaleFactor = 10000 / range; // Normalize to PCM range
    console.log('Waveform data range:', min, max);

    for (let i = 0; i < dataArray.length; i++) {
      const normalized = (dataArray[i] - 128) / 128.0;
      const y = (normalized * userCanvas.height * scaleFactor) + (userCanvas.height / 2);
      if (i === 0) userCtx.moveTo(x, y);
      else userCtx.lineTo(x, y);
      x += sliceWidth;
    }
    userCtx.stroke();
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

  document.getElementById('save-log').addEventListener('click', () => {
    const messages = Array.from(messagesEl.getElementsByTagName('p'))
      .map(p => p.textContent)
      .join('\n');
    const blob = new Blob([messages], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'roy-chat-log.txt';
    a.click();
    URL.revokeObjectURL(url);
  });
});
