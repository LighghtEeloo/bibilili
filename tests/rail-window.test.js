const assert = require("node:assert/strict");
const test = require("node:test");
const { loadContentRuntime } = require("./helpers/content-runtime.js");
const { RailElement, railFixture } = require("./helpers/rail-dom.js");
const { AccountSourceStore, BrowsePanel, LayoutRoot, RailWindow, SourceKind } = loadContentRuntime();
const { UiMessage, UiStrings } = global.__bibililiI18n;

global.HTMLElement = RailElement;
global.getComputedStyle = (element) => ({
  getPropertyValue: (name) => name === "--bibilili-card-width"
    ? `${element.ownerDocument.cardWidth}px` : "10px"
});
global.WheelEvent = { DOM_DELTA_PIXEL: 0, DOM_DELTA_LINE: 1, DOM_DELTA_PAGE: 2 };

function wheelEvent(overrides = {}) {
  return {
    deltaX: 0, deltaY: 100, deltaMode: WheelEvent.DOM_DELTA_PIXEL,
    cancelable: true, defaultPrevented: false,
    preventDefault() { this.defaultPrevented = true; },
    ...overrides
  };
}

function flushAsync() {
  return new Promise((resolve) => setImmediate(resolve));
}

test("vertical wheel input scrolls the rail in both directions and normalizes units", () => {
  const { layout, source, rail } = railFixture(LayoutRoot, 80);
  layout.renderRail(source, true);
  for (const [deltaMode, deltaY, expected] of [
    [WheelEvent.DOM_DELTA_PIXEL, 100, 100],
    [WheelEvent.DOM_DELTA_PIXEL, -40, 60],
    [WheelEvent.DOM_DELTA_LINE, 3, 108],
    [WheelEvent.DOM_DELTA_PAGE, 1, 1108]
  ]) {
    const event = wheelEvent({ deltaMode, deltaY });
    layout.handleRailWheel(event);
    assert.equal(rail.scrollLeft, expected);
    assert.equal(event.defaultPrevented, true);
  }
});

test("wheel input preserves native horizontal gestures, modifiers, and handled events", () => {
  const { layout, source, rail } = railFixture(LayoutRoot, 80);
  layout.renderRail(source, true);
  for (const overrides of [
    { deltaX: 100, deltaY: 0 }, { deltaX: 1 }, { deltaY: 0 },
    { ctrlKey: true }, { metaKey: true }, { altKey: true }, { shiftKey: true },
    { cancelable: false }, { defaultPrevented: true }
  ]) {
    const event = wheelEvent(overrides);
    layout.handleRailWheel(event);
    assert.equal(rail.scrollLeft, 0);
    assert.equal(event.defaultPrevented, Boolean(overrides.defaultPrevented));
  }
});

test("wheel input is consumed only when the rail can move", () => {
  const { layout, source, rail } = railFixture(LayoutRoot, 80);
  layout.renderRail(source, true);
  const start = wheelEvent({ deltaY: -100 });
  layout.handleRailWheel(start);
  assert.equal(rail.scrollLeft, 0);
  assert.equal(start.defaultPrevented, false);

  rail.scrollLeft = 100000;
  const endPosition = rail.scrollLeft;
  const end = wheelEvent();
  layout.handleRailWheel(end);
  assert.equal(rail.scrollLeft, endPosition);
  assert.equal(end.defaultPrevented, false);

  layout.renderRail({ ...source, items: source.items.slice(0, 1) }, true);
  const shortRail = wheelEvent();
  layout.handleRailWheel(shortRail);
  assert.equal(rail.scrollLeft, 0);
  assert.equal(shortRail.defaultPrevented, false);
});

