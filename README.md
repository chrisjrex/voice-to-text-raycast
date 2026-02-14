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
| **Manage Models** | Browse, download, and select Whisper and Parakeet models. |
| **Manage Post-Processing** | Enable AI-powered transformations (grammar fix, filler word removal, tone adjustment, etc.). |
| **Manage Dictionary** | Add protected terms (e.g. "CCY", "Séamus") that AI post-processing must preserve exactly. |

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

## Preferences

| Preference | Default | Description |
|---|---|---|
| Sox Path | `/opt/homebrew/bin/sox` | Path to the `sox` binary |
| Python Path | `/opt/homebrew/bin/python3` | Path to `python3` with mlx-whisper or parakeet-mlx installed |
| Silence Timeout | 15 seconds | Auto-stop recording after this many seconds of silence. Set to 0 to disable. |
