import { useEffect, useMemo } from "react";
import type { PixelConfig } from "@pixel/core";
import { ConfigPanel } from "./components/ConfigPanel";
import { JobMatrix } from "./components/JobMatrix";
import { Toolbar } from "./components/Toolbar";
import { useJobStore } from "./store/jobs";

function buildConfig(jobConfigMode: "global" | "local", localConfig: PixelConfig | undefined, globalConfig: PixelConfig) {
  if (jobConfigMode === "local" && localConfig) {
    return localConfig;
  }
  return globalConfig;
}

export default function App() {
  const {
    jobs,
    selectedJobId,
    editorMode,
    globalConfig,
    outputDir,
    concurrency,
    addPaths,
    removeJob,
    reorderJobs,
    toggleEnabled,
    selectJob,
    setEditorMode,
    setOutputDir,
    setConcurrency,
    setJobConfigMode,
    updateGlobalConfig,
    updateSelectedLocalConfig,
    markQueued,
    applyEvent,
    clearCompleted
  } = useJobStore();

  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === selectedJobId) ?? null,
    [jobs, selectedJobId]
  );

  useEffect(() => {
    return window.pixel.onJobEvent((event) => {
      applyEvent(event);
    });
  }, [applyEvent]);

  const handleAddFiles = async () => {
    const paths = await window.pixel.pickFiles();
    if (paths.length > 0) {
      addPaths(paths);
    }
  };

  const handlePickOutput = async () => {
    const next = await window.pixel.pickOutputDir();
    if (next) {
      setOutputDir(next);
    }
  };

  const startConversion = async (mode: "selected" | "included") => {
    const source = mode === "selected" ? jobs.filter((job) => job.id === selectedJobId) : jobs.filter((job) => job.enabled);
    if (source.length === 0) {
      return;
    }

    await window.pixel.setConcurrency(concurrency);

    const payload = {
      outputDir,
      jobs: source.map((job) => ({
        id: job.id,
        inputPath: job.inputPath,
        type: job.type,
        config: buildConfig(job.configMode, job.localConfig, globalConfig)
      }))
    };

    markQueued(payload.jobs.map((job) => job.id));
    await window.pixel.startConversion(payload);
  };

  const handleCancel = async () => {
    await window.pixel.cancel();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-sky-50 to-emerald-50 p-4 text-slate-900">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-4">
        <Toolbar
          jobs={jobs}
          outputDir={outputDir}
          concurrency={concurrency}
          onAddFiles={handleAddFiles}
          onPickOutput={handlePickOutput}
          onConvertSelected={() => startConversion("selected")}
          onConvertIncluded={() => startConversion("included")}
          onCancel={handleCancel}
          onClearCompleted={clearCompleted}
          onConcurrencyChange={(value) => setConcurrency(value)}
        />

        <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
          <JobMatrix
            jobs={jobs}
            selectedJobId={selectedJobId}
            onSelect={selectJob}
            onToggleEnabled={toggleEnabled}
            onSetConfigMode={setJobConfigMode}
            onRemove={removeJob}
            onReorder={reorderJobs}
            onDropFiles={addPaths}
            onOpenOutput={(targetPath) => window.pixel.openPath(targetPath)}
          />

          <ConfigPanel
            editorMode={editorMode}
            selectedJob={selectedJob}
            globalConfig={globalConfig}
            onEditorModeChange={setEditorMode}
            onGlobalPatch={updateGlobalConfig}
            onLocalPatch={updateSelectedLocalConfig}
          />
        </div>
      </div>
    </div>
  );
}
