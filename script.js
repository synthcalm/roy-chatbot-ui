// script.js

let currentPersona = 'roy';
let mediaRecorder;
let audioChunks = [];
const messagesDiv = document.getElementById('messages');
const royBtn = document.getElementById('royBtn');
const randyBtn = document.getElementById('randyBtn');
const speakBtn = document.getElementById('speakBtn');
const saveBtn = document.getElementById('saveBtn');

function setActivePersona(persona) {
  currentPersona = persona;
  royBtn.style.backgroundColor = persona === 'roy' ? 'green' : '';
  randyBtn.style.backgroundColor = persona === 'randy' ? 'orange' : '';
  speakBtn.style.backgroundColor = 'red';
}

function resetButtonStyles() {
  royBtn.style.backgroundColor = '';
  randyBtn.style.backgroundColor = '';
  speakBtn.style.backgroundColor = '';
}

function addMessage(role, text) {
  const p = document.createElement('p');
  p.innerHTML = `<strong>${role}:</strong> ${text}`;
  p.style.color = role === 'Roy' ? 'yellow' : 'white';
  messagesDiv.appendChild(p);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function downloadTranscript() {
  let content = '';
  document.querySelectorAll('#messages p').forEach(p => {
    content += p.textContent + '\n';
  });
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'chatlog.txt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  resetButtonStyles();
}

async function sendAudioToBackend(audioBlob) {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'audio.webm');

  const transcribeRes = await fetch('/api/transcribe', {
    method: 'POST',
    body: formData
  });

  if (!transcribeRes.ok) {
    console.error('Transcription failed');
    return;
  }

  const { text } = await transcribeRes.json();
  addMessage('You', text);

  const chatRes = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: text, persona: currentPersona })
  });

  const chatData = await chatRes.json();
  addMessage('Roy', chatData.text);

  const audio = new Audio(`data:audio/mp3;base64,${chatData.audio}`);
  audio.play();
}

async function startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(stream);

  audioChunks = [];
  mediaRecorder.ondataavailable = e => audioChunks.push(e.data);

  mediaRecorder.onstop = () => {
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
    sendAudioToBackend(audioBlob);
  };

  mediaRecorder.start();
}

royBtn.onclick = () => setActivePersona('roy');
randyBtn.onclick = () => setActivePersona('randy');
saveBtn.onclick = downloadTranscript;

let isRecording = false;
speakBtn.onclick = () => {
  if (!isRecording) {
    speakBtn.textContent = 'Stop';
    speakBtn.classList.add('blinking');
    startRecording();
  } else {
    speakBtn.textContent = 'Speak';
    speakBtn.classList.remove('blinking');
    mediaRecorder.stop();
  }
  isRecording = !isRecording;
};
