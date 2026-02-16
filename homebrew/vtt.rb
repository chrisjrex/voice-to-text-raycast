class Vtt < Formula
  desc "Voice-to-Text CLI tool (self-contained with bundled runtime)"
  homepage "https://github.com/chrisjrex/voice-to-text-raycast"
  version "1.0.0"
  
  # Download architecture-specific runtime
  if Hardware::CPU.arm?
    url "https://github.com/chrisjrex/voice-to-text-raycast/releases/download/v1.0.0/vtt-runtime-3.11.9-macos-arm64.tar.gz"
    sha256 "PLACEHOLDER_SHA256_ARM64"
  else
    url "https://github.com/chrisjrex/voice-to-text-raycast/releases/download/v1.0.0/vtt-runtime-3.11.9-macos-x86_64.tar.gz"
    sha256 "PLACEHOLDER_SHA256_X86_64"
  end
  
  license "MIT"
  
  depends_on "node"
  
  resource "vtt-cli" do
    url "https://registry.npmjs.org/@vtt/cli/-/cli-1.0.0.tgz"
    sha256 "PLACEHOLDER_NPM_SHA256"
  end
  
  def install
    # Install runtime to libexec
    (libexec/"runtime").install Dir["*"]
    
    # Download and install npm package
    resource("vtt-cli").stage do
      system "npm", "install", "-g", "@vtt/cli", "--prefix", libexec
    end
    
    # Create wrapper script that sets up paths
    (bin/"vtt").write <<~EOS
      #!/bin/bash
      export VTT_RUNTIME_PATH="#{libexec}/runtime"
      exec "#{libexec}/bin/vtt" "$@"
    EOS
    chmod 0755, bin/"vtt"
    
    # Create uninstall script
    (bin/"vtt-uninstall").write <<~EOS
      #!/bin/bash
      echo "Removing VTT data directory..."
      rm -rf "$HOME/.local/share/vtt"
      echo "Run 'brew uninstall vtt' to remove the package"
    EOS
    chmod 0755, bin/"vtt-uninstall"
  end
  
  def caveats
    <<~EOS
      VTT (bundled) has been installed!
      
      This version includes:
      - Python 3.11 runtime
      - All required Python packages
      - sox binary
      
      Quick start:
        vtt doctor              # Check installation
        vtt models list         # List available models
        vtt models download whisper-tiny
        vtt voices list         # List available voices
        vtt voices download Heart
        vtt transcribe          # Start transcribing
      
      Configuration directory: ~/.local/share/vtt
      
      To uninstall completely (including data):
        vtt-uninstall
        brew uninstall vtt
    EOS
  end
  
  test do
    system "#{bin}/vtt", "--version"
    system "#{bin}/vtt", "doctor"
  end
end
