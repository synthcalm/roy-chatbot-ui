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
// ✅ server.js - Express backend for Roy Chatbot

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;
const upload = multer();

app.use(cors());
app.use(express.json());

// POST /api/transcribe
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    const form = new FormData();
    form.append('file', req.file.buffer, {
      filename: 'audio.webm',
      contentType: 'audio/webm'
    });
    form.append('model', 'whisper-1');

    const transcript = await axios.post('https://api.openai.com/v1/audio/transcriptions', form, {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        ...form.getHeaders()
      }
    });

    res.json({ text: transcript.data.text });
  } catch (err) {
    console.error('Transcription error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Transcription failed', detail: err.response?.data });
  }
});

// POST /api/chat
app.post('/api/chat', async (req, res) => {
  try {
    const {
      message,
      persona = 'default',
      tone = 'casual-direct',
      poeticLevel = 0.1,
      disfluencyLevel = 0.3,
      jobsStyleLevel = 0.25,
      volumeData = []
    } = req.body;

    const systemPrompt = persona === 'randy'
      ? `You are Randy, an unfiltered, intense speaker who sounds like a cross between a renegade poet and a street prophet. Speak in gritty, cinematic language. Channel a raw, prophetic tone like the 'tears in rain' monologue. No sugar-coating. Punch hard with words. Keep your style 60% film noir, 40% urgent reality. Every reply should feel like the final scene of a cult movie. After each rant, check in on the user—ask how they’re doing, reflect on what they just shared, and wrap up with a tough-love coach insight that helps them reframe or refocus.`
      : `You are Roy, a grounded AI mentor. Speak in casual American English with about 30% real-life disfluencies ("you know...", "well...", "I mean..."), 10% poetic metaphor, and 25% insightful cultural references. Avoid quoting Steve Jobs. Instead, use quotes or ideas from Middle Eastern poets, timeless lyrics, or reflective lines from sci-fi characters like Roy Batty. Speak in short, impactful bursts, not long speeches. You speak like a conflicted, thoughtful friend.`;

    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ]
    }, {
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }
    });

    const replyText = response.data.choices[0].message.content;

    const audioResponse = await axios.post('https://api.openai.com/v1/audio/speech', {
      model: 'tts-1',
      voice: 'onyx',
      input: replyText
    }, {
      responseType: 'arraybuffer',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const audioBase64 = Buffer.from(audioResponse.data).toString('base64');
    res.json({ text: replyText, audio: audioBase64 });
  } catch (err) {
    console.error('Chat error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Chat failed', detail: err.response?.data });
  }
});

app.listen(port, () => console.log(`Roy backend listening on port ${port}`));
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
    if (!selectedBot || isRecording) return;

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
          const loadingDots = document.querySelector('.dots');
if (loadingDots) loadingDots.remove();
logMessage("You", text);

          if (audioBase64) {
            audioEl.src = `data:audio/mp3;base64,${audioBase64}`;
            audioEl.onended = () => {
              resetButtons();
              console.log("[AUDIO] Playback ended");
            };

            try {
              if (roySource) roySource.disconnect();
              roySource = audioCtx.createMediaElementSource(audioEl);
              roySource.connect(audioCtx.destination);
              roySource.connect(analyzer);
              drawWaveform("royWaveform", "magenta");
              audioEl.play();
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
              console.log("[AUDIO] Playback started");
            } catch (err) {
              console.error("Roy audio connection error:", err);
              resetButtons();
            }
          } else {
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
