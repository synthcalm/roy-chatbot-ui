// Global variables (assumed to be defined elsewhere in script.js)
let micActive = false;
let token = null;
let socket = null;
let mediaRecorder = null;
let audioContext = null;
let analyser = null;

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
    console.log('Recording already active, ignoring start request.');
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
          // Update the textbox with the live transcript (assumes liveTranscript is a global variable or DOM element)
          liveTranscript = transcript;
          document.getElementById('user-input').value = liveTranscript;
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
          const audioData = reader.result.split(',')[1]; // Get base64 audio data
          socket.send(JSON.stringify({
            audio_data: audioData
          }));
        };
        reader.readAsDataURL(event.data);
      }
    };
    mediaRecorder.start(250); // Send audio chunks every 250ms
    console.log('MediaRecorder started, sending audio to AssemblyAI...');
  } catch (err) {
    console.error('Error starting MediaRecorder:', err.message);
    appendMessage('Roy', 'Failed to start recording audio. Please try again.');
    stopRecording();
  }
}

// Helper function to stop recording (assumed to be called when stopping the mic)
function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  if (audioContext) {
    audioContext.close();
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

// Helper function to toggle the mic button (assumed to be defined elsewhere)
function toggleMicButton() {
  const micButton = document.getElementById('mic-button'); // Adjust ID as needed
  if (micButton) {
    micButton.textContent = micActive ? 'Stop' : 'Speak';
    micButton.classList.toggle('active', micActive);
  }
}

// Helper function to append messages (assumed to be defined elsewhere)
function appendMessage(sender, message) {
  const chatBox = document.getElementById('chat-box'); // Adjust ID as needed
  const messageElement = document.createElement('div');
  messageElement.textContent = `${sender}: ${message}`;
  chatBox.appendChild(messageElement);
  chatBox.scrollTop = chatBox.scrollHeight;
}
