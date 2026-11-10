export const DEFAULT_PERSONA_ID = "persona-default";
export const MAX_PERSONAS = 8;

export const PERSONA_SCOPED_FIELDS = Object.freeze([
  "activeCharId",
  "chatHistory",
  "chatRooms",
  "activeRoomIds",
  "chatModes",
  "chatReplyTimings",
  "chatBackgrounds",
  "groupChats",
  "chatScenes",
  "groupScenes",
  "chatTimeSettings",
  "innerThoughtSettings",
  "proactiveSettings",
  "proactiveUnread",
  "posts",
  "socialSettings",
  "memories",
  "chatLorebookBindings",
  "phoneInboxCache",
  "phoneAppCache",
  "wallet",
  "characterWallets",
  "transfers",
  "characterBlockStates",
  "characterChatMeta",
]);

const cloneDefault = (value) => {
  if (Array.isArray(value)) return [...value];
  if (value && typeof value === "object") return { ...value };
  return value;
};

export const createPersonaId = () => (
  typeof crypto !== "undefined" && crypto.randomUUID
    ? `persona-${crypto.randomUUID()}`
    : `persona-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
);

export function capturePersonaData(state = {}, defaults = {}) {
  const data = {};
  for (const field of PERSONA_SCOPED_FIELDS) {
    data[field] = state[field] === undefined
      ? cloneDefault(defaults[field])
      : state[field];
  }
  data.playerProfile = state.playerProfile || defaults.playerProfile;
  return data;
}

export function createEmptyPersonaData(defaults = {}, profile = {}) {
  const data = capturePersonaData({}, defaults);
  data.playerProfile = {
    ...(defaults.playerProfile || {}),
    ...(profile || {}),
  };
  return data;
}

export function normalizePersonaCollection(state = {}, defaults = {}) {
  const raw = state.personas && typeof state.personas === "object" ? state.personas : {};
  const ids = Object.keys(raw);
  if (!ids.length) {
    const data = capturePersonaData(state, defaults);
    return {
      activePersonaId: DEFAULT_PERSONA_ID,
      personas: {
        [DEFAULT_PERSONA_ID]: {
          id: DEFAULT_PERSONA_ID,
          label: String(data.playerProfile?.name || "預設人格").trim() || "預設人格",
          createdAt: Date.now(),
          data,
        },
      },
      activeData: data,
      migrated: true,
    };
  }

  const requestedId = String(state.activePersonaId || "");
  const activePersonaId = raw[requestedId] ? requestedId : ids[0];
  const personas = {};
  for (const id of ids) {
    const item = raw[id] || {};
    const itemData = item.activeDataInTopLevel && id === activePersonaId
      ? capturePersonaData(state, defaults)
      : item.data;
    const profileName = String(itemData?.playerProfile?.name || "").trim();
    personas[id] = {
      id,
      label: profileName || String(item.label || "玩家人格").trim() || "玩家人格",
      createdAt: Number(item.createdAt) || Date.now(),
      data: {
        ...createEmptyPersonaData(defaults),
        ...(itemData || {}),
        playerProfile: {
          ...(defaults.playerProfile || {}),
          ...(itemData?.playerProfile || {}),
        },
      },
    };
  }
  return {
    activePersonaId,
    personas,
    activeData: personas[activePersonaId].data,
    migrated: false,
  };
}

export function serializePersonas(personas, activePersonaId, activeData) {
  const current = personas?.[activePersonaId];
  if (!current) return personas || {};
  return {
    ...personas,
    [activePersonaId]: {
      ...current,
      label: String(activeData?.playerProfile?.name || current.label || "玩家人格").trim() || "玩家人格",
      data: activeData,
    },
  };
}
