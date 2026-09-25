const assert = require("node:assert/strict");
const test = require("node:test");
const { FakeStorage, ThrowingStorage, loadContentRuntime } = require("./helpers/content-runtime.js");
const { railFixture } = require("./helpers/rail-dom.js");
const { AccountSourceStore, BibililiController, LayoutRoot, SourceKind, WatchActionKind } = loadContentRuntime();
const { OperationHistory, OperationKind } = global.__bibililiOperationHistory;
const { SettingsPreference, SettingsTab, SettingsTabPreference } = global.__bibililiStorageState;
const { UiStrings, UiMessage, UiLanguage } = global.__bibililiI18n;
const TARGET = "https://www.bilibili.com/video/av123";
const details = { targetUrl: TARGET, title: "Original video", aid: "123", accountId: "77", folderId: "101" };
const settle = () => new Promise(setImmediate);

test.before(async (t) => {
  t.mock.method(global, "fetch", async (url) => ({ ok: true, json: async () => require(`../${url}`) }));
  await UiStrings.loadSupported();
});

/** Uses real history, settings, and account mutation code with bounded DOM and API fixtures. */
function fixture(t) {
  const previous = { localStorage: global.localStorage, sessionStorage: global.sessionStorage,
    href: global.location.href };
  global.localStorage = new FakeStorage();
  global.sessionStorage = new FakeStorage();
  global.location.href = TARGET;
  t.after(() => {
    global.localStorage = previous.localStorage;
    global.sessionStorage = previous.sessionStorage;
    global.location.href = previous.href;
  });
  const { document } = railFixture(LayoutRoot, 0);
  const controller = new BibililiController(document);
  const view = controller.settingsView;
  const store = controller.operationHistory;
  controller.layout.root = document.body;
  controller.accountSources.language = "en";
  t.mock.method(controller, "refreshAccountSources", () => {});
  t.mock.method(controller, "scheduleReconcile", () => {});
  t.mock.method(view.panel, "position", () => {});
  t.mock.method(AccountSourceStore, "csrfToken", () => "test-csrf");
  const fetch = t.mock.method(AccountSourceStore, "fetchApiPayload", async () =>
    ({ code: 0, data: { isLogin: true, mid: 77 } }));
  const post = t.mock.method(AccountSourceStore, "postApiPayload", async () => ({ code: 0 }));
  view.ensure();
  view.panel.root.hidden = false;
  view.render();
  return { controller, view, store, document, fetch, post, enable: () => {
    controller.setPreferences({ ...controller.preferences,
      features: { ...controller.preferences.features, operationHistory: true, performance: true } });
    view.selectTab(SettingsTab.OPERATION_HISTORY);
    return view.operationHistoryView;
  } };
}

test("history is opt-in, precedes Performance, and unavailable tabs are skipped by keyboard", (t) => {
  const { controller, view, document, enable } = fixture(t);
  assert.equal(view.tabs.get(SettingsTab.OPERATION_HISTORY).hidden, true);
  assert.equal(view.operationHistoryView.root, null);
  assert.equal(SettingsPreference.defaults().features.operationHistory, false);
  const historyView = enable();
  assert.deepEqual([...view.tabs.keys()], ["features", "actions", "operation_history", "performance"]);
  assert.equal(view.tabs.get(SettingsTab.OPERATION_HISTORY).hidden, false);
  assert.equal(historyView.empty.hidden, false);
  assert.equal(SettingsTabPreference.read(), SettingsTab.OPERATION_HISTORY);
  assert.equal(SettingsPreference.read().features.operationHistory, true);
  assert.equal(controller.scheduleReconcile.mock.callCount(), 0);
  assert.equal(controller.refreshAccountSources.mock.callCount(), 0);
  view.tabs.get(SettingsTab.OPERATION_HISTORY).focus();
  controller.setPreferences({ ...controller.preferences,
    features: { ...controller.preferences.features, operationHistory: false } });
  assert.equal(view.tab, SettingsTab.FEATURES);
  assert.equal(document.activeElement, view.tabs.get(SettingsTab.FEATURES));
  view.tabs.get(SettingsTab.FEATURES).dispatch("keydown", { key: "End", preventDefault() {} });
  assert.equal(view.tab, SettingsTab.PERFORMANCE);
  view.tabs.get(SettingsTab.PERFORMANCE).dispatch("keydown", { key: "ArrowLeft", preventDefault() {} });
  assert.equal(view.tab, SettingsTab.ACTIONS);
});

