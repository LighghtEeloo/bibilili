const assert = require("node:assert/strict");
const test = require("node:test");

const WATCH_HREF = "https://www.bilibili.com/video/BV1aa411c7mD";

function requireFresh(path) {
  delete require.cache[require.resolve(path)];
  require(path);
}

test("preludes publish shared namespaces on the content window", () => {
  const previousWindow = global.window;
  const fakeWindow = {
    location: {
      href: WATCH_HREF
    }
  };

  global.window = fakeWindow;

  try {
    requireFresh("../src/content-dom.js");
    requireFresh("../src/content-route.js");

    assert.equal(
      typeof fakeWindow.__bibililiDom.DomProbe.queryAll,
      "function"
    );
    assert.equal(
      fakeWindow.__bibililiRoute.BilibiliRoute.defaultBaseHref(),
      WATCH_HREF
    );
  } finally {
    global.window = previousWindow;
    delete require.cache[require.resolve("../src/content-dom.js")];
    delete require.cache[require.resolve("../src/content-route.js")];
  }
});
