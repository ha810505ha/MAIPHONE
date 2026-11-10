// 情侶空間：紀念日、約定、溫度解鎖的純函式（不碰儲存、不碰 UI），方便測試。
// 資料都放在 ent_coupleDaily 的頂層欄位，依角色分開：
//   _promises[charId]      約定清單 [{ id, text, date, source, createdAt, done, doneAt, sourceMessageId }]
//   _anniversaries[charId] 玩家自訂紀念日 [{ id, title, date: "YYYY-MM-DD", yearly }]
//   _peakTemp[charId]      曾經到過的最高溫度（解鎖用，降溫也不會收回）
//   _nicknames[charId]     85° 解鎖的專屬暱稱
// 每日的籤與小互動放在 store[charId]，每天會重建，所以長期資料不能放那裡。

const DAY = 86400000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PROMISE_PATTERN = /\[\[COUPLE_PROMISE:([\s\S]*?)\]\]/gi;
// 進行中最多 20 個（滿了要先完成或刪除）；已完成只保留最近 50 個，更舊的自動刪掉。
export const COUPLE_OPEN_PROMISE_LIMIT = 20;
export const COUPLE_DONE_PROMISE_LIMIT = 50;
export const COUPLE_ANNIVERSARY_LIMIT = 20;
export const COUPLE_DAY_MILESTONES = [50, 100, 200, 300, 500, 1000];
export const COUPLE_UNLOCKS = [
  { id: "goldenMoon", temperature: 70 },
  { id: "nickname", temperature: 85 },
  { id: "avatarFrame", temperature: 100 },
];

const cleanText = (value, limit) => String(value || "").replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
const pad = (value) => String(value).padStart(2, "0");

export const startOfDay = (time) => { const date = new Date(time); date.setHours(0, 0, 0, 0); return date.getTime(); };
export const toDateKey = (time) => { const date = new Date(time); return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; };
export const isValidDateKey = (value) => {
  if (!DATE_PATTERN.test(String(value || ""))) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
};
export const fromDateKey = (value) => { const [year, month, day] = value.split("-").map(Number); return new Date(year, month - 1, day).getTime(); };
// 第一天算第 1 天，以日曆日計算（跨過午夜就 +1）。
export const daysTogether = (firstTime, now = Date.now()) => (firstTime ? Math.floor((startOfDay(now) - startOfDay(firstTime)) / DAY) + 1 : 0);
export const daysUntil = (time, now = Date.now()) => Math.round((startOfDay(time) - startOfDay(now)) / DAY);
const sameMonthDay = (origin, year) => {
  const date = new Date(origin);
  const next = new Date(year, date.getMonth(), date.getDate());
  // 2/29 在非閏年改成 2/28
  if (next.getMonth() !== date.getMonth()) next.setDate(0);
  return next.getTime();
};

// labels 由呼叫端提供翻譯：firstChat()、spaceOpen()、day(n)、chatYears(n)、spaceYears(n)
export function buildCoupleAnniversaries({ firstChatAt, acceptedAt, custom = [], now = Date.now(), labels }) {
  const today = startOfDay(now);
  const past = [];
  const future = [];
  const push = (item) => { (item.time < today ? past : future).push({ ...item, daysLeft: daysUntil(item.time, now), isToday: item.time === today }); };
  if (firstChatAt) {
    const first = startOfDay(firstChatAt);
    push({ key: "first-chat", kind: "auto", title: labels.firstChat(), time: first, origin: true });
    COUPLE_DAY_MILESTONES.forEach((count) => push({ key: `day-${count}`, kind: "auto", title: labels.day(count), time: first + (count - 1) * DAY }));
    const firstYear = new Date(first).getFullYear();
    const years = new Date(today).getFullYear() - firstYear + 1;
    for (let year = 1; year <= years; year++) push({ key: `chat-year-${year}`, kind: "auto", title: labels.chatYears(year), time: sameMonthDay(first, firstYear + year) });
  }
  if (acceptedAt) {
    const opened = startOfDay(acceptedAt);
    // 開通日和第一次聊天同一天時只顯示一次
    if (!firstChatAt || opened !== startOfDay(firstChatAt)) push({ key: "space-open", kind: "auto", title: labels.spaceOpen(), time: opened, origin: true });
    const openYear = new Date(opened).getFullYear();
    const years = new Date(today).getFullYear() - openYear + 1;
    for (let year = 1; year <= years; year++) push({ key: `space-year-${year}`, kind: "auto", title: labels.spaceYears(year), time: sameMonthDay(opened, openYear + year) });
  }
  (Array.isArray(custom) ? custom : []).forEach((item) => {
    if (!item?.id || !isValidDateKey(item.date)) return;
    const origin = fromDateKey(item.date);
    push({ key: `custom-${item.id}`, kind: "custom", id: item.id, title: cleanText(item.title, 40), time: origin, origin: true, yearly: !!item.yearly });
    if (!item.yearly) return;
    const originYear = new Date(origin).getFullYear();
    const thisYear = sameMonthDay(origin, new Date(today).getFullYear());
    const next = thisYear >= today ? thisYear : sameMonthDay(origin, new Date(today).getFullYear() + 1);
    if (next > origin) push({ key: `custom-${item.id}-${new Date(next).getFullYear()}`, kind: "custom", id: item.id, title: cleanText(item.title, 40), time: next, years: new Date(next).getFullYear() - originYear, yearly: true });
  });
  past.sort((a, b) => b.time - a.time);
  future.sort((a, b) => a.time - b.time);
  // 已過去的週年／天數里程碑只留真的到過的（未來的不會出現在 past）。
  return { past, upcoming: future, today: future.filter((item) => item.isToday), next: future[0] || null };
}

