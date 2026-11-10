// 帳號雲端存檔（文字文件）的上傳核心：手動按鈕與自動同步共用同一條路（MP-094）。
// 只做「讀雲端目前版本 → 版本比對 → 合併帳本／遊戲進度 → PUT」，不碰 UI；呼叫端決定怎麼顯示。
import {
  getCloudDocument,
  isCloudDocumentNotFound,
  isCloudRevisionConflict,
  putCloudDocument,
} from "./cloudDataService.js";
import { conflictFromError, getDeviceLabel, resolveUploadBase } from "./cloudSyncRevision.js";
import { mergeWalletSyncData } from "../../utils/walletSync.js";
import { mergeGameProgressSyncData } from "../../utils/gameProgressSync.js";
import { validateTextSyncDocument } from "../../utils/textSyncDocument.js";

export const TEXT_SYNC_DOCUMENT_KEY = "app-text-sync-v1";
const TEXT_SYNC_META_PREFIX = "maliphone_text_sync_meta:";

// worker v3：壓縮後 20MB、每人每小時 30 次（任務板 MP-032 v3 規格）。原始 JSON 真實中文聊天約壓到 35～45%，
// 所以原始 8MB 左右就提醒整理對話，超過 40MB 直接不送（壓縮後也可能超過 20MB）。
export const TEXT_SYNC_SIZE_LIMITS = Object.freeze({ warnBytes: 8 * 1024 * 1024, maxBytes: 40 * 1024 * 1024 });

export function readTextSyncMeta(userId) {
  if (!userId) return null;
  try {
    const value = JSON.parse(localStorage.getItem(`${TEXT_SYNC_META_PREFIX}${userId}`) || "null");
    return value && typeof value === "object" ? value : null;
  } catch {
    return null;
  }
}

export function saveTextSyncMeta(userId, value) {
  if (!userId) return;
  try { localStorage.setItem(`${TEXT_SYNC_META_PREFIX}${userId}`, JSON.stringify(value)); } catch {}
}

export function measureDocumentBytes(document) {
  const json = JSON.stringify(document);
  if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(json).length;
  return json.length;
}

export class TextSyncDocumentTooLargeError extends Error {
  constructor(bytes, limit) {
    super(`Text sync document is too large (${bytes} > ${limit} bytes)`);
    this.name = "TextSyncDocumentTooLargeError";
    this.code = "DOCUMENT_TOO_LARGE";
    this.bytes = bytes;
    this.limit = limit;
  }
}

export class TextSyncRemoteReadError extends Error {
  constructor(cause) {
    super("Could not read the existing cloud document");
    this.name = "TextSyncRemoteReadError";
    this.code = "REMOTE_READ_FAILED";
    this.cause = cause;
  }
}

/**
 * 上傳一份文字文件。
 * 回傳：
 *   { status: "uploaded", revision, meta, remote, mediaResult, bytes, warning }
 *   { status: "conflict", conflict }  雲端比這台新（或這台從沒同步過），要玩家選擇；force 可略過
 * 丟出：TextSyncRemoteReadError（雲端讀不到、非 404）、TextSyncDocumentTooLargeError、其他網路錯誤（含 429 限流、409 競爭衝突）。
 */
export async function uploadTextSyncDocument({
  session, userId, getTextSyncDocument, force = false, environment, device = getDeviceLabel(),
  limits = TEXT_SYNC_SIZE_LIMITS, api = { getCloudDocument, putCloudDocument },
} = {}) {
  if (!session || typeof getTextSyncDocument !== "function") throw new Error("Text sync is not ready");
  const localMeta = readTextSyncMeta(userId);
  let existing;
  try {
    existing = await api.getCloudDocument(session, TEXT_SYNC_DOCUMENT_KEY, environment);
    if (existing?.key !== TEXT_SYNC_DOCUMENT_KEY) throw new Error("Unexpected cloud document");
    validateTextSyncDocument(existing.data);
  } catch (error) {
    if (!isCloudDocumentNotFound(error)) throw new TextSyncRemoteReadError(error);
    existing = null;
  }
  // P2：雲端比這台新（或這台從沒同步過）時不直接覆蓋，先請玩家選擇。
  const remoteInfo = existing ? { revision: existing.revision, updatedAt: existing.updatedAt, updatedBy: existing.updatedBy } : null;
  const { baseRevision, conflict } = resolveUploadBase({ meta: localMeta, remote: remoteInfo });
  if (conflict && !force) return { status: "conflict", conflict };

  let mediaResult;
  const document = await getTextSyncDocument({ session, environment, onMediaSync: (result) => { mediaResult = result; } });
  // 文字狀態是整份覆蓋；錢包帳本與遊戲進度例外：先把雲端那份併進來，另一台還沒下載的交易不會被抹掉。
  if (existing?.data?.state?.walletData) {
    document.state.walletData = mergeWalletSyncData(document.state.walletData, existing.data.state.walletData);
  }
  if (existing?.data?.state?.featureData) {
    document.state.featureData = {
      ...(document.state.featureData || {}),
      ...mergeGameProgressSyncData(document.state.featureData, existing.data.state.featureData),
    };
  }
  const bytes = measureDocumentBytes(document);
  if (bytes > limits.maxBytes) throw new TextSyncDocumentTooLargeError(bytes, limits.maxBytes);
  let saved;
  try {
    saved = await api.putCloudDocument(session, TEXT_SYNC_DOCUMENT_KEY, document, {
      ...(force ? { force: true } : { baseRevision }),
      device,
      environment,
    });
  } catch (error) {
    // 兩台裝置幾乎同時上傳時，由 worker 的條件寫入擋下後到的那台。
    if (isCloudRevisionConflict(error)) return { status: "conflict", conflict: conflictFromError(error, localMeta) };
    throw error;
  }
  const revision = saved?.revision || 1;
  const meta = { action: "upload", at: new Date().toISOString(), revision, remoteUpdatedAt: saved?.updatedAt || null };
  saveTextSyncMeta(userId, meta);
  return {
    status: "uploaded",
    revision,
    meta,
    remote: { revision, updatedAt: meta.remoteUpdatedAt, updatedBy: saved?.updatedBy || device },
    mediaResult,
    bytes,
    warning: bytes > limits.warnBytes ? "large" : null,
  };
}
