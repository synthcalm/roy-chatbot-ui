// === script.js (COMPLETE FINAL VERSION: FULL CODE FROM START TO FINISH) ===

// [previous code remains unchanged here]

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
    if (isIOS()) {
      startFeedbackBlink();
    } else {
      sendToRoy();
    }
  }
}

const royBtn = document.getElementById('royBtn');
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

function startFeedbackBlink() {
  feedbackBtn.classList.add('blinking');
  let blinkState = true;
  feedbackBlinkInterval = setInterval(() => {
    feedbackBtn.textContent = blinkState ? 'Feedback' : 'Press Me';
    blinkState = !blinkState;
  }, 600);
}

function stopFeedbackBlink() {
  clearInterval(feedbackBlinkInterval);
  feedbackBtn.textContent = 'Feedback';
  feedbackBtn.classList.remove('blinking');
}

const feedbackBtn = document.getElementById('feedbackBtn');
feedbackBtn?.addEventListener('click', () => {
  if (isIOS() && feedbackBtn.classList.contains('blinking')) {
    stopFeedbackBlink();
    sendToRoy();
  } else if (!isIOS()) {
    if (feedbackState === 'idle') {
      feedbackState = 'engaged';
      feedbackBtn.classList.add('engaged');
      sendToRoy().finally(() => {
        feedbackState = 'idle';
        feedbackBtn.classList.remove('engaged');
      });
    }
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
