const assert = require("node:assert/strict");
const test = require("node:test");
const { FakeStorage, ThrowingStorage, loadContentRuntime } = require("./helpers/content-runtime.js");
const { railFixture } = require("./helpers/rail-dom.js");
const { AccountSourceStore, BibililiController, LayoutRoot, SourceKind, WatchActionKind, VideoPreviewStore } = loadContentRuntime();
const { SettingsPreference, SettingsViewMode, SettingsTabPreference, RailOpening } = global.__bibililiStorageState;
const { UiControl } = global.__bibililiControls;
const { UiLanguage, UiMessage, UiStrings } = global.__bibililiI18n;

/** Uses the real controller and settings definitions with the existing small DOM model. */
function settingsFixture(t, { performance = false, viewMode = SettingsViewMode.CONCISE } = {}) {
  const fixture = railFixture(LayoutRoot, 5, SourceKind.COLLECTION);
  const { document } = fixture;
  const storage = global.localStorage;
  const session = global.sessionStorage;
  global.localStorage = new FakeStorage();
  global.sessionStorage = new FakeStorage();
  const preferences = SettingsPreference.defaults();
  preferences.features.performance = performance;
  preferences.viewMode = viewMode;
  SettingsPreference.write(preferences);
  const controller = new BibililiController(document);
  t.after(() => {
    controller.performanceMonitor.stop();
    global.localStorage = storage;
    global.sessionStorage = session;
  });
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

/** Checks visibility through section and tab ancestors in the small DOM model. */
function isSettingsControlVisible(view, control) {
  for (let element = control; element !== view.panel.root; element = element.parentElement) {
    if (element.hidden) return false;
  }
  return true;
}

test("settings enable features, sources, and pins while recording defaults off", () => {
  const defaults = SettingsPreference.defaults();
  assert.equal(defaults.viewMode, SettingsViewMode.CONCISE);
  assert.equal(defaults.language, null);
  assert.equal(defaults.operationHistoryLimit, 100);
  assert.equal(defaults.railOpening, RailOpening.ALWAYS);
  assert.deepEqual(Object.keys(defaults.sources), ["parts", "collection", "recommendations", "favorites", "watch_later", "history"]);
  for (const group of [defaults.sources, defaults.pinnedActions]) {
    assert.ok(Object.values(group).every((value) => value === true));
  }
  assert.deepEqual(defaults.features, { description: true, thumbnails: true, inPageNavigation: true, favoriteToSelectedFolder: true, refreshRailOnStart: true, silentRailLoading: true, moreButton: true, operationHistory: false, performance: false });
  const value = SettingsPreference.normalize({
    features: { description: false, thumbnails: "false", inPageNavigation: "false", unknown: true },
    sources: { collection: false, history: 0 }, pinnedActions: { like: false, unknown: true }
  });
  assert.equal(value.features.description, false);
  assert.equal(value.features.thumbnails, true);
  assert.equal(value.features.inPageNavigation, true);
  assert.equal(SettingsPreference.normalize({ features: { thumbnails: false } }).features.inPageNavigation, true);
  assert.equal(value.features.favoriteToSelectedFolder, true);
  assert.equal(value.features.refreshRailOnStart, true);
  assert.equal(value.features.silentRailLoading, true);
  assert.equal(SettingsPreference.normalize({
    features: { silentRailLoading: false }
  }).features.silentRailLoading, false);
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
  value.viewMode = SettingsViewMode.ADVANCED;
  value.operationHistoryLimit = 500;
  value.railOpening = RailOpening.CONTEXTUAL;
  value.features.thumbnails = false;
  value.features.inPageNavigation = false;
  value.features.favoriteToSelectedFolder = false;
  value.features.refreshRailOnStart = false;
  value.features.silentRailLoading = false;
  value.features.performance = true;
  value.pinnedActions.coin = false;
  value.language = UiLanguage.TRADITIONAL_CHINESE;
  assert.equal(SettingsPreference.write(value), true);
  assert.deepEqual(SettingsPreference.read(), value);
  global.localStorage.setItem(SettingsPreference.key, "not json");
  assert.deepEqual(SettingsPreference.read(), SettingsPreference.defaults());
  global.localStorage = new ThrowingStorage();
  assert.equal(SettingsPreference.write(value), false);
  assert.deepEqual(SettingsPreference.read(), SettingsPreference.defaults());
});

test("settings view modes accept the closed choices and default older records to Concise", () => {
  for (const viewMode of Object.values(SettingsViewMode)) {
    assert.equal(SettingsPreference.normalize({ viewMode }).viewMode, viewMode);
  }
  for (const viewMode of [null, undefined, "", "toString", {}, ["advanced"], false]) {
    const preferences = SettingsPreference.normalize({ viewMode, features: { description: false } });
    assert.equal(preferences.viewMode, SettingsViewMode.CONCISE);
    assert.equal(preferences.features.description, false);
  }
});

test("view modes reveal settings progressively while retaining feature values and control identity", (t) => {
  const { view, controller, document } = settingsFixture(t);
  view.ensure();
  t.mock.method(view.panel, "position", () => {});
  view.panel.root.hidden = false;
  view.render();
  const select = view.viewModeSelect;
  const inputs = [...view.inputs.keys()];
  const visibleInputs = () => inputs.filter((input) => isSettingsControlVisible(view, input)).map((input) => input.name);
  const visibleTabs = () => [...view.tabs].filter(([, button]) => !button.hidden).map(([key]) => key);
  assert.equal(select.value, SettingsViewMode.CONCISE);
  assert.equal(select.parentElement, view.panels.get("features").firstElementChild);
  assert.deepEqual(visibleInputs(), ["description", "inPageNavigation"]);
  assert.deepEqual(visibleTabs(), ["features", "rail", "actions"]);
  assert.equal(isSettingsControlVisible(view, view.languageSelect), true);
  assert.equal(isSettingsControlVisible(view, view.activationInput), true);

  const saved = { ...controller.preferences,
    features: { ...controller.preferences.features, thumbnails: false, operationHistory: true, performance: true },
    sources: { ...controller.preferences.sources, history: false },
    pinnedActions: { ...controller.preferences.pinnedActions, like: false } };
  controller.setPreferences(saved);
  const reconciles = controller.scheduleReconcile.mock.callCount();
  const refreshes = controller.refreshAccountSources.mock.callCount();
  const fullInputs = ["description", "thumbnails", "inPageNavigation", "favoriteToSelectedFolder", "operationHistory"];
  select.focus();
  for (const [viewMode, expectedInputs] of [
    [SettingsViewMode.FULLY_FLEDGED, fullInputs],
    [SettingsViewMode.ADVANCED, [...fullInputs, "performance"]],
    [SettingsViewMode.CONCISE, ["description", "inPageNavigation"]]
  ]) {
    select.value = viewMode;
    select.dispatch("change");
    assert.deepEqual(visibleInputs(), expectedInputs);
    assert.deepEqual(visibleTabs(), ["features", "rail", "actions", "operation_history", "performance"]);
    assert.deepEqual(SettingsPreference.read(), { ...saved, viewMode });
    assert.equal(document.activeElement, select);
    assert.equal(view.viewModeSelect, select);
    assert.deepEqual([...view.inputs.keys()], inputs);
  }
  assert.equal(controller.performance.enabled, true);
  assert.equal(controller.operationHistory.enabled, true);
  assert.equal(controller.scheduleReconcile.mock.callCount(), reconciles);
  assert.equal(controller.refreshAccountSources.mock.callCount(), refreshes);
  assert.equal(view.performanceView.status, undefined, "revealing diagnostics does not capture a snapshot");
});

test("view mode changes preserve other tabs, focus, keyboard navigation, and saved selection", (t) => {
  const { view, controller, document } = settingsFixture(t, { performance: true, viewMode: SettingsViewMode.ADVANCED });
  view.ensure();
  t.mock.method(view.panel, "position", () => {});
  view.panel.root.hidden = false;
  controller.setPreferences({ ...controller.preferences,
    features: { ...controller.preferences.features, operationHistory: true } });
  for (const tab of ["rail", "actions", "operation_history", "performance"]) {
    view.selectTab(tab);
    const control = tab === "rail" ? view.sourceArrangement.chips.get(SourceKind.HISTORY)
      : tab === "actions" ? view.actions.get(WatchActionKind.LIKE).button
        : tab === "performance" ? view.performanceView.copyButton : view.tabs.get(tab);
    control.focus();
    for (const viewMode of [SettingsViewMode.FULLY_FLEDGED, SettingsViewMode.ADVANCED, SettingsViewMode.CONCISE]) {
      SettingsPreference.write({ ...controller.preferences, viewMode });
      controller.onStorageChange({ key: SettingsPreference.key, storageArea: global.localStorage });
      assert.equal(view.tab, tab);
      assert.equal(SettingsTabPreference.read(), tab);
      assert.equal(document.activeElement, control);
      assert.equal(isSettingsControlVisible(view, control), true);
      assert.equal(isSettingsControlVisible(view, view.viewModeSelect), false);
      assert.ok([...view.tabs.values()].every((button) => !button.hidden));
    }
  }

  const restored = new global.__bibililiSettings.SettingsView(document, view.options);
  restored.update(SettingsPreference.read(), true, "en");
  restored.ensure();
  restored.render();
  assert.equal(restored.viewModeSelect.value, SettingsViewMode.CONCISE);
  assert.equal(restored.tab, "performance");
  for (const [key, expected] of [
    ["Home", "features"], ["ArrowRight", "rail"], ["ArrowRight", "actions"], ["ArrowRight", "operation_history"],
    ["End", "performance"], ["ArrowLeft", "operation_history"]
  ]) {
    restored.tabs.get(restored.tab).dispatch("keydown", { key, preventDefault() {} });
    assert.equal(restored.tab, expected);
    assert.equal(document.activeElement, restored.tabs.get(expected));
  }
});

test("a view mode change from another tab moves focus out of a hidden feature row", (t) => {
  const { view, controller, document } = settingsFixture(t, { viewMode: SettingsViewMode.FULLY_FLEDGED });
  view.ensure();
  t.mock.method(view.panel, "position", () => {});
  view.panel.root.hidden = false;
  for (const name of ["thumbnails", "favoriteToSelectedFolder"]) {
    controller.setPreferences({ ...controller.preferences, viewMode: SettingsViewMode.FULLY_FLEDGED });
    const input = [...view.inputs.keys()].find((input) => input.name === name);
    input.focus();
    SettingsPreference.write({ ...controller.preferences, viewMode: SettingsViewMode.CONCISE });
    controller.onStorageChange({ key: SettingsPreference.key, storageArea: global.localStorage });
    assert.equal(isSettingsControlVisible(view, input), false);
    assert.equal(document.activeElement, view.viewModeSelect);
    assert.equal(view.viewModeSelect.value, SettingsViewMode.CONCISE);
  }
});

test("view mode selection survives blocked storage and restoring defaults keeps the selected view", (t) => {
  const { view, controller } = settingsFixture(t);
  view.ensure();
  global.localStorage = new ThrowingStorage();
  view.viewModeSelect.value = SettingsViewMode.FULLY_FLEDGED;
  view.viewModeSelect.dispatch("change");
  assert.equal(controller.preferences.viewMode, SettingsViewMode.FULLY_FLEDGED);
  assert.equal(view.statusKey, UiMessage.SETTINGS_PAGE_ONLY_LABEL);
  view.selectTab("actions");
  view.actions.get(WatchActionKind.LIKE).button.dispatch("click");
  view.panel.root.querySelector(".bibilili-settings-restore").dispatch("click");
  assert.deepEqual(controller.preferences, { ...SettingsPreference.defaults(), viewMode: SettingsViewMode.FULLY_FLEDGED });
  assert.equal(view.tab, "actions");
  assert.equal(view.viewModeSelect.value, SettingsViewMode.FULLY_FLEDGED);
});

test("performance toggles recording without reconciliation and snapshots refresh only on demand", (t) => {
  const { controller, view } = settingsFixture(t, { viewMode: SettingsViewMode.ADVANCED });
  view.ensure();
  const snapshots = t.mock.method(controller, "performanceSnapshot");
  assert.equal(view.performanceView.status, undefined, "other tabs do not allocate statistics DOM");
  const input = [...view.inputs.keys()].find((input) => input.name === "performance");
  view.render();
  assert.equal(input.checked, false);
  assert.equal(view.tabs.get("performance").hidden, true);
  input.checked = true;
  input.dispatch("change");
  assert.equal(controller.performance.enabled, true);
  assert.equal(controller.scheduleReconcile.mock.callCount(), 0);
  assert.equal(controller.refreshAccountSources.mock.callCount(), 0);
  assert.equal(SettingsPreference.read().features.performance, true);
  assert.equal(view.tabs.get("performance").hidden, false);
  view.selectTab("performance");
  const performance = view.performanceView;
  const retained = performance.snapshot;
  controller.performance.count("navigationTicks");
  view.update(controller.preferences, true, "en");
  view.render();
  assert.equal(snapshots.mock.callCount(), 1);
  assert.equal(performance.snapshot, retained);
  assert.equal(retained.states.visible.counters.navigationTicks, 0);
  performance.refresh();
  assert.equal(performance.snapshot.states.visible.counters.navigationTicks, 1);
  const reset = [...performance.labels].find(([, key]) => key === UiMessage.PERFORMANCE_RESET)[0];
  reset.dispatch("click");
  assert.equal(performance.snapshot.states.visible.counters.navigationTicks, 0);
  assert.equal(controller.performance.enabled, true);
  input.checked = false;
  input.dispatch("change");
  assert.equal(controller.performance.enabled, false);
  assert.equal(view.tab, "features");
  assert.equal(view.tabs.get("performance").hidden, true);
  assert.equal(view.panels.get("performance").hidden, true);
});

test("unavailable Performance tabs are skipped by keyboard navigation and saved selection", (t) => {
  const { view, controller, document } = settingsFixture(t, { viewMode: SettingsViewMode.FULLY_FLEDGED });
  view.ensure();
  view.selectTab("actions");
  const key = (value) => view.tabs.get(view.tab).dispatch("keydown", { key: value, preventDefault() {} });
  key("ArrowRight");
  assert.equal(view.tab, "features");
  key("ArrowLeft");
  assert.equal(view.tab, "actions");
  key("Home");
  key("End");
  assert.equal(view.tab, "actions");
  view.selectTab("performance");
  assert.equal(view.tab, "actions");
  assert.equal(view.performanceView.status, undefined);

  global.__bibililiStorageState.SettingsTabPreference.write("performance");
  const restored = new global.__bibililiSettings.SettingsView(document, view.options);
  restored.update(controller.preferences, true, "en");
  restored.ensure();
  restored.render();
  assert.equal(restored.tab, "features");
  assert.equal(restored.tabs.get("performance").hidden, true);
  assert.equal(global.__bibililiStorageState.SettingsTabPreference.read(), "features");
});

test("a recording change from another tab moves focus out of hidden statistics and preserves totals", (t) => {
  const { view, controller, document } = settingsFixture(t, { performance: true, viewMode: SettingsViewMode.ADVANCED });
  view.ensure();
  t.mock.method(view.panel, "position", () => {});
  view.panel.root.hidden = false;
  view.selectTab("performance");
  view.performanceView.copyButton.focus();
  controller.performance.count("navigationTicks");
  const preferences = SettingsPreference.defaults();
  SettingsPreference.write(preferences);
  controller.onStorageChange({ key: SettingsPreference.key, storageArea: global.localStorage });
  assert.equal(view.tab, "features");
  assert.equal(document.activeElement, view.tabs.get("features"));
  assert.equal(view.tabs.get("performance").hidden, true);
  assert.equal(controller.performance.snapshot().states.visible.counters.navigationTicks, 1);
});

test("available settings tabs support roving keyboard focus and persisted selection", (t) => {
  const { view, document } = settingsFixture(t, { performance: true, viewMode: SettingsViewMode.ADVANCED });
  view.ensure();
  view.selectTab("features");
  const key = (value) => view.tabs.get(view.tab).dispatch("keydown", { key: value, preventDefault() {} });
  key("ArrowRight");
  assert.equal(view.tab, "rail");
  key("ArrowRight");
  assert.equal(view.tab, "actions");
  key("ArrowRight");
  assert.equal(view.tab, "performance");
  assert.equal(document.activeElement, view.tabs.get("performance"));
  assert.equal(view.tabs.get("performance").getAttribute("aria-selected"), "true");
  assert.equal(view.panels.get("features").hidden, true);
  assert.equal(global.__bibililiStorageState.SettingsTabPreference.read(), "performance");
  key("ArrowRight");
  assert.equal(view.tab, "features");
  key("End");
  assert.equal(view.tab, "performance");
  key("Home");
  assert.equal(view.tab, "features");
  key("ArrowLeft");
  assert.equal(view.tab, "performance");
});

test("copy exports the displayed snapshot and reports clipboard failures", async (t) => {
  const { controller, view } = settingsFixture(t, { performance: true, viewMode: SettingsViewMode.ADVANCED });
  view.ensure();
  view.selectTab("performance");
  const performance = view.performanceView;
  let copied;
  performance.options.onCopy = async (json) => { copied = JSON.parse(json); };
  controller.performance.setEnabled(true);
  controller.performance.count("navigationTicks");
  await performance.copy();
  assert.deepEqual(copied, performance.snapshot);
  assert.equal(copied.states.visible.counters.navigationTicks, 0);
  assert.equal(performance.copyMessage, UiMessage.PERFORMANCE_COPIED);
  performance.options.onCopy = async () => { throw new Error("clipboard blocked"); };
  await performance.copy();
  assert.equal(performance.copyMessage, UiMessage.PERFORMANCE_COPY_FAILED);
  assert.equal(performance.copyButton.disabled, false);
});

test("the performance widget follows its feature and stays directly beside Settings", (t) => {
  const { controller, view, layout } = settingsFixture(t);
  const widget = view.performanceWidget;
  const button = widget.launcher();
  assert.equal(button.hidden, true);
  assert.equal(button.nextSibling, layout.settingsButton);
  controller.setPreferences({ ...controller.preferences,
    features: { ...controller.preferences.features, performance: true } }, false);
  assert.equal(widget.launcher(), button);
  assert.equal(button.hidden, false);
  assert.equal(button.dataset.level, "quiet");
  assert.equal(view.performanceView.status, undefined, "the widget does not allocate statistics tables");
  controller.performanceMonitor.event("buffering", { durationMs: 3500 }, "warning");
  assert.equal(button.dataset.level, "warning");
  assert.equal(widget.badge.textContent, "!");
  assert.equal(button.getAttribute("aria-label"), UiStrings.message(UiMessage.PERFORMANCE_WIDGET_WARNING, "en",
    [UiStrings.message(UiMessage.PERFORMANCE_ALERT_BUFFERING, "en")]));
  controller.performanceMonitor.event("timer_gap", { durationMs: 2500 }, "severe");
  assert.equal(button.dataset.level, "severe");
  controller.setPreferences(SettingsPreference.defaults(), false);
  assert.equal(button.hidden, true);
});

test("widget copy captures a fresh report, keeps failures lit, and preserves alerts arriving during copying", async (t) => {
  const { controller, view } = settingsFixture(t, { performance: true });
  const widget = view.performanceWidget;
  const monitor = controller.performanceMonitor;
  monitor.event("buffering", { durationMs: 3500 }, "warning");
  widget.options.onCopy = async () => { throw new Error("clipboard blocked"); };
  await widget.copy();
  assert.equal(widget.copyMessage, UiMessage.PERFORMANCE_WIDGET_COPY_FAILED);
  assert.equal(widget.button.dataset.level, "warning");
  let resolve;
  let copied;
  widget.options.onCopy = (json) => {
    copied = JSON.parse(json);
    return new Promise((done) => { resolve = done; });
  };
  const copying = widget.copy();
  assert.equal(widget.button.disabled, true);
  monitor.event("timer_gap", { durationMs: 2500 }, "severe");
  resolve();
  await copying;
  assert.equal(copied.diagnostics.current.alert.type, "buffering");
  assert.equal(widget.button.dataset.level, "severe");
  widget.options.onCopy = async (json) => { copied = JSON.parse(json); };
  await widget.copy();
  assert.equal(copied.diagnostics.current.alert.type, "timer_gap");
  assert.equal(widget.button.dataset.level, "quiet");
  assert.equal(widget.copyMessage, UiMessage.PERFORMANCE_WIDGET_COPIED);
  assert.equal(widget.badge.textContent, "✓");
  assert.ok(monitor.events.some(({ type }) => type === "timer_gap"), "copying keeps event history");
});

test("disabling recording during widget copy prevents a stale success from clearing alerts", async (t) => {
  const { controller, view } = settingsFixture(t, { performance: true });
  const widget = view.performanceWidget;
  controller.performanceMonitor.event("api_error", {}, "warning");
  let resolve;
  widget.options.onCopy = () => new Promise((done) => { resolve = done; });
  const copying = widget.copy();
  controller.setPreferences(SettingsPreference.defaults(), false);
  resolve();
  await copying;
  assert.equal(widget.button.hidden, true);
  assert.equal(widget.copyMessage, null);
  assert.equal(controller.performanceMonitor.status().level, "warning");
});

test("report clipboard fallback stays inside settings and restores focus even on failure", (t) => {
  const { view, document } = settingsFixture(t, { performance: true, viewMode: SettingsViewMode.ADVANCED });
  view.ensure();
  view.selectTab("performance");
  document.body.append(view.panel.root);
  const button = view.performanceView.copyButton;
  button.focus();
  const create = document.createElement;
  t.mock.method(document, "createElement", (tag) => {
    const element = create(tag);
    element.select = () => element.focus();
    element.setSelectionRange = () => {};
    return element;
  });
  document.execCommand = () => {
    assert.equal(document.activeElement.parentElement, view.panel.root);
    throw new Error("copy denied");
  };
  assert.throws(() => LayoutRoot.copyTextWithTextarea(document, "{}", view.panel.root), /copy denied/);
  assert.equal(view.panel.root.querySelector("textarea"), null);
  assert.equal(document.activeElement, button);
});

test("language preferences accept only packaged languages and default to automatic", () => {
  for (const language of Object.values(UiLanguage)) {
    assert.equal(SettingsPreference.normalize({ language }).language, language);
  }
  for (const language of [null, undefined, "", "de", "zh-CN", "toString", {}, ["en"], false]) {
    assert.equal(SettingsPreference.normalize({ language }).language, null);
  }
});

test("the language selector updates labels in place and restores automatic detection", async (t) => {
  t.mock.method(global, "fetch", async (url) => ({ ok: true, json: async () => require(`../${url}`) }));
  await UiStrings.loadSupported();
  const { view, controller, document } = settingsFixture(t, { viewMode: SettingsViewMode.FULLY_FLEDGED });
  document.body.setAttribute("lang", "zh-CN");
  t.mock.method(view.panel, "position", () => {});
  t.mock.method(controller, "isWatchPage", () => true);
  t.mock.method(controller.accountSources, "refresh", async () => {});
  view.ensure();
  view.panel.isOpen = true;
  controller.setPreferences({ ...controller.preferences, sources: { ...controller.preferences.sources, history: false } });
  const select = view.languageSelect;
  const options = [...select.children];
  const viewOptions = [...view.viewModeSelect.children];
  assert.equal(select.value, "");
  assert.equal(controller.uiLanguage, UiLanguage.SIMPLIFIED_CHINESE);
  assert.equal(options[0].textContent, "自动");
  assert.deepEqual(options.slice(1).map((option) => option.textContent), ["English", "简体中文", "繁體中文"]);
  select.focus();
  for (const language of Object.values(UiLanguage)) {
    select.value = language;
    select.dispatch("change");
    assert.equal(controller.uiLanguage, language);
    assert.equal(SettingsPreference.read().language, language);
    assert.equal(view.panel.root.lang, language);
    assert.equal(view.panel.root.getAttribute("aria-label"), UiStrings.message(UiMessage.SETTINGS_LABEL, language));
    assert.deepEqual(viewOptions.map((option) => option.textContent), [
      UiMessage.SETTINGS_VIEW_CONCISE, UiMessage.SETTINGS_VIEW_FULLY_FLEDGED, UiMessage.SETTINGS_VIEW_ADVANCED
    ].map((key) => UiStrings.message(key, language)));
    assert.equal(view.viewModeSelect.value, SettingsViewMode.FULLY_FLEDGED);
    assert.deepEqual([...view.viewModeSelect.children], viewOptions);
    assert.equal(controller.loadingCover.resolveLanguage(), language);
    assert.equal(controller.preferences.sources.history, false);
    assert.equal(document.body.getAttribute("lang"), "zh-CN");
    assert.equal(document.activeElement, select);
    controller.resolveUiLanguage();
    view.update(controller.preferences, true, language);
    assert.equal(view.languageSelect, select);
    assert.deepEqual([...select.children], options);
  }
  assert.equal(controller.accountSources.refresh.mock.callCount(), 4);
  view.selectTab("features");
  assert.equal(select.parentElement.parentElement, view.panels.get("features"));
  assert.equal(view.panels.get("features").hidden, false);
  view.selectTab("actions");
  assert.equal(view.panels.get("features").hidden, true);
  view.selectTab("features");
  select.value = "";
  select.dispatch("change");
  assert.equal(controller.uiLanguage, UiLanguage.SIMPLIFIED_CHINESE);
  assert.equal(SettingsPreference.read().language, null);
  select.value = UiLanguage.ENGLISH;
  select.dispatch("change");
  view.panel.root.querySelector(".bibilili-settings-restore").dispatch("click");
  assert.equal(select.value, "");
  assert.equal(controller.uiLanguage, UiLanguage.SIMPLIFIED_CHINESE);
  assert.equal(controller.preferences.sources.history, true);
});

test("a language choice stays active with blocked storage while the layout is disabled", (t) => {
  const { view, controller, document } = settingsFixture(t);
  document.body.setAttribute("lang", "zh-CN");
  global.localStorage = new ThrowingStorage();
  controller.enabled = false;
  view.ensure();
  view.languageSelect.value = UiLanguage.ENGLISH;
  view.languageSelect.dispatch("change");
  assert.equal(controller.resolveUiLanguage(), UiLanguage.ENGLISH);
  assert.equal(controller.loadingCover.resolveLanguage(), UiLanguage.ENGLISH);
  assert.equal(view.language, UiLanguage.ENGLISH);
  assert.equal(view.statusKey, UiMessage.SETTINGS_PAGE_ONLY_LABEL);
  assert.equal(view.languageSelect.value, UiLanguage.ENGLISH);
  assert.equal(controller.enabled, false);
});

for (const feature of ["inPageNavigation", "refreshRailOnStart"]) {
  test(`${feature} preferences persist and restore without refreshing the current page`, (t) => {
    const { view, controller } = settingsFixture(t);
    view.ensure();
    view.panel.root.hidden = false;
    t.mock.method(view.panel, "position", () => {});
    view.render();
    const input = [...view.inputs.keys()].find((input) => input.name === feature);
    assert.equal(input.checked, true);
    assert.ok(view.panels.get(feature === "inPageNavigation" ? "features" : "rail").contains(input));
    input.checked = false;
    input.dispatch("change");
    assert.equal(controller.preferences.features[feature], false);
    assert.equal(SettingsPreference.read().features[feature], false);
    assert.equal(controller.layout.preferences.features[feature], false);
    assert.equal(controller.scheduleReconcile.mock.callCount(), 0);
    assert.equal(controller.refreshAccountSources.mock.callCount(), 0);
    controller.setPreferences(SettingsPreference.defaults());
    assert.equal(input.checked, true);
    const saved = SettingsPreference.read();
    saved.features[feature] = false;
    SettingsPreference.write(saved);
    controller.onStorageChange({ storageArea: global.localStorage, key: SettingsPreference.key });
    assert.equal(input.checked, false);
    assert.equal(controller.preferences.features[feature], false);
    assert.equal(controller.scheduleReconcile.mock.callCount(), 0);
  });
}

test("silent rail loading persists and refreshes the rail without reloading account lists", (t) => {
  const { view, controller, layout } = settingsFixture(t);
  view.ensure();
  view.render();
  const input = [...view.inputs.keys()].find((input) => input.name === "silentRailLoading");
  assert.equal(input.checked, true);
  assert.ok(view.panels.get("rail").contains(input));
  input.checked = false;
  input.dispatch("change");
  assert.equal(controller.preferences.features.silentRailLoading, false);
  assert.equal(SettingsPreference.read().features.silentRailLoading, false);
  assert.equal(layout.preferences.features.silentRailLoading, false);
  assert.equal(controller.scheduleReconcile.mock.callCount(), 1);
  assert.equal(controller.refreshAccountSources.mock.callCount(), 0);
  controller.setPreferences(SettingsPreference.defaults());
  assert.equal(input.checked, true);
});

test("the Rail tab holds opening, loading, and every source regardless of the Features view", (t) => {
  const { view } = settingsFixture(t);
  view.ensure();
  view.panel.root.hidden = false;
  t.mock.method(view.panel, "position", () => {});
  view.selectTab("rail");
  const rail = view.panels.get("rail");
  const inputs = [...view.inputs.keys()].filter((input) => rail.contains(input));
  assert.equal(rail.firstElementChild, view.railOpeningSelect.parentElement);
  assert.deepEqual(inputs.map((input) => input.name), ["refreshRailOnStart", "silentRailLoading"]);
  assert.equal(view.viewModeSelect.value, SettingsViewMode.CONCISE);
  assert.ok(inputs.every((input) => isSettingsControlVisible(view, input)));
  assert.ok([...view.sourceArrangement.chips.values()].every((chip) => isSettingsControlVisible(view, chip)));
  assert.equal(isSettingsControlVisible(view, view.railOpeningSelect), true);
  assert.deepEqual([...view.railOpeningSelect.children].map((option) => option.value),
    [RailOpening.ALWAYS, RailOpening.CONTEXTUAL, RailOpening.NEVER]);
});

test("the rail opening choice persists, syncs across tabs, and restores without reconciling", (t) => {
  const { view, controller, layout } = settingsFixture(t);
  view.ensure();
  view.panel.root.hidden = false;
  t.mock.method(view.panel, "position", () => {});
  view.render();
  const select = view.railOpeningSelect;
  assert.equal(select.value, RailOpening.ALWAYS);
  for (const value of [null, "", "open", {}]) {
    assert.equal(SettingsPreference.normalize({ railOpening: value }).railOpening, RailOpening.ALWAYS);
  }
  select.value = RailOpening.NEVER;
  select.dispatch("change");
  assert.equal(controller.preferences.railOpening, RailOpening.NEVER);
  assert.equal(layout.preferences.railOpening, RailOpening.NEVER);
  assert.equal(SettingsPreference.read().railOpening, RailOpening.NEVER);
  assert.equal(controller.scheduleReconcile.mock.callCount(), 0);
  assert.equal(controller.refreshAccountSources.mock.callCount(), 0);
  SettingsPreference.write({ ...controller.preferences, railOpening: RailOpening.CONTEXTUAL });
  controller.onStorageChange({ storageArea: global.localStorage, key: SettingsPreference.key });
  assert.equal(select.value, RailOpening.CONTEXTUAL);
  view.panel.root.querySelector(".bibilili-settings-restore").dispatch("click");
  assert.equal(controller.preferences.railOpening, RailOpening.ALWAYS);
  assert.equal(select.value, RailOpening.ALWAYS);
});

test("the Action bar tab lists list tools before watch actions, as the bar does", (t) => {
  const { view } = settingsFixture(t);
  view.ensure();
  const actions = view.panels.get("actions");
  const headings = [...actions.querySelectorAll("h3")].map((heading) => view.labels.get(heading));
  assert.deepEqual(headings, [UiMessage.RAIL_ACTIONS_LABEL, UiMessage.WATCH_ACTIONS_LABEL]);
  const kinds = [...view.actions.keys()];
  assert.deepEqual(kinds.slice(0, 4), ["locate", "start", "refresh", "search"]);
  assert.equal(kinds[4], WatchActionKind.LIKE);
  const more = [...view.inputs.keys()].find((input) => input.name === "moreButton");
  const children = actions.children;
  const lastWatchRow = view.actions.get(kinds.at(-1)).button.parentElement;
  assert.ok(children.indexOf(lastWatchRow) < children.findIndex((child) => child.contains(more)),
    "the More switch follows the watch actions, as More does on the bar");
  assert.ok(children.at(-2).contains(more));
  assert.equal(children.at(-1).className, "bibilili-settings-hint");
});

test("source order keeps saved kinds once and appends missing kinds canonically", () => {
  const canonical = SettingsPreference.defaults().sourceOrder;
  assert.deepEqual(canonical, ["parts", "collection", "recommendations", "favorites", "watch_later", "history"]);
  assert.deepEqual(SettingsPreference.normalize({ sourceOrder: ["history", "unknown", "parts", "history", 3] }).sourceOrder,
    ["history", "parts", "collection", "recommendations", "favorites", "watch_later"]);
  for (const sourceOrder of [undefined, "history", {}, []]) {
    assert.deepEqual(SettingsPreference.normalize({ sourceOrder }).sourceOrder, canonical);
  }
});

test("the dock follows the saved source order and reorders without reloading account lists", (t) => {
  const { controller, layout, anchor } = settingsFixture(t);
  t.mock.method(layout, "markSourceRoots", () => {});
  t.mock.method(layout, "renderSourceDock", () => {});
  const history = { kind: SourceKind.HISTORY, root: null, items: [{ targetUrl: "https://example.test/h", title: "H" }] };
  const recommendations = { kind: SourceKind.RECOMMENDATIONS, root: null,
    items: [{ targetUrl: "https://example.test/r", title: "R" }] };
  const sourceOrder = ["history", "parts", "collection", "recommendations", "favorites", "watch_later"];
  controller.setPreferences({ ...controller.preferences, sourceOrder });
  assert.equal(controller.scheduleReconcile.mock.callCount(), 1);
  assert.equal(controller.refreshAccountSources.mock.callCount(), 0);
  layout.setSources([recommendations, history], true, anchor, null);
  assert.deepEqual(layout.currentSources, [history, recommendations]);
  assert.equal(layout.selectedSourceKind, SourceKind.HISTORY, "the first source with items is the default route");
  controller.setPreferences({ ...controller.preferences, sourceOrder });
  assert.equal(controller.scheduleReconcile.mock.callCount(), 1, "an unchanged order does not reconcile");
});

/**
 * Opens the Rail tab with a geometry model: trays are 60px tall at y 0 and
 * 100, and chips are 90px wide on a 100px pitch. Visual boxes include an
 * inline translate; layout offsets ignore it.
 */
function sourceTrays(t, { reducedMotion = false } = {}) {
  const fixture = settingsFixture(t);
  const { view, document } = fixture;
  document.defaultView = { matchMedia: () => ({ matches: reducedMotion }) };
  view.ensure();
  view.panel.root.hidden = false;
  t.mock.method(view.panel, "position", () => {});
  view.selectTab("rail");
  const arrangement = view.sourceArrangement;
  const trayTop = new Map([[arrangement.shown, 0], [arrangement.hidden, 100]]);
  for (const tray of trayTop.keys()) {
    tray.clientLeft = 0;
    tray.clientTop = 0;
    tray.getBoundingClientRect = () => ({ left: 0, top: trayTop.get(tray), bottom: trayTop.get(tray) + 60 });
  }
  const animations = [];
  for (const chip of arrangement.chips.values()) {
    Object.defineProperties(chip, {
      offsetLeft: { get: () => 8 + chip.parentElement.children.indexOf(chip) * 100 },
      offsetTop: { value: 8 },
      offsetWidth: { value: 90 },
      offsetHeight: { value: 30 }
    });
    chip.getBoundingClientRect = () => {
      const [dx = 0, dy = 0] = (chip.style.transform?.match(/-?[\d.]+/g) ?? []).map(Number);
      return { left: chip.offsetLeft + dx, top: trayTop.get(chip.parentElement) + 8 + dy, width: 90, height: 30 };
    };
    chip.animate = (keyframes) => {
      animations.push([chip.dataset.sourceKind, keyframes[0].transform]);
      return { finished: Promise.resolve(), cancel() {} };
    };
  }
  arrangement.root.captures = [];
  arrangement.root.setPointerCapture = (pointerId) => arrangement.root.captures.push(pointerId);
  const chip = (kind) => arrangement.chips.get(kind);
  const pointer = (type, kind, pointerId, clientX, clientY, button = 0) => arrangement.root.dispatch(type, {
    target: kind ? chip(kind) : arrangement.root, pointerId, clientX, clientY, button
  });
  return { ...fixture, arrangement, animations, chip, pointer, trays: () => arrangement.arrangement() };
}

const DEFAULT_SOURCES = ["parts", "collection", "recommendations", "favorites", "watch_later", "history"];

test("source chips mirror saved visibility and order, and Reset restores both", (t) => {
  const { view, controller, trays, chip } = sourceTrays(t);
  assert.deepEqual(trays(), { shown: DEFAULT_SOURCES, hidden: [] });
  assert.equal(chip(SourceKind.PARTS).textContent, "Parts");
  assert.ok(chip(SourceKind.PARTS).className.includes("bibilili-source-button"), "chips use the source bar style");
  assert.equal(view.sourceArrangement.hidden.dataset.emptyLabel, "Drag sources here to hide them");
  const focused = chip(SourceKind.HISTORY);
  focused.focus();
  SettingsPreference.write({ ...controller.preferences,
    sources: { ...controller.preferences.sources, parts: false },
    sourceOrder: ["history", "recommendations", "parts", "collection", "favorites", "watch_later"] });
  controller.onStorageChange({ key: SettingsPreference.key, storageArea: global.localStorage });
  assert.deepEqual(trays(), {
    shown: ["history", "recommendations", "collection", "favorites", "watch_later"], hidden: ["parts"]
  });
  assert.equal(view.document.activeElement, focused, "a moved chip keeps focus");
  view.panel.root.querySelector(".bibilili-settings-section-reset").dispatch("click");
  assert.deepEqual(trays(), { shown: DEFAULT_SOURCES, hidden: [] });
  assert.deepEqual(controller.preferences.sourceOrder, DEFAULT_SOURCES);
  assert.ok(Object.values(controller.preferences.sources).every(Boolean));
  assert.equal(controller.preferences.railOpening, RailOpening.ALWAYS, "Reset leaves other settings alone");
});

test("clicking a chip moves it to the end of the other tray and animates displaced chips", (t) => {
  const { controller, trays, chip, animations } = sourceTrays(t);
  chip(SourceKind.COLLECTION).dispatch("click");
  assert.deepEqual(trays(), {
    shown: ["parts", "recommendations", "favorites", "watch_later", "history"], hidden: ["collection"]
  });
  assert.equal(controller.preferences.sources.collection, false);
  assert.deepEqual(controller.preferences.sourceOrder, [...trays().shown, ...trays().hidden]);
  assert.deepEqual(SettingsPreference.read().sourceOrder, controller.preferences.sourceOrder);
  assert.equal(controller.refreshAccountSources.mock.callCount(), 1, "visibility changes reload account lists");
  assert.deepEqual(animations, [
    ["collection", "translate(100px, -100px)"],
    ["recommendations", "translate(100px, 0px)"],
    ["favorites", "translate(100px, 0px)"],
    ["watch_later", "translate(100px, 0px)"],
    ["history", "translate(100px, 0px)"]
  ]);
  chip(SourceKind.COLLECTION).dispatch("click");
  assert.deepEqual(trays().shown.at(-1), "collection");
  assert.equal(controller.preferences.sources.collection, true);
});

test("reduced motion moves chips without animation", (t) => {
  const { chip, trays, animations } = sourceTrays(t, { reducedMotion: true });
  chip(SourceKind.PARTS).dispatch("click");
  assert.deepEqual(trays().hidden, ["parts"]);
  assert.deepEqual(animations, []);
});

test("arrow keys reorder chips, move them between trays, and keep focus", (t) => {
  const { controller, trays, chip, document } = sourceTrays(t);
  const favorites = chip(SourceKind.FAVORITES);
  favorites.focus();
  let prevented = 0;
  const key = (value) => favorites.dispatch("keydown", { key: value, preventDefault() { prevented += 1; } });
  key("ArrowLeft");
  assert.deepEqual(trays().shown, ["parts", "collection", "favorites", "recommendations", "watch_later", "history"]);
  assert.deepEqual(controller.preferences.sourceOrder, trays().shown);
  assert.equal(document.activeElement, favorites);
  key("ArrowDown");
  assert.deepEqual(trays(), {
    shown: ["parts", "collection", "recommendations", "watch_later", "history"], hidden: ["favorites"]
  });
  assert.equal(controller.preferences.sources.favorites, false);
  assert.equal(document.activeElement, favorites);
  key("ArrowDown");
  key("ArrowRight");
  assert.deepEqual(trays().hidden, ["favorites"], "moves past a tray edge are ignored");
  key("ArrowUp");
  assert.deepEqual(trays().shown, ["favorites", "parts", "collection", "recommendations", "watch_later", "history"]);
  assert.equal(controller.preferences.sources.favorites, true);
  key("Tab");
  assert.equal(prevented, 5);
});

test("a chip drag follows the pointer, previews its slot, and commits on release", (t) => {
  const { arrangement, controller, trays, chip, pointer } = sourceTrays(t);
  const history = chip(SourceKind.HISTORY);
  pointer("pointerdown", SourceKind.HISTORY, 7, 550, 20);
  pointer("pointermove", null, 7, 553, 20);
  assert.equal(arrangement.drag, null, "small movement stays a click");
  pointer("pointermove", null, 7, 250, 20);
  assert.deepEqual(arrangement.root.captures, [7]);
  assert.deepEqual(trays().shown, ["parts", "collection", "history", "recommendations", "favorites", "watch_later"]);
  assert.equal(history.style.transform, "translate(0px, 0px)", "the grab point stays under the pointer");
  pointer("pointermove", null, 7, 260, 25);
  assert.equal(history.style.transform, "translate(10px, 5px)");
  assert.deepEqual(SettingsPreference.read().sourceOrder, DEFAULT_SOURCES, "the preview is not saved");
  controller.onStorageChange({ key: SettingsPreference.key, storageArea: global.localStorage });
  assert.equal(trays().shown[2], "history", "reconciliation keeps the drag preview");
  pointer("pointermove", null, 8, 0, 130);
  assert.equal(trays().shown[2], "history", "other pointers are ignored");
  pointer("pointermove", null, 7, 100, 130);
  assert.deepEqual(trays(), {
    shown: ["parts", "collection", "recommendations", "favorites", "watch_later"], hidden: ["history"]
  });
  pointer("pointerup", null, 7, 100, 130);
  pointer("lostpointercapture", null, 7, 100, 130);
  assert.equal(history.style.transform, "");
  assert.equal(controller.preferences.sources.history, false);
  assert.deepEqual(controller.preferences.sourceOrder, [...trays().shown, ...trays().hidden]);
  history.dispatch("click");
  assert.deepEqual(trays().hidden, ["history"], "the click that ends a drag does not toggle");
  arrangement.dragEndedAt = -Infinity;
  history.dispatch("click");
  assert.deepEqual(trays().hidden, []);
});

test("a canceled chip drag restores the previous arrangement without saving", (t) => {
  const { arrangement, controller, trays, chip, pointer } = sourceTrays(t);
  pointer("pointerdown", SourceKind.PARTS, 3, 50, 20);
  pointer("pointermove", null, 3, 50, 130);
  assert.deepEqual(trays().hidden, ["parts"]);
  pointer("pointercancel", null, 3, 50, 130);
  assert.deepEqual(trays(), { shown: DEFAULT_SOURCES, hidden: [] });
  assert.equal(chip(SourceKind.PARTS).style.transform, "");
  assert.equal(controller.preferences.sources.parts, true);
  assert.equal(arrangement.drag, null);
  pointer("pointerdown", SourceKind.PARTS, 4, 50, 20, 2);
  pointer("pointermove", null, 4, 50, 130);
  assert.equal(arrangement.drag, null, "secondary buttons do not drag");
});

test("account continuation reports the revealed count for auto-load progress", async (t) => {
  const { controller } = settingsFixture(t);
  t.mock.method(controller.accountSources, "loadMore", async () => {});
  t.mock.method(controller.accountSources, "currentSource", () => ({ items: [1, 2, 3] }));
  assert.equal(await controller.loadMoreAccountSource(SourceKind.HISTORY), 3);
});

test("the direct-favorite switch uses the shared settings row and persistence", (t) => {
  const { view, controller } = settingsFixture(t);
  view.ensure();
  view.render();
  const input = [...view.inputs.keys()].find((input) => input.name === "favoriteToSelectedFolder");
  assert.equal(input.checked, true);
  assert.ok(view.panels.get("features").contains(input));
  input.checked = false;
  input.dispatch("change");
  assert.equal(controller.preferences.features.favoriteToSelectedFolder, false);
  assert.equal(SettingsPreference.read().features.favoriteToSelectedFolder, false);
  controller.setPreferences(SettingsPreference.defaults());
  assert.equal(input.checked, true);
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
  assert.equal(layout.moreRailGroup.nextSibling, layout.moreWatchGroup, "More lists list tools first");
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

test("the source bar orders list tools before watch actions and keeps utilities last", (t) => {
  const { layout, anchor } = settingsFixture(t);
  const activationControl = { mountDocked: () => anchor };
  for (let pass = 0; pass < 2; pass += 1) {
    layout.renderSourceBar([], activationControl);
    layout.renderControlPlacement();
    assert.equal(anchor.nextSibling, layout.railActionGroup);
    assert.equal(layout.railActionGroup.nextSibling, layout.actionGroup);
    assert.equal(layout.actionGroup.nextSibling, layout.dockUtilityGroup);
    assert.equal(layout.sourceBar.lastChild, layout.dockUtilityGroup);
  }
});

test("Search is on the bar by default and moves to More when unpinned", (t) => {
  const { layout, controller } = settingsFixture(t);
  layout.renderControlPlacement();
  assert.equal(layout.railSearchButton.parentElement, layout.railActionGroup);
  assert.equal(
    layout.railSearchButton.querySelector(".bibilili-action-label").textContent,
    UiStrings.message(UiMessage.RAIL_SEARCH_LABEL, "en")
  );

  controller.setPreferences({
    ...controller.preferences,
    pinnedActions: { ...controller.preferences.pinnedActions, search: false }
  });
  layout.renderControlPlacement();
  assert.equal(layout.railSearchButton.parentElement, layout.moreRailGroup);
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

test("Search stays in More while its placement preference is off", (t) => {
  const { layout, controller } = settingsFixture(t);
  controller.preferences.pinnedActions.search = false;
  layout.renderControlPlacement();
  assert.equal(layout.railSearchButton.parentElement, layout.moreRailGroup);

  controller.preferences.pinnedActions.search = true;
  layout.renderControlPlacement();
  assert.equal(layout.railSearchButton.parentElement, layout.railActionGroup);
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
  preferences.language = UiLanguage.TRADITIONAL_CHINESE;
  SettingsPreference.write(preferences);
  t.mock.method(SettingsPreference, "write", () => { throw new Error("unexpected write"); });
  controller.onStorageChange({ key: SettingsPreference.key, storageArea: global.localStorage });
  assert.equal(controller.preferences.sources.history, false);
  assert.equal(controller.uiLanguage, UiLanguage.TRADITIONAL_CHINESE);
  assert.equal(controller.settingsView.language, UiLanguage.TRADITIONAL_CHINESE);
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
