SHELL := /bin/sh

EXTENSION_SLUG := bibilili
VERSION := $(shell node -p "require('./manifest.json').version")
DIST_DIR := dist
PACKAGE := $(DIST_DIR)/$(EXTENSION_SLUG)-$(VERSION).zip
PACKAGE_FILES := manifest.json README.md src assets

.PHONY: help validate manual-checklist package inspect-package test-package clean

help:
	@printf '%s\n' 'Targets:'
	@printf '%s\n' '  make validate          Check JavaScript syntax, manifest JSON, and required package assets.'
	@printf '%s\n' '  make manual-checklist  Print browser checks required before store submission.'
	@printf '%s\n' '  make package           Build dist/bibilili-<manifest version>.zip.'
	@printf '%s\n' '  make inspect-package   List the package contents.'
	@printf '%s\n' '  make test-package      Verify the package zip can be read.'
	@printf '%s\n' '  make clean             Remove local package artifacts.'

validate:
	node --check src/content.js
	node -e "JSON.parse(require('fs').readFileSync('manifest.json', 'utf8'))"
	test -f assets/bibilili-logo.svg
	test -f assets/bibilili-logo-white.svg
	test -f assets/bibilili-logo-16.png
	test -f assets/bibilili-logo-32.png
	test -f assets/bibilili-logo-48.png
	test -f assets/bibilili-logo-128.png

manual-checklist:
	@printf '%s\n' 'Manual browser checks before publishing:'
	@printf '%s\n' '  1. Load this directory as an unpacked extension in chrome://extensions.'
	@printf '%s\n' '  2. Refresh a https://www.bilibili.com/video/* page after reloading the extension.'
	@printf '%s\n' '  3. Verify the player remains playable and comments scroll on the right when available.'
	@printf '%s\n' '  4. Verify valid video lists render in the bottom dock.'
	@printf '%s\n' '  5. Toggle each visible source button and confirm DOM mutations do not reset disabled sources.'
	@printf '%s\n' '  6. Navigate to another Bilibili video in the same tab and confirm the layout rebuilds.'

$(DIST_DIR):
	mkdir -p $(DIST_DIR)

package: validate | $(DIST_DIR)
	zip -r -FS $(PACKAGE) $(PACKAGE_FILES) -x '*.DS_Store'

inspect-package: package
	unzip -l $(PACKAGE)

test-package: package
	unzip -t $(PACKAGE)

clean:
	rm -f $(DIST_DIR)/$(EXTENSION_SLUG)-*.zip
