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
]);

for (const component of ["PetHome", "GameCenter", "MusicApp", "CoupleApp", "YunyinGame"]) {
  assert(
    new RegExp(`const ${component} = lazy\\(\\(\\) => import\\(`).test(appRouter),
    `${component} must remain route-lazy`,
  );
}

for (const component of ["SettingsApp", "SocialApp", "ChatView", "DirectChatView", "GroupChatModals"]) {
  assert(
    new RegExp(`const ${component} = React\\.lazy\\(\\(\\) => import\\(`).test(maliPhone),
    `${component} must remain route-lazy`,
  );
}

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

console.log("ok: gallery, animation, route chunking, and Yunyin HUD/settings guards hold");
