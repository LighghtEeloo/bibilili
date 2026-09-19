const assert = require("node:assert/strict");
const test = require("node:test");
const { FakeStorage, loadContentRuntime, TEST_WATCH_HREF } = require("./helpers/content-runtime.js");
const { BibililiController } = loadContentRuntime();

/** Runs controller lifecycle events with observable timer and listener ownership. */
function activityFixture(t, { enabled = true, hidden = false } = {}) {
  const listeners = new Map();
  const add = (type, callback) => {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type).add(callback);
  };
  const remove = (type, callback) => listeners.get(type)?.delete(callback);
  const document = {
    hidden,
    documentElement: {},
    addEventListener: add,
    removeEventListener: remove
  };
  const previous = Object.fromEntries([
    "location", "localStorage", "sessionStorage", "MutationObserver", "matchMedia",
    "addEventListener", "removeEventListener"
  ].map((key) => [key, global[key]]));
  Object.assign(global, {
    location: new URL(TEST_WATCH_HREF),
    localStorage: new FakeStorage(), sessionStorage: new FakeStorage(),
    addEventListener: add, removeEventListener: remove,
    matchMedia: () => ({ addEventListener: add, removeEventListener: remove }),
    MutationObserver: class {
      constructor(callback) { this.callback = callback; }
      observe() { this.connected = true; }
      disconnect() { this.connected = false; }
    }
  });
  const timers = new Map();
  const intervals = new Map();
  let nextId = 1;
  t.mock.method(global, "setTimeout", (callback, delay) => {
    const id = nextId++;
    timers.set(id, { callback, delay });
    return id;
  });
  t.mock.method(global, "clearTimeout", (id) => timers.delete(id));
  t.mock.method(global, "setInterval", (callback, delay) => {
    const id = nextId++;
    intervals.set(id, { callback, delay });
    return id;
  });
  t.mock.method(global, "clearInterval", (id) => intervals.delete(id));
  t.mock.method(global.__bibililiI18n.LanguageResolver, "resolve", () => "en");
  t.mock.method(global.__bibililiTheme.BilibiliThemeSync, "sync", () => {});
  const controller = new BibililiController(document);
  controller.enabled = enabled;
  for (const method of ["renderFloatingActivation", "prepareMount"]) t.mock.method(controller, method, () => {});
  t.mock.method(controller.layout, "destroy", () => {});
  t.mock.method(controller.layout, "resetPageSession", () => {});
  t.mock.method(controller.navigation, "start", () => {});
  t.mock.method(controller.accountSources, "refresh", async () => {});
  t.after(() => {
    controller.stop();
    Object.assign(global, previous);
  });
  const emit = (type) => [...listeners.get(type) ?? []].forEach((callback) => callback());
  const visibility = (hidden) => { document.hidden = hidden; emit("visibilitychange"); };
  return { controller, document, listeners, timers, intervals, visibility };
}

test("off startup leaves polling, page observation, media, and account loading stopped", (t) => {
  const { controller, timers, intervals, listeners } = activityFixture(t, { enabled: false });
  controller.start();
  assert.equal(controller.observer, null);
  assert.equal(intervals.size, 0);
  assert.equal(controller.settlingTimers.length, 0);
  assert.equal(controller.navigation.start.mock.callCount(), 0);
  assert.equal(controller.accountSources.refresh.mock.callCount(), 0);
  assert.equal(listeners.get("loadstart")?.size ?? 0, 0);
  assert.equal(listeners.get("storage").size, 1);
  assert.equal(listeners.get("visibilitychange").size, 1);
  assert.ok([...timers.values()].every(({ delay }) => delay === 0), "only the initial control update is scheduled");
});

test("switching off stops recurring work and reactivation samples the current route", (t) => {
  const { controller, timers, intervals, listeners } = activityFixture(t);
  controller.start();
  const observer = controller.observer;
  assert.equal(intervals.size, 1);
  assert.equal(listeners.get("loadstart").size, 1);
  controller.setEnabled(false, false);
  assert.equal(observer.connected, false);
  assert.equal(controller.observer, null);
  assert.equal(intervals.size, 0);
  assert.equal(timers.size, 0);
  assert.equal(listeners.get("loadstart").size, 0);
  observer.callback([{ target: {} }]);
  assert.equal(timers.size, 0, "queued mutations cannot restart work while off");

  global.location = new URL("https://www.bilibili.com/video/av222");
  controller.setEnabled(true, false);
  assert.equal(controller.pageKey, "video:av222:p1");
  assert.equal(controller.observer.connected, true);
  assert.equal(intervals.size, 1);
  assert.equal(controller.reconcileScheduler.pendingResetSourceRoute, true);
  controller.updateRuntimeActivity();
  assert.equal(intervals.size, 1, "resuming does not duplicate polling");
  assert.equal(listeners.get("loadstart").size, 1);
});

