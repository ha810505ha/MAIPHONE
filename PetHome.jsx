import React, { useEffect, useMemo, useRef, useState } from "react";
import "./styles/petHome.css";
import "./styles/petWorld.css";
import "./styles/petSettings.css";
import "./styles/petProfile.css";
import "./styles/petRoomDrag.css";
import "./styles/petManualAnimation.css";
import "./styles/petSprites.css";
import "./styles/petTiming.css";
import "./styles/petBubbleFollow.css";
import "./styles/petScale.css";
import "./styles/petProfileEditor.css";
import "./styles/petSettingSelect.css";
import "./styles/petProgress.css";
import "./styles/petData.css";
import "./styles/petDiary.css";
import { loadPetStorage, savePetHome, savePetSettingsPatch, DEFAULT_PET_SETTINGS } from "./services/pet/petStorage";
import { MILESTONES, MILESTONE_ORDER, evaluateMilestones, normalizePetHome, companionDays, formatDiaryDate, withDayLog, isDayLogWorthWriting, birthdayLine, bondTier, DAILY_BOND_CAP, afkPenalty, afkGreeting, afkDiaryEntries, AFK_MILESTONES, AFK_MILESTONE_ORDER } from "./services/pet/petDiary";
import { generateMilestoneTexts, generateLifeDiary, generateBirthdayDiary, generateNoteReply, generateEntryReply } from "./services/pet/petDiaryAiBridge";
import { petLine } from "./services/pet/petLines";
import { downloadJsonFile } from "./utils/exportFile";

const ACTIONS = {
  feed: { label: "餵食", icon: "🥕", message: "好好吃！", fullMessage: "肚子已經飽飽的～", stat: "hunger", exp: 5, delta: { hunger: 22, mood: 3 }, coins: 2, duration: 3000 },
  play: { label: "玩耍", icon: "🧶", message: "再玩一次！", fullMessage: "今天已經玩得超開心了！", stat: "mood", exp: 6, delta: { mood: 20, energy: -10 }, coins: 3, duration: 3000 },
  clean: { label: "洗澡", icon: "🫧", message: "香噴噴～", fullMessage: "我已經乾乾淨淨啦～", stat: "clean", exp: 8, delta: { clean: 24, mood: -2 }, coins: 2, duration: 3500 },
  sleep: { label: "休息", icon: "🌙", message: "晚安……", fullMessage: "精神滿滿，還不想睡～", stat: "energy", exp: 5, delta: { energy: 26, hunger: -5 }, coins: 1, duration: 5000 },
};

const FURNITURE = [
  { id: "bed", name: "雲朵小床", icon: "🛏️", slot: "left", price: 0 },
  { id: "plant", name: "森林盆栽", icon: "🪴", slot: "right", price: 0 },
  { id: "lamp", name: "暖光立燈", icon: "💡", slot: "right", price: 12 },
  { id: "sofa", name: "奶油沙發", icon: "🛋️", slot: "left", price: 18 },
  { id: "toy", name: "玩具小馬", icon: "🦄", slot: "floor", price: 10 },
  { id: "cushion", name: "草莓坐墊", icon: "🍓", slot: "floor", price: 8 },
];

const INITIAL = {
  hunger: 72, mood: 84, clean: 65, energy: 78, coins: 24, level: 3, exp: 0,
  owned: ["bed", "plant"], placed: { left: "bed", right: "plant", floor: null },
  petProfile: { name: "麻糬", birthday: "", species: "長毛小狗", gender: "未設定", primaryPersonality: "黏人", secondaryPersonality: "貪吃、好奇", likes: "摸摸、肉肉、公園", dislikes: "洗澡太久、打雷" },
};

const clamp = (value) => Math.max(0, Math.min(100, value));

