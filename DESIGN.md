# Design

Bibilili is a Manifest V3 browser extension for Bilibili watch pages. It
transposes the watch layout: comments move to the right of the player, and
video lists move to the bottom.

The player remains the visual anchor. Comments and video lists become bounded
scroll surfaces around it.

Chrome and Firefox share the manifest, ordered content-script files,
stylesheet, and assets. Firefox-specific add-on metadata lives in the shared
manifest under `browser_specific_settings`.

`src/content-route.js` is the route prelude. It defines the pure Bilibili watch
route model used by source extraction, source routing, and preview hydration.
`src/content-state.js` is the state prelude. It defines layout bookkeeping
helpers for moved page nodes and marked source roots. `src/content-i18n.js` is
the i18n prelude. It defines message catalog loading, formatting, and UI
language resolution. `src/content-storage.js` is the storage prelude. It
defines persisted activation, comment width, navigation-origin, and source-route
state. `src/content-theme.js` is the theme prelude. It defines browser
color-scheme resolution and Bilibili native theme synchronization.
`src/content-scheduler.js` is the scheduling prelude. It defines urgent and
lazy reconciliation request coalescing. `src/content.js` is the main runtime.
It owns discovery, reconciliation, rendering, account requests, preview
hydration, and activation state.

## Watch Page

The watch page is the Bilibili document for one visible video. Bibilili
discovers its player, comments, account control, watch title, video
description, tags, uploader, and page video-list sources.

The player region contains the video player and immediate playback controls.
Bibilili moves its surrounding layout context while preserving playback logic.
The video title, video description, tags, and uploader metadata remain
page-owned metadata. Bibilili may move the page-owned video description into an
extension-owned presentation slot and reads tags into extension-owned links.

The comment region contains the page-owned comment tree. Bibilili moves this
region into a right-side scroll container and may prepend the extension-owned
video description presentation in the same scrolling surface.

Discovery identifies the uploader card, video description, and tags by their
named module roots wherever Bilibili nests them. Broad class-name probes stay
bounded by list-container exclusion so list-card authors and card text do not
become page metadata.

Video-list sources contain page-owned list data or Bilibili account list data.
Bibilili reads them into uniform list items and routes one source at a time
into the bottom dock.

## DOM Ownership

Bibilili owns the layout root, stage, panes, video header, list dock,
source bar, video description presentation, watch action group,
current-video watch-later control, list rail, video cards,
watch-later mutation controls, extension classes, and bookkeeping attributes.
Bilibili owns the player, comments, source roots, links, native watch metadata,
native uploader card, watch action triggers, account controls, account lists,
and network-backed content.

Bibilili may move page-owned player, video description, and comment nodes into
extension containers. It keeps remaining page-owned watch metadata and
video-list roots available for observation and extraction, and it renders
account list API records into extension-owned cards without modifying native
account list DOM.

Bibilili may add and remove watch-later account records through Bilibili's
account API. These operations are account-list mutations. They do not activate
native watch-later controls or replace Bilibili navigation behavior.

Bibilili mirrors native watch action state with extension-owned buttons. Like,
coin, and favorite forward clicks to Bilibili's page-owned triggers. Coin and
favorite dialogs remain page-owned overlays. Share copies the current watch
URL. The watch-later action adds the current archive through the account API.

Bibilili forwards current-user comment avatar activation to the page-owned
account control when that control is available. Account menus, login prompts,
and account navigation remain under Bilibili ownership.

Bibilili removes only nodes it owns.

## Layout Root

The layout root is the extension-owned container for the transformed page. It
contains the stage and list dock. The stage contains the player pane and
comment pane; the list dock sits below the stage.

The layout root owns viewport-level sizing. It assigns bounded height to the
list dock and gives the remaining height to the stage.

Moved-node bookkeeping records the native restore point for each page-owned
node moved into an extension pane. Source-root bookkeeping marks native source
roots only while their extracted items are represented in the dock.

## Theme

The theme is Bilibili-owned page appearance. Bibilili synchronizes Bilibili's
native theme controls with the browser color-scheme preference.

Bibilili writes Bilibili's `theme_style` cookie, applies the native common-page
dark marker when needed, and swaps Bilibili's CSS-map stylesheet between its
light and dark variants when the page exposes that link. Appearance state stays
in Bilibili's native theme system.

