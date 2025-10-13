# 🔍 Eoogle

> **The open-source Discord bot that doesn't hide behind closed doors.**

Welcome to Eoogle – a Discord bot built with transparency and community at its core. While most bots keep their code locked away, we believe in doing things differently. Every line of code, every feature, and every update is here for you to explore, learn from, and contribute to.

## 🌟 Why Eoogle?

**Transparency First** - No black boxes, no secrets. See exactly how everything works.

**Community Driven** - Built by developers, for developers. Your contributions shape the future of Eoogle.

**GitHub Integration** - Seamlessly connect your Discord server with GitHub repositories, issues, and more.

**Always Evolving** - Regular updates, new features, and constant improvements driven by community feedback.

## ✨ Features

- 🔗 Seamless GitHub repository integration
- 📊 Real-time repository statistics and updates
- 🎯 Comprehensive command system
- 🚀 Fast and reliable performance
- 🛠️ Easy to customize and extend

## 🚀 Quick Start

### Prerequisites

Before you begin, make sure you have:

- **Node.js** (v16 or higher) - [Download here](https://nodejs.org/)
- **Git** - [Installation guide](https://git-scm.com/downloads)
- **Discord Bot Token** - [Create a bot](https://discord.com/developers/applications)
- **GitHub Personal Access Token** - [Generate token](https://github.com/settings/tokens)

### Installation Guide

Choose your operating system below:

<details>
<summary><b>🪟 Windows</b></summary>

1. **Open Command Prompt or PowerShell**
   - Press `Win + R`, type `cmd`, and hit Enter

2. **Clone the repository**
   ```bash
   git clone https://github.com/RevivalSearch/Eoogle.git
   cd Eoogle
   ```

3. **Set up environment variables**
   ```bash
   copy .env.example .env
   ```

4. **Configure your tokens**
   - Right-click `.env` → Open with Notepad
   - Add your credentials:
   ```env
   DISCORD_TOKEN=your_discord_bot_token_here
   GITHUB_TOKEN=your_github_token_here
   ```

5. **Install dependencies**
   ```bash
   npm install
   ```

6. **Launch Eoogle**
   ```bash
   npm start
   ```

</details>

<details>
<summary><b>🍎 macOS</b></summary>

1. **Open Terminal**
   - Press `Cmd + Space`, type `terminal`, and hit Enter

2. **Clone the repository**
   ```bash
   git clone https://github.com/RevivalSearch/Eoogle.git
   cd Eoogle
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```

4. **Configure your tokens**
   ```bash
   nano .env
   ```
   Or use TextEdit:
   ```bash
   open -a TextEdit .env
   ```
   
   Add your credentials:
   ```env
   DISCORD_TOKEN=your_discord_bot_token_here
   GITHUB_TOKEN=your_github_token_here
   ```
   
   Save and exit (in nano: `Ctrl + X`, then `Y`, then Enter)

5. **Install dependencies**
   ```bash
   npm install
   ```

6. **Launch Eoogle**
   ```bash
   npm start
   ```

</details>

<details>
<summary><b>🐧 Linux</b></summary>

1. **Open Terminal**
   - Usually `Ctrl + Alt + T`

2. **Clone the repository**
   ```bash
   git clone https://github.com/RevivalSearch/Eoogle.git
   cd Eoogle
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```

4. **Configure your tokens**
   ```bash
   nano .env
   ```
   Or use your preferred editor (vim, gedit, etc.)
   
   Add your credentials:
   ```env
   DISCORD_TOKEN=your_discord_bot_token_here
   GITHUB_TOKEN=your_github_token_here
   ```
   
   Save and exit (in nano: `Ctrl + X`, then `Y`, then Enter)

5. **Install dependencies**
   ```bash
   npm install
   ```

6. **Launch Eoogle**
   ```bash
   npm start
   ```

</details>

### ✅ Verification

If everything is set up correctly, you'll see Eoogle come online in your Discord server! 🎉

## 📖 Usage

Get started by running the help command in any server where Eoogle is installed:

```
e-help
```

This displays all available commands with descriptions and usage examples.

## 🐛 Troubleshooting

<details>
<summary><b>Bot won't start?</b></summary>

- Verify Node.js is installed: `node --version`
- Double-check your tokens in the `.env` file
- Ensure you ran `npm install` before starting
- Check for error messages in the console

</details>

<details>
<summary><b>Dependency issues?</b></summary>

- Delete the `node_modules` folder and `package-lock.json`
- Run `npm install` again
- Try clearing npm cache: `npm cache clean --force`

</details>

<details>
<summary><b>Bot is offline in Discord?</b></summary>

- Make sure your Discord bot token is valid
- Check that the bot has been invited to your server with proper permissions
- Verify your internet connection is stable

</details>

<details>
<summary><b>Still stuck?</b></summary>

[Open an issue](https://github.com/RevivalSearch/Eoogle/issues) on GitHub and we'll help you out!

</details>

## 🤝 Contributing

We love contributions! Here's how you can help make Eoogle better:

- 🐛 **Found a bug?** [Report it](https://github.com/RevivalSearch/Eoogle/issues/new)
- 💡 **Have an idea?** Share your feature suggestions
- 🔧 **Want to code?** Submit a pull request
- 📖 **Improve docs?** Documentation PRs are always welcome

Check out our [Contributing Guidelines](https://github.com/RevivalSearch/Eoogle/blob/main/CONTRIBUTING.md) to get started.

## 📄 License

This project is open source. See the [LICENSE](https://github.com/RevivalSearch/Eoogle/blob/main/LICENSE) file for details.

## 🔗 Important Links

- [📦 GitHub Repository](https://github.com/RevivalSearch/Eoogle)
- [🐛 Report Issues](https://github.com/RevivalSearch/Eoogle/issues)
- [💬 Discussions](https://github.com/RevivalSearch/Eoogle/discussions)

## ⭐ Show Your Support

If you find Eoogle useful, give it a star on GitHub! It helps others discover the project and motivates us to keep improving.

---

**Made with ❤️ by [RevivalSearch](https://github.com/RevivalSearch)**

*Because the best bots are the ones everyone can learn from.*
