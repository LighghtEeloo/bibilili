const assert = require("node:assert/strict");
const test = require("node:test");

const { loadContentRuntime } = require("./helpers/content-runtime.js");

const { LayoutRoot, RegionDiscovery, SourceAdapter, SourceKind } = loadContentRuntime();

class FakeElement {
  constructor(attributes = {}, options = {}) {
    this.attributes = new Map(Object.entries(attributes));
    this.localName = options.tagName ?? "div";
    this.className = options.className ?? attributes.class ?? "";
    this.id = options.id ?? attributes.id ?? "";
    this.ownText = options.text ?? "";
    this.children = [];
    this.parentElement = null;
    this.isConnected = true;
    this.inVideoPod = Boolean(options.inVideoPod);

    if (this.className) {
      this.attributes.set("class", this.className);
    }
    if (this.id) {
      this.attributes.set("id", this.id);
    }
  }

  get textContent() {
    return this.ownText + this.children.map((child) => child.textContent).join("");
  }

  get classList() {
    const tokens = this.className.split(/\s+/u).filter(Boolean);

    return {
      contains: (token) => tokens.includes(token),
      [Symbol.iterator]: () => tokens[Symbol.iterator]()
    };
  }

  append(...children) {
    for (const child of children) {
      child.parentElement = this;
      this.children.push(child);
    }
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  contains(node) {
    for (let current = node; current; current = current.parentElement ?? current.parentNode) {
      if (current === this) return true;
    }
    return false;
  }

  matches(selectorList) {
    return selectorList
      .split(",")
      .some((selector) => this.matchesSingle(selector.trim()));
  }

  matchesSingle(selector) {
    if (!selector) {
      return false;
    }

    if (selector.startsWith("#")) {
      return this.id === selector.slice(1);
    }

    if (selector.startsWith(".")) {
      const classes = selector.slice(1).split(".");
      return classes.every((className) => this.classList.contains(className));
    }

    const attribute = selector.match(
      /^\[([^\]=*]+)(?:([*]?=)["']([^"']*)["'])?\]$/u
    );
    if (attribute) {
      const value = this.getAttribute(attribute[1]);

      if (!attribute[2]) {
        return value !== null;
      }

      return attribute[2] === "*="
        ? value?.includes(attribute[3]) ?? false
        : value === attribute[3];
    }

    const tagAttribute = selector.match(
      /^([a-z][a-z0-9-]*)\[([^\]=*]+)(?:([*]?=)["']([^"']*)["'])?\]$/iu
    );
    if (tagAttribute) {
      if (this.localName !== tagAttribute[1].toLowerCase()) {
        return false;
      }

      const value = this.getAttribute(tagAttribute[2]);
      if (!tagAttribute[3]) {
        return value !== null;
      }

      return tagAttribute[3] === "*="
        ? value?.includes(tagAttribute[4]) ?? false
        : value === tagAttribute[4];
    }

    return this.localName === selector.toLowerCase();
  }

  querySelectorAll(selector) {
    const matches = [];

    for (const child of this.children) {
      if (child.matches(selector)) {
        matches.push(child);
      }
      matches.push(...child.querySelectorAll(selector));
    }

    return matches;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  closest(selector) {
    for (let current = this; current; current = current.parentElement) {
      if (current.matches(selector)) {
        return current;
      }
    }

    return this.inVideoPod && selector === ".video-pod" ? this : null;
  }
}

class FakeAnchorElement extends FakeElement {
  constructor(attributes = {}, options = {}) {
    super(attributes, { ...options, tagName: "a" });
  }
}

global.HTMLAnchorElement = FakeAnchorElement;
global.HTMLImageElement = class FakeImageElement extends FakeElement {};
global.getComputedStyle = () => ({ backgroundImage: "none" });

function titleElement(text) {
  return new FakeElement({}, { className: "title", text });
}

function partElement(title, duration, active = false) {
  const part = new FakeElement(
    {},
    {
      className: `simple-base-item page-item sub${active ? " active" : ""}`
    }
  );
  part.append(
    titleElement(title),
    new FakeElement({}, { className: "duration", text: duration })
  );
  return part;
}

