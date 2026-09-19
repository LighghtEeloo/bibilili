(() => {
  "use strict";

  const { UiControl, PopupPanel } = window.__bibililiControls;
  const { UiLanguage, UiMessage, UiStrings } = window.__bibililiI18n;
  const { SettingsPreference } = window.__bibililiStorageState;
  const SettingsTab = Object.freeze({ FEATURES: "features", ACTIONS: "actions" });

  /**
   * Renders persisted language, feature, and placement preferences in a reusable popup.
   * Native action icons are supplied by the layout's existing visual renderer.
   */
  class SettingsView {
    /** @param {Document} document @param {SettingsViewOptions} options */
    constructor(document, options) {
      this.document = document;
      this.options = options;
      this.panel = new PopupPanel(document, "bibilili-settings");
      this.tab = SettingsTab.ACTIONS;
      this.preferences = SettingsPreference.defaults();
      this.enabled = true;
      this.language = "en";
      this.labels = new Map();
      this.helpButtons = new Map();
      this.languageOptions = new Map();
      this.inputs = new Map();
      this.actions = new Map();
      this.tabs = new Map();
      this.panels = new Map();
      this.statusKey = UiMessage.SETTINGS_AUTOSAVE_LABEL;
      this.button = null;
    }

    /** Returns the stable settings launcher shared by the dock and disabled page. */
    launcher() {
      if (!this.button) {
        this.button = UiControl.button(this.document, "bibilili-action-button bibilili-settings-button", () => {
          this.toggle(this.button);
        });
        this.button.append(UiControl.icon(this.document, "settings"));
        this.button.setAttribute("aria-haspopup", "dialog");
        this.button.setAttribute("aria-expanded", "false");
        this.button.setAttribute("aria-controls", "bibilili-settings");
      }
      UiControl.setLabel(this.button, UiStrings.message(UiMessage.SETTINGS_LABEL, this.language));
      return this.button;
    }

    /** @param {HTMLElement} anchor */
    toggle(anchor) {
      this.ensure();
      this.render();
      if (!this.panel.isOpen) this.options.onOpen();
      this.panel.toggle(anchor);
    }

    /** Builds stable rows once so reconciliation preserves focus and pointer input. */
    ensure() {
      if (this.panel.root) return;
      this.panel.ensure();
      const root = this.panel.root;
      root.id = "bibilili-settings";
      const header = this.element("div", "bibilili-popup-header bibilili-settings-header");
      header.append(this.text("div", UiMessage.EXTENSION_NAME, "bibilili-settings-title"));
      const activation = this.switchRow("enabled", UiMessage.SETTINGS_ENABLED_LABEL, (checked) => {
        this.options.onEnabledChange(checked);
      });
      header.append(activation.row);
      this.activationInput = activation.input;
      const close = UiControl.button(this.document, "bibilili-popup-close", () => this.panel.close(true));
      close.append(UiControl.icon(this.document, "close"));
      this.closeButton = close;
      header.append(close);

      const tabs = this.element("div", "bibilili-settings-tabs");
      tabs.setAttribute("role", "tablist");
      for (const [key, message] of [
        [SettingsTab.FEATURES, UiMessage.SETTINGS_FEATURES_LABEL],
        [SettingsTab.ACTIONS, UiMessage.SETTINGS_ACTION_BAR_LABEL]
      ]) {
        const button = UiControl.button(this.document, "bibilili-settings-tab", () => this.selectTab(key));
        this.labels.set(button, message);
        button.id = `bibilili-settings-tab-${key}`;
        button.setAttribute("role", "tab");
        button.setAttribute("aria-controls", `bibilili-settings-panel-${key}`);
        button.addEventListener("keydown", (event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          this.selectTab(event.key === "Home" ? SettingsTab.FEATURES : event.key === "End"
            ? SettingsTab.ACTIONS : this.tab === SettingsTab.FEATURES ? SettingsTab.ACTIONS : SettingsTab.FEATURES);
          this.tabs.get(this.tab).focus();
        });
        this.tabs.set(key, button);
        tabs.append(button);
        const panel = this.element("div", "bibilili-settings-body");
        panel.id = `bibilili-settings-panel-${key}`;
        panel.setAttribute("role", "tabpanel");
        panel.setAttribute("aria-labelledby", button.id);
        this.panels.set(key, panel);
      }
      const features = this.panels.get(SettingsTab.FEATURES);
      features.append(this.languageRow());
      features.append(this.text("h3", UiMessage.SETTINGS_WATCH_PAGE_LABEL));
      for (const [key, message, hint] of [
        ["description", UiMessage.SETTINGS_DESCRIPTION_LABEL],
        ["thumbnails", UiMessage.SETTINGS_THUMBNAILS_LABEL],
        ["favoriteToSelectedFolder", UiMessage.SETTINGS_FAVORITE_FOLDER_LABEL, UiMessage.SETTINGS_FAVORITE_FOLDER_HINT]
      ]) this.addPreferenceSwitch(features, "features", key, message, hint);
      features.append(this.text("h3", UiMessage.SETTINGS_SOURCES_LABEL));
      for (const source of this.options.sources) {
        this.addPreferenceSwitch(features, "sources", source.kind, source.message);
      }
      features.append(this.text("p", UiMessage.SETTINGS_SOURCES_HINT, "bibilili-settings-hint"));

      const actions = this.panels.get(SettingsTab.ACTIONS);
      this.addPreferenceSwitch(actions, "features", "moreButton", UiMessage.SETTINGS_MORE_BUTTON_LABEL);
      for (const group of this.options.actionGroups) {
        actions.append(this.text("h3", group.message));
        for (const definition of group.actions) {
          const row = this.element("div", "bibilili-settings-row");
          const name = this.element("span", "bibilili-settings-action-name");
          const visual = UiControl.actionVisual(this.document);
          const label = this.text("span", definition.message);
          name.append(visual, label);
          const button = UiControl.button(this.document, "bibilili-settings-placement", () => {
            this.change("pinnedActions", definition.kind, !this.preferences.pinnedActions[definition.kind]);
          });
          this.actions.set(definition.kind, { visual, button, label });
          row.append(name, button);
          actions.append(row);
        }
      }
      actions.append(this.text("p", UiMessage.SETTINGS_FIXED_HINT, "bibilili-settings-hint"));
      const footer = this.element("div", "bibilili-settings-footer");
      this.status = this.element("span", "bibilili-settings-status");
      this.status.setAttribute("role", "status");
      const restore = UiControl.button(this.document, "bibilili-settings-restore", () => {
        this.options.onChange(SettingsPreference.defaults());
      });
      this.labels.set(restore, UiMessage.SETTINGS_RESTORE_LABEL);
      footer.append(this.status, restore);
      root.append(header, tabs, ...this.panels.values(), footer);
    }

    /** @param {string} tag @param {string} [className] @returns {HTMLElement} */
    element(tag, className = "") {
      const element = this.document.createElement(tag);
      element.className = className;
      return element;
    }

    /** Creates a localized text node whose label is refreshed in place. */
    text(tag, message, className = "") {
      const element = this.element(tag, className);
      this.labels.set(element, message);
      return element;
    }

    /** Creates a native language selector with each language named in its own language. */
    languageRow() {
      const row = this.element("label", "bibilili-settings-row");
      this.languageSelect = this.element("select", "bibilili-settings-select");
      this.languageSelect.name = "language";
      const automatic = this.text("option", UiMessage.SETTINGS_LANGUAGE_AUTOMATIC_LABEL);
      automatic.value = "";
      this.languageSelect.append(automatic);
      for (const language of Object.values(UiLanguage)) {
        const option = this.element("option");
        option.value = language;
        option.lang = language;
        this.languageOptions.set(option, language);
        this.languageSelect.append(option);
      }
      this.languageSelect.addEventListener("change", () => {
        this.options.onChange({ ...this.preferences, language: this.languageSelect.value || null });
      });
      row.append(this.text("span", UiMessage.SETTINGS_LANGUAGE_LABEL), this.languageSelect);
      return row;
    }

    /** Creates a labeled native switch, keeping optional help outside its clickable label. */
    switchRow(key, message, onChange, hint = null) {
      const row = this.element(hint ? "div" : "label",
        `bibilili-settings-row${hint ? " bibilili-settings-row-with-help" : ""}`);
      const input = this.element("input", "bibilili-settings-switch");
      input.type = "checkbox";
      input.name = key;
      input.setAttribute("role", "switch");
      input.addEventListener("change", () => onChange(input.checked));
      if (hint) {
        input.id = `bibilili-settings-${key}`;
        const label = this.text("label", message);
        label.setAttribute("for", input.id);
        const name = this.element("span", "bibilili-settings-name");
        name.append(label, this.helpControl(key, message, hint));
        row.append(name, input);
      } else {
        row.append(this.text("span", message), input);
      }
      return { row, input };
    }

    /** Shows localized help on hover or focus; activation also focuses it for touch input. */
    helpControl(key, message, hint) {
      const help = this.element("span", "bibilili-settings-help");
      const button = UiControl.button(this.document, "bibilili-settings-help-button", () => button.focus());
      button.textContent = "?";
      const tooltip = this.text("span", hint, "bibilili-settings-tooltip");
      tooltip.id = `bibilili-settings-${key}-help`;
      tooltip.setAttribute("role", "tooltip");
      button.setAttribute("aria-describedby", tooltip.id);
      this.helpButtons.set(button, message);
      help.append(button, tooltip);
      return help;
    }

    /** Adds one switch from the shared preference record. */
    addPreferenceSwitch(parent, group, key, message, hint = null) {
      const { row, input } = this.switchRow(key, message, (checked) => this.change(group, key, checked), hint);
      this.inputs.set(input, { group, key });
      parent.append(row);
    }

    /** Sends a fresh record to the controller; the view never persists independently. */
    change(group, key, value) {
      this.options.onChange({ ...this.preferences, [group]: { ...this.preferences[group], [key]: value } });
    }

    /** @param {string} tab */
    selectTab(tab) {
      this.tab = tab;
      this.render();
      this.panel.position();
    }

    /**
     * Refreshes labels and selected values without rebuilding interactive rows.
     * @param {SettingsPreferenceRecord} preferences
     * @param {boolean} enabled
     * @param {string} language
     */
    update(preferences, enabled, language) {
      this.preferences = preferences;
      this.enabled = enabled;
      this.language = language;
      if (this.button) UiControl.setLabel(this.button, UiStrings.message(UiMessage.SETTINGS_LABEL, language));
      if (this.panel.isOpen) {
        this.render();
        this.panel.position();
      }
    }

    /** Reports persistence failure without undoing the current page's choices. */
    showSaveResult(saved) {
      this.statusKey = saved ? UiMessage.SETTINGS_SAVED_LABEL : UiMessage.SETTINGS_PAGE_ONLY_LABEL;
      this.render();
    }

    /** Reuses the layout's icon renderer for all settings action rows. */
    render() {
      if (!this.panel.root) return;
      const message = (key) => UiStrings.message(key, this.language);
      this.panel.root.lang = this.language;
      this.panel.root.setAttribute("aria-label", message(UiMessage.SETTINGS_LABEL));
      UiControl.setLabel(this.closeButton, message(UiMessage.CLOSE_LABEL));
      for (const [element, key] of this.labels) {
        const label = message(key);
        if (element.textContent !== label) element.textContent = label;
      }
      for (const [button, key] of this.helpButtons) {
        button.setAttribute("aria-label", UiStrings.message(UiMessage.SETTINGS_HELP_LABEL, this.language, [message(key)]));
      }
      for (const [option, language] of this.languageOptions) {
        const label = UiStrings.message(UiMessage.LANGUAGE_NAME, language);
        if (option.textContent !== label) option.textContent = label;
      }
      const languageValue = this.preferences.language ?? "";
      if (this.languageSelect.value !== languageValue) this.languageSelect.value = languageValue;
      this.activationInput.checked = this.enabled;
      for (const [input, { group, key }] of this.inputs) input.checked = this.preferences[group][key];
      for (const [key, button] of this.tabs) {
        const active = key === this.tab;
        button.setAttribute("aria-selected", String(active));
        button.tabIndex = active ? 0 : -1;
        this.panels.get(key).hidden = !active;
      }
      for (const [kind, { visual, button, label }] of this.actions) {
        const pinned = this.preferences.pinnedActions[kind];
        const placement = message(pinned ? UiMessage.SETTINGS_ON_BAR_LABEL : UiMessage.SETTINGS_IN_MORE_LABEL);
        button.textContent = placement;
        button.setAttribute("aria-pressed", String(pinned));
        UiControl.setLabel(button, `${label.textContent}: ${placement}`);
        this.options.renderIcon(kind, visual);
      }
      this.status.textContent = message(this.statusKey);
    }

    /** Releases panel listeners and DOM when the content runtime stops. */
    destroy() {
      this.panel.destroy();
      this.button?.remove();
    }
  }

  /**
   * @typedef {object} SettingsViewOptions
   * @property {{ kind: string, message: string }[]} sources Ordered source definitions.
   * @property {{ message: string, actions: { kind: string, message: string }[] }[]} actionGroups Ordered actions.
   * @property {(preferences: SettingsPreferenceRecord) => void} onChange Applies and persists a full record.
   * @property {(enabled: boolean) => void} onEnabledChange Changes global activation.
   * @property {() => void} onOpen Dismisses another action popup before opening settings.
   * @property {(kind: string, visual: Element) => void} renderIcon Shared action visual renderer.
   */

  window.__bibililiSettings = Object.freeze({ SettingsView });
})();
