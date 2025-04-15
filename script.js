// script.js – Roy frontend using Whisper fallback with AssemblyAI

window.addEventListener('DOMContentLoaded', () => {
  // Inject greeting and clock
  appendMessage('Roy', "Welcome. I'm Roy. Speak when ready — your thoughts hold weight.");
  updateClock();
  setInterval(updateClock, 1000);
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
  }

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
  
  let sessionStart = Date.now();

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
      const alertBanner = document.createElement('div');
      alertBanner.textContent = '⚠️ AssemblyAI connection failed. Falling back to Whisper.';
      alertBanner.style.backgroundColor = '#222';
      alertBanner.style.color = 'yellow';
      alertBanner.style.padding = '10px';
      alertBanner.style.textAlign = 'center';
      alertBanner.style.border = '1px solid yellow';
      alertBanner.style.marginBottom = '10px';
      messagesEl.appendChild(alertBanner);

      appendMessage('Roy', 'AssemblyAI failed, switching to Whisper fallback.');

      recordedChunks = [];
      mediaRecorder = new MediaRecorder(stream);

      mediaRecorder.ondataavailable = e => recordedChunks.push(e.data);
      mediaRecorder.onstop = async () => {
        const thinkingEl = document.createElement('p');
        thinkingEl.innerHTML = `<strong style='color: yellow;'>Roy is reflecting<span class="dot-dot-dot">.</span></strong>`;
        let dots = 1;
        const interval = setInterval(() => {
          dots = (dots % 3) + 1;
          thinkingEl.querySelector('.dot-dot-dot').textContent = '.'.repeat(dots);
        }, 500);
        thinkingEl.className = 'roy';
        messagesEl.appendChild(thinkingEl);
        messagesEl.scrollTop = messagesEl.scrollHeight;

        const blob = new Blob(recordedChunks, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('audio', blob);

        const res = await fetch('https://roy-chatbo-backend.onrender.com/api/transcribe', {
          method: 'POST',
          body: formData
        });

        const data = await res.json();
        clearInterval(interval);
        thinkingEl.remove();

        if (data.text) {
          appendMessage('You', data.text);
          fetchRoyResponse(data.text);
        } else {
          appendMessage('Roy', "I didn’t catch that. Can you try again?");
        }
      };

      mediaRecorder.start();
    }

    isRecording = true;
    micBtn.textContent = 'Stop';
    micBtn.classList.add('recording');
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

  // Roy's expressive personality
  const affirmations = [
    "Oh, ok.", "I see.", "Understood.", "Right.", "Got it.", "Hmm, okay.",
    "Alright.", "Sure.", "Okay then.", "Ah, I get it.", "Noted.", "Thanks for that.",
    "Fair enough.", "Mhm.", "All clear.", "Yup.", "Acknowledged.", "Heard you.",
    "Hmm, makes sense.", "Alright then.", "Following you.", "Yep, that tracks.",
    "That's clear.", "Right, makes sense.", "That adds up.", "Okay, I hear that.",
    "I'm with you.", "Yeah, alright.", "Crystal clear.", "That’s fair.", "Alright, continue."
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

  let lastRoyMessage = '';

  function getRandomAffirmation() {
    let options = affirmations.filter(a => !lastRoyMessage.includes(a));
    return options[Math.floor(Math.random() * options.length)] || '';
  }

  async function fetchRoyResponse(message) {
    const thinkingEl = document.createElement('p');
    thinkingEl.innerHTML = `<strong style='color: yellow;'>Roy is reflecting<span class="dot-dot-dot">.</span></strong>`;
    let dots = 1;
    const interval = setInterval(() => {
      dots = (dots % 3) + 1;
      thinkingEl.querySelector('.dot-dot-dot').textContent = '.'.repeat(dots);
    }, 500);
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

      clearInterval(interval);
      thinkingEl.remove();

      let responseText = data.text;

      if (Math.random() < 0.6) {
        const affirmation = getRandomAffirmation();
        responseText = `${affirmation}
${responseText}`;
      }

      if (Math.random() < 0.1) {
        const quote = quotes[Math.floor(Math.random() * quotes.length)];
        responseText = `${quote}

${responseText}`;
      }

      if (Math.random() < 0.15) {
        const prompt = binaryPrompts[Math.floor(Math.random() * binaryPrompts.length)];
        responseText += `

${prompt}`;
      }

      const shortMsg = message.toLowerCase().trim();
      if (["i don't know", "idk", "whatever", "nothing", "meh", "huh"].includes(shortMsg) || shortMsg.length < 5) {
        responseText = `It's okay not to know — but if you *did* know, what would it sound like?
${responseText}`;
      }

      if (/(god|religion|faith|divine|heaven|hell|pray)/i.test(message)) {
        responseText = `'What can be asserted without evidence can also be dismissed without evidence.' – Christopher Hitchens

${responseText}`;
      }

      const royLine = document.createElement('p');
      royLine.className = 'roy';
      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      royLine.innerHTML = `<strong style='color: yellow;'>Roy:</strong> <span style='color: yellow;'>${responseText}</span> <span style='font-size: 10px; color: #888;'>(${timestamp})</span>`;
      messagesEl.appendChild(royLine);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      lastRoyMessage = responseText;

      if ((modeSelect.value === 'voice' || modeSelect.value === 'both') && data.audio) {
        const audio = new Audio(`data:audio/mp3;base64,${data.audio}`);
        audio.play();
        drawWaveform(royCtx, royCanvas, audio, 'magenta');
      }
    } catch (err) {
      clearInterval(interval);
      thinkingEl.remove();
      appendMessage('Roy', 'A storm clouded my voice. Try again.');
    }
  }
});
