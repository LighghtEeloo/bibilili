# Repository Guidelines

> `CLAUDE.md` is a symlink to this file. Do not edit `CLAUDE.md` directly -- edit `AGENTS.md` instead.

Bibilili is a Chrome Manifest V3 extension for Bilibili watch pages. The extension is currently a no-build project made of `manifest.json`, `src/content.js`, `src/content.css`, and `DESIGN.md`.

Above all: keep the implementation aligned with `DESIGN.md` and keep design knowledge close to the code that implements it. Use concise JSDoc comments for classes, methods, object shapes, and unusual DOM compromises. Write `Note: ` in a comment when a selector, fallback, or lifecycle rule exists because of Bilibili page behavior rather than local design preference.

Prefer a clean implementation over compatibility layers. Do not add migration shims, build tooling, frameworks, package managers, or generated artifacts unless the task explicitly requires them.

## Documentation and Language

Actively document the program. Public extension concepts, object shapes, controller classes, and lifecycle methods should have concise JSDoc.

All written documentation must be clear, accurate, and in English unless explicitly stated. No emojis unless strictly necessary. Add bold text only when it emphasizes truly valuable information.

Prefer direct definitions over defensive framing.
- Define what the system does before explaining limits or exclusions.
- Keep definition-by-negation to a minimum; use it only when a nearby confusion is likely and the contrast is genuinely clarifying.
- Avoid prose that reads like a rebuttal, disclaimer, or argument with an imaginary reviewer.
- When documenting a constraint, state the positive rule first, then the consequence if needed.

### Canonical Documentation

- `DESIGN.md` defines product and architecture intent.
- `src/content.js` JSDoc documents implementation concepts, invariants, and lifecycle details.
- `src/content.css` should stay readable through clear selectors and stable class names rather than large comment blocks.
- Do not add a standalone `docs/` tree as the canonical source unless the project scope changes.

## DESIGN.md

Before and after any edit to `DESIGN.md`, evaluate the document as a reader.
- Is the structure clear and logically ordered?
- Does the prose read like it was written by a knowledgeable practitioner, not like generated text?
- Are there redundant or overlapping sections that should be merged or reordered?

When writing `DESIGN.md`, use this style:
- Declarative, dry, precise.
- Each paragraph does one thing: introduces a concept, states its properties, and stops.
- No motivational framing, rhetoric, or implementation diary.
- Terms are introduced once and then trusted to carry themselves.
- The voice is impersonal but not bureaucratic.
- Sentences are structurally simple, favoring short main clauses over nested subordination.
- Analogies appear sparingly and only to established programming-language concepts, never to everyday metaphors.

## Extension Architecture

The content script is the extension runtime. It discovers page-owned regions, moves the player and comments into extension-owned panes, extracts video-list data, and renders the bottom dock.

Respect DOM ownership:
- Bibilili owns the layout root, stage, panes, source bar, list rail, video cards, extension classes, and bookkeeping attributes.
- Bilibili owns the player, comments, list roots, links, controls, and network-backed page content.
- The extension may move page-owned player and comment nodes into extension containers.
- The extension must not replace player controls, comment controls, playback logic, or Bilibili navigation logic.
- The extension removes only nodes it owns.

Represent source kinds as a closed set. Use the existing source-kind constants and stable ordering instead of free-form labels or ad hoc strings.

Extract list data into typed records before rendering. Required video item fields are target URL and title; skip items missing either field.

Keep reconciliation explicit. Mutation handling, same-tab navigation handling, moved-node restoration, and source-root hiding must remain easy to reason about.

## JavaScript Style

Use plain browser JavaScript that runs directly as a Manifest V3 content script.

- Prefer classes with documented methods for stateful concepts such as discovery, adapters, layout ownership, and controllers.
- Prefer constants for selector lists, source ordering, attribute names, class names, and timing values.
- Prefer small methods with clear receivers over large free functions.
- Avoid stringly typed state when a closed set or named record shape is available.
- Keep DOM queries scoped and de-duplicate candidates before acting on them.
- Treat broad Bilibili selectors as fallbacks. Prefer stable IDs and named classes first.
- Do not add runtime dependencies unless the task explicitly requires them.
- Do not introduce TypeScript, bundlers, transpilers, or package scripts unless the project intentionally moves to a build step.

Fail visibly for programmer errors during development, but avoid breaking the host page for expected Bilibili variation. Missing player means the extension does not mount. Missing comments or valid list items means that component stays absent until reconciliation finds it.

## CSS Style

The stylesheet owns the transformed viewport layout.

- Keep extension selectors under `#bibilili-layout-root` or `.bibilili-*` where possible.
- Use stable dimensions for panes, docks, rails, cards, buttons, and thumbnails so late-loading metadata does not resize the player.
- Keep the document body from becoming the primary scroll surface after mount.
- The comment pane owns vertical scrolling.
- The list rail owns horizontal scrolling.
- Hide page-owned source roots only through the extension bookkeeping attribute.
- Avoid decorative-only styling that competes with Bilibili content.

## Testing

Run lightweight local checks after content-script or manifest changes:

```sh
node --check src/content.js
node -e "JSON.parse(require('fs').readFileSync('manifest.json', 'utf8'))"
```

Manual browser testing is required for behavior changes because the extension depends on live Bilibili DOM:
- Load `/Users/arctic/Arc/bibilili` as an unpacked extension in `chrome://extensions`.
- Refresh a `https://www.bilibili.com/video/*` page after reloading the extension.
- Verify that the player remains playable, comments scroll on the right when available, and valid video lists render in the bottom dock.
- Toggle each visible source button and confirm ordinary DOM mutations do not reset disabled sources.
- Navigate to another Bilibili video in the same tab and confirm the layout rebuilds for the new page.

If browser testing cannot be performed, state that clearly in the final response.

## Version Control

This project uses git. Use git to inspect and communicate changes.

### Commit Message Convention

Format: `prefix: lowercase description`

No capitalization after the colon. No trailing period. One line.
The description should say what changed, not why.

#### Prefix Vocabulary

| Prefix | When to use |
|--------|-------------|
| `feat` | A user-visible capability that did not exist before. |
| `incr` | Incremental progress on an existing feature: bug fixes, polish, tuning, small additions. |
| `sisy` | Mechanical changes: formatting, linting, renaming passes, internal restructuring with no behavior change. |
| `vibe` | Exploratory, prototype-quality work. Expect rough edges; may be revised or replaced. |
| `repo` | Repository housekeeping: dependency changes, formatter config, file reorganization, one-off maintenance. |
| `docs` | Documentation-only changes, including `AGENTS.md`, `DESIGN.md`, and JSDoc comments. |
| `test` | Adding or updating tests without changing production code. |

#### Guidelines

- One logical change per commit.
- Pair implementation files with related tests or manual-test notes in the same commit.
- Order commits by dependency level: data shapes and utilities first, then discovery and reconciliation, then rendering and CSS, then config.
- Prefer many small commits over one large commit. A reviewer should understand a commit in under 30 seconds.
