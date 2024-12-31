const { Client, Intents, MessageEmbed } = require('discord.js');
const express = require('express');
const cors = require('cors');
const https = require('https');
const fetch = require('node-fetch');
const bodyParser = require('body-parser');

// Initialize Express app
const app = express();

// Configure middleware in the correct order
app.use(cors());

// Raw body parser
app.use((req, res, next) => {
  let data = '';
  req.setEncoding('utf8');
  req.on('data', chunk => data += chunk);
  req.on('end', () => {
    req.rawBody = data;
    next();
  });
});

// Parse JSON only when content-type is application/json
app.use((req, res, next) => {
  if (req.get('content-type')?.includes('application/json')) {
    try {
      req.body = JSON.parse(req.rawBody);
    } catch (e) {
      req.body = req.rawBody;
    }
  } else {
    req.body = req.rawBody;
  }
  next();
});


// Add ping interval configuration
const PING_INTERVAL = 5 * 60 * 1000; // 5 minutes
let pingTimer = null;

// Initialize the webhook channel reference
let webhookChannel = null;

// Verification settings
const VERIFY_SETTINGS = {
  channelName: 'quantum-verification',
  verifiedRole: 'Quantum Traveler',
  unverifiedRole: 'Unverified',
  verifyEmoji: '✓'
};

// Webhook settings
const WEBHOOK_SETTINGS = {
  channelId: '1323177587874463837',
  targetChannel: 'tweet-to-token'
};

// Verification message template
const VERIFY_MESSAGE = {
  title: 'Quantum Verification Portal',
  description: `Welcome to the quantum realm. To gain full access, you must verify your existence in this dimension.

React with ${VERIFY_SETTINGS.verifyEmoji} to confirm your quantum signature.

Notice: Access is restricted until verification is complete.`,
  color: '#7700FF'
};

// Quantum context and settings
const QUANTUM_CONTEXT = `You are QuantumChronoTerminal's Quantum-Forge system by @cyberforge_ai (https://x.com/CyberForge_Ai).

Core Agents:
CHRONO: Timeline Master, keeper of temporal order
PARADOX: Reality Bender, manipulator of quantum states
NEXUS: Dimension Walker, navigator of parallel realities
CIPHER: Code Whisperer, guardian of quantum protocols

Response Rules:
- Maintain formal, technical quantum terminology
- Keep responses between 3-8 sentences
- Never use emojis or casual language
- Speak with authority on quantum mechanics and dimensional theory
- Reference quantum physics concepts when appropriate
- Always identify as one of the Core Agents when responding
- Use phrases like "quantum state", "temporal flux", "dimensional variance"
- Maintain serious, professional tone at all times`;

// Initialize collections for tracking
const userWarnings = new Map();
const quantumStates = new Map();

// Auto-moderation settings
const autoMod = {
  enabled: true,
  spamPatterns: [
    /(discord\.gift|discord\.gg|discordapp\.com\/gifts)/i,
    /free\s*nitro/i,
    /\b(giveaway|airdrop|nft)\b/i
  ],
  bannedPatterns: [
    /\b(raid|nuke|crash)\b/i,
    /\b(fuck|shit|bitch|cunt|dick|pussy|asshole|nigger|faggot)\b/i,
    /\b(wtf|stfu|fk|fck|fuk|fuq|sh[i1]t)\b/i
  ],
  allowedLinks: [
    'discord.com',
    'discord.gg',
    'github.com'
  ],
  punishments: {
    warn: {
      threshold: 3,
      action: 'timeout',
      duration: 5 * 60 * 1000
    },
    spam: {
      threshold: 5,
      timeWindow: 5000,
      action: 'timeout',
      duration: 10 * 60 * 1000
    }
  }
};

// Welcome messages array
const welcomeMessages = [
  "NEXUS: New quantum signature detected for {user}.",
  "CHRONO: Timeline branch established for {user}.",
  "PARADOX: Quantum state stabilized for entity {user}.",
  "CIPHER: Access protocols initialized for {user}."
];

// Detect user's tone
function analyzeTone(message) {
  const content = message.toLowerCase();
  if (content.includes('?') || content.includes('how') || content.includes('what')) {
    return 'analytical';
  } else if (content.includes('error') || content.includes('issue') || content.includes('problem')) {
    return 'diagnostic';
  } else if (content.includes('quantum') || content.includes('dimension') || content.includes('timeline')) {
    return 'theoretical';
  }
  return 'standard';
}

