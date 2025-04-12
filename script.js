const micBtn = document.getElementById('mic-toggle');
const sendBtn = document.getElementById('send-button');
const inputEl = document.getElementById('user-input');
const messagesEl = document.getElementById('messages');
const audioEl = document.getElementById('roy-audio');
let isRecording = false;
let mediaRecorder, stream, chunks = [];

// Clock
setInterval(() => {
  const now = new Date();
  document.getElementById('current-date').textContent = now.toISOString().split('T')[0];
  document.getElementById('current-time').textContent = now.toTimeString().split(' ')[0];
}, 1000);

micBtn.addEventListener('click', async () => {
  if (!isRecording) {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    chunks = [];
    mediaRecorder.ondataavailable = e => chunks.push(e.data);
    mediaRecorder.onstop = async () => {
      const blob = new Blob(chunks, { type: 'audio/webm' });
      const formData = new FormData();
      formData.append('audio', blob);
      const res = await fetch('https://roy-chatbo-backend.onrender.com/api/transcribe', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      inputEl.value = data.text || '';
    };
    mediaRecorder.start();
    micBtn.classList.add('recording');
    micBtn.textContent = '🛑 Stop';
    isRecording = true;
  } else {
    mediaRecorder.stop();
    stream.getTracks().forEach(track => track.stop());
    micBtn.classList.remove('recording');
    micBtn.textContent = '🎙️ Speak';
    isRecording = false;
  }
});

sendBtn.addEventListener('click', async () => {
  const message = inputEl.value.trim();
  if (!message) return;

  appendMessage('You', message);
  inputEl.value = '';

  const res = await fetch('https://roy-chatbo-backend.onrender.com/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, userId: 'guest' })
  });
  const data = await res.json();

  appendMessage('Roy', data.text);
  audioEl.src = `data:audio/mp3;base64,${data.audio}`;
  audioEl.style.display = 'block';
  audioEl.play();
});

function appendMessage(sender, text) {
  const p = document.createElement('p');
  p.innerHTML = `<strong>${sender}:</strong> ${text}`;
  messagesEl.appendChild(p);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}
