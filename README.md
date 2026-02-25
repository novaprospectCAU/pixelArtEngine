# Pixel Art Engine

Desktop-first pixel conversion engine scaffold with shared core and CLI.

## Stack
- Electron + Vite + React + Zustand + Tailwind (`apps/desktop`)
- Shared TS packages (`packages/core`, `packages/queue`, `packages/ffmpeg`)
- CLI wrapper (`apps/cli`)

## Quick Start
```bash
npm install
npm run dev:desktop
```

CLI (single file):
```bash
npm run dev:cli -- ./sample/input.png --out ./outputs
```

## Commands
- `npm run dev:desktop`
- `npm run dev:cli -- <input-file> [--out <output-dir>]`
- `npm run typecheck`
- `npm run build`

## Current P0 Status
- Monorepo and package boundaries are set.
- Desktop UI has 2-column row-matched queue/result rendering.
- Drag/drop, reorder, include/exclude, global/per-item config editing are wired.
- IPC + queue + progress events are connected.
- Core conversion currently uses placeholder copy flow for end-to-end wiring.

See [CODEX.md](./CODEX.md) for full implementation spec and tickets.
