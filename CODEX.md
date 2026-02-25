# Pixel Conversion Engine + Asset Pipeline UI

## Product Shape (P0 Baseline)
- Desktop app: Electron + Vite + React + Zustand + Tailwind
- Shared Core: TypeScript packages used by Desktop and CLI
- Local media pipeline: ffmpeg wrapper for image/video conversion in Desktop and CLI

## UX Spec (Locked)
### Layout
- Single scrolling 2-column job matrix
- Left column: input queue controls per row
- Right column: output preview/result per same row
- Row rendering: one row = two cells (`input`, `output`) to guarantee equal heights and avoid dual-scroll sync complexity

### Top actions
- `Add Files`
- `Output Folder`
- `Convert Selected`
- `Convert All Included`
- `Cancel`
- `Clear Completed`
- Concurrency selector (`1..4`, default `2`)

### Modes
- `Global settings` (default)
- `Per-item override` (selected job only)

### Job lifecycle
`idle -> queued -> processing -> done | error | canceled`

## Data Model
```ts
type JobStatus = "idle" | "queued" | "processing" | "done" | "error" | "canceled";

type PixelConfig = {
  grid: number;
  palette: number;
  dither: "none" | "bayer" | "floyd";
  trim: boolean;
  alphaThreshold: number;
  outline: boolean;
  scale: number;
  fps?: number;
  outputFormat?: "png" | "svg" | "mp4" | "webm";
  alphaMask?: boolean;
  spritesheet?: boolean;
};

type Job = {
  id: string;
  inputPath: string;
  type: "image" | "svg" | "video";
  enabled: boolean;
  order: number;
  configMode: "global" | "local";
  localConfig?: PixelConfig;
  status: JobStatus;
  progress: number;
  output?: {
    primaryPath: string;
    extras?: string[];
    previewUrl?: string;
  };
  errorMessage?: string;
};
```

## Monorepo Structure
```txt
pixel-engine/
  apps/
    desktop/
    cli/
  packages/
    core/
    queue/
    ffmpeg/
```

## IPC Contract (P0)
- `dialog:pickFiles() -> string[]`
- `dialog:pickOutputDir() -> string | null`
- `jobs:start(payload) -> string[]`
- `jobs:cancel(jobId?) -> boolean`
- `jobs:setConcurrency(n) -> number`
- `shell:openPath(path) -> void`
- event stream: `jobs:event`

### IPC Payload Signatures
```ts
type StartJobPayload = {
  id: string;
  inputPath: string;
  type: "image" | "svg" | "video";
  config: PixelConfig;
};

type StartConversionPayload = {
  jobs: StartJobPayload[];
  outputDir: string;
};

type JobEvent =
  | { type: "queued"; jobId: string }
  | { type: "start"; jobId: string }
  | { type: "progress"; jobId: string; progress: number }
  | { type: "done"; jobId: string; result: JobOutput }
  | { type: "error"; jobId: string; message: string }
  | { type: "canceled"; jobId: string }
  | { type: "idle" };
```

## Desktop Component Tree (P0)
```txt
App
  Toolbar
  JobMatrix
    JobRow (input cell + output cell)
  ConfigPanel
```

## Zustand Store Shape (P0)
```ts
{
  jobs: Job[];
  selectedJobId: string | null;
  editorMode: "global" | "local";
  globalConfig: PixelConfig;
  outputDir: string;
  concurrency: number;
  actions: addPaths/removeJob/reorderJobs/toggleEnabled/...
}
```

## P0 Tickets
1. Workspace scaffold and package boundaries
2. Core type model + placeholder converter API
3. Queue with concurrency + cancel + progress event bus
4. Desktop 2-column row-matched UI + drag/drop + reorder + include/exclude
5. IPC bridge + main-process queue orchestration
6. CLI entry using shared core

## P1 Backlog
- Video spritesheet/meta/alpha-mask generation UI
- Folder drop + watch mode
- Real pixelization algorithm and ffmpeg frame graph integration
