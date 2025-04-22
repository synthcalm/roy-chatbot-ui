const royBtn = document.getElementById('royBtn');
const randyBtn = document.getElementById('randyBtn');
const speakBtn = document.getElementById('speakBtn');
const saveBtn = document.getElementById('saveBtn');
const homeBtn = document.getElementById('homeBtn');
const messagesDiv = document.getElementById('messages');
const userCanvas = document.getElementById('userWaveform');
const royCanvas = document.getElementById('royWaveform');
const scopesContainer = document.getElementById('scopes-container');
const userCtx = userCanvas.getContext('2d');
const royCtx = royCanvas.getContext('2d');
const dateTimeSpan = document.getElementById('date-time');
const countdownTimerSpan = document.getElementById('countdown-timer');

let mediaRecorder, audioChunks = [], isRecording = false;
let selectedPersona = null;
let userAudioContext = null;
let royAudioContext = null;
let royAudioSource = null;
let stream = null;

function initButtonStyles() {
    royBtn.style.border = '1px solid cyan';
    randyBtn.style.border = '1px solid cyan';
    saveBtn.style.border = '1px solid cyan';
    speakBtn.style.backgroundColor = 'black';
    speakBtn.style.color = 'cyan';
    speakBtn.style.border = '1px solid cyan';
}

function addMessage(text, sender, isThinking = false) {
    const msg = document.createElement('p');
    msg.className = sender;

    if (isThinking) {
        msg.classList.add('thinking');
        const baseText = text.endsWith('Thinking') ? text : `${text} Thinking`;
        msg.textContent = baseText;
        const dotsSpan = document.createElement('span');
        dotsSpan.className = 'thinking-dots';
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
    if (!stream) {
        console.error("[VISUALIZER] No audio stream available for user waveform.");
        userCtx.clearRect(0, 0, userCanvas.width, userCanvas.height);
        return;
    }
    if (userAudioContext && userAudioContext.state !== 'closed') userAudioContext.close();

    try {
        userAudioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = userAudioContext.createMediaStreamSource(stream);
        const analyser = userAudioContext.createAnalyser();
        analyser.fftSize = 2048;
        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        source.connect(analyser);

        function animate() {
            if (!isRecording) {
                userCtx.clearRect(0, 0, userCanvas.width, userCanvas.height);
                return;
            }
            analyser.getByteTimeDomainData(dataArray);
            drawWaveform(userCtx, userCanvas, dataArray, 'yellow', true);
            requestAnimationFrame(animate);
        }

        animate();
    } catch (error) {
        console.error("[VISUALIZER] Error setting up user visualization:", error);
        userCtx.clearRect(0, 0, userCanvas.width, userCanvas.height);
    }
}

// Helper function to convert base64 to Blob
function base64ToBlob(base64, mimeType) {
    const byteString = atob(base64);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);

    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }

    return new Blob([ab], { type: mimeType });
}

function playRoyAudio(base64Audio) {
    console.log("[AUDIO] Attempting to play audio, data length:", base64Audio?.length);
    if (!base64Audio) {
        console.error("[AUDIO] No audio data provided");
        return;
    }

    // Create a temporary object URL instead of keeping base64 in memory
    const audioBlob = base64ToBlob(base64Audio, 'audio/mp3');
    const audioUrl = URL.createObjectURL(audioBlob);

    const audioEl = new Audio(audioUrl);
    audioEl.setAttribute('playsinline', '');
    audioEl.setAttribute('controlsList', 'nodownload'); // Disable download in browsers that support it

    // Disable right-click menu on audio element
    audioEl.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        return false;
    });

    if (royAudioContext && royAudioContext.state !== 'closed') {
        try {
            if (royAudioSource) royAudioSource.disconnect();
            royAudioContext.close();
        } catch (e) {
            console.log('Error closing previous audio context:', e);
        }
    }

    royAudioContext = new (window.AudioContext || window.webkitAudioContext)();

    audioEl.addEventListener('canplaythrough', () => {
        try {
            royAudioSource = royAudioContext.createMediaElementSource(audioEl);
            const analyser = royAudioContext.createAnalyser();
            analyser.fftSize = 2048;
            const dataArray = new Uint8Array(analyser.frequencyBinCount);

            royAudioSource.connect(analyser);
            analyser.connect(royAudioContext.destination);

            let animationId;

            function animate() {
                analyser.getByteTimeDomainData(dataArray);
                const waveformColor = selectedPersona === 'randy' ? 'orange' : 'magenta';
                drawWaveform(royCtx, royCanvas, dataArray, waveformColor, false);
                animationId = requestAnimationFrame(animate);
            }

            animate();
            audioEl.play();

            audioEl.addEventListener('ended', () => {
                cancelAnimationFrame(animationId);
                royCtx.clearRect(0, 0, royCanvas.width, royCanvas.height);
                speakBtn.textContent = 'SPEAK';
                speakBtn.classList.remove('blinking');
                speakBtn.style.backgroundColor = 'red';
                speakBtn.style.color = 'white';
                speakBtn.style.border = '1px solid red';
                URL.revokeObjectURL(audioUrl); // Release the URL object
                cleanupRecording();
            });

            // Also revoke URL if there's an error
            audioEl.addEventListener('error', () => {
                console.error("[AUDIO] Error playing audio");
                URL.revokeObjectURL(audioUrl);
                cleanupRecording();
            });

        } catch (error) {
            console.error('Audio visualization failed:', error);
            URL.revokeObjectURL(audioUrl);
            audioEl.play();
        }
    });

    audioEl.load();
}

