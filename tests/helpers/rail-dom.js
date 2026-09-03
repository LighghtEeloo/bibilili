/** Minimal tree and geometry model for rail reconciliation tests. */
class RailElement {
  constructor(document, tagName) {
    this.ownerDocument = document;
    this.tagName = tagName;
    this.className = "";
    this.children = [];
    this.parentElement = null;
    this.dataset = {};
    this.style = {};
    this.attributes = new Map();
  }

  get classList() {
    return {
      contains: (name) => this.className.split(" ").includes(name),
      toggle: () => {}
    };
  }

  get isConnected() {
    return this === this.ownerDocument.body || Boolean(this.parentElement?.isConnected);
  }

  get firstChild() { return this.children[0] ?? null; }
  get firstElementChild() { return this.firstChild; }
  get nextSibling() {
    const siblings = this.parentElement?.children ?? [];
    return siblings[siblings.indexOf(this) + 1] ?? null;
  }

  matches(selector) {
    return selector.split(",").some((part) => this.classList.contains(part.trim().slice(1)));
  }

  closest(selector) {
    return this.matches(selector) ? this : this.parentElement?.closest(selector) ?? null;
  }

  querySelectorAll(selector) {
    return this.children.flatMap((child) => [
      ...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)
    ]);
  }

  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  contains(node) { return this === node || this.children.some((child) => child.contains(node)); }
  addEventListener() {}
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); }
  focus() { this.ownerDocument.activeElement = this; }

  insertBefore(node, reference) {
    node.remove();
    const index = reference ? this.children.indexOf(reference) : this.children.length;
    this.children.splice(index, 0, node);
    node.parentElement = this;
  }

  append(...nodes) { nodes.forEach((node) => this.insertBefore(node, null)); }
  replaceChildren(...nodes) {
    [...this.children].forEach((node) => node.remove());
    this.append(...nodes);
  }

  remove() {
    if (!this.parentElement) return;
    if (this.contains(this.ownerDocument.activeElement)) {
      this.ownerDocument.activeElement = this.ownerDocument.body;
    }
    const siblings = this.parentElement.children;
    siblings.splice(siblings.indexOf(this), 1);
    this.parentElement = null;
  }

  getBoundingClientRect() {
    const rail = this.ownerDocument.rail;
    return { left: this === rail ? 0 : 12 - rail.scrollLeft };
  }
}

function railFixture(LayoutRoot, count, kind = "history") {
  const document = {
    addEventListener() {}, removeEventListener() {},
    createElement: (tagName) => new RailElement(document, tagName),
    cardWidth: 190
  };
  document.body = document.createElement("body");
  document.activeElement = document.body;
  const demands = [];
  const previews = {
    setDemand: (items) => demands.push(items),
    hydrateItem: (item) => item
  };
  const layout = new LayoutRoot(document, previews);
  const rail = document.createElement("div");
  document.rail = rail;
  document.body.append(rail);
  rail.clientWidth = 1000;
  let scrollLeft = 0;
  Object.defineProperty(rail, "scrollLeft", {
    get: () => {
      const width = Number.parseFloat(rail.querySelector(".bibilili-card-row")?.style.width) || 0;
      return Math.max(0, Math.min(scrollLeft, width + 24 - rail.clientWidth));
    },
    set: (value) => { scrollLeft = value; }
  });
  layout.rail = rail;
  layout.root = document.body;
  layout.sourceBar = document.createElement("div");
  layout.renderSourceBar = () => {};
  const created = [];
  layout.updateVideoCard = (card, item, isCurrent, key, sourceKind) => {
    card.dataset.bibililiCardKey = key;
    card.dataset.bibililiCardSourceKind = sourceKind;
    card.renderedItem = item;
    card.isCurrent = isCurrent;
  };
  layout.videoCard = (item, isCurrent, key, sourceKind) => {
    const card = document.createElement("span");
    card.className = "bibilili-video-card";
    const link = document.createElement("a");
    link.className = "bibilili-card-link";
    const button = document.createElement("button");
    button.className = "bibilili-card-watch-later-button";
    button.hidden = sourceKind !== "watch_later";
    card.append(link, button);
    layout.updateVideoCard(card, item, isCurrent, key, sourceKind);
    created.push(card);
    return card;
  };
  const items = Array.from({ length: count }, (_, index) => ({
    targetUrl: `https://www.bilibili.com/video/av${index + 1}`,
    title: `Video ${index + 1}`
  }));
  const source = { kind, root: null, items, pagination: { hasMore: true, status: "ready" } };
  layout.currentSources = [source];
  layout.selectedSourceKind = kind;
  layout.isRailOpen = true;
  return {
    layout, rail, document, source, demands, created,
    cards: () => rail.querySelectorAll(".bibilili-video-card"),
    card: (index) => rail.querySelectorAll(".bibilili-video-card")
      .find((card) => Number(card.dataset.bibililiCardIndex) === index),
    more: () => rail.querySelector(".bibilili-source-more-button")
  };
}

module.exports = { RailElement, railFixture };
