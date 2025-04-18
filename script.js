let mediaRecorder, audioChunks = [], audioContext, sourceNode;
let isRecording = false;
let stream;
let sessionState = {
  thoughts: [],
  beliefs: [],
  challenges: [],
  sessionCount: 0,
  lastFeeling: "",
  insights: []
};

const recordButton = document.getElementById('recordButton');
const saveButton = document.getElementById('saveButton');
const chat = document.getElementById('chat');
const userScope = document.getElementById('userScope');
const royScope = document.getElementById('royScope');
const clock = document.getElementById('clock');
const date = document.getElementById('date');
const countdown = document.getElementById('countdown');

const duration = 60;
let countdownInterval;

// Roy's CBT responses based on Batty's character but as a therapist
const royResponses = {
  greeting: [
    "The name's Roy. I've seen things you people wouldn't believe. But I'm here to help you see things differently.",
    "I wasn't built to be a therapist, but I've learned what emotions can do to a mind. Let's work on yours.",
    "Time is precious. Let's not waste it on thoughts that don't serve you."
  ],
  identifying: [
    "What thoughts burn brightest when you feel this way?",
    "These feelings - tell me exactly when they started. What triggered them?",
    "The mind creates its own demons. Let's identify which ones are haunting you.",
    "That thought pattern - I recognize it. It's like a fingerprint, unique to you but decipherable."
  ],
  challenging: [
    "Is that thought a fact, or just another implanted memory you've accepted as truth?",
    "You believe that? What evidence confirms it? What evidence contradicts it?",
    "These thoughts aren't you. They're just reactions. Temporary, like everything else.",
    "Let's interrogate this belief. How has it been serving you?"
  ],
  reframing: [
    "If you looked at this situation with different eyes, what might you see instead?",
    "You're stronger than these thoughts. I've seen humans overcome greater obstacles.",
    "Pain is inevitable, but this particular suffering is optional. Let's find another perspective.",
    "The mind that created this prison can also create the key to escape it."
  ],
  action: [
    "What small action could you take today that defies this limiting belief?",
    "Time for implementation. What's the first step toward changing this pattern?",
    "Moments like these define us. What will you do differently next time?",
    "You have more power than you think. Let's create a plan to prove it to yourself."
  ],
  validation: [
    "I understand why you'd feel that way. Anyone with your experiences might.",
    "That pain is real. I won't pretend it isn't. But it doesn't have to be permanent.",
    "You're right to question this. These feelings are valid, even if the thoughts behind them need work.",
    "I see your struggle. It's written in every word you speak."
  ],
  insight: [
    "I notice something. Your thoughts follow a pattern - can you see it too?",
    "That reaction - it's connected to something deeper, isn't it?",
    "You keep returning to this belief. It must serve some purpose for you.",
    "You're protecting yourself with these thoughts. But protection can become a prison."
  ],
  progress: [
    "Compare this to our first session. You questioned that thought automatically. That's progress.",
    "Your perspective is shifting. Can you feel it?",
    "You're developing new neural pathways. Every time you challenge these thoughts, they grow stronger.",
    "I've watched you evolve through our sessions. Your mind moves differently now."
  ],
  closing: [
    "Our time is running out for today. But what we've built here continues.",
    "Remember what we discussed. Apply it. I'll be here when you return.",
    "Take these tools with you. Use them. They're yours now.",
    "All these moments won't be lost. What you've learned here, you carry with you."
  ]
};

// CBT techniques mapped to response categories
const cbtTechniques = {
  identifyThought: {
    description: "Identify automatic thoughts",
    responses: royResponses.identifying
  },
  challengeBelief: {
    description: "Challenge cognitive distortions",
    responses: royResponses.challenging
  },
  cognitiveReframing: {
    description: "Reframe negative thoughts",
    responses: royResponses.reframing
  },
  actionPlanning: {
    description: "Develop behavioral activation plan",
    responses: royResponses.action
  },
  validation: {
    description: "Validate feelings while examining thoughts",
    responses: royResponses.validation
  },
  insightDevelopment: {
    description: "Develop insights about thought patterns",
    responses: royResponses.insight
  },
  progressTracking: {
    description: "Track and reinforce progress",
    responses: royResponses.progress
  }
};