async function watchLaterRailFixture(t, targetIndex = 190) {
  const fixture = railFixture(LayoutRoot, 240, SourceKind.WATCH_LATER);
  if (targetIndex !== -1) {
    fixture.source.items[targetIndex].targetUrl = global.location.href;
  }
  const requests = [];
  t.mock.method(AccountSourceStore, "fetchApiPayload", async (url) => {
    requests.push(url);
    const list = new URL(url).pathname === "/x/v2/history/toview"
      ? fixture.source.items.map((item, index) => ({
          url: item.targetUrl, title: item.title, aid: index + 1
        }))
      : [{ aid: 50001, title: "History item" }];
    return { code: 0, data: { list, count: list.length } };
  });
  const store = new AccountSourceStore(() => {});
  await store.refresh("en");
  let reveals = 0;
  fixture.layout.onWatchLaterReveal = () => {
    reveals += 1;
    return store.revealWatchLaterItem(global.location.href);
  };
  fixture.layout.currentActivationControl = {};
  fixture.layout.currentSources = store.currentSources();
  fixture.layout.selectedSourceKind = SourceKind.HISTORY;
  return { ...fixture, store, requests, reveals: () => reveals };
}

test("rail geometry bounds the window independently of list length", () => {
  const geometry = new RailWindow(10000, 190, 10);
  assert.equal(geometry.width(true), 2000190);
  assert.equal(geometry.width(false), 1999990);
  assert.deepEqual(geometry.range(-12, 1000, 3), { start: 0, end: 8 });
  assert.deepEqual(geometry.range(1000000, 1000, 3), { start: 4997, end: 5008 });
  assert.deepEqual(geometry.previewIndexes(1000000, 1000), [
    5000, 5001, 5002, 5003, 5004, 4999, 5005, 4998, 5006, 4997, 5007
  ]);
  assert.deepEqual(geometry.range(1999800, 1000, 3), { start: 9996, end: 10000 });
  assert.deepEqual(geometry.previewIndexes(0, 0), []);
  assert.deepEqual(new RailWindow(0, 190, 10).previewIndexes(0, 1000), []);
});

test("rail geometry centers directly and minimally reveals keyboard targets", () => {
  const geometry = new RailWindow(10000, 190, 10);
  assert.equal(geometry.centeredOffset(9000, 1000), 1799595);
  assert.equal(geometry.revealedOffset(5001, 1000000, 1000), 1000000);
  assert.equal(geometry.revealedOffset(5005, 1000000, 1000), 1000190);
  assert.equal(geometry.revealedOffset(4999, 1000000, 1000), 999800);
});

test("large rails create only window cards and preserve full scrolling width", () => {
  const fixture = railFixture(LayoutRoot, 10000);
  const { layout, rail, source, card, cards, demands } = fixture;
  layout.preferences.features.silentRailLoading = false;
  layout.renderRail(source, true);
  assert.equal(cards().length, 8);
  assert.equal(card(0).style.left, "0px");
  assert.equal(fixture.more().style.left, "2000000px");
  rail.scrollLeft = 1000012;
  layout.renderRailWindow();
  assert.equal(cards().length, 11);
  assert.equal(card(0), undefined);
  assert.equal(card(5000).style.left, "1000000px");
  assert.equal(demands.at(-1)[0], source.items[5000]);
  assert.ok(demands.at(-1).every((item) => source.items.indexOf(item) >= 4997));
});

test("silent loading renders a skeleton sentinel instead of Show more", () => {
  const fixture = railFixture(LayoutRoot, 80);
  const { layout, rail, source } = fixture;
  layout.renderRail(source, true);
  const tail = rail.querySelector(".bibilili-source-tail");
  assert.ok(tail);
  assert.equal(tail.dataset.bibililiRailSentinel, "true");
  assert.equal(tail.dataset.state, "ready");
  assert.equal(tail.disabled, true);
  assert.equal(tail.style.left, "16000px");
  assert.ok(tail.querySelector(".bibilili-source-tail-skeleton"));
  assert.equal(rail.querySelector(".bibilili-source-more-button"), null);

  layout.renderRail({ ...source, pagination: { hasMore: false, status: "ready" } }, true);
  assert.equal(rail.querySelector(".bibilili-source-tail"), null);
});

