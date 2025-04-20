const royBtn = document.getElementById('royBtn');
const randyBtn = document.getElementById('randyBtn');
const speakBtn = document.getElementById('speakBtn');
const saveBtn = document.getElementById('saveBtn');
const messagesDiv = document.getElementById('messages');
const synthHomeBtn = document.getElementById('homeBtn');
const canvas1 = document.getElementById('scope1');
const canvas2 = document.getElementById('scope2');

let currentPersona = '';
let isRecording = false;

function setActivePersona(persona) {
  currentPersona = persona;
  royBtn.classList.remove('active-roy');
  randyBtn.classList.remove('active-randy');
  speakBtn.classList.remove('speak-standby', 'speak-blink', 'speak-ready');
  speakBtn.classList.add('speak-ready');

  if (persona === 'roy') {
    royBtn.classList.add('active-roy');
  } else if (persona === 'randy') {
    randyBtn.classList.add('active-randy');
  }
}

function resetButtons() {
  currentPersona = '';
  royBtn.classList.remove('active-roy');
  randyBtn.classList.remove('active-randy');
  speakBtn.classList.remove('speak-ready', 'speak-blink');
  speakBtn.classList.add('speak-standby');
}

function appendMessage(sender, text) {
  const message = document.createElement('div');
  message.className = sender + '-message';
  message.textContent = `${sender === 'user' ? 'You' : sender.charAt(0).toUpperCase() + sender.slice(1)}: ${text}`;
  messagesDiv.appendChild(message);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function simulateWaveform(canvas) {
  const ctx = canvas.getContext('2d');
  let x = 0;
  setInterval(() => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    ctx.moveTo(0, canvas.height / 2);
    for (let i = 0; i < canvas.width; i++) {
      ctx.lineTo(i, canvas.height / 2 + 20 * Math.sin((i + x) * 0.05));
    }
    ctx.strokeStyle = 'yellow';
    ctx.stroke();
    x += 2;
  }, 100);
}

speakBtn.addEventListener('click', async () => {
  if (!currentPersona) return;

  if (!isRecording) {
    isRecording = true;
    speakBtn.textContent = 'Stop';
    speakBtn.classList.add('speak-blink');

    // Simulate recording and response
    appendMessage('user', 'Hello?');

    const res = await fetch('https://roy-chatbo-backend.onrender.com/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Hello?',
        persona: currentPersona
      })
    });

    const data = await res.json();
    if (data && data.text) {
      appendMessage(currentPersona, data.text);
    }

    speakBtn.textContent = 'Speak';
    speakBtn.classList.remove('speak-blink');
    isRecording = false;
  }
});

royBtn.addEventListener('click', () => setActivePersona('roy'));
randyBtn.addEventListener('click', () => setActivePersona('randy'));
saveBtn.addEventListener('click', () => {
  const log = messagesDiv.textContent;
  const blob = new Blob([log], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'conversation.txt';
  a.click();
  resetButtons();
});

// Initialize
simulateWaveform(canvas1);
simulateWaveform(canvas2);
resetButtons();
appendMessage('roy', 'Hey there. You showed up. That means something.');
