// Roy/Randy Chat App - iPhone Compatible Version

// Wait until page is fully loaded
window.addEventListener('load', function() {
  
  // Get all the buttons and elements we need
  const royBtn = document.getElementById('royBtn');
  const randyBtn = document.getElementById('randyBtn');
  const speakBtn = document.getElementById('speakBtn');
  const saveBtn = document.getElementById('saveBtn');
  const homeBtn = document.getElementById('homeBtn');
  const messagesDiv = document.getElementById('messages');
  const userCanvas = document.getElementById('userWaveform');
  const royCanvas = document.getElementById('royWaveform');
  
  // Set initial button styles
  royBtn.style.border = '1px solid cyan';
  randyBtn.style.border = '1px solid cyan';
  speakBtn.style.backgroundColor = 'black';
  speakBtn.style.color = 'cyan';
  speakBtn.style.border = '1px solid cyan';
  
  // Variables to track state
  let isRecording = false;
  let selectedPersona = null;
  let audioChunks = [];
  
  // Roy Button Click
  royBtn.addEventListener('click', function() {
    selectedPersona = 'roy';
    royBtn.style.backgroundColor = 'green';
    royBtn.style.color = 'white';
    randyBtn.style.backgroundColor = 'black';
    addMessage('Roy: Greetings, my friend. What would you like to discuss today?', 'roy');
  });
  
  // Randy Button Click
  randyBtn.addEventListener('click', function() {
    selectedPersona = 'randy';
    randyBtn.style.backgroundColor = '#FFC107';
    randyBtn.style.color = 'white';
    royBtn.style.backgroundColor = 'black';
    addMessage('Randy: What\'s up? Let\'s talk!', 'randy');
  });
  
  // Speak Button Click - Main Functionality
  speakBtn.addEventListener('click', async function() {
    if (!selectedPersona) {
      alert('Please select Roy or Randy first');
      return;
    }
    
    if (isRecording) {
      // Stop recording
      mediaRecorder.stop();
      speakBtn.textContent = 'SPEAK';
      isRecording = false;
      return;
    }
    
    // Start recording
    speakBtn.textContent = 'STOP';
    isRecording = true;
    
    try {
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];
      
      mediaRecorder.ondataavailable = function(e) {
        audioChunks.push(e.data);
      };
      
      mediaRecorder.onstop = async function() {
        // Create audio blob
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        
        // Show "Transcribing..." message
        addMessage('You: (Transcribing...)', 'user');
        
        try {
          // Send to server for transcription
          const formData = new FormData();
          formData.append('audio', audioBlob);
          formData.append('bot', selectedPersona);
          
          const response = await fetch('https://roy-chatbo-backend.onrender.com/api/transcribe', {
            method: 'POST',
            body: formData
          });
          
          const result = await response.json();
          
          // Update with transcribed text
          messagesDiv.lastChild.textContent = 'You: ' + (result.text || 'Could not transcribe');
          
          // Get Roy/Randy response
          const botResponse = await fetch('https://roy-chatbo-backend.onrender.com/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: result.text,
              persona: selectedPersona
            })
          });
          
          const botData = await botResponse.json();
          addMessage((selectedPersona === 'randy' ? 'Randy: ' : 'Roy: ') + botData.text, selectedPersona);
          
          // Play audio response if available
          if (botData.audio) {
            playAudio(botData.audio);
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
      speakBtn.textContent = 'SPEAK';
      isRecording = false;
      alert('Could not access microphone. Please allow access.');
    }
  });
  
  // Simple audio playback function for iPhone
  function playAudio(base64Audio) {
    const audio = new Audio('data:audio/mp3;base64,' + base64Audio);
    audio.setAttribute('playsinline', ''); // Important for iPhone
    audio.play().catch(e => {
      // Show play button if auto-play fails
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
  
  // Helper function to add messages
  function addMessage(text, sender) {
    const msg = document.createElement('p');
    msg.className = sender;
    msg.textContent = text;
    messagesDiv.appendChild(msg);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }
  
  // Save Button
  saveBtn.addEventListener('click', function() {
    const blob = new Blob([messagesDiv.innerText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'conversation.txt';
    a.click();
  });
  
  // Home Button
  homeBtn.addEventListener('click', function() {
    window.location.href = 'https://synthcalm.com';
  });
  
  // Update time display
  function updateTime() {
    const now = new Date();
    document.getElementById('date-time').textContent = 
      (now.getMonth()+1) + '/' + now.getDate() + '/' + now.getFullYear() + ' ' +
      now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  }
  setInterval(updateTime, 60000);
  updateTime();
  
  // iPhone-specific initialization
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    // Add special styles for iPhone
    const style = document.createElement('style');
    style.textContent = `
      button { 
        min-height: 44px; /* Better touch target */
        -webkit-tap-highlight-color: transparent; /* Remove tap highlight */
      }
      #speakBtn {
        font-size: 18px; /* Larger text */
      }
    `;
    document.head.appendChild(style);
  }
});
