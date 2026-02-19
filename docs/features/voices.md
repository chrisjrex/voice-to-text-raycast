# Voice Management

Download, list, preview, and manage text-to-speech (TTS) voices.

## List Voices

View all available voices and their installation status:

```bash
voicekit voices list
```

Output shows:
- Voice name
- Engine type (System, Piper, Kokoro)
- Size
- Installation status (✓ installed, ✗ not installed)

## Download Voices

```bash
# Download a specific voice
voicekit voices download Heart
voicekit voices download Amy
voicekit voices download Samantha
```

### Voice Storage

- **Piper voices**: `~/.local/share/voicekit/voices/piper/`
- **Kokoro voices**: `~/.local/share/voicekit/voices/kokoro/`
- **System voices**: Built into macOS (no download)

## Preview Voices

Hear a sample before using:

```bash
# Preview a voice
voicekit voices preview Heart
voicekit voices preview Samantha
```

This plays a short sample phrase using the selected voice.

## Delete Voices

Remove voices to free up disk space:

```bash
# Delete a specific voice
voicekit voices delete Heart

# System voices cannot be deleted (built into macOS)
```

## Available Voices

See [Available Voices](../reference/voices.md) for detailed information about each voice.

### Quick Reference

**System Voices** (built-in, no download):
- Samantha, Alex, Daniel, Karen, Moira, Tessa, Fiona, Veena

**Piper Voices** (~60MB each):
- Amy, Lessac, Ryan, Alba, Alan

**Kokoro Voices** (~500KB each + ~300MB shared model):
- Heart, Alloy, Bella, Jessica, Nicole, Nova, River, Sarah, Sky
- Adam, Echo, Eric, Liam, Michael, Onyx
- Alice, Emma, Lily, Daniel, George, Lewis

## Usage in Speech

```bash
# Use specific voice
voicekit speak "Hello" -v Heart
voicekit speak --voice Amy "Hello world"

# Or set as default
export VOICEKIT_DEFAULT_TTS_VOICE=Heart
```

## Managing Disk Space

### Check Voice Sizes

```bash
# List shows voice sizes
voicekit voices list

# Check disk usage
du -h ~/.local/share/voicekit/voices/
```

### Free Up Space

```bash
# Delete voices you don't use
voicekit voices delete Amy
voicekit voices delete Ryan

# System voices use no extra space
# Piper: ~60MB per voice
# Kokoro: ~500KB per voice + ~300MB base model
```

## Voice Selection Tips

### For Speed
- Use **System voices** - no download, instant use
- Examples: Samantha, Alex

### For Quality
- Use **Kokoro voices** - best neural quality
- Examples: Heart, Alloy, Bella

### For Size
- Use **System voices** - zero download
- Use **Kokoro** after base model - only ~500KB per additional voice

### For Variety
- Mix different engines
- System for quick tests
- Kokoro for production use

## Tips

- Preview voices before downloading with `voices preview`
- Start with System voices for testing
- System voices work immediately (no download)
- Download one Piper/Kokoro voice to test quality
- Kokoro requires Python 3.10-3.12
- Voices can be switched instantly with `-v` flag
