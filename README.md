# Voice-to-Text

Local voice-to-text and text-to-speech for Raycast. Everything runs on-device — no cloud APIs, no data leaves your machine.

> Apple Silicon (M1 or later) is required.

## Installation

Install everything with one block — this enables both speech-to-text and text-to-speech:

```bash
# Recording (required for dictation)
brew install sox

# Speech-to-text — pick one or both:
pip3 install mlx-whisper    # multilingual
pip3 install parakeet-mlx   # English-only, generally faster

# Text-to-speech packages are auto-installed on first voice download
# (or skip TTS entirely and use macOS system voices)
```

Then in Raycast:

1. Open **Manage Models**
2. Download at least one STT model and set it as active
3. *(Optional)* Scroll to TTS voices, download one, and set it as active — or select a built-in macOS system voice

You're ready — run **Transcribe** to dictate, **Read Aloud** to speak text.

---

## Commands

| Command | Description |
|---|---|
| **Transcribe** | Start/stop recording. Transcribes on stop, copies result to clipboard, and pastes it. |
| **Read Aloud** | Speaks the selected text (or clipboard contents) using a local TTS voice. |
| **Manage Models** | Browse, download, and select STT models and TTS voices. |
| **Manage Post-Processing** | Enable AI-powered transformations (grammar fix, filler word removal, tone adjustment, etc.). |
| **Manage Dictionary** | Add protected terms (e.g. "CCY", "Seamus") that AI post-processing must preserve exactly. |
| **Transcription History** | Browse and manage past transcriptions. |
| **Toggle Kokoro Server** | Start or stop the persistent Kokoro TTS server. |

---

## Speech-to-Text Models

All models run locally via Apple MLX. Download and manage them through **Manage Models**.

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

---

## Text-to-Speech

Three TTS options are available. All are managed through **Manage Models** — pick a voice and set it as active.

### macOS System Voices (no install needed)

Uses the built-in `say` command. No downloads or Python packages required.

Available voices: Samantha, Alex, Daniel, Karen, Moira, Tessa, Fiona, Veena.

### Kokoro (best quality)

82M-parameter neural TTS. Runs a local Python server with 2-minute idle auto-shutdown.

Voices are downloaded individually (~500KB each). The first voice you download will also install the Python packages (`kokoro`, `soundfile`, `numpy`, ~50MB) and fetch the Kokoro voice engine (~312MB) — this is a one-time setup shared by all voices. 21 voices available across US and British English, male and female.

If the last Kokoro voice is deleted, you'll be offered the option to uninstall the engine and Python packages.

Use **Toggle Kokoro Server** to manually start/stop the server, or let it start automatically on first use.

### Piper (lightweight, CPU)

Fast open-source voice synthesizer from [Rhasspy](https://github.com/rhasspy/piper).

Voices are downloaded individually (~60MB each). The first voice you download will also install `piper-tts` (~24MB) — this is a one-time install shared by all voices. 5 voices available across US and British English, male and female.

If the last Piper voice is deleted, you'll be offered the option to uninstall the engine.

---

## Preferences

| Preference | Default | Description |
|---|---|---|
| Sox Path | `/opt/homebrew/bin/sox` | Path to `sox` binary |
| Python Path | `/opt/homebrew/bin/python3` | Path to `python3` with mlx-whisper or parakeet-mlx |
| Kokoro Python Path | `~/.local/lib-kokoro/venv/bin/python3` | Path to `python3` with kokoro installed |
| Save Transcription History | Enabled | Save transcriptions for later review |
| Copy to Clipboard | Enabled | Copy transcribed text to clipboard |
| Paste to Active App | Enabled | Paste transcribed text into the focused text field |
| Silence Timeout | 15 seconds | Auto-stop after this many seconds of silence (0 to disable) |

---

## Additional Information

### Downloading all Kokoro voices at once

By default, Kokoro voices are downloaded individually. If you'd prefer to download the model and all voices in one go, you can use `snapshot_download` directly:

```bash
python3 -c 'from huggingface_hub import snapshot_download; snapshot_download("hexgrad/Kokoro-82M")'
```

This downloads the full repository (~347MB) including all 53 voice files. The voices will then show as downloaded in **Manage Models**.
