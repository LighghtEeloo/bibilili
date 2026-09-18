const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const test = require("node:test");
const { loadContentRuntime, resetStorageState, TEST_WATCH_HREF } =
  require("./helpers/content-runtime.js");

const { BibililiController, SourceKind } = loadContentRuntime();
const { NativeVideoNavigation } = global.__bibililiNavigation;
const { UiStrings } = global.__bibililiI18n;
const pageScript = fs.readFileSync(require.resolve("../src/page-navigation.js"), "utf8");
const NEXT_HREF = "https://www.bilibili.com/video/BV1xx411c7mD";
const REQUEST_EVENT = "bibilili:video-navigation-request";
const RESULT_EVENT = "bibilili:video-navigation-result";

/** Connects separate page and content worlds through real DOM-style events. */
function navigationFixture(t) {
  resetStorageState();
  const originalLocation = global.location;
  global.location = new URL(TEST_WATCH_HREF);
  t.after(() => { global.location = originalLocation; });
  const document = new EventTarget();
  const scripts = [];
  document.documentElement = { append: (script) => scripts.push(script) };
  document.createElement = () => ({ remove() { scripts.splice(scripts.indexOf(this), 1); } });
  t.mock.method(UiStrings, "extensionRuntime", () => ({
    getURL: (path) => `chrome-extension://test/${path}`
  }));
  const timers = new Map();
  let timerId = 0;
  t.mock.method(global, "setTimeout", (callback, delay) => {
    timers.set(++timerId, { callback, delay });
    return timerId;
  });
  t.mock.method(global, "clearTimeout", (id) => timers.delete(id));
  const runTimers = (delay) => {
    for (const [id, timer] of [...timers]) {
      if (timer.delay === delay) {
        timers.delete(id);
        timer.callback();
      }
    }
  };
  const requests = [];
  let manifest = { bvid: "BV1aa411c7mD", aid: 1, p: 1 };
  const land = (target) => {
    manifest = { bvid: target.bvid ?? "BV1xx411c7mD", aid: target.aid ?? 2, p: target.p };
    global.location = new URL(`https://www.bilibili.com/video/${manifest.bvid}`);
    if (target.p > 1) global.location.searchParams.set("p", target.p);
  };
  const player = {
    reload(target) {
      requests.push(JSON.parse(JSON.stringify(target)));
      land(target);
      return Promise.resolve(true);
    },
    getManifest: () => manifest
  };
  const pageWindow = {
    get location() { return global.location; },
    setTimeout: (...args) => global.setTimeout(...args),
    player,
    nano: { EventType: { Player_LoadedMetadata: "loadedmetadata" } }
  };
  const pageContext = vm.createContext({ window: pageWindow, document, URL, CustomEvent });
  const installPage = () => vm.runInContext(pageScript, pageContext);
  installPage();
  const navigation = new NativeVideoNavigation(document);
  navigation.start();
  scripts[0].onload();
  t.after(() => navigation.stop());
  const settle = async () => {
    for (let pass = 0; pass < 6; pass += 1) {
      await Promise.resolve();
      runTimers(0);
    }
  };
  const controller = new BibililiController(document);
  controller.navigation = navigation;
  controller.enabled = true;
  controller.pageKey = controller.currentPageKey();
  const sources = [];
  t.mock.method(controller, "handlePotentialNavigation", () => {
    if (controller.currentPageKey() !== controller.pageKey) {
      sources.push(controller.initialSourceRouteState());
      controller.pageKey = controller.currentPageKey();
    }
  });
  t.mock.method(controller, "scheduleReconcile", () => {});
  const click = (kind, url) => {
    const event = new Event("click", { cancelable: true });
    controller.navigateVideoCard(kind, url, event);
    return event;
  };
  return {
    document, navigation, scripts, timers, runTimers, player, pageWindow,
    requests, land, settle, installPage, controller, sources, click
  };
}

test("watch-later A to B to A stays in-page with no native list roots", async (t) => {
  const f = navigationFixture(t);
  assert.deepEqual(f.controller.layout.currentSources, []);
  assert.equal(f.click(SourceKind.WATCH_LATER, NEXT_HREF).defaultPrevented, true);
  await f.settle();
  assert.equal(global.location.href, NEXT_HREF);
  assert.equal(f.click(SourceKind.WATCH_LATER, TEST_WATCH_HREF).defaultPrevented, true);
  await f.settle();
  assert.equal(global.location.href, TEST_WATCH_HREF);
  assert.deepEqual(f.requests.map((request) => request.bvid), ["BV1xx411c7mD", "BV1aa411c7mD"]);
  assert.deepEqual(f.sources, Array(2).fill({ sourceKind: SourceKind.WATCH_LATER, isRailOpen: true }));
  assert.equal(f.timers.size, 0);
});

