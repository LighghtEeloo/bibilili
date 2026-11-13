const assert = require("node:assert/strict");
const test = require("node:test");
const { loadContentRuntime } = require("./helpers/content-runtime.js");
const { RailElement } = require("./helpers/rail-dom.js");

const {
  BrowseDateGrouping,
  BrowseGrid,
  BrowsePanel,
  BrowseRowLayout
} = loadContentRuntime();
const { UiMessage, UiStrings } = global.__bibililiI18n;

function browseFixture(options = {}) {
  const document = {
    addEventListener() {},
    removeEventListener() {},
    createElement: (tagName) => new RailElement(document, tagName),
    createElementNS: (_namespace, tagName) => new RailElement(document, tagName)
  };
  document.body = document.createElement("body");
  document.activeElement = document.body;
  const root = document.createElement("div");
  document.body.append(root);
  return { document, root, panel: new BrowsePanel(document, root, options) };
}

function keyEvent(key, overrides = {}) {
  return {
    key,
    shiftKey: false,
    isComposing: false,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    defaultPrevented: false,
    propagationStopped: false,
    preventDefault() { this.defaultPrevented = true; },
    stopPropagation() { this.propagationStopped = true; },
    ...overrides
  };
}

function itemCount(count) {
  return UiStrings.message(UiMessage.BROWSE_ITEM_COUNT_LABEL, "en", [String(count)]);
}

function localTime(day, hour = 12) {
  return new Date(2026, 10, day, hour).getTime();
}

function browseSource(count, overrides = {}) {
  const items = Array.from({ length: count }, (_, index) => ({
    targetUrl: "https://www.bilibili.com/video/BV" + (index + 1),
    title: "Video " + (index + 1),
    author: "Author " + (index + 1),
    timestamp: localTime(12) - index * 1000
  }));
  return {
    kind: "history",
    root: null,
    items,
    pagination: { hasMore: false, status: "ready" },
    ...overrides
  };
}

function cardHost(document, requestMore = null) {
  const host = {
    created: [],
    demands: [],
    requestMoreCalls: 0,
    keyFor(item, keyCounts) {
      const base = "route:" + item.targetUrl;
      const count = keyCounts.get(base) ?? 0;
      keyCounts.set(base, count + 1);
      return count === 0 ? base : base + "\n" + (count + 1);
    },
    isCurrent: () => false,
    hydrate: (item) => item,
    create(item, isCurrent, key, sourceKind) {
      const card = document.createElement("span");
      card.className = "bibilili-video-card";
      const link = document.createElement("a");
      link.className = "bibilili-card-link";
      link.href = item.targetUrl;
      const button = document.createElement("button");
      button.className = "bibilili-card-watch-later-button";
      button.hidden = sourceKind !== "watch_later";
      card.append(link, button);
      host.update(card, item, isCurrent, key, sourceKind);
      host.created.push(card);
      return card;
    },
    update(card, item, isCurrent, key, sourceKind) {
      card.dataset.bibililiCardKey = key;
      card.dataset.bibililiCardSourceKind = sourceKind;
      card.renderedItem = item;
      card.isCurrent = isCurrent;
    },
    setDemand(items) {
      host.demands.push(items);
    }
  };
  if (requestMore) {
    host.requestMore = async (source) => {
      host.requestMoreCalls += 1;
      return requestMore(source);
    };
  }
  return host;
}

