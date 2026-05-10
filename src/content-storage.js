(() => {
  "use strict";

  const ENABLED_STORAGE_KEY = "bibilili:enabled";
  const CARD_NAVIGATION_ORIGIN_STORAGE_KEY =
    "bibilili:card-navigation-origin";
  const SOURCE_ROUTE_STATE_STORAGE_KEY = "bibilili:source-route-state";
  const COMMENT_PANE_WIDTH_STORAGE_KEY = "bibilili:comment-pane-width";
  const CARD_NAVIGATION_ORIGIN_TTL_MS = 120000;

  let storageConfig = Object.freeze({
    sourceOrder: Object.freeze([]),
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
      commentPaneMinWidth: config.commentPaneMinWidth ?? 0,
      commentPaneMaxWidth:
        config.commentPaneMaxWidth ?? Number.MAX_SAFE_INTEGER
    });
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

  /**
   * Stores a tab-scoped video-card navigation origin across document loads.
   */
  class CardNavigationOriginStore {
    /**
     * Persists one pending origin route for the clicked target route.
     *
     * @param {string} sourceKind
     * @param {string} targetRouteKey
     */
    static write(sourceKind, targetRouteKey) {
      if (
        !CardNavigationOriginStore.isValidSourceKind(sourceKind) ||
        !targetRouteKey
      ) {
        return;
      }

      try {
        const record = {
          sourceKind,
          targetRouteKey,
          createdAt: Date.now()
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
     * @returns {string | null}
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

      return record.sourceKind;
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
          sourceKind: record.sourceKind,
          targetRouteKey: record.targetRouteKey,
          createdAt: Number(record.createdAt)
        };
      } catch (_error) {
        return null;
      }
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
        CardNavigationOriginStore.isValidSourceKind(record?.sourceKind) &&
        typeof record?.targetRouteKey === "string" &&
        Boolean(record.targetRouteKey) &&
        Number.isFinite(age) &&
        age >= 0 &&
        age <= CARD_NAVIGATION_ORIGIN_TTL_MS
      );
    }

    /**
     * Returns true when a source kind is part of the configured closed set.
     *
     * @param {unknown} sourceKind
     * @returns {sourceKind is string}
     */
    static isValidSourceKind(sourceKind) {
      return (
        typeof sourceKind === "string" &&
        storageConfig.sourceOrder.includes(sourceKind)
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
      if (
        !pageRouteKey ||
        !CardNavigationOriginStore.isValidSourceKind(state?.sourceKind) ||
        typeof state?.isRailOpen !== "boolean"
      ) {
        return;
      }

      try {
        const record = {
          pageRouteKey,
          sourceKind: state.sourceKind,
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
          !CardNavigationOriginStore.isValidSourceKind(record?.sourceKind) ||
          typeof record?.isRailOpen !== "boolean"
        ) {
          return null;
        }

        return {
          sourceKind: record.sourceKind,
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
   * @property {number} [commentPaneMinWidth] Minimum stored comment pane width.
   * @property {number} [commentPaneMaxWidth] Maximum stored comment pane width.
   */

  /**
   * @typedef {object} CardNavigationOriginRecord
   * @property {string} sourceKind Closed source kind to select on arrival.
   * @property {string} targetRouteKey Watch route key the click opened.
   * @property {number} createdAt Milliseconds since epoch when recorded.
   */

  /**
   * @typedef {object} SourceRouteState
   * @property {string} sourceKind Closed source kind selected in the rail.
   * @property {boolean} isRailOpen Whether the selected route is expanded.
   */

  /**
   * Stable storage helpers loaded before the main content-script runtime.
   */
  window.__bibililiStorageState = Object.freeze({
    ActivationPreference,
    CardNavigationOriginStore,
    CommentPaneWidthPreference,
    SourceRouteStateStore,
    configure
  });
})();