test("silent loading requests one continuation near the tail", async () => {
  const fixture = railFixture(LayoutRoot, 80);
  const { layout, rail, source } = fixture;
  const calls = [];
  let resolveRequest;
  const pending = new Promise((resolve) => { resolveRequest = resolve; });
  layout.onSourceMore = (kind) => {
    calls.push(kind);
    return pending;
  };
  layout.renderRail(source, true);
  rail.scrollLeft = 1e9;
  layout.renderRailWindow();
  await flushAsync();
  assert.deepEqual(calls, [SourceKind.HISTORY]);
  layout.renderRailWindow();
  await flushAsync();
  assert.equal(calls.length, 1);
  resolveRequest();
  await pending;
  await flushAsync();
  assert.equal(layout.railAutoLoadKey, null);
});

test("a silent continuation without new cards falls back to Show more", async () => {
  const fixture = railFixture(LayoutRoot, 80);
  const { layout, rail, source } = fixture;
  let calls = 0;
  layout.onSourceMore = async () => {
    calls += 1;
    return 80;
  };
  layout.renderRail(source, true);
  rail.scrollLeft = 1e9;
  layout.renderRailWindow();
  await flushAsync();
  assert.equal(layout.railAutoLoadStalledKey, SourceKind.HISTORY);

  layout.renderRailWindow();
  assert.equal(rail.querySelector(".bibilili-source-tail"), null);
  assert.ok(fixture.more());
  layout.renderRailWindow();
  await flushAsync();
  assert.equal(calls, 1);
});

test("a silent continuation that adds cards keeps the skeleton tail", async () => {
  const fixture = railFixture(LayoutRoot, 80);
  const { layout, rail, source } = fixture;
  layout.onSourceMore = async () => 81;
  layout.renderRail(source, true);
  rail.scrollLeft = 1e9;
  layout.renderRailWindow();
  await flushAsync();
  assert.equal(layout.railAutoLoadStalledKey, null);
  assert.ok(rail.querySelector(".bibilili-source-tail"));
  assert.equal(rail.querySelector(".bibilili-source-more-button"), null);
});

test("switching sources resets a stalled silent continuation", async () => {
  const fixture = railFixture(LayoutRoot, 80);
  const { layout, rail, source } = fixture;
  layout.onSourceMore = async () => 80;
  layout.renderRail(source, true);
  rail.scrollLeft = 1e9;
  layout.renderRailWindow();
  await flushAsync();
  assert.equal(layout.railAutoLoadStalledKey, SourceKind.HISTORY);

  layout.renderRail({ ...source, kind: SourceKind.WATCH_LATER }, true);
  assert.equal(layout.railAutoLoadStalledKey, null);
});

test("manual progress clears a stalled silent continuation", async () => {
  const fixture = railFixture(LayoutRoot, 80);
  const { layout, rail, source } = fixture;
  layout.onSourceMore = async () => 80;
  layout.renderRail(source, true);
  rail.scrollLeft = 1e9;
  layout.renderRailWindow();
  await flushAsync();
  assert.equal(layout.railAutoLoadStalledKey, SourceKind.HISTORY);

  layout.renderRailWindow();
  const button = fixture.more();
  layout.onSourceMore = async () => 90;
  await layout.handleSourceMoreClick(SourceKind.HISTORY, button, { detail: 1 });
  assert.equal(layout.railAutoLoadStalledKey, null);
  layout.renderRailWindow();
  assert.ok(rail.querySelector(".bibilili-source-tail"));
  assert.equal(rail.querySelector(".bibilili-source-more-button"), null);
});

test("silent loading waits while the visible window is far from the tail", async () => {
  const fixture = railFixture(LayoutRoot, 80);
  const { layout, source } = fixture;
  const calls = [];
  layout.onSourceMore = async (kind) => { calls.push(kind); };
  layout.renderRail(source, true);
  await flushAsync();
  assert.deepEqual(calls, []);
  assert.equal(layout.railAutoLoadKey, null);
});

