(() => {
  "use strict";

  const OWNED_ROOT_ID = "bibilili-layout-root";
  const FLOATING_TOGGLE_ROOT_ID = "bibilili-toggle-root";
  const SOURCE_ROOT_ATTR = "data-bibilili-source-kind";
  const HTML_MOUNTED_CLASS = "bibilili-mounted";
  const ENABLED_STORAGE_KEY = "bibilili:enabled";
  const LOGO_ASSET_PATH = "assets/bibilili-logo-white.svg";
  const BROWSER_DARK_SCHEME_QUERY = "(prefers-color-scheme: dark)";
  const RECONCILE_DELAY_MS = 160;
  const COMMENT_PRIME_DELAY_MS = 650;
  const URL_POLL_INTERVAL_MS = 500;
  const MAX_ITEMS_PER_SOURCE = 80;

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

  const VIDEO_LINK_SELECTOR = [
    "a[href*='/video/']",
    "a[href*='//www.bilibili.com/video/']",
    "a[href*='/bangumi/play/']"
  ].join(",");

  const TITLE_SELECTORS = [
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
    ".player-auxiliary-playlist-list",
    ".playlist-container",
    ".recommend-list",
    ".recommend-list-v1",
    ".recommend-video-card-list",
    ".video-pod",
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
    QUEUE: "queue",
    COLLECTION: "collection",
    WATCH_LATER: "watch_later",
    RECOMMENDATIONS: "recommendations"
  });

  const SOURCE_ORDER = Object.freeze([
    SourceKind.QUEUE,
    SourceKind.COLLECTION,
    SourceKind.WATCH_LATER,
    SourceKind.RECOMMENDATIONS
  ]);

  const SOURCE_LABELS = Object.freeze({
    [SourceKind.QUEUE]: "Queue",
    [SourceKind.COLLECTION]: "Collection",
    [SourceKind.WATCH_LATER]: "Watch Later",
    [SourceKind.RECOMMENDATIONS]: "Recommendations"
  });

  const SOURCE_MARKS = Object.freeze({
    [SourceKind.QUEUE]: "Queue",
    [SourceKind.COLLECTION]: "Set",
    [SourceKind.WATCH_LATER]: "Later",
    [SourceKind.RECOMMENDATIONS]: "Rec"
  });

  /**
   * Closed theme modes applied to extension-owned surfaces.
   */
  const ThemeMode = Object.freeze({
    LIGHT: "light",
    DARK: "dark"
  });

  /**
   * Static source adapter configuration.
   *
   * Note: Bilibili uses several markup families across old, new, and lazy
   * watch page surfaces. The selectors prefer stable container names first and
   * keep broad class-name probes as fallbacks.
   */
  const SOURCE_DEFINITIONS = Object.freeze([
    {
      kind: SourceKind.QUEUE,
      selectors: [
        ".player-auxiliary-playlist-list",
        ".playlist-container",
        ".video-queue",
        "[class*='playlist']",
        "[class*='queue']"
      ],
      pattern:
        /(?:\u961f\u5217|\u64ad\u653e\u5217\u8868|queue|playlist)/i
    },
    {
      kind: SourceKind.COLLECTION,
      selectors: [
        "#multi_page",
        ".base-video-sections",
        ".video-sections",
        ".video-sections-content-list",
        ".video-pod",
        ".anthology-list",
        "[class*='video-section']",
        "[class*='anthology']"
      ],
      pattern:
        /(?:\u5408\u96c6|\u5206\u96c6|\u89c6\u9891\u9009\u96c6|collection|section|anthology)/i
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
      return Array.from(root.querySelectorAll(selector)).filter(DomProbe.isElement);
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
   * Resolves the extension theme from Bilibili state or browser preference.
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

      if (
        document.querySelector(
          "html[data-theme='dark'], html[data-color-mode='dark'], body[data-theme='dark'], body[data-color-mode='dark']"
        )
      ) {
        return ThemeMode.DARK;
      }

      if (
        document.querySelector(
          "html[data-theme='light'], html[data-color-mode='light'], body[data-theme='light'], body[data-color-mode='light']"
        )
      ) {
        return ThemeMode.LIGHT;
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
    }

    /**
     * Places the activation button as a floating page control.
     *
     * @param {boolean} enabled
     * @param {string} theme
     */
    mountFloating(enabled, theme) {
      this.ensureFloatingRoot(theme);
      this.setEnabled(enabled);
      this.floatingRoot.replaceChildren(this.ensureButton());
    }

    /**
     * Places the activation button as the leftmost bottom dock control.
     *
     * @param {Element} container
     * @param {boolean} enabled
     */
    mountDocked(container, enabled) {
      const button = this.ensureButton();
      this.setEnabled(enabled);
      container.append(button);

      if (this.floatingRoot?.isConnected) {
        this.floatingRoot.remove();
      }
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
        this.onToggle(this.button.getAttribute("aria-pressed") !== "true");
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
      if (typeof chrome !== "undefined" && chrome.runtime?.getURL) {
        return chrome.runtime.getURL(LOGO_ASSET_PATH);
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
      button.title = enabled ? "Turn Bibilili off" : "Turn Bibilili on";
      button.setAttribute("aria-label", button.title);
      button.setAttribute("aria-pressed", String(enabled));
    }
  }

  /**
   * Opens the native scroll position once so Bilibili can create lazy comments.
   */
  class CommentPrimer {
    /**
     * Creates a primer for one document.
     *
     * @param {Document} document
     */
    constructor(document) {
      this.document = document;
      this.primedPageKeys = new Set();
      this.timer = null;
    }

    /**
     * Returns true when this page has already had its native comment load pass.
     *
     * @param {string} pageKey
     * @returns {boolean}
     */
    hasPrimed(pageKey) {
      return this.primedPageKeys.has(pageKey);
    }

    /**
     * Scrolls to the native comment area before the transformed layout mounts.
     *
     * @param {string} pageKey
     * @param {() => void} afterPrime
     * @returns {boolean}
     */
    prime(pageKey, afterPrime) {
      if (this.hasPrimed(pageKey)) {
        return false;
      }

      this.primedPageKeys.add(pageKey);

      const startX = window.scrollX;
      const startY = window.scrollY;
      const target = this.targetElement();
      const maxY = Math.max(
        0,
        this.document.documentElement.scrollHeight - window.innerHeight
      );

      if (target) {
        target.scrollIntoView({ block: "center", inline: "nearest" });
      } else if (maxY > 0) {
        window.scrollTo({
          left: startX,
          top: Math.min(maxY, Math.max(window.innerHeight, maxY * 0.6))
        });
      } else {
        return false;
      }

      window.clearTimeout(this.timer);
      this.timer = window.setTimeout(() => {
        window.scrollTo({ left: startX, top: startY });
        afterPrime();
      }, COMMENT_PRIME_DELAY_MS);

      return true;
    }

    /**
     * Clears pending native scroll restoration.
     */
    stop() {
      if (this.timer) {
        window.clearTimeout(this.timer);
        this.timer = null;
      }
    }

    /**
     * Finds the best native element to bring near the viewport.
     *
     * @returns {Element | null}
     */
    targetElement() {
      for (const selector of COMMENT_PRIME_SELECTORS) {
        const element = this.document.querySelector(selector);

        if (element && !DomProbe.isOwned(element)) {
          return element;
        }
      }

      return null;
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

      for (const anchor of this.videoAnchors()) {
        const item = this.itemFromAnchor(anchor);

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
     * Finds video anchors that belong to the page-owned source root.
     *
     * @returns {HTMLAnchorElement[]}
     */
    videoAnchors() {
      return SourceAdapter.videoAnchorsIn(this.root);
    }

    /**
     * Finds video anchors below an arbitrary page-owned source root.
     *
     * @param {Element} root
     * @returns {HTMLAnchorElement[]}
     */
    static videoAnchorsIn(root) {
      return DomProbe.queryAll(root, VIDEO_LINK_SELECTOR)
        .filter((element) => element instanceof HTMLAnchorElement)
        .filter((anchor) => !DomProbe.isOwned(anchor))
        .filter((anchor) => Boolean(SourceAdapter.normalizedUrl(anchor)));
    }

    /**
     * Converts one anchor and its closest card-like ancestor to a video item.
     *
     * @param {HTMLAnchorElement} anchor
     * @returns {VideoItem | null}
     */
    itemFromAnchor(anchor) {
      const targetUrl = SourceAdapter.normalizedUrl(anchor);
      const card = SourceAdapter.cardForAnchor(anchor);
      const title = SourceAdapter.titleFor(anchor, card);

      if (!targetUrl || !title) {
        return null;
      }

      return {
        targetUrl,
        title,
        thumbnailUrl: SourceAdapter.thumbnailFor(anchor, card),
        sourceKind: this.kind,
        duration: SourceAdapter.durationFor(card),
        author: SourceAdapter.metadataFor(card, "author"),
        viewCount: SourceAdapter.metadataFor(card, "viewCount"),
        progress: SourceAdapter.progressFor(card)
      };
    }

    /**
     * Finds the nearest card-like element for a source anchor.
     *
     * @param {HTMLAnchorElement} anchor
     * @returns {Element}
     */
    static cardForAnchor(anchor) {
      for (const selector of CARD_SELECTORS) {
        const card = anchor.closest(selector);
        if (card && !DomProbe.isOwned(card)) {
          return card;
        }
      }

      return anchor;
    }

    /**
     * Returns the normalized URL from a video anchor.
     *
     * @param {HTMLAnchorElement} anchor
     * @returns {string | null}
     */
    static normalizedUrl(anchor) {
      const rawHref = anchor.getAttribute("href") || anchor.href;

      if (!rawHref || rawHref.startsWith("javascript:")) {
        return null;
      }

      try {
        const url = new URL(rawHref, window.location.href);

        if (url.protocol !== "http:" && url.protocol !== "https:") {
          return null;
        }

        return url.href;
      } catch (_error) {
        return null;
      }
    }

    /**
     * Extracts a required video title.
     *
     * @param {HTMLAnchorElement} anchor
     * @param {Element} card
     * @returns {string | null}
     */
    static titleFor(anchor, card) {
      const candidates = [
        anchor.getAttribute("title"),
        anchor.getAttribute("aria-label"),
        ...SourceAdapter.textsFromSelectors(anchor, TITLE_SELECTORS),
        ...SourceAdapter.textsFromSelectors(card, TITLE_SELECTORS),
        SourceAdapter.imageAltFor(anchor),
        DomProbe.compactText(anchor)
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
     * @param {HTMLAnchorElement} anchor
     * @param {Element} card
     * @returns {string | null}
     */
    static thumbnailFor(anchor, card) {
      const image = card.querySelector("img") || anchor.querySelector("img");
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
     * Returns the first image alt text below an anchor.
     *
     * @param {HTMLAnchorElement} anchor
     * @returns {string | null}
     */
    static imageAltFor(anchor) {
      const image = anchor.querySelector("img");
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
            label: SOURCE_LABELS[definition.kind],
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
        SourceAdapter.videoAnchorsIn(current).length > 0 ? current : null;

      if (best && this.isSourceBoundary(best)) {
        return best;
      }

      while (current.parentElement && current.parentElement !== this.document.body) {
        const parent = current.parentElement;

        if (DomProbe.isOwned(parent)) {
          break;
        }

        const currentCount = best ? SourceAdapter.videoAnchorsIn(best).length : 0;
        const parentCount = SourceAdapter.videoAnchorsIn(parent).length;

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
        ".right-container, #right-container, aside, [class*='right-container'], [class*='sidebar']"
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

      return SourceAdapter.videoAnchorsIn(root).length > 0;
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
        .map(({ kind, label, root, items }) => ({ kind, label, root, items }));
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
      this.activeKinds = new Set();
      this.disabledKinds = new Set();
      this.movedNodes = new Map();
      this.markedSourceRoots = new Set();
    }

    /**
     * Mounts or updates the transformed layout from discovered regions.
     *
     * @param {DiscoveredRegions} regions
     * @param {boolean} resetActiveSources
     * @param {ActivationControl} activationControl
     */
    render(regions, resetActiveSources, activationControl) {
      this.ensure();
      this.document.documentElement.classList.add(HTML_MOUNTED_CLASS);
      this.setTheme(ThemeResolver.resolve(this.document));
      this.setPlayer(regions.player);
      this.setPlayerTitle(regions.title);
      this.setComments(regions.comments);
      this.setSources(regions.sources, resetActiveSources, activationControl);
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
      this.activeKinds.clear();
      this.disabledKinds.clear();
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
      this.root.setAttribute("aria-label", "Bibilili watch layout");
      this.root.dataset.bibililiTheme = ThemeResolver.resolve(this.document);

      this.stage = this.document.createElement("main");
      this.stage.className = "bibilili-stage";

      this.playerPane = this.document.createElement("section");
      this.playerPane.className = "bibilili-player-pane";
      this.playerPane.setAttribute("aria-label", "Player");

      this.commentPane = this.document.createElement("aside");
      this.commentPane.className = "bibilili-comment-pane";
      this.commentPane.setAttribute("aria-label", "Comments");

      this.dock = this.document.createElement("section");
      this.dock.className = "bibilili-list-dock";
      this.dock.setAttribute("aria-label", "Video lists");

      this.sourceBar = this.document.createElement("div");
      this.sourceBar.className = "bibilili-source-bar";
      this.sourceBar.setAttribute("role", "toolbar");

      this.rail = this.document.createElement("div");
      this.rail.className = "bibilili-list-rail";

      this.stage.append(this.playerPane, this.commentPane);
      this.dock.append(this.sourceBar, this.rail);
      this.root.append(this.stage, this.dock);
      this.document.body.prepend(this.root);
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
        this.root.classList.remove("bibilili-has-player-title");
        this.playerTitleOverlay.hidden = true;
        this.playerTitleOverlay.removeAttribute("title");
        this.playerTitleText.textContent = "";
        return;
      }

      this.root.classList.add("bibilili-has-player-title");
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
     * @param {boolean} resetActiveSources
     * @param {ActivationControl} activationControl
     */
    setSources(sources, resetActiveSources, activationControl) {
      if (!this.root || !this.sourceBar || !this.rail) {
        return;
      }

      this.markSourceRoots(sources);

      if (resetActiveSources) {
        this.disabledKinds.clear();
      }

      const availableKinds = new Set(sources.map((source) => source.kind));
      this.activeKinds = new Set(
        [...availableKinds].filter((kind) => !this.disabledKinds.has(kind))
      );

      this.renderSourceDock(sources, activationControl);
    }

    /**
     * Renders or collapses the list dock from the current active source set.
     *
     * @param {VideoListSource[]} sources
     * @param {ActivationControl} activationControl
     */
    renderSourceDock(sources, activationControl) {
      if (!this.root || !this.sourceBar || !this.rail) {
        return;
      }

      const hasActiveSources = this.activeKinds.size > 0;

      this.root.classList.toggle("bibilili-has-dock", hasActiveSources);
      this.root.classList.toggle("bibilili-has-controls-dock", !hasActiveSources);
      this.renderSourceBar(sources, activationControl);

      if (hasActiveSources) {
        this.renderRail(sources);
      } else {
        this.rail.replaceChildren();
      }
    }

    /**
     * Renders toggle buttons for discovered source kinds.
     *
     * @param {VideoListSource[]} sources
     * @param {ActivationControl} activationControl
     */
    renderSourceBar(sources, activationControl) {
      this.sourceBar.replaceChildren();
      activationControl.mountDocked(this.sourceBar, true);

      for (const source of sources) {
        const button = this.document.createElement("button");
        button.type = "button";
        button.className = "bibilili-source-button";
        button.textContent = source.label;
        button.setAttribute("aria-pressed", String(this.activeKinds.has(source.kind)));
        button.addEventListener("click", () => {
          this.toggleSource(source.kind);
          this.renderSourceDock(sources, activationControl);
        });
        this.sourceBar.append(button);
      }
    }

    /**
     * Renders active source groups in a single horizontal rail.
     *
     * @param {VideoListSource[]} sources
     */
    renderRail(sources) {
      this.rail.replaceChildren();

      const activeSources = sources.filter((source) => this.activeKinds.has(source.kind));
      const showSourceMarks = activeSources.length > 1;

      for (const source of activeSources) {
        const group = this.document.createElement("section");
        group.className = "bibilili-source-group";
        group.dataset.sourceKind = source.kind;

        const title = this.document.createElement("h2");
        title.className = "bibilili-source-title";
        title.textContent = source.label;

        const row = this.document.createElement("div");
        row.className = "bibilili-card-row";

        for (const item of source.items) {
          row.append(this.videoCard(item, showSourceMarks));
        }

        group.append(title, row);
        this.rail.append(group);
      }
    }

    /**
     * Creates one extension-owned video card.
     *
     * @param {VideoItem} item
     * @param {boolean} showSourceMark
     * @returns {HTMLAnchorElement}
     */
    videoCard(item, showSourceMark) {
      const card = this.document.createElement("a");
      card.className = "bibilili-video-card";
      card.href = item.targetUrl;
      card.title = item.title;

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
        placeholder.textContent = item.title.slice(0, 1).toUpperCase();
        thumb.append(placeholder);
      }

      if (item.duration) {
        const duration = this.document.createElement("span");
        duration.className = "bibilili-card-duration";
        duration.textContent = item.duration;
        thumb.append(duration);
      }

      if (showSourceMark) {
        const mark = this.document.createElement("span");
        mark.className = "bibilili-card-source";
        mark.textContent = SOURCE_MARKS[item.sourceKind] ?? SOURCE_LABELS[item.sourceKind];
        thumb.append(mark);
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
     * Toggles a source kind while allowing an empty active set.
     *
     * @param {string} kind
     */
    toggleSource(kind) {
      if (this.activeKinds.has(kind)) {
        this.activeKinds.delete(kind);
        this.disabledKinds.add(kind);
      } else {
        this.activeKinds.add(kind);
        this.disabledKinds.delete(kind);
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
      this.commentPrimer = new CommentPrimer(document);
      this.enabled = ActivationPreference.readEnabled();
      this.activationControl = new ActivationControl(document, (enabled) => {
        this.setEnabled(enabled);
      });
      this.observer = null;
      this.reconcileTimer = null;
      this.urlTimer = null;
      this.themePreference = null;
      this.themeChangeHandler = null;
      this.popstateHandler = null;
      this.hashchangeHandler = null;
      this.pageKey = "";
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
      this.scheduleReconcile();
    }

    /**
     * Stops observation and removes the transformed layout.
     */
    stop() {
      this.observer?.disconnect();
      this.observer = null;

      if (this.reconcileTimer) {
        window.clearTimeout(this.reconcileTimer);
        this.reconcileTimer = null;
      }

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

      this.commentPrimer.stop();
      this.layout.destroy();
      this.activationControl.destroy();
    }

    /**
     * Schedules a debounced reconciliation pass.
     *
     * @param {boolean} [resetActiveSources]
     */
    scheduleReconcile(resetActiveSources = false) {
      if (this.reconcileTimer) {
        window.clearTimeout(this.reconcileTimer);
      }

      this.reconcileTimer = window.setTimeout(() => {
        this.reconcileTimer = null;
        this.reconcile(resetActiveSources);
      }, RECONCILE_DELAY_MS);
    }

    /**
     * Rebuilds the transformed layout from current DOM regions.
     *
     * @param {boolean} resetActiveSources
     */
    reconcile(resetActiveSources) {
      if (!this.isWatchPage()) {
        this.layout.destroy();
        this.activationControl.destroy();
        return;
      }

      if (!this.enabled) {
        this.layout.destroy();
        this.renderFloatingActivation();
        return;
      }

      const regions = this.discovery.discover();

      if (!regions.player) {
        this.layout.destroy();
        this.renderFloatingActivation();
        return;
      }

      if (!regions.comments && !this.layout.root) {
        const didPrime = this.commentPrimer.prime(this.pageKey, () => {
          this.scheduleReconcile();
        });

        if (didPrime) {
          return;
        }
      }

      this.layout.render(regions, resetActiveSources, this.activationControl);
    }

    /**
     * Observes lazy page updates and schedules reconciliation when page-owned
     * DOM changes.
     */
    observeMutations() {
      this.observer = new MutationObserver((mutations) => {
        const hasPageMutation = mutations.some((mutation) => !DomProbe.isOwned(mutation.target));

        if (hasPageMutation) {
          this.scheduleReconcile();
        }
      });

      this.observer.observe(this.document.documentElement, {
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
      this.themeChangeHandler = () => this.scheduleReconcile();
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

      this.pageKey = nextPageKey;
      this.layout.destroy();
      this.scheduleReconcile(true);
    }

    /**
     * Persists and applies the global activation state.
     *
     * @param {boolean} enabled
     */
    setEnabled(enabled) {
      this.enabled = enabled;
      ActivationPreference.writeEnabled(enabled);

      if (!enabled) {
        this.layout.destroy();
        this.renderFloatingActivation();
        return;
      }

      this.renderFloatingActivation();
      this.scheduleReconcile(true);
    }

    /**
     * Renders the activation button in its floating placement.
     */
    renderFloatingActivation() {
      if (!this.isWatchPage()) {
        this.activationControl.destroy();
        return;
      }

      this.activationControl.mountFloating(
        this.enabled,
        ThemeResolver.resolve(this.document)
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
   * @property {string | null} duration Optional compact duration.
   * @property {string | null} author Optional author label.
   * @property {string | null} viewCount Optional view count label.
   * @property {string | null} progress Optional watch progress label.
   */

  /**
   * @typedef {object} VideoListSource
   * @property {string} kind Closed source kind.
   * @property {string} label Human-readable source label.
   * @property {Element} root Page-owned source root.
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

  const previousController = window.__bibililiController;
  if (previousController && typeof previousController.stop === "function") {
    previousController.stop();
  }

  const start = () => {
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
