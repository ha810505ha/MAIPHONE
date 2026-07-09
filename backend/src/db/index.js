import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema.js";

let _db = null;
let _mode = null; // "postgres" | "pglite-dev"

// 測試時注入 PGlite 等替代實例
export function setDb(db) {
  _db = db;
  _mode = "injected";
}

export function getDb() {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL 未設定");
  const pool = new pg.Pool({ connectionString: url, max: 10 });
  _db = drizzle(pool, { schema });
  _mode = "postgres";
  return _db;
}

// 開發模式：沒有 DATABASE_URL 時改用內嵌 PGlite（資料存 backend/.pglite-dev/），
// 零設定即可完整測試帳號與同步。生產環境（NODE_ENV=production）不啟用。
export async function initDevDbIfNeeded() {
  if (_db || process.env.DATABASE_URL) return _mode;
  if (process.env.NODE_ENV === "production") return null;
  try {
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle: drizzlePglite } = await import("drizzle-orm/pglite");
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    const db = drizzlePglite(new PGlite("./.pglite-dev"), { schema });
    await migrate(db, { migrationsFolder: "./drizzle" });
    _db = db;
    _mode = "pglite-dev";
    console.log("⚠ 開發模式：使用內嵌 PGlite（backend/.pglite-dev），正式部署請設 DATABASE_URL");
    return _mode;
  } catch (err) {
    console.warn("PGlite 開發資料庫初始化失敗：", err?.message);
    return null;
  }
}

export async function checkDb() {
  if (!_db && !process.env.DATABASE_URL) return { configured: false };
  try {
    const db = getDb();
    await db.execute("select 1");
    return { configured: true, ok: true, mode: _mode };
  } catch (err) {
    return { configured: true, ok: false, error: err.message };
  }
}