test("visits are deduplicated during reconciliation and bounded records survive page loads", (t) => {
  const { store, enable } = fixture(t);
  store.visit(TARGET, "Disabled");
  assert.equal(store.entries.length, 0);
  enable();
  store.visit(TARGET, "First title");
  store.visit(`${TARGET}?tracking=ignored`, "Later title");
  assert.equal(store.entries.length, 1);
  store.visit(`${TARGET}?p=2`, "Part two");
  assert.equal(store.entries.length, 2);
  assert.equal(store.entries[0].title, "Part two");
  for (let i = 0; i < 120; i += 1) {
    store.visit(`https://www.bilibili.com/video/av${i + 1}`, `Video ${i}`);
  }
  assert.equal(store.entries.length, 100);
  const restored = new OperationHistory(() => {});
  assert.equal(restored.entries.length, 100);
  assert.equal(restored.entries[0].title, "Video 119");
  store.setEnabled(false);
  store.record(OperationKind.REMOVE, details);
  assert.equal(store.entries.length, 100);
});

test("invalid stored records are ignored and blocked storage leaves undo usable", async (t) => {
  const { store, enable } = fixture(t);
  enable();
  store.record(OperationKind.FAVORITE, details);
  const entry = store.entries[0];
  global.sessionStorage.setItem("bibilili:operation-history", JSON.stringify([
    { ...entry, aid: {} }, { ...entry, targetUrl: "javascript:alert(1)" },
    { ...entry, createdAt: 1e20 }, { ...entry, kind: "unknown" }, entry, entry
  ]));
  assert.equal(new OperationHistory(() => {}).entries.length, 1);
  global.sessionStorage = new ThrowingStorage();
  const history = new OperationHistory(() => {});
  history.setEnabled(true);
  history.record(OperationKind.REMOVE, details);
  await history.toggle(history.entries[0].id, async () => {});
  assert.equal(history.entries[0].undone, true);
});

test("history capacity accepts only its four choices and restores the saved limit before loading records", (t) => {
  const { controller, store } = fixture(t);
  for (const operationHistoryLimit of [10, 20, 100, 500]) {
    assert.equal(SettingsPreference.normalize({ operationHistoryLimit }).operationHistoryLimit, operationHistoryLimit);
  }
  for (const operationHistoryLimit of [0, 11, 50, 501, "20", null, {}, undefined]) {
    assert.equal(SettingsPreference.normalize({ operationHistoryLimit }).operationHistoryLimit, 100);
  }
  controller.setPreferences({ ...controller.preferences, operationHistoryLimit: 500 });
  store.setEnabled(true);
  for (let i = 0; i < 510; i += 1) store.visit(`https://www.bilibili.com/video/av${i + 1}`, `Video ${i}`);
  assert.equal(store.entries.length, 500);
  assert.equal(store.entries[0].title, "Video 509");
  assert.equal(store.entries.at(-1).title, "Video 10");
  const reloaded = new BibililiController(controller.document);
  assert.equal(reloaded.operationHistory.limit, 500);
  assert.equal(reloaded.operationHistory.entries.length, 500);
  SettingsPreference.write({ ...controller.preferences, operationHistoryLimit: 20 });
  const reduced = new BibililiController(controller.document);
  assert.equal(reduced.operationHistory.entries.length, 20);
  assert.equal(JSON.parse(global.sessionStorage.getItem("bibilili:operation-history")).length, 20);
});

