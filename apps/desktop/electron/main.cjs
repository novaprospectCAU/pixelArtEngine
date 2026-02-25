const path = require("node:path");
const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const { defaultPixelConfig } = require("@pixel/core");
const { convertAssetWithFfmpeg } = require("@pixel/ffmpeg");
const { JobQueue } = require("@pixel/queue");

let mainWindow = null;

const queue = new JobQueue(async ({ payload, signal, reportProgress }) => {
  const config = {
    ...defaultPixelConfig,
    ...payload.job.config
  };

  return convertAssetWithFfmpeg({
    inputPath: payload.job.inputPath,
    type: payload.job.type,
    config,
    outputDir: payload.outputDir,
    signal,
    onProgress: reportProgress
  });
}, 2);

queue.onEvent((event) => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  mainWindow.webContents.send("jobs:event", event);
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1120,
    minHeight: 720,
    backgroundColor: "#f8fafc",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools({ mode: "detach" });
    return;
  }

  mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

ipcMain.handle("dialog:pickFiles", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openFile", "multiSelections"],
    filters: [
      {
        name: "Assets",
        extensions: ["png", "jpg", "jpeg", "webp", "gif", "bmp", "svg", "mp4", "mov", "webm", "mkv", "avi", "m4v"]
      }
    ]
  });

  return result.canceled ? [] : result.filePaths;
});

ipcMain.handle("dialog:pickOutputDir", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory", "createDirectory"]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});

ipcMain.handle("jobs:start", async (_event, payload) => {
  const outputDir = path.resolve(payload.outputDir || path.join(process.cwd(), "outputs"));

  const queueItems = payload.jobs.map((job) => ({
    id: job.id,
    payload: {
      job,
      outputDir
    }
  }));

  queue.enqueue(queueItems);
  return payload.jobs.map((job) => job.id);
});

ipcMain.handle("jobs:cancel", async (_event, jobId) => {
  if (jobId) {
    queue.cancel(jobId);
  } else {
    queue.cancelAll();
  }
  return true;
});

ipcMain.handle("jobs:setConcurrency", async (_event, count) => {
  return queue.setConcurrency(count);
});

ipcMain.handle("shell:openPath", async (_event, targetPath) => {
  await shell.openPath(targetPath);
});
