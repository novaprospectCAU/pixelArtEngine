import type { AssetType, JobOutput, PixelConfig } from "@pixel/core";

export type StartJobPayload = {
  id: string;
  inputPath: string;
  type: AssetType;
  config: PixelConfig;
};

export type StartConversionPayload = {
  jobs: StartJobPayload[];
  outputDir: string;
};

export type JobEvent =
  | { type: "queued"; jobId: string }
  | { type: "start"; jobId: string }
  | { type: "progress"; jobId: string; progress: number }
  | { type: "done"; jobId: string; result: JobOutput }
  | { type: "error"; jobId: string; message: string }
  | { type: "canceled"; jobId: string }
  | { type: "idle" };

export type PixelBridge = {
  pickFiles: () => Promise<string[]>;
  pickOutputDir: () => Promise<string | null>;
  expandPaths: (paths: string[]) => Promise<string[]>;
  startConversion: (payload: StartConversionPayload) => Promise<string[]>;
  cancel: (jobId?: string) => Promise<boolean>;
  setConcurrency: (count: number) => Promise<number>;
  openPath: (targetPath: string) => Promise<void>;
  onJobEvent: (callback: (event: JobEvent) => void) => () => void;
};
