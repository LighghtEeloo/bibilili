const assert = require("node:assert/strict");
const test = require("node:test");
const { loadContentRuntime } = require("./helpers/content-runtime.js");
const { AccountSourceStore, SourceKind } = loadContentRuntime();
const WATCH = SourceKind.WATCH_LATER;
const ADD_URL = "https://api.bilibili.com/x/v2/history/toview/add";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((accept, decline) => { resolve = accept; reject = decline; });
  return { promise, resolve, reject };
}

const entries = (count) => Array.from({ length: count }, (_, index) => ({ aid: index + 1, title: `Video ${index + 1}` }));
const payload = (list) => ({ code: 0, data: { list, count: list.length } });
const settle = () => new Promise(setImmediate);

/** Supplies browser-delivered resource events and independently controlled API completions. */
function fixture(t) {
  let now = 10;
  const previousObserver = global.PerformanceObserver;
  const observers = [];
  global.PerformanceObserver = class {
    static supportedEntryTypes = ["resource"];
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe(options) { this.options = options; this.connected = true; }
    disconnect() { this.connected = false; }
    emit(...entries) { this.callback({ getEntries: () => entries }); }
  };
  t.mock.method(global.performance, "now", () => now);
  for (const method of ["setInterval", "setTimeout"]) {
    t.mock.method(global, method, () => { throw new Error("watch-later observation must not schedule timers"); });
  }
  const requests = [];
  const queued = [];
  const videos = entries(131);
  t.mock.method(AccountSourceStore, "fetchApiPayload", async (url, signal) => {
    requests.push({ url, signal });
    if (new URL(url).pathname !== "/x/v2/history/toview") return payload([]);
    return queued.length ? queued.shift() : payload(videos);
  });
  const store = new AccountSourceStore(() => {});
  t.after(() => { store.stop(); global.PerformanceObserver = previousObserver; });
  const resource = (responseEnd, overrides = {}) => ({
    name: ADD_URL, initiatorType: "fetch", responseEnd, ...overrides
  });
  const start = async () => {
    await store.refresh("en");
    store.setWatchLaterObservationActive(true);
    return store.watchLaterObserver;
  };
  const holdNextList = () => { const pending = deferred(); queued.push(pending.promise); return pending; };
  const listRequests = () => requests.filter(({ url }) => new URL(url).pathname === "/x/v2/history/toview");
  return { store, observers, videos, requests, start, resource, holdNextList, listRequests,
    setTime: (value) => { now = value; } };
}

test("observes only new add requests and preserves expansion, other sources, and account counts", async (t) => {
  const f = fixture(t);
  const observer = await f.start();
  f.store.setWatchLaterObservationActive(true);
  assert.equal(f.observers.length, 1);
  assert.deepEqual(observer.options, { type: "resource" }, "historical resource entries are not replayed");
  await f.store.loadMore(WATCH);
  const history = f.store.records.get(SourceKind.HISTORY);
  f.setTime(20);
  observer.emit(
    f.resource(10),
    ...[
      ADD_URL.replace("https:", "http:"),
      ADD_URL.replace("api.bilibili.com", "api.bilibili.com.example.org"),
      ADD_URL.replace("/add", ""),
      ADD_URL.replace("/add", "/del"),
      `${ADD_URL}/other`,
      `https://example.org/?next=${ADD_URL}`,
      "invalid"
    ].map((name) => f.resource(15, { name })),
    f.resource(15, { initiatorType: "img" })
  );
  assert.equal(f.listRequests().length, 1);

  f.videos.unshift({ aid: 999, title: "Native addition" });
  observer.emit(f.resource(15), f.resource(18, { name: `${ADD_URL}?from=native` }));
  await settle();
  assert.equal(f.listRequests().length, 2, "one delivered batch produces one refresh");
  assert.equal(f.store.currentSource(WATCH).items.length, 110);
  assert.equal(f.store.currentSource(WATCH).items[0].watchLaterAid, "999");
  assert.equal(f.store.currentWatchLaterCount(), 132);
  assert.equal(f.store.records.get(SourceKind.HISTORY), history);
  assert.equal(f.requests.length, 3, "history is not refreshed");

  f.setTime(30);
  observer.emit(f.resource(25, { initiatorType: "xmlhttprequest" }));
  await settle();
  assert.equal(f.listRequests().length, 3);
});

