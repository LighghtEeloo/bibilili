(() => {
  "use strict";

  const REQUEST_EVENT = "bibilili:video-navigation-request";
  const RESULT_EVENT = "bibilili:video-navigation-result";
  const COMMENTS_READY_EVENT = "bibilili:comments-ready-check";
  const WATCH_PATH_PATTERN = /^\/video\/(BV[0-9A-Za-z]+|av\d+)\/?$/u;

  /**
   * Invokes the page-owned player's archive reload API in the page world.
   * Also reads native comment readiness without changing the comment lifecycle.
   * This bridge exposes no extension APIs.
   */
  class PageVideoNavigation {
    /** Registers playback requests and read-only comment readiness probes. */
    constructor() {
      this.handler = (event) => this.handleRequest(event);
      this.commentsHandler = (event) => this.handleCommentsCheck(event);
      document.addEventListener(REQUEST_EVENT, this.handler);
      document.addEventListener(COMMENTS_READY_EVENT, this.commentsHandler, true);
    }

    /** Removes this installation's listeners before replacement. */
    stop() {
      document.removeEventListener(REQUEST_EVENT, this.handler);
      document.removeEventListener(COMMENTS_READY_EVENT, this.commentsHandler, true);
    }

    /**
     * Acknowledges a rendered comment thread belonging to the visible archive.
     *
     * Note: Bilibili leaves data-params at its initial archive after reload().
     * The live oid and showSpinner properties belong to the page world. The
     * spinner can finish before Lit commits its content, so both are checked.
     * Empty and closed threads render #contents too; no comment rows are required.
     *
     * @param {Event} event
     */
    handleCommentsCheck(event) {
      const root = event.target;
      const comments = root?.matches?.("bili-comments")
        ? root : root?.querySelector?.("bili-comments");
      if (!comments?.isConnected || typeof window.player?.getManifest !== "function") return;
      let manifest;
      try {
        manifest = window.player.getManifest();
      } catch (_error) {
        // Note: The native player may temporarily lack a manifest during reload.
        return;
      }
      const url = new URL(window.location.href);
      const routeId = url.pathname.match(WATCH_PATH_PATTERN)?.[1];
      if (
        !manifest?.aid || Number(comments.type) !== 1 ||
        String(comments.oid) !== String(manifest.aid) ||
        (routeId !== manifest.bvid && routeId !== `av${manifest.aid}`) ||
        Number(url.searchParams.get("p") || 1) !== Number(manifest.p) ||
        comments.showSpinner !== false || comments.isUpdatePending ||
        !comments.shadowRoot?.querySelector("#contents") ||
        comments.shadowRoot.querySelector("#spinner-container")
      ) return;
      event.preventDefault();
    }

    /**
     * Validates the cross-world message and acknowledges an available native player.
     *
     * @param {CustomEvent<string>} event
     */
    handleRequest(event) {
      if (
        typeof event.detail !== "string" || event.detail.length > 1024 ||
        window.location.origin !== "https://www.bilibili.com" ||
        !WATCH_PATH_PATTERN.test(window.location.pathname)
      ) return;
      let request;
      try {
        request = JSON.parse(event.detail);
      } catch (_error) {
        return;
      }
      const target = PageVideoNavigation.readTarget(request?.target);
      const player = window.player;
      if (
        typeof request?.id !== "string" || !request.id || request.id.length > 64 || !target ||
        typeof player?.reload !== "function" || typeof player.getManifest !== "function" ||
        !window.nano?.EventType?.Player_LoadedMetadata
      ) return;

      event.preventDefault();
      void this.navigate(request.id, target, player);
    }

    /**
     * Copies the supported player inputs out of an untrusted message record.
     *
     * @param {NativePlaybackTarget | null | undefined} input
     * @returns {NativePlaybackTarget | null}
     */
    static readTarget(input) {
      if (!Number.isSafeInteger(input?.p) || input.p < 1) return null;
      const target = { p: input.p };
      if (typeof input.bvid === "string" && /^BV[0-9A-Za-z]+$/u.test(input.bvid)) {
        target.bvid = input.bvid;
      } else if (Number.isSafeInteger(input.aid) && input.aid > 0) {
        target.aid = input.aid;
      } else {
        return null;
      }
      if (Number.isFinite(input.t) && input.t >= 0) target.t = input.t;
      return target;
    }

    /**
     * Lets Bilibili resolve IDs, replace playback, refresh the page, and write history.
     *
     * Note: The native player fills missing aid/cid from a BV or AV identifier.
     * Its LoadedMetadata and Canplay handlers update the watch page and cid cache.
     * Changing browser history directly would bypass that native lifecycle.
     *
     * @param {string} id
     * @param {NativePlaybackTarget} target
     * @param {{ reload: Function, getManifest: Function }} player
     */
    async navigate(id, target, player) {
      let success = false;
      try {
        const loaded = await player.reload(target);
        // Note: Bilibili's router commits the native metadata event asynchronously.
        await new Promise((resolve) => window.setTimeout(resolve, 0));
        const manifest = player.getManifest();
        const url = new URL(window.location.href);
        const routeId = url.pathname.match(WATCH_PATH_PATTERN)?.[1];
        const page = Number(url.searchParams.get("p") || 1);
        const requestedArchive = target.bvid
          ? manifest.bvid === target.bvid : Number(manifest.aid) === target.aid;
        const landedArchive = routeId === manifest.bvid || routeId === `av${manifest.aid}`;
        success = loaded !== false && window.player === player && requestedArchive &&
          Number(manifest.p) === target.p && landedArchive && page === target.p;
      } catch (_error) {
        // Native API absence, rejection, and playback failure use normal navigation.
      }
      document.dispatchEvent(new CustomEvent(RESULT_EVENT, {
        detail: JSON.stringify({ id, success, url: window.location.href })
      }));
    }
  }

  window.__bibililiPageNavigation?.stop();
  window.__bibililiPageNavigation = new PageVideoNavigation();
})();
