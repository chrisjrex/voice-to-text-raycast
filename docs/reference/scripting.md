# Piping and Scripting

Use VoiceKit in shell scripts and pipelines for automation.

## Basic Piping

### Pipe Text to Speech

```bash
# Echo to speech
echo "Hello world" | voicekit speak

# Date to speech
date | voicekit speak

# Command output to speech
whoami | voicekit speak
```

### Pipe Transcription Output

```bash
# Save transcription to file
voicekit transcribe --format raw > transcription.txt

# Transcribe and search
voicekit transcribe --format raw | grep "important"

# Transcribe and process with jq
voicekit transcribe --format json | jq -r '.text'
```

## Scripting Examples

### Audio Notifications

```bash
#!/bin/bash

# Alert when long command finishes
long_running_command && voicekit speak "Task completed successfully" -v Samantha

# Alert on error
if ! make build; then
    voicekit speak "Build failed!" -v Samantha
    exit 1
fi
```

### Health Checks

```bash
#!/bin/bash

# Check if VoiceKit is ready
if voicekit doctor --json | jq -e '.engines.whisper.available' > /dev/null; then
    echo "Whisper is ready"
    voicekit speak "VoiceKit is ready" -v Heart
else
    echo "Whisper not available"
    voicekit speak "VoiceKit setup incomplete" -v Samantha
fi
```

### File Processing

```bash
#!/bin/bash

# Read multiple files
for file in *.txt; do
    echo "Reading $file"
    voicekit speak "Now reading $file" -v Heart
    voicekit speak -f "$file" --speed 1.2
done
```

### Batch Transcription

```bash
#!/bin/bash

# Transcribe all audio files in directory
for audio in *.wav *.mp3; do
    if [ -f "$audio" ]; then
        output="${audio%.*}.txt"
        echo "Transcribing $audio..."
        voicekit transcribe --input "$audio" --format raw > "$output"
        echo "Saved to $output"
    fi
done
```

## Advanced Pipelines

### Transcribe and Analyze

```bash
# Transcribe meeting and extract action items
voicekit transcribe --format raw | \
    grep -i "action\|todo\|task" | \
    tee action-items.txt
```

### Text-to-Speech with Preprocessing

```bash
# Read file, filter, then speak
cat document.txt | \
    grep -v "^#" | \
    sed 's/^[[:space:]]*//' | \
    voicekit speak --speed 1.2
```

### VoiceKit in CI/CD

```bash
#!/bin/bash

# Build with audio feedback
voicekit speak "Starting build" -v Heart

if npm run build; then
    voicekit speak "Build successful" -v Heart
else
    voicekit speak "Build failed" -v Samantha
    exit 1
fi

# Run tests
voicekit speak "Running tests" -v Heart

if npm test; then
    voicekit speak "All tests passed" -v Heart
else
    voicekit speak "Tests failed" -v Samantha
    exit 1
fi
```

## Exit Codes

VoiceKit returns standard exit codes:

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Invalid arguments |
| 130 | Interrupted (Ctrl+C) |

### Using Exit Codes

```bash
#!/bin/bash

# Check if command succeeded
if voicekit speak "Hello"; then
    echo "Speech succeeded"
else
    echo "Speech failed"
fi

# Chain commands
voicekit doctor && voicekit speak "Ready" || voicekit speak "Not ready"
```

## JSON Output

### Doctor JSON

```bash
# Get health status as JSON
voicekit doctor --json | jq '.'

# Check specific component
voicekit doctor --json | jq -r '.engines.whisper.available'

# Filter by status
voicekit doctor --json | jq '.engines | to_entries[] | select(.value.available == false)'
```

### Transcription JSON

```bash
# Get transcription with metadata
voicekit transcribe --format json | jq '.'

# Extract just text
voicekit transcribe --format json | jq -r '.text'

# Get duration
voicekit transcribe --format json | jq -r '.duration'
```

## Automation Examples

### Daily Standup Recorder

```bash
#!/bin/bash

FILENAME="standup-$(date +%Y-%m-%d).txt"

echo "Recording standup notes..."
voicekit speak "Recording standup for $(date +%A)" -v Heart

voicekit transcribe --silence-timeout 5 --format raw > "$FILENAME"

if [ -s "$FILENAME" ]; then
    voicekit speak "Standup recorded" -v Heart
    echo "Saved to $FILENAME"
else
    voicekit speak "No speech detected" -v Samantha
fi
```

### Pomodoro Timer

```bash
#!/bin/bash

WORK_MINUTES=25
BREAK_MINUTES=5

voicekit speak "Starting Pomodoro timer" -v Heart

# Work session
sleep ${WORK_MINUTES}m
voicekit speak "Work session complete. Take a break." -v Heart

# Break session
sleep ${BREAK_MINUTES}m
voicekit speak "Break over. Back to work." -v Samantha
```

### Smart Home Integration

```bash
#!/bin/bash

# Announce when someone arrives
if ping -c 1 phone.local > /dev/null 2>&1; then
    voicekit speak "Welcome home!" -v Heart
fi

# Announce time every hour
while true; do
    sleep 3600
    voicekit speak "It is now $(date +%I:%M%p)" -v Heart
done
```

## Best Practices

### Error Handling

```bash
#!/bin/bash
set -e  # Exit on error

# Always check if VoiceKit is available
if ! command -v voicekit &> /dev/null; then
    echo "VoiceKit not installed"
    exit 1
fi

# Check health before operations
if ! voicekit doctor > /dev/null 2>&1; then
    echo "VoiceKit not properly configured"
    exit 1
fi
```

### Resource Management

```bash
#!/bin/bash

# Start Kokoro server for batch operations
voicekit server start

# Do batch work
for i in {1..10}; do
    voicekit speak "Message $i" -v Heart
done

# Clean up
voicekit server stop
```

### Logging

```bash
#!/bin/bash

LOGFILE="voicekit-$(date +%Y%m%d).log"

# Log all output
{
    echo "$(date): Starting VoiceKit script"
    voicekit doctor
    voicekit speak "Script started" -v Heart
} >> "$LOGFILE" 2>&1
```
