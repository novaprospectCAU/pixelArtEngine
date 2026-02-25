import { spawn } from "node:child_process";

export type FfmpegOptions = {
  ffmpegBin?: string;
  onStderr?: (line: string) => void;
};

export function runFfmpeg(args: string[], options: FfmpegOptions = {}): Promise<void> {
  const ffmpegBin = options.ffmpegBin ?? "ffmpeg";

  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegBin, args, {
      stdio: ["ignore", "pipe", "pipe"]
    });

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      options.onStderr?.(String(chunk));
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg exited with code ${code}`));
      }
    });
  });
}

export async function extractFrames(inputPath: string, outputPattern: string): Promise<void> {
  await runFfmpeg(["-i", inputPath, "-vsync", "0", outputPattern]);
}

export async function encodeVideo(inputPattern: string, outputPath: string, fps: number): Promise<void> {
  await runFfmpeg([
    "-framerate",
    String(fps),
    "-i",
    inputPattern,
    "-pix_fmt",
    "yuv420p",
    outputPath
  ]);
}
