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

  /** Renders stable history rows with inline loading, success, and retry feedback. */
  class OperationHistoryView {
    /** @param {Document} document @param {OperationHistoryViewOptions} options */
    constructor(document, options) {
      this.document = document;
      this.options = options;
      this.root = null;
      this.rows = new Map();
      this.draftLimit = null;
    }

    /** Allocates history DOM only when its settings tab is first selected. */
    mount(parent) {
      if (this.root) return;
      this.root = this.element("div", "bibilili-operation-history");
      this.hint = this.element("p", "bibilili-settings-hint");
      const toolbar = this.element("div", "bibilili-operation-history-toolbar");
      const size = this.element("div", "bibilili-operation-history-size");
      const label = this.element("label", "bibilili-operation-history-size-label");
      this.sizeLabel = this.element("span", "");
      this.sizeValue = this.element("span", "");
      this.sizeValue.setAttribute("aria-hidden", "true");
      this.sizeInput = this.element("input", "bibilili-operation-history-size-input");
      this.sizeInput.id = "bibilili-operation-history-size";
      this.sizeInput.type = "range";
      this.sizeInput.min = "0";
      this.sizeInput.max = String(OPERATION_HISTORY_LIMITS.length - 1);
      this.sizeInput.step = "1";
      label.setAttribute("for", this.sizeInput.id);
      label.append(this.sizeLabel, this.sizeValue);
      const ticks = this.element("div", "bibilili-operation-history-size-ticks");
      ticks.setAttribute("aria-hidden", "true");
      for (const limit of OPERATION_HISTORY_LIMITS) {
        const tick = this.element("span", "");
        tick.textContent = String(limit);
        ticks.append(tick);
      }
      this.sizeHint = this.element("p", "bibilili-settings-hint");
      this.sizeHint.id = "bibilili-operation-history-size-hint";
      this.sizeInput.setAttribute("aria-describedby", this.sizeHint.id);
      this.sizeInput.addEventListener("input", () => {
        this.draftLimit = OPERATION_HISTORY_LIMITS[Number(this.sizeInput.value)];
        this.renderLimit();
      });
      this.sizeInput.addEventListener("blur", () => this.commitLimit());
      this.clearButton = UiControl.button(this.document, "bibilili-operation-history-clear", () => this.options.store.clear());
      size.append(label, this.sizeInput, ticks);
      toolbar.append(size, this.clearButton);
      this.empty = this.element("p", "bibilili-operation-history-empty");
      this.list = this.element("ol", "bibilili-operation-history-list");
      this.root.append(this.hint, toolbar, this.sizeHint, this.empty, this.list);
      parent.append(this.root);
    }

    /** Publishes a slider draft only after focus leaves the input. */
    commitLimit() {
      const limit = this.draftLimit;
      this.draftLimit = null;
      if (limit !== null && limit !== this.options.store.limit) this.options.onLimitChange(limit);
      this.renderLimit();
    }

    /** Preserves an uncommitted slider choice through history and settings refreshes. */
    renderLimit() {
      const limit = this.draftLimit ?? this.options.store.limit;
      const position = String(OPERATION_HISTORY_LIMITS.indexOf(limit));
      if (this.sizeInput.value !== position) this.sizeInput.value = position;
      this.sizeInput.setAttribute("aria-valuetext", String(limit));
      this.sizeValue.textContent = String(limit);
    }

    /** @param {string} tag @param {string} className @returns {HTMLElement} */
    element(tag, className) {
      const element = this.document.createElement(tag);
      element.className = className;
      return element;
    }

    /** @param {OperationHistoryEntry} entry Creates one keyed row without rebuilding its button. */
    createRow(entry) {
      const row = this.element("li", "bibilili-operation-history-row");
      const summary = this.element("div", "bibilili-operation-history-summary");
      const title = this.element("a", "bibilili-operation-history-title");
      const detail = this.element("div", "bibilili-operation-history-detail");
      const kind = this.element("span", "bibilili-operation-history-kind");
      const time = this.element("time", "bibilili-operation-history-time");
      detail.append(kind, time);
      summary.append(title, detail);
      const actions = this.element("div", "bibilili-operation-history-actions");
      const feedback = this.element("span", "bibilili-operation-history-feedback");
      feedback.setAttribute("role", "status");
      const loading = this.options.createLoading();
      const check = UiControl.icon(this.document, "check");
      const message = this.element("span", "bibilili-operation-history-message");
      feedback.append(loading, check, message);
      const button = UiControl.button(this.document, "bibilili-operation-history-button", () => {
        void this.options.store.toggle(entry.id, this.options.onApply);
      });
      actions.append(feedback, button);
      row.append(summary, actions);
      return { row, title, kind, time, feedback, loading, check, message, button, actions };
    }

    /** Reconciles new records and operation results while preserving keyboard focus. */
    render(language) {
      if (!this.root) return;
      const { store } = this.options;
      const message = (key) => UiStrings.message(key, language);
      const dateFormat = new Intl.DateTimeFormat(language, { dateStyle: "short", timeStyle: "medium" });
      this.hint.textContent = message(UiMessage.OPERATION_HISTORY_HINT);
      this.sizeLabel.textContent = message(UiMessage.OPERATION_HISTORY_SIZE);
      this.sizeHint.textContent = message(UiMessage.OPERATION_HISTORY_SIZE_HINT);
      this.renderLimit();
      UiControl.setTextButtonLabel(this.clearButton, message(UiMessage.OPERATION_HISTORY_CLEAR));
      this.clearButton.disabled = !store.entries.length || Boolean(store.pendingId);
      this.empty.textContent = message(UiMessage.OPERATION_HISTORY_EMPTY);
      this.empty.hidden = store.entries.length > 0;
      const available = new Set();
      let previous = null;
      for (const entry of store.entries) {
        let parts = this.rows.get(entry.id);
        if (!parts) {
          parts = this.createRow(entry);
          this.rows.set(entry.id, parts);
        }
        available.add(entry.id);
        UiControl.place(this.list, parts.row, previous);
        previous = parts.row;
        parts.title.textContent = entry.title;
        parts.title.href = entry.targetUrl;
        parts.title.title = entry.title;
        parts.kind.textContent = message(OPERATION_MESSAGES[entry.kind]);
        const date = new Date(entry.createdAt);
        parts.time.dateTime = date.toISOString();
        parts.time.textContent = dateFormat.format(date);
        parts.actions.hidden = entry.kind === OperationKind.VISIT;
        parts.button.disabled = Boolean(store.pendingId) || !store.enabled;
        parts.button.setAttribute("aria-busy", String(entry.pending));
        const iconKind = entry.undone ? "redo" : "undo";
        if (parts.iconKind !== iconKind) {
          parts.button.replaceChildren(UiControl.icon(this.document, iconKind));
          parts.iconKind = iconKind;
        }
        UiControl.setLabel(parts.button,
          message(entry.undone ? UiMessage.OPERATION_HISTORY_REDO : UiMessage.OPERATION_HISTORY_UNDO));
        parts.loading.hidden = !entry.pending;
        const failed = entry.result === UiMessage.OPERATION_HISTORY_FAILED;
        parts.feedback.dataset.state = entry.pending ? "pending" : failed ? "error" : entry.result ? "success" : "";
        parts.check.hidden = !entry.result || failed;
        parts.check.style.display = parts.check.hidden ? "none" : "";
        parts.message.textContent = entry.pending ? message(UiMessage.SOURCE_MORE_LOADING_LABEL)
          : failed ? entry.error || message(entry.result) : entry.result ? message(entry.result) : "";
      }
      for (const [id, parts] of this.rows) {
        if (available.has(id)) continue;
        parts.row.remove();
        this.rows.delete(id);
      }
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
   * @property {(limit: number) => void} onLimitChange Applies and persists the selected capacity after blur.
   * @property {() => HTMLElement} createLoading Shared loading view factory.
   */

  window.__bibililiOperationHistory = Object.freeze({ OperationHistory, OperationHistoryView, OperationKind });
})();
