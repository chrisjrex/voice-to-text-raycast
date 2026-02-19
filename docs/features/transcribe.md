# Speech-to-Text (Transcribe)

Record and transcribe speech to text using local models.

## Basic Usage

```bash
# Start recording and transcribing (press Ctrl+C to stop)
voicekit transcribe
```

## Options

### Auto-Stop on Silence

Stop recording automatically after a period of silence:

```bash
# Stop after 15 seconds of silence
voicekit transcribe --silence-timeout 15

# Stop after 5 seconds of silence
voicekit transcribe -s 5
```

### Transcribe Existing Audio

Transcribe a pre-recorded audio file:

```bash
voicekit transcribe --input recording.wav
voicekit transcribe -i meeting.mp3
```

### Output Formats

```bash
# Output just the text (no timestamps)
voicekit transcribe --format raw

# Output as JSON
voicekit transcribe --format json

# Default format includes timestamps
```

### Save to File

```bash
# Save transcription to file
voicekit transcribe -o meeting.txt

# Equivalent to
voicekit transcribe > meeting.txt
```

### Model Selection

```bash
# Use specific model
voicekit transcribe --model whisper-small

# Use default model (set via VOICEKIT_DEFAULT_STT_MODEL)
voicekit transcribe
```

## Complete Examples

### Meeting Transcription

```bash
# Record with auto-stop and save to file
voicekit transcribe --silence-timeout 10 -o meeting-$(date +%Y%m%d).txt
```

### Process Existing Audio

```bash
# Transcribe and extract just the text
voicekit transcribe --input interview.wav --format raw > interview.txt
```

### Real-time Transcription with Piping

```bash
# Transcribe and process the output
voicekit transcribe --format json | jq -r '.text' | grep -i "important"
```

## Keyboard Shortcuts

During transcription:
- **Ctrl+C**: Stop recording and transcribe
- The recording will automatically process when stopped

## Models

See [Available Models](../reference/models.md) for a complete list of supported speech-to-text models.

## Common Use Cases

1. **Dictation**: Quick notes and ideas
2. **Meeting notes**: Record and transcribe meetings
3. **Voice memos**: Transcribe voice recordings
4. **Accessibility**: Hands-free text input
5. **Content creation**: Transcribe interviews or podcasts

## Tips

- Use `--silence-timeout` for hands-free recording
- Choose smaller models (whisper-tiny, parakeet-110m) for faster transcription
- Use larger models (whisper-large, parakeet-1.1b) for better accuracy
- Save transcriptions immediately with `-o` flag
