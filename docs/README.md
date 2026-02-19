# VoiceKit Documentation

Complete documentation for VoiceKit CLI tools for local speech recognition and synthesis.

## Table of Contents

### Getting Started
- [Quick Start](quickstart.md) - Get up and running in minutes
- [Installation Guide](installation.md) - Detailed installation instructions for all methods
- [Configuration](configuration.md) - Environment variables and customization

### Features
- [Speech-to-Text](features/transcribe.md) - Transcribe audio to text
- [Text-to-Speech](features/speak.md) - Convert text to spoken audio
- [Model Management](features/models.md) - Download and manage STT models
- [Voice Management](features/voices.md) - Download and manage TTS voices
- [Server Mode](features/server.md) - Background server for faster TTS

### Reference
- [Available Models](reference/models.md) - Complete list of STT models
- [Available Voices](reference/voices.md) - Complete list of TTS voices
- [Environment Variables](reference/environment.md) - All configuration options
- [File Locations](reference/files.md) - Where data is stored
- [Speed Control](reference/speed.md) - Adjusting speech speed
- [Piping & Scripting](reference/scripting.md) - Using VoiceKit in scripts

### Help
- [Troubleshooting](help/troubleshooting.md) - Common issues and solutions
- [Comparison](help/comparison.md) - Compare different installation methods
- [Uninstalling](help/uninstalling.md) - How to remove VoiceKit

### Full Guide
- [Complete Usage Guide](usage.md) - All documentation in one file

---

## Quick Links

**Installation Methods:**
- [Install Script (Recommended)](installation.md#install-script) - Bundled runtime, zero setup
- [NPM Package](installation.md#npm-package) - For developers with Python
- [Homebrew](installation.md#homebrew) - macOS package manager
- [CLI Lite](installation.md#cli-lite) - Lightweight version

**Common Commands:**
```bash
voicekit doctor          # Check system health
voicekit models list     # List STT models
voicekit voices list     # List TTS voices
voicekit transcribe      # Start transcribing
voicekit speak "Hello"   # Text to speech
```

## License

MIT - See the [main repository](https://github.com/chrisjrex/voice-to-text-raycast) for contribution guidelines.
