require('dotenv').config();
const tmi = require('tmi.js');

const LISTENER_URL = process.env.LISTENER_URL || 'http://YOUR_LAPTOP_IP:3000';

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

client.on('message', async (channel, tags, message, self) => {
  if (self) return;

  const msg = message.toLowerCase().trim();
  const user = tags['display-name'];

  if (msg === '!hello') {
    client.say(channel, `Hey ${user}!`);
  }

  // !sound <soundname> — plays a sound on the stream PC
  // Anyone can use this, remove the isMod check if you want it open to all
  if (msg.startsWith('!sound ')) {
    const soundName = msg.split(' ')[1];
    try {
      const res = await fetch(`${LISTENER_URL}/sound`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sound: soundName })
      });
      if (!res.ok) {
        console.log(`Sound request failed: ${res.status}`);
      }
    } catch (err) {
      console.log(`Could not reach listener: ${err.message}`);
    }
  }

  // !scene <scenename> — switches OBS scene (mod only)
  if (msg.startsWith('!scene ') && isMod(tags)) {
    const sceneName = msg.split(' ').slice(1).join(' ');
    try {
      await fetch(`${LISTENER_URL}/scene`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scene: sceneName })
      });
    } catch (err) {
      console.log(`Could not reach listener: ${err.message}`);
    }
  }

  // !source <sourcename> <on|off> — toggles OBS source visibility (mod only)
  if (msg.startsWith('!source ') && isMod(tags)) {
    const parts = msg.split(' ');
    const sourceName = parts[1];
    const visible = parts[2] === 'on';
    try {
      await fetch(`${LISTENER_URL}/source`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: sourceName, visible })
      });
    } catch (err) {
      console.log(`Could not reach listener: ${err.message}`);
    }
  }

  // !run <scriptname> — runs a python script (mod only)
  if (msg.startsWith('!run ') && isMod(tags)) {
    const scriptName = msg.split(' ')[1];
    try {
      await fetch(`${LISTENER_URL}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: scriptName })
      });
    } catch (err) {
      console.log(`Could not reach listener: ${err.message}`);
    }
  }
});

client.on('subscription', (channel, username) => {
  client.say(channel, `Thanks for subscribing, ${username}! PogChamp`);
  // Auto play a sound on sub
  fetch(`${LISTENER_URL}/sound`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sound: 'sub' })
  }).catch(() => {});
});

client.on('raided', (channel, username, viewers) => {
  client.say(channel, `Welcome in ${username} and your ${viewers} raiders!`);
  fetch(`${LISTENER_URL}/sound`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sound: 'raid' })
  }).catch(() => {});
});