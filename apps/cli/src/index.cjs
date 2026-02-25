#!/usr/bin/env node
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const {
  detectAssetType,
  defaultPixelConfig,
  expandInputPaths
} = require("@pixel/core");
const { convertAssetWithFfmpeg } = require("@pixel/ffmpeg");
const { JobQueue } = require("@pixel/queue");

function printUsage() {
  console.log(`Usage:
  pixel-cli <input...> [options]

Examples:
  pixel-cli ./assets/hero.png --out ./outputs
  pixel-cli ./assets ./clips/intro.mp4 --concurrency 2 --grid 16 --scale 4 --format png

Options:
  -o, --out <dir>            Output directory (default: ./outputs)
  --concurrency <n>          Parallel jobs (default: 2)
  --grid <n>                 Pixel grid size
  --palette <n>              Palette size
  --dither <none|bayer|floyd>
  --trim                     Enable trim
  --outline                  Enable outline
  --scale <n>                Upscale factor
  --fps <n>                  FPS for video output
  --format <png|svg|mp4|webm>
  --spritesheet              Export video spritesheet + metadata
  --alpha-mask               Export video alpha mask
  -h, --help                 Show this help
`);
}

function parseNumberFlag(value, flagName) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid value for ${flagName}: ${value}`);
  }
  return parsed;
}

function parseArgs(argv) {
  const inputs = [];
  let outputDir = path.resolve(process.cwd(), "outputs");
  let concurrency = 2;
  const configPatch = {};
  let help = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "-h" || arg === "--help") {
      help = true;
      continue;
    }

    if (arg === "-o" || arg === "--out") {
      const value = argv[i + 1];
      if (!value) {
        throw new Error(`${arg} requires a value`);
      }
      outputDir = path.resolve(value);
      i += 1;
      continue;
    }

    if (arg === "--concurrency") {
      const value = argv[i + 1];
      if (!value) {
        throw new Error(`${arg} requires a value`);
      }
      concurrency = Math.max(1, Math.floor(parseNumberFlag(value, arg)));
      i += 1;
      continue;
    }

    if (arg === "--grid") {
      const value = argv[i + 1];
      if (!value) {
        throw new Error(`${arg} requires a value`);
      }
      configPatch.grid = Math.max(1, Math.floor(parseNumberFlag(value, arg)));
      i += 1;
      continue;
    }

    if (arg === "--palette") {
      const value = argv[i + 1];
      if (!value) {
        throw new Error(`${arg} requires a value`);
      }
      configPatch.palette = Math.max(2, Math.floor(parseNumberFlag(value, arg)));
      i += 1;
      continue;
    }

    if (arg === "--dither") {
      const value = argv[i + 1];
      if (!value || !["none", "bayer", "floyd"].includes(value)) {
        throw new Error(`${arg} must be one of none|bayer|floyd`);
      }
      configPatch.dither = value;
      i += 1;
      continue;
    }

    if (arg === "--scale") {
      const value = argv[i + 1];
      if (!value) {
        throw new Error(`${arg} requires a value`);
      }
      configPatch.scale = Math.max(1, Math.floor(parseNumberFlag(value, arg)));
      i += 1;
      continue;
    }

    if (arg === "--fps") {
      const value = argv[i + 1];
      if (!value) {
        throw new Error(`${arg} requires a value`);
      }
      configPatch.fps = Math.max(1, Math.floor(parseNumberFlag(value, arg)));
      i += 1;
      continue;
    }

    if (arg === "--format") {
      const value = argv[i + 1];
      if (!value || !["png", "svg", "mp4", "webm"].includes(value)) {
        throw new Error(`${arg} must be one of png|svg|mp4|webm`);
      }
      configPatch.outputFormat = value;
      i += 1;
      continue;
    }

    if (arg === "--trim") {
      configPatch.trim = true;
      continue;
    }

    if (arg === "--outline") {
      configPatch.outline = true;
      continue;
    }

    if (arg === "--spritesheet") {
      configPatch.spritesheet = true;
      continue;
    }

    if (arg === "--alpha-mask") {
      configPatch.alphaMask = true;
      continue;
    }

    if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    }

    inputs.push(path.resolve(arg));
  }

  return {
    help,
    inputs,
    outputDir,
    concurrency,
    config: {
      ...defaultPixelConfig,
      ...configPatch
    }
  };
}

async function runBatch(files, options) {
  const progressByJob = new Map();
  let doneCount = 0;
  let errorCount = 0;

  const queue = new JobQueue(async ({ payload, reportProgress, signal }) => {
    return convertAssetWithFfmpeg({
      inputPath: payload.inputPath,
      type: payload.type,
      config: options.config,
      outputDir: options.outputDir,
      signal,
      onProgress: reportProgress
    });
  }, options.concurrency);

  const completed = new Promise((resolve) => {
    queue.onEvent((event) => {
      if (event.type === "start") {
        const file = files.find((item) => item.id === event.jobId);
        if (file) {
          console.log(`[start] ${file.inputPath}`);
        }
      }

      if (event.type === "progress") {
        const lastPercent = progressByJob.get(event.jobId) ?? 0;
        const nextPercent = Math.round(event.progress * 100);
        if (nextPercent >= lastPercent + 25 || nextPercent === 100) {
          progressByJob.set(event.jobId, nextPercent);
          const file = files.find((item) => item.id === event.jobId);
          if (file) {
            console.log(`[progress] ${nextPercent}% ${path.basename(file.inputPath)}`);
          }
        }
      }

      if (event.type === "done") {
        doneCount += 1;
        console.log(`[done] ${event.result.primaryPath}`);
      }

      if (event.type === "error") {
        errorCount += 1;
        const file = files.find((item) => item.id === event.jobId);
        console.error(`[error] ${file ? file.inputPath : event.jobId}: ${event.message}`);
      }

      if (event.type === "idle") {
        resolve({ doneCount, errorCount });
      }
    });
  });

  queue.enqueue(
    files.map((file) => ({
      id: file.id,
      payload: {
        inputPath: file.inputPath,
        type: file.type
      }
    }))
  );

  return completed;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help || options.inputs.length === 0) {
    printUsage();
    return;
  }

  const expandedPaths = await expandInputPaths(options.inputs);
  if (expandedPaths.length === 0) {
    console.error("No supported files found from inputs.");
    process.exitCode = 1;
    return;
  }

  const files = expandedPaths.map((inputPath) => ({
    id: randomUUID(),
    inputPath,
    type: detectAssetType(inputPath)
  }));

  console.log(`Discovered ${files.length} file(s). Output: ${options.outputDir}`);
  const { doneCount, errorCount } = await runBatch(files, options);

  console.log(`Summary: done=${doneCount}, errors=${errorCount}, total=${files.length}`);
  if (errorCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
