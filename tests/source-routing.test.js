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

/** Builds a layout that resolves routes and open state without a mounted dock. */
function routingLayout(railOpening) {
  const layout = Object.create(LayoutRoot.prototype);
  layout.preferences = {
    railOpening,
    sources: Object.fromEntries(Object.values(SourceKind).map((kind) => [kind, true]))
  };
  layout.pendingSourceRouteHint = null;
  layout.pendingSourceRouteOpenState = null;
  layout.appliedSourceRouteOpenState = null;
  layout.selectedSourceKind = null;
  layout.hasUserInteractedWithSources = false;
  layout.isRailOpen = false;
  return layout;
}

/** Resolves a new video's route and open state as setSources does. */
function openNewVideo(layout, sources) {
  const previousSourceKind = layout.selectedSourceKind;
  layout.selectedSourceKind = layout.resolveSourceRoute(sources, true);
  layout.resolveRailOpenState(sources, previousSourceKind, true);
  return layout.isRailOpen;
}

test("the rail opening preference sets the open state of automatically chosen routes", () => {
  const { RailOpening } = global.__bibililiStorageState;
  const current = {
    kind: SourceKind.COLLECTION,
    root: null,
    items: [{ targetUrl: global.location.href, title: "Current", isCurrent: true }]
  };
  const recommendations = source(SourceKind.RECOMMENDATIONS, "recommendations");

  assert.equal(openNewVideo(routingLayout(RailOpening.ALWAYS), [recommendations]), true);
  assert.equal(openNewVideo(routingLayout(RailOpening.NEVER), [current, recommendations]), false);
  assert.equal(openNewVideo(routingLayout(RailOpening.CONTEXTUAL), [current, recommendations]), true);
  assert.equal(openNewVideo(routingLayout(RailOpening.CONTEXTUAL), [recommendations]), false);

  const layout = routingLayout(RailOpening.NEVER);
  openNewVideo(layout, [recommendations]);
  layout.selectedSourceKind = SourceKind.WATCH_LATER;
  layout.resolveRailOpenState([source(SourceKind.WATCH_LATER, "watch later")], SourceKind.RECOMMENDATIONS, false);
  assert.equal(layout.isRailOpen, false, "a later automatic route keeps the preference");
});

test("hinted routes keep their open state under any rail opening preference", () => {
  const { RailOpening } = global.__bibililiStorageState;
  const recommendations = source(SourceKind.RECOMMENDATIONS, "recommendations");
  const layout = routingLayout(RailOpening.NEVER);
  layout.setPendingSourceRouteState({ sourceKind: SourceKind.RECOMMENDATIONS, isRailOpen: true });
  assert.equal(openNewVideo(layout, [recommendations]), true);
});