function resetButtonColors() {
    royBtn.style.backgroundColor = 'black';
    royBtn.style.color = 'cyan';
    royBtn.style.border = '1px solid cyan';

    randyBtn.style.backgroundColor = 'black';
    randyBtn.style.color = 'cyan';
    randyBtn.style.border = '1px solid cyan';

    speakBtn.style.backgroundColor = 'black';
    speakBtn.style.color = 'cyan';
    speakBtn.style.border = '1px solid cyan';
    speakBtn.textContent = 'SPEAK';
    speakBtn.classList.remove('blinking');

    isRecording = false;
    selectedPersona = null;

    userCtx.clearRect(0, 0, userCanvas.width, userCanvas.height);
    royCtx.clearRect(0, 0, royCanvas.width, royCanvas.height);
}

function updateDateTime() {
    const now = new Date();
    const date = now.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
    const time = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true });
    dateTimeSpan.textContent = `${date}   ${time}`;
    setTimeout(updateDateTime, 60000);
}

function startCountdownTimer() {
    let timeLeft = 60 * 60; // 60 minutes

    const timer = setInterval(() => {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        countdownTimerSpan.textContent = `<span class="math-inline">\{minutes\}\:</span>{seconds < 10 ? '0' : ''}${seconds}`;
        timeLeft--;

        if (timeLeft < 0) {
            clearInterval(timer);
            countdownTimerSpan.textContent = '0:00';
        }
    }, 1000);
}

royBtn.addEventListener('click', () => {
    resetButtonColors();
    selectedPersona = 'roy';

    royBtn.style.backgroundColor = 'green';
    royBtn.style.color = 'white';
    royBtn.style.border = '1px solid green';

    speakBtn.style.backgroundColor = 'red';
    speakBtn.style.color = 'white';
    speakBtn.style.border = '1px solid red';

    scopesContainer.style.borderColor = 'cyan';
    addMessage('Roy: Greetings, my friend—like a weary traveler, you\'ve arrived. What weighs on your soul today?', 'roy');
});

randyBtn.addEventListener('click', () => {
    resetButtonColors();
    selectedPersona = 'randy';

    randyBtn.style.backgroundColor = '#FFC107';
    randyBtn.style.color = 'white';
    randyBtn.style.border = '1px solid #FFC107';

    speakBtn.style.backgroundColor = 'red';
    speakBtn.style.color = 'white';
    speakBtn.style.border = '1px solid red';

    scopesContainer.style.borderColor = 'red';
    addMessage('Randy: Unleash the chaos—what\'s burning you up?', 'randy');
});

// Check backend health
async function checkBackendHealth() {
    try {
        const response = await fetch('https://roy-chatbo-backend.onrender.com/api/health', {
            method: 'GET',
        });
        console.log("[API] Backend health check:", response.ok ? "OK" : "Failed");
        return response.ok;
    } catch (error) {
        console.error("[API] Backend health check error:", error);
        return false;
    }
}

