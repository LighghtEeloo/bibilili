const assert = require("node:assert/strict");
const test = require("node:test");
global.window = globalThis;
require("../src/content-performance.js");
const { RuntimePerformance, PerformanceCounter: Counter, PerformanceWork: Work, ReconcileCause,
  DiscoveryProfile, DiscoveryStep } = global.__bibililiPerformance;

test("disabled recording never reads the clock or changes counters", () => {
  const recorder = new RuntimePerformance(() => { throw new Error("unexpected clock"); });
  recorder.count(Counter.NAVIGATION);
  recorder.request(ReconcileCause.MUTATION);
  assert.equal(recorder.begin(), null);
  recorder.setState(false, true);
  assert.equal(recorder.snapshot().states.off.elapsedMs, 0);
});

test("elapsed time and work stay separated across visible, hidden, and off periods", () => {
  let now = 0;
  const recorder = new RuntimePerformance(() => now);
  recorder.setEnabled(true);
  const sample = recorder.begin();
  now = 5;
  recorder.end(Work.RECONCILE, sample);
  recorder.end(Work.RECONCILE, sample);
  recorder.request(ReconcileCause.MUTATION);
  now = 100;
  recorder.setState(true, true);
  now = 300;
  recorder.setState(false, true);
  now = 600;
  const { states } = recorder.snapshot();
  assert.deepEqual(Object.values(states).map((state) => state.elapsedMs), [100, 200, 300]);
  assert.deepEqual(states.visible.work.reconcile, { count: 1, totalMs: 5, maxMs: 5 });
  assert.equal(states.visible.causes.mutation, 1);
  assert.equal(states.hidden.counters.navigationTicks, 0);
  states.visible.work.reconcile.count = 999;
  assert.equal(recorder.snapshot().states.visible.work.reconcile.count, 1);
});

test("pause excludes elapsed time and late samples; resume retains totals; reset invalidates requests", () => {
  let now = 0;
  const recorder = new RuntimePerformance(() => now);
  recorder.setEnabled(true);
  recorder.count(Counter.CACHE);
  const beforePause = recorder.beginRequest();
  now = 10;
  recorder.setEnabled(false);
  now = 100;
  recorder.setEnabled(true);
  recorder.endRequest(beforePause, true);
  const beforeReset = recorder.beginRequest();
  assert.equal(recorder.snapshot().states.visible.elapsedMs, 10);
  assert.equal(recorder.snapshot().states.visible.counters.previewCacheHits, 1);
  recorder.reset();
  recorder.endRequest(beforeReset, true);
  now = 120;
  const current = recorder.beginRequest();
  recorder.setState(true, true);
  recorder.endRequest(current, true, true);
  const { states } = recorder.snapshot();
  assert.equal(states.visible.elapsedMs, 20);
  assert.equal(states.visible.counters.apiRequests, 1);
  assert.equal(states.visible.counters.apiErrors, 0);
  assert.equal(states.visible.counters.apiAborts, 1);
  assert.equal(states.hidden.counters.apiAborts, 0);
});

test("aggregation uses fixed records even across long sessions", () => {
  const recorder = new RuntimePerformance(() => 0);
  recorder.setEnabled(true);
  const shape = (value) => JSON.stringify(value).replace(/\d+/gu, "0");
  const initial = shape(recorder.snapshot());
  for (let index = 0; index < 10000; index += 1) {
    recorder.request(ReconcileCause.PAGE);
    recorder.end(Work.RAIL, recorder.begin());
  }
  assert.equal(shape(recorder.snapshot()), initial);
});

test("discovery profiles accumulate repeated reads, preserve results and errors, and detach snapshots", () => {
  let now = 0;
  const recorder = new RuntimePerformance(() => now);
  recorder.setEnabled(true);
  const profile = new DiscoveryProfile(recorder);
  const result = {};
  assert.equal(profile.measure(DiscoveryStep.SOURCE_ROOTS, () => { now += 20.123; return result; }), result);
  profile.measure(DiscoveryStep.SOURCE_ROOTS, () => { now += 30; });
  const failure = new Error("failed read");
  assert.throws(() => profile.measure(DiscoveryStep.SOURCE_ITEMS, () => { now += 10; throw failure; }),
    (error) => error === failure);
  const snapshot = profile.snapshot();
  assert.equal(snapshot.sourceRoots, 50.1);
  assert.equal(snapshot.sourceItems, 10);
  assert.equal(snapshot.comments, 0);
  snapshot.sourceRoots = 999;
  assert.equal(profile.snapshot().sourceRoots, 50.1);
});

test("reset and recording boundaries invalidate discovery profiles without suppressing the reads", () => {
  const recorder = new RuntimePerformance(() => 0);
  recorder.setEnabled(true);
  const beforeReset = new DiscoveryProfile(recorder);
  recorder.reset();
  const beforePause = new DiscoveryProfile(recorder);
  recorder.setEnabled(false);
  recorder.setEnabled(true);
  recorder.now = () => { throw new Error("retired profile read the clock"); };
  assert.equal(beforeReset.measure(DiscoveryStep.PLAYER, () => "reset"), "reset");
  assert.equal(beforePause.measure(DiscoveryStep.PLAYER, () => "pause"), "pause");
  const current = new DiscoveryProfile(recorder);
  recorder.enabled = false;
  assert.equal(current.measure(DiscoveryStep.PLAYER, () => "disabled"), "disabled");
});
