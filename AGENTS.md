# Developer Guide

## Building

```bash
# Build core package first
cd packages/core && npm run build

# Then build CLI
cd packages/cli && npm run build

# Link for local testing
cd packages/cli && npm link
```

## Testing

```bash
npm test
```

## Development

```bash
npm run dev
```

## Common Issues

### Build fails with "No matching export"

If you see errors like `No matching export in "src/read-aloud.ts" for import "isKokoroServerRunning"`, check that:
1. The function is exported from the source file
2. The import path is correct for the current project structure

### After modifying CLI source

Run `npm link` in `packages/cli` to reinstall the CLI for local testing.
