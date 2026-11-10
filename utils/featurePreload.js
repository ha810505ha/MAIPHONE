const featureLoaders = {
  floatingPlayer: () => import("../components/music/FloatingPlayer.jsx"),
  directChatGenerator: () => import("../services/chat/directChatGenerator.js"),
  phoneAppGen: () => import("./phoneAppGen.js"),
  chatView: () => import("../components/chat/ChatView.jsx"),
  phoneApp: () => import("../components/apps/PhoneApp.jsx"),
  musicApp: () => import("../components/apps/MusicApp.jsx"),
};

const pendingLoads = new Map();

function loadFeature(feature) {
  if (!pendingLoads.has(feature)) {
    const promise = featureLoaders[feature]().catch((error) => {
      pendingLoads.delete(feature);
      throw error;
    });
    pendingLoads.set(feature, promise);
  }
  return pendingLoads.get(feature);
}

export const loadFloatingPlayer = () => loadFeature("floatingPlayer");
export const loadDirectChatGenerator = () => loadFeature("directChatGenerator");
export const loadPhoneAppGen = () => loadFeature("phoneAppGen");
export const loadChatView = () => loadFeature("chatView");
export const loadPhoneApp = () => loadFeature("phoneApp");
export const loadMusicApp = () => loadFeature("musicApp");

const APP_PRELOADERS = {
  chat: [loadChatView, loadDirectChatGenerator],
  music: [loadMusicApp, loadFloatingPlayer],
  phone: [loadPhoneApp, loadPhoneAppGen],
};

export function preloadFeatureForApp(appId) {
  const preloaders = APP_PRELOADERS[appId];
  if (!preloaders) return Promise.resolve([]);
  return Promise.allSettled(preloaders.map((preload) => preload()));
}

function allowsIdlePreload() {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (connection?.saveData) return false;
  if (["slow-2g", "2g"].includes(connection?.effectiveType)) return false;
  return document.visibilityState !== "hidden";
}

export function scheduleIdleFeaturePreload() {
  if (!allowsIdlePreload()) return () => {};

  const warmLikelyFeatures = () => {
    if (!allowsIdlePreload()) return;
    void Promise.allSettled([
      loadDirectChatGenerator(),
      loadFloatingPlayer(),
    ]);
  };

  if (typeof window.requestIdleCallback === "function") {
    const idleId = window.requestIdleCallback(warmLikelyFeatures, { timeout: 2500 });
    return () => window.cancelIdleCallback?.(idleId);
  }

  const timeoutId = window.setTimeout(warmLikelyFeatures, 1200);
  return () => window.clearTimeout(timeoutId);
}
