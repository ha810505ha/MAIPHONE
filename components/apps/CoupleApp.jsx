import React, { useEffect, useMemo, useRef, useState } from "react";
import { useGacha } from "../../contexts/GachaContext";
import { SpecialMemoryModal } from "../gacha/SpecialMemoryCard";
import { sanitizeUserImageUrl } from "../../utils/coreUtils";
import { loadFeatureEntity, saveFeatureEntity } from "../../utils/indexedDbStorage";
import { coupleDayKey, generateLoveSign, generateDailyTask, judgeCoupleTask, settleTemperature, temperatureComment } from "../../services/couple/coupleDailyService";

const RARITY_COLORS = { SSR: "#c99a4b", SR: "#8f6cc9", R: "#6f9cc9" };
const GLASS = { background: "rgba(255,255,255,.66)", border: "1px solid rgba(255,255,255,.85)" };
const HAND_FONT = "'LXGW WenKai TC','Noto Serif TC',serif";
const DAILY_KEY = "ent_coupleDaily";
const TASK_REWARD = 180;       // 一次單抽所需的靈魂結晶
const STREAK_BONUS = 540;      // 連續 7 天加碼 ×3
const formatDate = (time) => new Intl.DateTimeFormat("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(time));

function Avatar({ src, fallback, size = 52, ring = "#f191ae" }) {
  return (
    <span style={{ width: size, height: size, borderRadius: "50%", overflow: "hidden", flex: "0 0 auto", display: "grid", placeItems: "center", background: "rgba(255,255,255,.85)", border: `2.5px solid ${ring}`, boxShadow: "0 4px 14px rgba(190,90,120,.25)", fontSize: size * .42, fontWeight: 800, color: "#b05e75" }}>
      {src ? <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (fallback || "♥")}
    </span>
  );
}

const SectionCard = ({ children, style }) => <div style={{ ...GLASS, borderRadius: 18, padding: "13px 15px", marginTop: 10, boxShadow: "0 6px 18px rgba(200,110,140,.13)", ...style }}>{children}</div>;

function FullHeartBackdrop() {
  return <div className="couple-full-heart-bg" aria-hidden="true">
    <style>{`@keyframes coupleHeartFloat{0%{transform:translateY(18px) scale(.8);opacity:0}20%{opacity:.42}80%{opacity:.28}100%{transform:translateY(-120px) scale(1.15);opacity:0}}@keyframes coupleGlow{0%,100%{opacity:.32;transform:scale(.96)}50%{opacity:.58;transform:scale(1.04)}}.couple-full-heart-bg{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:0;background:radial-gradient(circle at 50% 20%,rgba(255,255,255,.38),transparent 45%)}.couple-full-heart-bg:before{content:"";position:absolute;width:220px;height:220px;left:50%;top:8%;transform:translateX(-50%);border-radius:50%;background:radial-gradient(circle,rgba(255,178,205,.34),transparent 68%);animation:coupleGlow 5s ease-in-out infinite}.couple-full-heart-bg span{position:absolute;bottom:-24px;color:rgba(255,255,255,.82);text-shadow:0 2px 8px rgba(213,93,137,.28);animation:coupleHeartFloat 8s linear infinite}.couple-full-heart-bg span:nth-child(1){left:8%;animation-delay:-1s}.couple-full-heart-bg span:nth-child(2){left:22%;animation-delay:-5s}.couple-full-heart-bg span:nth-child(3){left:39%;animation-delay:-3s}.couple-full-heart-bg span:nth-child(4){left:58%;animation-delay:-7s}.couple-full-heart-bg span:nth-child(5){left:75%;animation-delay:-2s}.couple-full-heart-bg span:nth-child(6){left:90%;animation-delay:-6s}@media(prefers-reduced-motion:reduce){.couple-full-heart-bg:before,.couple-full-heart-bg span{animation:none}.couple-full-heart-bg span{opacity:.18}}`}</style>
    {["♡", "✦", "♡", "·", "♡", "✦"].map((mark, index) => <span key={index} style={{ fontSize: index % 2 ? 12 : 18 }}>{mark}</span>)}
  </div>;
}

// 情侶空間：每日戀愛簽・關係溫度計・今日小任務＋特別記憶紀念卡牆。
export default function CoupleApp({ closeApp, characters = [], chatHistory = {}, setChatHistory, playerProfile, apiConfig }) {
  const { specialMemories, changeCrystals } = useGacha();
  const [partnerId, setPartnerId] = useState(null);
  const [choosing, setChoosing] = useState(false); // 只有第一次或主動換人時才顯示選擇頁
  const [view, setView] = useState("home"); // home | memories
  const [rarityFilter, setRarityFilter] = useState("ALL");
  const [viewingMemory, setViewingMemory] = useState(null);
  const [dailyStore, setDailyStore] = useState(null); // null = 尚未載入
  const [dailyLoading, setDailyLoading] = useState(false);
  const [judging, setJudging] = useState(false);
  const [notice, setNotice] = useState("");
  const generatingRef = useRef(false);
  const playerName = String(playerProfile?.name || "").trim() || "你";
  const playerAvatar = sanitizeUserImageUrl(playerProfile?.avatar);

  // 這裡選的是情侶空間的主要互動對象，不代表角色關係已經變成情侶。
  useEffect(() => {
    loadFeatureEntity(DAILY_KEY, null).then((saved) => {
      let store = saved && typeof saved === "object" ? saved : {};
      // 舊版只有單一 _partnerId；既有進度視為已開通空間並保留。
      if (!store._spaces && store._partnerId) {
        const legacyId = store._partnerId;
        store = {
          ...store,
          _activeSpaceId: legacyId,
          _spaces: { [legacyId]: { status: "accepted", acceptedAt: store[legacyId]?.createdAt || Date.now(), migrated: true } },
        };
        saveFeatureEntity(DAILY_KEY, store).catch(() => {});
      }
      setDailyStore(store);
      const savedPartner = store._activeSpaceId;
      if (savedPartner && store._spaces?.[savedPartner]?.status === "accepted" && characters.some((c) => String(c.id) === String(savedPartner))) setPartnerId(savedPartner);
      else setChoosing(true);
    }).catch(() => { setDailyStore({}); setChoosing(true); });
  }, []);
  const saveStore = (next) => { setDailyStore(next); saveFeatureEntity(DAILY_KEY, next).catch(() => {}); };
  const openSpace = (charId) => {
    setPartnerId(charId);
    setChoosing(false);
    setView("home");
    setRarityFilter("ALL");
    setNotice("");
    saveStore({ ...(dailyStore || {}), _activeSpaceId: charId });
  };

  const inviteCharacter = (charId) => {
    if (!dailyStore || typeof setChatHistory !== "function") return;
    const existingPending = Object.entries(dailyStore._spaces || {}).find(([, value]) => value?.status === "pending");
    if (existingPending && String(existingPending[0]) !== String(charId)) {
      setNotice("目前已有一份邀請等待回覆，請先完成或撤回。 ");
      return;
    }
    const previous = dailyStore._spaces?.[charId];
    if (previous?.canInviteAgainAt && Date.now() < previous.canInviteAgainAt) {
      setNotice(`還要等 ${Math.ceil((previous.canInviteAgainAt - Date.now()) / 86400000)} 天才能再次邀請。`);
      return;
    }
    const now = Date.now();
    const content = `💞 情侶空間邀請\n${playerName} 邀請你一起開啟「情侶空間」。\n這是一個只屬於你們兩人的共享空間，可以一起抽每日戀愛籤、完成小任務並收藏共同回憶。\n是否接受由你決定；這份邀請不代表你必須立刻改變目前的關係。`;
    setChatHistory((history) => ({ ...history, [charId]: [...(history[charId] || []), { id: `couple_invite_${now}`, role: "system_notice", content, time: now }] }));
    saveStore({
      ...dailyStore,
      _spaces: { ...(dailyStore._spaces || {}), [charId]: { status: "pending", invitedAt: now, pendingRound: 0 } },
    });
    setNotice("邀請已送到聊天室，角色會在三次回覆內做出決定。 ");
  };

  const partners = useMemo(() => characters.map((character) => {
    const memories = specialMemories.filter((m) => String(m.characterId) === String(character.id));
    const messages = chatHistory[character.id] || [];
    return { character, memoryCount: memories.length, messageCount: messages.length };
  }).sort((a, b) => b.memoryCount - a.memoryCount || b.messageCount - a.messageCount), [characters, specialMemories, chatHistory]);
  const acceptedPartners = partners.filter(({ character: c }) => dailyStore?._spaces?.[c.id]?.status === "accepted");
  const unopenedPartners = partners
    .filter(({ character: c }) => dailyStore?._spaces?.[c.id]?.status !== "accepted")
    .sort((a, b) => {
      const rank = ({ character: c }) => {
        const itemSpace = dailyStore?._spaces?.[c.id];
        if (itemSpace?.status === "pending") return 0;
        if (itemSpace?.canInviteAgainAt && Date.now() < itemSpace.canInviteAgainAt) return 1;
        return 2;
      };
      return rank(a) - rank(b);
    });
  const renderPartnerRow = ({ character: c, memoryCount, messageCount }) => {
    const itemSpace = dailyStore?._spaces?.[c.id];
    const status = itemSpace?.status || "available";
    const cooling = itemSpace?.canInviteAgainAt && Date.now() < itemSpace.canInviteAgainAt;
    const actionLabel = status === "accepted" ? "進入" : status === "pending" ? `等待回覆 ${itemSpace.pendingRound || 0}/3` : cooling ? `${Math.ceil((itemSpace.canInviteAgainAt - Date.now()) / 86400000)} 天後可邀請` : "送出邀請";
    return <button key={c.id} type="button" disabled={status === "pending" || cooling} onClick={() => status === "accepted" ? openSpace(c.id) : inviteCharacter(c.id)}
      style={{ ...GLASS, width: "100%", display: "flex", alignItems: "center", gap: 12, borderRadius: 18, padding: "12px 14px", marginBottom: 10, textAlign: "left", boxShadow: "0 6px 18px rgba(200,110,140,.14)" }}>
      <Avatar src={sanitizeUserImageUrl(c.avatar)} fallback={c.name?.[0]} size={48} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <b style={{ fontSize: 14, fontWeight: 900, color: "#7a4257" }}>{c.name}</b>
          {status === "accepted" && <span style={{ fontSize: 8.5, fontWeight: 800, color: "#fff", background: "linear-gradient(135deg,#f06292,#d16a8d)", borderRadius: 99, padding: "2px 7px" }}>💗 已開通</span>}
        </span>
        <span style={{ display: "block", fontSize: 10.5, color: "#a86e84", marginTop: 3 }}>{memoryCount ? `✦ ${memoryCount} 段特別記憶` : "還沒有特別記憶"} · {messageCount} 則訊息</span>
      </span>
      <span style={{ color: status === "accepted" ? "#cf8fa5" : "#a86e84", fontSize: 10, fontWeight: 800 }}>{actionLabel}</span>
    </button>;
  };

  const partner = partners.find((item) => String(item.character.id) === String(partnerId));
  const character = partner?.character;
  const space = character && dailyStore ? dailyStore._spaces?.[character.id] : null;
  const daily = character && dailyStore ? dailyStore[character.id] : null;
  const today = coupleDayKey();

  const shareToChat = (kind) => {
    if (!character || !daily || typeof setChatHistory !== "function") return;
    const isTask = kind === "task";
    if (isTask && !daily.task?.text) return;
    if (!isTask && !daily.sign?.text) return;
    const now = Date.now();
    const content = isTask
      ? `💞 ${character.name}給你的今日小互動\n「${daily.task.text}」`
      : `💞 今日戀愛籤\n${daily.sign.level}・${daily.sign.tip}\n「${daily.sign.text}」`;
    setChatHistory((history) => ({
      ...history,
      [character.id]: [...(history[character.id] || []), { id: `couple_${kind}_${now}`, role: "system_notice", content, time: now }],
    }));
    saveStore({
      ...dailyStore,
      [character.id]: isTask
        ? { ...daily, taskSharedAt: now, taskChatState: "active", taskChatEndedAt: null }
        : { ...daily, signSharedAt: now },
    });
    setNotice(isTask ? "已分享到聊天室；任務結束後會停止提供背景資訊。" : "戀愛籤已分享到聊天室，後續只依聊天紀錄承接。" );
  };

  // 每天第一次進入：結算溫度＋生成今日戀愛簽與任務
  useEffect(() => {
    if (!character || space?.status !== "accepted" || dailyStore === null || generatingRef.current) return;
    const current = dailyStore[character.id];
    // 當天任務已存在就不重生成；戀愛簽改由玩家按鈕抽，這裡不生成
    if (current?.day === today && current?.task?.text) return;
    generatingRef.current = true;
    setDailyLoading(true);
    const messages = chatHistory[character.id] || [];
    const lastMessageAt = messages[messages.length - 1]?.time || null;
    const lastMemoryAt = specialMemories.filter((m) => String(m.characterId) === String(character.id))[0]?.createdAt || null;
    const settled = settleTemperature({ previous: current?.temperature, lastMessageAt, lastTaskDoneDay: current?.lastDoneDay, lastMemoryAt, maxTemperatureReached: !!current?.maxTemperatureReached });
    const taskGenerationCharacter = {
      ...character,
      description: [
        "【今日小互動語氣】這不是制式任務或命令，而是角色想和玩家親近的私人邀請。請依角色個性自然地使用甜蜜、溫柔、撒嬌或調皮的口吻，讓玩家感到被期待；互動要輕鬆、具體，能在聊天室完成。避免『請完成』『必須』『任務』等系統式措辭。",
        character.description || character.personality || character.prompt || character.persona || "",
      ].filter(Boolean).join("\n"),
    };
    generateDailyTask({ character: taskGenerationCharacter, playerProfile, recentMessages: messages.slice(-12), apiConfig }).then((task) => {
      const sameDay = current?.day === today;
      saveStore({
        ...dailyStore,
        [character.id]: {
          day: today,
          sign: sameDay && current?.sign?.text ? current.sign : null,
          signAt: sameDay ? current?.signAt || null : null,
          task,
          taskDone: sameDay ? !!current.taskDone : false,
          taskComment: sameDay ? current.taskComment || "" : "",
          streak: current?.streak || 0,
          lastDoneDay: current?.lastDoneDay || null,
          temperature: sameDay ? current.temperature : settled.temperature,
          tempDelta: sameDay ? current.tempDelta : settled.delta,
          maxTemperatureReached: current?.maxTemperatureReached || settled.maxTemperatureReached,
          firstMaxedAt: current?.firstMaxedAt || (settled.temperature >= 100 ? Date.now() : null),
          milestones: {
            ...(current?.milestones || {}),
            ...(settled.temperature >= 100 && !current?.milestones?.fullHeart ? { fullHeart: { unlocked: true, unlockedAt: Date.now() } } : {}),
          },
        },
      });
    }).finally(() => { generatingRef.current = false; setDailyLoading(false); });
  }, [character?.id, dailyStore === null ? "loading" : "ready", today]);

  const [drawingSign, setDrawingSign] = useState(false);
  const drawSign = async () => {
    if (!character || !daily || daily.sign?.text || drawingSign) return;
    setDrawingSign(true);
    try {
      const sign = await generateLoveSign({ character, playerProfile, recentMessages: (chatHistory[character.id] || []).slice(-12), apiConfig });
      saveStore({ ...dailyStore, [character.id]: { ...daily, sign, signAt: Date.now() } });
    } finally { setDrawingSign(false); }
  };

  const checkTask = async () => {
    if (!character || !daily || daily.taskDone || judging) return;
    setJudging(true);
    setNotice("");
    try {
      const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
      const todayMessages = (chatHistory[character.id] || []).filter((m) => (m.time || 0) >= dayStart.getTime());
      const verdict = await judgeCoupleTask({ task: daily.task?.text, character, playerProfile, todayMessages, apiConfig });
      if (verdict.done) {
        const yesterday = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date(Date.now() - 86400000));
        const streak = daily.lastDoneDay === yesterday ? (daily.streak || 0) + 1 : 1;
        const bonus = streak > 0 && streak % 7 === 0 ? STREAK_BONUS : 0;
        changeCrystals(TASK_REWARD + bonus, {
          source: "couple",
          note: bonus ? `完成情侶空間任務・連續 ${streak} 天加碼` : "完成情侶空間任務",
        });
        saveStore({ ...dailyStore, [character.id]: { ...daily, taskDone: true, taskComment: verdict.comment, streak, lastDoneDay: today, taskChatState: "completed", taskChatEndedAt: Date.now() } });
        setNotice(`💎 獲得 ${TASK_REWARD} 靈魂結晶${bonus ? `，連續 ${streak} 天加碼 +${bonus}！` : `（連續 ${streak} 天）`}`);
      } else {
        saveStore({ ...dailyStore, [character.id]: { ...daily, taskComment: verdict.comment } });
        setNotice("");
      }
    } catch (reason) {
      setNotice(reason?.message || "驗收失敗，請稍後再試");
    } finally { setJudging(false); }
  };

  // ---- 資料載入中 ----
  if (dailyStore === null) {
    return (
      <div className="mp-page couple-app-page" style={{ background: "linear-gradient(180deg,#ffe0ea 0%,#ffd7e4 45%,#f3e3ff 100%)" }}>
        <div className="mp-hdr" style={{ background: "transparent" }}><div className="mp-back" onClick={closeApp}>←</div><div className="mp-htitle">💞 情侶空間</div></div>
        <div style={{ flex: 1, display: "grid", placeItems: "center", color: "#a86e84", fontSize: 12 }}>💗</div>
      </div>
    );
  }

  // ---- 永久空間列表／邀請角色 ----
  if (choosing || !partner) {
    return (
      <div className="mp-page couple-app-page" style={{ background: "linear-gradient(180deg,#ffe0ea 0%,#ffd7e4 45%,#f3e3ff 100%)" }}>
        <div className="mp-hdr" style={{ background: "transparent" }}><div className="mp-back" onClick={() => (partner ? setChoosing(false) : closeApp())}>←</div><div className="mp-htitle">💞 情侶空間</div></div>
        <div style={{ flex: 1, overflowY: "auto", padding: "6px 16px 26px" }}>
          <div style={{ textAlign: "center", padding: "10px 0 16px" }}>
            <div style={{ fontSize: 26 }}>💌</div>
            <div style={{ fontSize: 13, fontWeight: 900, color: "#7a4257", marginTop: 6, fontFamily: HAND_FONT }}>選擇一個雙人空間</div>
            <div style={{ fontSize: 10.5, color: "#a86e84", marginTop: 4, lineHeight: 1.7 }}>已開通的空間會永久保留；尚未開通的角色可以先送出邀請。</div>
          </div>
          {partners.length === 0 && <div className="mp-empty"><div className="mp-empty-i">💞</div><div className="mp-empty-t">還沒有角色<br />先去建立一位吧</div></div>}
          {acceptedPartners.length > 0 && <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "2px 4px 9px", color: "#9b566e", fontSize: 11, fontWeight: 900 }}>
              <span>💗 已開通空間</span><span style={{ color: "#c68ba0", fontSize: 9.5 }}>({acceptedPartners.length})</span>
              <span style={{ height: 1, flex: 1, background: "rgba(190,112,140,.22)" }} />
            </div>
            {acceptedPartners.map(renderPartnerRow)}
          </>}
          {unopenedPartners.length > 0 && <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, margin: `${acceptedPartners.length ? 18 : 2}px 4px 9px`, color: "#9b566e", fontSize: 11, fontWeight: 900 }}>
              <span>💌 未開通空間</span><span style={{ color: "#c68ba0", fontSize: 9.5 }}>({unopenedPartners.length})</span>
              <span style={{ height: 1, flex: 1, background: "rgba(190,112,140,.22)" }} />
            </div>
            {unopenedPartners.map(renderPartnerRow)}
          </>}
          {notice && <div style={{ textAlign: "center", fontSize: 11, fontWeight: 800, color: "#a2652f", marginTop: 10 }}>{notice}</div>}
        </div>
      </div>
    );
  }

  const characterAvatar = sanitizeUserImageUrl(character.avatar);
  const messages = chatHistory[character.id] || [];
  const firstMessageAt = messages[0]?.time || null;
  const daysTogether = firstMessageAt ? Math.max(1, Math.ceil((Date.now() - firstMessageAt) / 86400000)) : null;
  const allMemories = specialMemories.filter((m) => String(m.characterId) === String(character.id)).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  // ---- 回憶牆 ----
  if (view === "memories") {
    const memories = rarityFilter === "ALL" ? allMemories : allMemories.filter((m) => m.itemRarity === rarityFilter);
    const rarityCounts = allMemories.reduce((acc, m) => { acc[m.itemRarity] = (acc[m.itemRarity] || 0) + 1; return acc; }, {});
    return (
      <div className="mp-page couple-app-page" style={{ background: "linear-gradient(180deg,#ffe0ea 0%,#ffd7e4 45%,#f3e3ff 100%)" }}>
        <div className="mp-hdr" style={{ background: "transparent" }}><div className="mp-back" onClick={() => setView("home")}>←</div><div className="mp-htitle">📖 我們的回憶</div></div>
        <div style={{ flex: 1, overflowY: "auto", padding: "2px 16px 28px" }}>
          {allMemories.length > 0 && (
            <div style={{ display: "flex", justifyContent: "center", gap: 6, margin: "10px 0 4px" }}>
              {[["ALL", `全部 ${allMemories.length}`], ...["SSR", "SR", "R"].filter((r) => rarityCounts[r]).map((r) => [r, `${r} ${rarityCounts[r]}`])].map(([key, label]) => (
                <button key={key} type="button" onClick={() => setRarityFilter(key)}
                  style={key === rarityFilter
                    ? { border: 0, borderRadius: 99, padding: "4px 13px", fontSize: 10, fontWeight: 800, color: "#fff", background: key === "ALL" ? "linear-gradient(135deg,#f06292,#d16a8d)" : RARITY_COLORS[key], boxShadow: "0 3px 10px rgba(190,90,120,.3)" }
                    : { ...GLASS, borderRadius: 99, padding: "4px 13px", fontSize: 10, fontWeight: 700, color: key === "ALL" ? "#a86e84" : RARITY_COLORS[key] }}>
                  {label}
                </button>
              ))}
            </div>
          )}
          {allMemories.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "#a86e84" }}>
              <div style={{ fontSize: 34 }}>🕊️</div>
              <div style={{ fontSize: 12, fontWeight: 800, marginTop: 10, color: "#7a4257" }}>還沒有共同的特別記憶</div>
              <div style={{ fontSize: 10.5, lineHeight: 1.8, marginTop: 6 }}>到遊戲中心抽一張心意卡送給 {character.name}，<br />完成特別篇後凝結成記憶，就會收藏在這裡。</div>
            </div>
          ) : (
            <div style={{ position: "relative", margin: "14px 2px 0", paddingLeft: 18 }}>
              <div style={{ position: "absolute", left: 5, top: 6, bottom: 6, width: 2, borderRadius: 2, background: "linear-gradient(180deg,#f6b6ca,#e3c6f5)" }} />
              {memories.map((memory) => {
                const color = RARITY_COLORS[memory.itemRarity] || RARITY_COLORS.R;
                return (
                  <div key={memory.id} style={{ position: "relative", marginBottom: 12 }}>
                    <span style={{ position: "absolute", left: -17.5, top: 17, width: 9, height: 9, borderRadius: "50%", background: color, border: "2px solid #fff", boxShadow: `0 0 0 2px ${color}55` }} />
                    <button type="button" onClick={() => setViewingMemory(memory)}
                      style={{ ...GLASS, width: "100%", display: "flex", alignItems: "center", gap: 11, borderRadius: 16, borderLeft: `3px solid ${color}`, padding: "11px 13px", textAlign: "left", boxShadow: "0 5px 16px rgba(200,110,140,.13)" }}>
                      <span style={{ width: 42, height: 42, flex: "0 0 auto", borderRadius: 13, display: "grid", placeItems: "center", fontSize: 21, background: `linear-gradient(145deg,${color}22,${color}0d)`, border: `1px solid ${color}44` }}>{memory.itemIcon || "🌸"}</span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <b style={{ fontSize: 12.5, color: "#6d3c50", fontFamily: HAND_FONT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{memory.title}</b>
                          {memory.pinned && <span style={{ flex: "0 0 auto", width: 14, height: 14, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 8, color: "#fff", background: "radial-gradient(circle at 35% 30%,#eed49a,#c99a4b)" }}>✦</span>}
                        </span>
                        <span style={{ display: "block", fontSize: 10, color: "#a86e84", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{memory.summary || memory.text}</span>
                        <span style={{ display: "block", fontSize: 9, color: "#c093a4", marginTop: 3 }}>{formatDate(memory.createdAt)} · {memory.itemName} · <b style={{ color }}>{memory.itemRarity}</b></span>
                      </span>
                      <span style={{ color: "#cf8fa5" }}>›</span>
                    </button>
                  </div>
                );
              })}
              {memories.length === 0 && <div style={{ textAlign: "center", padding: "18px 0", fontSize: 11, color: "#a86e84" }}>這個稀有度還沒有回憶</div>}
            </div>
          )}
        </div>
        {viewingMemory && <SpecialMemoryModal memory={viewingMemory} characterAvatar={characterAvatar} playerAvatar={playerAvatar} playerName={playerName} onClose={() => setViewingMemory(null)} />}
      </div>
    );
  }

  // ---- 主頁：溫度計＋戀愛簽＋任務 ----
  const temperature = daily?.temperature ?? 60;
  const tempDelta = daily?.tempDelta ?? 0;
  const signTime = daily?.signAt ? new Intl.DateTimeFormat("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(daily.signAt)) : "";
  return (
    <div className="mp-page couple-app-page" style={{ overflow: "hidden", background: "linear-gradient(180deg,#ffe0ea 0%,#ffd7e4 45%,#f3e3ff 100%)" }}>
      {daily?.milestones?.fullHeart && <FullHeartBackdrop />}
      <div className="mp-hdr" style={{ position: "relative", zIndex: 1, background: "transparent" }}>
        <div className="mp-back" onClick={closeApp}>←</div>
        <div className="mp-htitle">💗 我們的日子</div>
        <button type="button" title="更換主要互動對象" onClick={() => setChoosing(true)}
          style={{ marginLeft: "auto", border: "1px solid rgba(255,255,255,.85)", borderRadius: 99, background: "rgba(255,255,255,.55)", color: "#a86e84", fontSize: 9.5, fontWeight: 800, padding: "5px 10px" }}>⇄ 換人</button>
      </div>
      <div style={{ position: "relative", zIndex: 1, flex: 1, overflowY: "auto", padding: "2px 16px 28px" }}>

        {/* 關係頭部 */}
        <div style={{ textAlign: "center", padding: "8px 0 2px" }}>
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
            <Avatar src={characterAvatar} fallback={character.name?.[0]} />
            <span style={{ margin: "0 -7px", zIndex: 1, fontSize: 20, filter: "drop-shadow(0 2px 4px rgba(200,80,110,.4))" }}>💗</span>
            <Avatar src={playerAvatar} fallback={playerName[0]} />
          </div>
          <div style={{ marginTop: 8, fontSize: 15, fontWeight: 900, color: "#7a4257", fontFamily: HAND_FONT }}>{character.name} ✕ {playerName}</div>
          <div style={{ marginTop: 3, fontSize: 10.5, color: "#a86e84" }}>{daysTogether ? <>開始互動的第 <b style={{ color: "#d16a8d", fontSize: 13 }}>{daysTogether}</b> 天</> : "故事還沒開始，先去打聲招呼吧"}</div>
        </div>

        {/* 關係溫度 */}
        <SectionCard>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: "#a86e84" }}>關係溫度</span>
            <span style={{ fontSize: 22, fontWeight: 900, color: "#d16a8d" }}>{temperature}°</span>
            {tempDelta !== 0 && <span style={{ fontSize: 10, fontWeight: 800, color: tempDelta > 0 ? "#e05a86" : "#8a9bb0" }}>{tempDelta > 0 ? `▲ 今天 +${tempDelta}` : `▼ 今天 ${tempDelta}`}</span>}
          </div>
          <div style={{ height: 7, borderRadius: 99, background: "rgba(255,255,255,.85)", marginTop: 8, overflow: "hidden" }}>
            <div style={{ width: `${temperature}%`, height: "100%", borderRadius: 99, background: "linear-gradient(90deg,#ffb2c8,#e91e63)", transition: "width .6s" }} />
          </div>
          <div style={{ fontSize: 10.5, color: "#a86e84", marginTop: 8, fontFamily: HAND_FONT }}>{character.name}說：{temperatureComment(tempDelta, temperature)}</div>
          {daily?.milestones?.fullHeart && <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(209,106,141,.18)", fontSize: 10.5, fontWeight: 900, color: "#c35f86" }}>✦ 羈絆里程碑：心意滿格</div>}
        </SectionCard>

        {/* 今日戀愛簽：玩家按了才抽，一天一支 */}
        <SectionCard>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 17 }}>🥠</span>
            <span style={{ fontSize: 12, fontWeight: 900, color: "#7a4257" }}>今日戀愛簽</span>
            {daily?.sign?.text && <span style={{ marginLeft: "auto", fontSize: 9.5, color: "#c093a4" }}>{signTime} 抽的</span>}
          </div>
          {daily?.sign?.text ? (
            <>
              <div style={{ display: "flex", gap: 6, marginTop: 9 }}>
                <span style={{ background: "linear-gradient(135deg,#f2c14e,#dd9f33)", color: "#fff", borderRadius: 8, padding: "2px 9px", fontSize: 10.5, fontWeight: 900 }}>{daily.sign.level}</span>
                <span style={{ ...GLASS, borderRadius: 8, padding: "2px 9px", fontSize: 10.5, fontWeight: 800, color: "#b05e75" }}>{daily.sign.tip}</span>
              </div>
              <div style={{ fontSize: 12.5, lineHeight: 1.85, color: "#6d3c50", marginTop: 8, fontFamily: HAND_FONT }}>「{daily.sign.text}」</div>
              <button type="button" disabled={!!daily.signSharedAt} onClick={() => shareToChat("sign")}
                style={{ marginTop: 9, border: 0, borderRadius: 10, padding: "7px 12px", fontSize: 10.5, fontWeight: 800, color: daily.signSharedAt ? "#a98b96" : "#fff", background: daily.signSharedAt ? "rgba(255,255,255,.72)" : "linear-gradient(135deg,#e88aaa,#c96f91)" }}>
                {daily.signSharedAt ? "已分享到聊天室" : "分享到聊天室"}
              </button>
            </>
          ) : (
            <div style={{ textAlign: "center", padding: "10px 0 4px" }}>
              <div style={{ fontSize: 10.5, color: "#a86e84", marginBottom: 10 }}>今天的籤還在籤筒裡，抽一支看看{character.name}想對你說什麼</div>
              <button type="button" disabled={drawingSign || dailyLoading || !daily} onClick={drawSign}
                style={{ border: 0, borderRadius: 14, padding: "9px 22px", fontSize: 12, fontWeight: 800, color: "#fff", background: "linear-gradient(135deg,#f2b25e,#dd8f33)", boxShadow: "0 4px 14px rgba(220,150,60,.35)", opacity: drawingSign || dailyLoading || !daily ? .6 : 1 }}>
                {drawingSign ? "抽籤中…" : "🥠 抽一支"}
              </button>
            </div>
          )}
        </SectionCard>

        {/* 今日小互動 */}
        <SectionCard>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 15 }}>💌</span>
            <span style={{ fontSize: 12, fontWeight: 900, color: "#7a4257" }}>今日小互動</span>
            <span style={{ marginLeft: "auto", fontSize: 9.5, fontWeight: 800, color: "#a2652f", background: "linear-gradient(135deg,#fff3d9,#ffe8bd)", border: "1px solid #ecd193", borderRadius: 99, padding: "2px 8px" }}>💎 靈魂結晶 ×{TASK_REWARD}</span>
          </div>
          {dailyLoading || !daily?.task ? (
            <div style={{ fontSize: 11, color: "#a86e84", padding: "12px 0 4px", textAlign: "center" }}>{dailyLoading ? `${character.name}正在想今天要出什麼題……` : "載入中……"}</div>
          ) : (
            <>
              <div style={{ fontSize: 12.5, lineHeight: 1.85, color: "#6d3c50", marginTop: 8, fontFamily: HAND_FONT }}>「{daily.task.text}」</div>
              {!daily.taskDone && <button type="button" disabled={daily.taskChatState === "active"} onClick={() => shareToChat("task")}
                style={{ marginTop: 9, border: 0, borderRadius: 10, padding: "7px 12px", fontSize: 10.5, fontWeight: 800, color: daily.taskChatState === "active" ? "#a98b96" : "#fff", background: daily.taskChatState === "active" ? "rgba(255,255,255,.72)" : "linear-gradient(135deg,#e88aaa,#c96f91)" }}>
                {daily.taskChatState === "active" ? "已分享到聊天室" : "分享到聊天室"}
              </button>}
              {daily.taskComment && <div style={{ fontSize: 10.5, color: daily.taskDone ? "#3f9d63" : "#b05e75", marginTop: 7, fontFamily: HAND_FONT }}>{daily.taskDone ? "✅ " : "💬 "}{daily.taskComment}</div>}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                {daily.taskDone
                  ? <span style={{ fontSize: 11, fontWeight: 800, color: "#3f9d63" }}>今日已完成</span>
                  : <button type="button" disabled={judging} onClick={checkTask}
                      style={{ border: 0, borderRadius: 12, padding: "8px 16px", fontSize: 11, fontWeight: 800, color: "#fff", background: "linear-gradient(135deg,#f06292,#d16a8d)", boxShadow: "0 4px 12px rgba(233,30,99,.3)", opacity: judging ? .6 : 1 }}>
                      {judging ? `${character.name}驗收中…` : `去聊天完成後，請${character.name}驗收`}
                    </button>}
                <span style={{ marginLeft: "auto", fontSize: 9.5, color: "#c093a4" }}>連續 7 天加碼 ×3 · 目前連續 {daily.streak || 0} 天</span>
              </div>
            </>
          )}
        </SectionCard>

        {notice && <div style={{ textAlign: "center", fontSize: 11, fontWeight: 800, color: "#a2652f", marginTop: 10 }}>{notice}</div>}

        {/* 功能入口 */}
        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button type="button" onClick={() => setView("memories")}
            style={{ ...GLASS, flex: 1, borderRadius: 16, padding: "13px 10px", textAlign: "center", boxShadow: "0 5px 16px rgba(200,110,140,.13)" }}>
            <div style={{ fontSize: 19 }}>📖</div>
            <div style={{ fontSize: 11, fontWeight: 900, color: "#7a4257", marginTop: 4 }}>我們的回憶</div>
            <div style={{ fontSize: 9, color: "#a86e84", marginTop: 2 }}>{allMemories.length ? `✦ ${allMemories.length} 段` : "還沒有"}</div>
          </button>
          <button type="button" disabled style={{ ...GLASS, flex: 1, borderRadius: 16, padding: "13px 10px", textAlign: "center", opacity: .55 }}>
            <div style={{ fontSize: 19 }}>🎁</div>
            <div style={{ fontSize: 11, fontWeight: 900, color: "#7a4257", marginTop: 4 }}>交換禮物</div>
            <div style={{ fontSize: 9, color: "#a86e84", marginTop: 2 }}>即將推出</div>
          </button>
          <button type="button" disabled style={{ ...GLASS, flex: 1, borderRadius: 16, padding: "13px 10px", textAlign: "center", opacity: .55 }}>
            <div style={{ fontSize: 19 }}>🤞</div>
            <div style={{ fontSize: 11, fontWeight: 900, color: "#7a4257", marginTop: 4 }}>約定</div>
            <div style={{ fontSize: 9, color: "#a86e84", marginTop: 2 }}>即將推出</div>
          </button>
        </div>
      </div>
    </div>
  );
}