function archiveElement(bvid, title, parts = []) {
  const archive = new FakeElement(
    { "data-key": bvid },
    { className: "pod-item video-pod__item simple" }
  );
  const head = new FakeElement(
    {},
    { className: "simple-base-item head active" }
  );
  head.append(titleElement(title));
  archive.append(head, ...parts);
  return archive;
}

function videoPodDocument(...archives) {
  const body = new FakeElement();
  const root = new FakeElement({}, { className: "video-pod" });
  root.append(...archives);
  body.append(root);

  return {
    body,
    root,
    document: {
      body,
      querySelectorAll: (selector) => body.querySelectorAll(selector)
    }
  };
}

/** Mirrors the standalone multipart pod observed on BV1TwHL6CEL9. */
function flatMultipartDocument(count = 18) {
  const list = new FakeElement({}, { className: "video-pod__list multip list" });
  for (let index = 0; index < count; index += 1) {
    const row = new FakeElement(
      { "data-key": String(43034609689 + index) },
      { className: `simple-base-item video-pod__item normal${index === 0 ? " active" : ""}` }
    );
    const title = index < 10 ? String(index + 1) : `第二季${index - 9}`;
    row.append(
      new FakeElement({ title }, { className: "title", text: title }),
      new FakeElement({}, { className: "stat-item duration", text: index === 1 ? "30:30" : "30:55" })
    );
    list.append(row);
  }
  return { ...videoPodDocument(list), list };
}

function recommendationCard(id, title = `Video ${id}`) {
  const card = new FakeElement({}, { className: "video-page-card-small recommend-video-card" });
  card.append(
    new FakeAnchorElement({ href: `/video/av${id}`, title }),
    new FakeAnchorElement({ href: `/video/av${id}`, title }, { className: "title" }),
    new FakeElement({}, { className: "up-name", text: "Uploader" }),
    new FakeElement({}, { className: "duration", text: "02:34" })
  );
  return card;
}

function recommendationDocument(...cards) {
  const body = new FakeElement();
  const sidebar = new FakeElement({}, { className: "right-container" });
  const root = new FakeElement({}, { id: "reco_list", className: "recommend-list recommend-list-v1" });
  root.append(new FakeElement({}, { tagName: "h3", text: "Recommendations" }), ...cards);
  sidebar.append(root);
  body.append(sidebar);
  return { body, root, document: { body, querySelectorAll: (selector) => body.querySelectorAll(selector) } };
}

test("source discovery shares root reads and reuses an unchanged 80-item source", (t) => {
  const { document, root } = recommendationDocument(
    ...Array.from({ length: 80 }, (_, index) => recommendationCard(index + 1))
  );
  const discovery = new RegionDiscovery(document);
  const extract = t.mock.method(SourceAdapter.prototype, "extractItems");
  const readers = [
    t.mock.method(SourceAdapter, "videoTargetsIn"),
    t.mock.method(discovery, "sourceRootForElement"),
    t.mock.method(discovery, "isValidSourceRoot"),
    t.mock.method(discovery, "sourceHeadingText"),
    t.mock.method(document, "querySelectorAll")
  ];
  const sources = discovery.findSources();

  assert.deepEqual(sources.map((source) => source.kind), [SourceKind.RECOMMENDATIONS]);
  assert.equal(sources[0].root, root);
  assert.deepEqual(sources[0].items.map((item) => item.title),
    Array.from({ length: 80 }, (_, index) => `Video ${index + 1}`));
  assert.equal(sources[0].items[0].author, "Uploader");
  assert.equal(sources[0].items[0].duration, "02:34");
  for (const reader of readers) {
    const keys = reader.mock.calls.map((call) => call.arguments[0]);
    assert.equal(keys.length, new Set(keys).size, "each source DOM read is shared within the pass");
  }
  assert.equal(readers[0].mock.calls.filter((call) => call.arguments[0] === root).length, 1);
  assert.equal(extract.mock.callCount(), 1);
  assert.equal(discovery.findSources()[0].items, sources[0].items);
  assert.equal(extract.mock.callCount(), 1, "a second pass skips all 80 item extractions");
});

