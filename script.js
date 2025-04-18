body {
  background: #000;
  font-family: 'Courier New', monospace;
  color: #0ff;
  margin: 0;
  padding: 10px;
}

#current-date, #current-time, #countdown-timer {
  display: inline-block;
  font-size: 16px;
  padding: 0 20px;
}

canvas {
  display: block;
  margin: 20px auto;
  border: 1px solid #0ff; /* Thinner border */
  background-color: #000;
  background-image:
    linear-gradient(to right, rgba(255, 255, 0, 0.3) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(255, 255, 0, 0.3) 1px, transparent 1px);
  background-size: 20px 20px;
}

#controls {
  text-align: center;
  margin: 20px auto;
}

button {
  background: transparent;
  border: 1px solid #0ff; /* Thinner border */
  color: #0ff;
  font-family: 'Courier New', monospace;
  font-size: 14px;
  padding: 8px 16px;
  margin: 0 5px;
  cursor: pointer;
  transition: all 0.3s ease-in-out;
}

button:hover {
  background-color: #0ff;
  color: #000;
}

#chat {
  max-width: 900px;
  margin: 0 auto;
  padding: 20px;
  color: yellow;
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
}

#chat p {
  margin-bottom: 10px;
  text-align: left;
}

#chat .roy strong {
  color: yellow;
}

#chat .you strong {
  color: white;
}