test("size drafts survive input, change, and reconciliation and only trim and persist on blur", (t) => {
  const { controller, store, view, document, enable } = fixture(t);
  const history = enable();
  for (let i = 0; i < 30; i += 1) store.visit(`https://www.bilibili.com/video/av${i + 1}`, `Video ${i}`);
  const slider = history.sizeInput;
  assert.equal(slider.type, "range");
  assert.equal(slider.value, "2");
  assert.equal(slider.getAttribute("aria-valuetext"), "100");
  slider.focus();
  for (const [position, limit] of [[0, 10], [3, 500], [1, 20]]) {
    slider.value = String(position);
    slider.dispatch("input");
    slider.dispatch("change");
    view.render();
    assert.equal(history.sizeValue.textContent, String(limit));
    assert.equal(slider.getAttribute("aria-valuetext"), String(limit));
    assert.equal(store.limit, 100);
    assert.equal(store.entries.length, 30);
    assert.equal(SettingsPreference.read().operationHistoryLimit, 100);
    assert.equal(JSON.parse(global.sessionStorage.getItem("bibilili:operation-history")).length, 30);
  }
  store.visit("https://www.bilibili.com/video/av31", "New while editing");
  assert.equal(slider.value, "1");
  assert.equal(store.entries.length, 31);
  document.body.focus();
  slider.dispatch("blur");
  assert.equal(store.limit, 20);
  assert.equal(store.entries.length, 20);
  assert.equal(store.entries[0].title, "New while editing");
  assert.equal(history.rows.size, 20);
  assert.equal(history.sizeInput, slider);
  assert.equal(SettingsPreference.read().operationHistoryLimit, 20);
  assert.equal(controller.refreshAccountSources.mock.callCount(), 0);
  assert.equal(controller.scheduleReconcile.mock.callCount(), 0);
});

test("clear empties and persists history without repeating the current visit or changing account data", (t) => {
  const { controller, store, enable, post } = fixture(t);
  const history = enable();
  assert.equal(history.clearButton.disabled, true);
  controller.setPreferences({ ...controller.preferences, operationHistoryLimit: 20 });
  store.visit(TARGET, "Current video");
  store.record(OperationKind.FAVORITE, details);
  store.record(OperationKind.REMOVE, details);
  assert.equal(history.clearButton.disabled, false);
  history.clearButton.dispatch("click");
  assert.equal(store.entries.length, 0);
  assert.equal(history.rows.size, 0);
  assert.equal(history.empty.hidden, false);
  assert.equal(history.clearButton.disabled, true);
  assert.deepEqual(JSON.parse(global.sessionStorage.getItem("bibilili:operation-history")), []);
  assert.equal(new OperationHistory(() => {}, 20).entries.length, 0);
  assert.equal(SettingsPreference.read().operationHistoryLimit, 20);
  assert.equal(post.mock.callCount(), 0);
  store.visit(TARGET, "Still current");
  assert.equal(store.entries.length, 0);
  store.visit("https://www.bilibili.com/video/av456", "Next video");
  assert.equal(store.entries.length, 1);
});

test("shrinking retains an in-flight operation and clear waits for it to settle", async (t) => {
  const { controller, store, enable } = fixture(t);
  const history = enable();
  store.record(OperationKind.FAVORITE, details);
  const entry = store.entries[0];
  let finish;
  const pending = store.toggle(entry.id, () => new Promise((resolve) => { finish = resolve; }));
  for (let i = 0; i < 30; i += 1) store.visit(`https://www.bilibili.com/video/av${i + 1}`, `Video ${i}`);
  controller.setPreferences({ ...controller.preferences, operationHistoryLimit: 10 });
  assert.equal(store.entries.length, 10);
  assert.equal(store.entries.at(-1), entry);
  assert.equal(history.rows.get(entry.id).loading.hidden, false);
  assert.equal(history.clearButton.disabled, true);
  store.clear();
  assert.equal(store.entries.length, 10);
  finish();
  await pending;
  assert.equal(entry.undone, true);
  assert.equal(history.clearButton.disabled, false);
  history.clearButton.dispatch("click");
  assert.equal(store.entries.length, 0);
});