test("source discovery refreshes mutated items and discovers newly populated roots", () => {
  const card = recommendationCard(1, "Before mutation");
  const { document, root, body } = recommendationDocument(card);
  const collection = new FakeElement();
  collection.append(new FakeElement({}, { tagName: "h3", text: "Unclassified" }));
  root.parentElement.append(collection);
  const discovery = new RegionDiscovery(document);
  const before = discovery.findSources();
  assert.deepEqual(before.map((source) => source.kind), [SourceKind.RECOMMENDATIONS]);

  for (const anchor of card.children.slice(0, 2)) anchor.attributes.set("title", "After mutation");
  root.append(recommendationCard(2));
  collection.children[0].ownText = "Collection";
  collection.append(recommendationCard(3), recommendationCard(4));
  discovery.sourceItems.invalidate([
    { type: "attributes", target: card.children[0] },
    { type: "childList", target: root, addedNodes: [root.children.at(-1)], removedNodes: [] },
    { type: "childList", target: collection, addedNodes: collection.children.slice(1), removedNodes: [] }
  ]);
  const after = discovery.findSources();
  assert.deepEqual(after.map((source) => source.kind), [SourceKind.COLLECTION, SourceKind.RECOMMENDATIONS]);
  assert.deepEqual(after[1].items.map((item) => item.title), ["After mutation", "Video 2"]);
  assert.equal(before[0].items[0].title, "Before mutation");

  body.children = [];
  assert.deepEqual(discovery.findSources(), [], "removed roots cannot survive a later pass");
  assert.equal(discovery.sourceItems.roots.size, 0, "removed native roots are released");
  body.append(root);
  assert.deepEqual(discovery.findSources().map((source) => source.kind), [SourceKind.RECOMMENDATIONS]);
});

test("unchanged sources reuse extraction across unrelated mutations and account updates", (t) => {
  const { document, root, body } = recommendationDocument(recommendationCard(1));
  const watchLater = new FakeElement({}, { className: "watch-later-list" });
  watchLater.append(new FakeAnchorElement({ href: "/video/av2", title: "Watch later video" }));
  body.append(watchLater);
  const discovery = new RegionDiscovery(document);
  const extract = t.mock.method(SourceAdapter.prototype, "extractItems");
  const first = discovery.findSources();
  assert.equal(extract.mock.callCount(), 2);
  const unrelated = new FakeElement();
  body.append(unrelated);
  discovery.sourceItems.invalidate([
    { type: "childList", target: body, addedNodes: [unrelated], removedNodes: [] },
    { type: "attributes", target: unrelated }
  ]);
  const second = discovery.findSources();
  assert.equal(extract.mock.callCount(), 2, "ordinary reconciliation does not extract unchanged roots");
  assert.equal(second[0].items, first[0].items);
  assert.equal(second[1].items, first[1].items);

  const author = root.children[1].children[2];
  author.ownText = "Updated uploader";
  discovery.sourceItems.invalidate([{ type: "characterData", target: { parentNode: author } }]);
  const third = discovery.findSources();
  assert.equal(extract.mock.callCount(), 3, "only the mutated source is re-extracted");
  assert.equal(third[0].items[0].author, "Updated uploader");
  assert.notEqual(third[0].items, first[0].items);
  assert.equal(third[1].items, first[1].items);
});

test("source extraction invalidates on ancestor attributes, moves, styles, and explicit clearing", (t) => {
  const { document, root, body } = recommendationDocument(recommendationCard(1));
  document.head = new FakeElement({}, { tagName: "head" });
  const discovery = new RegionDiscovery(document);
  const extract = t.mock.method(SourceAdapter.prototype, "extractItems");
  discovery.findSources();
  let expected = 1;
  for (const mutation of [
    { type: "attributes", target: root },
    { type: "attributes", target: root.parentElement },
    { type: "childList", target: body, addedNodes: [root.parentElement], removedNodes: [] },
    { type: "childList", target: body, addedNodes: [], removedNodes: [root] },
    { type: "childList", target: document.head, addedNodes: [], removedNodes: [] }
  ]) {
    discovery.sourceItems.invalidate([mutation]);
    discovery.findSources();
    assert.equal(extract.mock.callCount(), ++expected);
  }
  discovery.sourceItems.clear();
  discovery.findSources();
  assert.equal(extract.mock.callCount(), ++expected, "explicit refresh bypasses retained items");
});