test("additions during an active list request coalesce into one follow-up without aborting it", async (t) => {
  const f = fixture(t);
  const observer = await f.start();
  const pending = f.holdNextList();
  f.setTime(20);
  observer.emit(f.resource(15));
  f.setTime(30);
  observer.emit(f.resource(25));
  f.setTime(40);
  observer.emit(f.resource(35), f.resource(38));
  assert.equal(f.listRequests().length, 2);
  assert.equal(f.listRequests()[1].signal.aborted, false);

  f.videos.unshift({ aid: 999, title: "Added during refresh" });
  f.setTime(50);
  pending.resolve(payload(entries(131)));
  await settle();
  assert.equal(f.listRequests().length, 3);
  assert.equal(f.store.currentWatchLaterCount(), 132);
  assert.equal(f.store.currentSource(WATCH).items[0].watchLaterAid, "999");
  observer.emit(f.resource(38));
  await settle();
  assert.equal(f.listRequests().length, 3, "delayed delivery is covered by the follow-up");
});

test("an addition during initial loading refreshes when the initial request settles", async (t) => {
  const f = fixture(t);
  f.store.setWatchLaterObservationActive(true);
  const initialObserver = f.store.watchLaterObserver;
  const pending = f.holdNextList();
  const loading = f.store.refresh("en");
  const observer = f.store.watchLaterObserver;
  assert.notEqual(observer, initialObserver);
  assert.equal(initialObserver.connected, false);
  f.setTime(20);
  observer.emit(f.resource(15));
  assert.equal(f.listRequests().length, 1);
  f.videos.unshift({ aid: 999, title: "Added during startup" });
  pending.resolve(payload([]));
  await loading;
  assert.equal(f.listRequests().length, 2);
  assert.equal(f.store.currentWatchLaterCount(), 132);
});

test("extension additions absorb resource events before and after their own refresh", async (t) => {
  const f = fixture(t);
  const observer = await f.start();
  const addition = deferred();
  t.mock.method(AccountSourceStore, "addWatchLaterApiItem", () => addition.promise);
  const adding = f.store.addWatchLaterItem("https://www.bilibili.com/video/av999", "en");
  f.setTime(20);
  observer.emit(f.resource(18));
  assert.equal(f.listRequests().length, 1, "the known addition supplies its own refresh");
  f.videos.unshift({ aid: 999, title: "Dock addition" });
  f.setTime(30);
  addition.resolve();
  await adding;
  observer.emit(f.resource(18));
  await settle();
  assert.equal(f.listRequests().length, 2);
  assert.equal(f.store.currentWatchLaterCount(), 132);
});

test("a native addition during an extension addition's list refresh still gets a follow-up", async (t) => {
  const f = fixture(t);
  const observer = await f.start();
  t.mock.method(AccountSourceStore, "addWatchLaterApiItem", async () => {});
  const pending = f.holdNextList();
  f.setTime(20);
  const adding = f.store.addWatchLaterItem("https://www.bilibili.com/video/av999", "en");
  await settle();
  f.setTime(30);
  observer.emit(f.resource(25));
  f.videos.unshift({ aid: 999, title: "Native addition" });
  pending.resolve(payload(entries(131)));
  await adding;
  assert.equal(f.listRequests().length, 3);
  assert.equal(f.store.currentWatchLaterCount(), 132);
});

