// === script.js (Full Version: Press-Hold for iOS / Tap-Toggle Desktop, Dynamic Roy Responses, Artsy Waveforms, Complete Logic) ===

// Previous functions remain unchanged above this point

async function sendToRoy() {
  commitUtterance();
  const messages = document.getElementById('messages');
  const lastUserMsg = Array.from(messages.querySelectorAll('.user')).pop()?.textContent.replace('You: ', '') || '';
  if (!lastUserMsg.trim()) return;
  showThinkingDots();
  try {
    const response = await fetch('https://roy-chatbo-backend.onrender.com/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: lastUserMsg })
    });
    const data = await response.json();
    stopThinkingDots();
    messages.innerHTML += `<div class="roy">${generateRandomRoyResponse(data.text)}</div>`;
    scrollMessages();
    if (data.audio) {
      const royAudio = new Audio(data.audio);
      animateRoyWaveform(royAudio);
    }
  } catch (err) {
    stopThinkingDots();
    messages.innerHTML += '<div class="roy">Roy: Sorry, I’m having trouble responding right now.</div>';
    scrollMessages();
  }
}

function commitUtterance() {
  const messages = document.getElementById('messages');
  const interimDiv = document.getElementById('interim');
  if (interimDiv) interimDiv.remove();
  if (currentUtterance.trim()) {
    messages.innerHTML += `<div class="user">You: ${currentUtterance.trim()}</div>`;
    scrollMessages();
    currentUtterance = '';
  }
}

function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return alert('Speech recognition not supported.');
  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onresult = (event) => {
    let interim = '', final = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      event.results[i].isFinal ? final += transcript + ' ' : interim += transcript;
    }
    if (final.trim()) currentUtterance += final.trim() + ' ';
    const messages = document.getElementById('messages');
    const interimDiv = document.getElementById('interim');
    const fullLine = currentUtterance + interim;
    if (interimDiv) {
      interimDiv.textContent = `You: ${fullLine.trim()}`;
    } else {
      messages.innerHTML += `<div id="interim" class="user">You: ${fullLine.trim()}</div>`;
    }
    scrollMessages();
  };

  recognition.onerror = (e) => console.error('Speech recognition error:', e);
  recognition.onend = () => {
    if (royState === 'engaged') recognition.start();
  };
}

function startRecording() {
  navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.start();
    mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
    userAudioContext = new AudioContext();
    analyser = userAudioContext.createAnalyser();
    dataArray = new Uint8Array(analyser.fftSize);
    source = userAudioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    animateUserWaveform();
    recognition.start();
  }).catch(err => {
    console.error('Error starting recording:', err);
    alert('Failed to access microphone. Check permissions.');
  });
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
  audioChunks = [];
  source?.disconnect();
  analyser?.disconnect();
  userAudioContext?.close();
  recognition?.stop();
}

const royBtn = document.getElementById('royBtn');
function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}
if (isIOS()) {
  royBtn?.addEventListener('touchstart', (e) => { e.preventDefault(); handleStart(); });
  royBtn?.addEventListener('touchend', (e) => { e.preventDefault(); handleStop(); });
} else {
  royBtn?.addEventListener('click', () => {
    if (royState === 'idle') {
      handleStart();
    } else {
      handleStop();
    }
  });
}

function handleStart() {
  if (royState === 'idle') {
    royState = 'engaged';
    royBtn.classList.add('engaged');
    royBtn.textContent = 'STOP';
    startRecording();
  }
}

function handleStop() {
  if (royState === 'engaged') {
    royState = 'idle';
    royBtn.classList.remove('engaged');
    royBtn.textContent = 'SPEAK';
    stopRecording();
    sendToRoy();
  }
}

const feedbackBtn = document.getElementById('feedbackBtn');
feedbackBtn?.addEventListener('click', () => {
  if (feedbackState === 'idle') {
    feedbackState = 'engaged';
    feedbackBtn.classList.add('engaged');
    sendToRoy().finally(() => {
      feedbackState = 'idle';
      feedbackBtn.classList.remove('engaged');
    });
  }
});

document.getElementById('saveBtn')?.addEventListener('click', () => {
  const messages = document.getElementById('messages');
  const text = Array.from(messages.querySelectorAll('div')).map(div => div.textContent).join('\n');
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `synthcalm_chat_${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('homeBtn')?.addEventListener('click', () => {
  window.location.href = 'https://synthcalm.com';
});

window.onload = function () {
  updateDateTime();
  updateCountdownTimer();
  initWaveforms();
  initSpeechRecognition();
};
