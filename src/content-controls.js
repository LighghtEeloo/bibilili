(() => {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";
  const POPUP_GAP = 8;
  const ICON_PATHS = Object.freeze({
    locate: "M12 2v3m0 14v3M2 12h3m14 0h3M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0M14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0",
    start: "M5 5v14M17 6l-6 6 6 6",
    refresh: "M20 4v6h-6M20 10a8 8 0 1 0-1.1 6",
    search: "M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0M16 16l5 5",
    more: "M5 12h.01M12 12h.01M19 12h.01",
    settings: "M10 3h4l.7 2.4 2.1 1.2 2.5-.6 2 3.5-1.8 1.8v2.4l1.8 1.8-2 3.5-2.5-.6-2.1 1.2L14 22h-4l-.7-2.4-2.1-1.2-2.5.6-2-3.5 1.8-1.8v-2.4L2.7 9.5l2-3.5 2.5.6 2.1-1.2L10 3M15 12.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
    close: "M6 6l12 12M6 18 18 6",
    chevronDown: "M6 9l6 6 6-6"
  });

  /**
   * Utility methods for extension-owned interactive controls.
   */
  class UiControl {
    /**
     * Creates one decorative extension icon from the shared path registry.
     * Native watch actions use Bilibili's sanitized visual clones instead.
     * @param {Document} document
     * @param {string} kind Key in the closed icon registry.
     * @returns {SVGSVGElement}
     */
    static icon(document, kind) {
      if (!Object.hasOwn(ICON_PATHS, kind)) throw new Error(`Unknown icon: ${kind}`);
      const svg = document.createElementNS(SVG_NS, "svg");
      svg.setAttribute("class", "bibilili-local-icon");
      const path = document.createElementNS(SVG_NS, "path");
      for (const [name, value] of Object.entries({
        viewBox: "0 0 24 24", width: "20", height: "20", fill: "none",
        stroke: "currentColor", "stroke-width": kind === "more" ? "3" : "2",
        "stroke-linecap": "round", "stroke-linejoin": "round",
        "aria-hidden": "true", focusable: "false"
      })) svg.setAttribute(name, value);
      path.setAttribute("d", ICON_PATHS[kind]);
      svg.append(path);
      return svg;
    }

    /**
     * Places a stable child only when its parent or order changes.
     * @param {Element} parent
     * @param {Element} child
     * @param {Element | null} [previous]
     */
    static place(parent, child, previous = null) {
      const reference = previous ? previous.nextSibling : parent.firstChild;
      if (reference !== child) parent.insertBefore(child, reference);
    }

    /**
     * Creates the shared native-action visual slot used by every action surface.
     * @param {Document} document
     * @returns {HTMLSpanElement}
     */
    static actionVisual(document) {
      const visual = document.createElement("span");
      visual.className = "bibilili-action-native-visual";
      visual.setAttribute("aria-hidden", "true");
      return visual;
    }

    /**
     * Creates a button with the extension's standard button setup.
     *
     * @param {Document} document
     * @param {string} className
     * @param {(event: MouseEvent) => void} onClick
     * @returns {HTMLButtonElement}
     */
    static button(document, className, onClick) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = className;
      button.addEventListener("click", onClick);
      return button;
    }

    /**
     * Applies the same label to the hover title and accessible name.
     *
     * @param {HTMLElement} element
     * @param {string} label
     */
    static setLabel(element, label) {
      element.title = label;
      element.setAttribute("aria-label", label);
    }

    /**
     * Applies a visible text label and matching accessible name.
     *
     * @param {HTMLButtonElement} button
     * @param {string} label
     */
    static setTextButtonLabel(button, label) {
      button.textContent = label;
      UiControl.setLabel(button, label);
    }

    /**
     * Removes keyed buttons whose keys are absent from the latest render pass.
     *
     * @param {Map<string, HTMLButtonElement>} buttons
     * @param {Set<string>} availableKeys
     */
    static removeStaleButtons(buttons, availableKeys) {
      for (const [key, button] of buttons) {
        if (availableKeys.has(key)) {
          continue;
        }

        button.remove();
        buttons.delete(key);
      }
    }
  }

  /** A search button with shared expansion, Escape, and empty-blur behavior. */
  class SearchControl {
    /** @param {Document} document @param {SearchControlOptions} options */
    constructor(document, options) {
      this.options = options;
      this.root = document.createElement("div");
      this.root.className = options.className;
      this.button = UiControl.button(document, options.buttonClassName, () => {
        options.onOpen?.();
        this.setExpanded(true);
        this.input.focus();
      });
      this.button.append(UiControl.icon(document, "search"));
      this.button.setAttribute("aria-controls", options.inputId);
      this.button.setAttribute("aria-expanded", "false");
      this.input = document.createElement("input");
      this.input.id = options.inputId;
      this.input.type = "search";
      this.input.autocomplete = "off";
      this.input.hidden = true;
      this.input.addEventListener("input", () => options.onInput(this.input.value));
      this.input.addEventListener("keydown", (event) => {
        // Note: Bilibili handles player shortcuts on the containing document.
        event.stopPropagation();
        if (event.key === "Escape" && !event.isComposing) {
          event.preventDefault();
          this.input.value = "";
          options.onInput("");
          this.setExpanded(false);
          (options.escapeFocus?.() ?? this.button).focus();
        }
      });
      this.input.addEventListener("blur", () => {
        if (!this.input.value.trim()) this.setExpanded(false);
      });
      this.root.append(this.button, this.input);
    }

    /** @param {boolean} expanded Whether the field replaces its button. */
    setExpanded(expanded) {
      this.input.hidden = !expanded;
      this.button.hidden = expanded;
      this.button.setAttribute("aria-expanded", String(expanded));
      this.options.onExpandedChange?.();
    }

    /** @param {string} label Localized accessible name and input placeholder. */
    setLabel(label) {
      UiControl.setLabel(this.button, label);
      this.input.setAttribute("aria-label", label);
      this.input.placeholder = label;
    }
  }

  /**
   * @typedef {object} SearchControlOptions
   * @property {string} inputId Stable id referenced by the search button.
   * @property {string} className Container styling.
   * @property {string} buttonClassName Search button styling.
   * @property {(query: string) => void} onInput Applies the current query.
   * @property {() => void} [onOpen] Prepares the containing surface before expansion.
   * @property {() => void} [onExpandedChange] Reconciles placement or popup geometry.
   * @property {() => HTMLElement | null} [escapeFocus] Optional alternate focus return target.
   */

  /**
   * Owns a nonmodal panel above a page control, including dismissal and focus.
   * The panel lives outside the layout so Settings can survive deactivation.
   */
  class PopupPanel {
    /** @param {Document} document @param {string} className */
    constructor(document, className) {
      this.document = document;
      this.className = className;
      this.root = null;
      this.anchor = null;
      this.outsideHandler = (event) => {
        if (!this.root.contains(event.target) && !this.anchor?.contains(event.target)) {
          this.close(false);
        }
      };
      this.keyHandler = (event) => {
        if (event.key === "Escape" && !event.isComposing) {
          event.preventDefault();
          this.close(true);
        }
        // Note: Bilibili handles player shortcuts on the containing document.
        event.stopPropagation();
      };
      this.resizeHandler = () => this.position();
      this.escapeHandler = (event) => {
        if (event.key === "Escape" && !event.isComposing && !this.root.contains(event.target)) {
          this.close(true);
        }
      };
    }

    /** Creates the panel once; its keyed children survive subsequent openings. */
    ensure() {
      if (this.root) return;
      this.root = this.document.createElement("section");
      this.root.className = `bibilili-popup ${this.className}`;
      this.root.setAttribute("role", "dialog");
      this.root.hidden = true;
      this.root.addEventListener("keydown", this.keyHandler);
      this.root.addEventListener("keyup", (event) => event.stopPropagation());
    }

    /** @returns {boolean} Whether this panel is visible. */
    get isOpen() { return Boolean(this.root && !this.root.hidden); }

    /** @param {HTMLElement} anchor */
    toggle(anchor) {
      if (this.isOpen) this.close(true);
      else this.open(anchor);
    }

    /** Opens the panel and focuses its first available control. @param {HTMLElement} anchor */
    open(anchor) {
      this.ensure();
      this.anchor = anchor;
      if (!this.root.isConnected) this.document.body.append(this.root);
      this.root.hidden = false;
      anchor.setAttribute("aria-expanded", "true");
      this.position();
      this.document.addEventListener("pointerdown", this.outsideHandler, true);
      this.document.addEventListener("keydown", this.escapeHandler);
      window.addEventListener("resize", this.resizeHandler);
      this.root.querySelector("button:not(:disabled), input:not(:disabled)")?.focus();
    }

    /** Clamps the panel above its anchor within the visible viewport. */
    position() {
      if (!this.isOpen) return;
      const rect = this.anchor?.isConnected ? this.anchor.getBoundingClientRect() : null;
      const width = this.document.documentElement.clientWidth;
      const height = this.document.documentElement.clientHeight;
      this.root.style.maxHeight = `${Math.max(0, height - 2 * POPUP_GAP)}px`;
      const panel = this.root.getBoundingClientRect();
      this.root.style.left = `${Math.max(POPUP_GAP,
        Math.min((rect?.right ?? width) - panel.width, width - panel.width - POPUP_GAP))}px`;
      this.root.style.top = `${Math.max(POPUP_GAP,
        Math.min((rect?.top ?? height) - panel.height - POPUP_GAP, height - panel.height - POPUP_GAP))}px`;
    }

    /** Dismisses without removing controls. @param {boolean} [restoreFocus] */
    close(restoreFocus = false) {
      if (!this.isOpen) return;
      this.root.hidden = true;
      this.anchor?.setAttribute("aria-expanded", "false");
      this.document.removeEventListener("pointerdown", this.outsideHandler, true);
      this.document.removeEventListener("keydown", this.escapeHandler);
      window.removeEventListener("resize", this.resizeHandler);
      if (restoreFocus && this.anchor?.isConnected) this.anchor.focus();
    }

    /** Removes only the owned panel and its global listeners. */
    destroy() {
      this.close();
      this.root?.remove();
      this.root = null;
      this.anchor = null;
    }
  }

  window.__bibililiControls = Object.freeze({ UiControl, SearchControl, PopupPanel });
})();
