import {
  EMPTY_DEVICE_SECRETS,
  deviceSecretsEqual,
  extractDeviceSecrets,
  hydrateDeviceSecrets,
  mergeDeviceSecrets,
  normalizeDeviceSecrets,
  stripDeviceSecrets,
} from "./deviceSecrets.js";
import {
  getActivePersonaStorageId,
  isPersonaScopedFeatureKey,
  resolvePersonaFeatureKey,
} from "../services/persona/personaStorageScope.js";
import { DEFAULT_PERSONA_ID } from "../services/persona/personaModel.js";
import { compactActivePersona } from "./backupMediaAssets.js";
import { compactActiveRoomMirrors } from "./persistedMediaCleanup.js";

const DB_NAME = "maliphone_db";
const DB_VERSION = 1;
const STORE_NAME = "app_kv";
const APP_STATE_KEY = "app_state";
const DEVICE_SECRETS_KEY = "device_secrets_v1";

// === 儲存格式（v3：per-entity） ===
// 每個實體獨立一筆，包一層同步 metadata：
//   { data, updatedAt, rev, deviceId, deleted }
// 實體種類：
//   ent_core          其餘小設定（含 charOrder）
//   ent_char_<id>     單一角色卡
//   ent_chat_<id>     單一角色（或群組）的對話
//   ent_chatbg_<id>   單一聊天室背景（可能含 base64 圖）
//   ent_posts         貼文（整包，追加為主、量小）
//   ent_inboxCache    手機收件匣快取（不進 outbox）
//   ent_appCache      手機 App 快取（不進 outbox）
// 刪除用墓碑（deleted: true）保留，供未來雲端同步傳播刪除。
// sync_outbox 記錄尚未上傳的實體 key → updatedAt，同步引擎上傳成功後移除。

const ENT_PREFIX = "ent_";
const CORE_KEY = "ent_core";
const OUTBOX_KEY = "sync_outbox";
const FEATURE_KEYS = new Set(["ent_gachaInventory", "ent_gachaEpisodes", "ent_gachaCurrency", "ent_gachaCrystalLedger", "ent_gachaProgress", "ent_gachaSpecialMemories", "ent_musicPlayer", "ent_coupleDaily", "ent_calendar", "ent_yunyinSave", "ent_petHome", "ent_petSettings", "ent_loginReward", "ent_notes", "ent_systemMailbox", "ent_dating"]);
const charKey = (id) => `ent_char_${id}`;
const chatKey = (id) => `ent_chat_${id}`;
const chatBgKey = (id) => `ent_chatbg_${id}`;
const SINGLETON_ENTITIES = {
  posts: "ent_posts",
  phoneInboxCache: "ent_inboxCache",
  phoneAppCache: "ent_appCache",
  apiConfig: "ent_apiConfig",
  ttsConfig: "ent_ttsConfig",
};
// 不上雲：快取類，以及含玩家 API key 的設定（金鑰只留在裝置本地）
const NO_SYNC_KEYS = new Set(["ent_inboxCache", "ent_appCache", "ent_apiConfig", "ent_ttsConfig"]);

// 舊版 v2 分區格式
const V2_PARTITION_FIELDS = ["chatHistory", "chatBackgrounds", "posts", "phoneInboxCache", "phoneAppCache"];
const V2_CORE_KEY = "part_core";
const v2PartitionKey = (field) => `part_${field}`;

const LEGACY_LOCAL_KEYS = [
  "mali_characters",
  "mali_activeCharId",
  "mali_chatHistory",
  "mali_posts",
  "mali_memories",
  "mali_apiConfig",
];

const getDeviceId = () => {
  try {
    let id = localStorage.getItem("mali_device_id");
    if (!id) {
      id = (typeof crypto !== "undefined" && crypto.randomUUID)
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
      localStorage.setItem("mali_device_id", id);
    }
    return id;
  } catch {
    return "unknown-device";
  }
};

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("IndexedDB open failed"));
  });
}

function readKv(key) {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error || new Error("IndexedDB read failed"));
    tx.oncomplete = () => db.close();
    tx.onerror = () => db.close();
  }));
}

