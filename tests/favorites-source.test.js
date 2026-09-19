const assert = require("node:assert/strict");
const test = require("node:test");
const { FakeStorage, loadContentRuntime } = require("./helpers/content-runtime.js");
const { AccountSourceAdapter, AccountSourceStore, AccountSourceStatus, SourceKind, SourceMerger } = loadContentRuntime();
const { FavoriteFolderPreference, SourceRouteStateStore, CardNavigationOriginStore } = global.__bibililiStorageState;

const F = SourceKind.FAVORITES;
const folder = (id, title = `Folder ${id}`, count = 42) => ({ id, title, media_count: count, attr: 2 });
const media = (id, extra = {}) => ({ id, type: 2, title: `Video ${id}`, cover: "https://i0.hdslb.com/bfs/archive/cover.jpg", upper: { name: "Creator" }, cnt_info: { play: 150 }, ...extra });
const page = (medias, more = false) => ({ code: 0, data: { medias, has_more: more } });
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

/** Serves observed Bilibili response shapes and records exact page requests. */
function fixture(t, pages = {}) {
  global.localStorage = new FakeStorage();
  global.sessionStorage = new FakeStorage();
  const data = { account: { code: 0, data: { mid: 77, isLogin: true } }, folders: [folder(101), folder(202), folder(303, "Empty", 0)] };
  const requests = [];
  t.mock.method(AccountSourceStore, "fetchApiPayload", async (href, signal) => {
    const url = new URL(href);
    requests.push({ url, signal });
    if (url.pathname.endsWith("/nav")) return data.account;
    if (url.pathname.endsWith("/list-all")) return { code: 0, data: { list: data.folders, count: data.folders.length } };
    if (url.pathname.endsWith("/resource/list")) {
      const key = `${url.searchParams.get("media_id")}:${url.searchParams.get("pn")}`;
      const response = pages[key] ?? page([]);
      return typeof response === "function" ? response() : response;
    }
    return { code: 0, data: { list: [] } };
  });
  const store = new AccountSourceStore(() => {});
  store.language = "en";
  const resources = () => requests.filter(({ url }) => url.pathname.endsWith("/resource/list"));
  return { store, data, requests, resources };
}

test("favorites follows recommendations and precedes watch later, without eager folder requests", async (t) => {
  const { store, requests } = fixture(t);
  await store.refresh("en");
  assert.equal(requests.length, 2);
  const source = store.currentSource(F);
  assert.equal(source.folderId, null);
  assert.deepEqual(source.items, []);
  const kinds = [SourceKind.HISTORY, SourceKind.WATCH_LATER, F, SourceKind.RECOMMENDATIONS];
  assert.deepEqual(SourceMerger.merge([], kinds.map((kind) => ({ kind }))).map(({ kind }) => kind),
    [SourceKind.RECOMMENDATIONS, F, SourceKind.WATCH_LATER, SourceKind.HISTORY]);
});

test("favorite records reuse video extraction and exclude unsupported or unavailable media", () => {
  const items = AccountSourceAdapter.itemsFromEntries(F, [media(1), media(2, { type: 12 }), media(3, { attr: 9 }),
    media(4, { title: "" }), media(1), media(5, { bvid: "BV1aa411c7mD", bv_id: "BV1aa411c7mD" })], "en");
  assert.equal(items.length, 2);
  assert.equal(items[0].targetUrl, "https://www.bilibili.com/video/av1");
  assert.equal(items[0].author, "Creator");
  assert.equal(items[1].targetUrl, "https://www.bilibili.com/video/BV1aa411c7mD");
});

test("loads only a selected owned folder and keeps numbered continuation after filtered pages", async (t) => {
  const { store, resources } = fixture(t, {
    "101:1": page([media(1), media(2)], true),
    "101:2": page([media(3, { type: 12 })], true),
    "101:3": page([media(2), media(4)])
  });
  await store.loadFavoriteFolders();
  assert.equal(resources().length, 0);
  await store.selectFavoriteFolder("999");
  assert.equal(resources().length, 0);
  await store.selectFavoriteFolder("101");
  assert.equal(resources()[0].url.searchParams.get("ps"), "20");
  await store.loadMore(F);
  assert.equal(store.currentSource(F).pagination.hasMore, true);
  await store.loadMore(F);
  assert.deepEqual(store.currentSource(F).items.map(({ title }) => title), ["Video 1", "Video 2", "Video 4"]);
  assert.deepEqual(resources().map(({ url }) => url.searchParams.get("pn")), ["1", "2", "3"]);
  assert.equal(store.currentSource(F).pagination.hasMore, false);
});

