(() => {
  "use strict";

  /** Mutually exclusive runtime states. Off includes visible and hidden documents. */
  const PerformanceState = Object.freeze({ VISIBLE: "visible", HIDDEN: "hidden", OFF: "off" });
  /** Counters describe extension work, not browser-wide events or hardware wakeups. */
  const PerformanceCounter = Object.freeze({
    REQUESTS: "reconcileRequests", MUTATIONS: "mutationBatches",
    NAVIGATION: "navigationTicks", LOADING: "loadingTicks",
    API: "apiRequests", API_ERRORS: "apiErrors", API_ABORTS: "apiAborts",
    CACHE: "previewCacheHits"
  });
  /** Inclusive synchronous durations; nested work must not be added together. */
  const PerformanceWork = Object.freeze({
    RECONCILE: "reconcile", DISCOVERY: "discovery", LAYOUT: "layout", RAIL: "rail"
  });
  /** Causes count scheduling requests before coalescing, including hidden deferrals. */
  const ReconcileCause = Object.freeze({
    PAGE: "page", MUTATION: "mutation", SETTLING: "settling", ACCOUNT: "account",
    SETTINGS: "settings", VISIBILITY: "visibility", THEME: "theme", COMMENTS: "comments",
    RECOVERY: "recovery", CATALOG: "catalog", ACTION: "action"
  });

  /**
   * Aggregates per-document measurements in fixed-size records without timers or observers.
   * Disabling freezes totals; reset and recording changes invalidate unfinished samples.
   */
  class RuntimePerformance {
    /** @param {() => number} [now] Monotonic clock, injectable for deterministic tests. */
    constructor(now = () => performance.now()) {
      this.now = now;
      this.enabled = false;
      this.state = PerformanceState.VISIBLE;
      this.generation = 0;
      this.reset();
    }

    /** Clears measurements while preserving the recording preference and runtime state. */
    reset() {
      this.generation += 1;
      this.states = Object.fromEntries(Object.values(PerformanceState).map((state) => [state, {
        elapsedMs: 0,
        counters: Object.fromEntries(Object.values(PerformanceCounter).map((key) => [key, 0])),
        work: Object.fromEntries(Object.values(PerformanceWork).map((key) => [key,
          { count: 0, totalMs: 0, maxMs: 0 }])),
        causes: Object.fromEntries(Object.values(ReconcileCause).map((key) => [key, 0]))
      }]));
      this.since = this.enabled ? this.now() : null;
    }

    /** Freezes or resumes this document's totals without scheduling background work. */
    setEnabled(enabled) {
      if (this.enabled === enabled) return;
      this.accrue();
      this.enabled = enabled;
      this.generation += 1;
      this.since = enabled ? this.now() : null;
    }

    /** Accounts for the old state's elapsed recording time before a lifecycle change. */
    setState(enabled, hidden) {
      const state = !enabled ? PerformanceState.OFF
        : hidden ? PerformanceState.HIDDEN : PerformanceState.VISIBLE;
      if (this.state === state) return;
      this.accrue();
      this.state = state;
    }

    /** Advances elapsed time only on existing events or an explicit snapshot. */
    accrue() {
      if (!this.enabled) return;
      const now = this.now();
      this.states[this.state].elapsedMs += Math.max(0, now - this.since);
      this.since = now;
    }

    /** @param {string} counter Closed PerformanceCounter value. */
    count(counter) {
      if (this.enabled) this.states[this.state].counters[counter] += 1;
    }

    /** @param {string} cause Closed ReconcileCause value. */
    request(cause) {
      if (!this.enabled) return;
      this.states[this.state].counters[PerformanceCounter.REQUESTS] += 1;
      this.states[this.state].causes[cause] += 1;
    }

    /** @returns {PerformanceSample | null} Captures only a clock and state, never page data. */
    begin() {
      return this.enabled
        ? { generation: this.generation, state: this.state, started: this.now() } : null;
    }

    /** Consumes a sample once, ignoring work crossing reset or recording boundaries. */
    accept(sample) {
      if (!sample || !this.enabled || sample.generation !== this.generation) return false;
      sample.generation = -1;
      return true;
    }

    /** @param {string} work Closed PerformanceWork value. @param {PerformanceSample | null} sample */
    end(work, sample) {
      if (!this.accept(sample)) return;
      const duration = Math.max(0, this.now() - sample.started);
      const record = this.states[sample.state].work[work];
      record.count += 1;
      record.totalMs += duration;
      record.maxMs = Math.max(record.maxMs, duration);
    }

    /** Counts an API start; outcomes remain attributed to its starting runtime state. */
    beginRequest() {
      this.count(PerformanceCounter.API);
      return this.begin();
    }

    /** Counts failed or canceled requests only when their entire observation is retained. */
    endRequest(sample, failed, aborted = false) {
      if (!this.accept(sample)) return;
      if (aborted) this.states[sample.state].counters[PerformanceCounter.API_ABORTS] += 1;
      else if (failed) this.states[sample.state].counters[PerformanceCounter.API_ERRORS] += 1;
    }

    /** Returns detached, bounded records suitable for presentation and JSON export. */
    snapshot() {
      this.accrue();
      return {
        schemaVersion: 1, recording: this.enabled, state: this.state,
        states: Object.fromEntries(Object.entries(this.states).map(([state, value]) => [state, {
          elapsedMs: value.elapsedMs, counters: { ...value.counters }, causes: { ...value.causes },
          work: Object.fromEntries(Object.entries(value.work).map(([key, record]) => [key, { ...record }]))
        }]))
      };
    }
  }

  /**
   * @typedef {object} PerformanceSample
   * @property {number} generation Recording interval identity; consumed samples use -1.
   * @property {string} state Runtime state at work or request start.
   * @property {number} started Monotonic start time in milliseconds.
   */

  window.__bibililiPerformance = Object.freeze({
    RuntimePerformance, PerformanceState, PerformanceCounter, PerformanceWork, ReconcileCause
  });
})();
