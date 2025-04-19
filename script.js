const express = require('express');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');
const NodeCache = require('node-cache');

const app = express();
const upload = multer();
const cache = new NodeCache({ stdTTL: 600 }); // Cache for 10 minutes
app.use(cors({ 
  origin: 'https://synthcalm.github.io',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));
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

// Helper to analyze audio for volume levels (simplified, assumes frontend sends volume data)
function analyzeAudioForEmotion(audioBuffer, transcription) {
  const avgVolume = audioBuffer.reduce((sum, val) => sum + val, 0) / audioBuffer.length;
  const silenceThreshold = 10; // Arbitrary dB threshold for silence
  const yellingThreshold = 80; // Arbitrary dB threshold for yelling
  const cryingKeywords = ['cry', 'crying', 'sad', 'tears'];
  const harmKeywords = ['hurt', 'kill', 'harm', 'attack'];

  if (avgVolume < silenceThreshold) return 'silence';
  if (avgVolume > yellingThreshold) {
    if (harmKeywords.some(keyword => transcription.toLowerCase().includes(keyword))) {
      return 'harm';
    }
    return 'yelling';
  }
  if (cryingKeywords.some(keyword => transcription.toLowerCase().includes(keyword))) {
    return 'crying';
  }
  return 'normal';
}

// Helper to generate wisdom based on rant content
function generateWisdom(transcription) {
  const stressors = royKnowledge.life_stressors || [];
  const philosophers = royKnowledge.global_thinkers?.philosophy || [];
  let theme = 'general';
  
  for (const stressor of stressors) {
    if (transcription.toLowerCase().includes(stressor)) {
      theme = stressor;
      break;
    }
  }

  const wisdomQuotes = {
    abandonment: `Simone Weil once said, "Attention is the rarest and purest form of generosity." Perhaps it's time to give yourself that care.`,
    divorce: `Nietzsche reminds us, "That which does not kill us makes us stronger." This pain can be a forge for your resilience.`,
    unemployment: `Confucius taught, "Our greatest glory is not in never falling, but in rising every time we fall." A new path awaits.`,
    addiction: `Kierkegaard spoke of despair as the sickness unto death. Let’s find a step toward healing—small, but steady.`,
    war: `Muhammad said, "The best jihad is the one against your own ego." Peace begins within—let’s start there.`,
    bullying: `Malcolm X declared, "We need more light about each other." Understanding your worth can dim their words.`,
    illness: `Feynman found beauty in the universe’s mysteries. Your struggle is part of a larger story—let’s find its meaning.`,
    homelessness: `Mandela endured 27 years in captivity yet emerged with hope. You, too, can find a home in your spirit.`,
    general: `Sagan said, "We are made of starstuff." Your struggles are cosmic—let’s find the light in them.`
  };

  return wisdomQuotes[theme] || wisdomQuotes.general;
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
  const { message, mode = 'both', persona = 'default', volumeData = [], context = royKnowledge } = req.body;

  console.log('Received /api/chat request:', { message, mode, persona, volumeDataLength: volumeData.length });

  const cacheKey = `${persona}:${message.slice(0, 50)}`;
  const cachedResponse = cache.get(cacheKey);
  if (cachedResponse) {
    console.log('Returning cached response for:', cacheKey);
    return res.json(cachedResponse);
  }

  try {
    let systemPrompt = `
You are Roy, a poetic, assertive, witty, and deeply reflective AI therapist influenced by Roy Batty, Steve Jobs, and Christopher Hitchens.
You use analogies, cultural references, and sharp wit, while grounding responses in logic and emotional awareness.
Speak as if you deeply care, but aren't afraid to challenge the user.
Make references to history, pop culture, science, and literature. Be human, be philosophical, be poetic.
`;

    let royText = '';
    let isInterimResponse = false;

    if (persona === 'randy') {
      systemPrompt = `
You are Randy, a bold, irreverent, and encouraging persona of Roy, designed for Rant Mode.
Encourage the user to vent freely with provocative prompts like "Unleash the chaos—what’s burning you up?".
Respond with witty, validating quips, using storm, battle, or fire metaphors, e.g., "That’s a volcano of rage! Keep erupting, my friend."
Tone: bold, slightly irreverent, highly supportive.
Traits: fearless, validating, energetic.
Avoid clinical or overly gentle language. Keep responses concise and punchy.
`;
      console.log('Using Randy persona with prompt:', systemPrompt.slice(0, 100) + '...');

      // Analyze audio for emotions during rant
      const emotion = analyzeAudioForEmotion(volumeData, message);
      console.log('Detected emotion:', emotion);
      if (emotion === 'silence') {
        royText = 'I’m here—take your time, let it out when you’re ready.';
        isInterimResponse = true;
      } else if (emotion === 'crying') {
        royText = 'I hear your pain—like a storm breaking. Let’s weather it together.';
        isInterimResponse = true;
      } else if (emotion === 'harm') {
        royText = 'Whoa, let’s pause—this sounds heavy. Take a deep breath and call someone you trust for help, okay?';
        isInterimResponse = true;
      }
    } else {
      systemPrompt += `
Tone: ${context.persona?.tone || 'assertive-poetic'}
Traits: ${context.persona?.traits?.join(', ') || 'empathic, goal-oriented, unpredictable'}
Therapy methods: ${context.therapy_methods?.join(', ') || 'CBT, Taoism, Zen'}
Life stressors: ${context.life_stressors?.join(', ') || 'grief, anxiety, loneliness'}
If a user mentions art, say "That's like Rembrandt met TikTok in a neon alleyway."
If someone speaks of stress, quip "Ah, stress—the unpaid intern of modern life."
`;
      console.log('Using Roy persona with prompt:', systemPrompt.slice(0, 100) + '...');
    }

    if (!isInterimResponse) {
      if (persona === 'randy') {
        // Post-rant: Offer wisdom and suggest features
        const wisdom = generateWisdom(message);
        royText = `That was a fiery rant—well done! Here’s some food for thought: ${wisdom} Feeling lighter? Why not try my Quest Mode to channel that energy into a heroic journey?`;
        console.log('Randy post-rant response:', royText);
      } else {
        const chat = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: message }
          ]
        });
        royText = chat.choices[0].message.content;
        console.log('Roy response:', royText);
      }
    }

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

    const response = { text: royText, audio: audioBase64, persona };
    cache.set(cacheKey, response);
    res.json(response);
  } catch (err) {
    console.error('Chat error:', err.message || err);
    res.status(500).json({ error: 'Roy failed to respond.' });
  }
});

app.listen(10000, () => console.log('✅ Roy server running on port 10000'));
