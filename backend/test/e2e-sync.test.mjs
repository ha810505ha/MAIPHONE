// E2E：前端 syncService + indexedDbStorage ←→ 真的後端 app（PGlite）
// 模擬裝置 A 存資料同步上去，裝置 B 登入同帳號拉下來。
import { PGlite } from "@electric-sql/pglite";



const drizzlePglite = await import("drizzle-orm/pglite");
const { migrate } = await import("drizzle-orm/pglite/migrator");
const { setDb } = await import("../src/db/index.js");
const schema = await import("../src/db/schema.js");
const backendApp = (await import("../src/app.js")).default;
const db = drizzlePglite.drizzle(new PGlite(), { schema });
await migrate(db, { migrationsFolder: "./drizzle" });
setDb(db);

// --- 前端環境 shim ---
const idbStore = new Map(); // 可整個換掉來模擬另一台裝置
let currentStore = idbStore;
const makeReq = (result) => { const r = { result, onsuccess: null, onerror: null }; queueMicrotask(() => r.onsuccess && r.onsuccess()); return r; };
globalThis.IDBKeyRange = { bound: (lo, hi) => ({ lo, hi }) };
globalThis.localStorage = { _m: new Map(), getItem(k){ return this._m.get(k) ?? null; }, setItem(k,v){ this._m.set(k,String(v)); }, removeItem(k){ this._m.delete(k); } };
globalThis.window = { Capacitor: undefined };
globalThis.indexedDB = {
  open() {
    const dbo = {
      objectStoreNames: { contains: () => true }, close() {},
      transaction() {
        const tx = { oncomplete: null, onerror: null, objectStore: () => ({
          get: (k) => makeReq(currentStore.has(k) ? currentStore.get(k) : undefined),
          put: (v, k) => currentStore.set(k, v),
          delete: (k) => currentStore.delete(k),
          getAllKeys: ({lo, hi}) => makeReq([...currentStore.keys()].filter(k => k >= lo && k <= hi).sort()),
          getAll: ({lo, hi}) => makeReq([...currentStore.entries()].filter(([k]) => k >= lo && k <= hi).sort((a,b)=>a[0]<b[0]?-1:1).map(([,v])=>v)),
        })};
        queueMicrotask(() => queueMicrotask(() => tx.oncomplete && tx.oncomplete()));
        return tx;
      },
    };
    const r = { result: dbo, onsuccess: null, onerror: null, onupgradeneeded: null };
    queueMicrotask(() => r.onsuccess && r.onsuccess());
    return r;
  },
};
// fetch → 直接打後端 Hono app
const realFetch = globalThis.fetch;
globalThis.fetch = (url, opts = {}) => {
  const u = String(url);
  if (u.includes("/api/")) return backendApp.request(u.replace(/^https?:\/\/[^/]+/, ""), opts);
  return realFetch(url, opts);
};
globalThis.AbortSignal = globalThis.AbortSignal || {};
if (!AbortSignal.timeout) AbortSignal.timeout = () => undefined;

const storage = await import("../../utils/indexedDbStorage.js");
const syncSvc = await import("../../services/syncService.js");

let failed = 0;
const assert = (cond, msg) => { if (cond) console.log("ok:", msg); else { console.error("FAIL:", msg); failed += 1; } };
const def = { characters: [], activeCharId: null, chatHistory: {}, chatBackgrounds: {}, posts: [], wallet: { coins: 0 } };

// === 裝置 A ===
const sA = await storage.loadAppState(def);
await storage.saveAppState({ ...sA, characters: [{ id: "c1", name: "小美" }], chatHistory: { c1: [{ id: "m1", role: "user", content: "嗨" }] } });
const r1 = await syncSvc.syncOnBoot();
assert(r1 && r1.pushed >= 2, `裝置 A 開機同步 push（pushed=${r1?.pushed}）`);
const ob = await storage.getSyncOutbox();
assert(Object.keys(ob).length === 0, "push 後 outbox 清空");
const authA = syncSvc.getSyncAccount();
assert(!!authA?.userId, "自動建立匿名帳號");

// 綁定 email（直接打 API，模擬設定頁）
let res = await backendApp.request("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${authA.accessToken}` }, body: JSON.stringify({ email: "e2e@test.com", password: "12345678" }) });
assert(res.status === 200, "裝置 A 綁定 email");

// === 裝置 B（全新環境）===
currentStore = new Map();
localStorage._m = new Map();
localStorage.setItem("mali_device_id", "device-B");
res = await backendApp.request("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "e2e@test.com", password: "12345678", deviceId: "device-B" }) });
const login = await res.json();
localStorage.setItem("mali_auth", JSON.stringify({ userId: login.userId, accessToken: login.accessToken, refreshToken: login.refreshToken }));

const r2 = await syncSvc.syncNow({ pull: true });
assert(r2.pulled >= 2, `裝置 B 拉到資料（pulled=${r2.pulled}）`);
const sB = await storage.loadAppState(def);
assert(sB.characters[0]?.name === "小美" && sB.chatHistory.c1?.[0]?.content === "嗨", "裝置 B 載入後看到裝置 A 的角色與對話");

// 裝置 B 改資料 → 同步 → 裝置 A 增量拉取
await storage.saveAppState({ ...sB, chatHistory: { c1: [...sB.chatHistory.c1, { id: "m2", role: "assistant", content: "你好" }] } });
await syncSvc.syncNow({ pull: false });

// 回到裝置 A
currentStore = idbStore;
localStorage._m = new Map();
localStorage.setItem("mali_device_id", "device-A-again");
localStorage.setItem("mali_auth", JSON.stringify(authA));
const r3 = await syncSvc.syncNow({ pull: true });
assert(r3.pulled >= 1, "裝置 A 增量拉到 B 的變更");
const sA2 = await storage.loadAppState(def);
assert(sA2.chatHistory.c1?.length === 2 && sA2.chatHistory.c1[1].content === "你好", "裝置 A 看到 B 加的訊息");

if (failed) { console.error(`\n${failed} FAILED`); process.exit(1); }
console.log("\nALL PASS");
