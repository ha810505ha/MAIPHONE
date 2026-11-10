import assert from "node:assert/strict";
import fs from "node:fs";
import {
  isDynamicImportError,
  loadWithRetry,
  shouldAutoReloadAfterImportError,
} from "../utils/lazyWithRetry.js";
import {
  clearRuntimeDiagnostics,
  formatRuntimeDiagnostics,
  getRuntimeDiagnostics,
  installBlankScreenWatchdog,
  installRootBlankScreenWatchdog,
  recordRuntimeDiagnostic,
  setRuntimeDiagnosticApp,
} from "../services/diagnostics/runtimeDiagnostics.js";

{
  let attempts = 0;
  const loaded = await loadWithRetry(async () => {
    attempts += 1;
    if (attempts === 1) throw new Error("temporary WebView load failure");
    return { default: "ready" };
  }, { attempts: 2, delayMs: 0 });
  assert.deepEqual(loaded, { default: "ready" });
  assert.equal(attempts, 2, "延遲載入第一次失敗後應自動重試");
}

{
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const values = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key) => values.get(key) || null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    },
  });
  try {
    setRuntimeDiagnosticApp("home");
    setRuntimeDiagnosticApp("yunyin");
    setRuntimeDiagnosticApp("lorebook");
    recordRuntimeDiagnostic({
      kind: "test-error",
      message: "request failed with test-api-key and ?api_key=private-token",
      stack: "at LorebookApp (LorebookApp.jsx:42)",
    });
    const [record] = getRuntimeDiagnostics();
    assert.equal(record.appId, "lorebook");
    assert.deepEqual(record.recentApps.slice(-3), ["home", "yunyin", "lorebook"]);
    assert.doesNotMatch(record.message, /private-token|sk-proj/i, "錯誤紀錄不得保留 API Key");
    const report = formatRuntimeDiagnostics();
    assert.match(report, /MaliPhone 錯誤診斷/);
    assert.match(report, /home → yunyin → lorebook/);
    assert.doesNotMatch(report, /private-token|abcdefghijklmnop/);

    for (let index = 0; index < 12; index += 1) {
      recordRuntimeDiagnostic({ kind: "limit-test", message: `error-${index}` });
    }
    assert.equal(getRuntimeDiagnostics().length, 10, "裝置端只保留最近十筆錯誤");
    clearRuntimeDiagnostics();
    assert.equal(getRuntimeDiagnostics().length, 0);

    const previousDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
    const previousTimer = Object.getOwnPropertyDescriptor(globalThis, "setTimeout");
    const previousClearTimer = Object.getOwnPropertyDescriptor(globalThis, "clearTimeout");
    let pendingCheck = null;
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: {
        visibilityState: "visible",
        querySelector: () => ({ querySelectorAll: () => [] }),
        getElementById: () => ({ querySelector: () => null, querySelectorAll: () => [] }),
      },
    });
    Object.defineProperty(globalThis, "setTimeout", {
      configurable: true,
      value: (callback) => { pendingCheck = callback; return 1; },
    });
    Object.defineProperty(globalThis, "clearTimeout", { configurable: true, value: () => {} });
    try {
      installBlankScreenWatchdog({ appId: "chat" });
      pendingCheck?.();
      assert.equal(getRuntimeDiagnostics()[0]?.kind, "blank-screen");
      clearRuntimeDiagnostics();
      installRootBlankScreenWatchdog();
      pendingCheck?.();
      assert.equal(getRuntimeDiagnostics()[0]?.kind, "blank-screen");
    } finally {
      if (previousDocument) Object.defineProperty(globalThis, "document", previousDocument);
      else delete globalThis.document;
      if (previousTimer) Object.defineProperty(globalThis, "setTimeout", previousTimer);
      else delete globalThis.setTimeout;
      if (previousClearTimer) Object.defineProperty(globalThis, "clearTimeout", previousClearTimer);
      else delete globalThis.clearTimeout;
    }
  } finally {
    if (previousStorage) Object.defineProperty(globalThis, "localStorage", previousStorage);
    else delete globalThis.localStorage;
  }
}

{
  let attempts = 0;
  await assert.rejects(
    loadWithRetry(async () => {
      attempts += 1;
      throw new Error("persistent failure");
    }, { attempts: 2, delayMs: 0 }),
    /persistent failure/,
  );
  assert.equal(attempts, 2, "持續失敗不得無限重試");
}

for (const message of [
  "ChunkLoadError: Loading chunk 12 failed",
  "Failed to fetch dynamically imported module",
  "Importing a module script failed",
  "error loading dynamically imported module",
]) {
  assert.equal(isDynamicImportError(new Error(message)), true, message);
}
assert.equal(isDynamicImportError(new Error("ordinary render failure")), false);

