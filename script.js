// DOM Elements
const messagesDiv = document.getElementById('messages');
const userInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const startSpeechButton = document.getElementById('start-speech');
const currentDateSpan = document.getElementById('current-date');
const currentTimeSpan = document.getElementById('current-time');
const countdownTimerSpan = document.getElementById('countdown-timer');
const royAudio = document.getElementById('roy-audio');
const responseModeSelect = document.getElementById('responseMode');
const userWaveformCanvas = document.getElementById('userWaveform');

// Waveform Visualization
let audioContext, analyser, animationId, source;
function startWaveform() {
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            source = audioContext.createMediaStreamSource(stream);
            source.connect(analyser);
            analyser.fftSize = 2048;
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            const canvasCtx = userWaveformCanvas.getContext('2d');
            userWaveformCanvas.width = userWaveformCanvas.offsetWidth;

            function drawWaveform() {
                animationId = requestAnimationFrame(drawWaveform);
                analyser.getByteTimeDomainData(dataArray);
                canvasCtx.fillStyle = 'black';
                canvasCtx.fillRect(0, 0, userWaveformCanvas.width, userWaveformCanvas.height);
                canvasCtx.lineWidth = 2;
                canvasCtx.strokeStyle = 'cyan';
                canvasCtx.beginPath();
                const sliceWidth = userWaveformCanvas.width / bufferLength;
                let x = 0;
                for (let i = 0; i < bufferLength; i++) {
                    const v = dataArray[i] / 128.0;
                    const y = (v * userWaveformCanvas.height) / 2;
                    if (i === 0) canvasCtx.moveTo(x, y);
                    else canvasCtx.lineTo(x, y);
                    x += sliceWidth;
                }
                canvasCtx.lineTo(userWaveformCanvas.width, userWaveformCanvas.height / 2);
                canvasCtx.stroke();
            }
            drawWaveform();
        })
        .catch(err => {
            console.error('Waveform error:', err);
            messagesDiv.innerHTML += `<p class="message bot"><strong>Error:</strong> Failed to access microphone for waveform: ${err.message}</p>`;
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        });
}

function stopWaveform() {
    if (animationId) cancelAnimationFrame(animationId);
    if (source) source.disconnect();
    if (audioContext) audioContext.close();
    const canvasCtx = userWaveformCanvas.getContext('2d');
    canvasCtx.clearRect(0, 0, userWaveformCanvas.width, userWaveformCanvas.height);
}

// Timer Functions
function updateDateTime() {
    const now = new Date();
    if (currentDateSpan) {
        currentDateSpan.textContent = now.toLocaleDateString('en-US', { 
            weekday: 'short', month: 'short', day: 'numeric' 
        });
    }
    if (currentTimeSpan) {
        currentTimeSpan.textContent = now.toLocaleTimeString('en-US', { 
            hour: '2-digit', minute: '2-digit', second: '2-digit' 
        });
    }
}

let countdownSeconds = 600; // 10 minutes
function updateCountdown() {
    if (countdownTimerSpan) {
        const minutes = Math.floor(countdownSeconds / 60);
        const seconds = countdownSeconds % 60;
        countdownTimerSpan.textContent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
        if (countdownSeconds > 0) {
            countdownSeconds--;
        } else {
            countdownTimerSpan.textContent = '0:00';
        }
    }
}

setInterval(updateDateTime, 1000);
setInterval(updateCountdown, 1000);
updateDateTime();

// Speech Synthesis for Roy's audio response
function speakText(text) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    speechSynthesis.speak(utterance);
}

// Function to handle Roy's response
function handleRoyResponse(message) {
    const simulatedResponse = `I heard you say: "${message}". How can I assist you further?`;
    const mode = responseModeSelect.value;
    if (mode === 'both' || mode === 'text') {
        messagesDiv.innerHTML += `<p class="message roy"><strong>Roy:</strong> ${simulatedResponse}</p>`;
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }
    if (mode === 'both' || mode === 'voice') {
        speakText(simulatedResponse);
    }
}

