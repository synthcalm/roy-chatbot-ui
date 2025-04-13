// DOM Elements
const messagesDiv = document.getElementById('messages'); // Messages container
const userInput = document.getElementById('message-input'); // User input field
const sendButton = document.getElementById('send-button'); // Send button
const startSpeechButton = document.getElementById('start-speech'); // Speech button

// Check for SpeechRecognition API support
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;

if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false; // Stop after one utterance
    recognition.interimResults = true; // Show interim results
    recognition.lang = 'en-US'; // Set language

    // Handle transcription results
    recognition.onresult = (event) => {
        console.log('Speech recognition result received:', event.results); // Debug log
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            console.log(`Transcript [${i}]: ${transcript}, isFinal: ${event.results[i].isFinal}`); // Debug log
            if (event.results[i].isFinal) {
                finalTranscript += transcript;
            } else {
                interimTranscript += transcript;
            }
        }

        // Update the textbox with the transcription
        const newValue = finalTranscript || interimTranscript;
        if (newValue) {
            userInput.value = newValue;
            userInput.dispatchEvent(new Event('input')); // Trigger input event for reactivity
            console.log('Updated userInput.value:', newValue); // Debug log
        }
    };

    // Handle errors
    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        messagesDiv.innerHTML += `<p class="message bot"><strong>Error:</strong> Speech recognition failed: ${event.error}</p>`;
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    };

    // Handle end of recognition
    recognition.onend = () => {
        console.log('Speech recognition ended');
        if (startSpeechButton) {
            startSpeechButton.classList.remove('active'); // Reset button state
        }
    };

    // Handle no speech detected
    recognition.onnomatch = () => {
        console.log('No speech detected');
        messagesDiv.innerHTML += `<p class="message bot"><strong>Notice:</strong> No speech detected. Please try again.</p>`;
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    };
} else {
    console.warn('SpeechRecognition API not supported in this browser.');
}

// Add event listener for speech recognition (if supported)
if (startSpeechButton && recognition) {
    startSpeechButton.addEventListener('click', () => {
        // Toggle active state for visual feedback
        if (startSpeechButton.classList.contains('active')) {
            recognition.stop();
            startSpeechButton.classList.remove('active');
            console.log('Speech recognition stopped manually');
            return;
        }

        navigator.permissions.query({ name: 'microphone' })
            .then(permissionStatus => {
                if (permissionStatus.state === 'denied') {
                    messagesDiv.innerHTML += `<p class="message bot"><strong>Error:</strong> Please allow microphone access in your browser settings.</p>`;
                    messagesDiv.scrollTop = messagesDiv.scrollHeight;
                    return;
                }
                try {
                    recognition.start();
                    startSpeechButton.classList.add('active'); // Indicate recording
                    console.log('Speech recognition started');
                } catch (err) {
                    console.error('Error starting recognition:', err);
                    messagesDiv.innerHTML += `<p class="message bot"><strong>Error:</strong> Failed to start speech recognition: ${err.message}</p>`;
                    messagesDiv.scrollTop = messagesDiv.scrollHeight;
                }
            })
            .catch(err => {
                console.error('Permission query error:', err);
                messagesDiv.innerHTML += `<p class="message bot"><strong>Error:</strong> Unable to access microphone permissions: ${err.message}</p>`;
                messagesDiv.scrollTop = messagesDiv.scrollHeight;
            });
    });
} else if (startSpeechButton) {
    startSpeechButton.disabled = true;
    startSpeechButton.title = 'Speech recognition not supported';
    messagesDiv.innerHTML += `<p class="message bot"><strong>Warning:</strong> Speech recognition is not supported in this browser. Please use text input.</p>`;
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Add event listener to the send button
sendButton.addEventListener('click', () => {
    const message = userInput.value.trim(); // Get the user's message and trim whitespace

    if (message) {
        // Append user's message to the messages container
        messagesDiv.innerHTML += `<p class="message user"><strong>You:</strong> ${message}</p>`;

        // Send the message to the server via a POST request
        fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ userId: 'guest', message: message }) // Added userId to match server expectation
        })
        .then(response => response.json()) // Parse the response as JSON
        .then(data => {
            // Append the bot's response to the messages container
            messagesDiv.innerHTML += `<p class="message bot"><strong>Roy:</strong> ${data.message}</p>`;
            messagesDiv.scrollTop = messagesDiv.scrollHeight; // Auto-scroll to the bottom
        })
        .catch(error => {
            console.error('Error communicating with the server:', error);
            messagesDiv.innerHTML += `<p class="message bot"><strong>Error:</strong> An error occurred while processing your request.</p>`;
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        });

        // Clear the input field after sending the message
        userInput.value = '';
    }
});
