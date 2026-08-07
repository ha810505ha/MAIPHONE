import { VERSION } from "../../constants/appConstants.js";

const RUNTIME_DIAGNOSTICS_KEY = "mali_runtime_diagnostics_v1";
const MAX_RUNTIME_DIAGNOSTICS = 10;
const MAX_RECENT_APPS = 6;

let currentAppId = "home";
let recentAppIds = ["home"];
let globalCaptureInstalled = false;

const isVisibleSurface = (node) => {
  if (!node) return false;
  const style = globalThis.getComputedStyle?.(node);
  if (style && (
    style.display === "none"
    || style.visibility === "hidden"
    || Number(style.opacity) <= 0.01
  )) return false;
  const rect = node.getBoundingClientRect?.();
  return !rect || (rect.width > 1 && rect.height > 1);
};

const surfaceSnapshot = (phone, selector, surfaces) => {
  const phoneRect = phone?.getBoundingClientRect?.();
  return {
    visibilityState: cleanText(globalThis.document?.visibilityState || "unknown", 20),
    selector,
    phoneSize: phoneRect ? {
      width: Math.round(phoneRect.width || 0),
      height: Math.round(phoneRect.height || 0),
    } : null,
    surfaceCount: surfaces.length,
    surfaces: surfaces.slice(0, 4).map((surface) => {
      const style = globalThis.getComputedStyle?.(surface);
      const rect = surface.getBoundingClientRect?.();
      return {
        className: cleanText(surface.className || surface.tagName || "unknown", 120),
        display: cleanText(style?.display || "unknown", 30),
        visibility: cleanText(style?.visibility || "unknown", 30),
        opacity: cleanText(style?.opacity || "unknown", 30),
        width: Math.round(rect?.width || 0),
        height: Math.round(rect?.height || 0),
      };
    }),
  };
};

const cleanText = (value, limit = 2_000) => String(value || "")
  .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]")
  .replace(/\b(?:sk|key)-[A-Za-z0-9_-]{10,}\b/gi, "[REDACTED_KEY]")
  .replace(/\bAIza[A-Za-z0-9_-]{20,}\b/g, "[REDACTED_KEY]")
  .replace(/([?&](?:key|api_key|token)=)[^&\s]+/gi, "$1[REDACTED]")
  .replace(/((?:api[_-]?key|token)\s*[:=]\s*)[^\s,;]+/gi, "$1[REDACTED]")
  .slice(0, limit);

function readDiagnostics() {
  try {
    const parsed = JSON.parse(globalThis.localStorage?.getItem(RUNTIME_DIAGNOSTICS_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.slice(-MAX_RUNTIME_DIAGNOSTICS) : [];
  } catch {
    return [];
  }
}

function writeDiagnostics(records) {
  try {
    globalThis.localStorage?.setItem(
      RUNTIME_DIAGNOSTICS_KEY,
      JSON.stringify(records.slice(-MAX_RUNTIME_DIAGNOSTICS)),
    );
    return true;
  } catch {
    return false;
  }
}

function runtimePlatform() {
  const userAgent = String(globalThis.navigator?.userAgent || "");
  const android = userAgent.match(/Android\s+([^;)]+)/i)?.[1];
  const chrome = userAgent.match(/(?:Chrome|CriOS)\/([\d.]+)/i)?.[1];
  const webView = /;\s*wv\)/i.test(userAgent) || /\bwv\b/i.test(userAgent);
  return [
    android ? `Android ${android}` : cleanText(globalThis.navigator?.platform || "Unknown platform", 80),
    chrome ? `${webView ? "WebView" : "Chrome"} ${chrome}` : "",
  ].filter(Boolean).join(" · ");
}

export function setRuntimeDiagnosticApp(appId) {
  const normalized = cleanText(appId || "home", 40) || "home";
  currentAppId = normalized;
  if (recentAppIds.at(-1) !== normalized) {
    recentAppIds = [...recentAppIds, normalized].slice(-MAX_RECENT_APPS);
  }
}

/**
 * Detects the Android WebView failure mode where the phone shell still exists,
 * but the active route has no visible surface and no JavaScript exception.
 * The check is deliberately local-only: it records route metadata, never
 * captures rendered text or sends anything over the network.
 */
