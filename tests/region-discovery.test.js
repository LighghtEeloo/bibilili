const assert = require("node:assert/strict");
const test = require("node:test");

const { loadContentRuntime } = require("./helpers/content-runtime.js");

const { RegionDiscovery } = loadContentRuntime();

function fakeElement(text) {
  return {
    innerText: text,
    textContent: text,
    closest: () => null,
    querySelectorAll: () => []
  };
}

function fakeDescriptionDocument(element) {
  return {
    querySelectorAll: (selector) => (selector === "#v_desc" ? [element] : [])
  };
}

test("normalizes video description text from native controls", () => {
  assert.equal(
    RegionDiscovery.cleanVideoDescription(
      " First line \n\n展开更多\nSecond line show more"
    ),
    "First line\nSecond line"
  );
});

test("finds the page-owned video description element", () => {
  const description = fakeElement("Rendered description");
  const discovery = new RegionDiscovery(fakeDescriptionDocument(description));

  assert.equal(discovery.findVideoDescription(), description);
});

test("normalizes video tag text from native controls", () => {
  assert.equal(RegionDiscovery.cleanVideoTagText(" 血源诅咒 "), "血源诅咒");
  assert.equal(RegionDiscovery.cleanVideoTagText("展开更多"), null);
});

test("normalizes video tag search URLs", () => {
  const discovery = new RegionDiscovery({
    location: { href: "https://www.bilibili.com/video/BV1aa411c7mD" }
  });

  assert.equal(
    discovery.safeVideoTagUrl("//search.bilibili.com/all?keyword=test"),
    "https://search.bilibili.com/all?keyword=test"
  );
  assert.equal(discovery.safeVideoTagUrl("javascript:alert(1)"), null);
});

test("normalizes uploader space-home profile addresses", () => {
  assert.equal(RegionDiscovery.isUploaderSpaceHomeUrl(null), false);
  assert.equal(
    RegionDiscovery.isUploaderSpaceHomeUrl("//space.bilibili.com/9/favlist"),
    false
  );
  assert.equal(
    RegionDiscovery.isUploaderSpaceHomeUrl("https://www.bilibili.com/9"),
    false
  );
  assert.equal(
    RegionDiscovery.isUploaderSpaceHomeUrl("//space.bilibili.com/2045577567/"),
    true
  );
  assert.equal(
    RegionDiscovery.isUploaderSpaceHomeUrl(
      "//space.bilibili.com/2045577567/?spm_id_from=333.788.upinfo.detail.click"
    ),
    true
  );
});

class FakeDomNode {
  constructor({
    tagName = "div",
    id = null,
    className = "",
    text = "",
    attributes = {}
  } = {}) {
    this.localName = tagName.toLowerCase();
    this.id = id;
    this.className = className;
    this.text = text;
    this.attributes = { ...attributes };
    this.children = [];
    this.parentElement = null;
  }

  append(...children) {
    for (const child of children) {
      child.parentElement = this;
      this.children.push(child);
    }
  }

  get textContent() {
    return this.text + this.children.map((child) => child.textContent).join("");
  }

  getAttribute(name) {
    if (name === "class") {
      return this.className || null;
    }
    if (name === "id") {
      return this.id;
    }
    return this.attributes[name] ?? null;
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
      return this.className.split(/\s+/u).includes(selector.slice(1));
    }

    const classContains = selector.match(/^\[class\*=['"](.+)['"]\]$/u);
    if (classContains) {
      return this.className.includes(classContains[1]);
    }

    const tagAttrContains = selector.match(
      /^([a-z]+)\[([a-z-]+)\*=['"](.+)['"]\]$/iu
    );
    if (tagAttrContains) {
      return (
        this.localName === tagAttrContains[1].toLowerCase() &&
        (this.getAttribute(tagAttrContains[2]) ?? "").includes(
          tagAttrContains[3]
        )
      );
    }

    return this.localName === selector.toLowerCase();
  }

  closest(selector) {
    for (let current = this; current; current = current.parentElement) {
      if (current.matches(selector)) {
        return current;
      }
    }
    return null;
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
}

function fakeWatchDocument(...roots) {
  const body = new FakeDomNode();
  body.append(...roots);

  return { querySelectorAll: (selector) => body.querySelectorAll(selector) };
}

function fakeViewerHeader() {
  const header = new FakeDomNode({ className: "mini-header" });
  header.append(
    new FakeDomNode({
      tagName: "a",
      className: "right-entry__outside",
      text: "收藏",
      attributes: { href: "//space.bilibili.com/9/favlist" }
    }),
    new FakeDomNode({
      tagName: "a",
      className: "header-avatar-wrap",
      attributes: { href: "//space.bilibili.com/9" }
    })
  );

  return header;
}

test("uploader discovery ignores viewer header space links", () => {
  const card = new FakeDomNode({ className: "up-info-container" });
  card.append(
    new FakeDomNode({
      tagName: "a",
      className: "up-name",
      text: "铁骨曾曾",
      attributes: { href: "//space.bilibili.com/42/" }
    })
  );

  const info = new RegionDiscovery(
    fakeWatchDocument(fakeViewerHeader(), card)
  ).findUploaderInfo();

  assert.equal(info.name, "铁骨曾曾");
  assert.equal(info.profileUrl, "https://space.bilibili.com/42/");
});

test("uploader discovery reads the up panel inside list-column containers", () => {
  const panel = new FakeDomNode({ className: "up-panel-container" });
  panel.append(
    new FakeDomNode({
      tagName: "a",
      className: "up-name",
      text: "琪露诺的完美哲学教室",
      attributes: { href: "//space.bilibili.com/3546956708186252/" }
    })
  );

  const card = new FakeDomNode({ className: "video-card" });
  card.append(
    new FakeDomNode({
      tagName: "a",
      className: "upname",
      text: "马库斯Tullius-Cirno",
      attributes: { href: "//space.bilibili.com/327432656" }
    })
  );

  const column = new FakeDomNode({ className: "playlist-container" });
  column.append(panel, card);

  const info = new RegionDiscovery(
    fakeWatchDocument(fakeViewerHeader(), column)
  ).findUploaderInfo();

  assert.equal(info.name, "琪露诺的完美哲学教室");
  assert.equal(info.profileUrl, "https://space.bilibili.com/3546956708186252/");
});

test("uploader discovery stays absent with only viewer header links", () => {
  const info = new RegionDiscovery(
    fakeWatchDocument(fakeViewerHeader())
  ).findUploaderInfo();

  assert.equal(info, null);
});