export function extractCouplePromiseDirective(text) {
  const source = String(text || "");
  let proposal = null;
  const stripped = source.replace(PROMISE_PATTERN, (match, body) => {
    if (!proposal) proposal = parsePromiseBody(body);
    return "";
  });
  return { text: stripped.replace(/\n{3,}/g, "\n\n").trim(), proposal };
}

function parsePromiseBody(body) {
  const fields = {};
  const raw = String(body || "");
  // text 可能自己含分號，所以先把 date= 切出來，其餘都算 text。
  const dateMatch = raw.match(/;\s*date\s*=\s*([^;\]]*)\s*$/i);
  const head = dateMatch ? raw.slice(0, dateMatch.index) : raw;
  fields.text = head.replace(/^\s*text\s*=/i, "");
  fields.date = dateMatch ? dateMatch[1].trim() : "";
  return normalizeCouplePromise(fields);
}

export function normalizeCouplePromise(proposal) {
  if (!proposal || typeof proposal !== "object") return null;
  const text = cleanText(proposal.text, 60);
  if (!text) return null;
  const date = isValidDateKey(proposal.date) ? proposal.date : "";
  return { text, date };
}

const comparable = (value) => cleanText(value, 60).toLocaleLowerCase().replace(/[\p{P}\p{S}\s]/gu, "");
const bigrams = (value) => (value.length < 2 ? (value ? [value] : []) : Array.from({ length: value.length - 1 }, (_, index) => value.slice(index, index + 2)));
export function arePromisesSimilar(left, right) {
  const a = comparable(left);
  const b = comparable(right);
  if (!a || !b) return false;
  if (a === b) return true;
  if (Math.min(a.length, b.length) >= 4 && (a.includes(b) || b.includes(a))) return true;
  const remaining = [...bigrams(b)];
  let overlap = 0;
  for (const pair of bigrams(a)) {
    const index = remaining.indexOf(pair);
    if (index < 0) continue;
    overlap += 1;
    remaining.splice(index, 1);
  }
  return (2 * overlap) / (bigrams(a).length + bigrams(b).length) >= 0.58;
}

export const getCouplePromises = (store, charId) => (Array.isArray(store?._promises?.[charId]) ? store._promises[charId] : []);
export const findOpenPromiseDuplicate = (store, charId, text) => getCouplePromises(store, charId).find((item) => !item.done && arePromisesSimilar(item.text, text)) || null;

const withPromises = (store, charId, list) => ({ ...store, _promises: { ...(store?._promises || {}), [charId]: list } });

export function addCouplePromise(store, charId, input, { now = Date.now(), createId } = {}) {
  const normalized = normalizeCouplePromise(input);
  if (!normalized || !charId) return { store, status: "invalid" };
  const duplicate = findOpenPromiseDuplicate(store, charId, normalized.text);
  if (duplicate) return { store, status: "duplicate", promise: duplicate };
  if (getCouplePromises(store, charId).filter((item) => !item.done).length >= COUPLE_OPEN_PROMISE_LIMIT) return { store, status: "full" };
  const promise = {
    id: createId ? createId() : `promise_${now}_${Math.random().toString(36).slice(2, 7)}`,
    ...normalized,
    source: input.source === "chat" ? "chat" : "manual",
    createdAt: now,
    done: false,
    doneAt: null,
    ...(input.sourceMessageId ? { sourceMessageId: String(input.sourceMessageId) } : {}),
  };
  return { store: withPromises(store, charId, [promise, ...getCouplePromises(store, charId)]), status: "added", promise };
}

