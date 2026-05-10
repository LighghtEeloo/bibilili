const assert = require("node:assert/strict");
const test = require("node:test");

global.window = globalThis;
global.location = {
  href: "https://www.bilibili.com/video/BV1aa411c7mD"
};
global.document = {
  readyState: "loading",
  addEventListener: () => undefined
};
global.__bibililiExposeInternals = true;

require("../src/content-route.js");
require("../src/content-state.js");
require("../src/content-i18n.js");
require("../src/content-storage.js");
require("../src/content.js");

const { AccountSourceAdapter, SourceKind } = global.__bibililiInternals;

test("extracts account list entries from successful payload shapes", () => {
  assert.deepEqual(
    AccountSourceAdapter.entriesFromPayload({
      data: {
        list: [
          { title: "One" },
          null,
          "bad",
          { title: "Two" }
        ]
      }
    }),
    [{ title: "One" }, { title: "Two" }]
  );
  assert.deepEqual(AccountSourceAdapter.entriesFromPayload({ data: {} }), []);
});

test("resolves account record targets by direct URL and ids", () => {
  assert.equal(
    AccountSourceAdapter.targetUrlFor({
      redirect_url: "/video/BV1xx411c7mD?p=2"
    }),
    "https://www.bilibili.com/video/BV1xx411c7mD?p=2"
  );
  assert.equal(
    AccountSourceAdapter.targetUrlFor({
      history: { bvid: "BV1zz411c7mD", page: 3 }
    }),
    "https://www.bilibili.com/video/BV1zz411c7mD?p=3"
  );
  assert.equal(
    AccountSourceAdapter.targetUrlFor({
      kid: 123456
    }),
    "https://www.bilibili.com/video/av123456"
  );
  assert.equal(
    AccountSourceAdapter.targetUrlFor({
      bangumi: { ep_id: 98765 }
    }),
    "https://www.bilibili.com/bangumi/play/ep98765"
  );
});

test("formats account titles, duration, progress, and watch-later ids", () => {
  const entry = {
    title: " Main title ",
    page: {
      part: " Part 2 ",
      duration: 3661
    },
    progress: 65,
    aid: 123.9
  };

  assert.equal(AccountSourceAdapter.titleFor(entry), "Main title - Part 2");
  assert.equal(AccountSourceAdapter.durationFor(entry), "1:01:01");
  assert.equal(AccountSourceAdapter.progressFor(entry, "en"), "watchedProgress");
  assert.equal(AccountSourceAdapter.watchLaterAidFor(entry), "123");
});

test("converts account entries into de-duplicated source items", () => {
  const entries = [
    {
      bvid: "BV1xx411c7mD",
      title: "First",
      pic: "http://i0.hdslb.com/bfs/archive/cover.jpg",
      owner: { name: "UP" },
      duration: 125,
      aid: 100
    },
    {
      bvid: "BV1xx411c7mD",
      title: "First"
    },
    {
      title: "Missing target"
    },
    {
      bvid: "BV2xx411c7mD"
    }
  ];

  assert.deepEqual(
    AccountSourceAdapter.itemsFromEntries(
      SourceKind.WATCH_LATER,
      entries,
      "en"
    ),
    [
      {
        targetUrl: "https://www.bilibili.com/video/BV1xx411c7mD",
        title: "First",
        thumbnailUrl: "https://i0.hdslb.com/bfs/archive/cover.jpg",
        sourceKind: SourceKind.WATCH_LATER,
        duration: "2:05",
        author: "UP",
        viewCount: null,
        progress: null,
        watchLaterAid: "100"
      }
    ]
  );
});

test("omits empty account sources", () => {
  assert.equal(
    AccountSourceAdapter.sourceFromPayload(
      SourceKind.HISTORY,
      { data: { list: [{ title: "Missing target" }] } },
      "en"
    ),
    null
  );
});
