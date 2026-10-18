// AI 花費本的儲存：整台裝置一本帳（不分人格），存在 IndexedDB 的 ent_aiUsage。
// 記帳失敗不能影響 AI 回覆，所以所有錯誤都吞掉；寫入排隊、短時間內的多筆合併成一次寫入。
import { loadFeatureEntity, saveFeatureEntity } from "../../utils/indexedDbStorage.js";
import { dispatchFeatureDataChanged } from "../featureDataLifecycle.js";
import {
  AI_USAGE_ENTITY_KEY,
  appendAiUsageEntry,
  buildAiUsageEntry,
  normalizeAiUsageLedger,
} from "./aiUsageCore.js";

const FLUSH_DELAY_MS = 1500;
let pending = [];
let flushTimer = null;
let queue = Promise.resolve();

const runExclusive = (task) => {
  const run = queue.then(task, task);
  queue = run.catch(() => {});
  return run;
};

export async function loadAiUsageLedger() {
  return normalizeAiUsageLedger(await loadFeatureEntity(AI_USAGE_ENTITY_KEY, null));
}

/** 讀出帳本、套用 updater、存回去；跟記帳寫入共用同一條佇列。 */
export function updateAiUsageLedger(updater) {
  return runExclusive(async () => {
    const current = await loadAiUsageLedger();
    const next = normalizeAiUsageLedger(updater(current));
    await saveFeatureEntity(AI_USAGE_ENTITY_KEY, next);
    dispatchFeatureDataChanged([AI_USAGE_ENTITY_KEY], "ai-usage");
    return next;
  });
}

async function flushPending() {
  flushTimer = null;
  const batch = pending;
  pending = [];
  if (!batch.length) return;
  await runExclusive(async () => {
    let ledger = await loadAiUsageLedger();
    if (!ledger.settings.enabled) return;
    for (const item of batch) {
      ledger = appendAiUsageEntry(ledger, buildAiUsageEntry(item, ledger), { now: item.now });
    }
    await saveFeatureEntity(AI_USAGE_ENTITY_KEY, ledger);
    dispatchFeatureDataChanged([AI_USAGE_ENTITY_KEY], "ai-usage");
  });
}

/** 記一筆 AI 呼叫。呼叫端不需要 await，也不會因為記帳出錯而失敗。 */
export function recordAiUsage(item) {
  try {
    if (typeof indexedDB === "undefined") return;
    pending.push({ ...item, now: item.now || Date.now() });
    if (!flushTimer) {
      flushTimer = setTimeout(() => { flushPending().catch(() => {}); }, FLUSH_DELAY_MS);
    }
  } catch {
    // 記帳是附加功能，任何錯誤都不往外丟。
  }
}

/** 測試用：立刻寫入排隊中的紀錄。 */
export async function flushAiUsageForTest() {
  if (flushTimer) clearTimeout(flushTimer);
  await flushPending();
}
