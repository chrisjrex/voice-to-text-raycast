#!/bin/bash
# Build script for VTT bundled Python runtime
# Creates a minimal, portable Python 3.11 environment with all dependencies

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BUILD_DIR="$PROJECT_ROOT/build"
RUNTIME_DIR="$BUILD_DIR/runtime"
PYTHON_VERSION="3.11.9"
PYTHON_SHORT="3.11"

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

log "Building VTT runtime for macOS $ARCH"
log "Python version: $PYTHON_VERSION"

# Clean previous build
if [ -d "$RUNTIME_DIR" ]; then
    log "Cleaning previous build..."
    rm -rf "$RUNTIME_DIR"
fi

mkdir -p "$RUNTIME_DIR"
cd "$BUILD_DIR"

# Download Python from python.org
log "Downloading Python $PYTHON_VERSION..."
PYTHON_PKG="python-${PYTHON_VERSION}-macos11.pkg"
if [ ! -f "$PYTHON_PKG" ]; then
    curl -O "https://www.python.org/ftp/python/${PYTHON_VERSION}/${PYTHON_PKG}"
fi

# Extract Python from package
log "Extracting Python..."
pkgutil --expand-full "$PYTHON_PKG" python_pkg_extracted

# Find the Python framework
PYTHON_FRAMEWORK=$(find python_pkg_extracted -name "Python" -type d | head -1)
if [ -z "$PYTHON_FRAMEWORK" ]; then
    error "Could not find Python framework in package"
fi

# Copy Python to runtime directory
log "Copying Python framework..."
cp -R "$PYTHON_FRAMEWORK" "$RUNTIME_DIR/Python"

# Create bin directory structure
mkdir -p "$RUNTIME_DIR/bin"

# Create symlinks for python executables
ln -sf "../Python/bin/python${PYTHON_SHORT}" "$RUNTIME_DIR/bin/python3"
ln -sf "python3" "$RUNTIME_DIR/bin/python"

# Copy pip
if [ -f "$RUNTIME_DIR/Python/bin/pip${PYTHON_SHORT}" ]; then
    cp "$RUNTIME_DIR/Python/bin/pip${PYTHON_SHORT}" "$RUNTIME_DIR/bin/pip3"
    ln -sf "pip3" "$RUNTIME_DIR/bin/pip"
fi

# Clean up unnecessary files to reduce size
log "Cleaning up unnecessary files..."

# Remove test suite
rm -rf "$RUNTIME_DIR/Python/lib/python${PYTHON_SHORT}/test"
rm -rf "$RUNTIME_DIR/Python/lib/python${PYTHON_SHORT}/lib2to3/tests"

# Remove IDLE and tkinter (not needed for CLI)
rm -rf "$RUNTIME_DIR/Python/lib/python${PYTHON_SHORT}/idlelib"
rm -rf "$RUNTIME_DIR/Python/lib/python${PYTHON_SHORT}/tkinter"
rm -rf "$RUNTIME_DIR/Python/lib/python${PYTHON_SHORT}/turtledemo"

# Remove documentation
rm -rf "$RUNTIME_DIR/Python/share/doc"
rm -rf "$RUNTIME_DIR/Python/share/man"

# Remove development files
rm -rf "$RUNTIME_DIR/Python/include"
rm -f "$RUNTIME_DIR/Python/lib/libpython*.a"

# Remove unnecessary binaries
rm -f "$RUNTIME_DIR/Python/bin/idle"*
rm -f "$RUNTIME_DIR/Python/bin/python${PYTHON_SHORT}-config"

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

# Strip unnecessary files from packages
log "Optimizing package size..."
find "$RUNTIME_DIR/Python/lib/python${PYTHON_SHORT}/site-packages" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
find "$RUNTIME_DIR/Python/lib/python${PYTHON_SHORT}/site-packages" -type d -name "*.dist-info" -exec rm -rf {} + 2>/dev/null || true
find "$RUNTIME_DIR/Python/lib/python${PYTHON_SHORT}/site-packages" -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true

# Remove unnecessary test files from packages
find "$RUNTIME_DIR/Python/lib/python${PYTHON_SHORT}/site-packages" -type d -name "tests" -exec rm -rf {} + 2>/dev/null || true
find "$RUNTIME_DIR/Python/lib/python${PYTHON_SHORT}/site-packages" -type d -name "test" -exec rm -rf {} + 2>/dev/null || true

# Download and build static sox binary
log "Building static sox binary..."
SOX_VERSION="14.4.2"
SOX_DIR="$BUILD_DIR/sox-${SOX_VERSION}"

if [ ! -d "$SOX_DIR" ]; then
    curl -L "https://sourceforge.net/projects/sox/files/sox/${SOX_VERSION}/sox-${SOX_VERSION}.tar.gz/download" -o "sox-${SOX_VERSION}.tar.gz"
    tar xzf "sox-${SOX_VERSION}.tar.gz"
fi

cd "$SOX_DIR"

# Configure with static linking
./configure \
    --prefix="$RUNTIME_DIR" \
    --disable-shared \
    --enable-static \
    --without-ao \
    --without-pulseaudio \
    --without-alsa \
    --without-oss \
    --without-coreaudio \
    --with-ltdl \
    --disable-symlinks \
    CFLAGS="-arch $ARCH" \
    LDFLAGS="-arch $ARCH"

make -j$(sysctl -n hw.ncpu)
make install

cd "$BUILD_DIR"

# Copy sox binary to bin directory
cp "$RUNTIME_DIR/bin/sox" "$RUNTIME_DIR/bin/sox.tmp"
rm -rf "$RUNTIME_DIR/share"
rm -rf "$RUNTIME_DIR/lib/pkgconfig"
mv "$RUNTIME_DIR/bin/sox.tmp" "$RUNTIME_DIR/bin/sox"

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
rm -rf "$BUILD_DIR"

log "Done!"
