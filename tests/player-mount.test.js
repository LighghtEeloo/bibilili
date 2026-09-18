const assert = require("node:assert/strict");
const test = require("node:test");

const { FakeStorage, loadContentRuntime, TEST_WATCH_HREF } = require("./helpers/content-runtime.js");
const { RailElement } = require("./helpers/rail-dom.js");
const { BibililiController, LayoutRoot } = loadContentRuntime();
const { ReconcilePriority } = global.__bibililiScheduler;
const { LanguageResolver, UiStrings } = global.__bibililiI18n;
const { DomProbe } = global.__bibililiDom;
const { CardNavigationOriginStore } = global.__bibililiStorageState;

/** Adds owned-root matching to the existing minimal DOM fixture. */
class CoverElement extends RailElement {
  get parentNode() { return this.parentElement; }

  get classList() {
    const tokens = new Set(this.className.split(" ").filter(Boolean));
    return {
      contains: (name) => tokens.has(name),
      add: (name) => { tokens.add(name); this.className = [...tokens].join(" "); },
      remove: (name) => { tokens.delete(name); this.className = [...tokens].join(" "); },
      toggle: (name, force) => {
        const enabled = force ?? !tokens.has(name);
        if (enabled) tokens.add(name); else tokens.delete(name);
        this.className = [...tokens].join(" ");
        return enabled;
      }
    };
  }

  insertBefore(node, reference) {
    super.insertBefore(node, reference);
    if (node.isConnected) node.connectedCallback?.();
  }

  matches(selector) {
    return selector.split(",").some((part) => part.trim().startsWith("#")
      ? this.id === part.trim().slice(1) : super.matches(part));
  }
}

/** Models Bilibili reconnecting comments from an unchanged initial attribute. */
class NativeComments extends CoverElement {
  constructor(document, archiveId) {
    super(document, "div");
    this.setAttribute("data-params", `1,${archiveId}`);
    this.connections = 0;
  }

  connectedCallback() {
    this.archiveId = this.getAttribute("data-params").split(",")[1];
    this.connections += 1;
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
    controller.layout.root ??= document.createElement("section");
    document.body.append(controller.layout.root);
    controller.layout.playerNode = regions.player;
  });
  const paintFrame = () => {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((callback) => callback());
  };
  return { controller, cover, document, regions, timers, frames, paintFrame };
}

/** Exercises real layout moves while stubbing unrelated metadata and dock UI. */
function commentNavigationFixture(t) {
  const fixture = mountFixture(t);
  const { controller, document, regions } = fixture;
  document.removeEventListener = () => {};
  document.createComment = () => document.createElement("#comment");
  const nativeRoot = document.createElement("div");
  const player = document.createElement("div");
  const comments = new NativeComments(document, "111");
  document.body.append(nativeRoot);
  nativeRoot.append(player, comments);

  const layout = controller.layout;
  const root = document.createElement("section");
  root.id = "bibilili-layout-root";
  layout.root = root;
  layout.playerPane = document.createElement("section");
  layout.commentPane = document.createElement("aside");
  root.append(layout.playerPane, layout.commentPane);
  document.body.append(root);
  Object.assign(regions, { player, comments, commentState: "loaded", tags: [] });
  layout.destroy = LayoutRoot.prototype.destroy;
  layout.render = LayoutRoot.prototype.render;
  t.mock.method(layout, "ensure", () => {});
  t.mock.method(layout, "setLanguage", () => {});
  t.mock.method(layout, "renderVideoHeader", () => {});
  t.mock.method(layout, "renderVideoDescription", () => {});
  t.mock.method(layout, "setSources", () => {});
  t.mock.method(controller, "startPageReconciliation", () => {});
  controller.pageKey = controller.currentPageKey();
  controller.prepareMount();
  controller.reconcile(false);
  return { ...fixture, layout, root, nativeRoot, player, comments };
}

test("same-document navigation preserves the comment reload and native restore points", (t) => {
  const { controller, layout, root, comments, player } = commentNavigationFixture(t);
  const connections = comments.connections;
  const restorePoints = [...layout.movedPageNodes.placeholders];
  layout.commentPane.scrollTop = 500;
  layout.renderedSourceKind = "recommendations";
  layout.locatedCurrentRouteKeys.set("recommendations", controller.pageKey);
  // Bilibili reloads the live component without changing its initial attribute.
  comments.archiveId = "222";
  global.location = new URL("https://www.bilibili.com/video/av222");
  t.mock.method(controller.lazyPrimer, "prime", () => true);

  controller.handlePotentialNavigation();
  controller.reconcile(true);

  assert.equal(controller.loadingCover.root, null);
  assert.equal(layout.root, root);
  assert.equal(player.parentElement, layout.playerPane);
  assert.equal(comments.parentElement, layout.commentPane);
  assert.equal(comments.archiveId, "222");
  assert.equal(comments.connections, connections);
  assert.deepEqual([...layout.movedPageNodes.placeholders], restorePoints);
  assert.equal(controller.lazyPrimer.prime.mock.callCount(), 0);
  assert.equal(layout.commentPane.scrollTop, 0);
  assert.equal(layout.renderedSourceKind, null);
  assert.equal(layout.locatedCurrentRouteKeys.size, 0);
  assert.equal(layout.setSources.mock.calls.at(-1).arguments[1], true);
  controller.stop();
});

