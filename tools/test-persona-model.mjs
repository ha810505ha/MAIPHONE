import assert from "node:assert/strict";
import fs from "node:fs";
import {
  DEFAULT_PERSONA_ID,
  createEmptyPersonaData,
  normalizePersonaCollection,
  serializePersonas,
} from "../services/persona/personaModel.js";

const defaults = {
  playerProfile: { name: "玩家", gender: "" },
  chatHistory: {},
  memories: {},
  wallet: { balance: 500, transactions: [] },
  characterWallets: {},
  transfers: [],
};

const migrated = normalizePersonaCollection({
  playerProfile: { name: "小明", gender: "男" },
  chatHistory: { charA: [{ role: "user", content: "hello" }] },
  wallet: { balance: 321, transactions: [] },
}, defaults);
assert.equal(migrated.activePersonaId, DEFAULT_PERSONA_ID);
assert.equal(migrated.activeData.playerProfile.name, "小明");
assert.equal(migrated.activeData.wallet.balance, 321);
assert.equal(migrated.activeData.chatHistory.charA.length, 1);

const empty = createEmptyPersonaData(defaults, { name: "小美", gender: "女" });
assert.equal(empty.playerProfile.name, "小美");
assert.deepEqual(empty.chatHistory, {});
assert.equal(empty.wallet.balance, 500);

const personas = {
  [DEFAULT_PERSONA_ID]: migrated.personas[DEFAULT_PERSONA_ID],
  "persona-b": { id: "persona-b", label: "B", createdAt: 2, data: empty },
};
const normalizedPersonas = normalizePersonaCollection({
  activePersonaId: "persona-b",
  personas,
}, defaults);
assert.equal(normalizedPersonas.personas["persona-b"].label, "小美");

const serialized = serializePersonas(personas, "persona-b", {
  ...empty,
  playerProfile: { ...empty.playerProfile, name: "更新後姓名" },
  chatHistory: { charB: [{ role: "user", content: "new" }] },
});
assert.equal(serialized["persona-b"].data.chatHistory.charB.length, 1);
assert.equal(serialized["persona-b"].label, "更新後姓名");
assert.equal(serialized[DEFAULT_PERSONA_ID].data.chatHistory.charA.length, 1);

const playerProfileSource = fs.readFileSync(new URL("../components/apps/PlayerProfileApp.jsx", import.meta.url), "utf8");
const personaIndicatorSource = fs.readFileSync(new URL("../components/chat/PlayerPersonaIndicator.jsx", import.meta.url), "utf8");
assert.doesNotMatch(playerProfileSource, /persona\.onRename|人格名稱|>\s*改名\s*</);
assert.match(playerProfileSource, /itemProfile\?\.name \|\| item\.label/);
assert.match(personaIndicatorSource, /itemProfile\?\.name \|\| item\.label/);

console.log("persona model tests passed");
