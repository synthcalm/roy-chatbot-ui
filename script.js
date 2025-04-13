window.addEventListener('DOMContentLoaded', () => {
    const micBtn = document.getElementById('mic-toggle');
    const inputEl = document.getElementById('user-input');
    const messagesEl = document.getElementById('messages');
    let isRecording = false;
    let stream;
    let liveTranscriptEl = null;
    let thinkingEl = null;
    let socket;
    let audioContext;
    let processor;
    let source;

    const ASSEMBLYAI_SOCKET_URL = 'wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000';
    const ASSEMBLYAI_API_KEY = 'YOUR_ASSEMBLYAI_API_KEY';

    appendMessage('Roy', "Welcome. I'm Roy. Speak when ready — your thoughts hold weight.");

    async function startRecording() {
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
            source = audioContext.createMediaStreamSource(stream);
            processor = audioContext.createScriptProcessor(4096, 1, 1);

            processor.onaudioprocess = (event) => {
                const inputData = event.inputBuffer.getChannelData(0);
                const int16Data = convertFloat32ToInt16(inputData);
                if (socket && socket.readyState === WebSocket.OPEN) {
                    socket.send(int16Data);
                }
            };

            source.connect(processor);
            processor.connect(audioContext.destination);

            connectToAssemblyAI();

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

    function convertFloat32ToInt16(buffer) {
        let l = buffer.length;
        const buf = new Int16Array(l);
        while (l--) {
            buf[l] = Math.min(1, buffer[l]) * 0x7FFF;
        }
        return buf.buffer;
    }

    function connectToAssemblyAI() {
        socket = new WebSocket(ASSEMBLYAI_SOCKET_URL);
        socket.binaryType = 'arraybuffer';
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
        if (processor) processor.disconnect();
        if (source) source.disconnect();
        if (audioContext) audioContext.close();
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
