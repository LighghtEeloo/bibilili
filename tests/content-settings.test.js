const assert = require("node:assert/strict");
const test = require("node:test");
const { FakeStorage, ThrowingStorage, loadContentRuntime } = require("./helpers/content-runtime.js");
const { railFixture } = require("./helpers/rail-dom.js");
const { AccountSourceStore, BibililiController, LayoutRoot, SourceKind, WatchActionKind, VideoPreviewStore } = loadContentRuntime();
const { SettingsPreference } = global.__bibililiStorageState;
const { UiControl } = global.__bibililiControls;

/** Uses the real controller and settings definitions with the existing small DOM model. */
function settingsFixture(t) {
  const fixture = railFixture(LayoutRoot, 5, SourceKind.COLLECTION);
  const { document } = fixture;
  const storage = global.localStorage;
  global.localStorage = new FakeStorage();
  t.after(() => { global.localStorage = storage; });
  const controller = new BibililiController(document);
  t.mock.method(controller, "refreshAccountSources", () => {});
  t.mock.method(controller, "scheduleReconcile", () => {});
  const layout = controller.layout;
  layout.root = document.body;
  layout.sourceBar = document.createElement("div");
  layout.actionGroup = document.createElement("div");
  layout.rail = fixture.rail;
  document.body.append(layout.sourceBar);
  layout.createRailControls();
  layout.createDockUtilities();
  const anchor = document.createElement("button");
  layout.sourceBar.append(anchor);
  layout.currentActions = [WatchActionKind.LIKE, WatchActionKind.COIN, WatchActionKind.SHARE].map((kind) => {
    const trigger = document.createElement("button");
    document.body.append(trigger);
    return { kind, trigger, countText: "123" };
  });
  t.mock.method(layout, "updateActionVisual", (visual, action) => {
    visual.dataset.nativeKind = action.kind;
    return true;
  });
  controller.settingsView.update(controller.preferences, true, "en");
  return { ...fixture, controller, layout, anchor, view: controller.settingsView };
}

test("settings enable every feature and pin by default and validate saved values", () => {
  const defaults = SettingsPreference.defaults();
  assert.deepEqual(Object.keys(defaults.sources), ["parts", "collection", "recommendations", "watch_later", "history"]);
  for (const group of Object.values(defaults)) {
    assert.ok(Object.values(group).every((value) => value === true));
  }
  const value = SettingsPreference.normalize({
    features: { description: false, thumbnails: "false", unknown: true },
    sources: { collection: false, history: 0 }, pinnedActions: { like: false, unknown: true }
  });
  assert.equal(value.features.description, false);
  assert.equal(value.features.thumbnails, true);
  assert.equal(value.sources.collection, false);
  assert.equal(value.sources.history, true);
  assert.equal(value.pinnedActions.like, false);
  assert.equal("unknown" in value.pinnedActions, false);
  assert.equal("unknown" in value.features, false);
  assert.equal(SettingsPreference.defaults().features.description, true);
});

test("settings persist across reads and tolerate corrupt or blocked storage", (t) => {
  const previous = global.localStorage;
  t.after(() => { global.localStorage = previous; });
  global.localStorage = new FakeStorage();
  const value = SettingsPreference.defaults();
  value.features.thumbnails = false;
  value.pinnedActions.coin = false;
  assert.equal(SettingsPreference.write(value), true);
  assert.deepEqual(SettingsPreference.read(), value);
  global.localStorage.setItem(SettingsPreference.key, "not json");
  assert.deepEqual(SettingsPreference.read(), SettingsPreference.defaults());
  global.localStorage = new ThrowingStorage();
  assert.equal(SettingsPreference.write(value), false);
  assert.deepEqual(SettingsPreference.read(), SettingsPreference.defaults());
});

