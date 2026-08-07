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
  dataSnapshot,
  appReset,
  chatPrompt,
  chatMessageActions,
  proactiveChat,
  chatView,
  directGeneration,
  groupGeneration,
  groupController,
  chatVoice,
  chatSettings,
  chatRender,
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
  source("hooks/data/useGlobalDataSnapshot.js"),
  source("hooks/data/useAppReset.js"),
  source("hooks/chat/useChatPromptController.js"),
  source("hooks/chat/useChatMessageActions.js"),
  source("hooks/chat/useProactiveChatController.js"),
  source("hooks/chat/useChatViewController.js"),
  source("hooks/chat/useDirectChatGenerationController.js"),
  source("hooks/chat/useGroupChatGenerationController.js"),
  source("hooks/chat/useGroupChatController.js"),
  source("hooks/chat/useChatVoiceController.js"),
  source("hooks/chat/useChatSettingsController.js"),
  source("hooks/chat/useChatRenderController.jsx"),
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
const appHydration = await source("hooks/data/useAppHydrationController.js");
const chatImage = await source("hooks/chat/useChatImageController.js");
const characterBlock = await source("hooks/chat/useCharacterBlockController.js");
const characterBlockReaction = await source("hooks/chat/useCharacterBlockReaction.js");

for (const component of ["PetHome", "GameCenter", "CoupleApp", "YunyinGame"]) {
  assert(
    new RegExp(`const ${component} = lazyWithRetry\\(\\(\\) => import\\(`).test(appRouter),
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
    new RegExp(`const ${component} = lazyWithRetry\\(\\(\\) => import\\(`).test(featureSurfaces),
    `${component} must remain feature-surface-lazy`,
  );
}

