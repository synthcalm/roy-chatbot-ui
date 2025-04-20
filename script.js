async function startRecording() {
  try {
    // Request microphone access
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    unlockAudioContext(); // Ensure AudioContext is running

    // Set up MediaRecorder for recording
    mediaRecorder = new MediaRecorder(stream);
    chunks = [];

    mediaRecorder.ondataavailable = (e) => {
      chunks.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      const blob = new Blob(chunks, { type: 'audio/webm' });
      const formData = new FormData();
      formData.append('audio', blob, 'recording.webm');

      // Send the recorded audio to the backend
      const response = await fetch(`${BACKEND_URL}/process-audio`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();

      // Display Roy/Randy's response
      const msg = document.createElement('p');
      msg.className = isRantMode ? 'randy' : 'roy';
      msg.innerHTML = `<em>${isRantMode ? 'Randy' : 'Roy'}:</em> ${data.text}`;
      messagesDiv.appendChild(msg);
      messagesDiv.scrollTop = messagesDiv.scrollHeight;

      // Play the audio response if provided
      if (data.audio) {
        playRoyAudio(data.audio);
      }

      // Stop the stream
      stream.getTracks().forEach(track => track.stop());
    };

    // Set up audio visualization for user input
    source = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    dataArray = new Uint8Array(analyser.frequencyBinCount);

    function drawUserWaveform() {
      analyser.getByteFrequencyData(dataArray);
      userCtx.clearRect(0, 0, userWaveform.width, userWaveform.height);
      userCtx.beginPath();
      for (let i = 0; i < dataArray.length; i++) {
        const value = dataArray[i];
        userCtx.lineTo(i * (userWaveform.width / dataArray.length), userWaveform.height - value);
      }
      userCtx.strokeStyle = 'cyan';
      userCtx.stroke();
      if (isRecording) requestAnimationFrame(drawUserWaveform);
    }

    drawUserWaveform();
    mediaRecorder.start();
    isRecording = true;

    // Session timer
    sessionStartTime = new Date();
  } catch (error) {
    console.error('Error starting recording:', error);
    isRecording = false;
    speakToggle.textContent = 'Speak';
    speakToggle.style.background = 'black';
    speakToggle.style.color = 'red';
    speakToggle.style.borderColor = 'red';
    speakToggle.style.animation = 'blinker 1s linear infinite';
  }
}

function stopRecording() {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') return;
  mediaRecorder.stop();
  isRecording = false;
  sessionStartTime = null;
  userCtx.clearRect(0, 0, userWaveform.width, userWaveform.height);
}
