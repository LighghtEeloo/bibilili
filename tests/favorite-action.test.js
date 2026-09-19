const assert = require("node:assert/strict");
const test = require("node:test");
const { FakeStorage, loadContentRuntime } = require("./helpers/content-runtime.js");
const { railFixture } = require("./helpers/rail-dom.js");
const { AccountSourceStore, BibililiController, LayoutRoot, SourceKind, WatchActionKind } = loadContentRuntime();
const { FavoriteFolderPreference } = global.__bibililiStorageState;

const FAVORITE = WatchActionKind.FAVORITE;
const settle = () => new Promise(setImmediate);

/** Uses the real click routing and button renderer with a controllable account save. */
function fixture(t, mockSave = true) {
  const previous = { localStorage: global.localStorage, href: global.location.href };
  global.localStorage = new FakeStorage();
  global.location.href = "https://www.bilibili.com/video/av123";
  const { document } = railFixture(LayoutRoot, 0);
  const controller = new BibililiController(document);
  t.mock.method(controller, "scheduleReconcile", () => {});
  const layout = controller.layout;
  layout.root = document.body;
  controller.preferences.features.favoriteToSelectedFolder = true;
  controller.accountSources.favoriteFolders.accountId = "77";
  controller.accountSources.favoriteFolders.items = [{ id: "101", title: "Selected" }];
  controller.accountSources.records.get(SourceKind.FAVORITES).folderId = "101";
  const trigger = document.createElement("button");
  document.body.append(trigger);
  const action = { kind: FAVORITE, trigger, isActive: false, countText: "42" };
  layout.currentActions = [action];
  layout.onFavoriteAction = (action) => controller.handleFavoriteAction(action);
  const button = layout.watchActionButtonFor(FAVORITE);
  button.querySelector(".bibilili-action-count").textContent = "42";
  document.body.append(button);
  layout.syncWatchActionButtonState(button);
  let resolve, reject;
  const pending = new Promise((yes, no) => { resolve = yes; reject = no; });
  const save = mockSave ? t.mock.method(controller.accountSources, "addFavoriteItem", () => pending) : null;
  const native = t.mock.method(LayoutRoot, "clickNativeTrigger", () => {});
  t.mock.method(LayoutRoot, "liftNativeWatchActionOverlay", () => {});
  t.after(() => {
    controller.clearFavoriteActionState();
    global.localStorage = previous.localStorage;
    global.location.href = previous.href;
  });
  return { controller, layout, document, action, trigger, button, save, native,
    click: () => layout.handleWatchActionButtonClick(FAVORITE),
    resolve: (result) => resolve({ accountId: "77", ...result }), reject };
}

test("an inactive star saves once to the captured folder, lights after success, then uses native handling", async (t) => {
  const { controller, button, trigger, save, native, click, resolve } = fixture(t);
  click();
  click();
  assert.equal(save.mock.callCount(), 1);
  const [url, folderId, canAdd] = save.mock.calls[0].arguments;
  assert.equal(url, "https://www.bilibili.com/video/av123");
  assert.equal(folderId, "101");
  assert.equal(canAdd(), true);
  assert.equal(button.disabled, true);
  assert.equal(button.getAttribute("aria-busy"), "true");
  assert.equal(button.getAttribute("aria-pressed"), "false");
  controller.accountSources.records.get(SourceKind.FAVORITES).folderId = "202";
  assert.equal(canAdd(), true);
  resolve({ aid: "123", alreadySaved: false });
  await settle();
  assert.equal(button.disabled, false);
  assert.equal(button.getAttribute("aria-busy"), "false");
  assert.equal(button.getAttribute("aria-pressed"), "true");
  assert.equal(button.querySelector(".bibilili-action-count").textContent, "42");
  assert.equal(trigger.attributes.size, 0);
  assert.equal(native.mock.callCount(), 0);
  click();
  assert.equal(native.mock.callCount(), 1);
  assert.equal(save.mock.callCount(), 1);
});

