SHELL := /bin/sh

EXTENSION_SLUG := bibilili
VERSION := $(shell node -p "require('./manifest.json').version")
DIST_DIR := dist
CHROME_PACKAGE := $(DIST_DIR)/$(EXTENSION_SLUG)-chrome-$(VERSION).zip
FIREFOX_PACKAGE := $(DIST_DIR)/$(EXTENSION_SLUG)-firefox-$(VERSION).zip
CHROME_MANIFEST_DIR := $(DIST_DIR)/chrome
FIREFOX_MANIFEST_DIR := $(DIST_DIR)/firefox
CHROME_MANIFEST := $(CHROME_MANIFEST_DIR)/manifest.json
FIREFOX_MANIFEST := $(FIREFOX_MANIFEST_DIR)/manifest.json
COMMON_PACKAGE_FILES := README.md src assets _locales
CONTENT_SCRIPT_FILES := $(shell node -e "const fs=require('fs'); const manifest=JSON.parse(fs.readFileSync('manifest.json','utf8')); process.stdout.write(manifest.content_scripts.flatMap((script)=>script.js ?? []).join(' '));")

.PHONY: help validate validate-js validate-tests validate-json validate-assets manual-checklist package package-chrome package-firefox inspect-package test-package clean

help:
	@printf '%s\n' 'Targets:'
	@printf '%s\n' '  make validate          Run all local validation checks.'
	@printf '%s\n' '  make validate-js       Check manifest content-script JavaScript syntax.'
	@printf '%s\n' '  make validate-tests    Run Node tests.'
	@printf '%s\n' '  make validate-json     Parse manifest and locale JSON.'
	@printf '%s\n' '  make validate-assets   Verify required package assets.'
	@printf '%s\n' '  make manual-checklist  Print browser checks required before store submission.'
	@printf '%s\n' '  make package           Build Chrome and Firefox store zips.'
	@printf '%s\n' '  make package-chrome    Build dist/bibilili-chrome-<manifest version>.zip.'
	@printf '%s\n' '  make package-firefox   Build dist/bibilili-firefox-<manifest version>.zip.'
	@printf '%s\n' '  make inspect-package   List both package contents.'
	@printf '%s\n' '  make test-package      Verify both package zips can be read.'
	@printf '%s\n' '  make clean             Remove local package artifacts.'

validate: validate-js validate-tests validate-json validate-assets

validate-js:
	@for file in $(CONTENT_SCRIPT_FILES); do \
		printf '%s\n' "node --check $$file"; \
		node --check "$$file"; \
	done

validate-tests:
	node --test tests/*.test.js

validate-json:
	node -e "JSON.parse(require('fs').readFileSync('manifest.json', 'utf8'))"
	node -e "const fs=require('fs'); for (const dir of ['en','zh_CN','zh_TW']) JSON.parse(fs.readFileSync('_locales/'+dir+'/messages.json', 'utf8'))"

validate-assets:
	test -f assets/bibilili-logo.svg
	test -f assets/bibilili-logo-white.svg
	test -f assets/bibilili-logo-16.png
	test -f assets/bibilili-logo-32.png
	test -f assets/bibilili-logo-48.png
	test -f assets/bibilili-logo-128.png
	test -f assets/bibilili-logo-thick.svg
	test -f assets/bibilili-logo-thick-16.png
	test -f assets/bibilili-logo-thick-32.png
	test -f assets/bibilili-logo-thick-48.png
	test -f assets/bibilili-logo-thick-64.png
	test -f assets/bibilili-logo-thick-128.png

manual-checklist:
	@printf '%s\n' 'Manual browser checks before publishing:'
	@printf '%s\n' '  1. Chrome: load this directory as an unpacked extension in chrome://extensions.'
	@printf '%s\n' '  2. Firefox: load this directory manifest as a temporary add-on in about:debugging.'
	@printf '%s\n' '  3. Refresh a https://www.bilibili.com/video/* page after reloading the extension.'
	@printf '%s\n' '  4. Verify the player remains playable and comments scroll on the right when available.'
	@printf '%s\n' '  5. Verify valid video lists render in the bottom dock.'
	@printf '%s\n' '  6. Toggle each visible source button and confirm DOM mutations do not reset disabled sources.'
	@printf '%s\n' '  7. Navigate to another Bilibili video in the same tab and confirm the layout rebuilds.'

$(DIST_DIR):
	mkdir -p $(DIST_DIR)

$(CHROME_MANIFEST_DIR) $(FIREFOX_MANIFEST_DIR): | $(DIST_DIR)
	mkdir -p $@

$(CHROME_MANIFEST): manifest.json | $(CHROME_MANIFEST_DIR)
	node -e "const fs=require('fs'); const manifest=JSON.parse(fs.readFileSync('manifest.json','utf8')); delete manifest.browser_specific_settings; fs.writeFileSync('$@', JSON.stringify(manifest, null, 2) + '\n');"

$(FIREFOX_MANIFEST): manifest.json | $(FIREFOX_MANIFEST_DIR)
	cp manifest.json $@

package: package-chrome package-firefox

package-chrome: validate $(CHROME_MANIFEST) | $(DIST_DIR)
	rm -f $(CHROME_PACKAGE)
	zip -r $(CHROME_PACKAGE) $(COMMON_PACKAGE_FILES) -x '*.DS_Store'
	zip -j $(CHROME_PACKAGE) $(CHROME_MANIFEST)

package-firefox: validate $(FIREFOX_MANIFEST) | $(DIST_DIR)
	rm -f $(FIREFOX_PACKAGE)
	zip -r $(FIREFOX_PACKAGE) $(COMMON_PACKAGE_FILES) -x '*.DS_Store'
	zip -j $(FIREFOX_PACKAGE) $(FIREFOX_MANIFEST)

inspect-package: package
	@printf '%s\n' 'Chrome package:'
	unzip -l $(CHROME_PACKAGE)
	@printf '%s\n' 'Firefox package:'
	unzip -l $(FIREFOX_PACKAGE)

test-package: package
	unzip -t $(CHROME_PACKAGE)
	unzip -t $(FIREFOX_PACKAGE)

clean:
	rm -f $(DIST_DIR)/$(EXTENSION_SLUG)-*.zip
	rm -rf $(CHROME_MANIFEST_DIR) $(FIREFOX_MANIFEST_DIR)
