const assert = require("node:assert/strict");
const test = require("node:test");

const { loadContentRuntime, TEST_WATCH_HREF } = require("./helpers/content-runtime.js");
const { BibililiController, LayoutRoot } = loadContentRuntime();
const { ReconcilePriority } = global.__bibililiScheduler;

/** Models the controller handoff without native layout or network requests. */
function mountFixture(t) {
  const classes = new Set();
  const document = {
    documentElement: {
      classList: {
        add: (name) => classes.add(name),
        remove: (name) => classes.delete(name),
        contains: (name) => classes.has(name)
      }
    }
  };
  const timers = new Map();
  let nextTimer = 1;
  t.mock.method(global, "setTimeout", (callback, delay) => {
    const id = nextTimer++;
    timers.set(id, { callback, delay });
    return id;
  });
  t.mock.method(global, "clearTimeout", (id) => timers.delete(id));

  const previousLocation = global.location;
  const previousObserver = global.MutationObserver;
  global.location = new URL(TEST_WATCH_HREF);
  global.MutationObserver = class {
    constructor(callback) { this.callback = callback; }
    observe() {}
    disconnect() { this.disconnected = true; }
  };
  t.after(() => {
    global.location = previousLocation;
    global.MutationObserver = previousObserver;
  });
  t.mock.method(global.__bibililiTheme.BilibiliThemeSync, "sync", () => {});

  const controller = new BibililiController(document);
  const regions = { player: null, sources: [] };
  t.mock.method(controller, "resolveUiLanguage", () => "en");
  t.mock.method(controller, "renderFloatingActivation", () => {});
  t.mock.method(controller.discovery, "discover", () => regions);
  t.mock.method(controller.discovery, "findPlayerRegion", () => regions.player);
  t.mock.method(controller.lazyPrimer, "prime", () => false);
  t.mock.method(controller.layout, "destroy", () => {});
  t.mock.method(controller.layout, "render", () => {
    assert.ok(classes.has("bibilili-player-pending"), "player stays hidden during render");
    controller.layout.playerNode = regions.player;
  });
  return { classes, controller, document, regions, timers };
}

test("player handoff lasts through a missing player and ends after rendering", (t) => {
  const { classes, controller, regions, timers } = mountFixture(t);
  controller.prepareMount();
  assert.ok(classes.has("bibilili-player-pending"));

  controller.reconcile(false);
  assert.ok(classes.has("bibilili-player-pending"));

  regions.player = { isConnected: true };
  controller.reconcile(false);
  assert.ok(!classes.has("bibilili-player-pending"));
  assert.equal(timers.size, 0);
});

test("failed mounting restores the native player within a fixed deadline", (t) => {
  const { classes, controller, timers } = mountFixture(t);
  controller.prepareMount();
  const deadline = [...timers.values()][0];
  assert.equal(deadline.delay, 5000);

  controller.prepareMount();
  controller.reconcile(false);
  assert.equal(timers.size, 1, "retry does not extend the deadline");
  deadline.callback();
  assert.ok(!classes.has("bibilili-player-pending"));
  assert.equal(timers.size, 0);
});

test("document-start handoff waits for the root and releases its observer", (t) => {
  const { classes, controller, document } = mountFixture(t);
  const root = document.documentElement;
  document.documentElement = null;
  controller.prepareMount();
  const observer = controller.playerMountGuard.rootObserver;
  assert.ok(observer);

  document.documentElement = root;
  observer.callback();
  assert.ok(classes.has("bibilili-player-pending"));
  assert.ok(observer.disconnected);
  assert.equal(controller.playerMountGuard.rootObserver, null);
  controller.playerMountGuard.stop();
  assert.equal(classes.size, 0);
});

test("disabled and non-watch pages keep the native player visible", (t) => {
  const { classes, controller, timers } = mountFixture(t);
  controller.enabled = false;
  controller.prepareMount();
  assert.equal(classes.size, 0);
  assert.equal(timers.size, 0);

  controller.enabled = true;
  global.location = new URL("https://www.bilibili.com/");
  controller.prepareMount();
  assert.equal(classes.size, 0);
  assert.equal(timers.size, 0);
});

test("stopping before document creation cancels deferred startup and concealment", (t) => {
  const { classes, controller, document, timers } = mountFixture(t);
  document.documentElement = null;
  document.querySelectorAll = () => [];
  const readyHandler = () => {};
  const listeners = new Map([["DOMContentLoaded", readyHandler]]);
  document.removeEventListener = (name, handler) => {
    if (listeners.get(name) === handler) listeners.delete(name);
  };
  controller.readyHandler = readyHandler;
  controller.layout.destroy = LayoutRoot.prototype.destroy;
  controller.prepareMount();
  const observer = controller.playerMountGuard.rootObserver;

  controller.stop();
  assert.equal(listeners.size, 0);
  assert.ok(observer.disconnected);
  assert.equal(classes.size, 0);
  assert.equal(timers.size, 0);
});

test("disabling, stopping, and watch-page exit release a pending handoff", (t) => {
  const { classes, controller, timers } = mountFixture(t);
  controller.prepareMount();
  controller.setEnabled(false);
  assert.equal(classes.size, 0);
  assert.equal(timers.size, 0);

  controller.enabled = true;
  controller.prepareMount();
  controller.stop();
  assert.equal(classes.size, 0);
  assert.equal(timers.size, 0);

  controller.prepareMount();
  global.location = new URL("https://www.bilibili.com/");
  controller.reconcile(false);
  assert.equal(classes.size, 0);
  assert.equal(timers.size, 0);
});

test("same-document video navigation covers the next layout handoff", (t) => {
  const { classes, controller } = mountFixture(t);
  t.mock.method(controller, "startPageReconciliation", () => {});
  controller.pageKey = "previous-video";
  controller.handlePotentialNavigation();
  assert.ok(classes.has("bibilili-player-pending"));
  controller.playerMountGuard.stop();
});

test("late player arrival bypasses lazy scheduling without making other mutations urgent", (t) => {
  const { controller, regions } = mountFixture(t);
  const requests = [];
  t.mock.method(controller, "scheduleReconcile", (_reset, priority) => requests.push(priority));
  controller.observeMutations();
  const mutate = () => controller.observer.callback([{ target: {} }]);
  mutate();
  assert.equal(requests.pop(), ReconcilePriority.LAZY);

  regions.player = { isConnected: true };
  mutate();
  assert.equal(requests.pop(), ReconcilePriority.URGENT);

  controller.layout.playerNode = regions.player;
  mutate();
  assert.equal(requests.pop(), ReconcilePriority.LAZY);

  controller.layout.playerNode = null;
  controller.enabled = false;
  mutate();
  assert.equal(requests.pop(), ReconcilePriority.LAZY);

  controller.observer.callback([{ target: { closest: () => ({}) } }]);
  assert.equal(requests.length, 0, "extension-owned changes stay ignored");
});
