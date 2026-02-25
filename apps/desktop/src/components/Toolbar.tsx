import type { Job } from "@pixel/core";

type ToolbarProps = {
  jobs: Job[];
  outputDir: string;
  concurrency: number;
  onAddFiles: () => void;
  onPickOutput: () => void;
  onConvertSelected: () => void;
  onConvertIncluded: () => void;
  onCancel: () => void;
  onClearCompleted: () => void;
  onConcurrencyChange: (value: number) => void;
};

export function Toolbar({
  jobs,
  outputDir,
  concurrency,
  onAddFiles,
  onPickOutput,
  onConvertSelected,
  onConvertIncluded,
  onCancel,
  onClearCompleted,
  onConcurrencyChange
}: ToolbarProps) {
  const activeCount = jobs.filter((job) => job.status === "processing" || job.status === "queued").length;

  return (
    <header className="rounded-xl border border-slate-300/80 bg-white/80 p-4 backdrop-blur">
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn" onClick={onAddFiles} type="button">
          Add Files
        </button>
        <button className="btn" onClick={onPickOutput} type="button">
          Output Folder
        </button>
        <button className="btn btn-accent" onClick={onConvertSelected} type="button">
          Convert Selected
        </button>
        <button className="btn btn-accent" onClick={onConvertIncluded} type="button">
          Convert All Included
        </button>
        <button className="btn btn-danger" onClick={onCancel} type="button">
          Cancel
        </button>
        <button className="btn" onClick={onClearCompleted} type="button">
          Clear Completed
        </button>

        <div className="ml-auto flex items-center gap-2 text-sm text-slate-700">
          <label htmlFor="concurrency">Concurrency</label>
          <select
            id="concurrency"
            className="rounded-md border border-slate-300 bg-white px-2 py-1"
            value={concurrency}
            onChange={(event) => onConcurrencyChange(Number(event.target.value))}
          >
            {[1, 2, 3, 4].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <span className="rounded-md bg-slate-100 px-2 py-1">Active: {activeCount}</span>
        </div>
      </div>

      <p className="mt-3 text-xs text-slate-600">Output: {outputDir}</p>
    </header>
  );
}
