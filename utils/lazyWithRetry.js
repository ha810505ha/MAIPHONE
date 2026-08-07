import { lazy } from "react";

const DYNAMIC_IMPORT_ERROR_PATTERNS = [
  /ChunkLoadError/i,
  /Loading chunk [\w-]+ failed/i,
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  /error loading dynamically imported module/i,
  /Unable to preload CSS/i,
];

export function isDynamicImportError(error) {
  const message = String(error?.message || error || "");
  return DYNAMIC_IMPORT_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

export async function loadWithRetry(loader, {
  attempts = 2,
  delayMs = 120,
} = {}) {
  const safeAttempts = Math.max(1, Math.trunc(Number(attempts) || 1));
  let lastError;
  for (let attempt = 0; attempt < safeAttempts; attempt += 1) {
    try {
      return await loader();
    } catch (error) {
      lastError = error;
      if (attempt + 1 < safeAttempts && delayMs > 0) {
        await new Promise((resolve) => globalThis.setTimeout(resolve, delayMs));
      }
    }
  }
  throw lastError;
}

export function lazyWithRetry(loader, options) {
  return lazy(() => loadWithRetry(loader, options));
}

export function shouldAutoReloadAfterImportError(
  error,
  storage,
  appId = "unknown",
  now = Date.now(),
  cooldownMs = 30_000,
) {
  if (!isDynamicImportError(error) || !storage) return false;
  const key = `mali_app_import_reload_${String(appId || "unknown")}`;
  try {
    const previous = Number(storage.getItem(key) || 0);
    if (previous > 0 && now - previous < cooldownMs) return false;
    storage.setItem(key, String(now));
    return true;
  } catch {
    return false;
  }
}
