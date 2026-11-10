// 初次開啟引導（MP-095，2026-10-29）：第一次打開（本機沒有角色、沒看過引導）問「新玩家／老玩家」，
// 任何時候都能略過，看過一次就記在這台裝置；設定裡可以重看。
export const ONBOARDING_STATE_KEY = "mali_onboarding_v1";

const storage = () => {
  try { return typeof localStorage !== "undefined" ? localStorage : null; } catch { return null; }
};

export function readOnboardingState() {
  const store = storage();
  if (!store) return null;
  try {
    const value = JSON.parse(store.getItem(ONBOARDING_STATE_KEY) || "null");
    return value && typeof value === "object" ? value : null;
  } catch {
    return null;
  }
}

export function markOnboardingDone(choice, now = Date.now()) {
  const value = { done: true, choice: String(choice || "skip"), at: now };
  const store = storage();
  if (store) {
    try { store.setItem(ONBOARDING_STATE_KEY, JSON.stringify(value)); } catch {}
  }
  return value;
}

export function resetOnboarding() {
  const store = storage();
  if (store) {
    try { store.removeItem(ONBOARDING_STATE_KEY); } catch {}
  }
}

/** 要不要顯示引導（純函式）：本機沒有角色、沒看過、而且不在救援畫面。 */
export function shouldShowOnboarding({ characterCount = 0, state = readOnboardingState(), storageWiped = false } = {}) {
  if (storageWiped) return false;
  if (Number(characterCount) > 0) return false;
  return !state?.done;
}
