(() => {
  "use strict";

  const { UiLanguage } = window.__bibililiI18n;

  const ENABLED_STORAGE_KEY = "bibilili:enabled";
  const CARD_NAVIGATION_ORIGIN_STORAGE_KEY =
    "bibilili:card-navigation-origin";
  const SOURCE_ROUTE_STATE_STORAGE_KEY = "bibilili:source-route-state";
  const FAVORITE_FOLDER_STORAGE_PREFIX = "bibilili:favorite-folder:";
  const COMMENT_PANE_WIDTH_STORAGE_KEY = "bibilili:comment-pane-width";
  const SETTINGS_STORAGE_KEY = "bibilili:settings";
  const FEATURE_DEFAULTS = Object.freeze({
    description: true, thumbnails: true, favoriteToSelectedFolder: true, moreButton: true
  });
  const CARD_NAVIGATION_ORIGIN_TTL_MS = 120000;

  let storageConfig = Object.freeze({
    sourceOrder: Object.freeze([]),
    favoritesKind: null,
    actionDefaults: Object.freeze({}),
    commentPaneMinWidth: 0,
    commentPaneMaxWidth: Number.MAX_SAFE_INTEGER
  });

  /**
   * Configures storage validation rules owned by the main runtime.
   *
   * @param {StorageStateConfig} config
   */
  function configure(config) {
    storageConfig = Object.freeze({
      sourceOrder: Object.freeze([...(config.sourceOrder ?? [])]),
      favoritesKind: config.favoritesKind ?? null,
      actionDefaults: Object.freeze({ ...(config.actionDefaults ?? {}) }),
      commentPaneMinWidth: config.commentPaneMinWidth ?? 0,
      commentPaneMaxWidth:
        config.commentPaneMaxWidth ?? Number.MAX_SAFE_INTEGER
    });
  }

  /**
   * Stores the global activation preference for Bilibili pages.
   */
  class ActivationPreference {
    /** @returns {string} Origin-local key observed across Bilibili tabs. */
    static get key() { return ENABLED_STORAGE_KEY; }
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
     * @returns {boolean} Whether the requested state was persisted.
     */
    static writeEnabled(enabled) {
      try {
        window.localStorage.setItem(ENABLED_STORAGE_KEY, enabled ? "on" : "off");
        return true;
      } catch (_error) {
        return false;
      }
    }
  }

  /** Persists UI language, feature switches, enabled sources, and action placement. */
  class SettingsPreference {
    /** @returns {string} Origin-local key observed across Bilibili tabs. */
    static get key() { return SETTINGS_STORAGE_KEY; }

    /** @returns {SettingsPreferenceRecord} Fresh defaults in canonical key order. */
    static defaults() {
      return {
        language: null,
        features: { ...FEATURE_DEFAULTS },
        sources: Object.fromEntries(storageConfig.sourceOrder.map((kind) => [kind, true])),
        pinnedActions: { ...storageConfig.actionDefaults }
      };
    }

    /**
     * Keeps a supported language and known booleans, defaulting missing values.
     * @param {unknown} value
     * @returns {SettingsPreferenceRecord}
     */
    static normalize(value) {
      const result = SettingsPreference.defaults();
      if (Object.values(UiLanguage).includes(value?.language)) result.language = value.language;
      for (const group of ["features", "sources", "pinnedActions"]) {
        const defaults = result[group];
        for (const key of Object.keys(defaults)) {
          if (typeof value?.[group]?.[key] === "boolean") defaults[key] = value[group][key];
        }
      }
      return result;
    }

    /** @returns {SettingsPreferenceRecord} Saved preferences or defaults when unavailable. */
    static read() {
      try {
        return SettingsPreference.normalize(JSON.parse(window.localStorage.getItem(SETTINGS_STORAGE_KEY)));
      } catch (_error) {
        return SettingsPreference.defaults();
      }
    }

    /**
     * Writes validated preferences; false means the caller must retain page-only state.
     * @param {SettingsPreferenceRecord} preferences
     * @returns {boolean}
     */
    static write(preferences) {
      try {
        window.localStorage.setItem(SETTINGS_STORAGE_KEY,
          JSON.stringify(SettingsPreference.normalize(preferences)));
        return true;
      } catch (_error) {
        return false;
      }
    }
  }

  /**
   * Stores the preferred comment pane width across page loads.
   */
  class CommentPaneWidthPreference {
    /**
     * Returns the saved comment pane width.
     *
     * @returns {number | null}
     */
    static read() {
      try {
        const width = Number(
          window.localStorage.getItem(COMMENT_PANE_WIDTH_STORAGE_KEY)
        );

        return CommentPaneWidthPreference.isValidWidth(width) ? width : null;
      } catch (_error) {
        return null;
      }
    }

    /**
     * Persists the preferred comment pane width.
     *
     * @param {number} width
     */
    static write(width) {
      if (!CommentPaneWidthPreference.isValidWidth(width)) {
        return;
      }

      try {
        window.localStorage.setItem(
          COMMENT_PANE_WIDTH_STORAGE_KEY,
          String(Math.round(width))
        );
      } catch (_error) {
        return;
      }
    }

    /**
     * Returns true when a stored width is inside the supported range.
     *
     * @param {number} width
     * @returns {boolean}
     */
    static isValidWidth(width) {
      return (
        Number.isFinite(width) &&
        width >= storageConfig.commentPaneMinWidth &&
        width <= storageConfig.commentPaneMaxWidth
      );
    }
  }

  /** Stores the last selected favorite folder separately for each Bilibili account. */
  class FavoriteFolderPreference {
    /** @param {unknown} value @returns {string | null} Positive decimal API identity. */
    static normalizeId(value) {
      const text = typeof value === "number" && Number.isSafeInteger(value)
        ? String(value) : typeof value === "string" ? value : "";
      return /^[1-9]\d*$/u.test(text) ? text : null;
    }

    /** @param {string} accountId @returns {string | null} */
    static read(accountId) {
      if (!this.normalizeId(accountId)) return null;
      try {
        return this.normalizeId(window.localStorage.getItem(FAVORITE_FOLDER_STORAGE_PREFIX + accountId));
      } catch (_error) { return null; }
    }

    /** @param {string} accountId @param {string | null} folderId */
    static write(accountId, folderId) {
      if (!this.normalizeId(accountId)) return;
      try {
        const key = FAVORITE_FOLDER_STORAGE_PREFIX + accountId;
        if (this.normalizeId(folderId)) window.localStorage.setItem(key, folderId);
        else window.localStorage.removeItem(key);
      } catch (_error) { /* The current session retains the selection. */ }
    }
  }

  /** Validates source routes and retains a folder identity only for Favorites. */
  class SourceRoute {
    /** @param {object} route @returns {{ sourceKind: string, folderId?: string } | null} */
    static normalize(route) {
      if (!storageConfig.sourceOrder.includes(route?.sourceKind)) return null;
      const result = { sourceKind: route.sourceKind };
      if (route.sourceKind === storageConfig.favoritesKind && route.folderId != null) {
        const folderId = FavoriteFolderPreference.normalizeId(route.folderId);
        if (!folderId) return null;
        result.folderId = folderId;
      }
      return result;
    }
  }

  /**
   * Stores a tab-scoped video-card navigation origin across document loads.
   */
  class CardNavigationOriginStore {
    /**
     * Persists one pending origin route for the clicked target route.
     *
     * @param {{ sourceKind: string, folderId?: string }} route
     * @param {string} targetRouteKey
     * @param {NavigationGeometry | null} [geometry]
     */
    static write(route, targetRouteKey, geometry = null) {
      const normalized = SourceRoute.normalize(route);
      if (
        !normalized ||
        !targetRouteKey
      ) {
        return;
      }

      try {
        const record = {
          ...normalized,
          targetRouteKey,
          createdAt: Date.now(),
          geometry: CardNavigationOriginStore.validGeometry(geometry)
        };
        window.sessionStorage.setItem(
          CARD_NAVIGATION_ORIGIN_STORAGE_KEY,
          JSON.stringify(record)
        );
      } catch (_error) {
        return;
      }
    }

    /**
     * Returns and clears the pending origin when it matches the current route.
     *
     * @param {string | null} currentRouteKey
     * @returns {{ sourceKind: string, folderId?: string } | null}
     */
    static take(currentRouteKey) {
      const record = CardNavigationOriginStore.read();
      CardNavigationOriginStore.clear();

      if (
        !record ||
        !currentRouteKey ||
        record.targetRouteKey !== currentRouteKey
      ) {
        return null;
      }

      return SourceRoute.normalize(record);
    }

    /**
     * Reads a valid unexpired origin record.
     *
     * @returns {CardNavigationOriginRecord | null}
     */
    static read() {
      try {
        const raw = window.sessionStorage.getItem(
          CARD_NAVIGATION_ORIGIN_STORAGE_KEY
        );

        if (!raw) {
          return null;
        }

        const record = JSON.parse(raw);

        if (!CardNavigationOriginStore.isFresh(record)) {
          return null;
        }

        return {
          ...SourceRoute.normalize(record),
          targetRouteKey: record.targetRouteKey,
          createdAt: Number(record.createdAt),
          geometry: CardNavigationOriginStore.validGeometry(record.geometry)
        };
      } catch (_error) {
        return null;
      }
    }

    /**
     * Keeps bounded pane dimensions for the next document's loading surface.
     *
     * @param {NavigationGeometry | null | undefined} geometry
     * @returns {NavigationGeometry | null}
     */
    static validGeometry(geometry) {
      const commentWidth = geometry?.commentWidth;
      const dockHeight = geometry?.dockHeight;
      if (
        !Number.isFinite(commentWidth) || commentWidth < 0 || commentWidth > 640 ||
        !Number.isFinite(dockHeight) || dockHeight < 0 || dockHeight > 400
      ) {
        return null;
      }
      return { commentWidth, dockHeight };
    }

    /**
     * Returns true when an origin record is valid for the current tab.
     *
     * @param {CardNavigationOriginRecord | Record<string, unknown> | null | undefined}
     * record
     * @returns {boolean}
     */
    static isFresh(record) {
      const age = Date.now() - Number(record?.createdAt);

      return (
        Boolean(SourceRoute.normalize(record)) &&
        typeof record?.targetRouteKey === "string" &&
        Boolean(record.targetRouteKey) &&
        Number.isFinite(age) &&
        age >= 0 &&
        age <= CARD_NAVIGATION_ORIGIN_TTL_MS
      );
    }

    /**
     * Clears the pending tab-scoped origin route.
     */
    static clear() {
      try {
        window.sessionStorage.removeItem(CARD_NAVIGATION_ORIGIN_STORAGE_KEY);
      } catch (_error) {
        return;
      }
    }
  }

  /**
   * Stores the tab-scoped source route for the current watch route.
   */
  class SourceRouteStateStore {
    /**
     * Persists the selected source route for one watch route.
     *
     * @param {string | null} pageRouteKey
     * @param {SourceRouteState} state
     */
    static write(pageRouteKey, state) {
      const route = SourceRoute.normalize(state);
      if (
        !pageRouteKey ||
        !route ||
        typeof state?.isRailOpen !== "boolean"
      ) {
        return;
      }

      try {
        const record = {
          pageRouteKey,
          ...route,
          isRailOpen: state.isRailOpen
        };
        window.sessionStorage.setItem(
          SOURCE_ROUTE_STATE_STORAGE_KEY,
          JSON.stringify(record)
        );
      } catch (_error) {
        return;
      }
    }

    /**
     * Reads the source route state for the current watch route.
     *
     * @param {string | null} pageRouteKey
     * @returns {SourceRouteState | null}
     */
    static read(pageRouteKey) {
      if (!pageRouteKey) {
        return null;
      }

      try {
        const raw = window.sessionStorage.getItem(
          SOURCE_ROUTE_STATE_STORAGE_KEY
        );

        if (!raw) {
          return null;
        }

        const record = JSON.parse(raw);

        if (
          record?.pageRouteKey !== pageRouteKey ||
          !SourceRoute.normalize(record) ||
          typeof record?.isRailOpen !== "boolean"
        ) {
          return null;
        }

        return {
          ...SourceRoute.normalize(record),
          isRailOpen: record.isRailOpen
        };
      } catch (_error) {
        return null;
      }
    }
  }

  /**
   * @typedef {object} StorageStateConfig
   * @property {string[]} [sourceOrder] Closed source kind order.
   * @property {string} [favoritesKind] Source kind that carries a folder identity.
   * @property {Record<string, boolean>} [actionDefaults] Default placement for each action kind.
   * @property {number} [commentPaneMinWidth] Minimum stored comment pane width.
   * @property {number} [commentPaneMaxWidth] Maximum stored comment pane width.
   */

  /**
   * @typedef {object} CardNavigationOriginRecord
   * @property {string} sourceKind Closed source kind to select on arrival.
   * @property {string} [folderId] Favorite folder to select on arrival.
   * @property {string} targetRouteKey Watch route key the click opened.
   * @property {number} createdAt Milliseconds since epoch when recorded.
   * @property {NavigationGeometry | null} [geometry] Previous layout dimensions.
   */

  /**
   * @typedef {object} NavigationGeometry
   * @property {number} commentWidth Visible comment column width, or zero.
   * @property {number} dockHeight Visible dock height, or zero.
   */

  /**
   * @typedef {object} SourceRouteState
   * @property {string} sourceKind Closed source kind selected in the rail.
   * @property {string} [folderId] Selected favorite folder.
   * @property {boolean} isRailOpen Whether the selected route is expanded.
   */

  /**
   * @typedef {object} SettingsPreferenceRecord
   * @property {string | null} language Supported UI language; null uses automatic detection.
   * @property {{ description: boolean, thumbnails: boolean, favoriteToSelectedFolder: boolean, moreButton: boolean }} features Optional presentations and action behavior.
   * @property {Record<string, boolean>} sources Enabled source kinds.
   * @property {Record<string, boolean>} pinnedActions True places an action on the bar; false uses More.
   */

  /**
   * Stable storage helpers loaded before the main content-script runtime.
   */
  window.__bibililiStorageState = Object.freeze({
    ActivationPreference,
    CardNavigationOriginStore,
    CommentPaneWidthPreference,
    FavoriteFolderPreference,
    SourceRoute,
    SourceRouteStateStore,
    SettingsPreference,
    configure
  });
})();
