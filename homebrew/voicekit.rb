class Voicekit < Formula
  desc "VoiceKit CLI tool (self-contained with bundled runtime)"
  homepage "https://github.com/chrisjrex/voice-to-text-raycast"
  version "1.0.0"

  # For local testing, use --build-from-source flag
  # To update SHA256: shasum -a 256 <file>

  # Apple Silicon only (bundled runtime)
  on_macos do
    on_arm do
      url "https://github.com/chrisjrex/voice-to-text-raycast/releases/download/v1.0.0/voicekit-runtime-3.11.9-macos-arm64.tar.gz"
      sha256 "621bf0363557b0e2e144c016e6494849a330a6d6e66f90d530adc3467748cb98"
    end
    on_intel do
      # Intel users should use voicekit-lite
      disable! because: "requires Apple Silicon. Use 'brew install voicekit-lite' for Intel Macs."
    end
  end

  license "MIT"

  depends_on "node"
  depends_on "sox"

  def install
    # Install runtime to libexec/runtime
    (libexec/"runtime").install Dir["*"]

    # Install npm package globally to libexec
    system "npm", "install", "-g", "@voicekit/cli@#{version}", "--prefix", libexec

    # Create wrapper script that sets up paths to bundled runtime
    (bin/"voicekit").write <<~EOS
      #!/bin/bash
      export VOICEKIT_PYTHON_PATH="#{libexec}/runtime/bin/python3"
      exec "#{libexec}/bin/voicekit" "$@"
    EOS
    chmod 0755, bin/"voicekit"

    # Create uninstall script
    (bin/"voicekit-uninstall").write <<~EOS
      #!/bin/bash
      echo "Removing VoiceKit data directory..."
      rm -rf "$HOME/.local/share/voicekit"
      rm -rf "$HOME/.cache/VoiceKit"
      echo "Run 'brew uninstall voicekit' to remove the package"
    EOS
    chmod 0755, bin/"voicekit-uninstall"
  end

  def caveats
    <<~EOS
      VoiceKit (bundled) has been installed!

      This version includes:
      - Python 3.11 runtime with all required packages (mlx-whisper, parakeet-mlx, piper-tts, kokoro)

      Quick start:
        voicekit doctor              # Check installation
        voicekit models list         # List available models
        voicekit models download whisper-tiny
        voicekit voices list         # List available voices
        voicekit voices download Heart --engine piper
        voicekit transcribe record   # Start transcribing
        voicekit speak "Hello" --engine system

      Configuration directory: ~/.cache/VoiceKit

      To uninstall completely (including data):
        voicekit-uninstall
        brew uninstall voicekit
    EOS
  end

  test do
    system "#{bin}/voicekit", "--version"
  end
end
