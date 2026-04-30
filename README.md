# cha0s_b0t

A custom Twitch bot for [Cha0s_1nc](https://twitch.tv/cha0s_1nc) built with Node.js and tmi.js. Runs via Docker with automatic updates through Watchtower. Communicates with the **cha0s_listener** companion app for OBS and Jellyfin integration.

---

## Features

- OBS scene and source control from Twitch chat
- Jellyfin media controls and now playing info
- Dynamic keyword-to-sound triggers with cooldowns
- Sub and raid event responses
- Script execution on the stream PC
- Mod-only command protection

---

## Setup

### Prerequisites

- Docker and Docker Compose
- A Twitch account for the bot
- [cha0s_listener](https://github.com/Cha0s1nc/cha0s_listener) running on your stream PC

### Configuration

Create a `.env` file in the project root:

```env
TWITCH_USERNAME=your_bot_username
TWITCH_CHANNEL=your_channel_name
TWITCH_OAUTH=oauth:your_token_here
LISTENER_URL=http://x.x.x.x:3000
KEYWORDS_FILE=/data/keywords.json
```
  
> `LISTENER_URL` should point to the IP of the machine running cha0s_listener

### Running

```bash
docker compose up -d
```

The bot will connect to your Twitch channel automatically. Watchtower will pull and restart the container whenever a new image is pushed to the registry.

---

## Commands

### General — Everyone

| Command | Description |
|---------|-------------|
| `!hello` | Bot greets you by name |
| `!song` | Shows the currently playing track from Jellyfin |

---

### Media Controls — Mods Only - Jellyfin Usage Only

| Command | Description |
|---------|-------------|
| `!play` / `!pause` | Toggle play/pause on Jellyfin |
| `!skip` / `!next` | Skip to the next track |
| `!prev` / `!previous` | Go back to the previous track |

---

### OBS Controls — Mods Only

| Command | Description | Example |
|---------|-------------|---------|
| `!scene <name>` | Switch to an OBS scene | `!scene Gaming` |
| `!source <name> <on\|off>` | Toggle an OBS source visible or hidden | `!source webcam on` |

---

### Sound Controls — Mods Only

| Command | Description | Example |
|---------|-------------|---------|
| `!sound <name>` | Play a sound by name | `!sound airhorn` |

Sounds are served by the cha0s_listener app. Add sound files there.

---

### Script Execution — Mods Only

| Command | Description | Example |
|---------|-------------|---------|
| `!run <scriptname>` | Run a shell script on the stream PC | `!run lights_on` |

Scripts live in the `scripts/` folder of the cha0s_listener app as `.sh` files.

---

### Keyword Triggers — Mods Only

Keywords let you map words in chat to sounds that play automatically. Anyone in chat can trigger them once set up.

| Command | Description | Example |
|---------|-------------|---------|
| `!add <keyword> <sound> <exact\|any>` | Add a keyword trigger | `!add pog airhorn any` |
| `!remove <keyword>` | Remove a keyword trigger | `!remove pog` |
| `!cd <keyword> <seconds>` | Set cooldown on a keyword | `!cd pog 60` |
| `!keywords` | List all active keyword triggers | `!keywords` |

**Match types:**
- `exact` — the keyword must be a standalone word in the message (e.g. `pog` won't match `poggers`)
- `any` — the keyword matches anywhere in the message (e.g. `pog` will match `poggers`)

**Default cooldown:** 30 seconds per keyword

**Example setup:**
```
!add hype airhorn any
!add lol laugh exact
!cd hype 60
```

---

## Automatic Events

| Event | Response |
|-------|----------|
| New subscriber | Thanks them in chat, plays `sub` sound |
| Raid | Welcomes the raider and their viewers in chat, plays `raid` sound |

---

## Keyword Persistence

Keywords are saved to a JSON file at the path set in `KEYWORDS_FILE` (default `/data/keywords.json`). This file is mounted as a Docker volume so keywords persist across container restarts.

---

## Updating

The bot uses [Watchtower](https://containrrr.dev/watchtower/) to automatically update itself. When a new Docker image is pushed to the registry, Watchtower will pull and restart the container within 30 seconds. No manual intervention needed.

To manually force an update:

```bash
docker compose pull
docker compose up -d
```

---

## Related

- [cha0s_listener](https://github.com/Cha0s1nc/cha0s_listener) — Companion app for OBS and Jellyfin control with a live dashboard