function readAllEntities() {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const range = IDBKeyRange.bound(ENT_PREFIX, `${ENT_PREFIX}￿`);
    const keysReq = store.getAllKeys(range);
    const valuesReq = store.getAll(range);
    tx.oncomplete = () => {
      db.close();
      const out = {};
      const keys = keysReq.result || [];
      const values = valuesReq.result || [];
      for (let i = 0; i < keys.length; i += 1) out[keys[i]] = values[i];
      resolve(out);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error("IndexedDB read failed"));
    };
  }));
}

function writeEntries(entries) {
  if (!entries.length) return Promise.resolve();
  return openDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    for (const [key, value] of entries) {
      if (value === undefined) store.delete(key);
      else store.put(value, key);
    }
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error("IndexedDB write failed"));
    };
  }));
}

function readLegacyLocalStorage() {
  try {
    const found = {};
    for (const key of LEGACY_LOCAL_KEYS) {
      const raw = localStorage.getItem(key);
      if (raw !== null) found[key] = JSON.parse(raw);
    }
    if (Object.keys(found).length === 0) return null;
    return {
      characters: found.mali_characters ?? [],
      activeCharId: found.mali_activeCharId ?? null,
      chatHistory: found.mali_chatHistory ?? {},
      posts: found.mali_posts ?? [],
      memories: found.mali_memories ?? {},
      apiConfig: found.mali_apiConfig ?? {
        provider: "openai",
        baseUrl: "https://api.openai.com/v1",
        apiKey: "",
        model: "gpt-4o-mini",
      },
    };
  } catch {
    return null;
  }
}

function clearLegacyLocalStorage() {
  try {
    for (const key of LEGACY_LOCAL_KEYS) localStorage.removeItem(key);
  } catch {}
}

// === 記憶體中的儲存狀態 ===
// lastSaved：每個實體上次寫入時的資料參照，儲存時比對決定要不要重寫
// lastRevs：每個實體目前的版本號
// outbox：尚未同步的實體 key → updatedAt（快取類除外）
const mem = {
  lastSaved: new Map(),
  lastRevs: new Map(),
  outbox: {},
  lastDeviceSecrets: null,
};

// 所有會同時更新 IndexedDB 與 mem 的操作依序執行，避免兩個非同步存檔
// 從同一份 revision/outbox 基準出發，後完成的舊快照反而蓋掉新快照。
let mutationQueue = Promise.resolve();
const enqueueMutation = (work) => {
  const result = mutationQueue.then(work);
  mutationQueue = result.catch(() => {});
  return result;
};

const wrapEntity = (key, data, deleted = false, revisions = mem.lastRevs) => {
  const rev = (revisions.get(key) || 0) + 1;
  return { data: deleted ? null : data, updatedAt: Date.now(), rev, deviceId: getDeviceId(), deleted };
};

// 把整包 app state 拆成實體 map：{ 實體key → 資料參照 }
function splitStateToEntities(state) {
  const safeState = stripDeviceSecrets(state);
  const {
    characters = [],
    chatHistory = {},
    chatBackgrounds = {},
    ...rest
  } = safeState;
  const entities = new Map();
  const core = {
    ...rest,
    chatRooms: compactActiveRoomMirrors(rest.chatRooms, rest.activeRoomIds),
    personas: compactActivePersona(rest.personas, rest.activePersonaId),
  };
  for (const field of Object.keys(SINGLETON_ENTITIES)) {
    entities.set(SINGLETON_ENTITIES[field], core[field]);
    delete core[field];
  }
  core.charOrder = characters.map((c) => c?.id).filter(Boolean);
  entities.set(CORE_KEY, core);
  for (const c of characters) {
    if (c?.id) entities.set(charKey(c.id), c);
  }
  for (const [id, msgs] of Object.entries(chatHistory)) {
    entities.set(chatKey(id), msgs);
  }
  for (const [id, bg] of Object.entries(chatBackgrounds)) {
    entities.set(chatBgKey(id), bg);
  }
  return entities;
}

const coreChanged = (next, prev) => {
  if (!prev) return true;
  const nextKeys = Object.keys(next);
  if (nextKeys.length !== Object.keys(prev).length) return true;
  return nextKeys.some((k) => {
    // charOrder 是每次重建的陣列，逐項比較避免天天誤判為變動
    if (k === "charOrder") {
      const a = next[k] || [], b = prev[k] || [];
      return a.length !== b.length || a.some((v, i) => v !== b[i]);
    }
    return next[k] !== prev[k];
  });
};

