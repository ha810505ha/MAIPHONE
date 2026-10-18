// 測試站強制更新：線上 version.json 比目前版本新時只重載一次，失敗不重載。
import assert from "node:assert/strict";
globalThis.__MALIPHONE_BUILD__ = "20261018-0100";
const { reloadIfNewBuild, BUILD_ID } = await import("../utils/buildVersion.js");
assert.equal(BUILD_ID, "20261018-0100");
const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
const res = (build) => async () => ({ ok: true, json: async () => ({ build }) });
let reloads = 0; const reload = () => { reloads += 1; };
const storage = mem();
assert.equal(await reloadIfNewBuild({ fetchImpl: res("20261018-0100"), storage, reload }), false);
assert.equal(await reloadIfNewBuild({ fetchImpl: res("20261018-0200"), storage, reload }), true);
assert.equal(await reloadIfNewBuild({ fetchImpl: res("20261018-0200"), storage, reload }), false, "same target reloads only once");
assert.equal(await reloadIfNewBuild({ fetchImpl: async () => { throw new Error("offline"); }, storage, reload }), false);
assert.equal(await reloadIfNewBuild({ fetchImpl: async () => ({ ok: false }), storage, reload }), false);
assert.equal(reloads, 1);
console.log("ok: build version check reloads once per new build");
