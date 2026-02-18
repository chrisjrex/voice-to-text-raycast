#!/usr/bin/env python3
"""Storage table formatter using PrettyTable for VTT CLI."""

import json
import sys
from prettytable import PrettyTable


def format_storage_table(json_input: str) -> str:
    data = json.loads(json_input)
    lines = []

    lines.append("\nVTT Storage Usage")
    lines.append("=" * 60 + "\n")

    deps = data.get("dependencies", {})
    lines.append("Dependencies")
    t = PrettyTable(["Name", "Size", "Path"])
    t.border = False
    t.header = False
    t.add_row(["Python", deps.get("python", {}).get("size_human", "0 B"), deps.get("python", {}).get("path", "")])
    t.add_row(["Sox", deps.get("sox", {}).get("size_human", "0 B"), deps.get("sox", {}).get("path", "")])
    t.align = "l"
    t.align["Size"] = "r"
    t.align["Path"] = "l"
    output = t.get_string()
    lines.append(output.replace("Name", "  ").replace("Size", "").replace("Path", ""))
    lines.append("")

    storage = data.get("storage", {})
    data_dir = storage.get("data_dir", {})
    hf_cache = storage.get("huggingface_cache", {})

    lines.append("Storage Directories")
    t = PrettyTable(["Name", "Size", "Description"])
    t.border = False
    t.header = False
    t.add_row(["Data Directory", data_dir.get("size_human", "0 B"), data_dir.get("path", "")])
    t.add_row(["  stt/", data_dir.get("stt", {}).get("size_human", "0 B"), "(daemon, recordings)"])
    t.add_row(["    daemon/", data_dir.get("stt", {}).get("daemon", {}).get("size_human", "0 B"), "(scripts, logs)"])
    t.add_row(["    recordings/", data_dir.get("stt", {}).get("recordings", {}).get("size_human", "0 B"), "(transcription audio)"])
    t.add_row(["  tts/", data_dir.get("tts", {}).get("size_human", "0 B"), "(voices, previews, recordings)"])
    t.add_row(["    voices/", data_dir.get("tts", {}).get("voices", {}).get("size_human", "0 B"), "(downloaded TTS voices)"])
    t.add_row(["    previews/", data_dir.get("tts", {}).get("previews", {}).get("size_human", "0 B"), "(voice previews)"])
    t.add_row(["    recordings/", data_dir.get("tts", {}).get("recordings", {}).get("size_human", "0 B"), "(saved TTS output)"])
    t.add_row(["    tmp/", data_dir.get("tts", {}).get("tmp", {}).get("size_human", "0 B"), "(temporary files)"])
    t.add_row(["  venv/", data_dir.get("venv", {}).get("size_human", "0 B"), "(Python environment)"])
    t.add_row(["HuggingFace Cache", hf_cache.get("size_human", "0 B"), hf_cache.get("path", "")])
    t.add_row(["  models/", hf_cache.get("models", {}).get("size_human", "0 B"), "(STT models)"])
    t.align = "l"
    t.align["Size"] = "r"
    output = t.get_string()
    lines.append(output.replace("Name", "  ").replace("Size", "").replace("Description", ""))
    lines.append("")

    models = data.get("models", {})
    model_items = models.get("items", [])
    downloaded_models = [m for m in model_items if m.get("downloaded")]

    lines.append("STT Models")
    if downloaded_models:
        t = PrettyTable(["Alias", "Size", "Path"])
        t.border = False
        t.header = False
        for m in downloaded_models:
            path = m.get("path", "N/A") or "N/A"
            t.add_row([m.get("alias", ""), m.get("size_human", "0 B"), path])
        t.align = "l"
        t.align["Size"] = "r"
        output = t.get_string()
        lines.append(output.replace("Alias", "  ").replace("Size", "").replace("Path", ""))
    else:
        lines.append("  (no models downloaded)")
    lines.append("")

    voices = data.get("voices", {})
    voice_items = voices.get("items", [])
    downloaded_voices = [v for v in voice_items if v.get("downloaded") and v.get("provider") != "system"]

    lines.append("TTS Voices")
    if downloaded_voices:
        t = PrettyTable(["Alias", "Provider", "Size", "Path"])
        t.border = False
        t.header = False
        for v in downloaded_voices:
            path = v.get("path", "N/A") or "N/A"
            t.add_row([v.get("alias", ""), v.get("provider", ""), v.get("size_human", "0 B"), path])
        t.align = "l"
        t.align["Provider"] = "l"
        t.align["Size"] = "r"
        output = t.get_string()
        lines.append(output.replace("Alias", "  ").replace("Provider", "").replace("Size", "").replace("Path", ""))
    else:
        lines.append("  (no voices downloaded)")
    lines.append("")

    totals = data.get("totals", {})
    grand_total = totals.get("grand_total_human", "0 B")
    t = PrettyTable(["Total Storage Used", "Size"])
    t.border = False
    t.header = False
    t.add_row(["", grand_total])
    t.align = "l"
    t.align["Size"] = "r"
    lines.append(t.get_string())

    return "\n".join(lines)


if __name__ == "__main__":
    json_input = sys.stdin.read()
    print(format_storage_table(json_input))