test("every rail source uses the same native handoff and preserves its route", async (t) => {
  const f = navigationFixture(t);
  for (const [index, kind] of Object.values(SourceKind).entries()) {
    const target = `https://www.bilibili.com/video/BVtest${index}?p=2&t=43&from=rail`;
    assert.equal(f.click(kind, target).defaultPrevented, true);
    await f.settle();
    assert.deepEqual(f.requests.at(-1), { p: 2, bvid: `BVtest${index}`, t: 43 });
    assert.deepEqual(f.sources.at(-1), { sourceKind: kind, isRailOpen: true });
  }
});

test("current-card clicks preserve playback; part and timestamp links still switch", async (t) => {
  const f = navigationFixture(t);
  assert.equal(f.click(SourceKind.COLLECTION, TEST_WATCH_HREF).defaultPrevented, true);
  assert.equal(f.requests.length, 0);
  f.click(SourceKind.PARTS, `${TEST_WATCH_HREF}?p=2`);
  await f.settle();
  assert.equal(f.requests.at(-1).p, 2);
  f.click(SourceKind.HISTORY, `${TEST_WATCH_HREF}?p=2&t=12`);
  await f.settle();
  assert.equal(f.requests.at(-1).t, 12);
});

test("AV requests retain their source when Bilibili canonicalizes the URL to BV", async (t) => {
  const f = navigationFixture(t);
  f.click(SourceKind.HISTORY, "/video/av123?p=3");
  await f.settle();
  assert.deepEqual(f.requests, [{ aid: 123, p: 3 }]);
  assert.equal(global.location.href, `${NEXT_HREF}?p=3`);
  assert.deepEqual(f.sources, [{ sourceKind: SourceKind.HISTORY, isRailOpen: true }]);
});

test("only same-origin archive routes enter the bridge", (t) => {
  const f = navigationFixture(t);
  for (const target of [
    "https://other.test/video/BV1xx411c7mD", "http://www.bilibili.com/video/BV1xx411c7mD",
    "https://name:password@www.bilibili.com/video/BV1xx411c7mD",
    "/bangumi/play/ep123", "/list/watchlater", "/video/av0"
  ]) {
    assert.equal(f.click(SourceKind.HISTORY, target).defaultPrevented, false, target);
  }
  global.location = new URL("https://www.bilibili.com/list/watchlater");
  assert.equal(f.click(SourceKind.WATCH_LATER, NEXT_HREF).defaultPrevented, false);
  assert.equal(f.requests.length, 0);
});

test("unloaded bridge and unavailable native API leave the original link usable", (t) => {
  const f = navigationFixture(t);
  f.scripts[0].onerror();
  assert.equal(f.click(SourceKind.HISTORY, NEXT_HREF).defaultPrevented, false);
  f.scripts[0].onload();
  f.pageWindow.player = null;
  assert.equal(f.click(SourceKind.HISTORY, NEXT_HREF).defaultPrevented, false);
  f.pageWindow.player = f.player;
  f.pageWindow.nano = null;
  assert.equal(f.click(SourceKind.HISTORY, NEXT_HREF).defaultPrevented, false);
  assert.equal(f.navigation.pending, null);
  assert.equal(f.timers.size, 0);
});

test("a rejected native handoff follows the original link once", async (t) => {
  const f = navigationFixture(t);
  const fallbacks = [];
  global.location.assign = (url) => fallbacks.push(url);
  f.player.reload = () => Promise.reject(new Error("native load failed"));
  assert.equal(f.click(SourceKind.WATCH_LATER, NEXT_HREF).defaultPrevented, true);
  await f.settle();
  assert.deepEqual(fallbacks, [NEXT_HREF]);
  assert.equal(f.navigation.pending, null);
  assert.equal(f.timers.size, 0);
});

test("a handoff that changes only the URL still falls back", async (t) => {
  const f = navigationFixture(t);
  const fallbacks = [];
  f.player.reload = () => {
    global.location = new URL(NEXT_HREF);
    global.location.assign = (url) => fallbacks.push(url);
    return Promise.resolve(true);
  };
  f.click(SourceKind.WATCH_LATER, NEXT_HREF);
  await f.settle();
  assert.deepEqual(fallbacks, [NEXT_HREF]);
});

