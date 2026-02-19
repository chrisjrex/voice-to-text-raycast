# Troubleshooting

Common issues and solutions for VoiceKit.

## Installation Issues

### Command not found after installation

**Symptoms:**
```
bash: voicekit: command not found
```

**Solutions:**

1. **NPM global bin not in PATH:**
   ```bash
   export PATH="$PATH:$(npm config get prefix)/bin"
   # Add to ~/.zshrc or ~/.bash_profile
   ```

2. **Install script binary location:**
   ```bash
   # Check if binary exists
   ls -la ~/.local/bin/voicekit
   
   # Add to PATH if missing
   export PATH="$PATH:$HOME/.local/bin"
   ```

3. **Shell restart required:**
   ```bash
   source ~/.zshrc  # or ~/.bash_profile
   # Or restart terminal
   ```

### Permission errors

**Symptoms:**
```
EACCES: permission denied
```

**Solutions:**

1. **Fix data directory permissions:**
   ```bash
   chmod -R 755 ~/.local/share/voicekit
   chown -R $(whoami) ~/.local/share/voicekit
   ```

2. **Fix NPM permissions:**
   ```bash
   # On macOS, change NPM prefix
   mkdir ~/.npm-global
   npm config set prefix '~/.npm-global'
   export PATH=~/.npm-global/bin:$PATH
   ```

3. **Use sudo (not recommended):**
   ```bash
   sudo npm install -g @voicekit/cli
   ```

### Doctor shows missing dependencies

**Symptoms:**
```bash
$ voicekit doctor
✗ Python not found
✗ mlx-whisper not installed
```

**Solutions:**

1. **Install prerequisites (NPM/CLI Lite):**
   ```bash
   brew install python@3.11 sox
   pip3 install mlx-whisper parakeet-mlx piper-tts
   ```

2. **Use bundled version (install script):**
   ```bash
   curl -sSL https://raw.githubusercontent.com/chrisjrex/voice-to-text-raycast/main/scripts/install.sh | bash
   ```

3. **Check Python path:**
   ```bash
   export VOICEKIT_PYTHON_PATH="/opt/homebrew/bin/python3"
   ```

## Runtime Issues

### Kokoro voice download fails

**Symptoms:**
```
Error downloading Kokoro voice
```

**Solutions:**

1. **Check Python version:**
   ```bash
   # Kokoro requires Python 3.10-3.12
   python3 --version  # Should show 3.10-3.12
   ```

2. **Set Kokoro Python path:**
   ```bash
   # Create isolated environment
   python3.11 -m venv ~/.local/lib-kokoro/venv
   ~/.local/lib-kokoro/venv/bin/pip install kokoro soundfile numpy
   
   # Configure VoiceKit
   export VOICEKIT_KOKORO_PYTHON_PATH="$HOME/.local/lib-kokoro/venv/bin/python3"
   ```

3. **Check HuggingFace token:**
   ```bash
   export VOICEKIT_HF_TOKEN="your_token_here"
   ```

### Daemon not visible in Activity Monitor

**Symptoms:**
- Kokoro server running but not showing in Activity Monitor

**Solutions:**

1. **Install setproctitle:**
   ```bash
   pip3 install setproctitle
   ```

2. **Restart server:**
   ```bash
   voicekit server stop
   voicekit server start
   ```

### Slow transcription/ synthesis

**Symptoms:**
- Transcription takes longer than expected
- TTS has long delays

**Solutions:**

1. **Use smaller models:**
   ```bash
   # Instead of whisper-large
   voicekit models download whisper-tiny
   voicekit transcribe --model whisper-tiny
   ```

2. **Start Kokoro server:**
   ```bash
   voicekit server start
   # Then use Kokoro voices
   ```

3. **Use system voices:**
   ```bash
   # No download, instant use
   voicekit speak "Hello" -v Samantha
   ```

4. **Check available memory:**
   ```bash
   # Close other applications
   # Large models need 2-4GB RAM
   ```

### Audio recording not working

**Symptoms:**
```
Error: sox not found
```

**Solutions:**

1. **Install sox:**
   ```bash
   brew install sox
   ```

2. **Set sox path:**
   ```bash
   export VOICEKIT_SOX_PATH="/opt/homebrew/bin/sox"
   ```

3. **Check microphone permissions:**
   - System Preferences → Security & Privacy → Microphone
   - Ensure Terminal has microphone access

### Model download fails

**Symptoms:**
```
Error: Could not download model
```

**Solutions:**

1. **Check internet connection:**
   ```bash
   curl -I https://huggingface.co
   ```

2. **Set HuggingFace token:**
   ```bash
   export VOICEKIT_HF_TOKEN="your_hf_token"
   # Get token from https://huggingface.co/settings/tokens
   ```

3. **Clear cache and retry:**
   ```bash
   rm -rf ~/.cache/huggingface/hub/models--openai--whisper-tiny
   voicekit models download whisper-tiny
   ```

## Configuration Issues

### Environment variables not working

**Symptoms:**
- Setting `VOICEKIT_PYTHON_PATH` has no effect

**Solutions:**

1. **Check if exported:**
   ```bash
   # Check current value
   echo $VOICEKIT_PYTHON_PATH
   
   # Should show path, not empty
   ```

2. **Use absolute paths:**
   ```bash
   # Good
   export VOICEKIT_PYTHON_PATH="/Users/name/.local/share/voicekit/venv/bin/python"
   
   # Bad (tilde expansion unreliable)
   export VOICEKIT_PYTHON_PATH="~/.local/share/voicekit/venv/bin/python"
   ```

3. **Reload shell:**
   ```bash
   source ~/.zshrc
   # Or restart terminal
   ```

### Switching from bundled to system Python

**Symptoms:**
- Want to use custom Python instead of bundled

**Solutions:**

1. **Set Python path:**
   ```bash
   export VOICEKIT_PYTHON_PATH="/opt/homebrew/bin/python3"
   ```

2. **Install required packages:**
   ```bash
   pip3 install mlx-whisper parakeet-mlx piper-tts kokoro
   ```

3. **Verify with doctor:**
   ```bash
   voicekit doctor
   ```

## Switching Versions

### Switch from bundled to lite version

```bash
# Uninstall bundled
npm uninstall -g @voicekit/cli

# Install lite
npm install -g @voicekit/cli-lite

# Install prerequisites
brew install python@3.11 sox
pip3 install mlx-whisper parakeet-mlx piper-tts

# Verify
voicekit doctor
```

### Switch from lite to bundled version

```bash
# Uninstall lite
npm uninstall -g @voicekit/cli-lite

# Install bundled
npm install -g @voicekit/cli

# Or use install script
curl -sSL https://raw.githubusercontent.com/chrisjrex/voice-to-text-raycast/main/scripts/install.sh | bash
```

## Getting Help

### Check System Health

```bash
voicekit doctor
voicekit doctor --json
```

### Verbose Output

```bash
# Most commands support verbose mode
voicekit transcribe --verbose
voicekit speak "Hello" --verbose
```

### Debug Information

```bash
# Show version
voicekit --version

# Show all environment variables
env | grep VOICEKIT

# Check binary location
which voicekit
ls -la $(which voicekit)
```

### Report Issues

If none of these solutions work:

1. Run `voicekit doctor --json` and save output
2. Note your installation method (install script / npm / homebrew)
3. Include macOS version and hardware (Intel/Apple Silicon)
4. Report at: https://github.com/chrisjrex/voice-to-text-raycast/issues