// 已完成超過上限時，刪掉最早完成的。
const trimDonePromises = (list) => {
  const done = list.filter((item) => item.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  if (done.length <= COUPLE_DONE_PROMISE_LIMIT) return list;
  const drop = new Set(done.slice(COUPLE_DONE_PROMISE_LIMIT).map((item) => item.id));
  return list.filter((item) => !drop.has(item.id));
};
export const completeCouplePromise = (store, charId, promiseId, now = Date.now()) => withPromises(store, charId, trimDonePromises(getCouplePromises(store, charId).map((item) => (item.id === promiseId && !item.done ? { ...item, done: true, doneAt: now } : item))));
export const reopenCouplePromise = (store, charId, promiseId) => withPromises(store, charId, getCouplePromises(store, charId).map((item) => (item.id === promiseId ? { ...item, done: false, doneAt: null } : item)));
export const removeCouplePromise = (store, charId, promiseId) => withPromises(store, charId, getCouplePromises(store, charId).filter((item) => item.id !== promiseId));

// 進行中：有日期的依日期排、沒日期的放後面；已完成：最近完成的在前。
export function splitCouplePromises(list) {
  const open = list.filter((item) => !item.done).sort((a, b) => {
    if (a.date && b.date) return a.date.localeCompare(b.date);
    if (a.date) return -1;
    if (b.date) return 1;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
  const done = list.filter((item) => item.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  return { open, done };
}

export const getCoupleAnniversaries = (store, charId) => (Array.isArray(store?._anniversaries?.[charId]) ? store._anniversaries[charId] : []);
export function addCoupleAnniversary(store, charId, input, { now = Date.now() } = {}) {
  const title = cleanText(input?.title, 40);
  if (!charId || !title || !isValidDateKey(input?.date)) return { store, status: "invalid" };
  const list = getCoupleAnniversaries(store, charId);
  if (list.length >= COUPLE_ANNIVERSARY_LIMIT) return { store, status: "full" };
  const item = { id: `anniv_${now}_${Math.random().toString(36).slice(2, 7)}`, title, date: input.date, yearly: input.yearly !== false };
  return { store: { ...store, _anniversaries: { ...(store?._anniversaries || {}), [charId]: [...list, item] } }, status: "added", item };
}
export const removeCoupleAnniversary = (store, charId, id) => ({ ...store, _anniversaries: { ...(store?._anniversaries || {}), [charId]: getCoupleAnniversaries(store, charId).filter((item) => item.id !== id) } });

export const getCouplePeakTemperature = (store, charId, current = 0) => Math.max(Number(store?._peakTemp?.[charId]) || 0, Number(current) || 0);
export const withCouplePeakTemperature = (store, charId, temperature) => {
  const peak = getCouplePeakTemperature(store, charId, temperature);
  return peak === (Number(store?._peakTemp?.[charId]) || 0) ? store : { ...store, _peakTemp: { ...(store?._peakTemp || {}), [charId]: peak } };
};
export const isCoupleUnlocked = (peak, unlockId) => {
  const unlock = COUPLE_UNLOCKS.find((item) => item.id === unlockId);
  return !!unlock && peak >= unlock.temperature;
};
export const getCoupleNickname = (store, charId) => cleanText(store?._nicknames?.[charId], 20);
export const withCoupleNickname = (store, charId, nickname) => ({ ...store, _nicknames: { ...(store?._nicknames || {}), [charId]: cleanText(nickname, 20) } });

// 聊天用的約定摘要（只給角色看，中文即可）。
export function describeOpenPromisesForChat(list, now = Date.now()) {
  return splitCouplePromises(list).open.slice(0, 8).map((item) => {
    if (!item.date) return `- ${item.text}`;
    const left = daysUntil(fromDateKey(item.date), now);
    const when = left === 0 ? "今天" : left < 0 ? `已過約定日 ${-left} 天` : `${item.date}（${left} 天後）`;
    return `- ${item.text}（${when}）`;
  });
}

// 時間軸：紀念日（已過去）、完成的約定、特別記憶，依月份分組，新的在前。
export function buildCoupleTimeline({ anniversaries, promises = [], specialMemories = [] }) {
  const items = [
    ...anniversaries.past.map((item) => ({ key: `a-${item.key}`, type: "anniversary", time: item.time, title: item.title, kind: item.kind })),
    ...promises.filter((item) => item.done && item.doneAt).map((item) => ({ key: `p-${item.id}`, type: "promise", time: item.doneAt, title: item.text })),
    ...specialMemories.filter((item) => item?.createdAt).map((item) => ({ key: `m-${item.id}`, type: "special", time: item.createdAt, title: item.title, rarity: item.itemRarity, memory: item })),
  ].sort((a, b) => b.time - a.time);
  const months = [];
  items.forEach((item) => {
    const date = new Date(item.time);
    const key = `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
    let group = months[months.length - 1];
    if (!group || group.key !== key) { group = { key, year: date.getFullYear(), month: date.getMonth() + 1, items: [] }; months.push(group); }
    group.items.push(item);
  });
  return months;
}
