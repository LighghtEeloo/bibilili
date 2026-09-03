const assert = require("node:assert/strict");
const test = require("node:test");
const { loadContentRuntime } = require("./helpers/content-runtime.js");
const { RailElement, railFixture } = require("./helpers/rail-dom.js");
const { LayoutRoot, RailWindow, SourceKind } = loadContentRuntime();

global.HTMLElement = RailElement;
global.getComputedStyle = (element) => ({
  getPropertyValue: (name) => name === "--bibilili-card-width"
    ? `${element.ownerDocument.cardWidth}px` : "10px"
});

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
