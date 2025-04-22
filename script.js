let mediaRecorder, audioChunks = [], audioBlob;

async function setupRecorder() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const source = audioCtx.createMediaStreamSource(stream);
  const gainNode = audioCtx.createGain();
  gainNode.gain.value = 3.0; // Boost volume

  const destination = audioCtx.createMediaStreamDestination();
  source.connect(gainNode).connect(destination);

  mediaRecorder = new MediaRecorder(destination.stream);
  audioChunks = [];

  mediaRecorder.ondataavailable = e => audioChunks.push(e.data);

  mediaRecorder.onstop = async () => {
    audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType });

    console.log('Blob size:', audioBlob.size, 'MIME type:', mediaRecorder.mimeType);

    if (audioBlob.size < 2000) {
      document.getElementById('result').textContent = 'Audio too faint or silent. Please try again.';
      return;
    }

    const audioURL = URL.createObjectURL(audioBlob);
    const audioPlayback = document.getElementById('audioPlayback');
    audioPlayback.src = audioURL;
    audioPlayback.style.display = 'block';

    const formData = new FormData();
    formData.append('audio', audioBlob);

    document.getElementById('result').textContent = 'Uploading and transcribing...';

    try {
      const res = await fetch('https://roy-chatbo-backend.onrender.com/api/transcribe', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      document.getElementById('result').textContent = data.text || '(No text returned)';
    } catch (err) {
      document.getElementById('result').textContent = 'Transcription failed.';
      console.error('[Transcription Error]', err);
    }
  };
}

document.getElementById('recordBtn').onclick = async () => {
  await setupRecorder();
  mediaRecorder.start();
  document.getElementById('recordBtn').disabled = true;
  document.getElementById('stopBtn').disabled = false;
};

document.getElementById('stopBtn').onclick = () => {
  mediaRecorder.stop();
  document.getElementById('recordBtn').disabled = false;
  document.getElementById('stopBtn').disabled = true;
};