Extension-owned surfaces consume Bilibili CSS variables for backgrounds,
borders, text, and controls. Static fallbacks cover missing native variables.

## UI Language

The UI language is the language used by extension-owned labels and accessible
names. Bibilili resolves it from Bilibili document language markers, storage or
cookie locale markers, localized page chrome, the extension i18n UI language,
and then the browser language. The resolved language selects a packaged
extension i18n catalog.

Extension-owned labels and accessible names are message keys. Source kinds stay
language-neutral; the renderer maps them to localized button text and rail
headings during reconciliation. Bibilili-generated account metadata uses the UI
language for number formatting and message templates. Page-owned titles,
authors, and metadata keep Bilibili's language and wording.

## Activation Control

The activation control is the global button for enabling and disabling the
transformed layout. Before mount, it floats at the bottom-left of the page and
acts as a start or retry control. After mount, it is the leftmost control in the
bottom dock and acts as the off control.

The control presents the extension logo asset as its visible mark. Its
accessible name and title state whether activating it turns Bibilili on or off.
The control keeps one DOM button for the page session; reconciliation updates
that button in place and moves it only when its placement changes.

Disabling Bibilili restores page-owned player and comment nodes to their page
locations, removes the layout root, and leaves the floating activation control
mounted. Enabling Bibilili starts or retries a transformed page session.

Activation applies through an urgent reconciliation request after the current
input task when the player region is available. Lazy reconciliation and page
priming do not gate the first visible transformed layout.

The activation state is a Bilibili-page preference recording the requested
state. It persists across same-tab navigation and page reloads when browser
storage is available.

## Startup

An enabled watch page conceals the native player from document start until the
first transformed render completes. The player keeps its native geometry during
this handoff. Disabling Bibilili or leaving the watch page restores visibility;
a five-second deadline also restores it if mounting cannot complete. The same
guard covers activation and same-document video navigation.

Player discovery is enough to mount the transformed layout. Lazy comments and
page-owned source data may settle afterward.

On a new watch page, the controller may run one native lazy-primer pass before
moving comments. The pass briefly scrolls the page-owned document toward
comment and source regions, restores the previous scroll position, and
reconciles after Bilibili has had a chance to create lazy nodes and attributes.

Manual comment reload uses the same behavior after mount. The forced pass
temporarily releases the transformed layout, restores page-owned nodes to their
native positions and the native scroll position, and then reconciles.

Page-owned source roots remain measurable while hidden from the transformed
viewport. Bibilili hides them with source-root bookkeeping styles that preserve
layout geometry so Bilibili lazy observers can resolve list data and
thumbnails.

## Player Pane

The player pane contains the Bilibili player region and occupies the main
column of the stage. The comment pane determines its width reduction; the list
dock determines its height reduction. Bibilili leaves player controls, player
events, and playback state under Bilibili ownership.

The pane keeps the native mini-player container in normal flow and clears its
floating offsets. Native lazy priming can activate that mode while the player
is already mounted. Web fullscreen and browser fullscreen retain their native
positioning.

## Comment Pane

The comment pane is the right-side container for comments. It has the same
height as the player pane and owns vertical scrolling, so comment scrolling does
not move the player or list dock. The extension-owned video header sits at the
top of the comment pane and stays pinned while comments scroll. It contains
page-owned comment nodes and may
wrap the comment region; comment controls remain page-owned markup. Comment
content keeps Bilibili sizing and is uniformly zoomed down to fit the pane;
Bibilili does not restyle inner comment nodes.

The video header exposes a fit action. It reads the current video's intrinsic
aspect ratio and sets the comment pane width so the player pane matches the
video at stage height, under the same clamps and persistence as divider
resizing.

The comment pane may begin with an extension-owned video description
presentation. The presentation contains the page-owned video description node
and tag links, has no extension divider from comments, and scrolls in the same
surface as the comment tree.

The divider between the player pane and comment pane resizes the comment pane.
The saved width is a Bilibili-page preference. The player pane takes the
remaining stage width.

The current-user avatar inside a comment composer is the account-control bridge
entry point.

The comment retry state is extension-owned chrome shown when no usable comment
region is available. It keeps the comment column visible and provides a manual
reload control.

