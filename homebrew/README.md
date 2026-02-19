# Homebrew Tap for VoiceKit

Homebrew formulas for installing VoiceKit CLI on macOS.

## Available Formulas

### `voicekit` (Recommended)

Self-contained version with bundled Python runtime. Zero setup required.

```bash
brew tap chrisjrex/voicekit
brew install voicekit
```

**Includes:**
- Python 3.11 runtime
- All required Python packages (mlx-whisper, parakeet-mlx, piper-tts, kokoro)
- sox binary
- VoiceKit CLI tool

**Size:** ~50MB download

### `voicekit-lite`

Lightweight version that uses system dependencies.

```bash
brew tap chrisjrex/voicekit
brew install voicekit-lite
```

**Requirements:**
- sox (`brew install sox`)
- Python 3.11 (`brew install python@3.11`)
- Python packages (installed separately via pip)

**Size:** ~500KB download

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

# Start transcribing
voicekit transcribe
```

## Which Version Should I Use?

| Feature | `voicekit` | `voicekit-lite` |
|---------|------------|-----------------|
| Setup time | Instant | 10-15 minutes |
| Download size | ~50MB | ~500KB |
| Dependencies | None | Manual install |
| Best for | Quick start | Developers, custom setups |

**Recommendation:** Use `voicekit` (bundled) unless you:
- Already have Python packages installed
- Want to manage dependencies yourself
- Need to use a specific Python version
- Have limited disk space

## Switching Between Versions

```bash
# Switch from lite to bundled
brew uninstall voicekit-lite
brew install voicekit

# Switch from bundled to lite
brew uninstall voicekit
brew install voicekit-lite
# Then install prerequisites (see voicekit doctor)
```

## Uninstalling

```bash
# Remove data directory
voicekit-uninstall

# Remove package
brew uninstall voicekit  # or voicekit-lite

# Remove tap (optional)
brew untap chrisjrex/voicekit
```

## Troubleshooting

### Permission Denied

If you get permission errors:
```bash
sudo chown -R $(whoami) ~/.local/share/voicekit
```

### Python Not Found (voicekit-lite only)

Ensure Python 3.11 is in your PATH:
```bash
export PATH="/opt/homebrew/opt/python@3.11/bin:$PATH"
```

### Missing Dependencies (voicekit-lite only)

Install missing packages:
```bash
pip3 install mlx-whisper parakeet-mlx piper-tts
```

## Updating

```bash
brew update
brew upgrade voicekit  # or voicekit-lite
```

## Development

### Testing Formulas Locally

Since the formulas reference GitHub releases and npm packages that may not exist yet, use these methods for testing:

#### Option 1: Skip SHA256 verification (Quick Test)

```bash
# Install with SHA256 verification disabled
brew install --build-from-source --ignore-dependencies ./voicekit.rb

# For voicekit-lite
brew install --build-from-source --ignore-dependencies ./voicekit-lite.rb
```

#### Option 2: Build Runtime and Update SHA256

1. Build the runtime locally:
```bash
./scripts/build-runtime.sh
```

2. Get the SHA256 hash:
```bash
shasum -a 256 voicekit-runtime-3.11.9-macos-arm64.tar.gz
```

3. Update the formula with the real hash, then install:
```bash
brew install --build-from-source ./voicekit.rb
```

#### Option 3: Test Formula Syntax

```bash
# Check formula for errors
brew audit --strict ./voicekit.rb

# Test formula
brew test ./voicekit.rb
```

### Before Publishing

1. Build and upload runtime to GitHub releases
2. Publish npm packages (@voicekit/cli and @voicekit/cli-lite)
3. Update SHA256 hashes in formulas:
   - Runtime tarball SHA256
   - npm package SHA256
4. Test installation: `brew install chrisjrex/voicekit/voicekit`
5. Create PR to homebrew tap repository

## License

MIT
