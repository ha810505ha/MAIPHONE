import { useCallback, useEffect, useRef, useState } from "react";
import { isCloudAutoSyncAvailable, isOfficialSite } from "../../config/featureFlags";
import { getCloudDataConfig, getCloudDocument, isCloudDocumentNotFound, isCloudUploadRateLimited } from "../../services/cloud/cloudDataService";
import {
  TEXT_SYNC_DOCUMENT_KEY, TextSyncDocumentTooLargeError, TextSyncRemoteReadError, readTextSyncMeta, saveTextSyncMeta, uploadTextSyncDocument,
} from "../../services/cloud/textSyncService";
import {
  AUTO_CHECK_MIN_INTERVAL_MS, AUTO_SYNC_FAILURE_BACKOFF_MS, getAutoSyncTimings, planAutoDownload, planNextAutoSync, readAutoSyncState, writeAutoSyncState,
} from "../../services/cloud/autoSyncPlanner";
import { recordRuntimeDiagnostic } from "../../services/diagnostics/runtimeDiagnostics";
import { APP_DATA_SAVED_EVENT } from "../../services/featureDataLifecycle";

/**
 * 網頁版登入後的自動同步（MP-094，2026-10-29「正式站直接開同步」）：
 * - 本機存檔有變動 → 安靜 45 秒後、距上次上傳至少 5 分鐘 → 自動上傳（走與手動按鈕同一條 uploadTextSyncDocument）。
 *   正式站（isOfficialSite）改用 getAutoSyncTimings({ official: true })：安靜 15 秒、間隔 2 分鐘（worker 每小時 30 次的上限）。
 * - 自動下載（MP-095；正式站一律自動上傳下載）：登入／回到前景時看一眼雲端；本機沒有角色，或雲端較新而這台
 *   沒有還沒傳上去的變動 → 直接載入（下載前照舊留「覆蓋資料前」快照）；這台有未傳變動或從沒同步過 → 只通知，請玩家決定。
 * - 限流／失敗：依 retryAfter 或 15 分鐘退避；文件過大：停下並提示整理對話。
 * - APP（Capacitor）與旗標關閉時整個 hook 是 no-op。
 */