test("More reuses counted action nodes and preserves their identity across reconciles", (t) => {
  const { layout, anchor, controller, document } = settingsFixture(t);
  controller.setPreferences({
    ...controller.preferences,
    pinnedActions: { ...controller.preferences.pinnedActions, share: false, start: false }
  });
  layout.renderWatchActionGroup(layout.currentActions, anchor);
  layout.renderControlPlacement();
  const like = layout.actionButtons.get(WatchActionKind.LIKE);
  const share = layout.actionButtons.get(WatchActionKind.SHARE);
  assert.equal(like.parentElement, layout.actionGroup);
  assert.equal(share.parentElement, layout.moreWatchGroup);
  assert.equal(share.querySelector(".bibilili-action-count").textContent, "123");
  assert.equal(layout.railStartButton.parentElement, layout.moreRailGroup);
  assert.equal(layout.railLocateButton.parentElement, layout.railActionGroup);
  controller.setPreferences({ ...controller.preferences, pinnedActions: { ...controller.preferences.pinnedActions, like: false } });
  layout.renderWatchActionGroup(layout.currentActions, anchor);
  layout.renderControlPlacement();
  assert.equal(layout.actionButtons.get(WatchActionKind.LIKE), like);
  assert.equal(like.parentElement, layout.moreWatchGroup);
  like.focus();
  layout.renderWatchActionGroup(layout.currentActions, anchor);
  layout.renderControlPlacement();
  assert.equal(document.activeElement, like);
  t.mock.method(layout, "handleWatchActionButtonClick", () => {});
  like.dispatch("click");
  assert.equal(layout.handleWatchActionButtonClick.mock.callCount(), 1);
  layout.setVideoLoading(true);
  assert.equal(like.disabled, true);
  assert.equal(share.disabled, true);
});

test("settings share native and local icon renderers and keep rows stable after changes", (t) => {
  const { view, layout, controller } = settingsFixture(t);
  view.ensure();
  view.render();
  const { visual, button } = view.actions.get(WatchActionKind.LIKE);
  assert.equal(visual.dataset.nativeKind, WatchActionKind.LIKE);
  const source = view.actions.get("locate").visual.firstChild;
  const dock = layout.railLocateButton.firstChild;
  assert.equal(source.firstChild.getAttribute("d"), dock.firstChild.getAttribute("d"));
  button.dispatch("click");
  assert.equal(controller.preferences.pinnedActions.like, false);
  view.render();
  assert.equal(view.actions.get(WatchActionKind.LIKE).button, button);
  assert.equal(view.actions.get("locate").visual.firstChild, source);
  assert.equal(SettingsPreference.read().pinnedActions.like, false);
  assert.throws(() => UiControl.icon(view.document, "unknown"), /Unknown icon/);
});

test("source changes reconcile through the saved preference snapshot without reviving disabled sources", (t) => {
  const { controller, layout, source, anchor } = settingsFixture(t);
  t.mock.method(layout, "markSourceRoots", () => {});
  t.mock.method(layout, "renderSourceDock", () => {});
  controller.setPreferences({ ...controller.preferences, sources: { ...controller.preferences.sources, collection: false } });
  layout.setSources([source], false, anchor, null);
  assert.deepEqual(layout.currentSources, []);
  assert.equal(layout.selectedSourceKind, null);
  layout.setSources([source], true, anchor, { sourceKind: SourceKind.COLLECTION, isRailOpen: true });
  assert.deepEqual(layout.currentSources, []);
  assert.equal(layout.pendingSourceRouteHint, null);
  controller.setPreferences(SettingsPreference.defaults());
  layout.setSources([source], false, anchor, null);
  assert.equal(layout.currentSources[0], source);
});

test("an expanded search stays on the bar even when its shortcut belongs in More", (t) => {
  const { layout, controller } = settingsFixture(t);
  controller.preferences.pinnedActions.search = false;
  layout.renderControlPlacement();
  assert.equal(layout.railSearch.parentElement, layout.moreRailGroup);
  layout.setRailSearchExpanded(true);
  assert.equal(layout.railSearch.parentElement, layout.railActionGroup);
  layout.renderControlPlacement();
  assert.equal(layout.railSearch.parentElement, layout.railActionGroup);
  layout.setRailSearchExpanded(false);
  assert.equal(layout.railSearch.parentElement, layout.moreRailGroup);
});

test("popup dismissal restores focus and reopening retains the same controls", (t) => {
  const previous = { addEventListener: global.addEventListener, removeEventListener: global.removeEventListener };
  const listeners = new Set();
  global.addEventListener = (_type, listener) => listeners.add(listener);
  global.removeEventListener = (_type, listener) => listeners.delete(listener);
  t.after(() => Object.assign(global, previous));
  const { view, anchor, document } = settingsFixture(t);
  t.mock.method(view.panel, "position", () => {});
  view.toggle(anchor);
  const row = view.actions.get(WatchActionKind.LIKE).button;
  assert.equal(document.activeElement, view.activationInput);
  assert.equal(anchor.getAttribute("aria-expanded"), "true");
  assert.equal(listeners.size, 1);
  let prevented = false;
  row.focus();
  view.panel.root.dispatch("keydown", {
    key: "Escape", target: row, preventDefault: () => { prevented = true; }, stopPropagation() {}
  });
  assert.equal(prevented, true);
  assert.equal(view.panel.isOpen, false);
  assert.equal(document.activeElement, anchor);
  assert.equal(listeners.size, 0);
  view.toggle(anchor);
  assert.equal(view.actions.get(WatchActionKind.LIKE).button, row);
  view.panel.outsideHandler({ target: document.body });
  assert.equal(view.panel.isOpen, false);
  view.destroy();
  assert.equal(listeners.size, 0);
});

