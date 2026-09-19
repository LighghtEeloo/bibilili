const assert = require("node:assert/strict");
const test = require("node:test");
const { FakeStorage, loadContentRuntime } = require("./helpers/content-runtime.js");
const { RailElement, railFixture } = require("./helpers/rail-dom.js");
const { LayoutRoot, SourceKind, SourceAdapter, AccountSourceStatus, BibililiController } = loadContentRuntime();
const { FavoritesView } = global.__bibililiFavorites;
const { UiStrings } = global.__bibililiI18n;
const { SettingsPreference, SourceRouteStateStore } = global.__bibililiStorageState;

global.HTMLElement = RailElement;
global.HTMLAnchorElement = RailElement;
global.getComputedStyle = (element) => ({ getPropertyValue: (name) =>
  name === "--bibilili-card-width" ? `${element.ownerDocument.cardWidth}px` : "10px" });

test.before(async () => {
  const fetch = global.fetch;
  global.fetch = async (path) => ({ ok: true, json: async () => require(`../${path}`) });
  await UiStrings.load("en");
  global.fetch = fetch;
});

function fixture(t) {
  global.localStorage = new FakeStorage();
  const previous = { addEventListener: global.addEventListener, removeEventListener: global.removeEventListener };
  global.addEventListener = () => {};
  global.removeEventListener = () => {};
  t.after(() => Object.assign(global, previous));
  const result = railFixture(LayoutRoot, 40, SourceKind.FAVORITES);
  const { document, source, layout } = result;
  Object.assign(source, { folderId: "101", title: "Animation", status: "ready", loaded: true });
  const selected = [];
  const opened = [];
  const view = new FavoritesView(document, { statuses: AccountSourceStatus,
    onOpen: (choose) => opened.push(choose), onSelect: (id) => selected.push(id),
    onRefresh: () => {}, onSignIn: () => {} });
  t.mock.method(view.panel, "position", () => {});
  const directory = { items: [{ id: "101", title: "Animation", count: 40 }, { id: "202", title: "Music", count: 6 },
    { id: "303", title: "Empty", count: 0 }], status: "ready" };
  view.update(source, directory, "en");
  document.body.append(view.launcher());
  layout.favoritesView = view;
  return { ...result, view, directory, selected, opened };
}

test("picker searches folders, keeps button identity, selects empty folders, and restores focus", (t) => {
  const { view, directory, source, selected, document } = fixture(t);
  view.open(true);
  const row = view.rows.get("202").button;
  assert.equal(view.search.hidden, true);
  assert.equal(document.activeElement, view.rows.get("101").button);
  view.searchButton.dispatch("click");
  assert.equal(view.search.hidden, false);
  assert.equal(view.searchButton.getAttribute("aria-expanded"), "true");
  assert.equal(document.activeElement, view.search);
  view.search.value = "mUsIc";
  view.search.dispatch("input");
  assert.equal(view.rows.get("101").button.hidden, true);
  assert.equal(row.hidden, false);
  view.update(source, directory, "en");
  assert.equal(view.rows.get("202").button, row);
  assert.equal(document.activeElement, view.search);
  view.search.value = "";
  view.search.dispatch("input");
  view.rows.get("303").button.dispatch("click");
  assert.deepEqual(selected, ["303"]);
  assert.equal(view.panel.isOpen, false);
  assert.equal(document.activeElement, view.button);
  view.open(true);
  assert.equal(view.rows.get("202").button, row);
  assert.equal(view.search.hidden, true);
});

test("folder search collapses on empty blur and Escape clears the query without closing the picker", (t) => {
  const { view, document } = fixture(t);
  view.open(true);
  view.searchButton.dispatch("click");
  view.search.value = "";
  view.search.dispatch("blur");
  assert.equal(view.search.hidden, true);
  view.searchButton.dispatch("click");
  view.search.value = "Music";
  view.search.dispatch("input");
  view.search.dispatch("blur");
  assert.equal(view.search.hidden, false);
  let stopped = false;
  let prevented = false;
  view.search.dispatch("keydown", { key: "Escape", isComposing: true, stopPropagation() {}, preventDefault() {} });
  assert.equal(view.search.value, "Music");
  view.search.dispatch("keydown", { key: "Escape", stopPropagation() { stopped = true; }, preventDefault() { prevented = true; } });
  assert.ok(stopped && prevented);
  assert.equal(view.search.value, "");
  assert.equal(view.search.hidden, true);
  assert.equal(view.rows.get("101").button.hidden, false);
  assert.equal(document.activeElement, view.searchButton);
  assert.equal(view.panel.isOpen, true);
});

