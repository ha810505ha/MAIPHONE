import { readFile } from "node:fs/promises";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(`performance regression: ${message}`);
}

const [
  appRouter,
  maliPhone,
  themeCss,
  homeScreen,
  phoneCss,
  galleryStorage,
  galleryHook,
  viteConfig,
  yunyinOverlays,
  yunyinGame,
  yunyinSettings,
  featurePreload,
  musicShell,
  phoneGeneration,
  maliPhoneShell,
  maliPhoneOverlays,
  phoneNavigation,
  chatSurface,
  settingsSurface,
  utilitySurfaces,
  featureSurfaces,
  playerProfileController,
  chatMessageUtils,
  chatSorting,
] = await Promise.all([
  source("components/apps/AppRouter.jsx"),
  source("MaliPhone.jsx"),
  source("styles/themeCss.js"),
  source("components/shell/HomeScreen.jsx"),
  source("styles/maliPhone.css"),
  source("services/images/galleryImageStorage.js"),
  source("hooks/images/useGalleryImageUrl.js"),
  source("vite.config.js"),
  source("yunyin/ui/YunyinOverlays.jsx"),
  source("yunyin/YunyinGame.jsx"),
  source("yunyin/ui/GameSettingsPanel.jsx"),
  source("utils/featurePreload.js"),
  source("components/music/MusicShellLayer.jsx"),
  source("hooks/phone/usePhoneDataGeneration.js"),
  source("components/shell/MaliPhoneShell.jsx"),
  source("components/shell/MaliPhoneOverlays.jsx"),
  source("hooks/navigation/usePhoneNavigation.js"),
  source("components/chat/MaliPhoneChatSurface.jsx"),
  source("components/settings/MaliPhoneSettingsSurface.jsx"),
  source("components/apps/MaliPhoneUtilitySurfaces.jsx"),
  source("components/apps/MaliPhoneFeatureSurfaces.jsx"),
  source("hooks/player/usePlayerProfileController.js"),
  source("utils/chatMessageUtils.js"),
  source("utils/chatSorting.js"),
]);

for (const component of ["PetHome", "GameCenter", "CoupleApp", "YunyinGame"]) {
  assert(
    new RegExp(`const ${component} = lazy\\(\\(\\) => import\\(`).test(appRouter),
    `${component} must remain route-lazy`,
  );
}

for (const component of [
  "PlayerProfileApp",
  "DatingApp",
  "ContactsApp",
  "SocialApp",
  "LorebookApp",
  "StatusApp",
]) {
  assert(
    new RegExp(`const ${component} = React\\.lazy\\(\\(\\) => import\\(`).test(featureSurfaces),
    `${component} must remain feature-surface-lazy`,
  );
}

