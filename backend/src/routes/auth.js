import { Hono } from "hono";
import argon2 from "argon2";
import { and, eq, gt } from "drizzle-orm";
import { getDb } from "../db/index.js";
import { users, sessions, devices } from "../db/schema.js";
import {
  issueSession, requireAuth, hashToken,
  checkLoginThrottle, recordLoginFail, clearLoginFails,
} from "../lib/auth.js";

const auth = new Hono();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const normEmail = (email) => String(email || "").trim().toLowerCase();

async function upsertDevice(db, userId, deviceId, platform) {
  if (!deviceId) return;
  await db.insert(devices).values({
    id: deviceId,
    userId,
    platform: platform || null,
    lastSeenAt: new Date(),
  }).onConflictDoUpdate({
    target: devices.id,
    set: { userId, platform: platform || null, lastSeenAt: new Date() },
  });
}

// 匿名帳號：App 首次啟動呼叫，之後可綁定 email 升級
auth.post("/anonymous", async (c) => {
  const db = getDb();
  const { deviceId, platform } = await c.req.json().catch(() => ({}));
  if (!deviceId) return c.json({ error: "deviceId 必填" }, 400);
  const [knownDevice] = await db.select().from(devices).where(eq(devices.id, deviceId));
  if (knownDevice) {
    const [knownUser] = await db.select().from(users).where(eq(users.id, knownDevice.userId));
    if (knownUser?.status === "active" && !knownUser.email) {
      await upsertDevice(db, knownUser.id, deviceId, platform);
      const tokens = await issueSession(db, knownUser.id, deviceId);
      return c.json({ userId: knownUser.id, anonymous: true, recovered: true, ...tokens });
    }
    if (knownUser?.email) {
      return c.json({ error: "此裝置帳號已綁定 Email，請使用 Email 登入", code: "login_required" }, 409);
    }
  }
  const [user] = await db.insert(users).values({}).returning();
  await upsertDevice(db, user.id, deviceId, platform);
  const tokens = await issueSession(db, user.id, deviceId);
  return c.json({ userId: user.id, anonymous: true, ...tokens });
});

// 綁定 email（匿名帳號升級）：需要登入狀態，資料不搬家
auth.post("/register", requireAuth, async (c) => {
  const db = getDb();
  const body = await c.req.json().catch(() => ({}));
  const email = normEmail(body.email);
  const password = String(body.password || "");
  if (!EMAIL_RE.test(email)) return c.json({ error: "email 格式不正確" }, 400);
  if (password.length < 8) return c.json({ error: "密碼至少 8 個字元" }, 400);

  const [me] = await db.select().from(users).where(eq(users.id, c.get("userId")));
  if (!me) return c.json({ error: "unauthorized" }, 401);
  if (me.email) return c.json({ error: "此帳號已綁定 email" }, 409);
  const taken = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (taken.length) return c.json({ error: "此 email 已被使用" }, 409);

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  await db.update(users).set({ email, passwordHash }).where(eq(users.id, me.id));
  return c.json({ ok: true, email });
});

// 既有帳號在新裝置登入
auth.post("/login", async (c) => {
  const db = getDb();
  const body = await c.req.json().catch(() => ({}));
  const email = normEmail(body.email);
  const password = String(body.password || "");
  const { deviceId, platform } = body;
  if (!checkLoginThrottle(email)) return c.json({ error: "嘗試次數過多，請 15 分鐘後再試" }, 429);

  const [user] = await db.select().from(users).where(eq(users.email, email));
  const ok = user?.passwordHash && await argon2.verify(user.passwordHash, password).catch(() => false);
  if (!ok || user.status !== "active") {
    recordLoginFail(email);
    return c.json({ error: "email 或密碼錯誤" }, 401);
  }
  clearLoginFails(email);
  await upsertDevice(db, user.id, deviceId, platform);
  const tokens = await issueSession(db, user.id, deviceId);
  return c.json({ userId: user.id, anonymous: false, ...tokens });
});

// 換發 access token（rotate refresh token）
auth.post("/refresh", async (c) => {
  const db = getDb();
  const { refreshToken } = await c.req.json().catch(() => ({}));
  if (!refreshToken) return c.json({ error: "refreshToken 必填" }, 400);
  const [session] = await db.select().from(sessions).where(and(
    eq(sessions.tokenHash, hashToken(refreshToken)),
    gt(sessions.expiresAt, new Date()),
  ));
  if (!session) return c.json({ error: "unauthorized" }, 401);
  await db.delete(sessions).where(eq(sessions.id, session.id));
  const tokens = await issueSession(db, session.userId, session.deviceId);
  return c.json({ userId: session.userId, ...tokens });
});

auth.post("/logout", async (c) => {
  const db = getDb();
  const { refreshToken } = await c.req.json().catch(() => ({}));
  if (refreshToken) {
    await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(refreshToken)));
  }
  return c.json({ ok: true });
});

// 目前帳號資訊 + 裝置清單
auth.get("/me", requireAuth, async (c) => {
  const db = getDb();
  const [me] = await db.select({
    id: users.id, email: users.email, createdAt: users.createdAt,
  }).from(users).where(eq(users.id, c.get("userId")));
  if (!me) return c.json({ error: "unauthorized" }, 401);
  const deviceList = await db.select({
    id: devices.id, platform: devices.platform, lastSeenAt: devices.lastSeenAt,
  }).from(devices).where(eq(devices.userId, me.id));
  return c.json({ ...me, anonymous: !me.email, devices: deviceList });
});

// 登出特定裝置（撤銷該裝置的所有 session）
auth.delete("/devices/:id", requireAuth, async (c) => {
  const db = getDb();
  const deviceId = c.req.param("id");
  const userId = c.get("userId");
  const [device] = await db.select().from(devices).where(and(eq(devices.id, deviceId), eq(devices.userId, userId)));
  if (!device) return c.json({ error: "找不到裝置" }, 404);
  await db.delete(sessions).where(and(eq(sessions.userId, userId), eq(sessions.deviceId, deviceId)));
  await db.delete(devices).where(eq(devices.id, deviceId));
  return c.json({ ok: true });
});

export default auth;