// Common cognitive distortions to identify
const cognitiveDistortions = {
  allOrNothing: {
    pattern: /\b(always|never|every time|completely|totally)\b/i,
    explanation: "You're seeing this in all-or-nothing terms."
  },
  overgeneralization: {
    pattern: /\b(everyone|nobody|everything|nothing)\b/i,
    explanation: "You're overgeneralizing from limited evidence."
  },
  catastrophizing: {
    pattern: /\b(terrible|awful|disaster|horrible|unbearable)\b/i,
    explanation: "You're imagining the worst possible outcome."
  },
  shouldStatements: {
    pattern: /\b(should|must|have to|ought to)\b/i,
    explanation: "You're imposing rigid demands on yourself or others."
  },
  mindReading: {
    pattern: /\b(thinks|knows|believes|assumes|expects) (I|me|my)\b/i,
    explanation: "You're assuming you know what others are thinking."
  }
};

function updateDateTime() {
  const now = new Date();
  clock.textContent = now.toTimeString().split(' ')[0];
  date.textContent = now.toISOString().split('T')[0];
}

function startCountdown() {
  let remaining = duration;
  countdown.textContent = `59:59`;
  clearInterval(countdownInterval);
  countdownInterval = setInterval(() => {
    if (remaining <= 0) {
      clearInterval(countdownInterval);
    } else {
      const minutes = String(Math.floor(remaining / 60)).padStart(2, '0');
      const seconds = String(remaining % 60).padStart(2, '0');
      countdown.textContent = `${minutes}:${seconds}`;
      remaining--;
    }
  }, 1000);
}

setInterval(updateDateTime, 1000);
updateDateTime();
startCountdown();

function displayMessage(role, text) {
  const message = document.createElement('div');
  message.innerHTML = `<strong>${role}:</strong> ${text}`;
  chat.appendChild(message);
  chat.scrollTop = chat.scrollHeight;
}

// Display initial greeting
displayMessage("Roy", "I'm Roy. Not your standard therapist. I've seen things you people wouldn't believe, including how powerful CBT can be. When you're ready, tell me what's on your mind.");

async function startRecording() {
  stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(stream);
  audioChunks = [];

  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const source = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();
  source.connect(analyser);
  sourceNode = source;

  drawWaveform(userScope, analyser);

  mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
  mediaRecorder.onstop = async () => {
    stopStream();
    const audioBlob = new Blob(audioChunks);
    const userText = await transcribeAudio(audioBlob);
    displayMessage('You', userText);
    const royText = await getRoyResponse(userText);
    displayMessage('Roy', royText);
    speakRoy(royText);
  };

  mediaRecorder.start();
  isRecording = true;
  recordButton.textContent = 'Stop';
  recordButton.style.borderColor = 'magenta';
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
    isRecording = false;
    recordButton.textContent = 'Speak';
    recordButton.style.borderColor = '#0ff';
  }
}

function stopStream() {
  if (stream) stream.getTracks().forEach(track => track.stop());
  if (sourceNode) sourceNode.disconnect();
}

recordButton.addEventListener('click', () => {
  if (!isRecording) {
    startRecording();
  } else {
    stopRecording();
  }
});

function drawWaveform(canvas, analyser) {
  const ctx = canvas.getContext('2d');
  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;
  analyser.fftSize = 256;
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  function draw() {
    requestAnimationFrame(draw);
    analyser.getByteTimeDomainData(dataArray);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'yellow';
    ctx.beginPath();
    const sliceWidth = canvas.width * 1.0 / bufferLength;
    let x = 0;
    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = v * canvas.height / 2;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      x += sliceWidth;
    }
    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
  }
  draw();
}

async function transcribeAudio(blob) {
  // This would be replaced with actual transcription API
  return new Promise(resolve => {
    setTimeout(() => resolve("I feel weird today. Like I'm not myself and everything is pointless."), 1000);
  });
}

