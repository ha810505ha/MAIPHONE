export const MUSIC_SDK_TIMEOUT_MS = 15_000;
export const MUSIC_PLAYER_READY_TIMEOUT_MS = 10_000;

export class MusicSdkLoadError extends Error {
  constructor(label, reason = "load") {
    super(reason === "timeout"
      ? `${label} SDK 載入逾時，請檢查網路後重試`
      : `${label} SDK 載入失敗，請檢查網路後重試`);
    this.name = reason === "timeout" ? "MusicSdkTimeoutError" : "MusicSdkLoadError";
    this.code = reason === "timeout" ? "MUSIC_SDK_TIMEOUT" : "MUSIC_SDK_LOAD_FAILED";
  }
}

const findScript = (documentObject, src) => (
  Array.from(documentObject?.scripts || [])
    .find((script) => script?.getAttribute?.("src") === src || script?.src === src)
);

export function loadMusicSdk({
  src,
  label,
  callbackName,
  getReady,
  timeoutMs = MUSIC_SDK_TIMEOUT_MS,
  globalObject = globalThis.window,
  documentObject = globalThis.document,
}) {
  const ready = getReady?.();
  if (ready) return Promise.resolve(ready);
  if (!globalObject || !documentObject?.createElement || !documentObject?.head) {
    return Promise.reject(new MusicSdkLoadError(label));
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    let script = findScript(documentObject, src);
    const created = !script;
    const previousReady = globalObject[callbackName];

    const cleanup = () => {
      clearTimeout(timeout);
      script?.removeEventListener?.("error", onError);
      if (globalObject[callbackName] === onReady) {
        if (typeof previousReady === "function") globalObject[callbackName] = previousReady;
        else delete globalObject[callbackName];
      }
    };
    const finish = (value) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };
    const fail = (reason) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (created) script?.remove?.();
      reject(new MusicSdkLoadError(label, reason));
    };
    const onError = () => fail("load");
    const onReady = (...args) => {
      try {
        previousReady?.(...args);
      } catch (_) {}
      const value = getReady?.(...args) || args[0];
      if (value) finish(value);
      else fail("load");
    };

    const timeout = setTimeout(() => fail("timeout"), Math.max(1, Number(timeoutMs) || MUSIC_SDK_TIMEOUT_MS));
    globalObject[callbackName] = onReady;

    if (!script) {
      script = documentObject.createElement("script");
      script.src = src;
      script.async = true;
    }
    script.addEventListener?.("error", onError, { once: true });
    if (created) documentObject.head.appendChild(script);

    const lateReady = getReady?.();
    if (lateReady) finish(lateReady);
  });
}

export function withMusicTimeout(task, {
  label,
  timeoutMs = MUSIC_PLAYER_READY_TIMEOUT_MS,
  onTimeout,
} = {}) {
  let timer;
  return Promise.race([
    Promise.resolve(task).finally(() => clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(() => {
        onTimeout?.();
        reject(new MusicSdkLoadError(label || "音樂播放器", "timeout"));
      }, Math.max(1, Number(timeoutMs) || MUSIC_PLAYER_READY_TIMEOUT_MS));
    }),
  ]);
}
