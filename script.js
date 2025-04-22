window.addEventListener('load', function () {
  const royBtn = document.getElementById('royBtn');
  const randyBtn = document.getElementById('randyBtn');
  const speakBtn = document.getElementById('speakBtn');
  const saveBtn = document.getElementById('saveBtn');
  const homeBtn = document.getElementById('homeBtn');
  const messagesDiv = document.getElementById('messages');
  const userCanvas = document.getElementById('userWaveform');
  const royCanvas = document.getElementById('royWaveform');

  let isRecording = false;
  let selectedPersona = null;
  let audioChunks = [];
  let mediaRecorder;

  // Initial Speak button style (default)
  function setSpeakDefault() {
    speakBtn.style.backgroundColor = 'black';
    speakBtn.style.color = 'cyan';
    speakBtn.style.border = '1px solid cyan';
    speakBtn.classList.remove('blinking');
    speakBtn.textContent = 'SPEAK';
  }

  function setSpeakHot() {
    speakBtn.style.backgroundColor = 'red';
    speakBtn.style.border = '1px solid red';
    speakBtn.style.color = 'white';
    speakBtn.classList.remove('blinking');
    speakBtn.textContent = 'SPEAK';
  }

  function setSpeakRecording() {
    speakBtn.classList.add('blinking');
    speakBtn.style.backgroundColor = 'red';
    speakBtn.style.border = '1px solid red';
    speakBtn.style.color = 'white';
    speakBtn.textContent = 'STOP';
  }

  setSpeakDefault();

  royBtn.addEventListener('click', function () {
    selectedPersona = 'roy';
    royBtn.style.backgroundColor = 'green';
    royBtn.style.color = 'white';
    randyBtn.style.backgroundColor = 'black';
    randyBtn.style.color = 'cyan';
    addMessage('Roy: Greetings, my friend. What would you like to discuss today?', 'roy');
    setSpeakHot();
  });

  randyBtn.addEventListener('click', function () {
    selectedPersona = 'randy';
    randyBtn.style.backgroundColor = '#FFC107';
    randyBtn.style.color = 'white';
    royBtn.style.backgroundColor = 'black';
    royBtn.style.color = 'cyan';
    addMessage('Randy: What\'s up? Let\'s talk!', 'randy');
    setSpeakHot();
  });

  speakBtn.addEventListener('click', async function () {
    if (!selectedPersona) {
      alert('Please select Roy or Randy first');
      return;
    }

    if (isRecording) {
      mediaRecorder.stop();
      isRecording = false;
      setSpeakHot();
      return;
    }

    setSpeakRecording();
    isRecording = true;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];

      mediaRecorder.ondataavailable = function (e) {
        audioChunks.push(e.data);
      };

      mediaRecorder.onstop = async function () {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        addMessage('You: (Transcribing...)', 'user');

        try {
          const formData = new FormData();
          formData.append('audio', audioBlob);
          formData.append('bot', selectedPersona);

          const response = await fetch('https://roy-chatbo-backend.onrender.com/api/transcribe', {
            method: 'POST',
            body: formData
          });

          if (!response.ok) {
            throw new Error('Transcription failed');
          }

          const result = await response.json();
          messagesDiv.lastChild.textContent = 'You: ' + (result.text || 'Could not transcribe');

          const botResponse = await fetch('https://your-backend-url.com/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: result.text,
              persona: selectedPersona
            })
          });

          if (!botResponse.ok) {
            throw new Error('Chat failed');
          }

          const botData = await botResponse.json();
          addMessage((selectedPersona === 'randy' ? 'Randy: ' : 'Roy: ') + botData.text, selectedPersona);

          if (botData.audio) {
            playAudio(botData.audio);
            drawWaveformRoy(botData.audio);
          }

        } catch (error) {
          console.error('Error:', error);
          messagesDiv.lastChild.textContent = 'You: Transcription failed';
          addMessage((selectedPersona === 'randy' ? 'Randy: ' : 'Roy: ') + 'Sorry, I didn\'t get that', selectedPersona);
        }
      };

      mediaRecorder.start();

    } catch (error) {
      console.error('Microphone error:', error);
      alert('Could not access microphone. Please allow access.');
      setSpeakHot();
      isRecording = false;
    }
  });

  function playAudio(base64Audio) {
    const audio = new Audio('data:audio/wav;base64,' + base64Audio);
    audio.setAttribute('playsinline', '');
    audio.play().catch(e => {
      const playBtn = document.createElement('button');
      playBtn.textContent = 'Tap to Play Response';
      playBtn.style.margin = '10px';
      playBtn.style.padding = '10px';
      playBtn.onclick = () => {
        audio.play();
        playBtn.remove();
      };
      messagesDiv.appendChild(playBtn);
    });
  }

  function drawWaveformRoy(base64Audio) {
    const royCtx = royCanvas.getContext('2d');
    royCtx.clearRect(0, 0, royCanvas.width, royCanvas.height);

    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const audioData = atob(base64Audio);
    const buffer = new Uint8Array(audioData.length);
    for (let i = 0; i < audioData.length; i++) {
      buffer[i] = audioData.charCodeAt(i);
    }

    audioContext.decodeAudioData(buffer.buffer).then(decoded => {
      const data = decoded.getChannelData(0);
      royCtx.beginPath();
      for (let i = 0; i < royCanvas.width; i++) {
        const x = i;
        const y = (0.5 + data[Math.floor(i * data.length / royCanvas.width)] / 2) * royCanvas.height;
        if (i === 0) {
          royCtx.moveTo(x, y);
        } else {
          royCtx.lineTo(x, y);
        }
      }
      royCtx.strokeStyle = 'magenta';
      royCtx.stroke();
    }).catch(err => {
      console.error('drawWaveformRoy failed:', err);
    });
  }

  function addMessage(text, sender) {
    const msg = document.createElement('p');
    msg.className = sender;
    msg.textContent = text;
    messagesDiv.appendChild(msg);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  saveBtn.addEventListener('click', function () {
    const blob = new Blob([messagesDiv.innerText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'conversation.txt';
    a.click();
  });

  homeBtn.addEventListener('click', function () {
    window.location.href = 'https://synthcalm.com';
  });

  function updateTime() {
    const now = new Date();
    document.getElementById('date-time').textContent =
      (now.getMonth() + 1) + '/' + now.getDate() + '/' + now.getFullYear() + ' ' +
      now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  setInterval(updateTime, 60000);
  updateTime();

  if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    const style = document.createElement('style');
    style.textContent = `
      button { 
        min-height: 44px;
        -webkit-tap-highlight-color: transparent;
      }
      #speakBtn {
        font-size: 18px;
      }
    `;
    document.head.appendChild(style);
  }

  // Inject blinking CSS
  const style = document.createElement('style');
  style.textContent = `
    .blinking {
      animation: blink 1s step-start infinite;
    }
    @keyframes blink {
      50% { opacity: 0.3; }
    }
  `;
  document.head.appendChild(style);
});
