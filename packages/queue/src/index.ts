import { EventEmitter } from "node:events";

export type QueueWorkerContext<TPayload> = {
  id: string;
  payload: TPayload;
  signal: AbortSignal;
  reportProgress: (progress: number) => void;
};

export type QueueWorker<TPayload, TResult> = (
  context: QueueWorkerContext<TPayload>
) => Promise<TResult>;

export type QueueItem<TPayload> = {
  id: string;
  payload: TPayload;
};

export type QueueEvent<TResult> =
  | { type: "queued"; jobId: string }
  | { type: "start"; jobId: string }
  | { type: "progress"; jobId: string; progress: number }
  | { type: "done"; jobId: string; result: TResult }
  | { type: "error"; jobId: string; message: string }
  | { type: "canceled"; jobId: string }
  | { type: "idle" };

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export class JobQueue<TPayload, TResult> {
  private readonly worker: QueueWorker<TPayload, TResult>;

  private readonly emitter = new EventEmitter();

  private readonly pending: Array<QueueItem<TPayload>> = [];

  private readonly running = new Map<string, AbortController>();

  private readonly canceled = new Set<string>();

  private concurrency = 1;

  constructor(worker: QueueWorker<TPayload, TResult>, concurrency = 1) {
    this.worker = worker;
    this.concurrency = Math.max(1, concurrency);
  }

  onEvent(listener: (event: QueueEvent<TResult>) => void): () => void {
    this.emitter.on("event", listener);
    return () => this.emitter.off("event", listener);
  }

  enqueue(items: Array<QueueItem<TPayload>>): void {
    for (const item of items) {
      this.pending.push(item);
      this.emit({ type: "queued", jobId: item.id });
    }
    this.drain();
  }

  setConcurrency(next: number): number {
    this.concurrency = Math.max(1, Math.floor(next));
    this.drain();
    return this.concurrency;
  }

  cancel(jobId: string): void {
    const pendingIndex = this.pending.findIndex((item) => item.id === jobId);
    if (pendingIndex >= 0) {
      this.pending.splice(pendingIndex, 1);
      this.canceled.add(jobId);
      this.emit({ type: "canceled", jobId });
      this.emitIdleIfNeeded();
      return;
    }

    const controller = this.running.get(jobId);
    if (controller) {
      this.canceled.add(jobId);
      controller.abort();
    }
  }

  cancelAll(): void {
    for (const item of this.pending) {
      this.canceled.add(item.id);
      this.emit({ type: "canceled", jobId: item.id });
    }
    this.pending.length = 0;

    for (const [jobId, controller] of this.running.entries()) {
      this.canceled.add(jobId);
      controller.abort();
    }

    this.emitIdleIfNeeded();
  }

  private drain(): void {
    while (this.running.size < this.concurrency && this.pending.length > 0) {
      const next = this.pending.shift();
      if (!next) {
        return;
      }
      this.run(next);
    }
    this.emitIdleIfNeeded();
  }

  private run(item: QueueItem<TPayload>): void {
    const controller = new AbortController();
    this.running.set(item.id, controller);
    this.emit({ type: "start", jobId: item.id });

    this.worker({
      id: item.id,
      payload: item.payload,
      signal: controller.signal,
      reportProgress: (progress) => {
        this.emit({ type: "progress", jobId: item.id, progress });
      }
    })
      .then((result) => {
        if (this.canceled.has(item.id)) {
          return;
        }
        this.emit({ type: "done", jobId: item.id, result });
      })
      .catch((error) => {
        if (this.canceled.has(item.id) || isAbortError(error)) {
          this.emit({ type: "canceled", jobId: item.id });
          return;
        }
        const message = error instanceof Error ? error.message : "Unknown queue error";
        this.emit({ type: "error", jobId: item.id, message });
      })
      .finally(() => {
        this.running.delete(item.id);
        this.canceled.delete(item.id);
        this.drain();
      });
  }

  private emitIdleIfNeeded(): void {
    if (this.pending.length === 0 && this.running.size === 0) {
      this.emit({ type: "idle" });
    }
  }

  private emit(event: QueueEvent<TResult>): void {
    this.emitter.emit("event", event);
  }
}