test("hidden pages coalesce work and reconcile missed navigation on return", (t) => {
  const { controller, timers, intervals, visibility } = activityFixture(t);
  controller.start();
  const observer = controller.observer;
  visibility(true);
  assert.equal(observer.connected, false);
  assert.equal(intervals.size, 0);
  assert.equal(timers.size, 0);
  controller.scheduleReconcile(true);
  controller.scheduleReconcile(false);
  assert.equal(timers.size, 0);
  assert.equal(controller.pendingSourceRouteReset, true);

  global.location = new URL("https://www.bilibili.com/video/av333");
  controller.handlePotentialNavigation();
  assert.notEqual(controller.pageKey, "video:av333:p1");
  visibility(false);
  assert.equal(controller.pageKey, "video:av333:p1");
  assert.equal(intervals.size, 1);
  assert.equal(controller.observer.connected, true);
  assert.equal(controller.reconcileScheduler.pending, true);
});

test("visibility alone reuses account results and does not restart settling timers", (t) => {
  const { controller, visibility } = activityFixture(t);
  controller.start();
  const requests = controller.accountSources.refresh.mock.callCount();
  visibility(true);
  visibility(false);
  assert.equal(controller.accountSources.refresh.mock.callCount(), requests);
  assert.equal(controller.settlingTimers.length, 0);
  assert.equal(controller.reconcileScheduler.pending, true);
});

test("hidden startup defers account loading and observation until visible", (t) => {
  const { controller, timers, intervals, visibility } = activityFixture(t, { hidden: true });
  controller.start();
  assert.equal(controller.observer, null);
  assert.equal(timers.size, 0);
  assert.equal(intervals.size, 0);
  assert.equal(controller.accountSources.refresh.mock.callCount(), 0);
  visibility(false);
  assert.equal(controller.accountSources.refresh.mock.callCount(), 1);
  assert.equal(controller.observer.connected, true);
  assert.equal(intervals.size, 1);
  assert.equal(controller.pendingAccountRefresh, false);
});

test("account refresh requested while hidden resumes once on visibility", (t) => {
  const { controller, visibility } = activityFixture(t);
  controller.start();
  const requests = controller.accountSources.refresh.mock.callCount();
  visibility(true);
  controller.refreshAccountSources();
  controller.refreshAccountSources();
  assert.equal(controller.accountSources.refresh.mock.callCount(), requests);
  visibility(false);
  assert.equal(controller.accountSources.refresh.mock.callCount(), requests + 1);
  assert.equal(controller.pendingAccountRefresh, false);
});

test("stopping removes lifecycle listeners and prevents visibility resumption", (t) => {
  const { controller, timers, intervals, listeners, visibility } = activityFixture(t);
  controller.start();
  controller.stop();
  visibility(true);
  visibility(false);
  assert.equal(intervals.size, 0);
  assert.equal(timers.size, 0);
  for (const callbacks of listeners.values()) assert.equal(callbacks.size, 0);
});

test("performance recording adds no scheduled work and accounts for hidden and off periods", (t) => {
  const { controller, timers, intervals, visibility } = activityFixture(t);
  controller.start();
  const before = [...timers.keys()];
  const requests = controller.accountSources.refresh.mock.callCount();
  let now = 0;
  controller.performance.now = () => now;
  controller.setPreferences({ ...controller.preferences,
    features: { ...controller.preferences.features, performance: true } }, false);
  assert.deepEqual([...timers.keys()], before);
  assert.equal(intervals.size, 1);
  assert.equal(controller.accountSources.refresh.mock.callCount(), requests);
  controller.pollPageState();
  now = 100;
  visibility(true);
  controller.scheduleReconcile(false);
  now = 300;
  controller.setEnabled(false, false);
  now = 600;
  const { states } = controller.performance.snapshot();
  assert.deepEqual(Object.values(states).map((state) => state.elapsedMs), [100, 200, 300]);
  assert.equal(states.visible.counters.navigationTicks, 1);
  assert.equal(states.hidden.counters.navigationTicks, 0);
  assert.equal(states.hidden.counters.reconcileRequests, 1);
  assert.equal(states.hidden.work.reconcile.count, 0);
  assert.equal(states.off.counters.navigationTicks, 0);
  assert.equal(timers.size, 0);
  assert.equal(intervals.size, 0);
});

test("recording distinguishes coalesced scheduling requests from executed work", (t) => {
  const { controller } = activityFixture(t);
  const { ReconcileCause } = global.__bibililiPerformance;
  controller.performance.setEnabled(true);
  t.mock.method(controller, "reconcilePage", () => {});
  controller.scheduleReconcile(false, undefined, ReconcileCause.MUTATION);
  controller.scheduleReconcile(false, undefined, ReconcileCause.ACCOUNT);
  controller.reconcileScheduler.run();
  const state = controller.performance.snapshot().states.visible;
  assert.equal(state.counters.reconcileRequests, 2);
  assert.equal(state.work.reconcile.count, 1);
  assert.equal(state.causes.mutation, 1);
  assert.equal(state.causes.account, 1);
});
