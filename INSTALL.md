# Developer Installation

Install this extension from source without the Raycast Store.

## Prerequisites

- [Raycast](https://raycast.com) installed
- [Node.js](https://nodejs.org) 20+
- Apple Silicon Mac (M1 or later)

## Steps

1. Clone the repo:

```bash
git clone https://github.com/chrisjrex/voice-to-text-raycast.git
cd voice-to-text-raycast
```

2. Install dependencies:

```bash
npm install
```

3. Build and add to Raycast:

```bash
npm run dev
```

This opens Raycast with the extension loaded in development mode. The extension stays available in Raycast as long as the source directory exists.

4. Install system dependencies (see [README.md](README.md#installation) for details):

```bash
brew install sox
pip3 install mlx-whisper    # and/or parakeet-mlx
```

5. Open **Manage Models** in Raycast and download at least one STT model.

## Updating

Pull the latest changes and rebuild:

```bash
git pull
npm install
npm run dev
```

## Uninstalling

Remove the extension from Raycast via Settings > Extensions, then delete the cloned directory.
