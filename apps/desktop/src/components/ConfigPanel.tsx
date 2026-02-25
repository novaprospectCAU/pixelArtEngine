import { useEffect, useState } from "react";
import type { Job, PixelConfig } from "@pixel/core";

type EditorMode = "global" | "local";

type ConfigPanelProps = {
  editorMode: EditorMode;
  selectedJob: Job | null;
  globalConfig: PixelConfig;
  onEditorModeChange: (mode: EditorMode) => void;
  onGlobalPatch: (patch: Partial<PixelConfig>) => void;
  onLocalPatch: (patch: Partial<PixelConfig>) => void;
};

function FieldNumber({
  label,
  value,
  min,
  max,
  step,
  onChange
}: {
  label: string;
  value: number | undefined;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(value === undefined ? "" : String(value));

  useEffect(() => {
    setDraft(value === undefined ? "" : String(value));
  }, [value]);

  const commit = (raw: string) => {
    if (raw.trim() === "") {
      setDraft(value === undefined ? "" : String(value));
      return;
    }

    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      setDraft(value === undefined ? "" : String(value));
      return;
    }

    let next = parsed;
    if (typeof min === "number") {
      next = Math.max(min, next);
    }
    if (typeof max === "number") {
      next = Math.min(max, next);
    }

    onChange(next);
    setDraft(String(next));
  };

  return (
    <label className="flex flex-col gap-1 text-xs text-slate-700">
      {label}
      <input
        className="rounded-md border border-slate-300 px-2 py-1 text-sm"
        type="number"
        min={min}
        max={max}
        step={step}
        value={draft}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);

          if (next.trim() === "" || next === "-" || next === "+") {
            return;
          }

          const parsed = Number(next);
          if (!Number.isFinite(parsed)) {
            return;
          }
          onChange(parsed);
        }}
        onBlur={(event) => commit(event.target.value)}
      />
    </label>
  );
}

function FieldBoolean({
  label,
  value,
  onChange
}: {
  label: string;
  value: boolean | undefined;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-slate-700">
      <input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}

export function ConfigPanel({
  editorMode,
  selectedJob,
  globalConfig,
  onEditorModeChange,
  onGlobalPatch,
  onLocalPatch
}: ConfigPanelProps) {
  const localConfig = selectedJob?.configMode === "local" ? selectedJob.localConfig : undefined;
  const config = editorMode === "global" ? globalConfig : localConfig;
  const update = editorMode === "global" ? onGlobalPatch : onLocalPatch;

  return (
    <aside className="rounded-xl border border-slate-300/80 bg-white/80 p-4 backdrop-blur">
      <h2 className="text-sm font-semibold text-slate-900">Transform Settings</h2>

      <div className="mt-2 flex gap-2 text-sm">
        <button
          className={`btn ${editorMode === "global" ? "btn-accent" : ""}`}
          type="button"
          onClick={() => onEditorModeChange("global")}
        >
          Global settings
        </button>
        <button
          className={`btn ${editorMode === "local" ? "btn-accent" : ""}`}
          type="button"
          onClick={() => onEditorModeChange("local")}
          disabled={!selectedJob}
        >
          Per-item override
        </button>
      </div>

      {editorMode === "local" && !selectedJob && (
        <p className="mt-3 text-xs text-slate-600">Select a job to edit a local override.</p>
      )}

      {editorMode === "local" && selectedJob && selectedJob.configMode !== "local" && (
        <p className="mt-3 text-xs text-slate-600">
          This item is using global settings. Switch row mode to local to edit override.
        </p>
      )}

      {config && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <FieldNumber label="Grid" value={config.grid} min={8} max={256} step={8} onChange={(value) => update({ grid: value })} />
          <FieldNumber
            label="Palette"
            value={config.palette}
            min={2}
            max={256}
            step={2}
            onChange={(value) => update({ palette: value })}
          />
          <FieldNumber
            label="Alpha Threshold"
            value={config.alphaThreshold}
            min={0}
            max={255}
            onChange={(value) => update({ alphaThreshold: value })}
          />
          <FieldNumber label="Scale" value={config.scale} min={1} max={8} onChange={(value) => update({ scale: value })} />
          <FieldNumber label="FPS" value={config.fps} min={1} max={120} onChange={(value) => update({ fps: value })} />

          <label className="flex flex-col gap-1 text-xs text-slate-700">
            Dither
            <select
              className="rounded-md border border-slate-300 px-2 py-1 text-sm"
              value={config.dither}
              onChange={(event) => update({ dither: event.target.value as PixelConfig["dither"] })}
            >
              <option value="none">none</option>
              <option value="bayer">bayer</option>
              <option value="floyd">floyd</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs text-slate-700">
            Output
            <select
              className="rounded-md border border-slate-300 px-2 py-1 text-sm"
              value={config.outputFormat}
              onChange={(event) => update({ outputFormat: event.target.value as PixelConfig["outputFormat"] })}
            >
              <option value="png">png</option>
              <option value="svg">svg</option>
              <option value="mp4">mp4</option>
              <option value="webm">webm</option>
            </select>
          </label>

          <div className="col-span-2 grid grid-cols-2 gap-2 pt-1">
            <FieldBoolean label="Trim" value={config.trim} onChange={(value) => update({ trim: value })} />
            <FieldBoolean label="Outline" value={config.outline} onChange={(value) => update({ outline: value })} />
            <FieldBoolean
              label="Alpha Mask (video)"
              value={config.alphaMask}
              onChange={(value) => update({ alphaMask: value })}
            />
            <FieldBoolean
              label="Spritesheet (video)"
              value={config.spritesheet}
              onChange={(value) => update({ spritesheet: value })}
            />
          </div>
        </div>
      )}
    </aside>
  );
}
