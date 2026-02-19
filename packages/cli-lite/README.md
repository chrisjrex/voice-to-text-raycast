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

## Configuration

### Environment Variables

Override default paths if needed:

```bash
# Main Python for STT and Piper TTS
export VOICEKIT_PYTHON_PATH=/opt/homebrew/bin/python3

# Separate Python for Kokoro (if using venv)
export VOICEKIT_KOKORO_PYTHON_PATH="$HOME/.local/lib-kokoro/venv/bin/python3"

# Sox binary path
export VOICEKIT_SOX_PATH=/opt/homebrew/bin/sox

# Data directory for models and voices
export VOICEKIT_DATA_DIR="$HOME/.local/share/voicekit"

# Default STT model
export VOICEKIT_DEFAULT_STT_MODEL=whisper-tiny

# Default TTS voice
export VOICEKIT_DEFAULT_TTS_VOICE=Samantha

# HuggingFace token for higher rate limits (also respects HF_TOKEN)
export VOICEKIT_HF_TOKEN="your_hf_token"
```

### Using Python Version Managers

VoiceKit-lite works with any Python version manager. Set `VOICEKIT_PYTHON_PATH` to your managed environment:

**With `uv`:**
```bash
uv python install 3.11
uv venv ~/.local/share/voicekit/venv --python 3.11
source ~/.local/share/voicekit/venv/bin/activate
pip install mlx-whisper parakeet-mlx piper-tts kokoro
export VOICEKIT_PYTHON_PATH="$HOME/.local/share/voicekit/venv/bin/python"
```

**With `pyenv`:**
```bash
pyenv install 3.11.9
pyenv virtualenv 3.11.9 voicekit
pyenv activate voicekit
pip install mlx-whisper parakeet-mlx piper-tts kokoro
export VOICEKIT_PYTHON_PATH="$HOME/.pyenv/versions/voicekit/bin/python"
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

## Commands

See the [full CLI documentation](https://github.com/chrisjrex/voice-to-text-raycast/blob/main/packages/cli/README.md) for all commands and options.

Common commands:
- `voicekit transcribe` - Record and transcribe speech
- `voicekit speak [text]` - Text-to-speech
- `voicekit models list/download/delete` - Manage STT models
- `voicekit voices list/download/delete` - Manage TTS voices
- `voicekit doctor` - Check system health
- `voicekit help-all` - Show comprehensive help

---

## Troubleshooting

**Issue:** `voicekit doctor` shows missing dependencies
- **Solution:** Install prerequisites listed above

**Issue:** Daemon not visible in Activity Monitor
- **Solution:** Install setproctitle: `pip3 install setproctitle`

**Issue:** Kokoro voice download fails
- **Solution:** Ensure `VOICEKIT_KOKORO_PYTHON_PATH` points to Python 3.10-3.12

**Issue:** Permission denied errors
- **Solution:** Ensure data directory is writable: `mkdir -p ~/.local/share/voicekit`

**Issue:** Want to switch from lite to bundled version
- **Solution:** `npm uninstall -g @voicekit/cli-lite && npm install -g @voicekit/cli`

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

---

## License

MIT
