const express = require('express');
const multer = require('multer');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

const ASSEMBLY_API_KEY = process.env.ASSEMBLYAI_API_KEY;

router.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No audio file uploaded' });

  try {
    // 1. Upload to AssemblyAI
    const audioData = fs.readFileSync(req.file.path);
    const uploadRes = await axios.post(
      'https://api.assemblyai.com/v2/upload',
      audioData,
      {
        headers: {
          'authorization': ASSEMBLY_API_KEY,
          'content-type': 'application/octet-stream',
        }
      }
    );

    const audioUrl = uploadRes.data.upload_url;

    // 2. Request transcription
    const transcriptRes = await axios.post(
      'https://api.assemblyai.com/v2/transcript',
      { audio_url: audioUrl },
      {
        headers: {
          authorization: ASSEMBLY_API_KEY,
          'content-type': 'application/json',
        }
      }
    );

    const transcriptId = transcriptRes.data.id;

    // 3. Poll for result
    let completed = false;
    let text = '';
    while (!completed) {
      const pollingRes = await axios.get(
        `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
        {
          headers: { authorization: ASSEMBLY_API_KEY }
        }
      );

      if (pollingRes.data.status === 'completed') {
        completed = true;
        text = pollingRes.data.text;
      } else if (pollingRes.data.status === 'error') {
        return res.status(500).json({ error: 'AssemblyAI transcription error' });
      } else {
        await new Promise(r => setTimeout(r, 1500)); // wait 1.5s
      }
    }

    res.json({ text });

  } catch (err) {
    console.error('[Transcription Error]', err);
    res.status(500).json({ error: 'Failed to transcribe audio' });
  } finally {
    fs.unlink(req.file.path, () => {}); // Clean up temp file
  }
});

module.exports = router;
