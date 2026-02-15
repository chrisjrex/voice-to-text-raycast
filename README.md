# Voice-to-Text

Local voice-to-text for Raycast using MLX models. Transcription runs entirely on-device via Apple Silicon — no cloud APIs, no data leaves your machine.

## Prerequisites

This extension requires two command-line tools installed on your Mac:

### 1. sox (audio recording)

```bash
brew install sox
```

### 2. Python 3 with an MLX transcription package

Install **one** (or both) depending on which models you want to use:

- **Whisper** (multilingual):
  ```bash
  pip3 install mlx-whisper
  ```

- **Parakeet** (English-only, generally faster):
  ```bash
  pip3 install parakeet-mlx
  ```

### 3. Piper TTS (optional, for Read Aloud)

```bash
pip3 install piper-tts
```

> Apple Silicon (M1 or later) is required for MLX inference.

## Setup

1. Install the extension
2. Open **Manage Models** and download at least one model
3. Select the downloaded model as active
4. Configure paths in extension preferences if your `sox` or `python3` binaries are not at the default Homebrew locations (`/opt/homebrew/bin/sox`, `/opt/homebrew/bin/python3`)

## Commands

| Command | Description |
|---|---|
| **Toggle Dictation** | Start/stop recording. Transcribes on stop, copies result to clipboard, and pastes it. |
| **Read Aloud** | Speaks the currently selected text (or clipboard contents) using a local TTS voice. |
| **Manage Models** | Browse, download, and select STT models and TTS voices. |
| **Manage Post-Processing** | Enable AI-powered transformations (grammar fix, filler word removal, tone adjustment, etc.). |
| **Manage Dictionary** | Add protected terms (e.g. "CCY", "Séamus") that AI post-processing must preserve exactly. |
| **Transcription History** | Browse and manage past transcriptions. |

## Available Models

### Whisper (multilingual)
| Model | Size | Notes |
|---|---|---|
| Tiny | ~75 MB | Fastest, lower accuracy |
| Small | ~500 MB | Good balance |
| Large v3 Turbo | ~1.6 GB | Best multilingual accuracy |

### Parakeet (English only)
| Model | Size | Notes |
|---|---|---|
| 110M | ~220 MB | Fast, lightweight |
| 0.6B | ~1.2 GB | Good accuracy |
| 1.1B | ~2.2 GB | Most accurate |

## Text-to-Speech (Read Aloud)

TTS uses [Piper](https://github.com/rhasspy/piper), a fast open-source voice synthesizer that runs locally on CPU.

### 1. Download a voice

Open **Manage Models** in Raycast and scroll to the **TTS Voices** section. Select a voice and press Enter to download it.

| Voice | Accent | Gender |
|---|---|---|
| Amy | US English | Female |
| Lessac | US English | Female |
| Ryan | US English | Male |
| Alba | British English | Female |
| Alan | British English | Male |

### 2. Set active voice

Select a downloaded voice and press Enter to set it as active.

### 3. Use Read Aloud

Highlight text in any app and run **Read Aloud**. If nothing is selected, it reads from the clipboard. Audio plays via the built-in `afplay` command.

## Preferences

| Preference | Default | Description |
|---|---|---|
| TTS Engine | None | Override TTS engine (not needed when using Manage Models to set an active voice) |
| TTS Voice / Model | — | Manual voice name (overrides the managed active voice) |
| Sox Path | `/opt/homebrew/bin/sox` | Path to the `sox` binary |
| Python Path | `/opt/homebrew/bin/python3` | Path to `python3` with mlx-whisper or parakeet-mlx installed |
| Save Transcription History | Enabled | Save transcriptions for later review |
| Copy to Clipboard | Enabled | Copy transcribed text to clipboard |
| Paste to Active App | Enabled | Paste transcribed text into the focused text field |
| Silence Timeout | 15 seconds | Auto-stop recording after this many seconds of silence. Set to 0 to disable. |
