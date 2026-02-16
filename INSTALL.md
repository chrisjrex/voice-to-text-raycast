# Installation Guide

VTT (Voice-to-Text) offers two installation methods to suit different needs.

## Choose Your Installation

### Option 1: Bundled Version (Recommended) ⭐

**Best for:** Quick start, general users, anyone who wants it to "just work"

**What you get:**
- Python 3.11 runtime (bundled)
- All required Python packages
- sox binary
- VTT CLI tool

**Install via NPM:**
```bash
npm install -g @vtt/cli
```

**Or via Homebrew:**
```bash
brew tap chrisjrex/vtt
brew install vtt
```

**Size:** ~50MB download, ~150MB installed

---

### Option 2: Lite Version

**Best for:** Developers, minimalists, those who already have Python packages installed

**What you get:**
- VTT CLI tool only
- Uses your system Python and dependencies

**Prerequisites:**
```bash
# Install system dependencies
brew install sox python@3.11

# Install Python packages (pick what you need)
pip3 install mlx-whisper      # For multilingual STT
pip3 install parakeet-mlx     # For English-only STT (faster)
pip3 install piper-tts        # For lightweight TTS

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

After installation (either version):

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

| Feature | Bundled (`@vtt/cli`) | Lite (`@vtt/cli-lite`) |
|---------|---------------------|----------------------|
| **Setup time** | Instant | 10-15 minutes |
| **Download size** | ~50MB | ~500KB |
| **Disk usage** | ~150MB | ~50MB (shared with system) |
| **Dependencies** | None | sox, Python 3.11, pip packages |
| **Python version** | 3.11 (pinned) | Your choice (3.10+) |
| **Offline use** | ✅ Yes | ✅ Yes (after setup) |
| **Best for** | Quick start | Developers, custom setups |

---

## Switching Between Versions

```bash
# Switch from lite to bundled
npm uninstall -g @vtt/cli-lite
npm install -g @vtt/cli

# Switch from bundled to lite
npm uninstall -g @vtt/cli
npm install -g @vtt/cli-lite
# Then install prerequisites (see vtt doctor)
```

---

## Uninstalling

### Bundled Version
```bash
npm uninstall -g @vtt/cli
# Remove data directory
rm -rf ~/.local/share/vtt
```

### Lite Version
```bash
npm uninstall -g @vtt/cli-lite
# Remove data directory
rm -rf ~/.local/share/vtt
```

### Homebrew (either version)
```bash
vtt-uninstall          # Remove data
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

Ensure npm global bin is in your PATH:
```bash
export PATH="$PATH:$(npm config get prefix)/bin"
```

### Permission errors

Fix data directory permissions:
```bash
chmod -R 755 ~/.local/share/vtt
```

### Missing Python packages (lite version only)

Install required packages:
```bash
pip3 install mlx-whisper parakeet-mlx piper-tts
```

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
