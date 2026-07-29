import { fetchWithTimeout, isRequestCancelled, NETWORK_TIMEOUTS } from "../../utils/networkRequest.js";
import {
  loadMusicSdk,
  MUSIC_PLAYER_READY_TIMEOUT_MS,
  MUSIC_SDK_TIMEOUT_MS,
  withMusicTimeout,
} from "./musicSdkLoader.js";

// Spotify Embed iframe API 播放（瀏覽器已登入 Spotify 可播全曲，否則 30 秒預覽）。
// OAuth now-playing 屬之後的擴充，v1 先支援貼連結播放。
let controller = null;
let cbs = {};
let apiPromise = null;

function ensureEmbedApi(options = {}) {
  if (window.__spEmbedApi) return Promise.resolve(window.__spEmbedApi);
  if (apiPromise) return apiPromise;
  apiPromise = loadMusicSdk({
    src: "https://open.spotify.com/embed/iframe-api/v1",
    label: "Spotify",
    callbackName: "onSpotifyIframeApiReady",
    getReady: (api) => {
      if (api) window.__spEmbedApi = api;
      return window.__spEmbedApi || null;
    },
    timeoutMs: options.sdkTimeoutMs || MUSIC_SDK_TIMEOUT_MS,
  }).catch((error) => {
    apiPromise = null;
    throw error;
  });
  return apiPromise;
}

export async function trackFromUrl(url, options = {}) {
  const match = String(url || "").match(/open\.spotify\.com\/(?:intl-[\w-]+\/)?(track|episode)\/(\w+)/);
  if (!match) return null;
  const track = { id: `spotify:${match[1]}:${match[2]}`, source: "sp", title: "Spotify", artist: "", artworkUrl: null, duration: 0 };
  // oEmbed 補標題與縮圖，失敗不影響播放
  let meta = {};
  try {
    const response = await fetchWithTimeout(
      `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`,
      {},
      { signal: options.signal, timeoutMs: options.timeoutMs || NETWORK_TIMEOUTS.METADATA },
    );
    meta = await response.json();
  } catch (error) {
    if (isRequestCancelled(error)) throw error;
  }
  if (meta.title) track.title = meta.title;
  if (meta.thumbnail_url) track.artworkUrl = meta.thumbnail_url;
  return track;
}

export async function load(track, callbacks, options = {}) {
  cbs = callbacks;
  const api = await ensureEmbedApi(options);
  if (controller) {
    controller.loadUri(track.id);
    controller.play();
    return;
  }
  const controllerReady = new Promise((resolve, reject) => {
    try {
      api.createController(document.getElementById("sp-embed-host"), { uri: track.id, width: 1, height: 1 }, (created) => {
        if (!created) {
          reject(new Error("Spotify 播放器建立失敗"));
          return;
        }
        controller = created;
        controller.addListener("playback_update", (event) => {
          const data = event?.data || {};
          cbs.onState?.(!data.isPaused);
          if (data.duration) {
            cbs.onProgress?.(data.position / data.duration);
            if (data.position >= data.duration) cbs.onEnded?.();
          }
          lastDuration = data.duration || lastDuration;
        });
        controller.addListener?.("playback_error", (event) => {
          const error = new Error(event?.data?.message || "Spotify 播放器錯誤");
          cbs.onState?.(false);
          cbs.onError?.(error);
        });
        controller.play();
        resolve();
      });
    } catch (error) {
      reject(error);
    }
  });
  try {
    await withMusicTimeout(controllerReady, {
      label: "Spotify 播放器",
      timeoutMs: options.playerTimeoutMs || MUSIC_PLAYER_READY_TIMEOUT_MS,
      onTimeout: () => {
        try { controller?.pause?.(); } catch (_) {}
        controller = null;
      },
    });
  } catch (error) {
    try { controller?.pause?.(); } catch (_) {}
    controller = null;
    throw error;
  }
}

let lastDuration = 0;

export function stop() {
  try { controller?.pause?.(); } catch (_) {}
}

export const pause = () => controller?.pause?.();
export const resume = () => controller?.resume?.();
export const seek = (pct) => {
  if (controller && lastDuration) controller.seek((lastDuration * pct) / 1000);
};
