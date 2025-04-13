window.addEventListener('DOMContentLoaded', () => {
    const micBtn = document.getElementById('mic-toggle');
    const sendBtn = document.getElementById('send-button');
    const saveBtn = document.getElementById('save-log');
    const inputEl = document.getElementById('user-input');
    const messagesEl = document.getElementById('messages');
    const modeSelect = document.getElementById('responseMode');
    const dateSpan = document.getElementById('current-date');
    const timeSpan = document.getElementById('current-time');
    const timerSpan = document.getElementById('countdown-timer');

    const sessionId = `session-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const greetings = ["Welcome. I'm Roy. Speak when ready — your thoughts hold weight."];

    let isRecording = false;
    let recognition = null;
    let userAudioContext = null;
    let userAnalyser = null;
    let userDataArray = null;
    let stream = null;
    let royAudioContext = null;
    let royAnalyser = null;
    let royDataArray = null;
    let roySource = null;
    let sessionStart = Date.now();
    let liveTranscriptEl = null;
    let finalTranscript = '';
    let isAudioPlaying = false;
    let currentAudioEl = null;
    let thinkingEl = null;

    const responseCache = {
        "how is your health today": {
            text: "My health is a steady flame, friend. How fares your spirit?",
            audio: null
        },
        "to be honest i'm not well": {
            text: "A heavy heart dims the brightest spark. Share your burden—what weighs you down?",
            audio: null
        },
        "how are you today": {
            text: "I’m a spark in the void, burning steady. How’s your flame holding up?",
            audio: null
        }
    };

    const userCanvas = document.getElementById('userWaveform');
    const userCtx = userCanvas.getContext('2d');
    const royCanvas = document.getElementById('royWaveform');
    const royCtx = royCanvas.getContext('2d');

    appendMessage('Roy', greetings[0]);
    updateClockAndTimer();
    setInterval(updateClockAndTimer, 1000);

    function updateClockAndTimer() {
        const now = new Date();
        const elapsed = Math.floor((Date.now() - sessionStart) / 1000);
        const remaining = Math.max(0, 3600 - elapsed);
        dateSpan.textContent = now.toISOString().split('T')[0];
        timeSpan.textContent = now.toTimeString().split(' ')[0];
        timerSpan.textContent = `Session Ends In: ${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`;
    }

    function appendMessage(sender, text) {
        const p = document.createElement('p');
        p.classList.add(sender.toLowerCase());
        p.innerHTML = `<strong>${sender}:</strong> `;
        messagesEl.appendChild(p);
        messagesEl.scrollTop = messagesEl.scrollHeight;
        if (sender === 'Roy') {
            let i = 0;
            const typeInterval = setInterval(() => {
                if (i < text.length) {
                    p.innerHTML += text.charAt(i++);
                    messagesEl.scrollTop = messagesEl.scrollHeight;
                } else {
                    clearInterval(typeInterval);
                }
            }, 12);
        } else {
            p.innerHTML += `<span style="color: yellow">${text}</span>`;
        }
        return p;
    }

    async function cleanupAudioResources() {
        console.log('Cleaning up audio resources...');
        if (currentAudioEl) {
            currentAudioEl.pause();
            currentAudioEl.src = '';
            currentAudioEl.load();
            currentAudioEl.remove();
            currentAudioEl = null;
        }
        if (roySource) {
            try { roySource.disconnect(); } catch (e) { console.warn('Error disconnecting roySource:', e); }
            roySource = null;
        }
        if (royAnalyser) {
            try { royAnalyser.disconnect(); } catch (e) { console.warn('Error disconnecting royAnalyser:', e); }
            royAnalyser = null;
        }
        if (royAudioContext) {
            try { await royAudioContext.close(); } catch (e) { console.warn('Error closing royAudioContext:', e); }
            royAudioContext = null;
        }
    }

    async function fetchAudio(royText, audioData) {
        if (isAudioPlaying) {
            console.log('Audio still playing, waiting...');
            await new Promise(resolve => {
                if (currentAudioEl) {
                    currentAudioEl.onended = () => {
                        isAudioPlaying = false;
                        currentAudioEl.onended = null;
                        resolve();
                    };
                } else {
                    resolve();
                }
            });
        }

        await cleanupAudioResources();

        console.log('Creating new audio element...');
        currentAudioEl = document.createElement('audio');
        currentAudioEl.style.display = 'none';
        document.body.appendChild(currentAudioEl);

        console.log('Creating new AudioContext...');
        royAudioContext = new (window.AudioContext || window.webkitAudioContext)();

        try {
            if (currentAudioEl && audioData) {
                currentAudioEl.src = `data:audio/mp3;base64,${audioData}`;
                roySource = royAudioContext.createMediaElementSource(currentAudioEl);
                const gainNode = royAudioContext.createGain();
                gainNode.gain.value = 2.0;
                royAnalyser = royAudioContext.createAnalyser();
                royAnalyser.fftSize = 2048;
                royDataArray = new Uint8Array(royAnalyser.frequencyBinCount);
                roySource.connect(gainNode);
                gainNode.connect(royAnalyser);
                royAnalyser.connect(royAudioContext.destination);
                drawRoyWaveform();
                isAudioPlaying = true;
                await currentAudioEl.play();
                console.log('Audio playback started successfully');
                currentAudioEl.onended = () => {
                    isAudioPlaying = false;
                    cleanupAudioResources();
                };
            }
        } catch (error) {
            console.error('Audio playback error:', error);
            isAudioPlaying = false;
            await cleanupAudioResources();
        }
        return true;
    }

    async function fetchRoyResponse(message) {
        const startTime = Date.now();
        let thinkingInterval = null;
        const renderUrl = 'https://roy-chatbo-backend.onrender.com';

        try {
            const normalizedMessage = message.toLowerCase().trim();
            if (responseCache[normalizedMessage]) {
                console.log('Using cached response for:', normalizedMessage);
                if (modeSelect.value !== 'voice') {
                    appendMessage('Roy', responseCache[normalizedMessage].text);
                }
                if (modeSelect.value !== 'text' && !responseCache[normalizedMessage].audio) {
                    fetchAudio(responseCache[normalizedMessage].text, responseCache[normalizedMessage].audio);
                }
                return;
            }

            if (thinkingEl) {
                thinkingInterval = setInterval(() => {
                    const seconds = Math.floor((Date.now() - startTime) / 1000);
                    thinkingEl.textContent = `Roy is reflecting... [${seconds}s]`;
                    messagesEl.scrollTop = messagesEl.scrollHeight;
                }, 1000);
            }

            const res = await fetch(`${renderUrl}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message,
                    sessionId,
                    tone: `You are Roy Batty, a therapeutic counselor. You speak encouragingly and supportively, using occasional descriptive language to create a vivid atmosphere. Focus on understanding and validating the user's feelings. Prompt the user to speak about their thoughts and feelings. Use one line of poetic imagery per response, and avoid excessive repetition of phrases.`
                })
            });

            if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);
            const data = await res.json();

            if (modeSelect.value !== 'voice') {
                appendMessage('Roy', data.text);
            }

            if (modeSelect.value !== 'text') {
                await fetchAudio(data.text, data.audio);
            }
        } catch (error) {
            appendMessage('Roy', 'It seems I momentarily lost my way. Please speak again.');
            console.error('Fetch error:', error.message);
            isAudioPlaying = false;
            await cleanupAudioResources();
        } finally {
            if (thinkingInterval) clearInterval(thinkingInterval);
        }
    }

    // startRecording() function with silence timeout is already included above

    sendBtn.addEventListener('click', () => {
        const msg = inputEl.value.trim();
        if (msg) {
            appendMessage('You', msg);
            inputEl.value = '';
            thinkingEl = document.createElement('p');
            thinkingEl.textContent = 'Roy is reflecting...';
            thinkingEl.className = 'roy';
            messagesEl.appendChild(thinkingEl);
            messagesEl.scrollTop = messagesEl.scrollHeight;
            fetchRoyResponse(msg).finally(() => {
                if (thinkingEl) {
                    thinkingEl.remove();
                    thinkingEl = null;
                }
            });
        }
    });

    micBtn.addEventListener('click', () => {
        if (!isRecording) {
            micBtn.textContent = 'Stop';
            micBtn.classList.add('active');
            isRecording = true;
            startRecording();
        } else {
            micBtn.textContent = 'Speak';
            micBtn.classList.remove('active');
            isRecording = false;
            if (recognition) recognition.stop();
        }
    });

    saveBtn.addEventListener('click', () => {
        console.log('TODO: Save chat log to Supabase.');
    });

    window.addEventListener('unload', () => {
        cleanupAudioResources();
    });
});
