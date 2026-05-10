const assert = require("node:assert/strict");
const test = require("node:test");

const {
  TEST_SOURCE_KIND: SourceKind,
  ThrowingStorage,
  loadStorageState,
  resetStorageState
} = require("./helpers/content-runtime.js");

const {
  ActivationPreference,
  CardNavigationOriginStore,
  CommentPaneWidthPreference,
  SourceRouteStateStore
} = loadStorageState();

test("ActivationPreference defaults on and persists off state", () => {
  resetStorageState();

  assert.equal(ActivationPreference.readEnabled(), true);

  ActivationPreference.writeEnabled(false);
  assert.equal(ActivationPreference.readEnabled(), false);

  ActivationPreference.writeEnabled(true);
  assert.equal(ActivationPreference.readEnabled(), true);
});

test("CommentPaneWidthPreference stores only supported widths", () => {
  resetStorageState();

  CommentPaneWidthPreference.write(320.6);
  assert.equal(CommentPaneWidthPreference.read(), 321);

  CommentPaneWidthPreference.write(120);
  assert.equal(CommentPaneWidthPreference.read(), 321);

  CommentPaneWidthPreference.write(800);
  assert.equal(CommentPaneWidthPreference.read(), 321);
});

test("SourceRouteStateStore persists state for the matching page route", () => {
  resetStorageState();

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
  resetStorageState();

  SourceRouteStateStore.write("video:BV1:p1", {
    sourceKind: "unknown",
    isRailOpen: true
  });

  assert.equal(SourceRouteStateStore.read("video:BV1:p1"), null);
});

test("CardNavigationOriginStore consumes matching card origins once", () => {
  resetStorageState();

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
  resetStorageState();

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
  resetStorageState();
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
