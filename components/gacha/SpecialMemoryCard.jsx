import React, { useState } from "react";
import { useGacha } from "../../contexts/GachaContext";
import { sanitizeUserImageUrl } from "../../utils/coreUtils";
import { generateSpecialMemorySummary } from "../../services/gacha/specialMemoryService";
import { downloadImageFile } from "../../utils/exportFile";
import { translate } from "../../utils/i18n";

const RARITY_THEMES = {
  SSR: { label: "SSR MEMORY", bgTop: "#fff6e3", bgBottom: "#ffdfe9", frame: "#c99a4b", frameSoft: "#e5c78f", accent: "#a2652f", text: "#5c4632", glow: "rgba(255,214,150,.55)" },
  SR: { label: "SR MEMORY", bgTop: "#f4edff", bgBottom: "#ffe7f3", frame: "#8f6cc9", frameSoft: "#c4aee6", accent: "#6d4fa8", text: "#4a3c5e", glow: "rgba(200,170,255,.5)" },
  R: { label: "R MEMORY", bgTop: "#e9f4ff", bgBottom: "#ffeef5", frame: "#6f9cc9", frameSoft: "#aac9e6", accent: "#4a7099", text: "#3d4b5c", glow: "rgba(160,200,240,.5)" },
};
const HAND_FONT = "'LXGW WenKai TC','Noto Serif TC','PMingLiU',serif";
const SCRIPT_FONT = "'Great Vibes',cursive";
const themeOf = (memory) => RARITY_THEMES[memory?.itemRarity] || RARITY_THEMES.R;
const formatMemoryDate = (time, locale = "zh-TW") => new Intl.DateTimeFormat(locale, { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(time || Date.now()));

const roundedRectPath = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

const wrapCanvasText = (ctx, text, maxWidth, maxLines) => {
  const lines = [];
  for (const paragraph of String(text || "").split(/\n+/)) {
    let line = "";
    for (const char of paragraph) {
      if (ctx.measureText(line + char).width > maxWidth && line) { lines.push(line); line = char; } else { line += char; }
      if (lines.length >= maxLines) break;
    }
    if (line && lines.length < maxLines) lines.push(line);
    if (lines.length >= maxLines) break;
  }
  if (lines.length === maxLines) lines[maxLines - 1] = `${lines[maxLines - 1].slice(0, -1)}…`;
  return lines;
};

// 載入頭像並確認不會污染 canvas（污染後 toBlob 會失敗、整張卡都存不下來）。
// 先畫到一張測試小畫布上試 toDataURL，失敗（外部網址無 CORS）就放棄頭像改用字首圓圈。
const loadSafeImage = (src) => new Promise((resolve) => {
  if (!src) return resolve(null);
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    try {
      const probe = document.createElement("canvas");
      probe.width = probe.height = 8;
      probe.getContext("2d").drawImage(img, 0, 0, 8, 8);
      probe.toDataURL();
      resolve(img);
    } catch { resolve(null); }
  };
  img.onerror = () => resolve(null);
  img.src = src;
});

