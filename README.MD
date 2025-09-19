<div align="center">
  <img src="https://github.com/FwSchultz/assets/blob/main/bots/2KU77B0N3S/Logo.png" alt="logo" width="200" height="auto" />
  <h1>HLL-Qonzer-Server-Monitor</h1>
 
<!-- Badges -->
<p>
  <a href="https://github.com/2KU77B0N3S/HLL-Qonzer-Server-Monitor/graphs/contributors">
    <img src="https://img.shields.io/github/contributors/2KU77B0N3S/HLL-Qonzer-Server-Monitor" alt="contributors" />
  </a>
  <a href="">
    <img src="https://img.shields.io/github/last-commit/2KU77B0N3S/HLL-Qonzer-Server-Monitor" alt="last update" />
  </a>
  <a href="https://github.com/2KU77B0N3S/HLL-Qonzer-Server-Monitor/network/members">
    <img src="https://img.shields.io/github/forks/2KU77B0N3S/HLL-Qonzer-Server-Monitor" alt="forks" />
  </a>
  <a href="https://github.com/2KU77B0N3S/HLL-Qonzer-Server-Monitor/stargazers">
    <img src="https://img.shields.io/github/stars/2KU77B0N3S/HLL-Qonzer-Server-Monitor" alt="stars" />
  </a>
  <a href="https://github.com/2KU77B0N3S/HLL-Qonzer-Server-Monitor/issues/">
    <img src="https://img.shields.io/github/issues/2KU77B0N3S/HLL-Qonzer-Server-Monitor" alt="open issues" />
  </a>
  <a href="https://github.com/2KU77B0N3S/HLL-Qonzer-Server-Monitor/blob/master/LICENSE">
    <img src="https://img.shields.io/github/license/2KU77B0N3S/HLL-Qonzer-Server-Monitor.svg" alt="license" />
  </a>
</p>
  
<h4>
  <a href="https://github.com/2KU77B0N3S/HLL-Qonzer-Server-Monitor">Documentation</a>
  <span> · </span>
  <a href="https://github.com/2KU77B0N3S/HLL-Qonzer-Server-Monitor/issues/">Report Bug</a>
  <span> · </span>
  <a href="https://github.com/2KU77B0N3S/HLL-Qonzer-Server-Monitor/issues/">Request Feature</a>
</h4>
</div>
<br />

# Table of Contents
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Usage](#usage)
- [Configuration](#configuration)
- [Dependencies](#dependencies)
- [Notes](#notes)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)
- [Disclaimer](#disclaimer)

A Discord bot designed exclusively for Qonzer customers to monitor *Hell Let Loose* game server status.
The bot provides real-time updates on server ping, player count, map, and connection details, with a graphical ping history chart, refreshed every 15 seconds.

## Features
- Monitors up to three *Hell Let Loose* game servers.
- Displays server details (name, map, player count, ping, and connection info) in a Discord embed.
- Generates a line chart of ping history using Chart.js.
- Updates server status every 15 seconds.
- Supports scheduled daily restarts (optional, via environment variable).
- Color-coded ping indicators (green <100ms, yellow <200ms, red ≥200ms).
- Cleans up old messages in the Discord channel on startup.

## Prerequisites
- Node.js (v16 or higher)
- Discord bot token and channel ID
- Game server IP(s) and query port(s) of your Hell Let Loose Server
- A process manager like PM2 (recommended for production)

## Installation
1. **Clone the repository**:
   ```bash
   git clone https://github.com/2KU77B0N3S/HLL-Qonzer-Server-Monitor.git
   cd HLL-Qonzer-Server-Monitor
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   - Copy `.env.example` to `.env`:
     ```bash
     cp .env.example .env
     ```
   - Edit `.env` with your Discord bot token, channel ID, and game server details.

4. **Run the bot**:
   - For development:
     ```bash
     npm start
     ```
   - For production (using PM2):
     ```bash
     pm2 start main.mjs --name HLL-Qonzer-Server-Monitor
     ```

## Usage
- The bot logs into Discord and posts server status embeds to the specified channel.
- Each server’s embed includes:
  - Server name, map, player count, ping, and connection details.
  - A chart showing ping history (last 50 data points, ~12.5 minutes).
- Embeds are updated every 15 seconds.
- If `RESTART_TIME` is set, the bot restarts daily at the specified time (e.g., `4:00AM`).

## Configuration
- **Environment Variables** (in `.env`):
  - `DISCORD_TOKEN`: Your Discord bot token (required).
  - `CHANNEL_ID`: The Discord channel ID where embeds are posted (required).
  - `GAMESERVER_IP_1` and `GAMESERVER_QUERY_PORT_1`: IP and query port for the first server (required).
  - `GAMESERVER_IP_2` and `GAMESERVER_QUERY_PORT_2`: Optional second server.
  - `GAMESERVER_IP_3` and `GAMESERVER_QUERY_PORT_3`: Optional third server.
  - `RESTART_TIME`: Time for daily restart (e.g., `4:00AM` or `4:00PM`, optional).
- **Ping History**: Stores up to 50 data points per server (~12.5 minutes at 15s intervals).
- **Chart**: Generated using ChartJSNodeCanvas, saved as `pingchartX.png` for each server.

## Dependencies
- `discord.js`: For Discord bot functionality.
- `chartjs-node-canvas`: For rendering ping history charts.
- `node-fetch`: For querying server status from Qonzer API.
- `dotenv`: For environment variable management.
- `node-cron`: For scheduling daily restarts.

See `package.json` for full dependency list.

## Notes
- This bot is designed exclusively for Qonzer customers monitoring *Hell Let Loose* servers.
- The bot requires the `Guilds` and `GuildMessages` intents to function.
- For production, use a process manager like PM2 to handle crashes and restarts.

## Troubleshooting
- **Bot not posting**: Check `DISCORD_TOKEN` and `CHANNEL_ID` in `.env`. Ensure the bot has permissions in the Discord channel.
- **No server data**: Verify `GAMESERVER_IP_X` and `GAMESERVER_QUERY_PORT_X` values.
- **Chart issues**: Ensure `chartjs-node-canvas` dependencies are installed correctly (may require additional system libraries like `cairo`).
- **Restart not working**: Confirm `RESTART_TIME` format or use a process manager to handlle restarts.

## Contributing
This project is private and intended for Qonzer customers.
This is a Fan Project and not 

## License
MIT - For use by Qonzer customers only.

## Disclaimer
This is a fan-made project and is not officially affiliated with Qonzer or *Hell Let Loose*. It is provided as-is for community use, leveraging the Qonzer API for server monitoring.
If you want to support the project or me, buy a Gameserver at Qonzer [HERE](https://qonzer.com/aff.php?aff=55) - THX!
