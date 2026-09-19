(() => {
  "use strict";

  const { DomProbe } = window.__bibililiDom;
  const { UiControl, SearchControl, PopupPanel } = window.__bibililiControls;
  const { SettingsView } = window.__bibililiSettings;
  const { FavoritesView } = window.__bibililiFavorites;
  const { MovedPageNodeStore, SourceRootMarker } =
    window.__bibililiLayoutState;
  const { BILIBILI_WEB_ORIGIN, BilibiliRoute } = window.__bibililiRoute;
  const { DEFAULT_UI_LANGUAGE, LanguageResolver, UiMessage, UiStrings } =
    window.__bibililiI18n;
  const {
    BILIBILI_DARK_PAGE_ATTR,
    BILIBILI_LEGACY_DARK_COMMON_ATTR,
    BROWSER_DARK_SCHEME_QUERY,
    BilibiliThemeSync
  } = window.__bibililiTheme;
  const { ReconcilePriority, ReconcileScheduler } =
    window.__bibililiScheduler;
  const { NativeVideoNavigation } = window.__bibililiNavigation;
  const {
    ActivationPreference,
    CardNavigationOriginStore,
    CommentPaneWidthPreference,
    FavoriteFolderPreference,
    SourceRoute,
    SourceRouteStateStore,
    SettingsPreference,
    configure: configureStorageState
  } = window.__bibililiStorageState;

  const OWNED_ROOT_ID = "bibilili-layout-root";
  const FLOATING_TOGGLE_ROOT_ID = "bibilili-toggle-root";
  const LOADING_COVER_ID = "bibilili-loading-cover";
  const LIST_RAIL_ID = "bibilili-list-rail";
  const SOURCE_ROOT_ATTR = "data-bibilili-source-kind";
  const NATIVE_OVERLAY_ATTR = "data-bibilili-native-overlay";
  const NATIVE_OVERLAY_POSITION_ATTR =
    "data-bibilili-native-overlay-positioned";
  const HTML_MOUNTED_CLASS = "bibilili-mounted";
  const LOADING_COVER_TIMEOUT_MS = 5000;
  const LOADING_FADE_MS = 240;
  const PLAYER_RECOVERY_TIMEOUT_MS = 5000;
  const VIDEO_LOADING_CHECK_INTERVAL_MS = 100;
  const VIDEO_LOADING_CLASS = "bibilili-video-loading";
  const PLAYER_MEDIA_SELECTOR = "video, bwp-video";
  const PLAYER_LOAD_EVENTS = ["loadstart", "loadeddata", "canplay", "error"];
  const LOGO_ASSET_PATH = "assets/bibilili-logo-white.svg";
  const VIDEO_POD_SELECTOR = ".video-pod";
  const PAGE_LAZY_PRIME_DELAY_MS = 650;
  const URL_POLL_INTERVAL_MS = 500;
  const MAX_ITEMS_PER_SOURCE = 80;
  const ACCOUNT_FAVORITES_PAGE_SIZE = 20;
  const FAVORITE_CUSTOM_FOLDER_FLAG = 2;
  const FAVORITE_ARCHIVE_TYPE = 2;
  const FAVORITE_UNAVAILABLE_FLAG = 1;
  const ACCOUNT_HISTORY_PAGE_SIZE = 30;
  const ACCOUNT_WATCH_LATER_INITIAL_SIZE = 80;
  const ACCOUNT_MORE_BATCH_SIZE = 30;
  const MAX_CONCURRENT_VIDEO_PREVIEW_FETCHES = 4;
  const RAIL_WINDOW_BUFFER = 3;
  const COMMENT_PANE_WIDTH_PROPERTY = "--bibilili-comment-pane-width";
  const COMMENT_PANE_MIN_WIDTH = 240;
  const COMMENT_PANE_MAX_WIDTH = 640;
  const COMMENT_PANE_MAX_STAGE_RATIO = 0.5;
  const COMMENT_PANE_KEYBOARD_STEP = 24;
  const COMMENT_PANE_RESIZING_CLASS = "bibilili-is-resizing-comment-pane";
  const HAS_VIDEO_HEADER_CLASS = "bibilili-has-video-header";
  const LAZY_SETTLING_RECONCILE_DELAYS_MS = Object.freeze([
    400,
    1200,
    2600,
    5000
  ]);
  const ACCOUNT_NAV_URL = "https://api.bilibili.com/x/web-interface/nav";
  const FAVORITE_FOLDERS_URL = "https://api.bilibili.com/x/v3/fav/folder/created/list-all";
  const FAVORITES_SOURCE_URL = "https://api.bilibili.com/x/v3/fav/resource/list";
  const HISTORY_SOURCE_URL =
    `https://api.bilibili.com/x/web-interface/history/cursor?type=archive&ps=${ACCOUNT_HISTORY_PAGE_SIZE}`;
  const WATCH_LATER_SOURCE_URL = "https://api.bilibili.com/x/v2/history/toview";
  const WATCH_LATER_ADD_URL =
    "https://api.bilibili.com/x/v2/history/toview/add";
  const WATCH_LATER_DELETE_URL =
    "https://api.bilibili.com/x/v2/history/toview/del";
  const VIDEO_INFO_SOURCE_URL =
    "https://api.bilibili.com/x/web-interface/view";
  const BILIBILI_CSRF_COOKIE_NAME = "bili_jct";
  const SVG_NS = "http://www.w3.org/2000/svg";

  const PLAYER_SELECTORS = [
    "#bilibili-player",
    "#playerWrap",
    ".player-wrap",
    ".bpx-player-container",
    ".bpx-player-primary-area",
    "[class*='player-wrap']"
  ];

  const COMMENT_SELECTORS = [
    "#comment",
    "#commentapp",
    "#bili-comments",
    "bili-comments",
    ".comment",
    ".bili-comment",
    ".comment-container",
    ".reply-warp",
    ".reply-box",
    ".comment-m",
    "[class*='comment-container']",
    "[class*='reply-warp']"
  ];

  const COMMENT_PRIME_SELECTORS = [
    "#comment",
    "#commentapp",
    "#bili-comments",
    "bili-comments",
    ".comment"
  ];

  const COMMENT_USABLE_CONTENT_SELECTOR = [
    "textarea",
    "[contenteditable='true']",
    "button",
    "[role='button']",
    ".reply-list",
    ".reply-item",
    ".comment-list",
    ".comment-item",
    ".bili-comment-list",
    ".bili-comment-card",
    "[class*='reply-item']",
    "[class*='reply-content']",
    "[class*='comment-item']",
    "[class*='comment-list']",
    "[class*='comment-card']",
    "[class*='comment-renderer']",
    "[class*='CommentItem']",
    "[class*='CommentList']",
    "[class*='empty']",
    "[class*='Empty']"
  ].join(",");

  const COMMENT_RENDERED_SURFACE_SELECTOR = [
    "#bili-comments",
    "bili-comments",
    ".bili-comment",
    ".comment-container",
    ".reply-warp",
    ".reply-box",
    ".comment-m",
    "[class*='comment-container']",
    "[class*='reply-warp']",
    "[class*='Comment']",
    "[class*='comment']"
  ].join(",");

  const COMMENT_USABLE_TEXT_PATTERN =
    /(?:暂无评论|还没有评论|no comments|全部评论|评论区|发表评论|发一条友善的评论|reply|sort by)/i;
  const COMMENT_MIN_USABLE_TEXT_LENGTH = 12;
  const COMMENT_MIN_RENDERED_SURFACE_HEIGHT = 120;

  const WATCH_TITLE_SELECTORS = [
    "#viewbox_report h1",
    ".video-info-title",
    ".video-title",
    "h1.video-title",
    ".left-container h1",
    "h1[title]"
  ];

  const VIDEO_DESCRIPTION_SELECTORS = [
    "#v_desc",
    ".video-desc-container",
    ".video-desc",
    ".video-info-detail-list .item-desc",
    "[class*='video-desc']",
    "[class*='VideoDesc']",
    "#v_desc .desc-info",
    "#v_desc .desc-info-text",
    ".video-desc-container .basic-desc-info",
    ".video-desc-container .desc-info",
    ".video-desc .desc-info"
  ];
  const VIDEO_DESCRIPTION_CONTROL_TEXT_PATTERN =
    /^(?:展开更多|收起|展开|更多|show\s*more|show\s*less|more|less)$/iu;
  const VIDEO_DESCRIPTION_MAX_LENGTH = 4000;
  const VIDEO_TAGS_SELECTORS = [
    "#v_tag",
    ".video-tag-container",
    ".tag-panel",
    ".video-tags",
    ".tag-container",
    "[class*='video-tag']",
    "[class*='VideoTag']"
  ];
  /**
   * Note: Newer Bilibili watch pages nest the description and tag modules
   * inside the right-column list container, so named module roots are trusted
   * wherever they render; broad probes stay bounded by source-root exclusion.
   */
  const VIDEO_DESCRIPTION_ROOT_SELECTOR = [
    "#v_desc",
    ".video-desc-container",
    ".video-desc"
  ].join(",");
  const VIDEO_TAGS_ROOT_SELECTOR = ["#v_tag", ".video-tag-container"].join(",");
  const VIDEO_TAG_LINK_SELECTOR = [
    "a.tag-link[href]",
    "a[href*='from_source=video_tag']",
    "a[href*='search.bilibili.com/all?keyword=']"
  ].join(",");
  const VIDEO_TAG_MAX_COUNT = 32;
  const VIDEO_PUBLISH_DATE_SELECTORS = [
    "[class*='pubdate']",
    "[class*='Pubdate']",
    ".video-data",
    "[class*='video-data']",
    ".video-info-detail",
    ".video-info-detail-list .item"
  ];
  const VIDEO_PUBLISH_DATE_ROOT_SELECTOR =
    "[class*='pubdate'],[class*='Pubdate']";
  /**
   * Note: Recommendation cards expose month-day timestamps, so a full
   * year-month-day prefix identifies the current video's publish time.
   */
  const VIDEO_PUBLISH_DATE_TEXT_PATTERN =
    /\d{4}-\d{2}-\d{2}(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?/u;

  const VIDEO_LINK_SELECTOR = "a[href]";

  const VIDEO_TARGET_DATA_SELECTOR = [
    "[data-bvid]",
    "[data-bv-id]",
    "[data-bv]",
    "[data-aid]",
    "[data-avid]",
    "[data-url]",
    "[data-href]",
    "[data-link]",
    "[data-arcurl]",
    "[data-key]"
  ].join(",");

  const VIDEO_POD_ITEM_CLASS_SELECTOR = [
    ".video-pod__item",
    "[class*='video-pod__item']",
    ".video-pod-item",
    "[class*='video-pod-item']",
    ".pod-item",
    "[class*='pod-item']",
    ".simple-base-item",
    "[class*='simple-base-item']",
    ".normal-base-item",
    "[class*='normal-base-item']",
    ".page-item",
    "[class*='page-item']",
    ".singlep-list-item-inner",
    ".multip-list-item"
  ].join(",");

  const VIDEO_POD_ITEM_SELECTOR = [
    VIDEO_POD_ITEM_CLASS_SELECTOR,
    "li"
  ].join(",");

  const VIDEO_POD_ARCHIVE_ITEM_SELECTOR = [
    ".video-pod__item",
    "[class*='video-pod__item']",
    ".video-pod-item",
    "[class*='video-pod-item']",
    ".pod-item",
    "[class*='pod-item']"
  ].join(",");

  const VIDEO_PART_ITEM_SELECTOR = [
    ".page-item",
    "[class*='page-item']",
    ".singlep-list-item-inner",
    ".multip-list-item"
  ].join(",");

  const CURRENT_SOURCE_ITEM_ATTR_SELECTOR = [
    "[aria-current='page']",
    "[aria-current='true']",
    "[aria-selected='true']",
    "[data-current='true']",
    "[data-active='true']",
    "[data-selected='true']"
  ].join(",");

  const VIDEO_URL_DATA_ATTRS = [
    "data-url",
    "data-href",
    "data-link",
    "data-arcurl"
  ];
  const BVID_DATA_ATTRS = ["data-bvid", "data-bv-id", "data-bv", "data-key"];
  const AID_DATA_ATTRS = ["data-aid", "data-avid"];
  const PAGE_DATA_ATTRS = ["data-page", "data-p", "data-part"];
  const THUMBNAIL_IMAGE_URL_ATTRS = Object.freeze([
    "data-cover",
    "data-lazyload-src",
    "data-src",
    "data-original",
    "data-lazy-src",
    "src"
  ]);
  const THUMBNAIL_IMAGE_SRCSET_ATTRS = Object.freeze(["srcset"]);
  const THUMBNAIL_ATTRIBUTE_SELECTOR = [
    "img",
    ...THUMBNAIL_IMAGE_URL_ATTRS.map((attribute) => `[${attribute}]`),
    ...THUMBNAIL_IMAGE_SRCSET_ATTRS.map((attribute) => `[${attribute}]`)
  ].join(",");
  const THUMBNAIL_BACKGROUND_SELECTOR = [
    "[style*='background']",
    "[class*='Cover']",
    "[class*='Image']",
    "[class*='Pic']",
    "[class*='Poster']",
    "[class*='Thumb']",
    "[class*='cover']",
    "[class*='image']",
    "[class*='pic']",
    "[class*='poster']",
    "[class*='thumb']"
  ].join(",");
  const THUMBNAIL_PLACEHOLDER_NAME_PATTERN =
    /(?:^|[._-])(?:blank|default(?:[._-]?(?:cover|image|pic))?|empty|gray|grey|lazyload|loading|no[._-]?(?:cover|image|pic)|placeholder|spacer|transparent)(?:[._-]|$)/i;

  const LAZY_MUTATION_ATTRIBUTE_FILTER = Object.freeze([
    "class",
    "lang",
    BILIBILI_DARK_PAGE_ATTR,
    BILIBILI_LEGACY_DARK_COMMON_ATTR,
    "data-theme",
    "data-color-mode",
    "data-prefers-color-scheme",
    "data-dark",
    "data-locale",
    "data-language",
    "data-lang",
    "data-i18n-locale",
    "style",
    "href",
    "src",
    "srcset",
    "data-src",
    "data-original",
    "data-lazy-src",
    "data-lazyload-src",
    "data-cover",
    "data-url",
    "data-href",
    "data-link",
    "data-arcurl",
    "data-key",
    "data-bvid",
    "data-bv-id",
    "data-bv",
    "data-aid",
    "data-avid",
    "data-page",
    "data-p",
    "data-part",
    "title",
    "alt",
    "aria-label"
  ]);

  const TITLE_SELECTORS = [
    ".title-txt",
    ".title",
    ".info-title",
    ".video-title",
    ".bili-video-card__info--tit",
    ".bili-video-card__info--title",
    "[class*='title']",
    "[class*='Title']"
  ];

  const CARD_SELECTORS = [
    ".video-page-card-small",
    ".bili-video-card",
    ".video-card",
    ".card-box",
    ".video-episode-card",
    "[class*='video-card']",
    "[class*='VideoCard']",
    "[class*='card']",
    "[class*='item']",
    "li"
  ];

  const SOURCE_BOUNDARY_SELECTOR = [
    "#multi_page",
    "#reco_list",
    ".anthology-list",
    ".base-video-sections",
    ".player-auxiliary-playlist",
    ".player-auxiliary-playlist-list",
    ".playlist-container",
    ".video-queue",
    ".recommend-list",
    ".recommend-list-v1",
    ".recommend-video-card-list",
    VIDEO_POD_SELECTOR,
    ".video-sections",
    ".video-sections-content-list",
    ".watch-later-list",
    ".watchlater-list"
  ].join(",");

  const SOURCE_HEADING_SELECTOR = [
    "h1", "h2", "h3", "h4", "h5", "h6", "[role='heading']",
    ".title", ".head", ".header"
  ].join(",");

  const SOURCE_HEADING_ITEM_SELECTOR = [
    "a", ...CARD_SELECTORS, VIDEO_POD_ITEM_SELECTOR, VIDEO_TARGET_DATA_SELECTOR
  ].join(",");

  const SIDEBAR_BOUNDARY_SELECTOR = [
    ".right-container",
    "#right-container",
    "aside",
    "[class*='right-container']",
    "[class*='sidebar']"
  ].join(",");

  const PAGE_LAZY_PRIME_TARGET_SELECTORS = Object.freeze([
    ...COMMENT_PRIME_SELECTORS,
    SOURCE_BOUNDARY_SELECTOR,
    SIDEBAR_BOUNDARY_SELECTOR
  ]);

  const METADATA_SELECTORS = {
    author: [
      ".up-name",
      ".author",
      ".name",
      "[class*='author']",
      "[class*='up-name']"
    ],
    viewCount: [
      ".play",
      ".view",
      ".views",
      "[class*='view']",
      "[class*='play']"
    ],
    duration: [
      ".duration",
      ".length",
      ".time",
      "[class*='duration']",
      "[class*='length']",
      "[class*='time']"
    ]
  };

  const WATCH_ACTION_CONTEXT_SELECTOR = [
    "#arc_toolbar_report",
    ".video-toolbar",
    ".video-toolbar-left",
    ".video-toolbar-left-main",
    ".toolbar-left",
    ".ops",
    "[class*='video-toolbar']",
    "[class*='toolbar-left']"
  ].join(",");

  const WATCH_ACTION_TRIGGER_SELECTOR = [
    "button",
    "a[href]",
    "[role='button']",
    ".video-toolbar-left-item",
    ".video-toolbar-left-item-wrap",
    ".video-toolbar-item",
    ".video-like",
    ".video-coin",
    ".video-fav",
    ".video-favorite",
    ".video-share",
    ".video-watch-later",
    ".video-watchlater",
    ".watch-later",
    ".watchlater"
  ].join(",");

  const WATCH_ACTION_ACTIVE_SELECTOR = [
    "[aria-pressed='true']",
    "[aria-selected='true']",
    "[data-selected='true']",
    "[data-active='true']",
    ".on",
    ".active",
    ".is-active",
    ".selected"
  ].join(",");

  const WATCH_ACTION_COUNT_TEXT_LIMIT = 18;
  const WATCH_LATER_DELETE_LOCAL_ICON_KEY =
    "bibilili-local-watch-later-delete-icon";
  const UPLOADER_PROFILE_LINK_SELECTOR = "a[href*='space.bilibili.com']";
  const UPLOADER_PROFILE_HOME_PATH_PATTERN = /^\/\d+\/?$/u;
  const UPLOADER_META_TEXT_LIMIT = 64;
  /**
   * Global header surfaces that never contain current-video uploader data.
   *
   * Note: Logged-in Bilibili headers link the viewer's own space pages
   * (avatar, favorites, history), so header nodes cannot become uploader
   * candidates. Roots mirror the account-control header probes.
   */
  const HEADER_SURFACE_SELECTOR = [
    "#i_cecream",
    "#biliMainHeader",
    ".bili-header",
    ".international-header",
    ".mini-header"
  ].join(",");
  /**
   * Static uploader discovery configuration.
   *
   * Note: Bilibili has moved the current-video uploader panel between several
   * watch-page generations and now nests it inside the right-column list
   * container. Named panel roots are trusted wherever they render; broad
   * class-name probes stay bounded by source-root exclusion so
   * recommendation-card authors do not become page metadata.
   */
  const UPLOADER_CONTEXT_ROOT_SELECTORS = [
    "#v_upinfo",
    ".up-panel-container",
    ".up-info-container",
    ".up-info",
    ".up-info--left",
    ".video-owner",
    ".owner-card",
    ".uploader"
  ];
  const UPLOADER_CONTEXT_FALLBACK_SELECTORS = [
    "[class*='up-panel']",
    "[class*='up_info']",
    "[class*='up-info']",
    "[class*='UpInfo']",
    "[class*='upInfo']"
  ];
  const UPLOADER_CONTEXT_ROOT_SELECTOR =
    UPLOADER_CONTEXT_ROOT_SELECTORS.join(",");
  const UPLOADER_CONTEXT_FALLBACK_SELECTOR =
    UPLOADER_CONTEXT_FALLBACK_SELECTORS.join(",");
  const UPLOADER_CONTEXT_SELECTOR = [
    UPLOADER_CONTEXT_ROOT_SELECTOR,
    UPLOADER_CONTEXT_FALLBACK_SELECTOR
  ].join(",");
  const UPLOADER_NAME_SELECTORS = [
    ".up-name",
    ".up-name__text",
    ".up-info__name",
    ".username",
    ".user-name",
    ".name",
    "[class*='up-name']",
    "[class*='upName']",
    "[class*='UpName']",
    "[class*='user-name']",
    "[class*='UserName']",
    UPLOADER_PROFILE_LINK_SELECTOR
  ];
  const UPLOADER_META_SELECTORS = [
    ".up-description",
    ".up-info__desc",
    ".up-info__subtitle",
    ".up-info__fans",
    ".desc",
    ".subtitle",
    ".fans",
    "[class*='desc']",
    "[class*='Desc']",
    "[class*='subtitle']",
    "[class*='Subtitle']",
    "[class*='fans']",
    "[class*='Fans']"
  ];
  const UPLOADER_AVATAR_SELECTORS = [
    ".up-avatar img",
    ".up-face img",
    ".avatar img",
    ".bili-avatar-img",
    "img[class*='avatar']",
    "picture img",
    "img"
  ];
  const WATCH_ACTION_CLONE_REMOVED_ATTRIBUTES = new Set([
    "id",
    "tabindex",
    "role",
    "href",
    "target",
    "rel",
    "download",
    "type",
    "name",
    "value",
    "form",
    "formaction",
    "formenctype",
    "formmethod",
    "formnovalidate",
    "formtarget",
    "for"
  ]);
  const WATCH_ACTION_CLONE_INTERACTIVE_TAGS = new Set([
    "a",
    "button",
    "input",
    "label",
    "option",
    "select",
    "textarea"
  ]);

  /**
   * Static account-control and comment-composer discovery configuration.
   *
   * Note: Bilibili has multiple header and comment generations. These probes
   * stay scoped to native header roots and comment composer roots so ordinary
   * commenter avatars remain under page ownership.
   */
  const ACCOUNT_CONTROL_SELECTORS = [
    "#i_cecream .right-entry .header-avatar-wrap",
    "#i_cecream [class*='BiliHeader'] .header-avatar-wrap",
    ".bili-header .right-entry .header-avatar-wrap",
    ".international-header .header-avatar-wrap",
    ".mini-header .header-avatar-wrap",
    ".right-entry .header-avatar-wrap"
  ];
  const ACCOUNT_POPOVER_SELECTOR = [
    ".v-popover",
    ".avatar-panel-popover",
    "[class*='avatar-panel']",
    "[class*='AvatarPanel']"
  ].join(",");
  const COMMENT_COMPOSER_SELECTOR = [
    ".reply-box-wrap",
    ".reply-box",
    ".comment-send",
    ".comment-send-container",
    ".bili-comment-send",
    ".bili-comment-box",
    "[class*='reply-box']",
    "[class*='ReplyBox']",
    "[class*='comment-send']",
    "[class*='CommentSend']",
    "[class*='comment-box']",
    "[class*='CommentBox']"
  ].join(",");
  const COMMENT_COMPOSER_NON_AVATAR_SELECTOR = [
    "textarea",
    "[contenteditable='true']",
    "button",
    "[role='button']"
  ].join(",");
  const COMMENT_PROFILE_LINK_SELECTOR = "a[href*='space.bilibili.com']";
  const COMMENT_ROW_SELECTOR = [
    ".reply-item",
    ".comment-item",
    ".bili-comment-card",
    "[class*='reply-item']",
    "[class*='ReplyItem']",
    "[class*='comment-item']",
    "[class*='CommentItem']",
    "[class*='comment-card']",
    "[class*='CommentCard']"
  ].join(",");
  const FAVORITE_DIALOG_CONTENT_SELECTOR = [
    ".collection-m-exp",
    ".collection-m",
    "[class*='collection-m']",
    "[class*='Collection']"
  ].join(",");
  const COIN_DIALOG_CONTENT_SELECTOR = [
    ".coin-operated-m-exp",
    ".coin-operated-m",
    ".coin-dialog-mask",
    "[class*='coin-operated']"
  ].join(",");
  const WATCH_ACTION_DIALOG_ROOT_SELECTOR = [
    ".bili-dialog-m",
    ".coin-dialog-mask"
  ].join(",");
  const COMMENT_IMAGE_PREVIEW_SELECTOR = [
    ".pswp",
    ".pswp__scroll-wrap",
    ".pswp__container",
    ".pswp__item",
    "img.pswp__img",
    ".bili-comment-image-preview",
    ".bili-comment-img-preview",
    ".bili-comment-picture-preview",
    ".reply-image-preview",
    ".reply-img-preview",
    ".reply-picture-preview",
    "[class*='comment'][class*='image'][class*='preview']",
    "[class*='comment'][class*='Image'][class*='Preview']",
    "[class*='reply'][class*='image'][class*='preview']",
    "[class*='reply'][class*='Image'][class*='Preview']",
    "[class*='preview'][class*='image']",
    "[class*='Preview'][class*='Image']",
    "[class*='picture'][class*='preview']",
    "[class*='Picture'][class*='Preview']",
    "[class*='album'][class*='preview']",
    "[class*='Album'][class*='Preview']",
    "[class*='image'][class*='viewer']",
    "[class*='Image'][class*='Viewer']",
    ".bili-dialog-m",
    ".bili-dialog-bomb",
    "[class*='modal']",
    "[class*='Modal']"
  ].join(",");
  const COMMENT_IMAGE_PREVIEW_URL_PATTERN = /\/bfs\/(?:new_dyn|reply)\//u;
  const NATIVE_OVERLAY_SETTLE_DELAYS_MS = Object.freeze([80, 240, 600]);
  const COMMENT_ACCOUNT_AVATAR_FALLBACK_WIDTH = 92;
  const COMMENT_ACCOUNT_AVATAR_FALLBACK_HEIGHT = 128;

  /**
   * Closed source kinds used by discovery, state, rendering, and DOM markers.
   */
  const SourceKind = Object.freeze({
    PARTS: "parts",
    COLLECTION: "collection",
    RECOMMENDATIONS: "recommendations",
    FAVORITES: "favorites",
    WATCH_LATER: "watch_later",
    HISTORY: "history"
  });

  /**
   * Closed card actions that mutate the account watch-later list.
   */
  const WatchLaterCardAction = Object.freeze({
    ADD: "add",
    DELETE: "delete"
  });

  /**
   * Closed watch action kinds rendered by the bottom dock.
   */
  const WatchActionKind = Object.freeze({
    LIKE: "like",
    COIN: "coin",
    FAVORITE: "favorite",
    SHARE: "share",
    WATCH_LATER: "watch_later"
  });

  const SOURCE_LABEL_MESSAGE_NAMES = Object.freeze({
    [SourceKind.PARTS]: "sourcePartsLabel",
    [SourceKind.COLLECTION]: "sourceCollectionLabel",
    [SourceKind.RECOMMENDATIONS]: "sourceRecommendationsLabel",
    [SourceKind.FAVORITES]: "sourceFavoritesLabel",
    [SourceKind.WATCH_LATER]: "sourceWatchLaterLabel",
    [SourceKind.HISTORY]: "sourceHistoryLabel"
  });

  const WATCH_ACTION_LABEL_MESSAGE_NAMES = Object.freeze({
    [WatchActionKind.LIKE]: UiMessage.WATCH_ACTION_LIKE_LABEL,
    [WatchActionKind.COIN]: UiMessage.WATCH_ACTION_COIN_LABEL,
    [WatchActionKind.FAVORITE]: UiMessage.WATCH_ACTION_FAVORITE_LABEL,
    [WatchActionKind.SHARE]: UiMessage.WATCH_ACTION_SHARE_LABEL,
    [WatchActionKind.WATCH_LATER]: UiMessage.WATCH_LATER_ADD_LABEL
  });

  UiStrings.configure({
    sourceLabelMessageNames: SOURCE_LABEL_MESSAGE_NAMES,
    watchActionLabelMessageNames: WATCH_ACTION_LABEL_MESSAGE_NAMES,
    shareActionKind: WatchActionKind.SHARE
  });

  /**
   * Closed comment pane states used by discovery and layout reconciliation.
   */
  const CommentPaneState = Object.freeze({
    LOADED: "loaded",
    RETRY: "retry"
  });

  const SOURCE_ORDER = Object.freeze([
    SourceKind.PARTS,
    SourceKind.COLLECTION,
    SourceKind.RECOMMENDATIONS,
    SourceKind.FAVORITES,
    SourceKind.WATCH_LATER,
    SourceKind.HISTORY
  ]);

  const ACCOUNT_SOURCE_ORDER = Object.freeze([
    SourceKind.FAVORITES,
    SourceKind.WATCH_LATER,
    SourceKind.HISTORY
  ]);

  /**
   * Closed loading states for account-source pagination controls.
   */
  const AccountSourceStatus = Object.freeze({
    READY: "ready",
    LOADING: "loading",
    ERROR: "error",
    SIGNED_OUT: "signed_out"
  });

  const WATCH_ACTION_ORDER = Object.freeze([
    WatchActionKind.LIKE,
    WatchActionKind.COIN,
    WatchActionKind.FAVORITE,
    WatchActionKind.SHARE,
    WatchActionKind.WATCH_LATER
  ]);

  /** Closed list-tool actions sharing placement preferences with watch actions. */
  const RailActionKind = Object.freeze({
    LOCATE: "locate", START: "start", REFRESH: "refresh", SEARCH: "search"
  });
  const RAIL_ACTION_MESSAGES = Object.freeze({
    [RailActionKind.LOCATE]: UiMessage.RAIL_LOCATE_LABEL,
    [RailActionKind.START]: UiMessage.RAIL_START_LABEL,
    [RailActionKind.REFRESH]: UiMessage.RAIL_REFRESH_LABEL,
    [RailActionKind.SEARCH]: UiMessage.RAIL_SEARCH_LABEL
  });
  const RAIL_ACTION_ORDER = Object.freeze(Object.values(RailActionKind));

  configureStorageState({
    sourceOrder: SOURCE_ORDER,
    favoritesKind: SourceKind.FAVORITES,
    actionDefaults: Object.fromEntries([...WATCH_ACTION_ORDER, ...RAIL_ACTION_ORDER]
      .map((kind) => [kind, true])),
    commentPaneMinWidth: COMMENT_PANE_MIN_WIDTH,
    commentPaneMaxWidth: COMMENT_PANE_MAX_WIDTH
  });

  const WATCH_ACTION_STATEFUL_KINDS = new Set([
    WatchActionKind.LIKE,
    WatchActionKind.COIN,
    WatchActionKind.FAVORITE
  ]);

  /**
   * Static source adapter configuration.
   *
   * Note: Bilibili uses several markup families across old, new, and lazy
   * watch page surfaces. The selectors prefer stable container names first and
   * keep broad class-name probes as fallbacks.
   */
  const SOURCE_DEFINITIONS = Object.freeze([
    {
      kind: SourceKind.PARTS,
      selectors: [
        "#multi_page",
        // Note: Bilibili nests the current archive's part rows in video-pod.
        VIDEO_POD_SELECTOR
      ],
      pattern: /(?:\u5206P|\u5206\u96c6|\u9009\u96c6|parts?)/i
    },
    {
      kind: SourceKind.COLLECTION,
      selectors: [
        // Note: Bilibili renders collection archives and their parts together.
        VIDEO_POD_SELECTOR,
        ".player-auxiliary-playlist",
        ".player-auxiliary-playlist-list",
        ".player-auxiliary-playlist .playlist-container",
        ".video-queue",
        ".base-video-sections",
        ".video-sections",
        ".video-sections-content-list",
        ".anthology-list",
        "[class*='video-section']",
        "[class*='anthology']"
      ],
      pattern:
        /(?:\u5408\u96c6|\u89c6\u9891\u9009\u96c6|\u961f\u5217|collection|section|anthology|queue|playlist)/i
    },
    {
      kind: SourceKind.WATCH_LATER,
      selectors: [
        ".watch-later-list",
        ".watchlater-list",
        "[class*='watch-later']",
        "[class*='watchlater']",
        "[class*='watch_later']"
      ],
      pattern: /(?:\u7a0d\u540e\u518d\u770b|watch\s*later)/i
    },
    {
      kind: SourceKind.RECOMMENDATIONS,
      selectors: [
        "#reco_list",
        ".recommend-list-v1",
        ".recommend-list",
        ".recommend-video-card-list",
        "[data-loc-id*='related']",
        "[class*='recommend']"
      ],
      pattern:
        /(?:\u63a8\u8350|\u76f8\u5173\u89c6\u9891|related|recommend)/i
    }
  ]);

  /**
   * Static watch-action discovery configuration.
   *
   * Note: Bilibili has used several toolbar generations. The selectors prefer
   * named action classes and use title or accessible-name fallbacks only after
   * checking that the candidate belongs to a watch toolbar context.
   */
  const WATCH_ACTION_DEFINITIONS = Object.freeze([
    {
      kind: WatchActionKind.LIKE,
      selectors: [
        "#arc_toolbar_report .video-like",
        ".video-toolbar .video-like",
        ".video-toolbar-left .video-like",
        ".video-toolbar-left-main .video-like",
        ".ops .like",
        ".video-like",
        "[class*='video-like']",
        "[title*='点赞']",
        "[aria-label*='点赞']",
        "[title*='Like']",
        "[aria-label*='Like']",
        "[title*='like']",
        "[aria-label*='like']"
      ],
      countSelectors: [
        ".video-like-info",
        "[class*='like-info']",
        ".video-toolbar-item-text",
        ".video-toolbar-left-item-text",
        ".toolbar-left-item-text",
        "[class*='count']",
        "span"
      ],
      labelPattern: /(?:点赞|已点赞|取消点赞|like|liked)/iu,
      activePattern: /(?:\bon\b|\bactive\b|\bis-active\b|\bselected\b|\bliked\b|已点赞)/iu
    },
    {
      kind: WatchActionKind.COIN,
      selectors: [
        "#arc_toolbar_report .video-coin",
        ".video-toolbar .video-coin",
        ".video-toolbar-left .video-coin",
        ".video-toolbar-left-main .video-coin",
        ".ops .coin",
        ".video-coin",
        "[class*='video-coin']",
        "[title*='投币']",
        "[aria-label*='投币']",
        "[title*='Coin']",
        "[aria-label*='Coin']",
        "[title*='coin']",
        "[aria-label*='coin']"
      ],
      countSelectors: [
        ".video-coin-info",
        "[class*='coin-info']",
        ".video-toolbar-item-text",
        ".video-toolbar-left-item-text",
        ".toolbar-left-item-text",
        "[class*='count']",
        "span"
      ],
      labelPattern: /(?:投币|已投币|coin|coins?)/iu,
      activePattern: /(?:\bon\b|\bactive\b|\bis-active\b|\bselected\b|已投币)/iu
    },
    {
      kind: WatchActionKind.FAVORITE,
      selectors: [
        "#arc_toolbar_report .video-fav",
        "#arc_toolbar_report .video-favorite",
        ".video-toolbar .video-fav",
        ".video-toolbar .video-favorite",
        ".video-toolbar-left .video-fav",
        ".video-toolbar-left .video-favorite",
        ".video-toolbar-left-main .video-fav",
        ".video-toolbar-left-main .video-favorite",
        ".ops .collect",
        ".video-fav",
        ".video-favorite",
        "[class*='video-fav']",
        "[class*='video-favorite']",
        "[title*='收藏']",
        "[aria-label*='收藏']",
        "[title*='Favorite']",
        "[aria-label*='Favorite']",
        "[title*='Favourite']",
        "[aria-label*='Favourite']",
        "[title*='favorite']",
        "[aria-label*='favorite']"
      ],
      countSelectors: [
        ".video-fav-info",
        ".video-favorite-info",
        "[class*='fav-info']",
        "[class*='favorite-info']",
        ".video-toolbar-item-text",
        ".video-toolbar-left-item-text",
        ".toolbar-left-item-text",
        "[class*='count']",
        "span"
      ],
      labelPattern: /(?:收藏|已收藏|取消收藏|favorite|favourite|favou?rites?|collect(?:ed)?)/iu,
      activePattern: /(?:\bon\b|\bactive\b|\bis-active\b|\bselected\b|\bfavou?rited\b|\bcollected\b|已收藏)/iu
    },
    {
      kind: WatchActionKind.SHARE,
      selectors: [
        "#arc_toolbar_report .video-share",
        ".video-toolbar .video-share",
        ".video-toolbar-left .video-share",
        ".video-toolbar-left-main .video-share",
        ".ops .share",
        ".video-share",
        "[class*='video-share']",
        "[title*='分享']",
        "[aria-label*='分享']",
        "[title*='Share']",
        "[aria-label*='Share']",
        "[title*='share']",
        "[aria-label*='share']"
      ],
      countSelectors: [
        ".video-share-info",
        "[class*='share-info']",
        ".video-toolbar-item-text",
        ".video-toolbar-left-item-text",
        ".toolbar-left-item-text",
        "[class*='count']",
        "span"
      ],
      labelPattern: /(?:分享|share|shared)/iu,
      activePattern: /$^/u
    },
    {
      kind: WatchActionKind.WATCH_LATER,
      selectors: [
        "#arc_toolbar_report .video-watch-later",
        "#arc_toolbar_report .video-watchlater",
        ".video-toolbar .video-watch-later",
        ".video-toolbar .video-watchlater",
        ".video-toolbar-left .video-watch-later",
        ".video-toolbar-left .video-watchlater",
        ".video-toolbar-left-main .video-watch-later",
        ".video-toolbar-left-main .video-watchlater",
        ".ops .watch-later",
        ".ops .watchlater",
        ".video-watch-later",
        ".video-watchlater",
        "[class*='video-watch-later']",
        "[class*='video-watchlater']",
        "[title*='稍后']",
        "[aria-label*='稍后']",
        "[title*='稍後']",
        "[aria-label*='稍後']",
        "[title*='Watch later']",
        "[aria-label*='Watch later']",
        "[title*='watch later']",
        "[aria-label*='watch later']"
      ],
      countSelectors: [
        ".video-watch-later-info",
        ".video-watchlater-info",
        "[class*='watch-later-info']",
        "[class*='watchlater-info']",
        ".video-toolbar-item-text",
        ".video-toolbar-left-item-text",
        ".toolbar-left-item-text",
        "[class*='count']",
        "span"
      ],
      labelPattern: /(?:稍后再看|稍後再看|watch\s*later)/iu,
      activePattern: /(?:\bon\b|\bactive\b|\bis-active\b|\bselected\b|已添加|已加入)/iu
    }
  ]);

  /**
   * Shared loading presentation for startup, comments, and counted actions.
   * Callers supply text slots and placement; one indicator owns bar markup.
   */
  class LoadingView {
    /**
     * Creates a loading view with optional content before its decorative bar.
     * Status announcements and busy state belong to the containing surface.
     *
     * @param {Document} document
     * @param {{ className?: string, content?: Node[], inline?: boolean }} options
     * @returns {HTMLElement}
     */
    static create(document, { className = "", content = [], inline = false } = {}) {
      const view = document.createElement(inline ? "span" : "div");
      view.className = `bibilili-loading-view ${className}`.trim();
      const indicator = document.createElement("span");
      indicator.className = "bibilili-loading-indicator";
      indicator.setAttribute("aria-hidden", "true");
      view.append(...content, indicator);
      return view;
    }

    /**
     * Shares fade timing between CSS surfaces and startup-cover removal.
     *
     * @param {HTMLElement} surface
     */
    static prepareSurface(surface) {
      surface.style.setProperty("--bibilili-loading-fade-duration", `${LOADING_FADE_MS}ms`);
    }
  }

  /**
   * Covers the viewport until the transformed layout is ready to paint.
   *
   * Note: The cover mounts under the document root because Bilibili can paint
   * before DOMContentLoaded and replace or scroll its body during hydration.
   * Native geometry stays available beneath it. Metadata reads are coalesced
   * per frame and stop with the cover; loading never issues metadata requests.
   */
  class LoadingCover {
    /**
     * @param {Document} document
     * @param {RegionDiscovery} discovery
     */
    constructor(document, discovery) {
      this.document = document;
      this.discovery = discovery;
      this.root = null;
      this.title = null;
      this.uploader = null;
      this.timer = null;
      this.fadeTimer = null;
      this.updateFrame = null;
      this.revealFrame = null;
      this.observer = null;
      this.pageKey = null;
      this.lastTitle = null;
      this.previousTitle = null;
      this.geometry = null;
    }

    /**
     * Covers one page handoff without extending an active page's deadline.
     *
     * @param {string} pageKey
     */
    start(pageKey) {
      if (this.timer !== null && this.pageKey === pageKey) {
        return;
      }

      // Note: Same-document navigation can leave the previous video's title
      // in native markup until hydration catches up with the URL.
      this.previousTitle = this.pageKey && this.pageKey !== pageKey
        ? this.lastTitle : null;
      this.stop();
      this.pageKey = pageKey;
      const origin = CardNavigationOriginStore.read();
      this.geometry = origin?.targetRouteKey === pageKey ? origin.geometry : null;
      this.timer = window.setTimeout(() => this.stop(), LOADING_COVER_TIMEOUT_MS);
      this.observer = new MutationObserver((mutations) => {
        if (mutations.some((mutation) => !DomProbe.isOwned(mutation.target))) {
          this.scheduleUpdate();
        }
      });
      this.observer.observe(this.document, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ["content", "title", "lang"]
      });
      this.update();
    }

    /**
     * Creates the cover as soon as the document root exists.
     *
     * @returns {boolean}
     */
    ensure() {
      const documentRoot = this.document.documentElement;
      if (!documentRoot) {
        return false;
      }

      if (!this.root) {
        this.root = this.document.createElement("div");
        this.root.id = LOADING_COVER_ID;
        this.root.setAttribute("role", "status");
        this.root.setAttribute("aria-live", "polite");
        this.root.setAttribute("aria-atomic", "true");
        LoadingView.prepareSurface(this.root);
        const brand = this.document.createElement("div");
        brand.className = "bibilili-loading-brand";
        brand.textContent = "bibilili";
        brand.setAttribute("aria-hidden", "true");
        this.title = this.document.createElement("div");
        this.title.className = "bibilili-loading-title";
        this.uploader = this.document.createElement("div");
        this.uploader.className = "bibilili-loading-uploader";
        const content = LoadingView.create(this.document, {
          className: "bibilili-loading-content",
          content: [brand, this.title, this.uploader]
        });
        if (this.geometry) {
          this.mountShell(content);
        } else {
          this.root.append(content);
        }
      }

      if (this.root.parentElement !== documentRoot) {
        documentRoot.append(this.root);
      }
      return true;
    }

    /**
     * Reserves the previous panes across a document navigation.
     *
     * Only dimensions cross the document boundary; native player and comment
     * trees are created by Bilibili in the destination document.
     *
     * @param {HTMLElement} content Loading status and destination metadata.
     */
    mountShell(content) {
      this.root.className = "bibilili-loading-shell";
      this.root.style.setProperty(
        "--bibilili-loading-comment-width", `${this.geometry.commentWidth}px`
      );
      this.root.style.setProperty(
        "--bibilili-loading-dock-height", `${this.geometry.dockHeight}px`
      );
      this.root.style.setProperty(
        "--bibilili-loading-divider-width", this.geometry.commentWidth > 0 ? "8px" : "0px"
      );
      const player = this.document.createElement("div");
      player.className = "bibilili-loading-player";
      const comments = this.document.createElement("div");
      comments.className = "bibilili-loading-comments";
      const dock = this.document.createElement("div");
      dock.className = "bibilili-loading-dock";
      dock.setAttribute("aria-hidden", "true");
      (this.geometry.commentWidth > 0 ? comments : player).append(content);
      this.root.append(player, comments, dock);
    }

    /** Coalesces native metadata mutations into one update per frame. */
    scheduleUpdate() {
      if (this.updateFrame !== null) {
        return;
      }
      this.updateFrame = window.requestAnimationFrame(() => {
        this.updateFrame = null;
        this.update();
      });
    }

    /** Updates the title and uploader from metadata already in the page. */
    update() {
      if (this.timer === null || this.fadeTimer !== null || !this.ensure()) {
        return;
      }

      const language = LanguageResolver.resolve(this.document);
      const loadingLabel = UiStrings.message(UiMessage.LAYOUT_LOADING_LABEL, language);
      const candidate = this.discovery.findWatchTitle();
      const title = candidate !== this.previousTitle ? candidate : null;
      const uploader = title ? this.discovery.findUploaderInfo()?.name ?? "" : "";
      if (title) {
        this.lastTitle = title;
      }
      this.root.lang = language;
      this.root.setAttribute("aria-label", loadingLabel);
      if (this.title.textContent !== (title || loadingLabel)) {
        this.title.textContent = title || loadingLabel;
      }
      if (this.uploader.textContent !== uploader) {
        this.uploader.textContent = uploader;
      }
    }

    /**
     * Fades after two animation frames if the rendered layout is still ready.
     *
     * @param {() => boolean} isReady Checks mounted nodes and native priming.
     */
    finish(isReady) {
      if (this.timer === null || this.revealFrame !== null || this.fadeTimer !== null) {
        return;
      }

      this.revealFrame = window.requestAnimationFrame(() => {
        this.revealFrame = window.requestAnimationFrame(() => {
          this.revealFrame = null;
          if (!isReady()) {
            return;
          }
          this.update();
          this.stopObserving();
          this.root.dataset.bibililiLoadingState = "leaving";
          this.root.setAttribute("aria-hidden", "true");
          this.fadeTimer = window.setTimeout(() => this.stop(), LOADING_FADE_MS);
        });
      });
    }

    /** Releases metadata observation and its pending frame. */
    stopObserving() {
      this.observer?.disconnect();
      this.observer = null;
      if (this.updateFrame !== null) {
        window.cancelAnimationFrame(this.updateFrame);
      }
      this.updateFrame = null;
    }

    /** Removes the cover immediately and cancels every pending callback. */
    stop() {
      window.clearTimeout(this.timer);
      window.clearTimeout(this.fadeTimer);
      this.timer = null;
      this.fadeTimer = null;
      if (this.revealFrame !== null) {
        window.cancelAnimationFrame(this.revealFrame);
      }
      this.revealFrame = null;
      this.stopObserving();
      this.root?.remove();
      this.root = null;
      this.title = null;
      this.uploader = null;
    }
  }

  /**
   * Covers stale comments and counted watch actions during a video switch.
   * Destination playback and comments must be ready before refreshed data paints.
   * Native media events also cover player recommendations and browser history.
   */
  class VideoLoadingState {
    /**
     * @param {Document} document
     * @param {LayoutRoot} layout
     * @param {NativeVideoNavigation} navigation Reads native comment readiness.
     * @param {() => void} onReady Reconciles metadata and actions before reveal.
     */
    constructor(document, layout, navigation, onReady) {
      this.document = document;
      this.layout = layout;
      this.navigation = navigation;
      this.onReady = onReady;
      this.active = false;
      this.targetRouteKey = null;
      this.readyRouteKey = null;
      this.readyMedia = null;
      this.timer = null;
      this.frame = null;
      this.handler = null;
    }

    /** Observes native media loading without changing playback behavior. */
    start() {
      if (this.handler) return;
      this.handler = (event) => this.handleMediaEvent(event);
      for (const name of PLAYER_LOAD_EVENTS) {
        // Note: Native media load events do not bubble through the moved player.
        this.document.addEventListener(name, this.handler, true);
      }
    }

    /**
     * Starts immediately on a card click, before Bilibili changes the URL or media.
     *
     * @param {string | null} [targetRouteKey]
     */
    begin(targetRouteKey = null) {
      if (!this.layout.root?.isConnected || !this.layout.commentPane) return;
      this.cancel();
      this.active = true;
      this.targetRouteKey = targetRouteKey;
      this.readyRouteKey = null;
      this.readyMedia = null;
      this.layout.setVideoLoading(true);
      this.scheduleCheck();
    }

    /**
     * Observes only the mounted player's new media, not ordinary buffering.
     *
     * @param {Event} event
     */
    handleMediaEvent(event) {
      const media = event.target;
      if (!media?.matches?.(PLAYER_MEDIA_SELECTOR) || !this.layout.playerNode?.contains(media)) return;
      if (event.type === "loadstart") {
        if (!this.active) this.begin();
        this.readyMedia = null;
        this.readyRouteKey = null;
        this.cancelReveal();
      } else {
        this.readyMedia = media;
        this.readyRouteKey = SourceAdapter.currentWatchRouteKey();
        this.revealWhenReady();
      }
    }

    /**
     * Covers URL changes arriving before or after the native media load event.
     *
     * @param {string} routeKey
     */
    followRoute(routeKey) {
      if (!this.active && this.readyRouteKey !== routeKey) this.begin(routeKey);
      if (this.readyMedia && (!this.targetRouteKey || this.targetRouteKey === routeKey)) {
        // Note: Bilibili can commit its URL after the media event. The page
        // bridge must still confirm that player and comments match this route.
        this.readyRouteKey = routeKey;
      }
      this.revealWhenReady();
    }

    /**
     * Applies the native handoff's confirmed route, including AV-to-BV redirects.
     *
     * @param {string} landedUrl
     */
    confirm(landedUrl) {
      if (!this.active) return;
      this.targetRouteKey = SourceAdapter.watchRouteKeyForUrl(landedUrl);
      const media = this.layout.playerNode?.querySelector(PLAYER_MEDIA_SELECTOR);
      if (media?.readyState >= 2) {
        this.readyMedia = media;
        this.readyRouteKey = this.targetRouteKey;
      }
      this.revealWhenReady();
    }

    /**
     * Checks native readiness while a switch is active, including shadow-DOM
     * updates that the document's mutation observer cannot see.
     */
    scheduleCheck() {
      if (!this.active || this.timer !== null) return;
      this.timer = window.setTimeout(() => {
        this.timer = null;
        this.revealWhenReady();
      }, VIDEO_LOADING_CHECK_INTERVAL_MS);
    }

    /**
     * Requires the destination thread as well as a video frame or playback error.
     * A missing comment tree may reveal the layout's existing retry control.
     *
     * @param {string} routeKey
     * @returns {boolean}
     */
    isReady(routeKey) {
      if (
        !this.active || !this.readyMedia?.isConnected ||
        (this.readyMedia.readyState < 2 && !this.readyMedia.error) ||
        this.readyRouteKey !== routeKey ||
        (this.targetRouteKey && this.targetRouteKey !== routeKey)
      ) return false;
      const comments = this.layout.commentNode;
      return !comments?.isConnected || this.navigation.commentsReady(comments);
    }

    /** Reconciles and paints the destination, then rechecks before revealing it. */
    revealWhenReady() {
      if (!this.active || this.frame !== null) return;
      const routeKey = SourceAdapter.currentWatchRouteKey();
      if (!this.isReady(routeKey)) {
        this.scheduleCheck();
        return;
      }
      window.clearTimeout(this.timer);
      this.timer = null;
      this.onReady();
      this.frame = window.requestAnimationFrame(() => {
        this.frame = window.requestAnimationFrame(() => {
          this.frame = null;
          if (SourceAdapter.currentWatchRouteKey() === routeKey && this.isReady(routeKey)) {
            this.cancel();
          } else {
            this.scheduleCheck();
          }
        });
      });
    }

    /** Cancels a queued reveal when another video begins loading. */
    cancelReveal() {
      if (this.frame !== null) window.cancelAnimationFrame(this.frame);
      this.frame = null;
    }

    /** Restores covered controls after completion or cancellation. */
    cancel() {
      window.clearTimeout(this.timer);
      this.timer = null;
      this.cancelReveal();
      this.active = false;
      this.targetRouteKey = null;
      this.layout.setVideoLoading(false);
    }

    /** Removes all media listeners and pending presentation work. */
    stop() {
      this.cancel();
      if (this.handler) {
        for (const name of PLAYER_LOAD_EVENTS) {
          this.document.removeEventListener(name, this.handler, true);
        }
      }
      this.handler = null;
    }
  }

  /**
   * Owns the global button that enables and disables the transformed layout.
   */
  class ActivationControl {
    /**
     * Creates the activation control.
     *
     * @param {Document} document
     * @param {(enabled: boolean) => void} onToggle
     */
    constructor(document, onToggle) {
      this.document = document;
      this.onToggle = onToggle;
      this.button = null;
      this.floatingRoot = null;
      this.language = DEFAULT_UI_LANGUAGE;
    }

    /**
     * Places the activation button as a floating page control.
     *
     * @param {string} language
     */
    mountFloating(language) {
      this.setLanguage(language);
      this.ensureFloatingRoot();
      this.setEnabled(false);
      const button = this.ensureButton();

      if (button.parentElement !== this.floatingRoot) {
        this.floatingRoot.replaceChildren(button);
      }
    }

    /**
     * Places the activation button as the leftmost bottom dock control.
     *
     * @param {Element} container
     * @param {boolean} enabled
     * @param {string} language
     * @returns {HTMLButtonElement}
     */
    mountDocked(container, enabled, language) {
      this.setLanguage(language);
      const button = this.ensureButton();
      this.setEnabled(enabled);

      if (button.parentElement !== container || container.firstElementChild !== button) {
        container.insertBefore(button, container.firstChild);
      }

      if (this.floatingRoot?.isConnected) {
        this.floatingRoot.remove();
      }

      return button;
    }

    /**
     * Updates the language used by activation-control labels.
     *
     * @param {string} language
     */
    setLanguage(language) {
      this.language = UiStrings.normalizeLanguage(language);
    }

    /**
     * Removes all activation-control DOM.
     */
    destroy() {
      this.button?.remove();
      this.floatingRoot?.remove();
      this.button = null;
      this.floatingRoot = null;
    }

    /**
     * Ensures the floating host exists.
     */
    ensureFloatingRoot() {
      if (!this.floatingRoot?.isConnected) {
        const existing = this.document.getElementById(FLOATING_TOGGLE_ROOT_ID);
        if (existing) {
          existing.remove();
        }

        this.floatingRoot = this.document.createElement("div");
        this.floatingRoot.id = FLOATING_TOGGLE_ROOT_ID;
        this.document.body.append(this.floatingRoot);
      }
    }

    /**
     * Ensures the activation button exists.
     *
     * @returns {HTMLButtonElement}
     */
    ensureButton() {
      if (this.button) {
        return this.button;
      }

      this.button = UiControl.button(
        this.document,
        "bibilili-toggle-button",
        () => {
          const nextEnabled =
            this.button.getAttribute("aria-pressed") !== "true";
          this.onToggle(nextEnabled);
        }
      );
      this.button.append(ActivationControl.logoMark(this.document));

      return this.button;
    }

    /**
     * Creates the extension logo image used by the activation button.
     *
     * @param {Document} document
     * @returns {HTMLImageElement}
     */
    static logoMark(document) {
      const logo = document.createElement("img");
      logo.className = "bibilili-logo";
      logo.src = ActivationControl.logoAssetUrl();
      logo.decoding = "async";
      logo.draggable = false;
      logo.alt = "";
      logo.setAttribute("aria-hidden", "true");
      return logo;
    }

    /**
     * Returns the browser URL for the packaged logo asset.
     *
     * @returns {string}
     */
    static logoAssetUrl() {
      const runtime = UiStrings.extensionRuntime();

      if (runtime?.getURL) {
        return runtime.getURL(LOGO_ASSET_PATH);
      }

      return LOGO_ASSET_PATH;
    }

    /**
     * Updates button state, accessible name, and pressed state.
     *
     * @param {boolean} enabled
     */
    setEnabled(enabled) {
      const button = this.ensureButton();
      const label = UiStrings.message(
        enabled ? UiMessage.TURN_OFF_LABEL : UiMessage.TURN_ON_LABEL,
        this.language
      );

      UiControl.setLabel(button, label);
      button.setAttribute("aria-pressed", String(enabled));
    }
  }

  /**
   * Opens native page positions so Bilibili can hydrate lazy page regions.
   */
  class PageLazyPrimer {
    /**
     * Creates a primer for one document.
     *
     * @param {Document} document
     */
    constructor(document) {
      this.document = document;
      this.primedPageKeys = new Set();
      this.timer = null;
      this.restoreScrollPosition = null;
      this.restoreMountedClass = false;
    }

    /**
     * Requests one native scroll pass for comments, sidebar lists, and previews.
     *
     * Note: Bilibili can gate comments, list metadata, and thumbnail attributes
     * behind native document scroll or page-owned IntersectionObservers.
     * Forced retries ignore the per-page guard and release the transformed
     * scroll lock while the native document is being primed.
     *
     * @param {string} pageKey
     * @param {() => void} afterPrime
     * @param {{ force?: boolean }} [options]
     * @returns {boolean} true when a prime pass was scheduled
     */
    prime(pageKey, afterPrime, options = {}) {
      const force = Boolean(options.force);

      if (!force && this.primedPageKeys.has(pageKey)) {
        return false;
      }

      const hadMountedClass =
        force &&
        this.document.documentElement.classList.contains(HTML_MOUNTED_CLASS);

      if (hadMountedClass) {
        this.document.documentElement.classList.remove(HTML_MOUNTED_CLASS);
      }

      if (this.timer) {
        this.stop();
      }

      const restoreMountedClass =
        force &&
        (hadMountedClass ||
          this.document.documentElement.classList.contains(HTML_MOUNTED_CLASS));

      if (restoreMountedClass) {
        this.document.documentElement.classList.remove(HTML_MOUNTED_CLASS);
      }

      const startX = window.scrollX;
      const startY = window.scrollY;
      const target = this.targetElement();
      const maxY = Math.max(
        0,
        this.document.documentElement.scrollHeight - window.innerHeight
      );

      if (!this.scrollToPrimeTarget(target, startX, startY, maxY, force)) {
        if (restoreMountedClass) {
          this.document.documentElement.classList.add(HTML_MOUNTED_CLASS);
        }

        return false;
      }

      this.signalNativeLazyObservers();
      window.requestAnimationFrame(() => {
        this.signalNativeLazyObservers();
      });
      this.primedPageKeys.add(pageKey);
      this.restoreScrollPosition = { left: startX, top: startY };
      this.restoreMountedClass = restoreMountedClass;
      window.clearTimeout(this.timer);
      this.timer = window.setTimeout(() => {
        this.timer = null;
        this.restoreNativeScroll();
        this.restoreMountLock();
        afterPrime();
      }, PAGE_LAZY_PRIME_DELAY_MS);

      return true;
    }

    /**
     * Clears pending native scroll restoration.
     *
     * @param {boolean} [restoreScroll]
     */
    stop(restoreScroll = true) {
      if (this.timer) {
        window.clearTimeout(this.timer);
        this.timer = null;
      }

      if (restoreScroll) {
        this.restoreNativeScroll();
        this.restoreMountLock();
      } else {
        this.restoreScrollPosition = null;
        this.restoreMountedClass = false;
      }
    }

    /**
     * Moves the native document near a lazy target or a lower page position.
     *
     * @param {Element | null} target
     * @param {number} startX
     * @param {number} startY
     * @param {number} maxY
     * @param {boolean} force
     * @returns {boolean}
     */
    scrollToPrimeTarget(target, startX, startY, maxY, force) {
      if (force && target) {
        target.scrollIntoView({ block: "center", inline: "nearest" });
        return true;
      }

      if (target && PageLazyPrimer.isBelowViewportCenter(target, startY)) {
        target.scrollIntoView({ block: "center", inline: "nearest" });
        return true;
      }

      if (this.scrollToLowerPagePosition(startX, maxY)) {
        return true;
      }

      return force;
    }

    /**
     * Dispatches native viewport signals used by Bilibili lazy observers.
     */
    signalNativeLazyObservers() {
      window.dispatchEvent(new Event("scroll"));
      this.document.dispatchEvent(new Event("scroll", { bubbles: true }));
      window.dispatchEvent(new Event("resize"));
    }

    /**
     * Moves the native document toward lower lazy regions when no target is low.
     *
     * @param {number} startX
     * @param {number} maxY
     * @returns {boolean}
     */
    scrollToLowerPagePosition(startX, maxY) {
      if (maxY <= 0) {
        return false;
      }

      window.scrollTo({
        left: startX,
        top: Math.min(maxY, Math.max(window.innerHeight, maxY * 0.6))
      });

      return true;
    }

    /**
     * Returns true when a target is far enough down to prime directly.
     *
     * @param {Element} target
     * @param {number} startY
     * @returns {boolean}
     */
    static isBelowViewportCenter(target, startY) {
      const targetTop = target.getBoundingClientRect().top + startY;

      return targetTop > startY + window.innerHeight * 0.5;
    }

    /**
     * Restores the native document scroll position captured before priming.
     */
    restoreNativeScroll() {
      if (!this.restoreScrollPosition) {
        return;
      }

      const { left, top } = this.restoreScrollPosition;
      this.restoreScrollPosition = null;
      window.scrollTo({ left, top });
    }

    /**
     * Restores the transformed scroll lock released for a manual retry.
     */
    restoreMountLock() {
      if (!this.restoreMountedClass) {
        return;
      }

      this.restoreMountedClass = false;
      this.document.documentElement.classList.add(HTML_MOUNTED_CLASS);
    }

    /**
     * Finds the best native element to bring near the viewport.
     *
     * @returns {Element | null}
     */
    targetElement() {
      for (const selector of PAGE_LAZY_PRIME_TARGET_SELECTORS) {
        for (const element of DomProbe.queryAll(this.document, selector)) {
          if (this.isPrimeTarget(element)) {
            return element;
          }
        }
      }

      return null;
    }

    /**
     * Returns true when an element belongs to the native page surface.
     *
     * @param {Element} element
     * @returns {boolean}
     */
    isPrimeTarget(element) {
      return (
        element.isConnected &&
        element !== this.document.body &&
        element !== this.document.documentElement &&
        !DomProbe.isOwned(element)
      );
    }
  }

  /**
   * Collects valid video items from ordered source records.
   */
  class VideoItemCollector {
    /**
     * Builds de-duplicated video items until the requested item limit is met.
     *
     * @template T
     * @param {T[]} records
     * @param {(record: T, index: number) => VideoItem | null} itemFromRecord
     * @param {(item: VideoItem) => string} keyForItem
     * @param {number} itemLimit
     * @returns {VideoItem[]}
     */
    static collect(records, itemFromRecord, keyForItem, itemLimit) {
      const items = [];
      const seen = new Set();

      for (let index = 0; index < records.length; index += 1) {
        const item = itemFromRecord(records[index], index);

        if (!item) {
          continue;
        }

        const key = keyForItem(item);
        if (seen.has(key)) {
          continue;
        }

        seen.add(key);
        items.push(item);

        if (items.length >= itemLimit) {
          break;
        }
      }

      return items;
    }
  }

  /**
   * Extracts uniform video items from a page-owned source root.
   */
  class SourceAdapter {
    /**
     * Creates an adapter for one source root.
     *
     * @param {string} kind
     * @param {Element} root
     */
    constructor(kind, root) {
      this.kind = kind;
      this.root = root;
    }

    /**
     * Extracts valid video items from the source root.
     *
     * @returns {VideoItem[]}
     */
    extractItems() {
      const itemLimit =
        this.kind === SourceKind.PARTS || this.kind === SourceKind.COLLECTION
          ? Number.POSITIVE_INFINITY
          : MAX_ITEMS_PER_SOURCE;
      const keyForItem =
        this.kind === SourceKind.PARTS
          ? SourceAdapter.videoPartItemKey
          : SourceAdapter.itemKey;

      return VideoItemCollector.collect(
        this.videoTargets(),
        (target, index) => this.itemFromTarget(target, index),
        keyForItem,
        itemLimit
      );
    }

    /**
     * Finds video target elements that belong to the page-owned source root.
     *
     * @returns {Element[]}
     */
    videoTargets() {
      if (this.kind === SourceKind.PARTS) {
        return SourceAdapter.videoPartTargetsIn(this.root);
      }

      if (this.kind === SourceKind.COLLECTION) {
        const videoPod = this.root.matches(VIDEO_POD_SELECTOR)
          ? this.root
          : this.root.querySelector(VIDEO_POD_SELECTOR);

        if (videoPod) {
          // Note: Broad right-column candidates can contain both video-pod and
          // recommendations. Only the nested pod supplies collection archives.
          return SourceAdapter.videoPodArchiveTargetsIn(videoPod);
        }
      }

      return SourceAdapter.videoTargetsIn(this.root);
    }

    /**
     * Finds archive-level entries in Bilibili's combined collection and parts
     * surface.
     *
     * @param {Element} root
     * @returns {Element[]}
     */
    static videoPodArchiveTargetsIn(root) {
      const archiveItems = DomProbe.queryAll(
        root,
        VIDEO_POD_ARCHIVE_ITEM_SELECTOR
      ).filter(
        (element) =>
          !element.parentElement?.closest(VIDEO_POD_ARCHIVE_ITEM_SELECTOR)
      );
      const fallbackTargets = [
        ...SourceAdapter.dataTargetsIn(root),
        ...SourceAdapter.anchorTargetsIn(root).filter(
          (anchor) => !anchor.closest(VIDEO_PART_ITEM_SELECTOR)
        )
      ];
      const targets = archiveItems.length > 0 ? archiveItems : fallbackTargets;

      return DomProbe.unique(targets)
        .filter((target) => !DomProbe.isOwned(target))
        .filter((target) => Boolean(SourceAdapter.explicitTargetUrlFor(target)));
    }

    /**
     * Finds part rows for the current multipart archive.
     *
     * @param {Element} root
     * @returns {Element[]}
     */
    static videoPartTargetsIn(root) {
      if (root.matches(VIDEO_POD_SELECTOR)) {
        return SourceAdapter.videoPodPartTargetsIn(root);
      }

      const currentIdentity = SourceAdapter.playableIdentityForUrl(
        window.location.href
      );

      return SourceAdapter.videoTargetsIn(root).filter((target, index) => {
        const targetUrl = SourceAdapter.targetUrlFor(target, index);

        return Boolean(
          currentIdentity &&
            targetUrl &&
            SourceAdapter.playableIdentityForUrl(targetUrl) === currentIdentity
        );
      });
    }

    /**
     * Finds the current archive's nested page rows in a video-pod.
     *
     * Note: Bilibili places every page row below one archive element carrying
     * the BV id. Those rows remain distinct part targets even though the archive
     * ancestor is itself a playable data target.
     *
     * @param {Element} root
     * @returns {Element[]}
     */
    static videoPodPartTargetsIn(root) {
      const archive = SourceAdapter.currentVideoPodArchiveTarget(root);

      if (!archive) {
        return [];
      }

      return DomProbe.queryAll(archive, VIDEO_PART_ITEM_SELECTOR)
        .filter((target) => !DomProbe.isOwned(target))
        .filter((target) => !target.querySelector(VIDEO_PART_ITEM_SELECTOR))
        .filter((target) => Boolean(DomProbe.compactText(target)));
    }

    /**
     * Finds the video-pod archive entry representing the current BV or AV.
     *
     * @param {Element} root
     * @returns {Element | null}
     */
    static currentVideoPodArchiveTarget(root) {
      const archives = SourceAdapter.videoPodArchiveTargetsIn(root);
      const currentIdentity = SourceAdapter.playableIdentityForUrl(
        window.location.href
      );
      const matchingArchive = archives.find((archive) => {
        const targetUrl = SourceAdapter.explicitTargetUrlFor(archive);

        return Boolean(
          currentIdentity &&
            targetUrl &&
            SourceAdapter.playableIdentityForUrl(targetUrl) === currentIdentity
        );
      });

      if (matchingArchive) {
        return matchingArchive;
      }

      return archives.length === 1 ? archives[0] : null;
    }

    /**
     * Finds video target elements below an arbitrary page-owned source root.
     *
     * @param {Element} root
     * @returns {Element[]}
     */
    static videoTargetsIn(root) {
      const targets = [
        ...SourceAdapter.anchorTargetsIn(root),
        ...SourceAdapter.dataTargetsIn(root),
        ...SourceAdapter.videoPodItemTargetsIn(root)
      ];

      return DomProbe.unique(targets)
        .filter((target) => !DomProbe.isOwned(target))
        .filter((target, index) =>
          Boolean(SourceAdapter.targetUrlFor(target, index))
        );
    }

    /**
     * Finds playable anchor targets under a source root.
     *
     * @param {Element} root
     * @returns {Element[]}
     */
    static anchorTargetsIn(root) {
      return DomProbe.queryAll(root, VIDEO_LINK_SELECTOR)
        .filter((element) => element instanceof HTMLAnchorElement)
        .filter((anchor) => Boolean(SourceAdapter.normalizedUrl(anchor)));
    }

    /**
     * Finds row or card targets that expose a Bilibili URL or video id in data.
     *
     * Note: Bilibili video-pod rows can store either a BV id or a numeric
     * internal key in `data-key`. Invalid id values fall through to the
     * click-only video-pod page route.
     *
     * @param {Element} root
     * @returns {Element[]}
     */
    static dataTargetsIn(root) {
      return DomProbe.queryAll(root, VIDEO_TARGET_DATA_SELECTOR)
        .filter((element) => !SourceAdapter.hasPlayableAnchorAncestor(element))
        .filter((element) => Boolean(SourceAdapter.targetUrlFor(element)));
    }

    /**
     * Finds click-only rows in Bilibili's video-pod surface.
     *
     * Note: Some video-pod rows are page-owned click targets without stable
     * anchors. The adapter treats them as collection entries and derives a
     * route when no explicit URL or video id is present.
     *
     * @param {Element} root
     * @returns {Element[]}
     */
    static videoPodItemTargetsIn(root) {
      if (!root.matches(VIDEO_POD_SELECTOR)) {
        return [];
      }

      return DomProbe.queryAll(root, VIDEO_POD_ITEM_SELECTOR)
        .filter((element) => !SourceAdapter.hasPlayableAnchorAncestor(element))
        .filter((element) => !element.closest(VIDEO_TARGET_DATA_SELECTOR))
        .filter((element) => SourceAdapter.isVideoPodItemElement(element))
        .filter((element) => !SourceAdapter.hasNestedVideoPodItem(element))
        .filter((element) => Boolean(DomProbe.compactText(element)));
    }

    /**
     * Tests whether an element has the shape of one video-pod row.
     *
     * @param {Element} element
     * @returns {boolean}
     */
    static isVideoPodItemElement(element) {
      return (
        element.matches(VIDEO_POD_ITEM_SELECTOR) &&
        Boolean(
          element.matches(VIDEO_POD_ITEM_CLASS_SELECTOR) ||
            SourceAdapter.textsFromSelectors(element, TITLE_SELECTORS).length > 0 ||
            SourceAdapter.durationToken(DomProbe.compactText(element))
        )
      );
    }

    /**
     * Returns true when a candidate contains more specific pod item rows.
     *
     * @param {Element} element
     * @returns {boolean}
     */
    static hasNestedVideoPodItem(element) {
      return DomProbe.queryAll(element, VIDEO_POD_ITEM_SELECTOR).some(
        (child) =>
          child !== element && SourceAdapter.isVideoPodItemElement(child)
      );
    }

    /**
     * Converts one target element and its closest card-like ancestor to a video
     * item.
     *
     * @param {Element} target
     * @param {number} index
     * @returns {VideoItem | null}
     */
    itemFromTarget(target, index) {
      const targetUrl = SourceAdapter.targetUrlFor(target, index);
      if (!targetUrl) {
        return null;
      }

      if (
        this.kind === SourceKind.RECOMMENDATIONS &&
        SourceAdapter.isCurrentWatchUrl(targetUrl)
      ) {
        return null;
      }

      const card = SourceAdapter.cardForTarget(target);
      const title =
        this.kind === SourceKind.PARTS
          ? SourceAdapter.videoPartTitleFor(target, card)
          : SourceAdapter.titleFor(target, card);

      if (!title) {
        return null;
      }

      return {
        targetUrl,
        title,
        thumbnailUrl: SourceAdapter.thumbnailFor(target, card),
        sourceKind: this.kind,
        isCurrent:
          this.kind === SourceKind.COLLECTION &&
          (SourceAdapter.isCurrentSourceTarget(target, card) ||
            SourceAdapter.isCurrentWatchUrl(targetUrl)),
        duration: SourceAdapter.durationFor(card),
        author: SourceAdapter.metadataFor(card, "author"),
        viewCount: SourceAdapter.metadataFor(card, "viewCount"),
        progress: SourceAdapter.progressFor(card)
      };
    }

    /**
     * Finds the nearest card-like element for a source target.
     *
     * @param {Element} target
     * @returns {Element}
     */
    static cardForTarget(target) {
      for (const selector of CARD_SELECTORS) {
        const card = target.closest(selector);
        if (card && !DomProbe.isOwned(card)) {
          return card;
        }
      }

      return target;
    }

    /**
     * Returns the normalized URL for a source target.
     *
     * @param {Element} target
     * @param {number} [index]
     * @returns {string | null}
     */
    static targetUrlFor(target, index = 0) {
      return (
        SourceAdapter.explicitTargetUrlFor(target) ??
        SourceAdapter.videoPodPageUrl(target, index)
      );
    }

    /**
     * Returns an explicit playable URL from anchors or data without deriving a
     * click-only video-pod page route.
     *
     * @param {Element} target
     * @returns {string | null}
     */
    static explicitTargetUrlFor(target) {
      for (const anchor of SourceAdapter.anchorsForTarget(target)) {
        const url = SourceAdapter.normalizedUrl(anchor);

        if (url) {
          return url;
        }
      }

      for (const value of SourceAdapter.dataValues(target, VIDEO_URL_DATA_ATTRS)) {
        const url = SourceAdapter.normalizedVideoUrl(value);

        if (url) {
          return url;
        }
      }

      const bvid = SourceAdapter.firstDataValue(target, BVID_DATA_ATTRS);
      if (bvid) {
        const url = SourceAdapter.videoUrl({
          bvid,
          page: SourceAdapter.pageFor(target)
        });

        if (url) {
          return url;
        }
      }

      const aid = SourceAdapter.firstDataValue(target, AID_DATA_ATTRS);
      if (aid) {
        const url = SourceAdapter.videoUrl({
          aid,
          page: SourceAdapter.pageFor(target)
        });

        if (url) {
          return url;
        }
      }

      return null;
    }

    /**
     * Returns candidate anchors from a target without requiring them to be
     * playable.
     *
     * @param {Element} target
     * @returns {HTMLAnchorElement[]}
     */
    static anchorsForTarget(target) {
      const anchors =
        target instanceof HTMLAnchorElement
          ? [target]
          : DomProbe.queryAll(target, VIDEO_LINK_SELECTOR);

      return anchors.filter((anchor) => anchor instanceof HTMLAnchorElement);
    }

    /**
     * Returns true when an element is inside a playable anchor target.
     *
     * @param {Element} element
     * @returns {boolean}
     */
    static hasPlayableAnchorAncestor(element) {
      const anchor = element.closest(VIDEO_LINK_SELECTOR);

      return (
        anchor instanceof HTMLAnchorElement &&
        Boolean(SourceAdapter.normalizedUrl(anchor))
      );
    }

    /**
     * Returns the normalized URL from a video anchor.
     *
     * @param {HTMLAnchorElement} anchor
     * @returns {string | null}
     */
    static normalizedUrl(anchor) {
      const rawHref = anchor.getAttribute("href") || anchor.href;

      return SourceAdapter.normalizedVideoUrl(rawHref);
    }

    /**
     * Returns the normalized playable URL from raw URL-like text.
     *
     * @param {string | null | undefined} rawHref
     * @returns {string | null}
     */
    static normalizedVideoUrl(rawHref) {
      return BilibiliRoute.normalizedVideoUrl(rawHref, window.location.href);
    }

    /**
     * Builds a canonical Bilibili archive URL.
     *
     * @param {{ bvid?: string, aid?: string, page?: number | null }} params
     * @returns {string | null}
     */
    static videoUrl(params) {
      return BilibiliRoute.videoUrl(params);
    }

    /**
     * Builds a same-video page URL for click-only video-pod rows.
     *
     * @param {Element} target
     * @param {number} index
     * @returns {string | null}
     */
    static videoPodPageUrl(target, index) {
      if (!target.closest(VIDEO_POD_SELECTOR)) {
        return null;
      }

      const identity = SourceAdapter.playableIdentityForUrl(window.location.href);
      if (!identity?.startsWith("video:")) {
        return null;
      }

      const page = SourceAdapter.pageFor(target) ?? index + 1;
      const url = new URL(window.location.href);
      url.searchParams.set("p", String(page));

      return url.href;
    }

    /**
     * Reads candidate data attribute values from a target and its descendants.
     *
     * @param {Element} target
     * @param {string[]} attributes
     * @returns {string[]}
     */
    static dataValues(target, attributes) {
      const values = [];
      const holders = [
        target,
        ...DomProbe.queryAll(
          target,
          attributes.map((attribute) => `[${attribute}]`).join(",")
        )
      ];

      for (const holder of holders) {
        for (const attribute of attributes) {
          const value = holder.getAttribute(attribute);

          if (value) {
            values.push(value);
          }
        }
      }

      return values;
    }

    /**
     * Returns the first matching data attribute value.
     *
     * @param {Element} target
     * @param {string[]} attributes
     * @returns {string | null}
     */
    static firstDataValue(target, attributes) {
      return SourceAdapter.dataValues(target, attributes)[0] ?? null;
    }

    /**
     * Reads a one-based video page number from a target.
     *
     * @param {Element} target
     * @returns {number | null}
     */
    static pageFor(target) {
      for (const value of SourceAdapter.dataValues(target, PAGE_DATA_ATTRS)) {
        const page = Number.parseInt(value, 10);

        if (Number.isSafeInteger(page) && page > 0) {
          return page;
        }
      }

      return null;
    }

    /**
     * Normalizes Bilibili BV ids from data attributes.
     *
     * @param {string | null | undefined} value
     * @returns {string | null}
     */
    static cleanBvid(value) {
      return BilibiliRoute.cleanBvid(value);
    }

    /**
     * Normalizes Bilibili numeric archive ids from data attributes.
     *
     * @param {string | null | undefined} value
     * @returns {string | null}
     */
    static cleanAid(value) {
      return BilibiliRoute.cleanAid(value);
    }

    /**
     * Returns true for Bilibili routes that open a playable watch target.
     *
     * Note: Bilibili sidebars can include account or profile links with
     * "video" in their path. Those links are navigation chrome, not video
     * items for the bottom dock.
     *
     * @param {URL} url
     * @returns {boolean}
     */
    static isPlayableUrl(url) {
      return BilibiliRoute.isPlayableUrl(url, window.location.href);
    }

    /**
     * Returns a stable identity for a playable Bilibili URL.
     *
     * @param {string | URL} value
     * @returns {string | null}
     */
    static playableIdentityForUrl(value) {
      return BilibiliRoute.playableIdentityForUrl(value, window.location.href);
    }

    /**
     * Returns the Bilibili archive identity needed for video-info cover fetches.
     *
     * @param {string | URL} value
     * @returns {ArchiveVideoIdentity | null}
     */
    static archiveIdentityForUrl(value) {
      return BilibiliRoute.archiveIdentityForUrl(value, window.location.href);
    }

    /**
     * Returns true when a target points at the current watch route.
     *
     * Note: Bilibili can surface the current video inside recommendation
     * markup during lazy sidebar updates. Recommendations omit that duplicate.
     *
     * @param {string} targetUrl
     * @returns {boolean}
     */
    static isCurrentWatchUrl(targetUrl) {
      const currentIdentity = SourceAdapter.playableIdentityForUrl(
        window.location.href
      );
      const targetIdentity = SourceAdapter.playableIdentityForUrl(targetUrl);

      return Boolean(
        currentIdentity && targetIdentity && currentIdentity === targetIdentity
      );
    }

    /**
     * Returns true when Bilibili marks a source target as the active video row.
     *
     * Note: Bilibili collection rows can expose the current video through
     * active row state even when their extracted target URL does not normalize
     * to the browser's current watch route.
     *
     * @param {Element} target
     * @param {Element} card
     * @returns {boolean}
     */
    static isCurrentSourceTarget(target, card) {
      return (
        SourceAdapter.hasCurrentSourceMarker(target) ||
        SourceAdapter.hasCurrentSourceMarker(card)
      );
    }

    /**
     * Returns true when an element carries active/current source-row state.
     *
     * @param {Element} element
     * @returns {boolean}
     */
    static hasCurrentSourceMarker(element) {
      return (
        element.matches(CURRENT_SOURCE_ITEM_ATTR_SELECTOR) ||
        SourceAdapter.hasCurrentSourceClass(element)
      );
    }

    /**
     * Returns true when an element has a current-looking class token.
     *
     * @param {Element} element
     * @returns {boolean}
     */
    static hasCurrentSourceClass(element) {
      return Array.from(element.classList).some((className) =>
        /(?:^|[-_])(?:active|current|selected|playing|cur)(?:$|[-_])/iu.test(
          className
        )
      );
    }

    /**
     * Returns the current watch route key used to locate collection cards.
     *
     * @returns {string | null}
     */
    static currentWatchRouteKey() {
      return SourceAdapter.watchRouteKeyForUrl(window.location.href);
    }

    /**
     * Returns a watch route key that distinguishes archive pages within one BV.
     *
     * @param {string | URL} value
     * @returns {string | null}
     */
    static watchRouteKeyForUrl(value) {
      return BilibiliRoute.watchRouteKeyForUrl(value, window.location.href);
    }

    /**
     * Reads the one-based archive page number from a Bilibili watch URL.
     *
     * @param {URL} url
     * @returns {number}
     */
    static videoPageForUrl(url) {
      return BilibiliRoute.videoPageForUrl(url);
    }

    /**
     * Builds a de-duplication key for extracted page-owned video items.
     *
     * @param {VideoItem} item
     * @returns {string}
     */
    static itemKey(item) {
      const identity = SourceAdapter.playableIdentityForUrl(item.targetUrl);
      return `${identity ?? item.targetUrl}\n${item.title}`;
    }

    /**
     * Builds a part key that preserves distinct page routes even when their
     * displayed titles repeat.
     *
     * @param {VideoItem} item
     * @returns {string}
     */
    static videoPartItemKey(item) {
      return (
        SourceAdapter.watchRouteKeyForUrl(item.targetUrl) ??
        `${item.targetUrl}\n${item.title}`
      );
    }

    /**
     * Extracts a required video title.
     *
     * @param {Element} target
     * @param {Element} card
     * @returns {string | null}
     */
    static titleFor(target, card) {
      const candidates = [
        target.getAttribute("title"),
        target.getAttribute("aria-label"),
        ...SourceAdapter.textsFromSelectors(target, TITLE_SELECTORS),
        ...SourceAdapter.textsFromSelectors(card, TITLE_SELECTORS),
        SourceAdapter.imageAltFor(target),
        DomProbe.compactText(target)
      ];

      for (const candidate of candidates) {
        const title = SourceAdapter.cleanTitle(candidate);

        if (title) {
          return title;
        }
      }

      return null;
    }

    /**
     * Extracts a part label while allowing short native labels such as `1`.
     *
     * @param {Element} target
     * @param {Element} card
     * @returns {string | null}
     */
    static videoPartTitleFor(target, card) {
      const candidates = [
        target.getAttribute("title"),
        target.getAttribute("aria-label"),
        ...SourceAdapter.textsFromSelectors(target, TITLE_SELECTORS),
        ...SourceAdapter.textsFromSelectors(card, TITLE_SELECTORS),
        DomProbe.compactText(target)
      ];

      for (const candidate of candidates) {
        const text = SourceAdapter.cleanMetadata(candidate);

        if (!text) {
          continue;
        }

        const duration = SourceAdapter.durationToken(text);
        const title = SourceAdapter.cleanMetadata(
          duration ? text.replace(duration, "") : text
        );

        if (title) {
          return title;
        }
      }

      return null;
    }

    /**
     * Finds a thumbnail URL from images or CSS background images.
     *
     * @param {Element} target
     * @param {Element} card
     * @returns {string | null}
     */
    static thumbnailFor(target, card) {
      const imageUrl =
        SourceAdapter.thumbnailAttributeUrl(card) ||
        SourceAdapter.thumbnailAttributeUrl(target);

      if (imageUrl) {
        return imageUrl;
      }

      return (
        SourceAdapter.backgroundImageUrl(card) ||
        SourceAdapter.backgroundImageUrl(target)
      );
    }

    /**
     * Extracts a metadata field by known selector probes.
     *
     * @param {Element} card
     * @param {"author" | "viewCount"} field
     * @returns {string | null}
     */
    static metadataFor(card, field) {
      for (const text of SourceAdapter.textsFromSelectors(card, METADATA_SELECTORS[field])) {
        const clean = SourceAdapter.cleanMetadata(text);

        if (clean) {
          return clean;
        }
      }

      return null;
    }

    /**
     * Extracts the duration from explicit fields or a time-looking token.
     *
     * @param {Element} card
     * @returns {string | null}
     */
    static durationFor(card) {
      for (const text of SourceAdapter.textsFromSelectors(card, METADATA_SELECTORS.duration)) {
        const duration = SourceAdapter.durationToken(text);

        if (duration) {
          return duration;
        }
      }

      return SourceAdapter.durationToken(DomProbe.compactText(card));
    }

    /**
     * Extracts coarse playback progress when Bilibili exposes it in markup.
     *
     * @param {Element} card
     * @returns {string | null}
     */
    static progressFor(card) {
      const progress = card.querySelector(
        "[aria-valuenow], [class*='progress'], [class*='Progress']"
      );

      if (!progress) {
        return null;
      }

      const ariaValue = progress.getAttribute("aria-valuenow");
      if (ariaValue) {
        return `${ariaValue}%`;
      }

      const styleWidth = progress.getAttribute("style")?.match(/width:\s*([^;]+)/i)?.[1];
      return SourceAdapter.cleanMetadata(styleWidth ?? null);
    }

    /**
     * Collects non-empty text from a set of selector probes.
     *
     * @param {ParentNode} root
     * @param {string[]} selectors
     * @returns {string[]}
     */
    static textsFromSelectors(root, selectors) {
      const texts = [];

      for (const selector of selectors) {
        for (const element of DomProbe.queryAll(root, selector)) {
          const text = DomProbe.compactText(element);

          if (text) {
            texts.push(text);
          }
        }
      }

      return texts;
    }

    /**
     * Returns the first image alt text below a target element.
     *
     * @param {Element} target
     * @returns {string | null}
     */
    static imageAltFor(target) {
      const image = target.querySelector("img");
      return image?.getAttribute("alt") ?? null;
    }

    /**
     * Normalizes title text and rejects metadata-only strings.
     *
     * @param {string | null | undefined} value
     * @returns {string | null}
     */
    static cleanTitle(value) {
      const text = SourceAdapter.cleanMetadata(value);

      if (!text || text.length < 2 || SourceAdapter.durationToken(text) === text) {
        return null;
      }

      return text;
    }

    /**
     * Normalizes compact metadata text.
     *
     * @param {string | null | undefined} value
     * @returns {string | null}
     */
    static cleanMetadata(value) {
      const text = (value ?? "").replace(/\s+/g, " ").trim();
      return text || null;
    }

    /**
     * Extracts a duration-looking token from text.
     *
     * @param {string | null | undefined} value
     * @returns {string | null}
     */
    static durationToken(value) {
      return value?.match(/\b\d{1,2}:\d{2}(?::\d{2})?\b/)?.[0] ?? null;
    }

    /**
     * Normalizes image URLs from lazy attributes and protocol-relative values.
     *
     * @param {string | null | undefined} value
     * @returns {string | null}
     */
    static assetUrl(value) {
      const raw = value?.trim();

      if (!raw || raw.startsWith("data:")) {
        return null;
      }

      try {
        return new URL(raw, window.location.href).href;
      } catch (_error) {
        return null;
      }
    }

    /**
     * Normalizes an image URL and upgrades plain HTTP to HTTPS.
     *
     * Note: Bilibili image CDNs can expose HTTP thumbnail URLs on HTTPS watch
     * pages. Extension-owned image nodes use HTTPS to avoid mixed-content
     * upgrade warnings.
     *
     * @param {string | null | undefined} value
     * @returns {string | null}
     */
    static secureAssetUrl(value) {
      const assetUrl = SourceAdapter.assetUrl(value);

      if (!assetUrl) {
        return null;
      }

      const url = new URL(assetUrl);

      if (url.protocol === "http:") {
        url.protocol = "https:";
      }

      return url.href;
    }

    /**
     * Returns a secure thumbnail URL only when it is a real content image.
     *
     * Note: Bilibili lazy lists can expose loading or static placeholder assets
     * before mutating a card with the real cover URL.
     *
     * @param {string | null | undefined} value
     * @returns {string | null}
     */
    static usableThumbnailUrl(value) {
      const assetUrl = SourceAdapter.secureAssetUrl(value);

      if (!assetUrl || SourceAdapter.isPlaceholderThumbnailUrl(assetUrl)) {
        return null;
      }

      return assetUrl;
    }

    /**
     * Tests whether a normalized thumbnail URL points at a placeholder asset.
     *
     * @param {string} assetUrl
     * @returns {boolean}
     */
    static isPlaceholderThumbnailUrl(assetUrl) {
      const url = new URL(assetUrl);
      const pathname = url.pathname.toLowerCase();
      const filename = pathname.split("/").pop() ?? "";

      return (
        !filename ||
        pathname.includes("/bfs/static/") ||
        THUMBNAIL_PLACEHOLDER_NAME_PATTERN.test(filename)
      );
    }

    /**
     * Finds a usable thumbnail URL in image and lazy image attributes.
     *
     * @param {Element} element
     * @returns {string | null}
     */
    static thumbnailAttributeUrl(element) {
      const candidates = SourceAdapter.thumbnailAttributeCandidates(element);

      for (const candidate of candidates) {
        for (const value of SourceAdapter.thumbnailAttributeValues(candidate)) {
          const thumbnailUrl = SourceAdapter.usableThumbnailUrl(value);

          if (thumbnailUrl) {
            return thumbnailUrl;
          }
        }
      }

      return null;
    }

    /**
     * Returns candidate elements that may hold a native thumbnail URL.
     *
     * @param {Element} element
     * @returns {Element[]}
     */
    static thumbnailAttributeCandidates(element) {
      const candidates = element.matches(THUMBNAIL_ATTRIBUTE_SELECTOR)
        ? [element]
        : [];

      candidates.push(...DomProbe.queryAll(element, THUMBNAIL_ATTRIBUTE_SELECTOR));

      return DomProbe.unique(candidates);
    }

    /**
     * Returns possible image URLs from one thumbnail candidate.
     *
     * @param {Element} element
     * @returns {string[]}
     */
    static thumbnailAttributeValues(element) {
      const values = [];

      if (element instanceof HTMLImageElement) {
        values.push(element.currentSrc);
      }

      for (const attribute of THUMBNAIL_IMAGE_URL_ATTRS) {
        values.push(element.getAttribute(attribute));
      }

      for (const attribute of THUMBNAIL_IMAGE_SRCSET_ATTRS) {
        values.push(
          ...SourceAdapter.imageUrlsFromSrcset(element.getAttribute(attribute))
        );
      }

      return values.filter(Boolean);
    }

    /**
     * Extracts URL candidates from a `srcset` attribute.
     *
     * @param {string | null} value
     * @returns {string[]}
     */
    static imageUrlsFromSrcset(value) {
      return (
        value
          ?.split(",")
          .map((candidate) => candidate.trim().split(/\s+/)[0])
          .filter(Boolean) ?? []
      );
    }

    /**
     * Extracts a CSS background image URL when no image node is available.
     *
     * @param {Element} element
     * @returns {string | null}
     */
    static backgroundImageUrl(element) {
      for (const candidate of SourceAdapter.backgroundImageCandidates(element)) {
        const background = window.getComputedStyle(candidate).backgroundImage;
        const match = background.match(/url\(["']?(.+?)["']?\)/);

        if (!match) {
          continue;
        }

        const thumbnailUrl = SourceAdapter.usableThumbnailUrl(match[1]);

        if (thumbnailUrl) {
          return thumbnailUrl;
        }
      }

      return null;
    }

    /**
     * Returns elements whose computed background may carry a thumbnail.
     *
     * @param {Element} element
     * @returns {Element[]}
     */
    static backgroundImageCandidates(element) {
      return DomProbe.unique([
        element,
        ...DomProbe.queryAll(element, THUMBNAIL_BACKGROUND_SELECTOR)
      ]);
    }
  }

  /**
   * Converts Bilibili account-list API records into uniform video items.
   */
  class AccountSourceAdapter {
    /**
     * Converts one successful API payload into a video-list source.
     *
     * @param {string} kind
     * @param {object} payload
     * @param {string} language
     * @returns {VideoListSource | null}
     */
    static sourceFromPayload(kind, payload, language) {
      const items = AccountSourceAdapter.itemsFromEntries(
        kind,
        AccountSourceAdapter.entriesFromPayload(payload),
        language
      );

      if (items.length === 0) {
        return null;
      }

      return {
        kind,
        root: null,
        items
      };
    }

    /**
     * Returns the account-list array from a Bilibili response payload.
     *
     * @param {object} payload
     * @returns {object[]}
     */
    static entriesFromPayload(payload) {
      const list = payload?.data?.medias ?? payload?.data?.list;

      if (!Array.isArray(list)) {
        return [];
      }

      return list.filter((entry) => entry && typeof entry === "object");
    }

    /**
     * Reads the continuation cursor from a nonempty history response.
     *
     * Note: History continuation uses the response cursor even when individual
     * entries cannot become cards. A short page alone does not mark the end.
     *
     * @param {object} payload
     * @returns {HistoryCursor | null}
     */
    static historyCursorFromPayload(payload) {
      const data = payload?.data;
      if (!Array.isArray(data?.list) || data.list.length === 0) {
        return null;
      }

      const max = AccountSourceAdapter.nonNegativeInteger(data.cursor?.max);
      const viewAt = AccountSourceAdapter.nonNegativeInteger(data.cursor?.view_at);

      if (max === null || viewAt === null || (max === 0 && viewAt === 0)) {
        return null;
      }

      return {
        max,
        viewAt,
        business: AccountSourceAdapter.stringValue(data.cursor?.business) ?? ""
      };
    }

    /**
     * Returns the playable route identity used to merge account pages.
     *
     * @param {VideoItem} item
     * @returns {string}
     */
    static itemKey(item) {
      return SourceAdapter.watchRouteKeyForUrl(item.targetUrl) ?? item.targetUrl;
    }

    /**
     * Extracts valid account list items while preserving Bilibili order.
     *
     * @param {string} kind
     * @param {object[]} entries
     * @param {string} language
     * @returns {VideoItem[]}
     */
    static itemsFromEntries(kind, entries, language) {
      return VideoItemCollector.collect(
        entries,
        (entry) => AccountSourceAdapter.itemFromEntry(kind, entry, language),
        AccountSourceAdapter.itemKey,
        entries.length
      );
    }

    /**
     * Converts one account list record into a video item.
     *
     * @param {string} kind
     * @param {object} entry
     * @param {string} language
     * @returns {VideoItem | null}
     */
    static itemFromEntry(kind, entry, language) {
      // Note: Favorites can contain audio and unavailable archives alongside videos.
      if (kind === SourceKind.FAVORITES && (
        Number(entry.type) !== FAVORITE_ARCHIVE_TYPE ||
        (Number(entry.attr) & FAVORITE_UNAVAILABLE_FLAG)
      )) {
        return null;
      }
      const targetUrl = AccountSourceAdapter.targetUrlFor(entry);
      const title = AccountSourceAdapter.titleFor(entry);

      if (!targetUrl || !title) {
        return null;
      }

      const item = {
        targetUrl,
        title,
        thumbnailUrl: AccountSourceAdapter.thumbnailFor(entry),
        sourceKind: kind,
        duration: AccountSourceAdapter.durationFor(entry),
        author: AccountSourceAdapter.authorFor(entry),
        viewCount: AccountSourceAdapter.viewCountFor(entry, language),
        progress: AccountSourceAdapter.progressFor(entry, language)
      };

      if (kind === SourceKind.WATCH_LATER) {
        const watchLaterAid = AccountSourceAdapter.watchLaterAidFor(entry);

        if (watchLaterAid) {
          item.watchLaterAid = watchLaterAid;
        }
      }

      return item;
    }

    /**
     * Resolves the best navigation target from Bilibili account record fields.
     *
     * @param {object} entry
     * @returns {string | null}
     */
    static targetUrlFor(entry) {
      const directUrl = SourceAdapter.normalizedVideoUrl(
        AccountSourceAdapter.stringValue(entry.redirect_link) ||
          AccountSourceAdapter.stringValue(entry.redirect_url) ||
          AccountSourceAdapter.stringValue(entry.uri) ||
          AccountSourceAdapter.stringValue(entry.url)
      );

      if (directUrl) {
        return directUrl;
      }

      const page = AccountSourceAdapter.pageNumberFor(entry);
      const bvid = AccountSourceAdapter.stringValue(
        entry.bvid || entry.bv_id || entry.history?.bvid
      );

      if (bvid) {
        return SourceAdapter.videoUrl({ bvid, page });
      }

      const aid = AccountSourceAdapter.archiveAidFor(entry);

      if (aid) {
        return SourceAdapter.videoUrl({ aid: String(aid), page });
      }

      const epid = AccountSourceAdapter.numberValue(
        entry.epid ?? entry.history?.epid ?? entry.bangumi?.ep_id
      );

      if (epid) {
        return `${BILIBILI_WEB_ORIGIN}/bangumi/play/ep${epid}`;
      }

      return null;
    }

    /**
     * Extracts the display title from account record title fields.
     *
     * @param {object} entry
     * @returns {string | null}
     */
    static titleFor(entry) {
      const title = AccountSourceAdapter.cleanText(entry.title || entry.name);
      const subtitle = AccountSourceAdapter.cleanText(
        entry.long_title ||
          entry.show_title ||
          entry.page?.part ||
          entry.history?.part
      );

      if (title && subtitle && title !== subtitle) {
        return `${title} - ${subtitle}`;
      }

      return title || subtitle;
    }

    /**
     * Finds a thumbnail URL from account record image fields.
     *
     * @param {object} entry
     * @returns {string | null}
     */
    static thumbnailFor(entry) {
      const cover = Array.isArray(entry.covers) ? entry.covers[0] : null;
      const candidates = [
        entry.pic,
        entry.cover,
        entry.first_frame,
        cover,
        entry.bangumi?.cover
      ];

      for (const candidate of candidates) {
        const thumbnailUrl = SourceAdapter.usableThumbnailUrl(candidate);

        if (thumbnailUrl) {
          return thumbnailUrl;
        }
      }

      return null;
    }

    /**
     * Extracts the author label from account record owner fields.
     *
     * @param {object} entry
     * @returns {string | null}
     */
    static authorFor(entry) {
      return AccountSourceAdapter.cleanText(
        entry.author_name ||
          entry.owner?.name ||
          entry.upper?.name ||
          entry.author ||
          entry.up_name
      );
    }

    /**
     * Formats the view count when Bilibili includes one.
     *
     * @param {object} entry
     * @param {string} language
     * @returns {string | null}
     */
    static viewCountFor(entry, language) {
      const viewCount = AccountSourceAdapter.numberValue(
        entry.stat?.view ?? entry.cnt_info?.play ?? entry.view ?? entry.play
      );

      if (!viewCount || viewCount <= 0) {
        return null;
      }

      return UiStrings.viewCount(
        AccountSourceAdapter.compactNumber(viewCount, language),
        language
      );
    }

    /**
     * Extracts the duration from account record duration fields.
     *
     * @param {object} entry
     * @returns {string | null}
     */
    static durationFor(entry) {
      return AccountSourceAdapter.formatDuration(
        AccountSourceAdapter.numberValue(entry.duration ?? entry.page?.duration)
      );
    }

    /**
     * Extracts playback progress from account record progress fields.
     *
     * @param {object} entry
     * @param {string} language
     * @returns {string | null}
     */
    static progressFor(entry, language) {
      const progress = AccountSourceAdapter.numberValue(entry.progress);

      if (progress === null) {
        return null;
      }

      const duration = AccountSourceAdapter.numberValue(entry.duration);

      if (progress === -1 || (duration && progress >= duration)) {
        return UiStrings.finishedProgress(language);
      }

      const formatted = AccountSourceAdapter.formatDuration(progress);

      return formatted ? UiStrings.watchedProgress(formatted, language) : null;
    }

    /**
     * Reads the last watched page number from account record fields.
     *
     * @param {object} entry
     * @returns {number | null}
     */
    static pageNumberFor(entry) {
      return AccountSourceAdapter.numberValue(
        entry.page?.page ?? entry.history?.page
      );
    }

    /**
     * Reads the archive id used by Bilibili's watch-later deletion endpoint.
     *
     * @param {object} entry
     * @returns {string | null}
     */
    static watchLaterAidFor(entry) {
      const aid = AccountSourceAdapter.archiveAidFor(entry);

      if (!aid || aid <= 0) {
        return null;
      }

      return String(Math.trunc(aid));
    }

    /**
     * Reads the full account watch-later count from a to-view payload.
     *
     * @param {object} payload
     * @returns {number | null}
     */
    static watchLaterCountFromPayload(payload) {
      const candidates = [
        payload?.data?.count,
        payload?.data?.total,
        payload?.data?.page?.count,
        payload?.data?.page?.total,
        payload?.data?.cursor?.count,
        payload?.data?.cursor?.total
      ];

      for (const candidate of candidates) {
        const count = AccountSourceAdapter.nonNegativeInteger(candidate);

        if (count !== null) {
          return count;
        }
      }

      return null;
    }

    /**
     * Reads the archive id from account record id fields.
     *
     * @param {object} entry
     * @returns {number | null}
     */
    static archiveAidFor(entry) {
      return AccountSourceAdapter.numberValue(
        entry.aid ?? entry.kid ?? entry.history?.oid ?? (Number(entry.type) === FAVORITE_ARCHIVE_TYPE ? entry.id : null)
      );
    }

    /**
     * Formats seconds as a compact duration token.
     *
     * @param {number | null} seconds
     * @returns {string | null}
     */
    static formatDuration(seconds) {
      if (!seconds || seconds <= 0) {
        return null;
      }

      const totalSeconds = Math.floor(seconds);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const remainder = totalSeconds % 60;
      const paddedRemainder = String(remainder).padStart(2, "0");

      if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, "0")}:${paddedRemainder}`;
      }

      return `${minutes}:${paddedRemainder}`;
    }

    /**
     * Formats large counts without changing the card layout.
     *
     * @param {number} value
     * @param {string} language
     * @returns {string}
     */
    static compactNumber(value, language) {
      try {
        return new Intl.NumberFormat(UiStrings.numberLocale(language), {
          maximumFractionDigits: 1,
          notation: "compact"
        }).format(value);
      } catch (_error) {
        return String(value);
      }
    }

    /**
     * Converts a numeric value from Bilibili payloads.
     *
     * @param {unknown} value
     * @returns {number | null}
     */
    static numberValue(value) {
      const number = Number(value);

      if (!Number.isFinite(number)) {
        return null;
      }

      return number;
    }

    /**
     * Converts a non-negative integer value from Bilibili payloads.
     *
     * @param {unknown} value
     * @returns {number | null}
     */
    static nonNegativeInteger(value) {
      if (typeof value === "string" && !value.trim()) {
        return null;
      }

      const number = AccountSourceAdapter.numberValue(value);

      if (number === null || number < 0) {
        return null;
      }

      return Math.trunc(number);
    }

    /**
     * Converts a string value from Bilibili payloads.
     *
     * @param {unknown} value
     * @returns {string | null}
     */
    static stringValue(value) {
      return typeof value === "string" ? value.trim() || null : null;
    }

    /**
     * Normalizes compact text from Bilibili payloads.
     *
     * @param {unknown} value
     * @returns {string | null}
     */
    static cleanText(value) {
      return SourceAdapter.cleanMetadata(AccountSourceAdapter.stringValue(value));
    }
  }

  /**
   * Retains account lists, owns per-source pagination, and notifies rendering.
   */
  class AccountSourceStore {
    /**
     * Creates independently loaded account sources.
     *
     * @param {() => void} onChange
     */
    constructor(onChange) {
      this.onChange = onChange;
      /** @type {Map<string, AccountSourceRecord>} */
      this.records = new Map();
      this.enabledKinds = new Set(ACCOUNT_SOURCE_ORDER);
      /** @type {Map<string, AccountSourceRecord>} Cached records keyed by folder id. */
      this.favoriteRecords = new Map();
      /** @type {FavoriteFolderDirectory | null} Owned folders and directory request state. */
      this.favoriteFolders = null;
      this.language = null;
      this.stop();
    }

    /**
     * Returns revealed account items and their pagination state in source order.
     *
     * @returns {VideoListSource[]}
     */
    currentSources() {
      return ACCOUNT_SOURCE_ORDER.map((kind) => this.currentSource(kind))
        .filter(Boolean);
    }

    /**
     * Returns one account source at its expansion depth or with all retained items.
     *
     * @param {string} kind
     * @param {boolean} [includeAll] Includes retained items beyond the visible budget.
     * @returns {VideoListSource | null}
     */
    currentSource(kind, includeAll = false) {
      const record = this.records.get(kind);
      if (!record) {
        throw new Error("Unknown account source kind");
      }
      if (!this.enabledKinds.has(kind)) return null;
      const items = record.items.slice(0, includeAll ? undefined : record.visibleCount);
      const favorite = kind === SourceKind.FAVORITES;
      const folder = favorite ? this.favoriteFolders.items.find((entry) => entry.id === record.folderId) : null;
      return items.length > 0 || favorite
        ? {
            kind,
            ...(favorite ? {
              folderId: record.folderId,
              title: folder?.title,
              isDefaultFolder: Boolean(folder?.isDefault),
              status: record.folderId ? record.status : this.favoriteFolders.status,
              loaded: record.loaded
            } : {}),
            root: null,
            items,
            pagination: {
              hasMore: !includeAll && AccountSourceStore.hasMore(record),
              status: record.status
            }
          }
        : null;
    }

    /**
     * Reveals the cached watch-later batch containing a target without fetching.
     *
     * Existing expansion is retained. An absent target leaves the source alone.
     *
     * @param {string} targetUrl
     * @returns {VideoListSource | null} Revealed source, or null for no match.
     */
    revealWatchLaterItem(targetUrl) {
      const routeKey = SourceAdapter.watchRouteKeyForUrl(targetUrl);
      if (!routeKey) {
        return null;
      }
      const record = this.records.get(SourceKind.WATCH_LATER);
      const index = record.items.findIndex(
        (item) => AccountSourceAdapter.itemKey(item) === routeKey
      );
      if (index === -1) {
        return null;
      }

      const missingCount = index + 1 - record.visibleCount;
      if (missingCount > 0) {
        record.visibleCount += Math.ceil(missingCount / ACCOUNT_MORE_BATCH_SIZE) *
          ACCOUNT_MORE_BATCH_SIZE;
        this.onChange();
      }
      return this.currentSource(SourceKind.WATCH_LATER);
    }

    /**
     * Returns the full account watch-later count when available.
     *
     * @returns {number | null}
     */
    currentWatchLaterCount() {
      if (!this.enabledKinds.has(SourceKind.WATCH_LATER)) return null;
      return this.records.get(SourceKind.WATCH_LATER).watchLaterCount;
    }

    /**
     * Cancels disabled source requests while retaining their items and expansion.
     * Re-enabling refreshes the retained source on the next account pass.
     * @param {string[]} kinds Enabled account source kinds.
     */
    setEnabledKinds(kinds) {
      const enabled = new Set(kinds);
      for (const kind of ACCOUNT_SOURCE_ORDER) {
        if (enabled.has(kind) || !this.enabledKinds.has(kind)) continue;
        const records = kind === SourceKind.FAVORITES
          ? [this.records.get(kind), ...this.favoriteRecords.values()]
          : [this.records.get(kind)];
        for (const record of records) {
          record.controller?.abort();
          record.controller = null;
          record.loaded = false;
          record.status = AccountSourceStatus.READY;
        }
        if (kind === SourceKind.FAVORITES) {
          this.favoriteFolders.controller?.abort();
          this.favoriteFolders.controller = null;
          this.favoriteFolders.promise = null;
          this.favoriteFolders.loaded = false;
          this.favoriteFolders.status = AccountSourceStatus.READY;
        }
      }
      this.enabledKinds = enabled;
    }

    /**
     * Adds an archive and refreshes watch later at its current expansion depth.
     *
     * @param {string} targetUrl
     * @param {string} language
     * @returns {Promise<void>}
     */
    async addWatchLaterItem(targetUrl, language) {
      const identity = AccountSourceStore.watchLaterAddIdentityForUrl(targetUrl);

      if (!identity) {
        throw new Error("Missing watch-later target identity");
      }

      const records = this.records;
      await AccountSourceStore.addWatchLaterApiItem(identity);

      if (records !== this.records) {
        return;
      }

      if (this.language !== UiStrings.normalizeLanguage(language)) {
        await this.refresh(language);
      } else {
        await this.refreshSource(SourceKind.WATCH_LATER);
      }
    }

    /**
     * Deletes an archive from the account and the retained watch-later items.
     *
     * @param {string} aid
     * @returns {Promise<void>}
     */
    async deleteWatchLaterItem(aid) {
      const normalizedAid = AccountSourceStore.normalizeAid(aid);

      if (!normalizedAid) {
        throw new Error("Missing watch-later aid");
      }

      const record = this.records.get(SourceKind.WATCH_LATER);
      await AccountSourceStore.deleteWatchLaterApiItem(normalizedAid);

      if (this.records.get(SourceKind.WATCH_LATER) !== record) {
        return;
      }

      const wasRefreshing = Boolean(record.controller);
      record.controller?.abort();
      record.controller = null;
      record.status = AccountSourceStatus.READY;
      const didRemove = this.removeWatchLaterItem(normalizedAid);
      const didDecrement = this.decrementWatchLaterCount();

      if (didRemove || didDecrement || wasRefreshing) {
        this.onChange();
      }

      if (wasRefreshing) {
        await this.refreshSource(SourceKind.WATCH_LATER);
      }
    }

    /**
     * Decrements the loaded account count after a successful deletion.
     *
     * @returns {boolean}
     */
    decrementWatchLaterCount() {
      const record = this.records.get(SourceKind.WATCH_LATER);
      if (record.watchLaterCount === null) {
        return false;
      }

      record.watchLaterCount = Math.max(0, record.watchLaterCount - 1);
      return true;
    }

    /**
     * Removes an archive from visible and retained watch-later items.
     *
     * @param {string} aid
     * @returns {boolean}
     */
    removeWatchLaterItem(aid) {
      const record = this.records.get(SourceKind.WATCH_LATER);
      const items = record.items.filter((item) => item.watchLaterAid !== aid);
      const didRemove = items.length !== record.items.length;
      record.items = items;
      return didRemove;
    }

    /**
     * Loads account sources once per language, or explicitly refreshes them.
     *
     * @param {string} language
     * @param {boolean} [force]
     * @returns {Promise<void>}
     */
    async refresh(language, force = false) {
      const normalizedLanguage = UiStrings.normalizeLanguage(language);

      if (this.language !== normalizedLanguage) {
        this.stop();
        this.language = normalizedLanguage;
      }

      await Promise.all(ACCOUNT_SOURCE_ORDER.map((kind) => {
        if (kind === SourceKind.FAVORITES) {
          return this.favoriteFolders.requested ? this.loadFavoriteFolders(true) : undefined;
        }
        const record = this.records.get(kind);
        return !force && (record.loaded || record.controller)
          ? undefined
          : this.refreshSource(kind);
      }));
    }

    /**
     * Refreshes one source while preserving its visible-item budget.
     *
     * @param {string} kind
     * @returns {Promise<void>}
     */
    async refreshSource(kind) {
      if (!this.enabledKinds.has(kind)) return;
      const record = this.records.get(kind);
      if (kind === SourceKind.FAVORITES && !record.folderId) {
        await this.loadFavoriteFolders(true);
        return;
      }
      const controller = this.beginRequest(record);
      const url = AccountSourceStore.sourceUrl(record);

      try {
        const result = await AccountSourceStore.fetchSourceRecord(
          kind, url, controller.signal, this.language
        );

        if (this.isCurrentRequest(record, controller)) {
          record.items = result.source?.items ?? [];
          record.cursor = result.cursor;
          record.cursorKeys.clear();
          record.watchLaterCount = result.watchLaterCount;
          record.status = AccountSourceStatus.READY;
        }
      } catch (error) {
        if (this.isCurrentRequest(record, controller)) {
          if (kind === SourceKind.FAVORITES && error.code === -101) this.clearFavoriteAccount();
          else record.status = AccountSourceStatus.ERROR;
        }
      } finally {
        if (this.isCurrentRequest(record, controller)) {
          record.loaded = true;
          record.controller = null;
          this.onChange();
        }
      }
    }

    /**
     * Reveals retained items or appends one account continuation page.
     *
     * @param {string} kind
     * @returns {Promise<void>}
     */
    async loadMore(kind) {
      const record = this.records.get(kind);
      if (!record) {
        throw new Error("Unknown account source kind");
      }
      if (!this.enabledKinds.has(kind)) return;

      if (record.controller || !AccountSourceStore.hasMore(record)) {
        return;
      }

      if (record.items.length > record.visibleCount) {
        record.visibleCount += ACCOUNT_MORE_BATCH_SIZE;
        record.status = AccountSourceStatus.READY;
        this.onChange();
        return;
      }

      const cursor = record.cursor;
      const controller = this.beginRequest(record);

      try {
        const result = await AccountSourceStore.fetchSourceRecord(
          kind,
          AccountSourceStore.sourceUrl(record, cursor),
          controller.signal,
          this.language
        );

        if (!this.isCurrentRequest(record, controller)) {
          return;
        }

        const seen = new Set(record.items.map(AccountSourceAdapter.itemKey));
        for (const item of result.source?.items ?? []) {
          const key = AccountSourceAdapter.itemKey(item);
          if (!seen.has(key)) {
            seen.add(key);
            record.items.push(item);
          }
        }

        record.visibleCount += ACCOUNT_MORE_BATCH_SIZE;
        record.cursorKeys.add(JSON.stringify(cursor));
        record.cursor = result.cursor &&
          !record.cursorKeys.has(JSON.stringify(result.cursor))
          ? result.cursor
          : null;
        record.status = AccountSourceStatus.READY;
      } catch (error) {
        if (this.isCurrentRequest(record, controller)) {
          if (kind === SourceKind.FAVORITES && error.code === -101) this.clearFavoriteAccount();
          else record.status = AccountSourceStatus.ERROR;
        }
      } finally {
        if (this.isCurrentRequest(record, controller)) {
          record.controller = null;
          this.onChange();
        }
      }
    }

    /**
     * Starts a source request and invalidates its previous request.
     *
     * @param {AccountSourceRecord} record
     * @returns {AbortController}
     */
    beginRequest(record) {
      record.controller?.abort();
      const controller = new AbortController();
      record.controller = controller;
      record.status = AccountSourceStatus.LOADING;
      this.onChange();
      return controller;
    }

    /**
     * Rejects completions from canceled requests and earlier store sessions.
     *
     * @param {AccountSourceRecord} record
     * @param {AbortController} controller
     * @returns {boolean}
     */
    isCurrentRequest(record, controller) {
      const current = record.kind === SourceKind.FAVORITES && record.folderId
        ? this.favoriteRecords.get(record.folderId) : this.records.get(record.kind);
      return current === record &&
        record.controller === controller && !controller.signal.aborted;
    }

    /**
     * Cancels account work and resets the retained lists and expansion state.
     */
    stop() {
      for (const record of this.records.values()) {
        record.controller?.abort();
      }

      this.favoriteFolders?.controller?.abort();
      for (const record of this.favoriteRecords.values()) record.controller?.abort();
      this.favoriteRecords.clear();
      this.favoriteFolders = {
        accountId: null, items: [], requested: false, requestedFolderId: null,
        loaded: false, status: AccountSourceStatus.READY, controller: null, promise: null
      };
      this.records = new Map(ACCOUNT_SOURCE_ORDER.map((kind) => [kind, AccountSourceStore.createRecord(kind)]));
      this.language = null;
    }

    /** Creates a list record shared by singleton sources and favorite folders. */
    static createRecord(kind, folderId = null) {
      return {
        kind, folderId, items: [],
        visibleCount: kind === SourceKind.WATCH_LATER ? ACCOUNT_WATCH_LATER_INITIAL_SIZE
          : kind === SourceKind.FAVORITES ? ACCOUNT_FAVORITES_PAGE_SIZE : ACCOUNT_HISTORY_PAGE_SIZE,
        cursor: null, cursorKeys: new Set(), watchLaterCount: null,
        loaded: false, status: AccountSourceStatus.READY, controller: null
      };
    }

    /**
     * Resolves the first or next request for an account source.
     * Note: Favorites uses numbered pages; history supplies an opaque cursor.
     * @param {AccountSourceRecord} record
     * @param {HistoryCursor | number | null} [cursor]
     * @returns {string}
     */
    static sourceUrl(record, cursor = null) {
      if (record.kind === SourceKind.FAVORITES) {
        const url = new URL(FAVORITES_SOURCE_URL);
        for (const [key, value] of Object.entries({
          media_id: record.folderId, pn: cursor ?? 1, ps: ACCOUNT_FAVORITES_PAGE_SIZE,
          order: "mtime", type: 0, tid: 0, platform: "web"
        })) url.searchParams.set(key, String(value));
        return url.href;
      }
      if (record.kind === SourceKind.WATCH_LATER) return WATCH_LATER_SOURCE_URL;
      return cursor ? AccountSourceStore.historyUrlFor(cursor) : HISTORY_SOURCE_URL;
    }

    /** Drops account-private folder data when the authenticated account changes. */
    clearFavoriteAccount(accountId = null) {
      for (const record of this.favoriteRecords.values()) record.controller?.abort();
      this.favoriteRecords.clear();
      this.records.set(SourceKind.FAVORITES, AccountSourceStore.createRecord(SourceKind.FAVORITES));
      Object.assign(this.favoriteFolders, {
        accountId, items: [], loaded: false,
        status: accountId ? AccountSourceStatus.LOADING : AccountSourceStatus.SIGNED_OUT
      });
      this.onChange();
    }

    /**
     * Loads owned folders on demand and validates remembered selection against the account.
     * @param {boolean} [force] Refreshes the directory, including account identity.
     * @returns {Promise<void>}
     */
    async loadFavoriteFolders(force = false) {
      if (!this.enabledKinds.has(SourceKind.FAVORITES)) return;
      const directory = this.favoriteFolders;
      directory.requested = true;
      if (directory.promise) return directory.promise;
      if (directory.loaded && !force) {
        const record = this.records.get(SourceKind.FAVORITES);
        if (record.folderId && !record.loaded && !record.controller) await this.refreshSource(SourceKind.FAVORITES);
        return;
      }
      const controller = new AbortController();
      directory.controller = controller;
      directory.status = AccountSourceStatus.LOADING;
      this.onChange();
      const current = () => this.favoriteFolders === directory &&
        directory.controller === controller && !controller.signal.aborted;
      directory.promise = (async () => {
        try {
          const account = await AccountSourceStore.fetchApiPayload(ACCOUNT_NAV_URL, controller.signal);
          if (!current()) return;
          if (account.code === -101 || (account.code === 0 && account.data?.isLogin === false)) {
            this.clearFavoriteAccount();
            directory.requestedFolderId = null;
            return;
          }
          const accountId = FavoriteFolderPreference.normalizeId(account.data?.mid);
          if (account.code !== 0 || !accountId) throw new Error("Account identity unavailable");
          if (directory.accountId !== accountId) this.clearFavoriteAccount(accountId);
          const url = new URL(FAVORITE_FOLDERS_URL);
          url.searchParams.set("up_mid", accountId);
          const payload = await AccountSourceStore.fetchApiPayload(url.href, controller.signal);
          if (!current()) return;
          if (payload.code === -101) { this.clearFavoriteAccount(); return; }
          if (payload.code !== 0 || !(Array.isArray(payload.data?.list) || payload.data?.count === 0)) {
            throw new Error("Favorite folders unavailable");
          }
          const seen = new Set();
          directory.items = (payload.data.list ?? []).flatMap((entry) => {
            const id = FavoriteFolderPreference.normalizeId(entry?.id);
            const title = AccountSourceAdapter.cleanText(entry?.title);
            if (!id || !title || seen.has(id)) return [];
            seen.add(id);
            // Note: Bilibili clears attr bit 1 for its default folder, independently of title or order.
            return [{ id, title, count: AccountSourceAdapter.nonNegativeInteger(entry.media_count),
              isDefault: Number.isInteger(entry.attr) && entry.attr >= 0 &&
                !(entry.attr & FAVORITE_CUSTOM_FOLDER_FLAG) }];
          });
          for (const [id, record] of this.favoriteRecords) {
            if (seen.has(id)) continue;
            record.controller?.abort();
            this.favoriteRecords.delete(id);
          }
          const remembered = directory.requestedFolderId || this.records.get(SourceKind.FAVORITES).folderId ||
            FavoriteFolderPreference.read(accountId);
          const selected = directory.items.find((folder) => folder.id === remembered) ??
            directory.items.find((folder) => folder.isDefault);
          directory.requestedFolderId = null;
          directory.loaded = true;
          directory.status = AccountSourceStatus.READY;
          if (selected) {
            await this.selectFavoriteFolder(selected.id);
          } else {
            this.records.set(SourceKind.FAVORITES, AccountSourceStore.createRecord(SourceKind.FAVORITES));
            FavoriteFolderPreference.write(accountId, null);
          }
        } catch (_error) {
          if (current()) directory.status = AccountSourceStatus.ERROR;
        } finally {
          if (current()) {
            directory.controller = null;
            directory.promise = null;
            this.onChange();
          }
        }
      })();
      return directory.promise;
    }

    /** Selects a validated folder and reuses its retained cards and continuation. */
    async selectFavoriteFolder(folderId) {
      if (!this.enabledKinds.has(SourceKind.FAVORITES) ||
          !this.favoriteFolders.items.some((folder) => folder.id === folderId)) return;
      let record = this.favoriteRecords.get(folderId);
      if (!record) {
        record = AccountSourceStore.createRecord(SourceKind.FAVORITES, folderId);
        this.favoriteRecords.set(folderId, record);
      }
      this.favoriteFolders.requestedFolderId = null;
      this.records.set(SourceKind.FAVORITES, record);
      FavoriteFolderPreference.write(this.favoriteFolders.accountId, folderId);
      this.onChange();
      if (!record.loaded && !record.controller) await this.refreshSource(SourceKind.FAVORITES);
    }

    /** Validates a navigation or refresh hint before fetching the requested folder. */
    restoreFavoriteFolder(folderId) {
      const id = FavoriteFolderPreference.normalizeId(folderId);
      if (id && this.records.get(SourceKind.FAVORITES).folderId !== id) {
        this.favoriteFolders.requestedFolderId = id;
        void this.loadFavoriteFolders(true);
      }
    }

    /**
     * Returns whether retained items or an account continuation remain.
     *
     * @param {AccountSourceRecord} record
     * @returns {boolean}
     */
    static hasMore(record) {
      return record.items.length > record.visibleCount || Boolean(record.cursor);
    }

    /**
     * Builds the next history request from Bilibili's continuation fields.
     *
     * @param {HistoryCursor} cursor
     * @returns {string}
     */
    static historyUrlFor(cursor) {
      const url = new URL(HISTORY_SOURCE_URL);
      url.searchParams.set("max", String(cursor.max));
      url.searchParams.set("view_at", String(cursor.viewAt));
      url.searchParams.set("business", cursor.business);
      return url.href;
    }

    /**
     * Returns the archive identity accepted by Bilibili's to-view add endpoint.
     *
     * @param {string} targetUrl
     * @returns {ArchiveVideoIdentity | null}
     */
    static watchLaterAddIdentityForUrl(targetUrl) {
      const identity = SourceAdapter.archiveIdentityForUrl(targetUrl);

      if (identity?.queryName === "aid" || identity?.queryName === "bvid") {
        return identity;
      }

      return null;
    }

    /**
     * Fetches and normalizes one account-backed source.
     *
     * @param {string} kind
     * @param {string} url
     * @param {AbortSignal} signal
     * @param {string} language
     * @returns {Promise<AccountSourceFetchRecord>}
     */
    static async fetchSourceRecord(kind, url, signal, language) {
      const payload = await AccountSourceStore.fetchApiPayload(url, signal);

      if (!AccountSourceStore.isSuccessfulPayload(payload)) {
        throw Object.assign(new Error("Account source request failed"), { code: payload?.code });
      }

      if (kind === SourceKind.FAVORITES &&
          !Array.isArray(payload.data?.medias) && payload.data?.medias !== null) {
        throw new Error("Favorite media list unavailable");
      }

      return {
        kind,
        source: AccountSourceAdapter.sourceFromPayload(kind, payload, language),
        cursor: kind === SourceKind.HISTORY
          ? AccountSourceAdapter.historyCursorFromPayload(payload)
          : kind === SourceKind.FAVORITES && payload.data?.has_more &&
              AccountSourceAdapter.entriesFromPayload(payload).length
            ? Number(new URL(url).searchParams.get("pn")) + 1 : null,
        watchLaterCount: kind === SourceKind.WATCH_LATER
          ? AccountSourceAdapter.watchLaterCountFromPayload(payload)
          : null
      };
    }

    /**
     * Adds one archive to the current account's watch-later list.
     *
     * Note: Bilibili's to-view add endpoint accepts a BV id or archive id plus
     * the current account CSRF token. Bangumi routes are not archive targets.
     *
     * @param {ArchiveVideoIdentity} identity
     * @returns {Promise<void>}
     */
    static async addWatchLaterApiItem(identity) {
      const body = AccountSourceStore.watchLaterApiBody();
      body.set(identity.queryName, identity.queryValue);

      const payload = await AccountSourceStore.postApiPayload(
        WATCH_LATER_ADD_URL,
        body
      );

      if (!AccountSourceStore.isSuccessfulPayload(payload)) {
        throw new Error("Watch-later addition failed");
      }
    }

    /**
     * Deletes one archive from the current account's watch-later list.
     *
     * Note: Bilibili's to-view deletion endpoint takes an archive id and the
     * current account CSRF token instead of a card URL.
     *
     * @param {string} aid
     * @returns {Promise<void>}
     */
    static async deleteWatchLaterApiItem(aid) {
      const body = AccountSourceStore.watchLaterApiBody();
      body.set("aid", aid);

      const payload = await AccountSourceStore.postApiPayload(
        WATCH_LATER_DELETE_URL,
        body
      );

      if (!AccountSourceStore.isSuccessfulPayload(payload)) {
        throw new Error("Watch-later deletion failed");
      }
    }

    /**
     * Builds a form body containing the account CSRF token.
     *
     * @returns {URLSearchParams}
     */
    static watchLaterApiBody() {
      const csrfToken = AccountSourceStore.csrfToken();

      if (!csrfToken) {
        throw new Error("Missing Bilibili CSRF token");
      }

      const body = new URLSearchParams();
      body.set("csrf", csrfToken);
      return body;
    }

    /**
     * Fetches a Bilibili JSON payload with the current account cookies.
     *
     * Note: Bilibili account endpoints require the page's login cookies and may
     * return an application-level error when the visitor is signed out.
     *
     * @param {string} url
     * @param {AbortSignal} signal
     * @returns {Promise<object>}
     */
    static async fetchApiPayload(url, signal) {
      return AccountSourceStore.requestApiPayload(url, { signal });
    }

    /**
     * Posts a Bilibili form request with the current account cookies.
     *
     * @param {string} url
     * @param {URLSearchParams} body
     * @returns {Promise<object>}
     */
    static async postApiPayload(url, body) {
      return AccountSourceStore.requestApiPayload(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
        },
        body
      });
    }

    /**
     * Requests and parses one Bilibili JSON payload.
     *
     * @param {string} url
     * @param {RequestInit} [options]
     * @returns {Promise<object>}
     */
    static async requestApiPayload(url, options = {}) {
      const response = await fetch(url, {
        ...options,
        credentials: "include",
        headers: {
          Accept: "application/json, text/plain, */*",
          ...(options.headers ?? {})
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return AccountSourceStore.parseApiPayload(await response.text());
    }

    /**
     * Reads Bilibili's CSRF token from document cookies.
     *
     * @returns {string | null}
     */
    static csrfToken() {
      const cookies = document.cookie.split(";");

      for (const cookie of cookies) {
        const [rawName, ...rawValueParts] = cookie.split("=");
        const name = rawName.trim();

        if (name !== BILIBILI_CSRF_COOKIE_NAME) {
          continue;
        }

        const value = rawValueParts.join("=").trim();

        return value ? decodeURIComponent(value) : null;
      }

      return null;
    }

    /**
     * Normalizes an archive id used by the watch-later API.
     *
     * @param {unknown} aid
     * @returns {string | null}
     */
    static normalizeAid(aid) {
      const text = typeof aid === "string" ? aid.trim() : "";

      return /^\d+$/u.test(text) ? text : null;
    }

    /**
     * Parses one JSON API response.
     *
     * @param {string} text
     * @returns {object}
     */
    static parseApiPayload(text) {
      return JSON.parse(text);
    }

    /**
     * Returns true when a Bilibili API payload is successful.
     *
     * @param {object} payload
     * @returns {boolean}
     */
    static isSuccessfulPayload(payload) {
      return payload?.code === 0;
    }
  }

  /**
   * Fetches missing previews for the rail window and caches page-session results.
   */
  class VideoPreviewStore {
    /**
     * Creates a preview store.
     *
     * @param {() => void} onChange
     */
    constructor(onChange) {
      this.onChange = onChange;
      this.enabled = true;
      /** @type {Map<string, VideoPreviewRecord>} */
      this.records = new Map();
      this.queue = [];
      this.controllers = new Map();
    }

    /**
     * Replaces preview demand with visible cards followed by nearby cards.
     *
     * Off-window requests are canceled; completed results remain cached.
     *
     * @param {VideoItem[]} items
     */
    setDemand(items) {
      const wanted = new Map();
      for (const item of this.enabled ? items : []) {
        const identity = this.previewIdentityForItem(item);
        if (identity) {
          wanted.set(identity.key, identity);
        }
      }

      for (const identity of this.queue) {
        this.records.delete(identity.key);
      }
      this.queue = [];

      for (const [key, controller] of this.controllers) {
        if (!wanted.has(key)) {
          this.controllers.delete(key);
          if (this.records.get(key)?.state === "loading") {
            this.records.delete(key);
          }
          controller.abort();
        }
      }

      for (const identity of wanted.values()) {
        if (!this.records.has(identity.key)) {
          this.records.set(identity.key, { state: "queued", identity });
          this.queue.push(identity);
        }
      }
      this.pump();
    }

    /**
     * Applies a cached thumbnail without starting a request.
     *
     * @param {VideoItem} item
     * @returns {VideoItem}
     */
    hydrateItem(item) {
      if (!this.enabled) return item;
      if (SourceAdapter.usableThumbnailUrl(item.thumbnailUrl)) {
        return item;
      }

      const identity = this.previewIdentityForItem(item);
      if (!identity) {
        return item;
      }

      const record = this.records.get(identity.key);
      if (record?.state === "available" && record.thumbnailUrl) {
        return {
          ...item,
          thumbnailUrl: record.thumbnailUrl
        };
      }

      return item;
    }

    /** Cancels pending enrichment when disabled; native thumbnails remain intact. */
    setEnabled(enabled) {
      this.enabled = enabled;
      if (!enabled) this.setDemand([]);
    }

    /**
     * Returns the archive identity needed for one missing preview request.
     *
     * @param {VideoItem} item
     * @returns {ArchiveVideoIdentity | null}
     */
    previewIdentityForItem(item) {
      return SourceAdapter.usableThumbnailUrl(item.thumbnailUrl)
        ? null
        : SourceAdapter.archiveIdentityForUrl(item.targetUrl);
    }

    /**
     * Starts queued preview requests up to the concurrency limit.
     */
    pump() {
      while (
        this.controllers.size < MAX_CONCURRENT_VIDEO_PREVIEW_FETCHES &&
        this.queue.length > 0
      ) {
        const identity = this.queue.shift();
        const record = this.records.get(identity.key);

        if (record?.state !== "queued") {
          continue;
        }

        this.startFetch(identity);
      }
    }

    /**
     * Starts one preview fetch and records its advisory result.
     *
     * @param {ArchiveVideoIdentity} identity
     */
    startFetch(identity) {
      const controller = new AbortController();

      this.controllers.set(identity.key, controller);
      this.records.set(identity.key, {
        state: "loading",
        identity
      });

      VideoPreviewStore.fetchPreview(identity, controller.signal)
        .then((thumbnailUrl) => {
          if (this.controllers.get(identity.key) !== controller) {
            return;
          }

          if (thumbnailUrl) {
            this.records.set(identity.key, {
              state: "available",
              thumbnailUrl
            });
            this.onChange();
            return;
          }

          this.records.set(identity.key, { state: "unavailable" });
        })
        .catch(() => {
          if (this.controllers.get(identity.key) !== controller) {
            return;
          }

          this.records.set(identity.key, { state: "unavailable" });
        })
        .finally(() => {
          if (this.controllers.get(identity.key) !== controller) {
            return;
          }

          this.controllers.delete(identity.key);
          this.pump();
        });
    }

    /**
     * Cancels pending preview requests and clears the page-session cache.
     */
    stop() {
      this.setDemand([]);
      this.records.clear();
    }

    /**
     * Fetches one archive cover from Bilibili video metadata.
     *
     * Note: Bilibili can return application-level errors for private, deleted,
     * or unavailable videos. Those videos keep the title placeholder.
     *
     * @param {ArchiveVideoIdentity} identity
     * @param {AbortSignal} signal
     * @returns {Promise<string | null>}
     */
    static async fetchPreview(identity, signal) {
      const payload = await AccountSourceStore.fetchApiPayload(
        VideoPreviewStore.sourceUrl(identity),
        signal
      );

      if (!AccountSourceStore.isSuccessfulPayload(payload)) {
        return null;
      }

      return SourceAdapter.usableThumbnailUrl(payload?.data?.pic);
    }

    /**
     * Builds a Bilibili video-info URL for one archive identity.
     *
     * @param {ArchiveVideoIdentity} identity
     * @returns {string}
     */
    static sourceUrl(identity) {
      const url = new URL(VIDEO_INFO_SOURCE_URL);
      url.searchParams.set(identity.queryName, identity.queryValue);

      return url.href;
    }
  }

  /**
   * Merges page-owned sources with account-backed sources by closed source kind.
   */
  class SourceMerger {
    /**
     * Combines source lists and returns them in canonical source order.
     *
     * @param {VideoListSource[]} pageSources
     * @param {VideoListSource[]} accountSources
     * @returns {VideoListSource[]}
     */
    static merge(pageSources, accountSources) {
      const byKind = new Map();

      for (const source of [...pageSources, ...accountSources]) {
        byKind.set(source.kind, source);
      }

      return SOURCE_ORDER
        .map((kind) => byKind.get(kind))
        .filter(Boolean);
    }
  }

  /**
   * Discovers page-owned player, comment, and source regions for one watch page.
   */
  class RegionDiscovery {
    /**
     * Creates a discovery pass over a document.
     *
     * @param {Document} document
     */
    constructor(document) {
      this.document = document;
    }

    /**
     * Discovers the current watch page regions.
     *
     * @returns {DiscoveredRegions}
     */
    discover() {
      const comments = this.findCommentRegion();
      const hasUsableComments = this.hasUsableCommentContent(comments);

      return {
        player: this.findPlayerRegion(),
        title: this.findWatchTitle(),
        description: this.findVideoDescription(),
        tags: this.findVideoTags(),
        uploader: this.findUploaderInfo(),
        publishedAt: this.findPublishDate(),
        actions: this.findActions(),
        accountControl: this.findAccountControl(),
        comments: hasUsableComments ? comments : null,
        commentState: hasUsableComments
          ? CommentPaneState.LOADED
          : CommentPaneState.RETRY,
        sources: this.findSources()
      };
    }

    /**
     * Finds the Bilibili player region.
     *
     * @returns {Element | null}
     */
    findPlayerRegion() {
      const candidates = this.candidatesForSelectors(PLAYER_SELECTORS, true);

      for (const candidate of candidates) {
        const region = DomProbe.closestBySelectors(candidate, PLAYER_SELECTORS);

        if (this.isPlayerRegion(region)) {
          return region;
        }
      }

      return null;
    }

    /**
     * Finds the current watch title for extension-owned player chrome.
     *
     * @returns {string | null}
     */
    findWatchTitle() {
      for (const selector of WATCH_TITLE_SELECTORS) {
        for (const element of DomProbe.queryAll(this.document, selector)) {
          if (DomProbe.isOwned(element)) {
            continue;
          }

          const title = this.watchTitleFor(element);

          if (title) {
            return title;
          }
        }
      }

      const metaTitle = this.document.querySelector(
        "meta[property='og:title'], meta[name='title']"
      );

      if (metaTitle instanceof HTMLMetaElement) {
        return RegionDiscovery.cleanWatchTitle(metaTitle.content);
      }

      return RegionDiscovery.cleanWatchTitle(this.document.title);
    }

    /**
     * Extracts title text from one candidate title element.
     *
     * @param {Element} element
     * @returns {string | null}
     */
    watchTitleFor(element) {
      return RegionDiscovery.cleanWatchTitle(
        element.getAttribute("title") ||
          element.getAttribute("aria-label") ||
          DomProbe.compactText(element)
      );
    }

    /**
     * Normalizes watch title text from DOM and metadata sources.
     *
     * @param {string | null | undefined} value
     * @returns {string | null}
     */
    static cleanWatchTitle(value) {
      const title = (value ?? "")
        .replace(/\s+/g, " ")
        .replace(/\s*[-_]\s*哔哩哔哩.*$/u, "")
        .replace(/\s*[-_]\s*bilibili.*$/iu, "")
        .trim();

      return title || null;
    }

    /**
     * Finds the current video's page-owned description region.
     *
     * @returns {Element | null}
     */
    findVideoDescription() {
      for (const element of this.videoDescriptionCandidates()) {
        const description = RegionDiscovery.cleanVideoDescription(
          typeof element.innerText === "string"
            ? element.innerText
            : DomProbe.compactText(element)
        );

        if (description) {
          return element;
        }
      }

      return null;
    }

    /**
     * Returns likely current-video description elements.
     *
     * @returns {Element[]}
     */
    videoDescriptionCandidates() {
      const candidates = [];

      for (const selector of VIDEO_DESCRIPTION_SELECTORS) {
        candidates.push(...DomProbe.queryAll(this.document, selector));
      }

      return DomProbe.unique(candidates).filter(
        (element) =>
          !DomProbe.isOwned(element) &&
          !element.closest(UPLOADER_CONTEXT_SELECTOR) &&
          (element.closest(VIDEO_DESCRIPTION_ROOT_SELECTOR) ||
            !element.closest(SOURCE_BOUNDARY_SELECTOR))
      );
    }

    /**
     * Normalizes video description text from page-owned markup.
     *
     * @param {string | null | undefined} value
     * @returns {string | null}
     */
    static cleanVideoDescription(value) {
      const lines = (value ?? "")
        .replace(/\r\n?/g, "\n")
        .split("\n")
        .map((line) =>
          line
            .replace(/[ \t\f\v]+/g, " ")
            .replace(
              /\s*(?:展开更多|收起|show\s*more|show\s*less)\s*$/iu,
              ""
            )
            .trim()
        )
        .filter(
          (line) =>
            line && !VIDEO_DESCRIPTION_CONTROL_TEXT_PATTERN.test(line)
        );
      const description = lines
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

      return description
        ? description.slice(0, VIDEO_DESCRIPTION_MAX_LENGTH)
        : null;
    }

    /**
     * Finds the current video's page-owned tag links.
     *
     * @returns {VideoTag[]}
     */
    findVideoTags() {
      for (const element of this.videoTagsCandidates()) {
        const tags = this.videoTagsFor(element);

        if (tags.length) {
          return tags;
        }
      }

      return [];
    }

    /**
     * Extracts stable tag records from one page-owned tag container.
     *
     * @param {Element} element
     * @returns {VideoTag[]}
     */
    videoTagsFor(element) {
      const links = DomProbe.unique(
        DomProbe.queryAll(element, VIDEO_TAG_LINK_SELECTOR)
      );

      return this.dedupeVideoTags(
        links.map((link) => this.videoTagFor(link)).filter(Boolean)
      );
    }

    /**
     * Extracts one stable video tag record from a page-owned link.
     *
     * @param {Element} link
     * @returns {VideoTag | null}
     */
    videoTagFor(link) {
      const text = RegionDiscovery.cleanVideoTagText(
        link.getAttribute("title") ||
          link.getAttribute("aria-label") ||
          DomProbe.compactText(link)
      );
      const href = this.safeVideoTagUrl(link.getAttribute("href"));

      return text && href ? { text, href } : null;
    }

    /**
     * Returns likely current-video tag elements.
     *
     * @returns {Element[]}
     */
    videoTagsCandidates() {
      const candidates = [];

      for (const selector of VIDEO_TAGS_SELECTORS) {
        candidates.push(...DomProbe.queryAll(this.document, selector));
      }

      return DomProbe.unique(candidates).filter(
        (element) =>
          !DomProbe.isOwned(element) &&
          !element.closest(UPLOADER_CONTEXT_SELECTOR) &&
          Boolean(element.querySelector(VIDEO_TAG_LINK_SELECTOR)) &&
          (element.closest(VIDEO_TAGS_ROOT_SELECTOR) ||
            !element.closest(SOURCE_BOUNDARY_SELECTOR))
      );
    }

    /**
     * Converts native video-tag hrefs to safe absolute URLs.
     *
     * @param {string | null} value
     * @returns {string | null}
     */
    safeVideoTagUrl(value) {
      if (!value) {
        return null;
      }

      try {
        const url = new URL(
          value,
          this.document.location?.href ?? window.location.href
        );

        return /^https?:$/u.test(url.protocol) ? url.href : null;
      } catch {
        return null;
      }
    }

    /**
     * Normalizes a page-owned video tag label.
     *
     * @param {string | null | undefined} value
     * @returns {string | null}
     */
    static cleanVideoTagText(value) {
      const text = (value ?? "").replace(/\s+/g, " ").trim();

      return text && !VIDEO_DESCRIPTION_CONTROL_TEXT_PATTERN.test(text)
        ? text
        : null;
    }

    /**
     * Deduplicates video tags while preserving native order.
     *
     * @param {VideoTag[]} tags
     * @returns {VideoTag[]}
     */
    dedupeVideoTags(tags) {
      const seen = new Set();
      const deduped = [];

      for (const tag of tags) {
        const key = `${tag.text}\n${tag.href}`;

        if (seen.has(key)) {
          continue;
        }

        seen.add(key);
        deduped.push(tag);

        if (deduped.length >= VIDEO_TAG_MAX_COUNT) {
          break;
        }
      }

      return deduped;
    }

    /**
     * Finds the current video's uploader metadata for extension-owned chrome.
     *
     * @returns {UploaderInfo | null}
     */
    findUploaderInfo() {
      for (const root of this.uploaderCandidates()) {
        const info = this.uploaderInfoFor(root);

        if (info) {
          return info;
        }
      }

      return null;
    }

    /**
     * Finds the current video's publish date text.
     *
     * @returns {string | null}
     */
    findPublishDate() {
      for (const element of this.publishDateCandidates()) {
        const match = DomProbe.compactText(element).match(
          VIDEO_PUBLISH_DATE_TEXT_PATTERN
        );

        if (match) {
          return match[0];
        }
      }

      return null;
    }

    /**
     * Returns likely current-video publish-date elements.
     *
     * @returns {Element[]}
     */
    publishDateCandidates() {
      const candidates = [];

      for (const selector of VIDEO_PUBLISH_DATE_SELECTORS) {
        candidates.push(...DomProbe.queryAll(this.document, selector));
      }

      return DomProbe.unique(candidates).filter(
        (element) =>
          !DomProbe.isOwned(element) &&
          !element.closest(UPLOADER_CONTEXT_SELECTOR) &&
          (element.closest(VIDEO_PUBLISH_DATE_ROOT_SELECTOR) ||
            !element.closest(SOURCE_BOUNDARY_SELECTOR))
      );
    }

    /**
     * Returns likely current-video uploader roots.
     *
     * Named uploader-panel roots lead and are trusted wherever Bilibili
     * renders them. Broad class-name probes and profile links follow and stay
     * bounded by source-root exclusion.
     *
     * @returns {Element[]}
     */
    uploaderCandidates() {
      const trusted = DomProbe.queryAll(
        this.document,
        UPLOADER_CONTEXT_ROOT_SELECTOR
      );
      const bounded = DomProbe.unique([
        ...DomProbe.queryAll(this.document, UPLOADER_CONTEXT_FALLBACK_SELECTOR),
        ...this.uploaderProfileLinkCandidates()
      ]).filter((element) => !element.closest(SOURCE_BOUNDARY_SELECTOR));

      return [...trusted, ...bounded].filter(
        (element) =>
          !DomProbe.isOwned(element) && !element.closest(HEADER_SURFACE_SELECTOR)
      );
    }

    /**
     * Returns uploader roots derived from bare space-home profile links.
     *
     * @returns {Element[]}
     */
    uploaderProfileLinkCandidates() {
      const candidates = [];

      for (const link of DomProbe.queryAll(
        this.document,
        UPLOADER_PROFILE_LINK_SELECTOR
      )) {
        if (
          DomProbe.isOwned(link) ||
          link.closest(HEADER_SURFACE_SELECTOR) ||
          !RegionDiscovery.isUploaderSpaceHomeUrl(link.getAttribute("href"))
        ) {
          continue;
        }

        candidates.push(
          link.closest(UPLOADER_CONTEXT_SELECTOR) ?? link.parentElement ?? link
        );
      }

      return candidates;
    }

    /**
     * Reads one uploader candidate into a stable summary record.
     *
     * @param {Element} root
     * @returns {UploaderInfo | null}
     */
    uploaderInfoFor(root) {
      const name = this.uploaderNameFor(root);

      if (!name) {
        return null;
      }

      return {
        name,
        profileUrl: this.uploaderProfileUrlFor(root),
        avatarUrl: this.uploaderAvatarUrlFor(root),
        metaText: this.uploaderMetaTextFor(root, name)
      };
    }

    /**
     * Reads the uploader display name from a candidate root.
     *
     * @param {Element} root
     * @returns {string | null}
     */
    uploaderNameFor(root) {
      for (const element of RegionDiscovery.elementsMatchingOrInside(
        root,
        UPLOADER_NAME_SELECTORS
      )) {
        const name = RegionDiscovery.cleanUploaderName(
          element.getAttribute("title") ||
            element.getAttribute("aria-label") ||
            DomProbe.compactText(element)
        );

        if (name) {
          return name;
        }
      }

      return null;
    }

    /**
     * Reads the uploader profile URL from a candidate root.
     *
     * @param {Element} root
     * @returns {string | null}
     */
    uploaderProfileUrlFor(root) {
      for (const element of RegionDiscovery.elementsMatchingOrInside(root, [
        UPLOADER_PROFILE_LINK_SELECTOR
      ])) {
        const profileUrl = RegionDiscovery.safeUploaderProfileUrl(
          element.getAttribute("href")
        );

        if (profileUrl) {
          return profileUrl;
        }
      }

      return null;
    }

    /**
     * Reads the uploader avatar URL from a candidate root.
     *
     * @param {Element} root
     * @returns {string | null}
     */
    uploaderAvatarUrlFor(root) {
      for (const element of RegionDiscovery.elementsMatchingOrInside(
        root,
        UPLOADER_AVATAR_SELECTORS
      )) {
        for (const value of SourceAdapter.thumbnailAttributeValues(element)) {
          const avatarUrl = SourceAdapter.secureAssetUrl(value);

          if (avatarUrl) {
            return avatarUrl;
          }
        }
      }

      return null;
    }

    /**
     * Reads secondary uploader metadata such as sign text or follower count.
     *
     * @param {Element} root
     * @param {string} name
     * @returns {string | null}
     */
    uploaderMetaTextFor(root, name) {
      for (const element of RegionDiscovery.elementsMatchingOrInside(
        root,
        UPLOADER_META_SELECTORS
      )) {
        const metaText = RegionDiscovery.cleanUploaderMetaText(
          DomProbe.compactText(element),
          name
        );

        if (metaText) {
          return metaText;
        }
      }

      return null;
    }

    /**
     * Returns candidate descendants while including a matching root element.
     *
     * @param {Element} root
     * @param {string[]} selectors
     * @returns {Element[]}
     */
    static elementsMatchingOrInside(root, selectors) {
      const elements = [];

      for (const selector of selectors) {
        if (root.matches(selector)) {
          elements.push(root);
        }

        elements.push(...DomProbe.queryAll(root, selector));
      }

      return DomProbe.unique(elements);
    }

    /**
     * Normalizes uploader names and rejects native action labels.
     *
     * @param {string | null | undefined} value
     * @returns {string | null}
     */
    static cleanUploaderName(value) {
      const name = (value ?? "").replace(/\s+/g, " ").trim();

      if (!name || RegionDiscovery.isUploaderControlText(name)) {
        return null;
      }

      return name;
    }

    /**
     * Normalizes secondary uploader metadata.
     *
     * @param {string | null | undefined} value
     * @param {string} name
     * @returns {string | null}
     */
    static cleanUploaderMetaText(value, name) {
      const text = (value ?? "").replace(/\s+/g, " ").trim();

      if (
        !text ||
        text === name ||
        RegionDiscovery.isUploaderControlText(text)
      ) {
        return null;
      }

      return text.slice(0, UPLOADER_META_TEXT_LIMIT);
    }

    /**
     * Tests whether text belongs to native uploader controls.
     *
     * @param {string} value
     * @returns {boolean}
     */
    static isUploaderControlText(value) {
      return /^(?:\+?\s*(?:关注|已关注|关注中|发消息|私信|充电|follow(?:ing)?|message))$/iu.test(
        value
      );
    }

    /**
     * Tests whether a URL addresses a Bilibili user space home page.
     *
     * Note: Bilibili account pages such as the favorites list reuse the space
     * host with a subpath, so the bare numeric space root is the URL shape
     * shared by uploader profile links across watch-page generations.
     *
     * @param {string | null | undefined} value
     * @returns {boolean}
     */
    static isUploaderSpaceHomeUrl(value) {
      if (!value) {
        return false;
      }

      try {
        const url = new URL(value, window.location.href);

        return (
          url.hostname === "space.bilibili.com" &&
          UPLOADER_PROFILE_HOME_PATH_PATTERN.test(url.pathname)
        );
      } catch (_error) {
        return false;
      }
    }

    /**
     * Normalizes profile links for Bilibili uploader pages.
     *
     * @param {string | null | undefined} value
     * @returns {string | null}
     */
    static safeUploaderProfileUrl(value) {
      if (!value) {
        return null;
      }

      try {
        const url = new URL(value, window.location.href);

        if (!["http:", "https:"].includes(url.protocol)) {
          return null;
        }

        if (!["space.bilibili.com", "www.bilibili.com"].includes(url.hostname)) {
          return null;
        }

        if (url.protocol === "http:") {
          url.protocol = "https:";
        }

        return url.href;
      } catch (_error) {
        return null;
      }
    }

    /**
     * Finds page-owned watch actions that the bottom dock can mirror.
     *
     * @returns {WatchAction[]}
     */
    findActions() {
      const actions = [];
      const usedTriggers = new Set();

      for (const definition of WATCH_ACTION_DEFINITIONS) {
        const action = this.findAction(definition, usedTriggers);

        if (action) {
          actions.push(action);
        }
      }

      return actions;
    }

    /**
     * Finds one native action trigger for a watch action definition.
     *
     * @param {WatchActionDefinition} definition
     * @param {Set<Element>} usedTriggers
     * @returns {WatchAction | null}
     */
    findAction(definition, usedTriggers) {
      for (const candidate of this.actionCandidates(definition)) {
        const trigger = this.actionTriggerFor(candidate);

        if (
          usedTriggers.has(trigger) ||
          !this.isWatchActionTrigger(trigger, definition)
        ) {
          continue;
        }

        usedTriggers.add(trigger);
        return {
          kind: definition.kind,
          trigger,
          visualSource: this.watchActionVisualSource(trigger),
          countSelectors: definition.countSelectors,
          countText: this.watchActionCountText(trigger, definition),
          labelPattern: definition.labelPattern,
          isActive: this.isWatchActionActive(trigger, definition)
        };
      }

      return null;
    }

    /**
     * Returns true when an element exposes cloneable icon-like visual content.
     *
     * @param {Element} element
     * @returns {boolean}
     */
    static hasIconVisual(element) {
      return (
        element.matches("svg, path, use, img, picture, canvas") ||
        Boolean(element.querySelector("svg, path, use, img, picture, canvas"))
      );
    }

    /**
     * Returns the native visual source for an action trigger.
     *
     * @param {Element} trigger
     * @returns {Element | null}
     */
    watchActionVisualSource(trigger) {
      return trigger;
    }

    /**
     * Returns action candidates from watch toolbars first, then page fallbacks.
     *
     * @param {WatchActionDefinition} definition
     * @returns {Element[]}
     */
    actionCandidates(definition) {
      const candidates = [];
      const roots = this.watchActionRoots();

      for (const root of roots) {
        for (const selector of definition.selectors) {
          candidates.push(...DomProbe.queryAll(root, selector));
        }
      }

      for (const selector of definition.selectors) {
        candidates.push(...DomProbe.queryAll(this.document, selector));
      }

      return DomProbe.unique(
        candidates.filter((element) => !DomProbe.isOwned(element))
      );
    }

    /**
     * Returns likely page-owned watch toolbar containers.
     *
     * @returns {Element[]}
     */
    watchActionRoots() {
      return DomProbe.unique(
        DomProbe.queryAll(this.document, WATCH_ACTION_CONTEXT_SELECTOR).filter(
          (element) => !DomProbe.isOwned(element)
        )
      );
    }

    /**
     * Chooses the clickable native element for an action candidate.
     *
     * @param {Element} element
     * @returns {Element}
     */
    actionTriggerFor(element) {
      return DomProbe.closestBySelectors(element, [
        WATCH_ACTION_TRIGGER_SELECTOR
      ]);
    }

    /**
     * Tests whether a candidate belongs to the native watch action toolbar.
     *
     * @param {Element} trigger
     * @param {WatchActionDefinition} definition
     * @returns {boolean}
     */
    isWatchActionTrigger(trigger, definition) {
      if (!trigger.isConnected || DomProbe.isOwned(trigger)) {
        return false;
      }

      if (trigger === this.document.body || trigger === this.document.documentElement) {
        return false;
      }

      if (trigger.closest(WATCH_ACTION_CONTEXT_SELECTOR)) {
        return true;
      }

      return definition.selectors.some(
        (selector) =>
          /(?:video-|\.ops)/u.test(selector) && trigger.matches(selector)
      );
    }

    /**
     * Reads the native count text for one action without reformatting it.
     *
     * @param {Element} trigger
     * @param {WatchActionDefinition} definition
     * @returns {string | null}
     */
    watchActionCountText(trigger, definition) {
      const values = [];

      for (const selector of definition.countSelectors) {
        for (const element of DomProbe.queryAll(trigger, selector)) {
          values.push(DomProbe.compactText(element));
        }
      }

      values.push(
        DomProbe.compactText(trigger),
        trigger.getAttribute("title") ?? "",
        trigger.getAttribute("aria-label") ?? ""
      );

      for (const value of values) {
        const countText = RegionDiscovery.cleanWatchActionCountText(
          value,
          definition
        );

        if (countText) {
          return countText;
        }
      }

      return null;
    }

    /**
     * Removes action labels from a native count fragment.
     *
     * @param {string | null | undefined} value
     * @param {WatchActionDefinition} definition
     * @returns {string | null}
     */
    static cleanWatchActionCountText(value, definition) {
      const text = (value ?? "").replace(/\s+/g, " ").trim();

      if (!text) {
        return null;
      }

      const labelPattern = new RegExp(definition.labelPattern.source, "giu");
      const countText = text
        .replace(labelPattern, " ")
        .replace(/[()（）:：]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();

      if (!/[\d０-９]/u.test(countText)) {
        return null;
      }

      return countText.slice(0, WATCH_ACTION_COUNT_TEXT_LIMIT);
    }

    /**
     * Returns true when the native action exposes an active state.
     *
     * @param {Element} trigger
     * @param {WatchActionDefinition} definition
     * @returns {boolean}
     */
    isWatchActionActive(trigger, definition) {
      if (
        trigger.matches(WATCH_ACTION_ACTIVE_SELECTOR) ||
        Boolean(trigger.querySelector(WATCH_ACTION_ACTIVE_SELECTOR))
      ) {
        return true;
      }

      const stateText = [
        trigger.getAttribute("class"),
        trigger.getAttribute("title"),
        trigger.getAttribute("aria-label"),
        trigger.getAttribute("data-state"),
        trigger.getAttribute("data-status")
      ]
        .filter(Boolean)
        .join(" ");

      return definition.activePattern.test(stateText);
    }

    /**
     * Finds the native account control used by Bilibili's page header.
     *
     * @returns {AccountControl | null}
     */
    findAccountControl() {
      for (const candidate of this.accountControlCandidates()) {
        if (candidate.isConnected && DomProbe.hasBox(candidate)) {
          return { trigger: candidate };
        }
      }

      return null;
    }

    /**
     * Returns account-control candidates from native header regions.
     *
     * @returns {Element[]}
     */
    accountControlCandidates() {
      return DomProbe.unique(
        ACCOUNT_CONTROL_SELECTORS.flatMap((selector) =>
          DomProbe.queryAll(this.document, selector)
        )
      ).filter((element) => !DomProbe.isOwned(element));
    }

    /**
     * Finds the page-owned comment region when one is present.
     *
     * @returns {Element | null}
     */
    findCommentRegion() {
      const outsideCandidates = this.candidatesForSelectors(COMMENT_SELECTORS, false);
      const insideCandidates = this.candidatesForSelectors(COMMENT_SELECTORS, true);

      for (const candidate of [...outsideCandidates, ...insideCandidates]) {
        const region = DomProbe.closestBySelectors(candidate, COMMENT_SELECTORS);

        if (this.isCommentRegion(region)) {
          return region;
        }
      }

      return null;
    }

    /**
     * Tests whether a discovered comment root has page-owned usable content.
     *
     * Note: Bilibili may create an empty comment shell before it inserts
     * controls, an empty-state message, or comment rows.
     *
     * @param {Element | null} comments
     * @returns {boolean}
     */
    hasUsableCommentContent(comments) {
      if (!comments?.isConnected) {
        return false;
      }

      if (comments.querySelector(COMMENT_USABLE_CONTENT_SELECTOR)) {
        return true;
      }

      if (this.hasRenderedCommentSurface(comments)) {
        return true;
      }

      const text = DomProbe.compactText(comments);

      return (
        COMMENT_USABLE_TEXT_PATTERN.test(text) ||
        text.length >= COMMENT_MIN_USABLE_TEXT_LENGTH
      );
    }

    /**
     * Tests whether Bilibili has laid out a native comment surface.
     *
     * Note: Current Bilibili comment hosts can render visible comment UI while
     * exposing little or no text to ordinary content-script DOM queries.
     *
     * @param {Element} comments
     * @returns {boolean}
     */
    hasRenderedCommentSurface(comments) {
      const surfaces = [
        comments,
        ...DomProbe.queryAll(comments, COMMENT_RENDERED_SURFACE_SELECTOR)
      ];

      return surfaces.some((surface) => {
        if (!surface.matches(COMMENT_RENDERED_SURFACE_SELECTOR)) {
          return false;
        }

        const rect = surface.getBoundingClientRect();

        return (
          rect.width > 0 &&
          rect.height >= COMMENT_MIN_RENDERED_SURFACE_HEIGHT
        );
      });
    }

    /**
     * Finds valid source roots and extracts their video items.
     *
     * @returns {VideoListSource[]}
     */
    findSources() {
      const candidates = [];

      for (const definition of SOURCE_DEFINITIONS) {
        for (const root of this.sourceRootsFor(definition)) {
          const adapter = new SourceAdapter(definition.kind, root);
          const items = adapter.extractItems();

          if (
            items.length <
            RegionDiscovery.minimumSourceItemCount(definition.kind)
          ) {
            continue;
          }

          candidates.push({
            kind: definition.kind,
            root,
            items,
            score: this.scoreSourceRoot(root, definition, items.length)
          });
        }
      }

      return this.chooseSources(candidates);
    }

    /**
     * Returns the item count required for a source to provide navigation value.
     *
     * @param {string} kind
     * @returns {number}
     */
    static minimumSourceItemCount(kind) {
      return kind === SourceKind.PARTS || kind === SourceKind.COLLECTION ? 2 : 1;
    }

    /**
     * Finds candidates for selectors, optionally including extension-contained
     * page nodes that were moved during an earlier reconciliation.
     *
     * @param {string[]} selectors
     * @param {boolean} includeOwned
     * @returns {Element[]}
     */
    candidatesForSelectors(selectors, includeOwned) {
      const candidates = [];

      for (const selector of selectors) {
        for (const element of DomProbe.queryAll(this.document, selector)) {
          if (!includeOwned && DomProbe.isOwned(element)) {
            continue;
          }

          candidates.push(element);
        }
      }

      return DomProbe.unique(candidates);
    }

    /**
     * Tests whether a candidate behaves like the playback region.
     *
     * @param {Element} element
     * @returns {boolean}
     */
    isPlayerRegion(element) {
      if (!element.isConnected) {
        return false;
      }

      return (
        element.id === "bilibili-player" ||
        element.id === "playerWrap" ||
        Boolean(element.querySelector("video, canvas, iframe, .bpx-player-video-wrap")) ||
        DomProbe.hasBox(element)
      );
    }

    /**
     * Tests whether a candidate behaves like the comment tree.
     *
     * @param {Element} element
     * @returns {boolean}
     */
    isCommentRegion(element) {
      if (!element.isConnected || element === this.document.body) {
        return false;
      }

      if (
        element.matches(
          "#comment, #commentapp, #bili-comments, bili-comments, .bili-comment, .comment-container, .reply-warp, .reply-box, .comment-m"
        )
      ) {
        return true;
      }

      return Boolean(
        element.matches(".comment") &&
          element.querySelector(
            "#bili-comments, bili-comments, textarea, [contenteditable='true'], [class*='reply'], [class*='comment']"
          )
      );
    }

    /**
     * Finds plausible roots for one source definition.
     *
     * @param {SourceDefinition} definition
     * @returns {Element[]}
     */
    sourceRootsFor(definition) {
      const roots = [];

      for (const selector of definition.selectors) {
        for (const element of DomProbe.queryAll(this.document, selector)) {
          const root = this.sourceRootForElement(element);

          if (root && this.isValidSourceRoot(root)) {
            roots.push(root);
          }
        }
      }

      for (const root of this.headingMatchedSourceRoots(definition)) {
        if (this.isValidSourceRoot(root)) {
          roots.push(root);
        }
      }

      return DomProbe.unique(roots);
    }

    /**
     * Chooses a bounded source root near a matching element.
     *
     * @param {Element} element
     * @returns {Element | null}
     */
    sourceRootForElement(element) {
      if (DomProbe.isOwned(element)) {
        return null;
      }

      let current = element;
      let best =
        SourceAdapter.videoTargetsIn(current).length > 0 ? current : null;

      if (best && this.isSourceBoundary(best)) {
        return best;
      }

      while (current.parentElement && current.parentElement !== this.document.body) {
        const parent = current.parentElement;

        if (DomProbe.isOwned(parent)) {
          break;
        }

        const currentCount = best ? SourceAdapter.videoTargetsIn(best).length : 0;
        const parentCount = SourceAdapter.videoTargetsIn(parent).length;

        const upperBound =
          currentCount <= 2 ? 120 : Math.max(currentCount + 20, currentCount * 3);

        if (this.isSidebarBoundary(parent) && currentCount >= 2) {
          break;
        }

        if (parentCount >= 2 && parentCount <= upperBound) {
          best = parent;

          if (this.isSourceBoundary(best)) {
            break;
          }

          current = parent;
          continue;
        }

        break;
      }

      return best;
    }

    /**
     * Returns true when an element is a known bounded source container.
     *
     * @param {Element} element
     * @returns {boolean}
     */
    isSourceBoundary(element) {
      return element.matches(SOURCE_BOUNDARY_SELECTOR);
    }

    /**
     * Returns true when an element is a broad sidebar boundary.
     *
     * @param {Element} element
     * @returns {boolean}
     */
    isSidebarBoundary(element) {
      return element.matches(SIDEBAR_BOUNDARY_SELECTOR);
    }

    /**
     * Finds child groups whose heading text identifies a source kind.
     *
     * @param {SourceDefinition} definition
     * @returns {Element[]}
     */
    headingMatchedSourceRoots(definition) {
      const roots = [];
      const containers = DomProbe.queryAll(
        this.document,
        SIDEBAR_BOUNDARY_SELECTOR
      );

      for (const container of containers) {
        if (DomProbe.isOwned(container)) {
          continue;
        }

        for (const child of Array.from(container.children).filter(DomProbe.isElement)) {
          const text = this.sourceHeadingText(child);

          if (definition.pattern.test(text)) {
            roots.push(child);
          }
        }
      }

      return roots;
    }

    /**
     * Reads a list's own heading without including its video titles.
     * Note: Recommended video titles can contain source labels such as 合集.
     * Only a root heading or its direct header children identify the list kind.
     *
     * @param {Element} root
     * @returns {string}
     */
    sourceHeadingText(root) {
      const headings = [root, ...Array.from(root.children)]
        .filter((element) => element.matches(SOURCE_HEADING_SELECTOR))
        .filter((element) => !element.closest(SOURCE_HEADING_ITEM_SELECTOR))
        .filter((element) => SourceAdapter.videoTargetsIn(element).length === 0);
      return headings.map((element) => DomProbe.compactText(element)).join(" ").slice(0, 500);
    }

    /**
     * Tests whether a source root can produce source items without owning page
     * playback or comment regions.
     *
     * @param {Element} root
     * @returns {boolean}
     */
    isValidSourceRoot(root) {
      if (!root.isConnected || root === this.document.body || DomProbe.isOwned(root)) {
        return false;
      }

      if (root.querySelector("#bilibili-player, .bpx-player-container, video")) {
        return false;
      }

      return SourceAdapter.videoTargetsIn(root).length > 0;
    }

    /**
     * Scores a candidate source root for stable one-root-per-kind selection.
     *
     * @param {Element} root
     * @param {SourceDefinition} definition
     * @param {number} itemCount
     * @returns {number}
     */
    scoreSourceRoot(root, definition, itemCount) {
      let score = itemCount;
      const text = this.sourceHeadingText(root);

      if (definition.pattern.test(text)) {
        score += 12;
      }

      if (
        (definition.kind === SourceKind.PARTS ||
          definition.kind === SourceKind.COLLECTION) &&
        root.matches(VIDEO_POD_SELECTOR)
      ) {
        // Note: Bilibili's video-pod is the visible ordered archive-and-parts
        // surface and should beat broader list-looking roots with more links.
        score += 120;
      }

      if (root.id) {
        score += 4;
      }

      if (root.getAttribute(SOURCE_ROOT_ATTR) === definition.kind) {
        score += 6;
      }

      return score;
    }

    /**
     * Selects the best source for each kind and orders them by source kind.
     *
     * @param {(VideoListSource & { score: number })[]} candidates
     * @returns {VideoListSource[]}
     */
    chooseSources(candidates) {
      const byKind = new Map();

      for (const candidate of candidates) {
        const previous = byKind.get(candidate.kind);

        if (!previous || candidate.score > previous.score) {
          byKind.set(candidate.kind, candidate);
        }
      }

      return SOURCE_ORDER
        .map((kind) => byKind.get(kind))
        .filter(Boolean)
        .map(({ kind, root, items }) => ({ kind, root, items }));
    }
  }

  /**
   * Maps a fixed-width rail to a bounded window of logical card indexes.
   */
  class RailWindow {
    /**
     * @param {number} count Number of revealed video items.
     * @param {number} cardWidth Card border-box width from the stylesheet.
     * @param {number} gap Space between cards from the stylesheet.
     */
    constructor(count, cardWidth, gap) {
      this.count = count;
      this.cardWidth = cardWidth;
      this.gap = gap;
      this.stride = cardWidth + gap;
    }

    /**
     * Returns the full row width, including a continuation slot when present.
     *
     * @param {boolean} hasMore
     * @returns {number}
     */
    width(hasMore) {
      const slots = this.count + Number(hasMore);
      return Math.max(0, slots * this.stride - this.gap);
    }

    /**
     * Returns a half-open range intersecting the viewport and its buffer.
     *
     * @param {number} left Scroll offset relative to the row start.
     * @param {number} width Viewport width.
     * @param {number} [buffer]
     * @returns {{ start: number, end: number }}
     */
    range(left, width, buffer = 0) {
      if (width <= 0) {
        return { start: 0, end: 0 };
      }
      const first = Math.floor(Math.max(0, left) / this.stride);
      const end = Math.ceil(Math.max(0, left + width) / this.stride);
      return {
        start: Math.min(this.count, Math.max(0, first - buffer)),
        end: Math.min(this.count, Math.max(first, end) + buffer)
      };
    }

    /**
     * Returns visible indexes first, followed by buffered neighbors.
     *
     * @param {number} left
     * @param {number} width
     * @returns {number[]}
     */
    previewIndexes(left, width) {
      const visible = this.range(left, width);
      const buffered = this.range(left, width, RAIL_WINDOW_BUFFER);
      const indexes = [];
      for (let index = visible.start; index < visible.end; index += 1) {
        indexes.push(index);
      }
      for (let distance = 1; distance <= RAIL_WINDOW_BUFFER; distance += 1) {
        if (visible.start - distance >= buffered.start) {
          indexes.push(visible.start - distance);
        }
        if (visible.end + distance - 1 < buffered.end) {
          indexes.push(visible.end + distance - 1);
        }
      }
      return indexes;
    }

    /**
     * Returns the row-relative offset that centers an item.
     *
     * @param {number} index
     * @param {number} width Viewport width.
     * @returns {number}
     */
    centeredOffset(index, width) {
      return index * this.stride + (this.cardWidth - width) / 2;
    }

    /**
     * Returns the smallest scroll adjustment needed to reveal an item.
     *
     * @param {number} index
     * @param {number} left Current row-relative offset.
     * @param {number} width Viewport width.
     * @returns {number}
     */
    revealedOffset(index, left, width) {
      const start = index * this.stride;
      return Math.min(start, Math.max(left, start + this.cardWidth - width));
    }
  }

  /**
   * Owns the transformed watch layout and re-homes page-owned player/comment
   * nodes into extension panes.
   */
  class LayoutRoot {
    /**
     * Creates the extension-owned layout root.
     *
     * @param {Document} document
     * @param {VideoPreviewStore} videoPreviews
     */
    constructor(document, videoPreviews) {
      this.document = document;
      this.videoPreviews = videoPreviews;
      this.preferences = SettingsPreference.read();
      this.settingsView = null;
      this.favoritesView = null;
      this.movedPageNodes = new MovedPageNodeStore(this.document);
      this.sourceRootMarker = new SourceRootMarker(SOURCE_ROOT_ATTR);
      this.resetLayoutState();
    }

    /**
     * Resets extension-owned DOM references and render-session state.
     */
    resetLayoutState() {
      this.root = null;
      this.stage = null;
      this.playerPane = null;
      this.commentPane = null;
      this.isVideoLoading = false;
      this.commentLoadingView = null;
      this.commentLoadingLabel = null;
      this.commentResizeHandle = null;
      /** @type {{ pointerId: number } | null} */
      this.commentResizeDrag = null;
      this.commentRetryView = null;
      this.commentRetryMessage = null;
      this.commentReloadButton = null;
      this.videoHeader = null;
      this.videoHeaderTitle = null;
      this.videoHeaderMeta = null;
      this.videoHeaderAuthor = null;
      this.videoHeaderAvatar = null;
      this.videoHeaderAvatarImage = null;
      this.videoHeaderName = null;
      this.videoHeaderDate = null;
      this.videoHeaderFitButton = null;
      this.videoDescriptionView = null;
      this.videoDescriptionSlot = null;
      this.videoDescriptionNode = null;
      this.videoTagsList = null;
      this.dock = null;
      this.sourceBar = null;
      this.railActionGroup = null;
      this.morePanel = null;
      this.moreWatchGroup = null;
      this.moreRailGroup = null;
      this.dockUtilityGroup = null;
      this.moreButton = null;
      this.settingsButton = null;
      this.railLocateButton = null;
      this.railStartButton = null;
      /** Logical current-video index in the displayed rail, or -1 when absent. */
      this.railLocateIndex = -1;
      this.railRefreshButton = null;
      this.isRailRefreshing = false;
      this.onRailRefresh = null;
      this.railSearch = null;
      this.railSearchControl = null;
      this.railSearchButton = null;
      this.railSearchInput = null;
      this.railSearchQuery = "";
      this.railSearchKey = null;
      this.onWatchLaterSearchSource = null;
      this.actionGroup = null;
      this.rail = null;
      this.railSource = null;
      /** @type {RailCardEntry[]} */
      this.railEntries = [];
      this.railEntryIndexes = new Map();
      this.railStride = 0;
      this.railRenderFrame = null;
      this.railResizeObserver = null;
      this.railPointerCard = null;
      this.railPointerEndHandler = null;
      this.playerNode = null;
      this.commentNode = null;
      this.selectedSourceKind = null;
      this.isRailOpen = false;
      this.renderedSourceKey = null;
      this.favoriteRailPositions = new Map();
      this.actionButtons = new Map();
      this.sourceButtons = new Map();
      /** @type {WeakMap<HTMLElement, VideoCardRenderState>} */
      this.videoCardStates = new WeakMap();
      this.currentVideoDescription = null;
      this.currentVideoTags = [];
      this.renderedVideoTagsKey = "";
      this.currentUploader = null;
      this.currentPublishedAt = null;
      this.currentTitle = null;
      this.currentActions = [];
      this.currentSources = [];
      this.accountControl = null;
      this.currentActivationControl = null;
      this.watchLaterAccountCount = null;
      /** @type {Node[]} */
      this.watchLaterVisualSnapshot = [];
      this.watchLaterVisualSnapshotKey = "";
      this.onCommentReload = null;
      this.onWatchActionForward = null;
      this.onWatchLaterAdd = null;
      this.onWatchLaterDelete = null;
      this.onVideoCardNavigate = null;
      this.onSourceRouteChange = null;
      this.onSourceMore = null;
      this.onWatchLaterReveal = null;
      /** @type {SourceMoreInteraction | null} */
      this.pendingSourceMore = null;
      this.pendingWatchLaterAddKeys = new Set();
      this.pendingWatchLaterDeleteAids = new Set();
      this.completedWatchLaterAddKeys = new Set();
      this.watchLaterArchiveKeys = new Set();
      this.pendingSourceRouteHint = null;
      this.pendingSourceRouteOpenState = null;
      this.appliedSourceRouteOpenState = null;
      this.hasUserInteractedWithSources = false;
      /** Whether the selected route was chosen automatically rather than restored or clicked. */
      this.isDefaultSourceRoute = true;
      this.locatedCurrentRouteKeys = new Map();
      this.language = DEFAULT_UI_LANGUAGE;
    }

    /**
     * Mounts or updates the transformed layout from one discovery pass.
     *
     * This method is the layout boundary for reconciliation. Inputs are already
     * typed into page-owned regions and source records; the layout may move
     * player and comment nodes, mirror action state, and render extension-owned
     * list chrome, but it does not rediscover page DOM on its own.
     *
     * @param {DiscoveredRegions} regions
     * @param {boolean} resetSourceRoute
     * @param {ActivationControl} activationControl
     * @param {string} language
     * @param {number | null} watchLaterAccountCount
     * @param {() => void} onCommentReload
     * @param {() => void} onWatchActionForward
     * @param {(targetUrl: string) => Promise<void>} onWatchLaterAdd
     * @param {(aid: string) => Promise<void>} onWatchLaterDelete
     * @param {(sourceKind: string, targetUrl: string, event: MouseEvent, folderId?: string) => void} onVideoCardNavigate
     * @param {(state: SourceRouteState) => void} onSourceRouteChange
     * @param {SourceRouteState | null} sourceRouteState
     * @param {(sourceKind: string) => Promise<void>} onSourceMore
     * @param {() => VideoListSource | null} onWatchLaterReveal
     * @param {() => VideoListSource | null} onWatchLaterSearchSource
     * @param {(source: VideoListSource) => Promise<void>} onRailRefresh
     */
    render(
      regions,
      resetSourceRoute,
      activationControl,
      language,
      watchLaterAccountCount,
      onCommentReload,
      onWatchActionForward,
      onWatchLaterAdd,
      onWatchLaterDelete,
      onVideoCardNavigate,
      onSourceRouteChange,
      sourceRouteState,
      onSourceMore,
      onWatchLaterReveal,
      onWatchLaterSearchSource,
      onRailRefresh
    ) {
      this.ensure();
      this.document.documentElement.classList.add(HTML_MOUNTED_CLASS);
      this.onCommentReload = onCommentReload;
      this.onWatchActionForward = onWatchActionForward;
      this.setLanguage(language);
      this.watchLaterAccountCount = watchLaterAccountCount;
      this.setPlayer(regions.player);
      this.currentTitle = regions.title;
      this.currentVideoDescription =
        regions.description ?? this.currentMovedVideoDescription();
      this.currentVideoTags = regions.tags;
      this.setComments(regions.comments, regions.commentState);
      this.currentUploader = regions.uploader;
      this.currentPublishedAt = regions.publishedAt;
      this.renderVideoHeader();
      this.currentActions = regions.actions;
      this.accountControl = regions.accountControl;
      this.onWatchLaterAdd = onWatchLaterAdd;
      this.onWatchLaterDelete = onWatchLaterDelete;
      this.onVideoCardNavigate = onVideoCardNavigate;
      this.onSourceRouteChange = onSourceRouteChange;
      this.onSourceMore = onSourceMore;
      this.onWatchLaterSearchSource = onWatchLaterSearchSource;
      this.onWatchLaterReveal = onWatchLaterReveal;
      this.onRailRefresh = onRailRefresh;
      this.setSources(
        regions.sources,
        resetSourceRoute,
        activationControl,
        sourceRouteState
      );
    }

    /**
     * Clears per-video interaction state while keeping page-owned nodes attached.
     *
     * Note: Bilibili reloads its comment component in place during navigation.
     * Reconnecting that component initializes it from its original data-params
     * attribute, which can still identify the previous video.
     */
    resetPageSession() {
      this.morePanel?.close(true);
      this.favoritesView?.panel.close();
      this.rememberFavoriteRailPosition();
      LayoutRoot.clearNativeOverlayLift(this.document);
      this.endCommentPaneResize();
      this.railPointerCard = null;
      this.pendingSourceMore = null;
      this.renderedSourceKey = null;
      this.locatedCurrentRouteKeys.clear();
      this.completedWatchLaterAddKeys.clear();

      if (this.commentPane) {
        this.commentPane.scrollTop = 0;
      }
    }

    /**
     * Restores all moved page-owned nodes and removes extension-owned markup.
     *
     * Destroy is the normal exit path for disabling Bibilili, leaving a watch
     * page, or losing the player. It clears extension-owned state after page
     * nodes have been restored so later reconciliation starts from native page
     * ownership.
     */
    destroy() {
      this.releasePageOwnership();
      this.resetLayoutState();
      this.document.documentElement?.classList.remove(HTML_MOUNTED_CLASS);
    }

    /**
     * Temporarily restores page-owned nodes so native lazy observers can run.
     *
     * Note: Bilibili comment hydration may depend on the original page layout
     * being present while the native document scrolls. This release keeps the
     * layout object reusable; the next render pass recreates the extension DOM
     * and moves current page-owned nodes again.
     */
    releaseForNativePrime() {
      this.releasePageOwnership();
      this.document.documentElement.classList.remove(HTML_MOUNTED_CLASS);
    }

    /**
     * Restores page-owned nodes and removes extension-owned layout chrome.
     */
    releasePageOwnership() {
      this.favoritesView?.destroy();
      this.morePanel?.destroy();
      this.setVideoLoading(false);
      this.stopRailWindow();
      LayoutRoot.clearNativeOverlayLift(this.document);
      this.endCommentPaneResize();
      this.unmarkSourceRoots();
      this.restoreNode(this.playerNode);
      this.restoreVideoDescriptionNode();
      this.restoreNode(this.commentNode);

      if (this.root?.isConnected) {
        this.root.remove();
      }
    }

    /**
     * Ensures the extension-owned DOM scaffold exists.
     */
    ensure() {
      if (this.root?.isConnected) {
        return;
      }

      if (this.railResizeObserver) {
        this.stopRailWindow();
      }

      const existing = this.document.getElementById(OWNED_ROOT_ID);
      if (existing) {
        existing.remove();
      }

      this.root = this.document.createElement("section");
      this.root.id = OWNED_ROOT_ID;
      LoadingView.prepareSurface(this.root);

      this.stage = this.document.createElement("main");
      this.stage.className = "bibilili-stage";

      this.playerPane = this.document.createElement("section");
      this.playerPane.className = "bibilili-player-pane";

      this.commentPane = this.document.createElement("aside");
      this.commentPane.className = "bibilili-comment-pane";
      this.commentPane.addEventListener(
        "click",
        (event) => {
          this.handleCommentPaneClick(event);
        },
        true
      );

      this.commentResizeHandle = this.document.createElement("div");
      this.commentResizeHandle.className = "bibilili-comment-resize-handle";
      this.commentResizeHandle.tabIndex = 0;
      this.commentResizeHandle.setAttribute("role", "separator");
      this.commentResizeHandle.setAttribute("aria-orientation", "vertical");
      this.commentResizeHandle.setAttribute(
        "aria-valuemin",
        String(COMMENT_PANE_MIN_WIDTH)
      );
      this.commentResizeHandle.setAttribute(
        "aria-valuemax",
        String(COMMENT_PANE_MAX_WIDTH)
      );
      this.commentResizeHandle.addEventListener("pointerdown", (event) => {
        this.startCommentPaneResize(event);
      });
      this.commentResizeHandle.addEventListener("pointermove", (event) => {
        this.dragCommentPaneResize(event);
      });
      this.commentResizeHandle.addEventListener("pointerup", (event) => {
        this.endCommentPaneResize(event);
      });
      this.commentResizeHandle.addEventListener("pointercancel", (event) => {
        this.endCommentPaneResize(event);
      });
      this.commentResizeHandle.addEventListener("lostpointercapture", () => {
        this.endCommentPaneResize();
      });
      this.commentResizeHandle.addEventListener("keydown", (event) => {
        this.handleCommentPaneResizeKeydown(event);
      });

      this.dock = this.document.createElement("section");
      this.dock.className = "bibilili-list-dock";

      this.sourceBar = this.document.createElement("div");
      this.sourceBar.className = "bibilili-source-bar";
      this.sourceBar.setAttribute("role", "toolbar");

      this.actionGroup = this.document.createElement("div");
      this.actionGroup.className = "bibilili-action-group";
      this.actionGroup.setAttribute("role", "group");

      this.rail = this.document.createElement("div");
      this.rail.id = LIST_RAIL_ID;
      this.createRailControls();
      this.createDockUtilities();
      this.rail.className = "bibilili-list-rail";
      this.observeRailWindow();

      this.stage.append(
        this.playerPane,
        this.commentResizeHandle,
        this.commentPane
      );
      this.dock.append(this.sourceBar, this.rail);
      this.root.append(this.stage, this.dock);
      this.document.body.prepend(this.root);
      this.applyStoredCommentPaneWidth();
      this.setVideoLoading(this.isVideoLoading);
    }

    /**
     * Applies localized labels to extension-owned layout landmarks.
     *
     * @param {string} language
     */
    setLanguage(language) {
      this.language = UiStrings.normalizeLanguage(language);

      if (!this.root) {
        return;
      }

      this.root.setAttribute(
        "aria-label",
        UiStrings.message(UiMessage.LAYOUT_LABEL, this.language)
      );
      this.playerPane?.setAttribute(
        "aria-label",
        UiStrings.message(UiMessage.PLAYER_LABEL, this.language)
      );
      this.commentPane?.setAttribute(
        "aria-label",
        UiStrings.message(UiMessage.COMMENTS_LABEL, this.language)
      );
      this.updateVideoDescriptionLabel();
      this.updateCommentPaneResizeLabel();
      this.dock?.setAttribute(
        "aria-label",
        UiStrings.message(UiMessage.VIDEO_LISTS_LABEL, this.language)
      );
      this.actionGroup?.setAttribute(
        "aria-label",
        UiStrings.message(UiMessage.WATCH_ACTIONS_LABEL, this.language)
      );
      this.updateCommentRetryLabels();
      this.updateCommentLoadingLabel();
    }

    /**
     * Moves the current player node into the player pane.
     *
     * @param {Element | null} player
     */
    setPlayer(player) {
      if (!player || !this.playerPane) {
        return;
      }

      if (this.playerNode && this.playerNode !== player) {
        this.restoreNode(this.playerNode);
      }

      this.playerNode = player;
      this.movePageNode(player, this.playerPane, "player");
    }

    /**
     * Renders the extension-owned video header at the top of the comment pane.
     *
     * The header shows the watch title, the uploader link, and the publish
     * date. It keeps the comment pane reserved whenever any part is
     * available, even before comments load.
     */
    renderVideoHeader() {
      if (!this.root || !this.commentPane) {
        return;
      }

      const hasContent = Boolean(
        this.currentTitle || this.currentUploader || this.currentPublishedAt
      );

      this.root.classList.toggle(HAS_VIDEO_HEADER_CLASS, hasContent);

      if (!hasContent) {
        this.videoHeader?.remove();
        return;
      }

      this.ensureVideoHeader();
      this.updateVideoHeader();

      if (this.videoHeader.parentElement !== this.commentPane) {
        this.commentPane.prepend(this.videoHeader);
      }
    }

    /**
     * Ensures the stable video header nodes exist at the pane top.
     */
    ensureVideoHeader() {
      if (this.videoHeader) {
        return;
      }

      this.videoHeader = this.document.createElement("header");
      this.videoHeader.className = "bibilili-video-header";

      this.videoHeaderTitle = this.document.createElement("div");
      this.videoHeaderTitle.className = "bibilili-video-header-title";

      this.videoHeaderMeta = this.document.createElement("div");
      this.videoHeaderMeta.className = "bibilili-video-header-meta";

      this.videoHeaderAuthor = this.document.createElement("a");
      this.videoHeaderAuthor.className = "bibilili-video-header-author";

      this.videoHeaderAvatar = this.document.createElement("span");
      this.videoHeaderAvatar.className = "bibilili-video-header-avatar";
      this.videoHeaderAvatar.setAttribute("aria-hidden", "true");

      this.videoHeaderAvatarImage = this.document.createElement("img");
      this.videoHeaderAvatarImage.alt = "";
      this.videoHeaderAvatar.append(this.videoHeaderAvatarImage);

      this.videoHeaderName = this.document.createElement("span");
      this.videoHeaderName.className = "bibilili-video-header-name";

      this.videoHeaderDate = this.document.createElement("span");
      this.videoHeaderDate.className = "bibilili-video-header-date";

      this.videoHeaderFitButton = UiControl.button(
        this.document,
        "bibilili-video-header-fit",
        () => this.fitCommentPaneToVideo()
      );
      this.videoHeaderFitButton.append(
        LayoutRoot.fitVideoActionIcon(this.document)
      );

      this.videoHeaderAuthor.append(
        this.videoHeaderAvatar,
        this.videoHeaderName
      );
      this.videoHeaderMeta.append(
        this.videoHeaderAuthor,
        this.videoHeaderDate,
        this.videoHeaderFitButton
      );
      this.videoHeader.append(this.videoHeaderTitle, this.videoHeaderMeta);
      this.commentPane.prepend(this.videoHeader);
    }

    /**
     * Updates the video header content in place.
     */
    updateVideoHeader() {
      if (
        !this.videoHeader ||
        !this.videoHeaderTitle ||
        !this.videoHeaderAuthor ||
        !this.videoHeaderAvatar ||
        !this.videoHeaderAvatarImage ||
        !this.videoHeaderName ||
        !this.videoHeaderDate
      ) {
        return;
      }

      LayoutRoot.setStableText(
        this.videoHeaderTitle,
        this.currentTitle ?? ""
      );
      this.videoHeaderTitle.hidden = !this.currentTitle;

      const uploader = this.currentUploader;

      if (uploader) {
        this.videoHeaderAuthor.hidden = false;

        if (uploader.profileUrl) {
          this.videoHeaderAuthor.href = uploader.profileUrl;
          this.videoHeaderAuthor.target = "_blank";
          this.videoHeaderAuthor.rel = "noopener noreferrer";
        } else {
          this.videoHeaderAuthor.removeAttribute("href");
          this.videoHeaderAuthor.removeAttribute("target");
          this.videoHeaderAuthor.removeAttribute("rel");
        }

        UiControl.setLabel(
          this.videoHeaderAuthor,
          UiStrings.uploaderLabel(uploader.name, this.language)
        );
        LayoutRoot.setStableText(this.videoHeaderName, uploader.name);

        if (uploader.avatarUrl) {
          this.videoHeaderAvatar.hidden = false;

          if (
            this.videoHeaderAvatarImage.getAttribute("src") !==
            uploader.avatarUrl
          ) {
            this.videoHeaderAvatarImage.src = uploader.avatarUrl;
          }
        } else {
          this.videoHeaderAvatar.hidden = true;
          this.videoHeaderAvatarImage.removeAttribute("src");
        }
      } else {
        this.videoHeaderAuthor.hidden = true;
      }

      LayoutRoot.setStableText(
        this.videoHeaderDate,
        this.currentPublishedAt ?? ""
      );
      this.videoHeaderDate.hidden = !this.currentPublishedAt;

      UiControl.setLabel(
        this.videoHeaderFitButton,
        UiStrings.message(UiMessage.FIT_VIDEO_LABEL, this.language)
      );
    }

    /**
     * Writes element text only when the value changed.
     *
     * Reconciliation renders on every pass; replacing unchanged text nodes
     * would destroy DOM selections anchored inside them.
     *
     * @param {Element | null} element
     * @param {string} text
     */
    static setStableText(element, text) {
      if (!element || element.textContent === text) {
        return;
      }

      element.textContent = text;
    }

    /**
     * Creates the expand-arrows icon for the fit video action.
     *
     * @param {Document} document
     * @returns {SVGElement}
     */
    static fitVideoActionIcon(document) {
      const namespace = "http://www.w3.org/2000/svg";
      const icon = document.createElementNS(namespace, "svg");
      icon.setAttribute("viewBox", "0 0 16 16");
      icon.setAttribute("width", "14");
      icon.setAttribute("height", "14");
      icon.setAttribute("aria-hidden", "true");

      const path = document.createElementNS(namespace, "path");
      path.setAttribute(
        "d",
        "M2.5 2.5v11M13.5 2.5v11M6 8H3.9m0 0 1.6-1.6M3.9 8l1.6 1.6" +
          "M10 8h2.1m0 0-1.6-1.6M12.1 8l-1.6 1.6"
      );
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", "currentColor");
      path.setAttribute("stroke-width", "1.4");
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("stroke-linejoin", "round");
      icon.append(path);

      return icon;
    }

    /**
     * Returns the comment region still attached to its mounted pane.
     *
     * @returns {Element | null}
     */
    currentMountedComments() {
      return this.commentNode?.isConnected &&
        this.commentNode.parentElement === this.commentPane
        ? this.commentNode
        : null;
    }

    /**
     * Covers comments and counted watch actions for the same video transition.
     * The comment status shares its grid cell and stays centered while scrolled.
     *
     * @param {boolean} loading
     */
    setVideoLoading(loading) {
      this.isVideoLoading = loading;
      this.root?.classList.toggle(VIDEO_LOADING_CLASS, loading);
      for (const button of this.actionButtons.values()) {
        this.syncWatchActionButtonState(button);
      }
      if (this.commentPane) {
        this.commentPane.inert = loading;
        this.commentPane.setAttribute("aria-busy", String(loading));
      }
      if (loading && this.stage && !this.commentLoadingView?.isConnected) {
        this.commentLoadingView = this.document.createElement("div");
        this.commentLoadingView.className = "bibilili-comment-loading bibilili-loading-overlay";
        this.commentLoadingView.setAttribute("role", "status");
        this.commentLoadingLabel = this.document.createElement("div");
        this.commentLoadingLabel.className = "bibilili-comment-loading-label";
        const content = LoadingView.create(this.document, {
          content: [this.commentLoadingLabel]
        });
        this.commentLoadingView.append(content);
        this.stage.append(this.commentLoadingView);
        this.updateCommentLoadingLabel();
      }
      this.commentLoadingView?.setAttribute("aria-hidden", String(!loading));
    }

    /** Applies the localized status text to the comment loading surface. */
    updateCommentLoadingLabel() {
      LayoutRoot.setStableText(
        this.commentLoadingLabel,
        UiStrings.message(UiMessage.COMMENT_LOADING_LABEL, this.language)
      );
    }

    /**
     * Renders the current comment pane state.
     *
     * @param {Element | null} comments
     * @param {string} state
     */
    setComments(comments, state) {
      if (!this.root || !this.commentPane) {
        return;
      }

      if (state === CommentPaneState.LOADED && comments) {
        this.setLoadedComments(comments);
        return;
      }

      if (state === CommentPaneState.RETRY) {
        this.setCommentRetry();
        return;
      }

      this.hideComments();
    }

    /**
     * Restores moved comments and hides the comment pane.
     */
    hideComments() {
      this.restoreVideoDescriptionNode();
      this.videoDescriptionView?.remove();
      this.renderedVideoTagsKey = "";

      if (this.commentNode) {
        this.restoreNode(this.commentNode);
        this.commentNode = null;
      }

      this.root.classList.remove("bibilili-has-comments");
      this.root.classList.remove("bibilili-has-comment-retry");
    }

    /**
     * Moves the current usable comment node into the comment pane.
     *
     * @param {Element} comments
     */
    setLoadedComments(comments) {
      if (this.commentNode && this.commentNode !== comments) {
        this.restoreNode(this.commentNode);
        this.commentNode = null;
      }

      this.commentNode = comments;
      this.movePageNode(comments, this.commentPane, "comments");
      this.renderVideoDescription();
      this.root.classList.add("bibilili-has-comments");
      this.root.classList.remove("bibilili-has-comment-retry");
    }

    /**
     * Renders the current video description and tags before comments.
     */
    renderVideoDescription() {
      if (!this.commentPane || !this.commentNode) {
        return;
      }

      if (!this.preferences.features.description || !LayoutRoot.hasVideoDescriptionRegion(
        this.currentVideoDescription,
        this.currentVideoTags
      )) {
        this.restoreVideoDescriptionNode();
        this.videoDescriptionView?.remove();
        this.renderedVideoTagsKey = "";
        return;
      }

      this.ensureVideoDescriptionView();
      this.updateVideoDescriptionLabel();

      if (this.currentVideoDescription) {
        this.moveVideoDescriptionNode(this.currentVideoDescription);
      } else {
        this.restoreVideoDescriptionNode();
        this.videoDescriptionSlot.hidden = true;
      }

      const key = LayoutRoot.videoTagsKey(this.currentVideoTags);

      if (key !== this.renderedVideoTagsKey) {
        this.renderVideoTags(this.currentVideoTags);
        this.renderedVideoTagsKey = key;
      }

      if (this.commentNode.previousSibling !== this.videoDescriptionView) {
        this.commentPane.insertBefore(
          this.videoDescriptionView,
          this.commentNode
        );
      }
    }

    /**
     * Ensures the stable video description region exists.
     */
    ensureVideoDescriptionView() {
      if (this.videoDescriptionView) {
        return;
      }

      this.videoDescriptionView = this.document.createElement("section");
      this.videoDescriptionView.className = "bibilili-video-description";

      this.videoDescriptionSlot = this.document.createElement("div");
      this.videoDescriptionSlot.className =
        "bibilili-video-description-slot";

      this.videoTagsList = this.document.createElement("div");
      this.videoTagsList.className = "bibilili-video-tags";

      this.videoDescriptionView.append(
        this.videoDescriptionSlot,
        this.videoTagsList
      );
    }

    /**
     * Updates the video description accessible label.
     */
    updateVideoDescriptionLabel() {
      if (!this.videoDescriptionView) {
        return;
      }

      this.videoDescriptionView.setAttribute(
        "aria-label",
        UiStrings.message(UiMessage.VIDEO_DESCRIPTION_LABEL, this.language)
      );
    }

    /**
     * Moves the page-owned video description node into the description slot.
     *
     * @param {Element} description
     */
    moveVideoDescriptionNode(description) {
      if (!this.videoDescriptionSlot) {
        return;
      }

      if (
        this.videoDescriptionNode &&
        this.videoDescriptionNode !== description
      ) {
        this.restoreVideoDescriptionNode();
      }

      this.videoDescriptionNode = description;
      this.videoDescriptionSlot.hidden = false;
      this.movedPageNodes.move(
        description,
        this.videoDescriptionSlot,
        "description"
      );
    }

    /**
     * Returns the moved native description node while discovery cannot see it.
     *
     * @returns {Element | null}
     */
    currentMovedVideoDescription() {
      if (
        this.videoDescriptionNode?.isConnected &&
        this.videoDescriptionSlot?.contains(this.videoDescriptionNode)
      ) {
        return this.videoDescriptionNode;
      }

      return null;
    }

    /**
     * Restores the moved native video description node.
     */
    restoreVideoDescriptionNode() {
      if (!this.videoDescriptionNode) {
        return;
      }

      this.restoreNode(this.videoDescriptionNode);
      this.videoDescriptionNode = null;
    }

    /**
     * Renders video tag links in native order.
     *
     * @param {VideoTag[]} tags
     */
    renderVideoTags(tags) {
      if (!this.videoTagsList) {
        return;
      }

      this.videoTagsList.hidden = tags.length === 0;
      this.videoTagsList.replaceChildren(
        ...tags.map((tag) => {
          const link = this.document.createElement("a");
          link.className = "bibilili-video-tag-link";
          link.href = tag.href;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.textContent = tag.text;
          return link;
        })
      );
    }

    /**
     * Tests whether the video description region has renderable content.
     *
     * @param {Element | null} description
     * @param {VideoTag[]} tags
     * @returns {boolean}
     */
    static hasVideoDescriptionRegion(description, tags) {
      return Boolean(description || tags.length);
    }

    /**
     * Produces a stable comparison key for video tag snapshots.
     *
     * @param {VideoTag[]} tags
     * @returns {string}
     */
    static videoTagsKey(tags) {
      return JSON.stringify(tags.map((tag) => [tag.text, tag.href]));
    }

    /**
     * Renders the extension-owned comment reload state.
     */
    setCommentRetry() {
      this.hideComments();
      this.ensureCommentRetryView();
      this.updateCommentRetryLabels();

      if (this.commentRetryView.parentElement !== this.commentPane) {
        this.commentPane.append(this.commentRetryView);
      }

      this.root.classList.add("bibilili-has-comment-retry");
    }

    /**
     * Ensures the stable retry view and reload button exist.
     */
    ensureCommentRetryView() {
      if (this.commentRetryView) {
        return;
      }

      this.commentRetryView = this.document.createElement("div");
      this.commentRetryView.className = "bibilili-comment-retry";

      this.commentRetryMessage = this.document.createElement("p");
      this.commentRetryMessage.className = "bibilili-comment-retry-message";
      this.commentRetryMessage.setAttribute("aria-live", "polite");

      this.commentReloadButton = UiControl.button(
        this.document,
        "bibilili-comment-reload-button",
        () => {
          this.requestCommentReload();
        }
      );

      this.commentRetryView.append(
        this.commentRetryMessage,
        this.commentReloadButton
      );
    }

    /**
     * Updates localized retry text in place.
     */
    updateCommentRetryLabels() {
      if (!this.commentRetryMessage || !this.commentReloadButton) {
        return;
      }

      const message = UiStrings.message(
        UiMessage.COMMENT_RETRY_MESSAGE,
        this.language
      );
      const label = UiStrings.message(
        UiMessage.COMMENT_RELOAD_LABEL,
        this.language
      );

      this.commentRetryMessage.textContent = message;
      UiControl.setTextButtonLabel(this.commentReloadButton, label);
    }

    /**
     * Updates the comment divider accessible label.
     */
    updateCommentPaneResizeLabel() {
      if (!this.commentResizeHandle) {
        return;
      }

      const label = UiStrings.message(
        UiMessage.COMMENT_RESIZE_LABEL,
        this.language
      );
      UiControl.setLabel(this.commentResizeHandle, label);
    }

    /**
     * Applies the persisted comment pane width to the current layout.
     */
    applyStoredCommentPaneWidth() {
      const width = CommentPaneWidthPreference.read();

      if (width !== null) {
        this.setCommentPaneWidth(width, false);
      }
    }

    /**
     * Starts dragging the divider between the player and comments.
     *
     * @param {PointerEvent} event
     */
    startCommentPaneResize(event) {
      if (event.button !== 0 || !this.commentResizeHandle) {
        return;
      }

      event.preventDefault();
      this.commentResizeDrag = { pointerId: event.pointerId };
      this.document.documentElement.classList.add(COMMENT_PANE_RESIZING_CLASS);

      try {
        this.commentResizeHandle.setPointerCapture(event.pointerId);
      } catch (_error) {
        this.commentResizeDrag = null;
        this.document.documentElement.classList.remove(
          COMMENT_PANE_RESIZING_CLASS
        );
        return;
      }

      this.resizeCommentPaneFromClientX(event.clientX, false);
    }

    /**
     * Updates the comment pane width during an active divider drag.
     *
     * @param {PointerEvent} event
     */
    dragCommentPaneResize(event) {
      if (this.commentResizeDrag?.pointerId !== event.pointerId) {
        return;
      }

      event.preventDefault();
      this.resizeCommentPaneFromClientX(event.clientX, false);
    }

    /**
     * Completes an active divider drag and persists the width.
     *
     * @param {PointerEvent} [event]
     */
    endCommentPaneResize(event) {
      if (
        event &&
        this.commentResizeDrag &&
        this.commentResizeDrag.pointerId !== event.pointerId
      ) {
        return;
      }

      const shouldPersist = Boolean(this.commentResizeDrag);
      const pointerId = event?.pointerId ?? this.commentResizeDrag?.pointerId;
      this.commentResizeDrag = null;
      this.document.documentElement?.classList.remove(
        COMMENT_PANE_RESIZING_CLASS
      );

      if (
        pointerId !== undefined &&
        this.commentResizeHandle?.hasPointerCapture(pointerId)
      ) {
        try {
          this.commentResizeHandle.releasePointerCapture(pointerId);
        } catch (_error) {
          // Pointer capture may already be released by the browser.
        }
      }

      if (shouldPersist) {
        this.persistCurrentCommentPaneWidth();
      }
    }

    /**
     * Resizes the comment pane from keyboard interaction with the divider.
     *
     * @param {KeyboardEvent} event
     */
    handleCommentPaneResizeKeydown(event) {
      const direction =
        event.key === "ArrowLeft" ? 1 : event.key === "ArrowRight" ? -1 : 0;

      if (!direction) {
        return;
      }

      event.preventDefault();
      this.setCommentPaneWidth(
        this.currentCommentPaneWidth() +
          direction * COMMENT_PANE_KEYBOARD_STEP,
        true
      );
    }

    /**
     * Resizes the comment pane based on a viewport pointer position.
     *
     * @param {number} clientX
     * @param {boolean} persist
     */
    resizeCommentPaneFromClientX(clientX, persist) {
      if (!this.stage) {
        return;
      }

      const stageRect = this.stage.getBoundingClientRect();
      const handleWidth =
        this.commentResizeHandle?.getBoundingClientRect().width ?? 0;
      this.setCommentPaneWidth(
        stageRect.right - clientX - handleWidth / 2,
        persist
      );
    }

    /**
     * Sets the comment pane width so the player pane matches the video aspect.
     *
     * The current video's intrinsic aspect ratio tiles the player's video
     * area; the remaining stage width goes to the comment pane under the
     * same clamps and persistence as divider resizing.
     */
    fitCommentPaneToVideo() {
      const video = this.playerNode?.querySelector("video");
      const stageRect = this.stage?.getBoundingClientRect();

      if (
        !video ||
        !video.videoWidth ||
        !video.videoHeight ||
        !stageRect ||
        stageRect.height <= 0
      ) {
        return;
      }

      /*
       * Note: The bpx player keeps its control bar below the video area, so
       * the video tiles at video-area height rather than pane height.
       */
      const videoArea = this.playerNode?.querySelector(
        ".bpx-player-video-area"
      );
      const tilingHeight = (videoArea ?? this.playerPane)?.getBoundingClientRect()
        .height;

      if (!tilingHeight || tilingHeight <= 0) {
        return;
      }

      const handleWidth =
        this.commentResizeHandle?.getBoundingClientRect().width ?? 0;
      const tiledPlayerWidth =
        (tilingHeight * video.videoWidth) / video.videoHeight;

      this.setCommentPaneWidth(
        stageRect.width - handleWidth - tiledPlayerWidth,
        true
      );
    }

    /**
     * Applies a comment pane width to the layout root.
     *
     * @param {number} width
     * @param {boolean} persist
     */
    setCommentPaneWidth(width, persist) {
      if (!this.root) {
        return;
      }

      const clampedWidth = this.clampCommentPaneWidth(width);
      this.root.style.setProperty(
        COMMENT_PANE_WIDTH_PROPERTY,
        `${clampedWidth}px`
      );
      this.commentResizeHandle?.setAttribute(
        "aria-valuenow",
        String(clampedWidth)
      );

      if (persist) {
        CommentPaneWidthPreference.write(clampedWidth);
      }
    }

    /**
     * Persists the currently rendered comment pane width.
     */
    persistCurrentCommentPaneWidth() {
      const width = this.currentCommentPaneWidth();

      if (width > 0) {
        CommentPaneWidthPreference.write(this.clampCommentPaneWidth(width));
      }
    }

    /**
     * Returns the current comment pane width.
     *
     * @returns {number}
     */
    currentCommentPaneWidth() {
      const width = this.commentPane?.getBoundingClientRect().width ?? 0;

      if (Number.isFinite(width) && width > 0) {
        return width;
      }

      return CommentPaneWidthPreference.read() ?? COMMENT_PANE_MIN_WIDTH;
    }

    /**
     * Clamps comment pane width to stable viewport bounds.
     *
     * @param {number} width
     * @returns {number}
     */
    clampCommentPaneWidth(width) {
      const stageWidth = this.stage?.getBoundingClientRect().width ?? 0;
      const stageMax =
        stageWidth > 0
          ? Math.floor(stageWidth * COMMENT_PANE_MAX_STAGE_RATIO)
          : COMMENT_PANE_MAX_WIDTH;
      const maxWidth = Math.max(
        COMMENT_PANE_MIN_WIDTH,
        Math.min(COMMENT_PANE_MAX_WIDTH, stageMax)
      );

      if (!Number.isFinite(width)) {
        return COMMENT_PANE_MIN_WIDTH;
      }

      return Math.round(
        Math.min(Math.max(width, COMMENT_PANE_MIN_WIDTH), maxWidth)
      );
    }

    /**
     * Runs the controller-owned comment reload callback.
     */
    requestCommentReload() {
      this.onCommentReload?.();
    }

    /**
     * Forwards current-user avatar clicks in the comment composer to Bilibili's
     * native account control.
     *
     * @param {MouseEvent} event
     */
    handleCommentPaneClick(event) {
      LayoutRoot.liftNativeCommentOverlayFromEvent(event);

      const trigger = this.accountControl?.trigger;

      if (!trigger?.isConnected || !this.isCommentAccountAvatarClick(event)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      LayoutRoot.activateNativeAccountControl(trigger);
    }

    /**
     * Returns true when a click lands in the current-user avatar zone.
     *
     * Note: Bilibili's current comment component retargets clicks to the
     * comment host, hiding inner avatar markup from content scripts. The bridge
     * is scoped to the top-left composer avatar area.
     *
     * @param {MouseEvent} event
     * @returns {boolean}
     */
    isCommentAccountAvatarClick(event) {
      if (!(event instanceof MouseEvent) || !this.commentNode?.isConnected) {
        return false;
      }

      const target = DomProbe.eventElement(event);

      if (
        !target ||
        (target !== this.commentNode && !this.commentNode.contains(target))
      ) {
        return false;
      }

      const composer = target.closest(COMMENT_COMPOSER_SELECTOR);
      const profileLink = target.closest(COMMENT_PROFILE_LINK_SELECTOR);

      if (profileLink && (!composer || !this.commentNode.contains(composer))) {
        return false;
      }

      if (target.closest(COMMENT_ROW_SELECTOR)) {
        return false;
      }

      if (composer && this.commentNode.contains(composer)) {
        const nonAvatarControl = target.closest(
          COMMENT_COMPOSER_NON_AVATAR_SELECTOR
        );

        if (nonAvatarControl && composer.contains(nonAvatarControl)) {
          return false;
        }

        return LayoutRoot.isPointInsideCommentAvatarFallback(event, composer);
      }

      return LayoutRoot.isPointInsideCommentAvatarFallback(
        event,
        this.commentNode,
        this.firstCommentRowTopOffset()
      );
    }

    /**
     * Returns the first visible comment-row top relative to the comment root.
     *
     * @returns {number | null}
     */
    firstCommentRowTopOffset() {
      const rootRect = this.commentNode.getBoundingClientRect();
      let topOffset = null;

      for (const row of DomProbe.queryAll(this.commentNode, COMMENT_ROW_SELECTOR)) {
        const rect = row.getBoundingClientRect();

        if (rect.width <= 0 || rect.height <= 0) {
          continue;
        }

        const offset = rect.top - rootRect.top;

        if (offset < 0) {
          continue;
        }

        topOffset = topOffset === null ? offset : Math.min(topOffset, offset);
      }

      return topOffset;
    }

    /**
     * Renders visible source controls and the bottom rail.
     *
     * Source route state is applied only through this method. It preserves a
     * pending route hint until that source appears, so account-backed sources
     * can arrive after the first render without losing the user's navigation
     * context.
     *
     * @param {VideoListSource[]} sources
     * @param {boolean} resetSourceRoute
     * @param {ActivationControl} activationControl
     * @param {SourceRouteState | null} sourceRouteState
     */
    setSources(sources, resetSourceRoute, activationControl, sourceRouteState) {
      if (!this.root || !this.sourceBar || !this.rail) {
        return;
      }

      sources = sources.filter((source) => this.preferences.sources[source.kind]);
      this.currentSources = sources;
      this.watchLaterArchiveKeys = LayoutRoot.watchLaterArchiveKeysFor(sources);
      this.currentActivationControl = activationControl;
      this.markSourceRoots(sources);

      if (resetSourceRoute) {
        this.hasUserInteractedWithSources = false;
        this.setPendingSourceRouteState(sourceRouteState);
      } else if (sourceRouteState) {
        this.setPendingSourceRouteState(sourceRouteState);
      }
      if (this.pendingSourceRouteHint && !this.preferences.sources[this.pendingSourceRouteHint]) {
        this.setPendingSourceRouteState(null);
      }

      const previousSourceKind = this.selectedSourceKind;
      this.selectedSourceKind = this.resolveSourceRoute(sources, resetSourceRoute);
      this.resolveRailOpenState(previousSourceKind, resetSourceRoute);

      this.renderSourceDock(sources, activationControl);

      if (this.appliedSourceRouteOpenState !== null) {
        this.emitSourceRouteChange();
        this.appliedSourceRouteOpenState = null;
      }
    }

    /**
     * Stores a pending route state until its source is available.
     *
     * @param {SourceRouteState | null} state
     */
    setPendingSourceRouteState(state) {
      if (!state || !SOURCE_ORDER.includes(state.sourceKind) || !this.preferences.sources[state.sourceKind]) {
        this.pendingSourceRouteHint = null;
        this.pendingSourceRouteOpenState = null;
        return;
      }

      this.pendingSourceRouteHint = state.sourceKind;
      this.pendingSourceRouteOpenState =
        typeof state.isRailOpen === "boolean" ? state.isRailOpen : true;
    }

    /**
     * Renders the list dock from the current source route and rail open state.
     *
     * Opening watch later reveals the cached batch containing the current video.
     * Note: Account data can replace a page-owned watch-later source after mount;
     * that transition also reveals the cached target.
     *
     * @param {VideoListSource[]} sources
     * @param {ActivationControl} activationControl
     */
    renderSourceDock(sources, activationControl) {
      if (!this.root || !this.sourceBar || !this.rail) {
        return;
      }

      let selectedSource = this.selectedSource(sources);
      const hasOpenRail = Boolean(selectedSource && this.isRailOpen);
      const sourceKey = LayoutRoot.sourceKey(selectedSource);
      const resetScroll = sourceKey !== this.renderedSourceKey;
      const sourceChanged = this.railSearchKey !== sourceKey;
      if (resetScroll || !hasOpenRail) this.rememberFavoriteRailPosition();
      if (sourceChanged) {
        this.railSearchQuery = "";
        if (this.railSearchInput) this.railSearchInput.value = "";
        this.setRailSearchExpanded(false);
        this.railSearchKey = sourceKey;
      }

      if (
        hasOpenRail &&
        selectedSource.kind === SourceKind.WATCH_LATER &&
        selectedSource.root === null &&
        (resetScroll || this.railSource?.root !== null)
      ) {
        const revealedSource = this.onWatchLaterReveal?.();
        if (revealedSource) {
          selectedSource = revealedSource;
          sources = sources.map((source) => source.kind === SourceKind.WATCH_LATER
            ? revealedSource : source);
          this.currentSources = sources;
          this.watchLaterArchiveKeys = LayoutRoot.watchLaterArchiveKeysFor(sources);
        }
      }

      this.root.classList.toggle("bibilili-has-dock", hasOpenRail);
      this.root.classList.toggle("bibilili-has-controls-dock", !hasOpenRail);
      this.renderSourceBar(sources, activationControl);
      this.renderRailSearch(hasOpenRail);
      this.renderControlPlacement();

      if (hasOpenRail) {
        this.renderRail(this.searchRailSource(selectedSource), resetScroll);
        this.renderedSourceKey = sourceKey;
      } else {
        this.renderedSourceKey = null;
        this.pendingSourceMore = null;
        this.railSource = null;
        this.railEntries = [];
        this.railLocateIndex = -1;
        this.renderRailLocate();
        this.railEntryIndexes.clear();
        this.railPointerCard = null;
        this.videoPreviews.setDemand([]);
        this.videoCardStates = new WeakMap();
        this.rail.replaceChildren();
      }
      if (sourceChanged && selectedSource?.kind === SourceKind.FAVORITES &&
          (selectedSource.folderId || !this.isDefaultSourceRoute)) {
        this.emitSourceRouteChange();
      }
    }

    /** Groups rail actions in their stable Locate, Start, Refresh, Search order. */
    createRailControls() {
      this.createRailLocate();
      this.createRailStart();
      this.createRailRefresh();
      this.createRailSearch();
      this.railActionGroup = this.document.createElement("div");
      this.railActionGroup.className = "bibilili-rail-action-group";
      this.railActionGroup.setAttribute("role", "group");
      this.railActionGroup.append(
        this.railLocateButton, this.railStartButton, this.railRefreshButton, this.railSearch
      );
    }

    /** Creates the fixed Settings entry and a popup for unpinned action nodes. */
    createDockUtilities() {
      this.morePanel = new PopupPanel(this.document, "bibilili-more-popup");
      this.morePanel.ensure();
      LoadingView.prepareSurface(this.morePanel.root);
      this.morePanel.root.id = "bibilili-more-actions";
      this.moreWatchGroup = this.document.createElement("div");
      this.moreRailGroup = this.document.createElement("div");
      for (const group of [this.moreWatchGroup, this.moreRailGroup]) {
        group.className = "bibilili-more-group";
        group.setAttribute("role", "group");
      }
      this.morePanel.root.append(this.moreWatchGroup, this.moreRailGroup);
      this.morePanel.root.addEventListener("click", (event) => {
        if (event.target.closest("button") && !event.target.closest(".bibilili-rail-search")) {
          // Restore focus before forwarding a click that may open a native dialog.
          this.morePanel.close(true);
        }
      }, true);
      this.dockUtilityGroup = this.document.createElement("div");
      this.dockUtilityGroup.className = "bibilili-dock-utilities";
      this.moreButton = UiControl.button(this.document, "bibilili-action-button", () => {
        this.favoritesView?.panel.close();
        this.morePanel.toggle(this.moreButton);
      });
      this.moreButton.append(UiControl.icon(this.document, "more"));
      this.moreButton.setAttribute("aria-haspopup", "dialog");
      this.moreButton.setAttribute("aria-expanded", "false");
      this.moreButton.setAttribute("aria-controls", "bibilili-more-actions");
      this.settingsButton = this.settingsView.launcher();
      this.dockUtilityGroup.append(this.moreButton, this.settingsButton);
      for (const [kind, control] of this.railControls()) {
        const label = this.document.createElement("span");
        label.className = "bibilili-action-label";
        (kind === RailActionKind.SEARCH ? this.railSearchButton : control).append(label);
      }
    }

    /** @returns {Map<string, HTMLElement>} The actual list-tool nodes in canonical order. */
    railControls() {
      return new Map([
        [RailActionKind.LOCATE, this.railLocateButton],
        [RailActionKind.START, this.railStartButton],
        [RailActionKind.REFRESH, this.railRefreshButton],
        [RailActionKind.SEARCH, this.railSearch]
      ]);
    }

    /** Places each existing tool on the bar or in More without replacing handlers. */
    renderControlPlacement() {
      if (!this.morePanel || !this.dockUtilityGroup) return;
      let pinnedPrevious = null;
      let morePrevious = null;
      for (const [kind, control] of this.railControls()) {
        // An active search stays visible until cleared, even when its shortcut is unpinned.
        const pinned = this.preferences.pinnedActions[kind] ||
          (kind === RailActionKind.SEARCH && !this.railSearchInput.hidden);
        const parent = pinned ? this.railActionGroup : this.moreRailGroup;
        UiControl.place(parent, control, pinned ? pinnedPrevious : morePrevious);
        if (pinned) pinnedPrevious = control;
        else morePrevious = control;
        control.querySelector(".bibilili-action-label").textContent = this.actionLabel(kind);
      }
      const hasPinnedTools = [...this.railActionGroup.children].some((control) => !control.hidden);
      const hasMoreTools = [...this.moreRailGroup.children].some((control) => !control.hidden);
      this.railActionGroup.hidden = !hasPinnedTools;
      this.moreRailGroup.hidden = !hasMoreTools;
      const label = UiStrings.message(UiMessage.MORE_ACTIONS_LABEL, this.language);
      UiControl.setLabel(this.moreButton, label);
      this.morePanel.root.setAttribute("aria-label", label);
      this.moreWatchGroup.setAttribute("aria-label", UiStrings.message(UiMessage.WATCH_ACTIONS_LABEL, this.language));
      this.moreRailGroup.setAttribute("aria-label", UiStrings.message(UiMessage.RAIL_ACTIONS_LABEL, this.language));
      UiControl.setLabel(this.settingsButton, UiStrings.message(UiMessage.SETTINGS_LABEL, this.language));
      const moreHasFocus = this.document.activeElement === this.moreButton ||
        this.morePanel.root.contains(this.document.activeElement);
      this.moreButton.hidden = !this.preferences.features.moreButton ||
        (!this.moreWatchGroup.childElementCount && !hasMoreTools);
      this.dockUtilityGroup.classList.toggle("bibilili-has-more", !this.moreButton.hidden);
      if (this.moreButton.hidden) {
        this.morePanel.close();
        if (moreHasFocus) this.settingsButton.focus();
      }
      if (this.railActionGroup.nextSibling !== this.dockUtilityGroup ||
          this.sourceBar.lastChild !== this.dockUtilityGroup) {
        this.sourceBar.append(this.railActionGroup, this.dockUtilityGroup);
      }
      this.morePanel.position();
    }

    /** @param {string} kind @returns {string} The same explicit action label on every surface. */
    actionLabel(kind) {
      const message = RAIL_ACTION_MESSAGES[kind] ?? (kind === WatchActionKind.SHARE
        ? UiMessage.WATCH_ACTION_COPY_LINK_LABEL : WATCH_ACTION_LABEL_MESSAGE_NAMES[kind]);
      return UiStrings.message(message, this.language);
    }

    /**
     * Uses the dock's native visual path for settings, including watch-later snapshots.
     * Missing native actions keep a labeled settings row with an empty icon slot.
     * @param {string} kind
     * @param {Element} visual
     */
    renderSettingsIcon(kind, visual) {
      if (RAIL_ACTION_ORDER.includes(kind)) {
        if (visual.dataset.iconKind !== kind) {
          visual.replaceChildren(UiControl.icon(this.document, kind));
          visual.dataset.iconKind = kind;
        }
        return;
      }
      const action = this.orderedWatchActions(this.currentActions).find((item) => item.kind === kind);
      if (action) this.updateActionVisual(visual, action);
      else visual.replaceChildren();
    }

    /** Creates the first control in the rail action group. */
    createRailLocate() {
      this.railLocateButton = this.document.createElement("button");
      this.railLocateButton.type = "button";
      this.railLocateButton.className = "bibilili-action-button bibilili-rail-locate";
      this.railLocateButton.append(UiControl.icon(this.document, RailActionKind.LOCATE));
      this.railLocateButton.setAttribute("aria-controls", LIST_RAIL_ID);
      this.railLocateButton.disabled = true;
      this.railLocateButton.addEventListener("click", () => this.locateCurrentRailItem());
    }

    /** Updates the stable Locate control from the cached displayed-item index. */
    renderRailLocate() {
      if (!this.railLocateButton) return;
      const label = UiStrings.message(UiMessage.RAIL_LOCATE_LABEL, this.language);
      UiControl.setLabel(this.railLocateButton, label);
      this.railLocateButton.disabled = !this.isRailOpen || this.railLocateIndex === -1;
    }

    /** Centers the cached target and renders only its destination rail window. */
    locateCurrentRailItem() {
      if (!this.isRailOpen || !this.railSource || this.railLocateIndex === -1) return;
      this.renderRailWindow({ centerIndex: this.railLocateIndex });
    }

    /** Creates the return-to-start icon immediately after Locate. */
    createRailStart() {
      this.railStartButton = this.document.createElement("button");
      this.railStartButton.type = "button";
      this.railStartButton.className = "bibilili-action-button bibilili-rail-start";
      this.railStartButton.append(UiControl.icon(this.document, RailActionKind.START));
      this.railStartButton.setAttribute("aria-controls", LIST_RAIL_ID);
      this.railStartButton.disabled = true;
      this.railStartButton.addEventListener("click", () => this.scrollRailToStart());
    }

    /** Returns to the first rail window while preserving source and search state. */
    scrollRailToStart() {
      if (!this.isRailOpen || !this.railSource) return;
      this.renderRailWindow({ resetScroll: true });
    }

    /** Updates the Start control's localized label and open-rail availability. */
    renderRailStart(available) {
      if (!this.railStartButton) return;
      UiControl.setLabel(this.railStartButton,
        UiStrings.message(UiMessage.RAIL_START_LABEL, this.language));
      this.railStartButton.disabled = !available;
    }

    /** Creates the selected-source refresh control between Start and Search. */
    createRailRefresh() {
      this.railRefreshButton = this.document.createElement("button");
      this.railRefreshButton.type = "button";
      this.railRefreshButton.className = "bibilili-action-button bibilili-rail-refresh";
      this.railRefreshButton.append(UiControl.icon(this.document, RailActionKind.REFRESH));
      this.railRefreshButton.setAttribute("aria-controls", LIST_RAIL_ID);
      this.railRefreshButton.disabled = true;
      this.railRefreshButton.addEventListener("click", () => this.refreshCurrentRail());
    }

    /** Updates refresh availability and exposes an in-flight source reload. */
    renderRailRefresh() {
      if (!this.railRefreshButton) return;
      const label = UiStrings.message(UiMessage.RAIL_REFRESH_LABEL, this.language);
      UiControl.setLabel(this.railRefreshButton, label);
      this.railRefreshButton.disabled = !this.isRailOpen ||
        !this.selectedSource(this.currentSources) || !this.onRailRefresh ||
        this.isRailRefreshing;
      this.railRefreshButton.setAttribute("aria-busy", String(this.isRailRefreshing));
    }

    /** Reloads the selected source once, preserving the current rail controls. */
    async refreshCurrentRail() {
      const source = this.selectedSource(this.currentSources);
      if (!source || !this.isRailOpen || !this.onRailRefresh || this.isRailRefreshing) return;
      this.isRailRefreshing = true;
      this.pendingSourceMore = null;
      this.renderRailRefresh();
      try {
        await this.onRailRefresh(source);
      } finally {
        this.isRailRefreshing = false;
        this.renderRailRefresh();
      }
    }

    /** Creates stable search controls following Refresh. */
    createRailSearch() {
      this.railSearchControl = new SearchControl(this.document, {
        inputId: "bibilili-rail-search-input",
        className: "bibilili-rail-search",
        buttonClassName: "bibilili-action-button",
        onOpen: () => this.morePanel?.close(false),
        onInput: (query) => {
          this.railSearchQuery = query;
          this.refreshRailSearch();
        },
        onExpandedChange: () => this.renderControlPlacement(),
        escapeFocus: () => this.preferences.pinnedActions[RailActionKind.SEARCH]
          ? this.railSearchButton : this.moreButton?.hidden ? this.settingsButton : this.moreButton
      });
      this.railSearch = this.railSearchControl.root;
      this.railSearchButton = this.railSearchControl.button;
      this.railSearchInput = this.railSearchControl.input;
      this.railSearchInput.setAttribute("aria-controls", LIST_RAIL_ID);
      this.railSearchInput.value = this.railSearchQuery;
      this.setRailSearchExpanded(Boolean(this.railSearchQuery));
    }

    /** @param {boolean} expanded Whether the button presents an editable field. */
    setRailSearchExpanded(expanded) {
      this.railSearchControl?.setExpanded(expanded);
    }

    /** @param {boolean} available Whether a rail is open for searching. */
    renderRailSearch(available) {
      if (!this.railActionGroup) return;
      this.railActionGroup.setAttribute("aria-label",
        UiStrings.message(UiMessage.RAIL_ACTIONS_LABEL, this.language));
      this.renderRailLocate();
      this.renderRailStart(available);
      this.renderRailRefresh();
      this.railSearch.hidden = !available;
      const label = UiStrings.message(this.selectedSourceKind === SourceKind.FAVORITES
        ? UiMessage.FAVORITES_SEARCH_VIDEOS_LABEL : UiMessage.RAIL_SEARCH_LABEL, this.language);
      this.railSearchControl.setLabel(label);
    }

    /** Renders the current query from the start without changing expansion budgets. */
    refreshRailSearch() {
      const source = this.selectedSource(this.currentSources);
      if (source && this.isRailOpen) {
        this.pendingSourceMore = null;
        this.renderRail(this.searchRailSource(source), true);
      }
    }

    /**
     * Filters titles and authors, using the complete retained Watch Later list.
     * @param {VideoListSource} source
     * @returns {VideoListSource}
     */
    searchRailSource(source) {
      const query = this.railSearchQuery.trim().normalize("NFKC").toLowerCase();
      if (!query) return source;
      const searchable = source.kind === SourceKind.WATCH_LATER
        ? this.onWatchLaterSearchSource?.() ?? source
        : source;
      return {
        ...searchable,
        items: searchable.items.filter((item) =>
          [item.title, item.author].some((text) =>
            (text ?? "").normalize("NFKC").toLowerCase().includes(query)))
      };
    }

    /**
     * Renders route buttons for discovered source kinds.
     *
     * @param {VideoListSource[]} sources
     * @param {ActivationControl} activationControl
     */
    renderSourceBar(sources, activationControl) {
      const activationButton = activationControl.mountDocked(
        this.sourceBar,
        true,
        this.language
      );
      const availableKinds = new Set();
      let previous = activationButton;

      for (const source of sources) {
        const button = this.sourceButtonFor(source.kind);
        availableKinds.add(source.kind);
        const label = source.kind === SourceKind.FAVORITES && source.title && !source.isDefaultFolder
          ? UiStrings.message(UiMessage.FAVORITES_SOURCE_LABEL, this.language, [source.title])
          : UiStrings.sourceLabel(source.kind, this.language);
        LayoutRoot.setStableText(button, label);
        UiControl.setLabel(button, label);
        button.setAttribute(
          "aria-current",
          String(this.selectedSourceKind === source.kind)
        );
        button.setAttribute("aria-controls", LIST_RAIL_ID);

        if (this.selectedSourceKind === source.kind) {
          button.setAttribute("aria-expanded", String(this.isRailOpen));
        } else {
          button.removeAttribute("aria-expanded");
        }

        const reference = previous.nextSibling;
        if (reference !== button) {
          this.sourceBar.insertBefore(button, reference);
        }

        previous = button;
        if (source.kind === SourceKind.FAVORITES && this.favoritesView) {
          button.className = "bibilili-source-button bibilili-favorites-source-button";
          const picker = this.favoritesView.launcher();
          picker.setAttribute("data-active", String(this.selectedSourceKind === source.kind && this.isRailOpen));
          UiControl.place(this.sourceBar, picker, previous);
          previous = picker;
        }
      }
      if (!availableKinds.has(SourceKind.FAVORITES)) {
        this.favoritesView?.panel.close();
        this.favoritesView?.button?.remove();
      }

      UiControl.removeStaleButtons(this.sourceButtons, availableKinds);
      this.renderWatchActionGroup(this.currentActions, previous);
    }

    /**
     * Renders mirrored watch action controls after the provided dock control.
     *
     * @param {WatchAction[]} actions
     * @param {Element} placementAnchor
     * @returns {Element | null}
     */
    renderWatchActionGroup(actions, placementAnchor) {
      if (!this.sourceBar || !this.actionGroup) {
        return null;
      }

      const orderedActions = this.orderedWatchActions(actions);
      const availableKinds = new Set();

      if (orderedActions.length === 0) {
        this.actionGroup.remove();
        UiControl.removeStaleButtons(this.actionButtons, availableKinds);
        this.moreWatchGroup.hidden = true;
        return null;
      }

      this.actionGroup.setAttribute(
        "aria-label",
        UiStrings.message(UiMessage.WATCH_ACTIONS_LABEL, this.language)
      );

      const groupReference = placementAnchor.nextSibling;
      if (groupReference !== this.actionGroup) {
        this.sourceBar.insertBefore(this.actionGroup, groupReference);
      }

      let previous = null;
      let morePrevious = null;
      for (const action of orderedActions) {
        const button = this.watchActionButtonFor(action.kind);
        availableKinds.add(action.kind);
        this.updateWatchActionButton(button, action);

        if (this.preferences.pinnedActions[action.kind]) {
          UiControl.place(this.actionGroup, button, previous);
          previous = button;
        } else {
          UiControl.place(this.moreWatchGroup, button, morePrevious);
          morePrevious = button;
        }
      }

      UiControl.removeStaleButtons(this.actionButtons, availableKinds);
      this.actionGroup.hidden = !previous;
      this.moreWatchGroup.hidden = !morePrevious;
      return this.actionGroup;
    }

    /**
     * Orders native and extension-owned watch actions by the closed action set.
     *
     * @param {WatchAction[]} actions
     * @returns {WatchAction[]}
     */
    orderedWatchActions(actions) {
      return WATCH_ACTION_ORDER
        .map((kind) =>
          kind === WatchActionKind.WATCH_LATER
            ? this.currentWatchLaterAction(
                actions.find((action) => action.kind === kind) ?? null
              )
            : actions.find((action) => action.kind === kind)
        )
        .filter(Boolean);
    }

    /**
     * Returns the current-video watch-later action when the archive is addable.
     *
     * @param {WatchAction | null} nativeAction
     * @returns {WatchAction | null}
     */
    currentWatchLaterAction(nativeAction = null) {
      const state = this.currentWatchLaterAddState();

      if (!state) {
        return null;
      }

      if (
        !LayoutRoot.watchActionHasConnectedVisual(nativeAction) &&
        !this.hasWatchLaterVisualSnapshot()
      ) {
        return null;
      }

      return {
        kind: WatchActionKind.WATCH_LATER,
        trigger: nativeAction?.trigger ?? null,
        visualSource: nativeAction?.visualSource ?? null,
        countText: LayoutRoot.watchLaterAccountCountText(
          this.watchLaterAccountCount,
          this.language
        ),
        countSelectors: nativeAction?.countSelectors ?? [],
        nativeCountText: nativeAction?.countText ?? null,
        labelPattern: nativeAction?.labelPattern ?? null,
        isActive: false,
        watchLaterAddKey: state.key,
        watchLaterAddTargetUrl: state.targetUrl
      };
    }

    /**
     * Returns the add target for the current watch URL.
     *
     * @returns {{ key: string, targetUrl: string } | null}
     */
    currentWatchLaterAddState() {
      const targetUrl = LayoutRoot.currentWatchLaterAddTargetUrl();
      if (!targetUrl) {
        return null;
      }

      const identity = AccountSourceStore.watchLaterAddIdentityForUrl(targetUrl);
      if (!identity) {
        return null;
      }

      return {
        key: identity.key,
        targetUrl
      };
    }

    /**
     * Returns a clean current watch URL suitable for account-list mutation.
     *
     * @returns {string | null}
     */
    static currentWatchLaterAddTargetUrl() {
      return BilibiliRoute.shareUrlFor(window.location.href);
    }

    /**
     * Returns the keyed dock button for one watch action.
     *
     * @param {string} kind
     * @returns {HTMLButtonElement}
     */
    watchActionButtonFor(kind) {
      const existing = this.actionButtons.get(kind);
      if (existing) {
        return existing;
      }

      const button = UiControl.button(
        this.document,
        "bibilili-action-button",
        () => {
          this.handleWatchActionButtonClick(kind);
        }
      );
      button.dataset.watchActionKind = kind;
      button.append(this.watchActionNativeVisualNode());
      button.append(this.watchActionCountNode());
      const label = this.document.createElement("span");
      label.className = "bibilili-action-label";
      button.append(label);
      const loading = LoadingView.create(this.document, {
        className: "bibilili-action-loading bibilili-loading-overlay",
        inline: true
      });
      loading.setAttribute("aria-hidden", "true");
      button.append(loading);
      this.actionButtons.set(kind, button);
      return button;
    }

    /**
     * Creates the native visual wrapper used by one watch action button.
     *
     * @returns {HTMLSpanElement}
     */
    watchActionNativeVisualNode() {
      return UiControl.actionVisual(this.document);
    }

    /**
     * Creates the count node used by one watch action button.
     *
     * @returns {HTMLSpanElement}
     */
    watchActionCountNode() {
      const count = this.document.createElement("span");
      count.className = "bibilili-action-count";
      return count;
    }

    /**
     * Updates a watch action button in place.
     *
     * @param {HTMLButtonElement} button
     * @param {WatchAction} action
     */
    updateWatchActionButton(button, action) {
      button.querySelector(".bibilili-action-label").textContent = this.actionLabel(action.kind);
      if (action.kind === WatchActionKind.WATCH_LATER) {
        this.updateCurrentWatchLaterActionButton(button, action);
        return;
      }

      const visual = button.querySelector(".bibilili-action-native-visual");
      const count = button.querySelector(".bibilili-action-count");

      this.updateActionVisual(visual, action);
      count.textContent = action.countText ?? "";
      count.hidden = !action.countText;
      this.syncWatchActionButtonState(button, action);
    }

    /**
     * Hides stale counts and pressed state from accessibility during navigation.
     * Watch-later mutations retain their independent disabled state after reveal.
     *
     * @param {HTMLButtonElement} button
     * @param {WatchAction | undefined} [action] Freshly discovered action state.
     */
    syncWatchActionButtonState(button, action) {
      const kind = button.dataset.watchActionKind;
      const key = button.dataset.bibililiWatchLaterAddKey;
      button.disabled = this.isVideoLoading || (
        kind === WatchActionKind.WATCH_LATER && (!key || this.pendingWatchLaterAddKeys.has(key))
      );
      button.setAttribute("aria-busy", String(this.isVideoLoading));
      const count = button.querySelector(".bibilili-action-count");
      UiControl.setLabel(button, UiStrings.watchActionButtonLabel(
        kind,
        this.isVideoLoading ? null : count?.textContent,
        this.language
      ));
      if (!this.isVideoLoading && WATCH_ACTION_STATEFUL_KINDS.has(kind)) {
        const current = action ?? this.currentActions.find((candidate) => candidate.kind === kind);
        button.setAttribute("aria-pressed", String(Boolean(current?.isActive)));
      } else {
        button.removeAttribute("aria-pressed");
      }
    }

    /**
     * Updates the current-video watch-later button in place.
     *
     * @param {HTMLButtonElement} button
     * @param {WatchAction} action
     */
    updateCurrentWatchLaterActionButton(button, action) {
      const visual = button.querySelector(".bibilili-action-native-visual");
      const count = button.querySelector(".bibilili-action-count");
      const key = action.watchLaterAddKey ?? "";
      const countText = action.countText ?? "";

      button.dataset.bibililiWatchLaterAction = WatchLaterCardAction.ADD;
      button.dataset.bibililiWatchLaterAddKey = key;
      button.dataset.bibililiWatchLaterAddTargetUrl =
        action.watchLaterAddTargetUrl ?? "";

      button.hidden = !this.updateActionVisual(visual, action);
      count.textContent = countText;
      count.hidden = !countText;
      this.syncWatchActionButtonState(button, action);
    }

    /**
     * Renders the native-cloned current-video watch-later visual.
     *
     * @param {Element} visual
     * @param {WatchAction} action
     * @returns {boolean}
     */
    updateCurrentWatchLaterActionVisual(visual, action) {
      visual.replaceChildren();
      visual.removeAttribute("data-bibilili-fallback");

      const fragment = LayoutRoot.watchActionVisualFragment(
        this.document,
        action
      );

      if (fragment) {
        visual.append(fragment);
        this.rememberWatchLaterVisualSnapshot(WatchLaterCardAction.ADD, visual);
        return true;
      }

      if (this.hasWatchLaterVisualSnapshot(WatchLaterCardAction.ADD)) {
        visual.replaceChildren(
          ...this.watchLaterVisualSnapshotNodes(WatchLaterCardAction.ADD)
        );
        return true;
      }

      return false;
    }

    /**
     * Formats the account watch-later count for the dock action.
     *
     * @param {number | null} count
     * @param {string} language
     * @returns {string | null}
     */
    static watchLaterAccountCountText(count, language) {
      return count === null
        ? null
        : AccountSourceAdapter.compactNumber(count, language);
    }

    /**
     * Returns true when one native action can supply cloneable visual nodes.
     *
     * @param {WatchAction | null} action
     * @returns {boolean}
     */
    static watchActionHasConnectedVisual(action) {
      return Boolean(
        action &&
          (action.visualSource?.isConnected || action.trigger?.isConnected)
      );
    }

    /**
     * Returns true when this page session has a cloned watch-later visual.
     *
     * @returns {boolean}
     */
    hasWatchLaterVisualSnapshot(action = WatchLaterCardAction.ADD) {
      return (
        action === WatchLaterCardAction.ADD &&
        this.watchLaterVisualSnapshot.length > 0
      );
    }

    /**
     * Returns true when a card mutation button can render a visual.
     *
     * @param {string} action
     * @returns {boolean}
     */
    hasWatchLaterActionVisual(action) {
      return (
        this.hasWatchLaterVisualSnapshot(action) ||
        action === WatchLaterCardAction.DELETE
      );
    }

    /**
     * Stores cloneable watch-later visual nodes for later lazy reconciles.
     *
     * @param {string} action
     * @param {Element} visual
     */
    rememberWatchLaterVisualSnapshot(action, visual) {
      if (action !== WatchLaterCardAction.ADD) {
        return;
      }

      const key = visual.innerHTML;

      if (key === this.watchLaterVisualSnapshotKey) {
        return;
      }

      this.watchLaterVisualSnapshotKey = key;
      this.watchLaterVisualSnapshot = Array.from(visual.childNodes).map(
        (node) => node.cloneNode(true)
      );
    }

    /**
     * Returns fresh clones of the captured native watch-later visual.
     *
     * @param {string} action
     * @returns {Node[]}
     */
    watchLaterVisualSnapshotNodes(action) {
      return action === WatchLaterCardAction.ADD
        ? this.watchLaterVisualSnapshot.map((node) => node.cloneNode(true))
        : [];
    }

    /**
     * Returns the visual identity for one card mutation action.
     *
     * @param {string} action
     * @returns {string}
     */
    watchLaterActionVisualKey(action) {
      return action === WatchLaterCardAction.DELETE
        ? WATCH_LATER_DELETE_LOCAL_ICON_KEY
        : this.watchLaterVisualSnapshotKey;
    }

    /**
     * Returns fresh visual nodes for one card mutation action.
     *
     * @param {string} action
     * @returns {Node[]}
     */
    watchLaterActionVisualNodes(action) {
      if (action === WatchLaterCardAction.DELETE) {
        return [LayoutRoot.watchLaterDeleteLocalIcon(this.document)];
      }

      return this.watchLaterVisualSnapshotNodes(action);
    }

    /**
     * Builds the extension-owned trash icon used for watch-later deletions.
     *
     * @param {Document} document
     * @returns {SVGSVGElement}
     */
    static watchLaterDeleteLocalIcon(document) {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      const path = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path"
      );

      svg.classList.add("bibilili-card-watch-later-delete-icon");
      svg.setAttribute("viewBox", "0 0 16 16");
      svg.setAttribute("width", "16");
      svg.setAttribute("height", "16");
      svg.setAttribute("fill", "none");
      svg.setAttribute("aria-hidden", "true");
      svg.setAttribute("focusable", "false");
      path.setAttribute(
        "d",
        "M3 4.6h10M6.25 4.6V3.35h3.5V4.6M4.35 6.15l.45 6.25c.06.78.71 1.4 1.49 1.4h3.42c.78 0 1.43-.62 1.49-1.4l.45-6.25M6.75 7.65v3.8M9.25 7.65v3.8"
      );
      path.setAttribute("stroke", "currentColor");
      path.setAttribute("stroke-width", "1.45");
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("stroke-linejoin", "round");
      svg.append(path);

      return svg;
    }

    /**
     * Updates a mirrored action button with sanitized native visual markup.
     *
     * @param {Element} visual
     * @param {WatchAction} action
     */
    updateActionVisual(visual, action) {
      if (action.kind === WatchActionKind.WATCH_LATER) {
        return this.updateCurrentWatchLaterActionVisual(visual, action);
      }
      visual.replaceChildren();
      visual.removeAttribute("data-bibilili-fallback");

      const fragment = LayoutRoot.watchActionVisualFragment(
        this.document,
        action
      );
      if (fragment) {
        visual.append(fragment);
      } else {
        visual.dataset.bibililiFallback = "true";
        visual.textContent = UiStrings.watchActionLabel(
          action.kind,
          this.language
        );
      }

      if (action.kind === WatchActionKind.SHARE) {
        LayoutRoot.insertWatchActionCopyIcon(this.document, visual);
      }
      return true;
    }

    /**
     * Activates a dock watch action.
     *
     * @param {string} kind
     */
    handleWatchActionButtonClick(kind) {
      if (this.isVideoLoading) return;
      const action = this.currentActions.find(
        (candidate) => candidate.kind === kind
      );

      if (kind === WatchActionKind.SHARE) {
        this.copyCurrentWatchUrl();
        return;
      }

      if (kind === WatchActionKind.WATCH_LATER) {
        this.handleCurrentWatchLaterAddClick();
        return;
      }

      if (!action?.trigger?.isConnected) {
        return;
      }

      LayoutRoot.clickNativeTrigger(action.trigger);
      LayoutRoot.liftNativeWatchActionOverlay(kind, action.trigger);
      this.onWatchActionForward?.();
    }

    /**
     * Adds the current watch video to the account watch-later list.
     */
    handleCurrentWatchLaterAddClick() {
      const button = this.actionButtons.get(WatchActionKind.WATCH_LATER);
      const state = this.currentWatchLaterAddState();

      if (
        this.isVideoLoading || !state ||
        !this.onWatchLaterAdd ||
        this.pendingWatchLaterAddKeys.has(state.key)
      ) {
        return;
      }

      this.pendingWatchLaterAddKeys.add(state.key);

      if (button?.isConnected) {
        button.disabled = true;
      }

      this.onWatchLaterAdd(state.targetUrl)
        .then(() => {
          this.pendingWatchLaterAddKeys.delete(state.key);
          this.completedWatchLaterAddKeys.add(state.key);
          this.rerenderSourceDock();
        })
        .catch(() => {
          this.pendingWatchLaterAddKeys.delete(state.key);

          if (button?.isConnected) {
            this.syncWatchActionButtonState(button);
          }
        });
    }

    /**
     * Re-renders source controls with current layout state.
     */
    rerenderSourceDock() {
      if (!this.currentActivationControl) {
        return;
      }

      this.renderSourceDock(this.currentSources, this.currentActivationControl);
    }

    /**
     * Activates the native account control from the comment composer avatar.
     *
     * @param {Element} trigger
     */
    static activateNativeAccountControl(trigger) {
      LayoutRoot.clickNativeTrigger(
        LayoutRoot.nativeAccountActivationTarget(trigger)
      );
      LayoutRoot.scheduleNativeOverlayLift(() => {
        LayoutRoot.liftNativeAccountPopover(trigger);
      });
    }

    /**
     * Returns the best click target inside the native account control.
     *
     * @param {Element} trigger
     * @returns {Element}
     */
    static nativeAccountActivationTarget(trigger) {
      const wrap = LayoutRoot.nativeAccountWrap(trigger);
      return (
        DomProbe.queryAll(wrap, "a[href], button, [role='button']").find(
          (element) => !DomProbe.isOwned(element)
        ) ?? trigger
      );
    }

    /**
     * Lifts Bilibili's native account popover above the transformed viewport.
     *
     * @param {Element} trigger
     */
    static liftNativeAccountPopover(trigger) {
      const popover = LayoutRoot.accountPopoverForTrigger(trigger);

      if (popover) {
        LayoutRoot.markNativeOverlay(popover);
      }
    }

    /**
     * Finds the native account popover paired with the header account trigger.
     *
     * @param {Element} trigger
     * @returns {Element | null}
     */
    static accountPopoverForTrigger(trigger) {
      const wrap = LayoutRoot.nativeAccountWrap(trigger);
      const directChild =
        Array.from(wrap.children).find((child) =>
          child.matches(ACCOUNT_POPOVER_SELECTOR)
        ) ?? null;

      if (directChild) {
        return directChild;
      }

      if (wrap.nextElementSibling?.matches(ACCOUNT_POPOVER_SELECTOR)) {
        return wrap.nextElementSibling;
      }

      const document = trigger.ownerDocument;
      return (
        document.querySelector(".right-entry .header-avatar-wrap + .v-popover") ||
        document.querySelector(".right-entry .header-avatar-wrap .v-popover") ||
        document.querySelector(".right-entry .avatar-panel-popover") ||
        document.querySelector(".bili-header .header-avatar-wrap + .v-popover") ||
        document.querySelector(".bili-header .header-avatar-wrap .v-popover") ||
        document.querySelector(".bili-header .avatar-panel-popover") ||
        document.querySelector(".header-avatar-wrap + .v-popover") ||
        document.querySelector(".header-avatar-wrap > .v-popover") ||
        document.querySelector(".header-avatar-wrap .avatar-panel-popover")
      );
    }

    /**
     * Returns the native account wrapper for a header account trigger.
     *
     * @param {Element} trigger
     * @returns {Element}
     */
    static nativeAccountWrap(trigger) {
      return trigger.closest(".header-avatar-wrap, .v-popover-wrap") ?? trigger;
    }

    /**
     * Tests the conservative top-left current-user avatar fallback rectangle.
     *
     * @param {MouseEvent} event
     * @param {Element} element
     * @param {number | null} [bottomOffset]
     * @returns {boolean}
     */
    static isPointInsideCommentAvatarFallback(event, element, bottomOffset = null) {
      const rect = element.getBoundingClientRect();
      const width = Math.min(COMMENT_ACCOUNT_AVATAR_FALLBACK_WIDTH, rect.width);
      const unclampedHeight = Math.min(
        COMMENT_ACCOUNT_AVATAR_FALLBACK_HEIGHT,
        rect.height
      );
      const height =
        bottomOffset === null
          ? unclampedHeight
          : Math.min(unclampedHeight, Math.max(0, bottomOffset));

      return (
        width > 0 &&
        height > 0 &&
        event.clientX >= rect.left &&
        event.clientX < rect.left + width &&
        event.clientY >= rect.top &&
        event.clientY < rect.top + height
      );
    }

    /**
     * Lifts native watch-action overlays above the transformed viewport.
     *
     * @param {string} kind
     * @param {Element} trigger
     */
    static liftNativeWatchActionOverlay(kind, trigger) {
      if (
        kind !== WatchActionKind.COIN &&
        kind !== WatchActionKind.FAVORITE
      ) {
        return;
      }

      const document = trigger.ownerDocument;
      LayoutRoot.scheduleNativeOverlayLift(() => {
        const dialog = LayoutRoot.watchActionDialog(kind, document);

        if (dialog) {
          LayoutRoot.markNativeOverlay(dialog);
        }
      });
    }

    /**
     * Lifts page-owned comment overlays opened from the comment pane.
     *
     * @param {Event} event
     */
    static liftNativeCommentOverlayFromEvent(event) {
      const target = DomProbe.eventElement(event);

      if (!LayoutRoot.isCommentImagePreviewTrigger(target)) {
        return;
      }

      const document = target.ownerDocument;
      LayoutRoot.scheduleNativeOverlayLift(() => {
        for (const overlay of LayoutRoot.commentImagePreviewOverlays(document)) {
          LayoutRoot.markNativeOverlay(overlay);
        }
      });
    }

    /**
     * Returns true when a comment click can open an image preview.
     *
     * @param {Element | null} target
     * @returns {boolean}
     */
    static isCommentImagePreviewTrigger(target) {
      if (!target) {
        return false;
      }

      const image = target.closest("img, picture, [style*='background']");

      if (!image) {
        return false;
      }

      const source = LayoutRoot.commentImagePreviewSource(image);

      return Boolean(
        source && COMMENT_IMAGE_PREVIEW_URL_PATTERN.test(source)
      );
    }

    /**
     * Returns an image source from a possible comment image target.
     *
     * @param {Element} target
     * @returns {string | null}
     */
    static commentImagePreviewSource(target) {
      if (target instanceof HTMLImageElement) {
        return target.currentSrc || target.src || target.getAttribute("src");
      }

      const image = target.querySelector("img");

      if (image instanceof HTMLImageElement) {
        return image.currentSrc || image.src || image.getAttribute("src");
      }

      return window.getComputedStyle(target).backgroundImage;
    }

    /**
     * Finds comment image preview overlays created by Bilibili.
     *
     * @param {Document} document
     * @returns {Element[]}
     */
    static commentImagePreviewOverlays(document) {
      const overlays = [];

      for (const candidate of DomProbe.queryAll(
        document,
        COMMENT_IMAGE_PREVIEW_SELECTOR
      )) {
        if (!LayoutRoot.hasCommentImagePreviewSource(candidate)) {
          continue;
        }

        overlays.push(LayoutRoot.commentImagePreviewOverlay(candidate));
      }

      return DomProbe.unique(overlays);
    }

    /**
     * Returns true when an overlay candidate contains a comment preview image.
     *
     * @param {Element} candidate
     * @returns {boolean}
     */
    static hasCommentImagePreviewSource(candidate) {
      const sources = [
        LayoutRoot.commentImagePreviewSource(candidate),
        ...DomProbe.queryAll(candidate, "img").map((image) =>
          LayoutRoot.commentImagePreviewSource(image)
        )
      ];

      return sources.some((source) =>
        Boolean(source && COMMENT_IMAGE_PREVIEW_URL_PATTERN.test(source))
      );
    }

    /**
     * Returns the root overlay node for a comment image preview candidate.
     *
     * @param {Element} candidate
     * @returns {Element}
     */
    static commentImagePreviewOverlay(candidate) {
      return (
        candidate.closest(
          ".pswp, .bili-dialog-m, .bili-dialog-bomb, [class*='modal'], [class*='Modal']"
        ) ?? candidate
      );
    }

    /**
     * Runs a native-overlay lift after common Bilibili popover settle points.
     *
     * @param {() => void} lift
     */
    static scheduleNativeOverlayLift(lift) {
      for (const delay of NATIVE_OVERLAY_SETTLE_DELAYS_MS) {
        window.setTimeout(lift, delay);
      }
    }

    /**
     * Finds a native dialog opened by a mirrored watch action.
     *
     * @param {string} kind
     * @param {Document} document
     * @returns {Element | null}
     */
    static watchActionDialog(kind, document) {
      if (kind === WatchActionKind.COIN) {
        return LayoutRoot.coinDialog(document);
      }

      if (kind === WatchActionKind.FAVORITE) {
        return LayoutRoot.favoriteDialog(document);
      }

      return null;
    }

    /**
     * Finds Bilibili's coin dialog after the coin action opens it.
     *
     * Note: Bilibili renders the coin view as a global `bili-dialog-m` overlay
     * on watch pages and as `coin-dialog-mask` in adjacent page variants.
     *
     * @param {Document} document
     * @returns {Element | null}
     */
    static coinDialog(document) {
      const content = document.querySelector(COIN_DIALOG_CONTENT_SELECTOR);

      return content ? LayoutRoot.watchActionDialogRoot(content) : null;
    }

    /**
     * Finds Bilibili's favorite-folder dialog after the favorite action opens it.
     *
     * Note: Bilibili renders the favorite dialog as a global `bili-dialog-m`
     * overlay whose body uses collection-specific classes.
     *
     * @param {Document} document
     * @returns {Element | null}
     */
    static favoriteDialog(document) {
      const content = document.querySelector(FAVORITE_DIALOG_CONTENT_SELECTOR);

      return content ? LayoutRoot.watchActionDialogRoot(content) : null;
    }

    /**
     * Returns the stackable root for a native watch-action dialog.
     *
     * @param {Element} content
     * @returns {Element}
     */
    static watchActionDialogRoot(content) {
      return content.closest(WATCH_ACTION_DIALOG_ROOT_SELECTOR) ?? content;
    }

    /**
     * Marks a native overlay so it can paint over the transformed viewport.
     *
     * @param {Element} element
     */
    static markNativeOverlay(element) {
      element.setAttribute(NATIVE_OVERLAY_ATTR, "true");

      if (window.getComputedStyle(element).position === "static") {
        element.setAttribute(NATIVE_OVERLAY_POSITION_ATTR, "true");
      } else {
        element.removeAttribute(NATIVE_OVERLAY_POSITION_ATTR);
      }
    }

    /**
     * Removes overlay lift markers from page-owned overlay nodes.
     *
     * @param {Document} document
     */
    static clearNativeOverlayLift(document) {
      for (const element of DomProbe.queryAll(
        document,
        `[${NATIVE_OVERLAY_ATTR}]`
      )) {
        element.removeAttribute(NATIVE_OVERLAY_ATTR);
        element.removeAttribute(NATIVE_OVERLAY_POSITION_ATTR);
      }
    }

    /**
     * Copies the clean current watch URL for the dock share action.
     */
    copyCurrentWatchUrl() {
      const shareUrl =
        BilibiliRoute.shareUrlFor(window.location.href) ?? window.location.href;

      LayoutRoot.copyTextToClipboard(this.document, shareUrl).catch(
        () => undefined
      );
    }

    /**
     * Dispatches native click behavior from the page-owned trigger.
     *
     * @param {Element} trigger
     */
    static clickNativeTrigger(trigger) {
      if (typeof trigger.click === "function") {
        trigger.click();
        return;
      }

      trigger.dispatchEvent(
        new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          view: window
        })
      );
    }

    /**
     * Copies text with the clipboard API or a textarea fallback.
     *
     * @param {Document} document
     * @param {string} text
     * @returns {Promise<void>}
     */
    static async copyTextToClipboard(document, text) {
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(text);
          return;
        } catch (_error) {
          // Fall through to the legacy copy path for browsers that expose but
          // reject the async clipboard API in content scripts.
        }
      }

      LayoutRoot.copyTextWithTextarea(document, text);
    }

    /**
     * Copies text through a temporary document selection.
     *
     * @param {Document} document
     * @param {string} text
     */
    static copyTextWithTextarea(document, text) {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.setAttribute("readonly", "true");
      textarea.style.position = "fixed";
      textarea.style.inset = "0 auto auto 0";
      textarea.style.width = "1px";
      textarea.style.height = "1px";
      textarea.style.opacity = "0";
      document.body.append(textarea);
      textarea.select();
      textarea.setSelectionRange(0, text.length);

      const didCopy =
        typeof document.execCommand === "function" &&
        document.execCommand("copy");
      textarea.remove();

      if (!didCopy) {
        throw new Error("Copy command failed");
      }
    }

    /**
     * Creates the copy icon shown by the dock share action on hover.
     *
     * @param {Document} document
     * @returns {SVGSVGElement}
     */
    static watchActionCopyIcon(document) {
      const svg = document.createElementNS(SVG_NS, "svg");
      svg.classList.add("bibilili-action-copy-icon");
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("aria-hidden", "true");
      svg.setAttribute("focusable", "false");
      LayoutRoot.appendWatchActionCopyPaths(document, svg);
      return svg;
    }

    /**
     * Installs the copy mark inside the cloned native share icon when possible.
     *
     * @param {Document} document
     * @param {Element} visual
     */
    static insertWatchActionCopyIcon(document, visual) {
      const nativeIcon = visual.querySelector(
        "[data-bibilili-action-icon-clone='true']"
      );
      const nativeSvg = LayoutRoot.watchActionSvgIconTarget(nativeIcon);

      if (nativeSvg) {
        LayoutRoot.installWatchActionCopyMark(document, nativeSvg);
        return;
      }

      const icon = LayoutRoot.watchActionCopyIcon(document);

      if (nativeIcon?.parentNode) {
        nativeIcon.setAttribute(
          "data-bibilili-action-fallback-icon-clone",
          "true"
        );
        nativeIcon.parentNode.insertBefore(icon, nativeIcon.nextSibling);
        return;
      }

      visual.prepend(icon);
    }

    /**
     * Returns the SVG element that should own the share hover copy mark.
     *
     * @param {Element | null} nativeIcon
     * @returns {SVGElement | null}
     */
    static watchActionSvgIconTarget(nativeIcon) {
      if (!nativeIcon) {
        return null;
      }

      if (nativeIcon.matches("svg")) {
        return nativeIcon;
      }

      return nativeIcon.querySelector("svg");
    }

    /**
     * Adds a hidden copy mark to the native-cloned share SVG.
     *
     * @param {Document} document
     * @param {SVGElement} svg
     */
    static installWatchActionCopyMark(document, svg) {
      for (const child of Array.from(svg.children)) {
        child.setAttribute("data-bibilili-action-native-icon-part", "true");
      }

      const mark = document.createElementNS(SVG_NS, "g");
      const transform = LayoutRoot.watchActionCopyMarkTransform(svg);

      if (transform) {
        mark.setAttribute("transform", transform);
      }

      mark.classList.add("bibilili-action-copy-mark");
      LayoutRoot.appendWatchActionCopyPaths(document, mark);
      svg.append(mark);
    }

    /**
     * Returns a transform that fits the 24-unit copy mark to a native SVG.
     *
     * @param {SVGElement} svg
     * @returns {string | null}
     */
    static watchActionCopyMarkTransform(svg) {
      const viewBox = svg.viewBox?.baseVal;

      if (!viewBox?.width || !viewBox.height) {
        return null;
      }

      const scale = Math.min(viewBox.width, viewBox.height) / 24;
      const x = viewBox.x + (viewBox.width - 24 * scale) / 2;
      const y = viewBox.y + (viewBox.height - 24 * scale) / 2;

      if (
        Math.abs(scale - 1) < 0.001 &&
        Math.abs(x) < 0.001 &&
        Math.abs(y) < 0.001
      ) {
        return null;
      }

      return `translate(${LayoutRoot.svgNumber(x)} ${LayoutRoot.svgNumber(
        y
      )}) scale(${LayoutRoot.svgNumber(scale)})`;
    }

    /**
     * Formats a small SVG transform number.
     *
     * @param {number} value
     * @returns {string}
     */
    static svgNumber(value) {
      return Number(value.toFixed(4)).toString();
    }

    /**
     * Appends copy-symbol paths to an SVG container.
     *
     * @param {Document} document
     * @param {SVGElement} container
     */
    static appendWatchActionCopyPaths(document, container) {
      for (const pathData of [
        "M8 8.5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2v-8Z",
        "M5 15.5V6.5a2 2 0 0 1 2-2h8"
      ]) {
        const path = document.createElementNS(SVG_NS, "path");
        path.setAttribute("d", pathData);
        container.append(path);
      }
    }

    /**
     * Builds a sanitized clone of native action visuals.
     *
     * @param {Document} document
     * @param {WatchAction} action
     * @returns {DocumentFragment | null}
     */
    static watchActionVisualFragment(document, action) {
      const source = action.visualSource?.isConnected
        ? action.visualSource
        : action.trigger;
      const fragment = document.createDocumentFragment();

      if (!source?.isConnected) {
        return null;
      }

      for (const child of source.childNodes) {
        const clone = LayoutRoot.safeWatchActionVisualClone(
          document,
          child,
          action
        );

        if (clone && LayoutRoot.hasWatchActionVisualContent(clone)) {
          fragment.append(clone);
        }
      }

      if (!fragment.hasChildNodes()) {
        const text =
          action.kind === WatchActionKind.WATCH_LATER
            ? ""
            : DomProbe.compactText(source);

        if (text) {
          fragment.append(document.createTextNode(text));
        }
      }

      return LayoutRoot.hasRequiredWatchActionVisualContent(fragment, action)
        ? fragment
        : null;
    }

    /**
     * Clones one native visual node while removing interactive behavior.
     *
     * @param {Document} document
     * @param {Node} node
     * @param {WatchAction} action
     * @returns {Node | null}
     */
    static safeWatchActionVisualClone(document, node, action) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = (node.textContent ?? "").trim();

        if (!text || LayoutRoot.shouldDropWatchActionVisualText(text, action)) {
          return null;
        }

        return document.createTextNode(node.textContent);
      }

      if (!(node instanceof Element)) {
        return null;
      }

      if (LayoutRoot.isWatchActionTextOnlySource(node, action)) {
        return null;
      }

      const clone = LayoutRoot.createWatchActionVisualElement(document, node);

      for (const attribute of Array.from(node.attributes)) {
        if (!LayoutRoot.shouldCopyWatchActionVisualAttribute(attribute)) {
          continue;
        }

        clone.setAttribute(attribute.name, attribute.value);
      }

      if (LayoutRoot.isWatchActionCountSource(node, action)) {
        clone.dataset.bibililiActionCountClone = "true";
      }

      if (LayoutRoot.isWatchActionIconSource(node)) {
        clone.dataset.bibililiActionIconClone = "true";
      }

      for (const child of node.childNodes) {
        const childClone = LayoutRoot.safeWatchActionVisualClone(
          document,
          child,
          action
        );

        if (childClone) {
          clone.append(childClone);
        }
      }

      return clone;
    }

    /**
     * Creates a non-interactive element for a native visual clone.
     *
     * @param {Document} document
     * @param {Element} source
     * @returns {Element}
     */
    static createWatchActionVisualElement(document, source) {
      if (WATCH_ACTION_CLONE_INTERACTIVE_TAGS.has(source.localName)) {
        return document.createElement("span");
      }

      if (
        source.namespaceURI &&
        source.namespaceURI !== document.documentElement.namespaceURI
      ) {
        return document.createElementNS(source.namespaceURI, source.localName);
      }

      return document.createElement(source.localName);
    }

    /**
     * Returns true when a native visual attribute is safe for a clone.
     *
     * @param {Attr} attribute
     * @returns {boolean}
     */
    static shouldCopyWatchActionVisualAttribute(attribute) {
      const name = attribute.name.toLowerCase();

      return (
        !name.startsWith("on") &&
        !WATCH_ACTION_CLONE_REMOVED_ATTRIBUTES.has(name) &&
        name !== "contenteditable" &&
        name !== "xlink:href"
      );
    }

    /**
     * Returns true when a cloned node can produce visible action content.
     *
     * @param {Node} node
     * @returns {boolean}
     */
    static hasWatchActionVisualContent(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        return Boolean((node.textContent ?? "").trim());
      }

      if (node instanceof Element) {
        return (
          node.matches("svg, path, use, img, picture, canvas") ||
          Boolean(node.querySelector("svg, path, use, img, picture, canvas")) ||
          Boolean(DomProbe.compactText(node))
        );
      }

      return Array.from(node.childNodes).some((child) =>
        LayoutRoot.hasWatchActionVisualContent(child)
      );
    }

    /**
     * Returns true when a cloned visual has the content required for an action.
     *
     * @param {Node} node
     * @param {WatchAction} action
     * @returns {boolean}
     */
    static hasRequiredWatchActionVisualContent(node, action) {
      return action.kind === WatchActionKind.WATCH_LATER
        ? LayoutRoot.hasWatchActionIconContent(node)
        : LayoutRoot.hasWatchActionVisualContent(node);
    }

    /**
     * Returns true when a clone contains icon-like visual content.
     *
     * @param {Node} node
     * @returns {boolean}
     */
    static hasWatchActionIconContent(node) {
      if (node instanceof Element) {
        return (
          node.matches("svg, path, use, img, picture, canvas") ||
          Boolean(node.querySelector("svg, path, use, img, picture, canvas")) ||
          Boolean(
            node.querySelector("[data-bibilili-action-icon-clone='true']")
          )
        );
      }

      return Array.from(node.childNodes ?? []).some((child) =>
        LayoutRoot.hasWatchActionIconContent(child)
      );
    }

    /**
     * Returns true when a native node is the action count visual.
     *
     * @param {Element} source
     * @param {WatchAction} action
     * @returns {boolean}
     */
    static isWatchActionCountSource(source, action) {
      const countTexts = LayoutRoot.watchActionCountTexts(action);

      if (countTexts.size === 0) {
        return false;
      }

      const text = DomProbe.compactText(source);

      if (!countTexts.has(text)) {
        return false;
      }

      return action.countSelectors.some((selector) => source.matches(selector));
    }

    /**
     * Returns count strings that should stay outside cloned native visuals.
     *
     * @param {WatchAction} action
     * @returns {Set<string>}
     */
    static watchActionCountTexts(action) {
      return new Set(
        [action.countText, action.nativeCountText].filter(
          (text) => typeof text === "string" && text
        )
      );
    }

    /**
     * Returns true when native text is a count or unwanted watch-later label.
     *
     * @param {string} text
     * @param {WatchAction} action
     * @returns {boolean}
     */
    static shouldDropWatchActionVisualText(text, action) {
      if (LayoutRoot.watchActionCountTexts(action).has(text)) {
        return true;
      }

      if (action.kind !== WatchActionKind.WATCH_LATER) {
        return false;
      }

      return LayoutRoot.watchActionLabelPatternMatches(text, action);
    }

    /**
     * Returns true when text matches the action's native label pattern.
     *
     * @param {string} text
     * @param {WatchAction} action
     * @returns {boolean}
     */
    static watchActionLabelPatternMatches(text, action) {
      const pattern = action.labelPattern;

      if (!(pattern instanceof RegExp)) {
        return false;
      }

      return new RegExp(pattern.source, pattern.flags.replace("g", "")).test(
        text
      );
    }

    /**
     * Returns true when a native node carries only removable action text.
     *
     * @param {Element} source
     * @param {WatchAction} action
     * @returns {boolean}
     */
    static isWatchActionTextOnlySource(source, action) {
      const text = DomProbe.compactText(source);

      return (
        text &&
        LayoutRoot.shouldDropWatchActionVisualText(text, action) &&
        !source.matches("svg, img, picture, canvas") &&
        !source.querySelector("svg, img, picture, canvas")
      );
    }

    /**
     * Returns true when a native node is the action icon visual.
     *
     * @param {Element} source
     * @returns {boolean}
     */
    static isWatchActionIconSource(source) {
      const className = source.getAttribute("class") ?? "";
      const text = DomProbe.compactText(source);

      return (
        source.matches("svg, img, picture, canvas") ||
        /(?:^|[-_\s])icon(?:[-_\s]|$)/iu.test(className) ||
        (!text && Boolean(source.querySelector("svg, img, picture, canvas")))
      );
    }

    /**
     * Returns the keyed source button for a source kind.
     *
     * @param {string} kind
     * @returns {HTMLButtonElement}
     */
    sourceButtonFor(kind) {
      const existing = this.sourceButtons.get(kind);
      if (existing) {
        return existing;
      }

      const button = UiControl.button(
        this.document,
        "bibilili-source-button",
        () => {
          this.handleSourceButtonClick(kind);
        }
      );
      button.dataset.sourceKind = kind;
      this.sourceButtons.set(kind, button);
      return button;
    }

    /**
     * Routes to a source or opens/closes the rail for the current route.
     *
     * @param {string} kind
     */
    handleSourceButtonClick(kind) {
      this.hasUserInteractedWithSources = true;
      this.isDefaultSourceRoute = false;
      this.pendingSourceRouteHint = null;
      this.pendingSourceRouteOpenState = null;

      if (!this.currentActivationControl) {
        return;
      }

      if (!this.currentSources.some((source) => source.kind === kind)) {
        return;
      }

      const source = this.currentSources.find((candidate) => candidate.kind === kind);
      if (kind === SourceKind.FAVORITES && !source.folderId && this.favoritesView) {
        this.favoritesView.open();
        return;
      }
      this.favoritesView?.panel.close();
      if (this.selectedSourceKind === kind) {
        this.isRailOpen = !this.isRailOpen;
      } else {
        this.routeSource(kind);
      }

      this.renderSourceDock(this.currentSources, this.currentActivationControl);
      this.emitSourceRouteChange();
    }

    /**
     * Emits the selected source route state when one is available.
     */
    emitSourceRouteChange() {
      if (!this.selectedSourceKind || !this.onSourceRouteChange) {
        return;
      }

      this.onSourceRouteChange({
        sourceKind: this.selectedSourceKind,
        ...(this.selectedSourceKind === SourceKind.FAVORITES && this.selectedSource(this.currentSources)?.folderId
          ? { folderId: this.selectedSource(this.currentSources).folderId } : {}),
        isRailOpen: this.isRailOpen
      });
    }

    /**
     * Observes viewport changes and protects cards during pointer activation.
     */
    observeRailWindow() {
      const schedule = () => this.scheduleRailRender();
      this.rail.addEventListener("scroll", schedule, { passive: true });
      this.rail.addEventListener("focusin", schedule);
      this.rail.addEventListener("focusout", schedule);
      this.rail.addEventListener("keydown", (event) => {
        this.handleRailKeydown(event);
      });
      this.rail.addEventListener("pointerdown", (event) => {
        this.railPointerCard = event.target.closest?.(".bibilili-video-card") ?? null;
      });
      this.railPointerEndHandler = () => {
        if (this.railPointerCard) {
          this.railPointerCard = null;
          this.scheduleRailRender();
        }
      };
      this.document.addEventListener("pointerup", this.railPointerEndHandler, true);
      this.document.addEventListener("pointercancel", this.railPointerEndHandler, true);
      this.railResizeObserver = new ResizeObserver(schedule);
      this.railResizeObserver.observe(this.rail);
    }

    /**
     * Coalesces scrolling and preview updates without rediscovering page DOM.
     */
    scheduleRailRender() {
      if (this.railRenderFrame !== null || !this.railSource || !this.rail?.isConnected) {
        return;
      }
      this.railRenderFrame = requestAnimationFrame(() => {
        this.railRenderFrame = null;
        this.renderRailWindow();
      });
    }

    /**
     * Releases viewport observers and pending demand when layout ownership ends.
     */
    stopRailWindow() {
      if (this.railRenderFrame !== null) {
        cancelAnimationFrame(this.railRenderFrame);
        this.railRenderFrame = null;
      }
      this.railResizeObserver?.disconnect();
      this.railResizeObserver = null;
      this.document.removeEventListener("pointerup", this.railPointerEndHandler, true);
      this.document.removeEventListener("pointercancel", this.railPointerEndHandler, true);
      this.railPointerEndHandler = null;
      this.railPointerCard = null;
      this.railSource = null;
      this.railEntries = [];
      this.railLocateIndex = -1;
      this.renderRailLocate();
      this.railEntryIndexes.clear();
      this.railStride = 0;
      this.renderedSourceKey = null;
      this.videoPreviews.setDemand([]);
    }

    /**
     * Records the selected source and positions its window for reconciliation.
     *
     * @param {VideoListSource} source
     * @param {boolean} resetScroll
     */
    renderRail(source, resetScroll) {
      if (resetScroll) {
        this.pendingSourceMore = null;
      }

      const sourceKey = LayoutRoot.sourceKey(source);
      const moreInteraction = this.pendingSourceMore?.key === sourceKey
        ? this.pendingSourceMore
        : null;
      const { title } = this.ensureRailSourceGroup(source, resetScroll);
      title.textContent = this.railSearchQuery.trim() && source.items.length === 0
        ? UiStrings.message(UiMessage.RAIL_SEARCH_EMPTY, this.language)
        : source.title ?? UiStrings.sourceLabel(source.kind, this.language);
      this.renderFavoriteRailState(source, title);
      const watchRouteKey = SourceAdapter.currentWatchRouteKey();
      const locateKey = watchRouteKey ? `route:${watchRouteKey}` : null;
      const currentRouteKey = LayoutRoot.sourceLocatesCurrentCard(source.kind)
        ? watchRouteKey
        : null;
      const keyCounts = new Map();
      this.railSource = source;
      this.railEntryIndexes.clear();
      this.railLocateIndex = -1;
      this.railEntries = source.items.map((item, index) => {
        const key = this.videoCardRenderKey(item, keyCounts);
        const itemRouteKey = currentRouteKey
          ? SourceAdapter.watchRouteKeyForUrl(item.targetUrl)
          : null;
        const isCurrent = Boolean(this.currentRailItemMatchReason(
          source.kind,
          item,
          currentRouteKey,
          itemRouteKey
        ));
        if (this.railLocateIndex === -1 && (isCurrent || key === locateKey)) {
          this.railLocateIndex = index;
        }
        this.railEntryIndexes.set(key, index);
        return { item, key, isCurrent };
      });
      this.renderRailLocate();

      let focusIndex = -1;
      if (moreInteraction && source.pagination?.status !== AccountSourceStatus.LOADING) {
        if (
          moreInteraction.keyboard &&
          this.document.activeElement === moreInteraction.button
        ) {
          focusIndex = this.railEntries.findIndex(
            (entry) => !moreInteraction.cardKeys.has(entry.key)
          );
          if (focusIndex === -1 && !source.pagination?.hasMore) {
            focusIndex = this.railEntries.length - 1;
          }
        }
        this.pendingSourceMore = null;
      }

      const currentIndex = this.railEntries.findIndex((entry) => entry.isCurrent);
      let centerIndex = -1;
      if (currentIndex !== -1 && currentRouteKey && !this.railSearchQuery.trim()) {
        if (!moreInteraction && (
          resetScroll || this.locatedCurrentRouteKeys.get(sourceKey) !== currentRouteKey
        )) {
          centerIndex = currentIndex;
        }
        this.locatedCurrentRouteKeys.set(sourceKey, currentRouteKey);
      }
      const saved = source.kind === SourceKind.FAVORITES
        ? this.favoriteRailPositions.get(source.folderId) : undefined;
      if (resetScroll && saved !== undefined) {
        centerIndex = -1;
      }
      this.renderRailWindow({ resetScroll, centerIndex, focusIndex,
        restoredScrollLeft: resetScroll ? saved : undefined });
    }

    /** @param {VideoListSource | null} source @returns {string | null} Stable source instance. */
    static sourceKey(source) {
      if (!source) return null;
      return source.kind === SourceKind.FAVORITES && source.folderId
        ? `${source.kind}:${source.folderId}` : source.kind;
    }

    /** Keeps the horizontal position of each visited folder during the layout session. */
    rememberFavoriteRailPosition() {
      if (this.railSource?.kind === SourceKind.FAVORITES && this.railSource.folderId && this.rail) {
        this.favoriteRailPositions.set(this.railSource.folderId, this.rail.scrollLeft);
      }
    }

    /** Presents folder loading, empty, and recovery states inside the existing rail. */
    renderFavoriteRailState(source, title) {
      if (source.kind !== SourceKind.FAVORITES) return;
      const group = title.parentElement;
      let state = group.querySelector(".bibilili-favorite-rail-state");
      if (!state) {
        state = this.document.createElement("div");
        state.className = "bibilili-favorite-rail-state";
        const text = this.document.createElement("span");
        text.setAttribute("role", "status");
        const button = UiControl.button(this.document, "bibilili-source-button", () => {
          const current = this.selectedSource(this.currentSources);
          if (current?.folderId && current.status === AccountSourceStatus.ERROR) this.refreshCurrentRail();
          else this.favoritesView?.open(true);
        });
        state.append(text, button);
        group.append(state);
      }
      const empty = source.items.length === 0 && !source.pagination?.hasMore;
      state.hidden = !empty;
      const loading = source.status === AccountSourceStatus.LOADING;
      const failed = source.status === AccountSourceStatus.ERROR;
      const message = loading ? UiMessage.SOURCE_MORE_LOADING_LABEL
        : this.railSearchQuery.trim() && !failed ? UiMessage.RAIL_SEARCH_EMPTY
          : source.status === AccountSourceStatus.SIGNED_OUT ? UiMessage.FAVORITES_SIGN_IN_MESSAGE
          : failed ? UiMessage.FAVORITES_ERROR_MESSAGE
            : !source.folderId ? UiMessage.FAVORITES_CHOOSE_LABEL : UiMessage.FAVORITES_EMPTY_MESSAGE;
      LayoutRoot.setStableText(state.firstElementChild, UiStrings.message(message, this.language));
      const button = state.lastChild;
      button.hidden = loading || Boolean(source.folderId && !failed);
      UiControl.setTextButtonLabel(button, UiStrings.message(
        failed ? UiMessage.SOURCE_MORE_RETRY_LABEL : UiMessage.FAVORITES_CHOOSE_LABEL, this.language));
      if (!empty && failed) {
        title.textContent += ` · ${UiStrings.message(UiMessage.FAVORITES_REFRESH_ERROR_MESSAGE, this.language)}`;
      }
    }

    /**
     * Renders visible cards, a small buffer, and any active interaction targets.
     *
     * @param {object} [options]
     * @param {boolean} [options.resetScroll]
     * @param {number} [options.centerIndex] Current item to center before rendering.
     * @param {number} [options.focusIndex] Logical card receiving keyboard focus.
     * @param {boolean} [options.revealFocus] Scroll a keyboard target into view.
     * @param {boolean} [options.focusLastControl] Focus the target's last control.
     * @param {number} [options.restoredScrollLeft] Saved folder offset, applied after row sizing.
     */
    renderRailWindow({
      resetScroll = false,
      centerIndex = -1,
      focusIndex = -1,
      revealFocus = false,
      focusLastControl = false,
      restoredScrollLeft
    } = {}) {
      const source = this.railSource;
      const row = this.rail?.querySelector(".bibilili-card-row");
      if (!source || !row || !this.rail.isConnected) {
        return;
      }

      const preservedScrollLeft = this.rail.scrollLeft;
      const style = getComputedStyle(row);
      const geometry = new RailWindow(
        this.railEntries.length,
        Number.parseFloat(style.getPropertyValue("--bibilili-card-width")),
        Number.parseFloat(style.getPropertyValue("--bibilili-card-gap"))
      );
      const hasMore = source.root === null && Boolean(source.pagination?.hasMore);
      row.style.width = `${geometry.width(hasMore)}px`;
      const rowStart = row.getBoundingClientRect().left -
        this.rail.getBoundingClientRect().left + this.rail.scrollLeft;
      const viewportWidth = this.rail.clientWidth;
      let scrollLeft = restoredScrollLeft ?? (resetScroll ? 0 : preservedScrollLeft);

      if (!resetScroll && this.railStride && this.railStride !== geometry.stride) {
        scrollLeft = rowStart +
          (scrollLeft - rowStart) / this.railStride * geometry.stride;
      }
      if (centerIndex !== -1) {
        scrollLeft = rowStart + geometry.centeredOffset(centerIndex, viewportWidth);
      } else if (revealFocus && focusIndex !== -1) {
        scrollLeft = rowStart + geometry.revealedOffset(
          focusIndex, scrollLeft - rowStart, viewportWidth
        );
      }
      if (this.rail.scrollLeft !== scrollLeft) {
        this.rail.scrollLeft = scrollLeft;
      }
      this.railStride = geometry.stride;

      const previewIndexes = geometry.previewIndexes(
        this.rail.scrollLeft - rowStart, viewportWidth
      );
      this.videoPreviews.setDemand(previewIndexes.map(
        (index) => this.railEntries[index].item
      ));
      const indexes = new Set(previewIndexes);
      const activeElement = this.document.activeElement;
      const activeCard = activeElement?.closest?.(".bibilili-video-card");
      for (const card of [activeCard, this.railPointerCard]) {
        if (card?.parentElement === row) {
          const index = this.railEntryIndexes.get(card.dataset.bibililiCardKey);
          if (index !== undefined) {
            indexes.add(index);
          }
        }
      }
      if (focusIndex !== -1) {
        indexes.add(focusIndex);
      }

      const existingCards = this.videoCardsByKey(row);
      const usedKeys = new Set([...indexes].map((index) => this.railEntries[index].key));
      this.removeStaleVideoCards(row, usedKeys);
      let previous = null;
      let focusCard = null;
      for (const index of [...indexes].sort((left, right) => left - right)) {
        const entry = this.railEntries[index];
        const item = this.videoPreviews.hydrateItem(entry.item);
        let card = existingCards.get(entry.key);
        if (card) {
          this.updateVideoCard(card, item, entry.isCurrent, entry.key, source.kind);
        } else {
          card = this.videoCard(item, entry.isCurrent, entry.key, source.kind);
        }
        if (source.folderId) card.dataset.bibililiCardFolderId = source.folderId;
        else delete card.dataset.bibililiCardFolderId;
        card.dataset.bibililiCardIndex = String(index);
        card.style.left = `${index * geometry.stride}px`;
        const reference = previous ? previous.nextSibling : row.firstChild;
        if (reference !== card) {
          row.insertBefore(card, reference);
        }
        previous = card;
        if (index === focusIndex) {
          focusCard = card;
        }
      }

      if (focusCard) {
        const controls = LayoutRoot.railCardControls(focusCard);
        controls[focusLastControl ? controls.length - 1 : 0]?.focus({ preventScroll: true });
      } else if (activeCard && activeElement.isConnected && this.document.activeElement !== activeElement) {
        activeElement.focus({ preventScroll: true });
      }
      this.renderSourceMore(source, row);
      const moreButton = row.querySelector(".bibilili-source-more-button");
      if (moreButton) {
        moreButton.style.left = `${this.railEntries.length * geometry.stride}px`;
      }
    }

    /**
     * Preserves sequential Tab navigation across unrendered card boundaries.
     *
     * @param {KeyboardEvent} event
     */
    handleRailKeydown(event) {
      if (event.key !== "Tab" || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }
      const card = event.target.closest?.(".bibilili-video-card");
      let focusIndex;
      if (card) {
        const controls = LayoutRoot.railCardControls(card);
        const boundary = controls[event.shiftKey ? 0 : controls.length - 1];
        if (event.target !== boundary) {
          return;
        }
        focusIndex = Number(card.dataset.bibililiCardIndex) + (event.shiftKey ? -1 : 1);
      } else if (event.shiftKey && event.target.matches?.(".bibilili-source-more-button")) {
        focusIndex = this.railEntries.length - 1;
      } else {
        return;
      }
      if (focusIndex < 0 || focusIndex >= this.railEntries.length) {
        return;
      }
      event.preventDefault();
      this.renderRailWindow({ focusIndex, revealFocus: true, focusLastControl: event.shiftKey });
    }

    /**
     * Returns enabled card controls in their native tab order.
     *
     * @param {HTMLElement} card
     * @returns {HTMLElement[]}
     */
    static railCardControls(card) {
      return [...card.querySelectorAll(".bibilili-card-link, .bibilili-card-watch-later-button")]
        .filter((control) => !control.hidden && !control.disabled);
    }

    /**
     * Reuses a trailing account-source button while continuation is available.
     *
     * @param {VideoListSource} source
     * @param {HTMLElement} row
     */
    renderSourceMore(source, row) {
      let button = row.querySelector(".bibilili-source-more-button");
      if (source.root !== null || !source.pagination?.hasMore) {
        button?.remove();
        return;
      }

      if (!button) {
        button = UiControl.button(
          this.document,
          "bibilili-source-more-button",
          (event) => {
            void this.handleSourceMoreClick(source.kind, button, event);
          }
        );
        button.setAttribute("aria-controls", LIST_RAIL_ID);
        row.append(button);
      }

      this.updateSourceMoreButton(button, source.kind, source.pagination.status);
    }

    /**
     * Updates continuation text without dropping focus during a request.
     *
     * @param {HTMLButtonElement} button
     * @param {string} kind
     * @param {string} status
     */
    updateSourceMoreButton(button, kind, status) {
      const loading = status === AccountSourceStatus.LOADING;
      const message = loading
        ? UiMessage.SOURCE_MORE_LOADING_LABEL
        : status === AccountSourceStatus.ERROR
          ? UiMessage.SOURCE_MORE_RETRY_LABEL
          : UiMessage.SOURCE_MORE_LABEL;
      const label = UiStrings.message(message, this.language);
      LayoutRoot.setStableText(button, label);
      UiControl.setLabel(button, UiStrings.message(
        UiMessage.SOURCE_MORE_BUTTON_LABEL,
        this.language,
        [label, UiStrings.sourceLabel(kind, this.language)]
      ));
      button.setAttribute("aria-disabled", String(loading));
      button.setAttribute("aria-busy", String(loading));
    }

    /**
     * Loads more cards and records keyboard focus intent for reconciliation.
     *
     * @param {string} kind
     * @param {HTMLButtonElement} button
     * @param {MouseEvent} event
     * @returns {Promise<void>}
     */
    async handleSourceMoreClick(kind, button, event) {
      if (
        !this.onSourceMore ||
        !button.isConnected ||
        button.getAttribute("aria-disabled") === "true"
      ) {
        return;
      }

      this.pendingSourceMore = {
        key: LayoutRoot.sourceKey(this.railSource),
        button,
        keyboard: event.detail === 0,
        cardKeys: new Set(this.railEntries.map((entry) => entry.key))
      };
      this.updateSourceMoreButton(button, kind, AccountSourceStatus.LOADING);
      await this.onSourceMore(kind);
    }

    /**
     * Returns true when the source can scroll to the current watch route.
     *
     * @param {string} sourceKind
     * @returns {boolean}
     */
    static sourceLocatesCurrentCard(sourceKind) {
      return (
        sourceKind === SourceKind.PARTS ||
        sourceKind === SourceKind.COLLECTION ||
        sourceKind === SourceKind.FAVORITES ||
        sourceKind === SourceKind.WATCH_LATER
      );
    }

    /**
     * Returns true when cards in a source can add archive targets to watch later.
     *
     * @param {string} sourceKind
     * @returns {boolean}
     */
    static sourceSupportsWatchLaterAdd(sourceKind) {
      return (
        sourceKind === SourceKind.COLLECTION ||
        sourceKind === SourceKind.RECOMMENDATIONS ||
        sourceKind === SourceKind.FAVORITES
      );
    }

    /**
     * Returns archive identity keys from the account-backed watch-later source.
     *
     * @param {VideoListSource[]} sources
     * @returns {Set<string>}
     */
    static watchLaterArchiveKeysFor(sources) {
      const watchLaterSource = sources.find(
        (source) =>
          source.kind === SourceKind.WATCH_LATER && source.root === null
      );
      const keys = new Set();

      for (const item of watchLaterSource?.items ?? []) {
        const key = SourceAdapter.archiveIdentityForUrl(item.targetUrl)?.key;

        if (key) {
          keys.add(key);
        }
      }

      return keys;
    }

    /**
     * Ensures the selected-source group exists for the current rail route.
     *
     * @param {VideoListSource} source
     * @param {boolean} resetScroll
     * @returns {{ title: HTMLElement, row: HTMLElement }}
     */
    ensureRailSourceGroup(source, resetScroll) {
      const existingGroup = resetScroll ? null : this.rail.firstElementChild;

      if (
        existingGroup instanceof HTMLElement &&
        existingGroup.classList.contains("bibilili-source-group") &&
        existingGroup.dataset.sourceKind === source.kind
      ) {
        const title = existingGroup.querySelector(".bibilili-source-title");
        const row = existingGroup.querySelector(".bibilili-card-row");

        if (title instanceof HTMLElement && row instanceof HTMLElement) {
          return { title, row };
        }
      }

      this.videoCardStates = new WeakMap();
      this.railPointerCard = null;
      this.railStride = 0;

      const group = this.document.createElement("section");
      group.className = "bibilili-source-group";
      group.dataset.sourceKind = source.kind;

      const title = this.document.createElement("h2");
      title.className = "bibilili-source-title";

      const row = this.document.createElement("div");
      row.className = "bibilili-card-row";

      group.append(title, row);
      this.rail.replaceChildren(group);

      return { title, row };
    }

    /**
     * Returns reusable video cards currently rendered in one card row.
     *
     * @param {HTMLElement} row
     * @returns {Map<string, HTMLElement>}
     */
    videoCardsByKey(row) {
      const cards = new Map();

      for (const child of row.children) {
        if (
          child instanceof HTMLElement &&
          child.classList.contains("bibilili-video-card")
        ) {
          const key = child.dataset.bibililiCardKey;

          if (key && !cards.has(key)) {
            cards.set(key, child);
          }
        }
      }

      return cards;
    }

    /**
     * Builds a stable render key for one card in the current source pass.
     *
     * @param {VideoItem} item
     * @param {Map<string, number>} keyCounts
     * @returns {string}
     */
    videoCardRenderKey(item, keyCounts) {
      const baseKey = LayoutRoot.videoCardBaseRenderKey(item);
      const count = keyCounts.get(baseKey) ?? 0;
      keyCounts.set(baseKey, count + 1);

      return count === 0 ? baseKey : `${baseKey}\n${count + 1}`;
    }

    /**
     * Builds the base render key from the target watch route when available.
     *
     * @param {VideoItem} item
     * @returns {string}
     */
    static videoCardBaseRenderKey(item) {
      const routeKey = SourceAdapter.watchRouteKeyForUrl(item.targetUrl);

      return routeKey
        ? `route:${routeKey}`
        : `item:${item.targetUrl}\n${item.title}`;
    }

    /**
     * Removes card nodes that are absent from the latest source render.
     *
     * @param {HTMLElement} row
     * @param {Set<string>} usedKeys
     */
    removeStaleVideoCards(row, usedKeys) {
      for (const child of Array.from(row.children)) {
        if (
          child instanceof HTMLElement &&
          child.classList.contains("bibilili-video-card") &&
          !usedKeys.has(child.dataset.bibililiCardKey)
        ) {
          child.remove();
        }
      }
    }

    /**
     * Returns the reason an item is the current card for focusable sources.
     *
     * @param {string} sourceKind
     * @param {VideoItem} item
     * @param {string | null} currentRouteKey
     * @param {string | null} itemRouteKey
     * @returns {string | null}
     */
    currentRailItemMatchReason(
      sourceKind,
      item,
      currentRouteKey,
      itemRouteKey
    ) {
      if (sourceKind === SourceKind.COLLECTION && item.isCurrent) {
        return "native-current-marker";
      }

      if (
        LayoutRoot.sourceLocatesCurrentCard(sourceKind) &&
        currentRouteKey &&
        itemRouteKey === currentRouteKey
      ) {
        return "route-key";
      }

      return null;
    }

    /**
     * Creates one extension-owned video card.
     *
     * @param {VideoItem} item
     * @param {boolean} [isCurrent]
     * @param {string} [cardKey]
     * @param {string} [sourceKind]
     * @returns {HTMLElement}
     */
    videoCard(item, isCurrent = false, cardKey = "", sourceKind = "") {
      const card = this.document.createElement("span");
      this.updateVideoCard(card, item, isCurrent, cardKey, sourceKind);
      return card;
    }

    /**
     * Updates one extension-owned video card without replacing its root node.
     *
     * @param {HTMLElement} card
     * @param {VideoItem} item
     * @param {boolean} isCurrent
     * @param {string} cardKey
     * @param {string} sourceKind
     */
    updateVideoCard(card, item, isCurrent, cardKey, sourceKind) {
      const state = this.videoCardRenderState(item, isCurrent);
      const parts = this.videoCardParts(card);

      card.className = "bibilili-video-card";
      card.dataset.bibililiCardKey = cardKey;
      card.dataset.bibililiCardSourceKind = sourceKind;
      card.title = state.title;
      parts.link.href = state.targetUrl;
      parts.link.title = state.title;

      if (isCurrent) {
        card.setAttribute("aria-current", "page");
        parts.link.setAttribute("aria-current", "page");
      } else {
        card.removeAttribute("aria-current");
        parts.link.removeAttribute("aria-current");
      }

      this.updateWatchLaterActionControl(card, parts.watchLaterButton, state);

      const previousState = this.videoCardStates.get(card);
      if (
        previousState &&
        LayoutRoot.sameVideoCardRenderState(previousState, state)
      ) {
        return;
      }

      this.updateVideoCardParts(parts, state);
      this.videoCardStates.set(card, state);
    }

    /**
     * Ensures one video card has stable child nodes for in-place updates.
     *
     * @param {HTMLElement} card
     * @returns {VideoCardParts}
     */
    videoCardParts(card) {
      const existingLink = card.querySelector(".bibilili-card-link");
      const existingThumb = existingLink?.querySelector(".bibilili-card-thumb");
      const existingImage = existingThumb?.querySelector("img");
      const existingPlaceholder = existingThumb?.querySelector(
        ".bibilili-card-placeholder"
      );
      const existingDuration = existingThumb?.querySelector(
        ".bibilili-card-duration"
      );
      const existingTitle = existingLink?.querySelector(".bibilili-card-title");
      const existingMeta = existingLink?.querySelector(".bibilili-card-meta");
      const existingWatchLaterButton = card.querySelector(
        ".bibilili-card-watch-later-button"
      );

      if (
        existingLink instanceof HTMLAnchorElement &&
        existingThumb instanceof HTMLElement &&
        existingImage instanceof HTMLImageElement &&
        existingPlaceholder instanceof HTMLElement &&
        existingDuration instanceof HTMLElement &&
        existingTitle instanceof HTMLElement &&
        existingMeta instanceof HTMLElement &&
        existingWatchLaterButton instanceof HTMLButtonElement
      ) {
        return {
          link: existingLink,
          thumb: existingThumb,
          image: existingImage,
          placeholder: existingPlaceholder,
          duration: existingDuration,
          title: existingTitle,
          meta: existingMeta,
          watchLaterButton: existingWatchLaterButton
        };
      }

      const link = this.document.createElement("a");
      link.className = "bibilili-card-link";
      link.addEventListener(
        "click",
        (event) => {
          this.handleVideoCardLinkClick(event);
        },
        true
      );

      const thumb = this.document.createElement("span");
      thumb.className = "bibilili-card-thumb";

      const image = this.document.createElement("img");
      image.loading = "lazy";
      image.decoding = "async";
      image.alt = "";

      const placeholder = this.document.createElement("span");
      placeholder.className = "bibilili-card-placeholder";

      const duration = this.document.createElement("span");
      duration.className = "bibilili-card-duration";

      thumb.append(image, placeholder, duration);

      const title = this.document.createElement("span");
      title.className = "bibilili-card-title";

      const meta = this.document.createElement("span");
      meta.className = "bibilili-card-meta";

      const watchLaterButton = this.watchLaterActionButton();

      link.append(thumb, title, meta);
      card.replaceChildren(link, watchLaterButton);
      this.videoCardStates.delete(card);

      return {
        link,
        thumb,
        image,
        placeholder,
        duration,
        title,
        meta,
        watchLaterButton
      };
    }

    /**
     * Forwards plain same-tab card activation to the navigation controller.
     *
     * @param {MouseEvent} event
     */
    handleVideoCardLinkClick(event) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const link = event.currentTarget;
      const card =
        link instanceof HTMLAnchorElement
          ? link.closest(".bibilili-video-card")
          : null;
      const sourceKind =
        card instanceof HTMLElement
          ? card.dataset.bibililiCardSourceKind
          : null;

      if (
        !sourceKind ||
        !SOURCE_ORDER.includes(sourceKind) ||
        (link.target && link.target.toLowerCase() !== "_self") ||
        link.getAttribute("download") !== null ||
        !this.onVideoCardNavigate
      ) {
        return;
      }

      this.onVideoCardNavigate(sourceKind, link.href, event, card.dataset.bibililiCardFolderId);
    }

    /**
     * Creates the watch-later mutation button for one video card.
     *
     * @returns {HTMLButtonElement}
     */
    watchLaterActionButton() {
      const button = UiControl.button(
        this.document,
        "bibilili-card-watch-later-button",
        (event) => {
          event.preventDefault();
          event.stopPropagation();
          this.handleWatchLaterActionClick(button);
        }
      );

      return button;
    }

    /**
     * Updates one card's watch-later mutation control.
     *
     * @param {HTMLElement} card
     * @param {HTMLButtonElement} button
     * @param {VideoCardRenderState} state
     */
    updateWatchLaterActionControl(card, button, state) {
      const action = state.watchLaterAction;
      const key = state.watchLaterActionKey;
      const isActionable = Boolean(
        action && key && this.hasWatchLaterActionVisual(action)
      );

      button.hidden = !isActionable;
      button.disabled = isActionable
        ? this.isWatchLaterActionPending(action, key)
        : true;
      UiControl.setLabel(button, state.watchLaterActionLabel);

      if (isActionable) {
        card.dataset.bibililiWatchLaterAction = action;
        button.dataset.bibililiWatchLaterAction = action;
        this.updateWatchLaterActionIcon(button, action);
      } else {
        delete card.dataset.bibililiWatchLaterAction;
        delete button.dataset.bibililiWatchLaterAction;
        delete button.dataset.bibililiWatchLaterIcon;
        button.replaceChildren();
      }

      if (action === WatchLaterCardAction.DELETE) {
        card.dataset.bibililiWatchLaterAid = key;
      } else {
        delete card.dataset.bibililiWatchLaterAid;
      }

      if (action === WatchLaterCardAction.ADD) {
        card.dataset.bibililiWatchLaterAddKey = key;
        card.dataset.bibililiWatchLaterAddTargetUrl =
          state.watchLaterActionTargetUrl;
      } else {
        delete card.dataset.bibililiWatchLaterAddKey;
        delete card.dataset.bibililiWatchLaterAddTargetUrl;
      }
    }

    /**
     * Returns true when a watch-later mutation is already in flight.
     *
     * @param {string} action
     * @param {string} key
     * @returns {boolean}
     */
    isWatchLaterActionPending(action, key) {
      if (action === WatchLaterCardAction.ADD) {
        return this.pendingWatchLaterAddKeys.has(key);
      }

      if (action === WatchLaterCardAction.DELETE) {
        return this.pendingWatchLaterDeleteAids.has(key);
      }

      return false;
    }

    /**
     * Updates the icon on a reused watch-later mutation button.
     *
     * @param {HTMLButtonElement} button
     * @param {string} action
     */
    updateWatchLaterActionIcon(button, action) {
      const key = this.watchLaterActionVisualKey(action) || "snapshot";

      if (button.dataset.bibililiWatchLaterIcon === key) {
        return;
      }

      button.replaceChildren(...this.watchLaterActionVisualNodes(action));
      button.dataset.bibililiWatchLaterIcon = key;
    }

    /**
     * Dispatches a card watch-later mutation through the controller callback.
     *
     * @param {HTMLButtonElement} button
     */
    handleWatchLaterActionClick(button) {
      const card = button.closest(".bibilili-video-card");
      const action =
        button.dataset.bibililiWatchLaterAction ||
        (card instanceof HTMLElement
          ? card.dataset.bibililiWatchLaterAction
          : "");

      if (action === WatchLaterCardAction.ADD) {
        this.handleWatchLaterAddClick(button);
        return;
      }

      if (action === WatchLaterCardAction.DELETE) {
        this.handleWatchLaterDeleteClick(button);
      }
    }

    /**
     * Adds a card target to watch later through the controller callback.
     *
     * @param {HTMLButtonElement} button
     */
    handleWatchLaterAddClick(button) {
      const card = button.closest(".bibilili-video-card");
      const key =
        card instanceof HTMLElement
          ? card.dataset.bibililiWatchLaterAddKey
          : null;
      const targetUrl =
        card instanceof HTMLElement
          ? card.dataset.bibililiWatchLaterAddTargetUrl
          : null;

      if (!key || !targetUrl || !this.onWatchLaterAdd) {
        return;
      }

      this.pendingWatchLaterAddKeys.add(key);
      button.disabled = true;

      this.onWatchLaterAdd(targetUrl)
        .then(() => {
          this.pendingWatchLaterAddKeys.delete(key);
          this.completedWatchLaterAddKeys.add(key);

          if (button.isConnected) {
            button.hidden = true;
            button.disabled = true;
            delete button.dataset.bibililiWatchLaterAction;
          }

          if (card instanceof HTMLElement) {
            delete card.dataset.bibililiWatchLaterAction;
            delete card.dataset.bibililiWatchLaterAddKey;
            delete card.dataset.bibililiWatchLaterAddTargetUrl;
          }
        })
        .catch(() => {
          this.pendingWatchLaterAddKeys.delete(key);

          if (button.isConnected) {
            button.disabled = false;
          }
        });
    }

    /**
     * Deletes a watch-later card through the controller callback.
     *
     * @param {HTMLButtonElement} button
     */
    handleWatchLaterDeleteClick(button) {
      const card = button.closest(".bibilili-video-card");
      const aid =
        card instanceof HTMLElement
          ? card.dataset.bibililiWatchLaterAid
          : null;

      if (!aid || !this.onWatchLaterDelete) {
        return;
      }

      this.pendingWatchLaterDeleteAids.add(aid);
      button.disabled = true;

      this.onWatchLaterDelete(aid)
        .then(() => {
          this.pendingWatchLaterDeleteAids.delete(aid);
        })
        .catch(() => {
          this.pendingWatchLaterDeleteAids.delete(aid);

          if (button.isConnected) {
            button.disabled = false;
          }
        });
    }

    /**
     * Applies a new render state to stable video-card child nodes.
     *
     * @param {VideoCardParts} parts
     * @param {VideoCardRenderState} state
     */
    updateVideoCardParts(parts, state) {
      parts.thumb.dataset.bibililiThumbnailState = state.thumbnailUrl
        ? "image"
        : "placeholder";
      parts.thumb.dataset.bibililiHasDuration = state.duration
        ? "true"
        : "false";

      parts.image.removeAttribute("hidden");
      parts.placeholder.removeAttribute("hidden");
      parts.duration.removeAttribute("hidden");

      if (state.thumbnailUrl) {
        if (parts.image.getAttribute("src") !== state.thumbnailUrl) {
          parts.image.src = state.thumbnailUrl;
        }
      } else {
        parts.image.removeAttribute("src");
      }

      parts.placeholder.textContent = state.title;
      parts.duration.textContent = state.duration;
      parts.title.textContent = state.title;
      parts.meta.textContent = state.metaText;
    }

    /**
     * Returns the rendering state used to detect meaningful card updates.
     *
     * @param {VideoItem} item
     * @param {boolean} isCurrent
     * @returns {VideoCardRenderState}
     */
    videoCardRenderState(item, isCurrent) {
      const watchLaterAid =
        item.sourceKind === SourceKind.WATCH_LATER
          ? item.watchLaterAid ?? ""
          : "";
      const watchLaterAddKey = watchLaterAid
        ? ""
        : this.watchLaterAddKeyForItem(item);
      const canAddToWatchLater = Boolean(
        watchLaterAddKey &&
          !this.watchLaterArchiveKeys.has(watchLaterAddKey) &&
          !this.completedWatchLaterAddKeys.has(watchLaterAddKey)
      );
      const watchLaterAction = watchLaterAid
        ? WatchLaterCardAction.DELETE
        : canAddToWatchLater
          ? WatchLaterCardAction.ADD
          : "";

      return {
        targetUrl: item.targetUrl,
        title: item.title,
        thumbnailUrl: SourceAdapter.usableThumbnailUrl(item.thumbnailUrl) ?? "",
        duration: item.duration ?? "",
        metaText: [item.author, item.viewCount, item.progress]
          .filter(Boolean)
          .join(" · "),
        watchLaterAction,
        watchLaterActionKey:
          watchLaterAction === WatchLaterCardAction.DELETE
            ? watchLaterAid
            : watchLaterAction === WatchLaterCardAction.ADD
              ? watchLaterAddKey
              : "",
        watchLaterActionTargetUrl:
          watchLaterAction === WatchLaterCardAction.ADD ? item.targetUrl : "",
        watchLaterActionLabel:
          watchLaterAction === WatchLaterCardAction.DELETE
            ? UiStrings.watchLaterRemoveLabel(this.language)
            : watchLaterAction === WatchLaterCardAction.ADD
              ? UiStrings.watchLaterAddLabel(this.language)
              : "",
        isCurrent
      };
    }

    /**
     * Returns the account watch-later add key for supported page-owned sources.
     *
     * @param {VideoItem} item
     * @returns {string}
     */
    watchLaterAddKeyForItem(item) {
      if (!LayoutRoot.sourceSupportsWatchLaterAdd(item.sourceKind)) {
        return "";
      }

      return SourceAdapter.archiveIdentityForUrl(item.targetUrl)?.key ?? "";
    }

    /**
     * Tests whether a card render state has changed.
     *
     * @param {VideoCardRenderState} previousState
     * @param {VideoCardRenderState} nextState
     * @returns {boolean}
     */
    static sameVideoCardRenderState(previousState, nextState) {
      return (
        previousState.targetUrl === nextState.targetUrl &&
        previousState.title === nextState.title &&
        previousState.thumbnailUrl === nextState.thumbnailUrl &&
        previousState.duration === nextState.duration &&
        previousState.metaText === nextState.metaText &&
        previousState.watchLaterAction === nextState.watchLaterAction &&
        previousState.watchLaterActionKey === nextState.watchLaterActionKey &&
        previousState.watchLaterActionTargetUrl ===
          nextState.watchLaterActionTargetUrl &&
        previousState.watchLaterActionLabel ===
          nextState.watchLaterActionLabel &&
        previousState.isCurrent === nextState.isCurrent
      );
    }

    /**
     * Resolves the source route for current discovery results.
     *
     * @param {VideoListSource[]} sources
     * @param {boolean} resetSourceRoute
     * @returns {string | null}
     */
    resolveSourceRoute(sources, resetSourceRoute) {
      const availableKinds = new Set(sources.map((source) => source.kind));
      const hintedSourceKind = this.pendingSourceRouteHint;

      if (hintedSourceKind && availableKinds.has(hintedSourceKind)) {
        this.isDefaultSourceRoute = false;
        this.pendingSourceRouteHint = null;
        this.appliedSourceRouteOpenState =
          this.pendingSourceRouteOpenState ?? true;
        this.pendingSourceRouteOpenState = null;
        return hintedSourceKind;
      }

      /*
       * Note: account-backed sources may arrive after the first destination
       * render, so an unavailable hint stays pending for later reconciliation.
       */
      const current = this.selectedSource(sources);
      const unchosenFavorites = current?.kind === SourceKind.FAVORITES &&
        !current.folderId && this.isDefaultSourceRoute;
      if (
        !resetSourceRoute &&
        this.selectedSourceKind &&
        availableKinds.has(this.selectedSourceKind) && !unchosenFavorites
      ) {
        return this.selectedSourceKind;
      }

      const currentPageSource = this.currentPageSource(sources);
      this.isDefaultSourceRoute = true;

      if (currentPageSource && !this.hasUserInteractedWithSources) {
        return currentPageSource.kind;
      }

      return sources.find((source) => source.items.length)?.kind ?? sources[0]?.kind ?? null;
    }

    /**
     * Returns the first page-owned contextual source containing the current
     * watch route.
     *
     * @param {VideoListSource[]} sources
     * @returns {VideoListSource | null}
     */
    currentPageSource(sources) {
      const currentRouteKey = SourceAdapter.currentWatchRouteKey();
      if (!currentRouteKey) {
        return null;
      }

      return (
        sources.find((source) => {
          if (
            source.kind !== SourceKind.PARTS &&
            source.kind !== SourceKind.COLLECTION
          ) {
            return false;
          }

          return source.items.some((item) => {
            const itemRouteKey = SourceAdapter.watchRouteKeyForUrl(
              item.targetUrl
            );
            const matchReason = this.currentRailItemMatchReason(
              source.kind,
              item,
              currentRouteKey,
              itemRouteKey
            );

            return Boolean(matchReason);
          });
        }) ?? null
      );
    }

    /**
     * Preserves closed rail state for the same route and opens new routes.
     *
     * @param {string | null} previousSourceKind
     * @param {boolean} resetSourceRoute
     */
    resolveRailOpenState(previousSourceKind, resetSourceRoute) {
      if (!this.selectedSourceKind) {
        this.isRailOpen = false;
        return;
      }

      if (this.appliedSourceRouteOpenState !== null) {
        this.isRailOpen = this.appliedSourceRouteOpenState;
        return;
      }

      if (resetSourceRoute || previousSourceKind !== this.selectedSourceKind) {
        this.isRailOpen = true;
      }
    }

    /**
     * Returns the source for the current route.
     *
     * @param {VideoListSource[]} sources
     * @returns {VideoListSource | null}
     */
    selectedSource(sources) {
      return (
        sources.find((source) => source.kind === this.selectedSourceKind) ?? null
      );
    }

    /**
     * Routes the rail to one available source kind and opens it.
     *
     * @param {string} kind
     */
    routeSource(kind) {
      if (this.currentSources.some((source) => source.kind === kind)) {
        this.selectedSourceKind = kind;
        this.isRailOpen = true;
      }
    }

    /**
     * Moves a page-owned node into an extension pane and leaves a placeholder.
     *
     * The moved-node store owns the native restore target. Callers pass only
     * page-owned player or comment nodes; extension-owned children should be
     * recreated or removed instead of being restored through this path.
     *
     * @param {Element} node
     * @param {Element} pane
     * @param {string} placeholderName
     */
    movePageNode(node, pane, placeholderName) {
      this.movedPageNodes.move(node, pane, placeholderName);
    }

    /**
     * Restores a moved page-owned node to its original placeholder.
     *
     * Restoration is idempotent for null or already-restored nodes.
     * Note: Bilibili can remove the placeholder during navigation, so the
     * store uses the current layout root to detect whether the live node still
     * needs to be released.
     *
     * @param {Element | null} node
     */
    restoreNode(node) {
      this.movedPageNodes.restore(node, this.root);
    }

    /**
     * Marks page-owned source roots so CSS hides their original placement.
     *
     * @param {VideoListSource[]} sources
     */
    markSourceRoots(sources) {
      this.sourceRootMarker.mark(sources);
    }

    /**
     * Removes extension source markers from previously marked roots.
     */
    unmarkSourceRoots() {
      this.sourceRootMarker.unmark();
    }
  }

  /**
   * Coordinates discovery, layout updates, mutation observation, and same-tab
   * navigation detection.
   */
  class BibililiController {
    /**
     * Creates the extension controller.
     *
     * @param {Document} document
     */
    constructor(document) {
      this.document = document;
      this.discovery = new RegionDiscovery(document);
      this.navigation = new NativeVideoNavigation(document);
      this.loadingCover = new LoadingCover(document, this.discovery);
      this.videoPreviews = new VideoPreviewStore(() => {
        this.layout.scheduleRailRender();
      });
      this.layout = new LayoutRoot(document, this.videoPreviews);
      this.videoLoading = new VideoLoadingState(document, this.layout, this.navigation, () => {
        this.reconcile(false);
      });
      this.lazyPrimer = new PageLazyPrimer(document);
      this.accountSources = new AccountSourceStore(() => {
        this.scheduleReconcile(false, ReconcilePriority.LAZY);
      });
      this.enabled = ActivationPreference.readEnabled();
      this.preferences = SettingsPreference.read();
      this.favoritesView = new FavoritesView(document, {
        statuses: AccountSourceStatus,
        onOpen: (choose) => this.openFavoriteFolders(choose),
        onSelect: (id) => this.selectFavoriteFolder(id),
        onRefresh: () => this.accountSources.loadFavoriteFolders(true),
        onSignIn: () => {
          const trigger = this.layout.accountControl ?? this.discovery.findAccountControl();
          if (trigger) LayoutRoot.activateNativeAccountControl(trigger);
        }
      });
      this.layout.favoritesView = this.favoritesView;
      this.settingsView = new SettingsView(document, {
        sources: SOURCE_ORDER.map((kind) => ({ kind, message: SOURCE_LABEL_MESSAGE_NAMES[kind] })),
        actionGroups: [
          { message: UiMessage.WATCH_ACTIONS_LABEL, actions: WATCH_ACTION_ORDER.map((kind) => ({
            kind, message: kind === WatchActionKind.SHARE
              ? UiMessage.WATCH_ACTION_COPY_LINK_LABEL : WATCH_ACTION_LABEL_MESSAGE_NAMES[kind]
          })) },
          { message: UiMessage.RAIL_ACTIONS_LABEL, actions: RAIL_ACTION_ORDER.map((kind) => ({
            kind, message: RAIL_ACTION_MESSAGES[kind]
          })) }
        ],
        onChange: (preferences) => this.setPreferences(preferences),
        onEnabledChange: (enabled) => this.setEnabled(enabled),
        onOpen: () => {
          this.layout.morePanel?.close();
          this.favoritesView.panel.close();
        },
        renderIcon: (kind, visual) => this.layout.renderSettingsIcon(kind, visual)
      });
      this.layout.settingsView = this.settingsView;
      this.applyFeaturePreferences();
      this.storageHandler = null;
      this.onStorageChange = (event) => {
        if (event.storageArea !== window.localStorage) return;
        if (event.key === null || event.key === SettingsPreference.key) {
          this.setPreferences(SettingsPreference.read(), false);
        }
        if (event.key === null || event.key === ActivationPreference.key) {
          const enabled = ActivationPreference.readEnabled();
          if (enabled !== this.enabled) this.setEnabled(enabled, false);
        }
      };
      this.activationControl = new ActivationControl(document, (enabled) => {
        this.setEnabled(enabled);
      });
      this.readyHandler = null;
      this.observer = null;
      this.reconcileScheduler = new ReconcileScheduler((resetSourceRoute) => {
        this.reconcile(resetSourceRoute);
      });
      this.urlTimer = null;
      this.playerRecoveryTimer = null;
      this.themePreference = null;
      this.themeChangeHandler = null;
      this.popstateHandler = null;
      this.hashchangeHandler = null;
      this.uiLanguage = DEFAULT_UI_LANGUAGE;
      this.pageKey = "";
      /** @type {CardNavigationOriginRecord | null} */
      this.pendingVideoCardNavigationOrigin = null;
      this.nextPageSourceRouteState = null;
      this.pendingSourceRouteReset = false;
      this.settlingTimers = [];
    }

    /** Covers startup while keeping an already mounted watch layout visible. */
    prepareMount() {
      if (this.enabled && this.isWatchPage() && !this.layout.root?.isConnected) {
        this.loadingCover.start(this.currentPageKey());
      } else {
        this.loadingCover.stop();
      }
    }

    /**
     * Starts observers, account loading, and the first reconciliation pass.
     */
    start() {
      this.uiLanguage = LanguageResolver.resolve(this.document);
      this.navigation.start();
      this.videoLoading.start();
      this.pageKey = this.currentPageKey();
      this.nextPageSourceRouteState = this.initialSourceRouteState();
      BilibiliThemeSync.sync(this.document);
      this.observeMutations();
      this.observeNavigation();
      this.observeThemePreference();
      this.storageHandler = this.onStorageChange;
      window.addEventListener("storage", this.storageHandler);
      this.renderFloatingActivation();
      this.startPageReconciliation(false);
    }

    /**
     * Stops observation, cancels asynchronous work, and restores page DOM.
     */
    stop() {
      if (this.storageHandler) {
        window.removeEventListener("storage", this.storageHandler);
        this.storageHandler = null;
      }
      this.settingsView.destroy();
      this.favoritesView.destroy();
      if (this.readyHandler) {
        this.document.removeEventListener("DOMContentLoaded", this.readyHandler);
        this.readyHandler = null;
      }
      this.observer?.disconnect();
      this.observer = null;

      this.reconcileScheduler.cancel();

      if (this.urlTimer) {
        window.clearInterval(this.urlTimer);
        this.urlTimer = null;
      }

      if (this.popstateHandler) {
        window.removeEventListener("popstate", this.popstateHandler);
        this.popstateHandler = null;
      }

      if (this.hashchangeHandler) {
        window.removeEventListener("hashchange", this.hashchangeHandler);
        this.hashchangeHandler = null;
      }

      if (this.themePreference && this.themeChangeHandler) {
        this.themePreference.removeEventListener("change", this.themeChangeHandler);
        this.themePreference = null;
        this.themeChangeHandler = null;
      }

      this.lazyPrimer.stop();
      this.cancelSettlingReconciles();
      this.accountSources.stop();
      this.clearRenderedPageState();
      this.navigation.stop();
      this.videoLoading.stop();
      this.activationControl.destroy();
    }

    /**
     * Clears rendered page state without changing observers or activation.
     */
    clearRenderedPageState() {
      this.navigation.cancel();
      this.videoLoading.cancel();
      this.cancelPlayerRecovery();
      this.loadingCover.stop();
      this.videoPreviews.stop();
      this.pendingVideoCardNavigationOrigin = null;
      this.nextPageSourceRouteState = null;
      this.pendingSourceRouteReset = false;
      this.layout.destroy();
    }

    /**
     * Starts account refresh and urgent reconciliation for the current page.
     *
     * @param {boolean} resetSourceRoute
     */
    startPageReconciliation(resetSourceRoute) {
      this.refreshAccountSources();
      this.scheduleReconcile(resetSourceRoute, ReconcilePriority.URGENT);
      this.scheduleSettlingReconciles();
    }

    /**
     * Schedules a coalesced reconciliation pass.
     *
     * @param {boolean} [resetSourceRoute]
     * @param {string} [priority]
     */
    scheduleReconcile(
      resetSourceRoute = false,
      priority = ReconcilePriority.LAZY
    ) {
      this.reconcileScheduler.request(resetSourceRoute, priority);
    }

    /**
     * Schedules bounded lazy passes while native page hydration settles.
     */
    scheduleSettlingReconciles() {
      this.cancelSettlingReconciles();

      for (const delay of LAZY_SETTLING_RECONCILE_DELAYS_MS) {
        const timer = window.setTimeout(() => {
          this.settlingTimers = this.settlingTimers.filter(
            (candidate) => candidate !== timer
          );

          if (!this.enabled || !this.isWatchPage()) {
            return;
          }

          this.scheduleReconcile(false, ReconcilePriority.LAZY);
        }, delay);

        this.settlingTimers.push(timer);
      }
    }

    /**
     * Cancels pending startup or navigation settling passes.
     */
    cancelSettlingReconciles() {
      for (const timer of this.settlingTimers) {
        window.clearTimeout(timer);
      }

      this.settlingTimers = [];
    }

    /**
     * Retries native comment hydration without reloading the watch page.
     *
     * Note: Bilibili may leave comments unhydrated until the native document
     * scrolls near the comment region.
     */
    reloadComments() {
      if (!this.enabled || !this.isWatchPage()) {
        return;
      }

      this.reconcileScheduler.cancel();
      this.cancelSettlingReconciles();
      this.layout.releaseForNativePrime();

      const afterPrime = () => {
        this.scheduleReconcile(false, ReconcilePriority.URGENT);
        this.scheduleSettlingReconciles();
      };

      if (this.lazyPrimer.prime(this.pageKey, afterPrime, { force: true })) {
        return;
      }

      afterPrime();
    }

    /**
     * Rebuilds the transformed layout from current DOM regions.
     *
     * Reconciliation is the controller's only mount decision point. It handles
     * watch-page exit, disabled state, missing-player retry, lazy priming,
     * account-source merging, preview hydration, and the handoff into
     * LayoutRoot. User source-route state is captured before render because
     * account-backed sources may change the source list during later passes.
     *
     * @param {boolean} resetSourceRoute
     */
    reconcile(resetSourceRoute) {
      BilibiliThemeSync.sync(this.document);

      if (!this.isWatchPage()) {
        this.settingsView.panel.close();
        this.clearRenderedPageState();
        this.activationControl.destroy();
        return;
      }

      if (!this.enabled) {
        this.clearRenderedPageState();
        this.renderFloatingActivation();
        return;
      }

      this.pendingSourceRouteReset ||= resetSourceRoute;
      const language = this.resolveUiLanguage();
      const regions = this.discovery.discover();
      if (this.nextPageSourceRouteState?.sourceKind === SourceKind.FAVORITES) {
        this.accountSources.restoreFavoriteFolder(this.nextPageSourceRouteState.folderId);
      }
      this.favoritesView.update(this.accountSources.currentSource(SourceKind.FAVORITES),
        this.accountSources.favoriteFolders, language);
      this.loadingCover.update();
      const sources = SourceMerger.merge(
        regions.sources,
        this.accountSources.currentSources()
      );

      if (!regions.player) {
        if (this.layout.root?.isConnected) {
          this.waitForPlayerReplacement();
          return;
        }
        this.layout.destroy();
        this.renderFloatingActivation();
        return;
      }

      this.cancelPlayerRecovery();
      regions.sources = sources;
      const sourceRouteState = this.nextPageSourceRouteState;
      const mountedComments = this.layout.currentMountedComments();

      if (mountedComments && !regions.comments) {
        // Note: Bilibili can briefly empty the attached tree while reloading it.
        regions.comments = mountedComments;
        regions.commentState = CommentPaneState.LOADED;
      }

      if (
        !mountedComments &&
        (this.lazyPrimer.timer !== null ||
          this.lazyPrimer.prime(this.pageKey, () => {
            this.scheduleReconcile(false, ReconcilePriority.LAZY);
          }))
      ) {
        /*
         * Note: Bilibili lazy priming needs the comment tree to stay in the
         * native page briefly, but the transformed frame should keep its
         * comment column reserved while the usable tree is withheld.
         */
        regions.comments = null;
        regions.commentState = CommentPaneState.RETRY;
      }

      this.layout.render(
        regions,
        this.pendingSourceRouteReset,
        this.activationControl,
        language,
        this.accountSources.currentWatchLaterCount(),
        () => this.reloadComments(),
        () => this.scheduleReconcile(false, ReconcilePriority.LAZY),
        (targetUrl) => this.addWatchLaterItem(targetUrl),
        (aid) => this.deleteWatchLaterItem(aid),
        (sourceKind, targetUrl, event, folderId) =>
          this.navigateVideoCard(sourceKind, targetUrl, event, folderId),
        (state) => this.storeSourceRouteState(state),
        sourceRouteState,
        (sourceKind) => this.loadMoreAccountSource(sourceKind),
        () => this.accountSources.revealWatchLaterItem(window.location.href),
        () => this.accountSources.currentSource(SourceKind.WATCH_LATER, true),
        (source) => this.refreshRail(source)
      );
      this.settingsView.update(this.preferences, this.enabled, language);
      this.nextPageSourceRouteState = null;
      this.pendingSourceRouteReset = false;
      if (this.lazyPrimer.timer === null) {
        this.loadingCover.finish(() => Boolean(
          this.layout.root?.isConnected && this.layout.playerNode?.isConnected &&
          this.lazyPrimer.timer === null
        ));
      }
    }

    /**
     * Keeps the frame mounted during a bounded native player replacement.
     *
     * Note: A Bilibili route update may remove the old player before inserting
     * its replacement. A permanent loss still releases the native page.
     */
    waitForPlayerReplacement() {
      if (this.playerRecoveryTimer !== null) {
        return;
      }
      this.playerRecoveryTimer = window.setTimeout(() => {
        this.playerRecoveryTimer = null;
        if (!this.discovery.findPlayerRegion()) {
          this.layout.destroy();
          this.renderFloatingActivation();
        }
        this.scheduleReconcile(false, ReconcilePriority.URGENT);
      }, PLAYER_RECOVERY_TIMEOUT_MS);
    }

    /** Cancels the current player replacement deadline. */
    cancelPlayerRecovery() {
      window.clearTimeout(this.playerRecoveryTimer);
      this.playerRecoveryTimer = null;
    }

    /**
     * Reconciles player arrival urgently and other page mutations lazily.
     */
    observeMutations() {
      this.observer = new MutationObserver((mutations) => {
        const hasPageMutation = mutations.some((mutation) => !DomProbe.isOwned(mutation.target));

        if (hasPageMutation) {
          const playerArrived = this.enabled && this.isWatchPage() &&
            !this.layout.playerNode?.isConnected &&
            this.discovery.findPlayerRegion();
          this.scheduleReconcile(
            false,
            playerArrived ? ReconcilePriority.URGENT : ReconcilePriority.LAZY
          );
        }
      });

      this.observer.observe(this.document.documentElement, {
        attributes: true,
        attributeFilter: LAZY_MUTATION_ATTRIBUTE_FILTER,
        characterData: true,
        childList: true,
        subtree: true
      });
    }

    /**
     * Watches same-tab navigation by polling the URL and listening to native
     * history events.
     */
    observeNavigation() {
      this.popstateHandler = () => {
        this.navigation.cancel();
        this.videoLoading.cancel();
        this.handlePotentialNavigation();
      };
      this.hashchangeHandler = () => this.handlePotentialNavigation();
      window.addEventListener("popstate", this.popstateHandler);
      window.addEventListener("hashchange", this.hashchangeHandler);

      this.urlTimer = window.setInterval(
        () => this.handlePotentialNavigation(),
        URL_POLL_INTERVAL_MS
      );
    }

    /**
     * Watches browser color-scheme changes used when the page has no explicit
     * appearance mode.
     */
    observeThemePreference() {
      this.themePreference = window.matchMedia(BROWSER_DARK_SCHEME_QUERY);
      this.themeChangeHandler = () => {
        BilibiliThemeSync.sync(this.document);
        this.scheduleReconcile(false, ReconcilePriority.LAZY);
      };
      this.themePreference.addEventListener("change", this.themeChangeHandler);
    }

    /**
     * Resets per-page state when the visible watch page changes.
     *
     * Same-tab navigation reuses the content-script instance, so page-scoped
     * lazy-prime, preview, and source-route state are reset before the new
     * page's urgent reconciliation. The mounted layout retains native nodes
     * while Bilibili updates them for the destination video.
     */
    handlePotentialNavigation() {
      const nextPageKey = this.currentPageKey();

      if (nextPageKey === this.pageKey) {
        return;
      }

      this.lazyPrimer.stop(false);
      this.cancelPlayerRecovery();
      this.cancelSettlingReconciles();
      this.videoPreviews.stop();
      this.nextPageSourceRouteState = this.initialSourceRouteState();
      this.pageKey = nextPageKey;
      if (this.isWatchPage()) {
        this.videoLoading.followRoute(nextPageKey);
        this.layout.resetPageSession();
      } else {
        this.navigation.cancel();
        this.videoLoading.cancel();
        this.layout.destroy();
      }
      this.prepareMount();
      this.startPageReconciliation(true);
    }

    /**
     * Hands every rail source's archive target to Bilibili's native player.
     * Unavailable or failed handoffs retain ordinary document navigation.
     *
     * @param {string} sourceKind
     * @param {string} targetUrl
     * @param {MouseEvent} event
     * @param {string} [folderId] Folder captured on the clicked card.
     */
    navigateVideoCard(sourceKind, targetUrl, event, folderId) {
      const wasPending = Boolean(this.navigation.pending);
      this.navigation.cancel();
      const target = new URL(targetUrl, window.location.href);
      if (target.origin !== new URL(window.location.href).origin) {
        return;
      }
      if (
        !wasPending && !target.searchParams.has("t") &&
        SourceAdapter.watchRouteKeyForUrl(targetUrl) === SourceAdapter.currentWatchRouteKey()
      ) {
        event.preventDefault();
        return;
      }
      this.recordVideoCardNavigationSource(sourceKind, targetUrl, folderId);
      this.videoLoading.begin(SourceAdapter.watchRouteKeyForUrl(target.href));
      const accepted = this.navigation.navigate(target.href, (success, landedUrl) => {
        if (!this.enabled || !this.isWatchPage()) return;
        if (!success) {
          window.location.assign(target.href);
          return;
        }
        this.videoLoading.confirm(landedUrl);
        if (
          SourceAdapter.watchRouteKeyForUrl(landedUrl) !==
          SourceAdapter.watchRouteKeyForUrl(target.href)
        ) {
          // Note: Bilibili can canonicalize an AV request to its BV watch URL.
          this.recordVideoCardNavigationSource(sourceKind, landedUrl, folderId);
          if (this.currentPageKey() === this.pageKey) {
            const state = this.initialSourceRouteState();
            if (!this.layout.hasUserInteractedWithSources) {
              this.nextPageSourceRouteState = state;
              this.scheduleReconcile(false, ReconcilePriority.URGENT);
            }
          }
        }
        this.handlePotentialNavigation();
      });
      if (accepted) {
        event.preventDefault();
      }
    }

    /**
     * Remembers the source route for a normal video-card navigation attempt.
     *
     * @param {string} sourceKind
     * @param {string} targetUrl
     * @param {string} [folderId] Favorite folder carried through native canonicalization.
     */
    recordVideoCardNavigationSource(sourceKind, targetUrl, folderId) {
      const targetRouteKey = SourceAdapter.watchRouteKeyForUrl(targetUrl);

      if (!SOURCE_ORDER.includes(sourceKind)) {
        return;
      }

      if (!targetRouteKey) {
        return;
      }

      const route = { sourceKind };
      if (sourceKind === SourceKind.FAVORITES && FavoriteFolderPreference.normalizeId(folderId)) {
        route.folderId = folderId;
      }
      this.pendingVideoCardNavigationOrigin = {
        ...route,
        targetRouteKey,
        createdAt: Date.now()
      };
      const geometry = this.layout.root?.isConnected ? {
        commentWidth: this.layout.commentPane?.getBoundingClientRect().width ?? 0,
        dockHeight: this.layout.dock?.getBoundingClientRect().height ?? 0
      } : null;
      CardNavigationOriginStore.write(route, targetRouteKey, geometry);
    }

    /**
     * Converts the latest card click into a one-navigation source route hint.
     *
     * @returns {{ sourceKind: string, folderId?: string } | null}
     */
    consumeVideoCardNavigationSource() {
      const currentRouteKey = SourceAdapter.currentWatchRouteKey();
      const origin = this.pendingVideoCardNavigationOrigin;
      this.pendingVideoCardNavigationOrigin = null;

      if (
        origin &&
        currentRouteKey &&
        origin.targetRouteKey === currentRouteKey &&
        CardNavigationOriginStore.isFresh(origin)
      ) {
        CardNavigationOriginStore.clear();
        return SourceRoute.normalize(origin);
      }

      if (origin) {
        CardNavigationOriginStore.clear();
        return null;
      }

      return CardNavigationOriginStore.take(currentRouteKey);
    }

    /**
     * Returns the source route state to apply on a new page session.
     *
     * @returns {SourceRouteState | null}
     */
    initialSourceRouteState() {
      const pageRouteKey = SourceAdapter.currentWatchRouteKey();
      const originRoute = this.consumeVideoCardNavigationSource();

      if (originRoute) {
        return {
          ...originRoute,
          isRailOpen: true
        };
      }

      return SourceRouteStateStore.read(pageRouteKey);
    }

    /**
     * Stores the selected source route for refreshes of the current page.
     *
     * @param {SourceRouteState} state
     */
    storeSourceRouteState(state) {
      const requestedFolderId = this.accountSources.favoriteFolders.requestedFolderId;
      if (state.sourceKind === SourceKind.FAVORITES && requestedFolderId) {
        // Preserve a navigation hint while its account membership is being checked.
        state = { ...state, folderId: requestedFolderId };
      }
      SourceRouteStateStore.write(SourceAdapter.currentWatchRouteKey(), state);
    }

    /**
     * Persists and applies the global activation state.
     *
     * @param {boolean} enabled
     * @param {boolean} [persist] False applies another tab's activation state.
     */
    setEnabled(enabled, persist = true) {
      this.enabled = enabled;
      if (persist) this.settingsView.showSaveResult(ActivationPreference.writeEnabled(enabled));
      this.reconcileScheduler.cancel();

      if (!enabled) {
        this.lazyPrimer.stop();
        this.cancelSettlingReconciles();
        this.accountSources.stop();
        this.clearRenderedPageState();
        this.renderFloatingActivation();
        return;
      }

      this.prepareMount();
      this.settingsView.update(this.preferences, this.enabled, this.uiLanguage);
      this.startPageReconciliation(true);
    }

    /**
     * Applies saved preferences through the existing stores and reconciliation path.
     * @param {SettingsPreferenceRecord} preferences
     * @param {boolean} [persist] False applies another tab's storage event.
     */
    setPreferences(preferences, persist = true) {
      this.preferences = SettingsPreference.normalize(preferences);
      const saved = !persist || SettingsPreference.write(this.preferences);
      this.applyFeaturePreferences();
      this.settingsView.update(this.preferences, this.enabled, this.uiLanguage);
      if (persist) this.settingsView.showSaveResult(saved);
      this.refreshAccountSources();
      this.scheduleReconcile(false, ReconcilePriority.URGENT);
    }

    /** Shares one preference snapshot with layout and demand-driven stores. */
    applyFeaturePreferences() {
      this.layout.preferences = this.preferences;
      if (!this.preferences.sources[SourceKind.FAVORITES]) this.favoritesView.panel.close();
      this.videoPreviews.setEnabled(this.preferences.features.thumbnails);
      this.accountSources.setEnabledKinds(ACCOUNT_SOURCE_ORDER.filter((kind) => this.preferences.sources[kind]));
    }

    /** Opens owned folders and resumes the saved folder only for a source-label click. */
    async openFavoriteFolders(choose) {
      const request = this.favoriteOpenSequence = (this.favoriteOpenSequence ?? 0) + 1;
      if (!this.enabled || !this.preferences.sources[SourceKind.FAVORITES]) return;
      this.settingsView.panel.close();
      this.layout.morePanel?.close();
      await this.accountSources.loadFavoriteFolders(true);
      if (request !== this.favoriteOpenSequence || !this.enabled ||
          !this.preferences.sources[SourceKind.FAVORITES] || !this.favoritesView.panel.isOpen) return;
      const folderId = this.accountSources.currentSource(SourceKind.FAVORITES)?.folderId;
      if (!choose && folderId) {
        this.favoritesView.panel.close(true);
        this.selectFavoriteFolder(folderId);
      }
    }

    /** Selects a folder immediately, then lets the shared account completion reconcile it. */
    selectFavoriteFolder(folderId) {
      if (!this.enabled || !this.preferences.sources[SourceKind.FAVORITES] ||
          !this.accountSources.favoriteFolders.items.some((folder) => folder.id === folderId)) return;
      void this.accountSources.selectFavoriteFolder(folderId);
      this.nextPageSourceRouteState = { sourceKind: SourceKind.FAVORITES, folderId, isRailOpen: true };
      this.layout.hasUserInteractedWithSources = true;
      this.scheduleReconcile(false, ReconcilePriority.URGENT);
    }

    /**
     * Refreshes account-backed sources when the transformed page can use them.
     */
    refreshAccountSources() {
      if (!this.enabled || !this.isWatchPage()) {
        return;
      }

      this.accountSources.refresh(this.resolveUiLanguage());
    }

    /**
     * Refreshes the selected rail source without remounting page-owned regions.
     * Loaded account lists use one request; page sources are re-extracted from DOM.
     * History and Favorites restart at their first page.
     *
     * @param {VideoListSource} source
     * @returns {Promise<void>}
     */
    async refreshRail(source) {
      if (!this.enabled || !this.isWatchPage()) return;
      const pageKey = this.currentPageKey();
      if (source.root === null && ACCOUNT_SOURCE_ORDER.includes(source.kind)) {
        await this.accountSources.refreshSource(source.kind);
      }
      if (!this.enabled || !this.isWatchPage() || this.currentPageKey() !== pageKey) return;
      const sources = SourceMerger.merge(
        this.discovery.findSources(),
        this.accountSources.currentSources()
      );
      this.layout.watchLaterAccountCount = this.accountSources.currentWatchLaterCount();
      this.layout.setSources(sources, false, this.activationControl, null);
    }

    /**
     * Expands an account source and reconciles its current rail.
     *
     * @param {string} sourceKind
     * @returns {Promise<void>}
     */
    async loadMoreAccountSource(sourceKind) {
      await this.accountSources.loadMore(sourceKind);
      this.scheduleReconcile(false, ReconcilePriority.URGENT);
    }

    /**
     * Adds one card target to watch later without changing the current page.
     *
     * @param {string} targetUrl
     * @returns {Promise<void>}
     */
    async addWatchLaterItem(targetUrl) {
      await this.accountSources.addWatchLaterItem(
        targetUrl,
        this.resolveUiLanguage()
      );
      this.scheduleReconcile(false, ReconcilePriority.URGENT);
    }

    /**
     * Deletes one watch-later item without changing the current watch page.
     *
     * @param {string} aid
     * @returns {Promise<void>}
     */
    async deleteWatchLaterItem(aid) {
      await this.accountSources.deleteWatchLaterItem(aid);
      this.scheduleReconcile(false, ReconcilePriority.URGENT);
    }

    /**
     * Resolves and tracks the language used by extension-owned UI.
     *
     * @returns {string}
     */
    resolveUiLanguage() {
      const nextLanguage = LanguageResolver.resolve(this.document);

      if (nextLanguage !== this.uiLanguage) {
        this.uiLanguage = nextLanguage;

        if (this.enabled && this.isWatchPage()) {
          this.accountSources.refresh(nextLanguage, true);
        }
      }

      return this.uiLanguage;
    }

    /**
     * Renders the activation button as a floating start or retry control.
     */
    renderFloatingActivation() {
      if (!this.isWatchPage()) {
        this.activationControl.destroy();
        return;
      }

      BilibiliThemeSync.sync(this.document);
      this.activationControl.mountFloating(this.resolveUiLanguage());
      this.settingsView.update(this.preferences, this.enabled, this.uiLanguage);
      const settingsButton = this.settingsView.launcher();
      if (settingsButton.parentElement !== this.activationControl.floatingRoot) {
        this.activationControl.floatingRoot.append(settingsButton);
      }
    }

    /**
     * Returns true for Bilibili watch pages covered by this content script.
     *
     * @returns {boolean}
     */
    isWatchPage() {
      return (
        window.location.hostname === "www.bilibili.com" &&
        (window.location.pathname.startsWith("/video/") ||
          window.location.pathname.startsWith("/list/watchlater"))
      );
    }

    /**
     * Returns the navigation identity for a page session.
     *
     * @returns {string}
     */
    currentPageKey() {
      return (
        SourceAdapter.currentWatchRouteKey() ??
        `${window.location.origin}${window.location.pathname}${window.location.search}`
      );
    }
  }

  /**
   * @typedef {object} VideoItem
   * @property {string} targetUrl Required navigation target.
   * @property {string} title Required display title.
   * @property {string | null} thumbnailUrl Optional thumbnail image.
   * @property {string} sourceKind Closed source kind.
   * @property {boolean} [isCurrent] Native collection current-row marker.
   * @property {string | null} duration Optional compact duration.
   * @property {string | null} author Optional author label.
   * @property {string | null} viewCount Optional view count label.
   * @property {string | null} progress Optional watch progress label.
   * @property {string} [watchLaterAid] Archive id for watch-later removal.
   */

  /**
   * @typedef {object} VideoCardParts
   * @property {HTMLAnchorElement} link Main card navigation link.
   * @property {HTMLElement} thumb Thumbnail frame.
   * @property {HTMLImageElement} image Thumbnail image node.
   * @property {HTMLElement} placeholder Title fallback shown without an image.
   * @property {HTMLElement} duration Duration badge.
   * @property {HTMLElement} title Card title node.
   * @property {HTMLElement} meta Card metadata node.
   * @property {HTMLButtonElement} watchLaterButton Watch-later mutation button.
   */

  /**
   * @typedef {object} VideoCardRenderState
   * @property {string} targetUrl Current anchor navigation target.
   * @property {string} title Current title and fallback thumbnail text.
   * @property {string} thumbnailUrl Secure thumbnail URL or empty string.
   * @property {string} duration Compact duration text or empty string.
   * @property {string} metaText Rendered metadata line.
   * @property {string} watchLaterAction Watch-later card action or empty string.
   * @property {string} watchLaterActionKey Stable mutation key or empty string.
   * @property {string} watchLaterActionTargetUrl Add target URL or empty string.
   * @property {string} watchLaterActionLabel Accessible mutation label.
   * @property {boolean} isCurrent Current watch-route state.
   */

  /**
   * @typedef {object} VideoListSource
   * @property {string} kind Closed source kind.
   * @property {string | null} [folderId] Account-validated favorite folder identity.
   * @property {string} [title] Selected folder title.
   * @property {boolean} [isDefaultFolder] Selected folder is Bilibili's default favorites.
   * @property {string} [status] Closed account-source loading state.
   * @property {boolean} [loaded] Initial folder request has completed.
   * @property {Element | null} root Page-owned source root for DOM sources.
   * @property {VideoItem[]} items Extracted ordered video items.
   * @property {SourcePagination} [pagination] Account-source continuation state.
   */

  /**
   * @typedef {object} SourcePagination
   * @property {boolean} hasMore Retained items or an account continuation remain.
   * @property {string} status Closed AccountSourceStatus value.
   */

  /**
   * @typedef {object} RailCardEntry
   * @property {VideoItem} item Source metadata, independent of rendered DOM.
   * @property {string} key Stable key including duplicate-route occurrence.
   * @property {boolean} isCurrent Whether this item matches the watch route.
   */

  /**
   * @typedef {object} SourceMoreInteraction
   * @property {string} key Source instance being expanded.
   * @property {HTMLButtonElement} button Activated continuation control.
   * @property {boolean} keyboard Move focus if it remains on this control.
   * @property {Set<string>} cardKeys All revealed item keys before activation.
   */

  /**
   * @typedef {object} WatchAction
   * @property {string} kind Closed watch action kind.
   * @property {Element | null} trigger Page-owned native action trigger when present.
   * @property {Element | null} visualSource Native source for visual cloning.
   * @property {string[]} countSelectors Native count text probes.
   * @property {string | null} countText Displayed count text.
   * @property {string | null} [nativeCountText] Native count text inside cloned visuals.
   * @property {RegExp | null} [labelPattern] Native action label matcher.
   * @property {boolean} isActive Native active state.
   * @property {string} [watchLaterAddKey] Account watch-later add identity key.
   * @property {string} [watchLaterAddTargetUrl] Current archive URL to add.
   */

  /**
   * @typedef {object} HistoryCursor
   * @property {number} max Last history record identity.
   * @property {number} viewAt Last history view timestamp.
   * @property {string} business Bilibili cursor business value.
   */

  /**
   * @typedef {object} FavoriteFolder
   * @property {string} id Positive decimal media-list id.
   * @property {string} title Account-owned folder title.
   * @property {number | null} count Account media count, including unplayable entries.
   * @property {boolean} isDefault Bilibili's default-folder attribute.
   */

  /**
   * @typedef {object} FavoriteFolderDirectory
   * @property {string | null} accountId Authenticated account that owns these folders.
   * @property {FavoriteFolder[]} items Folders in Bilibili's returned order.
   * @property {boolean} requested Folder loading has been requested during this session.
   * @property {string | null} requestedFolderId Navigation hint awaiting membership validation.
   * @property {boolean} loaded The directory has loaded successfully.
   * @property {string} status Closed AccountSourceStatus value.
   * @property {AbortController | null} controller Active directory request.
   * @property {Promise<void> | null} promise Shared completion for concurrent openings.
   */

  /**
   * @typedef {object} AccountSourceRecord
   * @property {string} kind Closed account source kind.
   * @property {VideoItem[]} items All retained valid items in API order.
   * @property {number} visibleCount Maximum number of retained items revealed in the rail.
   * @property {string | null} folderId Favorite folder identity.
   * @property {HistoryCursor | number | null} cursor Next history cursor or favorite page.
   * @property {Set<string>} cursorKeys Successfully consumed account continuations.
   * @property {number | null} watchLaterCount Full watch-later count when available.
   * @property {boolean} loaded Initial load completed, including advisory failure.
   * @property {string} status Closed AccountSourceStatus value.
   * @property {AbortController | null} controller Current source request.
   */

  /**
   * @typedef {object} AccountSourceFetchRecord
   * @property {string} kind Closed source kind.
   * @property {VideoListSource | null} source Account-backed source when the payload has valid items.
   * @property {HistoryCursor | number | null} cursor Next history cursor or favorite page.
   * @property {number | null} watchLaterCount Full watch-later count for the watch-later source.
   */

  /**
   * @typedef {object} UploaderInfo
   * @property {string} name Page-owned uploader display name.
   * @property {string | null} profileUrl Optional uploader profile URL.
   * @property {string | null} avatarUrl Optional secure avatar image URL.
   * @property {string | null} metaText Optional secondary uploader metadata.
   */

  /**
   * @typedef {object} VideoTag
   * @property {string} text Page-owned video tag label.
   * @property {string} href Safe absolute search URL.
   */

  /**
   * @typedef {object} AccountControl
   * @property {Element} trigger Page-owned native account trigger.
   */

  /**
   * @typedef {object} DiscoveredRegions
   * @property {Element | null} player Page-owned player region.
   * @property {string | null} title Current watch title.
   * @property {Element | null} description Page-owned video description region.
   * @property {VideoTag[]} tags Current watch video tag links.
   * @property {UploaderInfo | null} uploader Current watch uploader metadata.
   * @property {string | null} publishedAt Current watch publish date text.
   * @property {WatchAction[]} actions Page-owned watch action controls.
   * @property {AccountControl | null} accountControl Page-owned account control.
   * @property {Element | null} comments Page-owned comment region.
   * @property {string} commentState Closed comment pane render state.
   * @property {VideoListSource[]} sources Valid video-list sources.
   */

  /**
   * @typedef {object} SourceDefinition
   * @property {string} kind Closed source kind.
   * @property {string[]} selectors Root selector probes.
   * @property {RegExp} pattern Heading text pattern.
   */

  /**
   * @typedef {object} WatchActionDefinition
   * @property {string} kind Closed watch action kind.
   * @property {string[]} selectors Native action trigger probes.
   * @property {string[]} countSelectors Native count text probes.
   * @property {RegExp} labelPattern Native action label pattern.
   * @property {RegExp} activePattern Native active-state pattern.
   */

  /**
   * @typedef {object} ArchiveVideoIdentity
   * @property {string} key Per-session preview cache key.
   * @property {"bvid" | "aid"} queryName Bilibili video-info query name.
   * @property {string} queryValue Bilibili archive id query value.
   */

  /**
   * @typedef {object} VideoPreviewRecord
   * @property {"queued" | "loading" | "available" | "unavailable"} state
   * @property {ArchiveVideoIdentity} [identity] Queued or loading identity.
   * @property {string} [thumbnailUrl] Fetched archive cover URL.
   */

  /*
   * Node tests set this flag before loading the content script so pure
   * adapters can be exercised while the document stays in loading state.
   */
  if (window.__bibililiExposeInternals) {
    window.__bibililiInternals = Object.freeze({
      AccountSourceAdapter,
      AccountSourceStore,
      AccountSourceStatus,
      BibililiController,
      LayoutRoot,
      RailWindow,
      RegionDiscovery,
      SourceAdapter,
      WatchActionKind,
      SourceKind,
      SourceMerger,
      VideoPreviewStore
    });
  }

  const previousController = window.__bibililiController;
  if (previousController) {
    previousController.stop();
  }

  const startToken = Symbol("bibilili-start");
  window.__bibililiStartToken = startToken;
  const controller = new BibililiController(document);
  window.__bibililiController = controller;
  controller.prepareMount();

  const start = () => {
    if (window.__bibililiStartToken !== startToken) {
      return;
    }

    controller.readyHandler = null;
    controller.start();

    const refreshAfterCatalogLoad = () => {
      if (
        window.__bibililiStartToken !== startToken ||
        window.__bibililiController !== controller
      ) {
        return;
      }

      controller.scheduleReconcile(false, ReconcilePriority.LAZY);
    };

    void UiStrings.loadSupported().then(
      refreshAfterCatalogLoad,
      refreshAfterCatalogLoad
    );
  };

  if (document.readyState === "loading") {
    controller.readyHandler = start;
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
