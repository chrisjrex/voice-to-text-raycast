# VoiceKit CLI Lite

Lightweight version of the VoiceKit CLI tool. This version requires manual installation of system dependencies.

> **Want zero setup?** Use [`@voicekit/cli`](https://www.npmjs.com/package/@voicekit/cli) instead - it includes everything bundled.

## Prerequisites

Before installing voicekit-lite, ensure you have:

### 1. System Requirements
- **macOS** with Apple Silicon (M1 or later)
- **Homebrew** installed ([install guide](https://brew.sh))

### 2. Install Core Dependencies

```bash
# Audio recording (required for dictation)
brew install sox

# Python 3.11 (recommended for compatibility)
brew install python@3.11
```

### 3. Install Python Packages

Choose the features you need:

**Speech-to-Text** (pick one or both):
```bash
# Multilingual support
pip3 install mlx-whisper

# English-only, generally faster
pip3 install parakeet-mlx
```

**Text-to-Speech** (optional):
```bash
# Lightweight TTS engine
pip3 install piper-tts

# For Kokoro (best quality) - requires Python 3.10-3.12
# See Kokoro setup section below
```

**Background Daemon** (for Activity Monitor visibility):
```bash
pip3 install setproctitle
```

### 4. Kokoro TTS Setup (Optional)

Kokoro requires Python 3.10-3.12 due to spacy/blis dependencies. If your system Python is newer, create an isolated environment:

```bash
# Create separate venv for Kokoro
python3.11 -m venv ~/.local/lib-kokoro/venv
~/.local/lib-kokoro/venv/bin/pip install kokoro soundfile numpy

# Configure VoiceKit to use it
export VOICEKIT_KOKORO_PYTHON_PATH="$HOME/.local/lib-kokoro/venv/bin/python3"
```

Add to your `~/.zshrc` or `~/.bash_profile` to make it permanent.

### 5. Verify Installation

```bash
voicekit doctor
```

This checks all dependencies and shows what's installed.

---

## Installation

Once prerequisites are met:

```bash
npm install -g @voicekit/cli-lite
```

Or via Homebrew:

```bash
brew tap chrisjrex/voicekit
brew install voicekit-lite
```

---

## Quick Start

```bash
# List available models and voices
voicekit models list
voicekit voices list

# Download a model
voicekit models download whisper-tiny

# Download a voice
voicekit voices download Heart

# Start transcribing
voicekit transcribe

# Read text aloud
voicekit speak "Hello world" -v Heart
```

---

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

---

## Differences from @voicekit/cli

| Feature | @voicekit/cli-lite | @voicekit/cli |
|---------|-------------------|---------------|
| **Size** | ~500KB | ~50MB |
| **Setup** | Manual dependencies | Zero setup |
| **Python version** | Your choice | Bundled 3.11 |
| **Best for** | Developers, custom setups | Quick start |

---

## Uninstalling

```bash
npm uninstall -g @voicekit/cli-lite

# Optional: Remove data directory
rm -rf ~/.local/share/voicekit/
```

For Homebrew:
```bash
brew uninstall voicekit-lite
```

For complete uninstall instructions, see [Uninstalling](../../docs/help/uninstalling.md).

---

## License

MIT
