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
  if (!base64Audio) {
    console.error('No base64 audio data received');
    addMessage('Error: No audio response received from Roy/Randy', 'roy');
    speakBtn.textContent = 'SPEAK';
    speakBtn.classList.remove('blinking');
    speakBtn.style.backgroundColor = 'red';
    speakBtn.style.color = 'white';
    speakBtn.style.border = '1px solid red';
    cleanupRecording();
    return;
  }

  console.log('Base64 audio length:', base64Audio.length);
  console.log('Base64 audio snippet:', base64Audio.substring(0, 50));

  // Convert base64 to binary
  const binaryString = atob(base64Audio);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Create a Blob and Blob URL for playback
  const audioBlob = new Blob([bytes], { type: 'audio/mp3' });
  const audioUrl = URL.createObjectURL(audioBlob);
  const audioEl = new Audio(audioUrl);
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
    addMessage('Error: Failed to play Roy/Randy\'s audio response.', 'roy', false);
    speakBtn.textContent = 'SPEAK';
    speakBtn.classList.remove('blinking');
    speakBtn.style.backgroundColor = 'red';
    speakBtn.style.color = 'white';
    speakBtn.style.border = '1px solid red';
    cleanupRecording();
    URL.revokeObjectURL(audioUrl);
  });

  audioEl.addEventListener('canplaythrough', () => {
    console.log('Audio can play through');
    console.log('Audio readyState:', audioEl.readyState);

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
          addMessage('Error: Failed to play Roy/Randy\'s audio response.', 'roy', false);
          speakBtn.textContent = 'SPEAK';
          speakBtn.classList.remove('blinking');
          speakBtn.style.backgroundColor = 'red';
          speakBtn.style.color = 'white';
          speakBtn.style.border = '1px solid red';
          cleanupRecording();
          URL.revokeObjectURL(audioUrl);
        });

        audioEl.addEventListener('ended', () => {
          console.log('Audio playback ended');
          cancelAnimationFrame(animationId);
          royCtx.clearRect(0, 0, royCanvas.width, royCanvas.height);
          speakBtn.textContent = 'SPEAK';
          speakBtn.classList.remove('blinking');
          speakBtn.style.backgroundColor = 'red';
          speakBtn.style.color = 'white';
          speakBtn.style.border = '1px solid red';
          cleanupRecording();
          URL.revokeObjectURL(audioUrl);
        });

      } catch (error) {
        console.error('Audio visualization failed:', error);
        audioEl.play().catch(err => {
          console.error('Fallback audio playback failed:', err);
          addMessage('Error: Failed to play Roy/Randy\'s audio response.', 'roy', false);
          cleanupRecording();
          URL.revokeObjectURL(audioUrl);
        });
      }
    });
  });

  audioEl.addEventListener('loadeddata', () => {
    console.log('Audio data loaded, duration:', audioEl.duration);
  });

  audioEl.load();
}

function resetButtonColors() {
  royBtn.style.backgroundColor = 'black';
  royBtn.style.color = 'cyan';
  royBtn.style.border = '1px solid cyan';

  randyBtn.style.backgroundColor = 'black';
  randyBtn.style.color = 'cyan';
  randyBtn.style.border = '1px solid cyan';

  speakBtn.style.backgroundColor = 'black';
  speakBtn.style.color = 'cyan';
  speakBtn.style.border = '1px solid cyan';
  speakBtn.textContent = 'SPEAK';
  speakBtn.classList.remove('blinking');

  isRecording = false;
  selectedPersona = null;

  userCtx.clearRect(0, 0, userCanvas.width, userCanvas.height);
  royCtx.clearRect(0, 0, royCanvas.width, royCanvas.height);
}

function updateDateTime() {
  const now = new Date();
  const date = now.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
  const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true });
  dateTimeSpan.textContent = `${date}   ${time}`;
  setTimeout(updateDateTime, 60000);
}

function startCountdownTimer() {
  let timeLeft = 60 * 60; // 60 minutes

  const timer = setInterval(() => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    countdownTimerSpan.textContent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    timeLeft--;

    if (timeLeft < 0) {
      clearInterval(timer);
      countdownTimerSpan.textContent = '0:00';
    }
  }, 1000);
}

