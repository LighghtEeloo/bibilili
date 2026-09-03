const assert = require("node:assert/strict");
const test = require("node:test");

const { loadContentRuntime } = require("./helpers/content-runtime.js");
const {
  AccountSourceAdapter,
  AccountSourceStore,
  AccountSourceStatus,
  SourceKind
} = loadContentRuntime();

function entries(start, count) {
  return Array.from({ length: count }, (_, index) => ({
    aid: start + index,
    title: "Video " + (start + index)
  }));
}

function payload(list, cursor = null) {
  return { code: 0, data: { list, cursor, count: list.length } };
}

function cursor(max, viewAt = 1000) {
  return { max, view_at: viewAt, business: "archive" };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((accept, decline) => {
    resolve = accept;
    reject = decline;
  });
  return { promise, resolve, reject };
}

function mockApi(t, watchLater, historyPages) {
  const requests = [];
  t.mock.method(AccountSourceStore, "fetchApiPayload", async (url, signal) => {
    const parsed = new URL(url);
    requests.push({ url: parsed, signal });
    if (parsed.pathname === "/x/v2/history/toview") {
      return payload(watchLater);
    }
    assert.equal(parsed.pathname, "/x/web-interface/history/cursor");
    assert.ok(historyPages.length, "unexpected history request");
    const next = historyPages.shift();
    if (next instanceof Error) {
      throw next;
    }
    return next;
  });
  return requests;
}

function source(store, kind = SourceKind.HISTORY) {
  return store.currentSources().find((candidate) => candidate.kind === kind);
}

test("retains watch-later entries past 80 and reveals batches without requests", async (t) => {
  const requests = mockApi(t, entries(1, 131), [payload([])]);
  const store = new AccountSourceStore(() => {});
  await store.refresh("en");

  assert.equal(source(store, SourceKind.WATCH_LATER).items.length, 80);
  assert.equal(source(store, SourceKind.WATCH_LATER).pagination.hasMore, true);
  assert.equal(store.currentWatchLaterCount(), 131);

  await store.loadMore(SourceKind.WATCH_LATER);
  assert.equal(source(store, SourceKind.WATCH_LATER).items.length, 110);
  await store.refresh("en");
  assert.equal(source(store, SourceKind.WATCH_LATER).items.length, 110);

  await store.loadMore(SourceKind.WATCH_LATER);
  assert.equal(source(store, SourceKind.WATCH_LATER).items.length, 131);
  assert.equal(source(store, SourceKind.WATCH_LATER).pagination.hasMore, false);
  await store.loadMore(SourceKind.WATCH_LATER);
  assert.equal(requests.length, 2);
  assert.equal(store.currentWatchLaterCount(), 131);
});

test("uses valid retained items rather than account totals to offer more", async (t) => {
  t.mock.method(AccountSourceStore, "fetchApiPayload", async () => ({
    code: 0,
    data: {
      count: 150,
      list: [
        ...entries(1, 80),
        ...entries(1, 20).map((entry) => ({ ...entry, title: "Changed title" })),
        ...Array.from({ length: 50 }, () => ({ title: "Missing URL" }))
      ]
    }
  }));
  const store = new AccountSourceStore(() => {});
  await store.refresh("en");

  assert.equal(source(store, SourceKind.WATCH_LATER).items.length, 80);
  assert.equal(source(store, SourceKind.WATCH_LATER).pagination.hasMore, false);
  assert.equal(store.currentWatchLaterCount(), 150);
});

test("reveals a cached watch-later target in batches without another request", async (t) => {
  const requests = mockApi(t, entries(1, 240), [payload(entries(1001, 30), cursor(1030))]);
  let changes = 0;
  const store = new AccountSourceStore(() => { changes += 1; });
  await store.refresh("en");
  const history = source(store);
  const changesBeforeReveal = changes;

  const revealed = store.revealWatchLaterItem(
    "https://www.bilibili.com/video/av191/?p=1&from=watch_later#player"
  );
  assert.equal(revealed.items.length, 200);
  assert.equal(revealed.items[190].watchLaterAid, "191");
  assert.equal(revealed.pagination.hasMore, true);
  assert.equal(changes, changesBeforeReveal + 1);
  assert.equal(store.currentWatchLaterCount(), 240);
  assert.deepEqual(source(store), history);
  assert.equal(requests.length, 2);

  store.revealWatchLaterItem("https://www.bilibili.com/video/av191");
  assert.equal(changes, changesBeforeReveal + 1);
  await store.loadMore(SourceKind.WATCH_LATER);
  assert.equal(store.revealWatchLaterItem("https://www.bilibili.com/video/av5").items.length, 230);
  assert.equal(requests.length, 2);
});

