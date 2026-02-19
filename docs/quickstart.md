# Quick Start

Get up and running with VoiceKit in minutes.

## Prerequisites

- **macOS** with Apple Silicon (M1 or later)
- **Node.js** 18+ (for NPM installation)

## Installation (Choose One)

### Option 1: Install Script (Recommended)

Zero setup, includes everything:

```bash
curl -sSL https://raw.githubusercontent.com/chrisjrex/voice-to-text-raycast/main/scripts/install.sh | bash
```

### Option 2: NPM

If you have Python 3.10+ already installed:

```bash
npm install -g @voicekit/cli
```

**Prerequisites:**
```bash
brew install python sox
```

### Option 3: Homebrew

```bash
brew tap chrisjrex/voicekit
brew install voicekit
```

## Verify Installation

```bash
voicekit doctor
```

This checks that everything is installed correctly.

## First Steps

### 1. List Available Resources

```bash
# See available speech-to-text models
voicekit models list

# See available text-to-speech voices
voicekit voices list
```

### 2. Download a Model and Voice

```bash
# Download a lightweight STT model
voicekit models download whisper-tiny

# Download a high-quality voice
voicekit voices download Heart
```

### 3. Start Using VoiceKit

**Transcribe speech to text:**
```bash
# Start recording and transcribing (press Ctrl+C to stop)
voicekit transcribe
```

**Convert text to speech:**
```bash
# Speak text using the Heart voice
voicekit speak "Hello world" -v Heart
```

## Next Steps

- Learn about all [transcribe options](features/transcribe.md)
- Explore [text-to-speech features](features/speak.md)
- See the [complete command reference](usage.md)
- Read about [configuration options](configuration.md)
