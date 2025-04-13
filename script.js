window.addEventListener('DOMContentLoaded', () => {
    // [All other variable declarations remain unchanged...]

    let silenceTimeout;

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

                clearTimeout(silenceTimeout);
                silenceTimeout = setTimeout(() => {
                    recognition.stop();
                }, 2000);
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

            setTimeout(() => {
                if (isRecording && recognition) {
                    console.warn('iOS mic timeout safeguard triggered. Forcing stop.');
                    recognition.stop();
                }
            }, 10000); // 10 seconds max limit for iOS mic

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

    // The rest of the script stays unchanged
});
