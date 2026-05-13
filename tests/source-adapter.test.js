const assert = require("node:assert/strict");
const test = require("node:test");

const { loadContentRuntime } = require("./helpers/content-runtime.js");

const { SourceAdapter } = loadContentRuntime();

global.HTMLAnchorElement = class FakeAnchorElement {};

class FakeElement {
  constructor(attributes = {}, options = {}) {
    this.attributes = new Map(Object.entries(attributes));
    this.inVideoPod = Boolean(options.inVideoPod);
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  querySelectorAll() {
    return [];
  }

  closest(selector) {
    return this.inVideoPod && selector === ".video-pod" ? this : null;
  }
}

test("resolves numeric video-pod data keys through page fallback", () => {
  const item = new FakeElement({ "data-key": "38266734336" }, { inVideoPod: true });

  assert.equal(
    SourceAdapter.targetUrlFor(item, 1),
    "https://www.bilibili.com/video/BV1aa411c7mD?p=2"
  );
});

test("resolves valid video-pod data-key BV ids before page fallback", () => {
  const item = new FakeElement(
    { "data-key": "BV1xx411c7mD" },
    { inVideoPod: true }
  );

  assert.equal(
    SourceAdapter.targetUrlFor(item, 4),
    "https://www.bilibili.com/video/BV1xx411c7mD"
  );
});

test("falls through invalid BV data before reading archive ids", () => {
  const item = new FakeElement({
    "data-bvid": "38266734336",
    "data-aid": "123456"
  });

  assert.equal(
    SourceAdapter.targetUrlFor(item),
    "https://www.bilibili.com/video/av123456"
  );
});
