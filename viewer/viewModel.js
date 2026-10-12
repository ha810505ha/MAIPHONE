// 把備份／救援檔的 App 狀態整理成檢視頁要顯示的資料。純函式，不讀寫任何存檔。

const isRecord = (value) => !!value && typeof value === "object" && !Array.isArray(value);
const asArray = (value) => (Array.isArray(value) ? value : []);
const text = (value) => (typeof value === "string" ? value : value == null ? "" : String(value));
const timeOf = (item) => Number(item?.time || item?.createdAt || item?.updatedAt || item?.timestamp || item?.date) || 0;

// 與 utils/chatMessageUtils.js 的 stripInternalBlocks 相同規則（不直接引用，避免把聊天執行期程式拉進檢視頁）。
export function stripInternalBlocks(value) {
  return text(value)
    .replace(/<internal>[\s\S]*?<\/internal>/gi, " ")
    .replace(/<(think|思|inner)>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(?:think|思|inner)>[\s\S]*$/i, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function imageSrcOf(value, mime) {
  const raw = text(value);
  if (!raw) return "";
  if (/^data:image\//i.test(raw) || /^https:\/\//i.test(raw) || /^blob:/i.test(raw)) return raw;
  if (/^[a-z0-9+/=\s]{128,}$/i.test(raw)) return `data:${mime || "image/png"};base64,${raw.replace(/\s/g, "")}`;
  return "";
}

const lastOf = (messages) => messages.reduce((latest, message) => (timeOf(message) >= timeOf(latest || {}) ? message : latest), null);

export function buildViewModel(state, tr) {
  const characters = asArray(state?.characters).filter(isRecord);
  const nameOf = (id) => characters.find((character) => String(character.id) === String(id))?.name || "";
  const avatarOf = (id) => imageSrcOf(characters.find((character) => String(character.id) === String(id))?.avatar);
  const playerName = text(state?.playerProfile?.nickname || state?.playerProfile?.name) || tr("你", "You", "あなた", "당신");
  const chatHistory = isRecord(state?.chatHistory) ? state.chatHistory : {};
  const chatRooms = isRecord(state?.chatRooms) ? state.chatRooms : {};
  const activeRoomIds = isRecord(state?.activeRoomIds) ? state.activeRoomIds : {};
  const featureData = isRecord(state?.featureData) ? state.featureData : {};
  const unknownName = tr("未知角色", "Unknown character", "不明なキャラ", "알 수 없는 캐릭터");

  const chatIds = [...new Set([...characters.map((character) => String(character.id)), ...Object.keys(chatHistory)])];
  const chats = chatIds.map((id) => {
    const topLevel = asArray(chatHistory[id]);
    const rooms = [];
    let activeFound = false;
    for (const room of asArray(chatRooms[id]).filter(isRecord)) {
      const isActive = room.activeDataInTopLevel || String(room.id) === String(activeRoomIds[id]);
      if (isActive) activeFound = true;
      const messages = isActive ? topLevel : asArray(room.messages);
      const title = text(room.title) || tr("聊天室", "Chat", "チャット", "채팅");
      rooms.push({ id: String(room.id), title: room.archivedAt ? `${title}${tr("（已封存）", " (archived)", "（アーカイブ）", " (보관됨)")}` : title, messages, active: isActive });
    }
    if (!activeFound && topLevel.length) rooms.unshift({ id: "__main", title: tr("目前的聊天室", "Current chat", "現在のチャット", "현재 채팅"), messages: topLevel, active: true });
    rooms.sort((a, b) => Number(b.active) - Number(a.active));
    const all = rooms.flatMap((room) => room.messages);
    const last = lastOf(all);
    return {
      id,
      name: nameOf(id) || unknownName,
      avatar: avatarOf(id),
      rooms: rooms.filter((room) => room.messages.length),
      count: all.length,
      lastAt: timeOf(last),
      lastText: messagePreview(last, tr),
    };
  }).filter((chat) => chat.count > 0).sort((a, b) => b.lastAt - a.lastAt);

  const groups = asArray(state?.groupChats).filter(isRecord).map((group) => {
    const messages = asArray(group.messages);
    const last = lastOf(messages);
    const memberNames = asArray(group.members || group.memberIds).map((member) => (isRecord(member) ? member.name || nameOf(member.id) : nameOf(member))).filter(Boolean);
    return { id: String(group.id), name: text(group.name) || tr("群組", "Group", "グループ", "그룹"), memberNames, messages, count: messages.length, lastAt: timeOf(last), lastText: messagePreview(last, tr) };
  }).sort((a, b) => b.lastAt - a.lastAt);

  const authorOf = (item) => (item?.authorType === "player" ? playerName : text(item?.authorName || item?.charName || item?.name) || nameOf(item?.charId || item?.authorId) || unknownName);
  const posts = asArray(state?.posts).filter(isRecord).map((post) => ({
    id: String(post.id ?? timeOf(post)),
    author: authorOf(post),
    content: stripInternalBlocks(post.content || post.text),
    time: timeOf(post),
    image: imageSrcOf(post.image),
    likes: Number(post.likes) || 0,
    comments: asArray(post.comments).filter(isRecord).map((comment) => ({ author: authorOf(comment), content: stripInternalBlocks(comment.content || comment.text) })),
  })).sort((a, b) => b.time - a.time);

  const PROFILE_FIELDS = ["description", "desc", "personality", "scenario", "profile", "bio", "intro"];
  const contacts = characters.map((character) => ({
    id: String(character.id),
    name: text(character.name) || unknownName,
    avatar: imageSrcOf(character.avatar),
    status: text(character.statusText),
    profile: PROFILE_FIELDS.map((field) => text(character[field]).trim()).filter(Boolean)[0] || "",
  }));

  const notes = asArray(featureData.notes).filter(isRecord).map((note, index) => ({
    id: String(note.id ?? index),
    title: text(note.title) || tr("（無標題）", "(Untitled)", "（無題）", "(제목 없음)"),
    content: text(note.content),
    time: timeOf(note),
  })).sort((a, b) => b.time - a.time);

  const lorebooks = asArray(state?.lorebooks).filter(isRecord).map((book, index) => ({
    id: String(book.id ?? index),
    name: text(book.name || book.title) || tr("世界書", "Lorebook", "ワールドブック", "월드북"),
    entries: asArray(book.entries).filter(isRecord).map((entry) => ({
      title: text(entry.title || entry.name) || asArray(entry.keys).join("、"),
      keys: asArray(entry.keys).map(text).filter(Boolean),
      content: text(entry.content),
    })),
  }));

  const memoryMap = isRecord(state?.memories) ? state.memories : {};
  const memories = Object.entries(memoryMap).map(([id, list]) => ({
    id,
    name: nameOf(id) || unknownName,
    avatar: avatarOf(id),
    items: asArray(list).map((memory) => (isRecord(memory) ? { text: text(memory.text || memory.content), time: timeOf(memory), archived: !!memory.archived || !!memory.archivedAt } : { text: text(memory), time: 0, archived: false })).filter((memory) => memory.text),
  })).filter((entry) => entry.items.length);

  const wallet = isRecord(state?.wallet) ? {
    balance: Number(state.wallet.balance) || 0,
    transactions: asArray(state.wallet.transactions).filter(isRecord).map((item) => ({
      amount: Number(item.amount) || 0,
      label: text(item.note || item.description || item.title || item.label || item.type),
      time: timeOf(item),
    })).sort((a, b) => b.time - a.time),
  } : null;

  const calendarEvents = asArray(featureData.calendar?.events).filter(isRecord).map((event) => ({
    title: text(event.title || event.name) || tr("（無標題）", "(Untitled)", "（無題）", "(제목 없음)"),
    when: text(event.date || event.startDate || event.start || event.day),
    time: text(event.time || event.startTime),
    note: text(event.note || event.description),
    with: nameOf(event.characterId || event.charId),
  })).sort((a, b) => (a.when < b.when ? 1 : -1));

  const yunyinSave = isRecord(featureData.yunyinSave) ? featureData.yunyinSave : null;
  const yunyin = yunyinSave ? {
    coins: Number(yunyinSave.coins) || 0,
    realm: Number(yunyinSave.cultivation?.realmIdx) || 0,
    planted: asArray(yunyinSave.farm?.plots).filter((plot) => plot?.cropId).length,
    plots: asArray(yunyinSave.farm?.plots).length,
    items: Object.values(isRecord(yunyinSave.inventory) ? yunyinSave.inventory : {}).reduce((sum, count) => sum + (Number(count) || 0), 0),
    createdAt: Number(yunyinSave.createdAt) || 0,
    lastSeenAt: Number(yunyinSave.lastSeenAt) || 0,
  } : null;

  return { playerName, chats, groups, posts, contacts, notes, lorebooks, memories, wallet, calendarEvents, yunyin };
}

export function messagePreview(message, tr) {
  if (!message) return "";
  if (message.pseudoImage) return tr("[圖片]", "[Image]", "[画像]", "[이미지]");
  if (message.pseudoVoice) return tr("[語音]", "[Voice]", "[音声]", "[음성]");
  if (message.image && !text(message.content).trim()) return tr("[圖片]", "[Image]", "[画像]", "[이미지]");
  return stripInternalBlocks(message.content).replace(/\s+/g, " ").slice(0, 60);
}

export function messageBody(message, tr) {
  const parts = [];
  const pseudoImage = isRecord(message?.pseudoImage) ? message.pseudoImage.description || message.pseudoImage.caption || message.pseudoImage.text : message?.pseudoImage;
  if (pseudoImage) parts.push(`${tr("[圖片]", "[Image]", "[画像]", "[이미지]")} ${text(pseudoImage)}`);
  const pseudoVoice = isRecord(message?.pseudoVoice) ? message.pseudoVoice.text || message.pseudoVoice.transcript : message?.pseudoVoice;
  if (pseudoVoice) parts.push(`${tr("[語音]", "[Voice]", "[音声]", "[음성]")} ${text(pseudoVoice)}`);
  if (message?.amount != null && /transfer/i.test(text(message.type || message.role))) parts.push(`${tr("[轉帳]", "[Transfer]", "[送金]", "[송금]")} $${Number(message.amount) || 0}`);
  const content = stripInternalBlocks(message?.content);
  if (content) parts.push(content);
  return parts.join("\n");
}

export const messageTime = timeOf;
