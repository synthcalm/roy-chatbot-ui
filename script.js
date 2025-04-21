document.addEventListener("DOMContentLoaded", () => {
  let mediaRecorder;
  let audioChunks = [];
  let countdownInterval;
  let countdownTime = 60 * 60; // 60 minutes
  let selectedBot = null;
  let isRecording = false;
  let stream = null; // To store the media stream for cleanup
  let analyzer, source, dataArray, bufferLength;
  let isDrawingWaveform = false; // To control waveform animation

  const royButton = document.getElementById("royBtn");
  const randyButton = document.getElementById("randyBtn");
  const speakButton = document.getElementById("speakBtn");
  const log = document.getElementById("messages");
  const timerDisplay = document.getElementById("countdown-timer");
  const dateDisplay = document.getElementById("date-time");
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

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
    // If a bot is selected, keep the button red; otherwise, reset to cyan
    if (selectedBot) {
      speakButton.style.backgroundColor = "red";
      speakButton.style.borderColor = "red";
      speakButton.style.color = "white";
    } else {
      speakButton.style.backgroundColor = "#000";
      speakButton.style.borderColor = "#0ff";
      speakButton.style.color = "cyan";
    }
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
    speakButton.style.color = "white";
  }

  function setRandyActive() {
    selectedBot = "randy";
    randyButton.style.backgroundColor = "orange";
    randyButton.style.borderColor = "orange";
    royButton.style.backgroundColor = "";
    royButton.style.borderColor = "#0ff";
    speakButton.style.backgroundColor = "red";
    speakButton.style.borderColor = "red";
    speakButton.style.color = "white";
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
    if (!selectedBot) {
      console.log("[UI] No bot selected");
      return;
    }

    // Toggle: If recording, stop; if not recording, start
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

    // Start recording
    console.log("[UI] Speak button clicked");
    await audioCtx.resume(); // iOS fix
    speakButton.textContent = "STOP";
    speakButton.style.backgroundColor = "red";
    speakButton.style.borderColor = "red";
    speakButton.style.color = "white";
    speakButton.classList.add("blinking");
    isRecording = true;

    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      analyzer = audioCtx.createAnalyser();
      source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyzer);
      isDrawingWaveform = true;
      drawWaveform("userWaveform", "yellow");

      audioChunks = [];
      mediaRecorder.ondataavailable = e => {
        if (e.data.size > 0) {
          audioChunks.push(e.data);
          console.log("[MIC] Audio chunk received, size:", e.data.size);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log("[MIC] Recording stopped");
        isDrawingWaveform = false; // Stop user waveform

        // Force button state change in case the event is delayed on iOS
        speakButton.textContent = "SPEAK";
        speakButton.classList.remove("blinking");
        speakButton.style.backgroundColor = "red";
        speakButton.style.borderColor = "red";
        speakButton.style.color = "white";
        isRecording = false;

        if (audioChunks.length === 0) {
          console.log("[MIC] No audio data recorded");
          cleanupRecording();
          return;
        }

        // Safari fix for MIME type
        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        const mimeType = isSafari ? 'audio/mp4' : 'audio/wav';
        const audioBlob = new Blob(audioChunks, { type: mimeType });
        const formData = new FormData();
        formData.append("audio", audioBlob);

        logMessage("You", "Transcribing...");
        logMessage("Roy", `<span class='dots'>. . .</span>`);

        try {
          // Step 1: Transcribe the user's audio
          const transcribeRes = await fetch("https://roy-chatbo-backend.onrender.com/api/transcribe", {
            method: "POST",
            body: formData
          });
          const transcribeJson = await transcribeRes.json();
          const userText = transcribeJson.text || "undefined";
          console.log("[TRANSCRIBE] User text:", userText);

          // Update the "Transcribing..." message with the user's transcription
          const transcribingMessage = log.lastChild.previousSibling; // Get the "Transcribing..." message
          if (transcribingMessage && transcribingMessage.textContent.includes("Transcribing...")) {
            transcribingMessage.innerHTML = `<span style="color:#fff">You:</span> <span style="color:#fff">${userText}</span>`;
          } else {
            logMessage("You", userText); // Fallback
          }

          // Step 2: Get Roy's response
          const chatRes = await fetch("https://roy-chatbo-backend.onrender.com/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: userText,
              persona: selectedBot,
              mode: "both"
            })
          });
          const chatJson = await chatRes.json();
          const royText = chatJson.text || "undefined";
          const audioBase64 = chatJson.audio;
          console.log("[AUDIO] base64 length:", audioBase64?.length);

          const loadingDots = document.querySelector('.dots');
          if (loadingDots) loadingDots.parentElement.remove();
          logMessage("Roy", royText);

          if (audioBase64) {
            const tempAudio = new Audio();
            tempAudio.src = `data:audio/mp3;base64,${audioBase64}`;
            tempAudio.setAttribute('playsinline', ''); // iOS fix
            tempAudio.onended = () => {
              console.log("[AUDIO] Playback ended");
              isDrawingWaveform = false; // Stop Roy's waveform
              cleanupRecording();
            };

            const tempSource = audioCtx.createMediaElementSource(tempAudio);
            tempSource.connect(audioCtx.destination);
            tempSource.connect(analyzer);
            isDrawingWaveform = true;
            drawWaveform("royWaveform", "magenta");
            tempAudio.play();
            console.log("[AUDIO] Playback started");
          } else {
            const loadingDots = document.querySelector('.dots');
            if (loadingDots) loadingDots.parentElement.remove();
            logMessage("Roy", "undefined");
            cleanupRecording();
          }
        } catch (err) {
          console.error("Transcription or chat failed:", err);
          const transcribingMessage = log.lastChild.previousSibling;
          if (transcribingMessage && transcribingMessage.textContent.includes("Transcribing...")) {
            transcribingMessage.innerHTML = `<span style="color:#fff">You:</span> <span style="color:#fff">Transcription failed</span>`;
          }
          const loadingDots = document.querySelector('.dots');
          if (loadingDots) loadingDots.parentElement.remove();
          logMessage("Roy", "undefined");
          cleanupRecording();
        }
      };

      mediaRecorder.onerror = (err) => {
        console.error("[MIC] MediaRecorder error:", err);
        cleanupRecording();
      };

      mediaRecorder.start();
      console.log("[MIC] Recording started");
    } catch (err) {
      console.error("Microphone access denied:", err);
      cleanupRecording();
    }
  });

  function cleanupRecording() {
    console.log("[CLEANUP] Cleaning up recording state");
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }
    if (source) {
      source.disconnect();
      source = null;
    }
    mediaRecorder = null;
    audioChunks = [];
    isRecording = false;
    isDrawingWaveform = false;
    resetButtons();
  }

  function logMessage(who, text) {
    const span = document.createElement("div");
    span.innerHTML = `<span style="color:${who === "Roy" ? "#ffff66" : "#fff"}">${who}:</span> <span style="color:${who === "Roy" ? "#ffff66" : "#fff"}">${text}</span>`;
    log.appendChild(span);
    log.scrollTop = log.scrollHeight;
  }

  function drawWaveform(canvasId, color) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
      console.error(`[WAVEFORM] Canvas with ID ${canvasId} not found`);
      return;
    }
    const ctx = canvas.getContext("2d");
    analyzer.fftSize = 256;
    bufferLength = analyzer.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);

    function draw() {
      if (!isDrawingWaveform) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }
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
