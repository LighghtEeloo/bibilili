(() => {
  "use strict";

  const I18N_OWNED_SURFACE_SELECTOR =
    "#bibilili-layout-root, #bibilili-toggle-root";

  /**
   * Closed UI languages rendered by extension-owned controls.
   */
  const UiLanguage = Object.freeze({
    ENGLISH: "en",
    SIMPLIFIED_CHINESE: "zh-Hans",
    TRADITIONAL_CHINESE: "zh-Hant"
  });

  const DEFAULT_UI_LANGUAGE = UiLanguage.ENGLISH;

  /**
   * Extension i18n message names used by extension-owned UI surfaces.
   */
  const UiMessage = Object.freeze({
    LAYOUT_LABEL: "layoutLabel",
    PLAYER_LABEL: "playerLabel",
    COMMENTS_LABEL: "commentsLabel",
    VIDEO_LISTS_LABEL: "videoListsLabel",
    TURN_ON_LABEL: "turnOnLabel",
    TURN_OFF_LABEL: "turnOffLabel",
    WATCH_ACTIONS_LABEL: "watchActionsLabel",
    WATCH_ACTION_COUNT_LABEL: "watchActionCountLabel",
    WATCH_ACTION_LIKE_LABEL: "watchActionLikeLabel",
    WATCH_ACTION_COIN_LABEL: "watchActionCoinLabel",
    WATCH_ACTION_FAVORITE_LABEL: "watchActionFavoriteLabel",
    WATCH_ACTION_SHARE_LABEL: "watchActionShareLabel",
    WATCH_ACTION_COPY_LINK_LABEL: "watchActionCopyLinkLabel",
    WATCH_LATER_REMOVE_LABEL: "watchLaterRemoveLabel",
    COMMENT_RESIZE_LABEL: "commentResizeLabel",
    COMMENT_RETRY_MESSAGE: "commentRetryMessage",
    COMMENT_RELOAD_LABEL: "commentReloadLabel",
    VIEW_COUNT: "viewCount",
    FINISHED_PROGRESS: "finishedProgress",
    WATCHED_PROGRESS: "watchedProgress"
  });

  const I18N_MESSAGE_DIRECTORIES = Object.freeze({
    [UiLanguage.ENGLISH]: "en",
    [UiLanguage.SIMPLIFIED_CHINESE]: "zh_CN",
    [UiLanguage.TRADITIONAL_CHINESE]: "zh_TW"
  });

  const I18N_NUMBER_LOCALES = Object.freeze({
    [UiLanguage.ENGLISH]: "en",
    [UiLanguage.SIMPLIFIED_CHINESE]: "zh-CN",
    [UiLanguage.TRADITIONAL_CHINESE]: "zh-TW"
  });

  const I18N_CATALOGS = new Map();
  const I18N_LOADS = new Map();
  let i18nConfig = Object.freeze({
    sourceLabelMessageNames: Object.freeze({}),
    watchActionLabelMessageNames: Object.freeze({}),
    shareActionKind: ""
  });

  /**
   * DOM helper used by language fallback probes before the main runtime.
   */
  class LanguageDomProbe {
    /**
     * Queries all elements matching a selector and returns only Elements.
     *
     * @param {ParentNode} root
     * @param {string} selector
     * @returns {Element[]}
     */
    static queryAll(root, selector) {
      return Array.from(root.querySelectorAll(selector));
    }

    /**
     * Returns true when an element is inside an extension-owned surface.
     *
     * @param {Element} element
     * @returns {boolean}
     */
    static isOwned(element) {
      return Boolean(element.closest(I18N_OWNED_SURFACE_SELECTOR));
    }

    /**
     * Produces normalized single-line text for language heuristics.
     *
     * @param {Node | null | undefined} node
     * @returns {string}
     */
    static compactText(node) {
      return (node?.textContent ?? "").replace(/\s+/g, " ").trim();
    }

    /**
     * De-duplicates elements while preserving discovery order.
     *
     * @param {Element[]} elements
     * @returns {Element[]}
     */
    static unique(elements) {
      const seen = new Set();
      const unique = [];

      for (const element of elements) {
        if (seen.has(element)) {
          continue;
        }

        seen.add(element);
        unique.push(element);
      }

      return unique;
    }
  }

  /**
   * Provides localized text from extension i18n message catalogs.
   */
  class UiStrings {
    /**
     * Configures labels that depend on runtime-owned closed kind constants.
     *
     * @param {I18nRuntimeConfig} config
     */
    static configure(config) {
      i18nConfig = Object.freeze({
        sourceLabelMessageNames: Object.freeze({
          ...(config.sourceLabelMessageNames ?? {})
        }),
        watchActionLabelMessageNames: Object.freeze({
          ...(config.watchActionLabelMessageNames ?? {})
        }),
        shareActionKind: config.shareActionKind ?? ""
      });
    }

    /**
     * Returns a supported UI language or the default language.
     *
     * @param {string | null | undefined} language
     * @returns {string}
     */
    static normalizeLanguage(language) {
      return I18N_MESSAGE_DIRECTORIES[language] ? language : DEFAULT_UI_LANGUAGE;
    }

    /**
     * Loads all packaged message catalogs used by the content script.
     *
     * @returns {Promise<void>}
     */
    static async loadSupported() {
      await Promise.all(
        Object.values(UiLanguage).map((language) => UiStrings.load(language))
      );
    }

    /**
     * Loads one packaged message catalog.
     *
     * @param {string | null | undefined} language
     * @returns {Promise<void>}
     */
    static load(language) {
      const normalizedLanguage = UiStrings.normalizeLanguage(language);

      if (I18N_CATALOGS.has(normalizedLanguage)) {
        return Promise.resolve();
      }

      if (I18N_LOADS.has(normalizedLanguage)) {
        return I18N_LOADS.get(normalizedLanguage);
      }

      const load = fetch(UiStrings.catalogUrl(normalizedLanguage))
        .then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          return response.json();
        })
        .then((catalog) => {
          I18N_CATALOGS.set(normalizedLanguage, catalog);
        })
        .catch(() => {
          I18N_CATALOGS.set(normalizedLanguage, null);
        })
        .finally(() => {
          I18N_LOADS.delete(normalizedLanguage);
        });

      I18N_LOADS.set(normalizedLanguage, load);
      return load;
    }

    /**
     * Returns the localized label for a closed source kind.
     *
     * @param {string} kind
     * @param {string} language
     * @returns {string}
     */
    static sourceLabel(kind, language) {
      const messageName = i18nConfig.sourceLabelMessageNames[kind];

      return messageName ? UiStrings.message(messageName, language) : kind;
    }

    /**
     * Returns the localized label for a closed watch action kind.
     *
     * @param {string} kind
     * @param {string} language
     * @returns {string}
     */
    static watchActionLabel(kind, language) {
      const messageName = i18nConfig.watchActionLabelMessageNames[kind];

      return messageName ? UiStrings.message(messageName, language) : kind;
    }

    /**
     * Returns the accessible label for one mirrored watch action button.
     *
     * @param {string} kind
     * @param {string | null} countText
     * @param {string} language
     * @returns {string}
     */
    static watchActionButtonLabel(kind, countText, language) {
      const label =
        kind === i18nConfig.shareActionKind
          ? UiStrings.message(UiMessage.WATCH_ACTION_COPY_LINK_LABEL, language)
          : UiStrings.watchActionLabel(kind, language);

      if (!countText) {
        return label;
      }

      return UiStrings.message(
        UiMessage.WATCH_ACTION_COUNT_LABEL,
        language,
        [label, countText]
      );
    }

    /**
     * Returns the accessible label for removing one watch-later card.
     *
     * @param {string} language
     * @returns {string}
     */
    static watchLaterRemoveLabel(language) {
      return UiStrings.message(UiMessage.WATCH_LATER_REMOVE_LABEL, language);
    }

    /**
     * Formats a Bilibili account view count in the current UI language.
     *
     * @param {string} count
     * @param {string} language
     * @returns {string}
     */
    static viewCount(count, language) {
      return UiStrings.message(UiMessage.VIEW_COUNT, language, [count]);
    }

    /**
     * Formats a completed account progress label in the current UI language.
     *
     * @param {string} language
     * @returns {string}
     */
    static finishedProgress(language) {
      return UiStrings.message(UiMessage.FINISHED_PROGRESS, language);
    }

    /**
     * Formats a partial account progress label in the current UI language.
     *
     * @param {string} duration
     * @param {string} language
     * @returns {string}
     */
    static watchedProgress(duration, language) {
      return UiStrings.message(UiMessage.WATCHED_PROGRESS, language, [duration]);
    }

    /**
     * Returns the Intl locale used for compact numeric account labels.
     *
     * @param {string} language
     * @returns {string}
     */
    static numberLocale(language) {
      return I18N_NUMBER_LOCALES[UiStrings.normalizeLanguage(language)];
    }

    /**
     * Returns one localized message with optional substitutions.
     *
     * @param {string} name
     * @param {string} language
     * @param {string[]} [substitutions]
     * @returns {string}
     */
    static message(name, language, substitutions = []) {
      return (
        UiStrings.catalogMessage(name, language, substitutions) ||
        name
      );
    }

    /**
     * Reads and interpolates one message from a loaded catalog.
     *
     * @param {string} name
     * @param {string} language
     * @param {string[]} substitutions
     * @returns {string}
     */
    static catalogMessage(name, language, substitutions) {
      const catalog = I18N_CATALOGS.get(UiStrings.normalizeLanguage(language));
      const record = catalog?.[name];

      if (!record || typeof record.message !== "string") {
        return "";
      }

      return UiStrings.interpolate(record, substitutions);
    }

    /**
     * Applies Chrome i18n-style placeholder substitutions to a catalog record.
     *
     * @param {I18nMessageRecord} record
     * @param {string[]} substitutions
     * @returns {string}
     */
    static interpolate(record, substitutions) {
      let message = record.message;
      const placeholders = record.placeholders ?? {};

      for (const [name, placeholder] of Object.entries(placeholders)) {
        const value = UiStrings.placeholderValue(placeholder, substitutions);
        const pattern = new RegExp(`\\$${UiStrings.escapeRegExp(name)}\\$`, "gi");
        message = message.replace(pattern, value);
      }

      substitutions.forEach((value, index) => {
        message = message.replace(new RegExp(`\\$${index + 1}`, "g"), value);
      });

      return message.replace(/\$\$/g, "$");
    }

    /**
     * Resolves one catalog placeholder content value.
     *
     * @param {{ content?: string }} placeholder
     * @param {string[]} substitutions
     * @returns {string}
     */
    static placeholderValue(placeholder, substitutions) {
      const content = placeholder.content ?? "";
      const match = content.match(/^\$(\d+)$/u);

      if (!match) {
        return content;
      }

      return substitutions[Number(match[1]) - 1] ?? "";
    }

    /**
     * Returns the packaged URL for one locale messages file.
     *
     * @param {string} language
     * @returns {string}
     */
    static catalogUrl(language) {
      const directory = I18N_MESSAGE_DIRECTORIES[language];
      const path = `_locales/${directory}/messages.json`;
      const runtime = UiStrings.extensionRuntime();

      return runtime?.getURL ? runtime.getURL(path) : path;
    }

    /**
     * Returns the extension runtime namespace when the browser exposes one.
     *
     * @returns {{ getURL?: (path: string) => string } | null}
     */
    static extensionRuntime() {
      if (typeof chrome !== "undefined" && chrome.runtime) {
        return chrome.runtime;
      }

      if (typeof browser !== "undefined" && browser.runtime) {
        return browser.runtime;
      }

      return null;
    }

    /**
     * Returns the extension i18n namespace when the browser exposes one.
     *
     * @returns {{ getMessage: (name: string, substitutions?: string | string[]) => string, getUILanguage?: () => string } | null}
     */
    static extensionI18n() {
      if (typeof chrome !== "undefined" && chrome.i18n?.getMessage) {
        return chrome.i18n;
      }

      if (typeof browser !== "undefined" && browser.i18n?.getMessage) {
        return browser.i18n;
      }

      return null;
    }

    /**
     * Escapes a string for literal use inside a regular expression.
     *
     * @param {string} value
     * @returns {string}
     */
    static escapeRegExp(value) {
      return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
  }

  /**
   * Resolves extension UI language from Bilibili page language state.
   */
  class LanguageResolver {
    /**
     * Returns the current UI language for extension-owned controls.
     *
     * @param {Document} document
     * @returns {string}
     */
    static resolve(document) {
      return (
        LanguageResolver.documentLanguage(document) ??
        LanguageResolver.storedLanguage("localStorage") ??
        LanguageResolver.storedLanguage("sessionStorage") ??
        LanguageResolver.cookieLanguage(document.cookie) ??
        LanguageResolver.pageChromeLanguage(document) ??
        LanguageResolver.extensionLanguage() ??
        LanguageResolver.browserLanguage() ??
        DEFAULT_UI_LANGUAGE
      );
    }

    /**
     * Reads language tokens exposed by the Bilibili document.
     *
     * @param {Document} document
     * @returns {string | null}
     */
    static documentLanguage(document) {
      const roots = [document.documentElement, document.body].filter(Boolean);

      for (const root of roots) {
        const language = LanguageResolver.languageToken(
          [
            root.getAttribute("lang"),
            root.getAttribute("xml:lang"),
            root.getAttribute("data-locale"),
            root.getAttribute("data-language"),
            root.getAttribute("data-lang"),
            root.getAttribute("data-i18n-locale")
          ]
            .filter(Boolean)
            .join(" ")
        );

        if (language) {
          return language;
        }
      }

      const meta = document.querySelector(
        "meta[http-equiv='content-language'], meta[name='language'], meta[name='locale'], meta[property='og:locale']"
      );

      if (
        typeof HTMLMetaElement !== "undefined" &&
        meta instanceof HTMLMetaElement
      ) {
        return LanguageResolver.languageToken(meta.content);
      }

      return null;
    }

    /**
     * Reads locale-like values from web storage.
     *
     * Note: Bilibili has used different frontend stacks over time, so language
     * preference keys are treated as probes instead of a single contract.
     *
     * @param {"localStorage" | "sessionStorage"} storageName
     * @returns {string | null}
     */
    static storedLanguage(storageName) {
      try {
        const storage = window[storageName];

        for (let index = 0; index < storage.length; index += 1) {
          const key = storage.key(index) ?? "";

          if (!/(?:locale|lang|language|i18n)/i.test(key)) {
            continue;
          }

          const language = LanguageResolver.languageToken(storage.getItem(key));

          if (language) {
            return language;
          }
        }
      } catch (_error) {
        return null;
      }

      return null;
    }

    /**
     * Reads locale-like values from Bilibili cookies.
     *
     * @param {string} cookieText
     * @returns {string | null}
     */
    static cookieLanguage(cookieText) {
      for (const cookie of cookieText.split(";")) {
        const separator = cookie.indexOf("=");
        const name = separator === -1 ? cookie : cookie.slice(0, separator);

        if (!/(?:locale|lang|language|i18n)/i.test(name)) {
          continue;
        }

        const value = separator === -1 ? "" : cookie.slice(separator + 1);
        const language = LanguageResolver.languageToken(
          LanguageResolver.decodeCookieValue(value)
        );

        if (language) {
          return language;
        }
      }

      return null;
    }

    /**
     * Infers language from stable Bilibili navigation and sidebar chrome.
     *
     * Note: This is a fallback for pages that render localized UI text without
     * updating the document language attribute.
     *
     * @param {Document} document
     * @returns {string | null}
     */
    static pageChromeLanguage(document) {
      const selectors = [
        "header",
        "nav",
        ".bili-header",
        ".international-header",
        ".mini-header",
        ".right-container",
        "#right-container",
        "aside"
      ];
      const text = LanguageDomProbe.unique(
        selectors.flatMap((selector) => LanguageDomProbe.queryAll(document, selector))
      )
        .filter((element) => !LanguageDomProbe.isOwned(element))
        .map((element) => LanguageDomProbe.compactText(element).slice(0, 600))
        .join(" ")
        .slice(0, 5000);

      if (!text) {
        return null;
      }

      if (/(?:繁體|傳統|稍後再看|歷史|推薦|觀看|評論|關閉|開啟)/u.test(text)) {
        return UiLanguage.TRADITIONAL_CHINESE;
      }

      if (/(?:简体|稍后再看|历史|推荐|观看|评论|关闭|开启)/u.test(text)) {
        return UiLanguage.SIMPLIFIED_CHINESE;
      }

      if (/\b(?:watch later|history|recommendations?|comments?|language|queue|collection)\b/i.test(text)) {
        return UiLanguage.ENGLISH;
      }

      return null;
    }

    /**
     * Returns the extension UI language when the i18n API exposes one.
     *
     * @returns {string | null}
     */
    static extensionLanguage() {
      const i18n = UiStrings.extensionI18n();

      if (typeof i18n?.getUILanguage !== "function") {
        return null;
      }

      return LanguageResolver.languageToken(i18n.getUILanguage());
    }

    /**
     * Returns the browser language only after Bilibili page signals are absent.
     *
     * @returns {string | null}
     */
    static browserLanguage() {
      const languages = navigator.languages?.length
        ? navigator.languages
        : [navigator.language];

      for (const language of languages) {
        const resolved = LanguageResolver.languageToken(language);

        if (resolved) {
          return resolved;
        }
      }

      return null;
    }

    /**
     * Maps a locale token to a supported UI language.
     *
     * @param {string | null | undefined} value
     * @returns {string | null}
     */
    static languageToken(value) {
      const text = (value ?? "").trim().toLowerCase().replace(/_/g, "-");

      if (!text) {
        return null;
      }

      if (/(?:zh-hant|zh-tw|zh-hk|zh-mo|繁體|繁体|traditional)/u.test(text)) {
        return UiLanguage.TRADITIONAL_CHINESE;
      }

      if (/(?:zh-hans|zh-cn|zh-sg|\bzh\b|简体|簡體|中文|chinese)/u.test(text)) {
        return UiLanguage.SIMPLIFIED_CHINESE;
      }

      if (/(?:^|[^a-z])en(?:-[a-z]+)?(?:$|[^a-z])|english/u.test(text)) {
        return UiLanguage.ENGLISH;
      }

      return null;
    }

    /**
     * Decodes a cookie value without letting malformed values break discovery.
     *
     * @param {string} value
     * @returns {string}
     */
    static decodeCookieValue(value) {
      try {
        return decodeURIComponent(value);
      } catch (_error) {
        return value;
      }
    }
  }

  /**
   * @typedef {object} I18nRuntimeConfig
   * @property {Record<string, string>} [sourceLabelMessageNames]
   * Message names keyed by closed source kind.
   * @property {Record<string, string>} [watchActionLabelMessageNames]
   * Message names keyed by closed watch action kind.
   * @property {string} [shareActionKind] Closed watch action kind for share.
   */

  /**
   * @typedef {object} I18nMessageRecord
   * @property {string} message Localized message text.
   * @property {Record<string, { content?: string }>} [placeholders]
   */

  /**
   * Stable i18n helpers loaded before the main content-script runtime.
   *
   * The main runtime treats this namespace as required startup state so a
   * manifest ordering error fails visibly during development.
   */
  window.__bibililiI18n = Object.freeze({
    DEFAULT_UI_LANGUAGE,
    LanguageResolver,
    UiLanguage,
    UiMessage,
    UiStrings
  });
})();
