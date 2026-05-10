const assert = require("node:assert/strict");
const test = require("node:test");

global.window = globalThis;

require("../src/content-theme.js");

const {
  BILIBILI_DARK_PAGE_ATTR,
  BILIBILI_LEGACY_DARK_COMMON_ATTR,
  BILIBILI_THEME_COOKIE_NAME,
  BILIBILI_THEME_STYLE_LINK_SELECTOR,
  BROWSER_DARK_SCHEME_QUERY,
  BilibiliThemeSync,
  ThemeMode
} = globalThis.__bibililiTheme;

class FakeClassList {
  constructor() {
    this.values = new Set();
  }

  add(value) {
    this.values.add(value);
  }

  remove(value) {
    this.values.delete(value);
  }

  contains(value) {
    return this.values.has(value);
  }
}

class FakeElement {
  constructor() {
    this.attributes = new Map();
    this.classList = new FakeClassList();
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }
}

function fakeDocument({ cookie = "", stylesheetHref = "" } = {}) {
  let cookieValue = cookie;
  const documentElement = new FakeElement();
  const stylesheet = stylesheetHref ? { href: stylesheetHref } : null;
  const cookieWrites = [];
  const document = {
    documentElement,
    cookieWrites,
    querySelector: (selector) =>
      selector === BILIBILI_THEME_STYLE_LINK_SELECTOR ? stylesheet : null
  };

  Object.defineProperty(document, "cookie", {
    get() {
      return cookieValue;
    },
    set(value) {
      cookieWrites.push(value);
      const match = String(value).match(/^([^=]+)=([^;]*)/u);

      if (!match) {
        return;
      }

      const records = new Map(
        cookieValue
          .split(";")
          .map((record) => record.trim())
          .filter(Boolean)
          .map((record) => {
            const index = record.indexOf("=");
            return index === -1
              ? [record, ""]
              : [record.slice(0, index), record.slice(index + 1)];
          })
      );
      records.set(match[1], match[2]);
      cookieValue = Array.from(records, ([key, recordValue]) =>
        `${key}=${recordValue}`
      ).join("; ");
    }
  });

  return { document, documentElement, stylesheet, cookieWrites };
}

test("BilibiliThemeSync resolves the browser color scheme", () => {
  const originalMatchMedia = global.matchMedia;

  global.matchMedia = (query) => {
    assert.equal(query, BROWSER_DARK_SCHEME_QUERY);
    return { matches: true };
  };

  try {
    assert.equal(BilibiliThemeSync.systemTheme(), ThemeMode.DARK);
  } finally {
    global.matchMedia = originalMatchMedia;
  }
});

test("BilibiliThemeSync reads Bilibili native theme state", () => {
  const darkCookie = fakeDocument({
    cookie: `${BILIBILI_THEME_COOKIE_NAME}=dark`
  });
  const lightStylesheet = fakeDocument({
    stylesheetHref:
      "https://s1.hdslb.com/bfs/seed/jinkela/short/bili-theme/light.css"
  });
  const darkMarker = fakeDocument();
  darkMarker.documentElement.setAttribute(BILIBILI_DARK_PAGE_ATTR, "common");

  assert.equal(
    BilibiliThemeSync.nativeTheme(darkCookie.document),
    ThemeMode.DARK
  );
  assert.equal(
    BilibiliThemeSync.nativeTheme(lightStylesheet.document),
    ThemeMode.LIGHT
  );
  assert.equal(
    BilibiliThemeSync.nativeTheme(darkMarker.document),
    ThemeMode.DARK
  );
});

test("BilibiliThemeSync writes Bilibili theme controls", () => {
  const originalMatchMedia = global.matchMedia;
  const state = fakeDocument({
    cookie: `${BILIBILI_THEME_COOKIE_NAME}=light`,
    stylesheetHref:
      "https://s1.hdslb.com/bfs/seed/jinkela/short/bili-theme/light.css?x=1"
  });

  global.matchMedia = () => ({ matches: true });

  try {
    assert.equal(BilibiliThemeSync.sync(state.document), ThemeMode.DARK);
  } finally {
    global.matchMedia = originalMatchMedia;
  }

  assert.match(
    state.cookieWrites.at(-1),
    /^theme_style=dark; path=\/; domain=\.bilibili\.com;/u
  );
  assert.equal(
    state.documentElement.getAttribute(BILIBILI_DARK_PAGE_ATTR),
    "common"
  );
  assert.equal(
    state.documentElement.hasAttribute(BILIBILI_LEGACY_DARK_COMMON_ATTR),
    true
  );
  assert.equal(
    state.stylesheet.href,
    "https://s1.hdslb.com/bfs/seed/jinkela/short/bili-theme/dark.css?x=1"
  );
});

test("BilibiliThemeSync removes dark markers for light mode", () => {
  const originalMatchMedia = global.matchMedia;
  const state = fakeDocument({
    cookie: `${BILIBILI_THEME_COOKIE_NAME}=dark`,
    stylesheetHref:
      "https://s1.hdslb.com/bfs/seed/jinkela/short/bili-theme/dark.css"
  });
  state.documentElement.setAttribute(BILIBILI_DARK_PAGE_ATTR, "common");
  state.documentElement.setAttribute(BILIBILI_LEGACY_DARK_COMMON_ATTR, "");

  global.matchMedia = () => ({ matches: false });

  try {
    assert.equal(BilibiliThemeSync.sync(state.document), ThemeMode.LIGHT);
  } finally {
    global.matchMedia = originalMatchMedia;
  }

  assert.equal(state.documentElement.hasAttribute(BILIBILI_DARK_PAGE_ATTR), false);
  assert.equal(
    state.documentElement.hasAttribute(BILIBILI_LEGACY_DARK_COMMON_ATTR),
    false
  );
  assert.equal(
    state.stylesheet.href,
    "https://s1.hdslb.com/bfs/seed/jinkela/short/bili-theme/light.css"
  );
});
