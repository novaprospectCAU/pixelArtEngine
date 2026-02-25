#!/usr/bin/env node
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const {
  detectAssetType,
  defaultPixelConfig,
  expandInputPaths,
  isSupportedAssetPath
} = require("@pixel/core");
const { convertAssetWithFfmpeg } = require("@pixel/ffmpeg");
const { JobQueue } = require("@pixel/queue");

function printUsage() {
  console.log(`Usage:
  pixel-cli <input...> [options]

Examples:
  pixel-cli ./assets/hero.png --out ./outputs
  pixel-cli ./assets ./clips/intro.mp4 --concurrency 2 --grid 16 --scale 4 --format png
  pixel-cli ./assets --watch --out ./outputs

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
  --watch                    Watch inputs and auto-convert changes
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
  let watch = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === "-h" || arg === "--help") {
      help = true;
      continue;
    }

    if (arg === "--watch") {
      watch = true;
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
    watch,
    inputs,
    outputDir,
    concurrency,
    config: {
      ...defaultPixelConfig,
      ...configPatch
    }
  };
}

function createBatchRunner(options) {
  const progressByJob = new Map();
  const filesById = new Map();
  const activeByPath = new Set();
  const idleResolvers = [];

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

  function settleIdleIfNeeded() {
    if (activeByPath.size !== 0) {
      return;
    }

    while (idleResolvers.length > 0) {
      const resolve = idleResolvers.shift();
      resolve();
    }
  }

  queue.onEvent((event) => {
    const trackedFile = "jobId" in event ? filesById.get(event.jobId) : undefined;

    if (event.type === "start") {
      if (trackedFile) {
        console.log(`[start] ${trackedFile.inputPath}`);
      }
      return;
    }

    if (event.type === "progress") {
      const lastPercent = progressByJob.get(event.jobId) ?? 0;
      const nextPercent = Math.round(event.progress * 100);
      if (nextPercent >= lastPercent + 25 || nextPercent === 100) {
        progressByJob.set(event.jobId, nextPercent);
        if (trackedFile) {
          console.log(`[progress] ${nextPercent}% ${path.basename(trackedFile.inputPath)}`);
        }
      }
      return;
    }

    if (event.type === "done" || event.type === "error" || event.type === "canceled") {
      if (trackedFile) {
        activeByPath.delete(trackedFile.inputPath);
        filesById.delete(event.jobId);
      }
    }

    if (event.type === "done") {
      doneCount += 1;
      console.log(`[done] ${event.result.primaryPath}`);
      settleIdleIfNeeded();
      return;
    }

    if (event.type === "error") {
      errorCount += 1;
      console.error(`[error] ${trackedFile ? trackedFile.inputPath : event.jobId}: ${event.message}`);
      settleIdleIfNeeded();
      return;
    }

    if (event.type === "canceled") {
      settleIdleIfNeeded();
      return;
    }

    if (event.type === "idle") {
      settleIdleIfNeeded();
    }
  });

  return {
    enqueuePaths(inputPaths) {
      const items = [];

      for (const inputPath of inputPaths) {
        const resolved = path.resolve(inputPath);
        if (activeByPath.has(resolved) || !isSupportedAssetPath(resolved)) {
          continue;
        }

        activeByPath.add(resolved);
        const id = randomUUID();
        const item = {
          id,
          inputPath: resolved,
          type: detectAssetType(resolved)
        };
        filesById.set(id, item);
        items.push(item);
      }

      if (items.length === 0) {
        return 0;
      }

      queue.enqueue(
        items.map((item) => ({
          id: item.id,
          payload: {
            inputPath: item.inputPath,
            type: item.type
          }
        }))
      );

      return items.length;
    },

    waitForIdle() {
      if (activeByPath.size === 0) {
        return Promise.resolve();
      }

      return new Promise((resolve) => {
        idleResolvers.push(resolve);
      });
    },

    getSummary() {
      return {
        doneCount,
        errorCount,
        activeCount: activeByPath.size
      };
    }
  };
}

async function startWatchMode(options, runner) {
  const chokidar = require("chokidar");

  console.log("Watch mode enabled. Press Ctrl+C to stop.");

  const watcher = chokidar.watch(options.inputs, {
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 250,
      pollInterval: 100
    }
  });

  const queueChangedPath = (changedPath) => {
    const resolved = path.resolve(changedPath);
    const count = runner.enqueuePaths([resolved]);
    if (count > 0) {
      console.log(`[watch] queued ${resolved}`);
    }
  };

  watcher.on("add", queueChangedPath);
  watcher.on("change", queueChangedPath);
  watcher.on("error", (error) => {
    console.error(`[watch:error] ${error instanceof Error ? error.message : String(error)}`);
  });

  let stopping = false;
  const stop = async (code) => {
    if (stopping) {
      return;
    }
    stopping = true;

    console.log("Stopping watch mode...");
    await watcher.close();
    await runner.waitForIdle();

    const summary = runner.getSummary();
    console.log(`Summary: done=${summary.doneCount}, errors=${summary.errorCount}`);
    process.exit(code || (summary.errorCount > 0 ? 1 : 0));
  };

  process.on("SIGINT", () => {
    void stop(0);
  });
  process.on("SIGTERM", () => {
    void stop(0);
  });
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

  console.log(`Discovered ${expandedPaths.length} file(s). Output: ${options.outputDir}`);
  const runner = createBatchRunner(options);
  runner.enqueuePaths(expandedPaths);

  if (options.watch) {
    await startWatchMode(options, runner);
    return;
  }

  await runner.waitForIdle();
  const summary = runner.getSummary();
  console.log(`Summary: done=${summary.doneCount}, errors=${summary.errorCount}, total=${expandedPaths.length}`);

  if (summary.errorCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