test("a closed rail does not start silent loading", async () => {
  const fixture = railFixture(LayoutRoot, 80);
  const { layout, rail, source } = fixture;
  const calls = [];
  layout.onSourceMore = async (kind) => { calls.push(kind); };
  layout.renderRail(source, true);
  rail.scrollLeft = 1e9;
  layout.isRailOpen = false;
  layout.renderRailWindow();
  await flushAsync();
  assert.deepEqual(calls, []);
});

test("disabling silent loading keeps the explicit continuation button", () => {
  const fixture = railFixture(LayoutRoot, 80);
  const { layout, rail, source } = fixture;
  layout.preferences.features.silentRailLoading = false;
  layout.renderRail(source, true);
  assert.ok(fixture.more());
  assert.equal(rail.querySelector(".bibilili-source-tail"), null);
});

test("a failed silent continuation exposes one retry action", async () => {
  const fixture = railFixture(LayoutRoot, 80);
  const { layout, rail, source } = fixture;
  const calls = [];
  layout.onSourceMore = async (kind) => { calls.push(kind); };
  layout.renderRail({ ...source, pagination: { hasMore: true, status: "error" } }, true);
  const tail = rail.querySelector(".bibilili-source-tail");
  assert.equal(tail.dataset.state, "error");
  assert.equal(tail.disabled, false);
  assert.equal(tail.getAttribute("aria-hidden"), null);

  rail.scrollLeft = 1e9;
  layout.renderRailWindow();
  await flushAsync();
  assert.deepEqual(calls, []);

  tail.dispatch("click");
  await flushAsync();
  assert.deepEqual(calls, [SourceKind.HISTORY]);
});

test("a source switch cancels a queued silent continuation", async () => {
  const fixture = railFixture(LayoutRoot, 80);
  const { layout, rail, source } = fixture;
  const calls = [];
  layout.onSourceMore = async (kind) => { calls.push(kind); };
  layout.renderRail(source, true);
  rail.scrollLeft = 1e9;
  layout.renderRailWindow();
  layout.renderRail({ ...source, kind: SourceKind.WATCH_LATER }, true);
  await flushAsync();
  assert.deepEqual(calls, []);
  assert.equal(layout.railAutoLoadKey, null);
});

test("silent watch-later continuation reveals cached items without a request", async (t) => {
  const fixture = await watchLaterRailFixture(t, -1);
  const { layout, store, requests, rail } = fixture;
  layout.preferences.features.silentRailLoading = true;
  layout.onSourceMore = async (kind) => {
    await store.loadMore(kind);
    layout.renderRail(store.currentSource(kind), false);
  };
  layout.renderRail(store.currentSource(SourceKind.WATCH_LATER), true);
  rail.scrollLeft = 1e9;
  layout.renderRailWindow();
  await flushAsync();
  assert.equal(store.currentSource(SourceKind.WATCH_LATER).items.length, 110);
  assert.equal(requests.length, 2);
});

test("current-video positioning renders the destination without intermediate cards", () => {
  const fixture = railFixture(LayoutRoot, 10000, SourceKind.WATCH_LATER);
  fixture.source.items[9000].targetUrl = global.location.href;
  fixture.layout.renderRail(fixture.source, true);
  assert.equal(fixture.card(9000).isCurrent, true);
  assert.equal(fixture.rail.scrollLeft, 1799607);
  assert.ok(fixture.created.length <= 12);
  assert.ok(fixture.created.every((card) => Number(card.dataset.bibililiCardIndex) > 8990));

  fixture.rail.scrollLeft = 0;
  fixture.layout.renderRail(fixture.source, false);
  assert.equal(fixture.rail.scrollLeft, 0);
});

test("Locate jumps to a cached current item in a large rail without rebuilding entries", () => {
  for (const kind of [SourceKind.PARTS, SourceKind.COLLECTION, SourceKind.WATCH_LATER, SourceKind.HISTORY]) {
    const { layout, source, rail, created, card } = railFixture(LayoutRoot, 10000, kind);
    layout.createRailLocate();
    source.items[9000].targetUrl = global.location.href;
    layout.renderRail(source, true);
    if (kind === SourceKind.HISTORY) assert.equal(rail.scrollLeft, 0);
    rail.scrollLeft = 0;
    layout.renderRailWindow();
    const entries = layout.railEntries;
    created.length = 0;

    assert.equal(layout.railLocateButton.disabled, false);
    layout.locateCurrentRailItem();
    assert.equal(layout.railEntries, entries);
    assert.equal(rail.scrollLeft, 1799607);
    assert.ok(card(9000));
    assert.ok(created.length <= 12);
    assert.ok(created.every((node) => Number(node.dataset.bibililiCardIndex) > 8990));
  }
});