test("browse date groups follow source order and collect undated items", () => {
  const now = new Date(2026, 10, 12, 12);
  const items = [
    { title: "old", timestamp: localTime(10) },
    { title: "today", timestamp: localTime(12) },
    { title: "undated" },
    { title: "yesterday", timestamp: localTime(11) },
    { title: "old again", timestamp: localTime(10) }
  ];
  const sections = BrowseDateGrouping.build(items, "en", now);

  assert.deepEqual(sections.map((section) => section.items.map((item) => item.title)), [
    ["old", "old again"],
    ["today", "undated"],
    ["yesterday"]
  ]);
  assert.equal(sections[0].label, new Intl.DateTimeFormat("en", {
    month: "short", day: "numeric"
  }).format(new Date(localTime(10))));
  assert.equal(sections[1].label, UiStrings.message(UiMessage.BROWSE_TODAY_LABEL, "en"));
  assert.equal(sections[2].label, UiStrings.message(UiMessage.BROWSE_YESTERDAY_LABEL, "en"));

  const leading = BrowseDateGrouping.build([
    { title: "leading" },
    { title: "dated", timestamp: localTime(12) },
    { title: "late" }
  ], "en", now);
  assert.deepEqual(leading.map((section) => section.items.map((item) => item.title)), [
    ["leading", "dated", "late"]
  ]);

  const undated = BrowseDateGrouping.build([{ title: "only" }], "en", now);
  assert.equal(undated.length, 1);
  assert.equal(undated[0].label, UiStrings.message(UiMessage.BROWSE_ALL_ITEMS_LABEL, "en"));
});

test("browse row layout maps entries to fixed header and card rows", () => {
  const layout = new BrowseRowLayout({
    sections: [{ key: "day", label: "Today", items: [1, 2, 3, 4, 5] }],
    columns: 3,
    cardHeight: 126,
    headerHeight: 30,
    emptyHeight: 96,
    gap: 10
  });

  assert.deepEqual(layout.rows.map((row) => row.kind), ["header", "cards", "cards"]);
  assert.deepEqual(layout.entryRowIndexes, [1, 1, 1, 2, 2]);
  assert.equal(layout.rows[1].entryStart, 0);
  assert.equal(layout.rows[1].entryEnd, 3);
  assert.equal(layout.rows[2].entryStart, 3);
  assert.equal(layout.rowIndexAt(0), 0);
  assert.equal(layout.rowIndexAt(40), 1);
  assert.equal(layout.rowIndexAt(176), 2);
  assert.equal(layout.rowIndexAt(999), 2);
  assert.equal(layout.totalHeight, 302);

  const empty = new BrowseRowLayout({
    sections: [],
    columns: 3,
    cardHeight: 126,
    headerHeight: 30,
    emptyHeight: 96,
    gap: 10
  });
  assert.deepEqual(empty.rows.map((row) => row.kind), ["empty"]);

  const tailed = new BrowseRowLayout({
    sections: [{ key: "day", label: "Today", items: [1] }],
    columns: 3,
    cardHeight: 126,
    headerHeight: 30,
    emptyHeight: 96,
    gap: 10,
    tailHeight: 126
  });
  assert.deepEqual(tailed.rows.map((row) => row.kind), ["header", "cards", "tail"]);
});

test("browse row layout keeps entry ranges global across sections", () => {
  const layout = new BrowseRowLayout({
    sections: [
      { key: "day", label: "Today", items: [1, 2, 3] },
      { key: "prev", label: "Yesterday", items: [4, 5] }
    ],
    columns: 2,
    cardHeight: 126,
    headerHeight: 30,
    emptyHeight: 96,
    gap: 10
  });

  assert.deepEqual(
    layout.rows.map((row) => [row.kind, row.entryStart ?? null, row.entryEnd ?? null]),
    [
      ["header", null, null],
      ["cards", 0, 2],
      ["cards", 2, 3],
      ["header", null, null],
      ["cards", 3, 5]
    ]
  );
  assert.deepEqual(layout.entryRowIndexes, [1, 1, 2, 4, 4]);
});

test("browse panel opens as a modal sheet and restores the launcher", () => {
  const { document, panel } = browseFixture();
  const anchor = document.createElement("button");
  document.body.append(anchor);

  assert.equal(panel.isOpen, false);
  assert.equal(panel.panel.getAttribute("aria-hidden"), "true");
  assert.equal(panel.panel.getAttribute("inert"), "");
  assert.equal(panel.panel.dataset.open, "false");
  assert.equal(panel.scrim.dataset.open, "false");

  panel.open({ anchor, title: "History", count: 12, language: "en" });

  assert.equal(panel.isOpen, true);
  assert.equal(panel.panel.dataset.open, "true");
  assert.equal(panel.scrim.dataset.open, "true");
  assert.equal(panel.panel.getAttribute("aria-hidden"), "false");
  assert.equal(panel.panel.getAttribute("inert"), null);
  assert.equal(panel.title.textContent, "History");
  assert.equal(panel.count.textContent, itemCount(12));
  assert.equal(panel.searchInput.getAttribute("aria-controls"), "bibilili-browse-grid");
  assert.equal(document.activeElement, panel.searchInput);

  panel.close(true);
  assert.equal(panel.isOpen, false);
  assert.equal(panel.panel.dataset.open, "false");
  assert.equal(panel.scrim.dataset.open, "false");
  assert.equal(panel.panel.getAttribute("aria-hidden"), "true");
  assert.equal(document.activeElement, anchor);
});

