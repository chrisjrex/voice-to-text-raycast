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

### Testing Formulas Locally

Since the formulas reference GitHub releases and npm packages that may not exist yet, use these methods for testing:

#### Option 1: Skip SHA256 verification (Quick Test)

```bash
# Install with SHA256 verification disabled
brew install --build-from-source --ignore-dependencies ./vtt.rb

# For vtt-lite
brew install --build-from-source --ignore-dependencies ./vtt-lite.rb
```

#### Option 2: Build Runtime and Update SHA256

1. Build the runtime locally:
```bash
./scripts/build-runtime.sh
```

2. Get the SHA256 hash:
```bash
shasum -a 256 vtt-runtime-3.11.9-macos-arm64.tar.gz
```

3. Update the formula with the real hash, then install:
```bash
brew install --build-from-source ./vtt.rb
```

#### Option 3: Test Formula Syntax

```bash
# Check formula for errors
brew audit --strict ./vtt.rb

# Test formula
brew test ./vtt.rb
```

### Before Publishing

1. Build and upload runtime to GitHub releases
2. Publish npm packages (@vtt/cli and @vtt/cli-lite)
3. Update SHA256 hashes in formulas:
   - Runtime tarball SHA256
   - npm package SHA256
4. Test installation: `brew install chrisjrex/vtt/vtt`
5. Create PR to homebrew tap repository

## License

MIT
