# Contributing

Bibilili is a no-build Chrome extension. The repository uses `make` for local
checks, packaging, and Chrome Web Store release commands.

## Node

Use `fnm` with the repository version file:

```sh
fnm install
fnm use
node --version
```

For automatic switching, configure the shell that runs local commands:

```sh
eval "$(fnm env --use-on-cd --shell zsh)"
```

The expected Node version is read from `.node-version`. The repository does not
vendor a Node binary or install runtime dependencies.

## Local Checks

Run the lightweight checks before packaging or committing content-script,
stylesheet, manifest, or asset changes:

```sh
make validate
```

This checks JavaScript syntax, parses `manifest.json`, and verifies that the
required logo assets are present.

Print the manual browser checklist before release testing:

```sh
make manual-checklist
```

Manual browser testing is required for behavior changes because the extension
depends on live Bilibili page DOM.

## Packaging

Build the upload archive from the manifest version:

```sh
make package
```

The package is written to `dist/bibilili-<version>.zip`. Inspect or verify it
with:

```sh
make inspect-package
make test-package
```

`dist/` is ignored by git. Keep packaged zip files local unless a release
process explicitly asks for an artifact.

Remove local package artifacts with:

```sh
make clean
```
