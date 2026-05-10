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

require("../src/content-route.js");
require("../src/content-state.js");
require("../src/content-i18n.js");
require("../src/content-storage.js");
require("../src/content.js");

const { SourceKind, SourceMerger } = global.__bibililiInternals;

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