export function installBlankScreenWatchdog({ appId = "home", locked = false, skipWhen = false, delayMs = 1_600 } = {}) {
  if (typeof globalThis.setTimeout !== "function" || typeof globalThis.document === "undefined") {
    return () => {};
  }
  let cancelled = false;
  let timer = null;
  const check = () => {
    if (cancelled || skipWhen) return;
    const phone = globalThis.document.querySelector?.("[data-runtime-phone]");
    if (!phone) return;
    // Pet Home has its own full-screen loading surface while IndexedDB data is read.
    // It is visible and interactive, even though it intentionally is not an mp-page.
    const selector = locked ? ".mp-lock" : appId === "home" ? ".mp-desk" : appId === "petHome" ? ".mp-page, .pet-app" : ".mp-page";
    const surfaces = Array.from(phone.querySelectorAll?.(selector) || []);
    if (surfaces.some(isVisibleSurface)) return;
    recordRuntimeDiagnostic({
      kind: "blank-screen",
      appId: locked ? "lock" : appId,
      message: `No visible ${locked ? "lock" : appId === "home" ? "home" : "app"} surface after route change`,
      source: "blank-screen-watchdog",
      details: surfaceSnapshot(phone, selector, surfaces),
    });
  };
  const schedule = () => {
    if (cancelled) return;
    globalThis.clearTimeout?.(timer);
    timer = globalThis.setTimeout(check, Math.max(800, Number(delayMs) || 1_600));
  };
  const onVisibilityChange = () => {
    if (globalThis.document.visibilityState !== "hidden") schedule();
  };
  schedule();
  globalThis.document.addEventListener?.("visibilitychange", onVisibilityChange);
  globalThis.addEventListener?.("pageshow", schedule);
  globalThis.addEventListener?.("focus", schedule);
  return () => {
    cancelled = true;
    globalThis.clearTimeout?.(timer);
    globalThis.document.removeEventListener?.("visibilitychange", onVisibilityChange);
    globalThis.removeEventListener?.("pageshow", schedule);
    globalThis.removeEventListener?.("focus", schedule);
  };
}

/** Detects a root-level blank where the phone shell never mounts at all. */
export function installRootBlankScreenWatchdog({ delayMs = 3_500 } = {}) {
  if (typeof globalThis.setTimeout !== "function" || typeof globalThis.document === "undefined") {
    return () => {};
  }
  let cancelled = false;
  let timer = null;
  const check = () => {
    if (cancelled) return;
    const root = globalThis.document.getElementById?.("root");
    if (!root) return;
    const phone = root.querySelector?.("[data-runtime-phone]");
    const visibleFallback = Array.from(root.querySelectorAll?.(".mp-page, .mp-lock, .mp-desk") || [])
      .some(isVisibleSurface);
    if (phone || visibleFallback) return;
    recordRuntimeDiagnostic({
      kind: "blank-screen",
      appId: currentAppId,
      message: "Root mounted without a visible phone surface",
      source: "root-blank-screen-watchdog",
    });
  };
  const schedule = () => {
    if (cancelled) return;
    globalThis.clearTimeout?.(timer);
    timer = globalThis.setTimeout(check, Math.max(1_500, Number(delayMs) || 3_500));
  };
  const onVisibilityChange = () => {
    if (globalThis.document.visibilityState !== "hidden") schedule();
  };
  schedule();
  globalThis.document.addEventListener?.("visibilitychange", onVisibilityChange);
  globalThis.addEventListener?.("pageshow", schedule);
  globalThis.addEventListener?.("focus", schedule);
  return () => {
    cancelled = true;
    globalThis.clearTimeout?.(timer);
    globalThis.document.removeEventListener?.("visibilitychange", onVisibilityChange);
    globalThis.removeEventListener?.("pageshow", schedule);
    globalThis.removeEventListener?.("focus", schedule);
  };
}

export function recordRuntimeDiagnostic({
  kind = "runtime",
  error,
  message,
  stack,
  source,
  line,
  column,
  details,
  appId = currentAppId,
} = {}) {
  const resolvedMessage = cleanText(message || error?.message || error || "Unknown error", 800);
  const resolvedStack = cleanText(stack || error?.stack || "", 4_000);
  const records = readDiagnostics();
  const now = Date.now();
  const previous = records.at(-1);
  const dedupeWindow = kind === "blank-screen" ? 30_000 : 1_500;
  if (
    previous
    && previous.appId === appId
    && previous.kind === kind
    && previous.message === resolvedMessage
    && now - Number(previous.at || 0) < dedupeWindow
  ) {
    return previous;
  }
  const record = {
    id: `err_${now}_${Math.random().toString(36).slice(2, 7)}`,
    at: now,
    version: VERSION,
    platform: runtimePlatform(),
    appId: cleanText(appId || "unknown", 40),
    recentApps: [...recentAppIds],
    kind: cleanText(kind, 40),
    message: resolvedMessage,
    stack: resolvedStack,
    source: cleanText(source, 500),
    line: line != null && Number.isFinite(Number(line)) ? Number(line) : null,
    column: column != null && Number.isFinite(Number(column)) ? Number(column) : null,
    details: details && typeof details === "object" ? details : null,
  };
  writeDiagnostics([...records, record]);
  return record;
}