test("browse panel traps Tab and clears a query before closing", () => {
  const { document, panel } = browseFixture();
  const anchor = document.createElement("button");
  document.body.append(anchor);
  panel.open({ anchor, title: "History", count: 3, language: "en" });

  const tab = keyEvent("Tab", { target: panel.searchInput });
  panel.handleKeydown(tab);
  assert.equal(tab.defaultPrevented, true);
  assert.equal(document.activeElement, panel.closeButton);

  const shiftTab = keyEvent("Tab", { shiftKey: true, target: panel.closeButton });
  panel.handleKeydown(shiftTab);
  assert.equal(shiftTab.defaultPrevented, true);
  assert.equal(document.activeElement, panel.searchInput);

  panel.searchInput.value = "cut";
  const firstEscape = keyEvent("Escape", { target: panel.searchInput });
  panel.handleKeydown(firstEscape);
  assert.equal(panel.searchInput.value, "");
  assert.equal(panel.isOpen, true);
  assert.equal(firstEscape.defaultPrevented, true);
  assert.equal(document.activeElement, panel.searchInput);

  const secondEscape = keyEvent("Escape", { target: panel.searchInput });
  panel.handleKeydown(secondEscape);
  assert.equal(panel.isOpen, false);
  assert.equal(document.activeElement, anchor);
});

test("browse panel dismisses from the scrim and falls back without a launcher", () => {
  let closes = 0;
  let fallbacks = 0;
  const { document, root, panel } = browseFixture({
    onClose: () => { closes += 1; },
    onFocusFallback: () => { fallbacks += 1; }
  });
  const anchor = document.createElement("button");

  panel.open({ anchor, title: "History", count: 1, language: "en" });
  panel.closeButton.focus();
  panel.scrim.dispatch("click");
  assert.equal(panel.isOpen, false);
  assert.equal(closes, 1);

  panel.open({ anchor, title: "History", count: 1, language: "en" });
  panel.close(true);
  assert.equal(closes, 2);
  assert.equal(fallbacks, 1);

  panel.destroy();
  assert.equal(root.children.length, 0);
});

test("browse panel updates its header without changing focus", () => {
  const { document, panel } = browseFixture();
  const anchor = document.createElement("button");
  document.body.append(anchor);
  panel.open({ anchor, title: "History", count: 3, language: "en" });
  const focused = document.activeElement;

  panel.update({ title: "Favorites · Watch", count: 5, language: "en" });

  assert.equal(panel.isOpen, true);
  assert.equal(panel.title.textContent, "Favorites · Watch");
  assert.equal(panel.count.textContent, itemCount(5));
  assert.equal(document.activeElement, focused);
});

test("browse panel clears its query and scroll for a new page session", () => {
  const { document, panel } = browseFixture();
  const host = cardHost(document);
  panel.cardHost = host;
  panel.grid.cardHost = host;
  panel.grid.measure = () => ({ width: 410, height: 300, cardWidth: 190, cardHeight: 126, gap: 10 });

  const source = browseSource(4);
  panel.open({ title: "History", count: 4, language: "en", source });
  panel.searchInput.value = "video 1";
  panel.searchInput.dispatch("input");
  assert.equal(panel.filteredCount, 1);

  panel.grid.root.scrollTop = 120;
  panel.resetSession();

  assert.equal(panel.isOpen, false);
  assert.equal(panel.query, "");
  assert.equal(panel.searchInput.value, "");
  assert.equal(panel.grid.data, null);
  assert.equal(panel.grid.root.scrollTop, 0);
  assert.equal(panel.count.textContent, itemCount(0));

  panel.open({ title: "History", count: 4, language: "en", source });
  assert.equal(panel.query, "");
  assert.equal(panel.filteredCount, 4);
  assert.equal(panel.count.textContent, itemCount(4));
});

