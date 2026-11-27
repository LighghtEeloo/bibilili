# Contributing

Bibilili is a no-build Manifest V3 browser extension. The repository uses
`make` for local checks, packaging, and browser store release commands.

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
locale catalogs, runs the Node tests, and verifies that the required logo
assets are present. The Makefile also exposes `validate-js`, `validate-tests`,
`validate-json`, and `validate-assets` when a narrower check is useful.

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

The browser-specific packages are written to
`dist/bibilili-chrome-<version>.zip` and `dist/bibilili-firefox-<version>.zip`.
Inspect or verify them with:

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

## Store releases

Open **Actions → Publish browser extensions → Run workflow**. Select `main`
for a store submission, or select any ref for a package-only check. The target
options are `package` (default), `chrome`, `firefox`, and `both`. Every run
uses `make test-package` and attaches both ZIPs as a workflow artifact. A
package-only run does not read store credentials or contact either store.

Before submitting, run the manual browser checklist for behavior changes.
Use the manifest version from the selected commit. For a new store version,
run the appropriate version bump (for example, `make bump-patch`) and push the
commit to `main` before starting the workflow. Use a version greater than the
latest submission in each target store.

### Chrome Web Store setup

1. Use an existing listing. If the item is new, upload its first ZIP and
   complete its listing and privacy information in the [Developer Dashboard](https://chrome.google.com/webstore/devconsole/).
2. Enable the Chrome Web Store API in Google Cloud, create a dedicated service
   account, and add its email to the publisher's Developer Dashboard account
   settings. Create a JSON key for that account. The developer account must
   have two-step verification enabled. See the [official service account guide](https://developer.chrome.com/docs/webstore/service-accounts).
3. In GitHub **Settings → Environments**, create `chrome-web-store` and set
   its deployment branch policy to allow only `main`. Add the following
   environment settings.

   | Kind | Name | Value |
   | --- | --- | --- |
   | Secret | `CWS_SERVICE_ACCOUNT_JSON` | Full service account JSON key |
   | Variable | `CWS_PUBLISHER_ID` | ID from **Publisher → Settings** in the Chrome dashboard |
   | Variable | `CWS_EXTENSION_ID` | 32-character item ID from the listing's **Package** tab |

The workflow uploads through the [Chrome Web Store API v2](https://developer.chrome.com/docs/webstore/using-api)
and requests normal review. An approved update is published automatically using
its existing visibility settings.

### Firefox Add-ons setup

1. Use the existing AMO listing matching the manifest's Gecko ID. The listing
   must already have a name, summary, categories, and a license from a previous
   listed version. Complete missing listing details in the [Developer Hub](https://addons.mozilla.org/developers/).
2. Generate an [AMO API key and secret](https://addons.mozilla.org/developers/addon/api/key/)
   as a developer with access to the listing.
3. In GitHub **Settings → Environments**, create `firefox-add-ons` and set
   its deployment branch policy to allow only `main`. Create the environment
   secrets `AMO_JWT_ISSUER` (API key) and `AMO_JWT_SECRET` (API secret).

The workflow uploads to the `listed` channel through the [AMO v5 API](https://mozilla.github.io/addons-server/topics/api/addons.html#version-create),
waits for automated ZIP validation, and creates a version for signing and publication.

### Checking the result

The store jobs report separately. A successful submission may still be in
review or awaiting signing. Confirm the final status in each developer
dashboard. If one store fails, rerun its failed job from the original workflow
run to reuse the same ZIPs. Check the dashboard first if the API reports a
submission or an upload already in progress. If a Chrome upload succeeded but
the publication request failed, check the draft version in the dashboard and
submit that draft there if a retry cannot re-upload it. Do not cancel a pending
submission or overwrite a draft without verifying its version.
