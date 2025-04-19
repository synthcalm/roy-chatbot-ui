
 window.addEventListener('DOMContentLoaded', () => {
   try {
     console.log('Script initialized');
     console.log('Whisper mode initialized');
 
     const royAudio = new Audio();
     royAudio.setAttribute('playsinline', 'true');
 @@ -21,8 +21,8 @@ window.addEventListener('DOMContentLoaded', () => {
     let analyser = null;
     let stream = null;
     let mediaRecorder = null;
     let ws = null;
     let isRecording = false;
     let recordedChunks = [];
     let sessionStart = Date.now();
 
     function updateClock() {
 @@ -53,81 +53,82 @@ window.addEventListener('DOMContentLoaded', () => {
           audioContext = new (window.AudioContext || window.webkitAudioContext)();
           await audioContext.resume();
         }
         stream = await navigator.mediaDevices.getUserMedia({ audio: true });
 
         stream = await navigator.mediaDevices.getUserMedia({ audio: true });
         const source = audioContext.createMediaStreamSource(stream);
         analyser = audioContext.createAnalyser();
         analyser.fftSize = 2048;
         source.connect(analyser);
         drawWaveform(userCtx, userCanvas, analyser, 'yellow');
 
         ws = new WebSocket("wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000", ['assemblyai-realtime']);
         ws.onopen = () => {
           ws.send(JSON.stringify({ auth_token: "c204c69052074ce98287a515e68da0c4" }));
           mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
         mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
         recordedChunks = [];
 
           mediaRecorder.ondataavailable = e => {
             if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
               ws.send(e.data);
               console.log('Sent audio chunk');
             }
           };
           mediaRecorder.start(500);
           isRecording = true;
           micBtn.textContent = 'Stop';
           micBtn.classList.add('recording');
         mediaRecorder.ondataavailable = e => {
           if (e.data.size > 0) recordedChunks.push(e.data);
         };
 
         ws.onmessage = async e => {
           const msg = JSON.parse(e.data);
           if (msg.text && msg.message_type === 'FinalTranscript') {
             appendMessage('You', msg.text);
             await fetchRoyResponse(msg.text);
         mediaRecorder.onstop = async () => {
           const blob = new Blob(recordedChunks, { type: 'audio/webm' });
           const formData = new FormData();
           formData.append('audio', blob);
 
           appendMessage('Roy', '<em>Transcribing...</em>');
 
           try {
             const res = await fetch('https://roy-chatbo-backend.onrender.com/api/transcribe', {
               method: 'POST',
               body: formData
             });
             const data = await res.json();
             if (data.text) {
               appendMessage('You', data.text);
               await fetchRoyResponse(data.text);
             } else {
               appendMessage('Roy', 'Sorry, I didn’t catch that.');
             }
           } catch (err) {
             console.error('Whisper transcription error:', err);
             appendMessage('Roy', 'Transcription failed.');
           }
         };
 
         ws.onerror = err => {
           console.error('WebSocket error', err);
           stopRecording();
         };
         mediaRecorder.start();
         isRecording = true;
         micBtn.textContent = 'Stop';
         micBtn.classList.add('recording');
 
         ws.onclose = () => stopRecording();
       } catch (err) {
         appendMessage('Roy', 'Mic access error. Check permissions.');
         console.error('Mic error:', err);
         appendMessage('Roy', 'Mic permission error.');
       }
     }
 
     function stopRecording() {
       if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
       if (stream) stream.getTracks().forEach(track => track.stop());
       if (ws && ws.readyState === WebSocket.OPEN) {
         ws.send(JSON.stringify({ terminate_session: true }));
         ws.close();
       }
       if (stream) stream.getTracks().forEach(t => t.stop());
       micBtn.textContent = 'Speak';
       micBtn.classList.remove('recording');
       isRecording = false;
     }
 
     async function fetchRoyResponse(text) {
       appendMessage('Roy', '<em>Roy is reflecting...</em>');
       try {
         const res = await fetch('https://roy-chatbo-backend.onrender.com/api/chat', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ message: text, mode: "both" })
           body: JSON.stringify({ message: text, mode: 'both' })
         });
         const data = await res.json();
         if (data.text) appendMessage('Roy', data.text);
         if (data.audio) {
           royAudio.src = `data:audio/mp3;base64,${data.audio}`;
           royAudio.play().catch(err => console.warn('Audio play blocked', err));
           royAudio.play().catch(e => console.warn('Autoplay error', e));
           drawWaveformRoy(royAudio);
         }
       } catch (err) {
         appendMessage('Roy', 'Roy failed to respond.');
         console.error(err);
         console.error('Roy response failed:', err);
         appendMessage('Roy', 'Error generating response.');
       }
     }
 
 @@ -211,10 +212,10 @@ window.addEventListener('DOMContentLoaded', () => {
 
     appendMessage('Roy', "Welcome. I'm Roy. Speak when ready.");
   } catch (err) {
     console.error('Fatal error:', err);
     const errBox = document.createElement('p');
     errBox.textContent = 'Roy failed to initialize.';
     errBox.style.color = 'red';
     document.body.appendChild(errBox);
     console.error('Fatal init error:', err);
     const fallback = document.createElement('p');
     fallback.textContent = 'Roy failed to load.';
     fallback.style.color = 'red';
     document.body.appendChild(fallback);
   }
 });
