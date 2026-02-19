# Installation Guide

VTT (Voice-to-Text) offers multiple installation methods to suit different needs.

## Choose Your Installation

### Option 1: Install Script (Recommended) ⭐

**Best for:** Quick start, general users, anyone who wants it to "just work"

**What you get:**
- Bundled Python 3.11 runtime with all packages
- VTT CLI tool
- Everything extracted to `~/.local/`

**Install:**
```bash
curl -sSL https://raw.githubusercontent.com/chrisjrex/voice-to-text-raycast/main/scripts/install.sh | bash
```

**Or download and run manually:**
```bash
curl -sSL -o install-vtt.sh https://raw.githubusercontent.com/chrisjrex/voice-to-text-raycast/main/scripts/install.sh
chmod +x install-vtt.sh
./install-vtt.sh
```

**Size:** ~300MB download, ~1.1GB installed

---

### Option 2: NPM Package

**Best for:** Developers who already have Python 3.10+ installed

**What you get:**
- VTT CLI tool
- Uses your system Python and dependencies

**Prerequisites:**
```bash
brew install sox python@3.11
pip3 install mlx-whisper parakeet-mlx piper-tts kokoro
```

**Install:**
```bash
npm install -g @vtt/cli
```

**Size:** ~36KB download

---

### Option 3: Homebrew

**Best for:** Homebrew users

```bash
brew tap chrisjrex/vtt
brew install vtt
```

---

### Option 4: Lite Version (Advanced)

**Best for:** Minimalists, those who want full control over dependencies

**What you get:**
- VTT CLI tool only (~500KB)
- Uses your system Python and dependencies

**Prerequisites:**
```bash
# Install system dependencies
brew install sox python@3.11

# Install Python packages (pick what you need)
pip3 install mlx-whisper      # For multilingual STT
pip3 install parakeet-mlx     # For English-only STT (faster)
pip3 install piper-tts        # For lightweight TTS

# Required for background daemon visibility in Activity Monitor
pip3 install setproctitle

# For Kokoro TTS (optional, requires Python 3.10-3.12)
python3.11 -m venv ~/.local/lib-kokoro/venv
~/.local/lib-kokoro/venv/bin/pip install kokoro soundfile numpy
```

**Install via NPM:**
```bash
npm install -g @vtt/cli-lite
```

**Or via Homebrew:**
```bash
brew tap chrisjrex/vtt
brew install vtt-lite
```

**Size:** ~500KB download

---

## Quick Start

After installation:

```bash
# Verify installation
vtt doctor

# List available resources
vtt models list
vtt voices list

# Download a speech-to-text model
vtt models download whisper-tiny

# Download a text-to-speech voice
vtt voices download Heart

# Start using VTT
vtt transcribe          # Record and transcribe
vtt speak "Hello world" # Text-to-speech
```

---

## Comparison

| Feature | Install Script | NPM (`@vtt/cli`) | Lite (`@vtt/cli-lite`) |
|---------|---------------|------------------|----------------------|
| **Setup time** | 2-3 minutes | Instant* | 10-15 minutes |
| **Download size** | ~300MB | ~36KB | ~500KB |
| **Disk usage** | ~1.1GB | Shared with system | ~50MB (shared) |
| **Dependencies** | Node.js only | Python 3.10+, sox | Python 3.10+, sox, pip packages |
| **Python version** | Bundled 3.11 | System Python | Your choice (3.10+) |
| **Offline use** | ✅ Yes | ✅ Yes | ✅ Yes (after setup) |
| **Best for** | Quick start | Developers | Minimalists, custom setups |

\* After npm install, run `vtt doctor` to verify Python dependencies

---

## Switching Between Versions

```bash
# From install script to npm
rm -rf ~/.local/share/vtt ~/.local/bin/vtt
npm install -g @vtt/cli

# From npm to install script
npm uninstall -g @vtt/cli
# Then run install script

# Switch to lite version
npm uninstall -g @vtt/cli
npm install -g @vtt/cli-lite
# Then install prerequisites (see vtt doctor)
```

---

## Uninstalling

### Install Script Installation
```bash
rm -rf ~/.local/share/vtt
rm -f ~/.local/bin/vtt
```

### NPM Installation
```bash
npm uninstall -g @vtt/cli
# Remove data directory
rm -rf ~/.cache/VoiceToText/
```

### Lite Version
```bash
npm uninstall -g @vtt/cli-lite
# Remove data directory
rm -rf ~/.cache/VoiceToText/
```

### Homebrew (any version)
```bash
brew uninstall vtt     # or vtt-lite
brew untap chrisjrex/vtt  # Optional: remove tap
```

---

## System Requirements

- **macOS** 11.0 (Big Sur) or later
- **Apple Silicon** (M1/M2/M3) or Intel Mac
- **Node.js** 20+ (for NPM installation)
- **Homebrew** (for Homebrew installation)

---

## Troubleshooting

### "vtt: command not found"

**Install script:** Add to PATH:
```bash
export PATH="$HOME/.local/bin:$PATH"
```

**NPM:** Ensure npm global bin is in your PATH:
```bash
export PATH="$PATH:$(npm config get prefix)/bin"
```

### Permission errors

Fix data directory permissions:
```bash
chmod -R 755 ~/.local/share/vtt
# or
chmod -R 755 ~/.cache/VoiceToText/
```

### Missing Python packages (npm/lite versions only)

Install required packages:
```bash
pip3 install mlx-whisper parakeet-mlx piper-tts kokoro setproctitle
```

### Daemon not visible in Activity Monitor

Install setproctitle:
```bash
pip3 install setproctitle
```
Then restart the daemon: `vtt transcribe stop && vtt transcribe start`

### Check what's installed

```bash
vtt doctor
```

---

## Next Steps

- Read the [full documentation](README.md)
- Learn about [configuration options](README.md#configuration)
- Explore [available models and voices](README.md#speech-to-text-models)

---

## Questions?

- **Quick help:** `vtt help-all`
- **GitHub Issues:** https://github.com/chrisjrex/voice-to-text-raycast/issues
