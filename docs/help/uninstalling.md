# Uninstalling

How to completely remove VoiceKit from your system.

## Uninstall by Method

### Install Script

Remove bundled installation:

```bash
# Remove binary
rm -f ~/.local/bin/voicekit

# Remove runtime and data
rm -rf ~/.local/share/voicekit/

# Remove from PATH (if you added it manually)
# Edit ~/.zshrc or ~/.bash_profile and remove:
# export PATH="$HOME/.local/bin:$PATH"
```

### NPM Package

Remove @voicekit/cli:

```bash
# Uninstall package
npm uninstall -g @voicekit/cli

# Remove data directory (optional)
rm -rf ~/.cache/VoiceKit/
rm -rf ~/.local/share/voicekit/

# Remove models (optional)
rm -rf ~/.cache/huggingface/hub/
```

### CLI Lite

Remove @voicekit/cli-lite:

```bash
# Uninstall package
npm uninstall -g @voicekit/cli-lite

# Remove data directory (optional)
rm -rf ~/.local/share/voicekit/

# Remove models (optional)
rm -rf ~/.cache/huggingface/hub/

# Python packages remain (remove if desired)
pip3 uninstall mlx-whisper parakeet-mlx piper-tts kokoro
```

### Homebrew

Remove voicekit or voicekit-lite:

```bash
# Uninstall formula
brew uninstall voicekit
brew uninstall voicekit-lite

# Untap repository (optional)
brew untap chrisjrex/voicekit

# Remove data (optional)
rm -rf ~/.local/share/voicekit/
rm -rf ~/.cache/huggingface/hub/
```

## Complete System Removal

Remove all traces of VoiceKit:

```bash
#!/bin/bash

echo "Removing VoiceKit..."

# Remove NPM packages
npm uninstall -g @voicekit/cli 2>/dev/null
npm uninstall -g @voicekit/cli-lite 2>/dev/null

# Remove Homebrew installation
brew uninstall voicekit 2>/dev/null
brew uninstall voicekit-lite 2>/dev/null
brew untap chrisjrex/voicekit 2>/dev/null

# Remove install script binary
rm -f ~/.local/bin/voicekit

# Remove data directories
rm -rf ~/.local/share/voicekit/
rm -rf ~/.cache/VoiceKit/

# Remove models (optional - shared with other HuggingFace tools)
read -p "Remove HuggingFace models too? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -rf ~/.cache/huggingface/hub/
    echo "HuggingFace models removed"
fi

# Remove environment variables from shell profile
for profile in ~/.zshrc ~/.bash_profile ~/.bashrc; do
    if [ -f "$profile" ]; then
        sed -i.bak '/VOICEKIT_/d' "$profile"
        echo "Cleaned $profile"
    fi
done

echo "VoiceKit removed successfully"
echo "Restart your terminal to complete"
```

## What Gets Removed

### Always Removed
- VoiceKit binary
- NPM packages
- Homebrew formulas

### Optionally Removed
- Voice data (Piper/Kokoro voices)
- Audio recordings
- HuggingFace models (may be shared)

### Preserved
- Python installation (system)
- Sox (system package)
- Python packages (CLI Lite)
- Shell configuration (except VOICEKIT variables)

## Data Backup

Before uninstalling, backup if needed:

```bash
# Backup custom voices
tar -czf voicekit-voices-backup.tar.gz ~/.local/share/voicekit/voices/

# Backup recordings
tar -czf voicekit-recordings-backup.tar.gz ~/.local/share/voicekit/recordings/

# Backup models (optional)
tar -czf voicekit-models-backup.tar.gz ~/.cache/huggingface/hub/
```

## Reinstallation

To reinstall after removal:

```bash
# Install Script (clean slate)
curl -sSL https://raw.githubusercontent.com/chrisjrex/voice-to-text-raycast/main/scripts/install.sh | bash

# NPM (if you kept Python)
npm install -g @voicekit/cli

# Homebrew
brew tap chrisjrex/voicekit
brew install voicekit
```

## Troubleshooting Uninstall

### Binary still in PATH

```bash
# Find and remove
which voicekit
rm -f $(which voicekit)

# Or restart terminal
exec zsh  # or exec bash
```

### Data still taking space

```bash
# Find remaining data
du -sh ~/.local/share/voicekit/ 2>/dev/null
du -sh ~/.cache/VoiceKit/ 2>/dev/null
du -sh ~/.cache/huggingface/ 2>/dev/null

# Remove manually
rm -rf ~/.local/share/voicekit/
rm -rf ~/.cache/VoiceKit/
```

### Permission denied during removal

```bash
# Use sudo for system-wide files (rare)
sudo rm -rf ~/.local/share/voicekit/

# Or fix permissions
sudo chown -R $(whoami) ~/.local/share/voicekit/
rm -rf ~/.local/share/voicekit/
```

## Verify Removal

Check VoiceKit is completely removed:

```bash
# Should return nothing
which voicekit

# Should return "command not found"
voicekit --version

# Check for remaining data
ls -la ~/.local/share/voicekit/ 2>&1
ls -la ~/.cache/VoiceKit/ 2>&1

# Check environment
grep VOICEKIT ~/.zshrc ~/.bash_profile 2>/dev/null
```

## Clean Slate

For a completely fresh start:

1. Uninstall VoiceKit completely
2. Remove all data
3. Restart terminal
4. Install fresh

This is useful when:
- Switching between versions
- Fixing persistent issues
- Starting with new configuration
- Troubleshooting
