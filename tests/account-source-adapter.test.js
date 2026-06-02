const assert = require("node:assert/strict");
const test = require("node:test");

const { loadContentRuntime } = require("./helpers/content-runtime.js");

const {
  AccountSourceAdapter,
  AccountSourceStore,
  LayoutRoot,
  SourceKind,
  WatchActionKind
} = loadContentRuntime();

function currentWatchLaterLayout() {
  return Object.assign(Object.create(LayoutRoot.prototype), {
    watchLaterArchiveKeys: new Set(),
    completedWatchLaterAddKeys: new Set()
  });
}

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

test("posts watch-later additions with archive identity and csrf", async () => {
  const previousFetch = global.fetch;
  let request = null;
  document.cookie = "bili_jct=csrf-token";

  global.fetch = async (url, options) => {
    request = { url, options };

    return {
      ok: true,
      text: async () => JSON.stringify({ code: 0 })
    };
  };

  try {
    await AccountSourceStore.addWatchLaterApiItem({
      key: "bvid:BV1xx411c7mD",
      queryName: "bvid",
      queryValue: "BV1xx411c7mD"
    });

    assert.equal(
      request.url,
      "https://api.bilibili.com/x/v2/history/toview/add"
    );
    assert.equal(request.options.method, "POST");
    assert.equal(request.options.credentials, "include");
    assert.equal(request.options.body.get("csrf"), "csrf-token");
    assert.equal(request.options.body.get("bvid"), "BV1xx411c7mD");
  } finally {
    global.fetch = previousFetch;
    document.cookie = "";
  }
});

test("resolves addable watch-later identities from archive URLs", () => {
  assert.deepEqual(
    AccountSourceStore.watchLaterAddIdentityForUrl(
      "https://www.bilibili.com/video/av123456"
    ),
    {
      key: "aid:123456",
      queryName: "aid",
      queryValue: "123456"
    }
  );
  assert.equal(
    AccountSourceStore.watchLaterAddIdentityForUrl(
      "https://www.bilibili.com/bangumi/play/ep12345"
    ),
    null
  );
});

test("exposes the current archive as a watch-later dock action after share", () => {
  const previousHref = window.location.href;
  window.location.href =
    "https://www.bilibili.com/video/BV1xx411c7mD?spm_id_from=333.788&p=2";
  const layout = currentWatchLaterLayout();

  try {
    assert.deepEqual(layout.currentWatchLaterAddState(), {
      key: "bvid:BV1xx411c7mD",
      targetUrl: "https://www.bilibili.com/video/BV1xx411c7mD?p=2"
    });

    assert.deepEqual(
      layout
        .orderedWatchActions([
          {
            kind: WatchActionKind.SHARE
          }
        ])
        .map((action) => action.kind),
      [WatchActionKind.SHARE, WatchActionKind.WATCH_LATER]
    );
  } finally {
    window.location.href = previousHref;
  }
});

test("keeps the current watch-later dock action for known archive targets", () => {
  const previousHref = window.location.href;
  window.location.href = "https://www.bilibili.com/video/av123456";
  const layout = currentWatchLaterLayout();
  const expectedState = {
    key: "aid:123456",
    targetUrl: "https://www.bilibili.com/video/av123456"
  };

  try {
    layout.watchLaterArchiveKeys.add("aid:123456");
    assert.deepEqual(layout.currentWatchLaterAddState(), expectedState);

    layout.watchLaterArchiveKeys.clear();
    layout.completedWatchLaterAddKeys.add("aid:123456");
    assert.deepEqual(layout.currentWatchLaterAddState(), expectedState);
  } finally {
    window.location.href = previousHref;
  }
});

test("ignores page-owned watch-later roots when suppressing add controls", () => {
  const pageOwnedWatchLater = {
    kind: SourceKind.WATCH_LATER,
    root: {},
    items: [
      {
        targetUrl: "https://www.bilibili.com/video/av123456",
        title: "Toolbar false positive"
      }
    ]
  };
  const accountWatchLater = {
    kind: SourceKind.WATCH_LATER,
    root: null,
    items: [
      {
        targetUrl: "https://www.bilibili.com/video/BV1xx411c7mD",
        title: "Account watch later"
      }
    ]
  };

  assert.deepEqual(
    LayoutRoot.watchLaterArchiveKeysFor([pageOwnedWatchLater]),
    new Set()
  );
  assert.deepEqual(
    LayoutRoot.watchLaterArchiveKeysFor([
      pageOwnedWatchLater,
      accountWatchLater
    ]),
    new Set(["bvid:BV1xx411c7mD"])
  );
});
