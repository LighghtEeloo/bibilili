(() => {
  "use strict";

  const { UiControl, SearchControl, PopupPanel } = window.__bibililiControls;
  const { UiMessage, UiStrings } = window.__bibililiI18n;

  /** Renders the favorite-folder picker using the shared nonmodal popup lifecycle. */
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

    /** Returns the stable chevron beside the ordinary Favorites source button. */
    launcher() {
      if (!this.button) {
        this.button = UiControl.button(this.document,
          "bibilili-source-button bibilili-favorites-picker-button", () => this.open(true));
        this.button.append(UiControl.icon(this.document, "chevronDown"));
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
      this.searchControl.setExpanded(Boolean(this.search.value?.trim()));
      this.panel.open(this.launcher());
      const selected = this.rows.get(this.source?.folderId)?.button;
      const first = [...this.rows.values()].find((row) => !row.button.hidden)?.button;
      const folder = selected && !selected.hidden ? selected : first;
      (!this.search.hidden ? this.search : folder ?? this.searchButton).focus();
      this.options.onOpen(choose);
    }

    /** Builds the fixed controls once; folder buttons remain keyed by folder id. */
    ensure() {
      if (this.panel.root) return;
      this.panel.ensure();
      this.panel.root.id = "bibilili-favorite-folders";
      const header = this.element("div", "bibilili-popup-header");
      this.heading = this.element("h2", "bibilili-favorites-heading");
      this.closeButton = UiControl.button(this.document, "bibilili-popup-close", () => this.panel.close(true));
      this.closeButton.append(UiControl.icon(this.document, "close"));
      this.searchControl = new SearchControl(this.document, {
        inputId: "bibilili-favorite-folder-search",
        className: "bibilili-favorites-search-control",
        buttonClassName: "bibilili-popup-close",
        onInput: () => this.render(),
        onExpandedChange: () => {
          header.classList.toggle("bibilili-favorites-searching", !this.search.hidden);
          this.panel.position();
        }
      });
      this.searchButton = this.searchControl.button;
      this.search = this.searchControl.input;
      this.search.className = "bibilili-favorites-search";
      header.append(this.heading, this.searchControl.root, this.closeButton);
      const body = this.element("div", "bibilili-favorites-body");
      this.list = this.element("div", "bibilili-favorite-folders");
      this.status = this.element("p", "bibilili-favorites-status");
      this.status.setAttribute("role", "status");
      this.refreshButton = UiControl.button(this.document, "bibilili-source-button", () => this.options.onRefresh());
      this.signInButton = UiControl.button(this.document, "bibilili-source-button", () => {
        this.panel.close(true);
        this.options.onSignIn();
      });
      const actions = this.element("div", "bibilili-favorites-actions");
      actions.append(this.signInButton, this.refreshButton);
      body.append(this.list, this.status, actions);
      this.panel.root.append(header, body);
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

    /** Reconciles folder names, counts, and explicit loading, login, and empty states. */
    render() {
      if (!this.panel.root || !this.directory) return;
      const title = this.message(UiMessage.FAVORITES_FOLDERS_LABEL);
      this.heading.textContent = title;
      this.panel.root.setAttribute("aria-label", title);
      UiControl.setLabel(this.closeButton, this.message(UiMessage.CLOSE_LABEL));
      const searchLabel = this.message(UiMessage.FAVORITES_SEARCH_LABEL);
      this.searchControl.setLabel(searchLabel);
      const query = (this.search.value ?? "").trim().normalize("NFKC").toLowerCase();
      const available = new Set();
      let previous = null;
      let matches = 0;
      for (const folder of this.directory.items) {
        available.add(folder.id);
        let row = this.rows.get(folder.id);
        if (!row) {
          const button = UiControl.button(this.document, "bibilili-favorite-folder", () => {
            this.panel.close(true);
            this.options.onSelect(folder.id);
          });
          const name = this.element("span", "bibilili-favorite-folder-name");
          const count = this.element("span", "bibilili-favorite-folder-count");
          button.append(name, count);
          row = { button, name, count };
          this.rows.set(folder.id, row);
        }
        row.name.textContent = folder.title;
        row.count.textContent = folder.count === null ? "" : new Intl.NumberFormat(UiStrings.numberLocale(this.language)).format(folder.count);
        row.button.setAttribute("aria-pressed", String(folder.id === this.source?.folderId));
        row.button.hidden = !folder.title.normalize("NFKC").toLowerCase().includes(query);
        if (!row.button.hidden) matches += 1;
        UiControl.place(this.list, row.button, previous);
        previous = row.button;
      }
      for (const [id, row] of this.rows) {
        if (available.has(id)) continue;
        if (row.button.contains(this.document.activeElement)) {
          (this.search.hidden ? this.searchButton : this.search).focus();
        }
        row.button.remove();
        this.rows.delete(id);
      }
      const status = this.directory.status;
      const loading = status === this.options.statuses.LOADING;
      const signedOut = status === this.options.statuses.SIGNED_OUT;
      const message = loading ? UiMessage.SOURCE_MORE_LOADING_LABEL
        : signedOut ? UiMessage.FAVORITES_SIGN_IN_MESSAGE
          : status === this.options.statuses.ERROR ? UiMessage.FAVORITES_ERROR_MESSAGE
            : !this.directory.items.length ? UiMessage.FAVORITES_NO_FOLDERS_MESSAGE
              : !matches ? UiMessage.FAVORITES_NO_MATCHES_MESSAGE : null;
      this.status.textContent = message ? this.message(message) : "";
      this.status.hidden = !message;
      this.list.setAttribute("aria-busy", String(loading));
      UiControl.setTextButtonLabel(this.refreshButton, this.message(
        status === this.options.statuses.ERROR ? UiMessage.SOURCE_MORE_RETRY_LABEL : UiMessage.FAVORITES_REFRESH_LABEL));
      this.refreshButton.disabled = loading;
      this.signInButton.hidden = !signedOut;
      UiControl.setTextButtonLabel(this.signInButton, this.message(UiMessage.FAVORITES_SIGN_IN_LABEL));
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
   * @property {(choose: boolean) => void} onOpen Loads folders and resumes a saved selection.
   * @property {(folderId: string) => void} onSelect Selects an account-validated folder.
   * @property {() => void} onRefresh Refreshes the directory and login state.
   * @property {() => void} onSignIn Opens Bilibili's native account control.
   */
  window.__bibililiFavorites = Object.freeze({ FavoritesView });
})();
