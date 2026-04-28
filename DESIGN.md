# Design

Bibilili is a Manifest V3 browser extension for Bilibili watch pages. It
transposes the watch layout: comments move to the right of the player, and
video lists move to the bottom.

The player remains the visual anchor. Comments and video lists become bounded
scroll surfaces around it.

Chrome and Firefox share the manifest, content script, stylesheet, and assets.
Firefox-specific add-on metadata lives in the shared manifest under
`browser_specific_settings`.

## Watch Page

The watch page is the Bilibili document for one visible video. Bibilili
discovers its player, comments, account control, watch title, and page
video-list sources.

The player region contains the video player and immediate playback controls.
Bibilili moves its surrounding layout context while preserving playback logic.
The video title remains page-owned metadata that Bibilili may read for
extension-owned presentation surfaces.

The comment region contains the page-owned comment tree. Bibilili moves this
tree into a right-side scroll container.

Video-list sources contain page-owned list data or Bilibili account list data.
Bibilili reads them into uniform list items and routes one source at a time
into the bottom dock.

## DOM Ownership

Bibilili owns the layout root, stage, panes, player title overlay, list dock,
source bar, watch action group, list rail, video cards, extension classes, and
bookkeeping attributes. Bilibili owns the player, comments, source roots,
links, watch action triggers, account controls, account lists, and
network-backed content.

Bibilili may move page-owned player and comment nodes into extension
containers. It keeps page-owned video-list roots available for observation and
extraction, and it renders account list API records into extension-owned cards
without modifying account lists.

Bibilili mirrors native watch action state with extension-owned buttons. Like,
coin, and favorite forward clicks to Bilibili's page-owned triggers. Share
copies the current watch URL.

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

## Theme

The theme is the extension-owned color state applied to extension surfaces. It
does not restyle page-owned player, comment, or source roots.

Bibilili resolves the theme from explicit Bilibili appearance markers, then
computed page colors, then the browser color-scheme preference. Extension-owned
surfaces use theme tokens for backgrounds, borders, text, and controls. Tokens
define clear foreground and background pairs for primary text, muted text,
selected controls, and badges in light and dark modes.

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

## Startup Lazy Readiness

Startup lazy readiness is the state between player discovery and Bilibili's
lazy comment and list hydration. Player discovery is enough to mount the
transformed layout; comments and page-owned source data may settle afterward.

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

The player pane may contain an extension-owned title overlay. The overlay reads
the watch title, appears at the top of the player pane when the pane is hovered
or focused, uses a vertical opacity gradient for legibility, and remains
pointer-transparent.

## Comment Pane

The comment pane is the right-side container for comments. It has the same
height as the player pane and owns vertical scrolling, so comment scrolling does
not move the player or list dock. It contains page-owned comment nodes and may
wrap the comment region; comment controls remain page-owned markup.

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

A video list source is a Bilibili list that can produce video items. The source
kind is a closed set represented by source-kind constants. The initial kinds are
collection, recommendations, watch later, and history. A source kind is shown
when page markup or an account list exposes matching content.

Each source has a stable source kind, optional page-owned root node, and ordered
set of extracted video items. Source adapters convert page-owned list markup and
Bilibili account API payloads into video items for the bottom dock renderer.

## Account Video List Source

An account video list source is a read-only Bilibili account list fetched by the
content script with the current Bilibili login cookies.

The account source kinds are watch later and history. Watch later reads
Bilibili's to-view list; history reads the recent video history list. Each API
response is normalized into the same video item shape used by page-owned
sources.

Account source fetches are advisory and never block the first transformed
layout. When an account request fails, requires login, or returns no valid
video items, that source is absent for the current render pass.

Account sources do not have page-owned roots. They are rendered in the bottom
dock but do not participate in source-root hiding.

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

Recommendation sources omit the current watch video. Collection sources
preserve Bilibili's ordered list entries so the current item remains
addressable in the rail.

## Video Preview Hydration

Video preview hydration is advisory metadata enrichment for video items whose
page-owned source does not expose a thumbnail.

Bibilili may fetch archive metadata from Bilibili's video-info API using a BV
or AV id derived from the item's target URL. It uses the returned archive cover
as the thumbnail. Page-owned thumbnails have precedence over fetched covers.
Placeholder, loading, and static page assets are not page-owned thumbnails.
They fall through to fetched covers when an archive id is available. Preview
fetches do not block rendering. Failed, unsupported, private, deleted, or
unavailable videos keep the title placeholder for the page session.

## List Dock

The list dock is the bottom container for the selected video-list source. It
contains the source bar and list rail, and it is the canonical visual placement
for collections, recommendations, watch-later entries, history entries, and
later video-list kinds.

The list dock has bounded height and owns horizontal scrolling through the list
rail. Document, player-pane, and comment-pane scrolling remain independent.

