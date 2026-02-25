const test = require("node:test");
const assert = require("node:assert/strict");
const { setTimeout: delay } = require("node:timers/promises");

const { JobQueue } = require("../packages/queue/dist/index.js");

test("JobQueue respects concurrency", async () => {
  let active = 0;
  let maxActive = 0;

  const queue = new JobQueue(async ({ payload }) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await delay(payload.ms);
    active -= 1;
    return payload.ms;
  }, 2);

  const done = [];
  const completion = new Promise((resolve) => {
    queue.onEvent((event) => {
      if (event.type === "done") {
        done.push(event.result);
      }
      if (event.type === "idle") {
        resolve();
      }
    });
  });

  queue.enqueue([
    { id: "a", payload: { ms: 50 } },
    { id: "b", payload: { ms: 50 } },
    { id: "c", payload: { ms: 50 } }
  ]);

  await completion;

  assert.equal(done.length, 3);
  assert.ok(maxActive <= 2, `expected <=2 active jobs, got ${maxActive}`);
});

test("JobQueue can cancel pending job", async () => {
  const queue = new JobQueue(async ({ payload }) => {
    await delay(payload.ms);
    return payload.ms;
  }, 1);

  const events = [];
  const completion = new Promise((resolve) => {
    queue.onEvent((event) => {
      events.push(event);
      if (event.type === "idle") {
        resolve();
      }
    });
  });

  queue.enqueue([
    { id: "a", payload: { ms: 40 } },
    { id: "b", payload: { ms: 40 } }
  ]);

  queue.cancel("b");

  await completion;

  assert.equal(events.some((event) => event.type === "canceled" && event.jobId === "b"), true);
  assert.equal(events.some((event) => event.type === "done" && event.jobId === "b"), false);
});
