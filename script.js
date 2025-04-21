const royBtn = document.getElementById('royBtn');
const randyBtn = document.getElementById('randyBtn');
const speakBtn = document.getElementById('speakBtn');
const saveBtn = document.getElementById('saveBtn');
const homeBtn = document.getElementById('homeBtn');
const messagesDiv = document.getElementById('messages');
const userCanvas = document.getElementById('userWaveform');
const royCanvas = document.getElementById('royWaveform');
const scopesContainer = document.getElementById('scopes-container');
const userCtx = userCanvas.getContext('2d');
const royCtx = royCanvas.getContext('2d');
const dateTimeSpan = document.getElementById('date-time');
const countdownTimerSpan = document.getElementById('countdown-timer');

let mediaRecorder, audioChunks = [], isRecording = false;
let selectedPersona = null;
let userAudioContext = null;
let royAudioContext = null;
let royAudioSource = null;
let stream = null;
let pendingAudioBase64 = null; // Store base64 audio for playback

function initButtonStyles() {
  royBtn.style.border = '1px solid cyan';
  randyBtn.style.border = '1px solid cyan';
  saveBtn.style.border = '1px solid cyan';
  speakBtn.style.backgroundColor = 'black';
  speakBtn.style.color = 'cyan';
  speakBtn.style.border = '1px solid cyan';
}

function addMessage(text, sender, isThinking = false) {
  const msg = document.createElement('p');
  msg.className = sender;

  if (isThinking) {
    msg.classList.add('thinking');
    const baseText = text.endsWith('Thinking') ? text : `${text} Thinking`;
    msg.textContent = baseText;
    const dotsSpan = document.createElement('span');
    dotsSpan.className = 'thinking-dots';
    msg.appendChild(dotsSpan);
  } else {
    msg.textContent = text;
  }

  messagesDiv.appendChild(msg);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
  return msg;
}

function drawWaveform(canvasCtx, canvas, data, color, isUserWaveform) {
  canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
  canvasCtx.beginPath();

  const sliceWidth = canvas.width / data.length;
  const centerY = canvas.height / 2;
  const scale = isUserWaveform ? 50 : 80;

  for (let i = 0; i < data.length; i++) {
    const normalized = (data[i] / 128.0) - 1;
    const y = centerY + (normalized * scale);
    const x = i * sliceWidth;

    if (i === 0) canvasCtx.moveTo(x, y);
    else canvasCtx.lineTo(x, y);
  }

  canvasCtx.strokeStyle = color;
  canvasCtx.lineWidth = 2;
  canvasCtx.stroke();
}

function setupUserVisualization(stream) {
  if (userAudioContext && userAudioContext.state !== 'closed') userAudioContext.close();

  userAudioContext = new (window.AudioContext || window.webkitAudioContext)();
  const source = userAudioContext.createMediaStreamSource(stream);
  const analyser = userAudioContext.createAnalyser();
  analyser.fftSize = 2048;
  const dataArray = new Uint8Array(analyser.frequencyBinCount);

  source.connect(analyser);

  function animate() {
    if (!isRecording) {
      userCtx.clearRect(0, 0, userCanvas.width, userCanvas.height);
      return;
    }
    analyser.getByteTimeDomainData(dataArray);
    drawWaveform(userCtx, userCanvas, dataArray, 'yellow', true);
    requestAnimationFrame(animate);
  }

  animate();
}

function resumeAudioContext(context) {
  if (context.state === 'suspended') {
    return context.resume().then(() => {
      console.log('AudioContext resumed successfully');
    }).catch(err => {
      console.error('Failed to resume AudioContext:', err);
    });
  }
  return Promise.resolve();
}

function playRoyAudio(base64Audio) {
  const audioEl = new Audio(`data:audio/mp3;base64,${base64Audio}`);
  audioEl.setAttribute('playsinline', '');

  if (royAudioContext && royAudioContext.state !== 'closed') {
    try {
      if (royAudioSource) royAudioSource.disconnect();
      royAudioContext.close();
    } catch (e) {
      console.log('Error closing previous audio context:', e);
    }
  }

  royAudioContext = new (window.AudioContext || window.webkitAudioContext)();

  audioEl.addEventListener('error', (e) => {
    console.error('Audio element error:', e);
    console.error('Audio element error code:', audioEl.error?.code);
    console.error('Audio element error message:', audioEl.error?.message);

    // Convert base64 to Blob for download as a fallback
    const binaryString = atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const audioBlob = new Blob([bytes], { type: 'audio/mp3' });
    const audioUrl = URL.createObjectURL(audioBlob);

    addMessage('Error: Failed to play Roy/Randy\'s audio response. [Tap here to download audio](#)', 'roy', false);
    const errorMsg = messagesDiv.lastChild;
    errorMsg.style.cursor = 'pointer';
    errorMsg.addEventListener('click', () => {
      const a = document.createElement('a');
      a.href = audioUrl;
      a.download = `${selectedPersona}-response.mp3`;
      a.click();
    });
    speakBtn.textContent = 'SPEAK';
    speakBtn.classList.remove('blinking');
    speakBtn.style.backgroundColor = 'red';
    speakBtn.style.color = 'white';
    speakBtn.style.border = '1px solid red';
    cleanupRecording();
  });

  audioEl.addEventListener('canplaythrough', () => {
    console.log('Audio can play through');
    console.log('Audio readyState:', audioEl.readyState); // Should be 4 (HAVE_ENOUGH_DATA)

    resumeAudioContext(royAudioContext).then(() => {
      try {
        royAudioSource = royAudioContext.createMediaElementSource(audioEl);
        const analyser = royAudioContext.createAnalyser();
        analyser.fftSize = 2048;
        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        royAudioSource.connect(analyser);
        analyser.connect(royAudioContext.destination);

        let animationId;

        function animate() {
          analyser.getByteTimeDomainData(dataArray);
          const waveformColor = selectedPersona === 'randy' ? 'orange' : 'magenta';
          drawWaveform(royCtx, royCanvas, dataArray, waveformColor, false);
          animationId = requestAnimationFrame(animate);
        }

        audioEl.play().then(() => {
          console.log('Audio playback started');
          animate();
        }).catch(err => {
          console.error('Audio playback failed:', err);

          // Convert base64 to Blob for download as a fallback
          const binaryString = atob(base64Audio);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const audioBlob = new Blob([bytes], { type: 'audio/mp3' });
          const audioUrl = URL.createObjectURL(audioBlob);

          addMessage('Error: Failed to play Roy/Randy\'s audio response. [Tap here to download audio](#)', 'roy', false);
          const errorMsg = messagesDiv.lastChild;
          errorMsg.style.cursor = 'pointer';
          errorMsg.addEventListener('click', () => {
            const a = document.createElement('a');
            a.href = audioUrl;
            a.download = `${selectedPersona}-response.mp3`;
            a.click();
          });
          speakBtn.textContent = 'SPEAK';
          speakBtn.classList.remove('blinking');
          speakBtn.style.backgroundColor = 'red';
          speakBtn.style.color = 'white';
          speakBtn.style.border = '1px solid red';
          cleanupRecording();
        });

        audioEl.addEventListener('ended', () => {
          console.log('Audio playback
