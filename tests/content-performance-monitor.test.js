const assert = require("node:assert/strict");
const test = require("node:test");
const { FakeStorage, ThrowingStorage } = require("./helpers/content-runtime.js");
global.window = globalThis;
require("../src/content-performance.js");
require("../src/content-performance-monitor.js");
const { RuntimePerformance, PerformanceWork, PerformanceState } = global.__bibililiPerformance;
const { PerformanceMonitor } = global.__bibililiPerformanceMonitor;

/** Drives real diagnostics with a monotonic clock, media events, and tab-local storage. */
function fixture(t, storage = new FakeStorage()) {
  const saved = Object.fromEntries(["sessionStorage", "addEventListener", "removeEventListener", "PerformanceObserver"]
    .map((key) => [key, global[key]]));
  const listeners = new Map();
  const add = (name, callback) => {
    if (!listeners.has(name)) listeners.set(name, new Set());
    listeners.get(name).add(callback);
  };
  const remove = (name, callback) => listeners.get(name)?.delete(callback);
  const observers = [];
  class Observer {
    static supportedEntryTypes = ["longtask"];
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe() { this.connected = true; }
    disconnect() { this.connected = false; }
    takeRecords() { return []; }
    emit(duration, startTime = 0) { this.callback({ getEntries: () => [{ duration, startTime }] }); }
  }
  Object.assign(global, { sessionStorage: storage, addEventListener: add, removeEventListener: remove,
    PerformanceObserver: Observer });
  const document = { hidden: false, focused: true, hasFocus: () => document.focused,
    addEventListener: add, removeEventListener: remove };
  let now = 0;
  const recorder = new RuntimePerformance(() => now);
  let media = { currentTime: 12, readyState: 4, networkState: 2, paused: false, seeking: false,
    muted: false, volume: 0.5, playbackRate: 1,
    buffered: { length: 1, start: () => 0, end: () => 30 } };
  const monitor = new PerformanceMonitor(document, recorder, {
    media: () => media, route: () => "video:BV1aa411c7mD:p1", onChange: () => {}
  });
  recorder.monitor = monitor;
  const enable = () => { recorder.setEnabled(true); monitor.setEnabled(true); monitor.setActive(true); };
  const emit = (type, properties = {}) => {
    for (const callback of listeners.get(type) ?? []) callback({ type, target: media, ...properties });
  };
  const advance = (duration) => {
    for (let elapsed = 0; elapsed < duration; elapsed += 500) { now += 500; monitor.tick(); }
  };
  t.after(() => { monitor.stop(); Object.assign(global, saved); });
  return { monitor, recorder, storage, observers, listeners, document, enable, emit, advance,
    setTime: (time) => { now = time; }, media, setMedia: (next) => { media = next; } };
}

test("recording owns observation only while active and tolerates missing long-task support", (t) => {
  const { monitor, recorder, observers, listeners, enable } = fixture(t);
  assert.equal(observers.length, 0);
  enable();
  const old = observers[0];
  old.emit(300);
  assert.equal(monitor.status().level, "warning");
  monitor.reset();
  monitor.setActive(false);
  assert.equal(old.connected, false);
  assert.equal(listeners.get("waiting").size, 0);
  monitor.setActive(true);
  old.emit(2000);
  assert.equal(monitor.status().level, "quiet", "a retired observer cannot report into the new interval");
  observers[1].emit(1200);
  assert.equal(monitor.status().level, "severe");
  recorder.setEnabled(false);
  monitor.setEnabled(false);
  assert.equal(listeners.get("pagehide").size, 0);
  assert.equal(observers[1].connected, false);
  monitor.longTasksSupported = false;
  enable();
  assert.equal(monitor.observer, null);
  monitor.stop();
  for (const callbacks of listeners.values()) assert.equal(callbacks.size, 0);
});

test("buffering alerts require continuous unpaused playback and ignore buffered stalled events", (t) => {
  const { monitor, enable, media, emit, advance } = fixture(t);
  enable();
  emit("stalled");
  advance(11000);
  assert.equal(monitor.status().level, "quiet");
  media.readyState = 2;
  media.paused = true;
  emit("waiting");
  advance(4000);
  assert.equal(monitor.status().level, "quiet");
  media.paused = false;
  media.seeking = true;
  emit("waiting");
  advance(4000);
  assert.equal(monitor.status().level, "quiet");
  media.seeking = false;
  emit("waiting");
  advance(2500);
  assert.equal(monitor.status().level, "quiet");
  advance(500);
  assert.deepEqual(monitor.status(), { level: "warning", type: "buffering" });
  advance(7000);
  assert.deepEqual(monitor.status(), { level: "severe", type: "buffering" });
  media.readyState = 4;
  emit("playing");
  assert.equal(monitor.waiting, null);
  assert.equal(monitor.status().level, "severe", "recovery preserves evidence until copying");
  assert.equal(monitor.snapshot().current.context.media.bufferedAhead, 18);
});

