import { eq } from "drizzle-orm";
import { getDb } from "../db/index.js";
import { adminAuditLogs, users } from "../db/schema.js";

export const requireAdmin = async (c, next) => {
  const userId = c.get("userId");
  if (!userId) return c.json({ error: "unauthorized" }, 401);

  const db = getDb();
  const [user] = await db.select({ id: users.id, role: users.role, status: users.status })
    .from(users)
    .where(eq(users.id, userId));

  if (!user || user.status !== "active") return c.json({ error: "unauthorized" }, 401);
  if (user.role !== "admin") return c.json({ error: "forbidden" }, 403);
  c.set("adminUserId", user.id);
  await next();
};

export async function writeAdminAudit({ adminUserId, action, targetUserId = null, details = null }) {
  if (!adminUserId || !action) throw new Error("adminUserId and action are required");
  const db = getDb();
  const [log] = await db.insert(adminAuditLogs).values({
    adminUserId,
    action,
    targetUserId,
    details,
  }).returning();
  return log;
}
