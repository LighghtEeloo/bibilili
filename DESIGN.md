# Design

Bibilili is a Chrome extension for Bilibili watch pages. It transposes the
watch layout: comments move from below the player to the right side, and video
lists move from the right side to the bottom.

The player remains the fixed visual anchor. Comments and video lists become
bounded scroll surfaces around it.

## Watch Page

The watch page is the Bilibili document for one visible video.

The extension treats a watch page as a set of discovered regions. Region
discovery produces handles for the player, comments, and video-list sources.

The player region contains the video player and immediate playback controls.
The extension moves its surrounding layout context without replacing playback
logic.

The comment region contains the page-owned comment tree. The extension moves
this tree into a right-side scroll container.

Video-list sources contain page-owned list data. The extension reads them into
uniform list items and renders those items in the bottom dock.

## Layout Root

The layout root is the extension-owned container for the transformed page.

It contains two regions: the stage and the list dock. The stage contains the
player pane and the comment pane. The list dock sits below the stage.

The layout root owns the viewport-level sizing rules. It assigns bounded height
to the list dock and gives the remaining height to the stage.

## Player Pane

The player pane contains the Bilibili player region.

It occupies the main column of the stage. Its width is reduced only by the
comment pane. Its height is reduced only by the list dock.

The extension does not intercept player controls, player events, or playback
state.

## Comment Pane

The comment pane is the right-side container for comments.

It has the same height as the player pane. It owns vertical scrolling. Scrolling
inside it does not move the player or the list dock.

The comment pane contains page-owned comment nodes. The extension may wrap the
comment region, but it must not replace comment controls with extension markup.

## Video List Source

A video list source is a Bilibili list that can produce video items.

The source kind is a closed set. The initial kinds are recommendations,
collection, watch later, and queue. A source kind is shown only when the page
exposes matching content.

The implementation should represent source kind as a closed enum, not as a
free-form label.

Each source has a label, a stable source kind, a page-owned root node, and an
ordered set of extracted video items.

Source adapters convert page-owned list markup into video items. Adapter output
is the only input used by the bottom dock renderer.

## Video Item

A video item is the uniform record rendered by the bottom dock.

It contains a target URL, title, thumbnail when available, source kind, and
optional metadata such as duration, author, view count, or progress.

The target URL and title are required. Missing required fields mean the source
adapter must skip the item.

## List Dock

The list dock is the bottom container for every video-list source.

It contains the source bar and the list rail. It is the only visual placement
used for recommendations, collections, watch-later entries, queues, and later
video-list kinds.

The list dock has bounded height. It owns horizontal scrolling through the list
rail. It does not cause the document, player pane, or comment pane to scroll.

## Source Bar

The source bar is the control row for visible list sources.

It contains one toggle button per discovered source kind. The initial buttons
are Recommendations, Collection, Watch Later, and Queue when those sources are
available.

The buttons are not exclusive tabs. More than one source can be active at the
same time.

The default active set contains all discovered sources. Disabling a source
removes that source's group from the list rail. Enabling it restores the group
at its stable position.

Each button exposes selected state with `aria-pressed`. A source with no valid
video items is omitted from the source bar.

## List Rail

The list rail is the horizontal scroll surface inside the list dock.

It renders one group for each active source. Groups appear in source-kind order:
queue, collection, watch later, recommendations.

Every group uses the same card layout. Native Bilibili list styling does not
determine the bottom presentation.

The rail scrolls horizontally across groups and cards. Source groups remain in
the same rail so multiple active lists are visible in one bottom view.

## Video Card

A video card is the extension-owned rendering of one video item.

It uses a fixed card width and a stable thumbnail aspect ratio. Card content
must not change the rail height.

The card links to the item's target URL. Activating it uses normal page
navigation unless the browser or Bilibili intercepts the link.

The card may display a compact source mark when multiple source kinds are
active.

## Reconciler

The reconciler maintains the transformed layout after initial mount.

It observes same-tab navigation, lazy region insertion, and list updates. When
the watched video changes, it starts a new page session and rebuilds discovered
regions.

When a source root changes, only that source is re-extracted and the list rail
is re-rendered from the current active source set.

When the comment region changes, the comment pane receives the current
page-owned comment tree.

## DOM Ownership

Bibilili owns the layout root, stage, panes, list dock, source bar, list rail,
video cards, extension classes, and bookkeeping attributes.

Bilibili owns the player, comments, source roots, links, controls, and
network-backed content.

The extension may move page-owned player and comment nodes into extension
containers. It must keep page-owned video-list roots available for observation
and extraction.

The extension removes only nodes it owns.

## Sizing Rules

The transformed page uses the viewport as its sizing boundary.

The stage height is the viewport height minus the list dock height. The player
pane and comment pane share the stage height.

The comment pane has vertical overflow. The list rail has horizontal overflow.
The document body should not become the primary scroll surface for transformed
content.

The list dock height is large enough for one row of cards and the source bar.
The height is fixed or clamped so late metadata does not resize the player.

## Failure Rules

The extension mounts only after it discovers a player region.

If comments are unavailable, the stage uses the player pane alone.

If no video-list source yields valid video items, the list dock is not shown.

If a later mutation provides comments or valid list items, the missing component
is mounted during reconciliation.
