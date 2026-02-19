# Installation Guide

Detailed installation instructions for all VoiceKit installation methods.

## Installation Methods

### Install Script (Recommended)

**Best for:** Quick start, no setup required

The install script bundles Python 3.11 and all dependencies:

```bash
curl -sSL https://raw.githubusercontent.com/chrisjrex/voice-to-text-raycast/main/scripts/install.sh | bash
```

Or download and run manually:

```bash
curl -sSL -o install-voicekit.sh https://raw.githubusercontent.com/chrisjrex/voice-to-text-raycast/main/scripts/install.sh
chmod +x install-voicekit.sh
./install-voicekit.sh
```

**What it installs:**
- Runtime: `~/.local/share/voicekit/runtime/` (bundled Python + packages)
- Binary: `~/.local/bin/voicekit`
- Data: `~/.local/share/voicekit/` (models, voices, recordings)

**Size:** ~300MB download, ~1.1GB installed

### NPM Package

**Best for:** Developers who already have Python 3.10+

```bash
npm install -g @voicekit/cli
```

**Prerequisites:**
```bash
brew install python sox
```

**What it installs:**
- NPM package: ~36KB
- Uses system Python
- Downloads models/voices on demand

**Size:** ~36KB (plus models/voices as needed)

### Homebrew

**Best for:** macOS users who prefer Homebrew

```bash
brew tap chrisjrex/voicekit
brew install voicekit
```

### CLI Lite

**Best for:** Custom setups, specific Python versions

Lightweight version requiring manual dependency installation:

```bash
npm install -g @voicekit/cli-lite
```

**Prerequisites:**

1. **System Requirements:**
   - macOS with Apple Silicon (M1 or later)
   - Homebrew installed

2. **Install Core Dependencies:**
   ```bash
   brew install sox python@3.11
   ```

3. **Install Python Packages:**

   Speech-to-Text (pick one or both):
   ```bash
   # Multilingual support
   pip3 install mlx-whisper
   
   # English-only, generally faster
   pip3 install parakeet-mlx
   ```

   Text-to-Speech (optional):
   ```bash
   pip3 install piper-tts
   ```

   Background Daemon (optional):
   ```bash
   pip3 install setproctitle
   ```

4. **Kokoro TTS Setup (Optional):**

   Kokoro requires Python 3.10-3.12:
   ```bash
   python3.11 -m venv ~/.local/lib-kokoro/venv
   ~/.local/lib-kokoro/venv/bin/pip install kokoro soundfile numpy
   export VOICEKIT_KOKORO_PYTHON_PATH="$HOME/.local/lib-kokoro/venv/bin/python3"
   ```

**Via Homebrew:**
```bash
brew tap chrisjrex/voicekit
brew install voicekit-lite
```

## Verification

After installation, verify everything works:

```bash
voicekit doctor
```

This checks:
- Python availability
- Required packages (mlx-whisper, parakeet-mlx, piper-tts, kokoro)
- Audio recording capability (sox)
- Data directory permissions

## Comparison

| Feature | Install Script | NPM Package | CLI Lite |
|---------|---------------|-------------|----------|
| **Download Size** | ~300MB | ~36KB | ~500KB |
| **Setup Time** | 2-3 minutes | Instant* | 10-15 minutes |
| **Dependencies** | Node.js only | Python 3.10+, sox | Python 3.10+, sox |
| **Python Version** | Bundled 3.11 | System Python | Your choice (3.10+) |
| **Disk Usage** | ~1.1GB | Shared with system | ~50MB (shared) |
| **Best For** | Quick start, no setup | Developers with Python | Custom setups |

\* After npm install, run `voicekit doctor` to check Python dependencies
