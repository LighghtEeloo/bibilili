(() => {
  "use strict";

  const { BILIBILI_WEB_ORIGIN, BilibiliRoute } = window.__bibililiRoute;
  const { UiStrings } = window.__bibililiI18n;
  const REQUEST_EVENT = "bibilili:video-navigation-request";
  const RESULT_EVENT = "bibilili:video-navigation-result";
  const PAGE_SCRIPT_PATH = "src/page-navigation.js";
  const NAVIGATION_TIMEOUT_MS = 10000;

  /**
   * Hands archive navigation to the page-owned player across execution worlds.
   * One active request owns fallback; a newer click or cancellation retires it.
   */
  class NativeVideoNavigation {
    /** @param {Document} document */
    constructor(document) {
      this.document = document;
      this.script = null;
      this.ready = false;
      /** @type {PendingVideoNavigation | null} */
      this.pending = null;
      this.resultHandler = null;
    }

    /** Loads the packaged page bridge once the document root is available. */
    start() {
      const runtime = UiStrings.extensionRuntime();
      if (this.script || !this.document.documentElement || !runtime?.getURL) {
        return;
      }
      this.resultHandler = (event) => this.handleResult(event);
      this.document.addEventListener(RESULT_EVENT, this.resultHandler);
      const script = this.document.createElement("script");
      script.src = runtime.getURL(PAGE_SCRIPT_PATH);
      script.onload = () => { this.ready = true; };
      script.onerror = () => { this.ready = false; };
      this.script = script;
      this.document.documentElement.append(script);
    }

    /**
     * Starts a native handoff, returning whether the original link is consumed.
     *
     * @param {string} targetUrl
     * @param {(success: boolean, landedUrl: string | null) => void} onResult
     * @returns {boolean}
     */
    navigate(targetUrl, onResult) {
      this.cancel();
      const target = NativeVideoNavigation.targetForUrl(targetUrl);
      if (!this.ready || !target) {
        return false;
      }
      const request = {
        id: window.crypto.randomUUID(),
        originRouteKey: BilibiliRoute.watchRouteKeyForUrl(window.location.href),
        targetRouteKey: BilibiliRoute.watchRouteKeyForUrl(targetUrl),
        timer: null,
        onResult
      };
      this.pending = request;
      request.timer = window.setTimeout(() => this.finish(false), NAVIGATION_TIMEOUT_MS);

      // Note: Firefox requires a string detail when crossing execution worlds.
      const event = new CustomEvent(REQUEST_EVENT, {
        cancelable: true,
        detail: JSON.stringify({ id: request.id, target })
      });
      this.document.dispatchEvent(event);
      if (!event.defaultPrevented) {
        this.cancel();
        return false;
      }
      return true;
    }

    /**
     * Converts a same-origin archive URL into the player's narrow input shape.
     *
     * @param {string} targetUrl
     * @returns {NativePlaybackTarget | null}
     */
    static targetForUrl(targetUrl) {
      try {
        const current = new URL(window.location.href);
        const url = new URL(targetUrl, current);
        const identity = BilibiliRoute.archiveIdentityForUrl(url);
        if (
          current.origin !== BILIBILI_WEB_ORIGIN || url.origin !== current.origin ||
          url.username || url.password || !identity ||
          !BilibiliRoute.archiveIdentityForUrl(current)
        ) {
          return null;
        }
        const target = { p: BilibiliRoute.videoPageForUrl(url) };
        if (identity.queryName === "bvid") {
          target.bvid = identity.queryValue;
        } else {
          target.aid = Number(identity.queryValue);
          if (!Number.isSafeInteger(target.aid) || target.aid <= 0) return null;
        }
        const time = Number(url.searchParams.get("t"));
        if (url.searchParams.has("t") && Number.isFinite(time) && time >= 0) {
          target.t = time;
        }
        return target;
      } catch (_error) {
        return null;
      }
    }

    /**
     * Accepts only the response for the latest navigation request.
     *
     * @param {CustomEvent<string>} event
     */
    handleResult(event) {
      if (!this.pending || typeof event.detail !== "string") return;
      let result;
      try {
        result = JSON.parse(event.detail);
      } catch (_error) {
        return;
      }
      if (result?.id !== this.pending.id || typeof result.success !== "boolean") return;
      const landedUrl = typeof result.url === "string" && result.url === window.location.href
        ? result.url : null;
      this.finish(result.success && Boolean(landedUrl), landedUrl);
    }

    /**
     * Settles the current request and suppresses fallback after another route wins.
     *
     * @param {boolean} success
     * @param {string | null} [landedUrl]
     */
    finish(success, landedUrl = null) {
      const request = this.pending;
      if (!request) return;
      this.cancel();
      const currentRouteKey = BilibiliRoute.watchRouteKeyForUrl(window.location.href);
      if (
        success || currentRouteKey === request.originRouteKey ||
        currentRouteKey === request.targetRouteKey
      ) {
        request.onResult(success, landedUrl);
      }
    }

    /** Retires pending callbacks without changing Bilibili's playback state. */
    cancel() {
      if (this.pending) window.clearTimeout(this.pending.timer);
      this.pending = null;
    }

    /** Removes the content-side listener and its owned script element. */
    stop() {
      this.cancel();
      if (this.resultHandler) {
        this.document.removeEventListener(RESULT_EVENT, this.resultHandler);
      }
      this.resultHandler = null;
      if (this.script) {
        this.script.onload = null;
        this.script.onerror = null;
        this.script.remove();
      }
      this.script = null;
      this.ready = false;
    }
  }

  /**
   * @typedef {object} NativePlaybackTarget
   * @property {string} [bvid] Archive BV identifier.
   * @property {number} [aid] Numeric archive identifier when no BV is supplied.
   * @property {number} p One-based archive part.
   * @property {number} [t] Requested playback time in seconds.
   */

  /**
   * @typedef {object} PendingVideoNavigation
   * @property {string} id Request correlation identifier.
   * @property {string | null} originRouteKey Route allowed to initiate fallback.
   * @property {string | null} targetRouteKey Destination allowed to retry a failed handoff.
   * @property {number | null} timer Bounded native handoff deadline.
   * @property {(success: boolean, landedUrl: string | null) => void} onResult
   */

  window.__bibililiNavigation = Object.freeze({ NativeVideoNavigation });
})();