test("failed additions trigger a list read without optimistic account changes", async (t) => {
  const f = fixture(t);
  const observer = await f.start();
  const addition = deferred();
  t.mock.method(AccountSourceStore, "addWatchLaterApiItem", () => addition.promise);
  const adding = f.store.addWatchLaterItem("https://www.bilibili.com/video/av999", "en");
  f.setTime(20);
  observer.emit(f.resource(15));
  addition.reject(new Error("addition failed"));
  await assert.rejects(adding, /addition failed/u);
  assert.equal(f.listRequests().length, 2);
  assert.equal(f.store.currentWatchLaterCount(), 131);
  assert.equal(f.store.currentSource(WATCH, true).items.some((item) => item.watchLaterAid === "999"), false);
});

test("failed list refreshes retain usable items and wait for another event before retrying", async (t) => {
  const f = fixture(t);
  const observer = await f.start();
  const pending = f.holdNextList();
  f.setTime(20);
  observer.emit(f.resource(15));
  pending.reject(new Error("unavailable"));
  await settle();
  assert.equal(f.store.currentWatchLaterCount(), 131);
  assert.equal(f.store.currentSource(WATCH).pagination.status, "error");
  assert.equal(f.listRequests().length, 2);
  f.setTime(30);
  observer.emit(f.resource(25));
  await settle();
  assert.equal(f.listRequests().length, 3);
  assert.equal(f.store.currentSource(WATCH).pagination.status, "ready");
});

test("disabling the source discards queued refreshes and rejects retired observers", async (t) => {
  const f = fixture(t);
  const observer = await f.start();
  const pending = f.holdNextList();
  f.setTime(20);
  observer.emit(f.resource(15));
  f.setTime(30);
  observer.emit(f.resource(25));
  f.store.setEnabledKinds([SourceKind.HISTORY]);
  assert.equal(observer.connected, false);
  assert.equal(f.listRequests()[1].signal.aborted, true);
  pending.resolve(payload(entries(200)));
  await settle();
  assert.equal(f.listRequests().length, 2);
  f.store.setEnabledKinds([WATCH, SourceKind.HISTORY]);
  f.store.setWatchLaterObservationActive(true);
  await f.store.refresh("en");
  const count = f.listRequests().length;
  f.setTime(40);
  observer.emit(f.resource(35));
  await settle();
  assert.equal(f.listRequests().length, count);
  assert.equal(f.store.currentWatchLaterCount(), 131);
});

test("stopping observation on route exit discards follow-ups without resetting cached items", async (t) => {
  const f = fixture(t);
  const observer = await f.start();
  const pending = f.holdNextList();
  f.setTime(20);
  observer.emit(f.resource(15));
  f.setTime(30);
  observer.emit(f.resource(25));
  f.store.setWatchLaterObservationActive(false);
  pending.resolve(payload(f.videos));
  await settle();
  assert.equal(f.listRequests().length, 2);
  assert.equal(f.store.currentWatchLaterCount(), 131);
});

test("store replacement discards old additions, callbacks, and pending list results", async (t) => {
  const f = fixture(t);
  const observer = await f.start();
  const addition = deferred();
  t.mock.method(AccountSourceStore, "addWatchLaterApiItem", () => addition.promise);
  const adding = f.store.addWatchLaterItem("https://www.bilibili.com/video/av999", "en");
  f.setTime(20);
  observer.emit(f.resource(15));
  f.store.stop();
  assert.equal(observer.connected, false);
  f.store.setWatchLaterObservationActive(true);
  await f.store.refresh("zh-CN");
  const count = f.listRequests().length;
  f.setTime(30);
  observer.emit(f.resource(25));
  addition.resolve();
  await adding;
  assert.equal(f.listRequests().length, count);
  assert.equal(f.store.currentWatchLaterCount(), 131);
});

test("resource observation is optional when the browser does not support it", async (t) => {
  const f = fixture(t);
  global.PerformanceObserver.supportedEntryTypes = ["longtask"];
  await f.start();
  assert.equal(f.store.watchLaterObserver, null);
  assert.equal(f.observers.length, 0);
  global.PerformanceObserver = undefined;
  f.store.setWatchLaterObservationActive(true);
  await f.store.refreshSource(WATCH);
  assert.equal(f.listRequests().length, 2);
});