A usable comment region has page-owned comment controls, comment rows, a
page-owned empty-state marker, or a visibly laid out Bilibili comment host.
Empty comment shells remain in their native page position so Bilibili can keep
hydrating them.

Activating comment reload runs a forced lazy-primer pass and then reconciles the
current watch page. It does not reload the browser page or replace Bilibili
comment controls.

## Video List Source

A video list source is a Bilibili list that can produce video items. Source
kinds form a closed set: parts, collection, recommendations, watch later, and
history. A source kind is shown when page markup or an account list exposes
matching content.

Each source has a stable source kind, optional page-owned root node, and ordered
set of extracted video items. Source adapters convert page-owned list markup and
Bilibili account API payloads into video items for the bottom dock renderer.

The route model converts playable Bilibili URLs into route identities, archive
preview identities, canonical archive URLs, and route keys. Archive route keys
include the page number; bangumi route keys use the playable bangumi identity.

Parts and collection sources require at least two valid items. A one-item list
does not provide navigation and remains absent from the source bar. Other source
kinds require one valid item.

## Parts and Collection Sources

A parts source is the ordered page list within the current archive. Each item
targets the current BV or AV with its one-based `p` route. Native part labels
may be short values such as `1`. Bibilili derives parts from explicit multipage
links or the nested page rows in Bilibili's video-pod.

A collection source is an ordered list of distinct playable archives. Its items
target separate BV or AV routes. Nested part rows do not become collection
items.

Bilibili may render collection archives and the current archive's parts in one
video-pod. Discovery can derive both sources from that root while keeping their
items and routes separate.

## Account Video List Source

An account video list source is a Bilibili account list fetched by the content
script with the current Bilibili login cookies.

The account source kinds are watch later and history. Watch later reads
Bilibili's to-view list; history reads the recent video history list. Each API
response is normalized into the same video item shape used by page-owned
sources. History is read-only in the dock. Watch later supports additions from
the current watch action and page-owned collection and recommendation cards.
It supports removals from account-backed watch-later cards.

The account source store retains valid items and expansion state separately for
each source. History starts with a request for 30 entries and retains the
response cursor for older pages. Watch later retains the returned list and
initially exposes up to 80 items. Each expansion reveals up to 30 additional
items, fetching one older page when history has no retained items left to show.
History pages merge by playable route identity in API order. Empty pages,
missing cursors, and repeated cursors end history continuation.

Watch-later expansion can advance directly to the batch containing a cached
target. It retains any deeper expansion and leaves an absent target unchanged.

Expansion survives source switches, ordinary reconciliation, and same-document
video navigation. Disabling the extension, replacing the document, or changing
the UI language resets the account source session.

Watch later also reads the full list count from to-view response metadata when
Bilibili exposes it. The count is account-state metadata. It is independent of
the revealed rail item count, which follows the current expansion depth and
valid-item rules.

Account source fetches are advisory and never block the first transformed
layout. A source remains absent until its initial request yields valid items.
Failed refreshes preserve usable items. Failed continuation requests preserve
the loaded items and cursor so the same page can be retried. Each source allows
one active request and discards completions from canceled requests.

Account sources do not have page-owned roots. They are rendered in the bottom
dock but do not participate in source-root hiding.

Watch-later items carry the archive id required by Bilibili's to-view deletion
endpoint when the account payload exposes it. A successful deletion removes the
item from the loaded watch-later source and reconciles the dock. Deleting the
currently open video from watch later leaves the watch page open.

The current watch action and collection and recommendation cards derive a
to-view add identity from their archive target URL. A successful card addition
refreshes watch later at its current expansion depth and hides the card add
control for that target during the current layout session. The current watch
action remains available after a successful addition.

## Video Item

A video item is the uniform record rendered by the bottom dock. It contains a
target URL, title, thumbnail when available, source kind, and optional metadata
such as duration, author, view count, or progress. The target URL and title are
required; source adapters skip items missing either field.

For page-owned sources, the target URL resolves to a playable Bilibili watch
route. Video archive routes and bangumi play routes are valid targets. Profile,
submission, and sidebar navigation routes do not produce video items. Page-owned
source adapters may derive targets from anchors, URL or id data attributes, and
Bilibili video-pod rows. Derived targets are normalized before the renderer
receives them.

Recommendation sources omit the current watch video. Parts sources preserve
the current archive's page order. Collection sources preserve Bilibili's
archive order so the current archive remains addressable in the rail.

