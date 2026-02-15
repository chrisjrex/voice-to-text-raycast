# Voice-to-Text

Local voice-to-text and text-to-speech for Raycast. Everything runs on-device — no cloud APIs, no data leaves your machine.

> Apple Silicon (M1 or later) is required.

## Commands

| Command | Description |
|---|---|
| **Toggle Dictation** | Start/stop recording. Transcribes on stop, copies result to clipboard, and pastes it. |
| **Read Aloud** | Speaks the currently selected text (or clipboard contents) using a local TTS voice. |
| **Manage Models** | Browse, download, and select STT models and TTS voices. |
| **Manage Post-Processing** | Enable AI-powered transformations (grammar fix, filler word removal, tone adjustment, etc.). |
| **Manage Dictionary** | Add protected terms (e.g. "CCY", "Séamus") that AI post-processing must preserve exactly. |
| **Transcription History** | Browse and manage past transcriptions. |

---

## Speech-to-Text (Dictation)

### Prerequisites

```bash
brew install sox
pip3 install mlx-whisper   # multilingual
pip3 install parakeet-mlx  # English-only, generally faster
```

Install one or both transcription packages depending on which models you want.

### Setup

1. Open **Manage Models** and download at least one model
2. Select the downloaded model as active
3. Configure paths in extension preferences if your `sox` or `python3` binaries are not at the default Homebrew locations

### Available Models

#### Whisper (multilingual)
| Model | Size | Notes |
|---|---|---|
| Tiny | ~75 MB | Fastest, lower accuracy |
| Small | ~500 MB | Good balance |
| Large v3 Turbo | ~1.6 GB | Best multilingual accuracy |

#### Parakeet (English only)
| Model | Size | Notes |
|---|---|---|
| 110M | ~220 MB | Fast, lightweight |
| 0.6B | ~1.2 GB | Good accuracy |
| 1.1B | ~2.2 GB | Most accurate |

---

## Text-to-Speech (Read Aloud)

TTS uses [Piper](https://github.com/rhasspy/piper), a fast open-source voice synthesizer that runs locally on CPU.

### Prerequisites

```bash
pip3 install piper-tts
```

### Setup

1. Open **Manage Models** and scroll to the **TTS Voices** section
2. Download a voice and set it as active
3. Highlight text in any app and run **Read Aloud** (falls back to clipboard if nothing is selected)

### Available Voices

| Voice | Accent | Gender |
|---|---|---|
| Amy | US English | Female |
| Lessac | US English | Female |
| Ryan | US English | Male |
| Alba | British English | Female |
| Alan | British English | Male |

---

## Preferences

| Preference | Default | Description |
|---|---|---|
| Sox Path | `/opt/homebrew/bin/sox` | Path to the `sox` binary |
| Python Path | `/opt/homebrew/bin/python3` | Path to `python3` |
| TTS Engine | None | Override TTS engine (not needed when using Manage Models) |
| TTS Voice / Model | — | Manual voice name (overrides the managed active voice) |
| Save Transcription History | Enabled | Save transcriptions for later review |
| Copy to Clipboard | Enabled | Copy transcribed text to clipboard |
| Paste to Active App | Enabled | Paste transcribed text into the focused text field |
| Silence Timeout | 15 seconds | Auto-stop after this many seconds of silence (0 to disable) |
