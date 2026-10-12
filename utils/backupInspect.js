// 備份檔／救援檔的讀取與摘要。只做純資料轉換，不讀寫任何存檔，
// 匯入預覽與唯讀檢視頁（viewer）共用。
import { FEATURE_EXPORTS, PERSONA_FEATURE_EXPORTS } from "../constants/featureStoreKeys.js";
import { unpackBackupMedia } from "./backupMediaAssets.js";

const isRecord = (value) => !!value && typeof value === "object" && !Array.isArray(value);

// 與 utils/indexedDbStorage.js 的實體命名一致。
const ENT = {
  core: "ent_core",
  charPrefix: "ent_char_",
  chatPrefix: "ent_chat_",
  chatBgPrefix: "ent_chatbg_",
  personaPrefix: "ent_persona_",
};
const SINGLETON_ENTITIES = {
  posts: "ent_posts",
  phoneInboxCache: "ent_inboxCache",
  phoneAppCache: "ent_appCache",
  apiConfig: "ent_apiConfig",
  ttsConfig: "ent_ttsConfig",
};
const V2_PARTITION_FIELDS = ["chatHistory", "chatBackgrounds", "posts", "phoneInboxCache", "phoneAppCache"];

export const isRescueFile = (raw) => isRecord(raw) && raw.format === "maliphone-rescue" && isRecord(raw.entries);

const unwrap = (wrapped) => (isRecord(wrapped) && !wrapped.deleted && "data" in wrapped ? wrapped.data : undefined);

/** 把救援檔的原始實體組回 App 狀態（與 indexedDbStorage 的 assembleState 相同規則）。 */
export function assembleRescueState(entries, { allowPartial = false } = {}) {
  const core = unwrap(entries[ENT.core]);
  const partial = !isRecord(core) && !isRecord(entries.app_state) && !isRecord(entries.part_core);
  let partialHasData = false;
  let state = null;
  if (isRecord(core) || (allowPartial && partial)) {
    state = { ...core };
    const charOrder = Array.isArray(state.charOrder) ? state.charOrder : [];
    delete state.charOrder;
    const characters = [];
    const chatHistory = {};
    const chatBackgrounds = {};
    for (const [key, wrapped] of Object.entries(entries)) {
      const data = unwrap(wrapped);
      if (data === undefined) continue;
      if (key.startsWith(ENT.charPrefix) && (!partial || isRecord(data))) {
        characters.push(data);
        partialHasData = true;
      } else if (key.startsWith(ENT.chatBgPrefix) && (!partial || isRecord(data) || typeof data === "string")) {
        chatBackgrounds[key.slice(ENT.chatBgPrefix.length)] = data;
        partialHasData = true;
      } else if (key.startsWith(ENT.chatPrefix) && (!partial || Array.isArray(data))) {
        chatHistory[key.slice(ENT.chatPrefix.length)] = partial ? data.filter(isRecord) : data;
        partialHasData = true;
      }
    }
    characters.sort((a, b) => {
      const ai = charOrder.indexOf(a?.id);
      const bi = charOrder.indexOf(b?.id);
      return (ai < 0 ? charOrder.length : ai) - (bi < 0 ? charOrder.length : bi);
    });
    state.characters = characters;
    state.chatHistory = chatHistory;
    state.chatBackgrounds = chatBackgrounds;
    for (const [field, key] of Object.entries(SINGLETON_ENTITIES)) {
      const data = unwrap(entries[key]);
      if (data !== undefined && (!partial || (field === "posts" ? Array.isArray(data) : isRecord(data)))) {
        state[field] = data;
        partialHasData = true;
      }
    }
    if (partial) {
      // Older rescue files may retain individual partitions without part_core.
      for (const field of V2_PARTITION_FIELDS) {
        const data = entries[`part_${field}`];
        if (field === "posts" ? Array.isArray(data) : isRecord(data)) {
          state[field] = data;
          partialHasData = true;
        }
      }
    }
  } else if (isRecord(entries.app_state)) {
    state = { ...entries.app_state };
  } else if (isRecord(entries.part_core)) {
    state = { ...entries.part_core };
    for (const field of V2_PARTITION_FIELDS) {
      if (entries[`part_${field}`] !== undefined) state[field] = entries[`part_${field}`];
    }
  }
  if (!state) return null;

  const featureData = isRecord(state.featureData) ? { ...state.featureData } : {};
  for (const [name, [key, fallback]] of Object.entries(FEATURE_EXPORTS)) {
    const data = unwrap(entries[key]);
    const validPartial = Array.isArray(fallback) ? Array.isArray(data) : name === "gachaCurrency" ? typeof data === "number" && Number.isFinite(data) : isRecord(data);
    if (data !== undefined && (!partial || validPartial)) {
      featureData[name] = data;
      partialHasData = true;
    }
  }
  const personaFeatures = {};
  const scopedNames = Object.fromEntries(Object.entries(PERSONA_FEATURE_EXPORTS).map(([name, [key]]) => [key.slice("ent_".length), name]));
  for (const [key, wrapped] of Object.entries(entries)) {
    if (!key.startsWith(ENT.personaPrefix)) continue;
    const rest = key.slice(ENT.personaPrefix.length);
    const suffix = Object.keys(scopedNames).find((item) => rest.endsWith(`_${item}`));
    const data = unwrap(wrapped);
    if (!suffix || data === undefined || (partial && !isRecord(data))) continue;
    const personaId = rest.slice(0, rest.length - suffix.length - 1);
    if (!personaId) continue;
    personaFeatures[personaId] = { ...(personaFeatures[personaId] || {}), [scopedNames[suffix]]: data };
    partialHasData = true;
  }
  if (Object.keys(personaFeatures).length) featureData.personaFeatures = personaFeatures;
  if (Object.keys(featureData).length) state.featureData = featureData;
  return partial && !partialHasData ? null : state;
}