test("browse grid virtualizes date rows and tails a pending continuation", () => {
  const { document, panel } = browseFixture();
  const host = cardHost(document);
  const grid = panel.grid;
  panel.cardHost = host;
  grid.cardHost = host;
  grid.measure = () => ({ width: 610, height: 300, cardWidth: 190, cardHeight: 126, gap: 10 });

  const source = browseSource(20, {
    pagination: { hasMore: true, status: "loading" }
  });
  panel.open({ title: "History", count: 20, language: "en", source });

  assert.equal(grid.columns, 3);
  assert.equal(panel.filteredCount, 20);
  assert.equal(host.created.length < 20, true);
  assert.equal(host.created.length > 0, true);
  const cardRows = grid.root.querySelectorAll(".bibilili-browse-cards-row").length;
  assert.equal(cardRows > 0, true);
  assert.equal(cardRows < 7, true);
  assert.equal(
    grid.root.querySelector(".bibilili-browse-date-count").textContent,
    "20"
  );

  grid.root.scrollTop = 10000;
  grid.render();
  const tail = grid.root.querySelector(".bibilili-browse-tail");
  assert.equal(tail.dataset.state, "loading");
  assert.equal(tail.disabled, true);
  assert.ok(tail.querySelector(".bibilili-source-tail-skeleton"));
  assert.equal(host.created.length < 20, true);
});

test("browse grid reports tail errors and keeps local filtering current", () => {
  const { document, panel } = browseFixture();
  const host = cardHost(document, async () => 2);
  panel.cardHost = host;
  panel.grid.cardHost = host;
  panel.grid.measure = () => ({ width: 610, height: 300, cardWidth: 190, cardHeight: 126, gap: 10 });

  const source = browseSource(2, {
    pagination: { hasMore: true, status: "loading" }
  });
  panel.open({ title: "History", count: 2, language: "en", source });
  let tail = panel.grid.root.querySelector(".bibilili-browse-tail");
  assert.equal(tail.dataset.state, "loading");

  const failed = {
    ...source,
    pagination: { hasMore: true, status: "error" }
  };
  panel.update({ title: "History", count: 2, language: "en", source: failed });
  tail = panel.grid.root.querySelector(".bibilili-browse-tail");
  assert.equal(tail.dataset.state, "error");
  assert.equal(tail.textContent, UiStrings.message(UiMessage.SOURCE_MORE_RETRY_LABEL, "en"));
  assert.equal(tail.disabled, false);

  tail.dispatch("click");
  assert.equal(host.requestMoreCalls, 1);
});

test("browse panel filters locally and Escape clears before closing", () => {
  const { document, panel } = browseFixture();
  const host = cardHost(document);
  panel.cardHost = host;
  panel.grid.cardHost = host;
  panel.grid.measure = () => ({ width: 610, height: 400, cardWidth: 190, cardHeight: 126, gap: 10 });

  const source = {
    kind: "history",
    root: null,
    items: [
      { targetUrl: "https://www.bilibili.com/video/BV1", title: "Alpha", author: "One", timestamp: localTime(12) },
      { targetUrl: "https://www.bilibili.com/video/BV2", title: "Beta", author: "Alpha Author", timestamp: localTime(12) },
      { targetUrl: "https://www.bilibili.com/video/BV3", title: "Gamma", author: "Two", timestamp: localTime(11) }
    ],
    pagination: { hasMore: false, status: "ready" }
  };
  panel.open({ title: "History", count: 3, language: "en", source });
  assert.equal(panel.count.textContent, itemCount(3));

  panel.searchInput.value = "alpha";
  panel.searchInput.dispatch("input");
  assert.equal(panel.filteredCount, 2);
  assert.equal(panel.count.textContent, itemCount(2));
  assert.equal(panel.searchInput.value, "alpha");
  assert.equal(host.created.filter((card) => card.isConnected).length, 2);

  const firstEscape = keyEvent("Escape", { target: panel.searchInput });
  panel.handleKeydown(firstEscape);
  assert.equal(panel.searchInput.value, "");
  assert.equal(panel.isOpen, true);
  assert.equal(panel.filteredCount, 3);
  assert.equal(panel.count.textContent, itemCount(3));
  assert.equal(document.activeElement, panel.searchInput);

  const secondEscape = keyEvent("Escape", { target: panel.searchInput });
  panel.handleKeydown(secondEscape);
  assert.equal(panel.isOpen, false);
});