test("directory failures retain usable choices and render login and retry states", (t) => {
  const { view, directory, source } = fixture(t);
  view.open(true);
  directory.status = AccountSourceStatus.ERROR;
  view.update(source, directory, "en");
  assert.equal(view.refreshButton.textContent, "Retry");
  assert.equal(view.rows.size, 3);
  directory.items = [];
  directory.status = AccountSourceStatus.SIGNED_OUT;
  view.update(source, directory, "en");
  assert.equal(view.rows.size, 0);
  assert.equal(view.signInButton.hidden, false);
  assert.match(view.status.textContent, /Sign in/);
  view.update(null, directory, "en");
  assert.equal(view.panel.isOpen, false);
  assert.equal(view.button.isConnected, false);
});

test("split source controls precede watch later and survive ordinary reconciliation", (t) => {
  const { layout, document, source, view } = fixture(t);
  document.body.append(layout.sourceBar);
  layout.renderSourceBar = LayoutRoot.prototype.renderSourceBar;
  t.mock.method(layout, "renderWatchActionGroup", () => {});
  const power = document.createElement("button");
  layout.sourceBar.append(power);
  const activation = { mountDocked: () => power };
  const watch = { ...source, kind: SourceKind.WATCH_LATER, folderId: null };
  layout.renderSourceBar([source, watch], activation);
  const label = layout.sourceButtons.get(SourceKind.FAVORITES);
  assert.equal(label.textContent, "Favorites · Animation");
  assert.equal(label.nextSibling, view.button);
  assert.equal(view.button.nextSibling, layout.sourceButtons.get(SourceKind.WATCH_LATER));
  view.button.focus();
  layout.renderSourceBar([source, watch], activation);
  assert.equal(layout.sourceButtons.get(SourceKind.FAVORITES), label);
  assert.equal(document.activeElement, view.button);
  layout.renderSourceBar([{ ...source, title: "默认收藏夹", isDefaultFolder: true }, watch], activation);
  assert.equal(label.textContent, "Favorites");
  assert.equal(label.getAttribute("aria-label"), "Favorites");
  layout.renderSourceBar([source, watch], activation);
  assert.equal(label.textContent, "Favorites · Animation");
  layout.currentActivationControl = activation;
  layout.handleSourceButtonClick(SourceKind.FAVORITES);
  assert.equal(layout.isRailOpen, false);
  layout.handleSourceButtonClick(SourceKind.FAVORITES);
  assert.equal(layout.isRailOpen, true);
});

test("folder switches restore scroll independently and clear the previous folder search", (t) => {
  const { layout, rail, source } = fixture(t);
  layout.currentActivationControl = {};
  layout.renderSourceDock([source], {});
  rail.scrollLeft = 2200;
  const other = { ...source, folderId: "202", title: "Music" };
  layout.renderSourceDock([other], {});
  assert.equal(rail.scrollLeft, 0);
  rail.scrollLeft = 1200;
  layout.railSearchQuery = "something";
  layout.renderSourceDock([source], {});
  assert.equal(layout.railSearchQuery, "");
  assert.equal(rail.scrollLeft, 2200);
  layout.renderSourceDock([other], {});
  assert.equal(rail.scrollLeft, 1200);
});

test("an unchosen Favorites route yields to loaded lists while a chosen empty folder stays selected", (t) => {
  const { layout, source } = fixture(t);
  const empty = { ...source, folderId: null, items: [] };
  const watch = { ...source, kind: SourceKind.WATCH_LATER };
  layout.hasUserInteractedWithSources = false;
  assert.equal(layout.resolveSourceRoute([empty], false), SourceKind.FAVORITES);
  assert.equal(layout.resolveSourceRoute([empty, watch], false), SourceKind.WATCH_LATER);
  assert.equal(layout.resolveSourceRoute([{ ...empty, folderId: "303" }, watch], false), SourceKind.FAVORITES);
});

