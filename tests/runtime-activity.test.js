const assert = require("node:assert/strict");
const test = require("node:test");
const { FakeStorage, loadContentRuntime, TEST_WATCH_HREF } = require("./helpers/content-runtime.js");
const { BibililiController, SourceKind } = loadContentRuntime();

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
    "addEventListener", "removeEventListener", "PerformanceObserver"
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
    },
    PerformanceObserver: class {
      static supportedEntryTypes = ["resource"];
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
  assert.equal(controller.accountSources.watchLaterObserver, null);
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
  const watchLaterObserver = controller.accountSources.watchLaterObserver;
  assert.equal(intervals.size, 1);
  assert.equal(listeners.get("loadstart").size, 1);
  controller.setEnabled(false, false);
  assert.equal(observer.connected, false);
  assert.equal(controller.observer, null);
  assert.equal(watchLaterObserver.connected, false);
  assert.equal(controller.accountSources.watchLaterObserver, null);
  assert.equal(intervals.size, 0);
  assert.equal(timers.size, 0);
  assert.equal(listeners.get("loadstart").size, 0);
  observer.callback([{ target: {} }]);
  assert.equal(timers.size, 0, "queued mutations cannot restart work while off");

  global.location = new URL("https://www.bilibili.com/video/av222");
  controller.setEnabled(true, false);
  assert.equal(controller.pageKey, "video:av222:p1");
  assert.equal(controller.observer.connected, true);
  assert.equal(controller.accountSources.watchLaterObserver.connected, true);
  assert.equal(intervals.size, 1);
  assert.equal(controller.reconcileScheduler.pendingResetSourceRoute, true);
  controller.updateRuntimeActivity();
  assert.equal(intervals.size, 1, "resuming does not duplicate polling");
  assert.equal(listeners.get("loadstart").size, 1);
});

test("watch-later observation follows source preferences and watch routes while remaining active in hidden tabs", (t) => {
  const { controller, visibility, intervals } = activityFixture(t);
  controller.start();
  const first = controller.accountSources.watchLaterObserver;
  visibility(true);
  visibility(false);
  assert.equal(controller.accountSources.watchLaterObserver, first);
  assert.equal(first.connected, true);
  assert.equal(intervals.size, 1, "resource observation adds no polling");

  controller.setPreferences({ ...controller.preferences,
    sources: { ...controller.preferences.sources, [SourceKind.WATCH_LATER]: false } }, false);
  assert.equal(first.connected, false);
  assert.equal(controller.accountSources.watchLaterObserver, null);
  controller.setPreferences({ ...controller.preferences,
    sources: { ...controller.preferences.sources, [SourceKind.WATCH_LATER]: true } }, false);
  const resumed = controller.accountSources.watchLaterObserver;
  assert.equal(resumed.connected, true);
  global.location = new URL("https://www.bilibili.com/video/av222");
  controller.handlePotentialNavigation();
  assert.equal(controller.accountSources.watchLaterObserver, resumed);
  global.location = new URL("https://www.bilibili.com/");
  controller.handlePotentialNavigation();
  assert.equal(resumed.connected, false);
  assert.equal(controller.accountSources.watchLaterObserver, null);
  global.location = new URL(TEST_WATCH_HREF);
  controller.handlePotentialNavigation();
  const returned = controller.accountSources.watchLaterObserver;
  assert.equal(returned.connected, true);
  controller.stop();
  assert.equal(returned.connected, false);
  assert.equal(controller.accountSources.watchLaterObserver, null);
});

test("hidden pages reconcile mutations and detect navigation before returning", (t) => {
  const { controller, timers, intervals, visibility } = activityFixture(t);
  const reconcile = t.mock.method(controller, "reconcilePage", () => {});
  t.mock.method(controller.discovery, "findPlayerRegion", () => null);
  controller.start();
  controller.reconcileScheduler.run();
  const observer = controller.observer;
  const polling = controller.urlTimer;
  const scheduled = [...timers.keys()];
  visibility(true);
  assert.equal(observer.connected, true);
  assert.equal(controller.urlTimer, polling);
  assert.deepEqual([...timers.keys()], scheduled);
  observer.callback([{ target: {} }]);
  controller.scheduleReconcile(true);
  controller.scheduleReconcile(false);
  assert.equal(timers.size, scheduled.length + 1, "hidden changes still coalesce");
  assert.equal(controller.reconcileScheduler.pendingResetSourceRoute, true);
  controller.reconcileScheduler.run();
  assert.equal(reconcile.mock.callCount(), 2, "background reconciliation executes");

  global.location = new URL("https://www.bilibili.com/video/av333");
  intervals.get(polling).callback();
  assert.equal(controller.pageKey, "video:av333:p1");
  assert.equal(controller.layout.resetPageSession.mock.callCount(), 1);
  assert.equal(controller.accountSources.refresh.mock.callCount(), 2);
  assert.equal(controller.reconcileScheduler.pendingResetSourceRoute, true);
  visibility(false);
  assert.equal(intervals.size, 1);
  assert.equal(controller.observer, observer);
  assert.equal(controller.accountSources.refresh.mock.callCount(), 2);
});