test("history size survives blocked storage for the page and clear remains usable", (t) => {
  const { controller, store, enable } = fixture(t);
  const history = enable();
  store.visit(TARGET, "Current video");
  global.localStorage = new ThrowingStorage();
  global.sessionStorage = new ThrowingStorage();
  history.sizeInput.value = "0";
  history.sizeInput.dispatch("input");
  history.sizeInput.dispatch("blur");
  assert.equal(store.limit, 10);
  assert.equal(controller.settingsView.statusKey, UiMessage.SETTINGS_PAGE_ONLY_LABEL);
  history.clearButton.dispatch("click");
  assert.equal(store.entries.length, 0);
});

test("undo uses the shared loading bar, serializes clicks, then shows a check and Redo", async (t) => {
  const { store, view, enable, document } = fixture(t);
  const historyView = enable();
  store.record(OperationKind.FAVORITE, details);
  const entry = store.entries[0];
  const parts = historyView.rows.get(entry.id);
  assert.equal(parts.button.getAttribute("aria-label"), "Undo");
  assert.equal(parts.button.title, "Undo");
  const undoIcon = parts.button.firstChild;
  assert.equal(undoIcon.getAttribute("aria-hidden"), "true");
  const undoPath = undoIcon.firstChild.getAttribute("d");
  assert.equal(parts.check.style.display, "none");
  parts.button.focus();
  let finish;
  const apply = t.mock.fn(() => new Promise((resolve) => { finish = resolve; }));
  const pending = store.toggle(entry.id, apply);
  assert.equal(parts.loading.hidden, false);
  assert.ok(parts.loading.classList.contains("bibilili-loading-view"));
  assert.ok(parts.loading.querySelector(".bibilili-loading-indicator"));
  assert.equal(parts.button.getAttribute("aria-busy"), "true");
  assert.equal(parts.button.disabled, true);
  await store.toggle(entry.id, apply);
  assert.equal(apply.mock.callCount(), 1);
  finish();
  await pending;
  assert.equal(parts.loading.hidden, true);
  assert.equal(parts.feedback.dataset.state, "success");
  assert.equal(parts.check.style.display, "");
  assert.equal(parts.button.getAttribute("aria-label"), "Redo");
  assert.equal(parts.button.title, "Redo");
  assert.notEqual(parts.button.firstChild.firstChild.getAttribute("d"), undoPath);
  assert.equal(parts.button.disabled, false);
  assert.equal(document.activeElement, parts.button);
  view.render();
  assert.equal(historyView.rows.get(entry.id).button, parts.button);
  assert.equal(new OperationHistory(() => {}).entries[0].undone, true);
  await store.toggle(entry.id, async (_entry, undo) => assert.equal(undo, false));
  assert.equal(parts.button.getAttribute("aria-label"), "Undo");
  assert.equal(parts.button.firstChild.firstChild.getAttribute("d"), undoPath);
  assert.equal(parts.message.textContent, "Redone");
});

test("failed undo and redo retain their retry buttons and display the error beside them", async (t) => {
  const { store, enable } = fixture(t);
  const view = enable();
  store.record(OperationKind.REMOVE, details);
  const entry = store.entries[0];
  const parts = view.rows.get(entry.id);
  const fail = async () => { throw new Error("Request denied"); };
  await store.toggle(entry.id, fail);
  assert.equal(entry.undone, false);
  assert.equal(parts.feedback.dataset.state, "error");
  assert.equal(parts.message.textContent, "Request denied");
  assert.equal(parts.button.getAttribute("aria-label"), "Undo");
  assert.equal(parts.button.disabled, false);
  assert.equal(parts.check.style.display, "none");
  await store.toggle(entry.id, async () => {});
  await store.toggle(entry.id, fail);
  assert.equal(entry.undone, true);
  assert.equal(parts.button.getAttribute("aria-label"), "Redo");
});

