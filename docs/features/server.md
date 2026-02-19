# Server Mode (Kokoro)

Start a background server for faster Kokoro text-to-speech.

## Why Use Server Mode?

The Kokoro server provides:
- **Faster response times** - No startup overhead
- **Consistent performance** - Pre-loaded model
- **Better resource management** - Shared model state

## Server Commands

### Start Server

```bash
voicekit server start
```

This starts the Kokoro server in the background.

### Check Status

```bash
voicekit server status
```

Shows:
- Whether server is running
- Process ID (PID)
- Uptime
- Memory usage

### Stop Server

```bash
voicekit server stop
```

Gracefully shuts down the background server.

## How It Works

1. **Without server**: Each `voicekit speak` command loads the Kokoro model (~300MB), generates audio, then unloads
2. **With server**: Model stays loaded in memory, ready for instant use

### Performance Impact

| Scenario | Without Server | With Server |
|----------|---------------|-------------|
| First request | ~3-5 seconds | ~3-5 seconds |
| Subsequent requests | ~3-5 seconds | ~0.5-1 seconds |
| Memory usage | Spikes per request | Constant ~350MB |

## When to Use Server Mode

### Recommended For:

- **Frequent TTS usage** - Many speak commands in a session
- **Interactive applications** - Scripts with multiple voice outputs
- **Development** - Testing voice features repeatedly
- **Accessibility tools** - Screen readers or notification systems

### Not Needed For:

- **Occasional usage** - One-off speak commands
- **Batch processing** - Single long text-to-speech job
- **System/Piper voices** - Only benefits Kokoro

## Integration Examples

### Script with Server

```bash
#!/bin/bash

# Start server if not running
if ! voicekit server status > /dev/null 2>&1; then
    voicekit server start
fi

# Multiple TTS operations (fast with server)
voicekit speak "Starting process" -v Heart
voicekit speak "Step 1 complete" -v Heart
voicekit speak "Step 2 complete" -v Heart
voicekit speak "Process finished" -v Heart

# Optional: stop server when done
# voicekit server stop
```

### Development Workflow

```bash
# Terminal 1: Start server for the day
voicekit server start

# Terminal 2: Run your app/script that uses Kokoro
./my-app.sh

# Many speak commands will be fast now
```

### Auto-start in Scripts

```bash
# Ensure server is running before speaking
ensure_kokoro_server() {
    if ! voicekit server status | grep -q "running"; then
        voicekit server start
        sleep 2  # Wait for startup
    fi
}

# Use it
ensure_kokoro_server
voicekit speak "Hello" -v Heart
```

## Server Management

### Automatic Startup

Add to your shell profile for always-on server:

```bash
# ~/.zshrc
if ! voicekit server status > /dev/null 2>&1; then
    voicekit server start
fi
```

### Checking if Server is Running

```bash
# Check status
voicekit server status

# Or use in scripts
if voicekit server status | grep -q "running"; then
    echo "Server is up"
fi
```

### Restart Server

```bash
# Stop and start
voicekit server stop && voicekit server start

# Or use doctor to check health
voicekit doctor
```

## Troubleshooting

**Issue:** Server won't start
- **Solution:** Check `voicekit doctor` for Kokoro availability

**Issue:** Server not visible in Activity Monitor
- **Solution:** Install setproctitle: `pip3 install setproctitle`

**Issue:** Slow even with server
- **Solution:** Server may have stopped, check status and restart

**Issue:** Port conflicts
- **Solution:** Server uses local socket, shouldn't conflict

## Resource Usage

- **Memory**: ~350MB (Kokoro model loaded)
- **CPU**: Minimal when idle
- **Startup time**: ~3-5 seconds
- **Response time**: ~0.5-1 seconds per request

## Tips

- Start server at the beginning of your work session
- Leave it running for repeated TTS tasks
- Stop it when done to free memory
- Use `voicekit doctor` to verify server health
- Server only benefits Kokoro voices (System/Piper unaffected)