async function writeStateEntities(state, force = false) {
  const entities = splitStateToEntities(state);
  const deviceSecrets = extractDeviceSecrets(state);
  const writes = [];
  const nextLastSaved = new Map(mem.lastSaved);
  const nextLastRevs = new Map(mem.lastRevs);
  const nextOutbox = { ...mem.outbox };
  let outboxDirty = false;
  const markOutbox = (key, updatedAt) => {
    if (NO_SYNC_KEYS.has(key)) return;
    nextOutbox[key] = updatedAt;
    outboxDirty = true;
  };

  for (const [key, data] of entities) {
    const changed = force ||
      (key === CORE_KEY ? coreChanged(data, mem.lastSaved.get(key)) : data !== mem.lastSaved.get(key));
    if (!changed) continue;
    const wrapped = wrapEntity(key, data, false, nextLastRevs);
    writes.push([key, wrapped]);
    markOutbox(key, wrapped.updatedAt);
    nextLastSaved.set(key, data);
    nextLastRevs.set(key, wrapped.rev);
  }

  // 消失的實體（角色被刪等）→ 墓碑，讓未來的同步能傳播刪除
  for (const key of mem.lastSaved.keys()) {
    if (key === CORE_KEY || entities.has(key)) continue;
    const wrapped = wrapEntity(key, null, true, nextLastRevs);
    writes.push([key, wrapped]);
    markOutbox(key, wrapped.updatedAt);
    nextLastSaved.delete(key);
    nextLastRevs.set(key, wrapped.rev);
  }

  if (outboxDirty) writes.push([OUTBOX_KEY, nextOutbox]);
  if (force || !deviceSecretsEqual(deviceSecrets, mem.lastDeviceSecrets)) {
    writes.push([DEVICE_SECRETS_KEY, deviceSecrets]);
  }
  await writeEntries(writes);
  // IndexedDB transaction 成功後才提交記憶體基準；失敗時原狀保留，
  // 下一次相同 snapshot 仍會被判定為待寫入並完整重試。
  mem.lastSaved = nextLastSaved;
  mem.lastRevs = nextLastRevs;
  if (outboxDirty) mem.outbox = nextOutbox;
  mem.lastDeviceSecrets = deviceSecrets;
}

// 從實體 map 還原成整包 app state
function assembleState(defaultState, entities) {
  const coreWrapped = entities[CORE_KEY];
  if (!coreWrapped || coreWrapped.deleted) return null;
  const state = { ...defaultState, ...coreWrapped.data };
  const charOrder = Array.isArray(state.charOrder) ? state.charOrder : [];
  delete state.charOrder;
  const characters = [];
  const chatHistory = {};
  const chatBackgrounds = {};
  for (const [key, wrapped] of Object.entries(entities)) {
    if (!wrapped || wrapped.deleted) continue;
    if (key.startsWith("ent_char_")) characters.push(wrapped.data);
    else if (key.startsWith("ent_chat_") && !key.startsWith("ent_chatbg_")) chatHistory[key.slice("ent_chat_".length)] = wrapped.data;
    else if (key.startsWith("ent_chatbg_")) chatBackgrounds[key.slice("ent_chatbg_".length)] = wrapped.data;
  }
  characters.sort((a, b) => {
    const ai = charOrder.indexOf(a?.id), bi = charOrder.indexOf(b?.id);
    return (ai < 0 ? charOrder.length : ai) - (bi < 0 ? charOrder.length : bi);
  });
  state.characters = characters;
  state.chatHistory = chatHistory;
  state.chatBackgrounds = chatBackgrounds;
  for (const [field, key] of Object.entries(SINGLETON_ENTITIES)) {
    const wrapped = entities[key];
    if (wrapped && !wrapped.deleted) state[field] = wrapped.data;
  }
  return state;
}

// 載入後初始化記憶體狀態，讓後續 saveAppState 的參照比對有基準
function primeMemory(state, entities) {
  mem.lastSaved = splitStateToEntities(state);
  mem.lastRevs = new Map();
  for (const [key, wrapped] of Object.entries(entities || {})) {
    if (wrapped?.rev) mem.lastRevs.set(key, wrapped.rev);
  }
}

