// 極簡 ICS (RFC 5545) 解析：只取 VEVENT 的標題／日期／時間／備註。
// RRULE 重複事件 v1 只匯入第一次發生日並標記 recurring，之後再擴充展開。

const unescapeText = (value) => String(value || "").replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1").trim();

export function parseIcs(text) {
  const lines = String(text || "").replace(/\r/g, "").split("\n");
  // RFC 5545 行摺疊：接續行以空白開頭，需併回上一行
  const unfolded = [];
  for (const line of lines) {
    if (/^[ \t]/.test(line) && unfolded.length) unfolded[unfolded.length - 1] += line.slice(1);
    else unfolded.push(line);
  }
  const events = [];
  let current = null;
  for (const line of unfolded) {
    if (line.startsWith("BEGIN:VEVENT")) { current = {}; continue; }
    if (line.startsWith("END:VEVENT")) {
      if (current?.date && current.title) events.push(current);
      current = null;
      continue;
    }
    if (!current) continue;
    const sep = line.indexOf(":");
    if (sep < 0) continue;
    const key = line.slice(0, sep).split(";")[0].toUpperCase();
    const value = line.slice(sep + 1).trim();
    if (key === "SUMMARY") current.title = unescapeText(value).slice(0, 80);
    else if (key === "DESCRIPTION" && !current.note) current.note = unescapeText(value).slice(0, 140);
    else if (key === "DTSTART") {
      const match = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/);
      if (match) {
        current.date = `${match[1]}-${match[2]}-${match[3]}`;
        if (match[4]) current.time = `${match[4]}:${match[5]}`;
      }
    } else if (key === "RRULE") current.recurring = true;
  }
  return events;
}
