# VoiceKit CLI

VoiceKit CLI tool for local speech recognition and synthesis. Works offline using Apple MLX.

## Features

- **Speech-to-Text**: Local transcription using Whisper or Parakeet
- **Text-to-Speech**: Multiple voice engines (System, Piper, Kokoro)
- **Offline**: Works completely offline after installation
- **Fast**: Apple Silicon optimized via MLX
- **Private**: All processing happens locally

## Installation

### Option 1: Install Script (Bundled Runtime)

**Recommended** - Includes Python 3.11 and all dependencies:

```bash
curl -sSL https://raw.githubusercontent.com/chrisjrex/voice-to-text-raycast/main/scripts/install.sh | bash
```

Or download and run manually:

```bash
curl -sSL -o install-voicekit.sh https://raw.githubusercontent.com/chrisjrex/voice-to-text-raycast/main/scripts/install.sh
chmod +x install-voicekit.sh
./install-voicekit.sh
```

This installs to `~/.local/` and includes a bundled Python runtime.

### Option 2: NPM (System Python)

If you already have Python 3.10+ and sox installed:

```bash
npm install -g @voicekit/cli
```

**Prerequisites:**
```bash
brew install python sox
```

### Option 3: Homebrew

```bash
brew tap chrisjrex/voicekit
brew install voicekit
```

## Quick Start

```bash
# Check installation
voicekit doctor

# List available models and voices
voicekit models list
voicekit voices list

# Download a speech-to-text model
voicekit models download whisper-tiny

# Download a text-to-speech voice
voicekit voices download Heart

# Start transcribing (Ctrl+C to stop)
voicekit transcribe

# Read text aloud
voicekit speak "Hello world" -v Heart
```

## Documentation

For complete documentation, see the [docs](../../docs/) directory:

- [Quick Start](../../docs/quickstart.md) - Get up and running in minutes
- [Installation Guide](../../docs/installation.md) - Detailed installation instructions
- [Configuration](../../docs/configuration.md) - Environment variables and customization
- [Usage Guide](../../docs/usage.md) - Complete command reference
- [Troubleshooting](../../docs/help/troubleshooting.md) - Common issues and solutions
- [Comparison](../../docs/help/comparison.md) - Compare installation methods

### Feature Documentation
- [Transcribe](../../docs/features/transcribe.md) - Speech-to-text
- [Speak](../../docs/features/speak.md) - Text-to-speech
- [Models](../../docs/features/models.md) - Manage STT models
- [Voices](../../docs/features/voices.md) - Manage TTS voices
- [Server](../../docs/features/server.md) - Background server

### Reference
- [Available Models](../../docs/reference/models.md) - Complete model list
- [Available Voices](../../docs/reference/voices.md) - Complete voice list
- [Environment Variables](../../docs/reference/environment.md) - All config options
- [File Locations](../../docs/reference/files.md) - Where data is stored
- [Speed Control](../../docs/reference/speed.md) - Adjusting speech speed
- [Piping & Scripting](../../docs/reference/scripting.md) - Using in scripts

## License

MIT

## Contributing

See the [main repository](https://github.com/chrisjrex/voice-to-text-raycast) for contribution guidelines.
