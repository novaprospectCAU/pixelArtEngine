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

Local `ffmpeg`/`ffprobe` binaries must be available in `PATH`.

CLI (single file):
```bash
npm run dev:cli -- ./sample/input.png --out ./outputs
```

CLI (batch files/folders):
```bash
npm run dev:cli -- ./assets ./clips --out ./outputs --concurrency 2 --grid 16 --scale 4 --alpha-threshold 8
```

CLI (watch mode):
```bash
npm run dev:cli -- ./assets --watch --out ./outputs
```

## Commands
- `npm run dev:desktop`
- `npm run dev:cli -- <input-file> [--out <output-dir>]`
- `npm run typecheck`
- `npm run build`
- `npm run test`

## Current P0 Status
- Monorepo and package boundaries are set.
- Desktop UI has 2-column row-matched queue/result rendering.
- Drag/drop, reorder, include/exclude, global/per-item config editing are wired.
- IPC + queue + progress events are connected.
- Core conversion path is wired to local ffmpeg for image/video processing and queue progress events.

See [CODEX.md](./CODEX.md) for full implementation spec and tickets.
