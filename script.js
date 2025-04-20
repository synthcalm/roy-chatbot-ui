const royToggle = document.getElementById('roy-toggle');
const randyToggle = document.getElementById('randy-toggle');
const speakToggle = document.getElementById('speak-toggle');
const messagesDiv = document.getElementById('messages');
const royWaveform = document.getElementById('royWaveform');
const userWaveform = document.getElementById('userWaveform');
const royCtx = royWaveform.getContext('2d');
const userCtx = userWaveform.getContext('2d');
const currentDate = document.getElementById('current-date');
const currentTime = document.getElementById('current-time');
const countdownTimer = document.getElementById('countdown-timer');

let audioContext, analyser, dataArray, source, mediaRecorder, stream;
let isRecording = false;
let isRantMode = false;
let isModeSelected = false;
let sessionStartTime = null;
let chunks = [], volumeData = [];

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;
let finalTranscript = '';
let interimTranscript = '';

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onresult = (event) => {
    interimTranscript = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += transcript + ' ';
      } else {
        interimTranscript = transcript;
      }
    }
    const userMsg = document.createElement('p');
    userMsg.className = 'user message';
    userMsg.textContent = `You: ${finalTranscript + interimTranscript}`;
    messagesDiv.innerHTML = '';
    messagesDiv.appendChild(userMsg);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  };

  recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
    stopRecording();
  };

  recognition.onend = () => {
    if (isRecording) stopRecording();
  };
} else {
  const msg = document.createElement('p');
  msg.className = 'system message';
  msg.textContent = 'Real-time transcription is not supported in this browser (e.g., Firefox). Your speech will be transcribed after recording.';
  messagesDiv.appendChild(msg);
}

function updateDateTime() {
  const now = new Date();
  currentDate.textContent = now.toLocaleDateString();
  currentTime.textContent = now.toLocaleTimeString();
  if (isRecording && sessionStartTime) {
    const elapsed = Math.floor((now - sessionStartTime) / 1000);
    const maxTime = isRantMode ? 1800 : 3600;
    const remaining = maxTime - elapsed;
    const min = Math.floor(remaining / 60);
    const sec = remaining % 60;
    countdownTimer.textContent = `Session: ${min}:${sec < 10 ? '0' : ''}${sec}`;
  }
}
setInterval(updateDateTime, 1000);

function resetButtons() {
  royToggle.style.background = 'cyan';
  royToggle.style.color = 'black';
  randyToggle.style.background = 'cyan';
  randyToggle.style.color = 'black';
  isModeSelected = false;
  speakToggle.classList.remove('ready-to-speak');
  speakToggle.style.animation = 'none';
  speakToggle.style.background = 'grey';
  speakToggle.style.color = 'white';
  speakToggle.style.borderColor = 'grey';
  speakToggle.textContent = 'Speak';
}

function clearMessagesAndShowGreeting(mode) {
  messagesDiv.innerHTML = '';
  const greeting = mode === 'roy'
    ? "Greetings, my friend—like a weary traveler, you’ve arrived. What weighs on your soul today?"
    : "Hey there! I’m Randy, your no-filter, straight-talking buddy. What’s eating you up? Spill it.";
  const msg = document.createElement('p');
  msg.className = `${mode} message bot`;
  msg.innerHTML = `<em>${mode === 'roy' ? 'Roy' : 'Randy'}:</em> ${greeting}`;
  messagesDiv.appendChild(msg);
  isModeSelected = true;
  speakToggle.classList.add('ready-to-speak');
  speakToggle.style.background = 'black';
  speakToggle.style.color = 'red';
  speakToggle.style.borderColor = 'red';
  speakToggle.style.animation = 'blinker 1s linear infinite';
  speakToggle.textContent = 'Speak';
}

function updateSpeakButtonRecordingState() {
  speakToggle.textContent = 'Stop';
  speakToggle.style.background = 'red';
  speakToggle.style.color = 'black';
  speakToggle.style.animation = 'none';
}

async function startRecording() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    analyser.fftSize = 2048;
    dataArray = new Uint8Array(analyser.frequencyBinCount);

    function drawUserWaveform() {
      if (!isRecording) {
        userCtx.clearRect(0, 0, userWaveform.width, userWaveform.height);
        return;
      }
      analyser.getByteFrequencyData(dataArray);
      userCtx.clearRect(0, 0, userWaveform.width, userWaveform.height);
      userCtx.beginPath();
      for (let i = 0; i < dataArray.length; i++) {
        userCtx.lineTo(i * (userWaveform.width / dataArray.length), userWaveform.height - dataArray[i]);
      }
      userCtx.strokeStyle = 'cyan';
      userCtx.stroke();
      requestAnimationFrame(drawUserWaveform);
    }
    drawUserWaveform();

    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.start();

    mediaRecorder.ondataavailable = (e) => {
      chunks.push(e.data);
      analyser.getByteFrequencyData(dataArray);
      const avgVolume = dataArray.reduce((sum, val) => sum + val, 0) / dataArray.length;
      volumeData.push(avgVolume);
    };

    if (SpeechRecognition) {
      finalTranscript = '';
      interimTranscript = '';
      recognition.start();
    }

    sessionStartTime = new Date();
    isRecording = true;
    chunks = [];
    volumeData = [];
    updateSpeakButtonRecordingState();
  } catch (err) {
    console.error('Error starting recording:', err);
    stopRecording();
  }
}

