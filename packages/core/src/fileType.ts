import path from "node:path";
import type { AssetType } from "./types";

const imageExt = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp"]);
const videoExt = new Set([".mp4", ".mov", ".webm", ".mkv", ".avi", ".m4v"]);
export const supportedAssetExtensions = new Set([...imageExt, ...videoExt, ".svg"]);

export function isSupportedAssetPath(inputPath: string): boolean {
  const ext = path.extname(inputPath).toLowerCase();
  return supportedAssetExtensions.has(ext);
}

export function detectAssetType(inputPath: string): AssetType {
  const ext = path.extname(inputPath).toLowerCase();
  if (ext === ".svg") {
    return "svg";
  }
  if (videoExt.has(ext)) {
    return "video";
  }
  if (imageExt.has(ext)) {
    return "image";
  }
  return "image";
}