test("browse panel focus order crosses card rows and wraps at the edges", () => {
  const { document, panel } = browseFixture();
  const host = cardHost(document);
  panel.cardHost = host;
  panel.grid.cardHost = host;
  panel.grid.measure = () => ({ width: 410, height: 500, cardWidth: 190, cardHeight: 126, gap: 10 });

  panel.open({ title: "History", count: 4, language: "en", source: browseSource(4) });
  const controls = panel.focusableControls();
  assert.equal(controls[0], panel.closeButton);
  assert.equal(controls[1], panel.searchInput);
  assert.equal(controls.slice(2).every((control) =>
    control.classList.contains("bibilili-card-link")), true);
  assert.equal(controls.length, 6);

  controls[2].focus();
  const tab = keyEvent("Tab", { target: controls[2] });
  panel.handleKeydown(tab);
  assert.equal(tab.defaultPrevented, true);
  assert.equal(document.activeElement, controls[3]);
  assert.equal(host.created[1].isConnected, true);

  const end = keyEvent("End", { target: document.activeElement });
  panel.handleKeydown(end);
  assert.equal(end.defaultPrevented, true);
  assert.equal(document.activeElement, controls[controls.length - 1]);

  panel.closeButton.focus();
  const wrap = keyEvent("Tab", { shiftKey: true, target: panel.closeButton });
  panel.handleKeydown(wrap);
  assert.equal(wrap.defaultPrevented, true);
  assert.equal(document.activeElement, controls[controls.length - 1]);
});

test("browse grid reflows columns and keeps the first visible item anchored", () => {
  const { document, panel } = browseFixture();
  const host = cardHost(document);
  panel.cardHost = host;
  panel.grid.cardHost = host;
  let width = 610;
  panel.grid.measure = () => ({ width, height: 300, cardWidth: 190, cardHeight: 126, gap: 10 });

  const source = browseSource(20);
  panel.open({ title: "History", count: 20, language: "en", source });
  const grid = panel.grid;
  assert.equal(grid.columns, 3);

  grid.root.scrollTop = 150;
  grid.render();
  const anchor = grid.captureAnchor();
  assert.ok(anchor);

  width = 410;
  grid.scheduleRender();

  assert.equal(grid.columns, 2);
  const entryIndex = grid.entryIndexByKey.get(anchor.key);
  const row = grid.rows[grid.layout.rowIndexForEntry(entryIndex)];
  assert.equal(grid.root.scrollTop, row.top);
  assert.equal(grid.captureAnchor().key, anchor.key);
});

test("browse panel moves focus to the next card when a refresh removes the focused card", () => {
  const { document, panel } = browseFixture();
  const host = cardHost(document);
  panel.cardHost = host;
  panel.grid.cardHost = host;
  panel.grid.measure = () => ({ width: 610, height: 500, cardWidth: 190, cardHeight: 126, gap: 10 });

  const source = browseSource(3);
  panel.open({ title: "History", count: 3, language: "en", source });
  const controls = panel.focusableControls();
  controls[3].focus();
  assert.equal(controls[3].closest(".bibilili-video-card").renderedItem.title, "Video 2");

  panel.update({
    title: "History",
    count: 2,
    language: "en",
    source: { ...source, items: [source.items[0], source.items[2]] }
  });

  assert.equal(panel.filteredCount, 2);
  assert.equal(document.activeElement, controls[4]);
  assert.equal(
    document.activeElement.closest(".bibilili-video-card").renderedItem.title,
    "Video 3"
  );
});

