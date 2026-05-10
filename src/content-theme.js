(() => {
  "use strict";

  const BROWSER_DARK_SCHEME_QUERY = "(prefers-color-scheme: dark)";

  /**
   * Closed theme modes applied to extension-owned surfaces.
   */
  const ThemeMode = Object.freeze({
    LIGHT: "light",
    DARK: "dark"
  });

  /**
   * Resolves the extension theme from Bilibili state, page colors, or browser preference.
   */
  class ThemeResolver {
    /**
     * Returns the current extension theme mode.
     *
     * @param {Document} document
     * @returns {string}
     */
    static resolve(document) {
      return (
        ThemeResolver.siteTheme(document) ??
        ThemeResolver.computedTheme(document) ??
        (window.matchMedia(BROWSER_DARK_SCHEME_QUERY).matches
          ? ThemeMode.DARK
          : ThemeMode.LIGHT)
      );
    }

    /**
     * Returns an explicit Bilibili theme mode when the page exposes one.
     *
     * @param {Document} document
     * @returns {string | null}
     */
    static siteTheme(document) {
      const roots = [document.documentElement, document.body].filter(Boolean);

      for (const root of roots) {
        const token = ThemeResolver.themeToken(root);

        if (token) {
          return token;
        }
      }

      return null;
    }

    /**
     * Infers theme mode from computed page colors.
     *
     * @param {Document} document
     * @returns {string | null}
     */
    static computedTheme(document) {
      const candidates = [
        document.body,
        document.documentElement,
        document.querySelector(
          ".bili-feed4-layout, .bili-layout, .left-container, .right-container"
        )
      ].filter(Boolean);

      for (const element of candidates) {
        const color = ThemeResolver.computedBackground(element);

        if (!color) {
          continue;
        }

        return ThemeResolver.relativeLuminance(color) < 0.42
          ? ThemeMode.DARK
          : ThemeMode.LIGHT;
      }

      return null;
    }

    /**
     * Reads root-level class and data attributes for theme tokens.
     *
     * @param {Element} root
     * @returns {string | null}
     */
    static themeToken(root) {
      const values = [
        root.getAttribute("data-theme"),
        root.getAttribute("data-color-mode"),
        root.getAttribute("data-prefers-color-scheme"),
        root.getAttribute("data-dark"),
        root.getAttribute("class")
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (
        /\b(?:bili-)?dark(?:-mode)?\b/.test(values) ||
        /\btheme-dark\b/.test(values)
      ) {
        return ThemeMode.DARK;
      }

      if (
        /\blight(?:-mode)?\b/.test(values) ||
        /\btheme-light\b/.test(values)
      ) {
        return ThemeMode.LIGHT;
      }

      return null;
    }

    /**
     * Returns an opaque computed background color for an element.
     *
     * @param {Element} element
     * @returns {{ red: number, green: number, blue: number } | null}
     */
    static computedBackground(element) {
      const value = window.getComputedStyle(element).backgroundColor;
      const color = ThemeResolver.parseRgb(value);

      if (!color || color.alpha < 0.5) {
        return null;
      }

      return color;
    }

    /**
     * Parses CSS rgb() and rgba() color strings.
     *
     * @param {string} value
     * @returns {{ red: number, green: number, blue: number, alpha: number } | null}
     */
    static parseRgb(value) {
      const match = value
        .trim()
        .match(
          /^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)(?:\s*,\s*(\d+(?:\.\d+)?))?\s*\)$/i
        );

      if (!match) {
        return null;
      }

      return {
        red: Number(match[1]),
        green: Number(match[2]),
        blue: Number(match[3]),
        alpha: match[4] === undefined ? 1 : Number(match[4])
      };
    }

    /**
     * Computes WCAG relative luminance for an RGB color.
     *
     * @param {{ red: number, green: number, blue: number }} color
     * @returns {number}
     */
    static relativeLuminance(color) {
      const [red, green, blue] = [
        color.red,
        color.green,
        color.blue
      ].map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.03928
          ? normalized / 12.92
          : ((normalized + 0.055) / 1.055) ** 2.4;
      });

      return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    }
  }

  /**
   * Stable theme helpers loaded before the main content-script runtime.
   */
  window.__bibililiTheme = Object.freeze({
    BROWSER_DARK_SCHEME_QUERY,
    ThemeMode,
    ThemeResolver
  });
})();
