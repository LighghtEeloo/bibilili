(() => {
  "use strict";

  const OWNED_SURFACE_SELECTOR =
    "#bibilili-layout-root, #bibilili-toggle-root";

  /**
   * Utility methods for querying page-owned DOM while avoiding extension-owned
   * surfaces.
   */
  class DomProbe {
    /**
     * Returns true when the node is an Element.
     *
     * @param {Node | Element | null | undefined} node
     * @returns {node is Element}
     */
    static isElement(node) {
      if (!node) {
        return false;
      }

      return typeof Element === "function"
        ? node instanceof Element
        : typeof node.closest === "function";
    }

    /**
     * Returns true when an element is inside an extension-owned surface.
     *
     * @param {Element | Node | null | undefined} node
     * @returns {boolean}
     */
    static isOwned(node) {
      const element = DomProbe.elementFor(node);

      if (!element) {
        return false;
      }

      return Boolean(element.closest(OWNED_SURFACE_SELECTOR));
    }

    /**
     * Queries all elements matching a selector.
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

    /**
     * Returns the element to test for an arbitrary DOM node.
     *
     * @param {Element | Node | null | undefined} node
     * @returns {Element | null}
     */
    static elementFor(node) {
      if (DomProbe.isElement(node)) {
        return node;
      }

      return node?.parentElement ?? null;
    }
  }

  /**
   * Stable DOM helpers loaded before i18n and the main content-script runtime.
   */
  globalThis.__bibililiDom = Object.freeze({
    DomProbe
  });
})();