// Initial greeting on page load
window.addEventListener('load', () => {
    const greeting = "Hello! I'm Roy, your SynthCalm assistant. How can I help you today?";
    messagesDiv.innerHTML += `<p class="message roy"><strong>Roy:</strong> ${greeting}</p>`;
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    speakText(greeting);
});

// Speech Recognition
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let isRecording = false;

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = true; // Keep STT running until stopped
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
        console.log('Speech result:', event.results);
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            console.log(`Transcript [${i}]: ${transcript}, isFinal: ${event.results[i].isFinal}`);
            if (event.results[i].isFinal) {
                finalTranscript += transcript + ' ';
            } else {
                interimTranscript += transcript;
            }
        }

        const newValue = finalTranscript + interimTranscript;
        if (newValue && userInput) {
            userInput.value = newValue.trim();
            userInput.dispatchEvent(new Event('input'));
            console.log('Set userInput.value:', newValue);
        }
    };

    recognition.onerror = (event) => {
        console.error('Speech error:', event.error);
        messagesDiv.innerHTML += `<p class="message bot"><strong>Error:</strong> Speech recognition failed: ${event.error}</p>`;
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        if (event.error !== 'aborted') {
            isRecording = false;
            startSpeechButton.classList.remove('active');
            stopWaveform();
        }
    };

    recognition.onend = () => {
        console.log('Speech recognition ended');
        if (isRecording) {
            // Restart recognition if the user hasn't stopped it
            try {
                recognition.start();
                console.log('Speech recognition restarted');
            } catch (err) {
                console.error('Restart error:', err);
            }
        } else {
            // User stopped manually, trigger Roy's response
            startSpeechButton.classList.remove('active');
            stopWaveform();
            const message = userInput.value.trim();
            if (message) {
                messagesDiv.innerHTML += `<p class="message user"><strong>You:</strong> ${message}</p>`;
                handleRoyResponse(message);
                userInput.value = '';
            }
        }
    };

    recognition.onnomatch = () => {
        console.log('No speech detected');
        messagesDiv.innerHTML += `<p class="message bot"><strong>Notice:</strong> No speech detected. Keep speaking or press stop.</p>`;
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    };
} else {
    console.warn('SpeechRecognition not supported');
}

if (startSpeechButton && recognition) {
    startSpeechButton.addEventListener('click', () => {
        if (isRecording) {
            isRecording = false;
            recognition.stop();
            console.log('Speech stopped manually');
        } else {
            navigator.permissions.query({ name: 'microphone' })
                .then(permissionStatus => {
                    if (permissionStatus.state === 'denied') {
                        messagesDiv.innerHTML += `<p class="message bot"><strong>Error:</strong> Please allow microphone access in browser settings.</p>`;
                        messagesDiv.scrollTop = messagesDiv.scrollHeight;
                        return;
                    }
                    try {
                        isRecording = true;
                        recognition.start();
                        startWaveform();
                        startSpeechButton.classList.add('active');
                        console.log('Speech started');
                    } catch (err) {
                        console.error('Start error:', err);
                        messagesDiv.innerHTML += `<p class="message bot"><strong>Error:</strong> Failed to start speech: ${err.message}</p>`;
                        messagesDiv.scrollTop = messagesDiv.scrollHeight;
                    }
                })
                .catch(err => {
                    console.error('Permission error:', err);
                    messagesDiv.innerHTML += `<p class="message bot"><strong>Error:</strong> Microphone permission error: ${err.message}</p>`;
                    messagesDiv.scrollTop = messagesDiv.scrollHeight;
                });
        }
    });
} else if (startSpeechButton) {
    startSpeechButton.disabled = true;
    startSpeechButton.title = 'Speech not supported';
    messagesDiv.innerHTML += `<p class="message bot"><strong>Warning:</strong> Speech recognition not supported. Use text input.</p>`;
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Send button event listener
sendButton.addEventListener('click', () => {
    const message = userInput.value.trim();
    if (message) {
        messagesDiv.innerHTML += `<p class="message user"><strong>You:</strong> ${message}</p>`;
        handleRoyResponse(message);
        userInput.value = '';
    }
});
