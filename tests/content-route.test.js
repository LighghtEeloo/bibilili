const assert = require("node:assert/strict");
const test = require("node:test");

global.window = globalThis;

require("../src/content-route.js");

const { BILIBILI_WEB_ORIGIN, BilibiliRoute } = globalThis.__bibililiRoute;
const BASE_HREF = "https://www.bilibili.com/video/BV1aa411c7mD";

test("recognizes Bilibili watch documents with an optional language segment", () => {
  for (const path of [
    "/video/BV1hr4E63Eo1/",
    "/zh-Hans/video/BV1hr4E63Eo1/?share_medium=android_i&share_source=GENERIC",
    "/zh-Hant/video/BV1hr4E63Eo1",
    "/en/video/BV1hr4E63Eo1",
    "/ja/video/av123",
    "/en-US/video/BV1hr4E63Eo1",
    "/list/watchlater",
    "/zh-Hans/list/watchlater/?bvid=BV1hr4E63Eo1"
  ]) {
    assert.equal(BilibiliRoute.isWatchPage(new URL(path, BASE_HREF)), true, path);
  }

  for (const path of [
    "https://space.bilibili.com/zh-Hans/video/BV1hr4E63Eo1",
    "/read/cv1?next=/zh-Hans/video/BV1hr4E63Eo1/",
    "/account/settings/video/BV1hr4E63Eo1",
    "/zh-Hans/en/video/BV1hr4E63Eo1",
    "/zh-Hans/video/",
    "/zh-Hans/video/BV1hr4E63Eo1/other",
    "/zh-Hans/list/watchlater-settings"
  ]) {
    assert.equal(BilibiliRoute.isWatchPage(new URL(path, BASE_HREF)), false, path);
  }
});

test("preserves archive and part identity across localized URLs", () => {
  const url = new URL("/zh-Hans/video/BV1hr4E63Eo1/?p=2&share_source=GENERIC#reply", BASE_HREF);
  assert.equal(BilibiliRoute.normalizedVideoUrl(url.href), url.href);
  assert.deepEqual(BilibiliRoute.archiveIdentityForUrl(url), {
    key: "bvid:BV1hr4E63Eo1",
    queryName: "bvid",
    queryValue: "BV1hr4E63Eo1"
  });
  assert.equal(BilibiliRoute.watchRouteKeyForUrl(url), "video:BV1hr4E63Eo1:p2");
  assert.equal(
    BilibiliRoute.watchRouteKeyForUrl("/video/BV1hr4E63Eo1?p=2", BASE_HREF),
    BilibiliRoute.watchRouteKeyForUrl(url)
  );
  assert.equal(
    BilibiliRoute.shareUrlFor(url),
    "https://www.bilibili.com/zh-Hans/video/BV1hr4E63Eo1/?p=2"
  );
});

test("normalizes playable Bilibili watch URLs", () => {
  assert.equal(BILIBILI_WEB_ORIGIN, "https://www.bilibili.com");
  assert.equal(
    BilibiliRoute.normalizedVideoUrl("/video/BV1xx411c7mD?p=2", BASE_HREF),
    "https://www.bilibili.com/video/BV1xx411c7mD?p=2"
  );
  assert.equal(
    BilibiliRoute.normalizedVideoUrl(
      " //www.bilibili.com/bangumi/play/ep12345 ",
      BASE_HREF
    ),
    "https://www.bilibili.com/bangumi/play/ep12345"
  );
});

test("rejects non-playable or unsafe URLs", () => {
  assert.equal(
    BilibiliRoute.normalizedVideoUrl("javascript:alert(1)", BASE_HREF),
    null
  );
  assert.equal(
    BilibiliRoute.normalizedVideoUrl("https://space.bilibili.com/42", BASE_HREF),
    null
  );
  assert.equal(
    BilibiliRoute.normalizedVideoUrl("https://www.bilibili.com/read/cv1", BASE_HREF),
    null
  );
});

test("builds canonical archive URLs", () => {
  assert.equal(
    BilibiliRoute.videoUrl({ bvid: "BV1xx411c7mD", page: 3 }),
    "https://www.bilibili.com/video/BV1xx411c7mD?p=3"
  );
  assert.equal(
    BilibiliRoute.videoUrl({ aid: "av123456" }),
    "https://www.bilibili.com/video/av123456"
  );
  assert.equal(BilibiliRoute.videoUrl({}), null);
});

test("builds share URLs without tracking parameters", () => {
  assert.equal(
    BilibiliRoute.shareUrlFor(
      "https://www.bilibili.com/video/BV1fUDQBMEgp/?vd_source=ded62002a59d50bb1f94edb42d31aec0",
      BASE_HREF
    ),
    "https://www.bilibili.com/video/BV1fUDQBMEgp/"
  );
  assert.equal(
    BilibiliRoute.shareUrlFor(
      "https://www.bilibili.com/video/BV1xx411c7mD/?p=2&spm_id_from=333.788&vd_source=abc#reply",
      BASE_HREF
    ),
    "https://www.bilibili.com/video/BV1xx411c7mD/?p=2"
  );
  assert.equal(
    BilibiliRoute.shareUrlFor(
      "https://www.bilibili.com/bangumi/play/ep12345?from_spmid=666#comment",
      BASE_HREF
    ),
    "https://www.bilibili.com/bangumi/play/ep12345"
  );
});

test("resolves playable identities", () => {
  assert.equal(
    BilibiliRoute.playableIdentityForUrl(
      "https://www.bilibili.com/video/BV1xx411c7mD/",
      BASE_HREF
    ),
    "video:BV1xx411c7mD"
  );
  assert.equal(
    BilibiliRoute.playableIdentityForUrl(
      "https://www.bilibili.com/video/AV123456",
      BASE_HREF
    ),
    "video:av123456"
  );
  assert.equal(
    BilibiliRoute.playableIdentityForUrl(
      "https://www.bilibili.com/bangumi/play/SS654",
      BASE_HREF
    ),
    "bangumi:ss654"
  );
});

test("resolves route keys with archive pages", () => {
  assert.equal(
    BilibiliRoute.watchRouteKeyForUrl(
      "https://www.bilibili.com/video/BV1xx411c7mD?p=7",
      BASE_HREF
    ),
    "video:BV1xx411c7mD:p7"
  );
  assert.equal(
    BilibiliRoute.watchRouteKeyForUrl(
      "https://www.bilibili.com/video/BV1xx411c7mD?p=0",
      BASE_HREF
    ),
    "video:BV1xx411c7mD:p1"
  );
  assert.equal(
    BilibiliRoute.watchRouteKeyForUrl(
      "https://www.bilibili.com/bangumi/play/md99",
      BASE_HREF
    ),
    "bangumi:md99"
  );
});

test("resolves archive identities for preview fetches", () => {
  assert.deepEqual(
    BilibiliRoute.archiveIdentityForUrl(
      "https://www.bilibili.com/video/BV1xx411c7mD",
      BASE_HREF
    ),
    {
      key: "bvid:BV1xx411c7mD",
      queryName: "bvid",
      queryValue: "BV1xx411c7mD"
    }
  );
  assert.deepEqual(
    BilibiliRoute.archiveIdentityForUrl(
      "https://www.bilibili.com/video/av123456",
      BASE_HREF
    ),
    {
      key: "aid:123456",
      queryName: "aid",
      queryValue: "123456"
    }
  );
  assert.equal(
    BilibiliRoute.archiveIdentityForUrl(
      "https://www.bilibili.com/bangumi/play/ep12345",
      BASE_HREF
    ),
    null
  );
});
