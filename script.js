let currentPersona = 'roy';
let isRecording = false;
let mediaRecorder;
let audioChunks = [];

const royBtn = document.getElementById('royBtn');
const randyBtn = document.getElementById('randyBtn');
const speakBtn = document.getElementById('speakBtn');
const saveBtn = document.getElementById('saveBtn');
const messagesDiv = document.getElementById('messages');
const synthBtn = document.getElementById('synthcalmBtn');

function updateButtons() {
  royBtn.className = 'btn';
  randyBtn.className = 'btn';
  speakBtn.className = 'btn speak-standby';

  if (currentPersona === 'roy') {
    royBtn.classList.add('active-roy');
    speakBtn.classList.remove('speak-standby');
    speakBtn.classList.add('speak-ready');
  } else if (currentPersona === 'randy') {
    randyBtn.classList.add('active-randy');
    speakBtn.classList.remove('speak-standby');
    speakBtn.classList.add('speak-ready');
  }
}

function toggleBlink(state) {
  if (state) {
    speakBtn.textContent = 'Stop';
    speakBtn.classList.add('speak-blink');
  } else {
    speakBtn.textContent = 'Speak';
    speakBtn.classList.remove('speak-blink');
  }
}

function addMessage(sender, text) {
  const p = document.createElement('p');
  p.className = sender === 'user' ? 'user-message' : (currentPersona === 'randy' ? 'randy-message' : 'roy-message');
  p.innerHTML = `<strong>${sender === 'user' ? 'You' : (currentPersona === 'randy' ? 'Randy' : 'Roy')}:</strong> ${text}`;
  messagesDiv.appendChild(p);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

royBtn.onclick = () => {
  currentPersona = 'roy';
  updateButtons();
}

randyBtn.onclick = () => {
  currentPersona = 'randy';
  updateButtons();
}

saveBtn.onclick = () => {
  updateButtons();
  speakBtn.textContent = 'Speak';
  const text = messagesDiv.innerText;
  const blob = new Blob([text], { type: 'text/plain' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'conversation.txt';
  link.click();
  messagesDiv.innerHTML = '';
}

speakBtn.onclick = async () => {
  if (isRecording) {
    toggleBlink(false);
    mediaRecorder.stop();
    isRecording = false;
  } else {
    toggleBlink(true);
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];

    mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      const formData = new FormData();
      formData.append('audio', audioBlob);

      try {
        const transcription = await fetch('/api/transcribe', {
          method: 'POST',
          body: formData
        }).then(res => res.json());

        const userInput = transcription.text;
        addMessage('user', userInput);

        const chatRes = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: userInput, persona: currentPersona })
        }).then(res => res.json());

        const botText = chatRes.text;
        const botAudio = chatRes.audio;
        addMessage('roy', botText);

        const audio = new Audio('data:audio/mp3;base64,' + botAudio);
        audio.play();
      } catch (err) {
        console.error('Transcription failed:', err);
      } finally {
        toggleBlink(false);
      }
    }

    mediaRecorder.start();
    isRecording = true;
  }
}

window.onload = () => {
  currentPersona = 'roy';
  updateButtons();
  addMessage('roy', "Hey there. You showed up. That means something.");
};