test("native image loads refresh currentSrc without reparsing unrelated source roots", (t) => {
  const card = recommendationCard(1);
  const picture = new global.HTMLImageElement({ src: "https://i0.hdslb.com/old.jpg" }, { tagName: "img" });
  card.append(picture);
  const { document, body } = recommendationDocument(card);
  const discovery = new RegionDiscovery(document);
  const extract = t.mock.method(SourceAdapter.prototype, "extractItems");
  assert.equal(discovery.findSources()[0].items[0].thumbnailUrl, "https://i0.hdslb.com/old.jpg");
  const unrelated = new global.HTMLImageElement();
  body.append(unrelated);
  assert.equal(discovery.sourceItems.invalidateImage(unrelated), false);
  discovery.findSources();
  assert.equal(extract.mock.callCount(), 1);

  picture.currentSrc = "https://i0.hdslb.com/loaded.jpg";
  assert.equal(discovery.sourceItems.invalidateImage(picture), true);
  assert.equal(discovery.findSources()[0].items[0].thumbnailUrl, "https://i0.hdslb.com/loaded.jpg");
  assert.equal(extract.mock.callCount(), 2);
});

test("source caches ignore tracking URLs but refresh route-dependent recommendations", (t) => {
  const previousHref = global.location.href;
  t.after(() => { global.location.href = previousHref; });
  const { document } = recommendationDocument(recommendationCard(1), recommendationCard(2));
  const discovery = new RegionDiscovery(document);
  const extract = t.mock.method(SourceAdapter.prototype, "extractItems");
  const initial = discovery.findSources();
  global.location.href = `${previousHref}?from=player#comments`;
  assert.equal(discovery.findSources()[0].items, initial[0].items);
  assert.equal(extract.mock.callCount(), 1);
  global.location.href = "https://www.bilibili.com/video/av1";
  assert.deepEqual(discovery.findSources()[0].items.map((item) => item.title), ["Video 2"]);
  assert.equal(extract.mock.callCount(), 2);
});

test("parts and collection share archive discovery and refresh after same-document navigation", (t) => {
  const { document } = videoPodDocument(
    archiveElement("BV1aa411c7mD", "First video", [partElement("One", "01:00"), partElement("Two", "02:00")]),
    archiveElement("BV1xx411c7mD", "Second video", [partElement("Three", "03:00"), partElement("Four", "04:00")])
  );
  const previousHref = global.location.href;
  t.after(() => { global.location.href = previousHref; });
  const archives = t.mock.method(SourceAdapter, "videoPodArchiveTargetsIn");
  const discovery = new RegionDiscovery(document);
  const first = discovery.findSources();
  assert.deepEqual(first.map((source) => source.kind), [SourceKind.PARTS, SourceKind.COLLECTION]);
  assert.deepEqual(first[0].items.map((item) => item.title), ["One", "Two"]);
  assert.equal(archives.mock.callCount(), 1);

  global.location.href = "https://www.bilibili.com/video/BV1xx411c7mD";
  const second = discovery.findSources();
  assert.deepEqual(second[0].items.map((item) => item.title), ["Three", "Four"]);
  assert.ok(second[0].items.every((item) => item.targetUrl.includes("BV1xx411c7mD?p=")));
  assert.equal(second[1].items.length, 2);
  assert.equal(archives.mock.callCount(), 2);
});

