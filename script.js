// Fully functioning script.js for SynthCalm Roy with debug logging for fetchRoyResponse

const dateEl = document.getElementById('current-date');
const timeEl = document.getElementById('current-time');
const countdownEl = document.getElementById('countdown-timer');
const chatBox = document.getElementById('chat');
const thinkingDots = document.getElementById('thinking-dots');
const micBtn = document.getElementById('mic-toggle');
const royCanvas = document.getElementById('royWaveform');
const royCtx = royCanvas.getContext('2d');
const royAudio = new Audio();
royAudio.setAttribute('playsinline', 'true');
document.body.appendChild(royAudio);

let stream, audioContext, workletNode, source;
let startTime = Date.now();
let isRecording = false;

function updateClock() {
  const now = new Date();
  dateEl.textContent = now.toISOString().split('T')[0];
  timeEl.textContent = now.toTimeString().split(' ')[0];
  const remaining = Math.max(0, 3600 - Math.floor((Date.now() - startTime) / 1000));
  countdownEl.textContent = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;
}
setInterval(updateClock, 1000);
updateClock();

function showThinkingDots() {
  thinkingDots.style.display = 'block';
}
function hideThinkingDots() {
  thinkingDots.style.display = 'none';
}
function addMessage(sender, text) {
  const msg = document.createElement('div');
  msg.innerHTML = `<span class="${sender === 'You' ? 'you' : ''}">${sender}:</span> ${text}`;
  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function drawWaveform(analyser, dataArray, canvas) {
  const ctx = canvas.getContext('2d');
  requestAnimationFrame(() => drawWaveform(analyser, dataArray, canvas));
  analyser.getByteTimeDomainData(dataArray);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = canvas.id === 'userWaveform' ? 'yellow' : 'magenta';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  const sliceWidth = canvas.width / dataArray.length;
  let x = 0;
  for (let i = 0; i < dataArray.length; i++) {
    const y = (dataArray[i] / 128.0) * canvas.height / 2;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    x += sliceWidth;
  }
  ctx.lineTo(canvas.width, canvas.height / 2);
  ctx.stroke();
}

function drawRoyWaveform(audio) {
  const ac = new AudioContext();
  const analyser = ac.createAnalyser();
  const source = ac.createMediaElementSource(audio);
  source.connect(analyser);
  analyser.connect(ac.destination);
  analyser.fftSize = 2048;
  const buffer = new Uint8Array(analyser.frequencyBinCount);
  function draw() {
    requestAnimationFrame(draw);
    analyser.getByteTimeDomainData(buffer);
    royCtx.fillStyle = '#000';
    royCtx.fillRect(0, 0, royCanvas.width, royCanvas.height);
    royCtx.strokeStyle = 'magenta';
    royCtx.lineWidth = 1.2;
    royCtx.beginPath();
    const slice = royCanvas.width / buffer.length;
    let x = 0;
    for (let i = 0; i < buffer.length; i++) {
      const y = (buffer[i] / 128.0) * royCanvas.height / 2;
      i === 0 ? royCtx.moveTo(x, y) : royCtx.lineTo(x, y);
      x += slice;
    }
    royCtx.stroke();
  }
  draw();
}

async function startRecording() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioContext = new AudioContext({ sampleRate: 16000 });

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

    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    source.connect(analyser);
    drawWaveform(analyser, dataArray, document.getElementById('userWaveform'));

    source.connect(workletNode).connect(audioContext.destination);

    const token = 'YOUR_ASSEMBLYAI_REALTIME_API_TOKEN';
    const socket = new WebSocket(`wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000`);
    socket.binaryType = 'arraybuffer';

    socket.onopen = () => socket.send(JSON.stringify({ token }));
    socket.onmessage = async (msg) => {
      const { text } = JSON.parse(msg.data);
      if (text) {
        addMessage('You', text);
        showThinkingDots();
        const royRes = await fetchRoyResponse(text);
        console.log('Roy API response:', royRes);
        hideThinkingDots();
        addMessage('Roy', royRes.text);
        if (royRes.audio) {
          royAudio.src = `data:audio/mp3;base64,${royRes.audio}`;
          royAudio.play().catch(e => console.warn('Autoplay error', e));
          drawRoyWaveform(royAudio);
        }
      }
    };

    workletNode.port.onmessage = (e) => {
      if (socket.readyState === WebSocket.OPEN) socket.send(e.data);
    };

    micBtn.textContent = 'Stop';
    micBtn.classList.add('recording');
    isRecording = true;
  } catch (err) {
    console.error('Mic error:', err);
    addMessage('Roy', '⚠️ Mic or connection error.');
  }
}

function stopRecording() {
  if (stream) stream.getTracks().forEach(t => t.stop());
  if (audioContext) audioContext.close();
  micBtn.textContent = 'Speak';
  micBtn.classList.remove('recording');
  isRecording = false;
}

async function fetchRoyResponse(text) {
  try {
    const res = await fetch('https://synthcalm-a2n7.onrender.com/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, mode: 'both' })
    });
    const data = await res.json();
    console.log('Roy backend returned:', data);
    return data;
  } catch (e) {
    console.error('fetchRoyResponse error:', e);
    return { text: 'Roy failed to load.', audio: null };
  }
}

micBtn.addEventListener('click', () => {
  isRecording ? stopRecording() : startRecording();
});