async function convertToWav(blob) {
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    const numberOfChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const length = audioBuffer.length * numberOfChannels * 2; // 16-bit PCM
    const buffer = new ArrayBuffer(44 + length);
    const view = new DataView(buffer);

    const writeString = (view, offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + length, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numberOfChannels * 2, true);
    view.setUint16(32, numberOfChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, 'data');
    view.setUint32(40, length, true);

    const channelData = [];
    for (let i = 0; i < numberOfChannels; i++) {
      channelData.push(audioBuffer.getChannelData(i));
    }
    let offset = 44;
    for (let i = 0; i < audioBuffer.length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, channelData[channel][i]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
        offset += 2;
      }
    }

    return new Blob([buffer], { type: 'audio/wav' });
  } catch (error) {
    console.error('WAV conversion failed:', error);
    throw error;
  }
}

royBtn.addEventListener('click', () => {
  resetButtonColors();
  selectedPersona = 'roy';

  royBtn.style.backgroundColor = 'green';
  royBtn.style.color = 'white';
  royBtn.style.border = '1px solid green';

  speakBtn.style.backgroundColor = 'red';
  speakBtn.style.color = 'white';
  speakBtn.style.border = '1px solid red';

  scopesContainer.style.borderColor = 'cyan';
  addMessage('Roy: Greetings, my friend—like a weary traveler, you\'ve arrived. What weighs on your soul today?', 'roy');
});

randyBtn.addEventListener('click', () => {
  resetButtonColors();
  selectedPersona = 'randy';

  randyBtn.style.backgroundColor = '#FFC107';
  randyBtn.style.color = 'white';
  randyBtn.style.border = '1px solid #FFC107';

  speakBtn.style.backgroundColor = 'red';
  speakBtn.style.color = 'white';
  speakBtn.style.border = '1px solid red';

  scopesContainer.style.borderColor = 'red';
  addMessage('Randy: Unleash the chaos—what\'s burning you up?', 'randy');
});

