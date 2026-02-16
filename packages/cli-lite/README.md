# VTT CLI Lite

Lightweight version of the Voice-to-Text CLI tool. This version requires manual installation of system dependencies.

> **Want zero setup?** Use [`@vtt/cli`](https://www.npmjs.com/package/@vtt/cli) instead - it includes everything bundled.

## Prerequisites

Before installing vtt-lite, ensure you have:

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

### 4. Kokoro TTS Setup (Optional)

Kokoro requires Python 3.10-3.12 due to spacy/blis dependencies. If your system Python is newer, create an isolated environment:

```bash
# Create separate venv for Kokoro
python3.11 -m venv ~/.local/lib-kokoro/venv
~/.local/lib-kokoro/venv/bin/pip install kokoro soundfile numpy

# Configure VTT to use it
export VTT_KOKORO_PYTHON_PATH="$HOME/.local/lib-kokoro/venv/bin/python3"
```

Add to your `~/.zshrc` or `~/.bash_profile` to make it permanent.

### 5. Verify Installation

```bash
vtt doctor
```

This checks all dependencies and shows what's installed.

---

## Installation

Once prerequisites are met:

```bash
npm install -g @vtt/cli-lite
```

Or via Homebrew:

```bash
brew tap chrisjrex/vtt
brew install vtt-lite
```

---

## Configuration

### Environment Variables

Override default paths if needed:

```bash
# Main Python for STT and Piper TTS
export VTT_PYTHON_PATH=/opt/homebrew/bin/python3

# Separate Python for Kokoro (if using venv)
export VTT_KOKORO_PYTHON_PATH="$HOME/.local/lib-kokoro/venv/bin/python3"

# Sox binary path
export VTT_SOX_PATH=/opt/homebrew/bin/sox

# Data directory for models and voices
export VTT_DATA_DIR="$HOME/.local/share/vtt"

# Default STT model
export VTT_DEFAULT_STT_MODEL=whisper-tiny

# Default TTS voice
export VTT_DEFAULT_TTS_VOICE=Samantha
```

### Using Python Version Managers

VTT-lite works with any Python version manager. Set `VTT_PYTHON_PATH` to your managed environment:

**With `uv`:**
```bash
uv python install 3.11
uv venv ~/.local/share/vtt/venv --python 3.11
source ~/.local/share/vtt/venv/bin/activate
pip install mlx-whisper parakeet-mlx piper-tts kokoro
export VTT_PYTHON_PATH="$HOME/.local/share/vtt/venv/bin/python"
```

**With `pyenv`:**
```bash
pyenv install 3.11.9
pyenv virtualenv 3.11.9 vtt
pyenv activate vtt
pip install mlx-whisper parakeet-mlx piper-tts kokoro
export VTT_PYTHON_PATH="$HOME/.pyenv/versions/vtt/bin/python"
```

---

## Quick Start

```bash
# List available models and voices
vtt models list
vtt voices list

# Download a model
vtt models download whisper-tiny

# Download a voice
vtt voices download Heart

# Start transcribing
vtt transcribe

# Read text aloud
vtt speak "Hello world" -v Heart
```

---

## Commands

See the [full CLI documentation](https://github.com/chrisjrex/voice-to-text-raycast/blob/main/packages/cli/README.md) for all commands and options.

Common commands:
- `vtt transcribe` - Record and transcribe speech
- `vtt speak [text]` - Text-to-speech
- `vtt models list/download/delete` - Manage STT models
- `vtt voices list/download/delete` - Manage TTS voices
- `vtt doctor` - Check system health
- `vtt help-all` - Show comprehensive help

---

## Troubleshooting

**Issue:** `vtt doctor` shows missing dependencies
- **Solution:** Install prerequisites listed above

**Issue:** Kokoro voice download fails
- **Solution:** Ensure `VTT_KOKORO_PYTHON_PATH` points to Python 3.10-3.12

**Issue:** Permission denied errors
- **Solution:** Ensure data directory is writable: `mkdir -p ~/.local/share/vtt`

**Issue:** Want to switch from lite to bundled version
- **Solution:** `npm uninstall -g @vtt/cli-lite && npm install -g @vtt/cli`

---

## Differences from @vtt/cli

| Feature | @vtt/cli-lite | @vtt/cli |
|---------|---------------|----------|
| **Size** | ~500KB | ~50MB |
| **Setup** | Manual dependencies | Zero setup |
| **Python version** | Your choice | Bundled 3.11 |
| **Best for** | Developers, custom setups | Quick start |

---

## Uninstalling

```bash
npm uninstall -g @vtt/cli-lite

# Optional: Remove data directory
rm -rf ~/.local/share/vtt/
```

For Homebrew:
```bash
brew uninstall vtt-lite
```

---

## License

MIT