test("an unresponsive handoff has one bounded fallback", (t) => {
  const f = navigationFixture(t);
  const fallbacks = [];
  global.location.assign = (url) => fallbacks.push(url);
  f.player.reload = () => new Promise(() => {});
  f.click(SourceKind.WATCH_LATER, NEXT_HREF);
  assert.deepEqual([...f.timers.values()].map((timer) => timer.delay), [10000]);
  f.runTimers(10000);
  f.runTimers(10000);
  assert.deepEqual(fallbacks, [NEXT_HREF]);
});

test("clicking A while B is loading sends a newer request even before the URL changes", async (t) => {
  const f = navigationFixture(t);
  const requests = [];
  let rejectFirst;
  f.player.reload = (target) => {
    requests.push(target.bvid);
    if (requests.length === 1) return new Promise((_resolve, reject) => { rejectFirst = reject; });
    f.land(target);
    return Promise.resolve(true);
  };
  f.click(SourceKind.WATCH_LATER, NEXT_HREF);
  f.click(SourceKind.WATCH_LATER, TEST_WATCH_HREF);
  rejectFirst(new Error("superseded"));
  await f.settle();
  assert.deepEqual(requests, ["BV1xx411c7mD", "BV1aa411c7mD"]);
  assert.equal(global.location.href, TEST_WATCH_HREF);
  assert.equal(f.navigation.pending, null);
  assert.equal(f.timers.size, 0);
});

test("navigation away and explicit cancellation suppress delayed failures", async (t) => {
  const f = navigationFixture(t);
  let reject;
  f.player.reload = () => new Promise((_resolve, failure) => { reject = failure; });
  const results = [];
  f.navigation.navigate(NEXT_HREF, (...args) => results.push(args));
  global.location = new URL("https://www.bilibili.com/video/BVthird");
  reject(new Error("old failure"));
  await f.settle();
  assert.deepEqual(results, []);
  f.navigation.navigate(NEXT_HREF, (...args) => results.push(args));
  f.navigation.cancel();
  reject(new Error("canceled failure"));
  await f.settle();
  assert.deepEqual(results, []);
});

test("disabling the layout cancels its pending fallback", async (t) => {
  const f = navigationFixture(t);
  let reject;
  f.player.reload = () => new Promise((_resolve, failure) => { reject = failure; });
  f.click(SourceKind.HISTORY, NEXT_HREF);
  t.mock.method(f.controller.layout, "destroy", () => {});
  t.mock.method(f.controller, "renderFloatingActivation", () => {});
  f.controller.setEnabled(false);
  reject(new Error("late failure"));
  await f.settle();
  assert.equal(f.navigation.pending, null);
  assert.equal(f.timers.size, 0);
});

test("page bridge rejects malformed input and passes only playback fields", async (t) => {
  const f = navigationFixture(t);
  for (const detail of [null, "{", "x".repeat(1025), JSON.stringify({ id: "id", target: { bvid: "BVnext", p: 0 } })]) {
    const event = new CustomEvent(REQUEST_EVENT, { cancelable: true, detail });
    f.document.dispatchEvent(event);
    assert.equal(event.defaultPrevented, false);
  }
  const event = new CustomEvent(REQUEST_EVENT, {
    cancelable: true,
    detail: JSON.stringify({ id: "id", target: { bvid: "BVnext", p: 1, t: 4, url: "https://other.test", autoplay: false } })
  });
  f.document.dispatchEvent(event);
  await f.settle();
  assert.equal(event.defaultPrevented, true);
  assert.deepEqual(f.requests, [{ bvid: "BVnext", p: 1, t: 4 }]);
});

test("unrelated and malformed responses cannot finish the active request", (t) => {
  const f = navigationFixture(t);
  f.player.reload = () => new Promise(() => {});
  const results = [];
  f.navigation.navigate(NEXT_HREF, (...args) => results.push(args));
  for (const detail of [null, "{", JSON.stringify({ id: "old", success: true, url: TEST_WATCH_HREF })]) {
    f.document.dispatchEvent(new CustomEvent(RESULT_EVENT, { detail }));
  }
  assert.equal(results.length, 0);
  assert.ok(f.navigation.pending);
});

test("reinstalling the page bridge does not duplicate native requests", async (t) => {
  const f = navigationFixture(t);
  f.installPage();
  f.navigation.start();
  assert.equal(f.scripts.length, 1);
  assert.equal(f.scripts[0].src, "chrome-extension://test/src/page-navigation.js");
  f.click(SourceKind.RECOMMENDATIONS, NEXT_HREF);
  await f.settle();
  assert.equal(f.requests.length, 1);
  f.navigation.stop();
  assert.equal(f.scripts.length, 0);
  assert.equal(f.navigation.ready, false);
});