const drawAvatarCircle = (ctx, { image, fallbackChar, cx, cy, radius, theme }) => {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,.85)";
  ctx.fill();
  ctx.clip();
  if (image) {
    const scale = Math.max((radius * 2) / image.width, (radius * 2) / image.height);
    const w = image.width * scale, h = image.height * scale;
    ctx.drawImage(image, cx - w / 2, cy - h / 2, w, h);
  } else {
    ctx.fillStyle = theme.accent;
    ctx.font = `700 ${Math.round(radius)}px ${HAND_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(fallbackChar || "♥", cx, cy + 2);
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.strokeStyle = theme.frame;
  ctx.lineWidth = 2.5;
  ctx.stroke();
};

const ensureCardFonts = async () => {
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load(`24px ${HAND_FONT}`, "特別記憶"),
        document.fonts.load(`700 30px ${HAND_FONT}`, "特別記憶"),
        document.fonts.load(`44px ${SCRIPT_FONT}`, "Special Memory"),
      ]),
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]);
  } catch {}
};

// 以 Canvas 直接繪製紀念卡 PNG（720×1150），避免外部截圖庫與圖片跨域污染問題。
export async function renderSpecialMemoryImage(memory, { characterAvatar, playerAvatar, playerName, locale = "zh-TW", tr } = {}) {
  const localTr = typeof tr === "function" ? tr : (...translations) => translate(locale, ...translations);
  const theme = themeOf(memory);
  const W = 720, H = 1150;
  await ensureCardFonts();
  const [charImage, playerImage] = await Promise.all([loadSafeImage(characterAvatar), loadSafeImage(playerAvatar)]);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, theme.bgTop);
  bg.addColorStop(1, theme.bgBottom);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.fillStyle = theme.glow;
  ctx.filter = "blur(70px)";
  ctx.beginPath();
  ctx.arc(W / 2, 250, 180, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = theme.frame;
  ctx.lineWidth = 5;
  roundedRectPath(ctx, 34, 34, W - 68, H - 68, 30);
  ctx.stroke();
  ctx.strokeStyle = theme.frameSoft;
  ctx.lineWidth = 1.6;
  roundedRectPath(ctx, 50, 50, W - 100, H - 100, 22);
  ctx.stroke();

  ctx.fillStyle = theme.frame;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "22px serif";
  for (const [cx, cy] of [[66, 66], [W - 66, 66], [66, H - 66], [W - 66, H - 66]]) ctx.fillText("✦", cx, cy);

  ctx.fillStyle = theme.accent;
  ctx.font = `700 22px ${HAND_FONT}`;
  ctx.fillText(`✦  ${theme.label.split("").join(" ")}  ✦`, W / 2, 108);

  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,.66)";
  ctx.strokeStyle = theme.frameSoft;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(W / 2, 216, 82, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  ctx.font = "84px 'Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji',sans-serif";
  ctx.fillText(memory.itemIcon || "🌸", W / 2, 222);

  ctx.fillStyle = theme.text;
  ctx.font = `700 34px ${HAND_FONT}`;
  ctx.fillText(memory.itemName || localTr("心意", "Sentiment", "想い", "마음"), W / 2, 348);
  ctx.fillStyle = theme.accent;
  ctx.font = `700 29px ${HAND_FONT}`;
  ctx.fillText(memory.title || localTr("特別的回憶", "A Special Memory", "特別な思い出", "특별한 추억"), W / 2, 398);

  ctx.strokeStyle = theme.frameSoft;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(150, 438);
  ctx.lineTo(W / 2 - 26, 438);
  ctx.moveTo(W / 2 + 26, 438);
  ctx.lineTo(W - 150, 438);
  ctx.stroke();
  ctx.fillStyle = theme.frame;
  ctx.font = "18px serif";
  ctx.fillText("❖", W / 2, 438);

  // 內文：對話摘要（旁白），接著角色自白（引號段）。舊資料沒有 summary 時退回 text。
  let cursor = 486;
  ctx.font = `23px ${HAND_FONT}`;
  const summaryLines = wrapCanvasText(ctx, memory.summary || memory.text, W - 190, 5);
  ctx.fillStyle = theme.text;
  summaryLines.forEach((line) => { ctx.fillText(line, W / 2, cursor); cursor += 40; });
  if (memory.monologue) {
    cursor += 22;
    ctx.fillStyle = theme.frame;
    ctx.font = `54px ${SCRIPT_FONT}`;
    ctx.fillText("“", W / 2, cursor + 6);
    cursor += 44;
    ctx.fillStyle = theme.accent;
    ctx.font = `24px ${HAND_FONT}`;
    const monologueLines = wrapCanvasText(ctx, memory.monologue, W - 220, 4);
    monologueLines.forEach((line) => { ctx.fillText(line, W / 2, cursor); cursor += 42; });
    ctx.fillStyle = theme.text;
    ctx.font = `18px ${HAND_FONT}`;
    ctx.fillText(`—— ${memory.characterName || ""}`, W / 2, cursor + 6);
  }

  const avatarY = H - 210;
  drawAvatarCircle(ctx, { image: charImage, fallbackChar: (memory.characterName || "♥")[0], cx: W / 2 - 26, cy: avatarY, radius: 33, theme });
  drawAvatarCircle(ctx, { image: playerImage, fallbackChar: (playerName || localTr("你", "You", "あなた", "나"))[0], cx: W / 2 + 26, cy: avatarY, radius: 33, theme });
  ctx.fillStyle = theme.accent;
  ctx.font = `700 23px ${HAND_FONT}`;
  ctx.fillText(`${memory.characterName || ""} ✕ ${playerName || localTr("你", "You", "あなた", "나")}`, W / 2, H - 148);
  ctx.fillStyle = theme.text;
  ctx.font = `18px ${HAND_FONT}`;
  ctx.fillText(`${memory.mode === "reality"
    ? localTr("現實篇章", "Reality Chapter", "リアル篇", "현실 편")
    : localTr("線上篇章", "Online Chapter", "オンライン篇", "온라인 편")} · ${formatMemoryDate(memory.createdAt, locale)}`, W / 2, H - 114);
  ctx.fillStyle = theme.frame;
  ctx.font = `42px ${SCRIPT_FONT}`;
  ctx.fillText("Special Memory", W / 2, H - 66);

  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error(localTr("圖片產生失敗", "Could not create the image.", "画像を生成できませんでした。", "이미지를 생성하지 못했습니다."))), "image/png"));
}

export function SpecialMemoryModal({ memory: memoryProp, characterAvatar, playerAvatar, playerName, tr, locale = "zh-TW", onClose }) {
  const { specialMemories, toggleSpecialMemoryPin } = useGacha();
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const localTr = typeof tr === "function" ? tr : (...translations) => translate(locale, ...translations);
  // 呼叫端可能傳入快照，釘選狀態一律以 context 中的最新資料為準
  const memory = specialMemories.find((item) => item.id === memoryProp?.id) || memoryProp;
  const theme = themeOf(memory);
  if (!memory) return null;
  const togglePin = () => {
    const result = toggleSpecialMemoryPin(memory.id);
    if (!result.ok && result.reason === "limit") setNotice(localTr("每位角色最多銘記 3 段特別記憶，請先解除其他銘記", "Each character can keep up to 3 permanent special memories. Unpin another one first.", "各キャラが銘記できる特別な思い出は3件までです。先に別の銘記を解除してください。", "캐릭터마다 특별한 추억을 최대 3개까지 새길 수 있습니다. 다른 추억을 먼저 해제하세요."));
    else if (result.ok) setNotice(result.pinned
      ? localTr("已銘記：角色聊天時會永遠記得這段回憶", "Remembered: the character will always recall this during chat.", "銘記しました：キャラはチャット中、この思い出をずっと覚えています。", "새김 완료: 캐릭터가 채팅 중 이 추억을 항상 기억합니다.")
      : localTr("已解除銘記：這段回憶改為聊到相關話題時想起", "Unpinned: this memory will now surface only when related topics come up.", "銘記を解除しました：関連する話題になったときに思い出します。", "새김 해제: 이제 관련 주제가 나올 때 이 추억을 떠올립니다."));
  };
  const download = async () => {
    if (saving) return;
    setSaving(true);
    setNotice("");
    try {
      const blob = await renderSpecialMemoryImage(memory, { characterAvatar, playerAvatar, playerName, locale, tr: localTr });
      const result = await downloadImageFile(blob, `special-memory-${memory.characterName || "memory"}-${formatMemoryDate(memory.createdAt, locale).replace(/\//g, "")}.png`);
      if (result?.method === "native-filesystem") setNotice(localTr(`已儲存到 Documents/${result.path}`, `Saved to Documents/${result.path}`, `Documents/${result.path} に保存しました`, `Documents/${result.path}에 저장했습니다`));
      else if (result?.method !== "cancelled") setNotice(localTr("紀念卡已下載", "Memory card downloaded.", "記念カードをダウンロードしました。", "기념 카드를 다운로드했습니다."));
    } catch (error) {
      setNotice(error?.message || localTr("下載失敗，請改用截圖另存", "Download failed. Please save a screenshot instead.", "ダウンロードに失敗しました。スクリーンショットで保存してください。", "다운로드에 실패했습니다. 스크린샷으로 저장해 주세요."));
    } finally {
      setSaving(false);
    }
  };
  const renderAvatar = (src, fallbackChar) => <span className="sg-memory-ava" style={{ borderColor: theme.frame, color: theme.accent }}>{src ? <img src={src} alt="" /> : (fallbackChar || "♥")}</span>;
  return <div className="sg-memory-overlay" onClick={onClose}>
    <style>{`.sg-memory-overlay{position:fixed;inset:0;z-index:340;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:13px;background:rgba(46,30,40,.55);backdrop-filter:blur(6px);padding:22px 18px}.sg-memory-card{position:relative;width:min(324px,86vw);max-height:74vh;overflow-y:auto;border-radius:22px;padding:28px 24px 24px;text-align:center;box-shadow:0 22px 55px rgba(70,40,55,.35);animation:sgMemoryIn .45s cubic-bezier(.2,.9,.3,1.2);font-family:'LXGW WenKai TC','Noto Serif TC','PMingLiU',serif;scrollbar-width:none}.sg-memory-card::-webkit-scrollbar{display:none}.sg-memory-frame{position:absolute;inset:10px;border-radius:15px;pointer-events:none}.sg-memory-corner{position:absolute;font-size:13px;line-height:1}.sg-memory-rarity{font-size:11px;font-weight:800;letter-spacing:.34em;text-indent:.34em;margin-bottom:12px}.sg-memory-icon{width:78px;height:78px;margin:0 auto;border-radius:50%;display:grid;place-items:center;font-size:38px;background:rgba(255,255,255,.68)}.sg-memory-item{margin-top:13px;font-size:19px;font-weight:900}.sg-memory-title{margin-top:3px;font-size:15px;font-weight:700}.sg-memory-divider{display:flex;align-items:center;gap:9px;margin:12px 8px;font-size:10px}.sg-memory-divider:before,.sg-memory-divider:after{content:"";height:1px;flex:1;background:currentColor;opacity:.5}.sg-memory-summary{font-size:13px;line-height:1.95;text-align:justify;white-space:pre-wrap;word-break:break-word}.sg-memory-quote-mark{margin:10px 0 -6px;font:34px/1 'Great Vibes',cursive;opacity:.9}.sg-memory-monologue{font-size:13.5px;line-height:1.95;white-space:pre-wrap;word-break:break-word}.sg-memory-sign{margin-top:5px;font-size:11px;opacity:.8}.sg-memory-pair{display:flex;align-items:center;justify-content:center;margin-top:16px}.sg-memory-ava{width:44px;height:44px;border-radius:50%;border:2px solid;display:grid;place-items:center;overflow:hidden;background:rgba(255,255,255,.85);font-size:18px;font-weight:800}.sg-memory-ava+.sg-memory-ava{margin-left:-9px}.sg-memory-ava img{width:100%;height:100%;object-fit:cover}.sg-memory-footer{margin-top:9px;font-size:11.5px;font-weight:700}.sg-memory-date{margin-top:3px;font-size:10.5px;opacity:.8}.sg-memory-brand{margin-top:9px;font:26px/1 'Great Vibes',cursive;opacity:.75}.sg-memory-actions{display:flex;gap:9px}.sg-memory-btn{border:0;border-radius:14px;padding:11px 17px;font-size:13px;font-weight:800}.sg-memory-btn-primary{background:linear-gradient(135deg,#df91a8,#bd5b7a);color:#fff}.sg-memory-btn-primary:disabled{opacity:.55}.sg-memory-btn-ghost{background:rgba(255,255,255,.88);color:#8c5468}.sg-memory-btn-sealed{background:linear-gradient(135deg,#e9cd8e,#c99a4b);color:#fff;text-shadow:0 1px 2px rgba(140,95,30,.35);box-shadow:0 3px 12px rgba(185,140,60,.4)}.sg-memory-notice{max-width:86vw;color:#ffe9f1;font-size:11px;text-align:center}@keyframes sgMemoryIn{from{transform:translateY(22px) scale(.92);opacity:0}to{transform:none;opacity:1}}`}</style>
    <div className="sg-memory-card" style={{ background: `linear-gradient(180deg,${theme.bgTop},${theme.bgBottom})`, color: theme.text }} onClick={(event) => event.stopPropagation()}>
      <div className="sg-memory-frame" style={{ border: `2px solid ${theme.frame}`, boxShadow: `inset 0 0 0 1px ${theme.frameSoft}` }} />
      {[["top", "left"], ["top", "right"], ["bottom", "left"], ["bottom", "right"]].map(([v, h]) => <span key={v + h} className="sg-memory-corner" style={{ [v]: 14, [h]: 17, color: theme.frame }}>✦</span>)}
      <div className="sg-memory-rarity" style={{ color: theme.accent }}>{theme.label}</div>
      <div className="sg-memory-icon" style={{ border: `1.5px solid ${theme.frameSoft}` }}>{memory.itemIcon || "🌸"}</div>
      <div className="sg-memory-item">{memory.itemName}</div>
      <div className="sg-memory-title" style={{ color: theme.accent }}>{memory.title}</div>
      <div className="sg-memory-divider" style={{ color: theme.frame }}>❖</div>
      <div className="sg-memory-summary">{memory.summary || memory.text}</div>
      {memory.monologue && <>
        <div className="sg-memory-quote-mark" style={{ color: theme.frame }}>“</div>
        <div className="sg-memory-monologue" style={{ color: theme.accent }}>{memory.monologue}</div>
        <div className="sg-memory-sign">—— {memory.characterName}</div>
      </>}
      <div className="sg-memory-pair">{renderAvatar(characterAvatar, (memory.characterName || "♥")[0])}{renderAvatar(playerAvatar, (playerName || localTr("你", "You", "あなた", "나"))[0])}</div>
      <div className="sg-memory-footer" style={{ color: theme.accent }}>{memory.characterName} ✕ {playerName || localTr("你", "You", "あなた", "나")}</div>
      <div className="sg-memory-date">{memory.mode === "reality"
        ? localTr("現實篇章", "Reality Chapter", "リアル篇", "현실 편")
        : localTr("線上篇章", "Online Chapter", "オンライン篇", "온라인 편")} · {formatMemoryDate(memory.createdAt, locale)}</div>
      <div className="sg-memory-brand" style={{ color: theme.frame }}>Special Memory</div>
    </div>
    {notice && <div className="sg-memory-notice">{notice}</div>}
    <div className="sg-memory-actions" onClick={(event) => event.stopPropagation()}>
      <button className="sg-memory-btn sg-memory-btn-primary" disabled={saving} onClick={download}>{saving ? localTr("產生中…", "Creating…", "生成中…", "생성 중…") : localTr("⬇ 下載紀念卡", "⬇ Download Card", "⬇ 記念カードを保存", "⬇ 기념 카드 다운로드")}</button>
      <button className={`sg-memory-btn ${memory.pinned ? "sg-memory-btn-sealed" : "sg-memory-btn-ghost"}`} onClick={togglePin}>{memory.pinned ? localTr("✦ 銘記中", "✦ Remembered", "✦ 銘記中", "✦ 새김 중") : localTr("✧ 銘記", "✧ Remember", "✧ 銘記", "✧ 새기기")}</button>
      <button className="sg-memory-btn sg-memory-btn-ghost" onClick={onClose}>{localTr("關閉", "Close", "閉じる", "닫기")}</button>
    </div>
  </div>;
}