test("native archive rows skip unused fallback scans and empty pods retain anchor fallback", (t) => {
  const archive = archiveElement("BV1aa411c7mD", "Current video");
  const { root } = videoPodDocument(archive);
  const anchors = t.mock.method(SourceAdapter, "anchorTargetsIn");
  const data = t.mock.method(SourceAdapter, "dataTargetsIn");
  assert.deepEqual(SourceAdapter.videoPodArchiveTargetsIn(root), [archive]);
  assert.equal(anchors.mock.callCount(), 0);
  assert.equal(data.mock.callCount(), 0);

  const fallback = new FakeAnchorElement({ href: "/video/av12" });
  const emptyPod = videoPodDocument(fallback).root;
  assert.deepEqual(SourceAdapter.videoPodArchiveTargetsIn(emptyPod), [fallback]);
  assert.equal(anchors.mock.callCount(), 1);
  assert.equal(data.mock.callCount(), 1);
});

test("usable title attributes avoid descendant queries for both videos and parts", (t) => {
  const target = new FakeAnchorElement({ title: "Named video" });
  const card = new FakeElement();
  const targetReads = t.mock.method(target, "querySelectorAll");
  const cardReads = t.mock.method(card, "querySelectorAll");
  assert.equal(SourceAdapter.titleFor(target, card), "Named video");
  target.attributes.set("title", "1");
  assert.equal(SourceAdapter.videoPartTitleFor(target, card), "1");
  assert.equal(targetReads.mock.callCount(), 0);
  assert.equal(cardReads.mock.callCount(), 0);
});

test("lazy title reads retain selector priority and skip invalid higher-priority values", (t) => {
  const target = new FakeAnchorElement({ title: "01:23", "aria-label": " " });
  target.append(
    titleElement("Lower priority"),
    new FakeElement({}, { className: "title-txt", text: "Preferred title" })
  );
  const reads = t.mock.method(target, "querySelectorAll");
  assert.equal(SourceAdapter.titleFor(target, target), "Preferred title");
  assert.deepEqual(reads.mock.calls.map((call) => call.arguments[0]), [".title-txt"]);

  target.children[1].ownText = "02:34";
  assert.equal(SourceAdapter.titleFor(target, target), "Lower priority");
  target.children = [];
  target.append(new global.HTMLImageElement({ alt: "Image title" }, { tagName: "img" }));
  assert.equal(SourceAdapter.titleFor(target, target), "Image title");
  target.children = [];
  target.ownText = "Plain text title";
  assert.equal(SourceAdapter.titleFor(target, target), "Plain text title");
});

test("metadata and duration reads stop at the first usable selector result", (t) => {
  const card = new FakeElement();
  card.append(
    new FakeElement({}, { className: "up-name", text: " " }),
    new FakeElement({}, { className: "author", text: "Chosen author" }),
    new FakeElement({}, { className: "name", text: "Lower priority" }),
    new FakeElement({}, { className: "duration", text: "Unknown" }),
    new FakeElement({}, { className: "length", text: "03:21" })
  );
  const reads = t.mock.method(card, "querySelectorAll");
  assert.equal(SourceAdapter.metadataFor(card, "author"), "Chosen author");
  assert.deepEqual(reads.mock.calls.map((call) => call.arguments[0]), [".up-name", ".author"]);
  reads.mock.resetCalls();
  assert.equal(SourceAdapter.durationFor(card), "03:21");
  assert.deepEqual(reads.mock.calls.map((call) => call.arguments[0]), [".duration", ".length"]);
});

test("thumbnail lookup reads a shared target and card once and retains image priority", (t) => {
  const card = new FakeElement();
  const attributes = t.mock.method(SourceAdapter, "thumbnailAttributeUrl");
  const styles = t.mock.method(global, "getComputedStyle", () => ({ backgroundImage: "none" }));
  assert.equal(SourceAdapter.thumbnailFor(card, card), null);
  assert.equal(attributes.mock.callCount(), 1);
  assert.equal(styles.mock.callCount(), 1);

  const target = new FakeElement({ "data-src": "//i0.hdslb.com/bfs/archive/target.jpg" });
  styles.mock.mockImplementation(() => ({ backgroundImage: "url(https://i0.hdslb.com/bfs/archive/background.jpg)" }));
  assert.equal(SourceAdapter.thumbnailFor(target, card), "https://i0.hdslb.com/bfs/archive/target.jpg");
  assert.equal(styles.mock.callCount(), 1, "target image attributes precede card background styles");
});