test("favorite undo and redo use the recorded folder and reject changed accounts before posting", async (t) => {
  const { controller, store, enable, post, fetch } = fixture(t);
  enable();
  store.record(OperationKind.FAVORITE, details);
  const entry = store.entries[0];
  controller.accountSources.records.get(SourceKind.FAVORITES).folderId = "202";
  const toggle = () => store.toggle(entry.id, (entry, undo) => controller.applyHistoryOperation(entry, undo));
  await toggle();
  assert.equal(entry.undone, true);
  let [url, body] = post.mock.calls[0].arguments;
  assert.equal(url, "https://api.bilibili.com/x/v3/fav/resource/deal");
  assert.equal(body.get("rid"), "123");
  assert.equal(body.get("del_media_ids"), "101");
  assert.equal(body.get("add_media_ids"), "");
  await toggle();
  body = post.mock.calls[1].arguments[1];
  assert.equal(body.get("add_media_ids"), "101");
  assert.equal(body.get("del_media_ids"), "");
  assert.equal(entry.undone, false);
  assert.equal(store.entries.length, 1);
  fetch.mock.mockImplementation(async () => ({ code: 0, data: { isLogin: true, mid: 88 } }));
  await toggle();
  assert.equal(post.mock.callCount(), 2);
  assert.equal(entry.undone, false);
  assert.match(entry.error, /account that performed/);
  fetch.mock.mockImplementation(async () => ({ code: 0, data: { isLogin: true, mid: 77 } }));
  post.mock.mockImplementation(async () => ({ code: -400, message: "Folder no longer exists" }));
  await toggle();
  assert.equal(entry.undone, false);
  assert.equal(entry.error, "Folder no longer exists");
});

test("a rail removal is recorded after success, restored by undo, and removed again by redo", async (t) => {
  const { controller, store, enable, post } = fixture(t);
  enable();
  const account = controller.accountSources;
  const record = account.records.get(SourceKind.WATCH_LATER);
  const item = { ...details, watchLaterAid: details.aid };
  record.items = [item];
  record.watchLaterCount = 1;
  t.mock.method(AccountSourceStore, "fetchSourceRecord", async () =>
    ({ source: { items: [item] }, watchLaterCount: 1, cursor: null }));
  await controller.deleteWatchLaterItem("123");
  assert.equal(record.items.length, 0);
  assert.equal(store.entries.length, 1);
  const entry = store.entries[0];
  assert.equal(entry.title, "Original video");
  assert.equal(entry.kind, OperationKind.REMOVE);
  const apply = (entry, undo) => controller.applyHistoryOperation(entry, undo);
  await store.toggle(entry.id, apply);
  assert.equal(entry.undone, true);
  assert.equal(record.items.length, 1);
  assert.ok(post.mock.calls[1].arguments[0].endsWith("/toview/add"));
  assert.equal(post.mock.calls[1].arguments[1].get("aid"), "123");
  await store.toggle(entry.id, apply);
  assert.equal(entry.undone, false);
  assert.equal(record.items.length, 0);
  assert.equal(store.entries.length, 1);
  post.mock.mockImplementation(async () => ({ code: -400, message: "Request denied" }));
  await assert.rejects(controller.deleteWatchLaterItem("456"));
  assert.equal(store.entries.length, 1);
});

test("visits have no undo, and disabling history during account verification prevents a new write", async (t) => {
  const { controller, store, enable, fetch, post } = fixture(t);
  const view = enable();
  store.visit(TARGET, "Visit");
  const visited = store.entries[0];
  assert.equal(view.rows.get(visited.id).actions.hidden, true);
  const unexpected = t.mock.fn();
  await store.toggle(visited.id, unexpected);
  assert.equal(unexpected.mock.callCount(), 0);
  store.record(OperationKind.REMOVE, details);
  const entry = store.entries[0];
  let finish;
  fetch.mock.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  const pending = store.toggle(entry.id, (entry, undo) => controller.applyHistoryOperation(entry, undo));
  store.setEnabled(false);
  finish({ code: 0, data: { isLogin: true, mid: 77 } });
  await pending;
  assert.equal(post.mock.callCount(), 0);
  assert.equal(entry.undone, false);
  assert.equal(entry.pending, false);
});

