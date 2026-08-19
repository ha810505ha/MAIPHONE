import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  compactActivePersona,
  compactLegacyLocalData,
  packBackupMedia,
  restoreActivePersona,
  unpackBackupMedia,
} from "../utils/backupMediaAssets.js";
import { compactActiveRoomMirrors } from "../utils/persistedMediaCleanup.js";
import { normalizePersonaCollection } from "../services/persona/personaModel.js";

const rawImage = "a".repeat(128);
const image = `data:image/jpeg;base64,${rawImage}`;
const source = {
  characters: [{ id: "char-1", avatar: image, heroImage: image }],
  chatBackgrounds: { "char-1": { src: image } },
  chatHistory: { "char-1": [{ role: "user", image: rawImage }] },
};

const packed = await packBackupMedia(source);
assert.equal(Object.keys(packed.assets).length, 2, "identical data URLs are stored once; legacy raw message images retain their own encoding");
assert.deepEqual(packed.state.characters[0].avatar, packed.state.characters[0].heroImage);
assert.deepEqual(packed.state.characters[0].avatar, packed.state.chatBackgrounds["char-1"].src);
assert.deepEqual(unpackBackupMedia(packed.state, packed.assets), source, "v2 asset references restore the runtime state shape");

const personas = { active: { id: "active", label: "Player", data: { chatHistory: { old: [] } } } };
const compacted = compactActivePersona(personas, "active");
assert.equal(compacted.active.activeDataInTopLevel, true);
assert.equal(compacted.active.data, undefined);
const restored = restoreActivePersona(compacted, "active", { chatHistory: { current: [] } });
assert.deepEqual(restored.active.data, { chatHistory: { current: [] } });

const rooms = {
  "char-1": [{ id: "room-1", messages: [{ id: "m1", content: "hello" }], memories: [{ id: "memory-1" }], scene: { location: "home" } }],
};
const compactedRooms = compactActiveRoomMirrors(rooms, { "char-1": "room-1" });
assert.equal(compactedRooms["char-1"][0].activeDataInTopLevel, true);
assert.equal(compactedRooms["char-1"][0].messages, undefined, "active room messages must use the top-level canonical copy");

const normalizedPersona = normalizePersonaCollection({
  activePersonaId: "active",
  personas: { active: { id: "active", activeDataInTopLevel: true } },
  playerProfile: { name: "Current Player" },
  chatHistory: { "char-1": [{ id: "m1" }] },
}, { playerProfile: { name: "Default" }, chatHistory: {} });
assert.equal(normalizedPersona.activeData.playerProfile.name, "Current Player");
assert.deepEqual(normalizedPersona.activeData.chatHistory, { "char-1": [{ id: "m1" }] });

assert.deepEqual(compactLegacyLocalData({
  mali_yunyin_save_v1: "legacy-yunyin",
  "maliphone-pet-home": "legacy-home",
  "maliphone-pet-settings": "legacy-settings",
  "maliphone-pet-cooldown-until": "123",
}, {
  yunyinSave: { coins: 1 },
  petHome: { pet: true },
  petSettings: { reminders: false },
}), {}, "migrated local mirrors must not be exported twice");

const snapshotSource = await readFile(
  new URL("../hooks/data/useGlobalDataSnapshot.js", import.meta.url),
  "utf8",
);
assert.doesNotMatch(snapshotSource, /mali_yunyin_crystals_v1/, "the never-used Yunyin crystal key must not return to backups");

console.log("ok: backup media is deduplicated and active persona state is not serialized twice");