// 特別篇完結後顯示的入口：尚未凝結 → 生成並凝結；已凝結 → 直接查看紀念卡。
export default function SpecialMemorySection({ episode, character, playerProfile, apiConfig }) {
  const { specialMemories, addSpecialMemory } = useGacha();
  const [isCondensing, setIsCondensing] = useState(false);
  const [error, setError] = useState("");
  const [viewing, setViewing] = useState(false);
  if (!episode || episode.status === "active") return null;
  const memory = specialMemories.find((item) => item.episodeId === episode.id);
  const characterAvatar = sanitizeUserImageUrl(character?.avatar || episode.characterAvatar);
  const playerAvatar = sanitizeUserImageUrl(playerProfile?.avatar);
  const playerName = String(playerProfile?.name || "").trim() || "你";
  const condense = async () => {
    if (isCondensing || memory) return;
    setError("");
    setIsCondensing(true);
    try {
      const generated = await generateSpecialMemorySummary({ episode, character, playerProfile, apiConfig });
      const created = addSpecialMemory({ episodeId: episode.id, title: generated.title, text: generated.memoryText, summary: generated.summary, monologue: generated.monologue });
      if (!created) throw new Error("特別記憶建立失敗，請重試");
      setViewing(true);
    } catch (reason) {
      setError(reason?.message || "特別記憶生成失敗，請稍後重試");
    } finally {
      setIsCondensing(false);
    }
  };
  return <div className="sg-memory-section">
    <style>{`.sg-memory-section{display:flex;flex-direction:column;align-items:center;gap:7px;margin:14px auto 6px}.sg-memory-cta{border:1px solid #dfb9c6;border-radius:16px;padding:10px 19px;background:linear-gradient(135deg,#fff3f7,#ffe9f0);color:#a5526d;font-size:12px;font-weight:800;box-shadow:0 5px 16px rgba(180,100,130,.16)}.sg-memory-cta:disabled{opacity:.55}.sg-memory-cta.done{background:linear-gradient(135deg,#fff8e9,#ffeccd);border-color:#e2c795;color:#a2652f}.sg-memory-hint{color:var(--mp-txt-l,#a18a8c);font-size:10px}.sg-memory-error{border:0;background:transparent;color:#bd5277;font-size:11px;text-decoration:underline}`}</style>
    {memory
      ? <button className="sg-memory-cta done" onClick={() => setViewing(true)}>✦ 查看特別記憶</button>
      : <>
        <button className="sg-memory-cta" disabled={isCondensing} onClick={condense}>{isCondensing ? "記憶凝結中…" : "✦ 凝結成特別記憶"}</button>
        <div className="sg-memory-hint">凝結後會化成一張可下載的紀念卡，並讓角色在日常聊天裡記得這段故事</div>
      </>}
    {error && <button className="sg-memory-error" onClick={condense}>{error}（點擊重試）</button>}
    {viewing && memory && <SpecialMemoryModal memory={memory} characterAvatar={characterAvatar} playerAvatar={playerAvatar} playerName={playerName} onClose={() => setViewing(false)} />}
  </div>;
}
