<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/bibilili-logo-white.svg">
    <img alt="Bibilili" src="assets/bibilili-logo.svg" width="128">
  </picture>
</div>
<br>

Bibilili is a Manifest V3 browser extension for Bilibili watch pages. It transposes the watch layout so comments sit to the right of the player and video lists sit in a bounded dock below it.

The extension keeps Bilibili in charge of playback, comments, links, and network-backed content while its content script owns the transformed viewport, source toggles, video cards, and layout bookkeeping.

## Packaging

Update the version in `manifest.json` with `make bump-major`, `make bump-minor`,
or `make bump-patch`. Major bumps reset minor and patch to zero; minor bumps
reset patch to zero. Each command requires a clean Git working tree and index,
including no untracked files, then commits the version change as `repo: publish`.
Run the selected bump command before packaging.

Bibilili ships from one source tree with browser-specific release packages:

```sh
make package
```

The Chrome package is written to `dist/bibilili-chrome-<version>.zip` with Firefox-only manifest keys removed. The Firefox package is written to `dist/bibilili-firefox-<version>.zip` with Gecko signing metadata retained.