{
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
  };
  const error = new Error("Failed to fetch dynamically imported module");
  assert.equal(shouldAutoReloadAfterImportError(error, storage, "yunyin", 10_000), true);
  assert.equal(shouldAutoReloadAfterImportError(error, storage, "yunyin", 20_000), false, "冷卻期間不得重複重新載入");
  assert.equal(shouldAutoReloadAfterImportError(error, storage, "lorebook", 20_000), true, "不同 App 分別保護");
  assert.equal(shouldAutoReloadAfterImportError(error, storage, "yunyin", 40_001), true, "冷卻後可以再次恢復");
}

const shellSource = fs.readFileSync(
  new URL("../components/shell/MaliPhoneShell.jsx", import.meta.url),
  "utf8",
);
const boundarySource = fs.readFileSync(
  new URL("../components/shell/AppRuntimeBoundary.jsx", import.meta.url),
  "utf8",
);
const mainSource = fs.readFileSync(new URL("../main.jsx", import.meta.url), "utf8");
const appRouterSource = fs.readFileSync(new URL("../components/apps/AppRouter.jsx", import.meta.url), "utf8");
const aboutSource = fs.readFileSync(
  new URL("../components/settings/AboutInfoSettings.jsx", import.meta.url),
  "utf8",
);
const styleSource = fs.readFileSync(new URL("../styles/maliPhone.css", import.meta.url), "utf8");
const diagnosticsSource = fs.readFileSync(
  new URL("../services/diagnostics/runtimeDiagnostics.js", import.meta.url),
  "utf8",
);
const lockScreenSource = fs.readFileSync(
  new URL("../components/shell/LockScreen.jsx", import.meta.url),
  "utf8",
);
const networkSource = fs.readFileSync(
  new URL("../utils/networkRequest.js", import.meta.url),
  "utf8",
);
const aiSource = fs.readFileSync(
  new URL("../services/aiService.js", import.meta.url),
  "utf8",
);
const lazySurfaceSources = [
  "../components/apps/AppRouter.jsx",
  "../components/apps/MaliPhoneFeatureSurfaces.jsx",
  "../components/apps/MaliPhoneUtilitySurfaces.jsx",
  "../components/chat/MaliPhoneChatSurface.jsx",
  "../components/music/MusicShellLayer.jsx",
  "../components/settings/MaliPhoneSettingsSurface.jsx",
  "../components/shell/MaliPhoneOverlays.jsx",
].map((path) => fs.readFileSync(new URL(path, import.meta.url), "utf8"));

assert.match(shellSource, /<AppRuntimeBoundary/, "手機殼應由執行期錯誤邊界保護");
assert.match(appRouterSource, /UnknownApp/, "過期或未知 App ID 不可讓內容變成空白");
assert.match(boundarySource, /返回主畫面/, "錯誤頁應允許玩家返回主畫面");
assert.match(boundarySource, /location\?\.reload/, "錯誤頁應提供重新載入");
assert.match(boundarySource, /copyRuntimeDiagnostics/, "錯誤頁應能直接複製診斷資訊");
assert.match(mainSource, /installGlobalRuntimeDiagnostics\(\)/, "啟動時應捕捉全域錯誤與未處理 Promise");
assert.match(mainSource, /<AppRuntimeBoundary appId="root">/, "手機外層也應防止致命錯誤變成全白畫面");
assert.match(aboutSource, /錯誤診斷/, "重開後應可從設定查看保留的錯誤紀錄");
assert.match(aboutSource, /copyRuntimeDiagnostics/, "設定頁應能複製保留的錯誤紀錄");
assert.match(styleSource, /\.mp-page\{[^}]*opacity:1;/, "App 頁面不可依賴 WebView 進場動畫完成才可見");
assert.doesNotMatch(styleSource, /@keyframes mpAppOpen\{\s*from\{transform:scale\(\.97\);opacity:0\}/, "App 進場動畫不可把整頁卡在透明狀態");
assert.match(diagnosticsSource, /installBlankScreenWatchdog/, "blank screen watchdog must be present");
assert.match(diagnosticsSource, /installRootBlankScreenWatchdog/, "root-level blank screen watchdog must be present");
assert.match(diagnosticsSource, /appId === "petHome" \? ".mp-page, .pet-app"/, "Pet Home loading surface must not be reported as blank");
assert.match(diagnosticsSource, /surfaceSnapshot/, "blank-screen records must retain render metadata");
assert.match(shellSource, /installBlankScreenWatchdog/, "route changes must start the blank screen watchdog");
assert.match(shellSource, /skipWhen: unlocking/, "lock-screen fade-out must not be reported as blank");
assert.match(shellSource, /data-runtime-phone/, "phone shell must expose the watchdog root");
assert.match(lockScreenSource, /data-runtime-phone/, "lock screen must expose the watchdog root");
assert.match(diagnosticsSource, /console-error/, "caught console errors must be available in diagnostics");
assert.match(networkSource, /network-http|network-error/, "network failures must be available in diagnostics");
assert.match(aiSource, /kind: "ai-error"/, "AI failures must be available in diagnostics");
for (const source of lazySurfaceSources) {
  assert.match(source, /lazyWithRetry/, "延遲載入的 App 應使用重試保護");
}

console.log("App runtime recovery checks passed");
