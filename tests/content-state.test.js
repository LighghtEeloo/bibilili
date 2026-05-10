const assert = require("node:assert/strict");
const test = require("node:test");

global.window = globalThis;
require("../src/content-state.js");

const { MovedPageNodeStore, SourceRootMarker } =
  globalThis.__bibililiLayoutState;

class FakeElement {
  constructor(name) {
    this.name = name;
    this.children = [];
    this.parentNode = null;
    this.parentElement = null;
    this.isConnected = false;
    this.attributes = new Map();
  }

  append(node) {
    this.insertBefore(node, null);
  }

  insertBefore(node, reference) {
    node.remove?.();

    const index = reference ? this.children.indexOf(reference) : -1;
    const nextIndex = index === -1 ? this.children.length : index;
    this.children.splice(nextIndex, 0, node);
    node.parentNode = this;
    node.parentElement = this;
    node.isConnected = this.isConnected;
  }

  replaceChildren(...nodes) {
    for (const child of [...this.children]) {
      child.remove();
    }

    for (const node of nodes) {
      this.append(node);
    }
  }

  contains(node) {
    if (node === this) {
      return true;
    }

    return this.children.some((child) => child.contains?.(node));
  }

  setAttribute(name, value) {
    this.attributes.set(name, value);
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  remove() {
    if (!this.parentNode) {
      return;
    }

    const siblings = this.parentNode.children;
    siblings.splice(siblings.indexOf(this), 1);
    this.parentNode = null;
    this.parentElement = null;
    this.isConnected = false;
  }
}

class FakeComment extends FakeElement {
  constructor(text) {
    super("#comment");
    this.textContent = text;
  }
}

function fakeDocument() {
  const body = new FakeElement("body");
  body.isConnected = true;

  return {
    body,
    createComment: (text) => new FakeComment(text)
  };
}

test("MovedPageNodeStore restores nodes to their native placeholder", () => {
  const document = fakeDocument();
  const nativeRoot = new FakeElement("native-root");
  const pane = new FakeElement("pane");
  const player = new FakeElement("player");
  const store = new MovedPageNodeStore(document);

  document.body.append(nativeRoot);
  nativeRoot.append(player);

  store.move(player, pane, "player");

  assert.equal(pane.children[0], player);
  assert.equal(nativeRoot.children.length, 1);
  assert.equal(nativeRoot.children[0].textContent, "bibilili player");

  store.restore(player, null);

  assert.deepEqual(nativeRoot.children, [player]);
  assert.deepEqual(pane.children, []);
});

test("MovedPageNodeStore releases stranded nodes from removed placeholders", () => {
  const document = fakeDocument();
  const nativeRoot = new FakeElement("native-root");
  const layoutRoot = new FakeElement("layout-root");
  const pane = new FakeElement("pane");
  const comments = new FakeElement("comments");
  const store = new MovedPageNodeStore(document);

  document.body.append(nativeRoot);
  document.body.append(layoutRoot);
  nativeRoot.append(comments);
  layoutRoot.append(pane);

  store.move(comments, pane, "comments");
  nativeRoot.children[0].remove();
  store.restore(comments, layoutRoot);

  assert.equal(document.body.children.at(-1), comments);
  assert.deepEqual(pane.children, []);
});

test("SourceRootMarker replaces and clears source root markers", () => {
  const marker = new SourceRootMarker("data-source-kind");
  const collectionRoot = new FakeElement("collection");
  const historyRoot = new FakeElement("history");

  marker.mark([
    { root: collectionRoot, kind: "collection" },
    { root: null, kind: "recommendations" }
  ]);

  assert.equal(collectionRoot.getAttribute("data-source-kind"), "collection");

  marker.mark([{ root: historyRoot, kind: "history" }]);

  assert.equal(collectionRoot.getAttribute("data-source-kind"), null);
  assert.equal(historyRoot.getAttribute("data-source-kind"), "history");

  marker.unmark();

  assert.equal(historyRoot.getAttribute("data-source-kind"), null);
});
