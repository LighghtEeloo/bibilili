const assert = require("node:assert/strict");
const test = require("node:test");

const { loadContentRuntime } = require("./helpers/content-runtime.js");

const { SourceKind, SourceMerger } = loadContentRuntime();

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