for (const hidden of [false, true]) {
  test(`full-page switching reloads native video changes once while ${hidden ? "hidden" : "visible"}`, (t) => {
    const { controller, intervals } = activityFixture(t, { hidden });
    const { CardNavigationOriginStore } = global.__bibililiStorageState;
    controller.preferences.features.inPageNavigation = false;
    const reloads = [];
    global.location.reload = () => reloads.push(global.location.href);
    controller.start();
    const requests = controller.accountSources.refresh.mock.callCount();
    const poll = intervals.get(controller.urlTimer).callback;
    poll();
    global.location.href = `${TEST_WATCH_HREF}?from=player&t=12#comments`;
    poll();
    assert.deepEqual(reloads, [], "startup, tracking, timestamps, and fragments retain the document");

    const target = "https://www.bilibili.com/video/av333?p=2";
    CardNavigationOriginStore.write({ sourceKind: SourceKind.HISTORY }, "video:av333:p2");
    global.location.href = target;
    poll();
    poll();
    assert.deepEqual(reloads, [target]);
    assert.equal(controller.pageKey, "video:av333:p2");
    assert.equal(controller.layout.resetPageSession.mock.callCount(), 0);
    assert.equal(controller.accountSources.refresh.mock.callCount(), requests);
    assert.equal(controller.reconcileScheduler.pending, false);
    assert.deepEqual(CardNavigationOriginStore.take("video:av333:p2"), { sourceKind: SourceKind.HISTORY });
  });
}

test("full-page switching follows history and parts while disabled layouts keep native navigation", (t) => {
  const { controller, listeners } = activityFixture(t);
  controller.preferences.features.inPageNavigation = false;
  const reloads = [];
  global.location.reload = () => reloads.push(global.location.href);
  controller.start();
  global.location.href = `${TEST_WATCH_HREF}?p=2`;
  for (const callback of listeners.get("popstate")) callback();
  assert.deepEqual(reloads, [`${TEST_WATCH_HREF}?p=2`]);

  global.location.href = "https://www.bilibili.com/";
  controller.handlePotentialNavigation();
  assert.equal(reloads.length, 1, "leaving the watch page does not trigger another load");
  controller.setEnabled(false, false);
  global.location.href = TEST_WATCH_HREF;
  for (const callback of listeners.get("popstate")) callback();
  assert.equal(reloads.length, 1, "the preference does not control a disabled layout");
});

test("visibility alone reuses account results and does not restart settling timers", (t) => {
  const { controller, visibility } = activityFixture(t);
  controller.start();
  const requests = controller.accountSources.refresh.mock.callCount();
  const settling = [...controller.settlingTimers];
  visibility(true);
  visibility(false);
  assert.equal(controller.accountSources.refresh.mock.callCount(), requests);
  assert.deepEqual(controller.settlingTimers, settling);
  assert.equal(controller.reconcileScheduler.pending, true);
});

test("hidden startup initializes navigation, account loading, and reconciliation", (t) => {
  const { controller, intervals, listeners, visibility } = activityFixture(t, { hidden: true });
  const reconcile = t.mock.method(controller, "reconcilePage", () => {});
  controller.start();
  assert.equal(controller.accountSources.refresh.mock.callCount(), 1);
  assert.equal(controller.observer.connected, true);
  assert.equal(intervals.size, 1);
  assert.equal(listeners.get("loadstart").size, 1);
  assert.equal(controller.navigation.start.mock.callCount(), 1);
  assert.ok(controller.settlingTimers.length > 0);
  controller.reconcileScheduler.run();
  assert.equal(reconcile.mock.callCount(), 1);
  visibility(false);
  assert.equal(controller.accountSources.refresh.mock.callCount(), 1);
});

test("account refresh requested while hidden runs without a visibility replay", (t) => {
  const { controller, visibility } = activityFixture(t);
  controller.start();
  const requests = controller.accountSources.refresh.mock.callCount();
  visibility(true);
  controller.refreshAccountSources();
  controller.refreshAccountSources();
  assert.equal(controller.accountSources.refresh.mock.callCount(), requests + 2);
  visibility(false);
  assert.equal(controller.accountSources.refresh.mock.callCount(), requests + 2);
});