export default function useCloudAutoSync({
  auth, hydrated, paused = false, getTextSyncDocument, applyTextSyncDocument, localCharacterCount = 0, onUploaded, onDownloaded, onCloudNewer,
}) {
  const available = isCloudAutoSyncAvailable() && getCloudDataConfig().configured;
  const official = isOfficialSite();
  const timings = getAutoSyncTimings({ official });
  const userId = auth?.user?.id || "";
  const session = auth?.session || null;
  const [state, setState] = useState(() => readAutoSyncState(userId));
  const [busy, setBusy] = useState(false);
  // 帳號頁狀態列用：uploading＝真的在上傳（busy 也包含看雲端）；pending＝已排好下一次上傳。
  // 倒數秒數放 ref、由帳號頁自己每秒讀，避免每次存檔都讓整個 MaliPhone 重新 render。
  const [uploading, setUploading] = useState(false);
  const [pending, setPending] = useState(false);
  const nextUploadAtRef = useRef(0);
  const dirtyRef = useRef(false);
  const lastChangeAtRef = useRef(0);
  const blockedRef = useRef(null); // { revision } 雲端較新時記住，玩家下載／覆蓋後才解除
  const blockedUntilRef = useRef(0);
  const busyRef = useRef(false);
  const timerRef = useRef(null);
  const latestRef = useRef({});
  // 正式站一律自動同步（2026-10-29），沒有開關；其他平台看每帳號設定。
  const enabled = official || state.enabled;
  latestRef.current = { session, userId, getTextSyncDocument, applyTextSyncDocument, localCharacterCount, onUploaded, onDownloaded, onCloudNewer, paused, enabled };
  const lastCheckAtRef = useRef(0);

  // 換帳號：重讀該帳號的自動同步狀態；標記全部歸零。
  useEffect(() => {
    setState(readAutoSyncState(userId));
    blockedRef.current = null;
    blockedUntilRef.current = 0;
  }, [userId]);

  // 本機真的寫進存檔（主資料實體或功能存檔有變）才算有東西要上傳；開機 hydrate 前的寫入不算。
  useEffect(() => {
    if (!hydrated || !available) return undefined;
    const onSaved = () => {
      dirtyRef.current = true;
      lastChangeAtRef.current = Date.now();
      scheduleRef.current?.();
    };
    window.addEventListener(APP_DATA_SAVED_EVENT, onSaved);
    return () => window.removeEventListener(APP_DATA_SAVED_EVENT, onSaved);
  }, [hydrated, available]);
  const scheduleRef = useRef(null);

  const persist = useCallback((patch) => {
    const next = writeAutoSyncState(latestRef.current.userId, patch);
    setState(next);
    return next;
  }, []);

  const runUpload = useCallback(async ({ manual = false } = {}) => {
    const { session: currentSession, userId: currentUser, getTextSyncDocument: getDocument, onUploaded: uploaded, onCloudNewer: cloudNewer, paused: isPaused } = latestRef.current;
    if (!available || !currentSession || !currentUser || !getDocument || busyRef.current) return null;
    if (isPaused && !manual) return null;
    // 雲端較新而玩家還沒處理：本機 meta 沒變就不再試。
    if (blockedRef.current && !manual) {
      const meta = readTextSyncMeta(currentUser);
      if (!(Number(meta?.revision) >= Number(blockedRef.current.revision))) return null;
      blockedRef.current = null;
    }
    busyRef.current = true;
    setBusy(true);
    setUploading(true);
    const startedAt = Date.now();
    try {
      const result = await uploadTextSyncDocument({ session: currentSession, userId: currentUser, getTextSyncDocument: getDocument });
      if (result.status === "conflict") {
        blockedRef.current = { revision: Number(result.conflict?.currentRevision) || 0 };
        persist({ lastAttemptAt: startedAt, lastStatus: "cloud-newer", lastMessage: "", remoteRevision: blockedRef.current.revision });
        cloudNewer?.(result.conflict);
        return result;
      }
      dirtyRef.current = lastChangeAtRef.current > startedAt; // 上傳途中又改的，留到下一輪
      blockedUntilRef.current = 0;
      persist({ lastAttemptAt: startedAt, lastSyncAt: Date.now(), lastRevision: result.revision, lastStatus: result.warning === "large" ? "uploaded-large" : "uploaded", lastMessage: "" });
      uploaded?.(result);
      return result;
    } catch (error) {
      if (isCloudUploadRateLimited(error)) {
        blockedUntilRef.current = Date.now() + Math.max(60, Number(error.retryAfter) || 3600) * 1000;
        persist({ lastAttemptAt: startedAt, lastStatus: "rate-limited", lastMessage: "" });
      } else if (error instanceof TextSyncDocumentTooLargeError) {
        dirtyRef.current = false; // 再試也一樣大，等玩家整理
        persist({ lastAttemptAt: startedAt, lastStatus: "too-large", lastMessage: String(error.bytes) });
      } else {
        blockedUntilRef.current = Date.now() + AUTO_SYNC_FAILURE_BACKOFF_MS;
        const message = error instanceof TextSyncRemoteReadError ? (error.cause?.message || error.message) : (error?.message || "");
        persist({ lastAttemptAt: startedAt, lastStatus: "failed", lastMessage: String(message).slice(0, 160) });
        recordRuntimeDiagnostic({ kind: "cloud-auto-sync", error, source: "useCloudAutoSync" });
      }
      return null;
    } finally {
      busyRef.current = false;
      setBusy(false);
      setUploading(false);
      scheduleRef.current?.();
    }
  }, [available, persist]);

  // 下載一份雲端存檔到這台（走既有 applyTextSyncDocument：先留快照、交易套用）。
  const downloadRemote = useCallback(async (remote) => {
    const { session: currentSession, userId: currentUser, applyTextSyncDocument: apply, onDownloaded: downloaded } = latestRef.current;
    if (!apply || !remote?.data) return false;
    await apply(remote.data, { session: currentSession });
    const meta = { action: "download", at: new Date().toISOString(), revision: remote.revision || 1, remoteUpdatedAt: remote.updatedAt || null };
    saveTextSyncMeta(currentUser, meta);
    dirtyRef.current = false;
    blockedRef.current = null;
    persist({ lastSyncAt: Date.now(), lastRevision: meta.revision, lastStatus: "downloaded", lastMessage: "" });
    downloaded?.({ revision: meta.revision, updatedBy: remote.updatedBy || "" });
    return true;
  }, [persist]);

  /** 看一眼雲端：該載入就載入、該問就通知。reason 只用於節流（login／visible／manual）。 */
  const checkCloud = useCallback(async ({ reason = "visible" } = {}) => {
    const { session: currentSession, userId: currentUser, paused: isPaused, enabled, localCharacterCount: count, onCloudNewer: cloudNewer } = latestRef.current;
    if (!available || !currentSession || !currentUser || !enabled || isPaused || busyRef.current) return null;
    if (reason === "visible" && Date.now() - lastCheckAtRef.current < AUTO_CHECK_MIN_INTERVAL_MS) return null;
    lastCheckAtRef.current = Date.now();
    busyRef.current = true;
    setBusy(true);
    try {
      let remote = null;
      try {
        remote = await getCloudDocument(currentSession, TEXT_SYNC_DOCUMENT_KEY);
      } catch (error) {
        if (!isCloudDocumentNotFound(error)) throw error;
      }
      const localMeta = readTextSyncMeta(currentUser);
      const plan = planAutoDownload({
        remoteExists: Boolean(remote?.data),
        remoteRevision: remote?.revision,
        localRevision: localMeta?.revision,
        localCharacterCount: count,
        dirty: dirtyRef.current,
      });
      if (plan === "load") {
        await downloadRemote(remote);
        return "downloaded";
      }
      if (plan === "ask") {
        const revision = Number(remote?.revision) || 0;
        if (!blockedRef.current || blockedRef.current.revision !== revision) {
          blockedRef.current = { revision };
          persist({ lastStatus: "cloud-newer", lastMessage: "", remoteRevision: revision });
          cloudNewer?.({ reason: localMeta?.revision ? "remote-newer" : "never-synced", currentRevision: revision, updatedAt: remote?.updatedAt, updatedBy: remote?.updatedBy });
        }
        return "cloud-newer";
      }
      return null;
    } catch (error) {
      persist({ lastStatus: "failed", lastMessage: String(error?.message || "").slice(0, 160) });
      recordRuntimeDiagnostic({ kind: "cloud-auto-sync", error, source: "useCloudAutoSync:check" });
      return null;
    } finally {
      busyRef.current = false;
      setBusy(false);
      scheduleRef.current?.();
    }
  }, [available, persist, downloadRemote]);

  // 登入（或開機時已登入）後先看雲端；回到前景時最多每 5 分鐘看一次。
  useEffect(() => {
    if (!hydrated || !available || !session) return undefined;
    const timer = setTimeout(() => { void checkCloud({ reason: "login" }); }, 1500);
    return () => clearTimeout(timer);
  }, [hydrated, available, session, checkCloud]);
  useEffect(() => {
    if (!available) return undefined;
    const onVisible = () => { if (document.visibilityState === "visible") void checkCloud({ reason: "visible" }); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [available, checkCloud]);

  const schedule = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = null;
    nextUploadAtRef.current = 0;
    const { session: currentSession, enabled, paused: isPaused } = latestRef.current;
    if (!available || !currentSession || !enabled || isPaused) { setPending(false); return; }
    const stored = readAutoSyncState(latestRef.current.userId);
    const delay = planNextAutoSync({
      dirty: dirtyRef.current,
      blocked: Boolean(blockedRef.current),
      lastChangeAt: lastChangeAtRef.current,
      lastAttemptAt: stored.lastAttemptAt,
      blockedUntil: blockedUntilRef.current,
      ...timings,
    });
    setPending(delay !== null);
    if (delay === null) return;
    nextUploadAtRef.current = Date.now() + delay;
    timerRef.current = setTimeout(() => { timerRef.current = null; nextUploadAtRef.current = 0; void runUpload(); }, delay);
  }, [available, runUpload, timings]);
  scheduleRef.current = schedule;

  // 登入、開關、暫停狀態改變時重新排程；離開頁面前若有變動且間隔已到就盡力送一次。
  useEffect(() => { schedule(); return () => clearTimeout(timerRef.current); }, [schedule, session, enabled, paused]);
  useEffect(() => {
    if (!available) return undefined;
    const onHide = () => {
      if (document.visibilityState !== "hidden") return;
      const delay = planNextAutoSync({ dirty: dirtyRef.current, blocked: Boolean(blockedRef.current), lastChangeAt: 0, lastAttemptAt: readAutoSyncState(latestRef.current.userId).lastAttemptAt, blockedUntil: blockedUntilRef.current, ...timings });
      if (delay === 0 && latestRef.current.enabled && !latestRef.current.paused) void runUpload();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [available, runUpload, timings]);

  const setEnabled = useCallback((enabled) => { persist({ enabled: Boolean(enabled) }); }, [persist]);
  const syncNow = useCallback(() => runUpload({ manual: true }), [runUpload]);
  // 玩家在帳號頁手動上傳／下載後，自動同步的「雲端較新」狀態要跟著解除。
  const noteManualSync = useCallback((meta) => {
    blockedRef.current = null;
    blockedUntilRef.current = 0;
    if (meta?.action === "upload") dirtyRef.current = false;
    persist({ lastSyncAt: Date.now(), lastRevision: Number(meta?.revision) || 0, lastStatus: meta?.action === "download" ? "downloaded" : "uploaded", lastMessage: "" });
  }, [persist]);

  const checkNow = useCallback(() => checkCloud({ reason: "manual" }), [checkCloud]);
  // 下一次自動上傳的時間（毫秒時間戳，0＝沒有排程）；帳號頁用來顯示「約 N 秒後」。
  const getNextUploadAt = useCallback(() => nextUploadAtRef.current, []);
  return { available, official, timings, enabled, busy, uploading, pending, getNextUploadAt, state, setEnabled, syncNow, checkNow, noteManualSync };
}
