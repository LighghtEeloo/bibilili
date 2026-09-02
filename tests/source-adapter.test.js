const assert = require("node:assert/strict");
const test = require("node:test");

const { loadContentRuntime } = require("./helpers/content-runtime.js");

const { RegionDiscovery, SourceAdapter, SourceKind } = loadContentRuntime();

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
