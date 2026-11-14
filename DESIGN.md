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
defines persisted activation, feature preferences, action placement, comment
width, navigation-origin, source-route state, and the last favorite folder per
account. `src/content-controls.js` defines shared controls, expandable search,
extension icon paths, and popup positioning and focus.
`src/content-favorites.js` owns the favorite-folder picker.
`src/content-operation-history.js` retains tab-local operation records and
renders their undo and redo controls in Settings.
`src/content-performance.js` aggregates runtime measurements in fixed-size
records for each document. `src/content-performance-monitor.js` records bounded
diagnostic events and retains a trace across page loads.
`src/content-performance-view.js` presents manual snapshots in Settings and the
diagnostic indicator beside its launcher.
`src/content-settings.js` renders the settings view from ordered definitions and
the controller's preference snapshot. `src/content-theme.js` defines browser
color-scheme resolution and Bilibili native theme synchronization.
`src/content-scheduler.js` is the scheduling prelude. It defines urgent and
lazy reconciliation request coalescing. `src/content-navigation.js` coordinates
video-switch requests and native comment readiness through the packaged
page-world bridge in `src/page-navigation.js`. `src/content.js` is the main runtime.
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
into the bottom dock. The selected source also opens as a full list in the
browse panel.

## DOM Ownership

Bibilili owns the loading cover, layout root, stage, panes, video header, list dock,
source bar, video description presentation, watch action group,
current-video watch-later control, list rail, browse panel, video cards,
watch-later mutation controls, Settings, More, and favorite-folder popups,
extension classes, and bookkeeping attributes.
Bilibili owns the player, comments, source roots, links, native watch metadata,
native uploader card, watch action triggers, account controls, account lists,
and network-backed content.

Bibilili may move page-owned player, video description, and comment nodes into
extension containers. It keeps remaining page-owned watch metadata and
video-list roots available for observation and extraction, and it renders
account list API records into extension-owned cards without modifying native
account list DOM.

Bibilili may add and remove watch-later account records through Bilibili's
account API. The current-video favorite action may add an unsaved archive to the
selected favorite folder. Operation history can reverse and repeat these
favorite saves and rail removals. These operations are account-list mutations.

Bibilili hands archive card navigation to Bilibili's native player API when
in-page switching is enabled. Otherwise, card links load a new document. The
player and watch page own video resolution, playback, metadata, comments, and
browser history.

Bibilili mirrors native watch action state with extension-owned buttons. Like
and coin forward clicks to Bilibili's page-owned triggers. Active favorite
buttons also forward clicks. Coin and favorite dialogs remain page-owned
overlays. Share copies the current watch URL. The watch-later action adds the
current archive through the account API.

Bibilili forwards current-user comment avatar activation to the page-owned
account control when that control is available. Account menus, login prompts,
and account navigation remain under Bilibili ownership.

Bibilili removes only nodes it owns.

## Layout Root

The layout root is the extension-owned container for the transformed page. It
contains the stage and list dock and hosts the browse panel overlay. The stage
contains the player pane and comment pane; the list dock sits below the stage.

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

Extension-owned layout surfaces consume Bilibili CSS variables for backgrounds,
borders, text, and controls. Static fallbacks cover missing native variables.

## UI Language

The UI language is the language used by extension-owned labels and accessible
names. Settings offers Automatic, English, Simplified Chinese, and Traditional
Chinese. An explicit choice selects its packaged extension i18n catalog.
Automatic is the default. It resolves the language from Bilibili document
language markers, storage or cookie locale markers, localized page chrome,
the extension i18n UI language, and then the browser language.

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

The off state stops page mutation observation, URL polling, media-load
observation, watch-later request observation, account-list loading, and preview
demand. Settings and event-based activation remain available. Enabling samples
the current route before mounting.

Activation applies through an urgent reconciliation request after the current
input task when the player region is available. The layout mounts independently
of lazy reconciliation and page priming.

The activation state is a Bilibili-page preference recording the requested
state. It persists across same-tab navigation and page reloads when browser
storage is available. Storage events apply changes to other open Bilibili tabs.

## Settings

Settings manages extension preferences on the watch page. Its button follows
the activation control onto the native page when the layout is disabled and
sits at the end of the dock when enabled. The same button opens a nonmodal popup
with Features, Rail, Action bar, Operation history, and Performance tabs.
Operation history and Performance require their respective features to be
enabled.

The Settings view selector starts the Features tab. Concise is the default and
shows UI language, description and tags, and in-page video switching.
Fully fledged adds thumbnail enrichment, favorite click behavior, and operation
history. Advanced adds performance recording, exposing every feature setting.
View modes control the rows in Features and preserve tab availability, the
selected tab, feature values, rail and source choices, and action placements.

Settings remembers the last selected tab across videos and page reloads in
origin-local storage. Features is the initial tab when no valid selection is
saved. Hiding the selected tab returns to Features. Focus moves out of hidden
tabs and rows. Tab selection is stored independently of feature preferences.

The UI language selector follows Settings view. Language names appear in their
own language. The tab also controls the description and tags, missing-thumbnail
enrichment, in-page video switching, single-click favorite saves, operation
history, and performance recording. These features default to enabled except
operation history and performance recording, which default to off.

Disabling the description restores its native node and removes its extension
presentation.
Disabling thumbnail enrichment cancels pending cover requests and uses
page-provided thumbnails.

The Rail tab controls rail opening, rail refresh on return to start, automatic
rail continuation, and each video source. Its rows appear in every Settings
view. Refresh, continuation, and every source default to enabled.

Rail opening sets the open state of a route that reconciliation selects
automatically. Always opens the rail and is the default. Parts and collections
opens it when the route is the parts or collection source containing the
current video. Never leaves the dock controls-only. Origin and restored routes
keep their recorded open state, and source buttons open the rail under every
choice. A changed choice applies to the next automatic route and leaves the
current rail unchanged.

Disabling a source removes it from routing and source root marking. A disabled
account source cancels outstanding list requests and retains its cached items
and expansion for a refresh when re-enabled. Favorites appears before Watch
later in Rail, as it does in the dock. Disabling Favorites closes its picker and
cancels folder video requests. Folder metadata remains available to direct
saves in either click mapping. The current-video favorite action retains its
independent behavior and Action bar preferences.

Settings with non-obvious behavior, including video switching, direct saves,
automatic continuation, and rail opening, explain it through question-mark help
buttons beside their labels. The explanation appears on
hover or keyboard focus; activating the help button also reveals it for touch
input.

Action bar controls whether each list tool or watch action appears on the bar
or in More. List tools precede watch actions, as they do on the bar. List tools
are Locate, Start, Refresh, and Search. All actions default to the bar. Show
More button defaults to enabled and displays the launcher when More contains
available actions. Disabling it hides the launcher and closes its popup while
retaining action placements.
Source order and the Power and Settings entry points have fixed placement.

