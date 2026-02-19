# Speed Control

Adjust the speaking speed for all text-to-speech voices.

## Basic Usage

Control speech speed with the `--speed` flag:

```bash
# Slow speech (80% speed)
voicekit speak --speed 0.8 "Speaking slowly"

# Normal speed (100%)
voicekit speak --speed 1.0 "Normal speed"

# Fast speech (150% speed)
voicekit speak --speed 1.5 "Speaking quickly"

# Very fast (200% speed)
voicekit speak --speed 2.0 "Speaking very fast"
```

## Valid Range

- **Minimum:** 0.5x (half speed)
- **Maximum:** 2.0x (double speed)
- **Default:** 1.0x (normal speed)

## Use Cases

### Slow Speed (0.5x - 0.8x)

Use for:
- Language learning
- Accessibility (hearing difficulties)
- Complex technical content
- Pronunciation practice

```bash
voicekit speak --speed 0.7 "Difficult technical terminology"
```

### Normal Speed (1.0x)

Use for:
- General listening
- Default behavior
- Most content types

```bash
voicekit speak "Hello world"  # Default 1.0x
```

### Fast Speed (1.2x - 1.5x)

Use for:
- Speed listening
- Long documents
- Reviewing content
- Efficient consumption

```bash
voicekit speak --speed 1.3 -f article.txt
```

### Very Fast (1.6x - 2.0x)

Use for:
- Skimming content
- Quick review
- Experienced speed listeners

```bash
voicekit speak --speed 1.8 -f long-document.txt
```

## Combining with Other Options

### With Voice Selection

```bash
voicekit speak --speed 1.2 -v Heart "Hello world"
```

### With File Input

```bash
voicekit speak --speed 1.5 -f document.txt
```

### With Output File

```bash
voicekit speak --speed 0.8 "Hello" -o slow-greeting.wav
```

### With Piping

```bash
cat article.txt | voicekit speak --speed 1.3
```

## Recommended Speeds by Content

| Content Type | Recommended Speed | Why |
|--------------|-------------------|-----|
| Fiction/Stories | 1.0x - 1.1x | Natural flow |
| News/Articles | 1.2x - 1.4x | Information dense |
| Technical docs | 0.9x - 1.1x | Need to process |
| Language learning | 0.7x - 0.9x | Comprehension |
| Notifications | 1.0x - 1.2x | Quick alerts |
| Audiobooks | 1.0x - 1.3x | Personal preference |

## Tips

### Finding Your Optimal Speed

1. Start at 1.0x for new content types
2. Gradually increase by 0.1x until uncomfortable
3. Back off by 0.1x for optimal speed
4. Different content may need different speeds

### Script Examples

**Variable speed based on content:**
```bash
#!/bin/bash
CONTENT_TYPE="$1"

if [ "$CONTENT_TYPE" = "technical" ]; then
    SPEED=0.9
elif [ "$CONTENT_TYPE" = "news" ]; then
    SPEED=1.3
else
    SPEED=1.0
fi

voicekit speak --speed $SPEED -f "$2"
```

**Speed listening mode:**
```bash
# Quick alias for speed listening
alias vks='voicekit speak --speed 1.5'

# Use it
vks -f article.txt
```

### Voice Differences

Different voices may sound better at different speeds:

- **System voices**: Usually good at 1.0x - 1.2x
- **Piper voices**: Good at 0.9x - 1.3x
- **Kokoro voices**: Excellent at 0.8x - 1.5x

Experiment to find what works best for each voice.

## Technical Details

Speed control is applied during audio synthesis:
- **System voices**: macOS speed control
- **Piper voices**: Time-stretching algorithm
- **Kokoro voices**: Speed parameter in synthesis

All methods maintain pitch while changing speed.
