(() => {
  "use strict";

  const { UiControl, PopupPanel } = window.__bibililiControls;
  const { UiMessage, UiStrings } = window.__bibililiI18n;

  /** Folder count above which the picker shows its search field. */
  const FOLDER_SEARCH_THRESHOLD = 8;

  /** Renders the favorite-folder picker as a menu of the Favorites split button. */
  class FavoritesView {
    /** @param {Document} document @param {FavoritesViewOptions} options */
    constructor(document, options) {
      this.document = document;
      this.options = options;
      this.panel = new PopupPanel(document, "bibilili-favorites-popup");
      this.button = null;
      this.rows = new Map();
      this.language = "en";
      this.source = null;
      this.directory = null;
    }

    /**
     * Returns the stable folder chevron that forms the trailing half of the
     * Favorites split button. The chevron points up, toward the picker it opens.
     */
    launcher() {
      if (!this.button) {
        this.button = UiControl.button(this.document,
          "bibilili-source-button bibilili-favorites-picker-button", () => this.open(true));
        this.button.append(UiControl.icon(this.document, "chevronUp"));
        this.button.setAttribute("aria-haspopup", "dialog");
        this.button.setAttribute("aria-expanded", "false");
        this.button.setAttribute("aria-controls", "bibilili-favorite-folders");
      }
      UiControl.setLabel(this.button, this.message(UiMessage.FAVORITES_CHOOSE_LABEL));
      return this.button;
    }

    /** Opens the picker, or resumes the remembered folder for a source-label click. */
    open(choose = false) {
      if (choose && this.panel.isOpen) { this.panel.close(true); return; }
      this.ensure();
      this.render();
      const launcher = this.launcher();
      // The picker follows the left edge of the split button, whose leading half precedes the chevron.
      this.panel.startAnchor = launcher.previousElementSibling ?? launcher;
      this.panel.open(launcher);
      this.focusInitial();
      this.options.onOpen(choose);
    }

    /** Focuses the selected folder, then the first match, the search field, and the refresh button. */
    focusInitial() {
      const visible = this.visibleRows();
      const selected = this.rows.get(this.source?.folderId)?.button;
      const target = visible.includes(selected) ? selected : visible[0];
      (target ?? (this.search.hidden ? this.refreshButton : this.search)).focus();
    }

    /** @returns {HTMLButtonElement[]} Folder buttons that match the query, in directory order. */
    visibleRows() {
      return (this.directory?.items ?? []).map((folder) => this.rows.get(folder.id)?.button)
        .filter((button) => button && !button.hidden);
    }

    /** Builds the fixed controls once; folder buttons remain keyed by folder id. */
    ensure() {
      if (this.panel.root) return;
      this.panel.ensure();
      const root = this.panel.root;
      root.id = "bibilili-favorite-folders";
      const header = this.element("div", "bibilili-favorites-header");
      this.heading = this.element("h2", "bibilili-favorites-heading");
      this.search = this.document.createElement("input");
      this.search.id = "bibilili-favorite-folder-search";
      this.search.className = "bibilili-favorites-search";
      this.search.type = "search";
      this.search.autocomplete = "off";
      this.search.addEventListener("input", () => this.render());
      this.refreshButton = UiControl.button(this.document,
        "bibilili-popup-close bibilili-favorites-refresh", () => this.options.onRefresh());
      this.refreshButton.append(UiControl.icon(this.document, "refresh"));
      header.append(this.heading, this.search, this.refreshButton);
      this.list = this.element("div", "bibilili-favorite-folders");
      this.state = this.element("div", "bibilili-favorites-state");
      this.status = this.element("p", "bibilili-favorites-status");
      this.status.setAttribute("role", "status");
      this.retryButton = UiControl.button(this.document, "bibilili-source-button", () => this.options.onRefresh());
      this.signInButton = UiControl.button(this.document, "bibilili-source-button", () => {
        this.panel.close(true);
        this.options.onSignIn();
      });
      this.state.append(this.status, this.signInButton, this.retryButton);
      this.hint = this.element("p", "bibilili-favorites-hint");
      root.append(header, this.list, this.state, this.hint);
      // Capture runs before the shared popup handler, which closes on Escape.
      root.addEventListener("keydown", (event) => this.handleKeydown(event), true);
    }

    /**
     * Moves between folders with the arrow keys, clears a query before closing,
     * and sends typed characters to the visible search field.
     * @param {KeyboardEvent} event
     */
    handleKeydown(event) {
      if (event.isComposing) return;
      const inSearch = event.target === this.search;
      if (event.key === "Escape") {
        if (!this.search.value) return;
        this.search.value = "";
        this.render();
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      const rows = this.visibleRows();
      const index = rows.indexOf(event.target);
      const move = (target) => {
        if (!target) return;
        event.preventDefault();
        target.focus();
      };
      if (event.key === "ArrowDown") {
        if (inSearch || index >= 0) move(rows[index + 1]);
      } else if (event.key === "ArrowUp") {
        if (index > 0) move(rows[index - 1]);
        else if (index === 0 && !this.search.hidden) move(this.search);
      } else if (index >= 0 && event.key === "Home") {
        move(rows[0]);
      } else if (index >= 0 && event.key === "End") {
        move(rows[rows.length - 1]);
      } else if (index >= 0 && !this.search.hidden && event.key.length === 1 && event.key !== " " &&
          !event.ctrlKey && !event.metaKey && !event.altKey) {
        // The focused field receives the character that triggered the move.
        this.search.focus();
      }
    }

    /** @param {string} tag @param {string} className @returns {HTMLElement} */
    element(tag, className) {
      const element = this.document.createElement(tag);
      element.className = className;
      return element;
    }

    /** @param {string} key @returns {string} */
    message(key) { return UiStrings.message(key, this.language); }

    /**
     * Refreshes account state while retaining inputs and folder controls.
     * @param {VideoListSource | null} source Null when Favorites is disabled.
     * @param {FavoriteFolderDirectory} directory Owned folder state.
     * @param {string} language Current UI language.
     */
    update(source, directory, language) {
      this.source = source;
      this.directory = directory;
      this.language = language;
      if (!source) {
        this.panel.close();
        this.button?.remove();
      } else if (this.button) {
        UiControl.setLabel(this.button, this.message(UiMessage.FAVORITES_CHOOSE_LABEL));
      }
      if (this.panel.isOpen) this.render();
    }

    /**
     * Creates one keyed folder button: selection check, name, default tag, and count.
     * @param {FavoriteFolder} folder
     * @returns {FavoriteFolderRow}
     */
    createRow(folder) {
      const button = UiControl.button(this.document, "bibilili-favorite-folder", () => {
        this.panel.close(true);
        this.options.onSelect(folder.id);
      });
      const name = this.element("span", "bibilili-favorite-folder-name");
      const tag = this.element("span", "bibilili-favorite-folder-tag");
      const count = this.element("span", "bibilili-favorite-folder-count");
      button.append(UiControl.icon(this.document, "check"), name, tag, count);
      return { button, name, tag, count };
    }

    /** Reconciles folder names, counts, and the loading, signed-out, failed, and empty states. */
    render() {
      if (!this.panel.root || !this.directory) return;
      const folders = this.directory.items;
      const title = this.message(UiMessage.FAVORITES_FOLDERS_LABEL);
      this.heading.textContent = title;
      this.panel.root.setAttribute("aria-label", title);
      const searchLabel = this.message(UiMessage.FAVORITES_SEARCH_LABEL);
      this.search.setAttribute("aria-label", searchLabel);
      this.search.placeholder = searchLabel;
      // A short directory needs no filter; an active query keeps the field until it is cleared.
      const searchable = folders.length > FOLDER_SEARCH_THRESHOLD || Boolean(this.search.value);
      if (!searchable && this.document.activeElement === this.search) this.refreshButton.focus();
      this.search.hidden = !searchable;
      this.heading.hidden = searchable;
      const query = (this.search.value ?? "").trim().normalize("NFKC").toLowerCase();
      const numbers = new Intl.NumberFormat(UiStrings.numberLocale(this.language));
      const defaultTag = this.message(UiMessage.FAVORITES_DEFAULT_TAG);
      const available = new Set();
      let previous = null;
      let matches = 0;
      for (const folder of folders) {
        available.add(folder.id);
        let row = this.rows.get(folder.id);
        if (!row) {
          row = this.createRow(folder);
          this.rows.set(folder.id, row);
        }
        row.name.textContent = folder.title;
        row.tag.textContent = defaultTag;
        row.tag.hidden = !folder.isDefault;
        row.count.textContent = folder.count === null ? "" : numbers.format(folder.count);
        row.button.setAttribute("aria-pressed", String(folder.id === this.source?.folderId));
        row.button.hidden = !folder.title.normalize("NFKC").toLowerCase().includes(query);
        if (!row.button.hidden) matches += 1;
        UiControl.place(this.list, row.button, previous);
        previous = row.button;
      }
      for (const [id, row] of this.rows) {
        if (available.has(id)) continue;
        if (row.button.contains(this.document.activeElement)) {
          (this.search.hidden ? this.refreshButton : this.search).focus();
        }
        row.button.remove();
        this.rows.delete(id);
      }
      const status = this.directory.status;
      const loading = status === this.options.statuses.LOADING;
      const signedOut = status === this.options.statuses.SIGNED_OUT;
      const failed = status === this.options.statuses.ERROR;
      // A revalidation keeps the retained folders on screen; only an empty list reads as loading.
      const message = loading ? (folders.length ? null : UiMessage.SOURCE_MORE_LOADING_LABEL)
        : signedOut ? UiMessage.FAVORITES_SIGN_IN_MESSAGE
          : failed ? UiMessage.FAVORITES_ERROR_MESSAGE
            : !folders.length ? UiMessage.FAVORITES_NO_FOLDERS_MESSAGE
              : !matches ? UiMessage.FAVORITES_NO_MATCHES_MESSAGE : null;
      this.status.textContent = message ? this.message(message) : "";
      this.state.hidden = !message;
      this.list.hidden = matches === 0;
      this.list.setAttribute("aria-busy", String(loading));
      UiControl.setLabel(this.refreshButton, this.message(UiMessage.FAVORITES_REFRESH_LABEL));
      this.refreshButton.disabled = loading;
      this.refreshButton.setAttribute("data-loading", String(loading));
      this.retryButton.hidden = !failed;
      UiControl.setTextButtonLabel(this.retryButton, this.message(UiMessage.SOURCE_MORE_RETRY_LABEL));
      this.signInButton.hidden = !signedOut;
      UiControl.setTextButtonLabel(this.signInButton, this.message(UiMessage.FAVORITES_SIGN_IN_LABEL));
      this.hint.textContent = this.message(UiMessage.FAVORITES_SAVE_HINT);
      this.hint.hidden = folders.length === 0;
      this.panel.position();
    }

    /** Releases popup listeners and owned controls while retaining the view instance. */
    destroy() {
      this.panel.destroy();
      this.button?.remove();
      this.button = null;
      this.rows.clear();
    }
  }

  /**
   * @typedef {object} FavoritesViewOptions
   * @property {Record<string, string>} statuses Closed account-source states.
   * @property {(choose: boolean) => void} onOpen Revalidates folders and resumes a saved selection.
   * @property {(folderId: string) => void} onSelect Selects an account-validated folder.
   * @property {() => void} onRefresh Refreshes the directory and login state.
   * @property {() => void} onSignIn Opens Bilibili's native account control.
   */

  /**
   * @typedef {object} FavoriteFolderRow
   * @property {HTMLButtonElement} button Keyed folder choice.
   * @property {HTMLElement} name Folder title.
   * @property {HTMLElement} tag Default-folder marker.
   * @property {HTMLElement} count Account media count.
   */
  window.__bibililiFavorites = Object.freeze({ FavoritesView });
})();
