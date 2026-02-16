#!/bin/bash
# Build script for cli-lite
# Copies source from cli package and builds

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

echo "Building @vtt/cli-lite..."

# Ensure cli source exists
if [ ! -d "../cli/src" ]; then
    echo "Error: ../cli/src not found. Run this from packages/cli-lite/"
    exit 1
fi

# Copy source files from cli (lite version shares same code)
echo "Copying source from cli package..."
rsync -av --delete ../cli/src/ ./src/ 2>/dev/null || cp -r ../cli/src/* ./src/

# Install dependencies
echo "Installing dependencies..."
npm install

# Build TypeScript
echo "Compiling TypeScript..."
npm run build

echo "Build complete!"
echo "Package: @vtt/cli-lite"
echo "Binary: ./dist/index.js"
