import { fetchWithTimeout, isRequestCancelled, NETWORK_TIMEOUTS } from "../../utils/networkRequest.js";
import {
  loadMusicSdk,
  MUSIC_PLAYER_READY_TIMEOUT_MS,
  MUSIC_SDK_TIMEOUT_MS,
  withMusicTimeout,
} from "./musicSdkLoader.js";

// YouTube IFrame Player API 封裝（免費免申請）。
// iframe 掛在 PlayerHost 的 #yt-player-host，1×1 px 移出視野維持背景播放。
let player = null;
let tick = null;
let cbs = {};
let readyPromise = null;
let loadedTrack = null;

function ensureApi(options = {}) {
  if (window.YT?.Player) return Promise.resolve();
  if (readyPromise) return readyPromise;
  readyPromise = loadMusicSdk({
    src: "https://www.youtube.com/iframe_api",
    label: "YouTube",
    callbackName: "onYouTubeIframeAPIReady",
    getReady: () => window.YT?.Player ? window.YT : null,
    timeoutMs: options.sdkTimeoutMs || MUSIC_SDK_TIMEOUT_MS,
  }).catch((error) => {
    readyPromise = null;
    throw error;
  });
  return readyPromise;
}

export function videoIdFromUrl(url) {
  const match = String(url || "").match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([\w-]{11})/);
  return match?.[1] || null;
}

export function playlistIdFromUrl(url) {
  const match = String(url || "").match(/[?&]list=([\w-]+)/);
  return match?.[1] || null;
}

export async function trackFromUrl(url, options = {}) {
  const playlistId = playlistIdFromUrl(url);
  const id = videoIdFromUrl(url);
  if (playlistId) {
    return {
      id: `yt-playlist:${playlistId}`,
      playlistId,
      startVideoId: id,
      source: "yt",
      title: "YouTube 播放清單",
      artist: "YouTube",
      artworkUrl: id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null,
      duration: 0,
    };
  }
  if (!id) return null;
  // oEmbed 免金鑰抓標題／作者／縮圖；失敗時仍可播放，只是沒有標題
  let meta = {};
  try {
    const response = await fetchWithTimeout(
      `https://www.youtube.com/oembed?url=https://youtu.be/${id}&format=json`,
      {},
      { signal: options.signal, timeoutMs: options.timeoutMs || NETWORK_TIMEOUTS.METADATA },
    );
    meta = await response.json();
  } catch (error) {
    if (isRequestCancelled(error)) throw error;
  }
  return { id, source: "yt", title: meta.title || "YouTube", artist: meta.author_name || "", artworkUrl: meta.thumbnail_url || null, duration: 0 };
}

export async function load(track, callbacks, options = {}) {
  cbs = callbacks;
  loadedTrack = track;
  await ensureApi(options);
  if (!player) {
    const playerReady = new Promise((resolve, reject) => {
      let initialized = false;
      try {
        player = new window.YT.Player("yt-player-host", {
          width: 1, height: 1,
          playerVars: { autoplay: 1, playsinline: 1, controls: 0 },
          events: {
            onReady: () => {
              initialized = true;
              resolve();
            },
            onError: (event) => {
              const error = new Error(`YouTube 播放器錯誤（${event?.data ?? "unknown"}）`);
              cbs.onState?.(false);
              cbs.onError?.(error);
              if (!initialized) reject(error);
            },
            onStateChange: (event) => {
              cbs.onState?.(event.data === window.YT.PlayerState.PLAYING);
              if (event.data === window.YT.PlayerState.PLAYING) {
                const data = player?.getVideoData?.() || {};
                if (data.video_id) {
                  cbs.onTrack?.({
                    id: data.video_id,
                    source: "yt",
                    playlistId: loadedTrack?.playlistId || null,
                    title: data.title || "YouTube",
                    artist: data.author || "",
                    artworkUrl: `https://i.ytimg.com/vi/${data.video_id}/hqdefault.jpg`,
                    duration: player?.getDuration?.() || 0,
                  });
                }
              }
              if (event.data === window.YT.PlayerState.ENDED) {
                const playlist = player?.getPlaylist?.() || [];
                const index = player?.getPlaylistIndex?.() ?? -1;
                if (!loadedTrack?.playlistId || index < 0 || index >= playlist.length - 1) cbs.onEnded?.();
              }
            },
          },
        });
      } catch (error) {
        reject(error);
      }
    });
    try {
      await withMusicTimeout(playerReady, {
        label: "YouTube 播放器",
        timeoutMs: options.playerTimeoutMs || MUSIC_PLAYER_READY_TIMEOUT_MS,
        onTimeout: () => {
          try { player?.destroy?.(); } catch (_) {}
          player = null;
        },
      });
    } catch (error) {
      try { player?.destroy?.(); } catch (_) {}
      player = null;
      throw error;
    }
  }
  if (track.playlistId) {
    player.loadPlaylist({
      list: track.playlistId,
      listType: "playlist",
      index: 0,
      startSeconds: 0,
      suggestedQuality: "default",
    });
  } else {
    player.loadVideoById(track.id);
  }
  clearInterval(tick);
  tick = setInterval(() => {
    const duration = player?.getDuration?.() || 0;
    if (duration) cbs.onProgress?.(player.getCurrentTime() / duration);
  }, 1000);
}

export function stop() {
  clearInterval(tick);
  try { player?.stopVideo?.(); } catch (_) {}
}

export const pause = () => player?.pauseVideo?.();
export const resume = () => player?.playVideo?.();
export const next = () => {
  const playlist = player?.getPlaylist?.() || [];
  const index = player?.getPlaylistIndex?.() ?? -1;
  if (index >= 0 && index < playlist.length - 1) {
    player.nextVideo();
    return true;
  }
  return false;
};
export const seek = (pct) => {
  const duration = player?.getDuration?.() || 0;
  if (duration) player.seekTo(duration * pct, true);
};