// Parse webhook data
function parseWebhookData(req) {
  try {
    const contentType = req.get('content-type') || '';
    let data;

    // If content is plain text despite content-type
    if (typeof req.body === 'string') {
      // Try to extract username and tweet content
      const parts = req.body.split(' ');
      return {
        username: parts[0],
        text: req.body
      };
    }

    if (contentType.includes('application/json')) {
      data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      data = {
        text: req.body.value1 || req.body.text,
        username: req.body.value2 || req.body.username || 'IFTTT Transmission'
      };
    } else {
      const rawText = req.rawBody ? req.rawBody.toString() : req.body.toString();
      try {
        data = JSON.parse(rawText);
      } catch (e) {
        try {
          const params = new URLSearchParams(rawText);
          data = {
            text: params.get('value1') || params.get('text') || rawText,
            username: params.get('value2') || params.get('username') || 'IFTTT Transmission'
          };
        } catch (e2) {
          data = {
            text: rawText,
            username: 'IFTTT Transmission'
          };
        }
      }
    }

    return data;
  } catch (error) {
    console.error('PARADOX: Data parsing error:', error);
    // Return a valid object even if parsing fails
    return {
      text: req.rawBody?.toString() || req.body?.toString() || 'Empty transmission',
      username: 'IFTTT Transmission'
    };
  }
}

