let mediaRecorder;
let audioChunks = [];
let countdownInterval;
let countdownTime = 60 * 60; // 60 minutes
let selectedBot = null;
let isRecording = false;

const royButton = document.getElementById("roy");
const randyButton = document.getElementById("randy");
const speakButton = document.getElementById("speak");
const log = document.getElementById("log");
const timerDisplay = document.getElementById("countdown");
const dateDisplay = document.getElementById("date");
const audioEl = new Audio();
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let analyzer, source, dataArray, bufferLength;

document.addEventListener("DOMContentLoaded", () => {
  if (dateDisplay && timerDisplay) {
    updateDateTime();
    setInterval(updateDateTime, 1000);

    updateCountdown();
    countdownInterval = setInterval(updateCountdown, 1000);
  }
});

function updateDateTime() {
  const now = new Date();
  const formattedDate = now.getFullYear() + "/" +
                        String(now.getMonth() + 1).padStart(2, "0") + "/" +
                        String(now.getDate()).padStart(2, "0");
  const formattedTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (dateDisplay) dateDisplay.textContent = formattedDate + " " + formattedTime;
}

function updateCountdown() {
  const minutes = String(Math.floor(countdownTime / 60)).padStart(2, "0");
  const seconds = String(countdownTime % 60).padStart(2, "0");
  if (timerDisplay) timerDisplay.textContent = `${minutes}:${seconds}`;
  countdownTime--;
  if (countdownTime < 0) clearInterval(countdownInterval);
}

function resetButtons() {
  royButton.style.backgroundColor = "";
  royButton.style.borderColor = "";
  randyButton.style.backgroundColor = "";
  randyButton.style.borderColor = "";
  speakButton.style.backgroundColor = "#000";
  speakButton.style.borderColor = "#0ff";
  speakButton.textContent = "SPEAK";
}

function setRoyActive() {
  selectedBot = "roy";
  royButton.style.backgroundColor = "green";
  royButton.style.borderColor = "green";
  randyButton.style.backgroundColor = "";
  randyButton.style.borderColor = "#0ff";
  speakButton.style.backgroundColor = "red";
  speakButton.style.borderColor = "red";
}

function setRandyActive() {
  selectedBot = "randy";
  randyButton.style.backgroundColor = "orange";
  randyButton.style.borderColor = "orange";
  royButton.style.backgroundColor = "";
  royButton.style.borderColor = "#0ff";
  speakButton.style.backgroundColor = "red";
  speakButton.style.borderColor = "red";
}

royButton.addEventListener("click", () => {
  if (selectedBot === "roy") {
    selectedBot = null;
    resetButtons();
  } else {
    setRoyActive();
  }
});

randyButton.addEventListener("click", () => {
  if (selectedBot === "randy") {
    selectedBot = null;
    resetButtons();
  } else {
    setRandyActive();
  }
});

speakButton.addEventListener("click", async () => {
  if (!selectedBot) return;

  await audioCtx.resume(); // Required for iOS

  if (!isRecording) {
    speakButton.textContent = "STOP";
    speakButton.classList.add("blinking");
    isRecording = true;

    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      mediaRecorder = new MediaRecorder(stream);
      analyzer = audioCtx.createAnalyser();
      source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyzer);
      drawWaveform();

      audioChunks = [];
      mediaRecorder.ondataavailable = event => audioChunks.push(event.data);
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        const formData = new FormData();
        formData.append("audio", audioBlob);
        formData.append("bot", selectedBot);

        logMessage("You", "Transcribing...");
        try {
          const res = await fetch("https://roy-chatbo-backend.onrender.com/api/chat", {
            method: "POST",
            body: formData
          });
          const json = await res.json();
          const text = json.text || "undefined";
          const audioUrl = json.audioUrl || null;

          logMessage("You", text);
          if (audioUrl) {
            audioEl.src = audioUrl;
            audioEl.onplay = () => {
              try {
                const roySource = audioCtx.createMediaElementSource(audioEl);
                roySource.connect(audioCtx.destination);
                roySource.connect(analyzer);
                drawWaveformRoy();
              } catch (err) {
                console.error("Roy playback error:", err);
              }
            };
            audioEl.onended = () => {
              if (selectedBot) {
                speakButton.textContent = "SPEAK";
                speakButton.classList.remove("blinking");
              } else {
                resetButtons();
              }
            };
            audioEl.play();
          }
        } catch (err) {
          console.error("Transcription failed:", err);
          logMessage("Roy", "undefined");
        }
      };

      mediaRecorder.start();
      setTimeout(() => {
        mediaRecorder.stop();
        stream.getTracks().forEach(track => track.stop());
        isRecording = false;
      }, 5000); // Auto-stop after 5 sec
    });
  }
});

function logMessage(who, text) {
  const span = document.createElement("div");
  span.innerHTML = `<span style="color:${who === "Roy" ? "#ffff66" : "#fff"}">${who}:</span> <span style="color:${who === "Roy" ? "#ffff66" : "#fff"}">${text}</span>`;
  log.appendChild(span);
  log.scrollTop = log.scrollHeight;
}

function drawWaveform() {
  const canvas = document.getElementById("waveform");
  const ctx = canvas.getContext("2d");
  analyzer.fftSize = 256;
  bufferLength = analyzer.frequencyBinCount;
  dataArray = new Uint8Array(bufferLength);

  function draw() {
    requestAnimationFrame(draw);
    analyzer.getByteFrequencyData(dataArray);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    for (let i = 0; i < bufferLength; i++) {
      const barHeight = dataArray[i] / 2;
      ctx.fillStyle = "yellow";
      ctx.fillRect(i * 3, canvas.height - barHeight, 2, barHeight);
    }
  }
  draw();
}

function drawWaveformRoy() {
  const canvas = document.getElementById("waveform");
  const ctx = canvas.getContext("2d");
  analyzer.fftSize = 256;
  bufferLength = analyzer.frequencyBinCount;
  dataArray = new Uint8Array(bufferLength);

  function draw() {
    requestAnimationFrame(draw);
    analyzer.getByteFrequencyData(dataArray);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    for (let i = 0; i < bufferLength; i++) {
      const barHeight = dataArray[i] / 2;
      ctx.fillStyle = "magenta";
      ctx.fillRect(i * 3, canvas.height - barHeight, 2, barHeight);
    }
  }
  draw();
}