test("description switches restore the page-owned node and reuse it when enabled", (t) => {
  const { layout, controller, document } = settingsFixture(t);
  document.createComment = () => document.createElement("#comment");
  const native = document.createElement("div");
  const description = document.createElement("div");
  native.append(description);
  document.body.append(native);
  layout.commentPane = document.createElement("aside");
  layout.commentNode = document.createElement("div");
  layout.commentPane.append(layout.commentNode);
  document.body.append(layout.commentPane);
  layout.currentVideoDescription = description;
  layout.renderVideoDescription();
  assert.equal(description.parentElement, layout.videoDescriptionSlot);
  const presentation = layout.videoDescriptionView;
  controller.setPreferences({ ...controller.preferences, features: { ...controller.preferences.features, description: false } });
  layout.renderVideoDescription();
  assert.equal(description.parentElement, native);
  assert.equal(presentation.isConnected, false);
  controller.setPreferences(SettingsPreference.defaults());
  layout.renderVideoDescription();
  assert.equal(layout.videoDescriptionView, presentation);
  assert.equal(description.parentElement, layout.videoDescriptionSlot);
});

test("storage events apply another tab's preferences without writing them back", (t) => {
  const { controller } = settingsFixture(t);
  const preferences = SettingsPreference.defaults();
  preferences.sources.history = false;
  preferences.pinnedActions.like = false;
  SettingsPreference.write(preferences);
  t.mock.method(SettingsPreference, "write", () => { throw new Error("unexpected write"); });
  controller.onStorageChange({ key: SettingsPreference.key, storageArea: global.localStorage });
  assert.equal(controller.preferences.sources.history, false);
  assert.equal(controller.layout.preferences.pinnedActions.like, false);
  assert.equal(controller.accountSources.enabledKinds.has(SourceKind.HISTORY), false);
  controller.onStorageChange({ key: SettingsPreference.key, storageArea: new FakeStorage() });
  assert.equal(controller.scheduleReconcile.mock.callCount(), 1);
});

test("disabling an account source cancels requests and discards a late completion", async (t) => {
  let finish;
  let signal;
  t.mock.method(AccountSourceStore, "fetchSourceRecord", (_kind, _url, requestSignal) => {
    signal = requestSignal;
    return new Promise((resolve) => { finish = resolve; });
  });
  const store = new AccountSourceStore(() => {});
  store.setEnabledKinds([SourceKind.HISTORY]);
  const pending = store.refresh("en");
  assert.equal(AccountSourceStore.fetchSourceRecord.mock.callCount(), 1);
  store.setEnabledKinds([]);
  assert.equal(signal.aborted, true);
  finish({ source: { items: [{ targetUrl: "https://www.bilibili.com/video/av1", title: "Old result" }] }, cursor: null });
  await pending;
  assert.deepEqual(store.currentSources(), []);
  assert.deepEqual(store.records.get(SourceKind.HISTORY).items, []);
  assert.equal(store.records.get(SourceKind.HISTORY).loaded, false);
  await store.refreshSource(SourceKind.HISTORY);
  assert.equal(AccountSourceStore.fetchSourceRecord.mock.callCount(), 1);
});

test("disabling thumbnail enrichment aborts work and keeps page thumbnails intact", async (t) => {
  let finish;
  let signal;
  t.mock.method(VideoPreviewStore, "fetchPreview", (_identity, requestSignal) => {
    signal = requestSignal;
    return new Promise((resolve) => { finish = resolve; });
  });
  const store = new VideoPreviewStore(() => {});
  const item = { targetUrl: "https://www.bilibili.com/video/av1", title: "Video", thumbnailUrl: null };
  store.setDemand([item]);
  store.setEnabled(false);
  assert.equal(signal.aborted, true);
  finish("https://i0.hdslb.com/bfs/archive/cover.jpg");
  await new Promise((resolve) => setImmediate(resolve));
  store.setDemand([item]);
  assert.equal(VideoPreviewStore.fetchPreview.mock.callCount(), 1);
  assert.equal(store.hydrateItem(item), item);
  const native = { ...item, thumbnailUrl: "https://i0.hdslb.com/bfs/archive/native.jpg" };
  assert.equal(store.hydrateItem(native), native);
  assert.equal(store.records.size, 0);
});
