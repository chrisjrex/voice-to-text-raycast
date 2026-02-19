# File Locations

Where VoiceKit stores data, models, and configuration.

## Data Directory

**Default:** `~/.local/share/voicekit/`

**Override:** Set `VOICEKIT_DATA_DIR` environment variable

### Structure

```
~/.local/share/voicekit/
├── voices/           # Downloaded TTS voices
│   ├── piper/       # Piper voices (~60MB each)
│   └── kokoro/      # Kokoro voices (~500KB each)
├── recordings/      # Audio recordings (if saved)
└── runtime/         # Bundled Python (install script only)
    ├── python/      # Python 3.11 installation
    └── packages/    # Python packages
```

## Models Directory

**Location:** `~/.cache/huggingface/hub/`

**Note:** Shared with other HuggingFace-based tools

### Structure

```
~/.cache/huggingface/hub/
├── models--openai--whisper-tiny/
├── models--openai--whisper-small/
├── models--openai--whisper-large/
├── models--nvidia--parakeet-110m/
└── ...
```

**Size:** Varies by downloaded models
- whisper-tiny: ~75MB
- whisper-small: ~500MB
- whisper-large: ~1.6GB
- parakeet-110m: ~220MB
- parakeet-0.6b: ~1.2GB
- parakeet-1.1b: ~2.2GB

## Binary Location

**Install Script:** `~/.local/bin/voicekit`

**NPM:** `$(npm config get prefix)/bin/voicekit`

**Homebrew:** `/opt/homebrew/bin/voicekit` (Apple Silicon)

## Configuration

VoiceKit uses **environment variables only** - no configuration files.

See [Environment Variables](environment.md) for all options.

## Log Files

VoiceKit outputs to stdout/stderr. No log files are created by default.

To capture logs:
```bash
voicekit transcribe 2> voicekit.log
```

## Cache Management

### View Disk Usage

```bash
# VoiceKit data
du -sh ~/.local/share/voicekit/

# Models cache
du -sh ~/.cache/huggingface/hub/

# Breakdown by model
du -h ~/.cache/huggingface/hub/ | sort -h
```

### Clean Up

```bash
# Remove all VoiceKit data
rm -rf ~/.local/share/voicekit/

# Remove all models
rm -rf ~/.cache/huggingface/hub/

# Remove specific model
voicekit models delete whisper-large
```

### Move Data Directory

```bash
# 1. Move existing data
mv ~/.local/share/voicekit /Volumes/External/voicekit

# 2. Set environment variable
export VOICEKIT_DATA_DIR="/Volumes/External/voicekit"

# 3. Add to shell profile for persistence
echo 'export VOICEKIT_DATA_DIR="/Volumes/External/voicekit"' >> ~/.zshrc
```

## Backup

### Backup Data

```bash
# Backup voices and settings
tar -czf voicekit-backup.tar.gz ~/.local/share/voicekit/

# Backup models (optional, can re-download)
tar -czf voicekit-models-backup.tar.gz ~/.cache/huggingface/hub/
```

### Restore Data

```bash
# Restore voices and settings
tar -xzf voicekit-backup.tar.gz -C ~/

# Restore models
tar -xzf voicekit-models-backup.tar.gz -C ~/
```

## Storage Planning

### Minimal Setup
- 1 model (~75-500MB)
- 1 voice (~0-300MB)
- **Total:** ~100-800MB

### Recommended Setup
- 2 models (~600MB)
- 2-3 voices (~400MB)
- **Total:** ~1GB

### Complete Setup
- All models (~4.5GB)
- All voices (~500MB)
- **Total:** ~5GB

## Permissions

VoiceKit data should be readable/writable by your user:

```bash
# Fix permissions if needed
chmod -R 755 ~/.local/share/voicekit/
chmod -R 755 ~/.cache/huggingface/

# Or reset to your user
sudo chown -R $(whoami) ~/.local/share/voicekit/
sudo chown -R $(whoami) ~/.cache/huggingface/
```

## Uninstalling

### Complete Removal

```bash
# Remove binary (install script)
rm -f ~/.local/bin/voicekit

# Remove data
rm -rf ~/.local/share/voicekit/

# Remove models (optional)
rm -rf ~/.cache/huggingface/hub/

# NPM uninstall
npm uninstall -g @voicekit/cli
npm uninstall -g @voicekit/cli-lite

# Homebrew uninstall
brew uninstall voicekit
brew uninstall voicekit-lite
```
