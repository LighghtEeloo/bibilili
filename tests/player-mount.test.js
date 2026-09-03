const assert = require("node:assert/strict");
const test = require("node:test");

const { loadContentRuntime, TEST_WATCH_HREF } = require("./helpers/content-runtime.js");
const { RailElement } = require("./helpers/rail-dom.js");
const { BibililiController, LayoutRoot } = loadContentRuntime();
const { ReconcilePriority } = global.__bibililiScheduler;
const { LanguageResolver, UiStrings } = global.__bibililiI18n;
const { DomProbe } = global.__bibililiDom;

/** Adds owned-root matching to the existing minimal DOM fixture. */
class CoverElement extends RailElement {
  matches(selector) {
    return selector.split(",").some((part) => part.trim().startsWith("#")
      ? this.id === part.trim().slice(1) : super.matches(part));
  }
}

/** Models loading, browser frames, and native priming without network requests. */
function mountFixture(t) {
  const document = {
    createElement(tagName) {
      const element = new CoverElement(document, tagName);
      element.style.setProperty = (name, value) => { element.style[name] = value; };
      return element;
    },
    querySelectorAll: () => []
  };
  document.documentElement = document.createElement("html");
  Object.defineProperty(document.documentElement, "isConnected", { value: true });
  document.body = document.createElement("body");
  document.documentElement.append(document.body);
  const timers = new Map();
  const frames = new Map();
  let nextId = 1;
  t.mock.method(global, "setTimeout", (callback, delay) => {
    const id = nextId++;
    timers.set(id, { callback, delay });
    return id;
  });
  t.mock.method(global, "clearTimeout", (id) => timers.delete(id));

  const previousGlobals = {
    location: global.location,
    MutationObserver: global.MutationObserver,
    requestAnimationFrame: global.requestAnimationFrame,
    cancelAnimationFrame: global.cancelAnimationFrame
  };
  global.location = new URL(TEST_WATCH_HREF);
  global.MutationObserver = class {
    constructor(callback) { this.callback = callback; }
    observe() {}
    disconnect() { this.disconnected = true; }
  };
  global.requestAnimationFrame = (callback) => {
    const id = nextId++;
    frames.set(id, callback);
    return id;
  };
  global.cancelAnimationFrame = (id) => frames.delete(id);
  t.after(() => Object.assign(global, previousGlobals));
  t.mock.method(global.__bibililiTheme.BilibiliThemeSync, "sync", () => {});
  t.mock.method(LanguageResolver, "resolve", () => "en");
  t.mock.method(UiStrings, "extensionMessage", (name) =>
    name === "layoutLoadingLabel" ? "Loading video" : name);

  const controller = new BibililiController(document);
  const cover = controller.loadingCover;
  const regions = { player: null, sources: [], title: null, uploader: null };
  t.mock.method(controller, "resolveUiLanguage", () => "en");
  t.mock.method(controller, "renderFloatingActivation", () => {});
  t.mock.method(controller.discovery, "discover", () => regions);
  t.mock.method(controller.discovery, "findPlayerRegion", () => regions.player);
  t.mock.method(controller.discovery, "findWatchTitle", () => regions.title);
  t.mock.method(controller.discovery, "findUploaderInfo", () => regions.uploader);
  t.mock.method(controller.lazyPrimer, "prime", () => false);
  t.mock.method(controller.layout, "destroy", () => {});
  t.mock.method(controller.layout, "render", () => {
    assert.ok(cover.root.isConnected, "the cover stays above the page during render");
    controller.layout.root = { isConnected: true };
    controller.layout.playerNode = regions.player;
  });
  const paintFrame = () => {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((callback) => callback());
  };
  return { controller, cover, document, regions, timers, frames, paintFrame };
}

test("loading covers a missing player and fades after the mounted layout can paint", (t) => {
  const { controller, cover, regions, timers, paintFrame } = mountFixture(t);
  controller.prepareMount();
  const root = cover.root;
  controller.reconcile(false);
  assert.ok(root.isConnected);
  assert.equal(cover.revealFrame, null);

  regions.player = { isConnected: true };
  controller.reconcile(false);
  paintFrame();
  assert.equal(root.dataset.bibililiLoadingState, undefined, "one frame still covers layout");
  paintFrame();
  assert.equal(root.dataset.bibililiLoadingState, "leaving");
  assert.equal(root.getAttribute("aria-hidden"), "true");
  assert.equal(cover.observer, null);
  const fade = timers.get(cover.fadeTimer);
  assert.equal(fade.delay, 240);
  fade.callback();
  assert.ok(!root.isConnected);
  assert.equal(cover.root, null);
  assert.equal(timers.size, 0);
});

test("native priming finishes before the cover starts leaving", (t) => {
  const { controller, cover, regions, paintFrame } = mountFixture(t);
  controller.prepareMount();
  regions.player = { isConnected: true };
  controller.lazyPrimer.timer = 123;
  controller.reconcile(false);
  paintFrame();
  assert.equal(cover.revealFrame, null);
  assert.equal(cover.fadeTimer, null);

  controller.lazyPrimer.timer = null;
  controller.reconcile(false);
  paintFrame();
  paintFrame();
  assert.equal(cover.root.dataset.bibililiLoadingState, "leaving");
  cover.stop();
});

test("a player detached before paint keeps the cover until a replacement mounts", (t) => {
  const { controller, cover, regions, paintFrame } = mountFixture(t);
  controller.prepareMount();
  regions.player = { isConnected: true };
  controller.reconcile(false);
  regions.player.isConnected = false;
  paintFrame();
  paintFrame();
  assert.equal(cover.fadeTimer, null);

  regions.player = { isConnected: true };
  controller.reconcile(false);
  paintFrame();
  paintFrame();
  assert.equal(cover.root.dataset.bibililiLoadingState, "leaving");
  cover.stop();
});

