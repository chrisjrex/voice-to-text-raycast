class VttLite < Formula
  desc "Voice-to-Text CLI tool (lite version - requires system dependencies)"
  homepage "https://github.com/chrisjrex/voice-to-text-raycast"
  version "1.0.0"
  
  url "https://registry.npmjs.org/@vtt/cli-lite/-/cli-lite-1.0.0.tgz"
  sha256 "PLACEHOLDER_SHA256"
  
  license "MIT"
  
  depends_on "node"
  depends_on "sox"
  depends_on "python@3.11"
  
  def install
    system "npm", "install", "-g", "@vtt/cli-lite", "--prefix", libexec
    
    # Create wrapper that ensures Python packages are available
    (bin/"vtt").write <<~EOS
      #!/bin/bash
      
      # Check for required Python packages
      PYTHON="#{Formula["python@3.11"].opt_bin}/python3"
      
      check_pkg() {
        $PYTHON -c "import $1" 2>/dev/null
      }
      
      # Warn if packages not installed
      if ! check_pkg mlx_whisper && ! check_pkg parakeet_mlx; then
        echo "⚠️  Warning: No STT engine installed."
        echo "   Install one with: pip3 install mlx-whisper"
        echo "   Or: pip3 install parakeet-mlx"
        echo ""
      fi
      
      if ! check_pkg piper; then
        echo "⚠️  Warning: Piper TTS not installed."
        echo "   Install with: pip3 install piper-tts"
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
      echo "Run 'brew uninstall vtt-lite' to remove the package"
    EOS
    chmod 0755, bin/"vtt-uninstall"
  end
  
  def caveats
    <<~EOS
      VTT Lite has been installed!
      
      ⚠️  IMPORTANT: You need to install Python packages manually:
      
      Speech-to-Text (pick one or both):
        pip3 install mlx-whisper      # Multilingual
        pip3 install parakeet-mlx     # English-only, faster
      
      Text-to-Speech (optional):
        pip3 install piper-tts        # Lightweight TTS
      
      Kokoro TTS (optional, requires Python 3.11):
        python3.11 -m venv ~/.local/lib-kokoro/venv
        ~/.local/lib-kokoro/venv/bin/pip install kokoro soundfile numpy
      
      Quick start:
        vtt doctor              # Check installation
        vtt models list         # List available models
        vtt models download whisper-tiny
        vtt voices list         # List available voices
        vtt voices download Heart
        vtt transcribe          # Start transcribing
      
      Configuration directory: ~/.local/share/vtt
      
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
    system "#{bin}/vtt", "doctor"
  end
end
