(() => {
  "use strict";

  /**
   * Tracks page-owned nodes that are temporarily moved into extension panes.
   *
   * The placeholder comment is the authoritative native restore point.
   * Note: Bilibili can remove that point during navigation, so restoration
   * falls back to appending the still-owned node to the document body when the
   * node would otherwise remain stranded inside a removed layout root.
   */
  class MovedPageNodeStore {
    /**
     * Creates a moved-node registry for one document.
     *
     * @param {Document} document
     */
    constructor(document) {
      this.document = document;
      /** @type {Map<Element, Comment>} */
      this.placeholders = new Map();
    }

    /**
     * Moves one page-owned node into an extension pane.
     *
     * The first move records the node's native parent position. Later moves of
     * the same node keep that original position so reconciliation can re-home a
     * node without losing the native restore target.
     *
     * @param {Element} node
     * @param {Element} pane
     * @param {string} placeholderName
     */
    move(node, pane, placeholderName) {
      if (node.parentElement === pane) {
        return;
      }

      if (!this.placeholders.has(node) && node.parentNode) {
        const placeholder = this.document.createComment(
          `bibilili ${placeholderName}`
        );
        node.parentNode.insertBefore(placeholder, node);
        this.placeholders.set(node, placeholder);
      }

      pane.replaceChildren(node);
    }

    /**
     * Restores one page-owned node to its native position when possible.
     *
     * @param {Element | null} node
     * @param {Element | null} ownerRoot
     */
    restore(node, ownerRoot) {
      if (!node) {
        return;
      }

      const placeholder = this.placeholders.get(node);
      this.placeholders.delete(node);

      if (placeholder?.isConnected && placeholder.parentNode) {
        placeholder.parentNode.insertBefore(node, placeholder);
        placeholder.remove();
        return;
      }

      if (ownerRoot?.contains(node)) {
        this.document.body.append(node);
      }
    }
  }

  /**
   * Applies and removes the source-root bookkeeping attribute.
   *
   * The marker is the stylesheet's only authority for hiding page-owned source
   * roots. It is applied only to roots from extracted source records and is
   * cleared before each new source pass.
   */
  class SourceRootMarker {
    /**
     * Creates a source-root marker using the configured attribute name.
     *
     * @param {string} attributeName
     */
    constructor(attributeName) {
      this.attributeName = attributeName;
      /** @type {Set<Element>} */
      this.roots = new Set();
    }

    /**
     * Marks the page-owned roots represented by the current source records.
     *
     * @param {MarkedSourceRoot[]} sources
     */
    mark(sources) {
      this.unmark();

      for (const source of sources) {
        if (!source.root) {
          continue;
        }

        source.root.setAttribute(this.attributeName, source.kind);
        this.roots.add(source.root);
      }
    }

    /**
     * Removes markers from roots marked by previous reconciliation passes.
     */
    unmark() {
      for (const root of this.roots) {
        root.removeAttribute(this.attributeName);
      }

      this.roots.clear();
    }
  }

  /**
   * @typedef {object} MarkedSourceRoot
   * @property {Element | null} root Page-owned source root when present.
   * @property {string} kind Closed source kind written to the marker.
   */

  /**
   * Stable helpers loaded before the main content-script runtime.
   *
   * The main runtime treats this namespace as required startup state so a
   * manifest ordering error fails visibly during development.
   */
  window.__bibililiLayoutState = Object.freeze({
    MovedPageNodeStore,
    SourceRootMarker
  });
})();
