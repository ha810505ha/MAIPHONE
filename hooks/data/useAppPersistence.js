import { useEffect, useRef, useState } from "react";
import { recordRuntimeDiagnostic } from "../../services/diagnostics/runtimeDiagnostics";

// 讀取失敗時的重試間隔：Android WebView 偶爾在啟動瞬間打不開 IndexedDB，稍等通常就好。
const LOAD_RETRY_DELAYS_MS = [400, 1200];
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default function useAppPersistence({ defaults, snapshot, loadState, saveState, syncOnBoot, schedulePush, onLoad, paused = false, writeGuard }) {
  const [hydrated, setHydrated] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const initialLoadRef = useRef(onLoad);
  const loadConfigRef = useRef({ defaults, loadState, syncOnBoot });

  useEffect(() => {
    let mounted = true;
    const config = loadConfigRef.current;
    const loadWithRetry = async () => {
      for (let attempt = 0; ; attempt += 1) {
        try {
          return await config.loadState(config.defaults);
        } catch (error) {
          if (attempt >= LOAD_RETRY_DELAYS_MS.length) throw error;
          await wait(LOAD_RETRY_DELAYS_MS[attempt]);
          if (!mounted) throw error;
        }
      }
    };
    config.syncOnBoot().catch(() => null).then(loadWithRetry).then((data) => {
      if (!mounted) return;
      initialLoadRef.current(data);
      setHydrated(true);
    }).catch((error) => {
      if (!mounted) return;
      // 讀不到存檔時絕不能用預設空資料開機：hydrated 一旦為 true，
      // 存檔 effect 會把空資料寫回 IndexedDB，蓋掉其實還在的玩家資料。
      recordRuntimeDiagnostic({
        kind: "storage-load",
        error,
        source: "useAppPersistence",
        details: { name: String(error?.name || "Error").slice(0, 60) },
      });
      setLoadError(error || new Error("Storage load failed"));
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const epoch = writeGuard?.epoch;
    const canWrite = () => !paused && !writeGuard?.active && !writeGuard?.blocked && writeGuard?.epoch === epoch;
    if (!hydrated || !canWrite()) return;
    const timer = setTimeout(() => {
      // The mutable guard also stops timers queued before React renders the pause.
      if (!canWrite()) return;
      const pending = Promise.resolve().then(() => {
        if (canWrite()) return saveState(snapshot);
      }).then(() => {
        if (canWrite()) return schedulePush();
      }).catch(() => {}).finally(() => {
        if (writeGuard?.pending === pending) writeGuard.pending = null;
      });
      if (writeGuard) writeGuard.pending = pending;
    }, 180);
    return () => clearTimeout(timer);
  }, [hydrated, snapshot, saveState, schedulePush, paused, writeGuard]);

  return { hydrated, loadFailed: Boolean(loadError), loadError };
}
