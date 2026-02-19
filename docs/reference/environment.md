# Environment Variables

Complete reference for all VoiceKit environment variables.

## Core Path Variables

### VOICEKIT_PYTHON_PATH

Path to the Python executable used for STT and Piper TTS.

```bash
export VOICEKIT_PYTHON_PATH="/opt/homebrew/bin/python3"
export VOICEKIT_PYTHON_PATH="$HOME/.local/share/voicekit/venv/bin/python"
```

**Default:** Uses bundled Python (install script) or system Python (NPM)

**Used by:** Whisper, Parakeet, Piper TTS

### VOICEKIT_KOKORO_PYTHON_PATH

Path to Python executable specifically for Kokoro TTS.

```bash
export VOICEKIT_KOKORO_PYTHON_PATH="$HOME/.local/lib-kokoro/venv/bin/python3"
export VOICEKIT_KOKORO_PYTHON_PATH="/opt/homebrew/bin/python3.11"
```

**Default:** Same as `VOICEKIT_PYTHON_PATH`

**Used by:** Kokoro TTS only

**Note:** Kokoro requires Python 3.10-3.12 due to dependencies

### VOICEKIT_SOX_PATH

Path to the SoX (Sound eXchange) binary for audio recording.

```bash
export VOICEKIT_SOX_PATH="/opt/homebrew/bin/sox"
export VOICEKIT_SOX_PATH="/usr/local/bin/sox"
```

**Default:** Auto-detected from PATH

**Used by:** Audio recording in `voicekit transcribe`

### VOICEKIT_DATA_DIR

Directory for VoiceKit data (models, voices, recordings).

```bash
export VOICEKIT_DATA_DIR="$HOME/.local/share/voicekit"
export VOICEKIT_DATA_DIR="/Volumes/External/voicekit-data"
```

**Default:** `$HOME/.local/share/voicekit`

**Contains:**
- `voices/` - Downloaded TTS voices
- `recordings/` - Audio recordings
- `runtime/` - Bundled Python (install script only)

## Default Settings

### VOICEKIT_DEFAULT_STT_MODEL

Default speech-to-text model for transcription.

```bash
export VOICEKIT_DEFAULT_STT_MODEL=whisper-tiny
export VOICEKIT_DEFAULT_STT_MODEL=parakeet-110m
```

**Default:** `whisper-tiny`

**Valid values:**
- `whisper-tiny`
- `whisper-small`
- `whisper-large`
- `parakeet-110m`
- `parakeet-0.6b`
- `parakeet-1.1b`

### VOICEKIT_DEFAULT_TTS_VOICE

Default text-to-speech voice.

```bash
export VOICEKIT_DEFAULT_TTS_VOICE=Heart
export VOICEKIT_DEFAULT_TTS_VOICE=Samantha
export VOICEKIT_DEFAULT_TTS_VOICE=Amy
```

**Default:** `Samantha` (system voice)

**Valid values:** Any installed voice name

## API Tokens

### VOICEKIT_HF_TOKEN

HuggingFace API token for higher rate limits when downloading models.

```bash
export VOICEKIT_HF_TOKEN="hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

**Alternative:** `HF_TOKEN` is also respected

**Default:** None (anonymous downloads)

**Used by:** Model and voice downloads from HuggingFace

**Get token:** https://huggingface.co/settings/tokens

## Complete Configuration Example

```bash
# ~/.zshrc or ~/.bash_profile

# Python paths
export VOICEKIT_PYTHON_PATH="$HOME/.local/share/voicekit/venv/bin/python"
export VOICEKIT_KOKORO_PYTHON_PATH="$HOME/.local/lib-kokoro/venv/bin/python3"

# Binary paths
export VOICEKIT_SOX_PATH="/opt/homebrew/bin/sox"

# Data directory
export VOICEKIT_DATA_DIR="$HOME/.local/share/voicekit"

# Defaults
export VOICEKIT_DEFAULT_STT_MODEL=parakeet-110m
export VOICEKIT_DEFAULT_TTS_VOICE=Heart

# API tokens
export VOICEKIT_HF_TOKEN="hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

## Priority Order

Environment variables take precedence in this order:

1. Explicit command-line flags (highest priority)
2. Environment variables
3. Bundled runtime defaults (lowest priority)

Example:
```bash
# Environment sets default
export VOICEKIT_DEFAULT_TTS_VOICE=Samantha

# Command-line overrides
voicekit speak "Hello" -v Heart  # Uses Heart, not Samantha
```

## Checking Current Values

### View All Variables

```bash
# Show all VOICEKIT variables
env | grep VOICEKIT

# Show specific variable
echo $VOICEKIT_PYTHON_PATH
echo $VOICEKIT_DEFAULT_TTS_VOICE
```

### Check Configuration

```bash
# Doctor shows which Python is being used
voicekit doctor

# Shows paths and availability
```

## Common Configurations

### Using System Python

```bash
export VOICEKIT_PYTHON_PATH="/opt/homebrew/bin/python3"
export VOICEKIT_SOX_PATH="/opt/homebrew/bin/sox"
```

### Using uv

```bash
export VOICEKIT_PYTHON_PATH="$HOME/.local/share/voicekit/venv/bin/python"
```

### Using pyenv

```bash
export VOICEKIT_PYTHON_PATH="$HOME/.pyenv/versions/voicekit/bin/python"
```

### Using Conda

```bash
export VOICEKIT_PYTHON_PATH="$HOME/anaconda3/envs/voicekit/bin/python"
```

### Kokoro with Separate Environment

```bash
export VOICEKIT_KOKORO_PYTHON_PATH="$HOME/.local/lib-kokoro/venv/bin/python3"
```

### External Storage

```bash
export VOICEKIT_DATA_DIR="/Volumes/External/voicekit"
```

## Troubleshooting

### Variable Not Working

1. Check if variable is set:
   ```bash
   echo $VARIABLE_NAME
   ```

2. Ensure it's exported:
   ```bash
   export VARIABLE_NAME=value
   ```

3. Reload shell configuration:
   ```bash
   source ~/.zshrc  # or ~/.bash_profile
   ```

### Path Issues

Use absolute paths, not relative:
```bash
# Good
export VOICEKIT_PYTHON_PATH="/Users/name/.local/share/voicekit/venv/bin/python"

# Bad
export VOICEKIT_PYTHON_PATH="~/.local/share/voicekit/venv/bin/python"
```

### Verify Python Works

```bash
# Test the Python path
$VOICEKIT_PYTHON_PATH --version

# Should show Python 3.10+
```
