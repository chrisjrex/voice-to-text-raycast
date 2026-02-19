# Configuration

VoiceKit can be configured using environment variables. No configuration files are required.

## Environment Variables

### Core Paths

```bash
# Main Python executable path
export VOICEKIT_PYTHON_PATH="$HOME/.local/share/voicekit/venv/bin/python"

# Separate Python for Kokoro TTS (if using isolated environment)
export VOICEKIT_KOKORO_PYTHON_PATH="$HOME/.local/lib-kokoro/venv/bin/python3"

# Sox binary path
export VOICEKIT_SOX_PATH="/opt/homebrew/bin/sox"

# Data directory for models, voices, and recordings
export VOICEKIT_DATA_DIR="$HOME/.local/share/voicekit"
```

### Default Settings

```bash
# Default speech-to-text model
export VOICEKIT_DEFAULT_STT_MODEL=whisper-tiny

# Default text-to-speech voice
export VOICEKIT_DEFAULT_TTS_VOICE=Heart

# HuggingFace token for higher rate limits
export VOICEKIT_HF_TOKEN="your_hf_token"
```

**Note:** `HF_TOKEN` is also respected if `VOICEKIT_HF_TOKEN` is not set.

### Priority

Environment variables take precedence over bundled runtime settings.

## Using Python Version Managers

### With `uv`

```bash
# Install Python 3.11
uv python install 3.11

# Create virtual environment
uv venv ~/.local/share/voicekit/venv --python 3.11
source ~/.local/share/voicekit/venv/bin/activate

# Install packages
pip install mlx-whisper parakeet-mlx piper-tts kokoro

# Configure VoiceKit
export VOICEKIT_PYTHON_PATH="$HOME/.local/share/voicekit/venv/bin/python"
```

### With `pyenv`

```bash
# Install Python 3.11.9
pyenv install 3.11.9

# Create virtual environment
pyenv virtualenv 3.11.9 voicekit
pyenv activate voicekit

# Install packages
pip install mlx-whisper parakeet-mlx piper-tts kokoro

# Configure VoiceKit
export VOICEKIT_PYTHON_PATH="$HOME/.pyenv/versions/voicekit/bin/python"
```

### With `conda`

```bash
# Create environment
conda create -n voicekit python=3.11
conda activate voicekit

# Install packages
pip install mlx-whisper parakeet-mlx piper-tts kokoro

# Configure VoiceKit
export VOICEKIT_PYTHON_PATH="$HOME/anaconda3/envs/voicekit/bin/python"
```

## Making Configuration Permanent

Add exports to your shell profile:

**Zsh:**
```bash
echo 'export VOICEKIT_PYTHON_PATH="$HOME/.local/share/voicekit/venv/bin/python"' >> ~/.zshrc
```

**Bash:**
```bash
echo 'export VOICEKIT_PYTHON_PATH="$HOME/.local/share/voicekit/venv/bin/python"' >> ~/.bash_profile
```

## Configuration Examples

### Use System Python Instead of Bundled

```bash
export VOICEKIT_PYTHON_PATH="/opt/homebrew/bin/python3"
```

### Use Custom Data Directory

```bash
export VOICEKIT_DATA_DIR="/Volumes/External/voicekit-data"
```

### Set Defaults

```bash
export VOICEKIT_DEFAULT_STT_MODEL=parakeet-110m
export VOICEKIT_DEFAULT_TTS_VOICE=Samantha
```

### Complete Custom Setup

```bash
# ~/.zshrc or ~/.bash_profile

# Use uv-managed Python
export VOICEKIT_PYTHON_PATH="$HOME/.local/share/voicekit/venv/bin/python"

# Separate Kokoro environment
export VOICEKIT_KOKORO_PYTHON_PATH="$HOME/.local/lib-kokoro/venv/bin/python3"

# Custom sox location
export VOICEKIT_SOX_PATH="/opt/homebrew/bin/sox"

# External storage for models
export VOICEKIT_DATA_DIR="/Volumes/External/voicekit"

# Personal defaults
export VOICEKIT_DEFAULT_STT_MODEL=parakeet-110m
export VOICEKIT_DEFAULT_TTS_VOICE=Heart

# HuggingFace token
export VOICEKIT_HF_TOKEN="hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```
