// 雲端同步版本檢查（MP-032 P2＋P5）。純函式，方便測試。
// 規格：docs/ai/research/2026-10-16_cloud-sync-p2-p5-spec.md
//
// 本機 meta（localStorage）記錄「這台裝置上次同步的是雲端第幾版」。上傳時把這個版號
// 當成 baseRevision 送給 worker；雲端已經比它新時，worker 回 409，前端改請玩家先下載。

const toRevision = (value) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : 0;
};

/**
 * 判斷這次上傳應該帶的 baseRevision，以及是否要先擋下來請玩家選擇。
 * @param {{ meta: object|null, remote: object|null }} input
 *   remote 為 null 代表雲端還沒有這份存檔。
 * @returns {{ baseRevision: number, conflict: null | { reason: string, currentRevision: number, localRevision: number, updatedAt: string|null, updatedBy: string|null } }}
 */
export function resolveUploadBase({ meta, remote }) {
  const localRevision = toRevision(meta?.revision);
  if (!remote) return { baseRevision: 0, conflict: null };
  const currentRevision = toRevision(remote.revision) || 1;
  const details = {
    currentRevision,
    localRevision,
    updatedAt: remote.updatedAt || null,
    updatedBy: remote.updatedBy || null,
  };
  // 從沒同步過或清過瀏覽器資料：不知道自己對應哪一版，一律當成可能比較舊。
  if (!localRevision) return { baseRevision: 0, conflict: { reason: "never-synced", ...details } };
  if (localRevision === currentRevision) return { baseRevision: currentRevision, conflict: null };
  // 雲端比較新（別的裝置上傳過），或版號對不上（雲端被重設），都不能直接覆蓋。
  return { baseRevision: localRevision, conflict: { reason: currentRevision > localRevision ? "remote-newer" : "mismatch", ...details } };
}

/** worker 回 409 時的錯誤轉成和 resolveUploadBase 相同的衝突格式。 */
export function conflictFromError(error, meta) {
  if (error?.code !== "REVISION_CONFLICT") return null;
  return {
    reason: "remote-newer",
    currentRevision: toRevision(error.currentRevision) || 1,
    localRevision: toRevision(meta?.revision),
    updatedAt: error.updatedAt || null,
    updatedBy: error.updatedBy || null,
  };
}

/**
 * 下載雲端舊版本到這台裝置後要寫入的 meta。
 * 版號記成「雲端目前最新版」，代表玩家是刻意根據最新版改回舊內容，之後上傳不會被擋。
 */
export function metaAfterHistoryRestore({ restoredRevision, headRevision, headUpdatedAt = null, at = new Date().toISOString() }) {
  return {
    action: "restore-history",
    at,
    revision: toRevision(headRevision) || toRevision(restoredRevision) || 1,
    restoredRevision: toRevision(restoredRevision),
    remoteUpdatedAt: headUpdatedAt,
  };
}

/** 只送粗略的裝置類型，用來顯示「由哪台裝置上傳」，不含任何識別碼。 */
export function getDeviceLabel(env = globalThis) {
  try {
    const capacitor = env?.Capacitor;
    if (capacitor?.isNativePlatform?.()) {
      const platform = String(capacitor.getPlatform?.() || "app");
      return platform === "android" ? "Android" : platform === "ios" ? "iOS" : "App";
    }
    const ua = String(env?.navigator?.userAgent || "");
    const os = /Android/i.test(ua) ? "Android" : /iPhone|iPad|iPod/i.test(ua) ? "iOS" : /Windows/i.test(ua) ? "Windows" : /Mac OS X/i.test(ua) ? "Mac" : /Linux/i.test(ua) ? "Linux" : "";
    const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "";
    return [os, browser].filter(Boolean).join(" ").slice(0, 40) || "Web";
  } catch {
    return "Web";
  }
}