test("browse panel requests the next page when short content reaches its end", async () => {
  const { document, panel } = browseFixture();
  const host = cardHost(document, async () => 4);
  panel.cardHost = host;
  panel.grid.cardHost = host;
  panel.grid.measure = () => ({ width: 610, height: 400, cardWidth: 190, cardHeight: 126, gap: 10 });

  const source = browseSource(2, {
    pagination: { hasMore: true, status: "ready" }
  });
  panel.open({ title: "History", count: 2, language: "en", source });
  await Promise.resolve();
  assert.equal(host.requestMoreCalls, 1);

  panel.close();
  assert.deepEqual(host.demands.at(-1), []);
});

test("browse card geometry fills rows with 16:9 thumbnails", () => {
  assert.deepEqual(BrowseGrid.geometry(1196, 12), {
    columns: 5,
    cardWidth: 229,
    cardHeight: 201,
    thumbHeight: 129
  });
  assert.deepEqual(BrowseGrid.geometry(932, 12), {
    columns: 4,
    cardWidth: 224,
    cardHeight: 198,
    thumbHeight: 126
  });
  assert.deepEqual(BrowseGrid.geometry(0, 12), {
    columns: 1,
    cardWidth: 220,
    cardHeight: 196,
    thumbHeight: 124
  });

  const five = BrowseGrid.geometry(1196, 12);
  assert.equal(
    five.columns * five.cardWidth + (five.columns - 1) * 12 <= 1196,
    true
  );
});

test("browse grid derives card size from its content width", () => {
  const { panel } = browseFixture();
  const grid = panel.grid;
  const previousGetComputedStyle = global.getComputedStyle;

  global.getComputedStyle = (element) => ({
    getPropertyValue: (name) => (name === "--bibilili-card-gap" ? "12px" : "")
  });
  grid.root.clientWidth = 1196;
  grid.root.clientHeight = 500;

  try {
    const metrics = grid.readMetrics();
    assert.equal(metrics.columns, 5);
    assert.equal(metrics.cardWidth, 229);
    assert.equal(metrics.cardHeight, 201);
    assert.equal(grid.root.style["--bibilili-card-width"], "229px");
    assert.equal(grid.root.style["--bibilili-card-height"], "201px");
    assert.equal(grid.root.style["--bibilili-browse-thumb-height"], "129px");
  } finally {
    global.getComputedStyle = previousGetComputedStyle;
  }
});

test("browse panel reports filtered matches against the retained count", () => {
  const { document, panel } = browseFixture();
  const host = cardHost(document);
  panel.cardHost = host;
  panel.grid.cardHost = host;
  panel.grid.measure = () => ({ width: 610, height: 400, cardWidth: 190, cardHeight: 126, gap: 10 });

  panel.open({ title: "History", count: 4, language: "en", source: browseSource(4) });
  panel.searchInput.value = "video 1";
  panel.searchInput.dispatch("input");

  assert.equal(panel.filteredCount, 1);
  assert.equal(
    panel.count.textContent,
    UiStrings.message(UiMessage.BROWSE_ITEM_COUNT_LABEL, "en", ["1 / 4"])
  );
});

test("browse panel explains an empty search with an Esc hint", () => {
  const { document, panel } = browseFixture();
  const host = cardHost(document);
  panel.cardHost = host;
  panel.grid.cardHost = host;
  panel.grid.measure = () => ({ width: 610, height: 400, cardWidth: 190, cardHeight: 126, gap: 10 });

  panel.open({ title: "History", count: 3, language: "zh_CN", source: browseSource(3) });
  panel.searchInput.value = "not a title";
  panel.searchInput.dispatch("input");

  const empty = panel.grid.root.querySelector(".bibilili-browse-empty");
  assert.equal(empty.getAttribute("role"), "status");
  assert.equal(
    empty.querySelector(".bibilili-browse-empty-title").textContent,
    UiStrings.message(UiMessage.BROWSE_SEARCH_EMPTY, "zh_CN")
  );
  assert.equal(
    empty.querySelector(".bibilili-browse-empty-hint").textContent,
    UiStrings.message(UiMessage.BROWSE_SEARCH_EMPTY_HINT, "zh_CN")
  );
});
