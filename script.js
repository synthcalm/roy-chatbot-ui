// ✅ Roy's audio playback debug for consistent sound across all devices
// 🛠 Ensure audio plays and waveform is visualized after each bot reply

const royToggle = document.getElementById('roy-toggle');
const randyToggle = document.getElementById('randy-toggle');
const speakToggle = document.getElementById('speak-toggle');
const saveButton = document.getElementById('saveButton');
const userWaveform = document.getElementById('userWaveform');
const royWaveform = document.getElementById('royWaveform');
const messagesDiv = document.getElementById('messages');
const userCtx = userWaveform.getContext('2d');
const royCtx = royWaveform.getContext('2d');
const currentDate = document.getElementById('current-date');
const currentTime = document.getElementById('current-time');
const countdownTimer = document.getElementById('countdown-timer');

const BACKEND_URL = 'https://roy-chatbo-backend.onrender.com';

let isRecording = false;
let isRantMode = false;
let isModeSelected = false;
let sessionStartTime;
let chunks = [], volumeData = [], mediaRecorder;
let audioContext, analyser, dataArray, source;

function unlockAudio() {
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  audioContext.resume();
}

['click', 'touchstart'].forEach(evt => {
  document.body.addEventListener(evt, unlockAudio, { once: true });
});

function visualizeAudio(element, canvas, ctx, color) {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const analyser = audioCtx.createAnalyser();
  const source = audioCtx.createMediaElementSource(element);
  source.connect(analyser);
  analyser.connect(audioCtx.destination);
  analyser.fftSize = 2048;
  const dataArray = new Uint8Array(analyser.frequencyBinCount);

  function draw() {
    analyser.getByteFrequencyData(dataArray);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    for (let i = 0; i < dataArray.length; i++) {
      const value = dataArray[i];
      ctx.lineTo(i * (canvas.width / dataArray.length), canvas.height - value);
    }
    ctx.strokeStyle = color;
    ctx.stroke();
    requestAnimationFrame(draw);
  }
  draw();
}

async function playRoyAudio(base64) {
  const audio = new Audio(`data:audio/mp3;base64,${base64}`);
  audio.setAttribute('playsinline', '');
  audio.setAttribute('autoplay', '');
  audio.load();

  return new Promise((resolve) => {
    audio.onloadeddata = () => {
      audio.play().then(() => {
        visualizeAudio(audio, royWaveform, royCtx, 'yellow');
        resolve();
      }).catch(() => {
        const tryPlay = () => {
          audio.play().then(() => visualizeAudio(audio, royWaveform, royCtx, 'yellow'));
          document.body.removeEventListener('click', tryPlay);
          document.body.removeEventListener('touchstart', tryPlay);
          resolve();
        };
        document.body.addEventListener('click', tryPlay);
        document.body.addEventListener('touchstart', tryPlay);
      });
    };
  });
}
