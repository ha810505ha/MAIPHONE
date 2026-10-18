import assert from "node:assert/strict";
import fs from "node:fs";
import { DATING_NICKNAME_MAX } from "../constants/dating.js";
import { createDatingState, normalizeDatingState } from "../services/dating/datingMatching.js";

// MP-055：信風暱稱 profile.name 的預設、字串化、截斷與舊存檔相容。
assert.equal(createDatingState().profile.name, "", "new dating state starts with an empty nickname");

const legacy = normalizeDatingState({ profile: { bio: "hi", photos: [], tags: [] } });
assert.equal(legacy.profile.name, "", "old saves without profile.name must normalize to an empty nickname");
assert.equal(legacy.profile.bio, "hi", "normalizing the nickname must not touch other profile fields");

assert.equal(normalizeDatingState({ profile: { name: "小舞" } }).profile.name, "小舞");
assert.equal(normalizeDatingState({ profile: { name: 42 } }).profile.name, "42", "numbers are stringified");
assert.equal(normalizeDatingState({ profile: { name: { bad: true } } }).profile.name, "", "non-text values are dropped");
assert.equal(normalizeDatingState({ profile: { name: null } }).profile.name, "");

const long = "a".repeat(DATING_NICKNAME_MAX + 15);
assert.equal(normalizeDatingState({ profile: { name: long } }).profile.name.length, DATING_NICKNAME_MAX, "nickname is truncated to the limit");

// 整個 profile 物件跟著 ent_dating 一起序列化，round-trip 後暱稱要還在。
const roundTrip = normalizeDatingState(JSON.parse(JSON.stringify(normalizeDatingState({ profile: { name: "暱稱" } }))));
assert.equal(roundTrip.profile.name, "暱稱", "nickname survives JSON round-trip");

// 元件：只用信風固定色、暱稱欄位用常數、預覽用正式 ProfileCard、主照片換序為純函式。
const editor = fs.readFileSync(new URL("../components/dating/DatingProfileEditor.jsx", import.meta.url), "utf8");
assert.match(editor, /DATING_NICKNAME_MAX/, "editor must use the nickname limit constant");
assert.match(editor, /export function promotePhoto/, "editor must expose the main-photo reorder helper");
assert.match(editor, /import ProfileCard from "\.\/ProfileCard"/, "preview must reuse the real ProfileCard");
assert.doesNotMatch(editor, /var\(--mp-(?:txt|surface|line|pink|accent)/, "editor must not use MaliPhone theme palette tokens");
assert.match(editor, /name \|\| playerName/, "display name must fall back to the player name");

// promotePhoto 的行為用同樣邏輯驗證（jsx 無法在 Node 直接匯入，抽出相同純函式）。
const source = editor.match(/export function promotePhoto\(photos, index\) \{([\s\S]*?)\n\}/);
assert.ok(source, "promotePhoto must stay a standalone pure function");
const promotePhoto = new Function("photos", "index", source[1]);
assert.deepEqual(promotePhoto(["a", "b", "c"], 2), ["c", "a", "b"], "tapping a thumbnail moves it to photos[0]");
assert.deepEqual(promotePhoto(["a", "b", "c"], 0), ["a", "b", "c"], "main photo stays put");
assert.deepEqual(promotePhoto(["a", "b"], 5), ["a", "b"], "out-of-range index is ignored");

const css = fs.readFileSync(new URL("../styles/maliPhone.css", import.meta.url), "utf8");
for (const cls of [".dt-me-hero{", ".dt-me-thumb{", ".dt-me-input{", ".dt-me-meter{", ".dt-me-cats{", ".dt-me-panel{", ".dt-me-preview{", ".dt-me .dt-btn{"]) {
  assert.ok(css.includes(cls), `maliPhone.css must define ${cls}`);
}

console.log("ok: dating profile editor nickname, main-photo reorder and layout rules");
