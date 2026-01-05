# 🚀 9ROUTER

[![npm version](https://img.shields.io/npm/v/9router.svg)](https://www.npmjs.com/package/9router)
[![License](https://img.shields.io/npm/l/9router.svg)](https://github.com/yourusername/9router/blob/main/LICENSE)

AI endpoint proxy with web dashboard - A JavaScript port of [CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI).

![9Router Dashboard](https://github.com/decolua/9router/raw/main/images/9router.png)

## 📖 Introduction

**9Router** is a powerful AI API proxy server that provides unified access to multiple AI providers through a single endpoint. It features automatic format translation, intelligent fallback routing, OAuth authentication, and a modern web dashboard for easy management.

**Key Highlights:**
- **JavaScript Port**: Converted from [CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI) (Go) to JavaScript/Node.js for better accessibility and easier deployment
- **Universal CLI Support**: Works seamlessly with Claude Code, OpenAI Codex, Cline, RooCode, AmpCode, and other CLI tools
- **Cross-Platform**: Runs on Windows, Linux, and macOS
- **Easy Deployment**: Simple installation via npx, or deploy to VPS

## ✨ Features

### Core Features
- **🔄 Multi-Provider Support**: Unified endpoint for 15+ AI providers (Claude, OpenAI, Gemini, GitHub Copilot, Qwen, iFlow, DeepSeek, Kimi, MiniMax, GLM, etc.)
- **🔐 OAuth & API Key Authentication**: Supports both OAuth2 flow and API key authentication
- **🎯 Format Translation**: Automatic request/response translation between OpenAI, Claude, Gemini, Codex, and Ollama formats
- **🌐 Web Dashboard**: Beautiful React-based dashboard for managing providers, combos, API keys, and settings
- **📊 Usage Tracking**: Real-time monitoring and analytics for all API requests

### Advanced Features
- **🎲 Combo System**: Create model combos with automatic fallback support
- **♻️ Intelligent Fallback**: Automatic account rotation when rate limits or errors occur
- **⚡ Response Caching**: Optimized caching for Claude Code (1-hour cache vs default 5 minutes)
- **🔧 Model Aliases**: Create custom model aliases for easier management
- **🔍 WebSearch Hook**: Model-based web search integration for Claude Code CLI
- **☁️ Cloud Deployment**: Deploy to Cloud for Cursor IDE integration with global edge performance

### Format Support
- **OpenAI Format**: Standard OpenAI Chat Completions API
- **Claude Format**: Anthropic Messages API
- **Gemini Format**: Google Generative AI API
- **OpenAI Responses API**: Codex CLI format
- **Ollama Format**: Compatible with Ollama-based tools

### CLI Integration
- Works with: Claude Code, OpenAI Codex, Cline, RooCode, AmpCode, Cursor, and more
- Seamless integration with popular AI coding assistants
- WebSearch hook for enhanced Claude Code capabilities

## 📦 Install

```bash
# Run directly with npx (recommended)
npx 9router

# Or install globally
npm install -g 9router
9router
```

## 🚀 Quick Start

```bash
9router                    # Start server with default settings
9router --port 8080        # Custom port
9router --no-browser       # Don't open browser
9router --skip-update      # Skip auto-update check
9router --help             # Show help
```

**Dashboard**: `http://localhost:20128/dashboard`

## 💾 Data Location

User data stored at:
- macOS/Linux: `~/.9router/db.json`
- Windows: `%APPDATA%/9router/db.json`

## 🛠️ Development

### Setup
```bash
# Clone repository
git clone https://github.com/yourusername/9router.git
cd 9router

# Install dependencies
npm install

# Start development server
npm run dev
```

### Project Structure
```
9router/
├── bin/                    # CLI entry point
│   ├── cli.js             # Main CLI script
│   └── hooks/             # CLI hooks (WebSearch)
├── src/
│   ├── app/               # Next.js app (dashboard & API routes)
│   ├── lib/               # Core libraries (DB, OAuth, etc.)
│   ├── shared/            # Shared components & utilities
│   └── sse/               # SSE streaming handlers
├── open-sse/              # Core proxy engine (translator, handlers)
│   ├── translator/        # Format translators
│   ├── handlers/          # Request handlers
│   ├── services/          # Core services
│   └── config/            # Provider configurations
└── public/                # Static assets
```

## 📤 Build & Publish

```bash
# Build standalone binary
npm run build:standalone

# Test locally
npm link
9router --help

# Publish to npm
npm login
npm publish
```

## 🧰 Tech Stack

| Layer | Technology |
|-------|------------|
| **Runtime** | Node.js 20+ / Bun |
| **Framework** | Next.js 15 |
| **Dashboard** | React 19 + Tailwind CSS 4 |
| **Database** | LowDB (JSON file-based) |
| **CLI** | Node.js CLI with auto-update |
| **Streaming** | Server-Sent Events (SSE) |
| **Auth** | OAuth 2.0 (PKCE) + API Keys |
| **Deployment** | Standalone / VPS |
| **State Management** | Zustand |

### Core Libraries
- **lowdb**: Lightweight JSON database
- **undici**: High-performance HTTP client
- **uuid**: Unique identifier generation
- **open**: Cross-platform browser launcher

## 🙏 Acknowledgments

Special thanks to:

- **[CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI)**: The original Go implementation that inspired this project. 9Router is a JavaScript port with enhanced features and web dashboard.

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.
