import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import type { ConvertRequest, ConvertResult, PixelConfig } from "@pixel/core";

const execFileAsync = promisify(execFile);

export type FfmpegOptions = {
  ffmpegBin?: string;
  signal?: AbortSignal;
  onStderrLine?: (line: string) => void;
};

export type FfprobeOptions = {
  ffprobeBin?: string;
};

export type ConvertWithFfmpegOptions = ConvertRequest & {
  ffmpegBin?: string;
  ffprobeBin?: string;
};

type FilterSpec =
  | {
      args: ["-vf", string];
    }
  | {
      args: ["-filter_complex", string, "-map", "[vout]"];
    };

function abortError(): Error {
  const error = new Error("Conversion canceled");
  error.name = "AbortError";
  return error;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function formatOutputByType(type: ConvertRequest["type"], config: PixelConfig): "png" | "svg" | "mp4" | "webm" {
  if (type === "video") {
    if (config.outputFormat === "webm") {
      return "webm";
    }
    return "mp4";
  }

  if (type === "svg" && config.outputFormat === "svg") {
    return "svg";
  }

  return "png";
}

function ditherMode(dither: PixelConfig["dither"]): string {
  if (dither === "floyd") {
    return "floyd_steinberg";
  }
  if (dither === "bayer") {
    return "bayer:bayer_scale=2";
  }
  return "none";
}

function createBaseFilter(config: PixelConfig, isVideo: boolean): string {
  const grid = clamp(Math.floor(config.grid || 32), 1, 512);
  const scale = clamp(Math.floor(config.scale || 1), 1, 16);
  const alphaThreshold = clamp(Math.floor(config.alphaThreshold || 0), 0, 255);

  const parts: string[] = [
    `scale=max(1\\,trunc(iw/${grid})):max(1\\,trunc(ih/${grid})):flags=neighbor`
  ];

  if (scale > 1) {
    parts.push(`scale=iw*${scale}:ih*${scale}:flags=neighbor`);
  }

  if (alphaThreshold > 0) {
    parts.push("format=rgba");
    parts.push(`lut=a='if(lt(val\\,${alphaThreshold})\\,0\\,255)'`);
  }

  // ffmpeg trim by transparency needs probe+2pass. Keep deterministic even-dimension crop for codecs.
  if (config.trim || isVideo) {
    parts.push("crop=iw-mod(iw\\,2):ih-mod(ih\\,2)");
  }

  if (isVideo) {
    const fps = clamp(Math.floor(config.fps || 24), 1, 120);
    parts.push(`fps=${fps}`);
    parts.push("pad=ceil(iw/2)*2:ceil(ih/2)*2");
  }

  return parts.join(",");
}

function buildFilterSpec(config: PixelConfig, isVideo: boolean): FilterSpec {
  const baseFilter = createBaseFilter(config, isVideo);
  const palette = clamp(Math.floor(config.palette || 256), 2, 256);

  if (palette >= 256) {
    return {
      args: ["-vf", baseFilter]
    };
  }

  const complexFilter = [
    `[0:v]${baseFilter},split=2[pix][pal]`,
    `[pal]palettegen=max_colors=${palette}:reserve_transparent=1[palette]`,
    `[pix][palette]paletteuse=dither=${ditherMode(config.dither)}[vout]`
  ].join(";");

  return {
    args: ["-filter_complex", complexFilter, "-map", "[vout]"]
  };
}

function splitLines(buffer: string): { lines: string[]; rest: string } {
  const chunks = buffer.split(/\r?\n/);
  const rest = chunks.pop() ?? "";
  return {
    lines: chunks.filter((line) => line.length > 0),
    rest
  };
}

export function runFfmpeg(args: string[], options: FfmpegOptions = {}): Promise<void> {
  const ffmpegBin = options.ffmpegBin ?? "ffmpeg";

  return new Promise((resolve, reject) => {
    if (options.signal?.aborted) {
      reject(abortError());
      return;
    }

    const child = spawn(ffmpegBin, args, {
      stdio: ["ignore", "pipe", "pipe"]
    });

    let settled = false;
    let stderrBuffer = "";
    const stderrTail: string[] = [];

    const rememberStderr = (line: string) => {
      if (!line.trim()) {
        return;
      }
      stderrTail.push(line.trim());
      if (stderrTail.length > 10) {
        stderrTail.shift();
      }
    };

    const complete = (err?: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      if (options.signal) {
        options.signal.removeEventListener("abort", onAbort);
      }
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    };

    const onAbort = () => {
      child.kill("SIGTERM");
      setTimeout(() => {
        if (!child.killed) {
          child.kill("SIGKILL");
        }
      }, 1500);
    };

    if (options.signal) {
      options.signal.addEventListener("abort", onAbort);
    }

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      stderrBuffer += String(chunk);
      const { lines, rest } = splitLines(stderrBuffer);
      stderrBuffer = rest;
      for (const line of lines) {
        rememberStderr(line);
        options.onStderrLine?.(line);
      }
    });

    child.on("error", (error) => {
      complete(error instanceof Error ? error : new Error(String(error)));
    });

    child.on("exit", (code, signal) => {
      if (stderrBuffer.trim().length > 0) {
        rememberStderr(stderrBuffer.trim());
        options.onStderrLine?.(stderrBuffer.trim());
      }

      if (options.signal?.aborted) {
        complete(abortError());
        return;
      }

      if (code === 0) {
        complete();
        return;
      }

      const reason = signal ? `signal ${signal}` : `code ${code}`;
      const details = stderrTail.length > 0 ? ` | ${stderrTail.join(" | ")}` : "";
      complete(new Error(`ffmpeg exited with ${reason}${details}`));
    });
  });
}

