// 非同步回覆只能追加到 setter 當下收到的最新 state。
// 不接受呼叫端傳入舊的完整 messages 陣列，避免 AI 等待期間的新訊息被覆蓋。
export function appendUniqueMessages(currentMessages, additions) {
  const current = Array.isArray(currentMessages) ? currentMessages : [];
  const incoming = Array.isArray(additions) ? additions.filter(Boolean) : [];
  if (!incoming.length) return current;
  const seenIds = new Set(current.map((message) => message?.id).filter(Boolean));
  const accepted = incoming.filter((message) => {
    if (!message?.id) return true;
    if (seenIds.has(message.id)) return false;
    seenIds.add(message.id);
    return true;
  });
  return accepted.length ? [...current, ...accepted] : current;
}

export function appendGroupMessages(groups, groupId, additions, updatedAt = Date.now()) {
  if (!Array.isArray(groups) || !groupId) return groups;
  let changed = false;
  const next = groups.map((group) => {
    if (group?.id !== groupId) return group;
    const messages = appendUniqueMessages(group.messages, additions);
    if (messages === group.messages) return group;
    changed = true;
    return { ...group, messages, updatedAt };
  });
  return changed ? next : groups;
}

export function removeGroupMessage(groups, groupId, messageId, updatedAt = Date.now()) {
  if (!Array.isArray(groups) || !groupId || !messageId) return groups;
  let changed = false;
  const next = groups.map((group) => {
    if (group?.id !== groupId) return group;
    const current = Array.isArray(group.messages) ? group.messages : [];
    const messages = current.filter((message) => message?.id !== messageId);
    if (messages.length === current.length) return group;
    changed = true;
    return { ...group, messages, updatedAt };
  });
  return changed ? next : groups;
}