function sanitizeEntityData(key, data) {
  if (!data || typeof data !== "object") return data;
  if (key === CORE_KEY) return stripDeviceSecrets(data);
  if (key === SINGLETON_ENTITIES.apiConfig) {
    return { ...data, apiKey: "" };
  }
  if (key === SINGLETON_ENTITIES.ttsConfig) {
    return stripDeviceSecrets({ ttsConfig: data }).ttsConfig;
  }
  return data;
}

function sanitizeWrappedEntity(key, wrapped) {
  if (!wrapped || wrapped.deleted) return wrapped;
  const safeData = sanitizeEntityData(key, wrapped.data);
  if (safeData === wrapped.data) return wrapped;
  return { ...wrapped, data: safeData };
}

const valuesDiffer = (left, right) => JSON.stringify(left) !== JSON.stringify(right);

async function hydrateAndMigrateDeviceSecrets(state, entities, storedSecrets) {
  const legacySecrets = extractDeviceSecrets(state);
  const deviceSecrets = mergeDeviceSecrets(storedSecrets, legacySecrets);
  const safeState = stripDeviceSecrets(state);
  const safeEntities = { ...entities };
  const writes = [];
  for (const key of [CORE_KEY, SINGLETON_ENTITIES.apiConfig, SINGLETON_ENTITIES.ttsConfig]) {
    const wrapped = entities[key];
    const safeWrapped = sanitizeWrappedEntity(key, wrapped);
    if (safeWrapped && valuesDiffer(wrapped, safeWrapped)) {
      safeEntities[key] = safeWrapped;
      writes.push([key, safeWrapped]);
    }
  }
  if (!storedSecrets || !deviceSecretsEqual(storedSecrets, deviceSecrets)) {
    writes.push([DEVICE_SECRETS_KEY, deviceSecrets]);
  }
  await writeEntries(writes);
  mem.lastDeviceSecrets = deviceSecrets;
  primeMemory(safeState, safeEntities);
  return hydrateDeviceSecrets(safeState, deviceSecrets);
}

async function readV2PartitionedState() {
  const core = await readKv(V2_CORE_KEY);
  if (!core) return null;
  const state = { ...core };
  for (const field of V2_PARTITION_FIELDS) {
    const value = await readKv(v2PartitionKey(field));
    if (value !== null && value !== undefined) state[field] = value;
  }
  return state;
}

async function migrateToEntities(migrated, oldKeysToDelete) {
  mem.lastSaved = new Map();
  mem.lastRevs = new Map();
  mem.outbox = {};
  await writeStateEntities(migrated, true);
  await writeEntries(oldKeysToDelete.map((key) => [key, undefined]));
}

async function loadAppState(defaultState) {
  const storedSecrets = await readKv(DEVICE_SECRETS_KEY);
  const entities = await readAllEntities();
  const assembled = assembleState(defaultState, entities);
  if (assembled) {
    mem.outbox = (await readKv(OUTBOX_KEY)) || {};
    return hydrateAndMigrateDeviceSecrets(assembled, entities, storedSecrets);
  }

  // v2 分區格式 → 遷移
  const v2 = await readV2PartitionedState();
  if (v2) {
    const migrated = { ...defaultState, ...v2 };
    await migrateToEntities(migrated, [V2_CORE_KEY, ...V2_PARTITION_FIELDS.map(v2PartitionKey)]);
    return hydrateDeviceSecrets(stripDeviceSecrets(migrated), mem.lastDeviceSecrets);
  }

  // v1 單一 blob 格式 → 遷移
  const savedLegacyKv = await readKv(APP_STATE_KEY);
  if (savedLegacyKv) {
    const migrated = { ...defaultState, ...savedLegacyKv };
    await migrateToEntities(migrated, [APP_STATE_KEY]);
    return hydrateDeviceSecrets(stripDeviceSecrets(migrated), mem.lastDeviceSecrets);
  }

  // 最早的 localStorage 格式 → 遷移
  const legacy = readLegacyLocalStorage();
  if (legacy) {
    const migrated = { ...defaultState, ...legacy };
    await migrateToEntities(migrated, []);
    clearLegacyLocalStorage();
    return hydrateDeviceSecrets(stripDeviceSecrets(migrated), mem.lastDeviceSecrets);
  }
  const deviceSecrets = normalizeDeviceSecrets(storedSecrets || EMPTY_DEVICE_SECRETS);
  mem.lastDeviceSecrets = deviceSecrets;
  return hydrateDeviceSecrets(defaultState, deviceSecrets);
}

