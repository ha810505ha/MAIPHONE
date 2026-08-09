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
import { MILESTONE_ORDER, evaluateMilestones, normalizePetHome, companionDays, formatDiaryDate, withDayLog, isDayLogWorthWriting, birthdayLine, birthdayEntryTitle, milestoneForLocale, bondTier, DAILY_BOND_CAP, afkPenalty, afkGreeting, afkDiaryEntries, AFK_MILESTONE_ORDER, afkMilestoneForLocale } from "./services/pet/petDiary";
import { generateMilestoneTexts, generateLifeDiary, generateBirthdayDiary, generateNoteReply, generateEntryReply } from "./services/pet/petDiaryAiBridge";
import { petLine } from "./services/pet/petLines";
import { GENDER_IDS, PERSONALITY_IDS } from "./services/pet/petProfile";
import { petUiText } from "./constants/petUiText";
import { localizedLifeTitle } from "./services/pet/petDiaryLocales";
import { downloadJsonFile } from "./utils/exportFile";
import { isAiConfigReady } from "./services/aiService";

const ACTIONS = {
  feed: { icon: "🥕", stat: "hunger", exp: 5, delta: { hunger: 22, mood: 3 }, coins: 2, duration: 3000 },
  play: { icon: "🧶", stat: "mood", exp: 6, delta: { mood: 20, energy: -10 }, coins: 3, duration: 3000 },
  clean: { icon: "🫧", stat: "clean", exp: 8, delta: { clean: 24, mood: -2 }, coins: 2, duration: 3500 },
  sleep: { icon: "🌙", stat: "energy", exp: 5, delta: { energy: 26, hunger: -5 }, coins: 1, duration: 5000 },
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
  petProfile: { name: "麻糬", birthday: "", species: "長毛小狗", gender: "unspecified", primaryPersonality: "clingy", secondaryPersonality: "貪吃、好奇", likes: "摸摸、肉肉、公園", dislikes: "洗澡太久、打雷" },
};

const clamp = (value) => Math.max(0, Math.min(100, value));

