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
            try {
                roySource.disconnect();
            } catch (e) {
                console.warn('Error disconnecting roySource:', e);
            }
            roySource = null;
        }
        if (royAnalyser) {
            try {
                royAnalyser.disconnect();
            } catch (e) {
                console.warn('Error disconnecting royAnalyser:', e);
            }
            royAnalyser = null;
        }
        if (royAudioContext) {
            try {
                await royAudioContext.close();
            } catch (e) {
                console.warn('Error closing royAudioContext:', e);
            }
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
                        if (currentAudioEl) {
                            currentAudioEl.onended = null;
                        }
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
            return false;
        }
        return true;
    }

    async function fetchRoyResponse(message) {
        const startTime = Date.now();
        let thinkingInterval = null;

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

            const res = await fetch('http://localhost:3001/api/chat', {
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

    async function startRecording() {
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            userAudioContext = new (window.AudioContext || window.webkitAudioContext)();
            const source = userAudioContext.createMediaStreamSource(stream);
            userAnalyser = userAudioContext.createAnalyser();
            source.connect(userAnalyser);
            userAnalyser.fftSize = 2048;
            userDataArray = new Uint8Array(userAnalyser.frequencyBinCount);
            drawUserWaveform();

            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            recognition = new SpeechRecognition();
            recognition.lang = 'en-US';
            recognition.interimResults = true;
            recognition.continuous = true;

            liveTranscriptEl = document.createElement('p');
            liveTranscriptEl.className = 'you live-transcript';
            liveTranscriptEl.innerHTML = '<strong>You (speaking):</strong> <span style="color: yellow"></span>';
            messagesEl.appendChild(liveTranscriptEl);
            messagesEl.scrollTop = messagesEl.scrollHeight;

            finalTranscript = '';

            recognition.onresult = (event) => {
                let interimTranscript = '';
                let finalPart = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    const transcript = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        finalPart += transcript + ' ';
                    } else {
                        interimTranscript += transcript;
                    }
                }
                finalTranscript += finalPart;
                const transcriptSpan = liveTranscriptEl.querySelector('span');
                transcriptSpan.textContent = interimTranscript || finalTranscript || '...';
                messagesEl.scrollTop = messagesEl.scrollHeight;
                console.log('Transcript update:', { finalTranscript, interimTranscript });
            };

            recognition.onend = () => {
                console.log('Recognition ended. Final transcript:', finalTranscript);
                try {
                    if (stream) {
                        stream.getTracks().forEach(t => t.stop());
                        stream = null;
                    }
                    if (userAudioContext) {
                        userAudioContext.close();
                        userAudioContext = null;
                    }

                    const finalMessage = (finalTranscript || '').trim();
                    if (liveTranscriptEl) {
                        liveTranscriptEl.remove();
                        liveTranscriptEl = null;
                    }

                    if (finalMessage) {
                        appendMessage('You', finalMessage);
                        inputEl.value = '';
                        thinkingEl = document.createElement('p');
                        thinkingEl.textContent = 'Roy is reflecting...';
                        thinkingEl.className = 'roy';
                        messagesEl.appendChild(thinkingEl);
                        messagesEl.scrollTop = messagesEl.scrollHeight;
                        fetchRoyResponse(finalMessage).finally(() => {
                            if (thinkingEl) {
                                thinkingEl.remove();
                                thinkingEl = null;
                            }
                        });
                    } else {
                        appendMessage('Roy', 'Your words slipped through the silence. Speak again.');
                    }

                    isRecording = false;
                    micBtn.textContent = 'Speak';
                    micBtn.classList.remove('active');
                    finalTranscript = '';
                } catch (error) {
                    console.error('Error in onend:', error);
                    appendMessage('Roy', 'A storm clouds my voice. Try again.');
                    isRecording = false;
                    micBtn.textContent = 'Speak';
                    micBtn.classList.remove('active');
                }
            };

            recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                if (liveTranscriptEl) {
                    liveTranscriptEl.remove();
                    liveTranscriptEl = null;
                }
                appendMessage('Roy', 'The winds steal my ears. Try speaking again.');
                recognition.stop();
            };

            recognition.start();
        } catch (error) {
            console.error('Recording error:', error);
            if (liveTranscriptEl) {
                liveTranscriptEl.remove();
                liveTranscriptEl = null;
            }
            appendMessage('Roy', 'The winds steal my ears. Try speaking again.');
            micBtn.textContent = 'Speak';
            micBtn.classList.remove('active');
            isRecording = false;
        }
    }

    function drawUserWaveform() {
        if (!userAnalyser) return;
        requestAnimationFrame(drawUserWaveform);
        userAnalyser.getByteTimeDomainData(userDataArray);
        userCtx.fillStyle = '#000';
        userCtx.fillRect(0, 0, userCanvas.width, userCanvas.height);
        drawGrid(userCtx, userCanvas.width, userCanvas.height, 'rgba(0,255,255,0.2)');
        userCtx.strokeStyle = 'yellow';
        userCtx.lineWidth = 1.5;
        userCtx.beginPath();
        const sliceWidth = userCanvas.width / userDataArray.length;
        let x = 0;
        for (let i = 0; i < userDataArray.length; i++) {
            const y = (userDataArray[i] / 128.0) * userCanvas.height / 2;
            i === 0 ? userCtx.moveTo(x, y) : userCtx.lineTo(x, y);
            x += sliceWidth;
        }
        userCtx.lineTo(userCanvas.width, userCanvas.height / 2);
        userCtx.stroke();
    }

    function drawRoyWaveform() {
        if (!royAnalyser) return;
        requestAnimationFrame(drawRoyWaveform);
        royAnalyser.getByteTimeDomainData(royDataArray);
        royCtx.fillStyle = '#000';
        royCtx.fillRect(0, 0, royCanvas.width, royCanvas.height);
        drawGrid(royCtx, royCanvas.width, royCanvas.height, 'rgba(0,255,255,0.2)');
        royCtx.strokeStyle = 'magenta';
        royCtx.lineWidth = 1.5;
        royCtx.beginPath();
        const sliceWidth = royCanvas.width / royDataArray.length;
        let x = 0;
        for (let i = 0; i < royDataArray.length; i++) {
            const y = (royDataArray[i] / 128.0) * royCanvas.height / 2;
            i === 0 ? royCtx.moveTo(x, y) : royCtx.lineTo(x, y);
            x += sliceWidth;
        }
        royCtx.lineTo(royCanvas.width, royCanvas.height / 2);
        royCtx.stroke();
    }

    function drawGrid(ctx, width, height, color) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 0.3;
        for (let x = 0; x < width; x += 20) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        for (let y = 0; y < height; y += 20) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
    }

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