test("folder switches retain separate caches, expansion, and late responses", async (t) => {
  const pending = deferred();
  const { store, resources } = fixture(t, {
    "101:1": page([media(1)], true), "101:2": pending.promise, "202:1": page([media(8)])
  });
  await store.loadFavoriteFolders();
  await store.selectFavoriteFolder("101");
  const more = store.loadMore(F);
  await store.selectFavoriteFolder("202");
  pending.resolve(page([media(2)]));
  await more;
  assert.equal(store.currentSource(F).items[0].title, "Video 8");
  await store.selectFavoriteFolder("101");
  assert.equal(resources().length, 3);
  assert.equal(store.currentSource(F).items.length, 2);
  assert.equal(store.currentSource(F).pagination.hasMore, false);
});

test("continuation failures retry the same page and refresh failures retain cards", async (t) => {
  let fail = true;
  const { store, resources } = fixture(t, {
    "101:1": () => page([media(1)], true),
    "101:2": () => { if (fail) throw new Error("offline"); return page([media(2)]); }
  });
  await store.loadFavoriteFolders();
  await store.selectFavoriteFolder("101");
  await store.loadMore(F);
  assert.equal(store.currentSource(F).pagination.status, AccountSourceStatus.ERROR);
  assert.equal(store.currentSource(F).items.length, 1);
  fail = false;
  await store.loadMore(F);
  assert.equal(resources()[1].url.href, resources()[2].url.href);
  t.mock.method(AccountSourceStore, "fetchApiPayload", async () => { throw new Error("offline"); });
  await store.refreshSource(F);
  assert.equal(store.currentSource(F).status, AccountSourceStatus.ERROR);
  assert.equal(store.currentSource(F).items.length, 2);
});

test("empty folders remain selectable and remembered per account", async (t) => {
  const { store } = fixture(t);
  await store.loadFavoriteFolders();
  await store.selectFavoriteFolder("303");
  assert.equal(store.currentSource(F).folderId, "303");
  assert.equal(store.currentSource(F).loaded, true);
  assert.deepEqual(store.currentSource(F).items, []);
  assert.equal(FavoriteFolderPreference.read("77"), "303");
  assert.equal(FavoriteFolderPreference.read("88"), null);
  store.stop();
  await store.loadFavoriteFolders();
  assert.equal(store.currentSource(F).folderId, "303");
});

test("first use selects the default folder by its attribute rather than its title or list position", async (t) => {
  const { store, data, resources } = fixture(t, { "202:1": page([media(1)]) });
  data.folders = [{ ...folder(101, "默认收藏夹"), attr: 3 }, { ...folder(202, "Renamed default"), attr: 0 }];
  await store.loadFavoriteFolders();
  assert.equal(store.currentSource(F).folderId, "202");
  assert.equal(store.currentSource(F).isDefaultFolder, true);
  assert.equal(store.currentSource(F).title, "Renamed default");
  assert.equal(FavoriteFolderPreference.read("77"), "202");
  assert.deepEqual(resources().map(({ url }) => url.searchParams.get("media_id")), ["202"]);
});

test("saved custom folders take precedence and deleted selections fall back to default favorites", async (t) => {
  const { store, data } = fixture(t);
  data.folders[0].attr = 1;
  FavoriteFolderPreference.write("77", "303");
  await store.loadFavoriteFolders();
  assert.equal(store.currentSource(F).folderId, "303");
  assert.equal(store.currentSource(F).isDefaultFolder, false);
  data.folders = data.folders.filter(({ id }) => id !== 303);
  await store.loadFavoriteFolders(true);
  assert.equal(store.currentSource(F).folderId, "101");
  assert.equal(store.currentSource(F).isDefaultFolder, true);
  assert.equal(FavoriteFolderPreference.read("77"), "101");
});