function stopRecording() {
  isRecording = false;
  resetSpeakButton();
  if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
  if (SpeechRecognition && recognition) recognition.stop();
  if (stream) stream.getTracks().forEach(track => track.stop());
  if (source) source.disconnect();
  if (audioContext) audioContext.close();
}

function resetSpeakButton() {
  if (isModeSelected) {
    speakToggle.classList.add('ready-to-speak');
    speakToggle.style.background = 'black';
    speakToggle.style.color = 'red';
    speakToggle.style.borderColor = 'red';
    speakToggle.style.animation = 'blinker 1s linear infinite';
    speakToggle.textContent = 'Speak';
  } else {
    speakToggle.classList.remove('ready-to-speak');
    speakToggle.style.animation = 'none';
    speakToggle.style.background = 'grey';
    speakToggle.style.color = 'white';
    speakToggle.style.borderColor = 'grey';
    speakToggle.textContent = 'Speak';
  }
}

mediaRecorder.onstop = async () => {
  const blob = new Blob(chunks, { type: 'audio/webm' });
  const formData = new FormData();
  formData.append('audio', blob, 'audio.webm');

  try {
    const res = await fetch('https://roy-chatbo-backend.onrender.com/api/transcribe', {
      method: 'POST',
      body: formData
    });
    if (!res.ok) throw new Error('Transcription failed');
    const { text } = await res.json();

    const userMsg = document.createElement('p');
    userMsg.className = 'user message';
    userMsg.textContent = `You: ${text}`;
    messagesDiv.innerHTML = '';
    messagesDiv.appendChild(userMsg);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

    sendToRoy(text);
  } catch (err) {
    console.error('Backend transcription error:', err);
    if (finalTranscript) {
      const userMsg = document.createElement('p');
      userMsg.className = 'user message';
      userMsg.textContent = `You: ${finalTranscript}`;
      messagesDiv.innerHTML = '';
      messagesDiv.appendChild(userMsg);
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
      sendToRoy(finalTranscript);
    }
  }
};

function sendToRoy(text) {
  const chatPayload = {
    message: text,
    mode: 'both',
    persona: isRantMode ? 'randy' : 'default',
    volumeData
  };

  fetch('https://roy-chatbo-backend.onrender.com/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(chatPayload)
  })
    .then(res => res.json())
    .then(({ text: replyText, audio: audioBase64 }) => {
      const msg = document.createElement('p');
      msg.className = `roy message bot`;
      if (isRantMode) msg.classList.add('randy');
      msg.innerHTML = `<em>${isRantMode ? 'Randy' : 'Roy'}:</em> ${replyText}`;
      messagesDiv.appendChild(msg);
      messagesDiv.scrollTop = messagesDiv.scrollHeight;
      if (audioBase64) playRoyAudio(audioBase64);
    })
    .catch(err => {
      console.error('Chat error:', err);
      const msg = document.createElement('p');
      msg.className = 'system message';
      msg.textContent = 'Error: Could not get a response from Roy/Randy.';
      messagesDiv.appendChild(msg);
    });
}

function playRoyAudio(base64) {
  const audio = new Audio(`data:audio/mp3;base64,${base64}`);
  audio.setAttribute('playsinline', '');
  audio.play();
  visualizeAudio(audio);
}

function visualizeAudio(audio) {
  const ctx = royCtx;
  const canvas = royWaveform;
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const source = audioCtx.createMediaElementSource(audio);
  const analyser = audioCtx.createAnalyser();
  source.connect(analyser);
  analyser.connect(audioCtx.destination);
  analyser.fftSize = 2048;
  const dataArray = new Uint8Array(analyser.frequencyBinCount);

  function draw() {
    analyser.getByteFrequencyData(dataArray);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    for (let i = 0; i < dataArray.length; i++) {
      ctx.lineTo(i * (canvas.width / dataArray.length), canvas.height - dataArray[i]);
    }
    ctx.strokeStyle = 'yellow';
    ctx.stroke();
    if (!audio.ended) requestAnimationFrame(draw);
  }
  draw();
}

royToggle.addEventListener('click', () => {
  isRantMode = false;
  resetButtons();
  royToggle.style.background = 'lime';
  royToggle.style.color = 'black';
  clearMessagesAndShowGreeting('roy');
});

randyToggle.addEventListener('click', () => {
  isRantMode = true;
  resetButtons();
  randyToggle.style.background = 'orange';
  randyToggle.style.color = 'black';
  clearMessagesAndShowGreeting('randy');
});

speakToggle.addEventListener('click', () => {
  if (!isModeSelected) return;
  if (!isRecording) {
    startRecording();
  } else {
    stopRecording();
  }
});
