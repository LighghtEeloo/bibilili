const assert = require("node:assert/strict");
const test = require("node:test");

global.window = globalThis;
global.location = {
  href: "https://www.bilibili.com/video/BV1aa411c7mD"
};
global.document = {
  readyState: "loading",
  addEventListener: () => undefined
};
global.__bibililiExposeInternals = true;

class FakeStorage {
  constructor() {
    this.records = new Map();
  }

  getItem(key) {
    return this.records.has(key) ? this.records.get(key) : null;
  }

  setItem(key, value) {
    this.records.set(key, String(value));
  }

  removeItem(key) {
    this.records.delete(key);
  }
}

global.sessionStorage = new FakeStorage();

require("../src/content-route.js");
require("../src/content-state.js");
require("../src/content.js");

const {
  CardNavigationOriginStore,
  SourceKind,
  SourceMerger,
  SourceRouteStateStore
} = global.__bibililiInternals;

function source(kind, label) {
  return {
    kind,
    root: null,
    items: [{ targetUrl: `https://example.test/${label}`, title: label }]
  };
}

test("SourceMerger returns canonical source order", () => {
  const collection = source(SourceKind.COLLECTION, "collection");
  const recommendations = source(SourceKind.RECOMMENDATIONS, "recommendations");
  const watchLater = source(SourceKind.WATCH_LATER, "watch later");
  const history = source(SourceKind.HISTORY, "history");

  assert.deepEqual(
    SourceMerger.merge([recommendations, collection], [history, watchLater]),
    [collection, recommendations, watchLater, history]
  );
});

test("SourceMerger lets account sources replace page sources of the same kind", () => {
  const pageWatchLater = source(SourceKind.WATCH_LATER, "page watch later");
  const accountWatchLater = source(
    SourceKind.WATCH_LATER,
    "account watch later"
  );

  assert.deepEqual(
    SourceMerger.merge([pageWatchLater], [accountWatchLater]),
    [accountWatchLater]
  );
});

test("SourceRouteStateStore persists state for the matching page route", () => {
  global.sessionStorage = new FakeStorage();

  SourceRouteStateStore.write("video:BV1:p1", {
    sourceKind: SourceKind.HISTORY,
    isRailOpen: false
  });

  assert.deepEqual(SourceRouteStateStore.read("video:BV1:p1"), {
    sourceKind: SourceKind.HISTORY,
    isRailOpen: false
  });
  assert.equal(SourceRouteStateStore.read("video:BV2:p1"), null);
});

test("SourceRouteStateStore ignores invalid source state", () => {
  global.sessionStorage = new FakeStorage();

  SourceRouteStateStore.write("video:BV1:p1", {
    sourceKind: "unknown",
    isRailOpen: true
  });

  assert.equal(SourceRouteStateStore.read("video:BV1:p1"), null);
});

test("CardNavigationOriginStore consumes matching card origins once", () => {
  global.sessionStorage = new FakeStorage();

  CardNavigationOriginStore.write(
    SourceKind.RECOMMENDATIONS,
    "video:BV1:p1"
  );

  assert.equal(
    CardNavigationOriginStore.take("video:BV1:p1"),
    SourceKind.RECOMMENDATIONS
  );
  assert.equal(CardNavigationOriginStore.take("video:BV1:p1"), null);
});

test("CardNavigationOriginStore clears mismatched card origins", () => {
  global.sessionStorage = new FakeStorage();

  CardNavigationOriginStore.write(SourceKind.COLLECTION, "video:BV1:p1");

  assert.equal(CardNavigationOriginStore.take("video:BV2:p1"), null);
  assert.equal(CardNavigationOriginStore.take("video:BV1:p1"), null);
});
