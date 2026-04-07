require('dotenv').config();
const tmi = require('tmi.js');
const fs = require('fs');
const path = require('path');

const LISTENER_URL = process.env.LISTENER_URL || 'http://10.0.0.22:3000';
const KEYWORDS_FILE = process.env.KEYWORDS_FILE || '/data/keywords.json';

const client = new tmi.Client({
  options: { debug: true },
  identity: {
    username: process.env.TWITCH_USERNAME,
    password: process.env.TWITCH_OAUTH,
  },
  channels: [process.env.TWITCH_CHANNEL]
});

client.connect().catch(console.error);

const isMod = (tags) => tags.mod || tags['user-type'] === 'mod' || tags.badges?.broadcaster;

// --- Keywords config ---

function loadKeywords() {
  try {
    if (!fs.existsSync(KEYWORDS_FILE)) return {};
    return JSON.parse(fs.readFileSync(KEYWORDS_FILE, 'utf8'));
  } catch (err) {
    console.log(`Error loading keywords: ${err.message}`);
    return {};
  }
}

function saveKeywords(keywords) {
  try {
    fs.mkdirSync(path.dirname(KEYWORDS_FILE), { recursive: true });
    fs.writeFileSync(KEYWORDS_FILE, JSON.stringify(keywords, null, 2));
  } catch (err) {
    console.log(`Error saving keywords: ${err.message}`);
  }
}

let keywords = loadKeywords();
const lastTriggered = {};

// --- Listener helper ---

