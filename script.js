// === FULLY REVISED SCRIPT.JS WITH RELIABLE AUDIO PLAYBACK, INPUT, DUAL WAVEFORM, INFO BAR, AND GREETING ===

let recognition, audioContext, analyser, dataArray, source;
let outputAudioContext, outputAnalyser, outputDataArray, outputSource;
let isRecording = false;
let userStream;
let currentTranscript = '';
let lastTranscript = ''; // NEW: To prevent duplicates
let speakBtn;

// (Unchanged setup functions here...)

// PATCHED: Debounce Logic to Prevent Duplicate Input Submissions
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
      audioContext.resume().then(() => console.log('AudioContext resumed successfully for iOS.'));
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
      lastTranscript = tempTranscript; // Prevent resending the same input
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

// PATCHED: Ensure Output Analyzer is Rebuilt Properly on Every Play
function playAudioBuffer(audioData) {
  const audio = new Audio(audioData);
  audio.setAttribute('playsinline', 'true');
  audio.load();

  if (outputAudioContext && outputAudioContext.state !== 'closed') {
    outputAudioContext.close().catch(() => {});
  }
  outputAudioContext = new (window.AudioContext || window.webkitAudioContext)();
  outputAnalyser = outputAudioContext.createAnalyser();
  outputAnalyser.fftSize = 2048;
  outputDataArray = new Uint8Array(outputAnalyser.frequencyBinCount);

  audio.addEventListener('canplaythrough', () => {
    outputSource = outputAudioContext.createMediaElementSource(audio);
    outputSource.connect(outputAnalyser);
    outputAnalyser.connect(outputAudioContext.destination);
    // Delay playback to ensure analyzer connection is fully established
    setTimeout(() => audio.play().catch(err => console.error('Audio playback error:', err)), 100);
  });

  audio.onended = () => {
    speakBtn.classList.remove('active');
    speakBtn.innerText = 'SPEAK';
    if (outputAudioContext && outputAudioContext.state !== 'closed') {
      outputAudioContext.close().catch(() => {});
    }
  };
}

// (The rest of your script remains unchanged)