test("resolves numeric video-pod data keys through page fallback", () => {
  const item = new FakeElement({ "data-key": "38266734336" }, { inVideoPod: true });

  assert.equal(
    SourceAdapter.targetUrlFor(item, 1),
    "https://www.bilibili.com/video/BV1aa411c7mD?p=2"
  );
});

test("resolves valid video-pod data-key BV ids before page fallback", () => {
  const item = new FakeElement(
    { "data-key": "BV1xx411c7mD" },
    { inVideoPod: true }
  );

  assert.equal(
    SourceAdapter.targetUrlFor(item, 4),
    "https://www.bilibili.com/video/BV1xx411c7mD"
  );
});

test("falls through invalid BV data before reading archive ids", () => {
  const item = new FakeElement({
    "data-bvid": "38266734336",
    "data-aid": "123456"
  });

  assert.equal(
    SourceAdapter.targetUrlFor(item),
    "https://www.bilibili.com/video/av123456"
  );
});

test("extracts nested video-pod pages as a separate parts source", () => {
  const { document } = videoPodDocument(
    archiveElement("BV1aa411c7mD", "Current video", [
      partElement("1", "31:58", true),
      partElement("2", "30:21"),
      partElement("周更", "01:39")
    ])
  );

  const sources = new RegionDiscovery(document).findSources();

  assert.deepEqual(sources.map((source) => source.kind), [SourceKind.PARTS]);
  assert.deepEqual(
    sources[0].items.map(({ targetUrl, title, duration }) => ({
      targetUrl,
      title,
      duration
    })),
    [
      {
        targetUrl: "https://www.bilibili.com/video/BV1aa411c7mD?p=1",
        title: "1",
        duration: "31:58"
      },
      {
        targetUrl: "https://www.bilibili.com/video/BV1aa411c7mD?p=2",
        title: "2",
        duration: "30:21"
      },
      {
        targetUrl: "https://www.bilibili.com/video/BV1aa411c7mD?p=3",
        title: "周更",
        duration: "01:39"
      }
    ]
  );
});

test("discovers all 18 flat CID-keyed multipart rows without a collection source", (t) => {
  const previousHref = global.location.href;
  t.after(() => { global.location.href = previousHref; });
  global.location.href = "https://www.bilibili.com/video/BV1TwHL6CEL9?p=4";
  const { document } = flatMultipartDocument();
  const sources = new RegionDiscovery(document).findSources();

  assert.deepEqual(sources.map((source) => source.kind), [SourceKind.PARTS]);
  assert.equal(sources[0].items.length, 18);
  assert.deepEqual(sources[0].items.map((item) => item.targetUrl),
    Array.from({ length: 18 }, (_, index) => `https://www.bilibili.com/video/BV1TwHL6CEL9?p=${index + 1}`));
  assert.deepEqual(sources[0].items.map((item) => item.title),
    Array.from({ length: 18 }, (_, index) => index < 10 ? String(index + 1) : `第二季${index - 9}`));
  assert.equal(sources[0].items[0].duration, "30:55");
  assert.equal(sources[0].items[1].duration, "30:30");
});

test("flat multipart discovery refreshes lazy rows and survives page navigation", (t) => {
  const previousHref = global.location.href;
  t.after(() => { global.location.href = previousHref; });
  const { document, list } = flatMultipartDocument(1);
  const discovery = new RegionDiscovery(document);
  assert.deepEqual(discovery.findSources(), [], "one part does not expose a source button");

  const next = flatMultipartDocument(2).list.children[1];
  list.append(next);
  discovery.sourceItems.invalidate([{ type: "childList", target: list, addedNodes: [next], removedNodes: [] }]);
  assert.equal(discovery.findSources()[0].items.length, 2);

  global.location.href = `${previousHref}?p=2`;
  list.children[0].className = "simple-base-item video-pod__item normal";
  next.className += " active";
  assert.deepEqual(discovery.findSources()[0].items.map((item) => item.targetUrl),
    [`${previousHref}?p=1`, `${previousHref}?p=2`]);
});

