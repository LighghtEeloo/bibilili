(() => {
  "use strict";

  const { PerformanceState, PerformanceWork } = window.__bibililiPerformance;
  const STORAGE_KEY = "bibilili-performance-trace";
  const MAX_EVENTS = 80;
  const MAX_STORED_LENGTH = 64000;
  const RETENTION_MS = 30 * 60 * 1000;
  const CHECKPOINT_MS = 5000;
  const WINDOW_MS = 10000;
  const SLOW_WORK_MS = 100;
  const SEVERE_WORK_MS = 1000;
  const LONG_TASK_MS = 200;
  const TICK_GAP_MS = 2000;
  const BUFFERING_MS = 3000;
  const SEVERE_BUFFERING_MS = 10000;
  const MEDIA_EVENTS = ["waiting", "stalled", "playing", "canplay", "pause", "seeking", "loadstart", "error"];
  const LEVELS = Object.freeze({ quiet: 0, warning: 1, severe: 2 });
  /** Closed diagnostic vocabulary; details contain measurements, never page text. */
  const EVENT_TYPES = Object.freeze([
    "recording_started", "page_hidden", "page_visible", "pagehide", "route_change",
    "window_focus", "window_blur", "page_frozen", "page_resumed",
    "navigation_start", "navigation_success", "navigation_fallback", "player_recovery",
    "slow_extension_work", "busy_extension", "long_task", "timer_gap", "api_burst", "api_error",
    "media_waiting", "media_wait_ended", "media_error", "buffering"
  ]);

  /**
   * Records bounded evidence alongside aggregate measurements. The controller's
   * existing navigation tick checks responsiveness and buffering; no timer is added.
   * Long-task observation covers the page and cannot attribute a task to Bibilili.
   */
  class PerformanceMonitor {
    /**
     * @param {Document} document
     * @param {RuntimePerformance} recorder
     * @param {{ media: () => HTMLMediaElement | null, route: () => string | null,
     *   onChange: () => void }} options
     */
    constructor(document, recorder, options) {
      this.document = document;
      this.recorder = recorder;
      this.options = options;
      this.enabled = false;
      this.active = false;
      this.frozen = false;
      this.foreground = false;
      this.hidden = Boolean(document.hidden);
      this.initialized = false;
      this.observer = null;
      this.observationStarted = 0;
      this.longTasksSupported = Boolean(window.PerformanceObserver?.supportedEntryTypes?.includes("longtask"));
      this.mediaHandler = (event) => this.handleMedia(event);
      this.pageHideHandler = (event) => {
        this.event("pagehide", { persisted: Boolean(event.persisted) });
        this.checkpoint(true);
      };
      this.focusHandler = () => this.handleFocus(true);
      this.blurHandler = () => this.handleFocus(false);
      this.freezeHandler = () => this.handleFreeze(true);
      this.resumeHandler = () => this.handleFreeze(false);
      this.events = [];
      this.sequence = 0;
      this.acknowledged = 0;
      /** @type {{ warning: PerformanceEvent | null, severe: PerformanceEvent | null }} */
      this.alerts = { warning: null, severe: null };
      this.previous = null;
      this.lastTick = null;
      this.lastCheckpoint = -Infinity;
      this.waiting = null;
      this.window = null;
      this.startedAt = Date.now();
    }

    /** Starts local capture on demand; disabling releases observation and stored traces. */
    setEnabled(enabled) {
      if (this.enabled === enabled) return;
      this.enabled = enabled;
      if (enabled) {
        this.frozen = false;
        if (!this.initialized) {
          this.initialized = true;
          this.previous = this.readPrevious();
          this.event("recording_started");
        }
        window.addEventListener?.("pagehide", this.pageHideHandler);
        window.addEventListener?.("focus", this.focusHandler);
        window.addEventListener?.("blur", this.blurHandler);
        this.document.addEventListener?.("freeze", this.freezeHandler);
        this.document.addEventListener?.("resume", this.resumeHandler);
      } else {
        this.setActive(false);
        this.removeLifecycleListeners();
        this.removeStored();
      }
      this.options.onChange();
    }

    /**
     * Observes enabled watch pages, including background playback. Actual media
     * events and measured work remain useful when browser timers are throttled.
     */
    setActive(active) {
      active = this.enabled && active;
      if (this.active === active) {
        this.syncTiming();
        return;
      }
      this.active = active;
      this.lastTick = null;
      this.foreground = false;
      this.waiting = null;
      this.window = null;
      this.observer?.disconnect();
      this.observer = null;
      for (const name of MEDIA_EVENTS) this.document.removeEventListener?.(name, this.mediaHandler, true);
      if (!active) {
        this.checkpoint(true);
        return;
      }
      this.syncTiming();
      this.observationStarted = this.recorder.now();
      for (const name of MEDIA_EVENTS) this.document.addEventListener?.(name, this.mediaHandler, true);
      if (this.longTasksSupported) {
        try {
          const observer = new window.PerformanceObserver((list) => {
            if (!this.active || this.frozen || this.observer !== observer) return;
            for (const entry of list.getEntries()) {
              if (entry.startTime >= this.observationStarted && entry.duration >= LONG_TASK_MS) {
                this.event("long_task", { durationMs: entry.duration },
                  entry.duration >= SEVERE_WORK_MS ? "severe" : "warning");
              }
            }
          });
          this.observer = observer;
          observer.observe({ type: "longtask", buffered: false });
        } catch (_error) {
          this.observer?.disconnect();
          this.observer = null;
        }
      }
    }

    /** Uses foreground timer gaps only; focus and visibility are independent signals. */
    syncTiming() {
      const hidden = Boolean(this.document.hidden);
      const foreground = this.active && !this.frozen && !hidden && this.document.hasFocus?.() !== false;
      if (foreground !== this.foreground) {
        this.foreground = foreground;
        this.lastTick = foreground ? this.recorder.now() : null;
      }
      if (hidden !== this.hidden) {
        this.hidden = hidden;
        this.window = null;
        this.checkpoint(true);
      }
    }

    /** Records app/window focus without interpreting focus loss as a playback interruption. */
    handleFocus(focused) {
      this.event(focused ? "window_focus" : "window_blur");
      this.syncTiming();
      this.checkpoint(true);
    }

    /** Excludes browser suspension from both responsiveness and buffering intervals. */
    handleFreeze(frozen) {
      this.frozen = frozen;
      this.finishWaiting(frozen ? "freeze" : "resume");
      this.event(frozen ? "page_frozen" : "page_resumed");
      this.observationStarted = this.recorder.now();
      this.observer?.takeRecords();
      this.syncTiming();
      this.checkpoint(true);
    }

    /** Releases lifecycle listeners shared by foreground and background diagnostics. */
    removeLifecycleListeners() {
      window.removeEventListener?.("pagehide", this.pageHideHandler);
      window.removeEventListener?.("focus", this.focusHandler);
      window.removeEventListener?.("blur", this.blurHandler);
      this.document.removeEventListener?.("freeze", this.freezeHandler);
      this.document.removeEventListener?.("resume", this.resumeHandler);
    }

    /** Releases listeners when this controller is replaced. */
    stop() {
      this.checkpoint(true);
      this.setActive(false);
      this.removeLifecycleListeners();
      this.enabled = false;
    }

    /** Clears current and previous evidence together with the Settings reset action. */
    reset() {
      this.events = [];
      this.previous = null;
      this.acknowledged = this.sequence;
      this.alerts = { warning: null, severe: null };
      this.window = null;
      this.waiting = null;
      this.lastTick = this.foreground ? this.recorder.now() : null;
      this.observationStarted = this.recorder.now();
      this.observer?.takeRecords();
      this.removeStored();
      this.options.onChange();
    }

    /** Appends one bounded, structured event and updates the indicator only on alerts. */
    event(type, details = {}, level = "quiet") {
      if (!this.enabled) return;
      if (!EVENT_TYPES.includes(type) || !Object.hasOwn(LEVELS, level)) throw new Error("Unknown performance event");
      const event = { sequence: ++this.sequence, atMs: Math.round(this.recorder.now()),
        state: this.recorder.state, focused: this.document.hasFocus?.() ?? null,
        type, level, details: { ...details } };
      this.events.push(event);
      if (this.events.length > MAX_EVENTS) this.events.shift();
      if (level !== "quiet") this.alerts[level] = event;
      if (level !== "quiet") this.options.onChange();
    }

    /** Fixed ten-second windows diagnose bursts and repeated expensive passes. */
    activityWindow() {
      const now = this.recorder.now();
      if (!this.window || this.window.state !== this.recorder.state || now - this.window.started >= WINDOW_MS) {
        this.window = { started: now, state: this.recorder.state, requests: 0, passes: 0, workMs: 0, warned: false };
      }
      return this.window;
    }

    /** Receives completed extension timings; nested discovery/layout phases stay in totals. */
    work(work, durationMs, state) {
      if (!this.enabled || state === PerformanceState.OFF) return;
      if (work !== PerformanceWork.RECONCILE && work !== PerformanceWork.RAIL) return;
      if (durationMs >= SLOW_WORK_MS) {
        this.event("slow_extension_work", { work, durationMs }, durationMs >= SEVERE_WORK_MS ? "severe" : "warning");
      }
      if (work !== PerformanceWork.RECONCILE) return;
      const recent = this.activityWindow();
      recent.passes += 1;
      recent.workMs += durationMs;
      if (!recent.warned && recent.passes >= 10 && recent.workMs >= 1000) {
        recent.warned = true;
        this.event("busy_extension", { count: recent.passes, durationMs: recent.workMs }, "warning");
      }
    }

    /** Counts actual extension API starts, not native player downloads. */
    request() {
      if (!this.enabled || this.recorder.state === PerformanceState.OFF) return;
      const recent = this.activityWindow();
      if (++recent.requests === 20) this.event("api_burst", { count: recent.requests }, "warning");
    }

    /** Samples the existing 500 ms navigation tick; gaps are symptoms, not proof of a cause. */
    tick() {
      if (!this.enabled || !this.active || this.frozen) return;
      this.syncTiming();
      const now = this.recorder.now();
      if (this.lastTick !== null && now - this.lastTick >= TICK_GAP_MS) {
        this.event("timer_gap", { durationMs: now - this.lastTick }, "severe");
      }
      this.lastTick = this.foreground ? now : null;
      const media = this.options.media();
      // Note: recording can begin after the native waiting event has already fired.
      if (!this.waiting && media) this.handleMedia({ type: "waiting", target: media });
      if (this.waiting) {
        if (media !== this.waiting.media || media?.paused || media?.seeking || media?.ended || media?.readyState >= 3) {
          this.finishWaiting("state_changed");
        } else {
          this.recordBuffering();
        }
      }
      this.checkpoint();
    }

    /** Observes the mounted media element without modifying playback or network state. */
    handleMedia(event) {
      if (!this.active || this.frozen || event.target !== this.options.media()) return;
      const media = event.target;
      if (event.type === "error") {
        this.event("media_error", { code: Number(media.error?.code) || 0 }, "severe");
        this.waiting = null;
        this.checkpoint(true);
      } else if (event.type === "waiting" || event.type === "stalled") {
        // Note: stalled can fire while buffered playback remains healthy.
        if (!media.paused && !media.seeking && !media.ended && media.readyState < 3 && !this.waiting) {
          this.waiting = { media, started: this.recorder.now(), level: "quiet" };
          this.event("media_waiting");
        }
      } else {
        this.finishWaiting(event.type);
      }
    }

    /** Records threshold crossings from a timer or a native recovery event. */
    recordBuffering() {
      const durationMs = this.recorder.now() - this.waiting.started;
      const level = durationMs >= SEVERE_BUFFERING_MS ? "severe" : durationMs >= BUFFERING_MS ? "warning" : "quiet";
      if (LEVELS[level] > LEVELS[this.waiting.level]) {
        this.waiting.level = level;
        this.event("buffering", { durationMs }, level);
      }
    }

    /** Closes a buffering interval after recovery, a pause, a seek, or a new media load. */
    finishWaiting(reason) {
      if (!this.waiting) return;
      // A throttled background timer may not run between waiting and recovery.
      if (reason === "playing" || reason === "canplay") this.recordBuffering();
      this.event("media_wait_ended", { durationMs: this.recorder.now() - this.waiting.started, reason });
      this.waiting = null;
      this.checkpoint();
    }

    /** Retains the newest event per severity so ring eviction cannot clear pending alerts. */
    get alert() { return this.alerts.severe ?? this.alerts.warning; }

    /** Returns the most severe unacknowledged event, including the previous document. */
    status() {
      let result = { level: "quiet", type: null };
      for (const event of [this.previous?.alert, this.alert]) {
        if (event && LEVELS[event.level] >= LEVELS[result.level]) {
          result = { level: event.level, type: event.type };
        }
      }
      return result;
    }

    /** Acknowledges only evidence included in a successful copy; newer alerts survive. */
    acknowledge(snapshot) {
      this.acknowledged = Math.max(this.acknowledged, snapshot.current.sequence);
      for (const level of ["warning", "severe"]) {
        if (this.alerts[level]?.sequence <= this.acknowledged) this.alerts[level] = null;
      }
      if (this.previous && snapshot.previous?.startedAt === this.previous.startedAt) {
        this.previous.acknowledged = this.previous.sequence;
        this.previous.alert = null;
      }
      this.options.onChange();
      this.checkpoint(true);
    }

    /** Captures media measurements and the canonical watch identity, without URL queries or page text. */
    context() {
      const media = this.options.media();
      let bufferedAhead = 0;
      for (let index = 0; index < (media?.buffered?.length ?? 0); index += 1) {
        if (media.buffered.start(index) <= media.currentTime && media.buffered.end(index) >= media.currentTime) {
          bufferedAhead = media.buffered.end(index) - media.currentTime;
          break;
        }
      }
      return {
        route: this.options.route(), hidden: Boolean(this.document.hidden),
        focused: this.document.hasFocus?.() ?? null, frozen: this.frozen,
        navigationType: window.performance?.getEntriesByType?.("navigation")[0]?.type ?? null,
        wasDiscarded: Boolean(this.document.wasDiscarded), longTaskObserver: this.observer !== null,
        media: media ? { currentTime: media.currentTime, readyState: media.readyState,
          networkState: media.networkState, paused: media.paused, seeking: media.seeking,
          muted: media.muted, volume: media.volume, playbackRate: media.playbackRate,
          bufferedAhead: Math.round(bufferedAhead * 100) / 100, errorCode: media.error?.code ?? null } : null
      };
    }

    /** @returns {object} One bounded document trace, suitable for local tab storage. */
    trace() {
      return { schemaVersion: 1, startedAt: this.startedAt, capturedAt: Date.now(),
        timeOrigin: window.performance?.timeOrigin ?? null,
        sequence: this.sequence, acknowledged: this.acknowledged, context: this.context(),
        alert: this.alert ? { ...this.alert, details: { ...this.alert.details } } : null,
        events: this.events.map((event) => ({ ...event, details: { ...event.details } })),
        totals: this.recorder.snapshot() };
    }

    /** Copies a current trace and one retained trace, with no recursive history. */
    snapshot() {
      return { current: this.trace(), previous: this.previous ? JSON.parse(JSON.stringify(this.previous)) : null };
    }

    /** Saves at most once per five seconds, plus explicit departure/fallback checkpoints. */
    checkpoint(force = false) {
      if (!this.enabled) return;
      const now = this.recorder.now();
      if (!force && now - this.lastCheckpoint < CHECKPOINT_MS) return;
      this.lastCheckpoint = now;
      try { window.sessionStorage?.setItem(STORAGE_KEY, JSON.stringify(this.trace())); }
      catch (_error) { /* Storage restrictions leave in-memory diagnostics usable. */ }
    }

    /** Reads only a recent, bounded trace from this tab's preceding document. */
    readPrevious() {
      try {
        const text = window.sessionStorage?.getItem(STORAGE_KEY);
        if (!text || text.length > MAX_STORED_LENGTH) return null;
        const trace = JSON.parse(text);
        if (trace.schemaVersion !== 1 || !Number.isFinite(trace.startedAt) || !Number.isFinite(trace.capturedAt) ||
            Date.now() - trace.capturedAt < 0 || Date.now() - trace.capturedAt > RETENTION_MS ||
            !Array.isArray(trace.events) || trace.events.length > MAX_EVENTS ||
            !Number.isSafeInteger(trace.sequence) || !Number.isSafeInteger(trace.acknowledged) ||
            trace.acknowledged < 0 || trace.sequence < trace.acknowledged) return null;
        const events = trace.events.map((event) => this.readEvent(event, trace.sequence));
        const alert = trace.alert ? this.readEvent(trace.alert, trace.sequence) : null;
        if (events.some((event) => !event) || (trace.alert && !alert)) return null;
        // Origin storage is page-owned. Retain only the monitor's closed measurement shape.
        return { schemaVersion: 1, startedAt: trace.startedAt, capturedAt: trace.capturedAt,
          timeOrigin: Number.isFinite(trace.timeOrigin) ? trace.timeOrigin : null,
          sequence: trace.sequence, acknowledged: trace.acknowledged, events,
          alert: alert?.sequence > trace.acknowledged ? alert : null,
          context: this.readShape(trace.context, { ...this.context(), media: {
            currentTime: 0, readyState: 0, networkState: 0, paused: false, seeking: false,
            muted: false, volume: 0, playbackRate: 0,
            bufferedAhead: 0, errorCode: 0
          } }),
          totals: this.readShape(trace.totals, this.recorder.snapshot()) };
      } catch (_error) { return null; }
    }

    /** Validates persisted evidence and drops arbitrary strings from page-owned storage. */
    readEvent(event, sequence) {
      if (!event || !EVENT_TYPES.includes(event.type) || !Object.hasOwn(LEVELS, event.level) ||
          !Object.values(PerformanceState).includes(event.state) || !Number.isFinite(event.atMs) ||
          !Number.isSafeInteger(event.sequence) || event.sequence <= 0 || event.sequence > sequence) return null;
      const details = {};
      for (const key of ["durationMs", "count", "code"]) {
        if (Number.isFinite(event.details?.[key])) details[key] = event.details[key];
      }
      if (typeof event.details?.persisted === "boolean") details.persisted = event.details.persisted;
      if (Object.values(PerformanceWork).includes(event.details?.work)) details.work = event.details.work;
      const reasons = [...MEDIA_EVENTS, "state_changed", "route_change", "timeout", "native_failure", "freeze", "resume"];
      if (reasons.includes(event.details?.reason)) details.reason = event.details.reason;
      return { sequence: event.sequence, atMs: event.atMs, state: event.state,
        focused: typeof event.focused === "boolean" ? event.focused : null,
        type: event.type, level: event.level, details };
    }

    /** Copies fixed records with numeric/boolean leaves and recognized navigation metadata. */
    readShape(value, shape) {
      return Object.fromEntries(Object.entries(shape).map(([key, fallback]) => {
        const item = value?.[key];
        let result = null;
        if (typeof fallback === "number") result = Number.isFinite(item) ? item : null;
        else if (typeof fallback === "boolean") result = typeof item === "boolean" ? item : null;
        else if (fallback && typeof fallback === "object" && item) result = this.readShape(item, fallback);
        else if (key === "state" && Object.values(PerformanceState).includes(item)) result = item;
        else if (key === "navigationType" && ["navigate", "reload", "back_forward", "prerender"].includes(item)) result = item;
        else if (key === "route" && typeof item === "string" && item.length <= 80 &&
            /^video:(?:BV[0-9A-Za-z]+|av\d+):p\d+$/u.test(item)) result = item;
        return [key, result];
      }));
    }

    /** Removes persisted diagnostics when recording is disabled or measurements reset. */
    removeStored() {
      try { window.sessionStorage?.removeItem(STORAGE_KEY); }
      catch (_error) { /* The current in-memory trace is still cleared or paused. */ }
    }
  }

  /**
   * @typedef {object} PerformanceEvent
   * @property {number} sequence Monotonic document-local event identifier.
   * @property {number} atMs Milliseconds on the document performance clock.
   * @property {string} state Runtime state when observed.
   * @property {boolean | null} focused Whether the page had focus, independently of visibility.
   * @property {string} type Closed diagnostic event name.
   * @property {"quiet" | "warning" | "severe"} level Heuristic severity, not cause attribution.
   * @property {object} details Numeric measurements and closed lifecycle labels.
   */

  window.__bibililiPerformanceMonitor = Object.freeze({ PerformanceMonitor });
})();
