#!/bin/bash
#
# VTT CLI Installer
# Downloads and installs VTT CLI with bundled runtime
#

set -e

REPO="chrisjrex/voice-to-text-raycast"
VERSION="${VTT_VERSION:-1.0.0}"
INSTALL_DIR="${VTT_INSTALL_DIR:-$HOME/.local}"
BIN_DIR="$INSTALL_DIR/bin"
SHARE_DIR="$INSTALL_DIR/share/vtt"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "VTT CLI Installer"
echo "=================="
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
echo "Downloading VTT CLI..."
CLI_URL="https://github.com/$REPO/releases/download/v$VERSION/vtt-cli-$VERSION.tgz"
curl -sSL "$CLI_URL" -o "/tmp/vtt-cli-$VERSION.tgz"

# Download runtime  
echo "Downloading VTT Runtime..."
RUNTIME_URL="https://github.com/$REPO/releases/download/v$VERSION/vtt-runtime-3.11.9-macos-arm64.tar.gz"
curl -sSL "$RUNTIME_URL" -o "/tmp/vtt-runtime.tar.gz"

# Extract CLI
echo "Installing CLI..."
cd /tmp
tar xzf "vtt-cli-$VERSION.tgz" 2>/dev/null || true

# Extract runtime
echo "Extracting runtime (this may take a minute)..."
tar xzf "/tmp/vtt-runtime.tar.gz" -C "$SHARE_DIR"

# Create wrapper script
cat > "$BIN_DIR/vtt" << 'EOF'
#!/bin/bash
# VTT CLI wrapper - uses bundled runtime
export VTT_PYTHON_PATH="$HOME/.local/share/vtt/runtime/bin/python3"
export VTT_SOX_PATH="$HOME/.local/share/vtt/runtime/bin/sox"
exec node "$HOME/.local/share/vtt/cli/dist/index.js" "$@"
EOF

chmod +x "$BIN_DIR/vtt"

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

echo "Run 'vtt doctor' to verify the installation"
echo ""

# Cleanup
rm -f "/tmp/vtt-cli-$VERSION.tgz" "/tmp/vtt-runtime.tar.gz" 2>/dev/null || true
