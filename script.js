// === FULLY REVISED SCRIPT.JS WITH RELIABLE AUDIO PLAYBACK, INPUT, DUAL WAVEFORM, INFO BAR, AND GREETING ===

let recognition, audioContext, analyser, dataArray, source;
let outputAudioContext, outputAnalyser, outputDataArray, outputSource;
let isRecording = false;
let userStream;
let currentTranscript = '';
let lastTranscript = ''; // NEW: To prevent duplicates
let speakBtn;

// Existing functions remain unchanged above...

// NEW: Start Transcription (Microphone Input and Waveform Drawing)
function startTranscription(ctx, canvas) {
  if (!('webkitSpeechRecognition' in window)) {
    alert('Speech recognition not supported in this browser.');
    return;
  }
  recognition = new webkitSpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
    userStream = stream;
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') {
      audioContext.resume().then(() => console.log('AudioContext resumed successfully.'));
    }
    source = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    dataArray = new Uint8Array(analyser.frequencyBinCount);
    source.connect(analyser);
    isRecording = true;
    drawMergedWaveform(ctx, canvas);
    recognition.start();
  });

  recognition.onresult = event => {
    let tempTranscript = Array.from(event.results).map(result => result[0].transcript).join('').trim();
    if (tempTranscript && tempTranscript !== lastTranscript) {
      currentTranscript = tempTranscript;
      lastTranscript = tempTranscript;
    }
  };

  recognition.onend = () => {
    if (isRecording) recognition.start();
  };

  recognition.onerror = event => {
    console.error('Recognition error:', event.error);
    if (isRecording) {
      recognition.stop();
      recognition.start();
    }
  };
}

// NEW: Stop User Recording Function
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
}