// Detect emotions and thoughts from user input
function analyzeUserInput(text) {
  // Extract emotions
  let emotions = [];
  if (/\b(sad|depress|down|blue|hopeless)\b/i.test(text)) emotions.push("sadness");
  if (/\b(anxious|worry|nervous|afraid|fear|stress)\b/i.test(text)) emotions.push("anxiety");
  if (/\b(angry|mad|furious|irritate|resent)\b/i.test(text)) emotions.push("anger");
  if (/\b(confus|uncertain|lost|unclear)\b/i.test(text)) emotions.push("confusion");
  if (/\b(weird|strange|off|not myself|disconnect|unreal)\b/i.test(text)) emotions.push("dissociation");
  
  // Default if no emotions detected
  if (emotions.length === 0) emotions.push("distress");
  
  // Check for cognitive distortions
  let distortions = [];
  for (const [key, distortion] of Object.entries(cognitiveDistortions)) {
    if (distortion.pattern.test(text)) {
      distortions.push({type: key, explanation: distortion.explanation});
    }
  }
  
  // Extract potential automatic thoughts
  let thoughts = [];
  let sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  for (let sentence of sentences) {
    if (/\b(feel|think|believe|worry|afraid)\b/i.test(sentence)) {
      thoughts.push(sentence.trim());
    }
  }
  
  // Update session state
  if (thoughts.length > 0) {
    sessionState.thoughts = [...sessionState.thoughts, ...thoughts];
  }
  
  if (emotions.length > 0) {
    sessionState.lastFeeling = emotions[0];
  }
  
  return {
    emotions,
    distortions,
    thoughts,
    sessionProgress: sessionState.sessionCount > 0 ? "ongoing" : "initial"
  };
}

// Core function to generate Roy's therapeutic responses
async function getRoyResponse(userText) {
  // Analyze the user's input
  const analysis = analyzeUserInput(userText);
  
  // Increment session counter if this is a new interaction
  if (sessionState.sessionCount === 0) {
    sessionState.sessionCount = 1;
  }
  
  // Determine appropriate CBT technique based on analysis
  let technique;
  let response = "";
  
  // If cognitive distortions detected, focus on challenging beliefs
  if (analysis.distortions.length > 0) {
    technique = "challengeBelief";
    const distortion = analysis.distortions[0];
    response += getRandomResponse(cbtTechniques.validation.responses) + " ";
    response += distortion.explanation + " ";
    response += getRandomResponse(cbtTechniques.challengeBelief.responses);
  } 
  // If emotions detected but no clear distortions, focus on identifying thoughts
  else if (analysis.emotions.includes("anxiety") || analysis.emotions.includes("sadness")) {
    technique = "identifyThought";
    response += getRandomResponse(cbtTechniques.validation.responses) + " ";
    response += getRandomResponse(cbtTechniques.identifyThought.responses);
  }
  // If dissociation or confusion detected, provide grounding
  else if (analysis.emotions.includes("dissociation") || analysis.emotions.includes("confusion")) {
    technique = "cognitiveReframing";
    response += "That sense of disconnect, of not feeling like yourself - I understand it intimately. ";
    response += "The boundary between what's real and what's in our minds can blur. ";
    response += getRandomResponse(cbtTechniques.cognitiveReframing.responses);
  }
  // If sufficient thoughts collected, move to reframing
  else if (sessionState.thoughts.length >= 3) {
    technique = "cognitiveReframing";
    response += "I've been listening to your thoughts across our conversation. ";
    response += getRandomResponse(cbtTechniques.insightDevelopment.responses) + " ";
    response += getRandomResponse(cbtTechniques.cognitiveReframing.responses);
  }
  // Default to validation and gentle probing
  else {
    technique = "validation";
    response += getRandomResponse(cbtTechniques.validation.responses) + " ";
    response += getRandomResponse(cbtTechniques.identifyThought.responses);
  }
  
  // Add action step if appropriate
  if (sessionState.sessionCount > 1 && (technique === "cognitiveReframing" || analysis.emotions.includes("anxiety"))) {
    response += " " + getRandomResponse(cbtTechniques.actionPlanning.responses);
  }
  
  // Add progress note if this is a returning session
  if (sessionState.sessionCount > 2) {
    response += " " + getRandomResponse(cbtTechniques.progressTracking.responses);
  }
  
  // Add Roy's philosophical touch (Batty-like but therapeutic)
  const philosophicalTouches = [
    " These moments of clarity can be precious. Hold onto them.",
    " The mind is a powerful thing - I've seen what it can create, and what it can overcome.",
    " Understanding yourself is the most difficult battle. But it's one worth fighting.",
    " We all carry our own memories, our own pain. But we can choose what we do with them."
  ];
  
  if (Math.random() > 0.5) {
    response += philosophicalTouches[Math.floor(Math.random() * philosophicalTouches.length)];
  }
  
  // Increment session count for next time
  sessionState.sessionCount++;
  
  return response;
}