test("Locate disables for absent videos and closed rails", () => {
  const { layout, source, rail } = railFixture(LayoutRoot, 100, SourceKind.HISTORY);
  layout.createRailLocate();
  source.items[90].targetUrl = global.location.href;
  layout.renderRail(source, true);
  assert.equal(layout.railLocateButton.disabled, false);
  assert.equal(layout.railLocateIndex, 90);
  layout.locateCurrentRailItem();
  assert.ok(rail.scrollLeft > 0);

  layout.isRailOpen = false;
  layout.renderSourceDock([source], null);
  assert.equal(layout.railLocateButton.disabled, true);
  assert.equal(layout.railLocateIndex, -1);

  layout.isRailOpen = true;
  layout.renderRail({ ...source, items: source.items.slice(0, 80) }, true);
  assert.equal(layout.railLocateButton.disabled, true);
});

test("Locate accepts a collection current marker and preserves control placement", () => {
  const { layout, source, document } = railFixture(LayoutRoot, 100, SourceKind.COLLECTION);
  const actions = document.createElement("div");
  layout.sourceBar.append(actions);
  layout.createRailControls();
  layout.sourceBar.append(layout.railActionGroup);
  source.items[90].isCurrent = true;
  layout.renderSourceDock([source], null);
  const button = layout.railLocateButton;
  assert.equal(button.disabled, false);
  assert.equal(layout.railLocateIndex, 90);
  assert.equal(actions.nextSibling, layout.railActionGroup);
  assert.equal(layout.railActionGroup.firstChild, button);
  assert.equal(button.nextSibling, layout.railStartButton);
  assert.equal(layout.railStartButton.nextSibling, layout.railRefreshButton);
  assert.equal(layout.railRefreshButton.nextSibling, layout.railSearchButton);
  layout.renderSourceDock([source], null);
  assert.equal(layout.railLocateButton, button);
  assert.equal(actions.nextSibling, layout.railActionGroup);
  assert.equal(button.nextSibling, layout.railStartButton);
  assert.equal(layout.railStartButton.nextSibling, layout.railRefreshButton);
  assert.equal(layout.railRefreshButton.nextSibling, layout.railSearchButton);
});

test("Search is enabled only for an open rail with valid source items", () => {
  const { layout, source } = railFixture(LayoutRoot, 3, SourceKind.HISTORY);
  layout.createRailControls();
  layout.isRailOpen = true;
  layout.renderSourceDock([source], null);

  assert.equal(layout.railSearchButton.disabled, false);
  assert.equal(layout.railSearchButton.getAttribute("aria-haspopup"), "dialog");
  assert.equal(layout.railSearchButton.getAttribute("aria-expanded"), "false");
  assert.equal(layout.railSearchButton.getAttribute("aria-controls"), "bibilili-browse-panel");
  assert.equal(
    layout.railSearchButton.getAttribute("aria-label"),
    UiStrings.message(UiMessage.RAIL_SEARCH_LABEL, "en")
  );

  layout.isRailOpen = false;
  layout.renderSourceDock([source], null);
  assert.equal(layout.railSearchButton.disabled, true);

  layout.isRailOpen = true;
  layout.renderRailActions(true, { ...source, items: [] });
  assert.equal(layout.railSearchButton.disabled, true);
});