Preferences use a validated record of settings view mode, UI language, history
capacity, rail opening, and feature, source, and action booleans in Bilibili
origin-local storage. Changes persist across videos and reloads and propagate through
storage events to other Bilibili tabs. History capacity applies when its slider
loses focus; other preferences apply immediately.
Unavailable storage leaves the current page's choices active and displays a
save-failure status. Restore defaults resets language, history capacity, rail
opening, feature, source, and placement preferences while retaining the
settings view mode, available selected tab, activation state, and pane
dimensions.

Settings rows keep their control identity through reconciliation. Native watch
icons use the same sanitized visual renderer and watch-later snapshot as dock
buttons. List tools use the shared extension icon renderer. An unavailable
native action retains its preference row with an empty icon slot.

Settings, More, and the favorite-folder picker share viewport-clamped
positioning, outside-click dismissal, Escape handling, and focus return to
their launcher. Their keyboard events stay
within extension controls. The settings popup remains available while the
layout is disabled. Popups are excluded from native DOM discovery.

## Operation History

Operation history records video visits, successful direct favorite saves, and
successful Watch later rail removals. Its Settings tab precedes Performance.
Each record contains the original video title, watch URL, operation kind, and
completion time. Account mutations also retain the account and archive ids;
favorite saves retain the destination folder id.

The history retains records in tab-local session storage across page loads.
Its capacity defaults to 100 and supports 10, 20, 100, or 500 records. A discrete
slider previews the selected capacity and applies it on losing focus. Reducing
capacity removes the oldest records while retaining any pending operation.
Clear removes the recorded history and is unavailable during an undo or redo.
Clearing keeps the current visit deduplicated and leaves account data unchanged.

Records appear newest first. Visits are recorded after navigation settles and a
watch title is available; ordinary reconciliation does not repeat them. Failed
operations and attempts to favorite an already saved archive do not create
records. Disabling the feature stops capture, hides its tab, and retains existing
records. Disabling a selected history tab returns Settings to Features.

Favorite saves and rail removals expose Undo and Redo as curved-arrow icon
buttons with localized hover titles and accessible labels. Undo removes a
favorite from its original folder or adds a removed archive back to Watch later. Redo reapplies
the original operation. Each request verifies the original account before
submitting a mutation. Undo and redo update the same history record and refresh
the affected account source. Restoring a Watch later item uses Bilibili's normal
add order.

One history mutation runs at a time. Its row uses the shared loading bar and
disables mutation buttons while pending. Success shows a green checkmark and
switches Undo to Redo or Redo to Undo. Failure shows the request error beside the
unchanged retry button. A submitted mutation finishes if the history view closes
or the feature is disabled. Its completed state remains available when history
reopens.

## Runtime Measurements

The performance recorder aggregates extension work for the current document.
Recording defaults to off. Its preference persists with other features; its
aggregate measurements remain in memory. Disabling recording freezes totals,
enabling it resumes them, and resetting clears them. Same-document navigation
retains measurements. A new document starts new totals.

Measurements use three exclusive states: enabled and visible, enabled and
hidden, and extension off. Off includes visible and hidden documents. Elapsed
recording time is accounted for at state changes and snapshots. Counters record
reconciliation requests, relevant mutation batches, navigation and fast-loading
timer callbacks, API starts and failures, cancellations, and cached thumbnail
applications. Scheduling causes count requests before coalescing, including
direct updates when destination media and comments become ready.

Synchronous timing records retain count, total duration, and maximum duration
for reconciliation, discovery, layout rendering, and rail updates. Durations
are inclusive; nested phases overlap. They describe elapsed execution time,
including synchronous browser work, rather than processor utilization or power.
API counts cover extension account and preview requests. Outcomes belong to
the request's starting state. Reset and recording changes discard unfinished
samples.

The diagnostic monitor retains at most 80 recent events and the latest
unacknowledged alert at each severity. Events cover extension timings, API
failures and bursts, player buffering, long tasks, visibility, window focus,
browser freeze/resume events, route changes, and native navigation handoffs.
A failed handoff records its timeout or native
failure reason before the extension requests full-page navigation. Reports
include browser and extension versions, canonical watch identity, player
readiness and buffered duration, mute and volume state, navigation type, and
browser discard status. Window focus is recorded independently of browser
visibility; a page can report visible while another application has focus.
Request URLs, query strings, response bodies, page text, and account data are
excluded. Reports remain local until copied by the user.

Slow reconciliation events retain the distinct causes merged into that pass
and two states captured when it begins: whether a native navigation handoff
is pending and whether destination media and comment readiness is still being
tracked. Readiness tracking can continue after the handoff succeeds. Canceling
a queued pass discards its causes. Direct readiness updates have their own cause.

Each slow reconciliation event includes discovery durations for comments,
player, metadata, watch actions, account control, source-root discovery, source
item extraction, and source selection. Repeated calls within a step accumulate
in the same pass. These timings measure existing reads and add no DOM queries.
They are retained with the event through copying, acknowledgement, and reload.

Warning thresholds are a 100 ms reconciliation or rail update, a 200 ms page
task, or three seconds of continuous buffering. Ten reconciliation passes
totaling one second or 20 extension API starts in a ten-second window also
produce warnings. API failures and failed player recovery produce warnings.
A one-second measured task, a two-second gap between foreground navigation timer callbacks,
ten seconds of buffering, a media error, or an extension navigation fallback
produce severe alerts. Page tasks and timer gaps measure symptoms across the
page; they do not identify the responsible script. Timer-gap alerts require a
visible, focused page. Focus and visibility changes reset that timing baseline.
Media events continue in the background and preserve buffering intervals across
visibility changes. Recovery events can report a completed stall even if a
throttled timer never sampled it. Pauses, seeks, and buffered playback do not
start buffering intervals. Browser freeze/resume events terminate those intervals
so suspension time does not count toward playback or timer alerts.

The existing navigation timer checkpoints diagnostics to tab-local session
storage at most once every five seconds. Visibility and window focus changes,
browser freeze/resume, departure, media errors, and native navigation fallback
checkpoint immediately. A new document can read one prior
trace captured within the last 30 minutes. Storage failures leave in-memory
capture available. Abrupt termination can lose events since the last checkpoint.
Disabling recording removes the stored trace. Reset clears current and previous
diagnostics as well as aggregate measurements.

Features exposes the Record performance switch. The Performance tab appears
only while this feature is enabled, including when the extension is off.
It shows a timestamped snapshot with state columns, then expandable work
timings, update triggers, and current resource counts. Resource counts include
page observation, navigation and loading timers, rendered and listed cards,
and preview requests and records.

The same feature shows an icon beside Settings in the dock or floating controls.
The icon is muted with no pending alerts, amber for warnings, and red for severe
events. Alerts also show an exclamation mark and a localized accessible label.
Clicking captures and copies a fresh JSON report. Successful copying acknowledges
only the included events and preserves their history; newer events remain lit.
Clipboard failure keeps alerts pending and offers retry feedback.

