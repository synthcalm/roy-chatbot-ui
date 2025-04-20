// script.js for Roy Chatbot - fixed and restored

const royBtn = document.getElementById('royBtn');
const randyBtn = document.getElementById('randyBtn');
const speakBtn = document.getElementById('speakBtn');
const saveBtn = document.getElementById('saveBtn');
const messagesDiv = document.getElementById('messages');
const scope1 = document.getElementById('scope1');
const scope2 = document.getElementById('scope2');
const scopeCtx1 = scope1.getContext('2d');
const scopeCtx2 = scope2.getContext('2d');

let mediaRecorder, audioChunks = [], currentPersona = null, isRecording = false;

function addMessage(sender, text) {
  const msg = document.createElement('p');
  msg.className = sender;
  msg.textContent = `${sender === 'user' ? 'You' : sender === 'roy' ? 'Roy' : 'Randy'}: ${text}`;
  messagesDiv.appendChild(msg);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function drawScope(ctx) {
  ctx.clearRect(0, 0, 600, 100);
  ctx.beginPath();
  for (let i = 0; i < 600; i++) {
    const y = 50 + 30 * Math.sin(i * 0.05 + Date.now() * 0.005);
    ctx.lineTo(i, y);
  }
  ctx.strokeStyle = 'cyan';
  ctx.lineWidth = 1;
  ctx.stroke();
  if (isRecording) requestAnimationFrame(() => drawScope(ctx));
}

function startRecording() {
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.start();
      audioChunks = [];

      mediaRecorder.ondataavailable = e => audioChunks.push(e.data);

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('audio', audioBlob, 'audio.webm');

        fetch('/api/transcribe', {
          method: 'POST',
          body: formData
        })
          .then(res => res.json())
          .then(data => {
            if (data.text) {
              addMessage('user', data.text);
              sendToChatbot(data.text);
            }
          })
          .catch(err => console.error('Transcription failed:', err));
      };
    })
    .catch(err => console.error('Mic access failed:', err));
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  isRecording = false;
}

function sendToChatbot(text) {
  fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: text, persona: currentPersona })
  })
    .then(res => res.json())
    .then(data => {
      if (data.text) {
        addMessage(currentPersona, data.text);
      }
      if (data.audio) {
        const audio = new Audio(`data:audio/mp3;base64,${data.audio}`);
        audio.play();
      }
    })
    .catch(err => console.error('Chat failed:', err));
}

function resetButtonColors() {
  royBtn.style.backgroundColor = 'cyan';
  randyBtn.style.backgroundColor = 'cyan';
  speakBtn.style.backgroundColor = 'cyan';
  speakBtn.classList.remove('blinking');
  speakBtn.textContent = 'Speak';
}

royBtn.onclick = () => {
  resetButtonColors();
  royBtn.style.backgroundColor = 'green';
  speakBtn.style.backgroundColor = 'red';
  currentPersona = 'roy';
};

randyBtn.onclick = () => {
  resetButtonColors();
  randyBtn.style.backgroundColor = 'orange';
  speakBtn.style.backgroundColor = 'red';
  currentPersona = 'randy';
};

speakBtn.onclick = () => {
  if (isRecording) {
    stopRecording();
    speakBtn.classList.remove('blinking');
    speakBtn.textContent = 'Speak';
  } else {
    isRecording = true;
    drawScope(scopeCtx1);
    drawScope(scopeCtx2);
    startRecording();
    speakBtn.classList.add('blinking');
    speakBtn.textContent = 'STOP';
  }
};

saveBtn.onclick = () => {
  const allText = messagesDiv.textContent;
  const blob = new Blob([allText], { type: 'text/plain' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'chatlog.txt';
  link.click();
  resetButtonColors();
};

window.onload = () => {
  const greeting = 'Hey, I’m Roy. You ready to talk?';
  addMessage('roy', greeting);
};