test("a folder choice supersedes a pending navigation hint during directory refresh", async (t) => {
  const { store, data, resources } = fixture(t);
  await store.loadFavoriteFolders();
  await store.selectFavoriteFolder("101");
  const pending = deferred();
  const account = data.account;
  data.account = pending.promise;
  store.restoreFavoriteFolder("202");
  const refresh = store.favoriteFolders.promise;
  await store.selectFavoriteFolder("303");
  pending.resolve(account);
  await refresh;
  assert.equal(store.currentSource(F).folderId, "303");
  assert.equal(FavoriteFolderPreference.read("77"), "303");
  assert.deepEqual(resources().map(({ url }) => url.searchParams.get("media_id")), ["101", "303"]);
});

test("settings cancel directory requests before folder data can load", async (t) => {
  const { store, data, requests } = fixture(t);
  const pending = deferred();
  const account = data.account;
  data.account = pending.promise;
  const loading = store.loadFavoriteFolders();
  store.setEnabledKinds([SourceKind.WATCH_LATER, SourceKind.HISTORY]);
  assert.equal(requests[0].signal.aborted, true);
  pending.resolve(account);
  await loading;
  assert.equal(requests.length, 1);
  assert.equal(store.favoriteFolders.accountId, null);
  assert.equal(store.favoriteFolders.items.length, 0);
  assert.equal(store.currentSource(F), null);
});

test("settings cancel per-folder requests and prevent late publication", async (t) => {
  const pending = deferred();
  const { store, resources } = fixture(t, { "101:1": pending.promise });
  await store.loadFavoriteFolders();
  const selecting = store.selectFavoriteFolder("101");
  store.setEnabledKinds([SourceKind.WATCH_LATER, SourceKind.HISTORY]);
  assert.equal(resources()[0].signal.aborted, true);
  assert.equal(store.currentSource(F), null);
  pending.resolve(page([media(1)]));
  await selecting;
  assert.equal(store.favoriteRecords.get("101").items.length, 0);
  store.setEnabledKinds([F, SourceKind.WATCH_LATER, SourceKind.HISTORY]);
  await store.refresh("en");
  assert.equal(store.currentSource(F).items.length, 1);
});

test("signed-out and changed-account responses discard the previous account's private cache", async (t) => {
  const { store, data } = fixture(t, { "101:1": page([media(1)]) });
  await store.loadFavoriteFolders();
  await store.selectFavoriteFolder("101");
  data.account = { code: -101 };
  await store.loadFavoriteFolders(true);
  assert.equal(store.favoriteFolders.status, AccountSourceStatus.SIGNED_OUT);
  assert.equal(store.favoriteRecords.size, 0);
  assert.equal(store.currentSource(F).folderId, null);
  data.account = { code: 0, data: { mid: 88, isLogin: true } };
  data.folders = [folder(505)];
  await store.loadFavoriteFolders(true);
  assert.equal(store.currentSource(F).folderId, null);
  assert.equal(store.favoriteFolders.accountId, "88");
  assert.equal(store.favoriteFolders.status, AccountSourceStatus.READY);
});

test("deleted folders clear selection without choosing another folder", async (t) => {
  const { store, data } = fixture(t, { "101:1": page([media(1)]) });
  await store.loadFavoriteFolders();
  await store.selectFavoriteFolder("101");
  data.folders = [folder(202)];
  await store.loadFavoriteFolders(true);
  assert.equal(store.currentSource(F).folderId, null);
  assert.equal(store.favoriteRecords.has("101"), false);
  assert.equal(FavoriteFolderPreference.read("77"), null);
});

test("refresh and card origins retain validated folder identity", (t) => {
  fixture(t);
  const route = { sourceKind: F, folderId: "101" };
  SourceRouteStateStore.write("video:av1:p1", { ...route, isRailOpen: false });
  assert.deepEqual(SourceRouteStateStore.read("video:av1:p1"), { ...route, isRailOpen: false });
  CardNavigationOriginStore.write(route, "video:av2:p1");
  assert.deepEqual(CardNavigationOriginStore.take("video:av2:p1"), route);
  CardNavigationOriginStore.write({ ...route, folderId: "../bad" }, "video:av2:p1");
  assert.equal(CardNavigationOriginStore.take("video:av2:p1"), null);
});