test("Search opens the browse panel and closes it when the rail or source changes", () => {
  const { layout, source, document } = railFixture(LayoutRoot, 3, SourceKind.HISTORY);
  layout.createRailControls();
  layout.browsePanel = new BrowsePanel(document, layout.sourceBar, {
    onClose: () => layout.railSearchButton.setAttribute("aria-expanded", "false"),
    onFocusFallback: () => layout.focusBrowseFallback()
  });
  layout.isRailOpen = true;
  layout.renderSourceDock([source], null);

  assert.equal(layout.railSearchButton.getAttribute("aria-controls"), layout.browsePanel.panel.id);
  layout.railSearchButton.dispatch("click");
  assert.equal(layout.browsePanel.isOpen, true);
  assert.equal(layout.railSearchButton.getAttribute("aria-expanded"), "true");
  assert.equal(layout.browsePanel.title.textContent,
    UiStrings.sourceLabel(SourceKind.HISTORY, "en"));

  layout.browsePanel.handleKeydown({
    key: "Escape",
    isComposing: false,
    preventDefault() {},
    stopPropagation() {}
  });
  assert.equal(layout.browsePanel.isOpen, false);
  assert.equal(layout.railSearchButton.getAttribute("aria-expanded"), "false");

  layout.railSearchButton.dispatch("click");
  layout.isRailOpen = false;
  layout.renderSourceDock([source], null);
  assert.equal(layout.browsePanel.isOpen, false);
  assert.equal(layout.railSearchButton.getAttribute("aria-expanded"), "false");

  layout.isRailOpen = true;
  layout.renderSourceDock([source], null);
  layout.railSearchButton.dispatch("click");
  layout.selectedSourceKind = SourceKind.COLLECTION;
  layout.renderSourceDock([{ ...source, kind: SourceKind.COLLECTION }], null);
  assert.equal(layout.browsePanel.isOpen, false);
});

test("Back to start refreshes the selected list once", async () => {
  const { layout, source, rail, card } = railFixture(LayoutRoot, 100);
  layout.createRailControls();
  layout.renderSourceDock([source], null);
  rail.scrollLeft = 8000;
  let finish;
  let requests = 0;
  layout.onRailRefresh = async (selected) => {
    assert.equal(selected, source);
    requests += 1;
    await new Promise((resolve) => { finish = resolve; });
    const updated = { ...source, items: source.items.map((item) => ({ ...item, title: `${item.title} updated` })) };
    layout.currentSources = [updated];
    layout.renderSourceDock([updated], null);
  };

  layout.railStartButton.dispatch("click");
  assert.equal(rail.scrollLeft, 0);
  assert.equal(requests, 1);
  assert.equal(layout.railRefreshButton.disabled, true);
  layout.railStartButton.dispatch("click");
  await layout.refreshCurrentRail();
  assert.equal(requests, 1, "Start and Refresh share the pending request");
  finish();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(rail.scrollLeft, 0);
  assert.equal(card(0).renderedItem.title, "Video 1 updated");
  assert.equal(layout.selectedSourceKind, source.kind);
  assert.equal(layout.railRefreshButton.disabled, false);
});

test("Back to start only scrolls when refresh is disabled and ignores a closed rail", () => {
  const { layout, source, rail, card } = railFixture(LayoutRoot, 100);
  layout.createRailControls();
  layout.renderSourceDock([source], null);
  let requests = 0;
  layout.onRailRefresh = async () => { requests += 1; };
  layout.preferences.features.refreshRailOnStart = false;
  rail.scrollLeft = 8000;
  layout.railStartButton.dispatch("click");
  assert.equal(rail.scrollLeft, 0);
  assert.equal(requests, 0);
  assert.equal(card(0).renderedItem, source.items[0]);
  assert.equal(layout.railSource.items.length, 100);

  layout.preferences.features.refreshRailOnStart = true;
  rail.scrollLeft = 8000;
  layout.isRailOpen = false;
  layout.renderSourceDock([source], null);
  assert.equal(layout.railStartButton.disabled, true);
  layout.scrollRailToStart();
  assert.equal(requests, 0);
});

