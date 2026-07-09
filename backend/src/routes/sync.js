import { Hono } from "hono";
import { and, asc, eq, gt, sql } from "drizzle-orm";
import { getDb } from "../db/index.js";
import { entities } from "../db/schema.js";
import { requireAuth } from "../lib/auth.js";

const sync = new Hono();
sync.use("*", requireAuth);

// 單一實體上限。超大實體（通常是聊天背景圖）先拒收，之後補物件儲存（見 plan.md §5）
const MAX_DATA_BYTES = 800 * 1024;
const PULL_PAGE_SIZE = 200;
const PUSH_BATCH_LIMIT = 100;

const serialize = (row) => ({
  key: row.key,
  rev: row.rev,
  updatedAt: row.updatedAt instanceof Date ? row.updatedAt.getTime() : row.updatedAt,
  deviceId: row.deviceId,
  deleted: row.deleted,
  data: row.data,
  serverSeq: Number(row.serverSeq),
});

// App 端 outbox 逐筆上傳。衝突策略 v1：last-write-wins（比 updatedAt），
// 輸的一方拿到 server 版本自行覆蓋本地。
sync.post("/push", async (c) => {
  const db = getDb();
  const userId = c.get("userId");
  const body = await c.req.json().catch(() => ({}));
  const list = Array.isArray(body.entities) ? body.entities : [];
  if (!list.length) return c.json({ results: [] });
  if (list.length > PUSH_BATCH_LIMIT) return c.json({ error: `一次最多 ${PUSH_BATCH_LIMIT} 筆` }, 400);

  const results = [];
  for (const e of list) {
    if (!e?.key || typeof e.key !== "string" || !e.key.startsWith("ent_")) {
      results.push({ key: e?.key ?? null, status: "invalid" });
      continue;
    }
    const bytes = Buffer.byteLength(JSON.stringify(e.data ?? null));
    if (bytes > MAX_DATA_BYTES) {
      results.push({ key: e.key, status: "too_large" });
      continue;
    }
    const incomingAt = new Date(Number(e.updatedAt) || Date.now());
    const [existing] = await db.select().from(entities)
      .where(and(eq(entities.userId, userId), eq(entities.key, e.key)));
    if (existing && existing.updatedAt.getTime() > incomingAt.getTime()) {
      results.push({ key: e.key, status: "conflict", server: serialize(existing) });
      continue;
    }
    const values = {
      userId,
      key: e.key,
      rev: Number(e.rev) || 1,
      updatedAt: incomingAt,
      deviceId: e.deviceId || null,
      deleted: !!e.deleted,
      data: e.deleted ? null : (e.data ?? null),
      // bigserial 只在 insert 時自動給值，update 要手動進位才能被 pull 游標掃到
      serverSeq: sql`nextval('entities_server_seq_seq')`,
    };
    await db.insert(entities).values(values).onConflictDoUpdate({
      target: [entities.userId, entities.key],
      set: values,
    });
    results.push({ key: e.key, status: "ok" });
  }
  return c.json({ results });
});

// 增量拉取：?since=<serverSeq 游標>，含墓碑
sync.get("/pull", async (c) => {
  const db = getDb();
  const userId = c.get("userId");
  const since = Number(c.req.query("since")) || 0;
  const rows = await db.select().from(entities)
    .where(and(eq(entities.userId, userId), gt(entities.serverSeq, since)))
    .orderBy(asc(entities.serverSeq))
    .limit(PULL_PAGE_SIZE);
  return c.json({
    entities: rows.map(serialize),
    nextSince: rows.length ? Number(rows[rows.length - 1].serverSeq) : since,
    hasMore: rows.length === PULL_PAGE_SIZE,
  });
});

export default sync;
