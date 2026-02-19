# Installation Comparison

Compare different VoiceKit installation methods.

## Quick Comparison

| Feature | Install Script | NPM Package | CLI Lite | Homebrew |
|---------|---------------|-------------|----------|----------|
| **Download Size** | ~300MB | ~36KB | ~500KB | ~300MB |
| **Setup Time** | 2-3 minutes | Instant* | 10-15 minutes | 2-3 minutes |
| **Dependencies** | Node.js only | Python 3.10+, sox | Python 3.10+, sox | Node.js or Python |
| **Python Version** | Bundled 3.11 | System Python | Your choice (3.10+) | Bundled or system |
| **Disk Usage** | ~1.1GB | Shared with system | ~50MB (shared) | ~1.1GB |
| **Offline** | Yes after install | Yes after install | Yes after install | Yes after install |
| **Best For** | Quick start, no setup | Developers with Python | Custom setups | macOS users |

\* After npm install, run `voicekit doctor` to check Python dependencies

## Detailed Comparison

### Install Script (Recommended)

**Best for:** Users who want zero setup

**Pros:**
- Includes everything (Python 3.11, packages, runtime)
- Works out of the box
- Isolated from system Python
- Easy uninstall

**Cons:**
- Large initial download (~300MB)
- Uses more disk space (~1.1GB)
- Longer initial setup (2-3 minutes)

**Install:**
```bash
curl -sSL https://raw.githubusercontent.com/chrisjrex/voice-to-text-raycast/main/scripts/install.sh | bash
```

**When to choose:**
- First-time users
- No Python experience
- Want zero configuration
- Don't want to manage dependencies

### NPM Package (@voicekit/cli)

**Best for:** Developers who already have Python

**Pros:**
- Instant installation (~36KB)
- Uses system Python (space efficient)
- Familiar npm workflow
- Easy updates

**Cons:**
- Requires Python 3.10+ installation
- Requires sox installation
- Manual dependency management
- Potential version conflicts

**Install:**
```bash
npm install -g @voicekit/cli
```

**Prerequisites:**
```bash
brew install python@3.11 sox
```

**When to choose:**
- Already have Python installed
- Comfortable with dependency management
- Want to minimize disk usage
- Using npm for other tools

### CLI Lite (@voicekit/cli-lite)

**Best for:** Custom Python setups

**Pros:**
- Lightweight (~500KB)
- Works with any Python version manager
- Minimal footprint
- Full control over environment

**Cons:**
- Manual dependency installation
- Longer setup (10-15 minutes)
- Requires technical knowledge
- No bundled runtime

**Install:**
```bash
npm install -g @voicekit/cli-lite
```

**Prerequisites:**
```bash
brew install python@3.11 sox
pip3 install mlx-whisper parakeet-mlx piper-tts kokoro
```

**When to choose:**
- Using pyenv, uv, or conda
- Want specific Python version
- Minimize disk usage
- Comfortable with Python ecosystem

### Homebrew

**Best for:** macOS package manager users

**Pros:**
- Native macOS integration
- Automatic updates with `brew upgrade`
- Clean uninstall with `brew uninstall`

**Cons:**
- Requires Homebrew installation
- May not be latest version immediately

**Install:**
```bash
brew tap chrisjrex/voicekit
brew install voicekit
```

**When to choose:**
- Already use Homebrew
- Want automatic updates
- Prefer package managers

## Feature Comparison

| Feature | Install Script | NPM | Lite | Homebrew |
|---------|---------------|-----|------|----------|
| **Transcribe** | ✓ | ✓ | ✓ | ✓ |
| **Speak** | ✓ | ✓ | ✓ | ✓ |
| **Model management** | ✓ | ✓ | ✓ | ✓ |
| **Voice management** | ✓ | ✓ | ✓ | ✓ |
| **Server mode** | ✓ | ✓ | ✓ | ✓ |
| **Doctor** | ✓ | ✓ | ✓ | ✓ |
| **Offline after install** | ✓ | ✓ | ✓ | ✓ |
| **Custom Python path** | ✓ | ✓ | ✓ | ✓ |
| **Environment variables** | ✓ | ✓ | ✓ | ✓ |

## Performance Comparison

| Metric | Install Script | NPM | Lite | Homebrew |
|--------|---------------|-----|------|----------|
| **Installation time** | 2-3 min | <1 min | 10-15 min | 2-3 min |
| **First run time** | Immediate | Immediate | Immediate | Immediate |
| **Model loading** | Same | Same | Same | Same |
| **Transcription speed** | Same | Same | Same | Same |
| **TTS speed** | Same | Same | Same | Same |

**Note:** All methods use the same underlying engines (Whisper, Parakeet, Piper, Kokoro) and have identical performance once installed.

## Use Case Recommendations

### For Beginners
**Recommendation:** Install Script
- No Python knowledge required
- Works immediately
- No configuration needed

### For Developers
**Recommendation:** NPM Package
- If you have Python: Use @voicekit/cli
- If you use pyenv/uv: Use @voicekit/cli-lite
- Fits existing workflows

### For macOS Power Users
**Recommendation:** Homebrew
- If you use Homebrew for everything
- Want automatic updates
- Clean system management

### For Minimal Systems
**Recommendation:** CLI Lite
- Share Python with other projects
- Minimal disk usage
- Full control

### For Corporate/Restricted Environments
**Recommendation:** Install Script
- Self-contained
- No admin rights needed (installs to ~/.local)
- No system dependencies

## Migration Guide

### Switching Between Versions

See [Uninstalling](uninstalling.md) for complete removal, then install the new version.

**Bundled → Lite:**
```bash
npm uninstall -g @voicekit/cli
npm install -g @voicekit/cli-lite
# Install prerequisites
```

**Lite → Bundled:**
```bash
npm uninstall -g @voicekit/cli-lite
npm install -g @voicekit/cli
```

**Any → Homebrew:**
```bash
# Uninstall current version
npm uninstall -g @voicekit/cli
npm uninstall -g @voicekit/cli-lite
rm -rf ~/.local/share/voicekit/

# Install via Homebrew
brew tap chrisjrex/voicekit
brew install voicekit
```

## Summary

- **Just want it to work?** → Install Script
- **Already have Python?** → NPM Package
- **Use pyenv/conda/uv?** → CLI Lite
- **Homebrew fan?** → Homebrew
- **Not sure?** → Install Script (easiest)