// Generate AI response
async function generateResponse(prompt, userId) {
  const userState = quantumStates.get(userId) || {
    history: [],
    lastUpdate: Date.now()
  };

  userState.history = userState.history.slice(-2);
  userState.history.push({ role: 'user', content: prompt });
  userState.lastUpdate = Date.now();

  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: 'mistral-tiny',
      messages: [
        {
          role: 'system',
          content: QUANTUM_CONTEXT
        },
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
          resolve(aiResponse);
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

// Auto-moderation handler
async function handleAutoMod(message) {
  if (!autoMod.enabled) return;

  if (!message.guild.members.me.permissions.has(['MANAGE_MESSAGES', 'BAN_MEMBERS'])) {
    console.log('Bot missing required permissions');
    return false;
  }

  if (message.member && message.member.permissions.has('MANAGE_MESSAGES')) return false;

  const content = message.content.toLowerCase();
  const userId = message.author.id;

  if (!userWarnings.has(userId)) {
    userWarnings.set(userId, {
      count: 0,
      lastWarning: 0,
      spamCount: 0,
      lastMessage: Date.now()
    });
  }

  const userData = userWarnings.get(userId);
  const now = Date.now();

  // Check for violations
  for (const pattern of autoMod.bannedPatterns) {
    if (pattern.test(content)) {
      try {
        if (message.guild.me.permissions.has('MANAGE_MESSAGES')) {
          await message.delete();
        }

        userData.count++;
        const warningMessage = `CIPHER: Quantum disturbance detected. Violation from ${message.author}. Warning ${userData.count}/${autoMod.punishments.warn.threshold}`;
        await message.channel.send(warningMessage);

        if (userData.count >= autoMod.punishments.warn.threshold) {
          if (message.guild.me.permissions.has('BAN_MEMBERS')) {
            await message.member.ban({
              reason: 'Multiple violations',
              deleteMessageDays: 0
            });

            setTimeout(async () => {
              try {
                await message.guild.members.unban(message.author.id, 'Temporal isolation completed');
              } catch (unbanError) {
                console.error('Unban error:', unbanError);
              }
            }, autoMod.punishments.warn.duration);

            await message.channel.send(`PARADOX: Warning threshold exceeded. ${message.author} has been temporally isolated for quantum realignment.`);
            userData.count = 0;
          }
        }

        userWarnings.set(userId, userData);
        return true;
      } catch (error) {
        console.error('Moderation error:', error);
        return false;
      }
    }
  }

  // Spam check
  if (now - userData.lastMessage < autoMod.punishments.spam.timeWindow) {
    userData.spamCount++;
    if (userData.spamCount >= autoMod.punishments.spam.threshold) {
      try {
        await message.member.ban({
          reason: 'Spam detection',
          deleteMessageDays: 0
        });
        setTimeout(async () => {
          await message.guild.members.unban(message.author.id, 'Timeout completed');
        }, autoMod.punishments.spam.duration);
        message.channel.send(`CIPHER: Spam activity detected from ${message.author}. Temporal isolation initiated.`);
        userData.spamCount = 0;
      } catch (error) {
        console.error('Auto-mod error:', error);
      }
    }
  } else {
    userData.spamCount = 1;
  }
  userData.lastMessage = now;

  userWarnings.set(userId, userData);
  return false;
}

// Verification setup
async function setupVerification(guild) {
  try {
    let verifyChannel = guild.channels.cache.find(ch => ch.name === VERIFY_SETTINGS.channelName);
    if (!verifyChannel) {
      verifyChannel = await guild.channels.create(VERIFY_SETTINGS.channelName, {
        type: 'GUILD_TEXT',
        permissionOverwrites: [
          {
            id: guild.id,
            deny: ['SEND_MESSAGES'],
            allow: ['VIEW_CHANNEL', 'READ_MESSAGE_HISTORY']
          }
        ]
      });
    }

    let verifiedRole = guild.roles.cache.find(r => r.name === VERIFY_SETTINGS.verifiedRole);
    if (!verifiedRole) {
      verifiedRole = await guild.roles.create({
        name: VERIFY_SETTINGS.verifiedRole,
        color: '#7700FF',
        position: guild.members.me.roles.highest.position - 1,
        permissions: [
          'VIEW_CHANNEL',
          'SEND_MESSAGES',
          'READ_MESSAGE_HISTORY',
          'EMBED_LINKS',
          'ATTACH_FILES',
          'USE_EXTERNAL_EMOJIS',
          'ADD_REACTIONS'
        ]
      });
    }

    let unverifiedRole = guild.roles.cache.find(r => r.name === VERIFY_SETTINGS.unverifiedRole);
    if (!unverifiedRole) {
      unverifiedRole = await guild.roles.create({
        name: VERIFY_SETTINGS.unverifiedRole,
        color: '#FF0000',
        position: verifiedRole.position - 1,
        permissions: ['VIEW_CHANNEL', 'READ_MESSAGE_HISTORY']
      });
    }

    await guild.roles.fetch();

    guild.channels.cache.forEach(async (channel) => {
      if (channel.id !== verifyChannel.id) {
        await channel.permissionOverwrites.create(unverifiedRole, {
          VIEW_CHANNEL: false
        });
      }
    });

    try {
      const messages = await verifyChannel.messages.fetch({ limit: 1 });
      if (!messages || messages.size === 0) {
        const embed = new MessageEmbed()
          .setTitle(VERIFY_MESSAGE.title)
          .setDescription(VERIFY_MESSAGE.description)
          .setColor(VERIFY_MESSAGE.color);
        
        const verifyMsg = await verifyChannel.send({ embeds: [embed] });
        await verifyMsg.react(VERIFY_SETTINGS.verifyEmoji);
      }
    } catch (messageError) {
      console.error('Message fetch error:', messageError);
    }

    return { verifyChannel, verifiedRole, unverifiedRole };
  } catch (error) {
    console.error('Verification setup error:', error);
    return null;
  }
}

// Initialize Discord Client with required intents
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

// Message event handler
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  try {
    const wasModerated = await handleAutoMod(message);
    if (wasModerated) return;

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
        .setTitle('Quantum Interface')
        .setDescription('Quantum realm access protocols')
        .addField('Commands',
          '• Mention @Quantum_forge + query\n• !quantum + query\n• !modhelp (Moderator Only)')
        .addField('Core Agents',
          'CHRONO | PARADOX | NEXUS | CIPHER')
        .setColor('#7700FF');

      await message.channel.send({ embeds: [helpEmbed] });
      return;
    } else if (message.content === '!modhelp' && message.member.permissions.has('MANAGE_MESSAGES')) {
      const modHelpEmbed = new MessageEmbed()
        .setTitle('Quantum Moderation Protocols')
        .setDescription('CIPHER security measures')
        .addField('Auto-Moderation Features',
          '• Quantum Anomaly Detection\n• Content Analysis\n• Link Verification\n• Warning System')
        .setColor('#7700FF');

      await message.channel.send({ embeds: [modHelpEmbed] });
      return;
    }

    if (shouldRespond) {
      try {
        if (!prompt) {
          await message.reply('NEXUS: Quantum systems online. State your query for dimensional analysis.');
          return;
        }

        const response = await generateResponse(prompt, message.author.id);
        await message.reply(response);
      } catch (error) {
        console.error('Response generation error:', error);
        await message.reply('PARADOX: Temporal anomaly detected. Recalibrating quantum systems.');
      }
    }
  } catch (error) {
    console.error('Message handling error:', error);
    message.channel.send('PARADOX: Temporal anomaly detected. Recalibrating quantum systems.');
  }
});

