import { describe, expect, it } from "vitest";
import { StoreError } from "@/data/store";
import { createScoreQueue, type PendingScore, type QueueState } from "./score-queue";

function setup(send: (change: PendingScore) => Promise<void>, saved: string | null = null) {
  let stored = saved;
  const timers: Array<() => void> = [];
  const states: QueueState[] = [];
  const queue = createScoreQueue({
    storage: { read: () => stored, write: (value) => (stored = value) },
    send,
    onChange: (state) => states.push(state),
    schedule: (fn) => timers.push(fn)
  });
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
  return { queue, timers, states, stored: () => stored, settle };
}

const at = (second: number) => `2026-11-13T10:00:${String(second).padStart(2, "0")}Z`;

describe("score queue", () => {
  it("sends changes oldest first and ends saved", async () => {
    const sent: PendingScore[] = [];
    const { queue, settle } = setup(async (change) => void sent.push(change));
    queue.enqueue({ competitorId: "a", tenths: 800, changedAt: at(1) });
    queue.enqueue({ competitorId: "b", tenths: 700, changedAt: at(2) });
    await settle();
    expect(sent.map((c) => c.competitorId)).toEqual(["a", "b"]);
    expect(queue.state()).toMatchObject({ status: "saved", pending: [] });
  });

  it("keeps changes while offline, survives a reload and sends them in order with no duplicates", async () => {
    let online = false;
    const sent: PendingScore[] = [];
    const first = setup(async (change) => {
      if (!online) throw new TypeError("Failed to fetch");
      sent.push(change);
    });
    first.queue.enqueue({ competitorId: "a", tenths: 800, changedAt: at(1) });
    await first.settle();
    first.queue.enqueue({ competitorId: "b", tenths: 600, changedAt: at(2) });
    first.queue.enqueue({ competitorId: "a", tenths: 850, changedAt: at(3) });
    await first.settle();
    expect(first.queue.state().status).toBe("offline");
    expect(first.queue.state().pending.map((c) => c.tenths)).toEqual([600, 850]);

    // Reload the page: a new queue reads the same storage.
    online = true;
    const second = setup(async (change) => void sent.push(change), first.stored());
    expect(second.queue.state()).toMatchObject({ status: "offline" });
    second.queue.retry();
    await second.settle();
    expect(sent.map((c) => [c.competitorId, c.tenths])).toEqual([
      ["b", 600],
      ["a", 850]
    ]);
    expect(second.queue.state()).toMatchObject({ status: "saved", pending: [] });
  });

  it("retries after a failure with a scheduled timer", async () => {
    let fails = 1;
    const sent: string[] = [];
    const { queue, timers, settle } = setup(async (change) => {
      if (fails-- > 0) throw new TypeError("Failed to fetch");
      sent.push(change.competitorId);
    });
    queue.enqueue({ competitorId: "a", tenths: 1, changedAt: at(1) });
    await settle();
    expect(timers).toHaveLength(1);
    timers[0]();
    await settle();
    expect(sent).toEqual(["a"]);
    expect(queue.state().status).toBe("saved");
  });

  it("drops a change the database refuses and reports it", async () => {
    const { queue, settle } = setup(async () => {
      throw new StoreError("invalid", "This sheet is already submitted.");
    });
    queue.enqueue({ competitorId: "a", tenths: 1, changedAt: at(1) });
    await settle();
    expect(queue.state()).toMatchObject({ status: "saved", pending: [], rejected: { message: "This sheet is already submitted." } });
  });

  it("does not lose a newer change made while the older one was sending", async () => {
    let release: () => void = () => undefined;
    const sent: number[] = [];
    const { queue, settle } = setup(
      (change) =>
        new Promise<void>((resolve) => {
          sent.push(change.tenths!);
          release = resolve;
        })
    );
    queue.enqueue({ competitorId: "a", tenths: 1, changedAt: at(1) });
    await settle();
    queue.enqueue({ competitorId: "a", tenths: 2, changedAt: at(2) });
    release();
    await settle();
    release();
    await settle();
    expect(sent).toEqual([1, 2]);
    expect(queue.state().pending).toEqual([]);
  });
});
