#!/usr/bin/env node
const path = require("node:path");
const { detectAssetType, defaultPixelConfig } = require("@pixel/core");
const { convertAssetWithFfmpeg } = require("@pixel/ffmpeg");

function parseArgs(argv) {
  const [inputPath, ...rest] = argv;
  let outputDir = path.resolve(process.cwd(), "outputs");

  for (let i = 0; i < rest.length; i += 1) {
    if ((rest[i] === "--out" || rest[i] === "-o") && rest[i + 1]) {
      outputDir = path.resolve(rest[i + 1]);
      i += 1;
    }
  }

  return { inputPath, outputDir };
}

async function main() {
  const { inputPath, outputDir } = parseArgs(process.argv.slice(2));

  if (!inputPath) {
    console.error("Usage: pixel-cli <input-file> [--out <output-dir>]");
    process.exit(1);
  }

  const resolvedInput = path.resolve(inputPath);
  const type = detectAssetType(resolvedInput);

  console.log(`Converting ${resolvedInput}`);
  const result = await convertAssetWithFfmpeg({
    inputPath: resolvedInput,
    outputDir,
    type,
    config: defaultPixelConfig,
    onProgress(progress) {
      const pct = Math.round(progress * 100);
      process.stdout.write(`\rProgress: ${pct}%`);
    }
  });

  process.stdout.write("\n");
  console.log(`Done: ${result.primaryPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
