document.addEventListener("DOMContentLoaded", () => {
  const royButton = document.getElementById("royBtn");
  const randyButton = document.getElementById("randyBtn");
  const speakButton = document.getElementById("speakBtn");
  const saveButton = document.getElementById("saveBtn");
  const homeButton = document.getElementById("homeBtn");
  const messagesDiv = document.getElementById("messages");
  const userCanvas = document.getElementById("userWaveform");
  const royCanvas = document.getElementById("royWaveform");
  const scopesContainer = document.getElementById("scopes-container");
  const userCtx = userCanvas.getContext("2d");
  const royCtx = royCanvas.getContext("2d");
  const dateTimeSpan = document.getElementById("date-time");
  const countdownTimerSpan = document.getElementById("countdown-timer");

  let mediaRecorder, audioChunks = [], isRecording = false;
  let selectedBot = null;
  let audioCtx = null;
  let stream = null;
  let source = null;
  let analyzer = null;
  let dataArray = null;

  if (!dateTimeSpan || !countdownTimerSpan || !royButton || !randyButton || !speakButton || !messagesDiv) {
    console.warn("Some DOM elements are missing. UI may not function as expected.");
    return;
  }

  initButtonStyles();
  updateDateTime();
  startCountdownTimer();

  function initButtonStyles() {
    royButton.style.border = "1px solid cyan";
    randyButton.style.border = "1px solid cyan";
    saveButton.style.border = "1px solid cyan";
    speakButton.style.backgroundColor = "black";
    speakButton.style.color = "cyan";
    speakButton.style.border = "1px solid cyan";
  }

  function addMessage(text, sender, isThinking = false) {
    const msg = document.createElement("p");
    msg.className = sender;

    if (isThinking) {
      msg.classList.add("thinking");
      const baseText = text.endsWith("Thinking") ? text : `${text} Thinking`;
      msg.textContent = baseText;
      const dotsSpan = document.createElement("span");
      dotsSpan.className = "thinking-dots";
      msg.appendChild(dotsSpan);
    } else {
      msg.textContent = text;
    }

    messagesDiv.appendChild(msg);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    return msg;
  }

  function drawWaveform(canvasCtx, canvas, data, color, isUserWaveform) {
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
    canvasCtx.beginPath();

    const sliceWidth = canvas.width / data.length;
    const centerY = canvas.height / 2;
    const scale = isUserWaveform ? 50 : 80;

    for (let i = 0; i < data.length; i++) {
      const normalized = (data[i] / 128.0) - 1;
      const y = centerY + (normalized * scale);
      const x = i * sliceWidth;

      if (i === 0) canvasCtx.moveTo(x, y);
      else canvasCtx.lineTo(x, y);
    }

    canvasCtx.strokeStyle = color;
    canvasCtx.lineWidth = 2;
    canvasCtx.stroke();
  }

  function setupUserVisualization(stream) {
    if (audioCtx && audioCtx.state !== "closed") audioCtx.close();

    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    source = audioCtx.createMediaStreamSource(stream);
    analyzer = audioCtx.createAnalyser();
    analyzer.fftSize = 2048;
    dataArray = new Uint8Array(analyzer.frequencyBinCount);

    source.connect(analyzer);

    function animate() {
      if (!isRecording) {
        userCtx.clearRect(0, 0, userCanvas.width, userCanvas.height);
        return;
      }
      analyzer.getByteTimeDomainData(dataArray);
      drawWaveform(userCtx, userCanvas, dataArray, "yellow", true);
      requestAnimationFrame(animate);
    }

    animate();
  }

  function playRoyAudio(base64Audio) {
    const audioEl = new Audio(`data:audio/mp3;base64,${base64Audio}`);
    audioEl.setAttribute("playsinline", "");

    if (audioCtx && audioCtx.state !== "closed") {
      try {
        if (source) source.disconnect();
        audioCtx.close();
      } catch (e) {
        console.log("Error closing previous audio context:", e);
      }
    }

    audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    audioEl.addEventListener("canplaythrough", () => {
      try {
        source = audioCtx.createMediaElementSource(audioEl);
        analyzer = audioCtx.createAnalyser();
        analyzer.fftSize = 2048;
        dataArray = new Uint8Array(analyzer.frequencyBinCount);

        source.connect(analyzer);
        analyzer.connect(audioCtx.destination);

        let animationId;

        function animate() {
          analyzer.getByteTimeDomainData(dataArray);
          const waveformColor = selectedBot === "randy" ? "orange" : "magenta";
          drawWaveform(royCtx, royCanvas, dataArray, waveformColor, false);
          animationId = requestAnimationFrame(animate);
        }

        animate();
        audioEl.play();

        audioEl.addEventListener("ended", () => {
          cancelAnimationFrame(animationId);
          royCtx.clearRect(0, 0, royCanvas.width, royCanvas.height);
          speakButton.textContent = "SPEAK";
          speakButton.classList.remove("blinking");
          speakButton.style.backgroundColor = "red";
          speakButton.style.color = "white";
          speakButton.style.border = "1px solid red";
          cleanupRecording();
        });
      } catch (error) {
        console.error("Audio visualization failed:", error);
        audioEl.play();
      }
    });

    audioEl.load();
  }

  function resetButtonColors() {
    royButton.style.backgroundColor = "black";
    royButton.style.color = "cyan";
    royButton.style.border = "1px solid cyan";

    randyButton.style.backgroundColor = "black";
    randyButton.style.color = "cyan";
    randyButton.style.border = "1px solid cyan";

    speakButton.style.backgroundColor = "black";
    speakButton.style.color = "cyan";
    speakButton.style.border = "1px solid cyan";
    speakButton.textContent = "SPEAK";
    speakButton.classList.remove("blinking");

    isRecording = false;
    selectedBot = null;

    userCtx.clearRect(0, 0, userCanvas.width, userCanvas.height);
    royCtx.clearRect(0, 0, royCanvas.width, royCanvas.height);
  }

  function updateDateTime() {
    const now = new Date();
    const date = now.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "numeric" });
    const time = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "numeric", hour12: true });
    dateTimeSpan.textContent = `${date} ${time}`;
    setTimeout(updateDateTime, 60000);
  }

  function startCountdownTimer() {
    let timeLeft = 60 * 60; // 60 minutes

    const timer = setInterval(() => {
      const minutes = Math.floor(timeLeft / 60);
      const seconds = timeLeft % 60;
      countdownTimerSpan.textContent = `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
      timeLeft--;

      if (timeLeft < 0) {
        clearInterval(timer);
        countdownTimerSpan.textContent = "0:00";
      }
    }, 1000);
  }

  royButton.addEventListener("click", () => {
    resetButtonColors();
    selectedBot = "roy";

    royButton.style.backgroundColor = "green";
    royButton.style.color = "white";
    royButton.style.border = "1px solid green";

    speakButton.style.backgroundColor = "red";
    speakButton.style.color = "white";
    speakButton.style.border = "1px solid red";

    scopesContainer.style.borderColor = "cyan";
    addMessage("Roy: Greetings, my friend—like a weary traveler, you've arrived. What weighs on your soul today?", "roy");
  });

  randyButton.addEventListener("click", () => {
    resetButtonColors();
    selectedBot = "randy";

    randyButton.style.backgroundColor = "#FFC107";
    randyButton.style.color = "white";
    randyButton.style.border = "1px solid #FFC107";

    speakButton.style.backgroundColor = "red";
    speakButton.style.color = "white";
    speakButton.style.border = "1px solid red";

    scopesContainer.style.borderColor = "red";
    addMessage("Randy: Unleash the chaos—what's burning you up?", "randy");
  });

  speakButton.addEventListener("click", async () => {
    if (!selectedBot) {
      alert("Please choose Roy or Randy first.");
      return;
    }

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

    console.log("[UI] Speak button clicked");
    try {
      isRecording = true;
      speakButton.textContent = "STOP";
      speakButton.classList.add("blinking");
      audioChunks = [];

      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setupUserVisualization(stream);
      mediaRecorder = new MediaRecorder(stream);

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunks.push(e.data);
          console.log("[MIC] Audio chunk received, size:", e.data.size);
        }
      };

      mediaRecorder.onstop = async () => {
        console.log("[MIC] Recording stopped");
        speakButton.textContent = "SPEAK";
        speakButton.classList.remove("blinking");
        speakButton.style.backgroundColor = "red";
        speakButton.style.color = "white";
        speakButton.style.border = "1px solid red";
        isRecording = false;

        userCtx.clearRect(0, 0, userCanvas.width, userCanvas.height);

        if (audioChunks.length === 0) {
          console.log("[MIC] No audio data recorded");
          cleanupRecording();
          return;
        }

        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        const mimeType = isSafari ? "audio/mp4" : "audio/wav";
        const audioBlob = new Blob(audioChunks, { type: mimeType });
        const formData = new FormData();
        formData.append("audio", audioBlob);
        formData.append("bot", selectedBot);

        const transcribingMessage = addMessage("You: Transcribing...", "user");
        const thinkingMessage = addMessage(`${selectedBot === "randy" ? "Randy" : "Roy"}`, selectedBot, true);

        try {
          // Try /api/transcribe first
          let userText = null;
          try {
            const transcribeRes = await fetch("https://roy-chatbo-backend.onrender.com/api/transcribe", {
              method: "POST",
              body: formData,
            });
            if (!transcribeRes.ok) throw new Error(`Transcription failed with status: ${transcribeRes.status}`);
            const transcribeJson = await transcribeRes.json();
            userText = transcribeJson.text || "undefined";
            console.log("[TRANSCRIBE] User text:", userText);
          } catch (transcribeError) {
            console.warn("[TRANSCRIBE] /api/transcribe failed, falling back to /api/chat:", transcribeError);
            // Fallback to /api/chat if /api/transcribe fails
            const chatRes = await fetch("https://roy-chatbo-backend.onrender.com/api/chat", {
              method: "POST",
              body: formData,
            });
            if (!chatRes.ok) throw new Error(`Chat failed with status: ${chatRes.status}`);
            const chatJson = await chatRes.json();
            userText = chatJson.text || "undefined"; // Assume /api/chat returns the user's transcription in text
            console.log("[CHAT] User text (fallback):", userText);
          }

          // Update the "Transcribing..." message with the user's transcription
          transcribingMessage.textContent = `You: ${userText}`;

          // If /api/transcribe worked, now call /api/chat for Roy's response
          let royText = userText;
          let audioBase64 = null;
          if (userText !== "undefined") {
            const chatRes = await fetch("https://roy-chatbo-backend.onrender.com/api/chat", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                message: userText,
                persona: selectedBot,
                mode: "both",
              }),
            });
            if (!chatRes.ok) throw new Error(`Chat failed with status: ${chatRes.status}`);
            const chatJson = await chatRes.json();
            royText = chatJson.text || "undefined";
            audioBase64 = chatJson.audio;
            console.log("[AUDIO] base64 length:", audioBase64?.length);
          }

          thinkingMessage.remove();
          addMessage(`${selectedBot === "randy" ? "Randy" : "Roy"}: ${royText}`, selectedBot);

          if (audioBase64) {
            playRoyAudio(audioBase64);
          } else {
            thinkingMessage.remove();
            addMessage(`${selectedBot === "randy" ? "Randy" : "Roy"}: undefined`, selectedBot);
            cleanupRecording();
          }
        } catch (error) {
          console.error("Transcription or chat failed:", error);
          transcribingMessage.textContent = "You: Transcription failed";
          thinkingMessage.remove();
          addMessage(`${selectedBot === "randy" ? "Randy" : "Roy"}: undefined`, selectedBot);
          cleanupRecording();
        }
      };

      mediaRecorder.onerror = (err) => {
        console.error("[MIC] MediaRecorder error:", err);
        cleanupRecording();
      };

      mediaRecorder.start();
      console.log("[MIC] Recording started");
    } catch (error) {
      console.error("Microphone access denied:", error);
      alert("Could not access your microphone. Please allow access.");
      speakButton.textContent = "SPEAK";
      speakButton.classList.remove("blinking");
      speakButton.style.backgroundColor = "red";
      speakButton.style.color = "white";
      speakButton.style.border = "1px solid red";
      isRecording = false;
    }
  });

  saveButton.addEventListener("click", () => {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, "-");
    const filename = `${selectedBot || "conversation"}-${timestamp}.txt`;
    const blob = new Blob([messagesDiv.innerText], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
  });

  homeButton.addEventListener("click", () => {
    window.location.href = "https://synthcalm.com";
  });

  function cleanupRecording() {
    console.log("[CLEANUP] Cleaning up recording state");
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      stream = null;
    }
    if (source) {
      source.disconnect();
      source = null;
    }
    if (audioCtx && audioCtx.state !== "closed") {
      audioCtx.close();
      audioCtx = null;
    }
    mediaRecorder = null;
    audioChunks = [];
    isRecording = false;
  }

  window.addEventListener("load", () => {
    initButtonStyles();
    updateDateTime();
    startCountdownTimer();
    userCtx.clearRect(0, 0, userCanvas.width, userCanvas.height);
    royCtx.clearRect(0, 0, royCanvas.width, royCanvas.height);
  });
});
