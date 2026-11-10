const messageFingerprint = (message) => [
  message?.role || "",
  Number(message?.time) || 0,
  String(message?.content || ""),
].join("\u0000");

/**
 * 信風的 entry.character 就是小手機的完整角色卡，不是第二份匯入資料。
 * 解鎖時只把這張內建卡以永久 id 顯示到聯絡人，並將信風歷史交接到同一角色。
 *
 * 舊版曾在解鎖時建立隨機 id；addCharacter 會用 datingProfileId 找回那位既有角色，
 * 因此重按、舊存檔修復或 relation 遺失都不會再生出一個分身。
 */
export function promoteDatingContact({ entry, messages, addCharacter, setChatHistory, createId }) {
  const canonicalId = entry.character?.id || entry.characterId;
  const migrated = (messages || []).map((message) => ({
    id: createId(),
    role: message.role,
    content: message.content,
    time: message.time,
    fromDating: true,
    datingMessageId: message.id || null,
  }));
  const created = addCharacter({
    ...entry.character,
    avatar: entry.character.avatar || entry.profile.photos?.[0] || "",
    datingProfileId: entry.id,
  }, {
    silent: true,
    source: "dating",
    id: canonicalId,
    initialMessages: migrated,
  });
  if (!created?.id) return null;

  if (migrated.length) {
    setChatHistory((history) => {
      const existing = Array.isArray(history?.[created.id]) ? history[created.id] : [];
      const sourceIds = new Set(existing.map((message) => message?.datingMessageId).filter(Boolean));
      const fingerprints = new Set(existing.map(messageFingerprint));
      const missing = migrated.filter((message) => (
        !(message.datingMessageId && sourceIds.has(message.datingMessageId))
        && !fingerprints.has(messageFingerprint(message))
      ));
      if (!missing.length) return history;
      const combined = [...existing, ...missing].sort((left, right) => (
        (Number(left?.time) || 0) - (Number(right?.time) || 0)
      ));
      return { ...history, [created.id]: combined };
    });
  }
  return created.id;
}
