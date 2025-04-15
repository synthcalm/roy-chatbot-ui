// script.js – Updated Roy frontend with polished UX and functional voice
// Version: 2.4 (Fixed voice functionality and improved waveforms)
// Note: After updating this file, ensure you redeploy to GitHub Pages (synthcalm.github.io) to apply changes.

console.log('SynthCalm App Version: 2.4');

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

  // Initialize time display
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

  async function getToken() {
    try {
      const res = await fetch('https://roy-chatbo-backend.onrender.com/api/assembly/token');
      const data = await res.json();
      token = data.token;
      return token;
    } catch (err) {
      console.error('Error getting token:', err);
      appendMessage('Roy', 'Communication error with speech service. Try typing instead.');
      return null;
    }
  }

  async function startRecording() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      const source = audioContext.createMediaStreamSource(stream);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      dataArray = new Uint8Array(analyser.frequencyBinCount);
      source.connect(analyser);
      
      // Start drawing waveform
      drawUserWaveform();

      // Get token for AssemblyAI
      const tokenResult = await getToken();
      if (!tokenResult) {
        stopRecording();
        return;
      }

      // Set up WebSocket for real-time transcription
      socket = new WebSocket(`wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000`);
      socket.binaryType = 'arraybuffer';

      socket.onopen = () => {
        socket.send(JSON.stringify({ token }));
      };

      socket.onmessage = (msg) => {
        const res = JSON.parse(msg.data);
        if (res.text) {
          transcriptEl.querySelector('span').textContent = res.text;
          liveTranscript = res.text;
        }
      };

      // Create live transcript element
      transcriptEl = document.createElement('p');
      transcriptEl.className = 'you live-transcript';
      transcriptEl.innerHTML = '<strong>You (speaking):</strong> <span style="color: yellow">...</span>';
      messagesEl.appendChild(transcriptEl);
      messagesEl.scrollTop = messagesEl.scrollHeight;

      // Set up audio processor for sending audio to AssemblyAI
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

      await audioContext.audioWorklet.addModule('data:application/javascript;base64,' + btoa(worklet));
      const workletNode = new AudioWorkletNode(audioContext, 'pcm-processor');
      workletNode.port.onmessage = (e) => {
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(e.data);
        }
      };
      source.connect(workletNode).connect(audioContext.destination);

      isRecording = true;
      micBtn.textContent = 'Stop';
      micBtn.classList.add('recording');
    } catch (err) {
      console.error('Recording error:', err);
      let errorMessage = 'Could not access your microphone.';
      if (err.name === 'NotAllowedError') {
        errorMessage = 'Microphone access denied. Please allow microphone permissions in your browser settings.';
      } else if (err.name === 'NotFoundError') {
        errorMessage = 'No microphone found. Please ensure a microphone is connected.';
      }
      appendMessage('Roy', errorMessage);
    }
  }

  function stopRecording() {
    // Close WebSocket
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ terminate_session: true }));
      socket.close();
      socket = null;
    }
    
    // Stop media stream
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }
    
    // Close audio context
    if (audioContext) {
      audioContext.close();
      audioContext = null;
      analyser = null;
    }

    // Clear user waveform
    userCtx.clearRect(0, 0, userCanvas.width, userCanvas.height);
    drawFlatLine(userCtx, userCanvas);

    // Process transcript if it exists
    if (liveTranscript.trim()) {
      appendMessage('You', liveTranscript);
      fetchRoyResponse(liveTranscript);
      liveTranscript = '';
    } else {
      appendMessage('Roy', 'Your words didn't make it through the static. Try again or type your message.');
    }

    // Remove the live transcript element
    if (transcriptEl) {
      transcriptEl.remove();
      transcriptEl = null;
    }

    // Update UI
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
        
        if (!res.ok) {
          throw new Error(`Server responded with status: ${res.status}`);
        }
        
        const data = await res.json();
        thinkingEl.remove();

        if (mode === 'text' || mode === 'both') {
          appendMessage('Roy', data.text, true);
        }
        
        if ((mode === 'voice' || mode === 'both') && data.audio) {
          // Create and setup audio for Roy
          audioEl.src = `data:audio/mp3;base64,${data.audio}`;
          audioEl.style.display = 'block';
          
          // Set up visualizer for Roy's voice
          const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          const source = audioCtx.createMediaElementSource(audioEl);
          const royAnalyser = audioCtx.createAnalyser();
          royAnalyser.fftSize = 2048;
          const royDataArray = new Uint8Array(royAnalyser.frequencyBinCount);
          
          source.connect(royAnalyser);
          royAnalyser.connect(audioCtx.destination);
          
          // Clear any previous waveform
          royCtx.clearRect(0, 0, royCanvas.width, royCanvas.height);
          drawFlatLine(royCtx, royCanvas);
          
          // Start drawing Roy's waveform when audio plays
          audioEl.onplay = function() {
            function drawRoyWaveform() {
              if (!royAnalyser || audioEl.paused || audioEl.ended) {
                royCtx.clearRect(0, 0, royCanvas.width, royCanvas.height);
                drawFlatLine(royCtx, royCanvas);
                return;
              }
              
              requestAnimationFrame(drawRoyWaveform);
              
              royAnalyser.getByteTimeDomainData(royDataArray);
              
              // Clear previous frame
              royCtx.clearRect(0, 0, royCanvas.width, royCanvas.height);
              
              // Style settings
              royCtx.fillStyle = '#000';
              royCtx.fillRect(0, 0, royCanvas.width, royCanvas.height);
              royCtx.lineWidth = 2;
              royCtx.strokeStyle = '#0ff';
              
              // Draw waveform with smooth curves
              royCtx.beginPath();
              
              const sliceWidth = royCanvas.width / royDataArray.length;
              let x = 0;
              
              for (let i = 0; i < royDataArray.length; i++) {
                // Apply a cleaner, more pronounced transformation
                const normalized = (royDataArray[i] / 128.0) - 1;
                const y = normalized * (royCanvas.height / 3) + (royCanvas.height / 2);
                
                if (i === 0) {
                  royCtx.moveTo(x, y);
                } else {
                  royCtx.lineTo(x, y);
                }
                
                x += sliceWidth;
              }
              
              royCtx.stroke();
            }
            
            drawRoyWaveform();
          };
          
          // Cleanup when audio ends
          audioEl.onended = function() {
            audioCtx.close();
            royCtx.clearRect(0, 0, royCanvas.width, royCanvas.height);
            drawFlatLine(royCtx, royCanvas);
          };
          
          // Play audio with a small delay to ensure setup is complete
          setTimeout(() => {
            audioEl.play().catch(err => {
              console.error('Audio playback error:', err);
              appendMessage('Roy', 'Voice output unavailable. Please check your audio settings.');
            });
          }, 100);
        }
        
        return;
      } catch (err) {
        console.error('Error fetching Roy response:', err);
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

  function drawUserWaveform() {
    if (!analyser || !isRecording) return;
    
    requestAnimationFrame(drawUserWaveform);
    
    analyser.getByteTimeDomainData(dataArray);
    
    // Clear previous frame
    userCtx.clearRect(0, 0, userCanvas.width, userCanvas.height);
    
    // Background
    userCtx.fillStyle = '#000';
    userCtx.fillRect(0, 0, userCanvas.width, userCanvas.height);
    
    // Waveform style
    userCtx.lineWidth = 2;
    userCtx.strokeStyle = 'yellow';
    
    // Begin drawing waveform
    userCtx.beginPath();
    
    const sliceWidth = userCanvas.width / dataArray.length;
    let x = 0;
    
    // Draw smooth waveform with enhanced visibility
    for (let i = 0; i < dataArray.length; i++) {
      // Apply a cleaner, more pronounced transformation
      const normalized = (dataArray[i] / 128.0) - 1;
      const y = normalized * (userCanvas.height / 3) + (userCanvas.height / 2);
      
      if (i === 0) {
        userCtx.moveTo(x, y);
      } else {
        userCtx.lineTo(x, y);
      }
      
      x += sliceWidth;
    }
    
    userCtx.stroke();
  }

  function drawFlatLine(ctx, canvas) {
    // Draw a flat line in the middle of the canvas
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    ctx.strokeStyle = canvas === userCanvas ? 'yellow' : '#0ff';
    ctx.lineWidth = 1;
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
  }

  function saveConversationLog() {
    const messages = Array.from(messagesEl.getElementsByTagName('p'))
      .filter(p => !p.classList.contains('live-transcript') && !p.classList.contains('typing'))
      .map(p => p.textContent);
    const logText = messages.join('\n');
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `roy-conversation-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Initialize flat lines on canvases
  drawFlatLine(userCtx, userCanvas);
  drawFlatLine(royCtx, royCanvas);

  // Event listeners
  sendBtn.addEventListener('click', () => {
    const msg = inputEl.value.trim();
    if (msg) {
      appendMessage('You', msg);
      inputEl.value = '';
      fetchRoyResponse(msg);
    }
  });

  micBtn.addEventListener('click', () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  });

  saveLogBtn.addEventListener('click', saveConversationLog);

  homeBtn.addEventListener('click', () => {
    window.location.href = 'https://synthcalm.com';
  });

  // Add event listener for Enter key in text input
  inputEl.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      sendBtn.click();
    }
  });
});