/** 救援檔 → 一般全域備份格式，可直接走既有匯入流程。 */
export function rescueToAppState(raw) {
  const state = assembleRescueState(raw?.entries || {});
  if (!state) {
    const error = new Error("Rescue file has no readable core app data");
    error.code = "RESCUE_CORE_MISSING";
    throw error;
  }
  return {
    format: "maliphone-app-state",
    formatVersion: 1,
    version: String(raw.appVersion || ""),
    exportedAt: raw.exportedAt || null,
    source: "maliphone-rescue",
    state,
  };
}

/** 讀任一種檔案給檢視頁用：回傳 { kind, exportedAt, appVersion, state }。 */
export function readBackupForViewing(raw) {
  if (isRescueFile(raw)) {
    const complete = assembleRescueState(raw.entries);
    const state = complete || assembleRescueState(raw.entries, { allowPartial: true });
    if (!state) throw new Error("Rescue file has no readable app data");
    return { kind: "rescue", partial: !complete, exportedAt: raw.exportedAt || null, appVersion: String(raw.appVersion || ""), skipped: Array.isArray(raw.skipped) ? raw.skipped.length : 0, state };
  }
  if (isRecord(raw) && raw.format === "maliphone-app-state" && isRecord(raw.state)) {
    const state = Number(raw.formatVersion) >= 2 ? unpackBackupMedia(raw.state, raw.assets) : raw.state;
    return { kind: raw.source === "maliphone-rescue" ? "rescue" : "backup", exportedAt: raw.exportedAt || null, appVersion: String(raw.version || ""), skipped: 0, state };
  }
  if (isRecord(raw) && (Array.isArray(raw.characters) || isRecord(raw.chatHistory))) {
    return { kind: "legacy", exportedAt: raw.exportedAt || null, appVersion: "", skipped: 0, state: raw };
  }
  throw new Error("Unsupported file");
}

const messageTime = (message) => Number(message?.time || message?.createdAt || message?.timestamp) || 0;
const lastTimeOf = (messages) => (Array.isArray(messages) ? messages.reduce((latest, message) => Math.max(latest, messageTime(message)), 0) : 0);

/** 內容摘要：給匯入預覽看「是不是我的資料」。 */
export function summarizeBackupContent(state) {
  const characters = Array.isArray(state?.characters) ? state.characters : [];
  const chatHistory = isRecord(state?.chatHistory) ? state.chatHistory : {};
  const chatRooms = isRecord(state?.chatRooms) ? state.chatRooms : {};
  const groups = Array.isArray(state?.groupChats) ? state.groupChats : [];
  const nameOf = (id) => characters.find((character) => String(character?.id) === String(id))?.name || "";
  let totalMessages = 0;
  const recent = [];
  for (const [id, messages] of Object.entries(chatHistory)) {
    let count = Array.isArray(messages) ? messages.length : 0;
    let at = lastTimeOf(messages);
    for (const room of Array.isArray(chatRooms[id]) ? chatRooms[id] : []) {
      if (room?.activeDataInTopLevel || !Array.isArray(room?.messages)) continue;
      count += room.messages.length;
      at = Math.max(at, lastTimeOf(room.messages));
    }
    totalMessages += count;
    const name = nameOf(id);
    if (name && count) recent.push({ name, at });
  }
  for (const group of groups) {
    const messages = Array.isArray(group?.messages) ? group.messages : [];
    totalMessages += messages.length;
    if (messages.length) recent.push({ name: String(group?.name || ""), at: lastTimeOf(messages) });
  }
  recent.sort((a, b) => b.at - a.at);
  return {
    characterNames: characters.map((character) => String(character?.name || "")).filter(Boolean),
    totalMessages,
    recentChats: recent.filter((item) => item.name).slice(0, 3),
  };
}
