import { pgTable, uuid, text, timestamp, boolean, integer, bigserial, numeric, jsonb, primaryKey, uniqueIndex, index } from "drizzle-orm/pg-core";

// 帳號。密碼用 argon2id 雜湊（M2 實作）。
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").unique(), // 匿名帳號為 null，綁定 email 後填入
  passwordHash: text("password_hash"),
  role: text("role").notNull().default("user"), // user / admin
  status: text("status").notNull().default("active"), // active / banned / deleted
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const adminAuditLogs = pgTable("admin_audit_logs", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  adminUserId: uuid("admin_user_id").notNull().references(() => users.id),
  action: text("action").notNull(),
  targetUserId: uuid("target_user_id").references(() => users.id),
  details: jsonb("details"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("admin_audit_admin_idx").on(t.adminUserId, t.createdAt),
  index("admin_audit_target_idx").on(t.targetUserId, t.createdAt),
]);

// 登入 session（refresh token 的 hash）
export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  deviceId: text("device_id"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("sessions_user_idx").on(t.userId)]);

// 裝置（App 端既有 mali_device_id）
export const devices = pgTable("devices", {
  id: text("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  platform: text("platform"), // android / web
  fcmToken: text("fcm_token"),
  proactiveEnabled: boolean("proactive_enabled").notNull().default(false),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
}, (t) => [index("devices_user_idx").on(t.userId)]);

// 雲端同步：本地 IndexedDB 實體的鏡像。serverSeq 是 pull 游標。
export const entities = pgTable("entities", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  key: text("key").notNull(), // ent_char_x / ent_chat_x / ...
  rev: integer("rev").notNull(),
  serverSeq: bigserial("server_seq", { mode: "number" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  deviceId: text("device_id"),
  deleted: boolean("deleted").notNull().default(false),
  data: jsonb("data"),
}, (t) => [
  primaryKey({ columns: [t.userId, t.key] }),
  index("entities_seq_idx").on(t.userId, t.serverSeq),
]);

// 點數帳本：只插入，不更新不刪除。餘額 = SUM(amount)。
export const pointLedger = pgTable("point_ledger", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  amount: integer("amount").notNull(), // 正=入點, 負=扣點
  kind: text("kind").notNull(), // purchase / ai_usage / refund / admin / game
  ref: text("ref"), // 訂單號 / AI 請求 id / 遊戲事件 id
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("ledger_user_idx").on(t.userId)]);

// 付費訂單。providerReceipt 唯一索引防同一張收據重複入點。
export const purchases = pgTable("purchases", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  provider: text("provider").notNull(), // google_play / stripe / manual
  providerReceipt: text("provider_receipt").notNull(),
  points: integer("points").notNull(),
  amountPaid: numeric("amount_paid"),
  currency: text("currency"),
  status: text("status").notNull().default("pending"), // pending / verified / rejected
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("purchases_receipt_uq").on(t.provider, t.providerReceipt)]);

// AI 代理用量紀錄
export const aiUsage = pgTable("ai_usage", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  model: text("model").notNull(),
  promptTokens: integer("prompt_tokens"),
  completionTokens: integer("completion_tokens"),
  costPoints: integer("cost_points").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("ai_usage_user_idx").on(t.userId)]);