Disabling the feature hides the tab and returns a selected Performance tab to
Features. Keyboard tab navigation skips unavailable tabs.

The statistics view creates its tables when Performance is first opened.
Opening or selecting Performance captures a snapshot. Refresh replaces it;
ordinary reconciliation keeps the displayed values stable. Reset clears
measurements and retained diagnostics and captures a new snapshot without
changing the recording preference. Copy report copies the displayed snapshot as JSON and
reports clipboard failure in place. The preference synchronizes across tabs;
measurements and resets belong to each document. Recording changes alone do
not request reconciliation or refresh account lists.

Recording uses existing runtime callbacks and bounded records. Enabled watch
pages observe media events and long tasks when supported, including while hidden.
Disabling the layout disconnects these observers and resets sampling baselines.
Recording adds no timer or network request. Disabled instrumentation
returns before reading the clock or allocating samples.
The page mutation handler excludes insertion and removal of extension-owned
surfaces, so opening a settings popup does not request a page update.

## Startup

The loading cover is an extension-owned surface above the entire watch viewport.
It follows the browser color-scheme preference from its first paint, using white
in light mode and charcoal in dark mode. It mounts from document start on enabled
pages and during activation. Same-document navigation keeps the mounted layout
visible. The cover shows the current title and uploader as native metadata
becomes available, with a localized loading title as fallback. It reads
existing page data without requesting video metadata or images.

The startup cover, comment overlay, and counted action overlays use one loading
view component. It renders optional text content with the same thin animated
bar. Indicator markup, fade timing, and reduced-motion rules are shared.
Comment and button covers also share overlay visibility and video transition
state. Each surface defines its placement and text.

Card navigation carries the current comment width and dock height in its
tab-scoped origin record. If the destination requires a new document, the
loading cover reserves those pane dimensions with an empty player surface,
destination metadata, and dock placeholders. Bilibili creates the destination
player and comments normally. The geometry expires with the origin record.

The cover background appears immediately and leaves native geometry intact
beneath it. The initial title, uploader, and indicator fade in over 180 ms;
the navigation shell shows them immediately. The cover fades out over 240 ms
after the layout mounts, the native lazy-primer pass ends, and two animation
frames allow the layout to paint. Optional comments, account
lists, and thumbnails continue loading independently. Reduced motion disables
animation. Disabling Bibilili or leaving the watch page removes the cover
immediately; a five-second deadline also removes it if startup stalls.

Player discovery is enough to mount the transformed layout. Lazy comments and
page-owned source data may settle afterward.

When no comments are attached to the pane, the controller may run one native
lazy-primer pass per watch route before moving comments. The pass briefly
scrolls the page-owned document toward comment and source regions, restores the
previous scroll position, and reconciles after Bilibili has had a chance to
create lazy nodes and attributes. Comments remain in the native page until the
pass finishes. Attached comments load within their pane and skip native priming.

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
hydrating them. An already attached comment region stays in its pane while
Bilibili temporarily empties it to load another video.

Video switches dim the comment pane, including its header and description,
while keeping its geometry and native nodes intact. The pane becomes inert and
exposes a busy state. A centered, localized status and the startup cover's thin
animated bar identify the transition. The status shares the pane's grid cell
and remains centered independently of comment scrolling.

Card activation starts this state before requesting playback. Native media
loads and watch-route changes use the same state; ordinary buffering does not.
The destination route, a displayable video frame, and a rendered destination
comment thread allow metadata reconciliation. Visible documents wait two paint
frames before the pane fades back over 240 ms. Hidden documents complete the
transition after reconciliation without waiting for paint. The page bridge
checks the native comment host's live archive identity, loading state, and
rendered content. Empty and closed threads count as completed loads.
Readiness is checked again before reveal;
elapsed time alone does not restore stale comments. A playback error still
waits for destination comments. New switches cancel queued reveals, and teardown
restores interaction. Reduced motion removes the fade and bar motion.

Visible documents check readiness every 100 ms for up to ten seconds after a
media load starts. Longer waits and hidden documents pause the loading animation
and share the existing 500 ms navigation check. Native media events can also
complete the transition in either visibility state. A new media load starts a
new fast-check interval.

Activating comment reload runs a forced lazy-primer pass and then reconciles the
current watch page. It does not reload the browser page or replace Bilibili
comment controls.

## Video List Source

A video list source is a Bilibili list that can produce video items. Source
kinds form a closed set: parts, collection, recommendations, favorites, watch
later, and history. A source kind is shown when page markup or an account list
exposes matching content.

Each source has a stable source kind, optional page-owned root node, and ordered
set of extracted video items. Source adapters convert page-owned list markup and
Bilibili account API payloads into video items for the bottom dock renderer.

Discovery identifies source kinds through named containers and list headings.
Heading fallbacks read a root heading or its direct header children; video-card
titles do not identify the containing list's kind.

Each source discovery pass shares selector matches, resolved roots, root
validation, headings, and playable target arrays. Candidate elements and roots
are deduplicated before resolution and validation. Root discovery reads the
current DOM on every pass. A candidate's target count and source item limit bound
its selection score. Candidates that cannot beat an already valid source skip
field extraction; ties retain the earlier root. Source adapters evaluate title
and metadata fallbacks in priority order and stop at the first usable value.

Extracted item arrays are cached by native root and source kind for the current
watch route. Native content mutations, inherited attribute changes, and root
moves invalidate affected roots. Image loads invalidate their containing
sources; stylesheet, theme, and viewport changes invalidate cached items.
New roots are extracted on discovery, and absent roots are released. Navigation,
observation shutdown, and explicit rail refresh clear the cache. Account updates
and unrelated page mutations reuse unchanged native source items.

The route model converts playable Bilibili URLs into route identities, archive
preview identities, canonical archive URLs, and route keys. Archive route keys
include the page number; bangumi route keys use the playable bangumi identity.

Parts and collection sources require at least two valid items. A one-item list
does not provide navigation and remains absent from the source bar. Other source
kinds require one valid item, except Favorites, whose enabled entry also
provides folder selection and account recovery when no videos are loaded.

## Parts and Collection Sources

A parts source is the ordered page list within the current archive. Each item
targets the current BV or AV with its one-based `p` route. Native part labels
may be short values such as `1`. Bibilili derives parts from explicit multipage
links, standalone multipart rows, or nested page rows in Bilibili's video-pod.
Standalone multipart rows carry CID keys; their list order supplies the page
number.

A collection source is an ordered list of distinct playable archives. Its items
target separate BV or AV routes. Nested part rows do not become collection
items.

Bilibili may render collection archives and the current archive's parts in one
video-pod. Discovery can derive both sources from that root while keeping their
items and routes separate.

## Account Video List Source

An account video list source is a Bilibili account list fetched by the content
script with the current Bilibili login cookies.

The account source kinds are favorites, watch later, and history. Favorites
reads the signed-in account's owned folders and the selected folder's videos.
Watch later reads Bilibili's to-view list; history reads the recent video history
list. Each API response is normalized into the same video item shape used by
page-owned sources. History is read-only in the dock. Watch later supports
additions from the current watch action and collection, recommendation, and
favorite cards. It supports removals from account-backed watch-later cards.