test("temporarily empty attached comments survive hydration and settling passes", (t) => {
  const { controller, layout, regions, comments } = commentNavigationFixture(t);
  const connections = comments.connections;
  comments.archiveId = "222";
  regions.comments = null;
  regions.commentState = "retry";
  controller.reconcile(false);
  assert.equal(layout.commentNode, comments);
  assert.equal(comments.parentElement, layout.commentPane);
  assert.equal(comments.archiveId, "222");
  assert.equal(comments.connections, connections);
  assert.ok(!layout.root.classList.contains("bibilili-has-comment-retry"));

  regions.comments = comments;
  regions.commentState = "loaded";
  controller.reconcile(false);
  assert.equal(comments.connections, connections);
  controller.stop();
});

test("a replacement comment region is adopted after the previous tree is removed", (t) => {
  const { controller, layout, document, nativeRoot, regions, comments } = commentNavigationFixture(t);
  comments.remove();
  const replacement = new NativeComments(document, "222");
  nativeRoot.append(replacement);
  regions.comments = replacement;
  controller.reconcile(false);
  assert.equal(layout.commentNode, replacement);
  assert.equal(replacement.parentElement, layout.commentPane);
  assert.equal(replacement.archiveId, "222");
  controller.stop();
});

test("leaving the watch page releases the preserved native regions", (t) => {
  const { controller, root, nativeRoot, comments, player } = commentNavigationFixture(t);
  global.location = new URL("https://www.bilibili.com/");
  controller.handlePotentialNavigation();
  assert.ok(!root.isConnected);
  assert.equal(comments.parentElement, nativeRoot);
  assert.equal(player.parentElement, nativeRoot);
  controller.stop();
});

test("initial comments stay native until the active primer finishes", (t) => {
  const { controller, regions } = mountFixture(t);
  controller.prepareMount();
  const comments = { isConnected: true };
  regions.player = { isConnected: true };
  controller.lazyPrimer.timer = 123;
  for (let pass = 0; pass < 2; pass += 1) {
    Object.assign(regions, { comments, commentState: "loaded" });
    controller.reconcile(false);
    assert.equal(regions.comments, null);
    assert.equal(regions.commentState, "retry");
  }
  controller.lazyPrimer.timer = null;
  Object.assign(regions, { comments, commentState: "loaded" });
  controller.reconcile(false);
  assert.equal(regions.comments, comments);
  controller.stop();
});

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

test("navigation removes an unfinished startup cover and leaves the mounted layout visible", (t) => {
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
  assert.equal(cover.root, null);
  assert.equal(timers.size, 0);
});

test("temporary player loss preserves the mounted panes until its replacement arrives", (t) => {
  const { controller, layout, root, regions, document, player, timers } = commentNavigationFixture(t);
  player.remove();
  regions.player = null;
  controller.reconcile(true);
  const deadline = controller.playerRecoveryTimer;
  assert.equal(timers.get(deadline).delay, 5000);
  controller.reconcile(false);
  assert.equal(controller.playerRecoveryTimer, deadline);
  assert.equal(layout.root, root);
  assert.ok(root.isConnected);
  regions.player = document.createElement("div");
  document.body.append(regions.player);
  controller.reconcile(false);
  assert.equal(layout.root, root);
  assert.equal(regions.player.parentElement, layout.playerPane);
  assert.equal(controller.playerRecoveryTimer, null);
  assert.ok(!timers.has(deadline));
  assert.equal(layout.setSources.mock.calls.at(-1).arguments[1], true,
    "the destination route reset survives the missing-player pass");
  controller.reconcile(false);
  assert.equal(layout.setSources.mock.calls.at(-1).arguments[1], false);
  controller.stop();
});

test("permanent player loss releases the native page at the recovery deadline", (t) => {
  const { controller, root, regions, player, timers } = commentNavigationFixture(t);
  t.mock.method(controller, "scheduleReconcile", () => {});
  player.remove();
  regions.player = null;
  controller.reconcile(false);
  timers.get(controller.playerRecoveryTimer).callback();
  assert.ok(!root.isConnected);
  assert.equal(controller.playerRecoveryTimer, null);
  controller.stop();
});

test("a document navigation reserves recorded pane geometry without consuming the source hint", (t) => {
  const { controller, cover } = mountFixture(t);
  const previousStorage = global.sessionStorage;
  global.sessionStorage = new FakeStorage();
  t.after(() => { global.sessionStorage = previousStorage; });
  CardNavigationOriginStore.write("history", controller.currentPageKey(), {
    commentWidth: 399, dockHeight: 242
  });
  controller.prepareMount();
  assert.ok(cover.root.classList.contains("bibilili-loading-shell"));
  assert.equal(cover.root.style["--bibilili-loading-comment-width"], "399px");
  assert.equal(cover.root.style["--bibilili-loading-dock-height"], "242px");
  assert.equal(cover.root.querySelector(".bibilili-loading-comments").contains(cover.title), true);
  assert.equal(controller.initialSourceRouteState().sourceKind, "history");
  cover.stop();
  controller.prepareMount();
  assert.ok(!cover.root.classList.contains("bibilili-loading-shell"), "an unrelated startup has no stale shell");
  controller.stop();
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