test("polling discovers existing buffering but never treats hidden time as a stall", (t) => {
  const { monitor, enable, media, advance, setTime, recorder, document } = fixture(t);
  enable();
  media.readyState = 1;
  advance(3500);
  assert.equal(monitor.status().type, "buffering");
  monitor.reset();
  media.readyState = 4;
  document.hidden = true;
  recorder.setState(true, true);
  monitor.setActive(true);
  setTime(100000);
  monitor.tick();
  assert.equal(monitor.status().level, "quiet");
  document.hidden = false;
  recorder.setState(true, false);
  monitor.setActive(true);
  advance(500);
  assert.equal(monitor.status().level, "quiet");
  setTime(104000);
  monitor.tick();
  assert.equal(monitor.status().type, "timer_gap");
});

test("a visible page behind another app records focus separately and ignores throttled timer gaps", (t) => {
  const { monitor, document, enable, emit, setTime, observers } = fixture(t);
  enable();
  document.focused = false;
  emit("blur");
  setTime(60000);
  monitor.tick();
  assert.equal(monitor.status().level, "quiet");
  assert.equal(monitor.events.at(-1).type, "window_blur");
  assert.equal(monitor.events.at(-1).focused, false);
  const context = monitor.snapshot().current.context;
  assert.equal(context.hidden, false);
  assert.equal(context.focused, false);
  assert.equal(context.media.muted, false);
  assert.equal(context.media.volume, 0.5);
  observers[0].emit(1200, 59000);
  assert.equal(monitor.status().type, "long_task", "actual long tasks remain observable behind another app");
  monitor.reset();
  document.focused = true;
  emit("focus");
  monitor.tick();
  assert.equal(monitor.status().level, "quiet");
});

test("background media recovery records buffering even without a timer callback during the stall", (t) => {
  const { monitor, document, recorder, media, enable, emit, setTime, listeners, storage } = fixture(t);
  enable();
  document.hidden = true;
  document.focused = false;
  recorder.setState(true, true);
  monitor.setActive(true);
  assert.equal(listeners.get("waiting").size, 1);
  media.readyState = 2;
  emit("waiting");
  setTime(6500);
  media.readyState = 4;
  emit("playing");
  assert.equal(monitor.waiting, null);
  assert.deepEqual(monitor.status(), { level: "warning", type: "buffering" });
  const buffering = monitor.events.find(({ type }) => type === "buffering");
  assert.equal(buffering.state, "hidden");
  assert.equal(buffering.focused, false);
  assert.equal(buffering.details.durationMs, 6500);
  assert.equal(monitor.events.some(({ type }) => type === "timer_gap"), false);
  const stored = JSON.parse([...storage.records.values()][0]);
  assert.equal(stored.alert.type, "buffering");
  assert.equal(stored.context.focused, false);
});

test("visibility changes preserve a buffering interval and background media errors survive reload", (t) => {
  const { monitor, document, recorder, media, enable, emit, setTime, storage } = fixture(t);
  enable();
  media.readyState = 2;
  emit("waiting");
  setTime(2000);
  document.hidden = true;
  recorder.setState(true, true);
  monitor.setActive(true);
  setTime(3500);
  monitor.tick();
  assert.equal(monitor.alert.details.durationMs, 3500);
  assert.equal(monitor.alert.state, "hidden");
  media.error = { code: 2 };
  emit("error");
  const stored = JSON.parse([...storage.records.values()][0]);
  assert.equal(stored.alert.type, "media_error");
  assert.equal(stored.alert.state, "hidden");
  assert.equal(stored.context.media.errorCode, 2);
});

test("freeze and resume retain lifecycle evidence without charging suspension to buffering or responsiveness", (t) => {
  const { monitor, enable, media, emit, setTime, storage, observers } = fixture(t);
  enable();
  media.readyState = 2;
  emit("waiting");
  setTime(1000);
  emit("freeze");
  assert.equal(monitor.waiting, null);
  assert.equal(JSON.parse([...storage.records.values()][0]).context.frozen, true);
  setTime(300000);
  monitor.tick();
  observers[0].emit(2000, 2000);
  assert.equal(monitor.status().level, "quiet");
  media.readyState = 4;
  emit("resume");
  monitor.tick();
  assert.equal(monitor.status().level, "quiet");
  assert.equal(monitor.frozen, false);
  assert.equal(monitor.events.at(-1).type, "page_resumed");
});