test("opening and reopening watch later reveals the cached current batch before rendering", async (t) => {
  const fixture = await watchLaterRailFixture(t);
  const { layout, store, rail, card, cards, created, demands, requests, reveals } = fixture;
  layout.renderSourceDock(layout.currentSources, {});
  assert.equal(reveals(), 0);
  assert.equal(store.currentSource(SourceKind.WATCH_LATER).items.length, 80);
  created.length = 0;
  demands.length = 0;

  layout.handleSourceButtonClick(SourceKind.WATCH_LATER);
  assert.equal(store.currentSource(SourceKind.WATCH_LATER).items.length, 200);
  assert.equal(layout.railSource.items.length, 200);
  assert.equal(card(190).isCurrent, true);
  const centeredScrollLeft = rail.scrollLeft;
  assert.ok(centeredScrollLeft > 37000);
  assert.ok(cards().length <= 12);
  assert.ok(created.every((card) => Number(card.dataset.bibililiCardIndex) > 180));
  assert.ok(demands.flat().every((item) => Number(item.watchLaterAid) > 180));
  assert.equal(reveals(), 1);
  assert.equal(requests.length, 2);

  rail.scrollLeft = 2012;
  layout.renderRailWindow();
  const retainedCard = card(10);
  layout.setSources(store.currentSources(), false, {}, null);
  assert.equal(rail.scrollLeft, 2012);
  assert.equal(card(10), retainedCard);
  assert.equal(reveals(), 1);

  layout.handleSourceButtonClick(SourceKind.WATCH_LATER);
  assert.equal(layout.isRailOpen, false);
  assert.deepEqual(demands.at(-1), []);
  assert.equal(reveals(), 1);
  layout.handleSourceButtonClick(SourceKind.WATCH_LATER);
  assert.equal(rail.scrollLeft, centeredScrollLeft);
  assert.equal(card(190).isCurrent, true);
  assert.equal(reveals(), 2);
  assert.equal(requests.length, 2);
});

test("opening watch later with no cached match keeps its initial batch", async (t) => {
  const { layout, store, rail, cards, requests } = await watchLaterRailFixture(t, -1);
  layout.handleSourceButtonClick(SourceKind.WATCH_LATER);
  assert.equal(store.currentSource(SourceKind.WATCH_LATER).items.length, 80);
  assert.equal(rail.scrollLeft, 0);
  assert.ok(cards().every((card) => !card.isCurrent));
  assert.equal(requests.length, 2);
});

test("account-source arrival reveals the target while preserving earlier manual scrolling", async (t) => {
  const fixture = await watchLaterRailFixture(t);
  const { layout, store, document, rail, card, requests, reveals } = fixture;
  const nativeSource = {
    ...fixture.source,
    root: document.createElement("section"),
    items: [fixture.source.items[190], ...fixture.source.items.slice(0, 79)]
  };
  layout.currentSources = [nativeSource];
  layout.selectedSourceKind = SourceKind.WATCH_LATER;
  layout.renderSourceDock(layout.currentSources, {});
  assert.equal(reveals(), 0);
  rail.scrollLeft = 2012;
  layout.renderRailWindow();

  layout.setSources(store.currentSources(), false, {}, null);
  assert.equal(layout.railSource.root, null);
  assert.equal(layout.railSource.items.length, 200);
  assert.equal(rail.scrollLeft, 2012);
  assert.equal(reveals(), 1);
  layout.handleSourceButtonClick(SourceKind.WATCH_LATER);
  layout.handleSourceButtonClick(SourceKind.WATCH_LATER);
  assert.equal(card(190).isCurrent, true);
  assert.ok(rail.scrollLeft > 37000);
  assert.equal(requests.length, 2);
});

test("focused and pressed cards stay mounted without retaining the intervening list", () => {
  const { layout, rail, document, source, card, cards, demands } = railFixture(LayoutRoot, 10000);
  layout.renderRail(source, true);
  const focused = card(0);
  const pressed = card(1);
  const link = focused.querySelector(".bibilili-card-link");
  link.focus();
  layout.railPointerCard = pressed;
  rail.scrollLeft = 1000012;
  layout.renderRailWindow();
  assert.equal(card(0), focused);
  assert.equal(card(1), pressed);
  assert.equal(document.activeElement, link);
  assert.equal(cards().length, 13);
  assert.ok(!demands.at(-1).includes(source.items[0]));

  document.activeElement = document.body;
  layout.railPointerCard = null;
  layout.renderRailWindow();
  assert.equal(cards().length, 11);
  assert.equal(focused.isConnected, false);
  assert.equal(pressed.isConnected, false);
});