function saveAppState(state) {
  return enqueueMutation(() => writeStateEntities(state));
}

// === 給未來同步引擎用的 API ===
// 取得待同步清單（實體 key → 本地最後更新時間）
async function getSyncOutbox() {
  return { ...((await readKv(OUTBOX_KEY)) || {}) };
}
// 讀取單一實體（含 metadata 包裝），供上傳用
function readEntity(key) {
  return readKv(key).then((wrapped) => sanitizeWrappedEntity(key, wrapped));
}
// 套用從伺服器拉下來的實體（不進 outbox——那是本地變更專用）。
// 回傳實際寫入的筆數；呼叫端若在 App 執行中收到 > 0，必須重新載入，
// 否則畫面與 mem.lastSaved 還握著舊資料，下次存檔會把舊資料蓋回雲端。
async function applyRemoteEntitiesUnlocked(list) {
  const writes = [];
  const nextLastRevs = new Map(mem.lastRevs);
  const myDeviceId = getDeviceId();
  for (const e of list || []) {
    if (!e?.key || !e.key.startsWith(ENT_PREFIX)) continue;
    // 這台裝置自己推上去又被拉回來的版本（echo）：本地已有，跳過，
    // 免得呼叫端誤判「雲端有新資料」而觸發不必要的重載
    if (e.deviceId === myDeviceId && (Number(e.rev) || 0) <= (mem.lastRevs.get(e.key) || 0)) continue;
    const local = await readKv(e.key);
    const remoteUpdatedAt = Number(e.updatedAt) || 0;
    const localUpdatedAt = Number(local?.updatedAt) || 0;
    // 游標重置或重新登入可能再次拉到舊的雲端快照；較舊版本不得覆蓋本機資料。
    if (local && (localUpdatedAt > remoteUpdatedAt || (localUpdatedAt === remoteUpdatedAt && (Number(local.rev) || 0) >= (Number(e.rev) || 0)))) continue;
    writes.push([e.key, {
      data: e.deleted ? null : sanitizeEntityData(e.key, e.data ?? null),
      updatedAt: remoteUpdatedAt || Date.now(),
      rev: Number(e.rev) || 1,
      deviceId: e.deviceId || null,
      deleted: !!e.deleted,
    }]);
    nextLastRevs.set(e.key, Number(e.rev) || 1);
  }
  await writeEntries(writes);
  mem.lastRevs = nextLastRevs;
  return writes.length;
}
function applyRemoteEntities(list) {
  return enqueueMutation(() => applyRemoteEntitiesUnlocked(list));
}

// 換帳號時清除本地所有實體與 outbox，之後由雲端資料重建。
// 只能在確定接下來會從雲端完整拉取時呼叫。
async function resetLocalEntitiesUnlocked() {
  const entities = await readAllEntities();
  await writeEntries([
    ...Object.keys(entities).map((key) => [key, undefined]),
    [OUTBOX_KEY, {}],
  ]);
  mem.lastSaved = new Map();
  mem.lastRevs = new Map();
  mem.outbox = {};
}
function resetLocalEntities() {
  return enqueueMutation(resetLocalEntitiesUnlocked);
}

async function clearDeviceSecretsUnlocked() {
  await writeEntries([[DEVICE_SECRETS_KEY, undefined]]);
  mem.lastDeviceSecrets = normalizeDeviceSecrets(EMPTY_DEVICE_SECRETS);
}
function clearDeviceSecrets() {
  return enqueueMutation(clearDeviceSecretsUnlocked);
}

// 清空待同步清單（切換帳號時用：舊帳號的未上傳項目不該推到新帳號）
async function clearSyncOutboxUnlocked() {
  await writeEntries([[OUTBOX_KEY, {}]]);
  mem.outbox = {};
}
function clearSyncOutbox() {
  return enqueueMutation(clearSyncOutboxUnlocked);
}

// 上傳成功後把實體移出 outbox；墓碑實體順便真正刪除
async function ackSyncedUnlocked(keys) {
  const deletes = [];
  const nextOutbox = { ...mem.outbox };
  for (const key of keys) {
    delete nextOutbox[key];
    const wrapped = await readKv(key);
    if (wrapped?.deleted) deletes.push([key, undefined]);
  }
  await writeEntries([...deletes, [OUTBOX_KEY, nextOutbox]]);
  mem.outbox = nextOutbox;
}
function ackSynced(keys) {
  return enqueueMutation(() => ackSyncedUnlocked(keys));
}

