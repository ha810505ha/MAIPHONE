import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { checkDb } from "./db/index.js";
import authRoutes from "./routes/auth.js";
import syncRoutes from "./routes/sync.js";
import adminRoutes from "./routes/admin.js";

const app = new Hono();
app.use(logger());

const api = new Hono();

// APK（Capacitor）的 origin 是 https://localhost，跨域呼叫 API 必須開 CORS。
// 認證走 Bearer token 不用 cookie，開放所有 origin 沒有 CSRF 風險。
api.use("*", cors({
  origin: (origin) => origin || "*",
  allowHeaders: ["Content-Type", "Authorization"],
  allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
}));

api.get("/health", async (c) => {
  const db = await checkDb();
  return c.json({
    ok: true,
    version: process.env.npm_package_version || "0.1.0",
    db,
    time: new Date().toISOString(),
  });
});

api.route("/auth", authRoutes);
api.route("/sync", syncRoutes);
api.route("/admin", adminRoutes);
// M4: api.route("/ai", aiRoutes)

app.route("/api", api);

export default app;
