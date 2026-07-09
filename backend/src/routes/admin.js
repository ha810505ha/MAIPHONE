import { Hono } from "hono";
import { requireAuth } from "../lib/auth.js";
import { requireAdmin } from "../lib/admin.js";

const admin = new Hono();
admin.use("*", requireAuth, requireAdmin);

admin.get("/me", (c) => c.json({
  ok: true,
  adminUserId: c.get("adminUserId"),
}));

export default admin;