test("active native state always forwards, including changes since discovery", (t) => {
  const { action, trigger, save, native, click } = fixture(t);
  action.isActive = true;
  click();
  action.isActive = false;
  trigger.className = "on";
  click();
  trigger.className = "";
  trigger.setAttribute("title", "已收藏");
  click();
  assert.equal(native.mock.callCount(), 3);
  assert.equal(save.mock.callCount(), 0);
});

test("disabled direct saving uses the existing native path", (t) => {
  const { controller, save, native, click } = fixture(t);
  controller.preferences.features.favoriteToSelectedFolder = false;
  click();
  assert.equal(native.mock.callCount(), 1);
  assert.equal(save.mock.callCount(), 0);
});

test("hiding Favorites in settings retains its current folder and a pending save", async (t) => {
  const { controller, button, save, native, click, resolve } = fixture(t);
  controller.preferences.sources[SourceKind.FAVORITES] = false;
  controller.applyFeaturePreferences();
  click();
  assert.equal(controller.accountSources.currentSource(SourceKind.FAVORITES), null);
  assert.equal(save.mock.calls[0].arguments[1], "101");
  const [, , canAdd, signal] = save.mock.calls[0].arguments;
  controller.preferences.sources[SourceKind.FAVORITES] = true;
  controller.applyFeaturePreferences();
  controller.preferences.sources[SourceKind.FAVORITES] = false;
  controller.applyFeaturePreferences();
  assert.equal(signal.aborted, false);
  assert.equal(canAdd(), true);
  resolve({ aid: "123", alreadySaved: false });
  await settle();
  assert.equal(button.getAttribute("aria-pressed"), "true");
  assert.equal(native.mock.callCount(), 0);
});

for (const { name, sourceKind, isRailOpen, sourceEnabled, remembered, destination } of [
  { name: "another rail is open", sourceKind: SourceKind.WATCH_LATER, isRailOpen: true, sourceEnabled: true, remembered: "202", destination: "202" },
  { name: "the Favorites rail is closed", sourceKind: SourceKind.FAVORITES, isRailOpen: false, sourceEnabled: true, remembered: null, destination: "101" },
  { name: "the Favorites source is disabled", sourceKind: SourceKind.HISTORY, isRailOpen: true, sourceEnabled: false, remembered: "202", destination: "202" }
]) {
  test(`a fresh page restores the favorite destination without showing Favorites when ${name}`, async (t) => {
    const { controller, layout, action, button, native, click } = fixture(t, false);
    const store = controller.accountSources;
    store.stop();
    store.language = "en";
    controller.preferences.sources[SourceKind.FAVORITES] = sourceEnabled;
    controller.applyFeaturePreferences();
    FavoriteFolderPreference.write("77", remembered);
    layout.selectedSourceKind = sourceKind;
    layout.isRailOpen = isRailOpen;
    const requests = [];
    t.mock.method(AccountSourceStore, "fetchApiPayload", async (href) => {
      const url = new URL(href);
      requests.push(url.pathname);
      if (url.pathname.endsWith("/nav")) return { code: 0, data: { mid: 77, isLogin: true } };
      if (url.pathname.endsWith("/list-all")) {
        controller.reconcileFavoriteAction([action]);
        return { code: 0, data: { list: [
          { id: 101, title: "Default", attr: 0 }, { id: 202, title: "Selected", attr: 2 }
        ] } };
      }
      if (url.pathname.endsWith("/favoured")) return { code: 0, data: { favoured: false } };
      throw new Error(`Unexpected request: ${url.pathname}`);
    });
    t.mock.method(AccountSourceStore, "csrfToken", () => "test-csrf");
    const post = t.mock.method(AccountSourceStore, "postApiPayload", async () => ({ code: 0 }));
    click();
    assert.equal(button.disabled, true);
    await settle();
    assert.equal(post.mock.callCount(), 1);
    assert.equal(post.mock.calls[0].arguments[1].get("add_media_ids"), destination);
    assert.equal(store.currentFavoriteFolderId(), destination);
    assert.equal(store.favoriteFolders.requested, false);
    assert.equal(requests.includes("/x/v3/fav/resource/list"), false);
    assert.equal(button.getAttribute("aria-pressed"), "true");
    assert.equal(layout.selectedSourceKind, sourceKind);
    assert.equal(layout.isRailOpen, isRailOpen);
    assert.equal(controller.favoritesView.panel.isOpen, false);
    assert.equal(native.mock.callCount(), 0);
  });
}

