const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("pixel", {
  pickFiles: () => ipcRenderer.invoke("dialog:pickFiles"),
  pickOutputDir: () => ipcRenderer.invoke("dialog:pickOutputDir"),
  expandPaths: (paths) => ipcRenderer.invoke("paths:expand", paths),
  startConversion: (payload) => ipcRenderer.invoke("jobs:start", payload),
  cancel: (jobId) => ipcRenderer.invoke("jobs:cancel", jobId),
  setConcurrency: (count) => ipcRenderer.invoke("jobs:setConcurrency", count),
  openPath: (targetPath) => ipcRenderer.invoke("shell:openPath", targetPath),
  onJobEvent: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("jobs:event", listener);
    return () => {
      ipcRenderer.off("jobs:event", listener);
    };
  }
});
