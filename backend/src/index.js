import "dotenv/config";
import { existsSync } from "node:fs";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import app from "./app.js";
import { getDb, initDevDbIfNeeded } from "./db/index.js";

// 有 DATABASE_URL（正式環境）→ 啟動時自動套用 migrations（drizzle-kit 只在開發時需要）
// 沒有 → 開發模式退回內嵌 PGlite
// 生產環境缺 JWT_SECRET 直接擋在啟動階段，不要等玩家登入才爆
if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET 未設定：請在 Railway Variables 加上隨機長字串");
}

if (process.env.DATABASE_URL) {
  const { migrate } = await import("drizzle-orm/node-postgres/migrator");
  await migrate(getDb(), { migrationsFolder: "./drizzle" });
  console.log("資料庫 migrations 已套用");
} else {
  await initDevDbIfNeeded();
}

// === 網頁版靜態檔 ===
// Railway 部署時把前端 build 產出放到 backend/public（見 README 部署流程）
// 本地開發通常沒有 public/，前端另外用 vite dev 跑
if (existsSync("./public")) {
  app.use("/*", serveStatic({ root: "./public" }));
  app.get("*", serveStatic({ path: "./public/index.html" })); // SPA fallback
}

const port = Number(process.env.PORT) || 8787;
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`MaliPhone backend listening on http://localhost:${info.port}`);
});
