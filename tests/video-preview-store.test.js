const assert = require("node:assert/strict");
const test = require("node:test");
const { loadContentRuntime } = require("./helpers/content-runtime.js");
const { VideoPreviewStore } = loadContentRuntime();

const cover = "https://i0.hdslb.com/bfs/archive/video-cover.jpg";
const item = (id) => ({ targetUrl: `https://www.bilibili.com/video/av${id}`, title: `Video ${id}` });
const settle = () => new Promise(setImmediate);

function fixture(t) {
  const requests = [];
  let changes = 0;
  t.mock.method(VideoPreviewStore, "fetchPreview", (identity, signal) => {
    let resolve;
    let reject;
    const promise = new Promise((accept, decline) => { resolve = accept; reject = decline; });
    requests.push({ identity, signal, resolve, reject });
    return promise;
  });
  const store = new VideoPreviewStore(() => { changes += 1; });
  t.after(() => store.stop());
  return { store, requests, changes: () => changes };
}

test("reading metadata stays idle until the rail supplies demand", (t) => {
  const { store, requests } = fixture(t);
  const items = Array.from({ length: 1000 }, (_, index) => item(index + 1));
  items.forEach((entry) => assert.equal(store.hydrateItem(entry), entry));
  assert.equal(requests.length, 0);

  store.setDemand([items[900], items[901], items[900]]);
  assert.deepEqual(requests.map((request) => request.identity.queryValue), ["901", "902"]);
});

test("preview demand skips usable covers and unsupported targets", (t) => {
  const { store, requests } = fixture(t);
  store.setDemand([
    { ...item(1), thumbnailUrl: cover },
    { targetUrl: "https://www.bilibili.com/bangumi/play/ep123", title: "Episode" },
    item(3)
  ]);
  assert.deepEqual(requests.map((request) => request.identity.queryValue), ["3"]);
});

test("limits concurrent metadata requests and pumps demand in order", async (t) => {
  const { store, requests } = fixture(t);
  store.setDemand(Array.from({ length: 12 }, (_, index) => item(index + 1)));
  assert.equal(requests.length, 4);
  requests[1].resolve(cover);
  await settle();
  assert.equal(requests.length, 5);
  assert.equal(requests[4].identity.queryValue, "5");
  assert.equal(store.hydrateItem(item(2)).thumbnailUrl, cover);
});

test("a distant jump cancels old requests and discards the old queue", async (t) => {
  const { store, requests, changes } = fixture(t);
  store.setDemand(Array.from({ length: 12 }, (_, index) => item(index + 1)));
  const abandoned = [...requests];
  store.setDemand([item(901), item(902)]);
  assert.ok(abandoned.every((request) => request.signal.aborted));
  assert.deepEqual(requests.slice(4).map((request) => request.identity.queryValue), ["901", "902"]);
  abandoned.forEach((request) => request.resolve(cover));
  await settle();
  assert.equal(changes(), 0);
  assert.equal(store.hydrateItem(item(1)).thumbnailUrl, undefined);
  assert.equal(requests.length, 6);

  store.setDemand([]);
  assert.ok(requests.every((request) => request.signal.aborted));
  requests.slice(4).forEach((request) => request.resolve(cover));
  await settle();
  assert.equal(changes(), 0);
});

test("reentering a canceled item ignores the earlier completion and cleanup", async (t) => {
  const { store, requests, changes } = fixture(t);
  store.setDemand([item(1)]);
  store.setDemand([]);
  store.setDemand([item(1)]);
  requests[0].resolve(cover);
  await settle();
  assert.equal(store.hydrateItem(item(1)).thumbnailUrl, undefined);
  assert.equal(changes(), 0);
  assert.equal(requests[1].signal.aborted, false);

  const newCover = cover.replace("video-cover", "new-cover");
  requests[1].resolve(newCover);
  await settle();
  assert.equal(store.hydrateItem(item(1)).thumbnailUrl, newCover);
  assert.equal(changes(), 1);
});

test("completed covers and failures are reused until the page session ends", async (t) => {
  const { store, requests } = fixture(t);
  store.setDemand([item(1), item(2), item(3)]);
  requests[0].resolve(cover);
  requests[1].resolve(null);
  requests[2].reject(new Error("Unavailable"));
  await settle();
  store.setDemand([]);
  store.setDemand([item(3), item(2), item(1)]);
  assert.equal(requests.length, 3);
  assert.equal(store.hydrateItem(item(1)).thumbnailUrl, cover);

  store.stop();
  assert.equal(store.hydrateItem(item(1)).thumbnailUrl, undefined);
  store.setDemand([item(1)]);
  assert.equal(requests.length, 4);
});
