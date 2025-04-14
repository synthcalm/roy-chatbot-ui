// script.js – Real-time voice flow for Roy using AssemblyAI (copied from MIA)

window.addEventListener('DOMContentLoaded', async () => {
  const micBtn = document.getElementById('mic-toggle');
  const sendBtn = document.getElementById('send-button');
  const inputEl = document.getElementById('user-input');
  const messagesEl = document.getElementById('messages');
  const modeSelect = document.getElementById('responseMode');
  const dateSpan = document.getElementById('current-date');
  const timeSpan = document.getElementById('current-time');
  const timerSpan = document.getElementById('countdown-timer');
  const sessionId = `session-${Date.now()}`;
  let stream, audioContext, source, workletNode, socket, liveTranscriptEl, isRecording = false;

  const royBackend = 'https://roy-chatbo-backend.onrender.com';
  const sessionStart = Date.now();

  // Clock + Timer
  function updateClock() {
    const now = new Date();
    const elapsed = Math.floor((Date.now() - sessionStart) / 1000);
    const remaining = Math.max(0, 3600 - elapsed);
    dateSpan.textContent = now.toISOString().split('T')[0];
    timeSpan.textContent = now.toTimeString().split(' ')[0];
    timerSpan.textContent = `Session Ends In: ${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
  }
  setInterval(updateClock, 1000);
  updateClock();

  // Greet
  appendMessage('Roy', "Welcome. I'm Roy. Speak when ready — your thoughts hold weight.");

  // Helpers
  function appendMessage(sender, text) {
    const p = document.createElement('p');
    p.classList.add(sender.toLowerCase());
    p.innerHTML = `<strong>${sender}:</strong> ${text}`;
    messagesEl.appendChild(p);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

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
        registerProcessor('pcm-processor', PCMProcessor);`));

      source = audioContext.createMediaStreamSource(stream);
      workletNode = new AudioWorkletNode(audioContext, 'pcm-processor');

      workletNode.port.onmessage = (e) => {
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.send(e.data);
        }
      };

      source.connect(workletNode).connect(audioContext.destination);
      await connectToAssemblyAI();

      liveTranscriptEl = document.createElement('p');
      liveTranscriptEl.className = 'you live-transcript';
      liveTranscriptEl.innerHTML = '<strong>You (speaking):</strong> <span style="color: yellow">...</span>';
      messagesEl.appendChild(liveTranscriptEl);

      micBtn.textContent = 'Stop';
      micBtn.classList.add('active');
      isRecording = true;
    } catch (err) {
      appendMessage('Roy', 'Microphone access denied or failed.');
      console.error('Mic error:', err);
    }
  }

  async function stopRecording() {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ terminate_session: true }));
      socket.close();
    }
    if (audioContext) await audioContext.close();
    if (stream) stream.getTracks().forEach(track => track.stop());
    if (liveTranscriptEl) {
      const final = liveTranscriptEl.querySelector('span').textContent.trim();
      liveTranscriptEl.remove();
      if (final && final !== '...') {
        appendMessage('You', final);
        await fetchRoyResponse(final);
      } else {
        appendMessage('Roy', 'Your words didn’t make it through the static. Try again.');
      }
    }
    micBtn.textContent = 'Speak';
    micBtn.classList.remove('active');
    isRecording = false;
  }

  async function connectToAssemblyAI() {
    const res = await fetch(`${royBackend}/api/assembly/token`);
    const { token } = await res.json();
    socket = new WebSocket(`wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000`);
    socket.binaryType = 'arraybuffer';

    socket.onopen = () => {
      socket.send(JSON.stringify({ token }));
    };

    socket.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      if (data.text && liveTranscriptEl) {
        liveTranscriptEl.querySelector('span').textContent = data.text;
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }
    };
  }

  async function fetchRoyResponse(text) {
    const resText = await fetch(`${royBackend}/api/chat/text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, sessionId })
    });
    const { text: reply } = await resText.json();
    appendMessage('Roy', reply);

    if (modeSelect.value !== 'text') {
      const resAudio = await fetch(`${royBackend}/api/chat/audio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: reply })
      });
      const { audio } = await resAudio.json();

      const audioEl = new Audio(`data:audio/mp3;base64,${audio}`);
      await audioEl.play();
    }
  }

  sendBtn.addEventListener('click', async () => {
    const msg = inputEl.value.trim();
    if (msg) {
      appendMessage('You', msg);
      inputEl.value = '';
      await fetchRoyResponse(msg);
    }
  });

  micBtn.addEventListener('click', () => {
    if (!isRecording) {
      startRecording();
    } else {
      stopRecording();
    }
  });
});
