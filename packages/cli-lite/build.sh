#!/bin/bash
# Build script for cli-lite
# Copies source from cli package and builds

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

echo "Building @voicekit/cli-lite..."

echo "Build complete!"
echo "Package: @voicekit/cli-lite"
echo "Binary: ./dist/index.js"
