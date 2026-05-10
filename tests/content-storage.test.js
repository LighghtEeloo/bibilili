const assert = require("node:assert/strict");
const test = require("node:test");

global.window = globalThis;

require("../src/content-storage.js");

const {
  ActivationPreference,
  CardNavigationOriginStore,
  CommentPaneWidthPreference,
  SourceRouteStateStore,
  configure
} = globalThis.__bibililiStorageState;

const SourceKind = Object.freeze({
  COLLECTION: "collection",
  RECOMMENDATIONS: "recommendations",
  WATCH_LATER: "watch_later",
  HISTORY: "history"
});

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

class ThrowingStorage {
  getItem() {
    throw new Error("blocked");
  }

  setItem() {
    throw new Error("blocked");
  }

  removeItem() {
    throw new Error("blocked");
  }
}

function resetStorage() {
  global.localStorage = new FakeStorage();
  global.sessionStorage = new FakeStorage();
  configure({
    sourceOrder: [
      SourceKind.COLLECTION,
      SourceKind.RECOMMENDATIONS,
      SourceKind.WATCH_LATER,
      SourceKind.HISTORY
    ],
    commentPaneMinWidth: 240,
    commentPaneMaxWidth: 640
  });
}

test("ActivationPreference defaults on and persists off state", () => {
  resetStorage();

  assert.equal(ActivationPreference.readEnabled(), true);

  ActivationPreference.writeEnabled(false);
  assert.equal(ActivationPreference.readEnabled(), false);

  ActivationPreference.writeEnabled(true);
  assert.equal(ActivationPreference.readEnabled(), true);
});

test("CommentPaneWidthPreference stores only supported widths", () => {
  resetStorage();

  CommentPaneWidthPreference.write(320.6);
  assert.equal(CommentPaneWidthPreference.read(), 321);

  CommentPaneWidthPreference.write(120);
  assert.equal(CommentPaneWidthPreference.read(), 321);

  CommentPaneWidthPreference.write(800);
  assert.equal(CommentPaneWidthPreference.read(), 321);
});

test("SourceRouteStateStore persists state for the matching page route", () => {
  resetStorage();

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
  resetStorage();

  SourceRouteStateStore.write("video:BV1:p1", {
    sourceKind: "unknown",
    isRailOpen: true
  });

  assert.equal(SourceRouteStateStore.read("video:BV1:p1"), null);
});

test("CardNavigationOriginStore consumes matching card origins once", () => {
  resetStorage();

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

test("CardNavigationOriginStore clears mismatched and expired origins", () => {
  resetStorage();

  CardNavigationOriginStore.write(SourceKind.COLLECTION, "video:BV1:p1");

  assert.equal(CardNavigationOriginStore.take("video:BV2:p1"), null);
  assert.equal(CardNavigationOriginStore.take("video:BV1:p1"), null);

  const originalNow = Date.now;
  Date.now = () => 1000;
  CardNavigationOriginStore.write(SourceKind.HISTORY, "video:BV3:p1");
  Date.now = () => 123001;

  try {
    assert.equal(CardNavigationOriginStore.take("video:BV3:p1"), null);
  } finally {
    Date.now = originalNow;
  }
});

test("storage helpers tolerate blocked browser storage", () => {
  resetStorage();
  global.localStorage = new ThrowingStorage();
  global.sessionStorage = new ThrowingStorage();

  assert.equal(ActivationPreference.readEnabled(), true);
  assert.equal(CommentPaneWidthPreference.read(), null);
  assert.equal(SourceRouteStateStore.read("video:BV1:p1"), null);
  assert.equal(CardNavigationOriginStore.take("video:BV1:p1"), null);

  assert.doesNotThrow(() => {
    ActivationPreference.writeEnabled(false);
    CommentPaneWidthPreference.write(320);
    SourceRouteStateStore.write("video:BV1:p1", {
      sourceKind: SourceKind.COLLECTION,
      isRailOpen: true
    });
    CardNavigationOriginStore.write(SourceKind.COLLECTION, "video:BV1:p1");
  });
});
