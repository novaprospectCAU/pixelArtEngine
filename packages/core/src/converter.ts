import fs from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import type { ConvertRequest, ConvertResult } from "./types";

function abortError(): Error {
  const error = new Error("Conversion canceled");
  error.name = "AbortError";
  return error;
}

function resolveOutputExtension(request: ConvertRequest): string {
  if (request.config.outputFormat) {
    return request.config.outputFormat;
  }
  if (request.type === "video") {
    return "mp4";
  }
  if (request.type === "svg") {
    return "svg";
  }
  return "png";
}

export async function convertAsset(request: ConvertRequest): Promise<ConvertResult> {
  const { inputPath, outputDir, signal, onProgress } = request;

  await fs.mkdir(outputDir, { recursive: true });

  const base = path.basename(inputPath, path.extname(inputPath));
  const outExt = resolveOutputExtension(request);
  const primaryPath = path.join(outputDir, `${base}_pixel.${outExt}`);

  for (let step = 1; step <= 10; step += 1) {
    if (signal?.aborted) {
      throw abortError();
    }
    await delay(75);
    onProgress?.(step / 10);
  }

  if (signal?.aborted) {
    throw abortError();
  }

  await fs.copyFile(inputPath, primaryPath);

  return {
    primaryPath,
    previewUrl: `file://${primaryPath}`
  };
}
