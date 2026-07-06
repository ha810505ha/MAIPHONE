// 角色手機 AI App：預設主題、驗證工具、各 App prompt 與資料淨化
import { gid, sanitizeText } from "./coreUtils";

export const DEFAULT_PHONE_THEME = {
  themeName: "預設",
  mode: "light",
  wallpaper: { from: "#ffd2e6", via: "#ecdcf2", to: "#d1ecff", angle: 180 },
  accent: "#e91e63",
  text: "#29485d",
  textSub: "#5f7f93",
  card: "rgba(255,255,255,.62)",
  cardBorder: "rgba(255,255,255,.8)",
  status: "",
  music: null,
  todos: [],
  fakeApps: [{ icon: "🖼️", name: "相簿" }, { icon: "🎧", name: "音樂" }],
};

export const isHex6 = (s) => typeof s === "string" && /^#[0-9a-fA-F]{6}$/.test(s.trim());
const isCssColor = (s) => typeof s === "string" && (
  isHex6(s) || /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\)$/.test(s.trim())
);

const hexToRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
export const mixHex = (a, b) => {
  const [r1, g1, b1] = hexToRgb(a); const [r2, g2, b2] = hexToRgb(b);
  const h = (x) => Math.round(x).toString(16).padStart(2, "0");
  return `#${h((r1 + r2) / 2)}${h((g1 + g2) / 2)}${h((b1 + b2) / 2)}`;
};
const relLuminance = (hex) => {
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const contrastRatio = (hexA, hexB) => {
  const [l1, l2] = [relLuminance(hexA), relLuminance(hexB)].sort((a, b) => b - a);
  return (l1 + 0.05) / (l2 + 0.05);
};

// 逐欄驗證 + 對比防呆。任何欄位壞掉都退回預設，不會整包作廢。
export const sanitizePhoneTheme = (raw) => {
  const d = DEFAULT_PHONE_THEME;
  const t = raw && typeof raw === "object" ? raw : {};
  const wp = t.wallpaper && typeof t.wallpaper === "object" ? t.wallpaper : {};
  const theme = {
    themeName: sanitizeText(t.themeName || d.themeName, 12),
    mode: t.mode === "dark" ? "dark" : "light",
    wallpaper: {
      from: isHex6(wp.from) ? wp.from : d.wallpaper.from,
      via: isHex6(wp.via) ? wp.via : (isHex6(wp.from) && isHex6(wp.to) ? mixHex(wp.from, wp.to) : d.wallpaper.via),
      to: isHex6(wp.to) ? wp.to : d.wallpaper.to,
      angle: Number.isFinite(+wp.angle) ? Math.max(0, Math.min(360, +wp.angle)) : d.wallpaper.angle,
    },
    accent: isHex6(t.accent) ? t.accent : d.accent,
    text: isHex6(t.text) ? t.text : d.text,
    textSub: isHex6(t.textSub) ? t.textSub : d.textSub,
    card: isCssColor(t.card) ? t.card : (t.mode === "dark" ? "rgba(255,255,255,.07)" : d.card),
    cardBorder: isCssColor(t.cardBorder) ? t.cardBorder : (t.mode === "dark" ? "rgba(255,255,255,.1)" : d.cardBorder),
    status: sanitizeText(t.status || "", 30),
    music: t.music && typeof t.music === "object"
      ? { title: sanitizeText(t.music.title || "", 24), artist: sanitizeText(t.music.artist || "", 20) }
      : null,
    todos: (Array.isArray(t.todos) ? t.todos : []).slice(0, 6).map((x) => ({
      text: sanitizeText(x?.text || "", 16), done: !!x?.done,
    })).filter((x) => x.text),
    fakeApps: (Array.isArray(t.fakeApps) ? t.fakeApps : d.fakeApps).slice(0, 4).map((a) => ({
      icon: sanitizeText(a?.icon || "📦", 4), name: sanitizeText(a?.name || "", 6),
    })).filter((a) => a.name),
  };
  // 對比檢查：text / textSub 對桌布中間色 < 4.5:1 → 依桌布深淺強制黑/白
  const wallMid = theme.wallpaper.via;
  const dark = relLuminance(wallMid) < 0.4;
  if (contrastRatio(theme.text, wallMid) < 4.5) theme.text = dark ? "#F2F2F5" : "#22262E";
  if (contrastRatio(theme.textSub, wallMid) < 3) theme.textSub = dark ? "#A9AFBD" : "#5C6673";
  return theme;
};

export const phoneWallpaperCss = (th) =>
  `linear-gradient(${th.wallpaper.angle}deg, ${th.wallpaper.from} 0%, ${th.wallpaper.via} 50%, ${th.wallpaper.to} 100%)`;

export const PHONE_APP_META = {
  theme:   { name: "主題",  icon: "🎨" },
  gallery: { name: "相簿",  icon: "🖼️" },
  music:   { name: "音樂",  icon: "🎧" },
  map:     { name: "地圖",  icon: "🗺️" },
  shop:    { name: "商店",  icon: "🛍️" },
  diary:   { name: "日記",  icon: "📔" },
  browser: { name: "瀏覽器", icon: "🧭" },
  usage:   { name: "使用紀錄", icon: "⏱️" },
};

// 共用上下文（角色資料 + 最近 10 句對話）
export const buildPhonePromptContext = (char, chatHistory) => {
  const recent = ((chatHistory || {})[char.id] || []).slice(-10)
    .map((m) => `${m.role === "user" ? "{{user}}" : char.name}: ${m.content || "[圖片]"}`).join("\n");
  const roleProfile = [char.description, char.personality, char.scenario].filter(Boolean).join("\n");
  return `角色：${char.name}\n角色設定：\n${roleProfile || "（無）"}\n\n最近對話（只供參考語氣與近況，不要複述）：\n${recent || "（尚無）"}`;
};

// G = 輸出語言指令；ctx = buildPhonePromptContext 結果
export const buildPhoneAppPrompt = (appId, G, ctx, extra = {}) => {
  if (appId === "theme") return `${G}

請為角色生成手機主題 JSON，輸出 JSON 且只能輸出 JSON。
格式：
{"themeName":"2~6字","mode":"light或dark","wallpaper":{"from":"#RRGGBB","via":"#RRGGBB","to":"#RRGGBB","angle":170},"accent":"#RRGGBB","text":"#RRGGBB","textSub":"#RRGGBB","card":"rgba(255,255,255,.07)","cardBorder":"rgba(255,255,255,.1)","status":"20字內","music":{"title":"歌名","artist":"演出者"},"todos":[{"text":"14字內","done":false}],"fakeApps":[{"icon":"emoji","name":"2字"}]}
規則：
1) mode 依角色氣質選 light 或 dark。
2) wallpaper 三色同色系和諧漸層；text 要在桌布上清楚可讀；accent 對比明顯。
3) status 像真的手機狀態，口語、對外可見，不要內心獨白。
4) music 是角色此刻會聽的歌，可虛構。
5) todos 2~6 項符合人設與近期劇情；每項依角色當下情況自然決定 done，可以全部完成、全部未完成或完成與未完成混合。不同次生成的完成比例要有變化，不要固定只有一項完成，也不要寫死任一方至少一項。
6) fakeApps 2~4 個，符合角色生活。

${ctx}`;
  if (appId === "gallery") return `${G}

請生成角色相簿 JSON，輸出 JSON 且只能輸出 JSON。
格式：{"photos":[{"caption":"12字內","tone":"#RRGGBB","time":"HH:MM"}]}
規則：4~6 張；caption 像角色隨手拍的日常，可以留懸念；tone 是照片主色調（${extra.mode === "dark" ? "偏深色" : "偏淺色"}）；不要 markdown、不要多餘欄位。

${ctx}`;
  if (appId === "music") return `${G}

請生成角色音樂 App JSON，輸出 JSON 且只能輸出 JSON。
格式：{"nowPlaying":{"title":"歌名","artist":"演出者","progress":0.38},"playlist":[{"title":"歌名","artist":"演出者","length":"3:47"}]}
規則：playlist 4~6 首，歌名可虛構，整體風格符合角色氣質；progress 0~1；不要 markdown。

${ctx}`;
  if (appId === "map") return `${G}

請生成角色常去地點 JSON，輸出 JSON 且只能輸出 JSON。
格式：{"places":[{"emoji":"🏪","name":"10字內","note":"12字內"}]}
規則：3~5 個；note 透露生活習慣但不破壞懸念；不要 markdown。

${ctx}`;
  if (appId === "shop") return `${G}

請生成角色網購紀錄 JSON，輸出 JSON 且只能輸出 JSON。
格式：{"orders":[{"emoji":"☕","item":"14字內","price":420,"status":"delivered或shipping","date":"MM/DD"}]}
規則：3~5 筆；品項符合人設與近期劇情；價格為正整數，全部訂單總額不得超過角色目前餘額 $${extra.balance ?? "（未知，控制在數千內）"}；不要 markdown。

${ctx}`;
  if (appId === "diary") return `${G}

請以角色第一人稱寫一篇日記，輸出 JSON 且只能輸出 JSON。
格式：{"title":"7月6日 週一 晴","body":"日記內文，120~200字，可用\\n\\n分段"}
規則：口吻完全符合角色；寫日常細節與真實情緒，可呼應最近對話但不要直接複述；不要 markdown。
${extra.prevTitles?.length ? `已寫過的日記標題（避免重複內容）：${extra.prevTitles.join("、")}` : ""}

${ctx}`;
  if (appId === "browser") return `${G}

請生成角色瀏覽器搜尋紀錄 JSON，輸出 JSON 且只能輸出 JSON。
格式：{"searches":[{"query":"搜尋詞 16字內","time":"23:42 或 昨天"}]}
規則：5~7 條；混合日常生活與洩露人設的搜尋，像真人隨手搜的口語短詞；不要 markdown。

${ctx}`;
  if (appId === "usage") return `${G}

請生成角色手機使用紀錄 JSON，輸出 JSON 且只能輸出 JSON。
格式：{"totalMinutes":72,"hourly":[24個0~10的整數，代表每小時相對使用量],"summary":"20字內作息描述","apps":[{"icon":"🗺️","name":"地圖","minutes":31}]}
規則：hourly 分布要符合角色作息（夜行/早起/上班族…）；apps 3~4 個，minutes 總和≈totalMinutes；不要 markdown。

${ctx}`;
  return "";
};

// prevData 只有日記用（追加式）；其他 App 忽略
export const sanitizePhoneAppData = (appId, parsed, prevData) => {
  if (appId === "theme") return sanitizePhoneTheme(parsed);
  if (appId === "gallery") {
    const photos = (Array.isArray(parsed?.photos) ? parsed.photos : []).slice(0, 6).map((p) => ({
      caption: sanitizeText(p?.caption || "", 14),
      tone: isHex6(p?.tone) ? p.tone : "#8a93a5",
      time: /^\d{1,2}:\d{2}$/.test(p?.time || "") ? p.time : "--:--",
    })).filter((p) => p.caption);
    return photos.length ? { photos } : null;
  }
  if (appId === "music") {
    const song = (s) => ({ title: sanitizeText(s?.title || "", 24), artist: sanitizeText(s?.artist || "", 20), length: /^\d{1,2}:\d{2}$/.test(s?.length || "") ? s.length : "" });
    const nowPlaying = parsed?.nowPlaying ? { ...song(parsed.nowPlaying), progress: Math.max(0, Math.min(1, +parsed.nowPlaying.progress || 0)) } : null;
    const playlist = (Array.isArray(parsed?.playlist) ? parsed.playlist : []).slice(0, 6).map(song).filter((s) => s.title);
    return nowPlaying || playlist.length ? { nowPlaying, playlist } : null;
  }
  if (appId === "map") {
    const places = (Array.isArray(parsed?.places) ? parsed.places : []).slice(0, 5).map((p) => ({
      emoji: sanitizeText(p?.emoji || "📍", 4), name: sanitizeText(p?.name || "", 12), note: sanitizeText(p?.note || "", 14),
    })).filter((p) => p.name);
    return places.length ? { places } : null;
  }
  if (appId === "shop") {
    const orders = (Array.isArray(parsed?.orders) ? parsed.orders : []).slice(0, 5).map((o) => ({
      id: gid(),
      emoji: sanitizeText(o?.emoji || "🛍️", 4),
      item: sanitizeText(o?.item || "", 16),
      price: Math.max(1, Math.min(999999, Math.round(+o?.price || 0))),
      status: o?.status === "shipping" ? "shipping" : "delivered",
      date: sanitizeText(o?.date || "", 6),
    })).filter((o) => o.item && o.price > 0);
    return orders.length ? { orders } : null;
  }
  if (appId === "diary") {
    const title = sanitizeText(parsed?.title || "", 20);
    const body = sanitizeText(parsed?.body || "", 400);
    if (!title || !body) return null;
    const prev = Array.isArray(prevData?.entries) ? prevData.entries : [];
    return { entries: [{ id: gid(), title, body, time: Date.now() }, ...prev].slice(0, 5) };
  }
  if (appId === "browser") {
    const searches = (Array.isArray(parsed?.searches) ? parsed.searches : []).slice(0, 7).map((s) => ({
      query: sanitizeText(s?.query || "", 18), time: sanitizeText(s?.time || "", 8),
    })).filter((s) => s.query);
    return searches.length ? { searches } : null;
  }
  if (appId === "usage") {
    const hourlyRaw = Array.isArray(parsed?.hourly) ? parsed.hourly : [];
    const hourly = Array.from({ length: 24 }, (_, i) => Math.max(0, Math.min(10, Math.round(+hourlyRaw[i] || 0))));
    const apps = (Array.isArray(parsed?.apps) ? parsed.apps : []).slice(0, 4).map((a) => ({
      icon: sanitizeText(a?.icon || "📱", 4), name: sanitizeText(a?.name || "", 8),
      minutes: Math.max(1, Math.min(1440, Math.round(+a?.minutes || 0))),
    })).filter((a) => a.name);
    if (!apps.length) return null;
    return {
      totalMinutes: Math.max(1, Math.min(1440, Math.round(+parsed?.totalMinutes || apps.reduce((s, a) => s + a.minutes, 0)))),
      hourly, summary: sanitizeText(parsed?.summary || "", 24), apps,
    };
  }
  return null;
};
