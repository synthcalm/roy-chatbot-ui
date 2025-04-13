window.addEventListener('DOMContentLoaded', () => {
    const micBtn = document.getElementById('mic-toggle');
    const inputEl = document.getElementById('user-input');
    const messagesEl = document.getElementById('messages');
    let isRecording = false;
    let mediaRecorder;
    let stream;
    let liveTranscriptEl = null;
    let thinkingEl = null;

    const ASSEMBLYAI_SOCKET_URL = 'wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000';
    const ASSEMBLYAI_API_KEY = 'eeee5d1982444610a670bd17152a8e4a';
    let socket;

    // Display greeting on load
    appendMessage('Roy', "Welcome. I'm Roy. Speak when ready — your thoughts hold weight.");

    async function startRecording() {
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaStreamAudioSourceNode = new AudioContext().createMediaStreamSource(stream);

            connectToAssemblyAI();

            mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            mediaRecorder.addEventListener('dataavailable', async (event) => {
                if (socket && socket.readyState === WebSocket.OPEN && event.data.size > 0) {
                    const reader = new FileReader();
                    reader.onload = () => {
                        const base64data = reader.result.split(',')[1];
                        socket.send(base64data);
                    };
                    reader.readAsDataURL(event.data);
                }
            });

            mediaRecorder.start(250);

            liveTranscriptEl = document.createElement('p');
            liveTranscriptEl.className = 'you live-transcript';
            liveTranscriptEl.innerHTML = '<strong>You (speaking):</strong> <span style="color: yellow"></span>';
            messagesEl.appendChild(liveTranscriptEl);
            messagesEl.scrollTop = messagesEl.scrollHeight;
        } catch (error) {
            console.error('Recording error:', error);
            appendMessage('Roy', 'Could not access the microphone.');
            stopRecording();
        }
    }

    function connectToAssemblyAI() {
        socket = new WebSocket(ASSEMBLYAI_SOCKET_URL);
        socket.onopen = () => {
            socket.send(JSON.stringify({ auth: ASSEMBLYAI_API_KEY }));
        };
        socket.onmessage = (message) => {
            const res = JSON.parse(message.data);
            if (res.text) {
                const transcriptSpan = liveTranscriptEl.querySelector('span');
                transcriptSpan.textContent = res.text;
                messagesEl.scrollTop = messagesEl.scrollHeight;
            }
        };
        socket.onerror = (e) => {
            console.error('AssemblyAI WebSocket error:', e);
            appendMessage('Roy', 'Something went wrong with AssemblyAI.');
        };
        socket.onclose = () => {
            console.warn('AssemblyAI WebSocket closed.');
        };
    }

    function stopRecording() {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        }
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ terminate_session: true }));
            socket.close();
        }
        if (liveTranscriptEl) {
            const finalMessage = liveTranscriptEl.querySelector('span')?.textContent?.trim();
            if (finalMessage) {
                appendMessage('You', finalMessage);
                inputEl.value = '';
                thinkingEl = document.createElement('p');
                thinkingEl.textContent = 'Roy is reflecting...';
                thinkingEl.className = 'roy';
                messagesEl.appendChild(thinkingEl);
                messagesEl.scrollTop = messagesEl.scrollHeight;
                fetchRoyResponse(finalMessage).finally(() => {
                    if (thinkingEl) thinkingEl.remove();
                });
            } else {
                appendMessage('Roy', 'Your words slipped through the silence. Speak again.');
            }
            liveTranscriptEl.remove();
            liveTranscriptEl = null;
        }
        isRecording = false;
        micBtn.textContent = 'Speak';
        micBtn.classList.remove('active');
    }

    function appendMessage(sender, text) {
        const p = document.createElement('p');
        p.classList.add(sender.toLowerCase());
        p.innerHTML = `<strong>${sender}:</strong> ${text}`;
        messagesEl.appendChild(p);
        messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    async function fetchRoyResponse(text) {
        console.log('Fetching Roy response for:', text);
        // Implement API fetch to backend here.
    }

    micBtn.addEventListener('click', () => {
        if (!isRecording) {
            micBtn.textContent = 'Stop';
            micBtn.classList.add('active');
            isRecording = true;
            startRecording();
        } else {
            stopRecording();
        }
    });
});
