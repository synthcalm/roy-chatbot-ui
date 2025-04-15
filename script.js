// script.js – Roy frontend using Whisper fallback with AssemblyAI and Roy's persona

window.addEventListener('DOMContentLoaded', () => {
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
  let audioContext = null;
  let analyser = null;
  let isRecording = false;
  let sessionStart = Date.now();

  const quoteThemes = {
    existential: [
      "'I've seen things you people wouldn't believe.' – Roy Batty",
      "'The unexamined life is not worth living.' – Socrates",
      "'Reality is that which, when you stop believing in it, doesn't go away.' – Philip K. Dick"
    ],
    pragmatic: [
      "'Do or do not. There is no try.' – Yoda",
      "'Freedom is the freedom to say that two plus two make four.' – Orwell",
      "'This too shall pass.'"
    ],
    poetic: [
      "'There is a crack in everything. That’s how the light gets in.' – Leonard Cohen",
      "'Not all those who wander are lost.' – Tolkien"
    ],
    rebellious: [
      "'Madness, as you know, is a lot like gravity. All it takes is a little push.' – The Joker",
      "'I am not what happened to me. I am what I choose to become.' – Jung"
    ]
  };

  const binaryPrompts = [
    "Would you rather feel safe or feel free?",
    "Would you rather follow logic or intuition?",
    "Would you rather let go or hold on?",
    "Would you rather be understood or be left alone?",
    "Would you rather ask or be asked?"
  ];

  appendMessage('Roy', "Welcome. I'm Roy. Speak when ready — your thoughts hold weight.");
  updateClock();
  setInterval(updateClock, 1000);

  function updateClock() {
    const now = new Date();
    const dateSpan = document.getElementById('current-date');
    const timeSpan = document.getElementById('current-time');
    const timerSpan = document.getElementById('countdown-timer');
    if (!dateSpan || !timeSpan || !timerSpan) return;
    dateSpan.textContent = now.toISOString().split('T')[0];
    timeSpan.textContent = now.toTimeString().split(' ')[0];
    const elapsed = Math.floor((Date.now() - sessionStart) / 1000);
    const remaining = Math.max(0, 3600 - elapsed);
    timerSpan.textContent = `Session Ends In: ${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
  }

  micBtn.addEventListener('click', () => {
    isRecording ? stopRecording() : startRecording();
  });

  async function startRecording() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      drawWaveform(userCtx, userCanvas, analyser, 'yellow');

      const res = await fetch('https://roy-chatbo-backend.onrender.com/api/assembly/token');
      const { token } = await res.json();

      const socket = new WebSocket(`wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000`);
      socket.onopen = () => socket.send(JSON.stringify({ token }));

      socket.onmessage = (msg) => {
        const res = JSON.parse(msg.data);
        if (res.text) {
          appendMessage('You', res.text);
          fetchRoyResponse(res.text);
        }
      };

      const workletCode = `
        class PCMWorklet extends AudioWorkletProcessor {
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
        registerProcessor('pcm-worklet', PCMWorklet);
      `;
      const blob = new Blob([workletCode], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      await audioContext.audioWorklet.addModule(url);
      const workletNode = new AudioWorkletNode(audioContext, 'pcm-worklet');
      workletNode.port.onmessage = (e) => {
        if (socket.readyState === WebSocket.OPEN) socket.send(e.data);
      };

      source.connect(workletNode);
      workletNode.connect(audioContext.destination);

    } catch (err) {
      appendMessage('Roy', 'AssemblyAI connection failed. Fallback in progress.');
    }

    isRecording = true;
    micBtn.textContent = 'Stop';
    micBtn.classList.add('recording');
  }

  function stopRecording() {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    micBtn.textContent = 'Speak';
    micBtn.classList.remove('recording');
    isRecording = false;
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
      const affirmation = getRandomAffirmation();
      const quote = getRandomThematicQuote();
      const prompt = Math.random() < 0.3 ? `\n\n${binaryPrompts[Math.floor(Math.random() * binaryPrompts.length)]}` : '';
      appendMessage('Roy', `${affirmation}\n\n${quote}\n\n${data.text}${prompt}`);
    } catch (err) {
      thinking.remove();
      appendMessage('Roy', 'Roy was silent. Try again.');
    }
  }

  function getRandomAffirmation() {
    const affirmations = [
      "Alright.", "Okay.", "Got it.", "Right...",
      "I see.", "Understood.", "Heard you.",
      "That’s clear.", "Go on.", "I’m listening.",
      "You have my attention.", "Speak your truth.",
      "That’s significant.", "Continue.",
      "Now we’re getting somewhere.", "Interesting.",
      "You’re not wrong.", "Hmm.", "Say more.", "Let’s unpack that."
    ];
    return affirmations[Math.floor(Math.random() * affirmations.length)];
  }

  function getRandomThematicQuote() {
    const categories = Object.keys(quoteThemes);
    const theme = categories[Math.floor(Math.random() * categories.length)];
    const quoteList = quoteThemes[theme];
    return quoteList[Math.floor(Math.random() * quoteList.length)];
  }
});