The list dock has two enabled states. It is open when a selected source is
showing its rail. It is controls-only when no discovered source yields valid
video items or when the selected source route is closed. Controls-only state
keeps the activation control, available watch action buttons, and available
source buttons visible, closes the rail, and gives the stage the viewport
height minus the source bar height.

## Watch Action Control

A watch action control is an extension-owned dock control derived from a native
Bilibili watch action. The initial action kinds are like, coin, favorite, and
share. The action kind is a closed set with that stable order.

Bibilili discovers native watch action triggers from the page toolbar. It reads
the displayed count text and active state when Bilibili exposes them. Missing
native actions are absent from the dock.

The like, coin, and favorite buttons present sanitized clones of native visual
content and dispatch clicks to their native triggers. Bibilili does not call
their action APIs directly or replace native action dialogs or account logic.

The share button presents the native share count and copies the current watch
URL when activated. It shows the native share visual normally and replaces only
the cloned share icon with a Bibilili-owned copy icon while hovered. It does
not proxy Bilibili's native share popover.

Watch action buttons are keyed by action kind. Reconciliation updates them in
place, replaces cloned visuals from current native markup, and removes buttons
for absent native triggers.

## Account Control Bridge

The account control bridge maps the current-user avatar in the comment composer
to Bilibili's native header account control. Bibilili discovers the page-owned
header account trigger during reconciliation; activating the composer avatar
inside the transformed comment pane clicks that trigger. Login prompts, account
menus, and account navigation remain owned by Bilibili.

The bridge target is the native header account control. Native comment-section
avatars are never account-control targets, even before the comment tree is moved
into the transformed pane.

Native account overlays may be marked with a Bibilili bookkeeping attribute so
they paint above the transformed viewport. The attribute changes only stacking
order and is removed when the transformed layout is released or destroyed.
Static overlay nodes receive a companion positioning marker so their stacking
order can take effect without changing Bilibili account behavior.

The bridge is scoped to the current-user avatar zone at the top of the comment
pane. Comment-row avatars retain their native link and profile behavior.

## Source Route

The source route is the selected source kind for the list dock. It defaults to
the first available source in source-kind order: collection, recommendations,
watch later, history. Reconciliation preserves the current route while its
source remains available; when the route disappears, the first available source
becomes selected.

Selecting a source route replaces the list rail with that source's video items.
Selecting the current route closes an open rail without clearing the route, or
reopens a closed rail. Source routes do not toggle a source off and do not
combine multiple sources in one rail.

## Source Bar

The source bar is the control row inside the enabled list dock. It begins with
the activation control, then contains one route button per discovered source
kind, then contains the watch action group when native watch actions are
available. The initial source buttons represent collection, recommendations,
watch later, and history when those sources are available. Their labels use the
current UI language.

The selected source button keeps `aria-current` for the remembered route and
exposes the rail open state with `aria-expanded`. The selected visual treatment
applies only while `aria-expanded` is `true`. A source with no valid video items
is omitted from the source bar.

The source bar is rendered whenever the enabled list dock is present. With no
available source, it contains the activation control and any available watch
action buttons.

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

When the selected source is a collection, the rail identifies the card whose
watch route matches the current page. It scrolls to that card once for the
current page session, and it does so again when the collection route is opened
explicitly.

## Video Card

A video card is the extension-owned rendering of one video item. It uses a
fixed card width and stable thumbnail aspect ratio. Card content keeps the rail
height stable.

The card links to the item's target URL. Activating it uses normal page
navigation unless the browser or Bilibili intercepts the link. When a thumbnail
is unavailable, the thumbnail area presents the video title and clamps it within
the fixed preview height.

During same-route reconciliation, existing card anchors and stable child nodes
are reused. Advisory list or thumbnail updates change card content and explicit
thumbnail state in place so normal link activation is not interrupted.

A collection card matching the current watch route exposes `aria-current` and
uses selected border and title colors. For collection cards, a native
current-row marker from Bilibili is equivalent to a matching watch route.

## Runtime Controller

The runtime controller coordinates discovery, activation, layout updates,
mutation observation, account source loading, and same-tab navigation
detection. It observes same-tab navigation, lazy region insertion, list
updates, account source completion, and page theme marker changes. When the
watched video changes, it starts a new page session and rebuilds discovered
regions.

Reconciliation is the controller's idempotent update pass over the current watch
page. Requests carry a priority and a source-reset flag. The reset flag clears
the page-session source route when the visible video session changes.

Reconciliation has two priorities. Urgent requests come from activation,
initial startup, and same-tab navigation. Lazy requests come from page
mutations, theme changes, page priming, and startup settling.

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
page-owned comment tree. When the watch title changes, the player title overlay
receives the current title.

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

If the watch title is unavailable, the player title overlay is not shown.

If no video-list source yields valid video items, the list dock is shown only
as the enabled activation surface.

If a later mutation provides comments or valid list items, the missing component
is mounted during reconciliation.
