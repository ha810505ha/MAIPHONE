// M3 同步 API 整合測試：兩台裝置 push/pull、衝突、墓碑、分頁游標
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { setDb } from "../src/db/index.js";
import * as schema from "../src/db/schema.js";
import app from "../src/app.js";

const db = drizzle(new PGlite(), { schema });
await migrate(db, { migrationsFolder: "./drizzle" });
setDb(db);

let failed = 0;
const assert = (cond, msg) => {
  if (cond) console.log("ok:", msg);
  else { console.error("FAIL:", msg); failed += 1; }
};
const req = (path, opts = {}, token) => app.request(`/api${path}`, {
  ...opts,
  headers: {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  },
});
const push = (list, token) => req("/sync/push", { method: "POST", body: JSON.stringify({ entities: list }) }, token);
const pull = (since, token) => req(`/sync/pull?since=${since}`, {}, token);

// 同一帳號、兩台裝置
const resA = await req("/auth/anonymous", { method: "POST", body: JSON.stringify({ deviceId: "dev-A" }) });
const devA = await resA.json();
await req("/auth/register", { method: "POST", body: JSON.stringify({ email: "s@test.com", password: "12345678" }) }, devA.accessToken);
const resB = await req("/auth/login", { method: "POST", body: JSON.stringify({ email: "s@test.com", password: "12345678", deviceId: "dev-B" }) });
const devB = await resB.json();

// 另一個不相干帳號（隔離測試）
const resC = await req("/auth/anonymous", { method: "POST", body: JSON.stringify({ deviceId: "dev-C" }) });
const devC = await resC.json();

// 1. 未登入被擋
let res = await push([], null);
assert(res.status === 401, "無 token → 401");

// 2. 裝置 A push 兩個實體
res = await push([
  { key: "ent_char_x", rev: 1, updatedAt: 1000, deviceId: "dev-A", data: { name: "小美" } },
  { key: "ent_chat_x", rev: 3, updatedAt: 1000, deviceId: "dev-A", data: [{ id: "m1" }] },
], devA.accessToken);
let out = await res.json();
assert(res.status === 200 && out.results.every((r) => r.status === "ok"), "裝置 A push 成功");

// 3. 裝置 B 從 0 拉 → 拿到兩筆
res = await pull(0, devB.accessToken);
out = await res.json();
assert(out.entities.length === 2 && out.entities.find((e) => e.key === "ent_char_x")?.data?.name === "小美", "裝置 B pull 到 A 的資料");
const cursorB = out.nextSince;
assert(cursorB > 0 && out.hasMore === false, "游標前進、無更多");

// 4. 再拉一次 → 空（增量）
res = await pull(cursorB, devB.accessToken);
out = await res.json();
assert(out.entities.length === 0 && out.nextSince === cursorB, "增量拉取：無新資料");

// 5. 裝置 B 更新同一實體（較新）→ ok；裝置 A 拿舊資料 push → conflict
res = await push([{ key: "ent_char_x", rev: 2, updatedAt: 5000, deviceId: "dev-B", data: { name: "小美v2" } }], devB.accessToken);
out = await res.json();
assert(out.results[0].status === "ok", "較新的更新 → ok");
res = await push([{ key: "ent_char_x", rev: 2, updatedAt: 2000, deviceId: "dev-A", data: { name: "舊版" } }], devA.accessToken);
out = await res.json();
assert(out.results[0].status === "conflict" && out.results[0].server.data.name === "小美v2", "較舊的 push → conflict + 回傳 server 版本");

// 6. 墓碑同步
res = await push([{ key: "ent_chat_x", rev: 4, updatedAt: 6000, deviceId: "dev-B", deleted: true }], devB.accessToken);
out = await res.json();
assert(out.results[0].status === "ok", "墓碑 push");
res = await pull(cursorB, devA.accessToken);
out = await res.json();
const tomb = out.entities.find((e) => e.key === "ent_chat_x");
assert(tomb?.deleted === true && tomb.data === null, "裝置 A 拉到墓碑（data 已清空）");

// 7. 帳號隔離：C 什麼都拉不到
res = await pull(0, devC.accessToken);
out = await res.json();
assert(out.entities.length === 0, "不同帳號拉不到別人的資料");

// 8. 防呆：壞 key、超大實體
res = await push([
  { key: "not-an-entity", rev: 1, updatedAt: 1, data: {} },
  { key: "ent_chatbg_big", rev: 1, updatedAt: 1, data: { img: "x".repeat(900 * 1024) } },
], devA.accessToken);
out = await res.json();
assert(out.results[0].status === "invalid" && out.results[1].status === "too_large", "壞 key → invalid、超大 → too_large");

if (failed) { console.error(`\n${failed} FAILED`); process.exit(1); }
console.log("\nALL PASS");
