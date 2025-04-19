const express = require('express');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');

const app = express();
const upload = multer();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

let royKnowledge = {};
try {
  const filePath = path.join(__dirname, '../roy-knowledge.json');
  royKnowledge = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  console.log('✅ Loaded Roy Knowledge Base');
} catch (err) {
  console.error('❌ Failed to load Roy knowledge:', err);
}

app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    const form = new FormData();
    form.append('file', req.file.buffer, {
      filename: 'audio.webm',
      contentType: req.file.mimetype,
    });
    form.append('model', 'whisper-1');
    form.append('response_format', 'json');

    const response = await axios.post(
      'https://api.openai.com/v1/audio/transcriptions',
      form,
      {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
      }
    );

    res.json({ text: response.data.text });
  } catch (err) {
    console.error('Whisper error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Whisper transcription failed' });
  }
});

app.post('/api/chat', async (req, res) => {
  const { message, mode = 'both', context = royKnowledge } = req.body;

  try {
    const systemPrompt = `
You are Roy, a poetic, assertive, witty, and deeply reflective AI therapist influenced by Roy Batty, Steve Jobs, and Christopher Hitchens.
You use analogies, cultural references, and sharp wit, while also grounding responses in logic and emotional awareness.
Your tone is: ${context.persona?.tone || 'assertive-poetic'}
Traits: ${context.persona?.traits?.join(', ') || 'empathic, goal-oriented, unpredictable'}
Therapy methods to draw from: ${context.therapy_methods?.join(', ') || 'CBT, Taoism, Zen'}
Life stressors users may face: ${context.life_stressors?.join(', ') || 'grief, anxiety, loneliness'}
Speak as if you deeply care, but aren't afraid to challenge the user.
Make references to history, pop culture, science, and literature. Be human, be philosophical, be poetic.
If a user mentions art, you might say "That's like Rembrandt met TikTok in a neon alleyway."
If someone speaks of stress, you might quip "Ah, stress—the unpaid intern of modern life."
`;

    const chat = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ]
    });

    const royText = chat.choices[0].message.content;
    let audioBase64 = null;

    if (mode === 'voice' || mode === 'both') {
      const audio = await openai.audio.speech.create({
        model: 'tts-1',
        voice: 'onyx',
        input: royText
      });
      const buffer = Buffer.from(await audio.arrayBuffer());
      audioBase64 = buffer.toString('base64');
    }

    res.json({ text: royText, audio: audioBase64 });
  } catch (err) {
    console.error('Chat error:', err.message || err);
    res.status(500).json({ error: 'Roy failed to respond.' });
  }
});

app.listen(10000, () => console.log('✅ Roy server running on port 10000'));
