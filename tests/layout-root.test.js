const assert = require("node:assert/strict");
const test = require("node:test");

const { loadContentRuntime } = require("./helpers/content-runtime.js");

const { LayoutRoot } = loadContentRuntime();

class CountingTextElement {
  constructor() {
    this.text = "";
    this.writes = 0;
  }

  get textContent() {
    return this.text;
  }

  set textContent(value) {
    this.text = String(value);
    this.writes += 1;
  }
}

test("setStableText keeps identical text across passes", () => {
  const element = new CountingTextElement();

  LayoutRoot.setStableText(element, "same title");
  LayoutRoot.setStableText(element, "same title");

  assert.equal(element.writes, 1);
});

test("setStableText writes changed text", () => {
  const element = new CountingTextElement();

  LayoutRoot.setStableText(element, "first");
  LayoutRoot.setStableText(element, "second");

  assert.equal(element.textContent, "second");
  assert.equal(element.writes, 2);
});

test("setStableText tolerates a missing element", () => {
  assert.doesNotThrow(() => LayoutRoot.setStableText(null, "text"));
});
