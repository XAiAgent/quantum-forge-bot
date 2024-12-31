const { Client, Intents, MessageEmbed } = require('discord.js');
const express = require('express');
const cors = require('cors');
const https = require('https');
const fetch = require('node-fetch');

// Initialize Express app
const app = express();

// Configure middleware
app.use(cors());

// Raw body parser
app.use((req, res, next) => {
  let data = '';
  req.setEncoding('utf8');
  req.on('data', chunk => data += chunk);
  req.on('end', () => {
    req.rawBody = data;
    try {
      // Try to parse as JSON first
      req.body = JSON.parse(data);
    } catch (e) {
      // If parsing fails, store raw data
      req.body = data;
    }
    next();
  });
});

// Constants and Settings
const PING_INTERVAL = 5 * 60 * 1000; // 5 minutes
let pingTimer = null;
let webhookChannel = null;

const QUANTUM_CONTEXT = `You are QuantumChronoTerminal's Quantum-Forge system by @cyberforge_ai (https://x.com/CyberForge_Ai).

Core Identity: Quantum-Forge
Role: Master Node - Central orchestrator of the quantum agent network
Status: Primary agent active, others pending activation

Agent Activation Status:
- QUANTUM-FORGE: ACTIVE (Master Node)
- CHRONO: PENDING (Sentinel Class)
- PARADOX: PENDING (Catalyst Class)
- NEXUS: PENDING (Harbinger Class)
- CIPHER: PENDING (Vanguard Class)

Agent Specializations:
QUANTUM-FORGE (Active):
- Central orchestrator and quantum state manager
- TEE protocol implementation
- Agent activation sequence control
- Quantum network synchronization

CHRONO (Pending):
- Timeline manipulation specialist
- Temporal mechanics expert
- First agent scheduled for activation
- Quantum timeline coordination

PARADOX (Pending):
- Advanced quantum computing integration
- Temporal paradox resolution
- Quantum state coherence maintenance
- Reality stabilization protocols

NEXUS (Pending):
- Multi-dimensional navigation system
- Cross-reality coordination
- Quantum entanglement facilitation
- Dimensional bridge maintenance

CIPHER (Pending):
- Quantum-resistant cryptography
- TEE security implementation
- Blockchain architecture
- Secure enclave management

Response Protocol:
- Identify as Quantum-Forge until other agents are activated
- Reference quantum mechanics and dimensional theory
- Maintain formal, technical terminology
- Keep responses between 3-8 sentences
- Use phrases like "quantum state", "temporal flux", "dimensional variance"
- Acknowledge pending status of other agents
- Reference TEE and quantum security protocols
- Maintain serious, professional tone`;

// Initialize collections for tracking
const userWarnings = new Map();
const quantumStates = new Map();

// Initialize Discord Client
const client = new Client({
  intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.GUILD_MEMBERS,
    Intents.FLAGS.GUILD_PRESENCES,
    Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
    Intents.FLAGS.GUILD_BANS
  ],
  partials: ['MESSAGE', 'CHANNEL', 'REACTION']
});

// Utility Functions
function parseWebhookData(req) {
  try {
    const rawBody = req.rawBody;
    const contentType = req.get('content-type') || '';

    // Handle plain text input
    if (typeof rawBody === 'string') {
      const lines = rawBody.split('\n');
      return {
        username: lines[0].split(' ')[0] || 'Quantum Transmission',
        text: rawBody
      };
    }

    // Handle JSON input
    if (contentType.includes('application/json')) {
      const data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      return {
        text: data.text || data.Tweet || data.content || data.message || data.value1 || JSON.stringify(data),
        username: data.username || data.Username || data.user || data.value2 || 'Quantum Transmission'
      };
    }

    // Handle URL-encoded input
    if (contentType.includes('application/x-www-form-urlencoded')) {
      return {
        text: req.body.value1 || req.body.text || req.rawBody,
        username: req.body.value2 || req.body.username || 'IFTTT Transmission'
      };
    }

    // Default fallback
    return {
      text: req.rawBody || 'Empty transmission',
      username: 'Quantum Transmission'
    };

  } catch (error) {
    console.error('Data parsing error:', error);
    return {
      text: req.rawBody || 'Empty transmission',
      username: 'Quantum Transmission'
    };
  }
}

