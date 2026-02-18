class Vtt < Formula
  desc "Voice-to-Text CLI tool (self-contained with bundled runtime)"
  homepage "https://github.com/chrisjrex/voice-to-text-raycast"
  version "1.0.0"
  
  # For local testing, use --build-from-source flag
  # To update SHA256: shasum -a 256 <file>
  
  # Apple Silicon only (bundled runtime)
  on_macos do
    on_arm do
      url "https://github.com/chrisjrex/voice-to-text-raycast/releases/download/v1.0.0/vtt-runtime-3.11.9-macos-arm64.tar.gz"
      sha256 "0000000000000000000000000000000000000000000000000000000000000000"
    end
    on_intel do
      # Intel users should use vtt-lite
      disable! because: "requires Apple Silicon. Use 'brew install vtt-lite' for Intel Macs."
    end
  end
  
  license "MIT"
  
  depends_on "node"
  
  def install
    # Install runtime to libexec/runtime
    (libexec/"runtime").install Dir["*"]
    
    # Install npm package globally to libexec
    system "npm", "install", "-g", "@vtt/cli@#{version}", "--prefix", libexec
    
    # Create wrapper script that sets up paths to bundled runtime
    (bin/"vtt").write <<~EOS
      #!/bin/bash
      export VTT_PYTHON_PATH="#{libexec}/runtime/bin/python3"
      export VTT_SOX_PATH="#{libexec}/runtime/bin/sox"
      exec "#{libexec}/bin/vtt" "$@"
    EOS
    chmod 0755, bin/"vtt"
    
    # Create uninstall script
    (bin/"vtt-uninstall").write <<~EOS
      #!/bin/bash
      echo "Removing VTT data directory..."
      rm -rf "$HOME/.local/share/vtt"
      rm -rf "$HOME/.cache/VoiceToText"
      echo "Run 'brew uninstall vtt' to remove the package"
    EOS
    chmod 0755, bin/"vtt-uninstall"
  end
  
  def caveats
    <<~EOS
      VTT (bundled) has been installed!
      
      This version includes:
      - Python 3.11 runtime with all required packages
      - sox binary for audio recording
      
      Quick start:
        vtt doctor              # Check installation
        vtt models list         # List available models
        vtt models download whisper-tiny
        vtt voices list         # List available voices
        vtt voices download Heart --engine piper
        vtt transcribe record   # Start transcribing
        vtt speak "Hello" --engine system
      
      Configuration directory: ~/.cache/VoiceToText
      
      To uninstall completely (including data):
        vtt-uninstall
        brew uninstall vtt
    EOS
  end
  
  test do
    system "#{bin}/vtt", "--version"
  end
end
