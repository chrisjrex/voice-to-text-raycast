# Text-to-Speech (Speak)

Convert text to spoken audio using local voice engines.

## Basic Usage

```bash
# Speak text using default voice
voicekit speak "Hello world"
```

## Options

### Voice Selection

```bash
# Use specific voice
voicekit speak -v Heart "Hello world"
voicekit speak --voice Samantha "Hello world"

# Use default voice (set via VOICEKIT_DEFAULT_TTS_VOICE)
voicekit speak "Hello world"
```

### Speed Control

Adjust speech speed from 0.5x to 2.0x:

```bash
# Slow speech (80% speed)
voicekit speak --speed 0.8 "Speaking slowly"

# Fast speech (150% speed)
voicekit speak --speed 1.5 "Speaking quickly"

# Very fast (200% speed)
voicekit speak -S 2.0 "Speaking very fast"
```

### Reading from File

```bash
# Read entire file
voicekit speak -f document.txt
voicekit speak --file article.md

# Read from stdin
voicekit speak < document.txt
cat document.txt | voicekit speak
```

### Piping from Other Commands

```bash
# Speak output from other commands
echo "Hello world" | voicekit speak
date | voicekit speak -v Samantha
```

### Save to File

```bash
# Save audio to file instead of playing
voicekit speak "Hello" -o output.wav
voicekit speak --output greeting.wav "Good morning"
```

## Complete Examples

### Read Long Documents

```bash
# Read a text file with a pleasant voice
voicekit speak -f book.txt -v Heart --speed 1.1
```

### Alert Notifications

```bash
# Use in scripts for audio alerts
if [ $? -ne 0 ]; then
    voicekit speak "Build failed!" -v Samantha
fi
```

### Speed Reading

```bash
# Listen to content at faster speeds
voicekit speak -f article.txt --speed 1.5
```

### Voice Testing

```bash
# Test all available voices
for voice in Heart Samantha Amy; do
    voicekit speak "This is $voice speaking" -v $voice
done
```

## Voices

See [Available Voices](../reference/voices.md) for a complete list of supported text-to-speech voices.

### Voice Engines

1. **System Voices** (built-in, no download)
   - macOS system voices
   - No setup required
   - Examples: Samantha, Alex, Daniel

2. **Piper Voices** (~60MB each)
   - High quality neural voices
   - Fast local synthesis
   - Examples: Amy, Lessac, Ryan

3. **Kokoro Voices** (~500KB each + ~300MB shared model)
   - Best quality voices
   - Requires Python 3.10-3.12
   - Examples: Heart, Alloy, Bella

## Common Use Cases

1. **Reading assistance**: Listen to documents
2. **Notifications**: Audio alerts in scripts
3. **Content consumption**: Listen to articles while doing other tasks
4. **Language learning**: Hear pronunciation
5. **Accessibility**: Screen reader alternative

## Tips

- Use `--speed 1.2` for comfortable listening to long content
- System voices are fastest (no download required)
- Kokoro voices have best quality but require more setup
- Use `-o` to save audio for later or sharing
- Pipe text from other commands for dynamic content
