// script.js – Roy Chatbot Modes: Enhanced TTS Style, Converse Mode, Prompt Tone Control

let isRecording = false;
let mediaRecorder, stream, chunks = [];
let userAudioContext, userAnalyser, userDataArray, userSource;
let royAudioContext, royAnalyser, royDataArray;

const sessionId = `session-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
const greetings = [
  "Welcome. I'm Roy. You may speak using 'Hands Free' or 'Speak' mode, or type below."
];

window.addEventListener('DOMContentLoaded', () => {
  const micBtn = document.getElementById('mic-toggle');
  const sendBtn = document.getElementById('send-button');
  const converseBtn = document.getElementById('converse-button');
  const saveBtn = document.getElementById('save-log');
  const inputEl = document.getElementById('user-input');
  const messagesEl = document.getElementById('messages');
  const audioEl = document.getElementById('roy-audio');
  const modeSelect = document.getElementById('responseMode');
  const userCanvas = document.getElementById('userWaveform');
  const royCanvas = document.getElementById('royWaveform');
  const userCtx = userCanvas.getContext('2d');
  const royCtx = royCanvas.getContext('2d');

  function drawGrid(ctx, width, height, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.5;
    for (let x = 0; x < width; x += 20) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    for (let y = 0; y < height; y += 20) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }
  }

  function drawUserWaveform() {
    if (!userAnalyser) return;
    requestAnimationFrame(drawUserWaveform);
    userAnalyser.getByteTimeDomainData(userDataArray);
    userCtx.fillStyle = '#000';
    userCtx.fillRect(0, 0, userCanvas.width, userCanvas.height);
    drawGrid(userCtx, userCanvas.width, userCanvas.height, 'rgba(0,255,255,0.3)');
    userCtx.lineWidth = 2;
    userCtx.strokeStyle = 'yellow';
    userCtx.beginPath();
    const sliceWidth = userCanvas.width / userDataArray.length;
    let x = 0;
    for (let i = 0; i < userDataArray.length; i++) {
      const v = userDataArray[i] / 128.0;
      const y = v * userCanvas.height / 2;
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
    drawGrid(royCtx, royCanvas.width, royCanvas.height, 'rgba(0,255,255,0.3)');
    royCtx.lineWidth = 2;
    royCtx.strokeStyle = 'magenta';
    royCtx.beginPath();
    const sliceWidth = royCanvas.width / royDataArray.length;
    let x = 0;
    for (let i = 0; i < royDataArray.length; i++) {
      const v = royDataArray[i] / 128.0;
      const y = v * royCanvas.height / 2;
      i === 0 ? royCtx.moveTo(x, y) : royCtx.lineTo(x, y);
      x += sliceWidth;
    }
    royCtx.lineTo(royCanvas.width, royCanvas.height / 2);
    royCtx.stroke();
  }

  function appendMessage(sender, text) {
    const p = document.createElement('p');
    p.classList.add(sender.toLowerCase() === 'you' ? 'user' : 'roy');
    p.innerHTML = `<strong>${sender}:</strong> `;
    messagesEl.appendChild(p);

    if (sender === 'Roy') {
      let i = 0;
      const typeInterval = setInterval(() => {
        if (i < text.length) {
          p.innerHTML += text.charAt(i++);
          messagesEl.scrollTop = messagesEl.scrollHeight;
        } else {
          clearInterval(typeInterval);
        }
      }, 10);
    } else {
      p.innerHTML += text;
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  }

  async function fetchRoyResponse(message) {
    if (!message || typeof message !== 'string') return;
    appendMessage('You', message);
    inputEl.value = '';

    const res = await fetch('https://roy-chatbo-backend.onrender.com/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        sessionId,
        tone: "Short, human-like, emotional intelligence. Add natural expressions like 'Mmhh', 'Correct...', or 'That's what we want'. Be sometimes fast, sometimes slow or loud. Emphasize naturally. Avoid robotic tone."
      })
    });

    if (!res.ok) {
      console.error('Chat error:', await res.text());
      return;
    }

    const data = await res.json();
    if (modeSelect.value !== 'voice') appendMessage('Roy', data.text);

    if (modeSelect.value !== 'text') {
      audioEl.src = `data:audio/mp3;base64,${data.audio}`;
      audioEl.style.display = 'none';
      audioEl.play();

      royAudioContext = new (window.AudioContext || window.webkitAudioContext)();
      royAnalyser = royAudioContext.createAnalyser();
      royAnalyser.fftSize = 2048;
      royDataArray = new Uint8Array(royAnalyser.frequencyBinCount);

      const source = royAudioContext.createMediaElementSource(audioEl);
      source.connect(royAnalyser);
      royAnalyser.connect(royAudioContext.destination);
      drawRoyWaveform();
    }
  }

  const greeting = greetings[Math.floor(Math.random() * greetings.length)];
  appendMessage('Roy', greeting);
});