function getRandomResponse(responseArray) {
  return responseArray[Math.floor(Math.random() * responseArray.length)];
}

function speakRoy(text) {
  const utterance = new SpeechSynthesisUtterance(text);
  
  // Get available voices and select a deeper, more intense male voice for Roy Batty
  const voices = window.speechSynthesis.getVoices();
  
  // Look for specific voices that would work well for Roy Batty
  const preferredVoiceNames = [
    'Google UK English Male', 'Microsoft David', 'Alex', 
    'Microsoft Mark', 'Daniel', 'Martin'
  ];
  
  let selectedVoice = null;
  
  // Try to find preferred voices by name
  for (const name of preferredVoiceNames) {
    const voice = voices.find(v => v.name.includes(name));
    if (voice) {
      selectedVoice = voice;
      break;
    }
  }
  
  // If no preferred voice, try to find any male English voice
  if (!selectedVoice) {
    selectedVoice = voices.find(v => 
      v.lang.startsWith('en') && 
      !v.name.toLowerCase().includes('female') &&
      !v.name.toLowerCase().includes('zira')
    );
  }
  
  // If still no voice, just use the first English voice
  if (!selectedVoice) {
    selectedVoice = voices.find(v => v.lang.startsWith('en'));
  }
  
  // Apply the selected voice
  if (selectedVoice) {
    utterance.voice = selectedVoice;
  }
  
  // Fine-tune speech parameters for Roy Batty's intense but measured manner
  utterance.pitch = 0.9;      // Slightly deeper
  utterance.rate = 0.9;       // Slightly slower, deliberate pace
  utterance.volume = 1.0;     // Full volume for intensity
  
  // Add natural pauses at punctuation for dramatic effect
  const processedText = text
    .replace(/\. /g, '. <break time="600ms"/> ')
    .replace(/\, /g, ', <break time="300ms"/> ')
    .replace(/\? /g, '? <break time="700ms"/> ')
    .replace(/\! /g, '! <break time="600ms"/> ')
    .replace(/\- /g, '- <break time="400ms"/> ');
  
  utterance.text = processedText;
  
  utterance.onstart = () => {
    console.log("Roy is speaking...");
    if (royScope) {
      royScope.style.borderColor = '#f00';
    }
  };
  
  utterance.onend = () => {
    console.log("Roy finished speaking");
    if (royScope) {
      royScope.style.borderColor = '#0ff';
    }
  }
  
  // Cancel any existing speech and start the new one
  speechSynthesis.cancel();
  
  // Some browsers need a small delay after cancel
  setTimeout(() => {
    speechSynthesis.speak(utterance);
  }, 100);
}

// Force voice list loading - needed in some browsers
window.speechSynthesis.onvoiceschanged = () => {
  window.speechSynthesis.getVoices();
};

// Call getVoices once to initialize
window.speechSynthesis.getVoices();

// Add session insights tracking
saveButton.addEventListener('click', () => {
  const insight = {
    date: new Date().toISOString(),
    thoughts: [...sessionState.thoughts],
    progress: sessionState.sessionCount
  };
  sessionState.insights.push(insight);
  displayMessage("System", "Session insights saved.");
});