test("small scrolls reuse card and link identity without dropping focus", () => {
  const { layout, rail, document, source, card } = railFixture(LayoutRoot, 80);
  layout.renderRail(source, true);
  const retained = card(4);
  const link = retained.querySelector(".bibilili-card-link");
  link.focus();
  rail.scrollLeft = 812;
  layout.renderRailWindow();
  assert.equal(card(4), retained);
  assert.equal(document.activeElement, link);
  assert.equal(card(0), undefined);
});

test("responsive card dimensions preserve the same logical scroll position", () => {
  const { layout, rail, document, source, card } = railFixture(LayoutRoot, 10000);
  layout.renderRail(source, true);
  rail.scrollLeft = 1000012;
  layout.renderRailWindow();
  document.cardWidth = 168;
  rail.clientWidth = 800;
  layout.renderRailWindow();
  assert.equal(rail.scrollLeft, 890012);
  assert.equal(card(5000).style.left, "890000px");
});

test("Tab crosses a virtual gap to the adjacent logical card", () => {
  const { layout, rail, document, source, card } = railFixture(LayoutRoot, 10000);
  layout.renderRail(source, true);
  const link = card(0).querySelector(".bibilili-card-link");
  link.focus();
  rail.scrollLeft = 1000012;
  layout.renderRailWindow();
  let prevented = false;
  layout.handleRailKeydown({
    key: "Tab", target: link, shiftKey: false,
    preventDefault() { prevented = true; }
  });
  assert.equal(prevented, true);
  assert.equal(document.activeElement, card(1).querySelector(".bibilili-card-link"));
  assert.ok(rail.scrollLeft <= 212);
});

test("keyboard expansion focuses the first appended card and keeps the scroll position", async () => {
  const fixture = railFixture(LayoutRoot, 110);
  const { layout, rail, document, card } = fixture;
  layout.preferences.features.silentRailLoading = false;
  const initial = { ...fixture.source, items: fixture.source.items.slice(0, 80) };
  layout.renderRail(initial, true);
  rail.scrollLeft = 100000;
  layout.renderRailWindow();
  const scrollLeft = rail.scrollLeft;
  const button = fixture.more();
  button.focus();
  layout.onSourceMore = async () => layout.renderRail(fixture.source, false);
  await layout.handleSourceMoreClick(SourceKind.HISTORY, button, { detail: 0 });
  assert.equal(document.activeElement, card(80).querySelector(".bibilili-card-link"));
  assert.equal(rail.scrollLeft, scrollLeft);
  assert.equal(fixture.more(), button);
});

test("exhausted continuation moves keyboard focus before removing its button", async () => {
  const fixture = railFixture(LayoutRoot, 80);
  const { layout, source, document, card } = fixture;
  layout.preferences.features.silentRailLoading = false;
  layout.renderRail(source, true);
  const button = fixture.more();
  button.focus();
  layout.onSourceMore = async () => layout.renderRail({
    ...source, pagination: { hasMore: false, status: "ready" }
  }, false);
  await layout.handleSourceMoreClick(source.kind, button, { detail: 0 });
  assert.equal(button.isConnected, false);
  assert.equal(document.activeElement, card(79).querySelector(".bibilili-card-link"));
});

test("closing the rail releases its cards and preview demand", () => {
  const { layout, source, cards, demands } = railFixture(LayoutRoot, 10000);
  layout.renderRail(source, true);
  layout.isRailOpen = false;
  layout.renderSourceDock([source], null);
  assert.equal(cards().length, 0);
  assert.deepEqual(demands.at(-1), []);
  assert.equal(layout.railSource, null);
});
