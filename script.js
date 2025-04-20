// ✅ Updated /api/transcribe for Whisper via actual file streaming for full compatibility (iOS, Android, Desktop)

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { OpenAI } = require('openai');

const app = express();
app.use(cors());
app.use(express.json());
const upload = multer();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No audio file received.' });

    const tempFilePath = path.join(os.tmpdir(), `audio-${Date.now()}.webm`);
    fs.writeFileSync(tempFilePath, req.file.buffer);

    const transcript = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempFilePath),
      model: 'whisper-1',
      response_format: 'json'
    });

    fs.unlinkSync(tempFilePath);
    res.json({ text: transcript.text });
  } catch (err) {
    console.error('Transcription error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Transcription failed.' });
  }
});
