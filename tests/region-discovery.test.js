const assert = require("node:assert/strict");
const test = require("node:test");

const { loadContentRuntime } = require("./helpers/content-runtime.js");

const { RegionDiscovery } = loadContentRuntime();

function fakeElement(text) {
  return {
    innerText: text,
    textContent: text,
    closest: () => null,
    querySelectorAll: () => []
  };
}

function fakeDescriptionDocument(element) {
  return {
    querySelectorAll: (selector) => (selector === "#v_desc" ? [element] : [])
  };
}

test("normalizes video description text from native controls", () => {
  assert.equal(
    RegionDiscovery.cleanVideoDescription(
      " First line \n\n展开更多\nSecond line show more"
    ),
    "First line\nSecond line"
  );
});

test("finds the page-owned video description element", () => {
  const description = fakeElement("Rendered description");
  const discovery = new RegionDiscovery(fakeDescriptionDocument(description));

  assert.equal(discovery.findVideoDescription(), description);
});

test("normalizes video tag text from native controls", () => {
  assert.equal(RegionDiscovery.cleanVideoTagText(" 血源诅咒 "), "血源诅咒");
  assert.equal(RegionDiscovery.cleanVideoTagText("展开更多"), null);
});

test("normalizes video tag search URLs", () => {
  const discovery = new RegionDiscovery({
    location: { href: "https://www.bilibili.com/video/BV1aa411c7mD" }
  });

  assert.equal(
    discovery.safeVideoTagUrl("//search.bilibili.com/all?keyword=test"),
    "https://search.bilibili.com/all?keyword=test"
  );
  assert.equal(discovery.safeVideoTagUrl("javascript:alert(1)"), null);
});
