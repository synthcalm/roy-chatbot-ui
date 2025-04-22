const royBtn = document.getElementById('royBtn');
const randyBtn = document.getElementById('randyBtn');
const speakBtn = document.getElementById('speakBtn');
const resultDiv = document.getElementById('result');
const replyDiv = document.getElementById('reply');
const audioPlayback = document.getElementById('audioPlayback');

let selectedPersona = null;
let mediaRecorder, audioChunks = [], isRecording = false;

royBtn.addEventListener('click', () => selectPersona('roy'));
randyBtn.addEventListener('click', () => selectPersona('randy'));

function selectPersona(persona) {
  selectedPersona = persona;
  royBtn.classList.remove('active');
  randyBtn.classList.remove('active');
  if (persona === 'roy') royBtn.classList.add('active');
  if (persona === 'randy') randyBtn.classList.add('active');
  speakBtn.disabled = false;
}

speakBtn.addEventListener('click', async () => {
  if (!selectedPersona) {
    alert('Select Roy or Randy first!');
    return;
  }

  if (isRecording) {
    mediaRecorder.stop();
    speakBtn.textContent = 'SPEAK';
    isRecording = false;
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];
    isRecording = true;
    speakBtn.textContent = 'STOP';

    mediaRecorder.ondataavailable = e => audioChunks.push(e.data);

    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType });
      const formData = new FormData();
      formData.append('audio', audioBlob);
      resultDiv.textContent = 'Transcribing...';

      try {
        const res = await fetch('https://roy-chatbo-backend.onrender.com/api/transcribe', { method: 'POST', body: formData });
        const data = await res.json();
        const userText = data.text || '(No transcription)';
        resultDiv.textContent = `You: ${userText}`;

        replyDiv.innerHTML = '<span class="thinking-dots">Thinking</span>';

        const chatRes = await fetch('https://roy-chatbo-backend.onrender.com/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: userText, persona: selectedPersona })
        });
        const chatData = await chatRes.json();
        replyDiv.textContent = `${selectedPersona === 'randy' ? 'Randy' : 'Roy'}: ${chatData.text}`;

        if (chatData.audio) {
          audioPlayback.src = `data:audio/mp3;base64,${chatData.audio}`;
          audioPlayback.style.display = 'block';
          audioPlayback.play();
        } else {
          audioPlayback.style.display = 'none';
        }

      } catch (error) {
        console.error('Error:', error);
        resultDiv.textContent = 'Transcription failed.';
        replyDiv.textContent = 'No reply.';
      }
    };

    mediaRecorder.start();
  } catch (err) {
    console.error('Microphone error:', err);
    alert('Microphone access denied or error.');
  }
});