// 獨立功能可直接使用既有 maliphone_db 實體與同步 outbox，避免各自建立資料庫。
async function loadFeatureEntity(key, fallback = null) {
  if (!FEATURE_KEYS.has(key)) throw new Error(`Unknown feature entity: ${key}`);
  const resolvedKey = resolvePersonaFeatureKey(key);
  let wrapped = await readKv(resolvedKey);
  // Existing installs stored these features without a persona namespace. Only
  // the migrated default persona may adopt that legacy value.
  if (!wrapped && isPersonaScopedFeatureKey(key) && getActivePersonaStorageId() === DEFAULT_PERSONA_ID) {
    const legacy = await readKv(key);
    if (legacy && !legacy.deleted) {
      await saveFeatureEntities([[key, legacy.data]]);
      wrapped = await readKv(resolvedKey);
    }
  }
  return wrapped && !wrapped.deleted ? wrapped.data : fallback;
}

async function saveFeatureEntity(key, data) {
  await saveFeatureEntities([[key, data]]);
}

async function loadPersonaFeatureEntity(key, personaId, fallback = null) {
  if (!FEATURE_KEYS.has(key) || !isPersonaScopedFeatureKey(key)) {
    throw new Error(`Unknown persona feature entity: ${key}`);
  }
  const wrapped = await readKv(resolvePersonaFeatureKey(key, personaId));
  return wrapped && !wrapped.deleted ? wrapped.data : fallback;
}

function savePersonaFeatureEntities(personaId, entries) {
  const requested = Array.from(entries || []);
  for (const [key] of requested) {
    if (!FEATURE_KEYS.has(key) || !isPersonaScopedFeatureKey(key)) {
      throw new Error(`Unknown persona feature entity: ${key}`);
    }
  }
  const resolved = requested.map(([key, data]) => [resolvePersonaFeatureKey(key, personaId), data]);
  return enqueueMutation(() => saveResolvedFeatureEntitiesUnlocked(resolved));
}

// 將一組獨立功能資料放在同一個 IndexedDB transaction 內寫入。
// 匯入備份時可避免前幾項成功、後幾項失敗而留下混合資料。
async function saveResolvedFeatureEntitiesUnlocked(normalized) {
  if (!normalized.length) return;
  const previousEntries = await Promise.all(normalized.map(async ([key]) => [key, await readKv(key)]));
  const previousByKey = new Map(previousEntries);
  const latestOutbox = (await readKv(OUTBOX_KEY)) || {};
  const updatedAt = Date.now();
  const deviceId = getDeviceId();
  const nextOutbox = { ...latestOutbox, ...mem.outbox };
  const writes = normalized.map(([key, data]) => {
    nextOutbox[key] = updatedAt;
    return [key, {
      data,
      updatedAt,
      rev: (Number(previousByKey.get(key)?.rev) || 0) + 1,
      deviceId,
      deleted: false,
    }];
  });
  await writeEntries([...writes, [OUTBOX_KEY, nextOutbox]]);
  mem.outbox = nextOutbox;
}
function normalizeFeatureWrites(entries) {
  const requested = Array.from(entries || []);
  for (const [key] of requested) {
    if (!FEATURE_KEYS.has(key)) throw new Error(`Unknown feature entity: ${key}`);
  }
  return requested.map(([key, data]) => [resolvePersonaFeatureKey(key), data]);
}
function saveFeatureEntities(entries) {
  // Resolve the active persona before entering the mutation queue. An async
  // write started by Persona A must never land in Persona B after a switch.
  const normalized = normalizeFeatureWrites(entries);
  return enqueueMutation(() => saveResolvedFeatureEntitiesUnlocked(normalized));
}

export { loadAppState, saveAppState, getSyncOutbox, readEntity, ackSynced, applyRemoteEntities, clearSyncOutbox, resetLocalEntities, clearDeviceSecrets, getDeviceId, loadFeatureEntity, saveFeatureEntity, saveFeatureEntities, loadPersonaFeatureEntity, savePersonaFeatureEntities };
