# Design

Bibilili is a Chrome extension for Bilibili watch pages. It transposes the
watch layout: comments move to the right of the player, and video lists move to
the bottom.

The player remains the visual anchor. Comments and video lists become bounded
scroll surfaces around it.

## Watch Page

The watch page is the Bilibili document for one visible video. Bibilili treats
it as discovered regions: player, comments, and video-list sources.

The player region contains the video player and immediate playback controls.
Bibilili moves its surrounding layout context while preserving playback logic.

The video title is page-owned watch metadata. Bibilili may read it for
extension-owned presentation surfaces.

The comment region contains the page-owned comment tree. Bibilili moves this
tree into a right-side scroll container.

Video-list sources contain page-owned list data. Bibilili reads them into
uniform list items and renders them in the bottom dock.

## Layout Root

The layout root is the extension-owned container for the transformed page. It
contains the stage and the list dock. The stage contains the player pane and
comment pane; the list dock sits below the stage.

The layout root owns viewport-level sizing. It assigns bounded height to the
list dock and gives the remaining height to the stage.

The layout root owns extension theme state. It reads explicit Bilibili
appearance markers first, then computed page colors, then the browser
color-scheme preference.

Extension-owned surfaces use theme tokens for backgrounds, borders, text, and
controls. Page-owned player, comment, and source roots keep native styling.
Theme tokens define clear foreground and background pairs for primary text,
muted text, selected controls, and badges in light and dark modes.

## Activation Control

The activation control is the global button for enabling and disabling the
transformed layout.

The control has two placements. When Bibilili is disabled, it floats at the
bottom-left of the page. When Bibilili is enabled, it is the leftmost control in
the bottom dock.

The control presents the extension logo asset as its visible mark. Its
accessible name and title state whether activating it turns Bibilili on or off.

Disabling Bibilili restores page-owned player and comment nodes to their page
locations, removes the layout root, and leaves the floating activation control
mounted. Enabling Bibilili starts a new transformed page session.

The activation state is a Bilibili-page preference. It persists across same-tab
navigation and page reloads when browser storage is available.

## Player Pane

The player pane contains the Bilibili player region. It occupies the main column
of the stage. The comment pane determines its width reduction; the list dock
determines its height reduction.

Bibilili leaves player controls, player events, and playback state under
Bilibili ownership.

The player pane may contain an extension-owned title overlay. The overlay reads
the watch title and appears at the top of the player pane when the pane is
hovered or focused.

The title overlay uses a vertical opacity gradient so the title remains legible
while the player stays visible. It is pointer-transparent, leaving playback
events to the player.

## Comment Pane

The comment pane is the right-side container for comments. It has the same
height as the player pane and owns vertical scrolling. Scrolling inside it does
not move the player or list dock.

The comment pane contains page-owned comment nodes. Bibilili may wrap the
comment region, while comment controls remain page-owned markup.

## Video List Source

A video list source is a Bilibili list that can produce video items.

The source kind is a closed set represented as an enum. The initial kinds are
recommendations, collection, watch later, and queue. A source kind is shown when
the page exposes matching content.

Each source has a label, stable source kind, page-owned root node, and ordered
set of extracted video items.

Source adapters convert page-owned list markup into video items. The bottom
dock renderer consumes adapter output.

## Video Item

A video item is the uniform record rendered by the bottom dock.

It contains a target URL, title, thumbnail when available, source kind, and
optional metadata such as duration, author, view count, or progress.

The target URL and title are required. Source adapters skip items missing either
field.

## List Dock

The list dock is the bottom container for every video-list source. It contains
the source bar and list rail, and it is the canonical visual placement for
recommendations, collections, watch-later entries, queues, and later
video-list kinds.

The list dock has bounded height. It owns horizontal scrolling through the list
rail. Document, player-pane, and comment-pane scrolling remain independent.

The list dock has two enabled states. It is expanded when at least one
discovered source is active. It is controls-only when discovered sources exist
and every source is disabled.

In controls-only state, the list dock keeps the activation control and source
bar visible and hides the list rail. The stage receives the viewport height
minus the source bar height.

## Source Bar

The source bar is the control row inside the enabled list dock.

It begins with the activation control, then contains one toggle button per
discovered source kind. The initial source buttons are Recommendations,
Collection, Watch Later, and Queue when those sources are available.

The buttons are not exclusive tabs. More than one source can be active at the
same time.

The default active set contains all discovered sources. Disabling a source
removes that source's group from the list rail. Enabling it restores the group
at its stable position.

Each source button exposes selected state with `aria-pressed`. A source with no
valid video items is omitted from the source bar.

The source bar is rendered whenever the enabled list dock is present. With no
available source, it contains the activation control alone. Disabled source
state is stored for the page session, so later reconciliation preserves
user-disabled choices.

## List Rail

The list rail is the horizontal scroll surface inside the list dock.

It renders one group for each active source. Groups appear in source-kind
order: queue, collection, watch later, recommendations.

Every group uses the same card layout. Native Bilibili list styling has no role
in the bottom presentation.

The rail scrolls horizontally across groups and cards. Source groups remain in
one rail so multiple active lists are visible in one bottom view.

## Video Card

A video card is the extension-owned rendering of one video item.

It uses a fixed card width and stable thumbnail aspect ratio. Card content keeps
the rail height stable.

The card links to the item's target URL. Activating it uses normal page
navigation unless the browser or Bilibili intercepts the link.

The card may display a compact source mark when multiple source kinds are
active.

## Reconciler

The reconciler maintains the transformed layout after initial mount.

It observes same-tab navigation, lazy region insertion, list updates, and page
theme marker changes. When the watched video changes, it starts a new page
session and rebuilds discovered regions.

Reconciliation requests are coalesced into the next pass. Page mutations cannot
indefinitely postpone activation or same-tab navigation.

When a source root changes, that source is re-extracted and the list rail is
re-rendered from the current active source set.

When the comment region changes, the comment pane receives the current
page-owned comment tree.

When the comment region is absent before first mount, the reconciler may run
one native comment-primer pass. The pass briefly scrolls the original document
toward the comment area, restores the previous scroll position, and reconciles
again after Bilibili has had a chance to create lazy comment nodes.

When the watch title changes, the player title overlay receives the current
title during reconciliation.

## DOM Ownership

Bibilili owns the layout root, stage, panes, player title overlay, list dock,
source bar, list rail, video cards, extension classes, and bookkeeping
attributes.

Bilibili owns the player, comments, source roots, links, controls, and
network-backed content.

Bibilili may move page-owned player and comment nodes into extension
containers. It keeps page-owned video-list roots available for observation and
extraction.

Bibilili removes only nodes it owns.

## Sizing Rules

The transformed page uses the viewport as its sizing boundary.

The stage height is the viewport height minus the list dock height. The player
pane and comment pane share the stage height.

The comment pane has vertical overflow. The list rail has horizontal overflow.
The transformed content uses pane-level scroll surfaces instead of document-body
scrolling.

The expanded list dock height fits one row of cards and the source bar. The
height is fixed or clamped, keeping late metadata from resizing the player.

The controls-only list dock height is the source bar height. When the list dock
is absent, its height contribution is zero.

## Failure Rules

Bibilili mounts only after it discovers a player region.

If comments are unavailable, the stage uses the player pane alone.

If the watch title is unavailable, the player title overlay is not shown.

If no video-list source yields valid video items, the list dock is shown only
as the enabled activation surface.

If valid video-list sources exist but none is active, the list dock is
controls-only until the user selects a source.

If a later mutation provides comments or valid list items, the missing component
is mounted during reconciliation.
