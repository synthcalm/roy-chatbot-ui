let recognition, audioContext, analyser, dataArray, source;
let outputAudioContext, outputAnalyser, outputDataArray, outputSource;
let isRecording = false;
let userStream;
let currentTranscript = '';
let lastTranscript = '';
let speakBtn, canvas, ctx;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  speakBtn = document.getElementById('speak-btn') || createButton('speak-btn', 'SPEAK');
  canvas = document.getElementById('waveform-canvas') || createCanvas('waveform-canvas');
  ctx = canvas.getContext('2d');
  setupCanvas();
  speakBtn.addEventListener('click', toggleRecording);
  displayGreeting();
});

// Create button if not found
function createButton(id, text) {
  const btn = document.createElement('button');
  btn.id = id;
  btn.innerText = text;
  document.body.appendChild(btn);
  return btn;
}

// Create canvas if not found
function createCanvas(id) {
  const canvas = document.createElement('canvas');
  canvas.id = id;
  canvas.width = window.innerWidth - 40;
  canvas.height = 200;
  document.body.appendChild(canvas);
  return canvas;
}

// Setup canvas dimensions and initial state
function setupCanvas() {
  canvas.width = window.innerWidth - 40;
  canvas.height = 200;
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'white';
  ctx.font = '20px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Press SPEAK to start recording...', canvas.width / 2, canvas.height / 2);
}

// Display greeting message
function displayGreeting() {
  appendRoyMessage('Hello! I’m Roy. Press the SPEAK button and say something to get started.');
}

// Toggle recording on button click
function toggleRecording() {
  if (!isRecording) {
    startTranscription(ctx, canvas);
    speakBtn.classList.add('active');
    speakBtn.innerText = 'STOP';
  } else {
    stopUserRecording();
  }
}

// Start transcription with improved compatibility and error handling
function startTranscription(ctx, canvas) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert('Speech recognition not supported in this browser. Please use Chrome or Safari.');
    appendRoyMessage('Speech recognition not supported. Try a different browser.');
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
      userStream = stream;
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      if (audioContext.state === 'suspended') {
        audioContext.resume()
          .then(() => console.log('AudioContext resumed successfully.'))
          .catch(err => {
            console.error('Failed to resume AudioContext:', err);
            alert('Please interact with the page to enable audio.');
          });
      }
      source = audioContext.createMediaStreamSource(stream);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      dataArray = new Uint8Array(analyser.frequencyBinCount);
      source.connect(analyser);
      isRecording = true;
      drawMergedWaveform(ctx, canvas);
      recognition.start();
    })
    .catch(err => {
      console.error('Failed to access microphone:', err);
      alert('Could not access your microphone. Please check permissions and try again.');
      appendRoyMessage('Microphone access failed. Please check permissions.');
      stopUserRecording();
    });

  recognition.onresult = event => {
    let tempTranscript = Array.from(event.results)
      .map(result => result[0].transcript)
      .join('')
      .trim();
    if (tempTranscript && tempTranscript !== lastTranscript) {
      currentTranscript = tempTranscript;
      lastTranscript = tempTranscript;
      appendRoyMessage(`You said: "${currentTranscript}"`);
    }
  };

  recognition.onend = () => {
    if (isRecording) {
      setTimeout(() => recognition.start(), 1000);
    }
  };

  recognition.onerror = event => {
    console.error('Recognition error:', event.error);
    if (isRecording) {
      recognition.stop();
      setTimeout(() => recognition.start(), 1000);
    }
  };
}

// Stop user recording and clean up
function stopUserRecording() {
  isRecording = false;
  if (recognition) recognition.stop();
  if (userStream) userStream.getTracks().forEach(track => track.stop());
  if (audioContext && audioContext.state !== 'closed') audioContext.close();
  speakBtn.classList.remove('active');
  speakBtn.innerText = 'SPEAK';
  if (currentTranscript.trim() !== '') {
    sendToRoy(currentTranscript);
  } else {
    appendRoyMessage("Hmm... didn't catch that. Try saying something?");
  }
  currentTranscript = '';
  lastTranscript = '';
  setupCanvas(); // Reset canvas
}

// Placeholder for sending transcript to "Roy" (e.g., backend or processing logic)
function sendToRoy(transcript) {
  console.log('Sending to Roy:', transcript);
  appendRoyMessage(`Processing: "${transcript}"`);
}

// Append Roy's message to the UI
function appendRoyMessage(message) {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'roy-message';
  messageDiv.innerText = message;
  document.body.appendChild(messageDiv);
  messageDiv.scrollIntoView();
}

// Draw waveform on canvas
function drawMergedWaveform(ctx, canvas) {
  if (!isRecording) return;
  requestAnimationFrame(() => drawMergedWaveform(ctx, canvas));
  analyser.getByteTimeDomainData(dataArray);
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'cyan';
  ctx.beginPath();

  const sliceWidth = canvas.width / dataArray.length;
  let x = 0;

  for (let i = 0; i < dataArray.length; i++) {
    const v = dataArray[i] / 128.0;
    const y = (v * canvas.height) / 2;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
    x += sliceWidth;
  }

  ctx.lineTo(canvas.width, canvas.height / 2);
  ctx.stroke();
}