assert(
  /const SettingsApp = lazyWithRetry\(\(\) => import\(/.test(settingsSurface),
  "SettingsApp must remain settings-surface-lazy",
);

for (const component of ["DirectChatView", "ChatScreenshotModal", "MemoryToastCard"]) {
  assert(
    new RegExp(`const ${component} = lazyWithRetry\\(\\(\\) => import\\(`).test(chatSurface),
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
    new RegExp(`const ${component} = lazyWithRetry\\(\\(\\) => import\\(`).test(maliPhoneOverlays),
    `${component} must remain overlay-lazy`,
  );
}

assert(maliPhone.includes("MaliPhoneShell"), "MaliPhone must keep its shell boundary");
assert(maliPhone.includes("MaliPhoneOverlays"), "MaliPhone must keep its overlay boundary");
assert(maliPhone.includes("useGlobalDataSnapshot({"), "MaliPhone must consume the data-sync controller");
assert(maliPhone.includes("useAppHydrationController({"), "MaliPhone must consume the app hydration controller");
assert(appHydration.includes("const applyLoadedAppState ="), "app hydration must own the loaded-state orchestration");
assert(!maliPhone.includes("const applyLoadedAppState ="), "loaded-state hydration must not return to the main controller");
assert(maliPhone.includes("useChatImageController({"), "MaliPhone must consume the chat image controller");
assert(chatImage.includes("const handleImgUp =") && chatImage.includes("CHAT_IMAGE_MAX_BYTES"), "chat image compression must remain owned by the chat image controller");
assert(!maliPhone.includes("const handleImgUp ="), "chat image upload must not return to the main controller");
assert(maliPhone.includes("useCharacterBlockController({"), "MaliPhone must consume the character block controller");
assert(maliPhone.includes("useCharacterBlockReaction({"), "MaliPhone must consume the character block reaction hook");
assert(
  ["const setCharacterBlocked =", "const setCharacterBlocksPlayer =", "setCharacterBlockStates"].every((helper) => characterBlock.includes(helper)),
  "character block state actions must remain owned by the block controller",
);
assert(characterBlockReaction.includes("generateAssistantForHistory"), "block reaction generation must remain in the reaction hook");
for (const helper of ["const setCharacterBlocked =", "const setCharacterBlocksPlayer ="]) {
  assert(!maliPhone.includes(helper), `${helper.slice(6, -3)} must not return to the main controller`);
}
assert(!maliPhone.includes("[block reaction]"), "block reaction effect must not return to the main controller");
for (const helper of [
  "getLocalAppDataSnapshot",
  "applyLocalAppDataSnapshot",
  "getExportableAppState",
  "getRollbackAppState",
  "validateImportedAppState",
  "summarizeImportedData",
  "applyImportedAppState",
]) {
  assert(dataSnapshot.includes(helper), `${helper} must remain owned by the data-sync controller`);
}
assert(
  !maliPhone.includes("const LOCAL_APP_DATA_KEYS ="),
  "local app data snapshot keys must not return to the main controller",
);
assert(maliPhone.includes("useAppReset({"), "MaliPhone must consume the data reset controller");
assert(
  appReset.includes("resetFeatureData") && appReset.includes("clearDeviceSecrets"),
  "data reset side effects must remain owned by the data reset controller",
);
assert(
  !maliPhone.includes("const clearAllData = async () =>"),
  "data reset implementation must not return to the main controller",
);
assert(maliPhone.includes("useChatSettingsController({"), "MaliPhone must consume the chat settings controller");
assert(chatSettings.includes("useChatPromptController({"), "chat prompt rules must remain owned by the chat settings controller");
for (const helper of [
  "buildChatSystemPrompt",
  "pickMemoriesForPrompt",
  "pickLorebookEntriesForPrompt",
  "formatMessagesForPrompt",
]) {
  assert(chatPrompt.includes(helper), `${helper} must remain owned by the chat prompt controller`);
}
assert(
  !maliPhone.includes("const buildChatSystemPrompt ="),
  "chat prompt construction must not return to the main controller",
);
for (const helper of [
  "setSelectedChatMode",
  "setInnerThoughtAutoEnabled",
  "setChatRealTimeEnabled",
  "setProactiveFrequency",
  "saveEditedMemory",
]) {
  assert(chatSettings.includes(helper), `${helper} must remain owned by the chat settings controller`);
}
assert(chatSettings.includes("useChatBackground({"), "chat background settings must remain owned by the chat settings controller");
assert(chatSettings.includes("getDirectSettings"), "direct chat settings props must remain owned by the chat settings controller");
assert(!maliPhone.includes("directSettings={{"), "direct chat settings props must not be rebuilt in the main controller");
for (const helper of ["const setSelectedChatMode =", "const setInnerThoughtAutoEnabled =", "const setProactiveFrequency =", "const saveEditedMemory ="]) {
  assert(!maliPhone.includes(helper), `${helper.slice(6, -3)} must not return to the main controller`);
}
assert(maliPhone.includes("useChatMessageActions({"), "MaliPhone must consume the chat message actions controller");
for (const helper of [
  "saveEditedMessage",
  "deleteMessageWithConfirm",
  "startNoticeLongPress",
  "cancelNoticeLongPress",
]) {
  assert(chatMessageActions.includes(helper), `${helper} must remain owned by the chat message actions controller`);
}
assert(
  !maliPhone.includes("const saveEditedMessage = () =>"),
  "chat message editing must not return to the main controller",
);
assert(maliPhone.includes("useProactiveChatController({"), "MaliPhone must consume the proactive chat controller");
for (const helper of ["getProactiveEligibleCharacters", "triggerProactiveMessage", "runProactiveSweep"]) {
  assert(proactiveChat.includes(helper), `${helper} must remain owned by the proactive chat controller`);
}
assert(
  !maliPhone.includes("const triggerProactiveMessage = async"),
  "proactive message generation must not return to the main controller",
);
assert(maliPhone.includes("useDirectChatGenerationController({"), "MaliPhone must consume the direct chat generation controller");
assert(directGeneration.includes("generateAssistantForHistory"), "direct reply orchestration must remain owned by the direct chat generation controller");
assert(
  !maliPhone.includes("const generateAssistantForHistory = async"),
  "direct reply orchestration must not return to the main controller",
);
assert(maliPhone.includes("useGroupChatGenerationController({"), "MaliPhone must consume the group chat generation controller");
for (const helper of ["buildGroupChatSystemPrompt", "generateGroupReplies", "useGroupChatAI", "parseGroupReplies"]) {
  assert(groupGeneration.includes(helper), `${helper} must remain owned by the group chat generation controller`);
}
assert(
  !maliPhone.includes("const runGroupReplyGeneration ="),
  "group reply generation must not return to the main controller",
);
assert(maliPhone.includes("useGroupChatController({"), "MaliPhone must consume the group chat controller");
for (const helper of ["getGroupChatModalProps", "setGroupCreateName", "setGroupEditUseRealTime", "applyGroupCoverCrop"]) {
  assert(groupController.includes(helper), `${helper} must remain owned by the group chat controller`);
}
assert(!maliPhone.includes("const [groupCreateOpen, setGroupCreateOpen]"), "group creation form state must not return to the main controller");
assert(!maliPhone.includes("groupChat={{"), "group chat modal props must not be rebuilt in the main controller");
assert(maliPhone.includes("useChatRenderController({"), "MaliPhone must consume the chat render controller");
for (const helper of ["selectVisibleChatMessages", "selectDirectChatThoughts", "directMessageRendererProps", "MaliPhoneChatSurface"]) {
  assert(chatRender.includes(helper), `${helper} must remain owned by the chat render controller`);
}
assert(!maliPhone.includes("const renderChat = () =>"), "chat screen orchestration must not return to the main controller");
assert(maliPhone.includes("useChatVoiceController({"), "MaliPhone must consume the chat voice controller");
for (const helper of ["getReplySpeechText", "markMessageVoiceGenerated", "renderCharacterVoiceAction", "getCharacterVoiceBubblePlayback"]) {
  assert(chatVoice.includes(helper), `${helper} must remain owned by the chat voice controller`);
}
assert(
  !maliPhone.includes("const getReplySpeechText = (charId, message) =>"),
  "chat voice text extraction must not return to the main controller",
);
assert(maliPhone.includes("useChatViewController({"), "MaliPhone must consume the chat view controller");
for (const helper of [
  "updateScrollToBottomVisibility",
  "scrollCurrentChatToBottom",
  "rememberCurrentChatScroll",
  "jumpToThoughtMessage",
  "handleDirectChatScroll",
]) {
  assert(chatView.includes(helper), `${helper} must remain owned by the chat view controller`);
}
assert(
  !maliPhone.includes("const updateScrollToBottomVisibility = (element) =>"),
  "chat viewport behavior must not return to the main controller",
);
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

assert(appRouter.includes("lazyWithRetry(loadMusicApp)"), "MusicApp must reuse the intent-preload loader");
assert(utilitySurfaces.includes("lazyWithRetry(loadPhoneApp)"), "PhoneApp must reuse the intent-preload loader");
for (const component of ["WalletSettingsApp", "WalletLedgerView"]) {
  assert(
    new RegExp(`const ${component} = lazyWithRetry\\(\\(\\) => import\\(`).test(utilitySurfaces),
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
assert(chatSurface.includes("lazyWithRetry(loadChatView)"), "ChatView must reuse the intent-preload loader");
assert(chatRender.includes("<MaliPhoneChatSurface") && !maliPhone.includes("<MaliPhoneChatSurface"), "chat render controller must keep the chat presentation boundary");
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
assert(viteConfig.includes('"mali-runtime"'), "MaliPhone domain runtime must remain outside the entry chunk");

for (const domainPath of [
  "/hooks/chat/",
  "/hooks/social/",
  "/hooks/wallet/",
  "/hooks/phone/",
  "/hooks/data/",
  "/hooks/home/",
]) {
  assert(
    viteConfig.includes(`normalized.includes("${domainPath}")`),
    `MaliPhone runtime chunk must retain the ${domainPath} domain boundary`,
  );
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
assert(musicShell.includes("lazyWithRetry(loadFloatingPlayer)"), "floating player must reuse the shared preload loader");
assert(phoneGeneration.includes("await loadPhoneAppGen()"), "phone generation must reuse the shared preload loader");
assert(directGeneration.includes("await loadDirectChatGenerator()"), "direct chat generation must reuse the shared preload loader");

console.log("ok: gallery, animation, route chunking, smart preloading, and Yunyin HUD/settings guards hold");
