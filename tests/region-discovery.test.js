const assert = require("node:assert/strict");
const test = require("node:test");

const { loadContentRuntime } = require("./helpers/content-runtime.js");

const { RegionDiscovery } = loadContentRuntime();

test("normalizes video description text from native controls", () => {
  assert.equal(
    RegionDiscovery.cleanVideoDescription(
      " First line \n\n展开更多\nSecond line show more"
    ),
    "First line\nSecond line"
  );
});
