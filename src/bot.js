require('dotenv').config();
const tmi = require('tmi.js');

const client = new tmi.Client({
  options: { debug: true },
  identity: {
    username: process.env.TWITCH_USERNAME,
    password: process.env.TWITCH_OAUTH,
  },
  channels: [process.env.TWITCH_CHANNEL]
});

client.connect().catch(console.error);

client.on('message', (channel, tags, message, self) => {
  if (self) return;

  const msg = message.toLowerCase();
  const user = tags['display-name'];

  if (msg === '!hello') {
    client.say(channel, `Hey ${user}!`);
  }
});