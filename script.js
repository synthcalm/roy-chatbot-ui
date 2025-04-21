let mediaRecorder;
let audioChunks = [];
let currentPersona = null;

const royBtn = document.getElementById('royBtn');
const randyBtn = document.getElementById('randyBtn');
const speakBtn = document.getElementById('speakBtn');
const output = document.getElementById('output');

royBtn.addEventListener('click', () => selectPersona('roy'));
randyBtn.addEventListener('click', () => selectPersona('randy'));
speakBtn.addEventListener('click', toggleRecording);

function selectPersona(persona) {
  currentPersona = persona;

  royBtn.classList.remove('active');
  randyBtn.classList.remove('active');

  if (persona === 'roy') {
    royBtn.classList.add('active');
    speakBtn.style.backgroundColor = 'red';
  } else {
    randyBtn.classList.add('active');
    speakBtn.style.backgroundColor = 'orange';
  }
}

async function toggleRecording() {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') {
    startRecording();
  } else {
    stopRecording();
  }
}

async function startRecording() {
  speakBtn.textContent = 'STOP';
  speakBtn.classList.add('blinking');

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

  let mimeType = 'audio/webm';
  if (/iPhone|iPad|iPod|Safari/i.test(navigator.userAgent) && !window.MSStream) {
    mimeType = 'audio/mp4';
  }

  mediaRecorder = new MediaRecorder(stream, { mimeType });

  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      audioChunks.push(event.data);
    }
  };

  mediaRecorder.onstop = async () => {
    speakBtn.classList.remove('blinking');
    speakBtn.textContent = 'Speak';

    const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType });
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.' + mediaRecorder.mimeType.split('/')[1]);

    try {
      const chatRes = await fetch('/api/chat', {
        method: 'POST',
        body: formData
      });

      const chatData = await chatRes.json();

      if (chatData.error) {
        output.textContent = `Error: ${chatData.error}`;
        return;
      }

      output.textContent = `You: (spoken)\nRoy: ${chatData.text}`;
      playAudio(chatData.audio);
    } catch (err) {
      output.textContent = 'Roy: Transcription or chat failed.';
      console.error(err);
    }

    audioChunks = [];
  };

  audioChunks = [];
  mediaRecorder.start();
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
}

function playAudio(base64Audio) {
  const audio = new Audio(`data:audio/mp3;base64,${base64Audio}`);
  audio.play();
}
