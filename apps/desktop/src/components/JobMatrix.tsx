import type { DragEvent } from "react";
import type { Job } from "@pixel/core";
import { formatLabel } from "../store/jobs";

function statusLabel(job: Job): string {
  if (job.status === "processing") {
    return `processing ${Math.round(job.progress * 100)}%`;
  }
  return job.status;
}

function extractDroppedPaths(event: DragEvent): string[] {
  return Array.from(event.dataTransfer.files)
    .map((file) => (file as File & { path?: string }).path)
    .filter((value): value is string => Boolean(value));
}

type JobMatrixProps = {
  jobs: Job[];
  selectedJobId: string | null;
  onSelect: (jobId: string) => void;
  onToggleEnabled: (jobId: string) => void;
  onSetConfigMode: (jobId: string, mode: "global" | "local") => void;
  onRemove: (jobId: string) => void;
  onReorder: (dragId: string, targetId: string) => void;
  onDropFiles: (paths: string[]) => void;
  onOpenOutput: (outputPath: string) => void;
};

export function JobMatrix({
  jobs,
  selectedJobId,
  onSelect,
  onToggleEnabled,
  onSetConfigMode,
  onRemove,
  onReorder,
  onDropFiles,
  onOpenOutput
}: JobMatrixProps) {
  const handleContainerDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const internalId = event.dataTransfer.getData("application/x-pixel-job-id");
    if (internalId) {
      return;
    }
    const paths = extractDroppedPaths(event);
    if (paths.length > 0) {
      onDropFiles(paths);
    }
  };

  return (
    <section
      className="min-h-[360px] rounded-xl border border-slate-300/80 bg-white/80 backdrop-blur"
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleContainerDrop}
    >
      <div className="grid grid-cols-2 border-b border-slate-300 text-xs uppercase tracking-wide text-slate-500">
        <div className="px-3 py-2">Input Queue</div>
        <div className="px-3 py-2">Output Preview / Result</div>
      </div>

      <div className="max-h-[68vh] overflow-auto">
        {jobs.length === 0 && (
          <div className="px-4 py-8 text-sm text-slate-500">
            Drop files here or use <strong>Add Files</strong>.
          </div>
        )}

        {jobs.map((job) => (
          <div
            key={job.id}
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData("application/x-pixel-job-id", job.id);
              event.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const dragId = event.dataTransfer.getData("application/x-pixel-job-id");
              if (dragId) {
                onReorder(dragId, job.id);
                return;
              }
              const paths = extractDroppedPaths(event);
              if (paths.length > 0) {
                onDropFiles(paths);
              }
            }}
            className={`grid grid-cols-2 border-b border-slate-200 ${
              selectedJobId === job.id ? "bg-emerald-50/80" : "bg-white/10"
            }`}
          >
            <div className="flex items-start gap-2 px-3 py-3">
              <span className="cursor-grab pt-1 text-slate-400" title="Drag to reorder">
                ::
              </span>

              <input
                type="checkbox"
                checked={job.enabled}
                onChange={() => onToggleEnabled(job.id)}
                title="Include / exclude"
              />

              <button className="flex-1 text-left" type="button" onClick={() => onSelect(job.id)}>
                <div className="text-sm font-medium text-slate-800">{formatLabel(job.inputPath)}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {job.type} | {statusLabel(job)} | {job.configMode}
                </div>
              </button>

              <div className="flex items-center gap-1">
                <button
                  className="btn btn-sm"
                  type="button"
                  onClick={() => onSetConfigMode(job.id, job.configMode === "global" ? "local" : "global")}
                >
                  {job.configMode === "global" ? "Use Local" : "Use Global"}
                </button>
                <button className="btn btn-sm" type="button" onClick={() => onRemove(job.id)}>
                  Remove
                </button>
              </div>
            </div>

            <div className="px-3 py-3">
              {(job.status === "idle" || job.status === "queued") && (
                <div className="text-xs text-slate-500">Waiting for conversion...</div>
              )}

              {job.status === "processing" && (
                <div>
                  <div className="mb-1 text-xs text-slate-600">Processing {Math.round(job.progress * 100)}%</div>
                  <div className="h-2 rounded-full bg-slate-200">
                    <div
                      className="h-2 rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${Math.max(2, Math.round(job.progress * 100))}%` }}
                    />
                  </div>
                </div>
              )}

              {job.status === "done" && job.output && (
                <div className="space-y-1">
                  <div className="text-xs text-slate-600">Done</div>
                  <div className="truncate text-xs text-slate-700" title={job.output.primaryPath}>
                    {job.output.primaryPath}
                  </div>
                  <button className="btn btn-sm" type="button" onClick={() => onOpenOutput(job.output!.primaryPath)}>
                    Open
                  </button>
                </div>
              )}

              {job.status === "error" && (
                <div className="text-xs text-red-600">{job.errorMessage ?? "Unknown error"}</div>
              )}

              {job.status === "canceled" && <div className="text-xs text-slate-500">Canceled</div>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
