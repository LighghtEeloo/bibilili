const TEST_WATCH_HREF = "https://www.bilibili.com/video/BV1aa411c7mD";

const TEST_SOURCE_KIND = Object.freeze({
  COLLECTION: "collection",
  RECOMMENDATIONS: "recommendations",
  WATCH_LATER: "watch_later",
  HISTORY: "history"
});

const TEST_SOURCE_ORDER = Object.freeze([
  TEST_SOURCE_KIND.COLLECTION,
  TEST_SOURCE_KIND.RECOMMENDATIONS,
  TEST_SOURCE_KIND.WATCH_LATER,
  TEST_SOURCE_KIND.HISTORY
]);

class FakeStorage {
  constructor() {
    this.records = new Map();
  }

  getItem(key) {
    return this.records.has(key) ? this.records.get(key) : null;
  }

  setItem(key, value) {
    this.records.set(key, String(value));
  }

  removeItem(key) {
    this.records.delete(key);
  }
}

class ThrowingStorage {
  getItem() {
    throw new Error("blocked");
  }

  setItem() {
    throw new Error("blocked");
  }

  removeItem() {
    throw new Error("blocked");
  }
}

function installContentGlobals() {
  global.window = globalThis;
  global.location = {
    href: TEST_WATCH_HREF
  };
  global.document = {
    readyState: "loading",
    addEventListener: () => undefined
  };
  global.__bibililiExposeInternals = true;
}

function loadContentRuntime() {
  installContentGlobals();

  require("../../src/content-route.js");
  require("../../src/content-state.js");
  require("../../src/content-i18n.js");
  require("../../src/content-storage.js");
  require("../../src/content.js");

  return global.__bibililiInternals;
}

function loadStorageState() {
  global.window = globalThis;
  require("../../src/content-storage.js");

  return globalThis.__bibililiStorageState;
}

function resetStorageState() {
  const storageState = loadStorageState();
  global.localStorage = new FakeStorage();
  global.sessionStorage = new FakeStorage();
  storageState.configure({
    sourceOrder: TEST_SOURCE_ORDER,
    commentPaneMinWidth: 240,
    commentPaneMaxWidth: 640
  });
}

module.exports = {
  FakeStorage,
  TEST_SOURCE_KIND,
  TEST_SOURCE_ORDER,
  TEST_WATCH_HREF,
  ThrowingStorage,
  installContentGlobals,
  loadContentRuntime,
  loadStorageState,
  resetStorageState
};