function PetHomeRuntime({ onClose, initialData, initialSettings, apiConfig, uiLanguage = "zh-TW" }) {
  const [data, setData] = useState(() => normalizePetHome({ ...INITIAL, ...initialData, petProfile: { ...INITIAL.petProfile, ...(initialData?.petProfile || {}) } }, uiLanguage));
  const [tab, setTab] = useState("home");
  const [message, setMessage] = useState(() => petUiText(uiLanguage, "initialGreeting"));
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
  const [dataNotice, setDataNotice] = useState(null);
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

  const aiEnabled = settings.aiDiary !== false && isAiConfigReady(apiConfig);
  const p = (key, values) => petUiText(uiLanguage, key, values);

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
    const timer = setInterval(() => setData((old) => evaluateMilestones({ ...old, hunger: clamp(old.hunger - 1), clean: clamp(old.clean - 1) }, uiLanguage)), 60000);
    return () => clearInterval(timer);
  }, [uiLanguage]);
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
      setMessage(afkGreeting(idleDays, data.petProfile, uiLanguage));
      playAnim("pet", 2600);
    }
    setData((old) => {
      const idle = Math.floor((Date.now() - (Number(old.lastCareAt) || Date.now())) / 86400000);
      const penalty = afkPenalty(idle);
      if (!penalty) return withDayLog(old);
      const milestones = { ...old.milestones };
      [3, 5, 10, 15].forEach((days) => { if (idle >= days && !milestones[`afk${days}`]) milestones[`afk${days}`] = Number(old.lastCareAt) + days * 86400000; });
      return withDayLog({ ...old, bond: clamp((Number(old.bond) || 0) - penalty), lastCareAt: Date.now(), milestones, diary: [...afkDiaryEntries(idle, old.lastCareAt, old.petProfile, uiLanguage), ...(old.diary || [])] });
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
    generateMilestoneTexts(pending.map((entry) => entry.milestone), data, apiConfig, uiLanguage)
      .then((texts) => { if (texts) setData((old) => ({ ...old, diary: (old.diary || []).map((entry) => entry.aiPending && texts[entry.milestone] ? { ...entry, text: texts[entry.milestone], aiPending: false } : entry) })); })
      .finally(() => { aiMilestoneBusyRef.current = false; });
  }, [aiEnabled, data.diary, uiLanguage]);

  // 有料才寫：昨天互動夠多、有出門或主人有手寫日記，才以寵物視角補一篇日常日記
  useEffect(() => {
    if (!aiEnabled || aiLifeBusyRef.current) return;
    const prev = data.prevDayLog;
    if (!prev || data.lastLifeDiaryFor === prev.date) return;
    if (!isDayLogWorthWriting(prev)) { setData((old) => ({ ...old, lastLifeDiaryFor: prev.date })); return; }
    aiLifeBusyRef.current = true;
    generateLifeDiary(prev, data, apiConfig, uiLanguage)
      .then((text) => {
        if (!text) return;
        const at = Date.now();
        setData((old) => old.lastLifeDiaryFor === prev.date ? old : { ...old, lastLifeDiaryFor: prev.date, diary: [{ id: `life-${at}`, at, type: "life", icon: "📖", title: localizedLifeTitle(uiLanguage, "小小的一天"), text, note: "" }, ...(old.diary || [])] });
      })
      .finally(() => { aiLifeBusyRef.current = false; });
  }, [aiEnabled, data.prevDayLog, data.lastLifeDiaryFor, uiLanguage]);

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
    setData((old) => old.milestones?.[key] ? old : { ...old, milestones: { ...old.milestones, [key]: at }, diary: [{ id: entryId, at, type: "life", icon: "🎂", title: birthdayEntryTitle(uiLanguage), text: birthdayLine(old.petProfile, uiLanguage), note: "" }, ...(old.diary || [])] });
    if (aiEnabled) generateBirthdayDiary(data, apiConfig, uiLanguage).then((text) => { if (text) setData((old) => ({ ...old, diary: (old.diary || []).map((entry) => entry.id === entryId ? { ...entry, text } : entry) })); });
  }, [data.petProfile?.birthday, uiLanguage]);

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
      setRoomDragging(false); playAnim("pet", 1300); setMessage(p("dragPlaced"));
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
    return average > 72 ? "moodHappy" : average > 45 ? "moodCalm" : "moodNeedCare";
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
    setData(evaluateMilestones(logged, uiLanguage));
    const fullMessageKey = { feed: "fullFeed", play: "fullPlay", clean: "fullClean", sleep: "fullSleep" }[key];
    setMessage(levelCoins ? p("levelUp", { level, coins: levelCoins }) : earnsReward ? petLine(key, old.petProfile, uiLanguage) : p(fullMessageKey));
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
  const getSceneLine = (id) => petLine(`scene-${id}`, data.petProfile, uiLanguage) || petLine("scene-home", data.petProfile, uiLanguage);
  const saveProfile = () => {
    const next = { ...profileDraft, name: profileDraft.name.trim() || "麻糬" };
    setData((old) => ({ ...old, petProfile: next }));
    setProfileDraft(next);
    setEditingProfile(false);
    setMessage(p("renameGreeting", { name: next.name }));
  };
  const saveDiaryEntry = () => {
    const text = diaryDraft.text.trim();
    if (!text) return;
    const at = Date.now();
    const entry = { id: `user-${at}`, at, type: "user", icon: "✍️", title: diaryDraft.title.trim() || p("untitledEntry"), text, note: "" };
    setData((old) => withDayLog({ ...old, diary: [entry, ...(old.diary || [])] }, (log) => { log.notes.push(text.slice(0, 100)); }));
    setDiaryDraft({ title: "", text: "" });
    setWritingDiary(false);
    if (aiEnabled) generateEntryReply(entry, data, apiConfig, uiLanguage).then((reply) => { if (reply) setData((old) => ({ ...old, diary: (old.diary || []).map((item) => item.id === entry.id ? { ...item, reply } : item) })); });
  };
  const saveEditedEntry = () => {
    const text = diaryDraft.text.trim();
    if (!text) return;
    const entryId = editingEntryId;
    const title = diaryDraft.title.trim() || p("untitledEntry");
    setData((old) => ({ ...old, diary: (old.diary || []).map((entry) => entry.id === entryId ? { ...entry, title, text } : entry) }));
    setEditingEntryId(null);
    setDiaryDraft({ title: "", text: "" });
    if (aiEnabled) generateEntryReply({ title, text }, data, apiConfig, uiLanguage).then((reply) => { if (reply) setData((old) => ({ ...old, diary: (old.diary || []).map((item) => item.id === entryId ? { ...item, reply } : item) })); });
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
    if (aiEnabled && note && entry) generateNoteReply(entry, note, data, apiConfig, uiLanguage).then((reply) => { if (reply) setData((old) => ({ ...old, diary: (old.diary || []).map((item) => item.id === id && item.note ? { ...item, reply } : item) })); });
  };
  const memoriesCount = (data.diary || []).filter((entry) => entry.type === "auto").length;
  const exportPetData = async () => {
    const payload = { type: "maliphone-pet-home", version: 1, exportedAt: new Date().toISOString(), data, settings };
    try {
      const result = await downloadJsonFile(payload, `pet-home-${petName}-${new Date().toISOString().slice(0, 10)}.json`);
      if (result.method === "cancelled") return;
      setDataNotice({ type: "success", key: result.method === "native-filesystem" ? "exportDocuments" : "exportSuccess", values: { path: result.path } });
    } catch (error) {
      setDataNotice({ type: "error", key: "exportFail", values: { message: error?.message || "Unknown error" } });
    }
  };
  const importPetData = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      if (payload?.type !== "maliphone-pet-home" || !payload.data || typeof payload.data !== "object") throw new Error("invalid");
      const nextData = normalizePetHome({ ...INITIAL, ...payload.data, petProfile: { ...INITIAL.petProfile, ...(payload.data.petProfile || {}) } }, uiLanguage);
      const nextSettings = { ...DEFAULT_PET_SETTINGS, ...(payload.settings || {}) };
      setData(nextData);
      setSettings(nextSettings);
      setProfileDraft({ ...nextData.petProfile });
      setDataNotice({ type: "success", key: "importSuccess" });
    } catch (_) {
      setDataNotice({ type: "error", key: "importFail" });
    }
  };
  const roomSprite = roomDragging || anim === "grabbed" ? "grabbed" : anim === "pet" ? "happy" : anim === "feed" ? "eat" : anim === "play" ? "play" : anim === "clean" ? "bath" : anim === "sleep" ? "sleep" : roomWalking ? `walk-${walkFrame}` : "idle";
  const bubblePosition = roomPetPosition
    ? { left: 0, top: 0, translate: `${Math.max(72, Math.min(282, roomPetPosition.x + 79))}px ${Math.max(8, roomPetPosition.y - 38)}px` }
    : { left: `${[25, 50, 75][petSpot]}%`, top: 104 };
  return (
    <div className="pet-app" style={{ position: "absolute", inset: 0, zIndex: 40, width: "100%", height: "100%", background: "#fff8ec" }}>
      <header className="pet-header">
        <button className="pet-circle-btn" onClick={tab === "settings" ? () => setTab("home") : onClose} aria-label={p("back")}>‹</button>
        <div><strong>{tab === "settings" ? p("houseSettings") : p("petHome")}</strong><span>{tab === "settings" ? p("managePreferences") : p("liveWith", { name: petName })}</span></div>
        {tab !== "settings" && <button className="pet-settings-button" onClick={() => setTab("settings")} aria-label={p("petSettings")}>⚙️</button>}
        <div className="pet-coins">⭐ {data.coins}</div>
      </header>

      <main className="pet-main">
        {tab === "home" && <>
          <section className="pet-status-card">
            <div className="pet-name"><span>{petName}</span><small>Lv. {data.level} · {p(petMood)}</small></div>
            <div className="pet-bars">
              {[["hunger","hunger","🥕"],["mood","mood","💗"],["clean","clean","🫧"],["energy","energy","⚡"]].map(([key,label,icon]) =>
                <div className="pet-bar" key={key}><span>{icon}</span><div><small>{p(label)}</small><i><b style={{width:`${data[key]}%`}} /></i></div></div>
              )}
            </div>
          </section>

          <section className={`pet-room pet-scene-${scene}`}>
            <button className="pet-map-button" onClick={() => setShowScenes((value) => !value)}>🗺️ {p(scene)}</button>
            {showScenes && <div className="pet-scene-picker">
              {[["home","🏠"],["park","🌳"],["beach","🏖️"]].map(([id, icon]) => <button key={id} className={scene === id ? "active" : ""} onClick={() => { setScene(id); setShowScenes(false); setPetSpot(1); setRoomPetPosition(null); setMessage(getSceneLine(id)); setData((old) => evaluateMilestones(withDayLog({ ...old, sceneVisits: { ...old.sceneVisits, [id]: true } }, (log) => { if (!log.scenes.includes(id)) log.scenes.push(id); }), uiLanguage)); }}><span>{icon}</span>{p(id)}</button>)}
            </div>}
            <div className="pet-window"><span>☁️</span><span>☀️</span></div>
            <div className="pet-wall-art">♡ HOME</div>
            {placedItem("left") && <button className="pet-furniture pet-left" onClick={() => buyOrPlace(placedItem("left"))}>{placedItem("left").icon}</button>}
            {placedItem("right") && <button className="pet-furniture pet-right" onClick={() => buyOrPlace(placedItem("right"))}>{placedItem("right").icon}</button>}
            {placedItem("floor") && <button className="pet-furniture pet-floor-item" onClick={() => buyOrPlace(placedItem("floor"))}>{placedItem("floor").icon}</button>}
            <div className={`pet-bubble ${roomWalking ? "is-following" : ""} ${roomDragging ? "is-dragging" : ""}`} style={bubblePosition}>{message}</div>
            <div className={`pet-scene-decor decor-${scene}`} aria-hidden="true"><span /><i /><b /></div>
            <button className={`pet-character pet-spot-${petSpot} ${anim ? anim : roomWalking ? "wandering" : "idle"} ${roomDragging ? "room-is-dragging" : ""} ${roomPetPosition ? "pet-manual-position" : ""}`} style={roomPetPosition ? { left: 0, top: 0, bottom: "auto", translate: `${roomPetPosition.x}px ${roomPetPosition.y}px`, transform: "none", transition: roomDragging ? "none" : undefined, willChange: roomDragging ? "translate" : undefined } : undefined} onPointerDown={onRoomPetPointerDown} onPointerMove={onRoomPetPointerMove} onPointerUp={onRoomPetPointerUp} onPointerCancel={onRoomPetPointerUp} onClick={() => { if (suppressPetClickRef.current) return; setMessage(petLine("petting", data.petProfile, uiLanguage)); playAnim("pet", 2000); }} aria-label={p("longPressDrag", { name: petName })}>
              <img className="pet-sprite-image" src={`./pet-assets/${roomSprite}.png`} alt={petName} draggable={false} />
            </button>
            <div className="pet-rug" />
          </section>

          <section className="pet-actions">
            {Object.entries(ACTIONS).map(([key, action]) => <button key={key} onClick={() => act(key)}><span>{action.icon}</span>{p(key === "clean" ? "cleanAction" : key)}</button>)}
          </section>
        </>}

        {tab === "decorate" && <section className="pet-panel pet-coming-soon"><div className="pet-coming-icon">🪑</div><strong>{p("decorateSoon")}</strong><p>{p("decorateSoonDescription")}</p><span>COMING SOON</span></section>}

        {tab === "album" && <section className="pet-panel pet-diary">
          <div className="pet-panel-title"><div><strong>{p("diaryTitle", { name: petName })}</strong><span>{p("diarySubtitle")}</span></div><button className="pet-diary-write" onClick={() => { setWritingDiary((value) => !value); setNoteEditingId(null); setEditingEntryId(null); setConfirmDeleteId(null); setActionsOpenId(null); setDiaryDraft({ title: "", text: "" }); }}>{writingDiary ? p("collapse") : `✏️ ${p("writeDiary")}`}</button></div>
          {writingDiary && <div className="pet-diary-editor">
            <input maxLength={20} value={diaryDraft.title} onChange={(e) => setDiaryDraft((old) => ({ ...old, title: e.target.value }))} placeholder={p("optionalTitle")} />
            <textarea maxLength={300} value={diaryDraft.text} onChange={(e) => setDiaryDraft((old) => ({ ...old, text: e.target.value }))} placeholder={p("dailyNote", { name: petName })} />
            <div className="pet-diary-editor-actions"><button onClick={() => { setWritingDiary(false); setDiaryDraft({ title: "", text: "" }); }}>{p("cancel")}</button><button className="primary" disabled={!diaryDraft.text.trim()} onClick={saveDiaryEntry}>{p("saveToDiary")}</button></div>
          </div>}
          {(data.diary || []).map((entry) => <article key={entry.id} className={`pet-diary-entry ${entry.type}`}>
            <header><span className="pet-diary-icon">{entry.icon}</span><div><strong>{entry.title}</strong><small>{formatDiaryDate(entry.at)}{entry.type === "user" ? ` · ${p("handwritten")}` : ""}</small></div></header>
            {editingEntryId !== entry.id && <p>{entry.text}</p>}
            {editingEntryId === entry.id && <div className="pet-diary-editor pet-diary-note-editor">
              <input maxLength={20} value={diaryDraft.title} onChange={(e) => setDiaryDraft((old) => ({ ...old, title: e.target.value }))} placeholder={p("optionalTitle")} />
              <textarea maxLength={300} value={diaryDraft.text} onChange={(e) => setDiaryDraft((old) => ({ ...old, text: e.target.value }))} placeholder={p("dailyNote", { name: petName })} />
              <div className="pet-diary-editor-actions"><button onClick={() => { setEditingEntryId(null); setDiaryDraft({ title: "", text: "" }); }}>{p("cancel")}</button><button className="primary" disabled={!diaryDraft.text.trim()} onClick={saveEditedEntry}>{p("save")}</button></div>
            </div>}
            {entry.note && noteEditingId !== entry.id && <div className="pet-diary-note">📝 {entry.note}</div>}
            {entry.reply && (entry.type === "user" || entry.note) && noteEditingId !== entry.id && editingEntryId !== entry.id && <div className="pet-diary-reply">🐾 {entry.reply}</div>}
            {entry.type !== "user" && noteEditingId !== entry.id && <button className="pet-diary-note-btn" onClick={() => { setNoteEditingId(entry.id); setNoteDraft(entry.note || ""); setWritingDiary(false); setEditingEntryId(null); setConfirmDeleteId(null); }}>{entry.note ? p("editNote") : `＋${p("addNote")}`}</button>}
            {entry.type === "user" && editingEntryId !== entry.id && <div className="pet-diary-entry-actions">
              {actionsOpenId === entry.id && (confirmDeleteId === entry.id ? <>
                <span>{p("confirmDelete")}</span>
                <button className="danger" onClick={() => deleteDiaryEntry(entry.id)}>{p("delete")}</button>
                <button onClick={() => setConfirmDeleteId(null)}>{p("cancel")}</button>
              </> : <>
                <button onClick={() => { setEditingEntryId(entry.id); setDiaryDraft({ title: entry.title, text: entry.text }); setWritingDiary(false); setNoteEditingId(null); setConfirmDeleteId(null); setActionsOpenId(null); }}>{p("edit")}</button>
                <button className="danger" onClick={() => setConfirmDeleteId(entry.id)}>{p("delete")}</button>
              </>)}
              <button className="pet-diary-pen" aria-label={p("editOrDelete")} onClick={() => { setActionsOpenId((open) => open === entry.id ? null : entry.id); setConfirmDeleteId(null); }}>{actionsOpenId === entry.id ? "✕" : "✏️"}</button>
            </div>}
            {noteEditingId === entry.id && <div className="pet-diary-editor pet-diary-note-editor">
              <textarea maxLength={200} value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder={p("notePlaceholder")} />
              <div className="pet-diary-editor-actions"><button onClick={() => { setNoteEditingId(null); setNoteDraft(""); }}>{p("cancel")}</button><button className="primary" onClick={() => saveDiaryNote(entry.id)}>{p("save")}</button></div>
            </div>}
          </article>)}
          <div className="pet-diary-locked"><span>🔒</span>{p("lockedMemories", { count: memoriesCount, total: MILESTONE_ORDER.length })}</div>
        </section>}

        {tab === "pets" && <section className="pet-pets-panel">
          {!editingProfile && !viewingGrowth && <>
            <div className="pet-panel-title"><div><strong>{p("myPets")}</strong><span>{p("petsSubtitle")}</span></div><span>{p("onePet")}</span></div>
            <article className="pet-profile-card"><div className="pet-profile-avatar"><img src="./pet-assets/idle.png" alt={petName} /></div><div className="pet-profile-info"><small>{p("currentCompanion")}</small><strong>{petName}</strong><span>{data.petProfile.species} · Lv. {data.level}</span></div><em>{p("togetherDays", { days: companionDays(data.adoptedAt) })}</em></article>
            <div className="pet-exp-card"><div><b>Lv. {data.level}</b><span>{data.exp} / {expNeeded} EXP</span></div><i><b style={{width:`${Math.min(100, data.exp / expNeeded * 100)}%`}} /></i></div>
            <div className="pet-profile-stats"><div><strong>{Math.round(Number(data.bond) || 0)}</strong><span>{p("bond")} · {p(({ "還在熟悉": "bondFamiliar", "喜歡你": "bondLikeYou", "好朋友": "bondFriends", "形影不離": "bondInseparable" })[bondTier(data.bond)] || "bondFamiliar")}</span></div><div><strong>{data.level}</strong><span>{p("growthLevel")}</span></div><div><strong>{memoriesCount}</strong><span>{p("unlockedMemories")}</span></div></div>
            <div className="pet-bond-hint">{p("todayBond", { value: Math.min(data.dayLog?.date === formatDiaryDate(Date.now()) ? (data.dayLog?.bondGained || 0) : 0, DAILY_BOND_CAP), total: DAILY_BOND_CAP })}</div>
            <div className="pet-setting-group pet-management-list">
              <button className="pet-setting-row" onClick={() => { setProfileDraft({ ...data.petProfile }); setEditingProfile(true); }}><span><b>{p("basicInfo")}</b><small>{p("basicInfoSub")}</small></span><i>›</i></button>
              <button className="pet-setting-row" onClick={() => setViewingGrowth(true)}><span><b>{p("growthRecord")}</b><small>{p("growthRecordSub")}</small></span><i>›</i></button>
            </div>
            <button className="pet-add-pet"><span>＋</span><div><strong>{p("welcomePet")}</strong><small>{p("welcomePetSub")}</small></div></button>
          </>}
          {viewingGrowth && !editingProfile && <div className="pet-growth">
            <div className="pet-editor-heading"><button onClick={() => setViewingGrowth(false)}>‹</button><div><strong>{p("growthRecord")}</strong><span>{p("growthSubtitle", { name: petName })}</span></div></div>
            <ul className="pet-growth-list">
              {MILESTONE_ORDER.filter((key) => data.milestones?.[key]).map((key) => {
                const milestone = milestoneForLocale(key, uiLanguage);
                const at = data.milestones[key];
                return <li key={key} className="done"><span>{milestone.icon}</span><div><strong>{milestone.title}</strong><small>{formatDiaryDate(at)}</small></div><i>✓</i></li>;
              })}
              {MILESTONE_ORDER.some((key) => !data.milestones?.[key]) && <li className="pet-growth-divider">{p("remainingMilestones", { count: MILESTONE_ORDER.filter((key) => !data.milestones?.[key]).length })}</li>}
              {AFK_MILESTONE_ORDER.some((key) => data.milestones?.[key]) && <li className="pet-growth-divider">{p("quietDays")}</li>}
              {AFK_MILESTONE_ORDER.filter((key) => data.milestones?.[key]).map((key) => {
                const milestone = afkMilestoneForLocale(key, uiLanguage);
                return <li key={key} className="done afk"><span>{milestone.icon}</span><div><strong>{milestone.title}</strong><small>{milestone.hint} · {formatDiaryDate(data.milestones[key])}</small></div></li>;
              })}
            </ul>
          </div>}
          {editingProfile && <div className="pet-profile-editor">
            <div className="pet-editor-heading"><button onClick={() => setEditingProfile(false)}>‹</button><div><strong>{p("basicInfo")}</strong><span>{p("createPersonality")}</span></div></div>
            <label><span>{p("name")}</span><input maxLength={12} value={profileDraft.name} onChange={(e) => setProfileDraft((old) => ({ ...old, name: e.target.value }))} placeholder={p("enterPetName")} /></label>
            <label><span>{p("birthday")}</span><input type="date" value={profileDraft.birthday} onChange={(e) => setProfileDraft((old) => ({ ...old, birthday: e.target.value }))} /></label>
            <label><span>{p("species")}</span><input maxLength={20} value={profileDraft.species} onChange={(e) => setProfileDraft((old) => ({ ...old, species: e.target.value }))} /></label>
            <label><span>{p("gender")}</span><select value={profileDraft.gender} onChange={(e) => setProfileDraft((old) => ({ ...old, gender: e.target.value }))}>{GENDER_IDS.map((id) => <option key={id} value={id}>{p(`gender_${id}`)}</option>)}</select></label>
            <label><span>{p("primaryPersonality")}</span><select value={profileDraft.primaryPersonality} onChange={(e) => setProfileDraft((old) => ({ ...old, primaryPersonality: e.target.value }))}>{PERSONALITY_IDS.map((id) => <option key={id} value={id}>{p(`personality_${id}`)}</option>)}</select></label>
            <label><span>{p("secondaryPersonality")}</span><input maxLength={30} value={profileDraft.secondaryPersonality} onChange={(e) => setProfileDraft((old) => ({ ...old, secondaryPersonality: e.target.value }))} placeholder={p("exampleSecondary")} /></label>
            <label><span>{p("likes")}</span><textarea maxLength={80} value={profileDraft.likes} onChange={(e) => setProfileDraft((old) => ({ ...old, likes: e.target.value }))} placeholder={p("exampleLikes")} /></label>
            <label><span>{p("dislikes")}</span><textarea maxLength={80} value={profileDraft.dislikes} onChange={(e) => setProfileDraft((old) => ({ ...old, dislikes: e.target.value }))} placeholder={p("exampleDislikes")} /></label>
            <div className="pet-editor-actions"><button onClick={() => setEditingProfile(false)}>{p("cancel")}</button><button onClick={saveProfile}>{p("saveProfile")}</button></div>
          </div>}
        </section>}

        {tab === "settings" && <section className="pet-settings-panel">
          <div className="pet-setting-group"><h3>🗺️ {p("mapAndActivity")}</h3>
            <button className="pet-setting-row" onClick={() => { setTab("home"); setShowScenes(true); }}><span><b>{p("chooseMap")}</b><small>{p("chooseMapSub")}</small></span><i>›</i></button>
            <label className="pet-setting-row"><span><b>{p("freeRoam")}</b><small>{p("freeRoamSub")}</small></span><input type="checkbox" checked={settings.autoWander} onChange={(e) => setSettings((old) => ({ ...old, autoWander: e.target.checked }))} /></label>
            <label className="pet-setting-row"><span><b>{p("desktopPet")}</b><small>{p("desktopPetSub")}</small></span><input type="checkbox" checked={settings.desktopPet} onChange={(e) => setSettings((old) => ({ ...old, desktopPet: e.target.checked }))} /></label>
            <label className="pet-setting-row"><span><b>{p("returnTime")}</b><small>{p("returnTimeSub")}</small></span><select className="pet-setting-select" value={settings.desktopPetReturnMinutes} onChange={(e) => setSettings((old) => ({ ...old, desktopPetReturnMinutes: Number(e.target.value) }))}>{[3,5,10,15,20,30].map((minute) => <option key={minute} value={minute}>{p("minutes", { value: minute })}</option>)}</select></label>
          </div>
          <div className="pet-setting-group"><h3>✨ {p("aiDiary")}</h3>
            <label className="pet-setting-row"><span><b>{p("personalizedDiary")}</b><small>{isAiConfigReady(apiConfig) ? p("aiConfigured") : p("aiNotConfigured")}</small></span><input type="checkbox" checked={settings.aiDiary !== false} onChange={(e) => setSettings((old) => ({ ...old, aiDiary: e.target.checked }))} /></label>
          </div>
          <div className="pet-setting-group"><h3>🔔 {p("reminders")}</h3>
            <label className="pet-setting-row"><span><b>{p("careReminder")}</b><small>{p("careReminderSub")}</small></span><input type="checkbox" checked={settings.reminders} onChange={(e) => setSettings((old) => ({ ...old, reminders: e.target.checked }))} /></label>
          </div>
          <div className="pet-setting-group"><h3>💾 {p("dataManagement")}</h3>
            <button className="pet-setting-row" onClick={exportPetData}><span><b>{p("exportPetData")}</b><small>{p("exportPetDataSub")}</small></span><i>{p("download")}　›</i></button>
            <button className="pet-setting-row" onClick={() => petDataImportRef.current?.click()}><span><b>{p("importPetData")}</b><small>{p("importPetDataSub")}</small></span><i>{p("chooseFile")}　›</i></button>
            <input ref={petDataImportRef} type="file" accept="application/json,.json" hidden onChange={importPetData} />
          </div>
          {dataNotice && <div className={`pet-data-notice ${dataNotice.type === "error" ? "error" : ""}`}>{p(dataNotice.key, dataNotice.values)}</div>}
          <p className="pet-settings-version">{p("prototype")}</p>
        </section>}
      </main>

      {tab !== "settings" && <nav className="pet-nav">
        <button className={tab === "home" ? "active" : ""} onClick={() => setTab("home")}><span>🏠</span>{p("home")}</button>
        <button className={tab === "decorate" ? "active" : ""} onClick={() => setTab("decorate")}><span>🪑</span>{p("decorate")}</button>
        <button className={tab === "album" ? "active" : ""} onClick={() => setTab("album")}><span>📔</span>{p("diary")}</button>
        <button className={tab === "pets" ? "active" : ""} onClick={() => setTab("pets")}><span>🐾</span>{p("pets")}</button>
      </nav>}
    </div>
  );
}

export default function PetHome({ onClose, apiConfig, uiLanguage = "zh-TW" }) {
  const [loaded, setLoaded] = useState(null);
  useEffect(() => {
    let mounted = true;
    loadPetStorage(INITIAL).then((value) => { if (mounted) setLoaded(value); }).catch((error) => { console.error("[pet] 資料載入失敗", error); if (mounted) setLoaded({ home: INITIAL, settings: { ...DEFAULT_PET_SETTINGS } }); });
    return () => { mounted = false; };
  }, []);
  if (!loaded) return <div className="pet-app" style={{ display: "grid", placeItems: "center" }}>{petUiText(uiLanguage, "loading")}</div>;
  return <PetHomeRuntime onClose={onClose} initialData={loaded.home} initialSettings={loaded.settings} apiConfig={apiConfig} uiLanguage={uiLanguage} />;
}
