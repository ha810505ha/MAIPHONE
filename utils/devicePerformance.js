// 低效能裝置偵測：CPU 核心少、記憶體小或開了省流量時，切到精簡視覺（粒子減半、不用毛玻璃）。
// 只影響外觀，不改任何資料；判斷結果寫在 html[data-mp-perf]，由 CSS 決定要省哪些效果。
const LOW_CORES = 4;
const LOW_MEMORY_GB = 4;

export function detectPerformanceMode(nav = typeof navigator === "undefined" ? null : navigator) {
  if (!nav) return "full";
  const cores = Number(nav.hardwareConcurrency) || 0;
  const memory = Number(nav.deviceMemory) || 0;
  const saveData = nav.connection?.saveData === true;
  if (saveData || (cores > 0 && cores <= LOW_CORES) || (memory > 0 && memory <= LOW_MEMORY_GB)) return "lite";
  return "full";
}

export function applyPerformanceMode() {
  if (typeof document === "undefined") return "full";
  const mode = detectPerformanceMode();
  document.documentElement.dataset.mpPerf = mode;
  return mode;
}
