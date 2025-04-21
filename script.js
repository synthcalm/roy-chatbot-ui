// Roy Chatbot frontend script with fixes for audio context, thinking animation, and UI improvements
// AssemblyAI real-time transcription with waveform visualization

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

// Global variables
let mediaRecorder, audioChunks = [], isRecording = false;
let selectedPersona = null;
let userAudioContext = null;
let royAudioContext = null;
let royAudioSource = null;

// Apply button borders immediately on load
function initButtonStyles() {
  // Add cyan borders to buttons
  royBtn.style.border = '1px solid cyan';
  randyBtn.style.border = '1px solid cyan';
  saveBtn.style.border = '1px solid cyan';
  speakBtn.style.border = '1px solid red'; // Red border for speak button
}

// Function to create and display messages in the chat
function addMessage(text, sender, isThinking = false) {
  const msg = document.createElement('p');
  msg.className = sender;
  
  if (isThinking) {
    msg.classList.add('thinking');
    const baseText = text.endsWith('Thinking') ? text : `${text} Thinking`;
    msg.textContent = baseText;
    
    // Create span for animated dots
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

// Function to draw waveform on canvas
function drawWaveform(canvasCtx, canvas, data, color, isUserWaveform) {
  canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
  canvasCtx.beginPath();
  
  const sliceWidth = canvas.width / data.length;
  const centerY = canvas.height / 2;
  const scale = isUserWaveform ? 50 : 80; // Different scaling for user vs Roy
  
  for (let i = 0; i < data.length; i++) {
    const normalized = (data[i] / 128.0) - 1; // Convert to range -1 to 1
    const y = centerY + (normalized * scale);
    const x = i * sliceWidth;
    
    if (i === 0) {
      canvasCtx.moveTo(x, y);
    } else {
      canvasCtx.lineTo(x, y);
    }
  }
  
  canvasCtx.strokeStyle = color;
  canvasCtx.lineWidth = 2;
  canvasCtx.stroke();
}

// Setup user's audio visualization (microphone input)
function setupUserVisualization(stream) {
  // Close previous context if it exists
  if (userAudioContext && userAudioContext.state !== 'closed') {
    userAudioContext.close();
  }
  
  userAudioContext = new (window.AudioContext || window.webkitAudioContext)();
  const source = userAudioContext.createMediaStreamSource(stream);
  const analyser = userAudioContext.createAnalyser();
  analyser.fftSize = 2048;
  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  
  source.connect(analyser);
  // Don't connect to destination to avoid feedback
  
  function animate() {
    if (!isRecording) return; // Stop animation when not recording
    
    analyser.getByteTimeDomainData(dataArray);
    drawWaveform(userCtx, userCanvas, dataArray, 'yellow', true);
    requestAnimationFrame(animate);
  }
  
  animate();
}

// Play audio with visualization (completely rewritten to fix audio context issue)
function playRoyAudio(base64Audio) {
  // Create audio element
  const audioEl = new Audio(`data:audio/mp3;base64,${base64Audio}`);
  audioEl.setAttribute('playsinline', '');
  
  // Clean up previous audio context if it exists
  if (royAudioContext && royAudioContext.state !== 'closed') {
    try {
      if (royAudioSource) {
        royAudioSource.disconnect();
      }
      royAudioContext.close();
    } catch (e) {
      console.log('Error closing previous audio context:', e);
    }
  }

  // Create a fresh audio context
  royAudioContext = new (window.AudioContext || window.webkitAudioContext)();
  
  // Set up audio visualization only after audio is loaded
  audioEl.addEventListener('canplaythrough', () => {
    try {
      // Create new source from the audio element
      royAudioSource = royAudioContext.createMediaElementSource(audioEl);
      const analyser = royAudioContext.createAnalyser();
      analyser.fftSize = 2048;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      
      // Connect nodes within the same context
      royAudioSource.connect(analyser);
      analyser.connect(royAudioContext.destination);
      
      let animationId;
      
      function animate() {
        analyser.getByteTimeDomainData(dataArray);
        const waveformColor = selectedPersona === 'randy' ? 'orange' : 'magenta';
        drawWaveform(royCtx, royCanvas, dataArray, waveformColor, false);
        animationId = requestAnimationFrame(animate);
      }
      
      // Start animation and play audio
      animate();
      
      audioEl.play().catch(err => {
        console.error('Audio playback error:', err);
        
        // Fallback for browsers that require user interaction
        const playButton = document.createElement('button');
        playButton.textContent = 'Play Response';
        playButton.style.marginTop = '10px';
        playButton.style.border = '1px solid cyan';
        messagesDiv.appendChild(playButton);
        
        playButton.addEventListener('click', () => {
          audioEl.play();
          playButton.remove();
        });
      });
      
      // Clean up when audio ends
      audioEl.addEventListener('ended', () => {
        cancelAnimationFrame(animationId);
        royCtx.clearRect(0, 0, royCanvas.width, royCanvas.height);
      });
      
    } catch (error) {
      console.error('Error setting up audio visualization:', error);
      // Fallback - just play the audio without visualization
      audioEl.play().catch(e => console.error('Fallback play error:', e));
    }
  });
  
  // Load the audio
  audioEl.load();
}

// Reset all button states and UI elements
function resetButtonColors() {
  royBtn.style.backgroundColor = 'black';
  royBtn.style.color = 'cyan';
  royBtn.style.border = '1px solid cyan';
  
  randyBtn.style.backgroundColor = 'black';
  randyBtn.style.color = 'cyan';
  randyBtn.style.border = '1px solid cyan';
  
  speakBtn.style.backgroundColor = 'black';
  speakBtn.style.color = 'cyan';
  speakBtn.style.border = '1px solid red';
  speakBtn.textContent = 'SPEAK';
  speakBtn.classList.remove('blinking');
  
  scopesContainer.style.borderColor = 'cyan';
  isRecording = false;
  selectedPersona = null;
  
  // Clear both canvases
  userCtx.clearRect(0, 0, userCanvas.width, userCanvas.height);
  royCtx.clearRect(0, 0, royCanvas.width, royCanvas.height);
}

// Update the date and time display
function updateDateTime() {
  const now = new Date();
  const date = now.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
  const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true });
  dateTimeSpan.textContent = `${date}   ${time}`;
  
  // Update every minute
  setTimeout(updateDateTime, 60000);
}