test("hidden activation still stops and restarts the extension runtime", (t) => {
  const { controller, timers, intervals, listeners, visibility } = activityFixture(t, { hidden: true, enabled: false });
  controller.start();
  assert.equal(controller.observer, null);
  assert.equal(intervals.size, 0);
  assert.equal(controller.accountSources.refresh.mock.callCount(), 0);
  global.location = new URL("https://www.bilibili.com/video/av222");
  controller.setEnabled(true, false);
  assert.equal(controller.pageKey, "video:av222:p1");
  assert.equal(controller.observer.connected, true);
  assert.equal(intervals.size, 1);
  assert.equal(controller.accountSources.refresh.mock.callCount(), 1);
  controller.setEnabled(false, false);
  assert.equal(controller.observer, null);
  assert.equal(intervals.size, 0);
  assert.equal(timers.size, 0);
  assert.equal(listeners.get("loadstart").size, 0);
  visibility(false);
  assert.equal(intervals.size, 0);
  assert.equal(controller.observer, null);
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
  const { controller, timers, intervals, visibility, listeners } = activityFixture(t);
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
  assert.equal(controller.performanceMonitor.active, true, "background playback remains observed");
  assert.equal(listeners.get("waiting").size, 1);
  controller.pollPageState();
  t.mock.method(controller, "reconcilePage", () => {});
  controller.scheduleReconcile(false);
  controller.reconcileScheduler.run();
  now = 300;
  controller.setEnabled(false, false);
  assert.equal(controller.performanceMonitor.active, false);
  assert.equal(listeners.get("waiting").size, 0);
  now = 600;
  const { states } = controller.performance.snapshot();
  assert.deepEqual(Object.values(states).map((state) => state.elapsedMs), [100, 200, 300]);
  assert.equal(states.visible.counters.navigationTicks, 1);
  assert.equal(states.hidden.counters.navigationTicks, 1);
  assert.equal(states.hidden.counters.reconcileRequests, 1);
  assert.equal(states.hidden.work.reconcile.count, 1);
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

test("slow updates capture navigation at entry, merged causes, and separate readiness updates", (t) => {
  const { controller } = activityFixture(t);
  const { ReconcileCause, DiscoveryStep } = global.__bibililiPerformance;
  let now = 0;
  controller.performance.now = () => now;
  controller.performance.setEnabled(true);
  controller.performanceMonitor.setEnabled(true);
  t.mock.method(controller, "reconcilePage", (profile) => {
    profile.measure(DiscoveryStep.METADATA, () => { now += 5; });
    profile.measure(DiscoveryStep.SOURCE_ITEMS, () => { now += 130; });
    controller.navigation.pending = null;
    controller.videoLoading.active = false;
  });
  controller.navigation.pending = {};
  controller.videoLoading.active = true;
  controller.scheduleReconcile(false, undefined, ReconcileCause.MUTATION);
  controller.scheduleReconcile(false, undefined, ReconcileCause.MUTATION);
  controller.scheduleReconcile(false, undefined, ReconcileCause.ACCOUNT);
  controller.reconcileScheduler.run();
  const first = controller.performanceMonitor.alert.details;
  assert.equal(first.navigationPending, true, "capture the state before the pass runs");
  assert.equal(first.videoLoading, true);
  assert.deepEqual(first.causes, [ReconcileCause.MUTATION, ReconcileCause.ACCOUNT]);
  assert.equal(first.discoveryMs.metadata, 5);
  assert.equal(first.discoveryMs.sourceItems, 130);

  controller.scheduleReconcile(false, undefined, ReconcileCause.SETTLING);
  controller.videoLoading.active = true;
  controller.videoLoading.onReady();
  const ready = controller.performanceMonitor.alert.details;
  assert.equal(ready.navigationPending, false);
  assert.equal(ready.videoLoading, true, "readiness can continue after the native handoff ends");
  assert.deepEqual(ready.causes, [ReconcileCause.MEDIA]);
  controller.reconcileScheduler.run();
  const settled = controller.performanceMonitor.alert.details;
  assert.equal(settled.navigationPending, false);
  assert.equal(settled.videoLoading, false);
  assert.deepEqual(settled.causes, [ReconcileCause.SETTLING]);
  assert.equal(controller.performance.snapshot().states.visible.causes.media, 1);
});

test("recording-off reconciliation does not allocate a discovery profile or read its clock", (t) => {
  const { controller } = activityFixture(t);
  controller.performance.now = () => { throw new Error("unexpected recording clock"); };
  const run = t.mock.method(controller, "reconcilePage", (profile) => assert.equal(profile, null));
  controller.scheduleReconcile(false);
  controller.reconcileScheduler.run();
  controller.videoLoading.onReady();
  assert.equal(run.mock.callCount(), 2);
  assert.equal(controller.reconcileScheduler.pendingCauses.size, 0);
});

test("opening extension popups is excluded from page mutation work while native additions remain observable", (t) => {
  const { controller } = activityFixture(t);
  controller.start();
  controller.performance.setEnabled(true);
  const owned = { matches: () => true };
  const native = { matches: () => false };
  const mutation = { target: {}, type: "childList", addedNodes: [owned], removedNodes: [] };
  controller.observer.callback([mutation]);
  assert.equal(controller.performance.snapshot().states.visible.counters.mutationBatches, 0);
  t.mock.method(controller.discovery, "findPlayerRegion", () => null);
  controller.observer.callback([{ ...mutation, addedNodes: [owned, native] }]);
  assert.equal(controller.performance.snapshot().states.visible.counters.mutationBatches, 1);
  assert.equal(controller.performance.snapshot().states.visible.causes.mutation, 1);
});