test("metadata arrives without replacing the cover and its own changes stay ignored", (t) => {
  const { controller, cover, regions, frames, paintFrame } = mountFixture(t);
  controller.prepareMount();
  const root = cover.root;
  assert.equal(cover.title.textContent, "Loading video");
  assert.equal(cover.uploader.textContent, "");

  regions.title = "A video <with literal markup>";
  regions.uploader = { name: "Example creator" };
  cover.observer.callback([{ target: {} }]);
  cover.observer.callback([{ target: {} }]);
  assert.equal(frames.size, 1, "native updates share one frame");
  paintFrame();
  assert.equal(cover.root, root);
  assert.equal(cover.title.textContent, regions.title);
  assert.equal(cover.uploader.textContent, "Example creator");
  assert.ok(DomProbe.isOwned(cover.title));
  cover.observer.callback([{ target: cover.title }]);
  assert.equal(frames.size, 0);
  cover.stop();
});

test("failed mounting removes the whole cover within a fixed deadline", (t) => {
  const { controller, cover, timers, frames } = mountFixture(t);
  controller.prepareMount();
  const root = cover.root;
  const observer = cover.observer;
  const deadline = timers.get(cover.timer);
  assert.equal(deadline.delay, 5000);

  controller.prepareMount();
  controller.reconcile(false);
  assert.equal(timers.size, 1, "retry does not extend the deadline");
  cover.observer.callback([{ target: {} }]);
  deadline.callback();
  assert.ok(!root.isConnected);
  assert.ok(observer.disconnected);
  assert.equal(timers.size, 0);
  assert.equal(frames.size, 0);
});

test("document-start loading mounts when the root arrives and observes early metadata", (t) => {
  const { controller, cover, document, regions, paintFrame } = mountFixture(t);
  const root = document.documentElement;
  document.documentElement = null;
  controller.prepareMount();
  assert.equal(cover.root, null);
  const observer = cover.observer;

  document.documentElement = root;
  regions.title = "Title from early page metadata";
  observer.callback([{ target: document }]);
  paintFrame();
  assert.equal(cover.root.parentElement, root);
  assert.equal(cover.title.textContent, regions.title);
  cover.stop();
  assert.ok(observer.disconnected);
  assert.equal(cover.root, null);
});

test("disabled and non-watch pages keep the native page uncovered", (t) => {
  const { controller, cover, timers } = mountFixture(t);
  controller.enabled = false;
  controller.prepareMount();
  assert.equal(cover.root, null);
  assert.equal(timers.size, 0);

  controller.enabled = true;
  global.location = new URL("https://www.bilibili.com/");
  controller.prepareMount();
  assert.equal(cover.root, null);
  assert.equal(timers.size, 0);
});

test("stopping before document creation cancels deferred startup and loading", (t) => {
  const { controller, cover, document, timers } = mountFixture(t);
  document.documentElement = null;
  const readyHandler = () => {};
  const listeners = new Map([["DOMContentLoaded", readyHandler]]);
  document.removeEventListener = (name, handler) => {
    if (listeners.get(name) === handler) listeners.delete(name);
  };
  controller.readyHandler = readyHandler;
  controller.layout.destroy = LayoutRoot.prototype.destroy;
  controller.prepareMount();
  const observer = cover.observer;

  controller.stop();
  assert.equal(listeners.size, 0);
  assert.ok(observer.disconnected);
  assert.equal(cover.root, null);
  assert.equal(timers.size, 0);
});

test("disabling, stopping, and watch-page exit remove a pending cover", (t) => {
  const { controller, cover, timers } = mountFixture(t);
  controller.prepareMount();
  controller.setEnabled(false);
  assert.equal(cover.root, null);
  assert.equal(timers.size, 0);

  controller.enabled = true;
  controller.prepareMount();
  controller.stop();
  assert.equal(cover.root, null);
  assert.equal(timers.size, 0);

  controller.prepareMount();
  global.location = new URL("https://www.bilibili.com/");
  controller.reconcile(false);
  assert.equal(cover.root, null);
  assert.equal(timers.size, 0);
});

test("navigation cancels the previous fade and waits for the next video's title", (t) => {
  const { controller, cover, regions, timers, paintFrame } = mountFixture(t);
  t.mock.method(controller, "startPageReconciliation", () => {});
  controller.pageKey = controller.currentPageKey();
  regions.title = "Previous video";
  regions.player = { isConnected: true };
  controller.prepareMount();
  controller.reconcile(false);
  paintFrame();
  paintFrame();
  const oldRoot = cover.root;
  const oldFade = cover.fadeTimer;

  global.location = new URL("https://www.bilibili.com/video/av123");
  controller.handlePotentialNavigation();
  assert.ok(!oldRoot.isConnected);
  assert.ok(!timers.has(oldFade));
  assert.equal(cover.root.dataset.bibililiLoadingState, undefined);
  assert.equal(cover.title.textContent, "Loading video");
  regions.title = "Next video";
  regions.uploader = { name: "Next creator" };
  cover.update();
  assert.equal(cover.title.textContent, "Next video");
  assert.equal(cover.uploader.textContent, "Next creator");
  cover.stop();
});

test("stopping while reveal frames are queued prevents a delayed fade", (t) => {
  const { controller, cover, regions, timers, frames, paintFrame } = mountFixture(t);
  controller.prepareMount();
  regions.player = { isConnected: true };
  controller.reconcile(false);
  paintFrame();
  assert.equal(frames.size, 1);
  controller.stop();
  paintFrame();
  assert.equal(cover.root, null);
  assert.equal(timers.size, 0);
  assert.equal(frames.size, 0);
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
