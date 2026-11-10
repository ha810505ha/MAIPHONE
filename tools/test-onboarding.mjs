import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// MP-095（2026-10-29）：初次開啟引導（新玩家教學／老玩家找回進度，隨時可略過）＋自動下載決策。
globalThis.localStorage = {
  values: new Map(),
  getItem(key) { return this.values.get(key) ?? null; },
  setItem(key, value) { this.values.set(key, String(value)); },
  removeItem(key) { this.values.delete(key); },
};
const { markOnboardingDone, readOnboardingState, resetOnboarding, shouldShowOnboarding, ONBOARDING_STATE_KEY } = await import("../services/onboarding/onboardingState.js");
const { planAutoDownload } = await import("../services/cloud/autoSyncPlanner.js");

// --- 引導要不要出現 ---
assert.equal(shouldShowOnboarding({ characterCount: 0, state: null }), true, "first open with no characters shows the guide");
assert.equal(shouldShowOnboarding({ characterCount: 3, state: null }), false, "a phone with characters is never nagged");
assert.equal(shouldShowOnboarding({ characterCount: 0, state: null, storageWiped: true }), false, "the rescue screen wins over the guide");
markOnboardingDone("returning");
assert.deepEqual({ done: readOnboardingState().done, choice: readOnboardingState().choice }, { done: true, choice: "returning" });
assert.equal(shouldShowOnboarding({ characterCount: 0 }), false, "seen once → not again on this device");
resetOnboarding();
assert.equal(readOnboardingState(), null);
assert.equal(shouldShowOnboarding({ characterCount: 0 }), true, "settings can replay it");
localStorage.setItem(ONBOARDING_STATE_KEY, "{broken");
assert.equal(shouldShowOnboarding({ characterCount: 0 }), true, "broken state → show (harmless, skippable)");

// --- 自動下載決策 ---
assert.equal(planAutoDownload({ remoteExists: false, localCharacterCount: 0 }), null, "no cloud save → nothing to load");
assert.equal(planAutoDownload({ remoteExists: true, remoteRevision: 3, localRevision: 0, localCharacterCount: 0 }), "load", "empty device → load without asking");
assert.equal(planAutoDownload({ remoteExists: true, remoteRevision: 9, localRevision: 7, localCharacterCount: 4, dirty: false }), "load", "cloud newer and nothing unsynced here → load");
assert.equal(planAutoDownload({ remoteExists: true, remoteRevision: 9, localRevision: 7, localCharacterCount: 4, dirty: true }), "ask", "cloud newer but unsynced local changes → ask");
assert.equal(planAutoDownload({ remoteExists: true, remoteRevision: 9, localRevision: 0, localCharacterCount: 4, dirty: false }), "ask", "never synced here but both sides have data → ask");
assert.equal(planAutoDownload({ remoteExists: true, remoteRevision: 7, localRevision: 7, localCharacterCount: 4, dirty: true }), null, "same revision → nothing to download");
assert.equal(planAutoDownload({ remoteExists: true, remoteRevision: 5, localRevision: 7, localCharacterCount: 4 }), null, "cloud older → nothing to download");

// --- 接線 ---
const screen = await readFile(new URL("../components/shell/OnboardingScreen.jsx", import.meta.url), "utf8");
assert.ok(screen.includes('data-onboarding="choice"') && screen.includes("onSkip") && screen.includes("onReturningPlayer"), "choice screen with skip and returning paths");
assert.ok(!/>[^<>{}]*[㐀-鿿][^<>{}]*</.test(screen), "no hard-coded JSX text outside tr()");
const root = await readFile(new URL("../MaliPhone.jsx", import.meta.url), "utf8");
assert.ok(root.includes("shouldShowOnboarding({"), "MaliPhone decides the guide after hydration");
assert.ok(root.includes('setSettingsTab("data")') && root.includes('finishOnboarding("returning")'), "returning players land on Settings → Data");
assert.ok(root.includes("applyTextSyncDocument,\n    localCharacterCount: characters.length,"), "auto download has what it needs");
const hook = await readFile(new URL("../hooks/cloud/useCloudAutoSync.js", import.meta.url), "utf8");
assert.ok(hook.includes("planAutoDownload({") && hook.includes('reason: "login"'), "the hook checks the cloud on login");
assert.ok(hook.includes("await apply(remote.data, { session: currentSession })"), "download goes through the protected restore path");
const about = await readFile(new URL("../components/settings/AboutInfoSettings.jsx", import.meta.url), "utf8");
assert.ok(about.includes("onReplayOnboarding"), "settings can replay the guide");
console.log("ok: first-open guide is skippable and remembered; auto download only when the device is empty or has nothing unsynced (MP-095)");