assert(
  /const SettingsApp = React\.lazy\(\(\) => import\(/.test(settingsSurface),
  "SettingsApp must remain settings-surface-lazy",
);

for (const component of ["DirectChatView", "ChatScreenshotModal", "MemoryToastCard"]) {
  assert(
    new RegExp(`const ${component} = React\\.lazy\\(\\(\\) => import\\(`).test(chatSurface),
    `${component} must remain chat-surface-lazy`,
  );
}

for (const component of [
  "GroupChatModals",
  "AddCharacterModal",
  "DataImportPreviewModal",
  "ChatroomImportPreviewModal",
  "CustomCssGuide",
]) {
  assert(
    new RegExp(`const ${component} = React\\.lazy\\(\\(\\) => import\\(`).test(maliPhoneOverlays),
    `${component} must remain overlay-lazy`,
  );
}

assert(maliPhone.includes("MaliPhoneShell"), "MaliPhone must keep its shell boundary");
assert(maliPhone.includes("MaliPhoneOverlays"), "MaliPhone must keep its overlay boundary");
assert(
  ["HomeScreen", "AppRouter", "MusicShellLayer"].every((component) => maliPhoneShell.includes(component)),
  "shell-owned layers must remain outside the main controller",
);
assert(
  maliPhoneOverlays.includes("MotionPresence") && maliPhoneOverlays.includes("<DesktopPet"),
  "global overlays and desktop pet must remain outside the main controller",
);
assert(maliPhone.includes("usePhoneNavigation({"), "MaliPhone must keep its navigation boundary");
assert(
  ["lockStartYRef", "suppressAppClickUntilRef", "openAppFromTouch", "blockRecentAppClicks"]
    .every((name) => phoneNavigation.includes(name)),
  "gesture and app-click guards must remain owned by the navigation hook",
);

assert(appRouter.includes("lazy(loadMusicApp)"), "MusicApp must reuse the intent-preload loader");
assert(utilitySurfaces.includes("React.lazy(loadPhoneApp)"), "PhoneApp must reuse the intent-preload loader");
for (const component of ["WalletSettingsApp", "WalletLedgerView"]) {
  assert(
    new RegExp(`const ${component} = React\\.lazy\\(\\(\\) => import\\(`).test(utilitySurfaces),
    `${component} must remain utility-surface-lazy`,
  );
}
assert(
  maliPhone.includes("<MaliPhoneWalletSurface") && maliPhone.includes("<MaliPhonePhoneSurface"),
  "wallet and phone must keep their presentation boundaries",
);
assert(
  [
    "MaliPhoneStatusSurface",
    "MaliPhoneSocialSurface",
    "MaliPhoneLorebookSurface",
    "MaliPhoneContactsSurface",
    "MaliPhoneDatingSurface",
    "MaliPhonePlayerSurface",
  ].every((component) => maliPhone.includes(`<${component}`)),
  "feature apps must keep their presentation boundaries",
);
assert(chatSurface.includes("React.lazy(loadChatView)"), "ChatView must reuse the intent-preload loader");
assert(maliPhone.includes("<MaliPhoneChatSurface"), "MaliPhone must keep its chat presentation boundary");
assert(maliPhone.includes("<MaliPhoneSettingsSurface"), "MaliPhone must keep its settings presentation boundary");
assert(
  maliPhone.includes("usePlayerProfileController({"),
  "MaliPhone must keep its player-profile controller boundary",
);
assert(
  ["calculateCropDrag", "createImageCropState", "drawCoverCrop"]
    .every((helper) => playerProfileController.includes(helper) && !maliPhone.includes(helper)),
  "player avatar crop primitives must remain owned by the player-profile controller",
);
assert(
  playerProfileController.includes("AVATAR_INPUT_MAX_SIDE = 1024")
    && playerProfileController.includes("AVATAR_OUTPUT_SIZE = 320")
    && playerProfileController.includes("AVATAR_JPEG_QUALITY = 0.86"),
  "player avatar resize and export quality limits must remain stable",
);
assert(
  maliPhone.includes('from "./utils/chatMessageUtils"')
    && maliPhone.includes('from "./utils/chatSorting"'),
  "MaliPhone must consume chat behavior through pure utility boundaries",
);
for (const helper of [
  "normalizeAssistantReply",
  "normalizeRealityReply",
  "splitAssistantBubbles",
  "extractTransferDirective",
  "extractTransferResponseDirective",
  "parseShareEventNotice",
]) {
  assert(
    chatMessageUtils.includes(`export function ${helper}`),
    `${helper} must remain in the chat-message utility`,
  );
  assert(
    !new RegExp(`const ${helper}\\s*=`).test(maliPhone),
    `${helper} must not return to the main controller`,
  );
}
for (const helper of ["sortChatThreads", "sortGroupChats"]) {
  assert(
    chatSorting.includes(`export function ${helper}`),
    `${helper} must remain in the chat-sorting utility`,
  );
}
assert(
  !maliPhone.includes("const getChatThreadSortMeta"),
  "chat thread sort metadata must not return to the main controller",
);
assert(
  themeCss.includes("renderThemeEffects = themeEffectsEnabled && showThemeEffects"),
  "theme effects must stop while another app covers the home screen",
);
assert(homeScreen.includes("prefers-reduced-motion: reduce"), "FLIP animation must respect reduced motion");
assert(homeScreen.includes('currentApp ? "is-obscured" : ""'), "covered desktop must be hidden from rendering");

const pageTrackRule = phoneCss.match(/\.mp-pages-track\{([^}]*)\}/)?.[1] || "";
assert(!pageTrackRule.includes("will-change"), "page track must not permanently reserve a compositor layer");

const listGallerySource = galleryStorage.slice(
  galleryStorage.indexOf("export async function listGalleryMeta"),
  galleryStorage.indexOf("export async function getGalleryImageBlob"),
);
assert(listGallerySource.includes("openCursor"), "gallery metadata must use cursor pagination");
assert(!listGallerySource.includes(".getAll("), "gallery metadata must not load the whole store");
assert(galleryStorage.includes("createImageBitmap"), "gallery decode must stay off the main image element path when supported");
assert(galleryStorage.includes("OffscreenCanvas"), "gallery resize must use OffscreenCanvas when supported");
assert(galleryStorage.includes("references"), "gallery Object URLs must remain reference-counted");
assert(galleryStorage.includes("objectUrlGeneration"), "pending gallery URL loads must be invalidated when the cache is cleared");
assert(
  galleryHook.includes("releaseGalleryImageUrl") && galleryHook.includes("enabled = true"),
  "gallery consumers must have lazy loading and automatic URL cleanup",
);

for (const chunk of ["react-vendor", "icons-vendor", "capacitor-vendor"]) {
  assert(viteConfig.includes(`"${chunk}"`), `${chunk} must remain independently cacheable`);
}

assert(yunyinOverlays.includes('data-yunyin-hud-title-row="1"'), "Yunyin title must keep its own HUD row");
assert(yunyinOverlays.includes('data-yunyin-hud-resource-stack="1"'), "Yunyin resource balances must stay in the right-side stack");
assert(yunyinOverlays.includes('aria-label={`金錢 ${coins}`}') && yunyinOverlays.includes('aria-label={`結晶 ${crystals}`}'), "Yunyin resource balances must remain individually accessible");
assert(yunyinOverlays.includes('data-yunyin-action-stack="1"'), "Yunyin actions must stay in the right-side stack");
assert(!yunyinOverlays.includes('aria-label="角色外觀"'), "player appearance must not consume a map action slot");
assert(
  yunyinSettings.includes('data-yunyin-player-appearance="1"') && yunyinSettings.includes("onEditAppearance()"),
  "player appearance must remain available from Yunyin settings",
);
assert(yunyinGame.includes("yunyinCameraControlTop(!!homeContext)"), "Yunyin camera control must follow the right-side action stack");
assert(featurePreload.includes("connection?.saveData"), "idle preload must respect data-saver mode");
assert(featurePreload.includes('"slow-2g", "2g"'), "idle preload must skip slow connections");
assert(featurePreload.includes("requestIdleCallback"), "likely features must warm during browser idle time");
assert(musicShell.includes("lazy(loadFloatingPlayer)"), "floating player must reuse the shared preload loader");
assert(phoneGeneration.includes("await loadPhoneAppGen()"), "phone generation must reuse the shared preload loader");
assert(maliPhone.includes("await loadDirectChatGenerator()"), "direct chat generation must reuse the shared preload loader");

console.log("ok: gallery, animation, route chunking, smart preloading, and Yunyin HUD/settings guards hold");
