// M2 auth 流程整合測試：PGlite 內嵌 Postgres + 實際 migration
// 執行：npm test
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import { setDb } from "../src/db/index.js";
import * as schema from "../src/db/schema.js";
import app from "../src/app.js";
import { writeAdminAudit } from "../src/lib/admin.js";

const db = drizzle(new PGlite(), { schema });
await migrate(db, { migrationsFolder: "./drizzle" });
setDb(db);

let failed = 0;
const assert = (cond, msg) => {
  if (cond) console.log("ok:", msg);
  else { console.error("FAIL:", msg); failed += 1; }
};
const post = (path, body, token) => app.request(`/api${path}`, {
  method: "POST",
  headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  body: JSON.stringify(body),
});
const get = (path, token) => app.request(`/api${path}`, {
  headers: token ? { Authorization: `Bearer ${token}` } : {},
});

// 1. 匿名帳號
let res = await post("/auth/anonymous", { deviceId: "dev-1", platform: "android" });
let anon = await res.json();
assert(res.status === 200 && anon.userId && anon.accessToken && anon.refreshToken, "匿名帳號建立並取得 tokens");

res = await post("/auth/anonymous", { deviceId: "dev-1", platform: "android" });
const recoveredAnon = await res.json();
assert(res.status === 200 && recoveredAnon.userId === anon.userId && recoveredAnon.recovered === true, "同一裝置恢復匿名帳號");

res = await get("/auth/me", anon.accessToken);
let me = await res.json();
assert(me.anonymous === true && me.devices?.[0]?.id === "dev-1", "me：匿名 + 裝置已登記");

res = await get("/admin/me", anon.accessToken);
assert(res.status === 403, "一般使用者不可進入管理端點");
await db.update(schema.users).set({ role: "admin" }).where(eq(schema.users.id, anon.userId));
res = await get("/admin/me", anon.accessToken);
assert(res.status === 200, "管理員可進入管理端點");
await writeAdminAudit({ adminUserId: anon.userId, action: "test.audit", details: { source: "auth-test" } });
const auditRows = await db.select().from(schema.adminAuditLogs).where(eq(schema.adminAuditLogs.adminUserId, anon.userId));
assert(auditRows.length === 1 && auditRows[0].action === "test.audit", "管理操作會留下稽核紀錄");

// 2. 未帶 token 被擋
res = await get("/auth/me");
assert(res.status === 401, "無 token → 401");

// 3. 綁定 email（升級，userId 不變）
res = await post("/auth/register", { email: "A@Test.com", password: "12345678" }, anon.accessToken);
assert(res.status === 200, "綁定 email 成功");
res = await post("/auth/register", { email: "b@test.com", password: "12345678" }, anon.accessToken);
assert(res.status === 409, "重複綁定 → 409");

res = await get("/auth/me", anon.accessToken);
me = await res.json();
assert(me.email === "a@test.com" && me.anonymous === false && me.id === anon.userId, "升級後 email 正規化、userId 不變");

res = await post("/auth/anonymous", { deviceId: "dev-1", platform: "android" });
assert(res.status === 409, "已綁 Email 的裝置不可用匿名登入接管");

// 4. 密碼太短 / email 格式
let res2 = await post("/auth/anonymous", { deviceId: "dev-tmp" });
const anon2 = await res2.json();
res = await post("/auth/register", { email: "x@test.com", password: "123" }, anon2.accessToken);
assert(res.status === 400, "密碼太短 → 400");
res = await post("/auth/register", { email: "not-an-email", password: "12345678" }, anon2.accessToken);
assert(res.status === 400, "email 格式錯誤 → 400");
res = await post("/auth/register", { email: "a@test.com", password: "12345678" }, anon2.accessToken);
assert(res.status === 409, "email 已被使用 → 409");

// 5. 新裝置登入
res = await post("/auth/login", { email: "a@test.com", password: "12345678", deviceId: "dev-2", platform: "web" });
const login = await res.json();
assert(res.status === 200 && login.userId === anon.userId, "新裝置登入到同一帳號");

res = await get("/auth/me", login.accessToken);
me = await res.json();
assert(me.devices.length === 2, "兩台裝置都在清單");

// 6. 錯誤密碼 + 節流
res = await post("/auth/login", { email: "a@test.com", password: "wrong-pass" });
assert(res.status === 401, "錯誤密碼 → 401");
for (let i = 0; i < 4; i += 1) await post("/auth/login", { email: "a@test.com", password: "wrong-pass" });
res = await post("/auth/login", { email: "a@test.com", password: "12345678" });
assert(res.status === 429, "5 次失敗後正確密碼也被節流 → 429");

// 7. refresh rotation
res = await post("/auth/refresh", { refreshToken: login.refreshToken });
const rotated = await res.json();
assert(res.status === 200 && rotated.accessToken && rotated.refreshToken !== login.refreshToken, "refresh 成功且 token 已輪替");
res = await post("/auth/refresh", { refreshToken: login.refreshToken });
assert(res.status === 401, "舊 refresh token 失效");

// 8. 登出裝置 → 該裝置 session 全撤銷
res = await app.request("/api/auth/devices/dev-2", {
  method: "DELETE",
  headers: { Authorization: `Bearer ${anon.accessToken}` },
});
assert(res.status === 200, "登出裝置 dev-2");
res = await post("/auth/refresh", { refreshToken: rotated.refreshToken });
assert(res.status === 401, "被登出裝置的 refresh token 已失效");

// 9. logout
res = await post("/auth/logout", { refreshToken: anon.refreshToken });
assert(res.status === 200, "logout");
res = await post("/auth/refresh", { refreshToken: anon.refreshToken });
assert(res.status === 401, "logout 後 refresh token 失效");

if (failed) { console.error(`\n${failed} FAILED`); process.exit(1); }
console.log("\nALL PASS");
