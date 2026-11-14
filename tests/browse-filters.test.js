const assert = require("node:assert/strict");
const test = require("node:test");
const { loadContentRuntime } = require("./helpers/content-runtime.js");

const {
  BrowseDurationFilter,
  BrowseFilters,
  BrowseStatusFilter,
  ListSearch,
  WatchState
} = loadContentRuntime();

function video(title, author, durationSeconds, watchState) {
  const item = {
    targetUrl: "https://www.bilibili.com/video/BV" + title.replace(/\W/g, ""),
    title,
    author
  };
  if (durationSeconds !== undefined) item.durationSeconds = durationSeconds;
  if (watchState !== undefined) item.watchState = watchState;
  return item;
}

const items = [
  video("Quick sort explained", "Aka", 180, WatchState.UNWATCHED),
  video("City night ride vlog", "Muzi", 840, WatchState.PARTIAL),
  video("Rust in one hour", "Zhou", 4320, WatchState.UNWATCHED),
  video("Pour-over coffee mistakes", "Muzi", 480, WatchState.FINISHED),
  video("Weekend camping vlog", "Aka", 1560, WatchState.PARTIAL)
];

function titles(list) {
  return list.map((item) => item.title);
}

test("search requires every whitespace-separated term in the title or author", () => {
  assert.deepEqual(titles(ListSearch.filter(items, "vlog muzi")), ["City night ride vlog"]);
  assert.deepEqual(titles(ListSearch.filter(items, "VLOG")), [
    "City night ride vlog",
    "Weekend camping vlog"
  ]);
  assert.deepEqual(titles(ListSearch.filter(items, "vlog　aka")), ["Weekend camping vlog"]);
  assert.equal(ListSearch.filter(items, "   "), items);
});

test("facets filter by status, duration bucket, and exact author", () => {
  const filters = BrowseFilters.empty();
  assert.equal(BrowseFilters.isActive(filters), false);
  assert.equal(BrowseFilters.apply(items, "", filters), items);

  assert.deepEqual(
    titles(BrowseFilters.apply(items, "", { ...filters, status: BrowseStatusFilter.UNFINISHED })),
    ["Quick sort explained", "City night ride vlog", "Rust in one hour", "Weekend camping vlog"]
  );
  assert.deepEqual(
    titles(BrowseFilters.apply(items, "", { ...filters, status: BrowseStatusFilter.FINISHED })),
    ["Pour-over coffee mistakes"]
  );
  assert.deepEqual(
    titles(BrowseFilters.apply(items, "", { ...filters, duration: BrowseDurationFilter.MEDIUM })),
    ["City night ride vlog", "Pour-over coffee mistakes"]
  );
  assert.deepEqual(
    titles(BrowseFilters.apply(items, "vlog", { ...filters, author: "Aka" })),
    ["Weekend camping vlog"]
  );
});

test("duration buckets use inclusive minimums and exclude unknown durations", () => {
  const bucket = (seconds) => BrowseFilters.durationBucket(video("x", "a", seconds));
  assert.equal(bucket(299), BrowseDurationFilter.SHORT);
  assert.equal(bucket(300), BrowseDurationFilter.MEDIUM);
  assert.equal(bucket(1200), BrowseDurationFilter.LONG);
  assert.equal(bucket(3600), BrowseDurationFilter.EXTENDED);
  assert.equal(BrowseFilters.durationBucket(video("x", "a")), null);
  assert.equal(
    BrowseFilters.durationMatches(video("x", "a"), BrowseDurationFilter.SHORT),
    false
  );
});

test("items without a watch state match only the all status", () => {
  const unknown = video("Unknown", "Aka", 60);
  assert.equal(BrowseFilters.statusMatches(unknown, BrowseStatusFilter.ALL), true);
  assert.equal(BrowseFilters.statusMatches(unknown, BrowseStatusFilter.UNFINISHED), false);
  assert.equal(BrowseFilters.statusMatches(unknown, BrowseStatusFilter.FINISHED), false);
});

test("facet counts apply the query and every other facet", () => {
  const facets = BrowseFilters.facets(items, "", {
    ...BrowseFilters.empty(),
    status: BrowseStatusFilter.UNFINISHED
  });

  assert.deepEqual([...facets.status], [
    [BrowseStatusFilter.ALL, 5],
    [BrowseStatusFilter.UNFINISHED, 4],
    [BrowseStatusFilter.FINISHED, 1]
  ]);
  assert.deepEqual([...facets.duration], [
    [BrowseDurationFilter.ALL, 4],
    [BrowseDurationFilter.SHORT, 1],
    [BrowseDurationFilter.MEDIUM, 1],
    [BrowseDurationFilter.LONG, 1],
    [BrowseDurationFilter.EXTENDED, 1]
  ]);
  assert.deepEqual(facets.author, {
    all: 4,
    authors: [
      { author: "Aka", count: 2 },
      { author: "Muzi", count: 1 },
      { author: "Zhou", count: 1 }
    ]
  });

  const queried = BrowseFilters.facets(items, "vlog", BrowseFilters.empty());
  assert.equal(queried.status.get(BrowseStatusFilter.ALL), 2);
  assert.equal(queried.status.get(BrowseStatusFilter.FINISHED), 0);
});

test("facets are unavailable without data unless active", () => {
  const plain = [video("One", "Aka"), video("Two", "Aka")];
  const facets = BrowseFilters.facets(plain, "", BrowseFilters.empty());
  assert.equal(facets.status, null);
  assert.equal(facets.duration, null);
  assert.equal(facets.author, null);

  const active = BrowseFilters.facets(plain, "", {
    status: BrowseStatusFilter.FINISHED,
    duration: BrowseDurationFilter.LONG,
    author: "Gone"
  });
  assert.equal(active.status.get(BrowseStatusFilter.FINISHED), 0);
  assert.equal(active.duration.get(BrowseDurationFilter.LONG), 0);
  assert.deepEqual(active.author.authors, [{ author: "Gone", count: 0 }]);
});
