<h2>🎤 Roy Audio Test (Bypass Hostinger, Direct Transcription Test)</h2>
<button id="recordBtn">🎙️ Start Recording</button>
<button id="stopBtn" disabled>🛑 Stop & Transcribe</button>
<p><strong>Transcription Result:</strong></p>
<div id="result">(waiting...)</div>
<p><strong>Playback:</strong></p>
<audio id="audioPlayback" controls style="margin-top: 10px; display:none;"></audio>

<script>
  let mediaRecorder, audioChunks = [], audioBlob;

  async function setupRecorder() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioCtx.createMediaStreamSource(stream);
    const gainNode = audioCtx.createGain();
    gainNode.gain.value = 3.0; // Boost volume

    const destination = audioCtx.createMediaStreamDestination();
    source.connect(gainNode).connect(destination);

    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    const mimeType = isSafari ? 'audio/wav' : 'audio/webm';

    try {
      mediaRecorder = new MediaRecorder(destination.stream, { mimeType });
    } catch (e) {
      console.warn('MIME type not supported, using default.');
      mediaRecorder = new MediaRecorder(destination.stream);
    }

    audioChunks = [];

    mediaRecorder.ondataavailable = e => audioChunks.push(e.data);

    mediaRecorder.onstop = async () => {
      audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType });
      
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

      document.getElementById('result').textContent = 'Uploading audio...';

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
</script>