The account source store retains valid items and expansion state separately for
each source. History starts with a request for 30 entries and retains the
response cursor for older pages. Watch later retains the returned list and
initially exposes up to 80 items. Favorites starts with 20 entries and retains
a numbered continuation for each folder. Each expansion reveals up to 30
retained items or fetches one continuation page. Pages merge by playable route
identity in API order. Empty raw pages, missing continuations, and repeated
cursors end continuation; a page whose entries are all filtered can continue.

Watch-later expansion can advance directly to the batch containing a cached
target. It retains any deeper expansion and leaves an absent target unchanged.
Automatic rail continuation uses the same local reveal path before any account
request.

Expansion survives source switches, ordinary reconciliation, and same-document
video navigation. Disabling the extension, replacing the document, or changing
the UI language resets the account source session.

Watch later also reads the full list count from to-view response metadata when
Bilibili exposes it. The count is account-state metadata. It is independent of
the revealed rail item count, which follows the current expansion depth and
valid-item rules.

Account source fetches are advisory and never block the first transformed
layout. Watch later and history remain absent until their initial requests
yield valid items. Favorites remains available for folder selection and account
status. Failed refreshes preserve usable items. Failed continuation requests
preserve the loaded items and cursor so the same page can be retried. Each
source instance allows one active request and discards completions from
canceled requests.

Account sources do not have page-owned roots. They are rendered in the bottom
dock but do not participate in source-root hiding.

Watch-later items carry the archive id required by Bilibili's to-view deletion
endpoint when the account payload exposes it. A successful deletion removes the
item from the loaded watch-later source and reconciles the dock. Deleting the
currently open video from watch later leaves the watch page open.

The current watch action and collection, recommendation, and favorite cards
derive a to-view add identity from their archive target URL. A successful card
addition refreshes watch later at its current expansion depth and hides the
card add control for that target during the current layout session. The current
watch action remains available after a successful addition.

While the watch-later source is enabled on an active watch page, a resource
observer detects completions of fetch and XMLHttpRequest calls to the to-view
add endpoint. Each completion signals a possible account change. The source
refreshes through its list endpoint at the retained expansion depth. Observation
continues in hidden tabs and uses no polling or historical resource replay.

Completions newer than an in-flight list request coalesce into one follow-up
refresh. Extension-owned additions supply their own refresh on success. Delayed
resource events already covered by a newer list request require no further
refresh. Disabling observation clears pending follow-up work. Browsers without
resource observation retain explicit additions and manual list refreshes.

The browse panel continues the selected source through the same record and
cursor as the rail. A panel continuation or full-source scan shares the
source's single active request. The scan requests pages until the cursor ends
or the scan stops. An empty page that advances the cursor remains a valid scan
step. Retained items and the cursor survive a closed panel, so a later
continuation resumes from the same position.

## Favorite Folders

A favorite folder is one account-owned list identified by its Bilibili media-list
id. Favorites is one source kind; each folder is a source instance. Folder names,
counts, and the default-folder marker come from the folder directory. Counts can
include unavailable or non-video entries, which the video adapter omits from the
rail.

The Favorites source button precedes Watch later and opens or collapses the
selected folder's rail. The default folder uses the plain Favorites label.
Other folders append their name after a middle dot. The adjacent chevron opens
a folder picker above the dock without changing stage geometry. The picker uses
the shared popup lifecycle, keyed folder buttons, and the page theme.

The source button and the chevron form one split button with a shared outline
and an inset divider. Hovering either half highlights the whole outline. The
selected treatment covers both halves while the Favorites rail is open. The
chevron points up toward the picker. While the picker is open, the chevron half
is tinted and the chevron points down.

The picker aligns its left edge with the split button. Its header holds a
heading and a refresh button. Folders follow in directory order. Each row shows
a check for the selected folder, the folder name, a marker on Bilibili's default
folder, and the media count. Zero-count folders remain selectable. A caption
below the list states that the selected folder also receives direct saves.

A search field replaces the heading when the directory holds more than eight
folders. It matches folder names. Escape clears a query; Escape with an empty
query closes the picker. Arrow keys, Home, and End move between visible
folders, and a typed character moves focus to the search field. Opening the
picker focuses the selected or first visible folder.

The directory loads when a watch page starts, while the Favorites source or the
favorite action is enabled. Loading the directory restores the selected folder
and its label. It leaves the rail route and visibility unchanged and does not
fetch folder videos. The first page of a folder's videos loads when its rail is
first shown. Opening the picker rechecks the account and directory. Retained
folders stay visible during the recheck, and the refresh button reports its
progress.

A source-label click opens the selected folder's rail. Before the directory
has resolved a selection, the click opens the picker and resumes the saved
folder after the check. Without a valid saved selection, the directory selects
Bilibili's default folder. If that folder is unavailable, the picker stays
open. Selecting a folder loads its cards on demand through the account store.
Each visited folder retains its cards, continuation, and horizontal rail
position for the layout session.

The last folder is stored per account. Navigation origins and the tab-scoped
source route carry the folder id. A restored id must belong to the authenticated
account's directory before its videos are requested. A deleted selection falls
back to the default folder when available. Sign-out and account changes discard
cached folder data.

Loading, signed-out, failed-request, and empty-folder states remain inside the
picker or selected rail. In the picker, a state shows one message and at most
one action. An empty directory reads as loading during its first request. Retry
preserves usable cards after a network failure. The sign-in action forwards to
the native account control. The picker's refresh button updates the directory;
rail Refresh reloads the selected folder from its first page. Favorites uses the existing current-card highlight, Locate, pagination,
and add-to-watch-later controls.

The selected folder is also the destination for direct saves from the
current-video star. Its selection remains current when the rail is closed,
another source is shown, or the Favorites source is disabled. Native favorite
controls own folder management. Operation history can undo a direct save from
its original folder.

## Video Item

A video item is the uniform record rendered by the bottom dock. It contains a
target URL, title, thumbnail when available, source kind, and optional metadata
such as duration, author, view count, or progress. The target URL and title are
required; source adapters skip items missing either field.

A video item may carry a `timestamp` field in Unix milliseconds. It is the
list's own ordering time: history `view_at`, favorite `fav_time`, or watch-later
`add_time` when Bilibili exposes it. The browse panel uses it for date sections.
Cards do not display it. A source without a usable timestamp renders as one
ungrouped section.

A video item may carry `durationSeconds`, the duration in whole seconds. Account
adapters read it from record duration fields; page-owned adapters parse it from
the duration token. Account records with progress also carry a `watchState`:
unwatched, partial, or finished. Bilibili reports progress for the
last-watched part. A multipart archive is finished only when that part is the
last part and its progress marks it finished; otherwise any progress makes it
partial. The card's progress label continues to describe the last-watched part.
The browse panel uses both fields for filters.

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