async function sendToListener(endpoint, body) {
  try {
    const res = await fetch(`${LISTENER_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error || `HTTP ${res.status}` };
    return { ok: true, ...data };
  } catch (err) {
    return { ok: false, error: 'Could not reach stream PC' };
  }
}

// --- Message handler ---

client.on('message', async (channel, tags, message, self) => {
  if (self) return;

  const msg = message.trim();
  const msgLower = msg.toLowerCase();
  const user = tags['display-name'];
  const mod = isMod(tags);

  // !hello
  if (msgLower === '!hello') {
    client.say(channel, `Hey ${user}!`);
  }

  // !song — everyone
  if (msgLower === '!song') {
    const result = await sendToListener('/media', { action: 'song' });
    if (!result.ok) {
      client.say(channel, `@${user} Could not get current song: ${result.error}`);
    } else if (result.nothing) {
      client.say(channel, `Nothing is playing @${user}`);
    } else if (result.song) {
      client.say(channel, `Now playing: ${result.song}`);
    }
  }

  // !sound <n> — mod only
  if (msgLower.startsWith('!sound ') && mod) {
    const soundName = msgLower.split(' ')[1];
    const result = await sendToListener('/sound', { sound: soundName });
    if (!result.ok) {
      client.say(channel, `@${user} Could not play sound "${soundName}": ${result.error}`);
    }
  }

  // !scene <n> — mod only
  if (msgLower.startsWith('!scene ') && mod) {
    const sceneName = msg.split(' ').slice(1).join(' ');
    const result = await sendToListener('/scene', { scene: sceneName });
    if (!result.ok) {
      client.say(channel, `@${user} Could not switch scene: ${result.error}`);
    }
  }

  // !source <n> <on|off> — mod only
  if (msgLower.startsWith('!source ') && mod) {
    const parts = msgLower.split(' ');
    const sourceName = parts[1];
    if (!parts[2] || !['on', 'off'].includes(parts[2])) {
      client.say(channel, `@${user} Usage: !source <name> <on|off>`);
      return;
    }
    const visible = parts[2] === 'on';
    const result = await sendToListener('/source', { source: sourceName, visible });
    if (!result.ok) {
      client.say(channel, `@${user} Could not toggle source: ${result.error}`);
    }
  }

  // !run <scriptname> — mod only
  if (msgLower.startsWith('!run ') && mod) {
    const scriptName = msgLower.split(' ')[1];
    const result = await sendToListener('/run', { script: scriptName });
    if (!result.ok) {
      client.say(channel, `@${user} Could not run script: ${result.error}`);
    }
  }

  // Media controls — mod only
  if ((msgLower === '!play' || msgLower === '!pause') && mod) {
    const result = await sendToListener('/media', { action: 'playpause' });
    if (!result.ok) client.say(channel, `@${user} Could not control media: ${result.error}`);
  }

  if ((msgLower === '!skip' || msgLower === '!next') && mod) {
    const result = await sendToListener('/media', { action: 'next' });
    if (!result.ok) client.say(channel, `@${user} Could not skip track: ${result.error}`);
  }

  if ((msgLower === '!prev' || msgLower === '!previous') && mod) {
    const result = await sendToListener('/media', { action: 'prev' });
    if (!result.ok) client.say(channel, `@${user} Could not go to previous track: ${result.error}`);
  }

  // --- Keyword management — mod only ---

  // !add <keyword> <sound> <exact|any>
  if (msgLower.startsWith('!add ') && mod) {
    const parts = msg.split(' ');
    if (parts.length < 4) {
      client.say(channel, `@${user} Usage: !add <keyword> <sound> <exact|any>`);
      return;
    }
    const keyword = parts[1].toLowerCase();
    const sound = parts[2];
    const matchType = parts[3].toLowerCase();
    if (!['exact', 'any'].includes(matchType)) {
      client.say(channel, `@${user} Match type must be "exact" or "any"`);
      return;
    }
    keywords[keyword] = { sound, exact: matchType === 'exact', cooldown: 30 };
    saveKeywords(keywords);
    client.say(channel, `@${user} Added keyword "${keyword}" → plays "${sound}.mp3" (${matchType} match, 30s cooldown)`);
  }

  // !remove <keyword>
  if (msgLower.startsWith('!remove ') && mod) {
    const keyword = msg.split(' ')[1]?.toLowerCase();
    if (!keyword) {
      client.say(channel, `@${user} Usage: !remove <keyword>`);
      return;
    }
    if (!keywords[keyword]) {
      client.say(channel, `@${user} Keyword "${keyword}" doesn't exist`);
      return;
    }
    delete keywords[keyword];
    saveKeywords(keywords);
    client.say(channel, `@${user} Removed keyword "${keyword}"`);
  }

  // !cd <keyword> <seconds>
  if (msgLower.startsWith('!cd ') && mod) {
    const parts = msg.split(' ');
    if (parts.length < 3) {
      client.say(channel, `@${user} Usage: !cd <keyword> <seconds>`);
      return;
    }
    const keyword = parts[1].toLowerCase();
    const seconds = parseInt(parts[2]);
    if (!keywords[keyword]) {
      client.say(channel, `@${user} Keyword "${keyword}" doesn't exist`);
      return;
    }
    if (isNaN(seconds) || seconds < 0) {
      client.say(channel, `@${user} Cooldown must be a number of seconds`);
      return;
    }
    keywords[keyword].cooldown = seconds;
    saveKeywords(keywords);
    client.say(channel, `@${user} Set cooldown for "${keyword}" to ${seconds}s`);
  }

  // !keywords — lists all keywords
  if (msgLower === '!keywords' && mod) {
    const list = Object.entries(keywords)
      .map(([kw, cfg]) => `"${kw}" → ${cfg.sound} (${cfg.exact ? 'exact' : 'any'}, ${cfg.cooldown}s)`)
      .join(' | ');
    client.say(channel, list.length ? `Keywords: ${list}` : 'No keywords set');
  }

  // --- Keyword matching — everyone ---
  const now = Date.now();
  for (const [keyword, cfg] of Object.entries(keywords)) {
    const cooldownMs = (cfg.cooldown || 30) * 1000;
    const lastTime = lastTriggered[keyword] || 0;
    if (now - lastTime < cooldownMs) continue;

    const matched = cfg.exact
      ? msgLower.split(/\s+/).includes(keyword)
      : msgLower.includes(keyword);

    if (matched) {
      lastTriggered[keyword] = now;
      const result = await sendToListener('/sound', { sound: cfg.sound });
      if (!result.ok) console.log(`Keyword sound error for "${keyword}": ${result.error}`);
    }
  }
});

client.on('subscription', (channel, username) => {
  client.say(channel, `Thanks for subscribing, ${username}! PogChamp`);
  sendToListener('/sound', { sound: 'sub' });
});

client.on('raided', (channel, username, viewers) => {
  client.say(channel, `Welcome in ${username} and your ${viewers} raiders!`);
  sendToListener('/sound', { sound: 'raid' });
});