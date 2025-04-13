window.addEventListener('DOMContentLoaded', async () => {
    const micBtn = document.getElementById('mic-toggle');
    const inputEl = document.getElementById('user-input');
    const messagesEl = document.getElementById('messages');
    let isRecording = false;
    let stream;
    let liveTranscriptEl = null;
    let thinkingEl = null;
    let socket;
    let audioContext;
    let source;
    let workletNode;

    const ASSEMBLYAI_SOCKET_URL = 'wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000';
    const ASSEMBLYAI_API_KEY = 'eeee5d1982444610a670bd17152a8e4a';

    appendMessage('Roy', "Welcome. I'm Roy. Speak when ready — your thoughts hold weight.");

    async function startRecording() {
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
            await audioContext.audioWorklet.addModule('data:application/javascript;base64,' + btoa(`
                class PCMProcessor extends AudioWorkletProcessor {
                    process(inputs) {
                        const input = inputs[0][0];
                        if (!input) return true;
                        const int16 = new Int16Array(input.length);
                        for (let i = 0; i < input.length; i++) {
                            int16[i] = Math.max(-1, Math.min(1, input[i])) * 0x7fff;
                        }
                        this.port.postMessage(int16.buffer);
                        return true;
                    }
                }
                registerProcessor('pcm-processor', PCMProcessor);
            `));

            source = audioContext.createMediaStreamSource(stream);
            workletNode = new AudioWorkletNode(audioContext, 'pcm-processor');

            workletNode.port.onmessage = (e) => {
                if (socket && socket.readyState === WebSocket.OPEN) {
                    socket.send(e.data);
                }
            };

            source.connect(workletNode).connect(audioContext.destination);
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
        if (workletNode) workletNode.disconnect();
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
        const apiBase = 'https://roy-chatbo-backend.onrender.com';

        try {
            const res = await fetch(`${apiBase}/api/chat/text`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: text,
                    sessionId: `session-${Date.now()}`,
                    tone: `You are Roy Batty, a therapeutic counselor. Your voice burns with poetic defiance. Speak with imagery, insight, and vivid human emotion.`
                })
            });

            if (!res.ok) throw new Error(`Text response failed: ${res.status}`);
            const data = await res.json();

            appendMessage('Roy', data.text);

            const audioRes = await fetch(`${apiBase}/api/chat/audio`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: data.text })
            });

            if (!audioRes.ok) throw new Error(`Audio response failed: ${audioRes.status}`);
            const audioData = await audioRes.json();

            const audioEl = new Audio(`data:audio/mp3;base64,${audioData.audio}`);
            audioEl.play();
        } catch (err) {
            console.error(err);
            appendMessage('Roy', 'Something disrupted my voice. Try again.');
        }
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