export async function probeDurationSeconds(inputPath: string, options: FfprobeOptions = {}): Promise<number> {
  const ffprobeBin = options.ffprobeBin ?? "ffprobe";

  const { stdout } = await execFileAsync(ffprobeBin, [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    inputPath
  ]);

  const duration = Number.parseFloat(stdout.trim());
  if (!Number.isFinite(duration) || duration <= 0) {
    return 0;
  }
  return duration;
}

function parseOutTimeMs(line: string): number | null {
  const match = line.match(/^out_time_ms=(\d+)$/);
  if (!match) {
    return null;
  }

  const value = Number.parseInt(match[1], 10);
  return Number.isFinite(value) ? value : null;
}

function videoCodecArgs(outputFormat: "mp4" | "webm"): string[] {
  if (outputFormat === "webm") {
    return ["-an", "-c:v", "libvpx-vp9", "-crf", "33", "-b:v", "0", "-pix_fmt", "yuv420p"];
  }

  return ["-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p"];
}

export async function convertAssetWithFfmpeg(request: ConvertWithFfmpegOptions): Promise<ConvertResult> {
  const { inputPath, outputDir, signal, onProgress, ffmpegBin, ffprobeBin } = request;

  await fs.mkdir(outputDir, { recursive: true });

  const base = path.basename(inputPath, path.extname(inputPath));
  const outputFormat = formatOutputByType(request.type, request.config);
  const primaryPath = path.join(outputDir, `${base}_pixel.${outputFormat}`);
  const extras: string[] = [];

  if (request.type === "svg" && outputFormat === "svg") {
    await fs.copyFile(inputPath, primaryPath);
    onProgress?.(1);
    return {
      primaryPath,
      previewUrl: `file://${primaryPath}`
    };
  }

  if (request.type === "video") {
    const durationSeconds = await probeDurationSeconds(inputPath, { ffprobeBin }).catch(() => 0);
    const filterSpec = buildFilterSpec(request.config, true);

    await runFfmpeg(
      [
        "-y",
        "-i",
        inputPath,
        ...filterSpec.args,
        ...videoCodecArgs(outputFormat === "webm" ? "webm" : "mp4"),
        "-progress",
        "pipe:2",
        "-nostats",
        primaryPath
      ],
      {
        ffmpegBin,
        signal,
        onStderrLine: (line) => {
          const outTimeMs = parseOutTimeMs(line);
          if (outTimeMs === null || durationSeconds <= 0) {
            return;
          }

          const progress = Math.max(0, Math.min(0.99, outTimeMs / (durationSeconds * 1_000_000)));
          onProgress?.(progress);
        }
      }
    );

    onProgress?.(1);

    if (request.config.spritesheet) {
      const fps = clamp(Math.floor(request.config.fps || 24), 1, 120);
      const spritesheetPath = path.join(outputDir, `${base}_spritesheet.png`);
      const metaPath = path.join(outputDir, `${base}_spritesheet.json`);

      await runFfmpeg(
        ["-y", "-i", primaryPath, "-vf", "fps=1,tile=8x8", "-frames:v", "1", spritesheetPath],
        { ffmpegBin, signal }
      );

      const metadata = {
        source: primaryPath,
        generatedAt: new Date().toISOString(),
        tile: "8x8",
        fps
      };
      await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2), "utf8");
      extras.push(spritesheetPath, metaPath);
    }

    if (request.config.alphaMask) {
      const alphaMaskPath = path.join(outputDir, `${base}_alpha.${outputFormat}`);
      await runFfmpeg(["-y", "-i", primaryPath, "-vf", "alphaextract", "-an", alphaMaskPath], {
        ffmpegBin,
        signal
      });
      extras.push(alphaMaskPath);
    }

    return {
      primaryPath,
      extras: extras.length > 0 ? extras : undefined,
      previewUrl: `file://${primaryPath}`
    };
  }

  const filterSpec = buildFilterSpec(request.config, false);
  onProgress?.(0.1);
  await runFfmpeg(["-y", "-i", inputPath, ...filterSpec.args, primaryPath], {
    ffmpegBin,
    signal
  });
  onProgress?.(1);

  return {
    primaryPath,
    previewUrl: `file://${primaryPath}`
  };
}

export async function extractFrames(inputPath: string, outputPattern: string): Promise<void> {
  await runFfmpeg(["-y", "-i", inputPath, "-vsync", "0", outputPattern]);
}

export async function encodeVideo(inputPattern: string, outputPath: string, fps: number): Promise<void> {
  await runFfmpeg([
    "-y",
    "-framerate",
    String(fps),
    "-i",
    inputPattern,
    "-pix_fmt",
    "yuv420p",
    outputPath
  ]);
}
