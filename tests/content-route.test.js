const assert = require("node:assert/strict");
const test = require("node:test");

global.window = globalThis;

require("../src/content-route.js");

const { BILIBILI_WEB_ORIGIN, BilibiliRoute } = globalThis.__bibililiRoute;
const BASE_HREF = "https://www.bilibili.com/video/BV1aa411c7mD";

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
