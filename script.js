// script.js – Roy frontend using Whisper fallback

window.addEventListener('DOMContentLoaded', () => {
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

  let sessionStart = Date.now();
  let mediaRecorder = null;
  let recordedChunks = [];
  let stream = null;
  let analyser = null;
  let audioContext = null;
  let isRecording = false;
  let lastRoyMessage = '';

  const affirmations = [
    "Oh, ok.", "I see.", "Understood.", "Right.", "Got it.", "Hmm, okay.",
    "Alright.", "Sure.", "Okay then.", "Ah, I get it.", "Noted.", "Thanks for that.",
    "Fair enough.", "Mhm.", "All clear.", "Yup.", "Acknowledged.", "Heard you.",
    "Hmm, makes sense.", "Alright then.", "Following you.", "Yep, that tracks.", "That's clear.",
    "Right, makes sense.", "That adds up.", "Okay, I hear that.", "I'm with you.",
    "Yeah, alright.", "Crystal clear.", "That’s fair.", "Alright, continue."
  ];

  const quotes = [
    "'Not all those who wander are lost.' – Tolkien",
    "'I think, therefore I am.' – Descartes",
    "'This too shall pass.'",
    "'There is a crack in everything. That’s how the light gets in.' – Leonard Cohen",
    "'Do or do not. There is no try.' – Yoda",
    "'Freedom is the freedom to say that two plus two make four.' – Orwell"
  ];

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
    dateSpan.textContent = now.toISOString().split('T')[0];
    timeSpan.textContent = now.toTimeString().split(' ')[0];
    const elapsed = Math.floor((Date.now() - sessionStart) / 1000);
    const remaining = Math.max(0, 3600 - elapsed);
    timerSpan.textContent = `Session Ends In: ${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
  }

  function appendMessage(sender, text) {
    const p = document.createElement('p');
    p.className = sender.toLowerCase();
    p.innerHTML = `<strong>${sender}:</strong> ${text}`;
    messagesEl.appendChild(p);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  async function fetchRoyResponse(message) {
    const thinkingEl = document.createElement('p');
    thinkingEl.textContent = 'Roy is reflecting...';
    thinkingEl.className = 'roy';
    messagesEl.appendChild(thinkingEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    try {
      const res = await fetch('https://roy-chatbo-backend.onrender.com/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, mode: modeSelect.value })
      });
      const data = await res.json();

      thinkingEl.remove();
      await new Promise(resolve => setTimeout(resolve, 500));

      let preface = getRandomAffirmation();
      let poetic = Math.random() < 0.1 ? `\n${quotes[Math.floor(Math.random() * quotes.length)]}` : '';
      let binary = Math.random() < 0.15 ? `\n${binaryPrompts[Math.floor(Math.random() * binaryPrompts.length)]}` : '';
      let paraphrase = '';

      const msgLower = message.trim().toLowerCase();
      const shortOrVague = ["i don't know", "idk", "whatever", "nothing", "huh", "dunno", "meh"].includes(msgLower) || message.length <= 4;

      if (shortOrVague) {
        paraphrase = `\nIt’s okay not to know. But if you *did* know, what might the answer sound like?`;
      } else if (message.length > 15 && Math.random() > 0.5) {
        paraphrase = `\nSo you're saying, \"${message.slice(0, 80)}\" — is that right?`;
      }

      if (/god|religion|faith|pray|heaven|hell/i.test(message)) {
        poetic = "\n'What can be asserted without evidence can also be dismissed without evidence.' – Christopher Hitchens";
      }

      const finalMessage = `${preface}${poetic}${paraphrase}\n${data.text}${binary}`;
      appendMessage('Roy', finalMessage);
      lastRoyMessage = finalMessage;

      if ((modeSelect.value === 'voice' || modeSelect.value === 'both') && data.audio) {
        const audio = new Audio(`data:audio/mp3;base64,${data.audio}`);
        audio.play();
        drawWaveform(royCtx, royCanvas, audio, 'magenta');
      }
    } catch (err) {
      thinkingEl.remove();
      appendMessage('Roy', 'A storm clouded my voice. Try again.');
    }
  }

  function getRandomAffirmation() {
    let options = affirmations.filter(a => !lastRoyMessage.includes(a));
    return options[Math.floor(Math.random() * options.length)] || '';
  }

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
      socket.onopen = () => {
        socket.send(JSON.stringify({ token }));
      };

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

      isRecording = true;
      micBtn.textContent = 'Stop';
      micBtn.classList.add('recording');
    } catch (err) {
      appendMessage('Roy', 'Microphone access was denied or AssemblyAI failed.');
    }
  }
      isRecording = true;
      micBtn.textContent = 'Stop';
      micBtn.classList.add('recording');
    });
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    micBtn.textContent = 'Speak';
    micBtn.classList.remove('recording');
    isRecording = false;
  }

  function drawWaveform(ctx, canvas, source, color) {
    const draw = () => {
      requestAnimationFrame(draw);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, canvas.height / 2);
      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
    };
    draw();
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
    const log = Array.from(messagesEl.children).map(c => c.textContent).join('\n');
    const blob = new Blob([log], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `roy-session-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById('home-btn').addEventListener('click', () => {
    window.location.href = 'https://synthcalm.com';
  });
});