test("a submitted favorite save records its original video even after navigation", async (t) => {
  const { controller, store, document, enable } = fixture(t);
  enable();
  t.mock.method(controller.discovery, "findWatchTitle", () => "Captured title");
  controller.accountSources.favoriteFolders.accountId = "77";
  controller.accountSources.records.get(SourceKind.FAVORITES).folderId = "101";
  const trigger = document.createElement("button");
  document.body.append(trigger);
  let finish;
  t.mock.method(controller.accountSources, "addFavoriteItem", () => new Promise((resolve) => { finish = resolve; }));
  controller.handleFavoriteAction({ kind: WatchActionKind.FAVORITE, trigger, isActive: false });
  global.location.href = "https://www.bilibili.com/video/av456";
  controller.clearFavoriteActionState();
  finish({ aid: "123", accountId: "77", folderId: "101", alreadySaved: false });
  await settle();
  assert.equal(store.entries.length, 1);
  assert.equal(store.entries[0].targetUrl, TARGET);
  assert.equal(store.entries[0].title, "Captured title");
  assert.equal(controller.favoriteActionState, null);
});

test("undo and redo keep the current star consistent while its native visual is stale", async (t) => {
  const { controller, document, enable } = fixture(t);
  enable();
  const layout = controller.layout;
  const trigger = document.createElement("button");
  document.body.append(trigger);
  const action = { kind: WatchActionKind.FAVORITE, trigger, isActive: true };
  layout.currentActions = [action];
  const button = layout.watchActionButtonFor(WatchActionKind.FAVORITE);
  const favoriteStatus = t.mock.method(AccountSourceStore, "isFavorite", async () => false);
  await controller.syncHistoryFavoriteAction(details, false);
  controller.reconcileFavoriteAction([action]);
  assert.equal(button.getAttribute("aria-pressed"), "false");
  action.isActive = false;
  controller.reconcileFavoriteAction([action]);
  assert.equal(controller.favoriteActionState, null);
  await controller.syncHistoryFavoriteAction(details, true);
  controller.reconcileFavoriteAction([action]);
  assert.equal(button.getAttribute("aria-pressed"), "true");
  favoriteStatus.mock.mockImplementation(async () => true);
  await controller.syncHistoryFavoriteAction(details, false);
  assert.equal(button.getAttribute("aria-pressed"), "true", "other favorite folders still count");
});

for (const changePreference of [false, true]) {
  test(`a favorite click after undo ${changePreference ? "is canceled by a preference change" : "survives native state catching up"}`, async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { controller, document, enable } = fixture(t);
    enable();
    t.mock.method(AccountSourceStore, "isFavorite", async () => false);
    t.mock.method(controller.discovery, "findWatchTitle", () => "Current video");
    const trigger = document.createElement("button");
    document.body.append(trigger);
    const action = { kind: WatchActionKind.FAVORITE, trigger, isActive: true };
    await controller.syncHistoryFavoriteAction(details, false);
    const save = t.mock.method(controller.accountSources, "addFavoriteItem", async () =>
      ({ ...details, alreadySaved: false }));
    controller.handleFavoriteAction(action, { detail: 1 });
    action.isActive = false;
    controller.reconcileFavoriteAction([action]);
    if (changePreference) {
      controller.preferences.features.favoriteToSelectedFolder = false;
      controller.applyFeaturePreferences();
    }
    t.mock.timers.tick(1000);
    await settle();
    assert.equal(save.mock.callCount(), changePreference ? 0 : 1);
  });
}

test("all supported catalogs translate history actions and feedback", () => {
  for (const language of Object.values(UiLanguage)) {
    for (const name of Object.keys(UiMessage).filter((key) => key.startsWith("OPERATION_HISTORY_"))) {
      const key = UiMessage[name];
      assert.notEqual(UiStrings.message(key, language), key);
    }
  }
});