## Video Preview Hydration

Video preview hydration is advisory metadata enrichment for video items whose
page-owned source does not expose a thumbnail.

Bibilili may fetch archive metadata from Bilibili's video-info API using a BV
or AV id derived from the item's target URL. It uses the returned archive cover
as the thumbnail. Page-owned thumbnails have precedence over fetched covers.
Placeholder, loading, and static page assets are not page-owned thumbnails.
They fall through to fetched covers when an archive id is available.

Preview demand contains visible items from the open rail and up to three
adjacent items on each side. Visible items have request priority. The preview
store allows four active metadata requests and cancels queued or active work
when an item leaves demand. Closing the rail clears demand. Completed results
remain cached for the page session.

Preview fetches do not block rendering. Failed, unsupported, private, deleted,
or unavailable videos keep the title placeholder for the page session.

## List Dock

The list dock is the bottom container for the selected video-list source. It
contains the source bar and list rail, and it is the canonical visual placement
for parts, collections, recommendations, watch-later entries, history entries,
and later video-list kinds.

The list dock has bounded height and owns horizontal scrolling through the list
rail. Document, player-pane, and comment-pane scrolling remain independent.

The list dock has two enabled states. It is open when a selected source is
showing its rail. It is controls-only when no discovered source yields valid
video items or when the selected source route is closed. Controls-only state
keeps the activation control, available watch action buttons, and available
source buttons visible, closes the rail, and gives the stage the viewport
height minus the source bar height.

## Watch Action Control

A watch action control is an extension-owned dock control for the current watch
video. The action kinds are like, coin, favorite, share, and watch later. The
action kind is a closed set with that stable order.

Bibilili discovers native watch action triggers from the page toolbar. It reads
the displayed count text and active state when Bilibili exposes them. Missing
native actions are absent from the dock. The watch-later action is absent when
the current watch URL is not an addable archive target or no native
watch-later visual has been captured.

The like, coin, and favorite buttons present sanitized clones of native visual
content and dispatch clicks to their native triggers. Bibilili does not call
their action APIs directly or replace native action dialogs or account logic.
The coin action may open Bilibili's native coin dialog. The favorite action may
open Bilibili's native collection dialog.

The share button presents the native share count and copies a clean current
watch URL when activated. The copied URL drops tracking parameters and keeps the
archive page parameter when it identifies the visible video part. It shows the
native share visual normally and replaces only the cloned share icon with a
Bibilili-owned copy icon while hovered. It does not proxy Bilibili's native
share popover.

The watch-later button sits after share when the current watch URL identifies
an addable archive. It uses the same account API mutation path as card
additions. It uses a sanitized clone of Bilibili's native watch-later visual
and does not draw an extension fallback. It shows the full account watch-later
count next to the icon when that count is known. It remains available when the
archive is already present in the account-backed watch-later source, so
activation can move that archive to the top of the watch-later list.

Watch action buttons are keyed by action kind. Reconciliation updates them in
place, replaces cloned visuals from current native markup, and removes buttons
for absent native triggers or unavailable account mutations.

## Video Header

The video header is extension-owned pane chrome at the top of the comment
pane. It shows the watch title, the uploader avatar and display name, and the
publish date when Bilibili exposes them. The uploader link opens the uploader
profile in a new browser page.

Discovery derives metadata from the native uploader card and publish-date
text. Profile-link fallbacks accept only bare space-home addresses outside the
global header, so viewer account links never supply uploader metadata. Follow
controls, message controls, and native uploader-card popovers remain under
Bilibili ownership.

Video header reconciliation updates the stable header nodes in place. The
comment pane reserves the header while any header part is available, including
before comments load.

## Account Control Bridge

The account control bridge maps the current-user avatar in the comment composer
to Bilibili's native header account control. Bibilili discovers the page-owned
header account trigger during reconciliation; activating the composer avatar
inside the transformed comment pane clicks that trigger. Login prompts, account
menus, and account navigation remain owned by Bilibili.

The bridge target is the native header account control. Native comment-section
avatars are never account-control targets, even before the comment tree is moved
into the transformed pane.

The bridge is scoped to the current-user avatar zone at the top of the comment
pane. Comment-row avatars retain their native link and profile behavior.

## Native Overlay Lift

