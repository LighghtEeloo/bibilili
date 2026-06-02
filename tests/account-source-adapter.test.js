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
    language: "en",
    watchLaterAccountCount: null,
    watchLaterVisualSnapshot: [],
    watchLaterVisualSnapshotKey: "",
    watchLaterDeleteVisualSnapshot: [],
    watchLaterDeleteVisualSnapshotKey: "",
    pendingWatchLaterAddKeys: new Set(),
    pendingWatchLaterDeleteAids: new Set(),
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

test("reads account watch-later totals from payload metadata", () => {
  assert.equal(
    AccountSourceAdapter.watchLaterCountFromPayload({
      data: {
        count: "123",
        list: [{ title: "Loaded card" }]
      }
    }),
    123
  );
  assert.equal(
    AccountSourceAdapter.watchLaterCountFromPayload({
      data: {
        page: { total: 88 },
        list: [{ title: "Loaded card" }]
      }
    }),
    88
  );
  assert.equal(
    AccountSourceAdapter.watchLaterCountFromPayload({
      data: {
        count: "",
        list: [{ title: "Loaded card" }]
      }
    }),
    null
  );
  assert.equal(
    AccountSourceAdapter.watchLaterCountFromPayload({
      data: {
        list: [{ title: "Loaded card" }, { title: "Another loaded card" }]
      }
    }),
    null
  );
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

test("returns watch-later count with account source records", async () => {
  const previousFetchApiPayload = AccountSourceStore.fetchApiPayload;

  AccountSourceStore.fetchApiPayload = async () => ({
    code: 0,
    data: {
      count: 101,
      list: [
        {
          bvid: "BV1xx411c7mD",
          title: "First"
        }
      ]
    }
  });

  try {
    const record = await AccountSourceStore.fetchSourceRecord(
      SourceKind.WATCH_LATER,
      "https://api.example.test/watch-later",
      new AbortController().signal,
      "en"
    );

    assert.equal(record.kind, SourceKind.WATCH_LATER);
    assert.equal(record.watchLaterCount, 101);
    assert.equal(record.source.kind, SourceKind.WATCH_LATER);
    assert.equal(record.source.items.length, 1);
    assert.equal(
      record.source.items[0].targetUrl,
      "https://www.bilibili.com/video/BV1xx411c7mD"
    );
  } finally {
    AccountSourceStore.fetchApiPayload = previousFetchApiPayload;
  }
});

test("aggregates account source records with the watch-later count", async () => {
  const previousFetchSourceRecord = AccountSourceStore.fetchSourceRecord;
  const watchLaterSource = {
    kind: SourceKind.WATCH_LATER,
    root: null,
    items: [
      {
        targetUrl: "https://www.bilibili.com/video/BV1xx411c7mD",
        title: "Watch later"
      }
    ]
  };
  const historySource = {
    kind: SourceKind.HISTORY,
    root: null,
    items: [
      {
        targetUrl: "https://www.bilibili.com/video/BV2xx411c7mD",
        title: "History"
      }
    ]
  };

  AccountSourceStore.fetchSourceRecord = async (kind) =>
    kind === SourceKind.WATCH_LATER
      ? {
          kind,
          source: watchLaterSource,
          watchLaterCount: 42
        }
      : {
          kind,
          source: historySource,
          watchLaterCount: null
        };

  try {
    assert.deepEqual(
      await AccountSourceStore.fetchSources(new AbortController().signal, "en"),
      {
        sources: [watchLaterSource, historySource],
        watchLaterCount: 42
      }
    );
  } finally {
    AccountSourceStore.fetchSourceRecord = previousFetchSourceRecord;
  }
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
    layout.watchLaterAccountCount = 123;

    assert.deepEqual(layout.currentWatchLaterAddState(), {
      key: "bvid:BV1xx411c7mD",
      targetUrl: "https://www.bilibili.com/video/BV1xx411c7mD?p=2"
    });

    const orderedActions = layout.orderedWatchActions([
      {
        kind: WatchActionKind.SHARE
      },
      {
        kind: WatchActionKind.WATCH_LATER,
        trigger: null,
        visualSource: { isConnected: true },
        countText: "1",
        countSelectors: ["span"],
        isActive: false
      }
    ]);
    const watchLaterAction = orderedActions.find(
      (action) => action.kind === WatchActionKind.WATCH_LATER
    );

    assert.deepEqual(
      orderedActions.map((action) => action.kind),
      [WatchActionKind.SHARE, WatchActionKind.WATCH_LATER]
    );
    assert.equal(watchLaterAction.countText, "123");
    assert.equal(watchLaterAction.nativeCountText, "1");
  } finally {
    window.location.href = previousHref;
  }
});

test("omits the current watch-later dock action without a native visual", () => {
  const previousHref = window.location.href;
  window.location.href = "https://www.bilibili.com/video/av123456";
  const layout = currentWatchLaterLayout();

  try {
    assert.deepEqual(
      layout
        .orderedWatchActions([
          {
            kind: WatchActionKind.SHARE
          }
        ])
        .map((action) => action.kind),
      [WatchActionKind.SHARE]
    );

    layout.watchLaterVisualSnapshot = [{ cloneNode: () => ({}) }];
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

test("drops native watch-later labels from cloned action visuals", () => {
  const action = {
    kind: WatchActionKind.WATCH_LATER,
    countText: "199",
    nativeCountText: "2",
    labelPattern: /(?:稍后再看|稍後再看|watch\s*later)/iu
  };

  assert.equal(
    LayoutRoot.shouldDropWatchActionVisualText("稍后再看", action),
    true
  );
  assert.equal(
    LayoutRoot.shouldDropWatchActionVisualText("Watch later", action),
    true
  );
  assert.equal(LayoutRoot.shouldDropWatchActionVisualText("2", action), true);
  assert.equal(LayoutRoot.shouldDropWatchActionVisualText("199", action), true);
  assert.equal(
    LayoutRoot.shouldDropWatchActionVisualText("unrelated", action),
    false
  );
});

test("uses captured native watch-later visuals for card mutation buttons", () => {
  const layout = currentWatchLaterLayout();
  const card = { dataset: {} };
  const button = {
    dataset: {},
    disabled: false,
    hidden: false,
    title: "",
    children: [],
    setAttribute(name, value) {
      this[name] = value;
    },
    replaceChildren(...children) {
      this.children = children;
    }
  };
  const state = {
    watchLaterAction: "add",
    watchLaterActionKey: "bvid:BV1xx411c7mD",
    watchLaterActionTargetUrl: "https://www.bilibili.com/video/BV1xx411c7mD",
    watchLaterActionLabel: "Add to watch later"
  };

  layout.updateWatchLaterActionControl(card, button, state);

  assert.equal(button.hidden, true);
  assert.equal(button.disabled, true);
  assert.deepEqual(button.children, []);
  assert.equal(card.dataset.bibililiWatchLaterAction, undefined);

  layout.watchLaterVisualSnapshotKey = "<svg></svg>";
  layout.watchLaterVisualSnapshot = [
    {
      cloneNode: () => ({ source: "native-watch-later" })
    }
  ];
  layout.updateWatchLaterActionControl(card, button, state);

  assert.equal(button.hidden, false);
  assert.equal(button.disabled, false);
  assert.equal(button.dataset.bibililiWatchLaterAction, "add");
  assert.equal(button.dataset.bibililiWatchLaterIcon, "<svg></svg>");
  assert.deepEqual(button.children, [{ source: "native-watch-later" }]);
  assert.equal(
    card.dataset.bibililiWatchLaterAddTargetUrl,
    "https://www.bilibili.com/video/BV1xx411c7mD"
  );

  const deleteState = {
    watchLaterAction: "delete",
    watchLaterActionKey: "123456",
    watchLaterActionTargetUrl: "",
    watchLaterActionLabel: "Remove from watch later"
  };

  layout.updateWatchLaterActionControl(card, button, deleteState);

  assert.equal(button.hidden, true);
  assert.deepEqual(button.children, []);
  assert.equal(card.dataset.bibililiWatchLaterAid, "123456");

  layout.watchLaterDeleteVisualSnapshotKey = "<svg data-trash></svg>";
  layout.watchLaterDeleteVisualSnapshot = [
    {
      cloneNode: () => ({ source: "native-trash" })
    }
  ];
  layout.updateWatchLaterActionControl(card, button, deleteState);

  assert.equal(button.hidden, false);
  assert.equal(button.disabled, false);
  assert.equal(button.dataset.bibililiWatchLaterAction, "delete");
  assert.equal(button.dataset.bibililiWatchLaterIcon, "<svg data-trash></svg>");
  assert.deepEqual(button.children, [{ source: "native-trash" }]);
  assert.equal(card.dataset.bibililiWatchLaterAid, "123456");
});

test("decrements loaded watch-later count after successful deletion", async () => {
  const previousDeleteWatchLaterApiItem =
    AccountSourceStore.deleteWatchLaterApiItem;
  let deletedAid = null;
  let changes = 0;
  const store = new AccountSourceStore(() => {
    changes += 1;
  });
  store.watchLaterCount = 7;
  store.sources = [
    {
      kind: SourceKind.WATCH_LATER,
      root: null,
      items: [
        {
          targetUrl: "https://www.bilibili.com/video/av123456",
          title: "Watch later",
          watchLaterAid: "123456"
        }
      ]
    }
  ];

  AccountSourceStore.deleteWatchLaterApiItem = async (aid) => {
    deletedAid = aid;
  };

  try {
    await store.deleteWatchLaterItem("123456");

    assert.equal(deletedAid, "123456");
    assert.equal(store.currentWatchLaterCount(), 6);
    assert.deepEqual(store.currentSources(), []);
    assert.equal(changes, 1);
  } finally {
    AccountSourceStore.deleteWatchLaterApiItem =
      previousDeleteWatchLaterApiItem;
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