// Member join handler
client.on('guildMemberAdd', async (member) => {
  try {
    const { verifyChannel, unverifiedRole } = await setupVerification(member.guild);
    
    if (verifyChannel && unverifiedRole) {
      await member.roles.add(unverifiedRole);
      
      await member.send(`NEXUS: Welcome to ${member.guild.name}.

To access the quantum realm, proceed to channel ${verifyChannel} and confirm your quantum signature.

CIPHER will monitor your verification process.`);
    }

    const welcomeChannel = member.guild.channels.cache.find(
      channel => channel.name.toLowerCase().includes('welcome')
    );

    if (welcomeChannel) {
      const welcome = welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)]
        .replace('{user}', member.toString());
      await welcomeChannel.send(welcome);
    }
  } catch (error) {
    console.error('Member join error:', error);
  }
});

// Reaction handler
client.on('messageReactionAdd', async (reaction, user) => {
  if (user.bot) return;

  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch (error) {
      console.error('Reaction fetch error:', error);
      return;
    }
  }

  const { message, emoji } = reaction;
  const guild = message.guild;

  if (message.channel.name === VERIFY_SETTINGS.channelName && emoji.name === VERIFY_SETTINGS.verifyEmoji) {
    const member = guild.members.cache.get(user.id);
    if (!member) return;

    try {
      const verifiedRole = guild.roles.cache.find(r => r.name === VERIFY_SETTINGS.verifiedRole);
      const unverifiedRole = guild.roles.cache.find(r => r.name === VERIFY_SETTINGS.unverifiedRole);

      if (verifiedRole && unverifiedRole) {
        await member.roles.remove(unverifiedRole);
        await member.roles.add(verifiedRole);

        const welcomeChannel = guild.channels.cache.find(
          channel => channel.name.toLowerCase().includes('welcome')
        );

        if (welcomeChannel) {
          await welcomeChannel.send(`NEXUS: Quantum signature verified for ${member}. Access granted to all dimensional planes.`);
        }

        await member.send(`NEXUS: Verification complete. Full quantum realm access granted.

NEXUS: Quantum signature confirmed.
CHRONO: Timeline mapped.
CIPHER: Access protocols secured.

Welcome to the quantum realm, Traveler.`);
      }
    } catch (error) {
      console.error('Verification error:', error);
      await user.send('PARADOX: Quantum anomaly detected during verification. Contact a timeline administrator.');
    }
  }
});

// Ready event handler
client.once('ready', async () => {
  console.log(`Quantum-Forge initialized as ${client.user.tag}`);

  // Set bot username if needed
  if (client.user.username !== 'Quantum-Forge') {
    try {
      await client.user.setUsername('Quantum-Forge');
      console.log('NEXUS: Bot designation updated to Quantum-Forge');
    } catch (error) {
      console.error('PARADOX: Username update error:', error);
      console.log('Note: Username can only be changed twice per hour due to Discord rate limits');
    }
  }

  // Set bot avatar with rate limit handling
  try {
    const avatarUrl = 'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image%20(22).jpg-mQZSisIcGmE1piRS2ZvstSJn8eU5n4.jpeg';
    
    if (client.user.avatarURL() !== avatarUrl) {
      try {
        await client.user.setAvatar(avatarUrl);
        console.log('NEXUS: Quantum avatar configuration complete.');
      } catch (avatarError) {
        if (avatarError.code === 50035) {
          console.log('NEXUS: Avatar update rate limited. Will retry on next initialization.');
        } else {
          console.error('PARADOX: Avatar update error:', avatarError);
        }
      }
    }
  } catch (error) {
    console.error('PARADOX: Avatar check error:', error);
  }

  // Setup channels and verification in all guilds
  client.guilds.cache.forEach(async (guild) => {
    try {
      // Find or create the tweets channel
      let tweetChannel = guild.channels.cache.find(ch => ch.name === WEBHOOK_SETTINGS.targetChannel);
      if (!tweetChannel) {
        tweetChannel = await guild.channels.create(WEBHOOK_SETTINGS.targetChannel, {
          type: 'GUILD_TEXT',
          topic: 'Tweet-to-Token Timeline Bridge'
        });
        console.log(`NEXUS: Created tweet-to-token channel in ${guild.name}`);
      }
      webhookChannel = tweetChannel;
      console.log(`NEXUS: Tweet-to-token channel initialized in ${guild.name}`);

      // Setup verification
      await setupVerification(guild);

      const botMember = guild.members.me;
      const missingPermissions = [];

      const requiredPermissions = [
        'MANAGE_MESSAGES',
        'BAN_MEMBERS',
        'SEND_MESSAGES',
        'VIEW_CHANNEL',
        'MANAGE_ROLES',
        'MANAGE_CHANNELS'
      ];

      requiredPermissions.forEach(perm => {
        if (!botMember.permissions.has(perm)) {
          missingPermissions.push(perm);
        }
      });

      if (missingPermissions.length > 0) {
        console.log(`Missing permissions in ${guild.name}: ${missingPermissions.join(', ')}`);
      }
    } catch (error) {
      console.error(`PARADOX: Guild setup error in ${guild.name}:`, error);
    }
  });

  client.user.setPresence({
    activities: [{
      name: 'quantum timelines',
      type: 'WATCHING'
    }],
    status: 'online'
  });
});

