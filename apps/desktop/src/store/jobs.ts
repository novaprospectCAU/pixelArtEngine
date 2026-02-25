import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AssetType, Job, PixelConfig } from "@pixel/core";
import type { JobEvent } from "../ipc";
import { defaultPixelConfig } from "../constants";

type EditorMode = "global" | "local";

type JobStore = {
  jobs: Job[];
  selectedJobId: string | null;
  editorMode: EditorMode;
  globalConfig: PixelConfig;
  outputDir: string;
  concurrency: number;
  addPaths: (paths: string[]) => void;
  removeJob: (id: string) => void;
  reorderJobs: (dragId: string, targetId: string) => void;
  toggleEnabled: (id: string) => void;
  selectJob: (id: string | null) => void;
  setEditorMode: (mode: EditorMode) => void;
  setOutputDir: (outputDir: string) => void;
  setConcurrency: (concurrency: number) => void;
  setJobConfigMode: (id: string, mode: "global" | "local") => void;
  updateGlobalConfig: (patch: Partial<PixelConfig>) => void;
  updateSelectedLocalConfig: (patch: Partial<PixelConfig>) => void;
  markQueued: (jobIds: string[]) => void;
  applyEvent: (event: JobEvent) => void;
  clearCompleted: () => void;
};

function detectAssetType(inputPath: string): AssetType {
  const lower = inputPath.toLowerCase();
  if (lower.endsWith(".svg")) {
    return "svg";
  }
  if (
    [".mp4", ".mov", ".webm", ".mkv", ".avi", ".m4v"].some((ext) =>
      lower.endsWith(ext)
    )
  ) {
    return "video";
  }
  return "image";
}

function basename(inputPath: string): string {
  const normalized = inputPath.replace(/\\/g, "/");
  const segments = normalized.split("/");
  return segments[segments.length - 1] ?? inputPath;
}

function normalizeOrder(jobs: Job[]): Job[] {
  return jobs.map((job, index) => ({ ...job, order: index }));
}

function createJob(inputPath: string, order: number): Job {
  return {
    id: crypto.randomUUID(),
    inputPath,
    type: detectAssetType(inputPath),
    enabled: true,
    order,
    configMode: "global",
    status: "idle",
    progress: 0
  };
}

function ensureLocalConfig(job: Job): Job {
  if (job.localConfig) {
    return job;
  }
  return {
    ...job,
    localConfig: { ...defaultPixelConfig }
  };
}

export function formatLabel(inputPath: string): string {
  return basename(inputPath);
}

export const useJobStore = create<JobStore>()(
  persist(
    (set, get) => ({
      jobs: [],
      selectedJobId: null,
      editorMode: "global",
      globalConfig: { ...defaultPixelConfig },
      outputDir: "outputs",
      concurrency: 2,

      addPaths(paths) {
        set((state) => {
          const existing = new Set(state.jobs.map((job) => job.inputPath));
          const next = [...state.jobs];
          for (const filePath of paths) {
            if (existing.has(filePath)) {
              continue;
            }
            next.push(createJob(filePath, next.length));
          }
          return { jobs: normalizeOrder(next) };
        });
      },

      removeJob(id) {
        set((state) => {
          const jobs = normalizeOrder(state.jobs.filter((job) => job.id !== id));
          const selectedJobId = state.selectedJobId === id ? null : state.selectedJobId;
          return { jobs, selectedJobId };
        });
      },

      reorderJobs(dragId, targetId) {
        if (dragId === targetId) {
          return;
        }
        set((state) => {
          const jobs = [...state.jobs];
          const from = jobs.findIndex((job) => job.id === dragId);
          const to = jobs.findIndex((job) => job.id === targetId);
          if (from < 0 || to < 0) {
            return { jobs: state.jobs };
          }
          const [moved] = jobs.splice(from, 1);
          jobs.splice(to, 0, moved);
          return { jobs: normalizeOrder(jobs) };
        });
      },

      toggleEnabled(id) {
        set((state) => ({
          jobs: state.jobs.map((job) =>
            job.id === id ? { ...job, enabled: !job.enabled } : job
          )
        }));
      },

      selectJob(id) {
        set({ selectedJobId: id });
      },

      setEditorMode(mode) {
        set((state) => {
          if (mode === "local" && state.selectedJobId) {
            return {
              editorMode: mode,
              jobs: state.jobs.map((job) => {
                if (job.id !== state.selectedJobId) {
                  return job;
                }
                return ensureLocalConfig({ ...job, configMode: "local" });
              })
            };
          }
          return { editorMode: mode };
        });
      },

      setOutputDir(outputDir) {
        set({ outputDir });
      },

      setConcurrency(concurrency) {
        set({ concurrency: Math.max(1, Math.floor(concurrency)) });
      },

      setJobConfigMode(id, mode) {
        set((state) => ({
          jobs: state.jobs.map((job) => {
            if (job.id !== id) {
              return job;
            }
            const nextJob = { ...job, configMode: mode };
            return mode === "local" ? ensureLocalConfig(nextJob) : nextJob;
          })
        }));
      },

      updateGlobalConfig(patch) {
        set((state) => ({
          globalConfig: {
            ...state.globalConfig,
            ...patch
          }
        }));
      },

      updateSelectedLocalConfig(patch) {
        const selectedJobId = get().selectedJobId;
        if (!selectedJobId) {
          return;
        }
        set((state) => ({
          jobs: state.jobs.map((job) => {
            if (job.id !== selectedJobId) {
              return job;
            }
            const ensured = ensureLocalConfig({ ...job, configMode: "local" });
            const nextLocalConfig: PixelConfig = {
              ...defaultPixelConfig,
              ...ensured.localConfig,
              ...patch
            };
            return {
              ...ensured,
              localConfig: nextLocalConfig
            };
          })
        }));
      },

      markQueued(jobIds) {
        const target = new Set(jobIds);
        set((state) => ({
          jobs: state.jobs.map((job) => {
            if (!target.has(job.id)) {
              return job;
            }
            return {
              ...job,
              status: "queued",
              progress: 0,
              errorMessage: undefined
            };
          })
        }));
      },

      applyEvent(event) {
        if (event.type === "idle") {
          return;
        }

        set((state) => ({
          jobs: state.jobs.map((job) => {
            if (job.id !== event.jobId) {
              return job;
            }

            switch (event.type) {
              case "queued":
                return { ...job, status: "queued", progress: 0, errorMessage: undefined };
              case "start":
                return { ...job, status: "processing", progress: Math.max(0.01, job.progress) };
              case "progress":
                return { ...job, status: "processing", progress: event.progress };
              case "done":
                return { ...job, status: "done", progress: 1, output: event.result, errorMessage: undefined };
              case "error":
                return { ...job, status: "error", errorMessage: event.message };
              case "canceled":
                return { ...job, status: "canceled", errorMessage: undefined };
              default:
                return job;
            }
          })
        }));
      },

      clearCompleted() {
        set((state) => ({
          jobs: normalizeOrder(
            state.jobs.filter((job) => !["done", "error", "canceled"].includes(job.status))
          )
        }));
      }
    }),
    {
      name: "pixel-desktop-settings",
      partialize: (state) => ({
        editorMode: state.editorMode,
        globalConfig: state.globalConfig,
        outputDir: state.outputDir,
        concurrency: state.concurrency
      })
    }
  )
);
