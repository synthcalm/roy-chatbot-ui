// ✅ script.js - Restored version with full functionality + API endpoints fixed for Render backend

const royBtn = document.getElementById('royBtn');
const randyBtn = document.getElementById('randyBtn');
const speakBtn = document.getElementById('speakBtn');
const saveBtn = document.getElementById('saveBtn');
const homeBtn = document.getElementById('homeBtn');
const messagesDiv = document.getElementById('messages');
const userCanvas = document.getElementById('userWaveform');
const royCanvas = document.getElementById('royWaveform');
const userCtx = userCanvas.getContext('2d');
const royCtx = royCanvas.getContext('2d');

let mediaRecorder, audioChunks = [], isRecording = false;
let selectedPersona = null;

function addMessage(text, sender) {
  const msg = document.createElement('p');
  msg.className = sender;
  msg.textContent = text;
  messagesDiv.appendChild(msg);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function drawScope(canvasCtx, canvas, data, color) {
  canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
  canvasCtx.beginPath();
  for (let i = 0; i < data.length; i++) {
    canvasCtx.lineTo(i * (canvas.width / data.length), canvas.height - data[i]);
  }
  canvasCtx.strokeStyle = color;
  canvasCtx.stroke();
}

function resetButtonColors() {
  royBtn.style.backgroundColor = 'cyan';
  randyBtn.style.backgroundColor = 'cyan';
  speakBtn.style.backgroundColor = 'cyan';
}

royBtn.addEventListener('click', () => {
  resetButtonColors();
  selectedPersona = 'roy';
  royBtn.style.backgroundColor = 'green';
  speakBtn.style.backgroundColor = 'red';
});

randyBtn.addEventListener('click', () => {
  resetButtonColors();
  selectedPersona = 'randy';
  randyBtn.style.backgroundColor = 'orange';
  speakBtn.style.backgroundColor = 'red';
});

speakBtn.addEventListener('click', async () => {
  if (!selectedPersona) return alert('Please choose Roy or Randy.');
  if (isRecording) return;
  isRecording = true;
  speakBtn.textContent = 'STOP';
  speakBtn.classList.add('blinking');

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(stream);
  audioChunks = [];

  mediaRecorder.ondataavailable = (e) => {
    audioChunks.push(e.data);
  };

  mediaRecorder.onstop = async () => {
    speakBtn.textContent = 'Speak';
    speakBtn.classList.remove('blinking');
    isRecording = false;
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
    const formData = new FormData();
    formData.append('audio', audioBlob);

    try {
      const transcribeRes = await fetch('https://roy-chatbo-backend.onrender.com/api/transcribe', {
        method: 'POST',
        body: formData
      });
      const { text } = await transcribeRes.json();
      addMessage('You: ' + text, 'user');

      const chatRes = await fetch('https://roy-chatbo-backend.onrender.com/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, persona: selectedPersona })
      });
      const { text: reply, audio } = await chatRes.json();
      addMessage(`${selectedPersona === 'randy' ? 'Randy' : 'Roy'}: ${reply}`, 'bot');

      const audioEl = new Audio('data:audio/mp3;base64,' + audio);
      audioEl.play();
    } catch (e) {
      console.error('Transcription failed:', e);
    }
  };

  mediaRecorder.start();
  setTimeout(() => {
    mediaRecorder.stop();
  }, 5000);
});

saveBtn.addEventListener('click', () => {
  const blob = new Blob([messagesDiv.innerText], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'conversation.txt';
  a.click();
  resetButtonColors();
});

homeBtn.addEventListener('click', () => {
  window.location.href = 'https://synthcalm.com';
});

window.onload = () => {
  addMessage('Roy: Hey, I’m here whenever you need me.', 'bot');
};