Native overlay lift is the stacking adjustment for page-owned popovers and
dialogs opened from controls that Bibilili forwards. It applies to the account
popover, the coin dialog, the favorite collection dialog, and comment image
previews.

Comment image previews are page-owned overlays opened from images inside the
comment pane. Bibilili detects preview-triggering comment image clicks and
marks the resulting preview overlay after Bilibili creates it. Bilibili's
PhotoSwipe preview root is also lifted directly by selector while it is open.

Lifted native overlays are marked with a Bibilili bookkeeping attribute so they
paint above the transformed viewport. The attribute changes only stacking
order and is removed when the transformed layout is released or destroyed.
Static overlay nodes receive a companion positioning marker so their stacking
order can take effect without changing Bilibili behavior.

## Source Route

The source route is the selected source kind for the list dock. It defaults to
the first available source in source-kind order: parts, collection,
recommendations, watch later, history. Reconciliation preserves the current
route while its source remains available; when the route disappears, the first
available source becomes selected.

An origin route is a one-navigation source-route hint created by normal
same-tab activation of an extension-owned video card. The next watch page
selects that source when it is available. The hint is tab-scoped and keyed to
the clicked target route, so it can survive document navigation without
becoming a persistent preference. Account-backed sources may satisfy the hint
after their fetch completes. Source button interaction clears a pending hint
for the current page.

Selecting a source route replaces the list rail with that source's video items.
Selecting the current route closes an open rail without clearing the route, or
reopens a closed rail. Source routes do not toggle a source off and do not
combine multiple sources in one rail.

The selected source route and rail open state are stored as tab-scoped state
for the current watch route. A browser refresh restores that state when the
source is available. Account-backed sources may satisfy the restored route
after their fetch completes.

## Source Bar

The source bar is the control row inside the enabled list dock. It begins with
the activation control, then contains one route button per discovered source
kind, then contains the watch action group when native watch actions are
available. Source buttons represent parts, collection, recommendations, watch
later, and history when those sources are available. Their labels use the
current UI language.

The selected source button keeps `aria-current` for the remembered route and
exposes the rail open state with `aria-expanded`. The selected visual treatment
applies only while `aria-expanded` is `true`. A source with no valid video items
is omitted from the source bar.

The source bar is rendered whenever the enabled list dock is present. With no
available source, it contains the activation control, available uploader
summary, and any available watch action buttons.

Source buttons are keyed by source kind. Reconciliation updates them in place,
orders them after the activation control and before the watch action group, and
removes buttons for absent sources. Stable button identity preserves
in-progress pointer and keyboard interaction while Bilibili mutates the page.

## List Rail

The list rail is the horizontal scroll surface inside the list dock. It renders
one group for the selected source while the source route is open. Every group
uses the same card layout; native Bilibili list styling has no role in the
bottom presentation.

The rail scrolls horizontally across the selected source's cards. Route changes
replace the group in place and reopen the rail.

A rail window contains the visible cards and up to three neighbors on each
side. The row retains the width of all revealed items while only window cards
have DOM nodes. A focused card and a card with an active pointer press remain
mounted until the interaction ends. Scrolling and resizing update the window
once per animation frame, independently of page discovery.

Cards retain their logical order and fixed positions within the full row.
Keyboard navigation reveals adjacent items across window boundaries. Resizing
preserves the logical scroll position when card dimensions change.

Account-backed history and watch-later groups end with a Show more button while
additional items are available. The button uses the video card dimensions and
stays at the end as cards are appended. It keeps its DOM identity during
reconciliation, presents Loading while a request is active, and presents Retry
after a continuation failure. It is removed when continuation ends.

Expansion preserves the rail scroll position and does not recenter the current
video. Keyboard activation focuses the first appended card if focus remains on
the button when loading completes. If continuation ends without adding a card,
focus moves to the last existing card before the button is removed.

When an origin route selects the destination source, the rail opens with that
source's cards. The behavior applies to extension-owned bottom-rail card links;
other card controls keep their own behavior.

When the selected source is parts, the rail identifies the card whose archive
page route matches the current watch route. It scrolls to that card once for the
current page session and again when the parts route is opened explicitly.

When the selected source is a collection, the rail identifies the card whose
archive matches the current video. A native current-row marker is equivalent to
an archive match. The rail scrolls to that card once for the current page
session and again when the collection route is opened explicitly.

