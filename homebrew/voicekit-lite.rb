class VoicekitLite < Formula
  desc "VoiceKit CLI tool (lite version - requires system dependencies)"
  homepage "https://github.com/chrisjrex/voice-to-text-raycast"
  version "1.0.0"
  license "MIT"

  # Install from GitHub release
  on_macos do
    url "https://github.com/chrisjrex/voice-to-text-raycast/archive/refs/tags/v#{version}.tar.gz"
    sha256 "27b4d0ba80dade4aa155a154a07075ac1ff3c86b8edf959085423ccaf792fd32"
  end

  depends_on "node"
  depends_on "sox"
  depends_on "python@3.11"

  def install
    # Build the packages
    cd "packages" do
      system "npm", "install"
      system "npm", "run", "build"
    end

    # Install CLI globally to libexec
    system "npm", "install", "-g", "./packages/cli", "--prefix", libexec

    # Create wrapper that sets Python path
    (bin/"voicekit").write <<~EOS
      #!/bin/bash

      PYTHON="#{Formula["python@3.11"].opt_bin}/python3"

      # Check for required Python packages and warn if missing
      check_pkg() {
        $PYTHON -c "import $1" 2>/dev/null
      }

      # Check STT engines
      if ! check_pkg mlx_whisper && ! check_pkg parakeet_mlx; then
        echo "⚠️  No STT engine installed."
        echo "   Install one with:"
        echo "     pip3 install mlx-whisper      # Multilingual"
        echo "     pip3 install parakeet-mlx     # English-only, faster"
        echo ""
      fi

      # Check TTS engines
      if ! check_pkg piper && ! check_pkg kokoro; then
        echo "⚠️  No TTS engine installed."
        echo "   Install one with:"
        echo "     pip3 install piper-tts        # Lightweight TTS"
        echo "     pip3 install kokoro           # High quality TTS"
        echo ""
      fi

      # Check prettytable for storage command
      if ! check_pkg prettytable; then
        echo "ℹ️  Install prettytable for 'voicekit storage' command: pip3 install prettytable"
        echo ""
      fi

      export VOICEKIT_PYTHON_PATH="$PYTHON"
      exec "#{libexec}/bin/voicekit" "$@"
    EOS
    chmod 0755, bin/"voicekit"

    # Create uninstall script
    (bin/"voicekit-uninstall").write <<~EOS
      #!/bin/bash
      echo "Removing VoiceKit data directory..."
      rm -rf "$HOME/.local/share/voicekit"
      rm -rf "$HOME/.cache/VoiceKit"
      echo "Run 'brew uninstall voicekit-lite' to remove the package"
    EOS
    chmod 0755, bin/"voicekit-uninstall"
  end

  def caveats
    <<~EOS
      VoiceKit Lite has been installed!

      IMPORTANT: You need to install Python packages manually.

      Speech-to-Text (pick one or both):
        pip3 install mlx-whisper      # Multilingual
        pip3 install parakeet-mlx     # English-only, faster

      Text-to-Speech (optional):
        pip3 install piper-tts        # Lightweight TTS
        pip3 install kokoro           # High quality TTS (requires Python 3.10-3.12)

      For 'voicekit storage' command:
        pip3 install prettytable

      Quick start:
        voicekit doctor              # Check installation
        voicekit models list         # List available models
        voicekit models download whisper-tiny
        voicekit voices list         # List available voices
        voicekit voices download Heart --engine piper
        voicekit transcribe record   # Start transcribing
        voicekit speak "Hello" --engine system

      Configuration directory: ~/.cache/VoiceKit

      To switch to the bundled version (includes everything):
        brew uninstall voicekit-lite
        brew install voicekit

      To uninstall completely (including data):
        voicekit-uninstall
        brew uninstall voicekit-lite
    EOS
  end

  test do
    system "#{bin}/voicekit", "--version"
  end
end
