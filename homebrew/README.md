# Homebrew Tap for VTT

Homebrew formulas for installing VTT (Voice-to-Text CLI) on macOS.

## Available Formulas

### `vtt` (Recommended)

Self-contained version with bundled Python runtime. Zero setup required.

```bash
brew tap chrisjrex/vtt
brew install vtt
```

**Includes:**
- Python 3.11 runtime
- All required Python packages (mlx-whisper, parakeet-mlx, piper-tts, kokoro)
- sox binary
- VTT CLI tool

**Size:** ~50MB download

### `vtt-lite`

Lightweight version that uses system dependencies.

```bash
brew tap chrisjrex/vtt
brew install vtt-lite
```

**Requirements:**
- sox (`brew install sox`)
- Python 3.11 (`brew install python@3.11`)
- Python packages (installed separately via pip)

**Size:** ~500KB download

## Quick Start

```bash
# Check installation
vtt doctor

# List available models and voices
vtt models list
vtt voices list

# Download a speech-to-text model
vtt models download whisper-tiny

# Download a text-to-speech voice
vtt voices download Heart

# Start transcribing
vtt transcribe
```

## Which Version Should I Use?

| Feature | `vtt` | `vtt-lite` |
|---------|-------|------------|
| Setup time | Instant | 10-15 minutes |
| Download size | ~50MB | ~500KB |
| Dependencies | None | Manual install |
| Best for | Quick start | Developers, custom setups |

**Recommendation:** Use `vtt` (bundled) unless you:
- Already have Python packages installed
- Want to manage dependencies yourself
- Need to use a specific Python version
- Have limited disk space

## Switching Between Versions

```bash
# Switch from lite to bundled
brew uninstall vtt-lite
brew install vtt

# Switch from bundled to lite
brew uninstall vtt
brew install vtt-lite
# Then install prerequisites (see vtt doctor)
```

## Uninstalling

```bash
# Remove data directory
vtt-uninstall

# Remove package
brew uninstall vtt  # or vtt-lite

# Remove tap (optional)
brew untap chrisjrex/vtt
```

## Troubleshooting

### Permission Denied

If you get permission errors:
```bash
sudo chown -R $(whoami) ~/.local/share/vtt
```

### Python Not Found (vtt-lite only)

Ensure Python 3.11 is in your PATH:
```bash
export PATH="/opt/homebrew/opt/python@3.11/bin:$PATH"
```

### Missing Dependencies (vtt-lite only)

Install missing packages:
```bash
pip3 install mlx-whisper parakeet-mlx piper-tts
```

## Updating

```bash
brew update
brew upgrade vtt  # or vtt-lite
```

## Development

To test formulas locally:

```bash
# Install from local file
brew install --build-from-source ./vtt.rb

# Test formula
brew test vtt
```

## License

MIT
