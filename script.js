// Global variables
let micActive = false;
let token = null;
let socket = null;
let mediaRecorder = null;
let audioContext = null;
let analyser = null;
let liveTranscript = '';
let isTyping = false;

// DOM elements
const messages = document.getElementById('messages');
const userInput = document.getElementById('user-input');
const sendButton = document.getElementById('send-button');
const micToggle = document.getElementById('mic-toggle');
const responseMode = document.getElementById('responseMode');
const saveLogButton = document.getElementById('save-log');
const homeButton = document.getElementById('home-btn');
const royAudio = document.getElementById('roy-audio');
const currentDate = document.getElementById('current-date');
const currentTime = document.getElementById('current-time');
const countdownTimer = document.getElementById('countdown-timer');

// Initialize date, time, and countdown timer
function updateDateTime() {
  const now = new Date();
  currentDate.textContent = now.toISOString().split('T')[0];
  currentTime.textContent = now.toTimeString().split(' ')[0];
}

function startCountdown() {
  let timeLeft = 60 * 60; // 60 minutes in seconds
  const timerInterval = setInterval(() => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    countdownTimer.textContent = `Session Ends In: ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    timeLeft--;
    if (timeLeft < 0) {
      clearInterval(timerInterval);
      countdownTimer.textContent = 'Session Ended';
      appendMessage('Roy', 'Your session has ended. Thank you for sharing.');
    }
  }, 1000);
}

// Fetch the AssemblyAI token from the backend
async function getToken() {
  try {
    console.log('Fetching token from backend...');
    const res = await fetch('https://roy-chatbo-backend.onrender.com/api/assembly/token', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('Token fetch response status:', res.status);
    if (!res.ok) {
      let errorData;
      try {
        errorData = await res.json();
      } catch (jsonErr) {
        throw new Error(`Server responded with status: ${res.status}, unable to parse error details`);
      }
      const errorMessage = errorData.details || `Server responded with status: ${res.status}`;
      throw new Error(errorMessage);
    }

    const data = await res.json();
    if (!data.token) {
      throw new Error('Token not found in response');
    }

    console.log('Token fetched successfully:', data.token);
    token = data.token;
    return token;
  } catch (err) {
    console.error('Error getting token:', err.message);
    appendMessage('Roy', 'Unable to connect to the speech service. The server might be down or misconfigured. Please try typing your message instead.');
    return null;
  }
}

// Start recording and set up real-time transcription
async function startRecording() {
  if (micActive) {
    console.log('Recording already active, stopping current recording.');
    stopRecording();
    return;
  }

  console.log('Starting recording...');

  // Step 1: Fetch the token
  const fetchedToken = await getToken();
  if (!fetchedToken) {
    console.log('Token fetch failed, aborting recording.');
    micActive = false;
    toggleMicButton();
    return;
  }

  // Step 2: Request microphone access
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    console.log('Microphone access granted:', stream);
  } catch (err) {
    console.error('Microphone access denied:', err.message);
    appendMessage('Roy', 'Microphone access was denied. Please allow microphone access to use the speak feature.');
    micActive = false;
    toggleMicButton();
    return;
  }

  // Step 3: Set up audio context and analyser for waveform visualization
  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    analyser.fftSize = 2048;
    console.log('Audio context and analyser set up successfully.');
    visualizeWaveform('userWaveform');
  } catch (err) {
    console.error('Error setting up audio context:', err.message);
    appendMessage('Roy', 'Failed to set up audio processing. Please try again.');
    micActive = false;
    toggleMicButton();
    stream.getTracks().forEach(track => track.stop());
    return;
  }

  // Step 4: Set up WebSocket for real-time transcription
  try {
    micActive = true;
    toggleMicButton();
    console.log('Token received, setting up WebSocket...');

    socket = new WebSocket('wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000');
    socket.onopen = () => {
      console.log('WebSocket connection opened.');
      socket.send(JSON.stringify({
        auth: { token: fetchedToken },
        sample_rate: 16000
      }));
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      appendMessage('Roy', 'Failed to connect to the transcription service. Please try again.');
      stopRecording();
    };

    socket.onclose = () => {
      console.log('WebSocket connection closed.');
      stopRecording();
    };

    socket.onmessage = (message) => {
      const data = JSON.parse(message.data);
      console.log('WebSocket message received:', data);

      if (data.message_type === 'SessionBegins') {
        console.log('Transcription session started:', data.session_id);
      } else if (data.message_type === 'PartialTranscript' || data.message_type === 'FinalTranscript') {
        const transcript = data.text || '';
        console.log('Transcript received:', transcript);
        if (transcript) {
          liveTranscript = transcript;
          userInput.value = liveTranscript;
          if (data.message_type === 'FinalTranscript') {
            sendMessage(liveTranscript);
          }
        }
      }
    };
  } catch (err) {
    console.error('Error setting up WebSocket:', err.message);
    appendMessage('Roy', 'Failed to set up transcription service. Please try again.');
    stopRecording();
    return;
  }

  // Step 5: Start recording audio and send it to AssemblyAI
  try {
    mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0 && socket.readyState === WebSocket.OPEN) {
        const reader = new FileReader();
        reader.onload = () => {
          const audioData = reader.result.split(',')[1];
          socket.send(JSON.stringify({
            audio_data: audioData
          }));
        };
        reader.readAsDataURL(event.data);
      }
    };
    mediaRecorder.start(250);
    console.log('MediaRecorder started, sending audio to AssemblyAI...');
  } catch (err) {
    console.error('Error starting MediaRecorder:', err.message);
    appendMessage('Roy', 'Failed to start recording audio. Please try again.');
    stopRecording();
  }
}

// Stop recording and clean up resources
function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  if (audioContext) {
    audioContext.close();
    audioContext = null;
    analyser = null;
    stopWaveform();
  }
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.close();
  }
  if (mediaRecorder) {
    mediaRecorder.stream.getTracks().forEach(track => track.stop());
  }
  micActive = false;
  toggleMicButton();
  console.log('Recording stopped.');
}

// Send a message to the backend for a chat response
async function sendMessage(message) {
  if (!message.trim()) return;

  appendMessage('You', message);
  userInput.value = '';
  liveTranscript = '';

  const mode = responseMode.value;
  const typingMessage = document.createElement('div');
  typingMessage.className = 'message roy typing';
  typingMessage.textContent = 'Roy';
  messages.appendChild(typingMessage);
  messages.scrollTop = messages.scrollHeight;
  isTyping = true;

  try {
    const response = await fetch('https://roy-chatbo-backend.onrender.com/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message, mode })
    });

    if (!response.ok) {
      throw new Error('Failed to get a response from the server');
    }

    const data = await response.json();
    messages.removeChild(typingMessage);
    isTyping = false;

    if (mode === 'text' || mode === 'both') {
      appendMessage('Roy', data.response);
    }
    if ((mode === 'voice' || mode === 'both') && data.audioUrl) {
      royAudio.src = data.audioUrl;
      royAudio.style.display = 'block';
      royAudio.play();
      visualizeWaveform('royWaveform', royAudio);
    }
  } catch (err) {
    console.error('Error sending message:', err.message);
    if (isTyping) {
      messages.removeChild(typingMessage);
      isTyping = false;
    }
    appendMessage('Roy', 'Sorry, I couldn’t process your request. Please try again.');
  }
}

// Append a message to the messages area
function appendMessage(sender, message) {
  const messageElement = document.createElement('div');
  messageElement.className = `message ${sender.toLowerCase()}`;
  messageElement.textContent = `${sender}: ${message}`;
  messages.appendChild(messageElement);
  messages.scrollTop = messages.scrollHeight;
}

// Toggle the mic button state
function toggleMicButton() {
  if (micToggle) {
    micToggle.textContent = micActive ? 'Stop' : 'Speak';
    micToggle.classList.toggle('recording', micActive);
  }
}

// Visualize the waveform
let waveformInterval;
function visualizeWaveform(canvasId, audioElement = null) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || (!analyser && !audioElement)) return;

  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;

  let dataArray, bufferLength;
  if (audioElement) {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioCtx.createMediaElementSource(audioElement);
    const analyserNode = audioCtx.createAnalyser();
    source.connect(analyserNode);
    analyserNode.connect(audioCtx.destination);
    analyserNode.fftSize = 2048;
    bufferLength = analyserNode.fftSize;
    dataArray = new Uint8Array(bufferLength);
    analyser = analyserNode;
  } else {
    bufferLength = analyser.fftSize;
    dataArray = new Uint8Array(bufferLength);
  }

  function draw() {
    analyser.getByteTimeDomainData(dataArray);
    ctx.clearRect(0, 0, width, height);
    ctx.lineWidth = 2;
    ctx.strokeStyle = canvasId === 'userWaveform' ? '#ff0' : '#0ff';
    ctx.beginPath();

    const sliceWidth = width / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * height) / 2;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    ctx.lineTo(width, height / 2);
    ctx.stroke();
  }

  waveformInterval = setInterval(draw, 50);
}

function stopWaveform() {
  if (waveformInterval) {
    clearInterval(waveformInterval);
    waveformInterval = null;
    ['userWaveform', 'royWaveform'].forEach(canvasId => {
      const canvas = document.getElementById(canvasId);
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    });
  }
}

// Save the conversation log
function saveLog() {
  const log = Array.from(messages.children)
    .map(child => child.textContent)
    .join('\n');
  const blob = new Blob([log], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `roy-session-${new Date().toISOString().split('T')[0]}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  updateDateTime();
  setInterval(updateDateTime, 1000);
  startCountdown();

  if (sendButton) {
    sendButton.addEventListener('click', () => {
      const message = userInput.value;
      sendMessage(message);
    });
  }

  if (micToggle) {
    micToggle.addEventListener('click', startRecording);
  }

  if (userInput) {
    userInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const message = userInput.value;
        sendMessage(message);
      }
    });
  }

  if (saveLogButton) {
    saveLogButton.addEventListener('click', saveLog);
  }

  if (homeButton) {
    homeButton.addEventListener('click', () => {
      window.location.href = 'https://synthcalm.com'; // Adjust URL as needed
    });
  }

  if (royAudio) {
    royAudio.addEventListener('ended', () => {
      royAudio.style.display = 'none';
      stopWaveform();
    });
  }
});
