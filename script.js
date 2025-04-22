const userCanvas = document.getElementById('userWaveform');
const royCanvas = document.getElementById('royWaveform');
const userCtx = userCanvas.getContext('2d');
const royCtx = royCanvas.getContext('2d');
let userAudioContext = null;
let userAnalyser = null;
let userSource = null;

function setupUserVisualization(stream) {
  userAudioContext = new (window.AudioContext || window.webkitAudioContext)();
  userAnalyser = userAudioContext.createAnalyser();
  userSource = userAudioContext.createMediaStreamSource(stream);
  userSource.connect(userAnalyser);

  const dataArray = new Uint8Array(userAnalyser.frequencyBinCount);
  function animate() {
    if (!isRecording) return;
    requestAnimationFrame(animate);
    userAnalyser.getByteTimeDomainData(dataArray);
    drawWaveform(userCtx, dataArray, 'yellow'); // Yellow for the user waveform
  }
  animate();
}

function drawWaveform(ctx, dataArray, color) {
  ctx.clearRect(0, 0, userCanvas.width, userCanvas.height);
  ctx.beginPath();
  for (let i = 0; i < dataArray.length; i++) {
    const x = (i / dataArray.length) * userCanvas.width;
    const y = userCanvas.height / 2 + (dataArray[i] - 128); // Centered vertically
    ctx.lineTo(x, y);
  }
  ctx.strokeStyle = color;
  ctx.stroke();
}

// Now we ensure user’s microphone input is processed
function startUserRecording() {
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then((stream) => {
      setupUserVisualization(stream); // Starts the waveform visualization for the user
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.start();
      mediaRecorder.ondataavailable = (event) => {
        // Collect audio data
      };
      mediaRecorder.onstop = () => {
        // Stop recording and process the audio
      };
    })
    .catch((err) => {
      console.error('Error accessing microphone:', err);
    });
}