test("measurements detect expensive extension work, request bursts, and failures but ignore canceled samples", (t) => {
  const { monitor, recorder, enable, setTime } = fixture(t);
  enable();
  const sample = recorder.begin();
  setTime(150);
  recorder.end(PerformanceWork.RECONCILE, sample);
  assert.equal(monitor.status().type, "slow_extension_work");
  monitor.reset();
  recorder.endRequest(recorder.beginRequest(), true, true);
  assert.equal(monitor.status().level, "quiet");
  recorder.endRequest(recorder.beginRequest(), true);
  assert.equal(monitor.status().type, "api_error");
  monitor.reset();
  for (let index = 0; index < 20; index += 1) recorder.beginRequest();
  assert.equal(monitor.status().type, "api_burst");
  monitor.reset();
  for (let index = 0; index < 20; index += 1) monitor.work(PerformanceWork.RECONCILE, 60, PerformanceState.VISIBLE);
  assert.equal(monitor.status().type, "busy_extension");
  monitor.reset();
  recorder.setState(true, true);
  monitor.work(PerformanceWork.RECONCILE, 2000, PerformanceState.HIDDEN);
  assert.equal(monitor.status().type, "slow_extension_work");
  assert.equal(monitor.alert.state, "hidden");
  monitor.reset();
  monitor.work(PerformanceWork.RECONCILE, 2000, PerformanceState.OFF);
  assert.equal(monitor.status().level, "quiet");
});

test("a successful copy acknowledges its snapshot while later alerts and bounded history survive", (t) => {
  const { monitor, enable } = fixture(t);
  enable();
  monitor.event("timer_gap", { durationMs: 2500 }, "severe");
  for (let index = 0; index < 200; index += 1) monitor.event("route_change");
  assert.equal(monitor.events.length, 80);
  assert.equal(monitor.status().level, "severe", "ring eviction must not extinguish an alert");
  const copied = monitor.snapshot();
  monitor.event("api_error", {}, "warning");
  for (let index = 0; index < 200; index += 1) monitor.event("route_change");
  monitor.acknowledge(copied);
  assert.equal(monitor.status().type, "api_error", "an alert arriving during clipboard access remains pending");
  monitor.acknowledge(monitor.snapshot());
  assert.equal(monitor.status().level, "quiet");
  assert.equal(monitor.events.length, 80);
});

test("departure checkpoints survive a new document, retain player evidence, and contain only bounded measurements", (t) => {
  const { monitor, recorder, enable, emit, storage } = fixture(t);
  enable();
  monitor.event("navigation_fallback", { reason: "timeout" }, "severe");
  emit("pagehide", { persisted: false });
  const persisted = [...storage.records.values()][0];
  const data = JSON.parse(persisted);
  data.extra = "private page text";
  data.events[0].details = { cookie: "private cookie" };
  data.context.extra = "private response";
  storage.setItem([...storage.records.keys()][0], JSON.stringify(data));
  const restored = new PerformanceMonitor(monitor.document, recorder, {
    media: () => null, route: () => "video:BV1bb411c7mD:p1", onChange: () => {}
  });
  restored.setEnabled(true);
  t.after(() => restored.stop());
  assert.equal(restored.status().type, "navigation_fallback");
  const report = restored.snapshot();
  assert.equal(report.previous.context.route, "video:BV1aa411c7mD:p1");
  assert.equal(report.previous.context.media.currentTime, 12, "old player data is available before the new player mounts");
  assert.equal(report.previous.alert.details.reason, "timeout");
  assert.equal(JSON.stringify(report).includes("private"), false);
  report.previous.events.length = 0;
  assert.ok(restored.previous.events.length > 0, "snapshots cannot modify stored evidence");
  restored.acknowledge(restored.snapshot());
  assert.equal(restored.status().level, "quiet");
  restored.reset();
  assert.equal(restored.previous, null);
  assert.equal(storage.records.size, 0);
});

test("expired, malformed, and oversized traces are ignored and blocked storage does not break recording", (t) => {
  const { monitor, storage, enable } = fixture(t);
  enable();
  monitor.checkpoint(true);
  const key = [...storage.records.keys()][0];
  const data = JSON.parse(storage.getItem(key));
  for (const value of ["bad JSON", "x".repeat(64001), JSON.stringify({ ...data, capturedAt: Date.now() - 1800001 }),
    JSON.stringify({ ...data, events: [null] })]) {
    storage.setItem(key, value);
    assert.equal(monitor.readPrevious(), null);
  }
  global.sessionStorage = new ThrowingStorage();
  monitor.event("media_error", { code: 2 }, "severe");
  monitor.checkpoint(true);
  assert.equal(monitor.snapshot().current.alert.type, "media_error");
  assert.equal(monitor.readPrevious(), null);
  monitor.setEnabled(false);
});