Preview demand contains visible items from the active list surface and, for
the rail, up to three adjacent items on each side. While the browse panel is
open, its visible card rows supply demand instead of the rail; closing the
panel restores rail demand. Visible items have request priority. The preview
store allows four active metadata requests and cancels queued or active work
when an item leaves demand. Closing both list surfaces clears demand. Completed
results remain cached for the page session.

Preview fetches do not block rendering. Failed, unsupported, private, deleted,
or unavailable videos keep the title placeholder for the page session.

## List Dock

The list dock is the bottom container for the selected video-list source. It
contains the source bar and list rail, and it is the canonical visual placement
for parts, collections, recommendations, favorite folders, watch-later entries,
and history entries. The browse panel presents the same source as an alternate
full-list surface.

The list dock has bounded height and owns horizontal scrolling through the list
rail. Document, player-pane, and comment-pane scrolling remain independent.

The list dock has two enabled states. It is open when a selected source is
showing its rail, including Favorites loading and empty states. It is
controls-only when no source is available or the selected route is closed.
Controls-only state keeps the activation control, available watch action
buttons, and available source buttons visible, closes the rail, and gives the
stage the viewport height minus the source bar height.

The dock's height transitions between its two states, so the stage resizes
continuously. Closing retains the rendered cards until the dock reaches its
controls-only height; the cards slide down with the source bar and clip against
the viewport edge.

## Watch Action Control

A watch action control is an extension-owned dock control for the current watch
video. The action kinds are like, coin, favorite, share, and watch later. The
action kind is a closed set with that stable order within each placement.

Bibilili discovers native watch action triggers from the page toolbar. It reads
toolbar roots once per pass and evaluates selectors in priority order until a
valid unused trigger is found. Document-wide fallbacks run only when toolbar
candidates yield no trigger. Displayed count text and active state are read on
each pass. Missing native actions are absent from the dock. The watch-later
action is absent when the current watch URL is not an addable archive target
or no native watch-later visual has been captured.

The like, coin, and favorite buttons present sanitized clones of native visual
content. Like and coin dispatch clicks to their native triggers. The coin action
may open Bilibili's native coin dialog.

The favorite action forwards to Bilibili immediately when the star is active.
With Single click to save to selected folder enabled, an inactive star saves
directly on single click and opens Bilibili's folder chooser on double click.
Turning the setting off swaps these actions. Keyboard activation uses the
single-click action.

An inactive pointer click waits 500 milliseconds before its single-click action.
A double click during that interval replaces it with the alternate action.
More stays open until the action resolves so its favorite button accepts both clicks.

A direct save uses the favorite-folder selection captured on the first click.
On a fresh page, the account store restores the saved selection or default folder
on demand. It validates the account and checks existing favorite state before
submitting the addition. An already saved archive, unavailable selection, or
failed request uses native handling.

A direct save disables repeated clicks while pending and lights the star after
success. Its count continues to mirror Bilibili. The saved state remains until
native state catches up; closing a native favorite dialog rechecks it for
removals. Success refreshes the directory and any loaded destination folder.
Navigation, layout deactivation, or changing the click mapping cancels the pending
gesture and save preparation. A submitted save may finish, but its completion does
not update a different page.

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

Video switches cover each watch action button with the comment pane's thin
loading bar and dim its icon and count. Button dimensions stay fixed. Covered
buttons are disabled and expose a busy state; accessible labels omit stale
counts and pressed state. The buttons share the comment pane's loading period.
Destination metadata and action controls reconcile before the covers fade out.
Pending watch-later additions retain their disabled state after the transition.

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

The source route is the selected source kind and optional favorite-folder id
for the list dock. It defaults to the first source with valid items in source
order: parts, collection, recommendations, favorites, watch later, history.
Favorites provides a folder-selection surface when no source has valid items.
An automatically selected, unchosen Favorites surface yields to sources that
load valid items. Explicitly selected and restored routes retain their source
while folders load. Reconciliation preserves a chosen route while its source
remains available; when the route disappears, the first available source
becomes selected. An automatically selected route takes its open state from the
rail opening preference.

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
kind, then the rail action group, then the pinned watch action group when
native watch actions are available. Source buttons represent parts, collection, recommendations,
favorites, watch later, and history when those sources are available. Their
labels use the current UI language.

The selected source button keeps `aria-current` for the remembered route and
exposes the rail open state with `aria-expanded`. The selected visual treatment
applies only while `aria-expanded` is `true`. Favorites keeps its folder picker
available while empty. Other sources with no valid video items are omitted
from the source bar.

The source bar is rendered whenever the enabled list dock is present. With no
available source, it contains the activation control, available uploader
summary, and any available watch action buttons.

Source buttons are keyed by source kind. Reconciliation updates them in place,
orders them after the activation control and before the rail action group, and
removes buttons for absent sources. Stable button identity preserves
in-progress pointer and keyboard interaction while Bilibili mutates the page.

The bar groups controls by subject. List controls lead: the source buttons and
the rail action group that acts on the selected source. Current-video controls
follow: the watch action group sits directly after the list controls, separated
by a vertical border. The remaining free space precedes More and Settings.

The rail action group follows the last source button. Pinned tools retain
Locate, Start, Refresh, Search order. The Search tool opens the browse panel
for the selected source. It follows the same placement preference as other list
tools and is unavailable while the rail is closed or the source has no valid
items. More and Settings remain at the trailing edge of the bar. Their leading
separator appears when More is visible. The bar uses equal horizontal edge
padding before the activation control and after Settings, including while its
contents scroll.

An active watch action tints its icon and count with the selection color. The
bordered selection treatment is reserved for the selected source button.

Closing the rail retracts the pinned rail tools toward the source buttons
instead of leaving disabled buttons dimmed on the bar. Opening the rail extends
them again. The tools stay mounted and disabled while retracted, so placement,
labels, and handlers survive the transition.

More contains unpinned list tools followed by unpinned watch actions, with
visible action labels. Each action keeps one button node, count, loading state,
and click handler as it moves between the bar and popup. Reconciliation retains
the placement preference. Opening a native action dialog dismisses More first.

## Rail Locate

The Locate button presents a crosshair icon with a localized tooltip and
accessible name. It centers the current video in the displayed rail. It is
disabled when the rail is closed or the displayed items contain no current
video. Locate preserves the selected source and account expansion depth.

Locate matches the current watch route or the collection's native current-row
marker. Reconciliation records the first matching item's logical index while
building rail entries. Activation uses that index to render the destination
window through the existing rail positioning path.

## Rail Start

The Back to start button returns the rail to its beginning. It presents a left
chevron and vertical bar with a localized tooltip and accessible name. It is
disabled when the rail is closed. Activation renders the first rail window and
preserves the selected source.

Refresh list when returning to start is enabled by default. Activation uses the
Rail Refresh behavior after resetting the scroll position. An in-flight refresh
is shared by both controls. Disabling the feature preserves account expansion
depth and returns to the first window without refreshing the source.

