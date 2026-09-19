const assert = require("node:assert/strict");
const test = require("node:test");

const { FakeStorage, loadContentRuntime, TEST_WATCH_HREF } = require("./helpers/content-runtime.js");
const { RailElement } = require("./helpers/rail-dom.js");
const { BibililiController, LayoutRoot, WatchActionKind } = loadContentRuntime();
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
      ? this.id === part.trim().slice(1)
      : this.tagName === part.trim() || super.matches(part));
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
  const runTimers = (delay) => {
    for (const [id, timer] of [...timers]) {
      if (timer.delay !== delay) continue;
      timers.delete(id);
      timer.callback();
    }
  };
  return { controller, cover, document, regions, timers, frames, paintFrame, runTimers };
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
  layout.stage = document.createElement("main");
  layout.stage.append(layout.playerPane, layout.commentPane);
  root.append(layout.stage);
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
  t.mock.method(controller.navigation, "commentsReady", (node) =>
    node.readyRouteKey === controller.currentPageKey());
  controller.pageKey = controller.currentPageKey();
  controller.prepareMount();
  controller.reconcile(false);
  return { ...fixture, layout, root, nativeRoot, player, comments };
}

/** Adds real counted controls while stubbing only native icon cloning. */
function watchActionLoadingFixture(t) {
  const fixture = commentNavigationFixture(t);
  const { controller, layout, document, root, nativeRoot, regions } = fixture;
  layout.sourceBar = document.createElement("div");
  layout.actionGroup = document.createElement("div");
  layout.moreWatchGroup = document.createElement("div");
  root.append(layout.moreWatchGroup);
  const sourceButton = document.createElement("button");
  sourceButton.disabled = false;
  layout.sourceBar.append(sourceButton);
  root.append(layout.sourceBar);
  regions.actions = Object.values(WatchActionKind).map((kind) => {
    const trigger = document.createElement("button");
    nativeRoot.append(trigger);
    return { kind, trigger, countText: "123", isActive: false };
  });
  t.mock.method(layout, "updateActionVisual", () => true);
  t.mock.method(layout.commentPane, "getBoundingClientRect", () => ({ width: 399 }));
  t.mock.method(controller.accountSources, "currentWatchLaterCount", () => 77);
  t.mock.method(UiStrings, "watchActionButtonLabel", (kind, count) => count ? `${kind}: ${count}` : kind);
  t.mock.method(layout, "setSources", () =>
    layout.renderWatchActionGroup(layout.currentActions, sourceButton));
  controller.reconcile(false);
  return { ...fixture, sourceButton };
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

test("card navigation dims comments before the native request and preserves their DOM", (t) => {
  const { controller, layout, root, comments, player, document } = commentNavigationFixture(t);
  t.mock.method(layout.commentPane, "getBoundingClientRect", () => ({ width: 399 }));
  const connections = comments.connections;
  const video = document.createElement("video");
  video.readyState = 4;
  player.append(video);
  t.mock.method(controller.navigation, "navigate", () => {
    assert.equal(layout.commentPane.inert, true);
    assert.equal(layout.commentPane.getAttribute("aria-busy"), "true");
    assert.equal(root.classList.contains("bibilili-video-loading"), true);
    assert.equal(comments.connections, connections);
    assert.equal(comments.parentElement, layout.commentPane);
    return true;
  });
  controller.navigateVideoCard("watch_later", "/video/BVnext", { preventDefault() {} });
  assert.equal(layout.commentLoadingView.parentElement, layout.stage);
  assert.equal(layout.commentLoadingView.getAttribute("role"), "status");
  assert.equal(layout.commentLoadingView.getAttribute("aria-hidden"), "false");
  controller.stop();
  assert.equal(controller.videoLoading.active, false);
});

test("counted buttons stay covered until refreshed data and comments can paint together", (t) => {
  const f = watchActionLoadingFixture(t);
  const { controller, layout, document, player, comments, regions, sourceButton, paintFrame, runTimers } = f;
  const buttons = [...layout.actionButtons.values()];
  assert.equal(buttons.length, 5);
  const video = document.createElement("video");
  video.readyState = 2;
  player.append(video);
  t.mock.method(controller.navigation, "navigate", () => {
    for (const button of buttons) {
      assert.equal(button.disabled, true, "controls are blocked before the native request");
      assert.equal(button.getAttribute("aria-busy"), "true");
      assert.equal(button.getAttribute("aria-label"), button.dataset.watchActionKind);
      assert.equal(button.getAttribute("aria-pressed"), null);
      assert.equal(button.querySelectorAll(".bibilili-loading-view").length, 1);
    }
    assert.equal(sourceButton.disabled, false, "source controls remain available");
    return true;
  });
  controller.navigateVideoCard("watch_later", "/video/BVnext", { preventDefault() {} });
  global.location = new URL("https://www.bilibili.com/video/BVnext");
  controller.videoLoading.handleMediaEvent({ type: "loadeddata", target: video });
  paintFrame();
  paintFrame();
  assert.ok(buttons.every((button) => button.disabled));
  for (const action of regions.actions) {
    action.countText = "987";
    action.isActive = true;
  }
  comments.readyRouteKey = controller.currentPageKey();
  runTimers(100);
  assert.equal(buttons[0].querySelector(".bibilili-action-count").textContent, "987",
    "the destination counts reconcile before reveal frames are queued");
  assert.ok(buttons.every((button) => button.disabled));
  paintFrame();
  paintFrame();
  assert.deepEqual([...layout.actionButtons.values()], buttons, "button identities stay stable");
  for (const button of buttons) {
    const kind = button.dataset.watchActionKind;
    assert.equal(button.disabled, false);
    assert.equal(button.getAttribute("aria-busy"), "false");
    assert.equal(button.getAttribute("aria-label"), `${kind}: ${kind === WatchActionKind.WATCH_LATER ? "77" : "987"}`);
    assert.equal(button.querySelectorAll(".bibilili-loading-view").length, 1);
  }
  assert.equal(buttons[0].getAttribute("aria-pressed"), "true");
  controller.stop();
});

test("covered action handlers cannot activate native controls or account mutations", (t) => {
  const { controller, layout } = watchActionLoadingFixture(t);
  t.mock.method(LayoutRoot, "clickNativeTrigger", () => {});
  t.mock.method(layout, "copyCurrentWatchUrl", () => {});
  layout.onWatchLaterAdd = t.mock.fn(() => Promise.resolve());
  controller.videoLoading.begin();
  for (const kind of Object.values(WatchActionKind)) layout.handleWatchActionButtonClick(kind);
  layout.handleCurrentWatchLaterAddClick();
  assert.equal(LayoutRoot.clickNativeTrigger.mock.callCount(), 0);
  assert.equal(layout.copyCurrentWatchUrl.mock.callCount(), 0);
  assert.equal(layout.onWatchLaterAdd.mock.callCount(), 0);
  controller.videoLoading.cancel();
  assert.ok([...layout.actionButtons.values()].every((button) => !button.disabled));
  controller.stop();
});

test("a watch-later request settling during navigation cannot uncover its button", async (t) => {
  const { controller, layout } = watchActionLoadingFixture(t);
  const button = layout.actionButtons.get(WatchActionKind.WATCH_LATER);
  let reject;
  layout.onWatchLaterAdd = () => new Promise((_resolve, fail) => { reject = fail; });
  layout.handleCurrentWatchLaterAddClick();
  controller.videoLoading.begin();
  reject(new Error("request failed"));
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(button.disabled, true);
  assert.equal(button.getAttribute("aria-busy"), "true");
  controller.videoLoading.cancel();
  assert.equal(button.disabled, false);

  const key = button.dataset.bibililiWatchLaterAddKey;
  layout.pendingWatchLaterAddKeys.add(key);
  controller.videoLoading.begin();
  controller.videoLoading.cancel();
  assert.equal(button.disabled, true, "an independent pending mutation remains disabled");
  assert.equal(button.getAttribute("aria-busy"), "false");
  controller.stop();
});

test("ready video frames keep old comments dim until the destination thread renders", (t) => {
  const { controller, layout, player, comments, document, paintFrame, runTimers } = commentNavigationFixture(t);
  const video = document.createElement("video");
  player.append(video);
  const loading = controller.videoLoading;
  loading.begin("video:BVnext:p1");
  video.readyState = 4;
  loading.handleMediaEvent({ type: "canplay", target: video });
  paintFrame();
  paintFrame();
  assert.equal(loading.active, true, "a late event from the previous route does not reveal comments");

  global.location = new URL("https://www.bilibili.com/video/BVnext");
  video.readyState = 1;
  loading.handleMediaEvent({ type: "loadstart", target: video });
  controller.handlePotentialNavigation();
  assert.equal(layout.isVideoLoading, true, "a URL change is not a ready video frame");
  video.readyState = 2;
  loading.handleMediaEvent({ type: "loadeddata", target: video });
  paintFrame();
  paintFrame();
  assert.equal(layout.isVideoLoading, true, "video readiness does not finish a comment load");
  for (let pass = 0; pass < 110; pass += 1) runTimers(100);
  assert.equal(layout.isVideoLoading, true, "elapsed time cannot reveal a stale thread");
  comments.readyRouteKey = controller.currentPageKey();
  runTimers(100);
  paintFrame();
  assert.equal(layout.isVideoLoading, true);
  paintFrame();
  assert.equal(layout.isVideoLoading, false);
  assert.equal(layout.commentPane.inert, false);
  assert.equal(layout.commentPane.getAttribute("aria-busy"), "false");
  assert.equal(layout.commentLoadingView.getAttribute("aria-hidden"), "true");
  controller.stop();
});

test("native player loads use the same comment state and a later URL poll does not restart it", (t) => {
  const { controller, layout, player, comments, document, paintFrame } = commentNavigationFixture(t);
  const video = document.createElement("video");
  player.append(video);
  const unrelated = document.createElement("video");
  document.body.append(unrelated);
  const handlers = new Map();
  document.addEventListener = (name, handler, capture) => {
    assert.equal(capture, true);
    handlers.set(name, handler);
  };
  document.removeEventListener = (name) => handlers.delete(name);
  const loading = controller.videoLoading;
  loading.start();
  assert.equal(handlers.has("waiting"), false, "buffering does not dim the pane");
  handlers.get("loadstart")({ type: "loadstart", target: unrelated });
  assert.equal(loading.active, false);
  handlers.get("loadstart")({ type: "loadstart", target: video });
  assert.equal(layout.isVideoLoading, true);
  global.location = new URL("https://www.bilibili.com/video/BVnext");
  comments.readyRouteKey = controller.currentPageKey();
  loading.revealWhenReady();
  paintFrame();
  paintFrame();
  assert.equal(layout.isVideoLoading, true, "comments alone cannot reveal before the video");
  video.readyState = 2;
  handlers.get("loadeddata")({ type: "loadeddata", target: video });
  paintFrame();
  paintFrame();
  controller.handlePotentialNavigation();
  assert.equal(layout.isVideoLoading, false);
  controller.stop();
  assert.equal(handlers.size, 0);
});

test("a second switch cancels the previous frame's queued comment reveal", (t) => {
  const { controller, layout, player, comments, document, paintFrame, runTimers } = commentNavigationFixture(t);
  const video = document.createElement("video");
  player.append(video);
  const loading = controller.videoLoading;
  loading.begin("video:BVnext:p1");
  global.location = new URL("https://www.bilibili.com/video/BVnext");
  comments.readyRouteKey = controller.currentPageKey();
  video.readyState = 2;
  loading.handleMediaEvent({ type: "loadeddata", target: video });
  paintFrame();
  loading.begin("video:BVthird:p1");
  paintFrame();
  assert.equal(layout.isVideoLoading, true);
  global.location = new URL("https://www.bilibili.com/video/BVthird");
  loading.handleMediaEvent({ type: "loadeddata", target: video });
  paintFrame();
  paintFrame();
  assert.equal(layout.isVideoLoading, true, "the earlier video's completion cannot reveal this one");
  comments.readyRouteKey = controller.currentPageKey();
  runTimers(100);
  paintFrame();
  paintFrame();
  assert.equal(layout.isVideoLoading, false);
  controller.stop();
});

test("confirmed AV redirects reveal ready media under its canonical route", (t) => {
  const { controller, layout, player, comments, document, paintFrame } = commentNavigationFixture(t);
  const video = document.createElement("video");
  video.readyState = 2;
  player.append(video);
  controller.videoLoading.begin("video:av222:p1");
  global.location = new URL("https://www.bilibili.com/video/BVnext");
  comments.readyRouteKey = controller.currentPageKey();
  controller.videoLoading.confirm(global.location.href);
  paintFrame();
  paintFrame();
  assert.equal(layout.isVideoLoading, false);
  controller.stop();
});

test("playback errors still wait for current comments; disabling cancels pending checks", (t) => {
  const { controller, layout, root, player, comments, document, timers, paintFrame, runTimers } = commentNavigationFixture(t);
  const pane = layout.commentPane;
  const video = document.createElement("video");
  player.append(video);
  const loading = controller.videoLoading;
  loading.begin();
  video.readyState = 0;
  video.error = { code: 2 };
  loading.handleMediaEvent({ type: "error", target: video });
  paintFrame();
  paintFrame();
  assert.equal(pane.inert, true);
  comments.readyRouteKey = controller.currentPageKey();
  runTimers(100);
  paintFrame();
  paintFrame();
  assert.equal(pane.inert, false);
  assert.equal(loading.active, false);
  loading.begin();
  const pendingCheck = loading.timer;
  controller.setEnabled(false);
  paintFrame();
  assert.equal(timers.has(pendingCheck), false);
  assert.equal(pane.inert, false);
  assert.equal(root.classList.contains("bibilili-video-loading"), false);
  assert.equal(loading.active, false);
  controller.stop();
});

test("a comment reload between paint frames defers the reveal again", (t) => {
  const { controller, layout, player, comments, document, paintFrame, runTimers } = commentNavigationFixture(t);
  const video = document.createElement("video");
  video.readyState = 2;
  player.append(video);
  controller.videoLoading.begin();
  comments.readyRouteKey = controller.currentPageKey();
  controller.videoLoading.handleMediaEvent({ type: "loadeddata", target: video });
  paintFrame();
  comments.readyRouteKey = null;
  paintFrame();
  assert.equal(layout.isVideoLoading, true);
  comments.readyRouteKey = controller.currentPageKey();
  runTimers(100);
  paintFrame();
  paintFrame();
  assert.equal(layout.isVideoLoading, false);
  controller.stop();
});

test("a native URL commit after the media event still waits for its destination thread", (t) => {
  const { controller, layout, player, comments, document, paintFrame, runTimers } = commentNavigationFixture(t);
  const video = document.createElement("video");
  video.readyState = 2;
  player.append(video);
  controller.videoLoading.handleMediaEvent({ type: "loadstart", target: video });
  controller.videoLoading.handleMediaEvent({ type: "loadeddata", target: video });
  global.location = new URL("https://www.bilibili.com/video/BVnext");
  controller.handlePotentialNavigation();
  paintFrame();
  paintFrame();
  assert.equal(layout.isVideoLoading, true);
  comments.readyRouteKey = controller.currentPageKey();
  runTimers(100);
  paintFrame();
  paintFrame();
  assert.equal(layout.isVideoLoading, false);
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
