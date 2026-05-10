(() => {
  "use strict";

  const BROWSER_DARK_SCHEME_QUERY = "(prefers-color-scheme: dark)";
  const BILIBILI_THEME_COOKIE_NAME = "theme_style";
  const BILIBILI_THEME_COOKIE_DOMAIN = ".bilibili.com";
  const BILIBILI_THEME_COOKIE_MAX_AGE_SECONDS = 31536000;
  const BILIBILI_THEME_STYLE_LINK_SELECTOR = "head link#__css-map__";
  const BILIBILI_DARK_PAGE_ATTR = "common-theme-dark-page";
  const BILIBILI_DARK_PAGE_VALUE = "common";
  const BILIBILI_LEGACY_DARK_COMMON_ATTR = "common-theme-dark-common";

  /**
   * Closed Bilibili theme modes.
   */
  const ThemeMode = Object.freeze({
    LIGHT: "light",
    DARK: "dark"
  });

  /**
   * Synchronizes Bilibili's native theme controls with the browser preference.
   */
  class BilibiliThemeSync {
    /**
     * Applies the current system theme to Bilibili-owned theme state.
     *
     * @param {Document} document
     * @returns {string}
     */
    static sync(document) {
      const mode = BilibiliThemeSync.systemTheme();

      BilibiliThemeSync.writeThemeCookie(document, mode);
      BilibiliThemeSync.applyThemeMarkers(document, mode);
      BilibiliThemeSync.swapThemeStylesheet(document, mode);

      return mode;
    }

    /**
     * Returns the theme currently requested by the browser.
     *
     * @returns {string}
     */
    static systemTheme() {
      return typeof window.matchMedia === "function" &&
        window.matchMedia(BROWSER_DARK_SCHEME_QUERY).matches
        ? ThemeMode.DARK
        : ThemeMode.LIGHT;
    }

    /**
     * Returns the native Bilibili theme mode when the page exposes one.
     *
     * @param {Document} document
     * @returns {string | null}
     */
    static nativeTheme(document) {
      return (
        BilibiliThemeSync.cookieTheme(document) ??
        BilibiliThemeSync.stylesheetTheme(document) ??
        BilibiliThemeSync.markerTheme(document)
      );
    }

    /**
     * Reads Bilibili's persisted theme cookie.
     *
     * @param {Document} document
     * @returns {string | null}
     */
    static cookieTheme(document) {
      const cookie = String(document.cookie ?? "");
      const escapedName = BILIBILI_THEME_COOKIE_NAME.replace(
        /[.*+?^${}()|[\]\\]/gu,
        "\\$&"
      );
      const match = cookie.match(
        new RegExp(`(?:^|;\\s*)${escapedName}=([^;]*)`, "u")
      );

      return BilibiliThemeSync.normalizeTheme(match?.[1]);
    }

    /**
     * Reads Bilibili's active theme stylesheet URL.
     *
     * @param {Document} document
     * @returns {string | null}
     */
    static stylesheetTheme(document) {
      const href = BilibiliThemeSync.themeStylesheet(document)?.href ?? "";

      if (/\/dark\.css(?:$|[?#])/u.test(href)) {
        return ThemeMode.DARK;
      }

      if (/\/light\.css(?:$|[?#])/u.test(href)) {
        return ThemeMode.LIGHT;
      }

      return null;
    }

    /**
     * Reads native dark-mode markers used by Bilibili common pages.
     *
     * @param {Document} document
     * @returns {string | null}
     */
    static markerTheme(document) {
      const root = document.documentElement;

      if (
        root?.getAttribute(BILIBILI_DARK_PAGE_ATTR) ===
          BILIBILI_DARK_PAGE_VALUE ||
        root?.hasAttribute(BILIBILI_LEGACY_DARK_COMMON_ATTR)
      ) {
        return ThemeMode.DARK;
      }

      return null;
    }

    /**
     * Writes Bilibili's native persisted theme cookie when needed.
     *
     * @param {Document} document
     * @param {string} mode
     * @returns {boolean}
     */
    static writeThemeCookie(document, mode) {
      if (
        !BilibiliThemeSync.isThemeMode(mode) ||
        BilibiliThemeSync.cookieTheme(document) === mode
      ) {
        return false;
      }

      try {
        document.cookie = [
          `${BILIBILI_THEME_COOKIE_NAME}=${mode}`,
          "path=/",
          `domain=${BILIBILI_THEME_COOKIE_DOMAIN}`,
          `max-age=${BILIBILI_THEME_COOKIE_MAX_AGE_SECONDS}`,
          "SameSite=Lax"
        ].join("; ");
        return true;
      } catch (_error) {
        return false;
      }
    }

    /**
     * Applies root markers consumed by Bilibili's native common-page theme CSS.
     *
     * @param {Document} document
     * @param {string} mode
     */
    static applyThemeMarkers(document, mode) {
      const root = document.documentElement;

      if (!root) {
        return;
      }

      if (mode === ThemeMode.DARK) {
        root.setAttribute(BILIBILI_DARK_PAGE_ATTR, BILIBILI_DARK_PAGE_VALUE);
        /*
         * Note: Bilibili has used both common-theme-dark-page="common" and a
         * boolean common-theme-dark-common marker for its common-page dark CSS.
         */
        root.setAttribute(BILIBILI_LEGACY_DARK_COMMON_ATTR, "");
        return;
      }

      root.removeAttribute(BILIBILI_DARK_PAGE_ATTR);
      root.removeAttribute(BILIBILI_LEGACY_DARK_COMMON_ATTR);
    }

    /**
     * Swaps Bilibili's own theme stylesheet when the CSS map is present.
     *
     * @param {Document} document
     * @param {string} mode
     * @returns {boolean}
     */
    static swapThemeStylesheet(document, mode) {
      if (!BilibiliThemeSync.isThemeMode(mode)) {
        return false;
      }

      const link = BilibiliThemeSync.themeStylesheet(document);

      if (!link?.href) {
        return false;
      }

      const nextHref = link.href.replace(
        /\/(?:dark|light)\.css(?=($|[?#]))/u,
        `/${mode}.css`
      );

      if (nextHref === link.href) {
        return false;
      }

      link.href = nextHref;
      return true;
    }

    /**
     * Finds Bilibili's CSS-map stylesheet link.
     *
     * @param {Document} document
     * @returns {{ href?: string } | null}
     */
    static themeStylesheet(document) {
      return typeof document.querySelector === "function"
        ? document.querySelector(BILIBILI_THEME_STYLE_LINK_SELECTOR)
        : null;
    }

    /**
     * Returns a supported theme mode from arbitrary text.
     *
     * @param {string | null | undefined} value
     * @returns {string | null}
     */
    static normalizeTheme(value) {
      return BilibiliThemeSync.isThemeMode(value) ? value : null;
    }

    /**
     * Returns true for a supported theme mode.
     *
     * @param {string | null | undefined} value
     * @returns {boolean}
     */
    static isThemeMode(value) {
      return value === ThemeMode.LIGHT || value === ThemeMode.DARK;
    }
  }

  /**
   * Stable native theme helpers loaded before the main content-script runtime.
   */
  window.__bibililiTheme = Object.freeze({
    BROWSER_DARK_SCHEME_QUERY,
    BILIBILI_DARK_PAGE_ATTR,
    BILIBILI_LEGACY_DARK_COMMON_ATTR,
    BILIBILI_THEME_COOKIE_NAME,
    BILIBILI_THEME_STYLE_LINK_SELECTOR,
    BilibiliThemeSync,
    ThemeMode
  });

  if (typeof document !== "undefined" && document?.documentElement) {
    BilibiliThemeSync.sync(document);
  }
})();