function PetHomeRuntime({ onClose, initialData, initialSettings, apiConfig }) {
  const [data, setData] = useState(() => normalizePetHome({ ...INITIAL, ...initialData, petProfile: { ...INITIAL.petProfile, ...(initialData?.petProfile || {}) } }));
  const [tab, setTab] = useState("home");
  const [message, setMessage] = useState("今天也要一起開心喔！");
  const [anim, setAnim] = useState("");
  const [scene, setScene] = useState("home");
  const [showScenes, setShowScenes] = useState(false);
  const [petSpot, setPetSpot] = useState(1);
  const [settings, setSettings] = useState(() => initialSettings);
  const [roomPetPosition, setRoomPetPosition] = useState(null);
  const [roomDragging, setRoomDragging] = useState(false);
  const [walkFrame, setWalkFrame] = useState(1);
  const [roomWalking, setRoomWalking] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [viewingGrowth, setViewingGrowth] = useState(false);
  const [profileDraft, setProfileDraft] = useState(() => ({ ...data.petProfile }));
  const [writingDiary, setWritingDiary] = useState(false);
  const [diaryDraft, setDiaryDraft] = useState({ title: "", text: "" });
  const [noteEditingId, setNoteEditingId] = useState(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [actionsOpenId, setActionsOpenId] = useState(null);
  const [dataNotice, setDataNotice] = useState("");
  const roomDragRef = useRef(null);
  const roomLongPressRef = useRef(null);
  const roomResumeRef = useRef(null);
  const roomWalkStopRef = useRef(null);
  const roomDragRafRef = useRef(null);
  const pendingRoomDragPointRef = useRef(null);
  const animTimerRef = useRef(null);
  const petDataImportRef = useRef(null);
  const suppressPetClickRef = useRef(false);
  const aiMilestoneBusyRef = useRef(false);
  const aiLifeBusyRef = useRef(false);

  const aiEnabled = settings.aiDiary !== false && Boolean(apiConfig?.apiKey);

  const playAnim = (name, duration) => {
    clearTimeout(animTimerRef.current);
    setAnim(name);
    if (duration) animTimerRef.current = setTimeout(() => setAnim(""), duration);
  };

  useEffect(() => { savePetHome(data).catch((error) => console.error("[pet] 小屋存檔失敗", error)); }, [data]);
  useEffect(() => {
    const timer = setInterval(() => setWalkFrame((frame) => frame % 3 + 1), 800);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => { savePetSettingsPatch(settings).then(() => window.dispatchEvent(new Event("pet-settings-changed"))).catch((error) => console.error("[pet] 設定保存失敗", error)); }, [settings]);
  useEffect(() => {
    const timer = setInterval(() => setData((old) => evaluateMilestones({ ...old, hunger: clamp(old.hunger - 1), clean: clamp(old.clean - 1) })), 60000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (tab !== "home" || anim || roomDragging || roomPetPosition || !settings.autoWander) return undefined;
    const wander = () => setPetSpot((current) => {
      setRoomWalking(true);
      clearTimeout(roomWalkStopRef.current);
      roomWalkStopRef.current = setTimeout(() => setRoomWalking(false), 2800);
      const choices = [0, 1, 2].filter((spot) => spot !== current);
      return choices[Math.floor(Math.random() * choices.length)];
    });
    const first = setTimeout(wander, 2600);
    const timer = setInterval(wander, 5200);
    return () => { clearTimeout(first); clearInterval(timer); };
  }, [tab, scene, anim, roomDragging, roomPetPosition, settings.autoWander]);

  useEffect(() => () => {
    clearTimeout(roomLongPressRef.current);
    clearTimeout(roomResumeRef.current);
    clearTimeout(roomWalkStopRef.current);
    clearTimeout(animTimerRef.current);
    if (roomDragRafRef.current) cancelAnimationFrame(roomDragRafRef.current);
  }, []);

  // 開啟小屋時：跨日活動流水歸檔＋久違回歸的冷落扣分與寵物對話
  // 扣分在 updater 內以最新狀態重算（lastCareAt 扣過即重置），StrictMode 重跑或重複開啟都不會多扣
  useEffect(() => {
    const idleDays = Math.floor((Date.now() - (Number(data.lastCareAt) || Date.now())) / 86400000);
    if (afkPenalty(idleDays)) {
      setMessage(afkGreeting(idleDays, data.petProfile));
      playAnim("pet", 2600);
    }
    setData((old) => {
      const idle = Math.floor((Date.now() - (Number(old.lastCareAt) || Date.now())) / 86400000);
      const penalty = afkPenalty(idle);
      if (!penalty) return withDayLog(old);
      const milestones = { ...old.milestones };
      [3, 5, 10, 15].forEach((days) => { if (idle >= days && !milestones[`afk${days}`]) milestones[`afk${days}`] = Number(old.lastCareAt) + days * 86400000; });
      return withDayLog({ ...old, bond: clamp((Number(old.bond) || 0) - penalty), lastCareAt: Date.now(), milestones, diary: [...afkDiaryEntries(idle, old.lastCareAt, old.petProfile), ...(old.diary || [])] });
    });
  }, []);

  // 里程碑 AI 潤飾：公版先上（aiPending），背景批次請 AI 依個性重寫；失敗保留公版、24 小時內下次再試
  useEffect(() => {
    if (!aiEnabled || aiMilestoneBusyRef.current) return;
    const now = Date.now();
    const fresh = (entry) => now - entry.at <= 86400000;
    if ((data.diary || []).some((entry) => entry.aiPending && entry.milestone && !fresh(entry))) {
      setData((old) => ({ ...old, diary: (old.diary || []).map((entry) => entry.aiPending && entry.milestone && !fresh(entry) ? { ...entry, aiPending: false } : entry) }));
      return;
    }
    const pending = (data.diary || []).filter((entry) => entry.aiPending && entry.milestone);
    if (!pending.length) return;
    aiMilestoneBusyRef.current = true;
    generateMilestoneTexts(pending.map((entry) => entry.milestone), data, apiConfig)
      .then((texts) => { if (texts) setData((old) => ({ ...old, diary: (old.diary || []).map((entry) => entry.aiPending && texts[entry.milestone] ? { ...entry, text: texts[entry.milestone], aiPending: false } : entry) })); })
      .finally(() => { aiMilestoneBusyRef.current = false; });
  }, [aiEnabled, data.diary]);

  // 有料才寫：昨天互動夠多、有出門或主人有手寫日記，才以寵物視角補一篇日常日記
  useEffect(() => {
    if (!aiEnabled || aiLifeBusyRef.current) return;
    const prev = data.prevDayLog;
    if (!prev || data.lastLifeDiaryFor === prev.date) return;
    if (!isDayLogWorthWriting(prev)) { setData((old) => ({ ...old, lastLifeDiaryFor: prev.date })); return; }
    aiLifeBusyRef.current = true;
    generateLifeDiary(prev, data, apiConfig)
      .then((text) => {
        if (!text) return;
        const at = Date.now();
        setData((old) => old.lastLifeDiaryFor === prev.date ? old : { ...old, lastLifeDiaryFor: prev.date, diary: [{ id: `life-${at}`, at, type: "life", icon: "📖", title: "小小的一天", text, note: "" }, ...(old.diary || [])] });
      })
      .finally(() => { aiLifeBusyRef.current = false; });
  }, [aiEnabled, data.prevDayLog, data.lastLifeDiaryFor]);

  // 生日日記：公版立即上，AI 成功再替換，一年一篇
  useEffect(() => {
    const birthday = data.petProfile?.birthday;
    if (!birthday) return;
    const [, month, day] = birthday.split("-").map(Number);
    const today = new Date();
    if (today.getMonth() + 1 !== month || today.getDate() !== day) return;
    const key = `bday-${today.getFullYear()}`;
    if (data.milestones?.[key]) return;
    const at = Date.now();
    const entryId = `life-bday-${at}`;
    setData((old) => old.milestones?.[key] ? old : { ...old, milestones: { ...old.milestones, [key]: at }, diary: [{ id: entryId, at, type: "life", icon: "🎂", title: "我的生日！", text: birthdayLine(old.petProfile), note: "" }, ...(old.diary || [])] });
    if (aiEnabled) generateBirthdayDiary(data, apiConfig).then((text) => { if (text) setData((old) => ({ ...old, diary: (old.diary || []).map((entry) => entry.id === entryId ? { ...entry, text } : entry) })); });
  }, [data.petProfile?.birthday]);

  const onRoomPetPointerDown = (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    const pointerTarget = event.currentTarget;
    const pointerId = event.pointerId;
    clearTimeout(roomResumeRef.current);
    clearTimeout(roomWalkStopRef.current);
    setRoomWalking(false);
    const petRect = event.currentTarget.getBoundingClientRect();
    const roomRect = event.currentTarget.closest(".pet-room")?.getBoundingClientRect();
    roomDragRef.current = { offsetX: event.clientX - petRect.left, offsetY: event.clientY - petRect.top, left: roomRect?.left || 0, top: roomRect?.top || 0, width: roomRect?.width || 354, height: roomRect?.height || 320 };
    roomLongPressRef.current = setTimeout(() => {
      if (!roomDragRef.current) return;
      suppressPetClickRef.current = true;
      setRoomPetPosition({ x: petRect.left - (roomRect?.left || 0), y: petRect.top - (roomRect?.top || 0) });
      setRoomDragging(true);
      playAnim("grabbed");
      pointerTarget?.setPointerCapture?.(pointerId);
    }, 360);
  };
  const onRoomPetPointerMove = (event) => {
    if (!roomDragging || !roomDragRef.current) return;
    event.preventDefault();
    pendingRoomDragPointRef.current = { clientX: event.clientX, clientY: event.clientY };
    if (roomDragRafRef.current) return;
    roomDragRafRef.current = requestAnimationFrame(() => {
      roomDragRafRef.current = null;
      const point = pendingRoomDragPointRef.current;
      const info = roomDragRef.current;
      if (!point || !info) return;
      setRoomPetPosition({
        x: Math.max(0, Math.min(info.width - 158, point.clientX - info.left - info.offsetX)),
        y: Math.max(0, Math.min(info.height - 174, point.clientY - info.top - info.offsetY)),
      });
    });
  };
  const onRoomPetPointerUp = (event) => {
    clearTimeout(roomLongPressRef.current);
    if (roomDragRafRef.current) {
      cancelAnimationFrame(roomDragRafRef.current);
      roomDragRafRef.current = null;
    }
    pendingRoomDragPointRef.current = null;
    if (roomDragging) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      setRoomDragging(false); playAnim("pet", 1300); setMessage("放在這裡嗎？好呀～");
      roomResumeRef.current = setTimeout(() => {
        setRoomPetPosition(null);
        setRoomWalking(true);
        clearTimeout(roomWalkStopRef.current);
        roomWalkStopRef.current = setTimeout(() => setRoomWalking(false), 2800);
        setPetSpot((current) => {
          const choices = [0, 1, 2].filter((spot) => spot !== current);
          return choices[Math.floor(Math.random() * choices.length)];
        });
      }, 3000);
      setTimeout(() => { suppressPetClickRef.current = false; }, 100);
    }
    roomDragRef.current = null;
  };

  const petMood = useMemo(() => {
    const average = (data.hunger + data.mood + data.clean + data.energy) / 4;
    return average > 72 ? "開心" : average > 45 ? "平靜" : "需要照顧";
  }, [data]);

  const act = (key) => {
    const action = ACTIONS[key];
    const old = data;
    const earnsReward = old[action.stat] < 100;
    let level = Number(old.level) || 1;
    let exp = Number(old.exp) || 0;
    let levelCoins = 0;
    if (earnsReward) exp += action.exp;
    let needed = 50 + (level - 1) * 25;
    while (exp >= needed) { exp -= needed; level += 1; needed = 50 + (level - 1) * 25; levelCoins += level * 5; }
    const next = { ...old, level, exp, coins: old.coins + (earnsReward ? action.coins : 0) + levelCoins };
    Object.entries(action.delta).forEach(([field, amount]) => { next[field] = clamp(old[field] + amount); });
    next.counters = { ...old.counters, [key]: (old.counters?.[key] || 0) + 1 };
    next.lastCareAt = Date.now();
    let bondGained = false;
    const logged = withDayLog(next, (log) => {
      log.acts[key] = (log.acts[key] || 0) + 1;
      if (earnsReward && (log.bondGained || 0) < DAILY_BOND_CAP) { log.bondGained = (log.bondGained || 0) + 1; bondGained = true; }
    });
    if (bondGained) logged.bond = clamp((Number(old.bond) || 0) + 1);
    setData(evaluateMilestones(logged));
    setMessage(levelCoins ? `我升到 Lv.${level} 了！獲得 ${levelCoins} 星星幣✨` : earnsReward ? (petLine(key, old.petProfile) || action.message) : action.fullMessage);
    playAnim(key, action.duration);
    setPetSpot(1);
  };

  const buyOrPlace = (item) => {
    if (!data.owned.includes(item.id)) {
      if (data.coins < item.price) { setMessage("星星幣不夠，再陪我玩一下吧！"); return; }
      setData((old) => ({ ...old, coins: old.coins - item.price, owned: [...old.owned, item.id], placed: { ...old.placed, [item.slot]: item.id } }));
      setMessage(`獲得「${item.name}」！`);
      return;
    }
    setData((old) => ({ ...old, placed: { ...old.placed, [item.slot]: old.placed[item.slot] === item.id ? null : item.id } }));
    setMessage("房間布置完成！");
  };

  const placedItem = (slot) => FURNITURE.find((item) => item.id === data.placed[slot]);
  const petName = data.petProfile?.name?.trim() || "麻糬";
  const expNeeded = 50 + ((Number(data.level) || 1) - 1) * 25;
  const getSceneLine = (id) => petLine(`scene-${id}`, data.petProfile) || petLine("scene-home", data.petProfile);
  const saveProfile = () => {
    const next = { ...profileDraft, name: profileDraft.name.trim() || "麻糬" };
    setData((old) => ({ ...old, petProfile: next }));
    setProfileDraft(next);
    setEditingProfile(false);
    setMessage(`以後請叫我「${next.name}」！`);
  };
  const saveDiaryEntry = () => {
    const text = diaryDraft.text.trim();
    if (!text) return;
    const at = Date.now();
    const entry = { id: `user-${at}`, at, type: "user", icon: "✍️", title: diaryDraft.title.trim() || "我的記事", text, note: "" };
    setData((old) => withDayLog({ ...old, diary: [entry, ...(old.diary || [])] }, (log) => { log.notes.push(text.slice(0, 100)); }));
    setDiaryDraft({ title: "", text: "" });
    setWritingDiary(false);
    if (aiEnabled) generateEntryReply(entry, data, apiConfig).then((reply) => { if (reply) setData((old) => ({ ...old, diary: (old.diary || []).map((item) => item.id === entry.id ? { ...item, reply } : item) })); });
  };
  const saveEditedEntry = () => {
    const text = diaryDraft.text.trim();
    if (!text) return;
    const entryId = editingEntryId;
    const title = diaryDraft.title.trim() || "我的記事";
    setData((old) => ({ ...old, diary: (old.diary || []).map((entry) => entry.id === entryId ? { ...entry, title, text } : entry) }));
    setEditingEntryId(null);
    setDiaryDraft({ title: "", text: "" });
    if (aiEnabled) generateEntryReply({ title, text }, data, apiConfig).then((reply) => { if (reply) setData((old) => ({ ...old, diary: (old.diary || []).map((item) => item.id === entryId ? { ...item, reply } : item) })); });
  };
  const deleteDiaryEntry = (id) => {
    setData((old) => ({ ...old, diary: (old.diary || []).filter((entry) => entry.id !== id) }));
    setConfirmDeleteId(null);
  };
  const saveDiaryNote = (id) => {
    const note = noteDraft.trim();
    setData((old) => ({ ...old, diary: (old.diary || []).map((entry) => entry.id === id ? { ...entry, note, reply: note ? entry.reply : undefined } : entry) }));
    setNoteEditingId(null);
    setNoteDraft("");
    const entry = (data.diary || []).find((item) => item.id === id);
    if (aiEnabled && note && entry) generateNoteReply(entry, note, data, apiConfig).then((reply) => { if (reply) setData((old) => ({ ...old, diary: (old.diary || []).map((item) => item.id === id && item.note ? { ...item, reply } : item) })); });
  };
  const memoriesCount = (data.diary || []).filter((entry) => entry.type === "auto").length;
  const exportPetData = async () => {
    const payload = { type: "maliphone-pet-home", version: 1, exportedAt: new Date().toISOString(), data, settings };
    try {
      const result = await downloadJsonFile(payload, `pet-home-${petName}-${new Date().toISOString().slice(0, 10)}.json`);
      if (result.method === "cancelled") return;
      setDataNotice(result.method === "native-filesystem" ? `寵物資料已匯出到 Documents/${result.path}` : "寵物資料已匯出");
    } catch (error) {
      setDataNotice(`匯出失敗：${error?.message || "Unknown error"}`);
    }
  };
  const importPetData = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      if (payload?.type !== "maliphone-pet-home" || !payload.data || typeof payload.data !== "object") throw new Error("invalid");
      const nextData = normalizePetHome({ ...INITIAL, ...payload.data, petProfile: { ...INITIAL.petProfile, ...(payload.data.petProfile || {}) } });
      const nextSettings = { ...DEFAULT_PET_SETTINGS, ...(payload.settings || {}) };
      setData(nextData);
      setSettings(nextSettings);
      setProfileDraft({ ...nextData.petProfile });
      setDataNotice("匯入成功，寵物資料已恢復");
    } catch (_) {
      setDataNotice("匯入失敗：不是有效的寵物小屋備份檔");
    }
  };
  const roomSprite = roomDragging || anim === "grabbed" ? "grabbed" : anim === "pet" ? "happy" : anim === "feed" ? "eat" : anim === "play" ? "play" : anim === "clean" ? "bath" : anim === "sleep" ? "sleep" : roomWalking ? `walk-${walkFrame}` : "idle";
  const bubblePosition = roomPetPosition
    ? { left: 0, top: 0, translate: `${Math.max(72, Math.min(282, roomPetPosition.x + 79))}px ${Math.max(8, roomPetPosition.y - 38)}px` }
    : { left: `${[25, 50, 75][petSpot]}%`, top: 104 };
  return (
    <div className="pet-app" style={{ position: "absolute", inset: 0, zIndex: 40, width: "100%", height: "100%", background: "#fff8ec" }}>
      <header className="pet-header">
        <button className="pet-circle-btn" onClick={tab === "settings" ? () => setTab("home") : onClose} aria-label="返回">‹</button>
        <div><strong>{tab === "settings" ? "小屋設定" : "寵物小屋"}</strong><span>{tab === "settings" ? "管理寵物與遊戲偏好" : `和${petName}一起生活`}</span></div>
        {tab !== "settings" && <button className="pet-settings-button" onClick={() => setTab("settings")} aria-label="寵物小屋設定">⚙️</button>}
        <div className="pet-coins">⭐ {data.coins}</div>
      </header>

      <main className="pet-main">
        {tab === "home" && <>
          <section className="pet-status-card">
            <div className="pet-name"><span>{petName}</span><small>Lv. {data.level} · {petMood}</small></div>
            <div className="pet-bars">
              {[["hunger","飽食","🥕"],["mood","心情","💗"],["clean","清潔","🫧"],["energy","精神","⚡"]].map(([key,label,icon]) =>
                <div className="pet-bar" key={key}><span>{icon}</span><div><small>{label}</small><i><b style={{width:`${data[key]}%`}} /></i></div></div>
              )}
            </div>
          </section>

          <section className={`pet-room pet-scene-${scene}`}>
            <button className="pet-map-button" onClick={() => setShowScenes((value) => !value)}>🗺️ {scene === "home" ? "小屋" : scene === "park" ? "公園" : "海邊"}</button>
            {showScenes && <div className="pet-scene-picker">
              {[["home","🏠","小屋"],["park","🌳","公園"],["beach","🏖️","海邊"]].map(([id, icon, name]) => <button key={id} className={scene === id ? "active" : ""} onClick={() => { setScene(id); setShowScenes(false); setPetSpot(1); setRoomPetPosition(null); setMessage(getSceneLine(id)); setData((old) => evaluateMilestones(withDayLog({ ...old, sceneVisits: { ...old.sceneVisits, [id]: true } }, (log) => { if (!log.scenes.includes(id)) log.scenes.push(id); }))); }}><span>{icon}</span>{name}</button>)}
            </div>}
            <div className="pet-window"><span>☁️</span><span>☀️</span></div>
            <div className="pet-wall-art">♡ HOME</div>
            {placedItem("left") && <button className="pet-furniture pet-left" onClick={() => buyOrPlace(placedItem("left"))}>{placedItem("left").icon}</button>}
            {placedItem("right") && <button className="pet-furniture pet-right" onClick={() => buyOrPlace(placedItem("right"))}>{placedItem("right").icon}</button>}
            {placedItem("floor") && <button className="pet-furniture pet-floor-item" onClick={() => buyOrPlace(placedItem("floor"))}>{placedItem("floor").icon}</button>}
            <div className={`pet-bubble ${roomWalking ? "is-following" : ""} ${roomDragging ? "is-dragging" : ""}`} style={bubblePosition}>{message}</div>
            <div className={`pet-scene-decor decor-${scene}`} aria-hidden="true"><span /><i /><b /></div>
            <button className={`pet-character pet-spot-${petSpot} ${anim ? anim : roomWalking ? "wandering" : "idle"} ${roomDragging ? "room-is-dragging" : ""} ${roomPetPosition ? "pet-manual-position" : ""}`} style={roomPetPosition ? { left: 0, top: 0, bottom: "auto", translate: `${roomPetPosition.x}px ${roomPetPosition.y}px`, transform: "none", transition: roomDragging ? "none" : undefined, willChange: roomDragging ? "translate" : undefined } : undefined} onPointerDown={onRoomPetPointerDown} onPointerMove={onRoomPetPointerMove} onPointerUp={onRoomPetPointerUp} onPointerCancel={onRoomPetPointerUp} onClick={() => { if (suppressPetClickRef.current) return; setMessage(petLine("petting", data.petProfile)); playAnim("pet", 2000); }} aria-label="長按拖曳麻糬">
              <img className="pet-sprite-image" src={`./pet-assets/${roomSprite}.png`} alt={petName} draggable={false} />
            </button>
            <div className="pet-rug" />
          </section>

          <section className="pet-actions">
            {Object.entries(ACTIONS).map(([key, action]) => <button key={key} onClick={() => act(key)}><span>{action.icon}</span>{action.label}</button>)}
          </section>
        </>}

        {tab === "decorate" && <section className="pet-panel pet-coming-soon"><div className="pet-coming-icon">🪑</div><strong>小屋布置準備中</strong><p>我們正在準備與寵物風格一致的新家具，之後再一起打造溫暖的小屋吧！</p><span>COMING SOON</span></section>}

        {tab === "album" && <section className="pet-panel pet-diary">
          <div className="pet-panel-title"><div><strong>{petName}日記</strong><span>牠會自己記下你們的小日常</span></div><button className="pet-diary-write" onClick={() => { setWritingDiary((value) => !value); setNoteEditingId(null); setEditingEntryId(null); setConfirmDeleteId(null); setActionsOpenId(null); setDiaryDraft({ title: "", text: "" }); }}>{writingDiary ? "收起" : "✏️ 寫日記"}</button></div>
          {writingDiary && <div className="pet-diary-editor">
            <input maxLength={20} value={diaryDraft.title} onChange={(e) => setDiaryDraft((old) => ({ ...old, title: e.target.value }))} placeholder="標題（可留空）" />
            <textarea maxLength={300} value={diaryDraft.text} onChange={(e) => setDiaryDraft((old) => ({ ...old, text: e.target.value }))} placeholder={`記下今天和${petName}的小事…`} />
            <div className="pet-diary-editor-actions"><button onClick={() => { setWritingDiary(false); setDiaryDraft({ title: "", text: "" }); }}>取消</button><button className="primary" disabled={!diaryDraft.text.trim()} onClick={saveDiaryEntry}>存進日記</button></div>
          </div>}
          {(data.diary || []).map((entry) => <article key={entry.id} className={`pet-diary-entry ${entry.type}`}>
            <header><span className="pet-diary-icon">{entry.icon}</span><div><strong>{entry.title}</strong><small>{formatDiaryDate(entry.at)}{entry.type === "user" ? " · 手寫" : ""}</small></div></header>
            {editingEntryId !== entry.id && <p>{entry.text}</p>}
            {editingEntryId === entry.id && <div className="pet-diary-editor pet-diary-note-editor">
              <input maxLength={20} value={diaryDraft.title} onChange={(e) => setDiaryDraft((old) => ({ ...old, title: e.target.value }))} placeholder="標題（可留空）" />
              <textarea maxLength={300} value={diaryDraft.text} onChange={(e) => setDiaryDraft((old) => ({ ...old, text: e.target.value }))} placeholder={`記下今天和${petName}的小事…`} />
              <div className="pet-diary-editor-actions"><button onClick={() => { setEditingEntryId(null); setDiaryDraft({ title: "", text: "" }); }}>取消</button><button className="primary" disabled={!diaryDraft.text.trim()} onClick={saveEditedEntry}>儲存</button></div>
            </div>}
            {entry.note && noteEditingId !== entry.id && <div className="pet-diary-note">📝 {entry.note}</div>}
            {entry.reply && (entry.type === "user" || entry.note) && noteEditingId !== entry.id && editingEntryId !== entry.id && <div className="pet-diary-reply">🐾 {entry.reply}</div>}
            {entry.type !== "user" && noteEditingId !== entry.id && <button className="pet-diary-note-btn" onClick={() => { setNoteEditingId(entry.id); setNoteDraft(entry.note || ""); setWritingDiary(false); setEditingEntryId(null); setConfirmDeleteId(null); }}>{entry.note ? "編輯註記" : "＋補寫幾句"}</button>}
            {entry.type === "user" && editingEntryId !== entry.id && <div className="pet-diary-entry-actions">
              {actionsOpenId === entry.id && (confirmDeleteId === entry.id ? <>
                <span>確定刪除這篇記事？</span>
                <button className="danger" onClick={() => deleteDiaryEntry(entry.id)}>刪除</button>
                <button onClick={() => setConfirmDeleteId(null)}>取消</button>
              </> : <>
                <button onClick={() => { setEditingEntryId(entry.id); setDiaryDraft({ title: entry.title, text: entry.text }); setWritingDiary(false); setNoteEditingId(null); setConfirmDeleteId(null); setActionsOpenId(null); }}>編輯</button>
                <button className="danger" onClick={() => setConfirmDeleteId(entry.id)}>刪除</button>
              </>)}
              <button className="pet-diary-pen" aria-label="編輯或刪除這篇記事" onClick={() => { setActionsOpenId((open) => open === entry.id ? null : entry.id); setConfirmDeleteId(null); }}>{actionsOpenId === entry.id ? "✕" : "✏️"}</button>
            </div>}
            {noteEditingId === entry.id && <div className="pet-diary-editor pet-diary-note-editor">
              <textarea maxLength={200} value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder="幫這段回憶補寫幾句…" />
              <div className="pet-diary-editor-actions"><button onClick={() => { setNoteEditingId(null); setNoteDraft(""); }}>取消</button><button className="primary" onClick={() => saveDiaryNote(entry.id)}>儲存</button></div>
            </div>}
          </article>)}
          <div className="pet-diary-locked"><span>🔒</span>繼續互動、升級與到處冒險，會解鎖更多回憶（{memoriesCount} / {MILESTONE_ORDER.length}）</div>
        </section>}

        {tab === "pets" && <section className="pet-pets-panel">
          {!editingProfile && !viewingGrowth && <>
            <div className="pet-panel-title"><div><strong>我的寵物</strong><span>查看資料、成長紀錄與切換夥伴</span></div><span>1 隻</span></div>
            <article className="pet-profile-card"><div className="pet-profile-avatar"><img src="./pet-assets/idle.png" alt={petName} /></div><div className="pet-profile-info"><small>目前的夥伴</small><strong>{petName}</strong><span>{data.petProfile.species} · Lv. {data.level}</span></div><em>相伴 {companionDays(data.adoptedAt)} 天</em></article>
            <div className="pet-exp-card"><div><b>Lv. {data.level}</b><span>{data.exp} / {expNeeded} EXP</span></div><i><b style={{width:`${Math.min(100, data.exp / expNeeded * 100)}%`}} /></i></div>
            <div className="pet-profile-stats"><div><strong>{Math.round(Number(data.bond) || 0)}</strong><span>親密度 · {bondTier(data.bond)}</span></div><div><strong>{data.level}</strong><span>成長等級</span></div><div><strong>{memoriesCount}</strong><span>解鎖回憶</span></div></div>
            <div className="pet-bond-hint">今日親密度 {Math.min(data.dayLog?.date === formatDiaryDate(Date.now()) ? (data.dayLog?.bondGained || 0) : 0, DAILY_BOND_CAP)} / {DAILY_BOND_CAP}</div>
            <div className="pet-setting-group pet-management-list">
              <button className="pet-setting-row" onClick={() => { setProfileDraft({ ...data.petProfile }); setEditingProfile(true); }}><span><b>基本資料</b><small>名字、生日、品種與個性</small></span><i>›</i></button>
              <button className="pet-setting-row" onClick={() => setViewingGrowth(true)}><span><b>成長紀錄</b><small>查看相遇以來的里程碑</small></span><i>›</i></button>
            </div>
            <button className="pet-add-pet"><span>＋</span><div><strong>迎接新寵物</strong><small>未來可在這裡新增或切換寵物</small></div></button>
          </>}
          {viewingGrowth && !editingProfile && <div className="pet-growth">
            <div className="pet-editor-heading"><button onClick={() => setViewingGrowth(false)}>‹</button><div><strong>成長紀錄</strong><span>和{petName}相遇以來的里程碑</span></div></div>
            <ul className="pet-growth-list">
              {MILESTONE_ORDER.filter((key) => data.milestones?.[key]).map((key) => {
                const milestone = MILESTONES[key];
                const at = data.milestones[key];
                return <li key={key} className="done"><span>{milestone.icon}</span><div><strong>{milestone.title}</strong><small>{formatDiaryDate(at)}</small></div><i>✓</i></li>;
              })}
              {MILESTONE_ORDER.some((key) => !data.milestones?.[key]) && <li className="pet-growth-divider">還有 {MILESTONE_ORDER.filter((key) => !data.milestones?.[key]).length} 個里程碑，等你們一起去發現</li>}
              {AFK_MILESTONE_ORDER.some((key) => data.milestones?.[key]) && <li className="pet-growth-divider">也有一些安靜的日子，牠都記著</li>}
              {AFK_MILESTONE_ORDER.filter((key) => data.milestones?.[key]).map((key) => {
                const milestone = AFK_MILESTONES[key];
                return <li key={key} className="done afk"><span>{milestone.icon}</span><div><strong>{milestone.title}</strong><small>{milestone.hint} · {formatDiaryDate(data.milestones[key])}</small></div></li>;
              })}
            </ul>
          </div>}
          {editingProfile && <div className="pet-profile-editor">
            <div className="pet-editor-heading"><button onClick={() => setEditingProfile(false)}>‹</button><div><strong>基本資料</strong><span>建立專屬於牠的個性</span></div></div>
            <label><span>名字</span><input maxLength={12} value={profileDraft.name} onChange={(e) => setProfileDraft((old) => ({ ...old, name: e.target.value }))} placeholder="輸入寵物名字" /></label>
            <label><span>生日</span><input type="date" value={profileDraft.birthday} onChange={(e) => setProfileDraft((old) => ({ ...old, birthday: e.target.value }))} /></label>
            <label><span>品種</span><input maxLength={20} value={profileDraft.species} onChange={(e) => setProfileDraft((old) => ({ ...old, species: e.target.value }))} /></label>
            <label><span>性別</span><select value={profileDraft.gender} onChange={(e) => setProfileDraft((old) => ({ ...old, gender: e.target.value }))}><option>未設定</option><option>男生</option><option>女生</option></select></label>
            <label><span>主要個性</span><select value={profileDraft.primaryPersonality} onChange={(e) => setProfileDraft((old) => ({ ...old, primaryPersonality: e.target.value }))}><option>黏人</option><option>活潑</option><option>貪吃</option><option>慵懶</option><option>害羞</option><option>溫柔</option><option>調皮</option></select></label>
            <label><span>次要個性</span><input maxLength={30} value={profileDraft.secondaryPersonality} onChange={(e) => setProfileDraft((old) => ({ ...old, secondaryPersonality: e.target.value }))} placeholder="例如：貪吃、好奇" /></label>
            <label><span>喜歡的事</span><textarea maxLength={80} value={profileDraft.likes} onChange={(e) => setProfileDraft((old) => ({ ...old, likes: e.target.value }))} placeholder="例如：摸摸、肉肉、公園" /></label>
            <label><span>討厭的事</span><textarea maxLength={80} value={profileDraft.dislikes} onChange={(e) => setProfileDraft((old) => ({ ...old, dislikes: e.target.value }))} placeholder="例如：打雷、洗澡太久" /></label>
            <div className="pet-editor-actions"><button onClick={() => setEditingProfile(false)}>取消</button><button onClick={saveProfile}>儲存資料</button></div>
          </div>}
        </section>}

        {tab === "settings" && <section className="pet-settings-panel">
          <div className="pet-setting-group"><h3>🗺️ 地圖與活動</h3>
            <button className="pet-setting-row" onClick={() => { setTab("home"); setShowScenes(true); }}><span><b>選擇地圖</b><small>小屋、公園與海邊</small></span><i>›</i></button>
            <label className="pet-setting-row"><span><b>自由活動</b><small>寵物會自行在場景中走動</small></span><input type="checkbox" checked={settings.autoWander} onChange={(e) => setSettings((old) => ({ ...old, autoWander: e.target.checked }))} /></label>
            <label className="pet-setting-row"><span><b>桌面小寵物</b><small>有機會出現在桌面或其他 App</small></span><input type="checkbox" checked={settings.desktopPet} onChange={(e) => setSettings((old) => ({ ...old, desktopPet: e.target.checked }))} /></label>
            <label className="pet-setting-row"><span><b>回小屋休息時間</b><small>拖進小屋後暫時不再出現</small></span><select className="pet-setting-select" value={settings.desktopPetReturnMinutes} onChange={(e) => setSettings((old) => ({ ...old, desktopPetReturnMinutes: Number(e.target.value) }))}>{[3,5,10,15,20,30].map((minute) => <option key={minute} value={minute}>{minute} 分鐘</option>)}</select></label>
          </div>
          <div className="pet-setting-group"><h3>✨ AI 日記</h3>
            <label className="pet-setting-row"><span><b>AI 個人化日記</b><small>{apiConfig?.apiKey ? "由 AI 依個性撰寫回憶、日常與回應" : "尚未設定 AI 連線，將使用內建文案"}</small></span><input type="checkbox" checked={settings.aiDiary !== false} onChange={(e) => setSettings((old) => ({ ...old, aiDiary: e.target.checked }))} /></label>
          </div>
          <div className="pet-setting-group"><h3>🔔 提醒</h3>
            <label className="pet-setting-row"><span><b>照顧提醒</b><small>寵物需要照顧時通知</small></span><input type="checkbox" checked={settings.reminders} onChange={(e) => setSettings((old) => ({ ...old, reminders: e.target.checked }))} /></label>
          </div>
          <div className="pet-setting-group"><h3>💾 資料管理</h3>
            <button className="pet-setting-row" onClick={exportPetData}><span><b>匯出寵物資料</b><small>下載寵物小屋專用 JSON 備份</small></span><i>下載　›</i></button>
            <button className="pet-setting-row" onClick={() => petDataImportRef.current?.click()}><span><b>匯入寵物資料</b><small>從先前的備份檔恢復進度</small></span><i>選擇檔案　›</i></button>
            <input ref={petDataImportRef} type="file" accept="application/json,.json" hidden onChange={importPetData} />
          </div>
          {dataNotice && <div className={`pet-data-notice ${dataNotice.startsWith("匯入失敗") ? "error" : ""}`}>{dataNotice}</div>}
          <p className="pet-settings-version">寵物小屋 · Prototype 0.2</p>
        </section>}
      </main>

      {tab !== "settings" && <nav className="pet-nav">
        <button className={tab === "home" ? "active" : ""} onClick={() => setTab("home")}><span>🏠</span>小屋</button>
        <button className={tab === "decorate" ? "active" : ""} onClick={() => setTab("decorate")}><span>🪑</span>布置</button>
        <button className={tab === "album" ? "active" : ""} onClick={() => setTab("album")}><span>📔</span>日記</button>
        <button className={tab === "pets" ? "active" : ""} onClick={() => setTab("pets")}><span>🐾</span>寵物</button>
      </nav>}
    </div>
  );
}

export default function PetHome({ onClose, apiConfig }) {
  const [loaded, setLoaded] = useState(null);
  useEffect(() => {
    let mounted = true;
    loadPetStorage(INITIAL).then((value) => { if (mounted) setLoaded(value); }).catch((error) => { console.error("[pet] 資料載入失敗", error); if (mounted) setLoaded({ home: INITIAL, settings: { ...DEFAULT_PET_SETTINGS } }); });
    return () => { mounted = false; };
  }, []);
  if (!loaded) return <div className="pet-app" style={{ display: "grid", placeItems: "center" }}>正在讀取寵物小屋資料⋯</div>;
  return <PetHomeRuntime onClose={onClose} initialData={loaded.home} initialSettings={loaded.settings} apiConfig={apiConfig} />;
}
