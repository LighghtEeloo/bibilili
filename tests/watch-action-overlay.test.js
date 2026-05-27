const assert = require("node:assert/strict");
const test = require("node:test");

const { loadContentRuntime } = require("./helpers/content-runtime.js");

const { LayoutRoot } = loadContentRuntime();

class FakeElement {
  constructor(classNames, parentElement = null) {
    this.classNames = new Set(classNames);
    this.parentElement = parentElement;
    this.attributes = new Map();
  }

  closest(selector) {
    const selectors = selector.split(",").map((item) => item.trim());
    let current = this;

    while (current) {
      if (selectors.some((item) => current.matches(item))) {
        return current;
      }

      current = current.parentElement;
    }

    return null;
  }

  matches(selector) {
    return selector.startsWith(".") && this.classNames.has(selector.slice(1));
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }
}

function fakeDocument(queryResult) {
  return {
    querySelector: () => queryResult
  };
}

function withNativeOverlayRuntime(position, callback) {
  const originalSetTimeout = window.setTimeout;
  const originalGetComputedStyle = window.getComputedStyle;

  window.setTimeout = (scheduled) => {
    scheduled();
    return 0;
  };
  window.getComputedStyle = () => ({ position });

  try {
    callback();
  } finally {
    window.setTimeout = originalSetTimeout;
    window.getComputedStyle = originalGetComputedStyle;
  }
}

test("coin dialog discovery returns the global dialog root", () => {
  const dialog = new FakeElement(["bili-dialog-m"]);
  const content = new FakeElement(["coin-operated-m-exp"], dialog);

  assert.equal(LayoutRoot.coinDialog(fakeDocument(content)), dialog);
});

test("coin dialog discovery accepts coin-dialog-mask roots", () => {
  const dialog = new FakeElement(["coin-dialog-mask"]);

  assert.equal(LayoutRoot.coinDialog(fakeDocument(dialog)), dialog);
});

test("coin action overlay lift marks the native dialog root", () => {
  const dialog = new FakeElement(["bili-dialog-m"]);
  const content = new FakeElement(["coin-operated-m"], dialog);
  const document = fakeDocument(content);

  withNativeOverlayRuntime("fixed", () => {
    LayoutRoot.liftNativeWatchActionOverlay("coin", { ownerDocument: document });
  });

  assert.equal(dialog.getAttribute("data-bibilili-native-overlay"), "true");
  assert.equal(
    dialog.getAttribute("data-bibilili-native-overlay-positioned"),
    null
  );
});

test("coin action overlay lift positions static native dialog roots", () => {
  const dialog = new FakeElement(["coin-dialog-mask"]);
  const document = fakeDocument(dialog);

  withNativeOverlayRuntime("static", () => {
    LayoutRoot.liftNativeWatchActionOverlay("coin", { ownerDocument: document });
  });

  assert.equal(dialog.getAttribute("data-bibilili-native-overlay"), "true");
  assert.equal(
    dialog.getAttribute("data-bibilili-native-overlay-positioned"),
    "true"
  );
});
