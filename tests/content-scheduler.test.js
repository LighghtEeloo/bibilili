const assert = require("node:assert/strict");
const test = require("node:test");

global.window = globalThis;

require("../src/content-scheduler.js");

const {
  ReconcilePriority,
  ReconcileScheduler
} = globalThis.__bibililiScheduler;

function installTimerHarness({ idle = false } = {}) {
  const originalSetTimeout = global.setTimeout;
  const originalClearTimeout = global.clearTimeout;
  const originalRequestIdleCallback = global.requestIdleCallback;
  const originalCancelIdleCallback = global.cancelIdleCallback;
  const timers = [];
  const idleCallbacks = [];
  const clearedTimers = new Set();
  const cancelledIdleCallbacks = new Set();
  let nextId = 1;

  global.setTimeout = (callback, delay) => {
    const id = nextId;
    nextId += 1;
    timers.push({ id, callback, delay });
    return id;
  };
  global.clearTimeout = (id) => {
    clearedTimers.add(id);
  };

  if (idle) {
    global.requestIdleCallback = (callback, options) => {
      const id = nextId;
      nextId += 1;
      idleCallbacks.push({ id, callback, options });
      return id;
    };
    global.cancelIdleCallback = (id) => {
      cancelledIdleCallbacks.add(id);
    };
  } else {
    delete global.requestIdleCallback;
    delete global.cancelIdleCallback;
  }

  return {
    cancelledIdleCallbacks,
    clearedTimers,
    idleCallbacks,
    restore: () => {
      global.setTimeout = originalSetTimeout;
      global.clearTimeout = originalClearTimeout;
      if (originalRequestIdleCallback === undefined) {
        delete global.requestIdleCallback;
      } else {
        global.requestIdleCallback = originalRequestIdleCallback;
      }
      if (originalCancelIdleCallback === undefined) {
        delete global.cancelIdleCallback;
      } else {
        global.cancelIdleCallback = originalCancelIdleCallback;
      }
    },
    timers
  };
}

test("ReconcileScheduler runs urgent requests once with merged reset state", () => {
  const harness = installTimerHarness();
  const runs = [];
  const scheduler = new ReconcileScheduler((resetSourceRoute) => {
    runs.push(resetSourceRoute);
  });

  try {
    scheduler.request(false, ReconcilePriority.URGENT);
    scheduler.request(true, ReconcilePriority.URGENT);

    assert.equal(harness.timers.length, 1);
    assert.equal(harness.timers[0].delay, 0);

    harness.timers[0].callback();

    assert.deepEqual(runs, [true]);
  } finally {
    harness.restore();
  }
});

test("ReconcileScheduler debounces lazy requests through idle time", () => {
  const harness = installTimerHarness({ idle: true });
  const runs = [];
  const scheduler = new ReconcileScheduler((resetSourceRoute) => {
    runs.push(resetSourceRoute);
  });

  try {
    scheduler.request(false, ReconcilePriority.LAZY);
    scheduler.request(true, ReconcilePriority.LAZY);

    assert.equal(harness.timers.length, 1);
    assert.equal(harness.timers[0].delay, 160);

    harness.timers[0].callback();

    assert.equal(harness.idleCallbacks.length, 1);
    assert.deepEqual(harness.idleCallbacks[0].options, { timeout: 900 });

    harness.idleCallbacks[0].callback();

    assert.deepEqual(runs, [true]);
  } finally {
    harness.restore();
  }
});

test("ReconcileScheduler urgent requests cancel pending lazy work", () => {
  const harness = installTimerHarness({ idle: true });
  const runs = [];
  const scheduler = new ReconcileScheduler((resetSourceRoute) => {
    runs.push(resetSourceRoute);
  });

  try {
    scheduler.request(false, ReconcilePriority.LAZY);
    const lazyTimer = harness.timers[0];

    scheduler.request(true, ReconcilePriority.URGENT);

    assert.ok(harness.clearedTimers.has(lazyTimer.id));
    assert.equal(harness.timers.length, 2);
    assert.equal(harness.timers[1].delay, 0);

    harness.timers[1].callback();

    assert.deepEqual(runs, [true]);
  } finally {
    harness.restore();
  }
});

test("ReconcileScheduler cancel clears timers and pending work", () => {
  const harness = installTimerHarness();
  const runs = [];
  const scheduler = new ReconcileScheduler((resetSourceRoute) => {
    runs.push(resetSourceRoute);
  });

  try {
    scheduler.request(true, ReconcilePriority.LAZY);
    const lazyTimer = harness.timers[0];

    scheduler.cancel();

    assert.ok(harness.clearedTimers.has(lazyTimer.id));

    scheduler.run();

    assert.deepEqual(runs, []);
  } finally {
    harness.restore();
  }
});
