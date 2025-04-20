function playRoyAudio(base64) {
  // Ensure the global audioContext is initialized and running
  unlockAudioContext();

  // Validate Base64 input
  if (!base64 || typeof base64 !== 'string' || !base64.trim()) {
    console.error('Invalid Base64 audio data');
    return;
  }

  const audio = new Audio(`data:audio/mp3;base64,${base64}`);
  audio.setAttribute('playsinline', ''); // Ensure iOS compatibility

  // Handle audio loading errors
  audio.onerror = (e) => {
    console.error('Audio loading error:', e);
  };

  audio.onloadeddata = () => {
    // Attempt to play audio
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          // Audio is playing, visualize it
          visualizeAudio(audio, royWaveform, royCtx, 'yellow');
        })
        .catch((error) => {
          console.warn('Audio playback failed:', error);
          // Fallback for autoplay restrictions (e.g., iOS)
          const resume = () => {
            audio.play()
              .then(() => {
                visualizeAudio(audio, royWaveform, royCtx, 'yellow');
              })
              .catch((err) => {
                console.error('Failed to resume audio:', err);
              });
            // Clean up event listeners
            document.body.removeEventListener('click', resume);
            document.body.removeEventListener('touchstart', resume);
          };
          document.body.addEventListener('click', resume, { once: true });
          document.body.addEventListener('touchstart', resume, { once: true });
        });
    }
  };

  // Load the audio
  audio.load();
}
