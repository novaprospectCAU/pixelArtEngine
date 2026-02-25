import fs from "node:fs/promises";
import path from "node:path";
import type { Dirent, Stats } from "node:fs";
import { isSupportedAssetPath } from "./fileType";

export async function expandInputPaths(inputPaths: string[]): Promise<string[]> {
  const seen = new Set<string>();
  const files: string[] = [];

  async function walk(targetPath: string): Promise<void> {
    const resolved = path.resolve(targetPath);
    if (seen.has(resolved)) {
      return;
    }
    seen.add(resolved);

    let stat: Stats;
    try {
      stat = await fs.stat(resolved);
    } catch {
      return;
    }

    if (stat.isDirectory()) {
      let entries: Array<Dirent>;
      try {
        entries = await fs.readdir(resolved, { withFileTypes: true });
      } catch {
        return;
      }

      entries.sort((a, b) => a.name.localeCompare(b.name));
      for (const entry of entries) {
        await walk(path.join(resolved, entry.name));
      }
      return;
    }

    if (stat.isFile() && isSupportedAssetPath(resolved)) {
      files.push(resolved);
    }
  }

  for (const inputPath of inputPaths) {
    await walk(inputPath);
  }

  return files;
}
