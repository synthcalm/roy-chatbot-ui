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

// Helper function to convert base64 to Blob
function base64ToBlob(base64, mimeType) {
  const byteString = atob(base64);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  
  return new Blob([ab], { type: mimeType });
}

function playRoyAudio(base64Audio) {
  console.log("[AUDIO] Attempting to play audio, data length:", base64Audio?.length);
  if (!base64Audio) {
    console.error("[AUDIO] No audio data provided");
    return;
  }

  // Create a temporary object URL instead of keeping base64 in memory
  const audioBlob = base64ToBlob(base64Audio, 'audio/mp3');
  const audioUrl = URL.createObjectURL(audioBlob);
  
  const audioEl = new Audio(audioUrl);
  audioEl.setAttribute('playsinline', '');
  audioEl.setAttribute('controlsList', 'nodownload'); // Disable download in browsers that support it
  
  // Disable right-click menu on audio element
  audioEl.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    return false;
  });

  if (royAudioContext && royAudioContext.state !== 'closed') {
    try {
      if (royAudioSource) royAudioSource.disconnect();
      royAudioContext.close();
    } catch (e) {
      console.log('Error closing previous audio context:', e);
    }
  }

  royAudioContext = new (window.AudioContext || window.webkitAudioContext)();

  audioEl.addEventListener('canplaythrough', () => {
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

      animate();
      audioEl.play();

      audioEl.addEventListener('ended', () => {
        cancelAnimationFrame(animationId);
        royCtx.clearRect(0, 0, royCanvas.width, royCanvas.height);
        speakBtn.textContent = 'SPEAK';
        speakBtn.classList.remove('blinking');
        speakBtn.style.backgroundColor = 'red';
        speakBtn.style.color = 'white';
        speakBtn.style.border = '1px solid red';
        URL.revokeObjectURL(audioUrl); // Release the URL object
        cleanupRecording();
      });

      // Also revoke URL if there's an error
      audioEl.addEventListener('error', () => {
        console.error("[AUDIO] Error playing audio");
        URL.revokeObjectURL(audioUrl);
        cleanupRecording();
      });

    } catch (error) {
      console.error('Audio visualization failed:', error);
      URL.revokeObjectURL(audioUrl);
      audioEl.play();
    }
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

// Check backend health
async function checkBackendHealth() {
  try {
    const response = await fetch('https://roy-chatbo-backend.onrender.com/api/health', {
      method: 'GET',
    });
    console.log("[API] Backend health check:", response.ok ? "OK" : "Failed");
    return response.ok;
  } catch (error) {
    console.error("[API] Backend health check error:", error);
    return false;
  }
}

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

      // Check backend health before proceeding
      const backendHealthy = await checkBackendHealth();
      if (!backendHealthy) {
        alert("Backend service appears to be unavailable. Please try again later.");
        cleanupRecording();
        return;
      }

      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
      const mimeType = isSafari ? 'audio/mp4' : 'audio/wav';
      const audioBlob = new Blob(audioChunks, { type: mimeType });
      const formData = new FormData();
      formData.append('audio', audioBlob);
      formData.append('bot', selectedPersona);

      const transcribingMessage = addMessage('You: Transcribing...', 'user');
      const thinkingMessage = addMessage(`${selectedPersona === 'randy' ? 'Randy' : 'Roy'}`, selectedPersona, true);

      let userText = null;
      let royText = null;
      let audioBase64 = null;

      try {
        // Step 1: Try /api/transcribe first
        try {
          console.log("[API] Calling /api/transcribe...");
          const transcribeRes = await fetch('https://roy-chatbo-backend.onrender.com/api/transcribe', {
            method: 'POST',
            body: formData,
          });
          console.log("[API] Transcribe status:", transcribeRes.status);
          
          if (!transcribeRes.ok) {
            const errorText = await transcribeRes.text();
            console.error(`[API] Transcribe error (${transcribeRes.status}):`, errorText);
            throw new Error(`Transcription failed with status: ${transcribeRes.status}`);
          }
          
          const transcribeJson = await transcribeRes.json();
          userText = transcribeJson.text || "undefined";
          console.log("[TRANSCRIBE] User text:", userText);
        } catch (transcribeError) {
          console.warn("[TRANSCRIBE] /api/transcribe failed, falling back to /api/chat:", transcribeError);
          // Fallback to /api/chat
          try {
            console.log("[API] Calling /api/chat with audio...");
            const chatRes = await fetch('https://roy-chatbo-backend.onrender.com/api/chat', {
              method: 'POST',
              body: formData,
            });
            console.log("[API] Chat status:", chatRes.status);
            
            if (!chatRes.ok) {
              const errorText = await chatRes.text();
              console.error(`[API] Chat error (${chatRes.status}):`, errorText);
              throw new Error(`Chat failed with status: ${chatRes.status}`);
            }
            
            const chatJson = await chatRes.json();
            console.log("[API] Chat response structure:", Object.keys(chatJson));
            userText = chatJson.text || "undefined";
            // Since /api/chat also returns Roy's response, extract only the user's transcription
            // For now, we'll assume the transcription is correct and Roy's response is separate
            console.log("[CHAT] User text (fallback):", userText);
            // Store Roy's response separately
            royText = chatJson.text || "undefined"; // Roy's response is the same as the transcribed text initially
            audioBase64 = chatJson.audio;
            console.log("[AUDIO] base64 received:", audioBase64 ? "Yes" : "No");
          } catch (chatError) {
            console.error("[CHAT] Fallback failed:", chatError);
            throw chatError;
          }
        }

        // Step 2: Update the UI with the user's transcription
        transcribingMessage.textContent = `You: ${userText}`;

        // Step 3: Call /api/chat with a JSON payload to get Roy's response (if not already fetched)
        if (userText !== "undefined" && !royText) {
          console.log("[API] Calling /api/chat with JSON...");
          const chatRes = await fetch('https://roy-chatbo-backend.onrender.com/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: userText,
              persona: selectedPersona,
            }),
          });
          console.log("[API] Chat status:", chatRes.status);
          
          if (!chatRes.ok) {
            const errorText = await chatRes.text();
            console.error(`[API] Chat error (${chatRes.status}):`, errorText);
            throw new Error(`Chat failed with status: ${chatRes.status}`);
          }
          
          const chatJson = await chatRes.json();
          console.log("[API] Chat response structure:", Object.keys(chatJson));
          royText = chatJson.text || "undefined";
          audioBase64 = chatJson.audio;
          console.log("[AUDIO] base64 received:", audioBase64 ? "Yes (length: " + audioBase64.length + ")" : "No");
        }

        thinkingMessage.remove();
        addMessage(`${selectedPersona === 'randy' ? 'Randy' : 'Roy'}: ${royText || "undefined"}`, selectedPersona);
        if (audioBase64) {
          playRoyAudio(audioBase64);
          // Clear sensitive data from memory after use
          setTimeout(() => {
            audioBase64 = null;
          }, 1000);
        } else {
          console.error("[AUDIO] No audio data in response");
          cleanupRecording();
        }
      } catch (error) {
        console.error('Transcription or chat failed:', error);
        transcribingMessage.textContent = userText ? `You: ${userText}` : 'You: Transcription failed';
        thinkingMessage.remove();
        addMessage(`${selectedPersona === 'randy' ? 'Randy' : 'Roy'}: Service unavailable. Please try again.`, selectedPersona);
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
  
  // Check backend health on page load
  checkBackendHealth().then(isHealthy => {
    if (!isHealthy) {
      console.warn("[STARTUP] Backend appears to be unavailable");
    } else {
      console.log("[STARTUP] Backend health check passed");
    }
  });
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
