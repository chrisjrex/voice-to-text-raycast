#!/bin/bash
#
# VoiceKit CLI Installer
# Downloads and installs VoiceKit CLI with bundled runtime
#

set -e

REPO="chrisjrex/voice-to-text-raycast"
VERSION="${VOICEKIT_VERSION:-1.0.0}"
INSTALL_DIR="${VOICEKIT_INSTALL_DIR:-$HOME/.local}"
BIN_DIR="$INSTALL_DIR/bin"
SHARE_DIR="$INSTALL_DIR/share/voicekit"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "VoiceKit CLI Installer"
echo "======================"
echo ""

# Detect architecture
ARCH=$(uname -m)
if [[ "$ARCH" != "arm64" ]]; then
    echo -e "${RED}Error: Only Apple Silicon (arm64) is currently supported${NC}"
    echo "Your architecture: $ARCH"
    exit 1
fi

# Create directories
mkdir -p "$BIN_DIR"
mkdir -p "$SHARE_DIR"

echo "Installing to: $INSTALL_DIR"
echo ""

# Download CLI
echo "Downloading VoiceKit CLI..."
CLI_URL="https://github.com/$REPO/releases/download/v$VERSION/voicekit-cli-$VERSION.tgz"
curl -sSL "$CLI_URL" -o "/tmp/voicekit-cli-$VERSION.tgz"

# Download runtime  
echo "Downloading VoiceKit Runtime..."
RUNTIME_URL="https://github.com/$REPO/releases/download/v$VERSION/voicekit-runtime-3.11-macos-arm64.tar.gz"
curl -sSL "$RUNTIME_URL" -o "/tmp/voicekit-runtime.tar.gz"

# Extract CLI
echo "Installing CLI..."
cd /tmp
tar xzf "voicekit-cli-$VERSION.tgz" 2>/dev/null || true

# Extract runtime
echo "Extracting runtime (this may take a minute)..."
tar xzf "/tmp/voicekit-runtime.tar.gz" -C "$SHARE_DIR"

# Create wrapper script
cat > "$BIN_DIR/voicekit" << 'EOF'
#!/bin/bash
# VoiceKit CLI wrapper - uses bundled runtime
export VOICEKIT_PYTHON_PATH="$HOME/.local/share/voicekit/runtime/bin/python3"
export VOICEKIT_SOX_PATH="$HOME/.local/share/voicekit/runtime/bin/sox"
exec node "$HOME/.local/share/voicekit/cli/dist/index.js" "$@"
EOF

chmod +x "$BIN_DIR/voicekit"

echo ""
echo -e "${GREEN}Installation complete!${NC}"
echo ""

# Check if bin dir is in PATH
if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
    echo -e "${YELLOW}Warning: $BIN_DIR is not in your PATH${NC}"
    echo ""
    echo "Add this to your shell profile (~/.zshrc or ~/.bash_profile):"
    echo "  export PATH=\"$BIN_DIR:\$PATH\""
    echo ""
fi

echo "Run 'voicekit doctor' to verify the installation"
echo ""

# Cleanup
rm -f "/tmp/voicekit-cli-$VERSION.tgz" "/tmp/voicekit-runtime.tar.gz" 2>/dev/null || true
