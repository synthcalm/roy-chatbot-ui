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
    // Since /api/chat is failing, simulate a response
    const simulatedResponse = `I heard you say: "${message}". How can I assist you further?`;
    
    // Determine response mode
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

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
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
                finalTranscript += transcript;
            } else {
                interimTranscript += transcript;
            }
        }

        const newValue = finalTranscript || interimTranscript;
        if (newValue && userInput) {
            userInput.value = newValue;
            userInput.dispatchEvent(new Event('input'));
            console.log('Set userInput.value:', newValue);
        }
    };

    recognition.onerror = (event) => {
        console.error('Speech error:', event.error);
        messagesDiv.innerHTML += `<p class="message bot"><strong>Error:</strong> Speech recognition failed: ${event.error}</p>`;
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    };

    recognition.onend = () => {
        console.log('Speech recognition ended');
        if (startSpeechButton) {
            startSpeechButton.classList.remove('active');
            // Automatically send the transcribed message
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
        messagesDiv.innerHTML += `<p class="message bot"><strong>Notice:</strong> No speech detected. Try again.</p>`;
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    };
} else {
    console.warn('SpeechRecognition not supported');
}

if (startSpeechButton && recognition) {
    startSpeechButton.addEventListener('click', () => {
        if (startSpeechButton.classList.contains('active')) {
            recognition.stop();
            startSpeechButton.classList.remove('active');
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
                        recognition.start();
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