// Start the countdown timer (5 minutes)
function startCountdownTimer() {
  let timeLeft = 5 * 60;
  
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

// Roy button event handler
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
  addMessage('Roy: Greetings, my friend—like a weary traveler, you've arrived. What weighs on your soul today?', 'roy');
});

// Randy button event handler
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
  addMessage('Randy: Unleash the chaos—what's burning you up?', 'randy');
});

// Speak/Stop button event handler
speakBtn.addEventListener('click', async () => {
  if (!selectedPersona) {
    alert('Please choose Roy or Randy first.');
    return;
  }
  
  if (isRecording) {
    // Stop recording
    mediaRecorder.stop();
    return;
  }
  
  try {
    isRecording = true;
    speakBtn.textContent = 'STOP';
    speakBtn.classList.add('blinking');
    audioChunks = [];
    
    // Request microphone access
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    // Setup visualization for user's audio
    setupUserVisualization(stream);
    
    // Create media recorder
    mediaRecorder = new MediaRecorder(stream);
    
    mediaRecorder.ondataavailable = (e) => {
      audioChunks.push(e.data);
    };
    
    mediaRecorder.onstop = async () => {
      // Update UI
      speakBtn.textContent = 'SPEAK';
      speakBtn.classList.remove('blinking');
      isRecording = false;
      
      // Clear user waveform
      userCtx.clearRect(0, 0, userCanvas.width, userCanvas.height);
      
      // Process recorded audio
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      const formData = new FormData();
      formData.append('audio', audioBlob);
      
      try {
        // Send audio for transcription
        const transcribeRes = await fetch('https://roy-chatbo-backend.onrender.com/api/transcribe', {
          method: 'POST',
          body: formData
        });
        
        const { text } = await transcribeRes.json();
        addMessage('You: ' + text, 'user');
        
        // Show thinking message with animated dots
        const thinkingMsg = addMessage(`${selectedPersona === 'randy' ? 'Randy' : 'Roy'}`, selectedPersona, true);
        
        // Send to backend for response
        const chatRes = await fetch('https://roy-chatbo-backend.onrender.com/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            message: text, 
            persona: selectedPersona,
            mode: 'both' // Request both text and audio
          })
        });
        
        const { text: reply, audio } = await chatRes.json();
        
        // Remove thinking message
        thinkingMsg.remove();
        
        // Add response message
        addMessage(`${selectedPersona === 'randy' ? 'Randy' : 'Roy'}: ${reply}`, selectedPersona);
        
        // Play audio response with the completely rewritten function
        if (audio) {
          playRoyAudio(audio);
        }
      } catch (error) {
        console.error('Error processing audio:', error);
        addMessage(`${selectedPersona === 'randy' ? 'Randy' : 'Roy'}: Sorry, I couldn't process your request.`, selectedPersona);
      }
    };
    
    // Start recording
    mediaRecorder.start();
    
  } catch (error) {
    console.error('Microphone access error:', error);
    alert('Could not access microphone. Please check permissions.');
    isRecording = false;
    speakBtn.textContent = 'SPEAK';
    speakBtn.classList.remove('blinking');
  }
});

// Save button event handler
saveBtn.addEventListener('click', () => {
  // Create a timestamp for the filename
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-');
  const filename = `${selectedPersona || 'conversation'}-${timestamp}.txt`;
  
  // Get conversation text
  const blob = new Blob([messagesDiv.innerText], { type: 'text/plain' });
  
  // Create download link
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
});

// Home button event handler
homeBtn.addEventListener('click', () => {
  window.location.href = 'https://synthcalm.com';
});

// Initialize on page load
window.addEventListener('load', () => {
  // Apply button styles immediately
  initButtonStyles();
  
  // Start clock and timer
  updateDateTime();
  startCountdownTimer();
  
  // Clear any lingering audio contexts
  if (userAudioContext && userAudioContext.state !== 'closed') {
    userAudioContext.close();
  }
  if (royAudioContext && royAudioContext.state !== 'closed') {
    royAudioContext.close();
  }
  
  // Initialize canvases with grid backgrounds
  userCtx.clearRect(0, 0, userCanvas.width, userCanvas.height);
  royCtx.clearRect(0, 0, royCanvas.width, royCanvas.height);
});

// Add CSS for thinking dots animation
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
