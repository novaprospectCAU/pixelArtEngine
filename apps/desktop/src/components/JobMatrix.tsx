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

function toLocalFileUrl(filePath: string, version?: string): string {
  const base = `local-file://open?path=${encodeURIComponent(filePath)}`;
  if (!version) {
    return base;
  }
  return `${base}&v=${encodeURIComponent(version)}`;
}

function readPreviewVersion(previewUrl: string | undefined): string | undefined {
  if (!previewUrl) {
    return undefined;
  }
  try {
    return new URL(previewUrl).searchParams.get("v") ?? undefined;
  } catch {
    return undefined;
  }
}

function InputPreview({ job }: { job: Job }) {
  const src = toLocalFileUrl(job.inputPath);

  if (job.type === "video") {
    return (
      <video
        src={src}
        className="h-16 w-24 rounded border border-slate-300 object-cover"
        muted
        loop
        playsInline
        autoPlay
      />
    );
  }

  return (
    <img
      src={src}
      alt="input preview"
      className="h-16 w-16 rounded border border-slate-300 object-cover"
    />
  );
}

function OutputPreview({ job }: { job: Job }) {
  if (!job.output?.previewUrl) {
    return (
      <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-500">
        Output preview not available yet
      </div>
    );
  }

  const version = readPreviewVersion(job.output.previewUrl);
  const src = toLocalFileUrl(job.output.primaryPath, version);

  if (job.type === "video") {
    return (
      <video
        key={`${job.id}:${version ?? job.output.primaryPath}`}
        src={src}
        className="h-20 w-28 rounded border border-slate-300 object-cover"
        muted
        loop
        playsInline
        autoPlay
      />
    );
  }

  return (
    <img
      key={`${job.id}:${version ?? job.output.primaryPath}`}
      src={src}
      alt="output preview"
      className="h-20 w-20 rounded border border-slate-300 object-cover"
    />
  );
}

type JobMatrixProps = {
  jobs: Job[];
  selectedJobId: string | null;
  onSelect: (jobId: string) => void;
  onToggleEnabled: (jobId: string) => void;
  onSetConfigMode: (jobId: string, mode: "global" | "local") => void;
  onRemove: (jobId: string) => void;
  onReorder: (dragId: string, targetId: string) => void;
  onDropFiles: (paths: string[]) => void | Promise<void>;
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
                <div className="flex items-start gap-3">
                  <InputPreview job={job} />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-slate-800">{formatLabel(job.inputPath)}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {job.type} | {statusLabel(job)} | {job.configMode}
                    </div>
                  </div>
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
                <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-500">
                  {job.status === "queued" ? "Queued..." : "Preview placeholder: waiting for conversion"}
                </div>
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
                  <OutputPreview job={job} />
                  <div className="text-xs text-slate-600">Done</div>
                  <div className="truncate text-xs text-slate-700" title={job.output.primaryPath}>
                    {job.output.primaryPath}
                  </div>
                  <button className="btn btn-sm" type="button" onClick={() => onOpenOutput(job.output!.primaryPath)}>
                    Open
                  </button>
                  {job.output.extras && job.output.extras.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <div className="text-[11px] uppercase tracking-wide text-slate-500">Extras</div>
                      {job.output.extras.map((extraPath) => (
                        <button
                          key={extraPath}
                          className="btn btn-sm block w-full truncate text-left"
                          type="button"
                          title={extraPath}
                          onClick={() => onOpenOutput(extraPath)}
                        >
                          {extraPath}
                        </button>
                      ))}
                    </div>
                  )}
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
