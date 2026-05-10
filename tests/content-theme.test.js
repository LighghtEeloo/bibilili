const assert = require("node:assert/strict");
const test = require("node:test");

global.window = globalThis;

require("../src/content-theme.js");

const {
  BROWSER_DARK_SCHEME_QUERY,
  ThemeMode,
  ThemeResolver
} = globalThis.__bibililiTheme;

function fakeElement(attributes = {}) {
  return {
    getAttribute: (name) => attributes[name] ?? null
  };
}

test("ThemeResolver reads explicit Bilibili theme tokens", () => {
  assert.equal(
    ThemeResolver.themeToken(fakeElement({ class: "bili-dark-mode" })),
    ThemeMode.DARK
  );
  assert.equal(
    ThemeResolver.themeToken(fakeElement({ "data-theme": "theme-light" })),
    ThemeMode.LIGHT
  );
  assert.equal(ThemeResolver.themeToken(fakeElement({ class: "plain" })), null);
});

test("ThemeResolver parses opaque rgb and rgba backgrounds", () => {
  assert.deepEqual(ThemeResolver.parseRgb("rgb(12, 34, 56)"), {
    red: 12,
    green: 34,
    blue: 56,
    alpha: 1
  });
  assert.deepEqual(ThemeResolver.parseRgb("rgba(1, 2, 3, 0.4)"), {
    red: 1,
    green: 2,
    blue: 3,
    alpha: 0.4
  });
  assert.equal(ThemeResolver.parseRgb("transparent"), null);
});

test("ThemeResolver infers computed light and dark themes", () => {
  const originalGetComputedStyle = global.getComputedStyle;
  const darkBody = {};
  const lightBody = {};

  global.getComputedStyle = (element) => ({
    backgroundColor: element === darkBody
      ? "rgb(16, 18, 20)"
      : "rgb(246, 247, 248)"
  });

  try {
    assert.equal(
      ThemeResolver.computedTheme({
        body: darkBody,
        documentElement: null,
        querySelector: () => null
      }),
      ThemeMode.DARK
    );
    assert.equal(
      ThemeResolver.computedTheme({
        body: lightBody,
        documentElement: null,
        querySelector: () => null
      }),
      ThemeMode.LIGHT
    );
  } finally {
    global.getComputedStyle = originalGetComputedStyle;
  }
});

test("ThemeResolver falls back to browser color scheme", () => {
  const originalGetComputedStyle = global.getComputedStyle;
  const originalMatchMedia = global.matchMedia;
  const document = {
    documentElement: fakeElement(),
    body: fakeElement(),
    querySelector: () => null
  };

  global.getComputedStyle = () => ({ backgroundColor: "transparent" });
  global.matchMedia = (query) => {
    assert.equal(query, BROWSER_DARK_SCHEME_QUERY);
    return { matches: true };
  };

  try {
    assert.equal(ThemeResolver.resolve(document), ThemeMode.DARK);
  } finally {
    global.getComputedStyle = originalGetComputedStyle;
    global.matchMedia = originalMatchMedia;
  }
});
