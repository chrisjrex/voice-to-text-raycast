# Model Management

Download, list, and manage speech-to-text (STT) models.

## List Models

View all available models and their installation status:

```bash
voicekit models list
```

Output shows:
- Model name
- Size
- Installation status (✓ installed, ✗ not installed)
- Supported features

## Download Models

```bash
# Download a specific model
voicekit models download whisper-tiny
voicekit models download parakeet-110m

# Download multiple models
voicekit models download whisper-small
voicekit models download parakeet-0.6b
```

### Models are stored in:

```
~/.cache/huggingface/hub/
```

## Delete Models

Remove models to free up disk space:

```bash
# Delete a specific model
voicekit models delete whisper-tiny

# Models are removed from cache directory
```

## Available Models

See [Available Models](../reference/models.md) for detailed information about each model.

### Quick Reference

**Whisper (multilingual):**
- `whisper-tiny` (~75MB) - Fastest, quick drafts
- `whisper-small` (~500MB) - Fast, good accuracy
- `whisper-large` (~1.6GB) - Slow, best multilingual

**Parakeet (English only):**
- `parakeet-110m` (~220MB) - Fastest, real-time
- `parakeet-0.6b` (~1.2GB) - Fast, good accuracy
- `parakeet-1.1b` (~2.2GB) - Medium, best English

## Usage in Transcription

```bash
# Use specific model for transcription
voicekit transcribe --model whisper-small

# Or set as default
export VOICEKIT_DEFAULT_STT_MODEL=whisper-small
```

## Managing Disk Space

### Check Model Sizes

```bash
# List shows model sizes
voicekit models list

# Check disk usage
du -h ~/.cache/huggingface/hub/
```

### Free Up Space

```bash
# Delete large models you don't use
voicekit models delete whisper-large

# Keep only what you need
# Typical setup: 1-2 models (~300MB - 1GB)
```

## Tips

- Start with `whisper-tiny` or `parakeet-110m` for testing
- Download larger models only if you need better accuracy
- Models are shared across VoiceKit installations
- Parakeet is English-only but faster
- Whisper supports multiple languages
- First download may take time (fetched from HuggingFace)