## Rail Refresh

The Refresh button reloads the selected rail source. It presents a circular-arrow
icon with a localized tooltip and accessible name. It is disabled while the rail is closed or a refresh is
pending. Refresh preserves the selected source while it remains available.
Scroll position is retained within the updated rail's bounds.

Loaded account lists refresh through one request to their list endpoint.
Watch later retains its expansion budget. History and Favorites restart from
the first page; subsequent entries follow the rail's continuation behavior.
Failed requests retain usable items.
Page-owned sources are re-extracted from Bilibili's current list markup.
Refresh updates the dock without reloading the page or remounting the player
and comments.

## Search Entry

The Search tool is available while a rail is open. It presents a search icon
with a localized tooltip and accessible name. Activation opens the browse panel
with its search field focused, including when the tool was in More. The tool
declares a dialog popup with `aria-haspopup`, exposes the panel's open state
with `aria-expanded`, and references the panel with `aria-controls`.

The rail does not filter its own cards. The browse panel owns the query and
filters for the selected source. Closing the panel leaves the rail's route, open
state, and scroll position unchanged.

## List Rail

The list rail is the horizontal scroll surface inside the list dock. It renders
one group for the selected source while the source route is open. Every group
uses the same card layout; native Bilibili list styling has no role in the
bottom presentation.

The rail accepts horizontal gestures and translates unmodified vertical wheel
input into horizontal scrolling. Modified wheel input retains browser handling.
Route changes replace the group in place. Selecting a source reopens the rail.

A rail window contains the visible cards and up to three neighbors on each
side. The row retains the width of all revealed items while only window cards
have DOM nodes. A focused card and a card with an active pointer press remain
mounted until the interaction ends. Scrolling and resizing update the window
once per animation frame, independently of page discovery.

Cards retain their logical order and fixed positions within the full row.
Keyboard navigation reveals adjacent items across window boundaries. Resizing
preserves the logical scroll position when card dimensions change.

Account-backed favorite, history, and watch-later groups end with a card-sized
continuation tail while additional items are available. The tail stays at the
end as cards are appended and keeps its DOM identity during reconciliation. It
is removed when continuation ends.

Automatic rail continuation loads the next batch when the visible window
reaches within two cards of the tail. Watch later reveals its retained items
without a request; favorites and history request their next page. The tail is a
decorative skeleton in transit. A failed continuation exposes a localized Retry
control in the same slot and is not retried automatically.

An automatic continuation that adds no cards stops automatic loading for that
source and exposes the explicit Show more button instead. A manual continuation
that adds cards restores automatic loading. Switching or closing the source
clears the stopped state.

Disabling automatic rail continuation restores the explicit Show more button. The button uses the
video card dimensions, presents Loading while a request is active, and presents
Retry after a continuation failure. Keyboard activation focuses the first
appended card if focus remains on the button when loading completes. If
continuation ends without adding a card, focus moves to the last existing card
before the button is removed.

Opening the browse panel suspends the rail's proximity trigger; the panel owns
continuation while it is open. Opening or closing the panel leaves the rail's
route, open state, and scroll position unchanged. Retained items the panel adds
remain available to the rail.

Expansion preserves the rail scroll position and does not recenter the current
video.

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

A video card is the extension-owned rendering of one video item. The rail
renders it at a fixed card width with a stable thumbnail area. The browse panel
renders the same card at a fluid width with a 16:9 thumbnail. Card content keeps
rows stable within each surface.

The card links to the item's target URL. Plain same-tab archive activation uses
the configured video-switching behavior for every source kind. Modified clicks,
downloads, and new-tab targets retain normal browser behavior. Activating the
current watch route preserves playback unless the link specifies a timestamp
or supersedes an unfinished switch.

When a thumbnail is unavailable, the thumbnail area presents the video title
and clamps it within the fixed preview height.

During same-route reconciliation, retained card roots, link anchors, and stable
child nodes are reused. Advisory list or thumbnail updates change card content
and explicit thumbnail state in place so normal link activation is not
interrupted. Thumbnail elements are created with window cards and use browser
lazy loading.

A parts card matching the current archive page route exposes `aria-current` and
uses selected border and title colors. A collection card for the current
archive uses the same treatment. For collection cards, a native current-row
marker from Bilibili is equivalent to an archive match.

Collection, recommendation, and favorite cards with archive targets include an
overlay add-to-watch-later button. Watch-later cards with a deletion identity
include an overlay removal button. The mutation button appears on card hover or card
focus, sits at the top-right of the card, and handles its own activation.
Add controls use the same captured native watch-later visual as the
current-video watch-later action. Removal controls always use an
extension-owned trash icon. Activating the rest of the card follows the card
link.

## Browse Panel

The browse panel is the vertical, full-source presentation of the selected
video-list source. It renders the source's video items as a grid of the same
cards used by the list rail, grouped by source date when timestamps are
available.

The panel opens from the Search tool in the rail action group and from the
browser's find shortcut. The tool is available while a rail is open and its
source has valid items. Activating it from More closes More before the panel
opens. The tool declares a dialog popup with `aria-haspopup`, exposes the
panel's open state with `aria-expanded`, and references the panel with
`aria-controls`.

The panel is an extension-owned modal dialog anchored to the bottom of the
layout root. It is centered horizontally with a 24px viewport gutter on each
side and a 1240px maximum width. It occupies up to 79% of the layout root
height, leaves at least a 24px top gutter within the layout root, and keeps
enough height for its header, search row, and one card row. On tall viewports
its top edge leaves a strip of the stage visible. A translucent scrim covers
the layout behind it and consumes the pointer activation that dismisses it, so
the underlying player control does not receive that click. The panel and scrim
paint above the dock and stage. The panel is positioned within the layout root
and changes neither stage nor dock dimensions. It is not a list-dock state;
the dock keeps its open or controls-only state beneath it. The player remains
mounted and playback continues beneath the panel.

The panel covers the dock and the lower stage. Its scrim and focus containment
make the covered surfaces unavailable to pointer and keyboard input until it
closes. Keyboard events inside the panel do not reach Bilibili's player
shortcuts.

The panel presents the selected source instance. Favorites presents the
selected folder and searches that folder. A source route change, a closed rail,
a disabled source or layout, a lost player, an account change, or the start of
same-tab navigation closes the panel. When a source or rail change closes the
panel, focus moves to the selected source button or the activation control.
Same-tab navigation hands focus to the destination page. Ordinary
reconciliation updates an open panel in place. The panel is excluded from
native DOM discovery; its changes are extension-owned mutations.

A source instance first opens the panel at the top. It retains its panel scroll
position, query, and filters while the page session and layout session continue,
and a reopened panel restores the first visible card by key when it still exists
and otherwise opens at the top. A new page session starts at the top. The
panel's open state does not survive a document load. The panel does not move to
the current video; the rail retains that positioning behavior.