speakBtn.addEventListener('click', async () => {
  if (!selectedPersona) {
    alert('Please choose Roy or Randy first.');
    return;
  }

  if (isRecording) {
    console.log("[UI] Stop button clicked");
    if (mediaRecorder && (mediaRecorder.state === "recording" || mediaRecorder.state === "paused")) {
      console.log("[MIC] Stopping recording...");
      mediaRecorder.stop();
    } else {
      console.log("[MIC] Recorder not in recording state:", mediaRecorder?.state);
      cleanupRecording();
    }
    return;
  }

  console.log("[UI] Speak button clicked");
  try {
    isRecording = true;
    speakBtn.textContent = 'STOP';
    speakBtn.classList.add('blinking');
    audioChunks = [];

    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    setupUserVisualization(stream);
    mediaRecorder = new MediaRecorder(stream);

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        audioChunks.push(e.data);
        console.log("[MIC] Audio chunk received, size:", e.data.size);
      }
    };

    mediaRecorder.onstop = async () => {
      console.log("[MIC] Recording stopped");
      speakBtn.textContent = 'SPEAK';
      speakBtn.classList.remove('blinking');
      speakBtn.style.backgroundColor = 'red';
      speakBtn.style.color = 'white';
      speakBtn.style.border = '1px solid red';
      isRecording = false;

      userCtx.clearRect(0, 0, userCanvas.width, userCanvas.height);

      if (audioChunks.length === 0) {
        console.log("[MIC] No audio data recorded");
        cleanupRecording();
        return;
      }

      try {
        let audioBlob = new Blob(audioChunks, { type: 'audio/mp4' });
        audioBlob = await convertToWav(audioBlob);

        const formData = new FormData();
        formData.append('audio', audioBlob, 'audio.wav');
        formData.append('bot', selectedPersona);

        const transcribingMessage = addMessage('You: Transcribing...', 'user');
        const thinkingMessage = addMessage(`${selectedPersona === 'randy' ? 'Randy' : 'Roy'}`, selectedPersona, true);

        let userText = null;
        let royText = null;
        let audioBase64 = null;

        try {
          try {
            const transcribeRes = await fetch('https://roy-chatbo-backend.onrender.com/api/transcribe', {
              method: 'POST',
              body: formData,
            });
            if (!transcribeRes.ok) throw new Error(`Transcription failed with status: ${transcribeRes.status}`);
            const transcribeJson = await transcribeRes.json();
            userText = transcribeJson.text || "undefined";
            console.log("[TRANSCRIBE] User text:", userText);
          } catch (transcribeError) {
            console.warn("[TRANSCRIBE] /api/transcribe failed, falling back to /api/chat:", transcribeError);
            try {
              const chatRes = await fetch('https://roy-chatbo-backend.onrender.com/api/chat', {
                method: 'POST',
                body: formData,
              });
              if (!chatRes.ok) throw new Error(`Chat failed with status: ${chatRes.status}`);
              const chatJson = await chatRes.json();
              userText = chatJson.text || "undefined";
              royText = chatJson.text || "undefined";
              audioBase64 = chatJson.audio;
              console.log("[CHAT] User text (fallback):", userText);
            } catch (chatError) {
              console.error("[CHAT] Fallback failed:", chatError);
              throw chatError;
            }
          }

          transcribingMessage.textContent = `You: ${userText}`;

          if (userText !== "undefined" && !royText) {
            const chatRes = await fetch('https://roy-chatbo-backend.onrender.com/api/chat', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                message: userText,
                persona: selectedPersona,
              }),
            });
            if (!chatRes.ok) throw new Error(`Chat failed with status: ${chatRes.status}`);
            const chatJson = await chatRes.json();
            royText = chatJson.text || "undefined";
            audioBase64 = chatJson.audio;
            console.log("[AUDIO] base64 length:", audioBase64?.length);
          }

          thinkingMessage.remove();
          addMessage(`${selectedPersona === 'randy' ? 'Randy' : 'Roy'}: ${royText || "undefined"}`, selectedPersona);
          if (audioBase64) {
            playRoyAudio(audioBase64);
          } else {
            console.error('No audioBase64 received');
            addMessage('Error: No audio response received from Roy/Randy', 'roy');
            cleanupRecording();
          }
        } catch (error) {
          console.error('Transcription or chat failed:', error);
          transcribingMessage.textContent = userText ? `You: ${userText}` : 'You: Transcription failed';
          thinkingMessage.remove();
          addMessage(`${selectedPersona === 'randy' ? 'Randy' : 'Roy'}: undefined`, selectedPersona);
          cleanupRecording();
        }
      } catch (error) {
        console.error('Audio conversion failed:', error);
        addMessage('You: Audio processing failed', 'user');
        cleanupRecording();
      }
    };

    mediaRecorder.onerror = (err) => {
      console.error("[MIC] MediaRecorder error:", err);
      cleanupRecording();
    };

    mediaRecorder.start();
    console.log("[MIC] Recording started");
  } catch (error) {
    console.error('Microphone error:', error);
    alert('Could not access your microphone. Please allow access.');
    speakBtn.textContent = 'SPEAK';
    speakBtn.classList.remove('blinking');
    speakBtn.style.backgroundColor = 'red';
    speakBtn.style.color = 'white';
    speakBtn.style.border = '1px solid red';
    isRecording = false;
  }
});

saveBtn.addEventListener('click', () => {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-');
  const filename = `${selectedPersona || 'conversation'}-${timestamp}.txt`;
  const blob = new Blob([messagesDiv.innerText], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
});

homeBtn.addEventListener('click', () => {
  window.location.href = 'https://synthcalm.com';
});

function cleanupRecording() {
  console.log("[CLEANUP] Cleaning up recording state");
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }
  if (userAudioContext && userAudioContext.state !== 'closed') {
    userAudioContext.close();
    userAudioContext = null;
  }
  if (royAudioContext && royAudioContext.state !== 'closed') {
    royAudioContext.close();
    royAudioContext = null;
  }
  mediaRecorder = null;
  audioChunks = [];
  isRecording = false;
}

window.addEventListener('load', () => {
  initButtonStyles();
  updateDateTime();
  startCountdownTimer();
  userCtx.clearRect(0, 0, userCanvas.width, userCanvas.height);
  royCtx.clearRect(0, 0, royCanvas.width, royCanvas.height);
});

document.head.insertAdjacentHTML('beforeend', `
  <style>
    .thinking-dots::after {
      content: '';
      animation: thinking-dots 1.4s infinite steps(4, end);
    }
    @keyframes thinking-dots {
      0% { content: ''; }
      25% { content: '.'; }
      50% { content: '..'; }
      75% { content: '...'; }
      100% { content: ''; }
    }
  </style>
`);
