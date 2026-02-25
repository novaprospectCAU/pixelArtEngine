export type JobStatus = "idle" | "queued" | "processing" | "done" | "error" | "canceled";

export type AssetType = "image" | "svg" | "video";

export type PixelConfig = {
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

export type JobOutput = {
  primaryPath: string;
  extras?: string[];
  previewUrl?: string;
};

export type Job = {
  id: string;
  inputPath: string;
  type: AssetType;
  enabled: boolean;
  order: number;
  configMode: "global" | "local";
  localConfig?: PixelConfig;
  status: JobStatus;
  progress: number;
  output?: JobOutput;
  errorMessage?: string;
};

export type ConvertRequest = {
  inputPath: string;
  type: AssetType;
  config: PixelConfig;
  outputDir: string;
  signal?: AbortSignal;
  onProgress?: (progress: number) => void;
};

export type ConvertResult = JobOutput;

export const defaultPixelConfig: PixelConfig = {
  grid: 32,
  palette: 64,
  dither: "bayer",
  trim: false,
  alphaThreshold: 8,
  outline: false,
  scale: 2,
  fps: 24,
  outputFormat: "png",
  alphaMask: false,
  spritesheet: false
};