export function getRuntimeDiagnostics() {
  return readDiagnostics().slice().reverse();
}

export function clearRuntimeDiagnostics() {
  try {
    globalThis.localStorage?.removeItem(RUNTIME_DIAGNOSTICS_KEY);
  } catch {
    // 清除失敗不影響 App 使用。
  }
}

export function formatRuntimeDiagnostics(records = getRuntimeDiagnostics()) {
  const safeRecords = Array.isArray(records) ? records : [];
  const header = [
    "MaliPhone 錯誤診斷",
    `App 版本：${VERSION}`,
    `匯出時間：${new Date().toISOString()}`,
    `紀錄數量：${safeRecords.length}`,
  ].join("\n");
  if (!safeRecords.length) return `${header}\n\n目前沒有錯誤紀錄。`;
  return `${header}\n\n${safeRecords.map((record, index) => [
    `#${index + 1} ${new Date(record.at).toISOString()}`,
    `類型：${record.kind || "runtime"}`,
    `App：${record.appId || "unknown"}`,
    `最近路徑：${(record.recentApps || []).join(" → ") || "unknown"}`,
    `平台：${record.platform || "unknown"}`,
    `訊息：${record.message || "Unknown error"}`,
    record.source ? `來源：${record.source}${record.line ? `:${record.line}${record.column ? `:${record.column}` : ""}` : ""}` : "",
    record.details ? `診斷資料：${JSON.stringify(record.details)}` : "",
    record.stack ? `堆疊：\n${record.stack}` : "",
  ].filter(Boolean).join("\n")).join("\n\n")}`;
}

export async function copyTextForDiagnostics(text) {
  const value = String(text || "");
  if (!value) return false;
  try {
    if (typeof globalThis.navigator?.clipboard?.writeText === "function") {
      await globalThis.navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Android WebView 若拒絕 Clipboard API，改用舊式選取複製。
  }
  try {
    const textarea = globalThis.document?.createElement("textarea");
    if (!textarea || !globalThis.document?.body) return false;
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    Object.assign(textarea.style, {
      position: "fixed",
      inset: "0 auto auto 0",
      width: "1px",
      height: "1px",
      opacity: "0",
      pointerEvents: "none",
    });
    globalThis.document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    const copied = globalThis.document.execCommand?.("copy") === true;
    textarea.remove();
    return copied;
  } catch {
    return false;
  }
}

export async function copyRuntimeDiagnostics(records) {
  return copyTextForDiagnostics(formatRuntimeDiagnostics(records));
}

export function installGlobalRuntimeDiagnostics() {
  if (globalCaptureInstalled || typeof globalThis.addEventListener !== "function") return;
  globalCaptureInstalled = true;
  globalThis.addEventListener("error", (event) => {
    if (event?.error || event?.message) {
      recordRuntimeDiagnostic({
        kind: "window-error",
        error: event.error,
        message: event.message,
        source: event.filename,
        line: event.lineno,
        column: event.colno,
      });
      return;
    }
    const target = event?.target;
    const tag = String(target?.tagName || "").toUpperCase();
    if (!["SCRIPT", "LINK"].includes(tag)) return;
    recordRuntimeDiagnostic({
      kind: "resource-error",
      message: `Failed to load ${tag.toLowerCase()} resource`,
      source: target?.src || target?.href || "",
    });
  }, true);
  globalThis.addEventListener("unhandledrejection", (event) => {
    recordRuntimeDiagnostic({
      kind: "unhandled-rejection",
      error: event?.reason,
      message: event?.reason?.message || event?.reason,
      stack: event?.reason?.stack,
    });
  });

  // A number of feature-level catches intentionally keep the UI usable and
  // only log the Error. Preserve the original console behavior while making
  // those failures available from the APK diagnostics screen as well.
  try {
    const consoleObject = globalThis.console;
    const originalError = consoleObject?.error;
    if (typeof originalError === "function") {
      consoleObject.error = (...args) => {
        try {
          const nestedError = args.find((value) => value?.error instanceof Error)?.error;
          const error = args.find((value) => value instanceof Error || typeof value?.stack === "string") || nestedError;
          const label = args.find((value) => typeof value === "string" && value.trim());
          if (error || label) {
            recordRuntimeDiagnostic({
              kind: "console-error",
              error,
              message: error?.message || label,
              source: "console.error",
              stack: error?.stack,
            });
          }
        } catch {
          // Diagnostics must never interfere with the application's console.
        }
        originalError.apply(consoleObject, args);
      };
    }
  } catch {
    // Some WebViews expose a read-only console object.
  }
}
