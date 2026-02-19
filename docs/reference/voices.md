# Available Voices

Complete reference for text-to-speech (TTS) voices supported by VoiceKit.

## System Voices

Built into macOS - no download required, available immediately.

### Available System Voices

| Voice | Gender | Quality | Best For |
|-------|--------|---------|----------|
| Samantha | Female | Good | General purpose, notifications |
| Alex | Male | Good | General purpose, accessibility |
| Daniel | Male | Good | British accent |
| Karen | Female | Good | Australian accent |
| Moira | Female | Good | Irish accent |
| Tessa | Female | Good | South African accent |
| Fiona | Female | Good | Scottish accent |
| Veena | Female | Good | Indian accent |

### Usage

```bash
voicekit speak "Hello" -v Samantha
voicekit speak "Hello" -v Alex
```

### Characteristics
- **Size**: 0 MB (built-in)
- **Speed**: Instant (no load time)
- **Quality**: Good, natural-sounding
- **Offline**: Yes
- **Setup**: None required

## Piper Voices

Neural TTS voices - high quality, moderate size.

### Available Piper Voices

| Voice | Gender | Accent | Size | Quality |
|-------|--------|--------|------|---------|
| Amy | Female | British | ~60MB | Very Good |
| Lessac | Female | American | ~60MB | Very Good |
| Ryan | Male | American | ~60MB | Very Good |
| Alba | Female | Scottish | ~60MB | Very Good |
| Alan | Male | British | ~60MB | Very Good |

### Usage

```bash
# Download first
voicekit voices download Amy

# Then use
voicekit speak "Hello" -v Amy
```

### Characteristics
- **Size**: ~60MB per voice
- **Speed**: Fast (~0.5-1s startup)
- **Quality**: Very good, neural synthesis
- **Offline**: Yes
- **Setup**: Download required

## Kokoro Voices

State-of-the-art neural voices - best quality, requires server.

### Available Kokoro Voices

#### Female Voices

| Voice | Style | Best For |
|-------|-------|----------|
| Heart | Warm, natural | General purpose, storytelling |
| Bella | Soft, gentle | Audiobooks, relaxation |
| Jessica | Professional | Business, presentations |
| Nicole | Friendly | Casual conversations |
| Nova | Modern | Technology, news |
| River | Calm | Meditation, sleep content |
| Sarah | Clear | Education, tutorials |
| Sky | Energetic | Marketing, entertainment |
| Alice | British | UK content |
| Emma | Young | Youth content |
| Lily | Sweet | Children's content |

#### Male Voices

| Voice | Style | Best For |
|-------|-------|----------|
| Adam | Natural | General purpose |
| Echo | Deep | Authority, documentaries |
| Eric | Professional | Business, news |
| Liam | Friendly | Casual content |
| Michael | Clear | Education, tutorials |
| Onyx | Strong | Action, trailers |
| Daniel | British | UK content |
| George | Classic | Audiobooks |
| Lewis | Warm | Storytelling |

#### Neutral Voices

| Voice | Style | Best For |
|-------|-------|----------|
| Alloy | Balanced | Any content |

### Usage

```bash
# Download first (includes base model)
voicekit voices download Heart

# Use voice
voicekit speak "Hello" -v Heart

# Optional: Start server for better performance
voicekit server start
```

### Characteristics
- **Size**: ~500KB per voice + ~300MB base model
- **Speed**: Fast with server, slower without
- **Quality**: Excellent, state-of-the-art
- **Offline**: Yes
- **Setup**: Download required, Python 3.10-3.12

## Voice Comparison

### By Quality

| Rank | Engine | Quality | Example Voices |
|------|--------|---------|----------------|
| 1 | Kokoro | Excellent | Heart, Alloy, Bella |
| 2 | Piper | Very Good | Amy, Lessac, Ryan |
| 3 | System | Good | Samantha, Alex |

### By Speed (First Use)

| Rank | Engine | Startup Time |
|------|--------|--------------|
| 1 | System | Instant |
| 2 | Piper | ~0.5-1s |
| 3 | Kokoro | ~3-5s (or ~0.5s with server) |

### By Size

| Engine | Size | Notes |
|--------|------|-------|
| System | 0 MB | Built-in |
| Piper | ~60MB per voice | Each voice separate |
| Kokoro | ~300MB + ~500KB/voice | Shared base model |

### By Use Case

| Use Case | Recommended | Why |
|----------|-------------|-----|
| Quick testing | System (Samantha, Alex) | No download |
| Notifications | System or Piper | Fast, reliable |
| Audiobooks | Kokoro (Heart, Bella) | Best quality |
| Accessibility | System or Kokoro | Clear, natural |
| Multiple voices | Kokoro | Small per-voice size |
| Low bandwidth | System | No download |

## Using Voices

### Set Default Voice

```bash
export VOICEKIT_DEFAULT_TTS_VOICE=Heart
```

### Use Specific Voice

```bash
voicekit speak "Hello" -v Amy
voicekit speak "Hello" --voice Heart
```

### Preview Voice

```bash
voicekit voices preview Heart
```

### List Available Voices

```bash
voicekit voices list
```

## Voice Selection Guide

### For Beginners
1. Start with System voices (Samantha, Alex)
2. Try Piper Amy for better quality
3. Download Kokoro Heart for best experience

### For Content Creation
- **Narration**: Kokoro Heart, Bella
- **Explainer videos**: Kokoro Sarah, Michael
- **Marketing**: Kokoro Sky, Alloy
- **Professional**: Kokoro Jessica, Eric

### For Development
- **Testing**: System Samantha (instant)
- **Production**: Kokoro Heart (best quality)
- **Variety**: Mix of Piper voices

### For Accessibility
- **Screen reader**: System Alex or Samantha
- **Notifications**: Any System voice
- **Long content**: Kokoro with server mode

## Recommendations

### Minimal Setup
- Use System voices only
- Zero download, instant use

### Recommended Setup
- Download 1 Kokoro voice (Heart or Alloy)
- Start server for frequent use
- ~300MB for excellent quality

### Complete Setup
- All Kokoro voices (~10MB additional)
- Select Piper voices for variety
- ~500MB total
