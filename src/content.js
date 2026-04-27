(() => {
  "use strict";

  const OWNED_ROOT_ID = "bibilili-layout-root";
  const FLOATING_TOGGLE_ROOT_ID = "bibilili-toggle-root";
  const LIST_RAIL_ID = "bibilili-list-rail";
  const SOURCE_ROOT_ATTR = "data-bibilili-source-kind";
  const HTML_MOUNTED_CLASS = "bibilili-mounted";
  const ENABLED_STORAGE_KEY = "bibilili:enabled";
  const LOGO_ASSET_PATH = "assets/bibilili-logo-white.svg";
  const VIDEO_POD_SELECTOR = ".video-pod";
  const BROWSER_DARK_SCHEME_QUERY = "(prefers-color-scheme: dark)";
  const RECONCILE_DELAY_MS = 160;
  const PAGE_LAZY_PRIME_DELAY_MS = 650;
  const URL_POLL_INTERVAL_MS = 500;
  const MAX_ITEMS_PER_SOURCE = 80;
  const COLLECTION_CARD_LOG_SAMPLE_SIZE = 12;
  const ACCOUNT_HISTORY_PAGE_SIZE = 30;
  const MAX_CONCURRENT_VIDEO_PREVIEW_FETCHES = 4;
  const IDLE_RECONCILE_TIMEOUT_MS = 900;
  const URGENT_RECONCILE_DELAY_MS = 0;
  const LAZY_SETTLING_RECONCILE_DELAYS_MS = Object.freeze([
    400,
    1200,
    2600,
    5000
  ]);
  const LOG_PREFIX = "[bibilili]";
  const BILIBILI_WEB_ORIGIN = "https://www.bilibili.com";
  const HISTORY_SOURCE_URL =
    `https://api.bilibili.com/x/web-interface/history/cursor?type=archive&ps=${ACCOUNT_HISTORY_PAGE_SIZE}`;
  const WATCH_LATER_SOURCE_URL = "https://api.bilibili.com/x/v2/history/toview";
  const VIDEO_INFO_SOURCE_URL =
    "https://api.bilibili.com/x/web-interface/view";

  const PLAYER_SELECTORS = [
    "#bilibili-player",
    "#playerWrap",
    ".player-wrap",
    ".bpx-player-container",
    ".bpx-player-primary-area",
    "[class*='player-wrap']"
  ];

  const COMMENT_SELECTORS = [
    "#comment",
    "#commentapp",
    "#bili-comments",
    "bili-comments",
    ".comment",
    ".bili-comment",
    ".comment-container",
    ".reply-warp",
    ".reply-box",
    ".comment-m",
    "[class*='comment-container']",
    "[class*='reply-warp']"
  ];

  const COMMENT_PRIME_SELECTORS = [
    "#comment",
    "#commentapp",
    "#bili-comments",
    "bili-comments",
    ".comment"
  ];

  const WATCH_TITLE_SELECTORS = [
    "#viewbox_report h1",
    ".video-info-title",
    ".video-title",
    "h1.video-title",
    ".left-container h1",
    "h1[title]"
  ];

  const VIDEO_LINK_SELECTOR = "a[href]";

  const VIDEO_TARGET_DATA_SELECTOR = [
    "[data-bvid]",
    "[data-bv-id]",
    "[data-bv]",
    "[data-aid]",
    "[data-avid]",
    "[data-url]",
    "[data-href]",
    "[data-link]",
    "[data-arcurl]",
    "[data-key]"
  ].join(",");

  const VIDEO_POD_ITEM_CLASS_SELECTOR = [
    ".video-pod__item",
    "[class*='video-pod__item']",
    ".video-pod-item",
    "[class*='video-pod-item']",
    ".pod-item",
    "[class*='pod-item']",
    ".simple-base-item",
    "[class*='simple-base-item']",
    ".normal-base-item",
    "[class*='normal-base-item']",
    ".page-item",
    "[class*='page-item']",
    ".singlep-list-item-inner",
    ".multip-list-item"
  ].join(",");

  const VIDEO_POD_ITEM_SELECTOR = [
    VIDEO_POD_ITEM_CLASS_SELECTOR,
    "li"
  ].join(",");

  const CURRENT_SOURCE_ITEM_ATTR_SELECTOR = [
    "[aria-current='page']",
    "[aria-current='true']",
    "[aria-selected='true']",
    "[data-current='true']",
    "[data-active='true']",
    "[data-selected='true']"
  ].join(",");

  const VIDEO_URL_DATA_ATTRS = [
    "data-url",
    "data-href",
    "data-link",
    "data-arcurl"
  ];
  const BVID_DATA_ATTRS = ["data-bvid", "data-bv-id", "data-bv", "data-key"];
  const AID_DATA_ATTRS = ["data-aid", "data-avid"];
  const PAGE_DATA_ATTRS = ["data-page", "data-p", "data-part"];

  const LAZY_MUTATION_ATTRIBUTE_FILTER = Object.freeze([
    "class",
    "lang",
    "data-theme",
    "data-color-mode",
    "data-prefers-color-scheme",
    "data-dark",
    "data-locale",
    "data-language",
    "data-lang",
    "data-i18n-locale",
    "style",
    "href",
    "src",
    "srcset",
    "data-src",
    "data-original",
    "data-lazy-src",
    "data-lazyload-src",
    "data-cover",
    "data-url",
    "data-href",
    "data-link",
    "data-arcurl",
    "data-key",
    "data-bvid",
    "data-bv-id",
    "data-bv",
    "data-aid",
    "data-avid",
    "data-page",
    "data-p",
    "data-part",
    "title",
    "alt",
    "aria-label"
  ]);

  const TITLE_SELECTORS = [
    ".title-txt",
    ".title",
    ".info-title",
    ".video-title",
    ".bili-video-card__info--tit",
    ".bili-video-card__info--title",
    "[class*='title']",
    "[class*='Title']"
  ];

  const CARD_SELECTORS = [
    ".video-page-card-small",
    ".bili-video-card",
    ".video-card",
    ".card-box",
    ".video-episode-card",
    "[class*='video-card']",
    "[class*='VideoCard']",
    "[class*='card']",
    "[class*='item']",
    "li"
  ];

  const SOURCE_BOUNDARY_SELECTOR = [
    "#multi_page",
    "#reco_list",
    ".anthology-list",
    ".base-video-sections",
    ".player-auxiliary-playlist",
    ".player-auxiliary-playlist-list",
    ".playlist-container",
    ".video-queue",
    ".recommend-list",
    ".recommend-list-v1",
    ".recommend-video-card-list",
    VIDEO_POD_SELECTOR,
    ".video-sections",
    ".video-sections-content-list",
    ".watch-later-list",
    ".watchlater-list"
  ].join(",");

  const SIDEBAR_BOUNDARY_SELECTOR = [
    ".right-container",
    "#right-container",
    "aside",
    "[class*='right-container']",
    "[class*='sidebar']"
  ].join(",");

  const PAGE_LAZY_PRIME_TARGET_SELECTORS = Object.freeze([
    ...COMMENT_PRIME_SELECTORS,
    SOURCE_BOUNDARY_SELECTOR,
    SIDEBAR_BOUNDARY_SELECTOR
  ]);

  const METADATA_SELECTORS = {
    author: [
      ".up-name",
      ".author",
      ".name",
      "[class*='author']",
      "[class*='up-name']"
    ],
    viewCount: [
      ".play",
      ".view",
      ".views",
      "[class*='view']",
      "[class*='play']"
    ],
    duration: [
      ".duration",
      ".length",
      ".time",
      "[class*='duration']",
      "[class*='length']",
      "[class*='time']"
    ]
  };

  /**
   * Closed source kinds used by discovery, state, rendering, and DOM markers.
   */
  const SourceKind = Object.freeze({
    COLLECTION: "collection",
    WATCH_LATER: "watch_later",
    HISTORY: "history",
    RECOMMENDATIONS: "recommendations"
  });

  const SOURCE_ORDER = Object.freeze([
    SourceKind.COLLECTION,
    SourceKind.RECOMMENDATIONS,
    SourceKind.WATCH_LATER,
    SourceKind.HISTORY
  ]);

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
    VIEW_COUNT: "viewCount",
    FINISHED_PROGRESS: "finishedProgress",
    WATCHED_PROGRESS: "watchedProgress"
  });

  const SOURCE_LABEL_MESSAGE_NAMES = Object.freeze({
    [SourceKind.COLLECTION]: "sourceCollectionLabel",
    [SourceKind.WATCH_LATER]: "sourceWatchLaterLabel",
    [SourceKind.HISTORY]: "sourceHistoryLabel",
    [SourceKind.RECOMMENDATIONS]: "sourceRecommendationsLabel"
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

  /**
   * Closed theme modes applied to extension-owned surfaces.
   */
  const ThemeMode = Object.freeze({
    LIGHT: "light",
    DARK: "dark"
  });

  /**
   * Closed priorities for reconciliation requests.
   */
  const ReconcilePriority = Object.freeze({
    URGENT: "urgent",
    LAZY: "lazy"
  });

  /**
   * Emits concise diagnostics for activation and reconciliation.
   */
  class DiagnosticLog {
    /**
     * Writes an informational diagnostic.
     *
     * @param {string} message
     * @param {object} [details]
     */
    static info(message, details = {}) {
      console.info(LOG_PREFIX, message, details);
    }

    /**
     * Writes a diagnostic for a blocked transformed layout.
     *
     * @param {string} message
     * @param {object} [details]
     */
    static warn(message, details = {}) {
      console.warn(LOG_PREFIX, message, details);
    }
  }

  /**
   * Coalesces reconciliation requests into urgent and lazy execution lanes.
   */
  class ReconcileScheduler {
    /**
     * Creates a scheduler that invokes one reconciliation callback.
     *
     * @param {(resetSourceRoute: boolean) => void} onRun
     */
    constructor(onRun) {
      this.onRun = onRun;
      this.pending = false;
      this.pendingResetSourceRoute = false;
      this.urgentTimer = null;
      this.delayTimer = null;
      this.idleHandle = null;
    }

    /**
     * Requests a reconciliation pass.
     *
     * @param {boolean} [resetSourceRoute]
     * @param {string} [priority]
     */
    request(resetSourceRoute = false, priority = ReconcilePriority.LAZY) {
      this.pending = true;
      this.pendingResetSourceRoute =
        this.pendingResetSourceRoute || resetSourceRoute;

      if (priority === ReconcilePriority.URGENT) {
        this.scheduleUrgent();
        return;
      }

      this.scheduleLazy();
    }

    /**
     * Clears all queued reconciliation work.
     */
    cancel() {
      this.clearUrgentTimer();
      this.clearDelayTimer();
      this.clearIdleCallback();
      this.pending = false;
      this.pendingResetSourceRoute = false;
    }

    /**
     * Schedules an urgent pass after the current browser task.
     */
    scheduleUrgent() {
      this.clearDelayTimer();
      this.clearIdleCallback();

      if (this.urgentTimer !== null) {
        return;
      }

      this.urgentTimer = window.setTimeout(() => {
        this.urgentTimer = null;
        this.run();
      }, URGENT_RECONCILE_DELAY_MS);
    }

    /**
     * Schedules a lazy pass through debounce and idle time.
     */
    scheduleLazy() {
      if (
        this.urgentTimer !== null ||
        this.delayTimer !== null ||
        this.idleHandle !== null
      ) {
        return;
      }

      this.delayTimer = window.setTimeout(() => {
        this.delayTimer = null;
        this.scheduleIdle();
      }, RECONCILE_DELAY_MS);
    }

    /**
     * Schedules the pending lazy pass during idle time or a bounded timeout.
     */
    scheduleIdle() {
      if (!this.pending) {
        return;
      }

      if (typeof window.requestIdleCallback === "function") {
        this.idleHandle = window.requestIdleCallback(
          () => {
            this.idleHandle = null;
            this.run();
          },
          { timeout: IDLE_RECONCILE_TIMEOUT_MS }
        );
        return;
      }

      this.delayTimer = window.setTimeout(() => {
        this.delayTimer = null;
        this.run();
      }, RECONCILE_DELAY_MS);
    }

    /**
     * Runs the pending reconciliation callback.
     */
    run() {
      this.clearUrgentTimer();
      this.clearDelayTimer();
      this.clearIdleCallback();

      if (!this.pending) {
        return;
      }

      const resetSourceRoute = this.pendingResetSourceRoute;
      this.pending = false;
      this.pendingResetSourceRoute = false;
      this.onRun(resetSourceRoute);
    }

    /**
     * Clears the urgent timer.
     */
    clearUrgentTimer() {
      if (this.urgentTimer === null) {
        return;
      }

      window.clearTimeout(this.urgentTimer);
      this.urgentTimer = null;
    }

    /**
     * Clears the lazy debounce timer.
     */
    clearDelayTimer() {
      if (this.delayTimer === null) {
        return;
      }

      window.clearTimeout(this.delayTimer);
      this.delayTimer = null;
    }

    /**
     * Clears the idle callback.
     */
    clearIdleCallback() {
      if (this.idleHandle === null) {
        return;
      }

      if (typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(this.idleHandle);
      }
      this.idleHandle = null;
    }
  }

  /**
   * Static source adapter configuration.
   *
   * Note: Bilibili uses several markup families across old, new, and lazy
   * watch page surfaces. The selectors prefer stable container names first and
   * keep broad class-name probes as fallbacks.
   */
  const SOURCE_DEFINITIONS = Object.freeze([
    {
      kind: SourceKind.COLLECTION,
      selectors: [
        "#multi_page",
        // Note: Bilibili renders its visible ordered video list as a video-pod.
        VIDEO_POD_SELECTOR,
        ".player-auxiliary-playlist",
        ".player-auxiliary-playlist-list",
        ".player-auxiliary-playlist .playlist-container",
        ".video-queue",
        ".base-video-sections",
        ".video-sections",
        ".video-sections-content-list",
        ".anthology-list",
        "[class*='video-section']",
        "[class*='anthology']"
      ],
      pattern:
        /(?:\u5408\u96c6|\u5206\u96c6|\u89c6\u9891\u9009\u96c6|\u961f\u5217|collection|section|anthology|queue|playlist)/i
    },
    {
      kind: SourceKind.WATCH_LATER,
      selectors: [
        ".watch-later-list",
        ".watchlater-list",
        "[class*='watch-later']",
        "[class*='watchlater']",
        "[class*='watch_later']"
      ],
      pattern: /(?:\u7a0d\u540e\u518d\u770b|watch\s*later)/i
    },
    {
      kind: SourceKind.RECOMMENDATIONS,
      selectors: [
        "#reco_list",
        ".recommend-list-v1",
        ".recommend-list",
        ".recommend-video-card-list",
        "[data-loc-id*='related']",
        "[class*='recommend']"
      ],
      pattern:
        /(?:\u63a8\u8350|\u76f8\u5173\u89c6\u9891|related|recommend)/i
    }
  ]);

  /**
   * Utility methods for querying page-owned DOM while avoiding extension-owned
   * surfaces.
   */
  class DomProbe {
    /**
     * Returns true when the node is an Element.
     *
     * @param {Node | null | undefined} node
     * @returns {node is Element}
     */
    static isElement(node) {
      return node instanceof Element;
    }

    /**
     * Returns true when an element is inside the extension-owned layout root.
     *
     * @param {Element | Node | null | undefined} node
     * @returns {boolean}
     */
    static isOwned(node) {
      if (!DomProbe.isElement(node)) {
        return false;
      }

      return Boolean(node.closest(`#${OWNED_ROOT_ID}, #${FLOATING_TOGGLE_ROOT_ID}`));
    }

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
     * Produces normalized single-line text for labels and heuristics.
     *
     * @param {Node | null | undefined} node
     * @returns {string}
     */
    static compactText(node) {
      return (node?.textContent ?? "").replace(/\s+/g, " ").trim();
    }

    /**
     * Tests whether an element has usable rendered geometry.
     *
     * @param {Element} element
     * @returns {boolean}
     */
    static hasBox(element) {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
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

    /**
     * Finds the closest candidate matching any selector in the selector list.
     *
     * @param {Element} element
     * @param {string[]} selectors
     * @returns {Element}
     */
    static closestBySelectors(element, selectors) {
      for (const selector of selectors) {
        const closest = element.closest(selector);
        if (closest) {
          return closest;
        }
      }

      return element;
    }
  }

  /**
   * Provides localized text from extension i18n message catalogs.
   */
  class UiStrings {
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

      if (typeof fetch !== "function") {
        I18N_CATALOGS.set(normalizedLanguage, null);
        return Promise.resolve();
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
        .catch((error) => {
          I18N_CATALOGS.set(normalizedLanguage, null);
          DiagnosticLog.info("i18n catalog unavailable", {
            language: normalizedLanguage,
            message: error?.message ?? String(error)
          });
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
      const messageName = SOURCE_LABEL_MESSAGE_NAMES[kind];

      return messageName ? UiStrings.message(messageName, language) : kind;
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

      if (meta instanceof HTMLMetaElement) {
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
      const text = DomProbe.unique(
        selectors.flatMap((selector) => DomProbe.queryAll(document, selector))
      )
        .filter((element) => !DomProbe.isOwned(element))
        .map((element) => DomProbe.compactText(element).slice(0, 600))
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
        document.querySelector(".bili-feed4-layout, .bili-layout, .left-container, .right-container")
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

      if (/\b(?:bili-)?dark(?:-mode)?\b/.test(values) || /\btheme-dark\b/.test(values)) {
        return ThemeMode.DARK;
      }

      if (/\blight(?:-mode)?\b/.test(values) || /\btheme-light\b/.test(values)) {
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
        .match(/^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)(?:\s*,\s*(\d+(?:\.\d+)?))?\s*\)$/i);

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
      const [red, green, blue] = [color.red, color.green, color.blue].map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.03928
          ? normalized / 12.92
          : ((normalized + 0.055) / 1.055) ** 2.4;
      });

      return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    }
  }

  /**
   * Stores the global activation preference for Bilibili pages.
   */
  class ActivationPreference {
    /**
     * Returns true when the transformed layout should start enabled.
     *
     * @returns {boolean}
     */
    static readEnabled() {
      try {
        return window.localStorage.getItem(ENABLED_STORAGE_KEY) !== "off";
      } catch (_error) {
        return true;
      }
    }

    /**
     * Persists the transformed layout activation state.
     *
     * @param {boolean} enabled
     */
    static writeEnabled(enabled) {
      try {
        window.localStorage.setItem(ENABLED_STORAGE_KEY, enabled ? "on" : "off");
      } catch (_error) {
        return;
      }
    }
  }

  /**
   * Owns the global button that enables and disables the transformed layout.
   */
  class ActivationControl {
    /**
     * Creates the activation control.
     *
     * @param {Document} document
     * @param {(enabled: boolean) => void} onToggle
     */
    constructor(document, onToggle) {
      this.document = document;
      this.onToggle = onToggle;
      this.button = null;
      this.floatingRoot = null;
      this.language = DEFAULT_UI_LANGUAGE;
    }

    /**
     * Places the activation button as a floating page control.
     *
     * @param {string} theme
     * @param {string} language
     */
    mountFloating(theme, language) {
      this.setLanguage(language);
      this.ensureFloatingRoot(theme);
      this.setEnabled(false);
      const button = this.ensureButton();

      if (button.parentElement !== this.floatingRoot) {
        this.floatingRoot.replaceChildren(button);
      }
    }

    /**
     * Places the activation button as the leftmost bottom dock control.
     *
     * @param {Element} container
     * @param {boolean} enabled
     * @param {string} language
     * @returns {HTMLButtonElement}
     */
    mountDocked(container, enabled, language) {
      this.setLanguage(language);
      const button = this.ensureButton();
      this.setEnabled(enabled);

      if (button.parentElement !== container || container.firstElementChild !== button) {
        container.insertBefore(button, container.firstChild);
      }

      if (this.floatingRoot?.isConnected) {
        this.floatingRoot.remove();
      }

      return button;
    }

    /**
     * Updates the language used by activation-control labels.
     *
     * @param {string} language
     */
    setLanguage(language) {
      this.language = UiStrings.normalizeLanguage(language);
    }

    /**
     * Removes all activation-control DOM.
     */
    destroy() {
      this.button?.remove();
      this.floatingRoot?.remove();
      this.button = null;
      this.floatingRoot = null;
    }

    /**
     * Ensures the floating host exists and has current theme state.
     *
     * @param {string} theme
     */
    ensureFloatingRoot(theme) {
      if (!this.floatingRoot?.isConnected) {
        const existing = this.document.getElementById(FLOATING_TOGGLE_ROOT_ID);
        if (existing) {
          existing.remove();
        }

        this.floatingRoot = this.document.createElement("div");
        this.floatingRoot.id = FLOATING_TOGGLE_ROOT_ID;
        this.document.body.append(this.floatingRoot);
      }

      this.floatingRoot.dataset.bibililiTheme = theme;
    }

    /**
     * Ensures the activation button exists.
     *
     * @returns {HTMLButtonElement}
     */
    ensureButton() {
      if (this.button) {
        return this.button;
      }

      this.button = this.document.createElement("button");
      this.button.type = "button";
      this.button.className = "bibilili-toggle-button";
      this.button.append(ActivationControl.logoMark(this.document));
      this.button.addEventListener("click", () => {
        const nextEnabled = this.button.getAttribute("aria-pressed") !== "true";
        this.onToggle(nextEnabled);
      });

      return this.button;
    }

    /**
     * Creates the extension logo image used by the activation button.
     *
     * @param {Document} document
     * @returns {HTMLImageElement}
     */
    static logoMark(document) {
      const logo = document.createElement("img");
      logo.className = "bibilili-logo";
      logo.src = ActivationControl.logoAssetUrl();
      logo.decoding = "async";
      logo.draggable = false;
      logo.alt = "";
      logo.setAttribute("aria-hidden", "true");
      return logo;
    }

    /**
     * Returns the browser URL for the packaged logo asset.
     *
     * @returns {string}
     */
    static logoAssetUrl() {
      const runtime = UiStrings.extensionRuntime();

      if (runtime?.getURL) {
        return runtime.getURL(LOGO_ASSET_PATH);
      }

      return LOGO_ASSET_PATH;
    }

    /**
     * Updates button state, accessible name, and pressed state.
     *
     * @param {boolean} enabled
     */
    setEnabled(enabled) {
      const button = this.ensureButton();
      button.title = UiStrings.message(
        enabled ? UiMessage.TURN_OFF_LABEL : UiMessage.TURN_ON_LABEL,
        this.language
      );
      button.setAttribute("aria-label", button.title);
      button.setAttribute("aria-pressed", String(enabled));
    }
  }

  /**
   * Opens native page positions so Bilibili can hydrate lazy page regions.
   */
  class PageLazyPrimer {
    /**
     * Creates a primer for one document.
     *
     * @param {Document} document
     */
    constructor(document) {
      this.document = document;
      this.primedPageKeys = new Set();
      this.timer = null;
      this.restoreScrollPosition = null;
    }

    /**
     * Requests one native scroll pass for comments, sidebar lists, and previews.
     *
     * Note: Bilibili can gate comments, list metadata, and thumbnail attributes
     * behind native document scroll or page-owned IntersectionObservers.
     *
     * @param {string} pageKey
     * @param {() => void} afterPrime
     * @returns {boolean} true when a prime pass was scheduled
     */
    prime(pageKey, afterPrime) {
      if (this.primedPageKeys.has(pageKey)) {
        return false;
      }

      const startX = window.scrollX;
      const startY = window.scrollY;
      const target = this.targetElement();
      const maxY = Math.max(
        0,
        this.document.documentElement.scrollHeight - window.innerHeight
      );

      if (!this.scrollToPrimeTarget(target, startX, startY, maxY)) {
        return false;
      }

      this.primedPageKeys.add(pageKey);
      this.restoreScrollPosition = { left: startX, top: startY };
      window.clearTimeout(this.timer);
      this.timer = window.setTimeout(() => {
        this.timer = null;
        this.restoreNativeScroll();
        afterPrime();
      }, PAGE_LAZY_PRIME_DELAY_MS);

      return true;
    }

    /**
     * Clears pending native scroll restoration.
     *
     * @param {boolean} [restoreScroll]
     */
    stop(restoreScroll = true) {
      if (this.timer) {
        window.clearTimeout(this.timer);
        this.timer = null;
      }

      if (restoreScroll) {
        this.restoreNativeScroll();
      } else {
        this.restoreScrollPosition = null;
      }
    }

    /**
     * Moves the native document near a lazy target or a lower page position.
     *
     * @param {Element | null} target
     * @param {number} startX
     * @param {number} startY
     * @param {number} maxY
     * @returns {boolean}
     */
    scrollToPrimeTarget(target, startX, startY, maxY) {
      if (target && PageLazyPrimer.isBelowViewportCenter(target, startY)) {
        target.scrollIntoView({ block: "center", inline: "nearest" });
        return true;
      }

      return this.scrollToLowerPagePosition(startX, maxY);
    }

    /**
     * Moves the native document toward lower lazy regions when no target is low.
     *
     * @param {number} startX
     * @param {number} maxY
     * @returns {boolean}
     */
    scrollToLowerPagePosition(startX, maxY) {
      if (maxY <= 0) {
        return false;
      }

      window.scrollTo({
        left: startX,
        top: Math.min(maxY, Math.max(window.innerHeight, maxY * 0.6))
      });

      return true;
    }

    /**
     * Returns true when a target is far enough down to prime directly.
     *
     * @param {Element} target
     * @param {number} startY
     * @returns {boolean}
     */
    static isBelowViewportCenter(target, startY) {
      const targetTop = target.getBoundingClientRect().top + startY;

      return targetTop > startY + window.innerHeight * 0.5;
    }

    /**
     * Restores the native document scroll position captured before priming.
     */
    restoreNativeScroll() {
      if (!this.restoreScrollPosition) {
        return;
      }

      const { left, top } = this.restoreScrollPosition;
      this.restoreScrollPosition = null;
      window.scrollTo({ left, top });
    }

    /**
     * Finds the best native element to bring near the viewport.
     *
     * @returns {Element | null}
     */
    targetElement() {
      for (const selector of PAGE_LAZY_PRIME_TARGET_SELECTORS) {
        for (const element of DomProbe.queryAll(this.document, selector)) {
          if (this.isPrimeTarget(element)) {
            return element;
          }
        }
      }

      return null;
    }

    /**
     * Returns true when an element belongs to the native page surface.
     *
     * @param {Element} element
     * @returns {boolean}
     */
    isPrimeTarget(element) {
      return (
        element.isConnected &&
        element !== this.document.body &&
        element !== this.document.documentElement &&
        !DomProbe.isOwned(element)
      );
    }
  }

  /**
   * Extracts uniform video items from a page-owned source root.
   */
  class SourceAdapter {
    /**
     * Creates an adapter for one source root.
     *
     * @param {string} kind
     * @param {Element} root
     */
    constructor(kind, root) {
      this.kind = kind;
      this.root = root;
    }

    /**
     * Extracts valid video items from the source root.
     *
     * @returns {VideoItem[]}
     */
    extractItems() {
      const items = [];
      const seen = new Set();
      const itemLimit =
        this.kind === SourceKind.COLLECTION
          ? Number.POSITIVE_INFINITY
          : MAX_ITEMS_PER_SOURCE;

      const targets = this.videoTargets();

      for (let index = 0; index < targets.length; index += 1) {
        const item = this.itemFromTarget(targets[index], index);

        if (!item) {
          continue;
        }

        const key = SourceAdapter.itemKey(item);
        if (seen.has(key)) {
          continue;
        }

        seen.add(key);
        items.push(item);

        if (items.length >= itemLimit) {
          break;
        }
      }

      return items;
    }

    /**
     * Finds video target elements that belong to the page-owned source root.
     *
     * @returns {Element[]}
     */
    videoTargets() {
      return SourceAdapter.videoTargetsIn(this.root);
    }

    /**
     * Finds video target elements below an arbitrary page-owned source root.
     *
     * @param {Element} root
     * @returns {Element[]}
     */
    static videoTargetsIn(root) {
      const targets = [
        ...SourceAdapter.anchorTargetsIn(root),
        ...SourceAdapter.dataTargetsIn(root),
        ...SourceAdapter.videoPodItemTargetsIn(root)
      ];

      return DomProbe.unique(targets)
        .filter((target) => !DomProbe.isOwned(target))
        .filter((target, index) =>
          Boolean(SourceAdapter.targetUrlFor(target, index))
        );
    }

    /**
     * Finds playable anchor targets under a source root.
     *
     * @param {Element} root
     * @returns {Element[]}
     */
    static anchorTargetsIn(root) {
      return DomProbe.queryAll(root, VIDEO_LINK_SELECTOR)
        .filter((element) => element instanceof HTMLAnchorElement)
        .filter((anchor) => Boolean(SourceAdapter.normalizedUrl(anchor)));
    }

    /**
     * Finds row or card targets that expose a Bilibili URL or video id in data.
     *
     * Note: Bilibili video-pod rows commonly store the BV id in `data-key`.
     *
     * @param {Element} root
     * @returns {Element[]}
     */
    static dataTargetsIn(root) {
      return DomProbe.queryAll(root, VIDEO_TARGET_DATA_SELECTOR)
        .filter((element) => !SourceAdapter.hasPlayableAnchorAncestor(element))
        .filter((element) => Boolean(SourceAdapter.targetUrlFor(element)));
    }

    /**
     * Finds click-only rows in Bilibili's video-pod surface.
     *
     * Note: Some video-pod rows are page-owned click targets without stable
     * anchors. The adapter treats them as collection entries and derives a
     * route when no explicit URL or video id is present.
     *
     * @param {Element} root
     * @returns {Element[]}
     */
    static videoPodItemTargetsIn(root) {
      if (!root.matches(VIDEO_POD_SELECTOR)) {
        return [];
      }

      return DomProbe.queryAll(root, VIDEO_POD_ITEM_SELECTOR)
        .filter((element) => !SourceAdapter.hasPlayableAnchorAncestor(element))
        .filter((element) => !element.closest(VIDEO_TARGET_DATA_SELECTOR))
        .filter((element) => SourceAdapter.isVideoPodItemElement(element))
        .filter((element) => !SourceAdapter.hasNestedVideoPodItem(element))
        .filter((element) => Boolean(DomProbe.compactText(element)));
    }

    /**
     * Tests whether an element has the shape of one video-pod row.
     *
     * @param {Element} element
     * @returns {boolean}
     */
    static isVideoPodItemElement(element) {
      return (
        element.matches(VIDEO_POD_ITEM_SELECTOR) &&
        Boolean(
          element.matches(VIDEO_POD_ITEM_CLASS_SELECTOR) ||
            SourceAdapter.textsFromSelectors(element, TITLE_SELECTORS).length > 0 ||
            SourceAdapter.durationToken(DomProbe.compactText(element))
        )
      );
    }

    /**
     * Returns true when a candidate contains more specific pod item rows.
     *
     * @param {Element} element
     * @returns {boolean}
     */
    static hasNestedVideoPodItem(element) {
      return DomProbe.queryAll(element, VIDEO_POD_ITEM_SELECTOR).some(
        (child) =>
          child !== element && SourceAdapter.isVideoPodItemElement(child)
      );
    }

    /**
     * Converts one target element and its closest card-like ancestor to a video
     * item.
     *
     * @param {Element} target
     * @param {number} index
     * @returns {VideoItem | null}
     */
    itemFromTarget(target, index) {
      const targetUrl = SourceAdapter.targetUrlFor(target, index);
      if (!targetUrl) {
        return null;
      }

      if (
        this.kind === SourceKind.RECOMMENDATIONS &&
        SourceAdapter.isCurrentWatchUrl(targetUrl)
      ) {
        return null;
      }

      const card = SourceAdapter.cardForTarget(target);
      const title = SourceAdapter.titleFor(target, card);

      if (!title) {
        return null;
      }

      return {
        targetUrl,
        title,
        thumbnailUrl: SourceAdapter.thumbnailFor(target, card),
        sourceKind: this.kind,
        isCurrent:
          this.kind === SourceKind.COLLECTION &&
          SourceAdapter.isCurrentSourceTarget(target, card),
        duration: SourceAdapter.durationFor(card),
        author: SourceAdapter.metadataFor(card, "author"),
        viewCount: SourceAdapter.metadataFor(card, "viewCount"),
        progress: SourceAdapter.progressFor(card)
      };
    }

    /**
     * Finds the nearest card-like element for a source target.
     *
     * @param {Element} target
     * @returns {Element}
     */
    static cardForTarget(target) {
      for (const selector of CARD_SELECTORS) {
        const card = target.closest(selector);
        if (card && !DomProbe.isOwned(card)) {
          return card;
        }
      }

      return target;
    }

    /**
     * Returns the normalized URL for a source target.
     *
     * @param {Element} target
     * @param {number} [index]
     * @returns {string | null}
     */
    static targetUrlFor(target, index = 0) {
      for (const anchor of SourceAdapter.anchorsForTarget(target)) {
        const url = SourceAdapter.normalizedUrl(anchor);

        if (url) {
          return url;
        }
      }

      for (const value of SourceAdapter.dataValues(target, VIDEO_URL_DATA_ATTRS)) {
        const url = SourceAdapter.normalizedVideoUrl(value);

        if (url) {
          return url;
        }
      }

      const bvid = SourceAdapter.firstDataValue(target, BVID_DATA_ATTRS);
      if (bvid) {
        return SourceAdapter.videoUrl({ bvid, page: SourceAdapter.pageFor(target) });
      }

      const aid = SourceAdapter.firstDataValue(target, AID_DATA_ATTRS);
      if (aid) {
        return SourceAdapter.videoUrl({ aid, page: SourceAdapter.pageFor(target) });
      }

      return SourceAdapter.videoPodPageUrl(target, index);
    }

    /**
     * Returns candidate anchors from a target without requiring them to be
     * playable.
     *
     * @param {Element} target
     * @returns {HTMLAnchorElement[]}
     */
    static anchorsForTarget(target) {
      const anchors =
        target instanceof HTMLAnchorElement
          ? [target]
          : DomProbe.queryAll(target, VIDEO_LINK_SELECTOR);

      return anchors.filter((anchor) => anchor instanceof HTMLAnchorElement);
    }

    /**
     * Returns true when an element is inside a playable anchor target.
     *
     * @param {Element} element
     * @returns {boolean}
     */
    static hasPlayableAnchorAncestor(element) {
      const anchor = element.closest(VIDEO_LINK_SELECTOR);

      return (
        anchor instanceof HTMLAnchorElement &&
        Boolean(SourceAdapter.normalizedUrl(anchor))
      );
    }

    /**
     * Returns the normalized URL from a video anchor.
     *
     * @param {HTMLAnchorElement} anchor
     * @returns {string | null}
     */
    static normalizedUrl(anchor) {
      const rawHref = anchor.getAttribute("href") || anchor.href;

      return SourceAdapter.normalizedVideoUrl(rawHref);
    }

    /**
     * Returns the normalized playable URL from raw URL-like text.
     *
     * @param {string | null | undefined} rawHref
     * @returns {string | null}
     */
    static normalizedVideoUrl(rawHref) {
      if (!rawHref || rawHref.startsWith("javascript:")) {
        return null;
      }

      try {
        const url = new URL(rawHref, window.location.href);

        if (url.protocol !== "http:" && url.protocol !== "https:") {
          return null;
        }

        if (!SourceAdapter.isPlayableUrl(url)) {
          return null;
        }

        return url.href;
      } catch (_error) {
        return null;
      }
    }

    /**
     * Builds a canonical Bilibili archive URL.
     *
     * @param {{ bvid?: string, aid?: string, page?: number | null }} params
     * @returns {string | null}
     */
    static videoUrl(params) {
      const bvid = SourceAdapter.cleanBvid(params.bvid);
      const aid = SourceAdapter.cleanAid(params.aid);

      if (!bvid && !aid) {
        return null;
      }

      const path = bvid ? `/video/${bvid}` : `/video/av${aid}`;
      const url = new URL(path, BILIBILI_WEB_ORIGIN);

      if (params.page && params.page > 1) {
        url.searchParams.set("p", String(params.page));
      }

      return url.href;
    }

    /**
     * Builds a same-video page URL for click-only video-pod rows.
     *
     * @param {Element} target
     * @param {number} index
     * @returns {string | null}
     */
    static videoPodPageUrl(target, index) {
      if (!target.closest(VIDEO_POD_SELECTOR)) {
        return null;
      }

      const identity = SourceAdapter.playableIdentityForUrl(window.location.href);
      if (!identity?.startsWith("video:")) {
        return null;
      }

      const page = SourceAdapter.pageFor(target) ?? index + 1;
      const url = new URL(window.location.href);
      url.searchParams.set("p", String(page));

      return url.href;
    }

    /**
     * Reads candidate data attribute values from a target and its descendants.
     *
     * @param {Element} target
     * @param {string[]} attributes
     * @returns {string[]}
     */
    static dataValues(target, attributes) {
      const values = [];
      const holders = [
        target,
        ...DomProbe.queryAll(
          target,
          attributes.map((attribute) => `[${attribute}]`).join(",")
        )
      ];

      for (const holder of holders) {
        for (const attribute of attributes) {
          const value = holder.getAttribute(attribute);

          if (value) {
            values.push(value);
          }
        }
      }

      return values;
    }

    /**
     * Returns the first matching data attribute value.
     *
     * @param {Element} target
     * @param {string[]} attributes
     * @returns {string | null}
     */
    static firstDataValue(target, attributes) {
      return SourceAdapter.dataValues(target, attributes)[0] ?? null;
    }

    /**
     * Reads a one-based video page number from a target.
     *
     * @param {Element} target
     * @returns {number | null}
     */
    static pageFor(target) {
      for (const value of SourceAdapter.dataValues(target, PAGE_DATA_ATTRS)) {
        const page = Number.parseInt(value, 10);

        if (Number.isSafeInteger(page) && page > 0) {
          return page;
        }
      }

      return null;
    }

    /**
     * Normalizes Bilibili BV ids from data attributes.
     *
     * @param {string | null | undefined} value
     * @returns {string | null}
     */
    static cleanBvid(value) {
      const text = (value ?? "").trim();
      return /^BV[0-9A-Za-z]+$/u.test(text) ? text : null;
    }

    /**
     * Normalizes Bilibili numeric archive ids from data attributes.
     *
     * @param {string | null | undefined} value
     * @returns {string | null}
     */
    static cleanAid(value) {
      const text = (value ?? "").trim().replace(/^av/i, "");
      return /^\d+$/u.test(text) ? text : null;
    }

    /**
     * Returns true for Bilibili routes that open a playable watch target.
     *
     * Note: Bilibili sidebars can include account or profile links with
     * "video" in their path. Those links are navigation chrome, not video
     * items for the bottom dock.
     *
     * @param {URL} url
     * @returns {boolean}
     */
    static isPlayableUrl(url) {
      return (
        url.hostname === "www.bilibili.com" &&
        Boolean(SourceAdapter.playableIdentityForUrl(url))
      );
    }

    /**
     * Returns a stable identity for a playable Bilibili URL.
     *
     * @param {string | URL} value
     * @returns {string | null}
     */
    static playableIdentityForUrl(value) {
      try {
        const url =
          value instanceof URL ? value : new URL(value, window.location.href);

        if (url.hostname !== "www.bilibili.com") {
          return null;
        }

        const path = url.pathname.replace(/\/+$/u, "");
        const videoMatch = path.match(/^\/video\/(BV[0-9A-Za-z]+|av\d+)$/i);

        if (videoMatch) {
          const videoId = videoMatch[1];
          const normalizedId =
            /^av/i.test(videoId) ? videoId.toLowerCase() : videoId;

          return `video:${normalizedId}`;
        }

        const bangumiMatch = path.match(
          /^\/bangumi\/play\/((?:ep|ss|md)\d+)$/i
        );

        if (bangumiMatch) {
          return `bangumi:${bangumiMatch[1].toLowerCase()}`;
        }

        return null;
      } catch (_error) {
        return null;
      }
    }

    /**
     * Returns the Bilibili archive identity needed for video-info cover fetches.
     *
     * @param {string | URL} value
     * @returns {ArchiveVideoIdentity | null}
     */
    static archiveIdentityForUrl(value) {
      try {
        const url =
          value instanceof URL ? value : new URL(value, window.location.href);

        if (url.hostname !== "www.bilibili.com") {
          return null;
        }

        const path = url.pathname.replace(/\/+$/u, "");
        const match = path.match(/^\/video\/(BV[0-9A-Za-z]+|av\d+)$/i);

        if (!match) {
          return null;
        }

        const videoId = match[1];
        const bvid = SourceAdapter.cleanBvid(videoId);

        if (bvid) {
          return {
            key: `bvid:${bvid}`,
            queryName: "bvid",
            queryValue: bvid
          };
        }

        const aid = SourceAdapter.cleanAid(videoId);

        if (aid) {
          return {
            key: `aid:${aid}`,
            queryName: "aid",
            queryValue: aid
          };
        }

        return null;
      } catch (_error) {
        return null;
      }
    }

    /**
     * Returns true when a target points at the current watch route.
     *
     * Note: Bilibili can surface the current video inside recommendation
     * markup during lazy sidebar updates. Recommendations omit that duplicate.
     *
     * @param {string} targetUrl
     * @returns {boolean}
     */
    static isCurrentWatchUrl(targetUrl) {
      const currentIdentity = SourceAdapter.playableIdentityForUrl(
        window.location.href
      );
      const targetIdentity = SourceAdapter.playableIdentityForUrl(targetUrl);

      return Boolean(
        currentIdentity && targetIdentity && currentIdentity === targetIdentity
      );
    }

    /**
     * Returns true when Bilibili marks a source target as the active video row.
     *
     * Note: Bilibili collection rows can expose the current video through
     * active row state even when their extracted target URL does not normalize
     * to the browser's current watch route.
     *
     * @param {Element} target
     * @param {Element} card
     * @returns {boolean}
     */
    static isCurrentSourceTarget(target, card) {
      return (
        SourceAdapter.hasCurrentSourceMarker(target) ||
        SourceAdapter.hasCurrentSourceMarker(card)
      );
    }

    /**
     * Returns true when an element carries active/current source-row state.
     *
     * @param {Element} element
     * @returns {boolean}
     */
    static hasCurrentSourceMarker(element) {
      return (
        element.matches(CURRENT_SOURCE_ITEM_ATTR_SELECTOR) ||
        SourceAdapter.hasCurrentSourceClass(element)
      );
    }

    /**
     * Returns true when an element has a current-looking class token.
     *
     * @param {Element} element
     * @returns {boolean}
     */
    static hasCurrentSourceClass(element) {
      return Array.from(element.classList).some((className) =>
        /(?:^|[-_])(?:active|current|selected|playing|cur)(?:$|[-_])/iu.test(
          className
        )
      );
    }

    /**
     * Returns the current watch route key used to locate collection cards.
     *
     * @returns {string | null}
     */
    static currentWatchRouteKey() {
      return SourceAdapter.watchRouteKeyForUrl(window.location.href);
    }

    /**
     * Returns a watch route key that distinguishes archive pages within one BV.
     *
     * @param {string | URL} value
     * @returns {string | null}
     */
    static watchRouteKeyForUrl(value) {
      try {
        const url =
          value instanceof URL ? value : new URL(value, window.location.href);
        const identity = SourceAdapter.playableIdentityForUrl(url);

        if (!identity) {
          return null;
        }

        if (identity.startsWith("video:")) {
          return `${identity}:p${SourceAdapter.videoPageForUrl(url)}`;
        }

        return identity;
      } catch (_error) {
        return null;
      }
    }

    /**
     * Reads the one-based archive page number from a Bilibili watch URL.
     *
     * @param {URL} url
     * @returns {number}
     */
    static videoPageForUrl(url) {
      const page = Number.parseInt(url.searchParams.get("p") ?? "", 10);

      return Number.isSafeInteger(page) && page > 0 ? page : 1;
    }

    /**
     * Builds a de-duplication key for extracted page-owned video items.
     *
     * @param {VideoItem} item
     * @returns {string}
     */
    static itemKey(item) {
      const identity = SourceAdapter.playableIdentityForUrl(item.targetUrl);
      return `${identity ?? item.targetUrl}\n${item.title}`;
    }

    /**
     * Extracts a required video title.
     *
     * @param {Element} target
     * @param {Element} card
     * @returns {string | null}
     */
    static titleFor(target, card) {
      const candidates = [
        target.getAttribute("title"),
        target.getAttribute("aria-label"),
        ...SourceAdapter.textsFromSelectors(target, TITLE_SELECTORS),
        ...SourceAdapter.textsFromSelectors(card, TITLE_SELECTORS),
        SourceAdapter.imageAltFor(target),
        DomProbe.compactText(target)
      ];

      for (const candidate of candidates) {
        const title = SourceAdapter.cleanTitle(candidate);

        if (title) {
          return title;
        }
      }

      return null;
    }

    /**
     * Finds a thumbnail URL from images or CSS background images.
     *
     * @param {Element} target
     * @param {Element} card
     * @returns {string | null}
     */
    static thumbnailFor(target, card) {
      const image = card.querySelector("img") || target.querySelector("img");
      const imageUrl = image
        ? SourceAdapter.assetUrl(
            image.currentSrc ||
              image.getAttribute("src") ||
              image.getAttribute("data-src") ||
              image.getAttribute("data-original") ||
              image.getAttribute("data-lazy-src")
          )
        : null;

      if (imageUrl) {
        return imageUrl;
      }

      return SourceAdapter.backgroundImageUrl(card);
    }

    /**
     * Extracts a metadata field by known selector probes.
     *
     * @param {Element} card
     * @param {"author" | "viewCount"} field
     * @returns {string | null}
     */
    static metadataFor(card, field) {
      for (const text of SourceAdapter.textsFromSelectors(card, METADATA_SELECTORS[field])) {
        const clean = SourceAdapter.cleanMetadata(text);

        if (clean) {
          return clean;
        }
      }

      return null;
    }

    /**
     * Extracts the duration from explicit fields or a time-looking token.
     *
     * @param {Element} card
     * @returns {string | null}
     */
    static durationFor(card) {
      for (const text of SourceAdapter.textsFromSelectors(card, METADATA_SELECTORS.duration)) {
        const duration = SourceAdapter.durationToken(text);

        if (duration) {
          return duration;
        }
      }

      return SourceAdapter.durationToken(DomProbe.compactText(card));
    }

    /**
     * Extracts coarse playback progress when Bilibili exposes it in markup.
     *
     * @param {Element} card
     * @returns {string | null}
     */
    static progressFor(card) {
      const progress = card.querySelector(
        "[aria-valuenow], [class*='progress'], [class*='Progress']"
      );

      if (!progress) {
        return null;
      }

      const ariaValue = progress.getAttribute("aria-valuenow");
      if (ariaValue) {
        return `${ariaValue}%`;
      }

      const styleWidth = progress.getAttribute("style")?.match(/width:\s*([^;]+)/i)?.[1];
      return SourceAdapter.cleanMetadata(styleWidth ?? null);
    }

    /**
     * Collects non-empty text from a set of selector probes.
     *
     * @param {ParentNode} root
     * @param {string[]} selectors
     * @returns {string[]}
     */
    static textsFromSelectors(root, selectors) {
      const texts = [];

      for (const selector of selectors) {
        for (const element of DomProbe.queryAll(root, selector)) {
          const text = DomProbe.compactText(element);

          if (text) {
            texts.push(text);
          }
        }
      }

      return texts;
    }

    /**
     * Returns the first image alt text below a target element.
     *
     * @param {Element} target
     * @returns {string | null}
     */
    static imageAltFor(target) {
      const image = target.querySelector("img");
      return image?.getAttribute("alt") ?? null;
    }

    /**
     * Normalizes title text and rejects metadata-only strings.
     *
     * @param {string | null | undefined} value
     * @returns {string | null}
     */
    static cleanTitle(value) {
      const text = SourceAdapter.cleanMetadata(value);

      if (!text || text.length < 2 || SourceAdapter.durationToken(text) === text) {
        return null;
      }

      return text;
    }

    /**
     * Normalizes compact metadata text.
     *
     * @param {string | null | undefined} value
     * @returns {string | null}
     */
    static cleanMetadata(value) {
      const text = (value ?? "").replace(/\s+/g, " ").trim();
      return text || null;
    }

    /**
     * Extracts a duration-looking token from text.
     *
     * @param {string | null | undefined} value
     * @returns {string | null}
     */
    static durationToken(value) {
      return value?.match(/\b\d{1,2}:\d{2}(?::\d{2})?\b/)?.[0] ?? null;
    }

    /**
     * Normalizes image URLs from lazy attributes and protocol-relative values.
     *
     * @param {string | null | undefined} value
     * @returns {string | null}
     */
    static assetUrl(value) {
      const raw = value?.trim();

      if (!raw || raw.startsWith("data:")) {
        return null;
      }

      try {
        return new URL(raw, window.location.href).href;
      } catch (_error) {
        return null;
      }
    }

    /**
     * Normalizes an image URL and upgrades plain HTTP to HTTPS.
     *
     * @param {string | null | undefined} value
     * @returns {string | null}
     */
    static secureAssetUrl(value) {
      const assetUrl = SourceAdapter.assetUrl(value);

      if (!assetUrl) {
        return null;
      }

      try {
        const url = new URL(assetUrl);

        if (url.protocol === "http:") {
          url.protocol = "https:";
        }

        return url.href;
      } catch (_error) {
        return null;
      }
    }

    /**
     * Extracts a CSS background image URL when no image node is available.
     *
     * @param {Element} element
     * @returns {string | null}
     */
    static backgroundImageUrl(element) {
      const background = window.getComputedStyle(element).backgroundImage;
      const match = background.match(/url\(["']?(.+?)["']?\)/);

      if (!match) {
        return null;
      }

      return SourceAdapter.assetUrl(match[1]);
    }
  }

  /**
   * Converts Bilibili account-list API records into uniform video items.
   */
  class AccountSourceAdapter {
    /**
     * Converts one successful API payload into a video-list source.
     *
     * @param {string} kind
     * @param {object} payload
     * @param {string} language
     * @returns {VideoListSource | null}
     */
    static sourceFromPayload(kind, payload, language) {
      const items = AccountSourceAdapter.itemsFromEntries(
        kind,
        AccountSourceAdapter.entriesFromPayload(payload),
        language
      );

      if (items.length === 0) {
        return null;
      }

      return {
        kind,
        root: null,
        items
      };
    }

    /**
     * Returns the account-list array from a Bilibili response payload.
     *
     * @param {object} payload
     * @returns {object[]}
     */
    static entriesFromPayload(payload) {
      const list = payload?.data?.list;

      if (!Array.isArray(list)) {
        return [];
      }

      return list.filter((entry) => entry && typeof entry === "object");
    }

    /**
     * Extracts valid account list items while preserving Bilibili order.
     *
     * @param {string} kind
     * @param {object[]} entries
     * @param {string} language
     * @returns {VideoItem[]}
     */
    static itemsFromEntries(kind, entries, language) {
      const items = [];
      const seen = new Set();

      for (const entry of entries) {
        const item = AccountSourceAdapter.itemFromEntry(kind, entry, language);

        if (!item) {
          continue;
        }

        const key = `${item.targetUrl}\n${item.title}`;
        if (seen.has(key)) {
          continue;
        }

        seen.add(key);
        items.push(item);

        if (items.length >= MAX_ITEMS_PER_SOURCE) {
          break;
        }
      }

      return items;
    }

    /**
     * Converts one account list record into a video item.
     *
     * @param {string} kind
     * @param {object} entry
     * @param {string} language
     * @returns {VideoItem | null}
     */
    static itemFromEntry(kind, entry, language) {
      const targetUrl = AccountSourceAdapter.targetUrlFor(entry);
      const title = AccountSourceAdapter.titleFor(entry);

      if (!targetUrl || !title) {
        return null;
      }

      return {
        targetUrl,
        title,
        thumbnailUrl: AccountSourceAdapter.thumbnailFor(entry),
        sourceKind: kind,
        duration: AccountSourceAdapter.durationFor(entry),
        author: AccountSourceAdapter.authorFor(entry),
        viewCount: AccountSourceAdapter.viewCountFor(entry, language),
        progress: AccountSourceAdapter.progressFor(entry, language)
      };
    }

    /**
     * Resolves the best navigation target from Bilibili account record fields.
     *
     * @param {object} entry
     * @returns {string | null}
     */
    static targetUrlFor(entry) {
      const directUrl = SourceAdapter.normalizedVideoUrl(
        AccountSourceAdapter.stringValue(entry.redirect_link) ||
          AccountSourceAdapter.stringValue(entry.redirect_url) ||
          AccountSourceAdapter.stringValue(entry.uri) ||
          AccountSourceAdapter.stringValue(entry.url)
      );

      if (directUrl) {
        return directUrl;
      }

      const page = AccountSourceAdapter.pageNumberFor(entry);
      const bvid = AccountSourceAdapter.stringValue(
        entry.bvid || entry.history?.bvid
      );

      if (bvid) {
        return SourceAdapter.videoUrl({ bvid, page });
      }

      const aid = AccountSourceAdapter.numberValue(
        entry.aid ?? entry.kid ?? entry.history?.oid
      );

      if (aid) {
        return SourceAdapter.videoUrl({ aid: String(aid), page });
      }

      const epid = AccountSourceAdapter.numberValue(
        entry.epid ?? entry.history?.epid ?? entry.bangumi?.ep_id
      );

      if (epid) {
        return `${BILIBILI_WEB_ORIGIN}/bangumi/play/ep${epid}`;
      }

      return null;
    }

    /**
     * Extracts the display title from account record title fields.
     *
     * @param {object} entry
     * @returns {string | null}
     */
    static titleFor(entry) {
      const title = AccountSourceAdapter.cleanText(entry.title || entry.name);
      const subtitle = AccountSourceAdapter.cleanText(
        entry.long_title ||
          entry.show_title ||
          entry.page?.part ||
          entry.history?.part
      );

      if (title && subtitle && title !== subtitle) {
        return `${title} - ${subtitle}`;
      }

      return title || subtitle;
    }

    /**
     * Finds a thumbnail URL from account record image fields.
     *
     * @param {object} entry
     * @returns {string | null}
     */
    static thumbnailFor(entry) {
      const cover = Array.isArray(entry.covers) ? entry.covers[0] : null;

      return SourceAdapter.assetUrl(
        entry.pic ||
          entry.cover ||
          entry.first_frame ||
          cover ||
          entry.bangumi?.cover
      );
    }

    /**
     * Extracts the author label from account record owner fields.
     *
     * @param {object} entry
     * @returns {string | null}
     */
    static authorFor(entry) {
      return AccountSourceAdapter.cleanText(
        entry.author_name ||
          entry.owner?.name ||
          entry.author ||
          entry.up_name
      );
    }

    /**
     * Formats the view count when Bilibili includes one.
     *
     * @param {object} entry
     * @param {string} language
     * @returns {string | null}
     */
    static viewCountFor(entry, language) {
      const viewCount = AccountSourceAdapter.numberValue(
        entry.stat?.view ?? entry.view ?? entry.play
      );

      if (!viewCount || viewCount <= 0) {
        return null;
      }

      return UiStrings.viewCount(
        AccountSourceAdapter.compactNumber(viewCount, language),
        language
      );
    }

    /**
     * Extracts the duration from account record duration fields.
     *
     * @param {object} entry
     * @returns {string | null}
     */
    static durationFor(entry) {
      return AccountSourceAdapter.formatDuration(
        AccountSourceAdapter.numberValue(entry.duration ?? entry.page?.duration)
      );
    }

    /**
     * Extracts playback progress from account record progress fields.
     *
     * @param {object} entry
     * @param {string} language
     * @returns {string | null}
     */
    static progressFor(entry, language) {
      const progress = AccountSourceAdapter.numberValue(entry.progress);

      if (progress === null) {
        return null;
      }

      const duration = AccountSourceAdapter.numberValue(entry.duration);

      if (progress === -1 || (duration && progress >= duration)) {
        return UiStrings.finishedProgress(language);
      }

      const formatted = AccountSourceAdapter.formatDuration(progress);

      return formatted ? UiStrings.watchedProgress(formatted, language) : null;
    }

    /**
     * Reads the last watched page number from account record fields.
     *
     * @param {object} entry
     * @returns {number | null}
     */
    static pageNumberFor(entry) {
      return AccountSourceAdapter.numberValue(
        entry.page?.page ?? entry.history?.page
      );
    }

    /**
     * Formats seconds as a compact duration token.
     *
     * @param {number | null} seconds
     * @returns {string | null}
     */
    static formatDuration(seconds) {
      if (!seconds || seconds <= 0) {
        return null;
      }

      const totalSeconds = Math.floor(seconds);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const remainder = totalSeconds % 60;
      const paddedRemainder = String(remainder).padStart(2, "0");

      if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, "0")}:${paddedRemainder}`;
      }

      return `${minutes}:${paddedRemainder}`;
    }

    /**
     * Formats large counts without changing the card layout.
     *
     * @param {number} value
     * @param {string} language
     * @returns {string}
     */
    static compactNumber(value, language) {
      try {
        return new Intl.NumberFormat(UiStrings.numberLocale(language), {
          maximumFractionDigits: 1,
          notation: "compact"
        }).format(value);
      } catch (_error) {
        return String(value);
      }
    }

    /**
     * Converts a numeric value from Bilibili payloads.
     *
     * @param {unknown} value
     * @returns {number | null}
     */
    static numberValue(value) {
      const number = Number(value);

      if (!Number.isFinite(number)) {
        return null;
      }

      return number;
    }

    /**
     * Converts a string value from Bilibili payloads.
     *
     * @param {unknown} value
     * @returns {string | null}
     */
    static stringValue(value) {
      return typeof value === "string" ? value.trim() || null : null;
    }

    /**
     * Normalizes compact text from Bilibili payloads.
     *
     * @param {unknown} value
     * @returns {string | null}
     */
    static cleanText(value) {
      return SourceAdapter.cleanMetadata(AccountSourceAdapter.stringValue(value));
    }
  }

  /**
   * Loads account-backed list sources and notifies reconciliation on completion.
   */
  class AccountSourceStore {
    /**
     * Creates an account source store.
     *
     * @param {() => void} onChange
     */
    constructor(onChange) {
      this.onChange = onChange;
      this.sources = [];
      this.loading = false;
      this.abortController = null;
      this.sequence = 0;
      this.loadedLanguage = null;
      this.loadingLanguage = null;
    }

    /**
     * Returns the latest loaded account sources.
     *
     * @returns {VideoListSource[]}
     */
    currentSources() {
      return this.sources;
    }

    /**
     * Starts one account-source refresh for the current UI language.
     *
     * @param {string} language
     * @param {boolean} [force]
     */
    refresh(language, force = false) {
      if (typeof fetch !== "function") {
        return;
      }

      const normalizedLanguage = UiStrings.normalizeLanguage(language);

      if (this.loading) {
        if (!force || this.loadingLanguage === normalizedLanguage) {
          return;
        }

        this.abortController?.abort();
      }

      if (!force && this.loadedLanguage === normalizedLanguage) {
        return;
      }

      if (this.loadedLanguage !== normalizedLanguage) {
        this.sources = [];
      }

      const sequence = this.sequence + 1;
      const controller =
        typeof AbortController === "function" ? new AbortController() : null;
      this.sequence = sequence;
      this.loading = true;
      this.abortController = controller;
      this.loadingLanguage = normalizedLanguage;

      AccountSourceStore.fetchSources(controller?.signal, normalizedLanguage)
        .then((sources) => {
          if (sequence !== this.sequence) {
            return;
          }

          this.sources = sources;
          this.onChange();
        })
        .catch((error) => {
          if (error?.name === "AbortError") {
            return;
          }

          if (sequence === this.sequence) {
            this.sources = [];
          }

          DiagnosticLog.info("account source refresh failed", {
            message: error?.message ?? String(error)
          });
        })
        .finally(() => {
          if (sequence !== this.sequence) {
            return;
          }

          this.loading = false;
          this.abortController = null;
          this.loadedLanguage = normalizedLanguage;
          this.loadingLanguage = null;
        });
    }

    /**
     * Cancels pending account fetches and clears loaded sources.
     */
    stop() {
      this.sequence += 1;
      this.abortController?.abort();
      this.abortController = null;
      this.loading = false;
      this.sources = [];
      this.loadedLanguage = null;
      this.loadingLanguage = null;
    }

    /**
     * Fetches all account-backed video-list sources.
     *
     * @param {AbortSignal | undefined} signal
     * @param {string} language
     * @returns {Promise<VideoListSource[]>}
     */
    static async fetchSources(signal, language) {
      const requests = [
        { kind: SourceKind.WATCH_LATER, url: WATCH_LATER_SOURCE_URL },
        { kind: SourceKind.HISTORY, url: HISTORY_SOURCE_URL }
      ];

      const sources = await Promise.all(
        requests.map(({ kind, url }) =>
          AccountSourceStore.fetchSource(kind, url, signal, language)
        )
      );

      return sources.filter(Boolean);
    }

    /**
     * Fetches and normalizes one account-backed source.
     *
     * @param {string} kind
     * @param {string} url
     * @param {AbortSignal | undefined} signal
     * @param {string} language
     * @returns {Promise<VideoListSource | null>}
     */
    static async fetchSource(kind, url, signal, language) {
      try {
        const payload = await AccountSourceStore.fetchApiPayload(url, signal);

        if (!AccountSourceStore.isSuccessfulPayload(payload)) {
          return null;
        }

        return AccountSourceAdapter.sourceFromPayload(kind, payload, language);
      } catch (error) {
        if (error?.name === "AbortError") {
          throw error;
        }

        DiagnosticLog.info("account source unavailable", {
          kind,
          message: error?.message ?? String(error)
        });
        return null;
      }
    }

    /**
     * Fetches a Bilibili JSON payload with the current account cookies.
     *
     * Note: Bilibili account endpoints require the page's login cookies and may
     * return an application-level error when the visitor is signed out.
     *
     * @param {string} url
     * @param {AbortSignal | undefined} signal
     * @returns {Promise<object>}
     */
    static async fetchApiPayload(url, signal) {
      const response = await fetch(url, {
        credentials: "include",
        headers: {
          Accept: "application/json, text/plain, */*"
        },
        signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return AccountSourceStore.parseApiPayload(await response.text());
    }

    /**
     * Parses JSON and callback-wrapped JSON responses.
     *
     * @param {string} text
     * @returns {object}
     */
    static parseApiPayload(text) {
      try {
        return JSON.parse(text);
      } catch (_jsonError) {
        const match = text.trim().match(/^[\w$.]+\((.*)\);?$/s);

        if (!match) {
          throw new Error("Invalid account source JSON");
        }

        return JSON.parse(match[1]);
      }
    }

    /**
     * Returns true when a Bilibili API payload is successful.
     *
     * @param {object} payload
     * @returns {boolean}
     */
    static isSuccessfulPayload(payload) {
      return payload?.code === 0;
    }
  }

  /**
   * Fetches missing archive preview images without blocking layout rendering.
   */
  class VideoPreviewStore {
    /**
     * Creates a preview store.
     *
     * @param {() => void} onChange
     */
    constructor(onChange) {
      this.onChange = onChange;
      /** @type {Map<string, VideoPreviewRecord>} */
      this.records = new Map();
      this.queue = [];
      this.controllers = new Map();
      this.activeCount = 0;
      this.sequence = 0;
    }

    /**
     * Returns sources with cached fetched thumbnails applied.
     *
     * @param {VideoListSource[]} sources
     * @returns {VideoListSource[]}
     */
    hydrateSources(sources) {
      return sources.map((source) => {
        let changed = false;
        const items = source.items.map((item) => {
          const hydrated = this.hydrateItem(item);

          if (hydrated !== item) {
            changed = true;
          }

          return hydrated;
        });

        return changed ? { ...source, items } : source;
      });
    }

    /**
     * Applies a cached fetched thumbnail or queues one archive preview request.
     *
     * @param {VideoItem} item
     * @returns {VideoItem}
     */
    hydrateItem(item) {
      if (item.thumbnailUrl) {
        return item;
      }

      const identity = SourceAdapter.archiveIdentityForUrl(item.targetUrl);
      if (!identity) {
        return item;
      }

      const record = this.records.get(identity.key);
      if (record?.state === "available" && record.thumbnailUrl) {
        return {
          ...item,
          thumbnailUrl: record.thumbnailUrl
        };
      }

      if (!record) {
        this.enqueue(identity);
      }

      return item;
    }

    /**
     * Queues one preview request unless fetch is unavailable.
     *
     * @param {ArchiveVideoIdentity} identity
     */
    enqueue(identity) {
      if (typeof fetch !== "function") {
        this.records.set(identity.key, { state: "unavailable" });
        return;
      }

      this.records.set(identity.key, {
        state: "queued",
        identity
      });
      this.queue.push(identity);
      this.pump();
    }

    /**
     * Starts queued preview requests up to the concurrency limit.
     */
    pump() {
      while (
        this.activeCount < MAX_CONCURRENT_VIDEO_PREVIEW_FETCHES &&
        this.queue.length > 0
      ) {
        const identity = this.queue.shift();
        const record = this.records.get(identity.key);

        if (record?.state !== "queued") {
          continue;
        }

        this.startFetch(identity);
      }
    }

    /**
     * Starts one preview fetch and records its advisory result.
     *
     * @param {ArchiveVideoIdentity} identity
     */
    startFetch(identity) {
      const sequence = this.sequence;
      const controller =
        typeof AbortController === "function" ? new AbortController() : null;

      this.activeCount += 1;
      this.controllers.set(identity.key, controller);
      this.records.set(identity.key, {
        state: "loading",
        identity
      });

      VideoPreviewStore.fetchPreview(identity, controller?.signal)
        .then((thumbnailUrl) => {
          if (sequence !== this.sequence) {
            return;
          }

          if (thumbnailUrl) {
            this.records.set(identity.key, {
              state: "available",
              thumbnailUrl
            });
            this.onChange();
            return;
          }

          this.records.set(identity.key, { state: "unavailable" });
        })
        .catch((error) => {
          if (sequence !== this.sequence || error?.name === "AbortError") {
            return;
          }

          this.records.set(identity.key, { state: "unavailable" });
          DiagnosticLog.info("video preview unavailable", {
            key: identity.key,
            message: error?.message ?? String(error)
          });
        })
        .finally(() => {
          if (sequence !== this.sequence) {
            return;
          }

          this.activeCount -= 1;
          this.controllers.delete(identity.key);
          this.pump();
        });
    }

    /**
     * Cancels pending preview requests and clears the page-session cache.
     */
    stop() {
      this.sequence += 1;

      for (const controller of this.controllers.values()) {
        controller?.abort();
      }

      this.records.clear();
      this.queue = [];
      this.controllers.clear();
      this.activeCount = 0;
    }

    /**
     * Fetches one archive cover from Bilibili video metadata.
     *
     * Note: Bilibili can return application-level errors for private, deleted,
     * or unavailable videos. Those videos keep the title placeholder.
     *
     * @param {ArchiveVideoIdentity} identity
     * @param {AbortSignal | undefined} signal
     * @returns {Promise<string | null>}
     */
    static async fetchPreview(identity, signal) {
      const payload = await AccountSourceStore.fetchApiPayload(
        VideoPreviewStore.sourceUrl(identity),
        signal
      );

      if (!AccountSourceStore.isSuccessfulPayload(payload)) {
        return null;
      }

      return SourceAdapter.secureAssetUrl(payload?.data?.pic);
    }

    /**
     * Builds a Bilibili video-info URL for one archive identity.
     *
     * @param {ArchiveVideoIdentity} identity
     * @returns {string}
     */
    static sourceUrl(identity) {
      const url = new URL(VIDEO_INFO_SOURCE_URL);
      url.searchParams.set(identity.queryName, identity.queryValue);

      return url.href;
    }
  }

  /**
   * Merges page-owned sources with account-backed sources by closed source kind.
   */
  class SourceMerger {
    /**
     * Combines source lists and returns them in canonical source order.
     *
     * @param {VideoListSource[]} pageSources
     * @param {VideoListSource[]} accountSources
     * @returns {VideoListSource[]}
     */
    static merge(pageSources, accountSources) {
      const byKind = new Map();

      for (const source of [...pageSources, ...accountSources]) {
        byKind.set(source.kind, source);
      }

      return SOURCE_ORDER
        .map((kind) => byKind.get(kind))
        .filter(Boolean);
    }
  }

  /**
   * Discovers page-owned player, comment, and source regions for one watch page.
   */
  class RegionDiscovery {
    /**
     * Creates a discovery pass over a document.
     *
     * @param {Document} document
     */
    constructor(document) {
      this.document = document;
    }

    /**
     * Discovers the current watch page regions.
     *
     * @returns {DiscoveredRegions}
     */
    discover() {
      return {
        player: this.findPlayerRegion(),
        title: this.findWatchTitle(),
        comments: this.findCommentRegion(),
        sources: this.findSources()
      };
    }

    /**
     * Finds the Bilibili player region.
     *
     * @returns {Element | null}
     */
    findPlayerRegion() {
      const candidates = this.candidatesForSelectors(PLAYER_SELECTORS, true);

      for (const candidate of candidates) {
        const region = DomProbe.closestBySelectors(candidate, PLAYER_SELECTORS);

        if (this.isPlayerRegion(region)) {
          return region;
        }
      }

      return null;
    }

    /**
     * Finds the current watch title for extension-owned player chrome.
     *
     * @returns {string | null}
     */
    findWatchTitle() {
      for (const selector of WATCH_TITLE_SELECTORS) {
        for (const element of DomProbe.queryAll(this.document, selector)) {
          if (DomProbe.isOwned(element)) {
            continue;
          }

          const title = this.watchTitleFor(element);

          if (title) {
            return title;
          }
        }
      }

      const metaTitle = this.document.querySelector(
        "meta[property='og:title'], meta[name='title']"
      );

      if (metaTitle instanceof HTMLMetaElement) {
        return RegionDiscovery.cleanWatchTitle(metaTitle.content);
      }

      return RegionDiscovery.cleanWatchTitle(this.document.title);
    }

    /**
     * Extracts title text from one candidate title element.
     *
     * @param {Element} element
     * @returns {string | null}
     */
    watchTitleFor(element) {
      return RegionDiscovery.cleanWatchTitle(
        element.getAttribute("title") ||
          element.getAttribute("aria-label") ||
          DomProbe.compactText(element)
      );
    }

    /**
     * Normalizes watch title text from DOM and metadata sources.
     *
     * @param {string | null | undefined} value
     * @returns {string | null}
     */
    static cleanWatchTitle(value) {
      const title = (value ?? "")
        .replace(/\s+/g, " ")
        .replace(/\s*[-_]\s*哔哩哔哩.*$/u, "")
        .replace(/\s*[-_]\s*bilibili.*$/iu, "")
        .trim();

      return title || null;
    }

    /**
     * Finds the page-owned comment region when one is present.
     *
     * @returns {Element | null}
     */
    findCommentRegion() {
      const outsideCandidates = this.candidatesForSelectors(COMMENT_SELECTORS, false);
      const insideCandidates = this.candidatesForSelectors(COMMENT_SELECTORS, true);

      for (const candidate of [...outsideCandidates, ...insideCandidates]) {
        const region = DomProbe.closestBySelectors(candidate, COMMENT_SELECTORS);

        if (this.isCommentRegion(region)) {
          return region;
        }
      }

      return null;
    }

    /**
     * Finds valid source roots and extracts their video items.
     *
     * @returns {VideoListSource[]}
     */
    findSources() {
      const candidates = [];

      for (const definition of SOURCE_DEFINITIONS) {
        for (const root of this.sourceRootsFor(definition)) {
          const adapter = new SourceAdapter(definition.kind, root);
          const items = adapter.extractItems();

          if (items.length === 0) {
            continue;
          }

          candidates.push({
            kind: definition.kind,
            root,
            items,
            score: this.scoreSourceRoot(root, definition, items.length)
          });
        }
      }

      return this.chooseSources(candidates);
    }

    /**
     * Finds candidates for selectors, optionally including extension-contained
     * page nodes that were moved during an earlier reconciliation.
     *
     * @param {string[]} selectors
     * @param {boolean} includeOwned
     * @returns {Element[]}
     */
    candidatesForSelectors(selectors, includeOwned) {
      const candidates = [];

      for (const selector of selectors) {
        for (const element of DomProbe.queryAll(this.document, selector)) {
          if (!includeOwned && DomProbe.isOwned(element)) {
            continue;
          }

          candidates.push(element);
        }
      }

      return DomProbe.unique(candidates);
    }

    /**
     * Tests whether a candidate behaves like the playback region.
     *
     * @param {Element} element
     * @returns {boolean}
     */
    isPlayerRegion(element) {
      if (!element.isConnected) {
        return false;
      }

      return (
        element.id === "bilibili-player" ||
        element.id === "playerWrap" ||
        Boolean(element.querySelector("video, canvas, iframe, .bpx-player-video-wrap")) ||
        DomProbe.hasBox(element)
      );
    }

    /**
     * Tests whether a candidate behaves like the comment tree.
     *
     * @param {Element} element
     * @returns {boolean}
     */
    isCommentRegion(element) {
      if (!element.isConnected || element === this.document.body) {
        return false;
      }

      if (
        element.matches(
          "#comment, #commentapp, #bili-comments, bili-comments, .bili-comment, .comment-container, .reply-warp, .reply-box, .comment-m"
        )
      ) {
        return true;
      }

      return Boolean(
        element.matches(".comment") &&
          element.querySelector(
            "#bili-comments, bili-comments, textarea, [contenteditable='true'], [class*='reply'], [class*='comment']"
          )
      );
    }

    /**
     * Finds plausible roots for one source definition.
     *
     * @param {SourceDefinition} definition
     * @returns {Element[]}
     */
    sourceRootsFor(definition) {
      const roots = [];

      for (const selector of definition.selectors) {
        for (const element of DomProbe.queryAll(this.document, selector)) {
          const root = this.sourceRootForElement(element);

          if (root && this.isValidSourceRoot(root)) {
            roots.push(root);
          }
        }
      }

      for (const root of this.headingMatchedSourceRoots(definition)) {
        if (this.isValidSourceRoot(root)) {
          roots.push(root);
        }
      }

      return DomProbe.unique(roots);
    }

    /**
     * Chooses a bounded source root near a matching element.
     *
     * @param {Element} element
     * @returns {Element | null}
     */
    sourceRootForElement(element) {
      if (DomProbe.isOwned(element)) {
        return null;
      }

      let current = element;
      let best =
        SourceAdapter.videoTargetsIn(current).length > 0 ? current : null;

      if (best && this.isSourceBoundary(best)) {
        return best;
      }

      while (current.parentElement && current.parentElement !== this.document.body) {
        const parent = current.parentElement;

        if (DomProbe.isOwned(parent)) {
          break;
        }

        const currentCount = best ? SourceAdapter.videoTargetsIn(best).length : 0;
        const parentCount = SourceAdapter.videoTargetsIn(parent).length;

        const upperBound =
          currentCount <= 2 ? 120 : Math.max(currentCount + 20, currentCount * 3);

        if (this.isSidebarBoundary(parent) && currentCount >= 2) {
          break;
        }

        if (parentCount >= 2 && parentCount <= upperBound) {
          best = parent;

          if (this.isSourceBoundary(best)) {
            break;
          }

          current = parent;
          continue;
        }

        break;
      }

      return best;
    }

    /**
     * Returns true when an element is a known bounded source container.
     *
     * @param {Element} element
     * @returns {boolean}
     */
    isSourceBoundary(element) {
      return element.matches(SOURCE_BOUNDARY_SELECTOR);
    }

    /**
     * Returns true when an element is a broad sidebar boundary.
     *
     * @param {Element} element
     * @returns {boolean}
     */
    isSidebarBoundary(element) {
      return element.matches(SIDEBAR_BOUNDARY_SELECTOR);
    }

    /**
     * Finds child groups whose heading text identifies a source kind.
     *
     * @param {SourceDefinition} definition
     * @returns {Element[]}
     */
    headingMatchedSourceRoots(definition) {
      const roots = [];
      const containers = DomProbe.queryAll(
        this.document,
        SIDEBAR_BOUNDARY_SELECTOR
      );

      for (const container of containers) {
        if (DomProbe.isOwned(container)) {
          continue;
        }

        for (const child of Array.from(container.children).filter(DomProbe.isElement)) {
          const text = DomProbe.compactText(child).slice(0, 500);

          if (definition.pattern.test(text)) {
            roots.push(child);
          }
        }
      }

      return roots;
    }

    /**
     * Tests whether a source root can produce source items without owning page
     * playback or comment regions.
     *
     * @param {Element} root
     * @returns {boolean}
     */
    isValidSourceRoot(root) {
      if (!root.isConnected || root === this.document.body || DomProbe.isOwned(root)) {
        return false;
      }

      if (root.querySelector("#bilibili-player, .bpx-player-container, video")) {
        return false;
      }

      return SourceAdapter.videoTargetsIn(root).length > 0;
    }

    /**
     * Scores a candidate source root for stable one-root-per-kind selection.
     *
     * @param {Element} root
     * @param {SourceDefinition} definition
     * @param {number} itemCount
     * @returns {number}
     */
    scoreSourceRoot(root, definition, itemCount) {
      let score = itemCount;
      const text = DomProbe.compactText(root).slice(0, 600);

      if (definition.pattern.test(text)) {
        score += 12;
      }

      if (
        definition.kind === SourceKind.COLLECTION &&
        root.matches(VIDEO_POD_SELECTOR)
      ) {
        // Note: Bilibili's video-pod is the visible ordered video list and
        // should beat broader collection-looking roots with more links.
        score += 120;
      }

      if (root.id) {
        score += 4;
      }

      if (root.getAttribute(SOURCE_ROOT_ATTR) === definition.kind) {
        score += 6;
      }

      return score;
    }

    /**
     * Selects the best source for each kind and orders them by source kind.
     *
     * @param {(VideoListSource & { score: number })[]} candidates
     * @returns {VideoListSource[]}
     */
    chooseSources(candidates) {
      const byKind = new Map();

      for (const candidate of candidates) {
        const previous = byKind.get(candidate.kind);

        if (!previous || candidate.score > previous.score) {
          byKind.set(candidate.kind, candidate);
        }
      }

      return SOURCE_ORDER
        .map((kind) => byKind.get(kind))
        .filter(Boolean)
        .map(({ kind, root, items }) => ({ kind, root, items }));
    }
  }

  /**
   * Owns the transformed watch layout and re-homes page-owned player/comment
   * nodes into extension panes.
   */
  class LayoutRoot {
    /**
     * Creates the extension-owned layout root.
     *
     * @param {Document} document
     */
    constructor(document) {
      this.document = document;
      this.root = null;
      this.stage = null;
      this.playerPane = null;
      this.playerTitleOverlay = null;
      this.playerTitleText = null;
      this.commentPane = null;
      this.dock = null;
      this.sourceBar = null;
      this.rail = null;
      this.playerNode = null;
      this.commentNode = null;
      this.selectedSourceKind = null;
      this.isRailOpen = false;
      this.renderedSourceKind = null;
      this.sourceButtons = new Map();
      this.currentSources = [];
      this.currentActivationControl = null;
      this.hasUserInteractedWithSources = false;
      this.locatedCollectionRouteKey = null;
      this.language = DEFAULT_UI_LANGUAGE;
      this.movedNodes = new Map();
      this.markedSourceRoots = new Set();
    }

    /**
     * Mounts or updates the transformed layout from discovered regions.
     *
     * @param {DiscoveredRegions} regions
     * @param {boolean} resetSourceRoute
     * @param {ActivationControl} activationControl
     * @param {string} language
     */
    render(regions, resetSourceRoute, activationControl, language) {
      this.ensure();
      this.document.documentElement.classList.add(HTML_MOUNTED_CLASS);
      this.setLanguage(language);
      this.setTheme(ThemeResolver.resolve(this.document));
      this.setPlayer(regions.player);
      this.setPlayerTitle(regions.title);
      this.setComments(regions.comments);
      this.setSources(regions.sources, resetSourceRoute, activationControl);
    }

    /**
     * Restores moved nodes and removes extension-owned markup.
     */
    destroy() {
      this.unmarkSourceRoots();
      this.restoreNode(this.playerNode);
      this.restoreNode(this.commentNode);

      this.playerNode = null;
      this.commentNode = null;

      if (this.root?.isConnected) {
        this.root.remove();
      }

      this.root = null;
      this.stage = null;
      this.playerPane = null;
      this.playerTitleOverlay = null;
      this.playerTitleText = null;
      this.commentPane = null;
      this.dock = null;
      this.sourceBar = null;
      this.rail = null;
      this.selectedSourceKind = null;
      this.isRailOpen = false;
      this.renderedSourceKind = null;
      this.sourceButtons.clear();
      this.currentSources = [];
      this.currentActivationControl = null;
      this.hasUserInteractedWithSources = false;
      this.locatedCollectionRouteKey = null;
      this.language = DEFAULT_UI_LANGUAGE;
      this.document.documentElement.classList.remove(HTML_MOUNTED_CLASS);
    }

    /**
     * Ensures the extension-owned DOM scaffold exists.
     */
    ensure() {
      if (this.root?.isConnected) {
        return;
      }

      const existing = this.document.getElementById(OWNED_ROOT_ID);
      if (existing) {
        existing.remove();
      }

      this.root = this.document.createElement("section");
      this.root.id = OWNED_ROOT_ID;
      this.root.dataset.bibililiTheme = ThemeResolver.resolve(this.document);

      this.stage = this.document.createElement("main");
      this.stage.className = "bibilili-stage";

      this.playerPane = this.document.createElement("section");
      this.playerPane.className = "bibilili-player-pane";

      this.commentPane = this.document.createElement("aside");
      this.commentPane.className = "bibilili-comment-pane";

      this.dock = this.document.createElement("section");
      this.dock.className = "bibilili-list-dock";

      this.sourceBar = this.document.createElement("div");
      this.sourceBar.className = "bibilili-source-bar";
      this.sourceBar.setAttribute("role", "toolbar");

      this.rail = this.document.createElement("div");
      this.rail.id = LIST_RAIL_ID;
      this.rail.className = "bibilili-list-rail";

      this.stage.append(this.playerPane, this.commentPane);
      this.dock.append(this.sourceBar, this.rail);
      this.root.append(this.stage, this.dock);
      this.document.body.prepend(this.root);
    }

    /**
     * Applies localized labels to extension-owned layout landmarks.
     *
     * @param {string} language
     */
    setLanguage(language) {
      this.language = UiStrings.normalizeLanguage(language);

      if (!this.root) {
        return;
      }

      this.root.setAttribute(
        "aria-label",
        UiStrings.message(UiMessage.LAYOUT_LABEL, this.language)
      );
      this.playerPane?.setAttribute(
        "aria-label",
        UiStrings.message(UiMessage.PLAYER_LABEL, this.language)
      );
      this.commentPane?.setAttribute(
        "aria-label",
        UiStrings.message(UiMessage.COMMENTS_LABEL, this.language)
      );
      this.dock?.setAttribute(
        "aria-label",
        UiStrings.message(UiMessage.VIDEO_LISTS_LABEL, this.language)
      );
    }

    /**
     * Applies the resolved theme mode to extension-owned surfaces.
     *
     * @param {string} mode
     */
    setTheme(mode) {
      if (!this.root) {
        return;
      }

      this.root.dataset.bibililiTheme = mode;
    }

    /**
     * Moves the current player node into the player pane.
     *
     * @param {Element | null} player
     */
    setPlayer(player) {
      if (!player || !this.playerPane) {
        return;
      }

      if (this.playerNode && this.playerNode !== player) {
        this.restoreNode(this.playerNode);
      }

      this.playerNode = player;
      this.movePageNode(player, this.playerPane, "player");
      this.ensurePlayerTitleOverlay();
    }

    /**
     * Updates the hover title overlay for the current player.
     *
     * @param {string | null} title
     */
    setPlayerTitle(title) {
      if (!this.root || !this.playerPane) {
        return;
      }

      this.ensurePlayerTitleOverlay();

      if (!title) {
        this.playerTitleOverlay.hidden = true;
        this.playerTitleOverlay.removeAttribute("title");
        this.playerTitleText.textContent = "";
        return;
      }

      this.playerTitleOverlay.hidden = false;
      this.playerTitleText.textContent = title;
      this.playerTitleOverlay.setAttribute("title", title);
    }

    /**
     * Ensures the extension-owned player title overlay exists above the player.
     */
    ensurePlayerTitleOverlay() {
      if (!this.playerPane) {
        return;
      }

      if (!this.playerTitleOverlay) {
        this.playerTitleOverlay = this.document.createElement("div");
        this.playerTitleOverlay.className = "bibilili-player-title-overlay";
        this.playerTitleOverlay.setAttribute("aria-hidden", "true");

        this.playerTitleText = this.document.createElement("div");
        this.playerTitleText.className = "bibilili-player-title";
        this.playerTitleOverlay.append(this.playerTitleText);
      }

      if (this.playerTitleOverlay.parentElement !== this.playerPane) {
        this.playerPane.append(this.playerTitleOverlay);
      }
    }

    /**
     * Moves the current comment node into the comment pane.
     *
     * @param {Element | null} comments
     */
    setComments(comments) {
      if (!this.root || !this.commentPane) {
        return;
      }

      if (this.commentNode && this.commentNode !== comments) {
        this.restoreNode(this.commentNode);
        this.commentNode = null;
      }

      if (!comments) {
        this.root.classList.remove("bibilili-has-comments");
        return;
      }

      this.commentNode = comments;
      this.movePageNode(comments, this.commentPane, "comments");
      this.root.classList.add("bibilili-has-comments");
    }

    /**
     * Renders visible source controls and the bottom rail.
     *
     * @param {VideoListSource[]} sources
     * @param {boolean} resetSourceRoute
     * @param {ActivationControl} activationControl
     */
    setSources(sources, resetSourceRoute, activationControl) {
      if (!this.root || !this.sourceBar || !this.rail) {
        return;
      }

      this.currentSources = sources;
      this.currentActivationControl = activationControl;
      this.markSourceRoots(sources);

      if (resetSourceRoute) {
        this.hasUserInteractedWithSources = false;
      }

      const previousSourceKind = this.selectedSourceKind;
      this.selectedSourceKind = this.resolveSourceRoute(sources, resetSourceRoute);
      this.resolveRailOpenState(previousSourceKind, resetSourceRoute);

      this.renderSourceDock(sources, activationControl);
    }

    /**
     * Renders the list dock from the current source route and rail open state.
     *
     * @param {VideoListSource[]} sources
     * @param {ActivationControl} activationControl
     */
    renderSourceDock(sources, activationControl) {
      if (!this.root || !this.sourceBar || !this.rail) {
        return;
      }

      const selectedSource = this.selectedSource(sources);
      const hasOpenRail = Boolean(selectedSource && this.isRailOpen);

      this.root.classList.toggle("bibilili-has-dock", hasOpenRail);
      this.root.classList.toggle("bibilili-has-controls-dock", !hasOpenRail);
      this.renderSourceBar(sources, activationControl);

      if (hasOpenRail) {
        this.renderRail(
          selectedSource,
          selectedSource.kind !== this.renderedSourceKind
        );
        this.renderedSourceKind = selectedSource.kind;
      } else {
        this.renderedSourceKind = null;
        this.rail.replaceChildren();
      }
    }

    /**
     * Renders route buttons for discovered source kinds.
     *
     * @param {VideoListSource[]} sources
     * @param {ActivationControl} activationControl
     */
    renderSourceBar(sources, activationControl) {
      const activationButton = activationControl.mountDocked(
        this.sourceBar,
        true,
        this.language
      );
      const availableKinds = new Set();
      let previous = activationButton;

      for (const source of sources) {
        const button = this.sourceButtonFor(source.kind);
        availableKinds.add(source.kind);
        button.textContent = UiStrings.sourceLabel(source.kind, this.language);
        button.setAttribute(
          "aria-current",
          String(this.selectedSourceKind === source.kind)
        );
        button.setAttribute("aria-controls", LIST_RAIL_ID);

        if (this.selectedSourceKind === source.kind) {
          button.setAttribute("aria-expanded", String(this.isRailOpen));
        } else {
          button.removeAttribute("aria-expanded");
        }

        const reference = previous.nextSibling;
        if (reference !== button) {
          this.sourceBar.insertBefore(button, reference);
        }

        previous = button;
      }

      this.removeStaleSourceButtons(availableKinds);
    }

    /**
     * Returns the keyed source button for a source kind.
     *
     * @param {string} kind
     * @returns {HTMLButtonElement}
     */
    sourceButtonFor(kind) {
      const existing = this.sourceButtons.get(kind);
      if (existing) {
        return existing;
      }

      const button = this.document.createElement("button");
      button.type = "button";
      button.className = "bibilili-source-button";
      button.dataset.sourceKind = kind;
      button.addEventListener("click", () => {
        this.handleSourceButtonClick(kind);
      });
      this.sourceButtons.set(kind, button);
      return button;
    }

    /**
     * Routes to a source or opens/closes the rail for the current route.
     *
     * @param {string} kind
     */
    handleSourceButtonClick(kind) {
      this.hasUserInteractedWithSources = true;

      if (!this.currentActivationControl) {
        return;
      }

      if (!this.currentSources.some((source) => source.kind === kind)) {
        return;
      }

      if (this.selectedSourceKind === kind) {
        this.isRailOpen = !this.isRailOpen;
      } else {
        this.routeSource(kind);
      }

      this.renderSourceDock(this.currentSources, this.currentActivationControl);
    }

    /**
     * Removes keyed source buttons for sources absent from the current page.
     *
     * @param {Set<string>} availableKinds
     */
    removeStaleSourceButtons(availableKinds) {
      for (const [kind, button] of this.sourceButtons) {
        if (availableKinds.has(kind)) {
          continue;
        }

        button.remove();
        this.sourceButtons.delete(kind);
      }
    }

    /**
     * Renders the selected source group in the horizontal rail.
     *
     * @param {VideoListSource} source
     * @param {boolean} resetScroll
     */
    renderRail(source, resetScroll) {
      const preservedScrollLeft = resetScroll ? 0 : this.rail.scrollLeft;
      this.rail.replaceChildren();

      const group = this.document.createElement("section");
      group.className = "bibilili-source-group";
      group.dataset.sourceKind = source.kind;

      const title = this.document.createElement("h2");
      title.className = "bibilili-source-title";
      title.textContent = UiStrings.sourceLabel(source.kind, this.language);

      const row = this.document.createElement("div");
      row.className = "bibilili-card-row";

      const currentRouteKey =
        source.kind === SourceKind.COLLECTION
          ? SourceAdapter.currentWatchRouteKey()
          : null;
      let currentCard = null;
      let currentCardIndex = -1;
      let currentCardDetails = null;
      let currentCardReason = null;
      const detectionSamples = [];

      for (let index = 0; index < source.items.length; index += 1) {
        const item = source.items[index];
        const itemRouteKey = currentRouteKey
          ? SourceAdapter.watchRouteKeyForUrl(item.targetUrl)
          : null;
        const matchReason = this.currentCollectionItemMatchReason(
          source.kind,
          item,
          currentRouteKey,
          itemRouteKey
        );
        const isCurrent = Boolean(matchReason);
        const card = this.videoCard(item, isCurrent);

        if (
          source.kind === SourceKind.COLLECTION &&
          detectionSamples.length < COLLECTION_CARD_LOG_SAMPLE_SIZE
        ) {
          detectionSamples.push(
            LayoutRoot.collectionCardLogItem(index, item, itemRouteKey)
          );
        }

        if (isCurrent && !currentCard) {
          currentCard = card;
          currentCardIndex = index;
          currentCardDetails = LayoutRoot.collectionCardLogItem(
            index,
            item,
            itemRouteKey
          );
          currentCardReason = matchReason;
        }

        row.append(card);
      }

      group.append(title, row);
      this.rail.append(group);
      this.logCollectionCardDetection(
        source,
        currentRouteKey,
        currentCardIndex,
        currentCardDetails,
        currentCardReason,
        detectionSamples,
        resetScroll
      );
      const didLocateCurrentCard = this.locateCurrentCollectionCard(
        source.kind,
        currentCard,
        currentRouteKey,
        resetScroll
      );

      if (!didLocateCurrentCard && !resetScroll) {
        this.rail.scrollLeft = preservedScrollLeft;
      }
    }

    /**
     * Logs collection card matching inputs for debugging Bilibili markup.
     *
     * @param {VideoListSource} source
     * @param {string | null} currentRouteKey
     * @param {number} currentCardIndex
     * @param {object | null} currentCardDetails
     * @param {string | null} currentCardReason
     * @param {object[]} detectionSamples
     * @param {boolean} resetScroll
     */
    logCollectionCardDetection(
      source,
      currentRouteKey,
      currentCardIndex,
      currentCardDetails,
      currentCardReason,
      detectionSamples,
      resetScroll
    ) {
      if (source.kind !== SourceKind.COLLECTION) {
        return;
      }

      DiagnosticLog.info("collection card detection", {
        currentRouteKey,
        itemCount: source.items.length,
        matchedIndex: currentCardIndex,
        matchedItem: currentCardDetails,
        matchedReason: currentCardReason,
        resetScroll,
        railOpen: this.isRailOpen,
        selectedSourceKind: this.selectedSourceKind,
        locatedCollectionRouteKey: this.locatedCollectionRouteKey,
        sampledItems: detectionSamples
      });
    }

    /**
     * Builds one compact diagnostic record for a collection card candidate.
     *
     * @param {number} index
     * @param {VideoItem} item
     * @param {string | null} routeKey
     * @returns {object}
     */
    static collectionCardLogItem(index, item, routeKey) {
      return {
        index,
        isCurrent: Boolean(item.isCurrent),
        routeKey,
        title: item.title.slice(0, 80),
        targetUrl: item.targetUrl
      };
    }

    /**
     * Returns the reason an item is the current collection card.
     *
     * @param {string} sourceKind
     * @param {VideoItem} item
     * @param {string | null} currentRouteKey
     * @param {string | null} itemRouteKey
     * @returns {string | null}
     */
    currentCollectionItemMatchReason(
      sourceKind,
      item,
      currentRouteKey,
      itemRouteKey
    ) {
      if (sourceKind !== SourceKind.COLLECTION) {
        return null;
      }

      if (item.isCurrent) {
        return "native-current-marker";
      }

      if (currentRouteKey && itemRouteKey === currentRouteKey) {
        return "route-key";
      }

      return null;
    }

    /**
     * Positions the collection rail on the current video card when available.
     *
     * @param {string} sourceKind
     * @param {HTMLAnchorElement | null} currentCard
     * @param {string | null} currentRouteKey
     * @param {boolean} resetScroll
     * @returns {boolean}
     */
    locateCurrentCollectionCard(
      sourceKind,
      currentCard,
      currentRouteKey,
      resetScroll
    ) {
      const beforeScrollLeft = this.rail.scrollLeft;

      if (
        sourceKind !== SourceKind.COLLECTION ||
        !currentCard ||
        !currentRouteKey
      ) {
        if (resetScroll) {
          this.rail.scrollLeft = 0;
        }
        if (sourceKind === SourceKind.COLLECTION) {
          DiagnosticLog.info("collection card scroll skipped", {
            currentRouteKey,
            reason: currentCard ? "missing-current-route-key" : "no-current-card",
            resetScroll,
            beforeScrollLeft,
            afterScrollLeft: this.rail.scrollLeft
          });
        }
        return resetScroll;
      }

      if (
        resetScroll ||
        this.locatedCollectionRouteKey !== currentRouteKey
      ) {
        currentCard.scrollIntoView({ block: "nearest", inline: "center" });
        this.locatedCollectionRouteKey = currentRouteKey;
        window.requestAnimationFrame(() => {
          DiagnosticLog.info("collection card scroll", {
            currentRouteKey,
            resetScroll,
            beforeScrollLeft,
            afterScrollLeft: this.rail.scrollLeft,
            cardOffsetLeft: currentCard.offsetLeft,
            cardWidth: currentCard.offsetWidth,
            railClientWidth: this.rail.clientWidth,
            railScrollWidth: this.rail.scrollWidth
          });
        });
        return true;
      }

      DiagnosticLog.info("collection card scroll skipped", {
        currentRouteKey,
        reason: "already-located",
        resetScroll,
        beforeScrollLeft,
        afterScrollLeft: this.rail.scrollLeft
      });
      return false;
    }

    /**
     * Creates one extension-owned video card.
     *
     * @param {VideoItem} item
     * @param {boolean} [isCurrent]
     * @returns {HTMLAnchorElement}
     */
    videoCard(item, isCurrent = false) {
      const card = this.document.createElement("a");
      card.className = "bibilili-video-card";
      card.href = item.targetUrl;
      card.title = item.title;

      if (isCurrent) {
        card.setAttribute("aria-current", "page");
      }

      const thumb = this.document.createElement("span");
      thumb.className = "bibilili-card-thumb";

      if (item.thumbnailUrl) {
        const image = this.document.createElement("img");
        image.loading = "lazy";
        image.decoding = "async";
        image.alt = "";
        image.src = item.thumbnailUrl;
        thumb.append(image);
      } else {
        const placeholder = this.document.createElement("span");
        placeholder.className = "bibilili-card-placeholder";
        placeholder.textContent = item.title;
        thumb.append(placeholder);
      }

      if (item.duration) {
        const duration = this.document.createElement("span");
        duration.className = "bibilili-card-duration";
        duration.textContent = item.duration;
        thumb.append(duration);
      }

      const title = this.document.createElement("span");
      title.className = "bibilili-card-title";
      title.textContent = item.title;

      const meta = this.document.createElement("span");
      meta.className = "bibilili-card-meta";
      meta.textContent = [item.author, item.viewCount, item.progress].filter(Boolean).join(" · ");

      card.append(thumb, title, meta);
      return card;
    }

    /**
     * Resolves the source route for current discovery results.
     *
     * @param {VideoListSource[]} sources
     * @param {boolean} resetSourceRoute
     * @returns {string | null}
     */
    resolveSourceRoute(sources, resetSourceRoute) {
      const availableKinds = new Set(sources.map((source) => source.kind));
      const currentCollection = this.currentCollectionSource(sources);

      if (currentCollection && !this.hasUserInteractedWithSources) {
        return currentCollection.kind;
      }

      if (
        !resetSourceRoute &&
        this.selectedSourceKind &&
        availableKinds.has(this.selectedSourceKind)
      ) {
        return this.selectedSourceKind;
      }

      return sources[0]?.kind ?? null;
    }

    /**
     * Returns the collection source containing the current watch route.
     *
     * @param {VideoListSource[]} sources
     * @returns {VideoListSource | null}
     */
    currentCollectionSource(sources) {
      const collection = sources.find(
        (source) => source.kind === SourceKind.COLLECTION
      );
      const sourceKinds = sources.map((source) => source.kind);

      if (!collection) {
        DiagnosticLog.info("collection source detection", {
          sourceKinds,
          hasCollection: false,
          currentRouteKey: SourceAdapter.currentWatchRouteKey(),
          hasUserInteractedWithSources: this.hasUserInteractedWithSources
        });
        return null;
      }

      const currentRouteKey = SourceAdapter.currentWatchRouteKey();
      if (!currentRouteKey) {
        DiagnosticLog.info("collection source detection", {
          sourceKinds,
          hasCollection: true,
          currentRouteKey,
          itemCount: collection.items.length,
          matchedIndex: -1,
          hasUserInteractedWithSources: this.hasUserInteractedWithSources
        });
        return null;
      }

      let matchedReason = null;
      const matchedIndex = collection.items.findIndex((item) => {
        const itemRouteKey = SourceAdapter.watchRouteKeyForUrl(item.targetUrl);
        const matchReason = this.currentCollectionItemMatchReason(
          collection.kind,
          item,
          currentRouteKey,
          itemRouteKey
        );

        if (matchReason) {
          matchedReason = matchReason;
        }

        return Boolean(matchReason);
      });

      DiagnosticLog.info("collection source detection", {
        sourceKinds,
        hasCollection: true,
        currentRouteKey,
        itemCount: collection.items.length,
        matchedIndex,
        matchedReason,
        hasUserInteractedWithSources: this.hasUserInteractedWithSources
      });

      return matchedIndex >= 0 ? collection : null;
    }

    /**
     * Preserves closed rail state for the same route and opens new routes.
     *
     * @param {string | null} previousSourceKind
     * @param {boolean} resetSourceRoute
     */
    resolveRailOpenState(previousSourceKind, resetSourceRoute) {
      if (!this.selectedSourceKind) {
        this.isRailOpen = false;
        return;
      }

      if (resetSourceRoute || previousSourceKind !== this.selectedSourceKind) {
        this.isRailOpen = true;
      }
    }

    /**
     * Returns the source for the current route.
     *
     * @param {VideoListSource[]} sources
     * @returns {VideoListSource | null}
     */
    selectedSource(sources) {
      return (
        sources.find((source) => source.kind === this.selectedSourceKind) ?? null
      );
    }

    /**
     * Routes the rail to one available source kind and opens it.
     *
     * @param {string} kind
     */
    routeSource(kind) {
      if (this.currentSources.some((source) => source.kind === kind)) {
        this.selectedSourceKind = kind;
        this.isRailOpen = true;
      }
    }

    /**
     * Moves a page-owned node into an extension pane and leaves a placeholder.
     *
     * @param {Element} node
     * @param {Element} pane
     * @param {string} placeholderName
     */
    movePageNode(node, pane, placeholderName) {
      if (node.parentElement === pane) {
        return;
      }

      if (!this.movedNodes.has(node) && node.parentNode) {
        const placeholder = this.document.createComment(`bibilili ${placeholderName}`);
        node.parentNode.insertBefore(placeholder, node);
        this.movedNodes.set(node, placeholder);
      }

      pane.replaceChildren(node);
    }

    /**
     * Restores a moved page-owned node to its original placeholder.
     *
     * @param {Element | null} node
     */
    restoreNode(node) {
      if (!node) {
        return;
      }

      const placeholder = this.movedNodes.get(node);
      this.movedNodes.delete(node);

      if (placeholder?.isConnected && placeholder.parentNode) {
        placeholder.parentNode.insertBefore(node, placeholder);
        placeholder.remove();
      } else if (this.root?.contains(node)) {
        this.document.body.append(node);
      }
    }

    /**
     * Marks page-owned source roots so CSS hides their original placement.
     *
     * @param {VideoListSource[]} sources
     */
    markSourceRoots(sources) {
      this.unmarkSourceRoots();

      for (const source of sources) {
        if (!source.root) {
          continue;
        }

        source.root.setAttribute(SOURCE_ROOT_ATTR, source.kind);
        this.markedSourceRoots.add(source.root);
      }
    }

    /**
     * Removes extension source markers from previously marked roots.
     */
    unmarkSourceRoots() {
      for (const root of this.markedSourceRoots) {
        root.removeAttribute(SOURCE_ROOT_ATTR);
      }

      this.markedSourceRoots.clear();
    }
  }

  /**
   * Coordinates discovery, layout updates, mutation observation, and same-tab
   * navigation detection.
   */
  class BibililiController {
    /**
     * Creates the extension controller.
     *
     * @param {Document} document
     */
    constructor(document) {
      this.document = document;
      this.discovery = new RegionDiscovery(document);
      this.layout = new LayoutRoot(document);
      this.lazyPrimer = new PageLazyPrimer(document);
      this.accountSources = new AccountSourceStore(() => {
        this.scheduleReconcile(false, ReconcilePriority.LAZY);
      });
      this.videoPreviews = new VideoPreviewStore(() => {
        this.scheduleReconcile(false, ReconcilePriority.LAZY);
      });
      this.enabled = ActivationPreference.readEnabled();
      this.activationControl = new ActivationControl(document, (enabled) => {
        this.setEnabled(enabled);
      });
      this.observer = null;
      this.reconcileScheduler = new ReconcileScheduler((resetSourceRoute) => {
        this.reconcile(resetSourceRoute);
      });
      this.urlTimer = null;
      this.themePreference = null;
      this.themeChangeHandler = null;
      this.popstateHandler = null;
      this.hashchangeHandler = null;
      this.uiLanguage = LanguageResolver.resolve(document);
      this.pageKey = "";
      this.lastPlayerWaitDiagnostic = "";
      this.settlingTimers = [];
    }

    /**
     * Starts the controller.
     */
    start() {
      this.pageKey = this.currentPageKey();
      this.observeMutations();
      this.observeNavigation();
      this.observeThemePreference();
      this.renderFloatingActivation();
      this.refreshAccountSources();
      this.scheduleReconcile(false, ReconcilePriority.URGENT);
      this.scheduleSettlingReconciles();
    }

    /**
     * Stops observation and removes the transformed layout.
     */
    stop() {
      this.observer?.disconnect();
      this.observer = null;

      this.reconcileScheduler.cancel();

      if (this.urlTimer) {
        window.clearInterval(this.urlTimer);
        this.urlTimer = null;
      }

      if (this.popstateHandler) {
        window.removeEventListener("popstate", this.popstateHandler);
        this.popstateHandler = null;
      }

      if (this.hashchangeHandler) {
        window.removeEventListener("hashchange", this.hashchangeHandler);
        this.hashchangeHandler = null;
      }

      if (this.themePreference && this.themeChangeHandler) {
        this.themePreference.removeEventListener("change", this.themeChangeHandler);
        this.themePreference = null;
        this.themeChangeHandler = null;
      }

      this.lazyPrimer.stop();
      this.cancelSettlingReconciles();
      this.accountSources.stop();
      this.videoPreviews.stop();
      this.layout.destroy();
      this.activationControl.destroy();
    }

    /**
     * Schedules a coalesced reconciliation pass.
     *
     * @param {boolean} [resetSourceRoute]
     * @param {string} [priority]
     */
    scheduleReconcile(
      resetSourceRoute = false,
      priority = ReconcilePriority.LAZY
    ) {
      this.reconcileScheduler.request(resetSourceRoute, priority);
    }

    /**
     * Schedules bounded lazy passes while native page hydration settles.
     */
    scheduleSettlingReconciles() {
      this.cancelSettlingReconciles();

      for (const delay of LAZY_SETTLING_RECONCILE_DELAYS_MS) {
        const timer = window.setTimeout(() => {
          this.settlingTimers = this.settlingTimers.filter(
            (candidate) => candidate !== timer
          );

          if (!this.enabled || !this.isWatchPage()) {
            return;
          }

          this.scheduleReconcile(false, ReconcilePriority.LAZY);
        }, delay);

        this.settlingTimers.push(timer);
      }
    }

    /**
     * Cancels pending startup or navigation settling passes.
     */
    cancelSettlingReconciles() {
      for (const timer of this.settlingTimers) {
        window.clearTimeout(timer);
      }

      this.settlingTimers = [];
    }

    /**
     * Rebuilds the transformed layout from current DOM regions.
     *
     * @param {boolean} resetSourceRoute
     */
    reconcile(resetSourceRoute) {
      if (!this.isWatchPage()) {
        this.videoPreviews.stop();
        this.layout.destroy();
        this.activationControl.destroy();
        return;
      }

      if (!this.enabled) {
        this.videoPreviews.stop();
        this.layout.destroy();
        this.renderFloatingActivation();
        return;
      }

      const language = this.resolveUiLanguage();
      const regions = this.discovery.discover();
      const sources = SourceMerger.merge(
        regions.sources,
        this.accountSources.currentSources()
      );

      if (!regions.player) {
        this.logWaitingForPlayer();
        this.layout.destroy();
        this.renderFloatingActivation();
        return;
      }

      this.lastPlayerWaitDiagnostic = "";
      regions.sources = this.videoPreviews.hydrateSources(sources);

      if (
        this.lazyPrimer.prime(this.pageKey, () => {
          this.scheduleReconcile(false, ReconcilePriority.LAZY);
        })
      ) {
        regions.comments = null;
      }

      this.layout.render(
        regions,
        resetSourceRoute,
        this.activationControl,
        language
      );
    }

    /**
     * Observes lazy page updates and schedules reconciliation when page-owned
     * DOM changes.
     */
    observeMutations() {
      this.observer = new MutationObserver((mutations) => {
        const hasPageMutation = mutations.some((mutation) => !DomProbe.isOwned(mutation.target));

        if (hasPageMutation) {
          this.scheduleReconcile(false, ReconcilePriority.LAZY);
        }
      });

      this.observer.observe(this.document.documentElement, {
        attributes: true,
        attributeFilter: LAZY_MUTATION_ATTRIBUTE_FILTER,
        childList: true,
        subtree: true
      });
    }

    /**
     * Watches same-tab navigation by polling the URL and listening to native
     * history events.
     */
    observeNavigation() {
      this.popstateHandler = () => this.handlePotentialNavigation();
      this.hashchangeHandler = () => this.handlePotentialNavigation();
      window.addEventListener("popstate", this.popstateHandler);
      window.addEventListener("hashchange", this.hashchangeHandler);

      this.urlTimer = window.setInterval(
        () => this.handlePotentialNavigation(),
        URL_POLL_INTERVAL_MS
      );
    }

    /**
     * Watches browser color-scheme changes used when the page has no explicit
     * appearance mode.
     */
    observeThemePreference() {
      this.themePreference = window.matchMedia(BROWSER_DARK_SCHEME_QUERY);
      this.themeChangeHandler = () => {
        this.scheduleReconcile(false, ReconcilePriority.LAZY);
      };
      this.themePreference.addEventListener("change", this.themeChangeHandler);
    }

    /**
     * Resets per-page state when the visible watch page changes.
     */
    handlePotentialNavigation() {
      const nextPageKey = this.currentPageKey();

      if (nextPageKey === this.pageKey) {
        return;
      }

      this.lazyPrimer.stop(false);
      this.cancelSettlingReconciles();
      this.videoPreviews.stop();
      this.pageKey = nextPageKey;
      this.layout.destroy();
      this.refreshAccountSources();
      this.scheduleReconcile(true, ReconcilePriority.URGENT);
      this.scheduleSettlingReconciles();
    }

    /**
     * Persists and applies the global activation state.
     *
     * @param {boolean} enabled
     */
    setEnabled(enabled) {
      this.enabled = enabled;
      ActivationPreference.writeEnabled(enabled);
      this.reconcileScheduler.cancel();

      if (!enabled) {
        this.lazyPrimer.stop();
        this.cancelSettlingReconciles();
        this.accountSources.stop();
        this.videoPreviews.stop();
        this.layout.destroy();
        this.renderFloatingActivation();
        return;
      }

      this.refreshAccountSources();
      this.scheduleReconcile(true, ReconcilePriority.URGENT);
      this.scheduleSettlingReconciles();
    }

    /**
     * Refreshes account-backed sources when the transformed page can use them.
     */
    refreshAccountSources() {
      if (!this.enabled || !this.isWatchPage()) {
        return;
      }

      this.accountSources.refresh(this.resolveUiLanguage());
    }

    /**
     * Resolves and tracks the language used by extension-owned UI.
     *
     * @returns {string}
     */
    resolveUiLanguage() {
      const nextLanguage = LanguageResolver.resolve(this.document);

      if (nextLanguage !== this.uiLanguage) {
        this.uiLanguage = nextLanguage;

        if (this.enabled && this.isWatchPage()) {
          this.accountSources.refresh(nextLanguage, true);
        }
      }

      return this.uiLanguage;
    }

    /**
     * Logs a changed missing-player diagnostic without flooding lazy page loads.
     */
    logWaitingForPlayer() {
      const details = {
        pageKey: this.pageKey,
        playerCandidates: this.discovery.candidatesForSelectors(PLAYER_SELECTORS, true).length,
        layoutMounted: Boolean(this.layout.root?.isConnected)
      };
      const key = JSON.stringify(details);

      if (key === this.lastPlayerWaitDiagnostic) {
        return;
      }

      this.lastPlayerWaitDiagnostic = key;
      DiagnosticLog.warn("reconcile waiting for player region", details);
    }

    /**
     * Renders the activation button as a floating start or retry control.
     */
    renderFloatingActivation() {
      if (!this.isWatchPage()) {
        this.activationControl.destroy();
        return;
      }

      this.activationControl.mountFloating(
        ThemeResolver.resolve(this.document),
        this.resolveUiLanguage()
      );
    }

    /**
     * Returns true for Bilibili watch pages covered by this content script.
     *
     * @returns {boolean}
     */
    isWatchPage() {
      return (
        window.location.hostname === "www.bilibili.com" &&
        (window.location.pathname.startsWith("/video/") ||
          window.location.pathname.startsWith("/list/watchlater"))
      );
    }

    /**
     * Returns the navigation identity for a page session.
     *
     * @returns {string}
     */
    currentPageKey() {
      return `${window.location.origin}${window.location.pathname}${window.location.search}`;
    }
  }

  /**
   * @typedef {object} VideoItem
   * @property {string} targetUrl Required navigation target.
   * @property {string} title Required display title.
   * @property {string | null} thumbnailUrl Optional thumbnail image.
   * @property {string} sourceKind Closed source kind.
   * @property {boolean} [isCurrent] Native collection current-row marker.
   * @property {string | null} duration Optional compact duration.
   * @property {string | null} author Optional author label.
   * @property {string | null} viewCount Optional view count label.
   * @property {string | null} progress Optional watch progress label.
   */

  /**
   * @typedef {object} VideoListSource
   * @property {string} kind Closed source kind.
   * @property {Element | null} root Page-owned source root for DOM sources.
   * @property {VideoItem[]} items Extracted ordered video items.
   */

  /**
   * @typedef {object} DiscoveredRegions
   * @property {Element | null} player Page-owned player region.
   * @property {string | null} title Current watch title.
   * @property {Element | null} comments Page-owned comment region.
   * @property {VideoListSource[]} sources Valid video-list sources.
   */

  /**
   * @typedef {object} SourceDefinition
   * @property {string} kind Closed source kind.
   * @property {string[]} selectors Root selector probes.
   * @property {RegExp} pattern Heading text pattern.
   */

  /**
   * @typedef {object} ArchiveVideoIdentity
   * @property {string} key Per-session preview cache key.
   * @property {"bvid" | "aid"} queryName Bilibili video-info query name.
   * @property {string} queryValue Bilibili archive id query value.
   */

  /**
   * @typedef {object} VideoPreviewRecord
   * @property {"queued" | "loading" | "available" | "unavailable"} state
   * @property {ArchiveVideoIdentity} [identity] Queued or loading identity.
   * @property {string} [thumbnailUrl] Fetched archive cover URL.
   */

  /**
   * @typedef {object} I18nMessageRecord
   * @property {string} message Localized message text.
   * @property {Record<string, { content?: string }>} [placeholders]
   */

  const previousController = window.__bibililiController;
  if (previousController && typeof previousController.stop === "function") {
    previousController.stop();
  }

  const startToken = Symbol("bibilili-start");
  window.__bibililiStartToken = startToken;

  const start = async () => {
    await UiStrings.loadSupported();

    if (window.__bibililiStartToken !== startToken) {
      return;
    }

    const controller = new BibililiController(document);
    window.__bibililiController = controller;
    controller.start();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
