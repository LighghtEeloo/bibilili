const assert = require("node:assert/strict");
const test = require("node:test");

global.window = globalThis;

require("../src/content-dom.js");
require("../src/content-i18n.js");

const { LanguageResolver, UiLanguage, UiStrings } = globalThis.__bibililiI18n;

UiStrings.configure({
  sourceLabelMessageNames: {
    history: "sourceHistoryLabel"
  },
  watchActionLabelMessageNames: {
    share: "watchActionShareLabel"
  },
  shareActionKind: "share"
});

function fakeElement(attributes = {}, textContent = "") {
  return {
    textContent,
    getAttribute: (name) => attributes[name] ?? null,
    closest: () => null
  };
}

test("loads catalog messages and formats known labels", async () => {
  const previousFetch = global.fetch;
  const requestedUrls = [];

  global.fetch = async (url) => {
    requestedUrls.push(url);

    return {
      ok: true,
      json: async () => ({
        sourceHistoryLabel: { message: "History" },
        watchActionCopyLinkLabel: { message: "Copy link" },
        watchActionCountLabel: {
          message: "$action$ ($count$)",
          placeholders: {
            action: { content: "$1" },
            count: { content: "$2" }
          }
        },
        viewCount: { message: "$1 views" }
      })
    };
  };

  try {
    await UiStrings.load(UiLanguage.ENGLISH);

    assert.deepEqual(requestedUrls, ["_locales/en/messages.json"]);
    assert.equal(
      UiStrings.sourceLabel("history", UiLanguage.ENGLISH),
      "History"
    );
    assert.equal(
      UiStrings.watchActionButtonLabel("share", "2", UiLanguage.ENGLISH),
      "Copy link (2)"
    );
    assert.equal(UiStrings.viewCount("10", UiLanguage.ENGLISH), "10 views");
  } finally {
    global.fetch = previousFetch;
  }
});

test("interpolates named placeholders and positional substitutions", () => {
  assert.equal(
    UiStrings.interpolate(
      {
        message: "$action$ $count$ $$ $1",
        placeholders: {
          action: { content: "$1" },
          count: { content: "$2" }
        }
      },
      ["Like", "12"]
    ),
    "Like 12 $ Like"
  );
});

test("resolves language from document and Bilibili chrome signals", () => {
  const document = {
    documentElement: fakeElement({ lang: "zh-TW" }),
    body: fakeElement(),
    cookie: "",
    querySelector: () => null,
    querySelectorAll: () => []
  };

  const ownedHeader = {
    textContent: "History",
    closest: () => ({})
  };
  const nativeHeader = {
    textContent: "稍后再看 推荐 评论",
    closest: () => null
  };

  assert.equal(
    LanguageResolver.resolve(document),
    UiLanguage.TRADITIONAL_CHINESE
  );
  assert.equal(
    LanguageResolver.pageChromeLanguage({
      querySelectorAll: (selector) => (
        selector === "header" ? [ownedHeader, nativeHeader, nativeHeader] : []
      )
    }),
    UiLanguage.SIMPLIFIED_CHINESE
  );
  assert.equal(
    LanguageResolver.cookieLanguage("theme=dark; locale=english"),
    UiLanguage.ENGLISH
  );
});
