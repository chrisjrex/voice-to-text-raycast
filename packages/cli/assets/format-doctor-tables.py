#!/usr/bin/env python3
import json
import sys
from prettytable import PrettyTable

def main():
    data = json.load(sys.stdin)
    
    # Runtime table
    runtime = data.get("runtime", {})
    runtime_type = runtime.get("type", "unknown")
    runtime_type_display = {
        "bundled": "Bundled (self-contained)",
        "system": "System",
        "custom": "Custom (env override)"
    }.get(runtime_type, runtime_type) or runtime_type
    
    runtime_type_value = "✓ " + runtime_type_display if runtime_type != "system" else runtime_type_display
    
    runtime_table = PrettyTable()
    runtime_table.border = False
    runtime_table.header = False
    runtime_table.field_names = ["Runtime", "Value"]
    runtime_table.align["Runtime"] = "l"
    runtime_table.align["Value"] = "l"
    runtime_table.add_row(["Python", runtime.get("python", "")])
    runtime_table.add_row(["Sox", runtime.get("sox", "")])
    runtime_table.add_row(["Data", runtime.get("data_dir", "")])
    
    # Dependencies table
    deps = data.get("dependencies", {})
    system = deps.get("system", {})
    engines = deps.get("engines", {})
    
    deps_table = PrettyTable()
    deps_table.border = False
    deps_table.header = False
    deps_table.field_names = ["Dependencies", "Installed"]
    deps_table.align["Dependencies"] = "l"
    deps_table.align["Installed"] = "c"
    deps_table.add_row(["Sox", "✓" if system.get("sox") else "✗"])
    deps_table.add_row(["afplay", "✓" if system.get("afplay") else "✗"])
    deps_table.add_row(["say", "✓" if system.get("say") else "✗"])
    
    # STT table
    stt_table = PrettyTable()
    stt_table.border = False
    stt_table.header = True
    stt_table.field_names = ["Engine", "installed", "Models"]
    stt_table.align["Engine"] = "l"
    stt_table.align["Status"] = "c"
    stt_table.align["Models"] = "c"
    stt_engines = engines.get("whisper")
    parakeet_engines = engines.get("parakeet")
    stt_table.add_row(["Whisper", "✓" if stt_engines else "✗", data.get("models", {}).get("whisper", 0)])
    stt_table.add_row(["Parakeet", "✓" if parakeet_engines else "✗", data.get("models", {}).get("parakeet", 0)])
    
    # TTS table
    piper = engines.get("piper", {})
    kokoro = engines.get("kokoro", {})
    piper_status = "✓" if piper.get("available") else "✗"
    kokoro_status = "✓" if kokoro.get("available") else "✗"
    if kokoro.get("server_running"):
        kokoro_status += " (server)"
    
    tts_table = PrettyTable()
    tts_table.border = False
    tts_table.header = True
    tts_table.field_names = ["Engine", "installed", "Voices"]
    tts_table.align["Engine"] = "l"
    tts_table.align["Status"] = "c"
    tts_table.align["Voices"] = "c"
    tts_table.add_row(["Piper", piper_status, piper.get("voices", 0)])
    tts_table.add_row(["Kokoro", kokoro_status, kokoro.get("voices", 0)])
    
    # Services table
    playback = data.get("playback", {})
    playback_status = f"Active (PID: {playback['pid']})" if playback.get("active") else "Stopped"
    
    services_table = PrettyTable()
    services_table.border = False
    services_table.header = False
    services_table.field_names = ["Service", "Status"]
    services_table.align["Service"] = "l"
    services_table.align["Status"] = "l"
    services_table.add_row(["Playback", playback_status])
    services_table.add_row(["Kokoro Server", "Running" if kokoro.get("server_running") else "Not running"])
    
    # Environment variables table
    env_vars = data.get("environment")
    env_table = None
    if env_vars:
        env_table = PrettyTable()
        env_table.border = False
        env_table.header = False
        env_table.field_names = ["VTT_", "Value"]
        env_table.align["VTT_"] = "l"
        env_table.align["Value"] = "l"
        for key, value in env_vars.items():
            env_table.add_row([key, value])
    
    print("Runtime:")
    print(runtime_table)
    
    if env_table:
        print()
        print("Env Variables:")
        print(env_table)
    
    print()
    print("Dependencies:")
    print(deps_table)
    print()
    print("Speech-to-Text:")
    print(stt_table)
    print()
    print("Text-to-Speech:")
    print(tts_table)
    print()
    print("Background Services:")
    print(services_table)

if __name__ == "__main__":
    main()