When the selected source is watch later, the rail uses the same current-card
matching, positioning, and highlight path as collection. Selecting or reopening
the route searches all retained account items and reveals the batch containing
the current watch route before rendering. The rail scrolls to that card when
present. Subsequent reconciliation preserves manual scrolling.

Current-card positioning uses the item's logical index and renders the
destination window directly.

## Video Card

A video card is the extension-owned rendering of one video item. It uses a
fixed card width and stable thumbnail aspect ratio. Card content keeps the rail
height stable.

The card links to the item's target URL. Activating it uses normal page
navigation unless the browser or Bilibili intercepts the link. When a thumbnail
is unavailable, the thumbnail area presents the video title and clamps it within
the fixed preview height.

During same-route reconciliation, retained card roots, link anchors, and stable
child nodes are reused. Advisory list or thumbnail updates change card content
and explicit thumbnail state in place so normal link activation is not
interrupted. Thumbnail elements are created with window cards and use browser
lazy loading.

A parts card matching the current archive page route exposes `aria-current` and
uses selected border and title colors. A collection card for the current
archive uses the same treatment. For collection cards, a native current-row
marker from Bilibili is equivalent to an archive match.

Collection and recommendation cards with archive targets include an overlay
add-to-watch-later button. Watch-later cards with a deletion identity include
an overlay removal button. The mutation button appears on card hover or card
focus, sits at the top-right of the card, and handles its own activation.
Add controls use the same captured native watch-later visual as the
current-video watch-later action. Removal controls always use an
extension-owned trash icon. Activating the rest of the card follows the card
link.

## Runtime Controller

The runtime controller coordinates discovery, activation, layout updates,
mutation observation, account source loading, and same-tab navigation
detection. It observes same-tab navigation, lazy region insertion, list
updates, account source completion, and page theme marker changes. When the
watched video changes, it starts a new page session and rebuilds discovered
regions.

The page session key is the stable watch route when the URL identifies a
playable video. Tracking query changes on the same video do not start a new
page session.

Reconciliation is the controller's idempotent update pass over the current watch
page. Requests carry a priority and a source-reset flag. The reset flag clears
the page-session source route when the visible video session changes.

Reconciliation has two priorities. Urgent requests come from activation,
initial startup, same-tab navigation, and player arrival while awaiting a
mount. Lazy requests come from other page mutations, theme changes, page
priming, and startup settling.

Urgent requests run asynchronously after the current browser task. They cancel
pending lazy scheduling, keep the reset flag if any pending request set it, and
preserve input event delivery.

Lazy requests are debounced, then run during browser idle time or a fixed
timeout. Additional page mutations merge into the pending lazy request without
restarting the debounce or postponing the pass indefinitely.

Each pass discovers page-owned regions, then applies an idempotent render to
extension-owned surfaces. The render path updates stable controls in place and
moves page-owned player and comment nodes only when their owning region
changes.

When a source root changes or an account source finishes loading, that source is
re-extracted and the list rail is re-rendered from the current source route.
When the comment region changes, the comment pane receives the current
page-owned comment tree. When the watch title, uploader, or publish date
changes, the video header receives the current values.

At startup and after same-tab navigation, the controller schedules a bounded
set of lazy settling passes. These passes refresh comments, list items, and
thumbnail metadata that Bilibili creates after the first transformed layout.

## Sizing Rules

The transformed page uses the viewport as its sizing boundary. The stage height
is the viewport height minus the list dock height. The player pane and comment
pane share the stage height.

The comment pane has vertical overflow. The list rail has horizontal overflow.
The transformed content uses pane-level scroll surfaces instead of
document-body scrolling.

The expanded list dock height fits one row of cards and the source bar. The
height is fixed or clamped, keeping late metadata from resizing the player.

The controls-only list dock height is the source bar height. When the list dock
is absent, its height contribution is zero.

## Failure Rules

Bibilili mounts only after it discovers a player region.

If comments are unavailable or only an empty shell is present, the comment pane
shows the comment retry state.

The video header shows only the metadata fields Bilibili exposes. When no
header field is available, the comment pane follows its comment state alone.

If no video-list source yields valid video items, the list dock is shown only
as the enabled activation surface.

If a later mutation provides comments or valid list items, the missing component
is mounted during reconciliation.