test("watch-later reveal leaves unloaded, absent, and different-part targets alone", async (t) => {
  const requests = mockApi(t, entries(1, 131), [payload([])]);
  const store = new AccountSourceStore(() => {});
  assert.equal(store.revealWatchLaterItem("https://www.bilibili.com/video/av100"), null);
  assert.equal(requests.length, 0);
  await store.refresh("en");

  for (const targetUrl of [
    "https://www.bilibili.com/video/av999",
    "https://www.bilibili.com/video/av100?p=2",
    "https://example.com/video/av100",
    "invalid"
  ]) {
    assert.equal(store.revealWatchLaterItem(targetUrl), null);
  }
  assert.equal(source(store, SourceKind.WATCH_LATER).items.length, 80);
  assert.equal(store.currentWatchLaterCount(), 131);
  assert.equal(requests.length, 2);
});

test("follows history cursors, merges overlapping routes, and grows beyond 80", async (t) => {
  const requests = mockApi(t, [], [
    payload(entries(1, 30), cursor(30, 900)),
    payload([{ aid: 30, title: "Updated title" }, ...entries(31, 29)], cursor(59, 800)),
    payload(entries(60, 30), cursor(89, 700)),
    payload([], cursor(0, 0))
  ]);
  const store = new AccountSourceStore(() => {});
  await store.refresh("en");
  const firstItem = source(store).items[0];

  await store.loadMore(SourceKind.HISTORY);
  assert.equal(source(store).items.length, 59);
  assert.equal(source(store).items[29].title, "Video 30");
  assert.equal(source(store).items[0], firstItem);
  assert.equal(requests[2].url.searchParams.get("max"), "30");
  assert.equal(requests[2].url.searchParams.get("view_at"), "900");
  assert.equal(requests[2].url.searchParams.get("business"), "archive");
  assert.equal(requests[2].url.searchParams.get("type"), "archive");
  assert.equal(requests[2].url.searchParams.get("ps"), "30");

  await store.loadMore(SourceKind.HISTORY);
  assert.equal(source(store).items.length, 89);
  assert.equal(source(store).pagination.hasMore, true);
  await store.loadMore(SourceKind.HISTORY);
  assert.equal(source(store).items.length, 89);
  assert.equal(source(store).pagination.hasMore, false);
  await store.loadMore(SourceKind.HISTORY);
  assert.equal(requests.length, 5);
});

test("keeps continuation for short or filtered pages and stops repeated cursors", async (t) => {
  const requests = mockApi(t, [], [
    payload(entries(1, 1), cursor(1, 900)),
    payload([{ title: "Missing URL" }], cursor(2, 800)),
    payload(entries(2, 1), cursor(1, 900))
  ]);
  const store = new AccountSourceStore(() => {});
  await store.refresh("en");
  assert.equal(source(store).pagination.hasMore, true);

  await store.loadMore(SourceKind.HISTORY);
  assert.equal(source(store).items.length, 1);
  assert.equal(source(store).pagination.hasMore, true);
  await store.loadMore(SourceKind.HISTORY);
  assert.equal(source(store).items.length, 2);
  assert.equal(source(store).pagination.hasMore, false);
  await store.loadMore(SourceKind.HISTORY);
  assert.equal(requests.length, 4);
});

test("validates history continuation independently of card extraction", () => {
  assert.deepEqual(
    AccountSourceAdapter.historyCursorFromPayload(
      payload([{ title: "Missing URL" }], cursor("30", "900"))
    ),
    { max: 30, viewAt: 900, business: "archive" }
  );
  for (const response of [
    payload([], cursor(30)),
    payload(entries(1, 1)),
    payload(entries(1, 1), cursor(0, 0)),
    payload(entries(1, 1), cursor(-1)),
    payload(entries(1, 1), { max: "invalid", view_at: 900 })
  ]) {
    assert.equal(AccountSourceAdapter.historyCursorFromPayload(response), null);
  }
});

test("deduplicates in-flight loads and retries the same cursor after failure", async (t) => {
  const pending = deferred();
  const requests = mockApi(t, [], [
    payload(entries(1, 30), cursor(30)),
    pending.promise,
    payload(entries(31, 30), cursor(60))
  ]);
  const store = new AccountSourceStore(() => {});
  await store.refresh("en");
  const loading = store.loadMore(SourceKind.HISTORY);

  assert.equal(source(store).pagination.status, AccountSourceStatus.LOADING);
  await store.loadMore(SourceKind.HISTORY);
  assert.equal(requests.length, 3);
  pending.reject(new Error("offline"));
  await loading;

  assert.equal(source(store).items.length, 30);
  assert.equal(source(store).pagination.status, AccountSourceStatus.ERROR);
  assert.equal(source(store).pagination.hasMore, true);
  await store.loadMore(SourceKind.HISTORY);
  assert.equal(requests[3].url.href, requests[2].url.href);
  assert.equal(source(store).items.length, 60);
  assert.equal(source(store).pagination.status, AccountSourceStatus.READY);
});