test("flat multipart extraction requires the native multip list marker", () => {
  const { root, list } = flatMultipartDocument(2);
  list.className = "video-pod__list";
  assert.deepEqual(new SourceAdapter(SourceKind.PARTS, root).extractItems(), []);
  assert.deepEqual(new SourceAdapter(SourceKind.COLLECTION, root).extractItems(), []);
});

test("flat multipart rows nested under another archive do not become current parts", () => {
  const { list } = flatMultipartDocument(2);
  const { root } = videoPodDocument(
    archiveElement("BV1xx411c7mD", "Other video", [list]),
    archiveElement("BV1yy411c7mD", "Another video")
  );
  assert.deepEqual(new SourceAdapter(SourceKind.PARTS, root).extractItems(), []);
  assert.equal(new SourceAdapter(SourceKind.COLLECTION, root).extractItems().length, 2);
});

test("keeps parts before a navigable multi-video collection", () => {
  const { document } = videoPodDocument(
    archiveElement("BV1aa411c7mD", "Current video", [
      partElement("Part one", "10:00", true),
      partElement("Part two", "11:00")
    ]),
    archiveElement("BV1xx411c7mD", "Next video")
  );

  const sources = new RegionDiscovery(document).findSources();

  assert.deepEqual(sources.map((source) => source.kind), [
    SourceKind.PARTS,
    SourceKind.COLLECTION
  ]);
  assert.deepEqual(
    sources.find((source) => source.kind === SourceKind.COLLECTION).items.map(
      (item) => item.targetUrl
    ),
    [
      "https://www.bilibili.com/video/BV1aa411c7mD",
      "https://www.bilibili.com/video/BV1xx411c7mD"
    ]
  );
});

test("bounds collection extraction to a nested video-pod", () => {
  const { root } = videoPodDocument(
    archiveElement("BV1aa411c7mD", "Current video")
  );
  const broadSidebar = new FakeElement({}, { className: "rcmd-tab" });
  broadSidebar.append(
    root,
    archiveElement("BV1xx411c7mD", "Recommendation outside the pod")
  );

  const items = new SourceAdapter(
    SourceKind.COLLECTION,
    broadSidebar
  ).extractItems();

  assert.deepEqual(
    items.map((item) => item.targetUrl),
    ["https://www.bilibili.com/video/BV1aa411c7mD"]
  );
});

test("modified, canceled, download, and new-tab card clicks retain browser behavior", (t) => {
  const previousHTMLElement = global.HTMLElement;
  global.HTMLElement = FakeElement;
  t.after(() => { global.HTMLElement = previousHTMLElement; });
  const layout = new LayoutRoot({});
  const card = new FakeElement({}, { className: "bibilili-video-card" });
  card.dataset = { bibililiCardSourceKind: SourceKind.COLLECTION };
  const link = new FakeAnchorElement({ href: "/video/BV1xx411c7mD" });
  link.href = "https://www.bilibili.com/video/BV1xx411c7mD";
  card.append(link);
  const calls = [];
  layout.onVideoCardNavigate = (...args) => calls.push(args);
  const event = { button: 0, currentTarget: link };
  for (const field of ["ctrlKey", "metaKey", "shiftKey", "altKey", "defaultPrevented"]) {
    layout.handleVideoCardLinkClick({ ...event, [field]: true });
  }
  layout.handleVideoCardLinkClick({ ...event, button: 1 });
  link.target = "_blank";
  layout.handleVideoCardLinkClick(event);
  link.target = "";
  link.attributes.set("download", "");
  layout.handleVideoCardLinkClick(event);
  assert.equal(calls.length, 0);
  link.attributes.delete("download");
  layout.handleVideoCardLinkClick(event);
  assert.deepEqual(calls, [[SourceKind.COLLECTION, link.href, event, undefined]]);
});
