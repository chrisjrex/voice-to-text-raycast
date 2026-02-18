#!/usr/bin/env node
/**
 * Bundle runtime script - downloads or copies runtime tarball for embedding
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const RUNTIME_URL = 'https://github.com/chrisjrex/voice-to-text-raycast/releases/download/v1.0.0/vtt-runtime-3.11.9-macos-arm64.tar.gz';
const RUNTIME_FILE = 'vtt-runtime-3.11.9-macos-arm64.tar.gz';
const DIST_DIR = path.join(__dirname, '..', 'dist');
const ASSETS_DIR = path.join(__dirname, '..', 'assets');

async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Follow redirect
        downloadFile(response.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', reject);
  });
}

async function main() {
  const destPath = path.join(DIST_DIR, 'runtime.tar.gz');
  
  // Check if runtime already exists in assets
  const assetsRuntime = path.join(ASSETS_DIR, RUNTIME_FILE);
  if (fs.existsSync(assetsRuntime)) {
    console.log('Using runtime from assets:', assetsRuntime);
    fs.copyFileSync(assetsRuntime, destPath);
    console.log('Runtime bundled to:', destPath);
    return;
  }
  
  // Check if runtime exists in dist already
  if (fs.existsSync(destPath)) {
    console.log('Runtime already bundled:', destPath);
    return;
  }
  
  // Try to download from GitHub releases
  console.log('Downloading runtime from GitHub releases...');
  console.log('URL:', RUNTIME_URL);
  
  try {
    await downloadFile(RUNTIME_URL, destPath);
    console.log('Runtime downloaded and bundled to:', destPath);
  } catch (error) {
    console.error('Failed to download runtime:', error.message);
    console.error('\nPlease manually download the runtime and place it in assets/:');
    console.error('  ' + RUNTIME_URL);
    console.error('\nOr place it at:', destPath);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
