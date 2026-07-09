import crypto from "node:crypto";
import { sign, verify } from "hono/jwt";
import { sessions } from "../db/schema.js";

export const ACCESS_TTL_SEC = 15 * 60;
export const REFRESH_TTL_DAYS = 30;

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") throw new Error("JWT_SECRET 未設定");
  return "dev-only-secret-change-me";
}

export const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

// 建立 session：refresh token 只回傳一次，DB 只存 hash
export async function issueSession(db, userId, deviceId) {
  const refreshToken = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 86400000);
  const [session] = await db.insert(sessions).values({
    userId,
    tokenHash: hashToken(refreshToken),
    deviceId: deviceId || null,
    expiresAt,
  }).returning();
  const accessToken = await sign({
    sub: userId,
    sid: session.id,
    exp: Math.floor(Date.now() / 1000) + ACCESS_TTL_SEC,
  }, getJwtSecret());
  return { accessToken, refreshToken, expiresAt };
}

// JWT 驗證中介層：通過後 c.get("userId") 可用
export const requireAuth = async (c, next) => {
  const header = c.req.header("Authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return c.json({ error: "unauthorized" }, 401);
  try {
    const payload = await verify(token, getJwtSecret(), "HS256");
    c.set("userId", payload.sub);
    c.set("sessionId", payload.sid);
  } catch {
    return c.json({ error: "unauthorized" }, 401);
  }
  await next();
};

// 登入失敗節流：同 email 5 次失敗鎖 15 分鐘（單機記憶體版，M5 前夠用）
const loginFails = new Map();
export function checkLoginThrottle(email) {
  const rec = loginFails.get(email);
  if (rec && rec.count >= 5 && Date.now() - rec.last < 15 * 60 * 1000) return false;
  return true;
}
export function recordLoginFail(email) {
  const rec = loginFails.get(email) || { count: 0, last: 0 };
  if (Date.now() - rec.last > 15 * 60 * 1000) rec.count = 0;
  rec.count += 1;
  rec.last = Date.now();
  loginFails.set(email, rec);
}
export function clearLoginFails(email) {
  loginFails.delete(email);
}