The panel header titles the source and shows a second line with the visible date
group and a count of renderable items. While a query or filter is active, the
count reads matching items over retained items. Counts describe renderable
items, not account or folder metadata totals. The header, search row, and scan
progress row stay fixed; the card grid owns the panel's vertical scroll. Panel
labels and date sections use the UI language; folder titles keep Bilibili's
wording.

Browse cards are the rail's cards rendered into a different geometry: a fluid
card with a 16:9 thumbnail above a fixed text block. The panel uses the same card
renderer and item key, the same current-card match, the same thumbnail state, the
same watch-later add or removal controls, and the same navigation callbacks.
Within a card, focus follows the rail's link and mutation control order. Each
surface owns and reconciles its own card nodes; the panel never moves a rail
card. The panel adds no card actions.

The panel uses the extension's dialog focus, Escape, and focus-return rules with
layout-anchored geometry rather than the shared popup positioning.

## Browse Date Groups

The panel groups items by the source timestamp's calendar date in the browser's
local time zone. Sections follow the order in which their first item appears in
the source, and items keep their source order within a section.

Sections use Today and Yesterday labels when those dates are present. Other
sections use a localized month and day, adding the year when it differs from
the current year. Today and Yesterday are UI message keys; other labels use
`Intl.DateTimeFormat` with the UI language. Date labels are computed when
sections are built, when the panel opens, and when the document becomes visible.
Each 46px section header row shows its label as a primary heading, a muted
count of renderable items, and a rule that fills the remaining width. Section
headers are headings in the grid.

An item without a valid timestamp joins the section of the nearest preceding
timestamped item. Items before the first timestamped item join the first dated
section. A source with no timestamps at all renders one ungrouped section.

Date headers are layout rows in the virtual grid and scroll with the cards. The
panel header shows the date group of the first visible card row while the grid
scrolls, so the current date remains identifiable without a pinned header.

Search and filters narrow items before sections are built. Section headers and
counts describe the filtered result. Section boundaries follow source order; the
panel does not reorder items by timestamp.

## Browse Virtual Grid

The panel lays out cards in a vertical grid. Each card keeps a 16:9 thumbnail
above a fixed text block. The grid targets a 220px minimum card width, chooses
the column count that fits the panel's content width, and divides the remaining
width evenly so cards fill each row. The card gap is 12px. Rows have a fixed
height for the current width; empty cells at the end of a row are not rendered.
A resize recomputes card width, card height, and the column count.

The panel virtualizes over layout rows: a date header row, a card row, and a
tail row. Fixed row heights let the scroll surface know the full content height
without measuring cards. The panel mounts the rows intersecting the viewport and
one row of overscan above and below. A focused card's row and a row with an
active pointer press stay mounted until the interaction ends.

Scrolling and resizing update the window once per animation frame,
independently of page discovery. Resizing recomputes the column count and keeps
the first visible item at the top rather than preserving the row index.
Appending items extends the content without moving the current scroll position.

The panel requests its next continuation when the rendered content approaches
its end, or when the content is shorter than the viewport and more items remain.
A 56px full-width tail row marks a request in flight. A failed continuation
keeps the rendered items and replaces the tail with a localized retry row. Retry is
explicit and resumes from the retained cursor. An automatic continuation that
adds no cards stops automatic loading for that source and exposes the explicit
continuation control instead; an explicit continuation that adds cards restores
automatic loading. One continuation request per source is active; the panel and
the rail share the source's request state.

A source refresh or an account mutation reconciles the open grid in place. The
panel preserves the first visible item and the focused item by card key. When
the viewport begins in a date header or in a gap between rows, the grid retains
the exact scroll offset so near-top updates do not snap to the next card row. If
the source shrinks past the current position, the grid clamps to its new end.

Changing the query or a filter rebuilds the layout rows and returns the panel to
the top. Clearing them rebuilds the unfiltered rows at the top. Matches that
arrive from a scan extend the rows without moving the current scroll position.

## Browse Search

The panel has its own persistent search field. Its accessible name and
placeholder name the selected source, not a broader video library. It searches
the complete selected source rather than only the items retained by the rail.
Whitespace separates query terms. Each term must appear in the title or author
as a case-insensitive, Unicode-normalized substring. Favorites searches the
selected folder.

Page-owned sources and account sources with no continuation filter locally. An
account source with a continuation starts a full-source scan after a short input
debounce. A filter change starts the scan without the debounce. The scan
requests one continuation page at a time through the source's normal request
path and adds matches to their date sections as pages complete. An empty
continuation page that advances the cursor remains a scan step; a missing or
repeated cursor ends the scan.

The panel reports the scan as provisional. The result count updates as pages
arrive, and the no-matches state appears only when the scan reaches the end. A
progress row below the search field shows a busy indicator and the number of
scanned items. Matches keep source order and are not ranked by relevance.

Changing the query, closing the panel, changing the source, or starting
navigation stops the scan after its in-flight page. The in-flight page is
retained, the cursor stays usable, and the source remains ready for a later
continuation. A scan failure keeps the matches already found and exposes a
localized retry; retry resumes from the retained cursor.

The scan uses the same source record and cursor as the rail. A completed scan
leaves the source fully retained by loading pages without scheduling a layout
reconcile; the rail renders the expanded list when the panel closes. Scan pages
update the panel and the source store without a page discovery pass or a
player, comment, or dock remount.

The panel owns the list query and filters. Closing and reopening the panel
retains them while the source instance continues; a source instance change or a
new page session clears them. Reopening a panel with a retained query or filter
resumes its scan when the source can continue.

The header count compares matching items with retained items while a query or
filter is active. The no-matches state sits in the grid while the query and
filters stay visible. It explains that Escape clears them and offers a control
that clears both and focuses the search field.

## Browse Filters

Browse filters are click-based controls that narrow the selected source together
with the query. The filters are watch status, duration, and uploader. They form
a chip row that follows the query field in the search row and wraps below it on
narrow panels.

Watch status is a pair of toggle chips: Unfinished and Finished. Unfinished
covers unwatched and partial items. Pressing a chip selects its status and
releases the other chip. Pressing the selected chip restores every status. Each
status chip shows the item count it would leave.

Duration and uploader are menu chips. An inactive menu chip shows an icon, the
filter name, and a disclosure chevron. An active menu chip shows the selected
option in the selection color and replaces the chevron with a clear control
that resets that filter. Activating the chip toggles its menu.

A filter menu is a nonmodal popover below its chip, inside the sheet. It lists
a reset option, a separator, and the filter's values as a radio group. Each
option shows its item count and a meter scaled to the largest count among the
filter's values. Choosing an option applies it, closes the menu, and returns
focus to the chip. One menu is open at a time. The menu shifts to stay within
the sheet's side edges and shortens to fit above its bottom edge. A pointer
press outside the menu's chip and popover, closing the panel, or a source change
closes the menu.

