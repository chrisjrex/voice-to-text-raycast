# Voice-to-Text

Local voice-to-text and text-to-speech for Raycast. Everything runs on-device — no cloud APIs, no data leaves your machine.

> Apple Silicon (M1 or later) is required.

## Installation

### Quick Install (Recommended)

Zero-setup installation with bundled runtime:

```bash
npm install -g @vtt/cli
```

Or via Homebrew:
```bash
brew tap chrisjrex/vtt
brew install vtt
```

That's it! Everything is included (Python 3.11, all packages, sox).

### Lite Install (Advanced)

If you prefer managing dependencies yourself:

```bash
# Install prerequisites
brew install sox python@3.11
pip3 install mlx-whisper setproctitle  # or parakeet-mlx

# Install VTT
npm install -g @vtt/cli-lite
```

See [INSTALL.md](INSTALL.md) for detailed installation options.

---

## Quick Start

1. **Check installation:**
   ```bash
   vtt doctor
   ```

2. **Download a model and voice:**
   ```bash
   vtt models download whisper-tiny
   vtt voices download Heart
   ```

3. **Start using:**
   ```bash
   vtt transcribe    # Record and transcribe
   vtt speak "Hello" # Text to speech
   ```

---

## Commands

### Transcribe

Start/stop recording. Transcribes on stop, then copies and/or pastes the result.

**Settings** (Raycast Settings > Extensions > Voice-to-Text > Transcribe):

| Setting | Default | Description |
|---|---|---|
| Copy to Clipboard | On | Copy transcribed text to clipboard |
| Paste to Active App | On | Paste transcribed text into the focused text field |
| Save Transcription History | On | Save transcriptions for later review |
| Silence Timeout | 15s | Auto-stop after this many seconds of silence (0 to disable) |

### Read Aloud

Speaks the selected text (or clipboard contents) using a local TTS voice. Run again with no selection to stop playback.

If the Kokoro server is running (via TTS Status), Read Aloud uses it for instant responses. Otherwise it does a cold start — loads the model, generates audio, and exits. Cold starts are slower (~5–10s) but require no background process.

### Manage Models

Browse, download, and select STT models and TTS voices.

**Settings** (Raycast Settings > Extensions > Voice-to-Text > Manage Models):

| Setting | Default | Description |
|---|---|---|
| Piper | On | Show Piper TTS voices |
| Kokoro | On | Show Kokoro TTS voices |

### Manage Post-Processing

Enable AI-powered transformations on transcriptions — grammar fixes, filler word removal, tone adjustment, and custom processors. Requires Raycast AI (Pro).

### Manage Dictionary

Add protected terms (e.g. "CCY", "Seamus") that AI post-processing must preserve exactly.

### Transcription History

Browse and manage past transcriptions.

### TTS Status (Menu Bar)

Shows a menu bar icon with TTS engine status. Controls for starting/stopping the Kokoro server and installing/uninstalling TTS engines.

**Settings** (Raycast Settings > Extensions > Voice-to-Text > TTS Status):

| Setting | Default | Description |
|---|---|---|
| Kokoro Idle Timeout | 120s | Auto-shutdown the Kokoro server after this many seconds of inactivity (0 to disable) |

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

Three TTS options, all managed through **Manage Models**.

### macOS System Voices (no install needed)

Uses the built-in `say` command. No downloads or Python packages required.

Available voices: Samantha, Alex, Daniel, Karen, Moira, Tessa, Fiona, Veena.

### Kokoro (best quality)

82M-parameter neural TTS. 21 voices across US and British English.

Voices are downloaded individually (~500KB each). The first download also installs the Python packages and fetches the voice engine (~362MB total) — this is a one-time setup shared by all voices.

**Cold start vs warm server:** Without the server running, Read Aloud does a cold start each time (~5–10s) — it loads the model, generates audio, and exits. To get near-instant responses, start the Kokoro server from the **TTS Status** menu bar. The server keeps the model in memory and auto-shuts down after the configured idle timeout (default: 2 minutes).

### Piper (lightweight, CPU)

Fast open-source voice synthesizer. 5 voices across US and British English.

Voices are downloaded individually (~60MB each). The first download also installs `piper-tts` (~24MB).

---

## Extension Settings

These apply across all commands (Raycast Settings > Extensions > Voice-to-Text):

### Core Settings

| Setting | Default | Description |
|---|---|---|
| Post-Processing Model | GPT-4o Mini | AI model for post-processing transcriptions |

### Runtime Settings (Optional)

**When using `@vtt/cli` (bundled):** These settings are automatically configured. You only need to change them if you want to use a custom Python environment.

**When using `@vtt/cli-lite`:** These settings must point to your system Python installation.

| Setting | Default | Description |
|---|---|---|
| Python Path | Auto-detected | Python 3.10+ with mlx-whisper or parakeet-mlx |
| Kokoro Python Path | Auto-detected | Python 3.10–3.12 for Kokoro (separate venv recommended) |
| Sox Path | Auto-detected | Path to sox binary for audio recording |

**Environment Variables:** You can also set these via environment variables (takes precedence over settings):
- `VTT_PYTHON_PATH`
- `VTT_KOKORO_PYTHON_PATH`
- `VTT_SOX_PATH`
- `VTT_DATA_DIR`
- `VTT_HF_TOKEN` - HuggingFace token for higher rate limits (also respects `HF_TOKEN`)

---

## Cleanup

### Uninstall TTS engines

Use the **TTS Status** menu bar to uninstall Kokoro or Piper. This removes the Python packages and downloaded voices.

### Remove STT models

Downloaded models are cached in `~/.cache/huggingface/hub/`. Delete specific model directories to free space:

```bash
# List downloaded models
ls ~/.cache/huggingface/hub/ | grep models--

# Remove a specific model (e.g. whisper-tiny)
rm -rf ~/.cache/huggingface/hub/models--mlx-community--whisper-tiny
```

### Full uninstall

1. Uninstall TTS engines from **TTS Status** menu bar
2. Remove STT models from `~/.cache/huggingface/hub/`
3. Remove the extension from Raycast

---

## Downloading all Kokoro voices at once

By default, Kokoro voices are downloaded individually. To download the model and all voices in one go:

```bash
python3 -c 'from huggingface_hub import snapshot_download; snapshot_download("hexgrad/Kokoro-82M")'
```

This downloads the full repository (~347MB) including all 53 voice files. The voices will then show as downloaded in **Manage Models**.
