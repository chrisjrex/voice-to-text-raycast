class VttLite < Formula
  desc "Voice-to-Text CLI tool (lite version - requires system dependencies)"
  homepage "https://github.com/chrisjrex/voice-to-text-raycast"
  version "1.0.0"
  
  # For local testing, use --build-from-source flag
  # To update SHA256: shasum -a 256 <file>
  
  url "https://registry.npmjs.org/@vtt/cli-lite/-/cli-lite-#{version}.tgz"
  sha256 "0000000000000000000000000000000000000000000000000000000000000000"
  
  license "MIT"
  
  depends_on "node"
  depends_on "sox"
  depends_on "python@3.11"
  
  def install
    system "npm", "install", "-g", "@vtt/cli-lite@#{version}", "--prefix", libexec
    
    # Create wrapper that checks dependencies
    (bin/"vtt").write <<~EOS
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
        echo "ℹ️  Install prettytable for 'vtt storage' command: pip3 install prettytable"
        echo ""
      fi
      
      exec "#{libexec}/bin/vtt" "$@"
    EOS
    chmod 0755, bin/"vtt"
    
    # Create uninstall script
    (bin/"vtt-uninstall").write <<~EOS
      #!/bin/bash
      echo "Removing VTT data directory..."
      rm -rf "$HOME/.local/share/vtt"
      rm -rf "$HOME/.cache/VoiceToText"
      echo "Run 'brew uninstall vtt-lite' to remove the package"
    EOS
    chmod 0755, bin/"vtt-uninstall"
  end
  
  def caveats
    <<~EOS
      VTT Lite has been installed!
      
      IMPORTANT: You need to install Python packages manually.
      
      Speech-to-Text (pick one or both):
        pip3 install mlx-whisper      # Multilingual
        pip3 install parakeet-mlx     # English-only, faster
      
      Text-to-Speech (optional):
        pip3 install piper-tts        # Lightweight TTS
        pip3 install kokoro           # High quality TTS (requires Python 3.10-3.12)
      
      For 'vtt storage' command:
        pip3 install prettytable
      
      Quick start:
        vtt doctor              # Check installation
        vtt models list         # List available models
        vtt models download whisper-tiny
        vtt voices list         # List available voices
        vtt voices download Heart --engine piper
        vtt transcribe record   # Start transcribing
        vtt speak "Hello" --engine system
      
      Configuration directory: ~/.cache/VoiceToText
      
      To switch to the bundled version (includes everything):
        brew uninstall vtt-lite
        brew install vtt
      
      To uninstall completely (including data):
        vtt-uninstall
        brew uninstall vtt-lite
    EOS
  end
  
  test do
    system "#{bin}/vtt", "--version"
  end
end
