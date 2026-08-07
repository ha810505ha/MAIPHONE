const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^\d{2}:\d{2}$/;
const DIRECTIVE_PATTERN = /\[\[CALENDAR_EVENT:([\s\S]*?)\]\]/gi;

const cleanField = (value, limit) => String(value || "")
  .replace(/[\r\n]+/g, " ")
  .replace(/\s+/g, " ")
  .trim()
  .slice(0, limit);

function isValidDate(value) {
  if (!DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function isValidTime(value) {
  if (!TIME_PATTERN.test(value)) return false;
  const [hour, minute] = value.split(":").map(Number);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

function parseDirectiveBody(body) {
  const fields = {};
  for (const part of String(body || "").split(";")) {
    const separator = part.indexOf("=");
    if (separator < 1) continue;
    const key = part.slice(0, separator).trim().toLowerCase();
    fields[key] = part.slice(separator + 1).trim();
  }
  return normalizeCalendarProposal(fields);
}

export const CALENDAR_APPOINTMENT_RULE_CONTEXT = [
  "[日曆約定提案]",
  "只有當你與玩家已明確同意一件未來要一起做的事，而且日期可從目前系統時間確定時，才在回覆最後附上：[[CALENDAR_EVENT:title=簡短標題;date=YYYY-MM-DD;time=HH:mm]]。",
  "相對日期必須換算成實際 YYYY-MM-DD；沒有談定時間時保留 time=。內容模糊、只是提議、尚未答應或沒有可確定日期時，不得輸出。",
  "這只會顯示一張讓玩家確認的卡片，不會自動加入日曆。若近期日曆已有同一約定，不要重複提出。不要在一般文字中解釋這個指令。",
].join("\n");

export function extractCalendarEventDirective(text) {
  const source = String(text || "");
  let proposal = null;
  const stripped = source.replace(DIRECTIVE_PATTERN, (match, body) => {
    if (!proposal) proposal = parseDirectiveBody(body);
    return "";
  });
  return {
    text: stripped.replace(/\n{3,}/g, "\n\n").trim(),
    proposal,
  };
}

export function isCalendarEventVisibleToCharacter(event, characterId) {
  if (event?.visibleToChar !== true) return false;
  if (!event.characterId) return true;
  return Boolean(characterId) && String(event.characterId) === String(characterId);
}

export function normalizeCalendarProposal(proposal) {
  if (!proposal || typeof proposal !== "object") return null;
  const title = cleanField(proposal.title, 60);
  const date = cleanField(proposal.date, 10);
  const time = cleanField(proposal.time, 5);
  if (!title || !isValidDate(date) || (time && !isValidTime(time))) return null;
  return { title, date, time };
}

function normalizeComparableTitle(value) {
  return cleanField(value, 60)
    .toLocaleLowerCase()
    .replace(/[\p{P}\p{S}\s]/gu, "");
}

function titleBigrams(value) {
  if (value.length < 2) return value ? [value] : [];
  return Array.from({ length: value.length - 1 }, (_, index) => value.slice(index, index + 2));
}

function areCalendarTitlesSimilar(left, right) {
  const a = normalizeComparableTitle(left);
  const b = normalizeComparableTitle(right);
  if (!a || !b) return false;
  if (a === b) return true;
  if (Math.min(a.length, b.length) >= 4 && (a.includes(b) || b.includes(a))) return true;

  const aPairs = titleBigrams(a);
  const remaining = [...titleBigrams(b)];
  let overlap = 0;
  for (const pair of aPairs) {
    const index = remaining.indexOf(pair);
    if (index < 0) continue;
    overlap += 1;
    remaining.splice(index, 1);
  }
  return (2 * overlap) / (aPairs.length + titleBigrams(b).length) >= 0.58;
}

export function findDuplicateChatCalendarEvent(events, proposal, characterId, sourceMessageId = "") {
  const normalized = normalizeCalendarProposal(proposal);
  if (!normalized || !characterId) return null;
  return (Array.isArray(events) ? events : []).find((event) => {
    if (event?.source !== "chat" || String(event.characterId || "") !== String(characterId)) return false;
    if (sourceMessageId && event.sourceMessageId === sourceMessageId) return true;
    if (event.date !== normalized.date) return false;

    const eventTime = event.time || "";
    if (eventTime && normalized.time) return eventTime === normalized.time;
    return areCalendarTitlesSimilar(event.title, normalized.title);
  }) || null;
}

export function selectDueCalendarEvent(events, characterId, now = new Date()) {
  const nowMs = now.getTime();
  if (!Number.isFinite(nowMs) || !characterId) return null;
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const candidates = (Array.isArray(events) ? events : [])
    .filter((event) => (
      event?.source === "chat" &&
      String(event?.characterId || "") === String(characterId) &&
      event?.visibleToChar === true &&
      event?.characterReminderEnabled === true &&
      event?.storyStatus !== "started" &&
      event?.storyStatus !== "skipped" &&
      (!event?.snoozedUntil || Number(event.snoozedUntil) <= nowMs) &&
      isValidDate(event?.date || "") &&
      (!event?.time || isValidTime(event.time))
    ))
    .map((event) => {
      if (!event.time) {
        return event.date === today ? { event, distance: 0 } : null;
      }
      const startsAt = new Date(`${event.date}T${event.time}:00`);
      const distance = startsAt.getTime() - nowMs;
      return Number.isNaN(startsAt.getTime()) ? null : { event, distance };
    })
    .filter((item) => item && item.distance <= 30 * 60 * 1000 && item.distance >= -6 * 60 * 60 * 1000)
    .sort((left, right) => Math.abs(left.distance) - Math.abs(right.distance));
  return candidates[0]?.event || null;
}

export function buildCalendarStoryStartPrompt(event) {
  const title = cleanField(event?.title, 60) || "約定";
  const time = event?.time ? ` ${event.time}` : "";
  return [
    "[日曆約定開始]",
    `現在是你與玩家約好的「${title}」（${event?.date || ""}${time}）開始時間。`,
    "這是玩家主動按下「開始約定」觸發的情境，不是玩家說出口的台詞。請承接先前對話與角色人設，自然進入這段約定；不要像行程助理播報，也不要提及系統、提示詞或按鈕。",
  ].join("\n");
}