test("a restored closed Favorites route survives loading and retains its folder identity", (t) => {
  const { layout, source } = fixture(t);
  global.sessionStorage = new FakeStorage();
  const directory = { requestedFolderId: "101" };
  const controller = { accountSources: { favoriteFolders: directory } };
  layout.onSourceRouteChange = (state) => BibililiController.prototype.storeSourceRouteState.call(controller, state);
  t.mock.method(layout, "markSourceRoots", () => {});
  const loading = { ...source, folderId: null, items: [], status: AccountSourceStatus.LOADING };
  const route = { sourceKind: SourceKind.FAVORITES, folderId: "101", isRailOpen: false };
  const routeKey = SourceAdapter.currentWatchRouteKey();
  layout.setSources([loading], true, {}, route);
  assert.deepEqual(SourceRouteStateStore.read(routeKey), route);
  const watch = { ...source, kind: SourceKind.WATCH_LATER };
  layout.setSources([loading, watch], false, {}, null);
  assert.equal(layout.selectedSourceKind, SourceKind.FAVORITES);
  assert.equal(layout.isRailOpen, false);
  directory.requestedFolderId = null;
  layout.setSources([source, watch], false, {}, null);
  assert.deepEqual(SourceRouteStateStore.read(routeKey), route);
  layout.setSources([{ ...source, folderId: "202" }, watch], false, {}, null);
  assert.deepEqual(SourceRouteStateStore.read(routeKey), { ...route, folderId: "202" });
});

test("favorite cards retain folder identity and reuse current-card highlighting and load more", (t) => {
  const { layout, source, card, more } = fixture(t);
  source.items[2].targetUrl = global.location.href;
  layout.renderRail(source, true);
  assert.equal(card(2).isCurrent, true);
  assert.equal(card(2).dataset.bibililiCardFolderId, "101");
  assert.equal(more().textContent, "Show more");
  const calls = [];
  layout.onVideoCardNavigate = (...args) => calls.push(args);
  const link = card(2).firstChild;
  link.href = global.location.href;
  layout.handleVideoCardLinkClick({ button: 0, currentTarget: link });
  assert.equal(calls[0][3], "101");
});

test("settings source switch closes the picker and filters Favorites without changing star placement", (t) => {
  const { document } = fixture(t);
  const controller = new BibililiController(document);
  t.mock.method(controller, "scheduleReconcile", () => {});
  t.mock.method(controller, "refreshAccountSources", () => {});
  const { layout, favoritesView, settingsView } = controller;
  t.mock.method(favoritesView.panel, "position", () => {});
  t.mock.method(favoritesView.options, "onOpen", () => {});
  const source = controller.accountSources.currentSource(SourceKind.FAVORITES);
  favoritesView.update(source, controller.accountSources.favoriteFolders, "en");
  document.body.append(favoritesView.launcher());
  favoritesView.open(true);
  settingsView.ensure();
  const sources = [...settingsView.inputs.entries()].filter(([, value]) => value.group === "sources");
  assert.deepEqual(sources.map(([, value]) => value.key), ["parts", "collection", "recommendations", "favorites", "watch_later", "history"]);
  const input = sources.find(([, value]) => value.key === "favorites")[0];
  input.checked = false;
  input.dispatch("change");
  assert.equal(controller.preferences.sources.favorites, false);
  assert.equal(controller.preferences.pinnedActions.favorite, true);
  assert.equal(favoritesView.panel.isOpen, false);
  assert.equal(controller.accountSources.currentSource(SourceKind.FAVORITES), null);
  assert.equal(SettingsPreference.read().sources.favorites, false);
  layout.root = document.body;
  layout.sourceBar = document.createElement("div");
  layout.rail = document.createElement("div");
  t.mock.method(layout, "markSourceRoots", () => {});
  t.mock.method(layout, "renderSourceDock", () => {});
  layout.setSources([source], false, {}, { sourceKind: SourceKind.FAVORITES, folderId: "101", isRailOpen: true });
  assert.deepEqual(layout.currentSources, []);
  assert.equal(layout.pendingSourceRouteHint, null);
});
