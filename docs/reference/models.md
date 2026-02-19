# Available Models

Complete reference for speech-to-text (STT) models supported by VoiceKit.

## Whisper Models

Multilingual speech recognition models from OpenAI.

| Model | Size | Speed | Best For | Languages |
|-------|------|-------|----------|-----------|
| whisper-tiny | ~75MB | Fastest | Quick drafts, testing | 99+ |
| whisper-small | ~500MB | Fast | Good accuracy, general use | 99+ |
| whisper-large | ~1.6GB | Slow | Best accuracy, production | 99+ |

### Whisper Model Details

**whisper-tiny**
- Download: `voicekit models download whisper-tiny`
- Use case: Quick transcriptions, testing, low-resource environments
- Accuracy: Good for clear audio
- Speed: ~5-10x real-time on Apple Silicon

**whisper-small**
- Download: `voicekit models download whisper-small`
- Use case: Daily use, meetings, notes
- Accuracy: Very good, handles noise well
- Speed: ~2-4x real-time on Apple Silicon

**whisper-large**
- Download: `voicekit models download whisper-large`
- Use case: Professional transcription, multiple languages
- Accuracy: Best quality, excellent multilingual support
- Speed: ~1-2x real-time on Apple Silicon

## Parakeet Models

English-only models optimized for speed and accuracy.

| Model | Size | Speed | Best For |
|-------|------|-------|----------|
| parakeet-110m | ~220MB | Fastest | Real-time, streaming |
| parakeet-0.6b | ~1.2GB | Fast | Good accuracy, English content |
| parakeet-1.1b | ~2.2GB | Medium | Best English accuracy |

### Parakeet Model Details

**parakeet-110m**
- Download: `voicekit models download parakeet-110m`
- Use case: Real-time dictation, live transcription
- Accuracy: Good for clear English audio
- Speed: ~10-20x real-time on Apple Silicon
- Note: English only

**parakeet-0.6b**
- Download: `voicekit models download parakeet-0.6b`
- Use case: English podcasts, videos, meetings
- Accuracy: Very good English accuracy
- Speed: ~3-5x real-time on Apple Silicon
- Note: English only

**parakeet-1.1b**
- Download: `voicekit models download parakeet-1.1b`
- Use case: Professional English transcription
- Accuracy: Excellent English accuracy
- Speed: ~1-2x real-time on Apple Silicon
- Note: English only

## Model Comparison

### By Use Case

| Use Case | Recommended Model | Why |
|----------|------------------|-----|
| Quick notes | whisper-tiny or parakeet-110m | Fast, small |
| Meeting transcription | whisper-small or parakeet-0.6b | Good accuracy |
| Podcast transcription | whisper-small | Handles noise |
| Multi-language | whisper-small or whisper-large | Language support |
| Professional | whisper-large or parakeet-1.1b | Best accuracy |
| Real-time dictation | parakeet-110m | Fastest |

### By Language

| Language | Recommended Model |
|----------|------------------|
| English | parakeet-110m, parakeet-0.6b, parakeet-1.1b |
| Multilingual | whisper-tiny, whisper-small, whisper-large |
| Non-English | whisper-small or whisper-large |

### By Resource Usage

| Resource | Best Choice |
|----------|-------------|
| Low disk space | whisper-tiny (~75MB) |
| Low memory | whisper-tiny or parakeet-110m |
| Fast transcription | parakeet-110m |
| Best accuracy | whisper-large or parakeet-1.1b |

## Using Models

### Set Default Model

```bash
export VOICEKIT_DEFAULT_STT_MODEL=whisper-small
```

### Use Specific Model

```bash
voicekit transcribe --model parakeet-110m
```

### List Available Models

```bash
voicekit models list
```

## Model Storage

Models are cached in:
```
~/.cache/huggingface/hub/
```

This directory is shared with other HuggingFace-based tools.

## Technical Details

### Whisper
- Architecture: Encoder-decoder transformer
- Training data: 680,000 hours of multilingual audio
- Framework: MLX (Apple Silicon optimized)
- License: MIT

### Parakeet
- Architecture: CTC-based encoder
- Training data: English-only datasets
- Framework: MLX (Apple Silicon optimized)
- License: CC BY 4.0

## Recommendations

### For New Users
1. Start with `whisper-tiny` for testing
2. Download `whisper-small` for daily use
3. Try `parakeet-110m` if you only need English

### For Production
- Use `whisper-small` for general purpose
- Use `parakeet-1.1b` for English-only high accuracy
- Use `whisper-large` for multilingual content

### Disk Space Planning
- Minimal setup: 1 model (~75-500MB)
- Recommended: 2 models (~600MB)
- Complete: All models (~4.5GB)
