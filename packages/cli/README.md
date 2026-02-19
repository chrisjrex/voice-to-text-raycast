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

## Commands

### Transcribe

Record and transcribe speech to text:

```bash
# Basic usage
voicekit transcribe

# Auto-stop after 15 seconds of silence
voicekit transcribe --silence-timeout 15

# Transcribe existing audio file
voicekit transcribe --input recording.wav

# Output just the text
voicekit transcribe --format raw

# Save to file
voicekit transcribe -o meeting.txt
```

### Speak

Convert text to speech:

```bash
# Speak text
voicekit speak "Hello world"

# Use specific voice
voicekit speak -v Heart "Hello world"
voicekit speak -v Samantha "Hello world"

# Control speed (0.5x - 2.0x)
voicekit speak --speed 1.5 "Fast speech"

# Read from file
voicekit speak -f document.txt

# Pipe from stdin
echo "Hello world" | voicekit speak
cat document.txt | voicekit speak -v Heart

# Save to file instead of playing
voicekit speak "Hello" -o output.wav
```

### Manage Models

```bash
# List all STT models
voicekit models list

# Download a model
voicekit models download whisper-tiny
voicekit models download parakeet-110m

# Delete a model
voicekit models delete whisper-tiny
```

### Manage Voices

```bash
# List all TTS voices
voicekit voices list

# Download a voice
voicekit voices download Heart
voicekit voices download Amy

# Preview a voice
voicekit voices preview Heart

# Delete a voice
voicekit voices delete Heart
```

### Server (Kokoro)

Start background server for faster TTS:

```bash
# Start server
voicekit server start

# Check status
voicekit server status

# Stop server
voicekit server stop
```

### Doctor

Check system health:

```bash
# Full health check
voicekit doctor

# JSON output for scripting
voicekit doctor --json
```

### Help

```bash
# Quick help
voicekit --help

# Comprehensive documentation
voicekit help-all

# Command-specific help
voicekit transcribe --help
voicekit speak --help
```

## Configuration

### Environment Variables

Override bundled runtime with custom paths:

```bash
# Use custom Python (e.g., via uv, pyenv, conda)
export VOICEKIT_PYTHON_PATH="$HOME/.local/share/voicekit/venv/bin/python"

# Use custom sox
export VOICEKIT_SOX_PATH="/opt/homebrew/bin/sox"

# Set default model/voice
export VOICEKIT_DEFAULT_STT_MODEL=parakeet-110m
export VOICEKIT_DEFAULT_TTS_VOICE=Heart

# Data directory
export VOICEKIT_DATA_DIR="$HOME/.local/share/voicekit"

# HuggingFace token for higher rate limits (also respects HF_TOKEN)
export VOICEKIT_HF_TOKEN="your_hf_token"
```

**Note:** Environment variables take precedence over bundled runtime.

### Using with Python Version Managers

While the bundled runtime works out-of-the-box, you can use your own Python setup:

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

## Available Models

### Whisper (multilingual)

| Model | Size | Speed | Best For |
|-------|------|-------|----------|
| whisper-tiny | ~75MB | Fastest | Quick drafts |
| whisper-small | ~500MB | Fast | Good accuracy |
| whisper-large | ~1.6GB | Slow | Best multilingual |

### Parakeet (English only)

| Model | Size | Speed | Best For |
|-------|------|-------|----------|
| parakeet-110m | ~220MB | Fastest | Real-time |
| parakeet-0.6b | ~1.2GB | Fast | Good accuracy |
| parakeet-1.1b | ~2.2GB | Medium | Best English |

## Available Voices

### System Voices (built-in, no download)

Samantha, Alex, Daniel, Karen, Moira, Tessa, Fiona, Veena

### Piper Voices (~60MB each)

Amy, Lessac, Ryan, Alba, Alan

### Kokoro Voices (~500KB each + ~300MB shared model)

Heart, Alloy, Bella, Jessica, Nicole, Nova, River, Sarah, Sky, Adam, Echo, Eric, Liam, Michael, Onyx, Alice, Emma, Lily, Daniel, George, Lewis

## File Locations

- **Runtime**: `~/.local/share/voicekit/runtime/` (bundled Python + packages)
- **Data**: `~/.local/share/voicekit/` (models, voices, recordings)
- **Models**: `~/.cache/huggingface/hub/`
- **Config**: Environment variables only (no config file)

## Speed Control

All voices support speed adjustment:

```bash
voicekit speak --speed 0.8 "Slow speech"    # 80% speed
voicekit speak --speed 1.5 "Fast speech"    # 150% speed
```

Valid range: 0.5x to 2.0x

## Piping and Scripting

```bash
# Transcribe and save
voicekit transcribe --format raw > transcription.txt

# Transcribe and process
voicekit transcribe --format json | jq -r '.text' | grep "keyword"

# Speak in scripts
if voicekit speak "Warning!" -v Samantha; then
    echo "Alert spoken"
fi

# Check health in scripts
if voicekit doctor --json | jq -e '.engines.whisper.available' > /dev/null; then
    echo "Whisper is ready"
fi
```

## Troubleshooting

**Issue:** Command not found after installation
- **Solution:** Ensure npm global bin is in PATH: `export PATH="$PATH:$(npm config get prefix)/bin"`

**Issue:** Permission errors
- **Solution:** Fix data directory permissions: `chmod -R 755 ~/.local/share/voicekit`

**Issue:** Daemon not visible in Activity Monitor (when using custom Python)
- **Solution:** Install setproctitle: `pip3 install setproctitle`

**Issue:** Want to use system Python instead of bundled
- **Solution:** Set `VOICEKIT_PYTHON_PATH` environment variable

**Issue:** Switch from bundled to lite version
- **Solution:** 
  ```bash
  npm uninstall -g @voicekit/cli
  npm install -g @voicekit/cli-lite
  # Then install prerequisites (see cli-lite README)
  ```

## Comparison

| Feature | Install Script | NPM Package | @voicekit/cli-lite |
|---------|---------------|-------------|-------------------|
| **Download Size** | ~300MB | ~36KB | ~500KB |
| **Setup Time** | 2-3 minutes | Instant* | 10-15 minutes |
| **Dependencies** | Node.js only | Python 3.10+, sox | Python 3.10+, sox |
| **Python Version** | Bundled 3.11 | System Python | Your choice (3.10+) |
| **Disk Usage** | ~1.1GB | Shared with system | ~50MB (shared) |
| **Best For** | Quick start, no setup | Developers with Python | Custom setups |

\* After npm install, run `voicekit doctor` to check Python dependencies

## Uninstalling

### Install Script Installation

```bash
rm -rf ~/.local/share/voicekit/
rm -f ~/.local/bin/voicekit
```

### NPM Installation

```bash
npm uninstall -g @voicekit/cli

# Remove data directory (optional)
rm -rf ~/.cache/VoiceKit/
```

### Homebrew

```bash
brew uninstall voicekit
```

## License

MIT

## Contributing

See the [main repository](https://github.com/chrisjrex/voice-to-text-raycast) for contribution guidelines.
