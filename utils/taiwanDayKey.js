// 台灣時間每日 05:00 換日；00:00–04:59 仍計入前一天。
export function taiwanDayKey(now = Date.now()) {
  const shifted = new Date(now - 5 * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(shifted);
  const get = (type) => parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
