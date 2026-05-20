const gid = () => Math.random().toString(36).substr(2, 9);
const ft = (d) => `${d.getHours().toString().padStart(2,"0")}:${d.getMinutes().toString().padStart(2,"0")}`;
const fd = (d) => {
  const days = ["SUN","MON","TUE","WED","THU","FRI","SAT"];
  const mos = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  return { day: days[d.getDay()], month: mos[d.getMonth()], date: d.getDate() };
};
const ld = (k, fb) => { try { const v = localStorage.getItem(`mali_${k}`); return v ? JSON.parse(v) : fb; } catch { return fb; } };
const sv = (k, v) => { try { localStorage.setItem(`mali_${k}`, JSON.stringify(v)); } catch {} };

const sanitizeText = (value, maxLen = 2000) => {
  if (value === null || value === undefined) return "";
  const s = String(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
  return s.slice(0, maxLen);
};

const sanitizeUserImageUrl = (url) => {
  if (!url || typeof url !== "string") return null;
  const v = url.trim();
  if (/^blob:/i.test(v)) return v;
  if (/^data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(v)) return v;
  try {
    const u = new URL(v);
    const hostOk = /^(localhost|127\.0\.0\.1)$/i.test(u.hostname);
    if ((u.protocol === "https:") || (u.protocol === "http:" && hostOk)) return u.toString();
  } catch {}
  return null;
};

export { gid, ft, fd, ld, sv, sanitizeText, sanitizeUserImageUrl };