test("account-confirmed favorites light the star and open native controls without another save", async (t) => {
  const { button, native, click, resolve } = fixture(t);
  click();
  resolve({ aid: "123", alreadySaved: true });
  await settle();
  assert.equal(native.mock.callCount(), 1);
  assert.equal(button.getAttribute("aria-pressed"), "true");
  assert.equal(button.disabled, false);
});

test("failed direct saves release the button and forward to native controls", async (t) => {
  const { button, native, click, reject } = fixture(t);
  click();
  reject(new Error("offline"));
  await settle();
  assert.equal(native.mock.callCount(), 1);
  assert.equal(button.disabled, false);
  assert.equal(button.getAttribute("aria-pressed"), "false");
});

test("disabling the setting cancels preparation and ignores its late completion", async (t) => {
  const { controller, button, save, native, click, resolve } = fixture(t);
  click();
  const [, , canAdd, signal] = save.mock.calls[0].arguments;
  controller.preferences.features.favoriteToSelectedFolder = false;
  controller.applyFeaturePreferences();
  assert.equal(signal.aborted, true);
  assert.equal(canAdd(), false);
  resolve({ aid: "123", alreadySaved: false });
  await settle();
  assert.equal(button.disabled, false);
  assert.equal(button.getAttribute("aria-pressed"), "false");
  assert.equal(native.mock.callCount(), 0);
});

test("navigation invalidates preparation and prevents late saves from lighting the next video", async (t) => {
  const { controller, button, save, native, click, resolve } = fixture(t);
  click();
  const [, , canAdd, signal] = save.mock.calls[0].arguments;
  global.location.href = "https://www.bilibili.com/video/av456";
  assert.equal(canAdd(), false);
  controller.reconcileFavoriteAction([]);
  assert.equal(signal.aborted, true);
  resolve({ aid: "123", alreadySaved: false });
  await settle();
  assert.equal(button.getAttribute("aria-pressed"), "false");
  assert.equal(native.mock.callCount(), 0);
});

test("an account change cannot publish an earlier account's saved state", async (t) => {
  const { controller, button, native, click, resolve } = fixture(t);
  click();
  controller.accountSources.favoriteFolders.accountId = "88";
  resolve({ aid: "123", alreadySaved: false });
  await settle();
  assert.equal(button.getAttribute("aria-pressed"), "false");
  assert.equal(button.disabled, false);
  assert.equal(native.mock.callCount(), 0);
});

test("closing the native folder dialog refreshes the saved override after cancellation or removal", async (t) => {
  const { controller, document, action, button, click, resolve } = fixture(t);
  const dialog = document.createElement("div");
  dialog.getBoundingClientRect = () => ({ width: 200, height: 200 });
  let currentDialog = null;
  let saved = true;
  t.mock.method(LayoutRoot, "favoriteDialog", () => currentDialog);
  const status = t.mock.method(AccountSourceStore, "isFavorite", async () => saved);
  click();
  resolve({ aid: "123", alreadySaved: false });
  await settle();
  for (const nextSaved of [true, false]) {
    click();
    currentDialog = dialog;
    controller.reconcileFavoriteAction([action]);
    currentDialog = null;
    saved = nextSaved;
    controller.reconcileFavoriteAction([action]);
    await settle();
    assert.equal(button.getAttribute("aria-pressed"), String(nextSaved));
  }
  assert.equal(status.mock.callCount(), 2);
  assert.equal(controller.favoriteActionState, null);
});
