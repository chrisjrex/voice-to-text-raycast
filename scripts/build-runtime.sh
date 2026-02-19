#!/bin/bash
# Build script for VTT bundled Python runtime using python-build-standalone
# Creates a relocatable Python 3.11 environment with all dependencies

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BUILD_DIR="$PROJECT_ROOT/build"
RUNTIME_DIR="$BUILD_DIR/runtime"
PYTHON_VERSION="3.11"
PYTHON_RELEASE="20260211"
PYTHON_FULL_VERSION="3.11.14"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[BUILD]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

# Detect architecture
ARCH=$(uname -m)
if [ "$ARCH" != "arm64" ] && [ "$ARCH" != "x86_64" ]; then
    error "Unsupported architecture: $ARCH. Only arm64 and x86_64 are supported."
fi

# Map architecture to python-build-standalone naming
if [ "$ARCH" = "arm64" ]; then
    PBS_ARCH="aarch64"
else
    PBS_ARCH="x86_64"
fi

log "Building VTT runtime for macOS $ARCH"
log "Python version: $PYTHON_VERSION"

# Clean previous build
if [ -d "$RUNTIME_DIR" ]; then
    log "Cleaning previous build..."
    rm -rf "$RUNTIME_DIR"
fi

mkdir -p "$RUNTIME_DIR"
cd "$BUILD_DIR"

# Download python-build-standalone
PYTHON_BUILD_NAME="cpython-${PYTHON_FULL_VERSION}+${PYTHON_RELEASE}-${PBS_ARCH}-apple-darwin-install_only"
PYTHON_TARBALL="${PYTHON_BUILD_NAME}.tar.gz"
PYTHON_URL="https://github.com/astral-sh/python-build-standalone/releases/download/${PYTHON_RELEASE}/${PYTHON_TARBALL}"

log "Downloading python-build-standalone ${PYTHON_VERSION}..."
if [ ! -f "$PYTHON_TARBALL" ]; then
    curl -L -o "$PYTHON_TARBALL" "$PYTHON_URL"
fi

# Extract Python
log "Extracting Python..."
tar xzf "$PYTHON_TARBALL" -C "$RUNTIME_DIR" --strip-components=1

# Verify Python works
log "Verifying Python installation..."
"$RUNTIME_DIR/bin/python3" --version || error "Python failed to run"

# Install required packages
log "Installing Python packages..."
export PATH="$RUNTIME_DIR/bin:$PATH"

# Upgrade pip first
python3 -m pip install --upgrade pip setuptools wheel

# Install core dependencies
log "Installing mlx-whisper..."
pip install mlx-whisper

log "Installing parakeet-mlx..."
pip install parakeet-mlx

log "Installing piper-tts..."
pip install piper-tts

log "Installing kokoro and dependencies..."
pip install kokoro soundfile numpy scipy torch transformers

log "Installing prettytable..."
pip install prettytable

# Strip unnecessary files from packages
log "Optimizing package size..."
SITE_PACKAGES="$RUNTIME_DIR/lib/python${PYTHON_VERSION}/site-packages"
find "$SITE_PACKAGES" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
find "$SITE_PACKAGES" -type d -name "*.dist-info" -exec rm -rf {} + 2>/dev/null || true
find "$SITE_PACKAGES" -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true

# Remove unnecessary test files from packages
find "$SITE_PACKAGES" -type d -name "tests" -exec rm -rf {} + 2>/dev/null || true
find "$SITE_PACKAGES" -type d -name "test" -exec rm -rf {} + 2>/dev/null || true

# Clean up Python installation itself
log "Cleaning up unnecessary files..."

# Remove test suite
rm -rf "$RUNTIME_DIR/lib/python${PYTHON_VERSION}/test"
rm -rf "$RUNTIME_DIR/lib/python${PYTHON_VERSION}/lib2to3/tests"

# Remove IDLE and tkinter if present
rm -rf "$RUNTIME_DIR/lib/python${PYTHON_VERSION}/idlelib" 2>/dev/null || true
rm -rf "$RUNTIME_DIR/lib/python${PYTHON_VERSION}/tkinter" 2>/dev/null || true

# Remove development files
rm -rf "$RUNTIME_DIR/include"
rm -f "$RUNTIME_DIR/lib/libpython*.a"

# Create tarball
log "Creating distribution tarball..."
ARCHIVE_NAME="vtt-runtime-${PYTHON_VERSION}-macos-${ARCH}.tar.gz"
cd "$RUNTIME_DIR"
tar czf "$PROJECT_ROOT/$ARCHIVE_NAME" .

# Calculate sizes
RUNTIME_SIZE=$(du -sh "$RUNTIME_DIR" | cut -f1)
ARCHIVE_SIZE=$(du -sh "$PROJECT_ROOT/$ARCHIVE_NAME" | cut -f1)

log "Build complete!"
log "Runtime directory size: $RUNTIME_SIZE"
log "Archive size: $ARCHIVE_SIZE"
log "Archive location: $PROJECT_ROOT/$ARCHIVE_NAME"

# Copy to cli assets for local testing
if [ -d "$PROJECT_ROOT/packages/cli/assets" ]; then
    log "Copying runtime to cli assets..."
    rm -rf "$PROJECT_ROOT/packages/cli/assets/runtime"
    cp -R "$RUNTIME_DIR" "$PROJECT_ROOT/packages/cli/assets/runtime"
    log "Runtime copied to packages/cli/assets/runtime"
fi

# Cleanup
log "Cleaning up build files..."
cd "$PROJECT_ROOT"
rm -rf "$BUILD_DIR"

log "Done!"
