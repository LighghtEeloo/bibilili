const assert = require("node:assert/strict");
const test = require("node:test");

class FakeNode {
  constructor() {
    this.nodeType = FakeNode.ELEMENT_NODE;
    this.parentElement = null;
  }
}

FakeNode.ELEMENT_NODE = 1;

class FakeElement extends FakeNode {
  constructor({
    tagName = "div",
    className = "",
    attributes = {},
    rect = { left: 0, top: 0, width: 0, height: 0 }
  } = {}) {
    super();
    this.localName = tagName.toLowerCase();
    this.className = className;
    this.attributes = { ...attributes };
    this.children = [];
    this.isConnected = true;
    this.rect = rect;
  }

  append(...children) {
    for (const child of children) {
      child.parentElement = this;
      this.children.push(child);
    }
  }

  contains(node) {
    for (let current = node; current; current = current.parentElement) {
      if (current === this) {
        return true;
      }
    }

    return false;
  }

  closest(selector) {
    for (let current = this; current; current = current.parentElement) {
      if (current.matches(selector)) {
        return current;
      }
    }

    return null;
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

    if (selector.startsWith(".")) {
      return this.hasClass(selector.slice(1));
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
        this.attributeValue(tagAttrContains[2]).includes(tagAttrContains[3])
      );
    }

    const attrEquals = selector.match(/^\[([a-z-]+)=['"](.+)['"]\]$/iu);
    if (attrEquals) {
      return this.attributeValue(attrEquals[1]) === attrEquals[2];
    }

    return this.localName === selector.toLowerCase();
  }

  hasClass(className) {
    return this.className.split(/\s+/u).includes(className);
  }

  attributeValue(name) {
    return name === "class" ? this.className : this.attributes[name] ?? "";
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

  getBoundingClientRect() {
    return this.rect;
  }
}

class FakeMouseEvent {
  constructor({ target, clientX, clientY }) {
    this.target = target;
    this.clientX = clientX;
    this.clientY = clientY;
  }
}

global.Node = FakeNode;
global.Element = FakeElement;
global.MouseEvent = FakeMouseEvent;

const { loadContentRuntime } = require("./helpers/content-runtime.js");

const { LayoutRoot } = loadContentRuntime();

function layoutFor(commentNode) {
  return Object.assign(Object.create(LayoutRoot.prototype), { commentNode });
}

function element(options) {
  return new FakeElement(options);
}

function mouseEvent(target, clientX, clientY) {
  return new FakeMouseEvent({ target, clientX, clientY });
}

test("comment-row profile links keep native avatar navigation", () => {
  const comment = element({ rect: { left: 0, top: 0, width: 320, height: 480 } });
  const row = element({
    className: "reply-item",
    rect: { left: 0, top: 64, width: 320, height: 96 }
  });
  const link = element({
    tagName: "a",
    attributes: { href: "https://space.bilibili.com/42" },
    rect: { left: 12, top: 80, width: 44, height: 44 }
  });
  const avatar = element({
    tagName: "img",
    className: "avatar",
    rect: { left: 12, top: 80, width: 44, height: 44 }
  });

  comment.append(row);
  row.append(link);
  link.append(avatar);

  assert.equal(
    layoutFor(comment).isCommentAccountAvatarClick(
      mouseEvent(avatar, 24, 92)
    ),
    false
  );
});

test("composer avatar links still bridge to the native account control", () => {
  const comment = element({ rect: { left: 0, top: 0, width: 320, height: 480 } });
  const composer = element({
    className: "reply-box",
    rect: { left: 0, top: 0, width: 320, height: 120 }
  });
  const link = element({
    tagName: "a",
    attributes: { href: "https://space.bilibili.com/7" },
    rect: { left: 16, top: 24, width: 48, height: 48 }
  });
  const avatar = element({
    tagName: "img",
    className: "avatar",
    rect: { left: 16, top: 24, width: 48, height: 48 }
  });

  comment.append(composer);
  composer.append(link);
  link.append(avatar);

  assert.equal(
    layoutFor(comment).isCommentAccountAvatarClick(
      mouseEvent(avatar, 32, 40)
    ),
    true
  );
});

test("retargeted top-left composer avatar clicks use the fallback zone", () => {
  const comment = element({ rect: { left: 0, top: 0, width: 320, height: 480 } });

  assert.equal(
    layoutFor(comment).isCommentAccountAvatarClick(mouseEvent(comment, 24, 72)),
    true
  );
});

test("visible comment rows clamp the retargeted avatar fallback", () => {
  const comment = element({ rect: { left: 0, top: 0, width: 320, height: 480 } });
  const row = element({
    className: "reply-item",
    rect: { left: 0, top: 96, width: 320, height: 96 }
  });

  comment.append(row);

  assert.equal(
    layoutFor(comment).isCommentAccountAvatarClick(mouseEvent(comment, 24, 112)),
    false
  );
});
