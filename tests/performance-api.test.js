const assert = require("node:assert/strict");
const test = require("node:test");
const { loadContentRuntime } = require("./helpers/content-runtime.js");
const { AccountSourceStore, VideoPreviewStore } = loadContentRuntime();
const { RuntimePerformance } = global.__bibililiPerformance;

test("API diagnostics count transport, parse, and application errors separately from aborts", async (t) => {
  const recorder = new RuntimePerformance();
  recorder.setEnabled(true);
  const results = [
    { ok: true, text: async () => '{"code":0}' },
    { ok: true, text: async () => '{"code":-101}' },
    { ok: false, status: 503 },
    { ok: true, text: async () => 'invalid' },
    new TypeError("network"),
    new DOMException("aborted", "AbortError")
  ];
  t.mock.method(global, "fetch", async () => {
    const result = results.shift();
    if (result instanceof Error) throw result;
    return result;
  });
  for (let index = 0; index < 6; index += 1) {
    try { await AccountSourceStore.requestApiPayload("https://api.bilibili.com/test", {}, recorder); }
    catch (_error) { /* API failures retain their existing rejection behavior. */ }
  }
  const counts = recorder.snapshot().states.visible.counters;
  assert.equal(counts.apiRequests, 6);
  assert.equal(counts.apiErrors, 4);
  assert.equal(counts.apiAborts, 1);
});

test("preview calls share API instrumentation and stale requests cannot alter reset totals", async (t) => {
  const recorder = new RuntimePerformance();
  recorder.setEnabled(true);
  let finish;
  t.mock.method(global, "fetch", () => new Promise((resolve) => { finish = resolve; }));
  const pending = VideoPreviewStore.fetchPreview({ queryName: "aid", queryValue: "1" }, undefined, recorder);
  assert.equal(recorder.snapshot().states.visible.counters.apiRequests, 1);
  recorder.reset();
  finish({ ok: false, status: 500 });
  await assert.rejects(pending);
  const counts = recorder.snapshot().states.visible.counters;
  assert.equal(counts.apiRequests, 0);
  assert.equal(counts.apiErrors, 0);
});
