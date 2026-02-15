#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUT_DIR="$SCRIPT_DIR/../assets/samples"
TEXT="Testing 1, 2, 3"

PIPER_DATA_DIR="${PIPER_DATA_DIR:-$(mktemp -d)}"
mkdir -p "$OUT_DIR"

# --- Piper voices ---
PIPER_VOICES=(
  en_US-amy-medium
  en_US-lessac-medium
  en_US-ryan-medium
  en_GB-alba-medium
  en_GB-alan-medium
)

echo "=== Generating Piper samples ==="
for voice in "${PIPER_VOICES[@]}"; do
  out="$OUT_DIR/$voice.wav"
  if [[ -f "$out" ]]; then
    echo "  skip $voice (exists)"
    continue
  fi
  echo "  generating $voice..."
  python3 -m piper.download_voices "$voice" --download-dir "$PIPER_DATA_DIR" 2>/dev/null
  echo "$TEXT" | python3 -m piper --model "$voice" --data-dir "$PIPER_DATA_DIR" --output_file "$out" 2>/dev/null
  echo "  -> $out"
done

# --- Kokoro voices ---
KOKORO_VOICES=(
  af_heart af_alloy af_bella af_jessica af_nicole af_nova af_river af_sarah af_sky
  am_adam am_echo am_eric am_liam am_michael am_onyx
  bf_alice bf_emma bf_lily
  bm_daniel bm_george bm_lewis
)

echo "=== Generating Kokoro samples ==="
for voice in "${KOKORO_VOICES[@]}"; do
  out="$OUT_DIR/$voice.wav"
  if [[ -f "$out" ]]; then
    echo "  skip $voice (exists)"
    continue
  fi
  echo "  generating $voice..."
  python3 -c "
import kokoro, soundfile as sf
pipeline = kokoro.KPipeline(lang_code='a')
samples = pipeline(\"$TEXT\", voice=\"$voice\")
for i, (gs, ps, audio) in enumerate(samples):
    sf.write(\"$out\", audio, 24000)
    break
" 2>/dev/null
  echo "  -> $out"
done

echo "=== Done ==="
