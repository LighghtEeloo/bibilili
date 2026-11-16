(() => {
  "use strict";

  const { BilibiliRoute } = window.__bibililiRoute;
  const { UiControl } = window.__bibililiControls;
  const { UiMessage, UiStrings } = window.__bibililiI18n;
  const { FavoriteFolderPreference, OPERATION_HISTORY_LIMITS, DEFAULT_OPERATION_HISTORY_LIMIT } = window.__bibililiStorageState;
  const STORAGE_KEY = "bibilili:operation-history";
  /** Operations owned by Bibilili and supported by its history surface. */
  const OperationKind = Object.freeze({ VISIT: "visit", FAVORITE: "favorite", REMOVE: "remove" });
  const OPERATION_MESSAGES = Object.freeze({
    [OperationKind.VISIT]: UiMessage.OPERATION_HISTORY_VISIT,
    [OperationKind.FAVORITE]: UiMessage.OPERATION_HISTORY_FAVORITE,
    [OperationKind.REMOVE]: UiMessage.OPERATION_HISTORY_REMOVE
  });

  /** Keeps bounded tab-local history and serializes undo and redo requests. */
  class OperationHistory {
    /** @param {() => void} onChange Refreshes an open history surface. @param {number} [limit] Saved capacity. */
    constructor(onChange, limit = DEFAULT_OPERATION_HISTORY_LIMIT) {
      this.onChange = onChange;
      this.limit = OPERATION_HISTORY_LIMITS.includes(limit) ? limit : DEFAULT_OPERATION_HISTORY_LIMIT;
      this.enabled = false;
      this.entries = [];
      this.pendingId = null;
      this.lastVisitKey = null;
      try {
        const saved = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY));
        const ids = new Set();
        if (Array.isArray(saved)) {
          this.entries = saved.slice(0, this.limit).flatMap((value) => {
            const entry = OperationHistory.normalize(value);
            if (!entry || ids.has(entry.id)) return [];
            ids.add(entry.id);
            return [entry];
          });
          if (saved.length > this.entries.length) this.save();
        }
      } catch (_error) {
        // Unavailable storage leaves history usable for the current document.
      }
    }

    /** @param {boolean} enabled Stops new records without discarding completed operations. */
    setEnabled(enabled) {
      if (this.enabled === enabled) return;
      this.enabled = enabled;
      this.lastVisitKey = null;
    }

    /** Applies a supported capacity while retaining an active request. @param {number} limit */
    setLimit(limit) {
      if (!OPERATION_HISTORY_LIMITS.includes(limit) || this.limit === limit) return;
      this.limit = limit;
      this.trim();
      this.save();
      this.onChange();
    }

    /** Clears completed history while keeping the current visit deduplicated. */
    clear() {
      if (this.pendingId || !this.entries.length) return;
      this.entries = [];
      this.save();
      this.onChange();
    }

    /** Keeps the newest records and any in-flight row within the configured capacity. */
    trim() {
      while (this.entries.length > this.limit) {
        const index = this.entries.findLastIndex((candidate) => candidate.id !== this.pendingId);
        this.entries.splice(index, 1);
      }
    }

    /** @param {unknown} value @returns {OperationHistoryEntry | null} Validated persisted entry. */
    static normalize(value) {
      if (!value || !Object.values(OperationKind).includes(value.kind) ||
          typeof value.id !== "string" || !value.id || value.id.length > 100 ||
          !Number.isSafeInteger(value.createdAt) || value.createdAt <= 0 || value.createdAt > 8640000000000000 ||
          typeof value.targetUrl !== "string" || typeof value.title !== "string") return null;
      const targetUrl = BilibiliRoute.shareUrlFor(value.targetUrl);
      const title = value.title.trim().slice(0, 500);
      if (!targetUrl || !title) return null;
      const entry = {
        id: value.id, kind: value.kind, targetUrl, title, createdAt: value.createdAt,
        undone: value.undone === true, pending: false, result: null, error: ""
      };
      if (value.kind !== OperationKind.VISIT) {
        const aid = FavoriteFolderPreference.normalizeId(value.aid);
        const accountId = FavoriteFolderPreference.normalizeId(value.accountId);
        if (!aid || !accountId) return null;
        Object.assign(entry, { aid, accountId });
        if (value.kind === OperationKind.FAVORITE) {
          const folderId = FavoriteFolderPreference.normalizeId(value.folderId);
          if (!folderId) return null;
          entry.folderId = folderId;
        }
      }
      return entry;
    }

    /** Records one successful operation with its original target and account identity. */
    record(kind, details) {
      if (!this.enabled) return;
      const entry = OperationHistory.normalize({
        ...details, kind, id: window.crypto.randomUUID(), createdAt: Date.now(), undone: false
      });
      if (!entry) return;
      this.entries.unshift(entry);
      this.trim();
      this.save();
      this.onChange();
    }

    /** Records a settled watch route once across ordinary reconciliation passes. */
    visit(targetUrl, title) {
      if (!this.enabled || !title) return;
      const key = BilibiliRoute.watchRouteKeyForUrl(targetUrl);
      if (!key || key === this.lastVisitKey) return;
      this.lastVisitKey = key;
      this.record(OperationKind.VISIT, { targetUrl, title });
    }

    /**
     * Applies an inverse operation; failures retain the same retry action.
     * A submitted mutation settles even if recording is switched off meanwhile.
     * @param {string} id
     * @param {(entry: OperationHistoryEntry, undo: boolean) => Promise<void>} apply
     */
    async toggle(id, apply) {
      const entry = this.entries.find((candidate) => candidate.id === id);
      if (!this.enabled || this.pendingId || !entry || entry.kind === OperationKind.VISIT) return;
      const undo = !entry.undone;
      this.pendingId = id;
      entry.pending = true;
      entry.result = null;
      entry.error = "";
      this.onChange();
      try {
        await apply(entry, undo);
        entry.undone = undo;
        entry.result = undo ? UiMessage.OPERATION_HISTORY_UNDONE : UiMessage.OPERATION_HISTORY_REDONE;
        this.save();
      } catch (error) {
        entry.error = typeof error?.message === "string" ? error.message.slice(0, 240) : "";
        entry.result = UiMessage.OPERATION_HISTORY_FAILED;
      } finally {
        entry.pending = false;
        this.pendingId = null;
        this.onChange();
      }
    }

    /** Persists identities and undo state; transient feedback belongs to this document. */
    save() {
      try {
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(this.entries.map((entry) => {
          const { pending, result, error, ...record } = entry;
          return record;
        })));
      } catch (_error) {
        // Storage failure must not turn a successful account mutation into a failed undo.
      }
    }
  }

  /** Leading row icons; removals use the Watch later clock. */
  const OPERATION_ICONS = Object.freeze({
    [OperationKind.VISIT]: "play",
    [OperationKind.FAVORITE]: "star",
    [OperationKind.REMOVE]: "clock"
  });
  /** History list filters in display order; each kind filter shares its OperationKind value. */
  const OperationFilter = Object.freeze({ ALL: "all", ...OperationKind });
  const FILTER_MESSAGES = Object.freeze({
    [OperationFilter.ALL]: UiMessage.OPERATION_HISTORY_FILTER_ALL,
    [OperationFilter.VISIT]: UiMessage.OPERATION_HISTORY_FILTER_VISIT,
    [OperationFilter.FAVORITE]: UiMessage.OPERATION_HISTORY_FILTER_FAVORITE,
    [OperationFilter.REMOVE]: UiMessage.OPERATION_HISTORY_FILTER_REMOVE
  });
  /** Row feedback states; the persistent undone state shows only without a fresher result. */
  const FeedbackState = Object.freeze({
    NONE: "", PENDING: "pending", SUCCESS: "success", ERROR: "error", UNDONE: "undone"
  });
  const DAY_MS = 24 * 60 * 60 * 1000;

  /**
   * Renders history as a kind filter, a scrolling day-grouped list, and capacity controls.
   * Rows are keyed by entry id and survive filter, day, and result changes so focus stays put.
   */
  class OperationHistoryView {
    /** @param {Document} document @param {OperationHistoryViewOptions} options */
    constructor(document, options) {
      this.document = document;
      this.options = options;
      this.root = null;
      this.language = "en";
      this.filter = OperationFilter.ALL;
      /** @type {Map<string, OperationHistoryRow>} */
      this.rows = new Map();
      /** @type {Map<string, OperationHistoryDay>} */
      this.days = new Map();
      /** @type {Map<string, OperationHistoryFilterButton>} */
      this.filterButtons = new Map();
      /** @type {Map<number, HTMLButtonElement>} */
      this.sizeButtons = new Map();
    }

    /** Allocates history DOM only when its settings tab is first selected. */
    mount(parent) {
      if (this.root) return;
      this.root = this.element("div", "bibilili-operation-history");
      this.filters = this.element("div", "bibilili-operation-history-filters");
      this.filters.setAttribute("role", "group");
      for (const filter of Object.values(OperationFilter)) {
        const button = UiControl.button(this.document, "bibilili-operation-history-filter", () => this.selectFilter(filter));
        const label = this.element("span", "");
        const count = this.element("span", "bibilili-operation-history-filter-count");
        button.append(label, count);
        this.filterButtons.set(filter, { button, label, count });
        this.filters.append(button);
      }
      this.scroller = this.element("div", "bibilili-operation-history-scroll");
      this.empty = this.element("div", "bibilili-operation-history-empty");
      this.emptyTitle = this.element("p", "bibilili-operation-history-empty-title");
      this.emptyHint = this.element("p", "bibilili-operation-history-empty-hint");
      this.empty.append(this.emptyTitle, this.emptyHint);
      this.list = this.element("div", "bibilili-operation-history-days");
      this.scroller.append(this.empty, this.list);
      const footer = this.element("div", "bibilili-operation-history-footer");
      const size = this.element("div", "bibilili-operation-history-size");
      size.setAttribute("role", "group");
      this.sizeLabel = this.element("span", "bibilili-operation-history-size-label");
      this.sizeLabel.id = "bibilili-operation-history-size-label";
      size.setAttribute("aria-labelledby", this.sizeLabel.id);
      const choices = this.element("div", "bibilili-operation-history-size-choices");
      for (const limit of OPERATION_HISTORY_LIMITS) {
        const button = UiControl.button(this.document, "bibilili-operation-history-size-choice", () => {
          if (limit !== this.options.store.limit) this.options.onLimitChange(limit);
        });
        button.textContent = String(limit);
        this.sizeButtons.set(limit, button);
        choices.append(button);
      }
      size.append(this.sizeLabel, choices);
      this.clearButton = UiControl.button(this.document, "bibilili-operation-history-clear", () => this.options.store.clear());
      footer.append(size, this.clearButton);
      this.root.append(this.filters, this.scroller, footer);
      parent.append(this.root);
    }

    /** Shows one operation kind, or every kind, from the top of the list. @param {string} filter */
    selectFilter(filter) {
      if (this.filter === filter) return;
      this.filter = filter;
      this.scroller.scrollTop = 0;
      this.render(this.language);
    }

    /** @param {string} tag @param {string} className @returns {HTMLElement} */
    element(tag, className) {
      const element = this.document.createElement(tag);
      element.className = className;
      return element;
    }

    /** @param {Date} date @returns {string} Local calendar day key. */
    static dayKey(date) {
      return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
    }

    /**
     * Names today and yesterday relatively and older days by date; the year appears outside the current year.
     * @param {Date} date @param {Date} now @param {string} language @returns {string}
     */
    static dayLabel(date, now, language) {
      const start = (value) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
      const days = Math.round((start(now) - start(date)) / DAY_MS);
      if (days === 0 || days === 1) {
        const label = new Intl.RelativeTimeFormat(language, { numeric: "auto" }).format(-days, "day");
        return label.charAt(0).toLocaleUpperCase(language) + label.slice(1);
      }
      return new Intl.DateTimeFormat(language, {
        weekday: "short", month: "short", day: "numeric",
        year: date.getFullYear() === now.getFullYear() ? undefined : "numeric"
      }).format(date);
    }

    /** @param {string} key @returns {OperationHistoryDay} One labeled day section. */
    createDay(key) {
      const section = this.element("section", "bibilili-operation-history-day");
      const heading = this.element("h4", "bibilili-operation-history-day-label");
      heading.id = `bibilili-operation-history-day-${key}`;
      section.setAttribute("aria-labelledby", heading.id);
      const list = this.element("ol", "bibilili-operation-history-list");
      section.append(heading, list);
      return { section, heading, list };
    }

    /** @param {OperationHistoryEntry} entry @returns {OperationHistoryRow} One keyed row. */
    createRow(entry) {
      const row = this.element("li", "bibilili-operation-history-row");
      row.dataset.kind = entry.kind;
      const icon = this.element("span", "bibilili-operation-history-icon");
      icon.append(UiControl.icon(this.document, OPERATION_ICONS[entry.kind]));
      const summary = this.element("div", "bibilili-operation-history-summary");
      const title = this.element("a", "bibilili-operation-history-title");
      const detail = this.element("div", "bibilili-operation-history-detail");
      const kind = this.element("span", "bibilili-operation-history-kind");
      const time = this.element("time", "bibilili-operation-history-time");
      const feedback = this.element("span", "bibilili-operation-history-feedback");
      feedback.setAttribute("role", "status");
      const loading = this.options.createLoading();
      const check = UiControl.icon(this.document, "check");
      const message = this.element("span", "bibilili-operation-history-message");
      feedback.append(loading, check, message);
      detail.append(kind, time, feedback);
      summary.append(title, detail);
      row.append(icon, summary);
      let button = null;
      if (entry.kind !== OperationKind.VISIT) {
        button = UiControl.button(this.document, "bibilili-operation-history-button", () => {
          void this.options.store.toggle(entry.id, this.options.onApply);
        });
        row.append(button);
      }
      return { row, title, kind, time, feedback, loading, check, message, button };
    }

    /** Reconciles filters, day groups, rows, and capacity while preserving keyboard focus. */
    render(language) {
      if (!this.root) return;
      this.language = language;
      const { store } = this.options;
      const message = (key) => UiStrings.message(key, language);
      const counts = new Map(Object.values(OperationFilter).map((filter) => [filter, 0]));
      for (const entry of store.entries) counts.set(entry.kind, counts.get(entry.kind) + 1);
      counts.set(OperationFilter.ALL, store.entries.length);
      this.filters.setAttribute("aria-label", message(UiMessage.OPERATION_HISTORY_FILTER_LABEL));
      for (const [filter, { button, label, count }] of this.filterButtons) {
        const text = message(FILTER_MESSAGES[filter]);
        label.textContent = text;
        count.textContent = String(counts.get(filter));
        button.setAttribute("aria-label", `${text} (${counts.get(filter)})`);
        button.setAttribute("aria-pressed", String(filter === this.filter));
      }
      this.sizeLabel.textContent = message(UiMessage.OPERATION_HISTORY_SIZE);
      for (const [limit, button] of this.sizeButtons) button.setAttribute("aria-pressed", String(limit === store.limit));
      UiControl.setTextButtonLabel(this.clearButton, message(UiMessage.OPERATION_HISTORY_CLEAR));
      this.clearButton.disabled = !store.entries.length || Boolean(store.pendingId);

      const visible = this.filter === OperationFilter.ALL ? store.entries
        : store.entries.filter((entry) => entry.kind === this.filter);
      this.empty.hidden = visible.length > 0;
      this.emptyTitle.textContent = message(store.entries.length
        ? UiMessage.OPERATION_HISTORY_FILTER_EMPTY : UiMessage.OPERATION_HISTORY_EMPTY);
      this.emptyHint.textContent = message(UiMessage.OPERATION_HISTORY_HINT);
      this.emptyHint.hidden = store.entries.length > 0;

      const now = new Date();
      const formats = {
        time: new Intl.DateTimeFormat(language, { timeStyle: "short" }),
        full: new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "medium" })
      };
      /** @type {Map<string, HTMLElement | null>} Last placed row per day in this pass. */
      const placedDays = new Map();
      const placedRows = new Set();
      let previousDay = null;
      for (const entry of visible) {
        const date = new Date(entry.createdAt);
        const key = OperationHistoryView.dayKey(date);
        let day = this.days.get(key);
        if (!day) {
          day = this.createDay(key);
          this.days.set(key, day);
        }
        if (!placedDays.has(key)) {
          UiControl.place(this.list, day.section, previousDay);
          previousDay = day.section;
          placedDays.set(key, null);
          day.heading.textContent = OperationHistoryView.dayLabel(date, now, language);
        }
        let parts = this.rows.get(entry.id);
        if (!parts) {
          parts = this.createRow(entry);
          this.rows.set(entry.id, parts);
        }
        UiControl.place(day.list, parts.row, placedDays.get(key));
        placedDays.set(key, parts.row);
        placedRows.add(entry.id);
        this.renderRow(parts, entry, date, formats, message);
      }
      const retained = new Set(store.entries.map((entry) => entry.id));
      for (const [id, parts] of this.rows) {
        if (placedRows.has(id)) continue;
        parts.row.remove();
        if (!retained.has(id)) this.rows.delete(id);
      }
      for (const [key, day] of this.days) {
        if (placedDays.has(key)) continue;
        day.section.remove();
        this.days.delete(key);
      }
    }

    /**
     * Updates one row's text, undo control, and feedback line.
     * @param {OperationHistoryRow} parts @param {OperationHistoryEntry} entry @param {Date} date
     * @param {{ time: Intl.DateTimeFormat, full: Intl.DateTimeFormat }} formats
     * @param {(key: string) => string} message
     */
    renderRow(parts, entry, date, formats, message) {
      const { store } = this.options;
      parts.row.dataset.undone = String(entry.undone);
      parts.title.textContent = entry.title;
      parts.title.href = entry.targetUrl;
      parts.title.title = entry.title;
      parts.kind.textContent = message(OPERATION_MESSAGES[entry.kind]);
      parts.time.dateTime = date.toISOString();
      parts.time.textContent = formats.time.format(date);
      parts.time.title = formats.full.format(date);
      if (parts.button) {
        parts.button.disabled = Boolean(store.pendingId) || !store.enabled;
        parts.button.setAttribute("aria-busy", String(entry.pending));
        const iconKind = entry.undone ? "redo" : "undo";
        if (parts.iconKind !== iconKind) {
          parts.button.replaceChildren(UiControl.icon(this.document, iconKind));
          parts.iconKind = iconKind;
        }
        UiControl.setLabel(parts.button,
          message(entry.undone ? UiMessage.OPERATION_HISTORY_REDO : UiMessage.OPERATION_HISTORY_UNDO));
      }
      const failed = entry.result === UiMessage.OPERATION_HISTORY_FAILED;
      const state = entry.pending ? FeedbackState.PENDING : failed ? FeedbackState.ERROR
        : entry.result ? FeedbackState.SUCCESS : entry.undone ? FeedbackState.UNDONE : FeedbackState.NONE;
      parts.feedback.dataset.state = state;
      parts.loading.hidden = state !== FeedbackState.PENDING;
      parts.check.hidden = state !== FeedbackState.SUCCESS;
      parts.check.style.display = parts.check.hidden ? "none" : "";
      parts.message.textContent = state === FeedbackState.PENDING ? message(UiMessage.SOURCE_MORE_LOADING_LABEL)
        : state === FeedbackState.ERROR ? entry.error || message(entry.result)
          : state === FeedbackState.SUCCESS ? message(entry.result)
            : state === FeedbackState.UNDONE ? message(UiMessage.OPERATION_HISTORY_UNDONE) : "";
    }
  }

  /**
   * @typedef {object} OperationHistoryEntry
   * @property {string} id Stable history row identity.
   * @property {string} kind Closed OperationKind value.
   * @property {string} targetUrl Original watch route.
   * @property {string} title Original video title.
   * @property {number} createdAt Completion time in milliseconds.
   * @property {string} [aid] Archive id used by account mutations.
   * @property {string} [accountId] Account owning the original operation.
   * @property {string} [folderId] Exact destination of a direct favorite save.
   * @property {boolean} undone Whether the inverse operation has succeeded.
   * @property {boolean} pending Whether an undo or redo is running.
   * @property {string | null} result Localized feedback message key.
   * @property {string} error Bounded request failure text.
   */

  /**
   * @typedef {object} OperationHistoryViewOptions
   * @property {OperationHistory} store Tab-local operations and mutation state.
   * @property {(entry: OperationHistoryEntry, undo: boolean) => Promise<void>} onApply Account operation executor.
   * @property {(limit: number) => void} onLimitChange Applies and persists a selected capacity.
   * @property {() => HTMLElement} createLoading Shared loading view factory.
   */

  /**
   * @typedef {object} OperationHistoryRow
   * @property {HTMLLIElement} row Keyed list item carrying kind and undone state.
   * @property {HTMLAnchorElement} title Link to the original watch route.
   * @property {HTMLElement} kind Localized operation kind.
   * @property {HTMLTimeElement} time Completion time; the full timestamp is its hover title.
   * @property {HTMLElement} feedback Status region for pending, success, error, and undone states.
   * @property {HTMLElement} loading Shared loading bar.
   * @property {SVGSVGElement} check Success mark.
   * @property {HTMLElement} message Feedback text.
   * @property {HTMLButtonElement | null} button Undo or redo control; visits have none.
   * @property {string} [iconKind] Rendered button icon.
   */

  /**
   * @typedef {object} OperationHistoryDay
   * @property {HTMLElement} section Day group labeled by its heading.
   * @property {HTMLElement} heading Sticky day label.
   * @property {HTMLOListElement} list Rows completed on that day, newest first.
   */

  /**
   * @typedef {object} OperationHistoryFilterButton
   * @property {HTMLButtonElement} button Pressed while its filter is selected.
   * @property {HTMLElement} label Localized filter name.
   * @property {HTMLElement} count Matching record count.
   */

  window.__bibililiOperationHistory = Object.freeze({
    OperationHistory, OperationHistoryView, OperationKind, OperationFilter
  });
})();