speakBtn.addEventListener('click', async () => {
    if (!selectedPersona) {
        alert('Please choose Roy or Randy first.');
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
        speakBtn.textContent = 'STOP';
        speakBtn.classList.add('blinking');
        audioChunks = [];

        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setupUserVisualization(stream); // Ensure stream is passed
        mediaRecorder = new MediaRecorder(stream);

        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                audioChunks.push(e.data);
                console.log("[MIC] Audio chunk received, size:", e.data.size);
            }
        };

        mediaRecorder.onstop = async () => {
            console.log("[MIC] Recording stopped");
            speakBtn.textContent = 'SPEAK';
            speakBtn.classList.remove('blinking');
            speakBtn.style.backgroundColor = 'red';
            speakBtn.style.color = 'white';
            speakBtn.style.border = '1px solid red';
            isRecording = false;

            userCtx.clearRect(0, 0, userCanvas.width, userCanvas.height);

            if (audioChunks.length === 0) {
                console.log("[MIC] No audio data recorded");
                cleanupRecording();
                return;
            }

            // Check backend health before proceeding
            const backendHealthy = await checkBackendHealth();
            if (!backendHealthy) {
                alert("Backend service appears to be unavailable. Please try again later.");
                cleanupRecording();
                return;
            }

            const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
            const mimeType = isSafari ? 'audio/mp4' : 'audio/wav';
            const audioBlob = new Blob(audioChunks, { type: mimeType });
            const formData = new FormData();
            formData.append('audio', audioBlob);
            formData.append('bot', selectedPersona);

            const transcribingMessage = addMessage('You: Transcribing...', 'user');
            const thinkingMessage = addMessage(`${selectedPersona === 'randy' ? 'Randy' : 'Roy'}`, selectedPersona, true);

            let userText = null;
            let royText = null;
            let audioBase64 = null;

            try {
                // Step 1: Try /api/transcribe first
                let transcribeResponse;
                try {
                    console.log("[API] Calling /api/transcribe...");
                    transcribeResponse = await fetch('https://roy-chatbo-backend.onrender.com/api/transcribe', {
                        method: 'POST',
                        body: formData,
                    });
                    console.log("[API] Transcribe status:", transcribeResponse.status);

                    if (!transcribeResponse.ok) {
                        const errorText = await transcribeResponse.text();
                        console.error(`[API] Transcribe error (${transcribeResponse.status}):`, errorText);
                        throw new Error(`Transcription failed with status: ${transcribeResponse.status}`);
                    }

                    const transcribeJson = await transcribeResponse.json();
                    userText = transcribeJson.text || "undefined";
                    console.log("[TRANSCRIBE] User text:", userText);
                } catch (transcribeError) {
                    console.warn("[TRANSCRIBE] /api/transcribe failed, falling back to /api/chat:", transcribeError);
                    // Fallback to /api/chat
                    try {
                        console.log("[API] Calling /api/chat with audio...");
                        const chatResponse = await fetch('https://roy-chatbo-backend.onrender.com/api/chat', {
                            method: 'POST',
                            body: formData,
                        });
                        console.log("[API] Chat status:", chatResponse.status);

                        if (!chatResponse.ok) {
                            const errorText = await chatResponse.text();
                            console.error(`[API] Chat error (${chatResponse.status}):`, errorText);
                            throw new Error(`Chat failed with status: ${chatResponse.status}`);
                        }

                        const chatJson = await chatResponse.json();
                        console.log("[API] Chat response structure (fallback with audio):", Object.keys(chatJson));
                        userText = chatJson.text || "undefined";
                        royText = chatJson.response || chatJson.text || "undefined"; // Assuming 'response' might hold Roy's text
                        audioBase64 = chatJson.audio;
                        console.log("[CHAT - FALLBACK] User text:", userText);
                        console.log("[CHAT - FALLBACK] Roy text:", royText);
                        console.log("[AUDIO - FALLBACK] base64 received:", audioBase64 ? "Yes" : "No");
                    } catch (chatError) {
                        console.error("[CHAT - FALLBACK] Fallback failed:", chatError);
                        throw chatError;
                    }
                }

                // Step 2: Update the UI with the user's transcription
                transcribingMessage.textContent = `You: ${userText}`;

                // Step 3: Call /api/chat with a JSON payload to get Roy's response (if not already fetched in fallback)
                if (userText !== "undefined" && !royText) {
                    console.log("[API] Calling /api/chat with JSON...");
                    const chatResponse = await fetch('https://roy-chatbo
