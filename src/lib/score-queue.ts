import { StoreError } from "@/data/store";

export interface PendingScore {
  competitorId: string;
  /** Null clears the score. */
  tenths: number | null;
  /** When the judge made the change, as an ISO time. */
  changedAt: string;
}

export type SaveStatus = "saved" | "saving" | "offline";

export interface QueueState {
  status: SaveStatus;
  pending: PendingScore[];
  /** The last change the database refused for good, if any. Those changes are dropped. */
  rejected: { change: PendingScore; message: string } | null;
}

export interface QueueStorage {
  read(): string | null;
  write(value: string): void;
}

interface QueueOptions {
  storage: QueueStorage;
  send: (change: PendingScore) => Promise<void>;
  onChange: (state: QueueState) => void;
  /** Milliseconds before the first retry after a failed send. Doubles up to maxRetryMs. */
  retryMs?: number;
  maxRetryMs?: number;
  schedule?: (fn: () => void, ms: number) => unknown;
}

/**
 * Keeps score changes on the phone until the database has them. Changes are sent oldest first; a newer change to
 * the same dancer replaces an unsent older one. The queue survives a reload through `storage`. A send that fails
 * for any reason other than a refusal (StoreError) is retried with backoff, so a lost connection only delays saving.
 */
export function createScoreQueue({ storage, send, onChange, retryMs = 1000, maxRetryMs = 15000, schedule = setTimeout }: QueueOptions) {
  let pending: PendingScore[] = load();
  let status: SaveStatus = pending.length > 0 ? "offline" : "saved";
  let rejected: QueueState["rejected"] = null;
  let flushing = false;
  let delay = retryMs;
  let retryScheduled = false;

  function load(): PendingScore[] {
    try {
      const parsed = JSON.parse(storage.read() ?? "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function persist() {
    try {
      storage.write(JSON.stringify(pending));
    } catch {
      // Storage can be unavailable (private mode). The queue still works for this page load.
    }
  }

  function emit() {
    onChange({ status, pending: [...pending], rejected });
  }

  function enqueue(change: PendingScore) {
    pending = [...pending.filter((item) => item.competitorId !== change.competitorId), change];
    persist();
    void flush();
  }

  async function flush(): Promise<void> {
    if (flushing) return;
    flushing = true;
    try {
      while (pending.length > 0) {
        status = "saving";
        emit();
        const next = [...pending].sort((a, b) => a.changedAt.localeCompare(b.changedAt))[0];
        try {
          await send(next);
        } catch (error) {
          if (error instanceof StoreError) {
            rejected = { change: next, message: error.message };
          } else {
            status = "offline";
            emit();
            if (!retryScheduled) {
              retryScheduled = true;
              schedule(() => {
                retryScheduled = false;
                void flush();
              }, delay);
              delay = Math.min(delay * 2, maxRetryMs);
            }
            return;
          }
        }
        // Remove the change we sent, unless a newer one for the same dancer arrived meanwhile.
        pending = pending.filter((item) => !(item.competitorId === next.competitorId && item.changedAt === next.changedAt));
        persist();
        delay = retryMs;
      }
      status = "saved";
      emit();
    } finally {
      flushing = false;
    }
  }

  emit();
  return {
    enqueue,
    /** Try again now, for example when the browser reports it is back online. */
    retry: () => void flush(),
    state: (): QueueState => ({ status, pending: [...pending], rejected })
  };
}