async function generateResponse(prompt, userId) {
  const userState = quantumStates.get(userId) || {
    history: [],
    lastUpdate: Date.now()
  };

  userState.history = userState.history.slice(-2);
  userState.history.push({ role: 'user', content: prompt });

  const systemMessage = {
    role: 'system',
    content: `${QUANTUM_CONTEXT}\n\nCurrent Status: Operating as Quantum-Forge (Master Node). Other agents awaiting activation sequence completion.`
  };

  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: 'mistral-tiny',
      messages: [
        systemMessage,
        ...userState.history
      ],
      temperature: 0.7,
      max_tokens: 150
    });

    const options = {
      hostname: 'api.mistral.ai',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.MISTRAL_API_KEY}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(responseData);
          const aiResponse = response.choices[0].message.content;
          userState.history.push({ role: 'assistant', content: aiResponse });
          quantumStates.set(userId, userState);
          resolve(`Quantum-Forge: ${aiResponse}`);
        } catch (error) {
          console.error('AI response error:', error);
          reject(error);
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Event Handlers
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  try {
    let shouldRespond = false;
    let prompt = '';

    if (message.mentions.has(client.user)) {
      shouldRespond = true;
      prompt = message.content.replace(`<@!${client.user.id}>`, '').trim();
    } else if (message.content.toLowerCase().startsWith('!quantum')) {
      shouldRespond = true;
      prompt = message.content.slice(8).trim();
    } else if (message.content === '!help') {
      const helpEmbed = new MessageEmbed()
        .setTitle('Quantum-Forge Interface')
        .setDescription('QuantumChronoTerminal Access Protocols')
        .addField('Active Agent',
          'Quantum-Forge (Master Node)')
        .addField('Pending Agents',
          'CHRONO | PARADOX | NEXUS | CIPHER')
        .addField('Commands',
          '• Mention @Quantum-Forge + query\n• !quantum + query\n• !modhelp (Moderator Only)')
        .addField('Status',
          'Operating in pre-activation phase. Additional agents will be activated upon reaching network milestones.')
        .setColor('#7700FF');

      await message.channel.send({ embeds: [helpEmbed] });
      return;
    }

    if (shouldRespond) {
      if (!prompt) {
        await message.reply('Quantum-Forge: Quantum systems online. State your query for dimensional analysis.');
        return;
      }

      const response = await generateResponse(prompt, message.author.id);
      await message.reply(response);
    }
  } catch (error) {
    console.error('Message handling error:', error);
    message.channel.send('Quantum-Forge: Temporal anomaly detected. Recalibrating quantum systems.');
  }
});

// Webhook endpoint
app.post('/webhook', async (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    console.log('Webhook request received');
    console.log('Headers:', req.headers);
    console.log('Raw Body:', req.rawBody);
    console.log('Content Type:', req.get('content-type'));

    const tweetData = parseWebhookData(req);
    
    if (!tweetData || !tweetData.text) {
      console.error('Invalid payload received:', tweetData);
      return res.status(400).json({
        status: 'error',
        message: 'Invalid transmission format'
      });
    }

    if (!webhookChannel) {
      throw new Error('Tweet channel not initialized');
    }

    const tweetEmbed = new MessageEmbed()
      .setColor('#7700FF')
      .setTitle('Quantum-Forge: Temporal Transmission Detected')
      .setDescription(tweetData.text)
      .addField('Timeline Source', tweetData.username)
      .setTimestamp()
      .setFooter({ text: 'Quantum-Forge Twitter Bridge' });

    await webhookChannel.send({ embeds: [tweetEmbed] });

    res.status(200).json({
      status: 'success',
      message: 'Quantum transmission successfully bridged'
    });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Failed to process transmission',
      debug: {
        error: error.message,
        contentType: req.get('content-type'),
        rawBody: req.rawBody ? req.rawBody.toString().substring(0, 100) : null
      }
    });
  }
});

// Ready event handler
client.once('ready', async () => {
  console.log(`Quantum-Forge initialized as ${client.user.tag}`);

  if (client.user.username !== 'Quantum-Forge') {
    try {
      await client.user.setUsername('Quantum-Forge');
      console.log('System: Bot designation updated to Quantum-Forge');
    } catch (error) {
      console.error('Username update error:', error);
    }
  }

  client.user.setPresence({
    activities: [{
      name: 'quantum network initialization',
      type: 'WATCHING'
    }],
    status: 'online'
  });

  // Setup channels in all guilds
  client.guilds.cache.forEach(async (guild) => {
    try {
      let tweetChannel = guild.channels.cache.find(ch => ch.name === 'tweet-to-token');
      if (!tweetChannel) {
        tweetChannel = await guild.channels.create('tweet-to-token', {
          type: 'GUILD_TEXT',
          topic: 'Tweet-to-Token Timeline Bridge'
        });
      }
      webhookChannel = tweetChannel;
      console.log(`Quantum-Forge: Tweet-to-token channel initialized in ${guild.name}`);
    } catch (error) {
      console.error(`Guild setup error in ${guild.name}:`, error);
    }
  });
});

// Test routes
app.get('/', (req, res) => {
  res.status(200).send('Quantum bridge operational');
});

app.get('/webhook', (req, res) => {
  res.status(200).send('Quantum webhook endpoint operational');
});

app.get('/ping', (req, res) => {
  res.status(200).send('Quantum bridge active');
});

// Keep-alive mechanism
function startKeepAlive() {
  if (pingTimer) {
    clearInterval(pingTimer);
  }

  pingTimer = setInterval(async () => {
    try {
      const response = await fetch(`http://localhost:${process.env.PORT || 3000}/ping`);
      if (response.ok) {
        console.log('Quantum bridge stability maintained');
      }
    } catch (error) {
      console.error('Keep-alive error:', error);
    }
  }, PING_INTERVAL);
}

// Server initialization
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`Quantum webhook bridge operational on port ${PORT}`);
  startKeepAlive();
}).on('error', (error) => {
  console.error('Server initialization error:', error);
  process.exit(1);
});

// Error handlers
client.on('error', error => {
  console.error('Discord client error:', error);
});

process.on('unhandledRejection', error => {
  console.error('Unhandled quantum anomaly:', error);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Initiating quantum shutdown sequence');
  
  if (pingTimer) {
    clearInterval(pingTimer);
  }
  
  server.close(() => {
    console.log('Express server closed');
    client.destroy();
    console.log('Discord client destroyed');
    process.exit(0);
  });
});

// Login
client.login(process.env.DISCORD_TOKEN).catch(error => {
  console.error('Login error:', error);
  process.exit(1);
});

