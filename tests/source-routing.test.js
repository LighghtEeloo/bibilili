const assert = require("node:assert/strict");
const test = require("node:test");

const { loadContentRuntime } = require("./helpers/content-runtime.js");

const { LayoutRoot, SourceKind, SourceMerger } = loadContentRuntime();

function source(kind, label) {
  return {
    kind,
    root: null,
    items: [{ targetUrl: `https://example.test/${label}`, title: label }]
  };
}

test("SourceMerger returns canonical source order", () => {
  const parts = source(SourceKind.PARTS, "parts");
  const collection = source(SourceKind.COLLECTION, "collection");
  const recommendations = source(SourceKind.RECOMMENDATIONS, "recommendations");
  const watchLater = source(SourceKind.WATCH_LATER, "watch later");
  const history = source(SourceKind.HISTORY, "history");

  assert.deepEqual(
    SourceMerger.merge(
      [recommendations, collection, parts],
      [history, watchLater]
    ),
    [parts, collection, recommendations, watchLater, history]
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

test("multipart pages default to parts before their containing collection", () => {
  const layout = Object.create(LayoutRoot.prototype);
  layout.pendingSourceRouteHint = null;
  layout.selectedSourceKind = null;
  layout.hasUserInteractedWithSources = false;

  const parts = {
    kind: SourceKind.PARTS,
    root: null,
    items: [
      {
        targetUrl: "https://www.bilibili.com/video/BV1aa411c7mD?p=1",
        title: "Part one"
      }
    ]
  };
  const collection = {
    kind: SourceKind.COLLECTION,
    root: null,
    items: [
      {
        targetUrl: "https://www.bilibili.com/video/BV1aa411c7mD",
        title: "Current archive",
        isCurrent: true
      }
    ]
  };

  assert.equal(
    layout.resolveSourceRoute([parts, collection], true),
    SourceKind.PARTS
  );
});