test("treats account application errors as retryable continuation failures", async (t) => {
  mockApi(t, [], [
    payload(entries(1, 1), cursor(1)),
    { code: -101, message: "Not logged in" }
  ]);
  const store = new AccountSourceStore(() => {});
  await store.refresh("en");
  await store.loadMore(SourceKind.HISTORY);

  assert.equal(source(store).items.length, 1);
  assert.equal(source(store).pagination.status, AccountSourceStatus.ERROR);
  assert.equal(source(store).pagination.hasMore, true);
});

test("ignores a late page response after the account session stops", async (t) => {
  const pending = deferred();
  const requests = mockApi(t, [], [
    payload(entries(1, 30), cursor(30)),
    pending.promise
  ]);
  let changes = 0;
  const store = new AccountSourceStore(() => { changes += 1; });
  await store.refresh("en");
  const loading = store.loadMore(SourceKind.HISTORY);
  store.stop();
  const changesAtStop = changes;
  assert.equal(requests[2].signal.aborted, true);
  pending.resolve(payload(entries(31, 30), cursor(60)));
  await loading;

  assert.deepEqual(store.currentSources(), []);
  assert.equal(store.currentWatchLaterCount(), null);
  assert.equal(changes, changesAtStop);
});

test("publishes history while the initial watch-later request is still pending", async (t) => {
  const pending = deferred();
  t.mock.method(AccountSourceStore, "fetchApiPayload", async (url) =>
    new URL(url).pathname === "/x/v2/history/toview"
      ? pending.promise
      : payload(entries(1, 30), cursor(30))
  );
  const historyReady = deferred();
  const store = new AccountSourceStore(() => {
    if (source(store)?.items.length === 30) {
      historyReady.resolve();
    }
  });
  const refresh = store.refresh("en");
  await historyReady.promise;
  assert.equal(source(store, SourceKind.WATCH_LATER), undefined);
  assert.equal(source(store).items.length, 30);
  pending.reject(new Error("unavailable"));
  await refresh;
  assert.equal(source(store).items.length, 30);
});

test("watch-later mutations preserve both expansion depths and history pages", async (t) => {
  const watchLater = entries(1, 131);
  const requests = mockApi(t, watchLater, [
    payload(entries(1001, 30), cursor(1030)),
    payload(entries(1031, 30), cursor(1060))
  ]);
  const store = new AccountSourceStore(() => {});
  await store.refresh("en");
  await store.loadMore(SourceKind.WATCH_LATER);
  await store.loadMore(SourceKind.HISTORY);

  t.mock.method(AccountSourceStore, "addWatchLaterApiItem", async () => {
    watchLater.unshift(...entries(9000, 1));
  });
  t.mock.method(AccountSourceStore, "deleteWatchLaterApiItem", async () => {});
  await store.addWatchLaterItem("https://www.bilibili.com/video/av9000", "en");

  assert.equal(requests.length, 4);
  assert.equal(source(store).items.length, 60);
  assert.equal(source(store, SourceKind.WATCH_LATER).items.length, 110);
  assert.equal(source(store, SourceKind.WATCH_LATER).items[0].watchLaterAid, "9000");
  assert.equal(store.currentWatchLaterCount(), 132);

  await store.deleteWatchLaterItem("9000");
  assert.equal(source(store, SourceKind.WATCH_LATER).items.length, 110);
  assert.equal(source(store, SourceKind.WATCH_LATER).items[0].watchLaterAid, "1");
  await store.loadMore(SourceKind.WATCH_LATER);
  assert.equal(source(store, SourceKind.WATCH_LATER).items.length, 131);
  assert.equal(source(store, SourceKind.WATCH_LATER).pagination.hasMore, false);
  assert.equal(store.currentWatchLaterCount(), 131);
  assert.equal(source(store).items.length, 60);
  assert.equal(requests.length, 4);
});

test("a canceled refresh cannot restore a deleted watch-later card", async (t) => {
  const pending = deferred();
  const watchPages = [
    payload(entries(1, 2)),
    pending.promise,
    payload(entries(2, 2))
  ];
  t.mock.method(AccountSourceStore, "fetchApiPayload", async (url) =>
    new URL(url).pathname === "/x/v2/history/toview"
      ? watchPages.shift()
      : payload([])
  );
  t.mock.method(AccountSourceStore, "deleteWatchLaterApiItem", async () => {});
  const store = new AccountSourceStore(() => {});
  await store.refresh("en");
  const refresh = store.refreshSource(SourceKind.WATCH_LATER);
  await store.deleteWatchLaterItem("1");
  pending.resolve(payload(entries(1, 3)));
  await refresh;

  assert.deepEqual(
    source(store, SourceKind.WATCH_LATER).items.map((item) => item.watchLaterAid),
    ["2", "3"]
  );
  assert.equal(store.currentWatchLaterCount(), 2);
});
