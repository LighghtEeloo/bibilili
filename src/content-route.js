(() => {
  "use strict";

  const BILIBILI_WEB_ORIGIN = "https://www.bilibili.com";

  /**
   * Resolves Bilibili watch routes into stable extension route records.
   */
  class BilibiliRoute {
    /**
     * Returns the current document URL when one is available.
     *
     * @returns {string}
     */
    static defaultBaseHref() {
      return typeof globalThis.location?.href === "string"
        ? globalThis.location.href
        : BILIBILI_WEB_ORIGIN;
    }

    /**
     * Returns the normalized playable URL from raw URL-like text.
     *
     * @param {string | null | undefined} rawHref
     * @param {string} [baseHref]
     * @returns {string | null}
     */
    static normalizedVideoUrl(rawHref, baseHref = BilibiliRoute.defaultBaseHref()) {
      const raw = (rawHref ?? "").trim();

      if (!raw || /^javascript:/iu.test(raw)) {
        return null;
      }

      try {
        const url = new URL(raw, baseHref);

        if (url.protocol !== "http:" && url.protocol !== "https:") {
          return null;
        }

        return BilibiliRoute.isPlayableUrl(url, baseHref) ? url.href : null;
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
      const bvid = BilibiliRoute.cleanBvid(params.bvid);
      const aid = BilibiliRoute.cleanAid(params.aid);

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
     * Normalizes Bilibili BV ids from route or data values.
     *
     * @param {string | null | undefined} value
     * @returns {string | null}
     */
    static cleanBvid(value) {
      const text = (value ?? "").trim();
      return /^BV[0-9A-Za-z]+$/u.test(text) ? text : null;
    }

    /**
     * Normalizes Bilibili numeric archive ids from route or data values.
     *
     * @param {string | null | undefined} value
     * @returns {string | null}
     */
    static cleanAid(value) {
      const text = (value ?? "").trim().replace(/^av/iu, "");
      return /^\d+$/u.test(text) ? text : null;
    }

    /**
     * Returns true for Bilibili routes that open a playable watch target.
     *
     * @param {URL} url
     * @param {string} [baseHref]
     * @returns {boolean}
     */
    static isPlayableUrl(url, baseHref = BilibiliRoute.defaultBaseHref()) {
      return (
        url.hostname === "www.bilibili.com" &&
        Boolean(BilibiliRoute.playableIdentityForUrl(url, baseHref))
      );
    }

    /**
     * Returns a stable identity for a playable Bilibili URL.
     *
     * @param {string | URL} value
     * @param {string} [baseHref]
     * @returns {string | null}
     */
    static playableIdentityForUrl(value, baseHref = BilibiliRoute.defaultBaseHref()) {
      try {
        const url = BilibiliRoute.urlFor(value, baseHref);

        if (url.hostname !== "www.bilibili.com") {
          return null;
        }

        const path = url.pathname.replace(/\/+$/u, "");
        const videoMatch = path.match(/^\/video\/(BV[0-9A-Za-z]+|av\d+)$/iu);

        if (videoMatch) {
          const videoId = videoMatch[1];
          const normalizedId =
            /^av/iu.test(videoId) ? videoId.toLowerCase() : videoId;

          return `video:${normalizedId}`;
        }

        const bangumiMatch = path.match(
          /^\/bangumi\/play\/((?:ep|ss|md)\d+)$/iu
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
     * Returns the archive identity needed for video-info cover fetches.
     *
     * @param {string | URL} value
     * @param {string} [baseHref]
     * @returns {ArchiveVideoIdentity | null}
     */
    static archiveIdentityForUrl(value, baseHref = BilibiliRoute.defaultBaseHref()) {
      try {
        const url = BilibiliRoute.urlFor(value, baseHref);

        if (url.hostname !== "www.bilibili.com") {
          return null;
        }

        const path = url.pathname.replace(/\/+$/u, "");
        const match = path.match(/^\/video\/(BV[0-9A-Za-z]+|av\d+)$/iu);

        if (!match) {
          return null;
        }

        const videoId = match[1];
        const bvid = BilibiliRoute.cleanBvid(videoId);

        if (bvid) {
          return {
            key: `bvid:${bvid}`,
            queryName: "bvid",
            queryValue: bvid
          };
        }

        const aid = BilibiliRoute.cleanAid(videoId);

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
     * Returns a watch route key that distinguishes archive pages within one BV.
     *
     * @param {string | URL} value
     * @param {string} [baseHref]
     * @returns {string | null}
     */
    static watchRouteKeyForUrl(value, baseHref = BilibiliRoute.defaultBaseHref()) {
      try {
        const url = BilibiliRoute.urlFor(value, baseHref);
        const identity = BilibiliRoute.playableIdentityForUrl(url, baseHref);

        if (!identity) {
          return null;
        }

        if (identity.startsWith("video:")) {
          return `${identity}:p${BilibiliRoute.videoPageForUrl(url)}`;
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
     * Parses a URL-like value against a base URL.
     *
     * @param {string | URL} value
     * @param {string} baseHref
     * @returns {URL}
     */
    static urlFor(value, baseHref) {
      return value instanceof URL ? value : new URL(value, baseHref);
    }
  }

  /**
   * @typedef {object} ArchiveVideoIdentity
   * @property {string} key Per-session preview cache key.
   * @property {"bvid" | "aid"} queryName Bilibili video-info query name.
   * @property {string} queryValue Bilibili archive id query value.
   */

  globalThis.__bibililiRoute = Object.freeze({
    BILIBILI_WEB_ORIGIN,
    BilibiliRoute
  });
})();
