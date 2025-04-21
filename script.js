document.addEventListener("DOMContentLoaded", () => {
  let mediaRecorder;
  let audioChunks = [];
  let countdownInterval;
  let countdownTime = 60 * 60; // 60 minutes
  let selectedBot = null;
  let isRecording = false;
  let roySource = null;

  const royButton = document.getElementById("royBtn");
  const randyButton = document.getElementById("randyBtn");
  const speakButton = document.getElementById("speakBtn");
  const log = document.getElementById("messages");
  const timerDisplay = document.getElementById("countdown-timer");
  const dateDisplay = document.getElementById("date-time");
  const audioEl = new Audio();
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  let analyzer, source, dataArray, bufferLength;

  if (!dateDisplay || !timerDisplay || !royButton || !randyButton || !speakButton || !log) {
    console.warn("Some DOM elements are missing. UI may not function as expected.");
    return;
  }

  updateDateTime();
  setInterval(updateDateTime, 1000);

  updateCountdown();
  countdownInterval = setInterval(updateCountdown, 1000);

  function updateDateTime() {
    const now = new Date();
    const formattedDate = now.getFullYear() + "/" +
                          String(now.getMonth() + 1).padStart(2, "0") + "/" +
                          String(now.getDate()).padStart(2, "0");
    const formattedTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    dateDisplay.textContent = formattedDate + " " + formattedTime;
  }

  function updateCountdown() {
    const minutes = String(Math.floor(countdownTime / 60)).padStart(2, "0");
    const seconds = String(countdownTime % 60).padStart(2, "0");
    timerDisplay.textContent = `${minutes}:${seconds}`;
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
    speakButton.classList.remove("blinking");
    isRecording = false;
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

    if (isRecording) {
      mediaRecorder.stop();
      console.log("[MIC] Manual stop triggered");
      return;
    }

    await audioCtx.resume(); // iOS fix

    speakButton.textContent = "STOP";
    speakButton.classList.add("blinking");
    isRecording = true;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      analyzer = audioCtx.createAnalyser();
      source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyzer);
      drawWaveform("userWaveform", "yellow");

      audioChunks = [];
      mediaRecorder.ondataavailable = e => audioChunks.push(e.data);

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        const formData = new FormData();
        formData.append("audio", audioBlob);
        formData.append("bot", selectedBot);

        logMessage("You", "Transcribing...");
        logMessage("Roy", `<span class='dots'>. . .</span>`);
        try {
          const res = await fetch("https://roy-chatbo-backend.onrender.com/api/chat", {
            method: "POST",
            body: formData
          });
          const json = await res.json();
          const text = json.text || "undefined";
          const audioBase64 = json.audio;
          console.log("[AUDIO] base64 length:", audioBase64?.length);
          const loadingDots = document.querySelector('.dots');
          if (loadingDots) loadingDots.remove();
          logMessage("Roy", text);

          if (audioBase64) {
            const tempAudio = new Audio();
            tempAudio.src = `data:audio/mp3;base64,${audioBase64}`;
            tempAudio.onended = () => {
              resetButtons();
              console.log("[AUDIO] Playback ended");
            };

            try {
              const tempSource = audioCtx.createMediaElementSource(tempAudio);
              tempSource.connect(audioCtx.destination);
              tempSource.connect(analyzer);
              drawWaveform("royWaveform", "magenta");
              tempAudio.play();
              console.log("[AUDIO] Playback started");
            } catch (err) {
              console.error("Roy audio connection error:", err);
              resetButtons();
            }
              console.log("[AUDIO] Playback started");
            } catch (err) {
              console.error("Roy audio connection error:", err);
              resetButtons();
            }
          } else {
            const loadingDots = document.querySelector('.dots');
            if (loadingDots) loadingDots.remove();
            logMessage("Roy", "undefined");
            resetButtons();
          }
        } catch (err) {
          console.error("Transcription fetch failed:", err);
          logMessage("Roy", "undefined");
          resetButtons();
        }
      };

      mediaRecorder.start();
      console.log("[MIC] Recording started");

      setTimeout(() => {
        mediaRecorder.stop();
        stream.getTracks().forEach(track => track.stop());
        isRecording = false;
        console.log("[MIC] Recording stopped");
      }, 5000);
    } catch (err) {
      console.error("Microphone access denied:", err);
      resetButtons();
    }
  });

  function logMessage(who, text) {
    const span = document.createElement("div");
    span.innerHTML = `<span style="color:${who === "Roy" ? "#ffff66" : "#fff"}">${who}:</span> <span style="color:${who === "Roy" ? "#ffff66" : "#fff"}">${text}</span>`;
    log.appendChild(span);
    log.scrollTop = log.scrollHeight;
  }

  function drawWaveform(canvasId, color) {
    const canvas = document.getElementById(canvasId);
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
        ctx.fillStyle = color;
        ctx.fillRect(i * 3, canvas.height - barHeight, 2, barHeight);
      }
    }
    draw();
  }
});
