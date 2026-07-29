import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { featureDataEventIncludes } from "../services/featureDataLifecycle.js";

const changed = { detail: { keys: ["ent_notes", "ent_musicPlayer"], reason: "import" } };
assert.equal(featureDataEventIncludes(changed, "ent_notes"), true);
assert.equal(featureDataEventIncludes(changed, ["ent_calendar", "ent_musicPlayer"]), true);
assert.equal(featureDataEventIncludes(changed, "ent_dating"), false);
assert.equal(featureDataEventIncludes({ detail: { keys: [] } }, "ent_dating"), true);

const source = async (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [backup, main, music, dating, gacha] = await Promise.all([
  source("services/featureBackupService.js"),
  source("MaliPhone.jsx"),
  source("contexts/MusicPlayerContext.jsx"),
  source("hooks/dating/useDatingApp.js"),
  source("contexts/GachaContext.jsx"),
]);

assert(backup.includes("dispatchFeatureDataChanged(writes.keys(), reason)"), "feature restore must announce changed entities");
assert(backup.includes("export function resetFeatureData()"), "feature data must expose one reset entry point");
assert(main.includes("await resetFeatureData()"), "clear-all must reset feature entities before clearing the UI");
for (const [name, text] of [["music", music], ["dating", dating], ["gacha", gacha]]) {
  assert(text.includes("FEATURE_DATA_CHANGED_EVENT"), `${name} runtime must reload after import/reset`);
  assert(text.includes("featureDataEventIncludes"), `${name} runtime must filter lifecycle events by entity`);
}

console.log("ok: feature import, reset, and mounted runtimes share one lifecycle event");
