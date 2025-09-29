# Eoogle Discord Bot

A Discord bot that fetches user information from the ECSR API.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the root directory and add your Discord bot token:
```
DISCORD_TOKEN=your_bot_token_here
```

3. Run the bot:
```bash
node bot.js
```

## Features

- Displays user information including:
  - Username and display name
  - Description
  - Membership status with badges
  - Account creation date
  - Place visits and forum posts
  - Staff status
  - Username history
  - Avatar thumbnail

## Emojis

The bot uses the following emojis for status indicators:
- <:banned:1422001984055283902> - User is banned
- <:admin:1422001963893264454> - User is staff/admin
- <:verified:1422001945480134687> - User is verified
- <:OBC_Badge:1422001890878558280> - Outrageous Builders Club
- <:TBC_Badge:1422001881336516729> - Turbo Builders Club
- <:BC_Badge:1422001868120260718> - Builders Club
