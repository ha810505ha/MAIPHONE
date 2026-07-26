const pad = (value) => String(value).padStart(2, "0");
const dayKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const normalize = (value) => String(value || "")
  .toLowerCase()
  .replace(/[，。！？、,.!?\s:：;；\-_/]+/g, "");

const DATE_WORDS = /今天|今日|今晚|今早|明天|明日|後天|这周|這週|本週|周末|週末|下週|星期|禮拜|幾點|几点|行程|日曆|日历|有空|忙不忙|安排|約會|预约|預約|考試|上班|看醫生|看牙|today|tomorrow|weekend|schedule|calendar|appointment/i;

function eventMatchesQuery(event, query) {
  if (DATE_WORDS.test(query)) return true;
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return false;
  const title = normalize(event?.title);
  if (title.length >= 2 && (normalizedQuery.includes(title) || title.includes(normalizedQuery))) return true;
  return Array.from({ length: Math.max(0, title.length - 1) }, (_, index) => title.slice(index, index + 2))
    .some((token) => normalizedQuery.includes(token));
}

function relativeDateLabel(date, today) {
  const difference = Math.round((date.getTime() - today.getTime()) / 86400000);
  if (difference === 0) return "今天";
  if (difference === 1) return "明天";
  if (difference === 2) return "後天";
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export function buildCalendarPromptContext(events, query, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(today);
  end.setDate(end.getDate() + 3);
  const startKey = dayKey(today);
  const endKey = dayKey(end);
  const upcoming = (Array.isArray(events) ? events : [])
    .filter((event) => event?.visibleToChar === true && event.date >= startKey && event.date <= endKey && event.title)
    .sort((a, b) => `${a.date}T${a.time || "99:99"}`.localeCompare(`${b.date}T${b.time || "99:99"}`))
    .slice(0, 3);
  if (!upcoming.length) return "";

  const lines = upcoming.map((event) => {
    const [year, month, day] = event.date.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    const relevant = eventMatchesQuery(event, query);
    const note = relevant && event.note ? `；備註：${String(event.note).trim().slice(0, 80)}` : "";
    return `- ${relativeDateLabel(date, today)}${event.time ? ` ${event.time}` : ""}｜${String(event.title).trim().slice(0, 60)}${note}`;
  });

  return [
    "[玩家近期可見行程]",
    ...lines,
    "使用規則：這些只是背景資訊。僅在目前話題、日期或情境自然相關時使用；不要主動逐項報告、不要反覆提醒，也不要透露正在讀取日曆。",
  ].join("\n");
}

const REMINDER_STORAGE_KEY = "calendar-character-reminders-v1";
const REMINDER_EARLY_MS = 30 * 60 * 1000;
const REMINDER_LATE_MS = 30 * 60 * 1000;

function readReminderHistory(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem(REMINDER_STORAGE_KEY) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeReminderHistory(storage, history, now) {
  const cutoff = now.getTime() - 14 * 86400000;
  const pruned = Object.fromEntries(
    Object.entries(history).filter(([, remindedAt]) => Number(remindedAt) >= cutoff)
  );
  try {
    storage?.setItem(REMINDER_STORAGE_KEY, JSON.stringify(pruned));
  } catch {
    // Storage may be unavailable in privacy mode; the reminder can still be generated.
  }
}

export function takeCalendarChatReminder(events, now = new Date(), storage = globalThis?.localStorage) {
  const history = readReminderHistory(storage);
  const candidates = (Array.isArray(events) ? events : [])
    .filter((event) => (
      event?.visibleToChar === true &&
      event?.characterReminderEnabled === true &&
      event?.id &&
      event?.title &&
      /^\d{4}-\d{2}-\d{2}$/.test(event.date || "") &&
      /^\d{2}:\d{2}$/.test(event.time || "") &&
      !history[event.id]
    ))
    .map((event) => {
      const startsAt = new Date(`${event.date}T${event.time}:00`);
      return { event, startsAt, distance: startsAt.getTime() - now.getTime() };
    })
    .filter(({ startsAt, distance }) => (
      !Number.isNaN(startsAt.getTime()) &&
      distance <= REMINDER_EARLY_MS &&
      distance >= -REMINDER_LATE_MS
    ))
    .sort((a, b) => Math.abs(a.distance) - Math.abs(b.distance));

  const picked = candidates[0];
  if (!picked) return "";

  history[picked.event.id] = now.getTime();
  writeReminderHistory(storage, history, now);

  const minutes = Math.round(picked.distance / 60000);
  const timing = minutes > 1
    ? `大約 ${minutes} 分鐘後`
    : minutes >= 0
      ? "快要開始了"
      : `大約 ${Math.abs(minutes)} 分鐘前已開始`;
  const note = String(picked.event.note || "").trim().slice(0, 80);

  return [
    "[自然關心契機]",
    `玩家有一件已允許你知道的事情：${String(picked.event.title).trim().slice(0, 60)}（${timing}）`,
    note ? `可用背景：${note}` : "",
    "若符合此刻對話氣氛，請像熟悉玩家的人一樣自然地順帶關心一句；不要像助理播報行程，不要條列時間，不要說你讀了日曆。若話題或情緒明顯不適合，這次可以完全不提。",
  ].filter(Boolean).join("\n");
}
