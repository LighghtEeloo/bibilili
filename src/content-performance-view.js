(() => {
  "use strict";

  const { UiControl } = window.__bibililiControls;
  const { UiMessage, UiStrings } = window.__bibililiI18n;
  const { PerformanceState, PerformanceCounter, PerformanceWork, ReconcileCause } = window.__bibililiPerformance;

  const STATE_LABELS = Object.freeze({
    [PerformanceState.VISIBLE]: UiMessage.PERFORMANCE_VISIBLE,
    [PerformanceState.HIDDEN]: UiMessage.PERFORMANCE_HIDDEN,
    [PerformanceState.OFF]: UiMessage.PERFORMANCE_OFF
  });
  const COUNTER_LABELS = Object.freeze({
    [PerformanceCounter.REQUESTS]: UiMessage.PERFORMANCE_REQUESTS,
    [PerformanceCounter.MUTATIONS]: UiMessage.PERFORMANCE_MUTATIONS,
    [PerformanceCounter.NAVIGATION]: UiMessage.PERFORMANCE_NAVIGATION,
    [PerformanceCounter.LOADING]: UiMessage.PERFORMANCE_LOADING,
    [PerformanceCounter.API]: UiMessage.PERFORMANCE_API,
    [PerformanceCounter.API_ERRORS]: UiMessage.PERFORMANCE_API_ERRORS,
    [PerformanceCounter.API_ABORTS]: UiMessage.PERFORMANCE_API_ABORTS,
    [PerformanceCounter.CACHE]: UiMessage.PERFORMANCE_CACHE
  });
  const WORK_LABELS = Object.freeze({
    [PerformanceWork.RECONCILE]: UiMessage.PERFORMANCE_RECONCILE,
    [PerformanceWork.DISCOVERY]: UiMessage.PERFORMANCE_DISCOVERY,
    [PerformanceWork.LAYOUT]: UiMessage.PERFORMANCE_LAYOUT,
    [PerformanceWork.RAIL]: UiMessage.PERFORMANCE_RAIL
  });
  const CAUSE_LABELS = Object.freeze({
    [ReconcileCause.PAGE]: UiMessage.PERFORMANCE_CAUSE_PAGE,
    [ReconcileCause.MUTATION]: UiMessage.PERFORMANCE_MUTATIONS,
    [ReconcileCause.SETTLING]: UiMessage.PERFORMANCE_CAUSE_SETTLING,
    [ReconcileCause.ACCOUNT]: UiMessage.PERFORMANCE_CAUSE_ACCOUNT,
    [ReconcileCause.SETTINGS]: UiMessage.SETTINGS_LABEL,
    [ReconcileCause.VISIBILITY]: UiMessage.PERFORMANCE_CAUSE_VISIBILITY,
    [ReconcileCause.THEME]: UiMessage.PERFORMANCE_CAUSE_THEME,
    [ReconcileCause.COMMENTS]: UiMessage.COMMENTS_LABEL,
    [ReconcileCause.RECOVERY]: UiMessage.PERFORMANCE_CAUSE_RECOVERY,
    [ReconcileCause.CATALOG]: UiMessage.PERFORMANCE_CAUSE_CATALOG,
    [ReconcileCause.ACTION]: UiMessage.PERFORMANCE_CAUSE_ACTION,
    [ReconcileCause.MEDIA]: UiMessage.PERFORMANCE_CAUSE_MEDIA
  });
  const ALERT_LABELS = Object.freeze({
    slow_extension_work: UiMessage.PERFORMANCE_ALERT_WORK,
    busy_extension: UiMessage.PERFORMANCE_ALERT_WORK,
    long_task: UiMessage.PERFORMANCE_ALERT_STALL,
    timer_gap: UiMessage.PERFORMANCE_ALERT_STALL,
    buffering: UiMessage.PERFORMANCE_ALERT_BUFFERING,
    media_error: UiMessage.PERFORMANCE_ALERT_MEDIA,
    api_burst: UiMessage.PERFORMANCE_ALERT_API,
    api_error: UiMessage.PERFORMANCE_ALERT_API,
    navigation_fallback: UiMessage.PERFORMANCE_ALERT_NAVIGATION,
    player_recovery: UiMessage.PERFORMANCE_ALERT_PLAYER
  });

  /** Stable one-click diagnostics indicator beside Settings, shared by dock and floating controls. */
  class PerformanceWidget {
    /** @param {Document} document @param {PerformanceViewOptions} options */
    constructor(document, options) {
      this.document = document;
      this.options = options;
      this.enabled = false;
      this.language = "en";
      this.button = null;
      this.copySequence = 0;
      this.copyMessage = null;
    }

    /** Creates one accessible icon button without allocating the Settings statistics view. */
    launcher() {
      if (!this.button) {
        this.button = UiControl.button(this.document, "bibilili-action-button bibilili-performance-button", () => this.copy());
        this.button.append(UiControl.icon(this.document, "performance"));
        this.badge = this.document.createElement("span");
        this.badge.className = "bibilili-performance-badge";
        this.badge.setAttribute("aria-hidden", "true");
        this.feedback = this.document.createElement("span");
        this.feedback.className = "bibilili-performance-feedback";
        this.feedback.setAttribute("role", "status");
        this.button.append(this.badge, this.feedback);
      }
      this.render();
      return this.button;
    }

    /** Hides the entry immediately when recording is disabled, retaining its DOM identity. */
    update(enabled, language) {
      if (this.enabled !== enabled) {
        this.copySequence += 1;
        this.copyMessage = null;
        if (this.button) this.button.disabled = false;
      }
      this.enabled = enabled;
      this.language = language;
      this.render();
    }

    /** Clears stale copy feedback when new diagnostic evidence or a reset arrives. */
    notify() {
      this.copyMessage = null;
      this.render();
    }

    /** Copies fresh evidence and acknowledges only a successfully exported report. */
    async copy() {
      if (!this.enabled || this.button.disabled) return;
      const sequence = ++this.copySequence;
      this.button.disabled = true;
      this.copyMessage = null;
      this.render();
      try {
        const snapshot = this.options.onSnapshot();
        await this.options.onCopy(JSON.stringify(snapshot, null, 2));
        if (sequence !== this.copySequence) return;
        this.options.onCopied(snapshot);
        this.copyMessage = UiMessage.PERFORMANCE_WIDGET_COPIED;
      } catch (_error) {
        if (sequence !== this.copySequence) return;
        this.copyMessage = UiMessage.PERFORMANCE_WIDGET_COPY_FAILED;
      }
      this.button.disabled = false;
      this.render();
    }

    /** Updates only changed attributes; color, badge, tooltip, and accessible name describe state. */
    render() {
      if (!this.button) return;
      if (this.button.hidden !== !this.enabled) this.button.hidden = !this.enabled;
      if (!this.enabled) return;
      const status = this.options.onStatus();
      const key = status.level === "severe" ? UiMessage.PERFORMANCE_WIDGET_SEVERE
        : status.level === "warning" ? UiMessage.PERFORMANCE_WIDGET_WARNING : UiMessage.PERFORMANCE_WIDGET_QUIET;
      const reason = status.type ? UiStrings.message(ALERT_LABELS[status.type], this.language) : "";
      const label = UiStrings.message(key, this.language, [reason]);
      if (this.button.title !== label) UiControl.setLabel(this.button, label);
      if (this.button.dataset.level !== status.level) this.button.dataset.level = status.level;
      const feedback = this.copyMessage ? UiStrings.message(this.copyMessage, this.language) : "";
      if (this.feedback.textContent !== feedback) {
        this.feedback.textContent = feedback;
        if (feedback) {
          const rect = this.button.getBoundingClientRect();
          this.feedback.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 288))}px`;
          this.feedback.style.bottom = `${window.innerHeight - rect.top + 8}px`;
        }
      }
      if (this.feedback.hidden !== !feedback) this.feedback.hidden = !feedback;
      const badge = this.copyMessage === UiMessage.PERFORMANCE_WIDGET_COPIED && status.level === "quiet"
        ? "✓" : this.copyMessage === UiMessage.PERFORMANCE_WIDGET_COPY_FAILED ? "×"
          : status.level === "quiet" ? "" : "!";
      if (this.badge.textContent !== badge) this.badge.textContent = badge;
    }

    /** Prevents pending clipboard operations from updating a replaced runtime. */
    destroy() {
      this.copySequence += 1;
      this.button?.remove();
    }
  }

  /** Presents manually captured statistics without taking samples during ordinary renders. */
  class PerformanceView {
    /** @param {Document} document @param {PerformanceViewOptions} options */
    constructor(document, options) {
      this.document = document;
      this.options = options;
      this.labels = new Map();
      this.values = new Map();
      this.snapshot = null;
      this.language = "en";
      this.copySequence = 0;
    }

    /** Creates stable controls, tables, and expandable detail sections once. */
    mount(parent) {
      if (this.status) return;
      this.status = this.node("p", null, "bibilili-performance-status");
      parent.append(this.status, this.node("p", UiMessage.PERFORMANCE_HINT, "bibilili-settings-hint"));
      const toolbar = this.node("div", null, "bibilili-performance-toolbar");
      for (const [message, action] of [
        [UiMessage.PERFORMANCE_REFRESH, () => this.refresh()],
        [UiMessage.PERFORMANCE_RESET, () => { this.options.onReset(); this.refresh(); }],
        [UiMessage.PERFORMANCE_COPY, () => this.copy()]
      ]) {
        const button = UiControl.button(this.document, "bibilili-settings-placement", action);
        this.labels.set(button, message);
        toolbar.append(button);
        if (message === UiMessage.PERFORMANCE_COPY) this.copyButton = button;
      }
      this.copyStatus = this.node("span", null, "bibilili-performance-copy-status");
      this.copyStatus.setAttribute("role", "status");
      this.timestamp = this.node("p", null, "bibilili-settings-hint");
      parent.append(toolbar, this.copyStatus, this.timestamp);

      const columns = Object.values(STATE_LABELS);
      const activity = this.table(parent, UiMessage.PERFORMANCE_ACTIVITY, columns);
      const states = Object.values(PerformanceState);
      this.row(activity, UiMessage.PERFORMANCE_ELAPSED, states.map((state) => (data) => data.states[state].elapsedMs / 1000));
      this.row(activity, UiMessage.PERFORMANCE_RECONCILE, states.map((state) => (data) => data.states[state].work.reconcile.count));
      this.row(activity, UiMessage.PERFORMANCE_RECONCILE_TIME, states.map((state) => (data) => data.states[state].work.reconcile.totalMs));
      for (const [key, message] of Object.entries(COUNTER_LABELS)) {
        this.row(activity, message, states.map((state) => (data) => data.states[state].counters[key]));
      }
      parent.append(this.node("p", UiMessage.PERFORMANCE_STATE_HINT, "bibilili-settings-hint"));

      const timings = this.details(parent, UiMessage.PERFORMANCE_TIMINGS);
      timings.append(this.node("p", UiMessage.PERFORMANCE_TIMING_HINT, "bibilili-settings-hint"));
      const timingTable = this.table(timings, null,
        [UiMessage.PERFORMANCE_COUNT, UiMessage.PERFORMANCE_TOTAL, UiMessage.PERFORMANCE_MAX]);
      for (const [key, message] of Object.entries(WORK_LABELS)) {
        this.row(timingTable, message, [
          (data) => states.reduce((total, state) => total + data.states[state].work[key].count, 0),
          (data) => states.reduce((total, state) => total + data.states[state].work[key].totalMs, 0),
          (data) => Math.max(...states.map((state) => data.states[state].work[key].maxMs))
        ]);
      }
      const causes = this.details(parent, UiMessage.PERFORMANCE_CAUSES);
      causes.append(this.node("p", UiMessage.PERFORMANCE_CAUSE_HINT, "bibilili-settings-hint"));
      const causeTable = this.table(causes, null, columns);
      for (const [key, message] of Object.entries(CAUSE_LABELS)) {
        this.row(causeTable, message, states.map((state) => (data) => data.states[state].causes[key]));
      }

      const resources = this.details(parent, UiMessage.PERFORMANCE_RESOURCES);
      const resourceTable = this.table(resources, null, [UiMessage.PERFORMANCE_COUNT]);
      for (const [key, message] of [
        ["mutationObserver", UiMessage.PERFORMANCE_OBSERVER],
        ["navigationTimer", UiMessage.PERFORMANCE_NAVIGATION],
        ["loadingTimer", UiMessage.PERFORMANCE_LOADING],
        ["renderedCards", UiMessage.PERFORMANCE_RENDERED],
        ["listItems", UiMessage.PERFORMANCE_ITEMS],
        ["previewRequests", UiMessage.PERFORMANCE_PREVIEW_REQUESTS],
        ["previewQueue", UiMessage.PERFORMANCE_PREVIEW_QUEUE],
        ["previewRecords", UiMessage.PERFORMANCE_PREVIEW_RECORDS]
      ]) this.row(resourceTable, message, [(data) => data.resources[key]]);
    }

    /** Captures a new report only for opening, selecting, refreshing, or resetting the tab. */
    refresh() {
      this.snapshot = this.options.onSnapshot();
      this.copySequence += 1;
      this.copyMessage = null;
      this.copyButton.disabled = false;
      this.render(this.language);
    }

    /** Copies exactly the displayed snapshot and reports clipboard failures in place. */
    async copy() {
      if (!this.snapshot) return;
      const sequence = ++this.copySequence;
      this.copyButton.disabled = true;
      let message;
      try {
        await this.options.onCopy(JSON.stringify(this.snapshot, null, 2));
        message = UiMessage.PERFORMANCE_COPIED;
      } catch (_error) {
        message = UiMessage.PERFORMANCE_COPY_FAILED;
      }
      if (sequence !== this.copySequence) return;
      this.copyButton.disabled = false;
      this.copyMessage = message;
      this.render(this.language);
    }

    /** Localizes the retained snapshot without reading runtime state. */
    render(language) {
      const changed = this.language !== language || this.renderedSnapshot !== this.snapshot;
      this.language = language;
      if (!this.status) return;
      const message = (key) => UiStrings.message(key, language);
      this.setText(this.copyStatus, this.copyMessage ? message(this.copyMessage) : "");
      if (!changed) return;
      this.renderedSnapshot = this.snapshot;
      for (const [element, key] of this.labels) this.setText(element, message(key));
      if (!this.snapshot) return;
      this.setText(this.status, message(this.snapshot.recording ? UiMessage.PERFORMANCE_RECORDING : UiMessage.PERFORMANCE_PAUSED));
      this.setText(this.timestamp, UiStrings.message(UiMessage.PERFORMANCE_TIMESTAMP, language,
        [new Date(this.snapshot.capturedAt).toLocaleTimeString(language)]));
      const format = new Intl.NumberFormat(language, { maximumFractionDigits: 1 });
      for (const [cell, read] of this.values) {
        const value = read(this.snapshot);
        this.setText(cell, typeof value === "boolean"
          ? message(value ? UiMessage.PERFORMANCE_ACTIVE : UiMessage.PERFORMANCE_STOPPED)
          : format.format(value));
      }
    }

    /** Updates only changed text so diagnostics cannot produce a mutation feedback loop. */
    setText(element, value) { if (element.textContent !== value) element.textContent = value; }

    /** Creates an element with an optional catalog label. */
    node(tag, message = null, className = "") {
      const element = this.document.createElement(tag);
      element.className = className;
      if (message) this.labels.set(element, message);
      return element;
    }

    /** Adds a native keyboard-accessible disclosure for less frequently used statistics. */
    details(parent, message) {
      const details = this.node("details", null, "bibilili-performance-details");
      details.append(this.node("summary", message));
      parent.append(details);
      return details;
    }

    /** Builds a semantic table whose numeric columns share stable widths. */
    table(parent, caption, columns) {
      const table = this.node("table", null, "bibilili-performance-table");
      if (caption) table.append(this.node("caption", caption));
      const head = this.node("thead");
      const row = this.node("tr");
      row.append(this.node("th", UiMessage.PERFORMANCE_METRIC));
      for (const message of columns) row.append(this.node("th", message));
      for (const cell of row.children) cell.setAttribute("scope", "col");
      head.append(row);
      const body = this.node("tbody");
      table.append(head, body);
      parent.append(table);
      return body;
    }

    /** Adds one labeled statistic with snapshot readers, retaining every cell's identity. */
    row(body, message, readers) {
      const row = this.node("tr");
      const label = this.node("th", message);
      label.setAttribute("scope", "row");
      row.append(label);
      for (const read of readers) {
        const cell = this.node("td");
        this.values.set(cell, read);
        row.append(cell);
      }
      body.append(row);
    }
  }

  /**
   * @typedef {PerformanceSnapshot & { capturedAt: string, resources: PerformanceResources,
   *   environment: { extensionVersion: string | null, userAgent: string | null },
   *   diagnostics: { current: object, previous: object | null } }} PerformanceReport
   */

  /**
   * @typedef {object} PerformanceResources
   * @property {boolean} mutationObserver Whether page mutation observation is active.
   * @property {boolean} longTaskObserver Whether page-wide long-task observation is active.
   * @property {boolean} navigationTimer Whether the shared navigation timer is active.
   * @property {boolean} loadingTimer Whether a fast readiness check is queued.
   * @property {number} renderedCards Extension cards currently in the rail DOM.
   * @property {number} listItems Items in the selected, filtered rail.
   * @property {number} previewRequests Active preview metadata requests.
   * @property {number} previewQueue Queued preview metadata requests.
   * @property {number} previewRecords Retained preview records, including pending and failed entries.
   */

  /**
   * @typedef {object} PerformanceViewOptions
   * @property {() => PerformanceReport} onSnapshot Captures aggregates and current resource counts.
   * @property {() => void} onReset Clears this document's measurements.
   * @property {(json: string) => Promise<void>} onCopy Copies the displayed report.
   * @property {() => { level: string, type: string | null }} onStatus Reads the current unacknowledged alert.
   * @property {(report: PerformanceReport) => void} onCopied Acknowledges evidence copied by the widget.
   */
  window.__bibililiPerformanceView = Object.freeze({ PerformanceView, PerformanceWidget });
})();