Duration buckets are under 5 minutes, 5 to 20 minutes, 20 to 60 minutes, and 60
minutes or more; each bucket includes its lower bound. Uploader options list
authors by descending count. An uploader menu with eight or more uploaders
starts with a lookup field. The lookup narrows the list by case-insensitive,
Unicode-normalized substring, clears each time the menu opens, and chooses the
first matching uploader on Enter.

A filter appears when retained items carry its data: a watch state, a duration,
or at least two distinct authors. An active filter stays visible so it can be
cleared. Without an available filter, the search row contains only the query
field. Items without a watch state or duration match only that filter's reset
state.

Counts apply the query and the other filters. Status chips and duration options
that would leave no items are disabled unless selected. Uploader options include
authors with matching items and the selected author. Scan pages update counts in
place. Menu options are reconciled by value, so the focused option survives an
update.

Clear filters appears while two or more filters are active. It resets every
filter without changing the query. A single active filter clears from its own
chip.

The query and filters combine conjunctively and keep source order. A filter
change has the same effects as a query change: it updates the header count,
suspends automatic continuation, and returns the grid to the top.

## Browse Keyboard and Focus

The panel is a modal dialog labelled by its source title. Opening moves focus to
its search field. The Close control precedes the search field in tab order.
Focus stays within the panel: Tab and Shift+Tab move through the Close control,
the search field, the visible filter chips and clear controls, the scan retry
control when visible, and the rendered cards, wrapping at the ends. Keyboard events inside
the panel do not reach Bilibili's player shortcuts.

Command+F and Control+F open the panel for the selected source and focus its
query field. The shortcut follows the Search tool's availability: it consumes
the key only while a rail is open with valid items, and otherwise the browser's
native find continues. An open More, Settings, or Favorites popup closes before
the panel opens. With the panel open, the shortcut refocuses the query field and
selects its text.

Tab or Shift+Tab that crosses a rendered card row mounts the adjacent card row
and moves focus to its first or last control, matching the rail's cross-window
behavior. A focused card's row stays mounted while the grid scrolls. When focus
is in the grid, Home and End move to the first and last card of the filtered
list, and PageUp and PageDown scroll one viewport without moving focus. Moving
focus reveals its target row.

ArrowDown or ArrowUp on a menu chip opens its menu. Opening focuses the lookup
field when present, and otherwise the checked option. Inside a menu, ArrowDown
and ArrowUp move through the lookup field and the enabled options, wrapping at
the ends. Home and End move to the first and last option. A printable key on an
option moves focus to the lookup field. Tab closes the menu and continues from
its chip; Shift+Tab closes the menu and focuses its chip.

Escape with an open filter menu closes the menu and focuses its chip. Otherwise,
Escape with a non-empty query or an active filter clears both and focuses the
search field. Escape with neither closes the panel. Clear filters also returns
focus to the search field. The Close control always closes. Closing by Escape or
the Close control returns focus to the Search tool, to the More launcher when
the tool is unpinned, or to the selected source button or activation control
when the tool is no longer available. A scrim pointer dismissal closes without
forcing focus.

A plain same-tab card activation closes the panel before navigation; focus
follows the destination navigation. Modified and new-tab activations leave the
panel open. When an account mutation or source refresh removes the focused
card, focus moves to the next card in reading order, then the previous card,
then the search field. Result-count changes and scan progress are announced
through the polite status regions; search failures are announced by the scan
row's alert state. Date changes
caused by scrolling are not announced.

The panel opens and closes with a short slide and fade. Reduced motion removes
the transition.

## Video Navigation

The feature preference `inPageNavigation` appears as “Switch videos without
reloading” and defaults to enabled. It applies to the next video switch. When
disabled, card links load a new document and native same-document video or part
changes trigger a reload of the destination URL. Source-route hints survive
the reload. Tracking parameters and fragment changes on the same watch route
retain the current page. The preference applies while Bibilili is enabled.

The navigation bridge hands a BV or AV identifier, one-based part, and optional
playback timestamp to Bilibili's player reload API. It works between archive
watch pages without requiring a matching page-owned list item. Bilibili resolves
the video's playback identifiers and updates its page through native player
events. The extension keeps the mounted layout and reconciles the new content.

The content script injects a packaged page-world script and exchanges
JSON-string DOM events with it. The page script validates playback inputs and
calls the native API. It has no extension API access. The browser history and
URL are written by Bilibili's watch page.

A handoff succeeds when the player manifest and visible route identify the
requested archive and part. If the native API is unavailable, the original link
opens normally. Failed or unresponsive handoffs use document navigation after
failure or a ten-second deadline. Other route types use normal links.

Each new card click retires the previous request's fallback. Disabling the
layout, leaving the watch page, or using browser history also cancels pending
fallback. A delayed failure cannot redirect an unrelated watch route. An AV
request canonicalized to a BV URL retains its source-route hint.

## Runtime Controller

The runtime controller coordinates discovery, activation, layout updates,
mutation observation, account source loading, and same-tab navigation
detection. It observes same-tab navigation, lazy region insertion, list
updates, account source completion, and page theme marker changes. When the
watched video changes with in-page switching enabled, it starts a new page
session and reconciles discovered regions in the mounted layout. The comment
scroll position and source-route interaction state reset for the destination
video. Full-page switching reloads the new watch route before reconciliation.
Same-tab navigation closes the browse panel before the destination transition.

Enabled documents retain mutation observation, URL polling, native navigation,
account loading, preview demand, and scheduled reconciliation while hidden.
Background route changes and replacement player regions follow the same
reconciliation path as foreground changes. Bilibili retains playback ownership.

Hidden documents dismiss the startup cover and pause loading animations and
fast readiness checks. Visibility requests one current-state reconciliation
without restarting account loading or the bounded settling passes. Disabling
the extension stops page observation, polling, and scheduled runtime work.

Same-document navigation preserves attached player and comment regions.
Bilibili updates its comment component's video identity in place. Reconnecting
that component initializes it from an original attribute that can identify a
previous video. The layout moves a replacement region when Bilibili supplies
one and restores native regions when disabled or leaving the watch page.

The mounted frame remains visible for up to five seconds while a missing player
is replaced. A replacement resumes reconciliation in the same panes. If no
player arrives by the deadline, the controller restores the native page and
leaves the activation control available for retry.

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
changes. Document-root classes and theme attributes are written only when their
values change, so reconciliation settles after page activity stops.

Changed native sources are re-extracted; unchanged sources reuse their cached
items. Account results merge with native sources without invalidating them.
The list rail and any open browse panel render from the current source route.
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

The browse panel is an absolute overlay within the layout root. Its height is a
fraction of the layout root and does not contribute to stage or dock sizing. Its
card grid derives card and row heights from its own content width and owns the
panel's vertical scroll. The document body remains non-scrolling.

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

The browse panel is unavailable when no source has valid items. An open panel
closes when its source is no longer selected or no longer has valid items. A
continuation failure inside the panel keeps rendered cards and exposes an
explicit retry row.

If a later mutation provides comments or valid list items, the missing component
is mounted during reconciliation.
