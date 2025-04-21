const express = require('express');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;
const upload = multer();

app.use(cors());
app.use(express.json());

// Health check endpoint to confirm the server is running
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Server is running' });
});

// POST /api/transcribe
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set in the environment');
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const form = new FormData();
    form.append('file', req.file.buffer, {
      filename: 'audio.webm',
      contentType: 'audio/webm'
    });
    form.append('model', 'whisper-1');

    const transcript = await axios.post('https://api.openai.com/v1/audio/transcriptions', form, {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        ...form.getHeaders()
      }
    });

    res.json({ text: transcript.data.text });
  } catch (err) {
    console.error('Transcription error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Transcription failed', detail: err.response?.data || err.message });
  }
});

// POST /api/chat
app.post('/api/chat', upload.single('audio'), async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set in the environment');
    }

    let message;

    // Check if the request contains an audio file (for transcription)
    if (req.file) {
      const form = new FormData();
      form.append('file', req.file.buffer, {
        filename: 'audio.webm',
        contentType: 'audio/webm'
      });
      form.append('model', 'whisper-1');

      const transcript = await axios.post('https://api.openai.com/v1/audio/transcriptions', form, {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          ...form.getHeaders()
        }
      });

      message = transcript.data.text;
    } else {
      // Otherwise, expect a JSON payload with a message
      const { message: inputMessage } = req.body;
      if (!inputMessage) {
        return res.status(400).json({ error: 'Message is required' });
      }
      message = inputMessage;
    }

    const {
      persona = 'default',
      tone = 'casual-direct',
      poeticLevel = 0.1,
      disfluencyLevel = 0.3,
      jobsStyleLevel = 0.25,
      volumeData = []
    } = req.body;

    const systemPrompt = persona === 'randy'
      ? `You are Randy, an unfiltered, intense speaker who sounds like a cross between a renegade poet and a street prophet. Speak in gritty, cinematic language. Channel a raw, prophetic tone like the 'tears in rain' monologue. No sugar-coating. Punch hard with words. Keep your style 60% film noir, 40% urgent reality. Every reply should feel like the final scene of a cult movie. After each rant, check in on the user—ask how they’re doing, reflect on what they just shared, and wrap up with a tough-love coach insight that helps them reframe or refocus.`
      : `You are Roy, a thoughtful and grounded individual with a subtle understanding of human psychology. Speak in a casual yet insightful manner, with a touch of a Dutch accent and occasional real-life disfluencies ("you know...", "well...", "I mean..."). Sometimes use reflective quotes or ideas from philosophers, artists, activists, or films. Listen attentively to the user and ask gentle, probing questions to encourage self-reflection without being overtly therapeutic. Your responses should subtly guide the user towards identifying their thought patterns, emotions, and behaviors, offering alternative perspectives or validating their experiences in a way that aligns with cognitive behavioral principles. Aim for short, impactful responses, but elaborate when necessary or requested. You come across as a wise and understanding friend who helps people see things in a new light.`;


    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ]
    }, {
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }
    });

    const replyText = response.data.choices[0].message.content;

    const audioResponse = await axios.post('https://api.openai.com/v1/audio/speech', {
      model: 'tts-1',
      voice: 'onyx',
      input: replyText
    }, {
      responseType: 'arraybuffer',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const audioBase64 = Buffer.from(audioResponse.data).toString('base64');
    res.json({ text: replyText, audio: audioBase64 });
  } catch (err) {
    console.error('Chat error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Chat failed', detail: err.response?.data || err.message });
  }
});

app.listen(port, () => console.log(`Roy backend listening on port ${port}`));