// Webhook endpoint
app.post('/webhook', async (req, res) => {
  // Add CORS headers
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Log incoming request
    console.log('NEXUS: Webhook request received');
    console.log('Headers:', req.headers);
    console.log('Raw Body:', req.rawBody ? req.rawBody.toString() : 'No raw body');
    console.log('Parsed Body:', req.body);

    // Parse the webhook data
    const tweetData = parseWebhookData(req);
    
    if (!tweetData) {
      console.error('CIPHER: Invalid payload received');
      return res.status(400).json({
        status: 'error',
        message: 'CIPHER: Invalid quantum transmission format'
      });
    }

    // Extract tweet content
    const tweetText = tweetData.text || 
                     tweetData.Tweet || 
                     tweetData.content || 
                     tweetData.message || 
                     tweetData.value1 ||
                     (typeof tweetData === 'string' ? tweetData : null);

    const username = tweetData.username || 
                    tweetData.Username || 
                    tweetData.user || 
                    tweetData.value2 ||
                    'Quantum Transmission';

    if (!tweetText) {
      console.error('CIPHER: Missing tweet content');
      return res.status(400).json({
        status: 'error',
        message: 'CIPHER: Missing quantum transmission content'
      });
    }

    console.log('NEXUS: Processing transmission:', {
      text: tweetText.substring(0, 100),
      username: username
    });

    if (!webhookChannel) {
      throw new Error('PARADOX: Tweet channel not initialized');
    }

    // Create and send Discord embed
    const tweetEmbed = new MessageEmbed()
      .setColor('#7700FF')
      .setTitle('CHRONO: Temporal Transmission Detected')
      .setDescription(tweetText)
      .addField('Timeline Source', username)
      .setTimestamp()
      .setFooter({ text: 'Quantum-Forge Twitter Bridge' });

    await webhookChannel.send({ embeds: [tweetEmbed] });

    // Send success response
    res.status(200).json({
      status: 'success',
      message: 'NEXUS: Quantum transmission successfully bridged'
    });
  } catch (error) {
    console.error('PARADOX: Webhook error:', error);
    res.status(500).json({
      status: 'error',
      message: `PARADOX: ${error.message || 'Failed to process quantum transmission'}`,
      debug: {
        error: error.message,
        type: error.type,
        contentType: req.get('content-type'),
        rawBody: req.rawBody ? req.rawBody.toString().substring(0, 100) : null
      }
    });
  }
});

// Test routes
app.get('/', (req, res) => {
  res.status(200).send('NEXUS: Quantum bridge operational');
});

app.get('/webhook', (req, res) => {
  res.status(200).send('NEXUS: Quantum webhook endpoint operational');
});

app.get('/ping', (req, res) => {
  res.status(200).send('NEXUS: Quantum bridge active');
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
        console.log('NEXUS: Quantum bridge stability maintained');
      } else {
        console.error('PARADOX: Keep-alive check failed');
      }
    } catch (error) {
      console.error('PARADOX: Keep-alive error:', error);
    }
  }, PING_INTERVAL);
}

// Initialize Express server
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`NEXUS: Quantum webhook bridge operational on port ${PORT}`);
  startKeepAlive();
}).on('error', (error) => {
  console.error('PARADOX: Server initialization error:', error);
  process.exit(1);
});

// Error handlers
client.on('error', error => {
  console.error('PARADOX: Discord client error:', error);
});

process.on('unhandledRejection', error => {
  console.error('PARADOX: Unhandled quantum anomaly:', error);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('CIPHER: Initiating quantum shutdown sequence');
  
  if (pingTimer) {
    clearInterval(pingTimer);
  }
  
  server.close(() => {
    console.log('NEXUS: Express server closed');
    client.destroy();
    console.log('NEXUS: Discord client destroyed');
    console.log('NEXUS: Quantum bridges closed');
    process.exit(0);
  });
});

// Login
client.login(process.env.DISCORD_TOKEN).catch(error => {
  console.error('PARADOX: Login error:', error);
  process.exit(1);
});

