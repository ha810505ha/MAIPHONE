import React, { useState, useEffect, useRef } from "react";
import { VERSION, API_PROVIDERS, DEFAULT_APPS, DOCK_APPS } from "./constants/appConstants";
import { gid, ft, fd, sanitizeText, sanitizeUserImageUrl } from "./utils/coreUtils";
import { parseSillyTavernJSON, parseSillyTavernPNG, buildSystemPrompt } from "./utils/characterParser";
import { callAI, fetchAvailableModels } from "./services/aiService";
import { loadAppState, saveAppState } from "./utils/indexedDbStorage";
import css from "./styles/maliPhoneCss";

function AddCharModal({ setModal, addCharacter, updateCharacter, editingCharacter, sanitizeUserImageUrl }) {
  const [tab, setTab] = useState("manual");
  const [n, sn] = useState(""); const [d, sd] = useState(""); const [p, sp] = useState(""); const [rel, srel] = useState(""); const [av, sav] = useState("");
  const [importErr, setImportErr] = useState(""); const [importing, setImporting] = useState(false);
  const avRef = useRef(null); const importRef = useRef(null);
  useEffect(() => {
    if (!editingCharacter) return;
    setTab("manual");
    sn(editingCharacter.name || "");
    sd(editingCharacter.description || "");
    sp(editingCharacter.systemPrompt || "");
    srel(editingCharacter.relationshipToUser || "");
    sav(editingCharacter.avatar || "");
  }, [editingCharacter]);
  const onAv = (e) => { const f = e.target.files?.[0]; if(!f) return; const r = new FileReader(); r.onload = () => { const safe = sanitizeUserImageUrl(String(r.result || "")); if (safe) sav(safe); }; r.readAsDataURL(f); };
  const handleImport = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setImportErr(""); setImporting(true);
    try {
      if (file.name.endsWith(".json")) { const t = await file.text(); addCharacter(parseSillyTavernJSON(JSON.parse(t))); }
      else if (file.type === "image/png") { addCharacter(await parseSillyTavernPNG(file)); }
      else setImportErr("不支援的檔案格式，請使用 .json 或 .png");
    } catch (err) { setImportErr(err.message || "匯入失敗"); }
    setImporting(false); if (importRef.current) importRef.current.value = "";
  };
  return (
    <div className="mp-overlay" onClick={() => setModal(null)}>
      <div className="mp-modal" onClick={e => e.stopPropagation()}>
        <div className="mp-modal-t">{editingCharacter ? "編輯角色" : "新增角色"}</div>
        {!editingCharacter && <div className="mp-tabs">
          <div className={`mp-tab ${tab==="manual"?"active":""}`} onClick={() => setTab("manual")}>手動建立</div>
          <div className={`mp-tab ${tab==="import"?"active":""}`} onClick={() => setTab("import")}>匯入角色卡</div>
        </div>}
        {tab === "import" ? (<>
          <div className="mp-drop" onClick={() => importRef.current?.click()}>
            <div className="mp-drop-icon">📥</div>
            <div className="mp-drop-text">
              {importing ? "匯入中..." : "點擊選擇 SillyTavern 角色卡"}
              <br />
              <span style={{fontSize:10,color:"var(--mp-txt-l)"}}>支援 .json 與 .png</span>
            </div>
          </div>
          <input type="file" ref={importRef} accept=".json,.png" style={{display:"none"}} onChange={handleImport} />
          {importErr && <div style={{fontSize:12,color:"#e53935",marginTop:6,textAlign:"center"}}>{importErr}</div>}
          <div style={{marginTop:12,padding:10,background:"rgba(244,143,177,.05)",borderRadius:10,fontSize:11,color:"var(--mp-txt-l)",lineHeight:1.6}}>
            <strong>支援格式：</strong><br/>
            SillyTavern V1/V2 JSON<br/>
            SillyTavern PNG（含 chara tEXt chunk）<br/>
            會自動讀取 name、description、personality、scenario、first_mes、mes_example、system_prompt、tags
          </div>
        </>) : (<>
          <div className="mp-row"><div className="mp-lbl">角色頭像</div><div style={{display:"flex",alignItems:"center",gap:10}}><div className="mp-av" style={{cursor:"pointer"}} onClick={() => avRef.current?.click()}>{av ? <img src={av} alt="" /> : "🦊"}</div><input type="file" ref={avRef} accept="image/*" style={{display:"none"}} onChange={onAv} /><span style={{fontSize:11,color:"var(--mp-txt-l)"}}>點擊更換</span></div></div>
          <div className="mp-row"><div className="mp-lbl">角色名稱 *</div><input className="mp-sinp" value={n} onChange={e=>sn(e.target.value)} placeholder="例如 Luna" /></div>
          <div className="mp-row"><div className="mp-lbl">角色設定（Character Description）</div><textarea className="mp-ta" value={d} onChange={e=>sd(e.target.value)} placeholder="描述角色背景、行為、語氣與互動方式" style={{minHeight:90,resize:"vertical"}} /></div>
            <div className="mp-row"><div className="mp-lbl">系統提示詞（System Prompt）</div><textarea className="mp-ta" value={p} onChange={e=>sp(e.target.value)} placeholder="定義角色語氣、人格、回覆方式" /></div>
            <div className="mp-row"><div className="mp-lbl">與玩家關係</div><input className="mp-sinp" value={rel} onChange={e=>srel(e.target.value)} placeholder="例如：青梅竹馬、同事、戀人、陌生人" /></div>
            <button className="mp-save" style={{marginTop:10}} onClick={() => {
              if(!n.trim()) return alert("請輸入角色名稱");
              const payload = {name:n.trim(),description:d.trim(),systemPrompt:p.trim(),relationshipToUser:rel.trim(),avatar:av,personality:editingCharacter?.personality||"",scenario:editingCharacter?.scenario||"",firstMessage:editingCharacter?.firstMessage||"",messageExamples:editingCharacter?.messageExamples||"",tags:editingCharacter?.tags||[],creator:editingCharacter?.creator||"",creatorNotes:editingCharacter?.creatorNotes||""};
              if (editingCharacter) updateCharacter(editingCharacter.id, payload);
              else addCharacter(payload);
            }}>{editingCharacter ? "儲存變更" : "建立角色"}</button>
        </>)}
      </div>
    </div>
  );
}

function BarClock({ ft }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="mp-bar">
      <span>{ft(now)}</span>
      <div className="mp-bar-r"><span>📶</span><span>100%</span><span>🔋</span></div>
    </div>
  );
}

function LockClock({ ft, fd }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const dateInfo = fd(now);
  return (
    <>
      <div className="mp-lock-time">{ft(now)}</div>
      <div className="mp-lock-date">{dateInfo.day} · {dateInfo.month} {dateInfo.date}</div>
    </>
  );
}

function DeskClock({ ft, fd }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const dateInfo = fd(now);
  return (
    <div className="mp-clock">
      <div className="mp-clock-big">{ft(now)}</div>
      <div className="mp-clock-meta"><span className="mp-clock-day">{dateInfo.day}</span><span className="mp-clock-ds">{dateInfo.month} · {dateInfo.date}</span></div>
    </div>
  );
}

export default function MaliPhone() {
  const defaultAppState = {
    characters: [],
    activeCharId: null,
    chatHistory: {},
    posts: [],
    memories: {},
    lorebooks: [],
    chatLorebookBindings: {},
    phoneInboxCache: {},
    wallet: {
      balance: 500,
      transactions: [],
      assets: [],
    },
    apiPresets: [
      { id: "preset-1", name: "預設 1", provider: "openai", baseUrl: "https://api.openai.com/v1", apiKey: "", model: "gpt-4o-mini" },
      { id: "preset-2", name: "預設 2", provider: "grok", baseUrl: "https://api.x.ai/v1", apiKey: "", model: "grok-3-mini" },
      { id: "preset-3", name: "預設 3", provider: "openrouter", baseUrl: "https://openrouter.ai/api/v1", apiKey: "", model: "auto" },
    ],
    playerProfile: {
      name: "玩家",
      nickname: "",
      bio: "",
      avatar: "",
      doll: {
        hairStyle: "長髮",
        topStyle: "連帽上衣",
        accessoryStyle: "髮夾",
        hairColor: "#5d4037",
        topColor: "#f48fb1",
        accessoryColor: "#90caf9",
      },
    },
    apiConfig: { provider: "openai", baseUrl: "https://api.openai.com/v1", apiKey: "", model: "gpt-4o-mini" },
  };
  const [locked, setLocked] = useState(true);
  const [unlocking, setUnlocking] = useState(false);
  const [currentApp, setCurrentApp] = useState(null);
  const [toast, setToast] = useState(null);
  const [characters, setCharacters] = useState(defaultAppState.characters);
  const [activeCharId, setActiveCharId] = useState(defaultAppState.activeCharId);
  const [chatHistory, setChatHistory] = useState(defaultAppState.chatHistory);
  const [chatInput, setChatInput] = useState("");
  const [chatImage, setChatImage] = useState(null);
  const CHAT_IMAGE_MAX_BYTES = 1024 * 1024; // 1MB
  const [isTyping, setIsTyping] = useState(false);
  const [currentChatChar, setCurrentChatChar] = useState(null);
  const [activeMessageId, setActiveMessageId] = useState(null);
  const [messageEditor, setMessageEditor] = useState(null);
  const [posts, setPosts] = useState(defaultAppState.posts);
  const [postCommentInputs, setPostCommentInputs] = useState({});
  const [activeCommentPostId, setActiveCommentPostId] = useState(null);
  const SHARE_RAW_TOKEN_LIMIT = 1000;
  const TOTAL_CONTEXT_TOKEN_LIMIT = 40000;
  const [memories, setMemories] = useState(defaultAppState.memories);
  const [lorebooks, setLorebooks] = useState(defaultAppState.lorebooks);
  const [chatLorebookBindings, setChatLorebookBindings] = useState(defaultAppState.chatLorebookBindings);
  const [phoneInboxCache, setPhoneInboxCache] = useState(defaultAppState.phoneInboxCache);
  const [wallet, setWallet] = useState(defaultAppState.wallet);
  const [apiPresets, setApiPresets] = useState(defaultAppState.apiPresets);
  const [playerProfile, setPlayerProfile] = useState(defaultAppState.playerProfile);
  const [playerAvatarCrop, setPlayerAvatarCrop] = useState(null);
  const [phoneViewCharId, setPhoneViewCharId] = useState(null);
  const [phonePage, setPhonePage] = useState("picker");
  const [phoneActiveThreadId, setPhoneActiveThreadId] = useState("player");
  const [phoneGenLoading, setPhoneGenLoading] = useState(false);
  const [memoryEditor, setMemoryEditor] = useState(null);
  const [activeMemoryId, setActiveMemoryId] = useState(null);
  const [apiConfig, setApiConfig] = useState(defaultAppState.apiConfig);
  const [modal, setModal] = useState(null);
  const [editingCharacter, setEditingCharacter] = useState(null);
  const [tempConfig, setTempConfig] = useState(null);
  const [providerModelOptions, setProviderModelOptions] = useState({});
  const [fetchingModels, setFetchingModels] = useState(false);
  const [presetSavePickerOpen, setPresetSavePickerOpen] = useState(false);
  const [clearCacheArmed, setClearCacheArmed] = useState(false);
  const [statusExpandedCharId, setStatusExpandedCharId] = useState(null);
  const [settingsApiOpen, setSettingsApiOpen] = useState(true);
  const [settingsResetOpen, setSettingsResetOpen] = useState(false);
  const [editingLorebookEntry, setEditingLorebookEntry] = useState(null);
  const [editingLorebookBook, setEditingLorebookBook] = useState(null);
  const [activeLorebookId, setActiveLorebookId] = useState(null);
  const [viewingLorebookEntry, setViewingLorebookEntry] = useState(null);
  const [chatSettingsOpen, setChatSettingsOpen] = useState(false);
  const [chatSettingsExpandedBooks, setChatSettingsExpandedBooks] = useState({});
  const [genLoading, setGenLoading] = useState(false);
  const [homePage, setHomePage] = useState(1);
  const PAGE_SIZE = 12;
  const HOME_SLOT_COUNT = PAGE_SIZE * 3;
  const [homeSlots, setHomeSlots] = useState(Array.from({ length: HOME_SLOT_COUNT }, () => null));
  const [dockOrder, setDockOrder] = useState(DOCK_APPS);
  const [isDraggingApp, setIsDraggingApp] = useState(false);
  const [pointerDrag, setPointerDrag] = useState(null);
  const [hydrated, setHydrated] = useState(false);
  const socialLastGlobalPostAtRef = useRef(0);
  const socialLastPostByCharRef = useRef({});
  const SOCIAL_GLOBAL_COOLDOWN_MS = 60 * 1000;
  const SOCIAL_CHAR_COOLDOWN_MS = 3 * 60 * 1000;
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const noticeLongPressTimerRef = useRef(null);
  const swipeStartXRef = useRef(null);
  const swipeStartYRef = useRef(null);
  const lockStartYRef = useRef(null);
  const edgeTurnTimerRef = useRef(null);
  const edgeTurnDirRef = useRef(null);
  const suppressAppClickUntilRef = useRef(0);

  useEffect(() => {
    let mounted = true;
    loadAppState(defaultAppState).then((data) => {
      if (!mounted) return;
      setCharacters(data.characters || []);
      setActiveCharId(data.activeCharId ?? null);
      setChatHistory(data.chatHistory || {});
      setPosts(data.posts || []);
      setMemories(data.memories || {});
      setPhoneInboxCache(data.phoneInboxCache || {});
      setWallet(data.wallet || defaultAppState.wallet);
      setApiPresets(Array.isArray(data.apiPresets) && data.apiPresets.length ? data.apiPresets : defaultAppState.apiPresets);
      setPlayerProfile(data.playerProfile || defaultAppState.playerProfile);
      setChatLorebookBindings(data.chatLorebookBindings || {});
      const loadedLorebooks = Array.isArray(data.lorebooks) ? data.lorebooks : [];
      if (loadedLorebooks.length) {
        setLorebooks(loadedLorebooks);
        setActiveLorebookId(loadedLorebooks[0]?.id || null);
      } else if (Array.isArray(data.lorebookEntries) && data.lorebookEntries.length) {
        const migrated = [{
          id: gid(),
          name: "預設世界書",
          description: "",
          enabled: true,
          updatedAt: Date.now(),
          entries: data.lorebookEntries,
        }];
        setLorebooks(migrated);
        setActiveLorebookId(migrated[0].id);
      } else {
        setLorebooks([]);
        setActiveLorebookId(null);
      }
      setApiConfig(data.apiConfig || defaultAppState.apiConfig);
      const initialDock = (data.dockOrder && Array.isArray(data.dockOrder)) ? data.dockOrder : DOCK_APPS;
      setDockOrder(initialDock);
      if (data.homeSlots && Array.isArray(data.homeSlots) && data.homeSlots.length === HOME_SLOT_COUNT) {
        setHomeSlots(data.homeSlots);
      } else {
        const fallbackOrder = (data.homeOrder && Array.isArray(data.homeOrder))
          ? data.homeOrder
          : DEFAULT_APPS.filter(a => !DOCK_APPS.includes(a.id)).map(a => a.id);
        const nextSlots = Array.from({ length: HOME_SLOT_COUNT }, () => null);
        fallbackOrder
          .filter((id) => !initialDock.includes(id))
          .slice(0, PAGE_SIZE)
          .forEach((id, i) => { nextSlots[PAGE_SIZE + i] = id; });
        setHomeSlots(nextSlots);
      }
      setHydrated(true);
    }).catch(() => {
      if (mounted) setHydrated(true);
    });
    return () => { mounted = false; };
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    const timer = setTimeout(() => {
      saveAppState({ characters, activeCharId, chatHistory, posts, memories, lorebooks, chatLorebookBindings, phoneInboxCache, wallet, apiPresets, playerProfile, apiConfig, homeSlots, dockOrder }).catch(() => {});
    }, 180);
    return () => clearTimeout(timer);
  }, [hydrated, characters, activeCharId, chatHistory, posts, memories, lorebooks, chatLorebookBindings, phoneInboxCache, wallet, apiPresets, playerProfile, apiConfig, homeSlots, dockOrder]);
  useEffect(() => {
    if (!(typeof import.meta !== "undefined" && import.meta.env && import.meta.env.PROD)) return;
    if (!("serviceWorker" in navigator)) return;
    const base = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.BASE_URL) ? import.meta.env.BASE_URL : "/";
    navigator.serviceWorker.register(`${base}sw.js`).then((reg) => {
      if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
      reg.addEventListener("updatefound", () => {
        const worker = reg.installing;
        if (!worker) return;
        worker.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) {
            worker.postMessage({ type: "SKIP_WAITING" });
          }
        });
      });
    }).catch(() => {});
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    let changed = false;
    const normalized = {};
    Object.entries(memories || {}).forEach(([charId, arr]) => {
      normalized[charId] = (arr || []).map((m) => {
        const next = {
          id: m.id || gid(),
          text: sanitizeText(m.text, 500),
          date: m.date || Date.now(),
          pinned: !!m.pinned,
        };
        if (!m.id || typeof m.pinned === "undefined" || next.text !== m.text) changed = true;
        return next;
      }).slice(0, 30);
    });
    if (changed) setMemories(normalized);
  }, [hydrated]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatHistory, isTyping, currentChatChar]);
  useEffect(() => {
    const forceEnd = () => {
      setPointerDrag(null);
      setIsDraggingApp(false);
      clearTimeout(edgeTurnTimerRef.current);
      edgeTurnTimerRef.current = null;
      edgeTurnDirRef.current = null;
    };
    window.addEventListener("pointerup", forceEnd);
    window.addEventListener("pointercancel", forceEnd);
    return () => {
      window.removeEventListener("pointerup", forceEnd);
      window.removeEventListener("pointercancel", forceEnd);
    };
  }, []);

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(null), 2200); };
  const playerAvatarRef = useRef(null);
  const estimateTokens = (s) => Math.ceil(String(s || "").length / 3.5);
  const getUserDisplayName = () => sanitizeText(playerProfile?.name || "玩家", 40) || "玩家";
  const applyUserPlaceholder = (text) => String(text || "").replace(/\{\{user\}\}/g, getUserDisplayName());
  const getPlayerContextBlock = () => {
    const n = sanitizeText(playerProfile?.name || "玩家", 40);
    const nn = sanitizeText(playerProfile?.nickname || "", 40);
    const b = sanitizeText(playerProfile?.bio || "", 400);
    const nameLine = nn ? `名稱：${n}\n暱稱：${nn}` : `名稱：${n}`;
    const nicknameRule = nn
      ? `暱稱使用規則：僅在語氣自然、關係熟悉時偶爾使用暱稱「${nn}」，不要每句都使用。`
      : "";
    return [ `[玩家設定]\n${nameLine}${b ? `\n設定：${b}` : ""}`, nicknameRule ].filter(Boolean).join("\n");
  };
  const handlePlayerAvatarUpload = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      const safe = sanitizeUserImageUrl(String(r.result || ""));
      if (!safe) return showToast("頭像格式不支援");
      setPlayerAvatarCrop({ src: safe, zoom: 1, panX: 0, panY: 0, dragging: false, dragStartX: 0, dragStartY: 0, startPanX: 0, startPanY: 0 });
    };
    r.readAsDataURL(f);
    e.target.value = "";
  };
  const applyPlayerAvatarCrop = () => {
    if (!playerAvatarCrop?.src) return;
    const img = new Image();
    img.onload = () => {
      const size = 320;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const iw = img.width;
      const ih = img.height;
      const scale = Math.max(size / iw, size / ih) * Math.max(1, playerAvatarCrop.zoom || 1);
      const dw = iw * scale;
      const dh = ih * scale;
      const panX = Number(playerAvatarCrop.panX || 0);
      const panY = Number(playerAvatarCrop.panY || 0);
      const maxShiftX = Math.max(0, (dw - size) / 2);
      const maxShiftY = Math.max(0, (dh - size) / 2);
      const shiftX = (maxShiftX * panX) / 100;
      const shiftY = (maxShiftY * panY) / 100;
      const dx = (size - dw) / 2 + shiftX;
      const dy = (size - dh) / 2 + shiftY;
      ctx.drawImage(img, dx, dy, dw, dh);
      const out = canvas.toDataURL("image/jpeg", 0.86);
      const safe = sanitizeUserImageUrl(out);
      if (!safe) return showToast("頭像處理失敗");
      setPlayerProfile((p) => ({ ...(p || {}), avatar: safe }));
      setPlayerAvatarCrop(null);
      showToast("大頭貼已更新");
    };
    img.onerror = () => showToast("圖片讀取失敗");
    img.src = playerAvatarCrop.src;
  };
  const startPlayerAvatarDrag = (e) => {
    if (!playerAvatarCrop) return;
    const px = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
    const py = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
    setPlayerAvatarCrop((s) => ({ ...(s || {}), dragging: true, dragStartX: px, dragStartY: py, startPanX: s?.panX || 0, startPanY: s?.panY || 0 }));
  };
  const movePlayerAvatarDrag = (e) => {
    setPlayerAvatarCrop((s) => {
      if (!s?.dragging) return s;
      const px = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
      const py = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
      const nextPanX = (s.startPanX || 0) + ((px - (s.dragStartX || 0)) / 1.8);
      const nextPanY = (s.startPanY || 0) + ((py - (s.dragStartY || 0)) / 1.8);
      return { ...s, panX: Math.max(-100, Math.min(100, nextPanX)), panY: Math.max(-100, Math.min(100, nextPanY)) };
    });
  };
  const endPlayerAvatarDrag = () => setPlayerAvatarCrop((s) => s ? { ...s, dragging: false } : s);
  const onPlayerAvatarPointerDown = (e) => {
    e.preventDefault();
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch (_) {}
    startPlayerAvatarDrag(e);
  };
  const onPlayerAvatarPointerMove = (e) => {
    if (!playerAvatarCrop?.dragging) return;
    e.preventDefault();
    movePlayerAvatarDrag(e);
  };
  const onPlayerAvatarPointerUp = (e) => {
    try { e.currentTarget.releasePointerCapture?.(e.pointerId); } catch (_) {}
    endPlayerAvatarDrag();
  };
  const activeChar = characters.find(c => c.id === activeCharId);
  const handleUnlock = () => { setUnlocking(true); setTimeout(() => { setLocked(false); setUnlocking(false); }, 450); };
  const onLockTouchStart = (e) => { lockStartYRef.current = e.touches?.[0]?.clientY ?? null; };
  const onLockTouchEnd = (e) => {
    const sy = lockStartYRef.current;
    const ey = e.changedTouches?.[0]?.clientY ?? null;
    lockStartYRef.current = null;
    if (sy === null || ey === null) return;
    const diff = sy - ey;
    if (diff > 70) handleUnlock();
  };
  const onLockMouseDown = (e) => { lockStartYRef.current = e.clientY ?? null; };
  const onLockMouseUp = (e) => {
    const sy = lockStartYRef.current;
    const ey = e.clientY ?? null;
    lockStartYRef.current = null;
    if (sy === null || ey === null) return;
    const diff = sy - ey;
    if (diff > 70) handleUnlock();
  };
  const onLockPointerDown = (e) => { lockStartYRef.current = e.clientY ?? null; };
  const onLockPointerUp = (e) => {
    const sy = lockStartYRef.current;
    const ey = e.clientY ?? null;
    lockStartYRef.current = null;
    if (sy === null || ey === null) return;
    const diff = sy - ey;
    if (diff > 70) handleUnlock();
  };
  const openApp = (id) => {
    if (id === "settings") setTempConfig({ ...apiConfig });
    if (id === "lorebook") setActiveLorebookId(null);
    setCurrentApp(id);
  };
  const closeApp = () => { setCurrentApp(null); setCurrentChatChar(null); };
  const closeMessageEditor = () => setMessageEditor(null);
  const deleteChatMessage = (charId, messageId) => {
    setChatHistory((h) => ({ ...h, [charId]: (h[charId] || []).filter((m) => m.id !== messageId) }));
    setActiveMessageId(null);
  };
  const startNoticeLongPress = (messageId) => {
    clearTimeout(noticeLongPressTimerRef.current);
    noticeLongPressTimerRef.current = setTimeout(() => {
      setActiveMessageId(messageId);
    }, 450);
  };
  const cancelNoticeLongPress = () => {
    clearTimeout(noticeLongPressTimerRef.current);
    noticeLongPressTimerRef.current = null;
  };
  const saveEditedMessage = () => {
    if (!currentChatChar || !messageEditor) return;
    const cid = currentChatChar.id;
    const next = (chatHistory[cid] || []).map((m) =>
      m.id === messageEditor.id ? { ...m, content: sanitizeText(messageEditor.content, 4000) } : m
    );
    setChatHistory((h) => ({ ...h, [cid]: next }));
    setMessageEditor(null);
    setActiveMessageId(null);
    showToast("訊息已更新");
  };
  const deleteMessageWithConfirm = () => {
    if (!currentChatChar || !messageEditor) return;
    if (!confirm("確定要刪除這則對話嗎？")) return;
    const cid = currentChatChar.id;
    const next = (chatHistory[cid] || []).filter((m) => m.id !== messageEditor.id);
    setChatHistory((h) => ({ ...h, [cid]: next }));
    setMessageEditor(null);
    setActiveMessageId(null);
    showToast("訊息已刪除");
  };
  const normalizeAssistantReply = (text) => {
    if (!text) return "";
    let t = String(text).trim();
    // 移除常見動作描寫格式：*...*、（...）、(...)
    t = t.replace(/\*[^*]{1,120}\*/g, " ");
    t = t.replace(/（[^（）]{1,120}）/g, " ");
    t = t.replace(/\([^()]{1,120}\)/g, " ");
    // 收斂空白與空行
    t = t.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    return t || "嗯，我在。";
  };
  const sortModelsByProvider = (provider, models) => {
    const list = [...(models || [])];
    if (provider !== "openrouter") return list;
    const companyOf = (m) => {
      const s = String(m || "");
      const slash = s.indexOf("/");
      return slash > 0 ? s.slice(0, slash).toLowerCase() : "zzz";
    };
    const isFree = (m) => /:free$/i.test(String(m || ""));
    return list.sort((a, b) => {
      const freeDiff = (isFree(b) ? 1 : 0) - (isFree(a) ? 1 : 0);
      if (freeDiff !== 0) return freeDiff;
      const ca = companyOf(a);
      const cb = companyOf(b);
      if (ca !== cb) return ca.localeCompare(cb);
      return String(a).localeCompare(String(b));
    });
  };
  const tokenizeForRecall = (text) => {
    const s = String(text || "").toLowerCase();
    const words = s.match(/[a-z0-9_]+|[\u4e00-\u9fff]/g) || [];
    return new Set(words.filter((w) => w.length >= 1));
  };
  const normalizeForMatch = (text) =>
    String(text || "")
      .toLowerCase()
      .replace(/[，。！？、,.!?\s]+/g, " ")
      .trim();
  const normalizeMemoryText = (text) =>
    String(text || "")
      .toLowerCase()
      .replace(/[，。！？、,.!?\s]+/g, " ")
      .trim();
  const memorySimilarity = (a, b) => {
    const sa = new Set(normalizeMemoryText(a).split(" ").filter(Boolean));
    const sb = new Set(normalizeMemoryText(b).split(" ").filter(Boolean));
    if (!sa.size || !sb.size) return 0;
    let inter = 0;
    sa.forEach((w) => { if (sb.has(w)) inter += 1; });
    return inter / Math.max(sa.size, sb.size);
  };
  const pickMemoriesForPrompt = (charId, recentMsgs) => {
    const list = (memories[charId] || []).filter((m) => m?.text);
    if (!list.length) return [];
    const pinned = list.filter((m) => m.pinned).slice(0, 5);
    const unpinned = list.filter((m) => !m.pinned);
    const query = recentMsgs.map((m) => `${m.role}:${m.content || ""}`).join("\n");
    const qTokens = tokenizeForRecall(query);
    const scored = unpinned.map((m) => {
      const tks = tokenizeForRecall(m.text);
      let hit = 0;
      tks.forEach((t) => { if (qTokens.has(t)) hit += 1; });
      return { m, hit };
    });
    scored.sort((a, b) => b.hit - a.hit || (b.m.date || 0) - (a.m.date || 0));
    const recalled = scored.filter((x) => x.hit > 0).slice(0, 3).map((x) => x.m);
    return [...pinned, ...recalled];
  };
  const getChatLorebookBinding = (charId) => {
    const fallbackBookIds = (lorebooks || []).map((b) => b.id);
    const binding = chatLorebookBindings?.[charId];
    if (!binding) return { enabledBookIds: fallbackBookIds, entryOverrides: {}, entryModes: {} };
    return {
      enabledBookIds: Array.isArray(binding.enabledBookIds) ? binding.enabledBookIds : fallbackBookIds,
      entryOverrides: binding.entryOverrides || {},
      entryModes: binding.entryModes || {},
    };
  };
  const toggleChatLorebookBook = (charId, bookId) => {
    setChatLorebookBindings((prev) => {
      const current = prev?.[charId] || {
        enabledBookIds: (lorebooks || []).map((b) => b.id),
        entryOverrides: {},
        entryModes: {},
      };
      const exists = current.enabledBookIds.includes(bookId);
      const enabledBookIds = exists
        ? current.enabledBookIds.filter((id) => id !== bookId)
        : [...current.enabledBookIds, bookId];
      return { ...prev, [charId]: { ...current, enabledBookIds } };
    });
  };
  const toggleChatLorebookEntry = (charId, entryId, defaultEnabled) => {
    setChatLorebookBindings((prev) => {
      const current = prev?.[charId] || {
        enabledBookIds: (lorebooks || []).map((b) => b.id),
        entryOverrides: {},
        entryModes: {},
      };
      const nowEnabled = Object.prototype.hasOwnProperty.call(current.entryOverrides, entryId)
        ? !!current.entryOverrides[entryId]
        : !!defaultEnabled;
      const nextEnabled = !nowEnabled;
      return {
        ...prev,
        [charId]: {
          ...current,
          entryOverrides: { ...current.entryOverrides, [entryId]: nextEnabled },
        },
      };
    });
  };
  const cycleChatLorebookEntryMode = (charId, entryId) => {
    setChatLorebookBindings((prev) => {
      const current = prev?.[charId] || {
        enabledBookIds: (lorebooks || []).map((b) => b.id),
        entryOverrides: {},
        entryModes: {},
      };
      const now = current.entryModes?.[entryId] || "AUTO";
      const next = now === "AUTO" ? "PIN" : "AUTO";
      return {
        ...prev,
        [charId]: {
          ...current,
          entryModes: { ...(current.entryModes || {}), [entryId]: next },
        },
      };
    });
  };
  const setAllChatLorebookEntries = (charId, book, enabled) => {
    if (!book) return;
    setChatLorebookBindings((prev) => {
      const current = prev?.[charId] || {
        enabledBookIds: (lorebooks || []).map((b) => b.id),
        entryOverrides: {},
        entryModes: {},
      };
      const nextOverrides = { ...current.entryOverrides };
      (book.entries || []).forEach((entry) => {
        if (!entry?.id) return;
        nextOverrides[entry.id] = !!enabled;
      });
      return {
        ...prev,
        [charId]: {
          ...current,
          entryOverrides: nextOverrides,
        },
      };
    });
  };
  const pickLorebookEntriesForPrompt = (charId, recentMsgs) => {
    const query = recentMsgs.map((m) => `${m.role}:${m.content || ""}`).join("\n");
    const normalizedQuery = normalizeForMatch(query);
    const latestUserMsg = [...recentMsgs].reverse().find((m) => m?.role === "user")?.content || "";
    const normalizedLatestUser = normalizeForMatch(latestUserMsg);
    const qTokens = tokenizeForRecall(query);
    const binding = getChatLorebookBinding(charId);
    const enabledBooks = (lorebooks || []).filter((b) => binding.enabledBookIds.includes(b.id));
    const pinned = [];
    const matched = [];
    const candidates = [];
    enabledBooks.forEach((book) => {
      (book.entries || []).forEach((entry) => {
        const mode = binding.entryModes?.[entry.id] || "AUTO";
        const effectiveEnabled = mode === "PIN"
          ? true
          : (Object.prototype.hasOwnProperty.call(binding.entryOverrides, entry.id)
              ? !!binding.entryOverrides[entry.id]
              : !!entry.enabled);
        if (!effectiveEnabled) return;
        if (mode === "PIN") {
          pinned.push({ entry, bookName: book.name || "世界書", hit: 9999, mode });
          return;
        }
        const keys = Array.isArray(entry.keywords) ? entry.keywords : [];
        const keyTokens = new Set(keys.flatMap((k) => [...tokenizeForRecall(k)]));
        let hit = 0;
        keyTokens.forEach((t) => { if (qTokens.has(t)) hit += 1; });
        // AUTO 強觸發：完整關鍵字命中「最新使用者訊息」即直接命中。
        let forcedByKeyword = false;
        keys.forEach((k) => {
          const nk = normalizeForMatch(k);
          if (!nk) return;
          if (normalizedLatestUser.includes(nk)) {
            forcedByKeyword = true;
            hit += 1000;
            return;
          }
          if (normalizedQuery.includes(nk)) hit += 3;
        });
        if (mode === "AUTO" && !forcedByKeyword && hit <= 0) return;
        if (hit > 0) matched.push({ entry, bookName: book.name || "世界書", hit, mode });
        if (hit > 0) candidates.push({ entry, bookName: book.name || "世界書", hit, mode });
      });
    });
    candidates.sort((a, b) => b.hit - a.hit || (b.entry.updatedAt || 0) - (a.entry.updatedAt || 0));
    const uniq = new Map();
    [...pinned, ...matched, ...candidates].forEach((x) => { if (!uniq.has(x.entry.id)) uniq.set(x.entry.id, x); });
    return Array.from(uniq.values()).slice(0, 8);
  };

  const sendMessage = async () => {
    if (!currentChatChar) return;
    const text = chatInput.trim(); const img = chatImage?.data || null;
    if (!text && !img) return;
    const cid = currentChatChar.id;
    const um = { id: gid(), role: "user", content: text, image: img, imageSummary: "", time: Date.now() };
    const prev = chatHistory[cid] || [];
    setChatHistory(h => ({ ...h, [cid]: [...prev, um] }));
    setChatInput(""); setChatImage(null); setIsTyping(true);
    try {
      const now = new Date();
      const nowDate = new Intl.DateTimeFormat("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
      const nowTime = new Intl.DateTimeFormat("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
      const nowTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Taipei";
      const nowContext = `[系統時間] 目前時間：${nowDate} ${nowTime} (${nowTz})`;
      const hist = [...prev, um]
        .slice(-30)
        .map((m) => {
          if (m.role === "system_notice") {
            return { role: "user", content: `[系統備註]\n${m.content || ""}`, image: null };
          }
          if (m.role === "user" || m.role === "assistant" || m.role === "system") {
            const summaryLine = m.imageSummary ? `\n[圖片摘要]\n${m.imageSummary}` : "";
            return { role: m.role, content: `${m.content || ""}${summaryLine}`.trim(), image: m.image || null };
          }
          return null;
        })
        .filter(Boolean)
        .slice(-20);
      const hasCurrentImage = !!um.image;
      // 視覺 token 只花在本輪新圖：舊圖一律改用摘要文字，不再重送 image。
      const safeHist = hist.map((m, idx) => {
        const isLast = idx === hist.length - 1;
        if (hasCurrentImage && isLast) return m; // 本輪新圖保留 image
        return { ...m, image: null };
      });
      const picked = pickMemoriesForPrompt(cid, safeHist);
      const memoryContext = picked.map((m, i) => `- ${i + 1}. ${m.text}`).join("\n");
      const loreHits = pickLorebookEntriesForPrompt(cid, safeHist);
      const pinnedLore = loreHits.filter((x) => x.mode === "PIN");
      const autoLore = loreHits.filter((x) => x.mode !== "PIN");
      const pinnedLoreContext = pinnedLore.map((x, i) => `${i + 1}. [${x.bookName}] ${x.entry.title || "條目"}：${x.entry.content || ""}`).join("\n");
      const autoLoreContext = autoLore.map((x, i) => `- ${i + 1}. [${x.bookName}] ${x.entry.title || "條目"}：${x.entry.content || ""}`).join("\n");
      const mergedContext = [
        getPlayerContextBlock(),
        nowContext,
        pinnedLoreContext ? `[強制條目 - 必須遵守]\n以下條目為當前對話的硬性規則，回覆時必須滿足：\n${pinnedLoreContext}` : "",
        memoryContext,
        autoLoreContext ? `[世界書]\n${autoLoreContext}` : "",
      ].filter(Boolean).join("\n\n");
      // 全域 token 保險上限：先裁歷史，再裁 context，避免超過模型上下文。
      let boundedHist = [...safeHist];
      let boundedContext = mergedContext;
      const countAllTokens = () => (
        estimateTokens(boundedContext) +
        boundedHist.reduce((sum, m) => sum + estimateTokens(m?.content || ""), 0)
      );
      while (boundedHist.length > 6 && countAllTokens() > TOTAL_CONTEXT_TOKEN_LIMIT) {
        boundedHist.shift();
      }
      if (countAllTokens() > TOTAL_CONTEXT_TOKEN_LIMIT) {
        const overflow = countAllTokens() - TOTAL_CONTEXT_TOKEN_LIMIT;
        const trimChars = Math.max(0, Math.ceil(overflow * 3.5));
        if (trimChars > 0 && boundedContext.length > trimChars) {
          boundedContext = boundedContext.slice(0, boundedContext.length - trimChars);
        }
      }
      const finalHist = boundedHist.map((m) => ({ ...m, content: applyUserPlaceholder(m.content) }));
      const sysP = applyUserPlaceholder(buildSystemPrompt(currentChatChar, boundedContext));
      const reply = await callAI(finalHist, apiConfig, sysP);
      const cleanReply = normalizeAssistantReply(reply);
      let imageSummary = "";
      if (hasCurrentImage) {
        const base = text ? `{{user}} 訊息：${text}\n` : "";
        imageSummary = sanitizeText(`${base}重點：${cleanReply}`.slice(0, 220), 220);
      }
      if (hasCurrentImage && imageSummary) {
        setChatHistory((h) => ({
          ...h,
          [cid]: (h[cid] || []).map((m) => (m.id === um.id ? { ...m, imageSummary } : m)),
        }));
      }
      setChatHistory(h => ({ ...h, [cid]: [...(h[cid] || []), { id: gid(), role: "assistant", content: cleanReply, time: Date.now() }] }));
    } catch (err) {
      const detail = sanitizeText(err?.message || "未知錯誤", 500);
      setChatHistory(h => ({ ...h, [cid]: [...(h[cid] || []), { id: gid(), role: "system_notice", content: `連線錯誤：${detail}`, time: Date.now() }] }));
    }
    setIsTyping(false);
  };
  const parseShareEventNotice = (text) => {
    const raw = String(text || "");
    if (!raw.startsWith("[APP_SHARE_EVENT]")) return null;
    const lines = raw.split("\n").map((x) => x.trim()).filter(Boolean);
    const meta = {};
    let bodyStart = 1;
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].includes("=")) { bodyStart = i; break; }
      const idx = lines[i].indexOf("=");
      const k = lines[i].slice(0, idx);
      const v = lines[i].slice(idx + 1);
      meta[k] = v;
      bodyStart = i + 1;
    }
    return { meta, body: lines.slice(bodyStart).join("\n") };
  };

  const handleImgUp = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      const raw = String(r.result || "");
      const safe = sanitizeUserImageUrl(raw);
      if (!safe) {
        showToast("圖片格式不支援");
        return;
      }
      const imgEl = new Image();
      imgEl.onload = () => {
        const { width, height } = imgEl;
        const candidates = [
          { maxEdge: 1280, quality: 0.8 },
          { maxEdge: 1024, quality: 0.72 },
          { maxEdge: 896, quality: 0.65 },
          { maxEdge: 768, quality: 0.58 },
        ];
        let picked = null;
        for (const c of candidates) {
          const maxSide = Math.max(width, height);
          const scale = maxSide > c.maxEdge ? (c.maxEdge / maxSide) : 1;
          const targetW = Math.max(1, Math.round(width * scale));
          const targetH = Math.max(1, Math.round(height * scale));
          const canvas = document.createElement("canvas");
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          ctx.drawImage(imgEl, 0, 0, targetW, targetH);
          const out = canvas.toDataURL("image/jpeg", c.quality);
          const data = out.split(",")[1] || "";
          const bytes = Math.floor((data.length * 3) / 4);
          picked = { data, mime: "image/jpeg", bytes, width: targetW, height: targetH, quality: c.quality };
          if (bytes <= CHAT_IMAGE_MAX_BYTES) break;
        }
        if (!picked || picked.bytes > CHAT_IMAGE_MAX_BYTES) {
          setChatImage(null);
          showToast("圖片壓縮到最低設定後仍超過 1MB，請改用裁切圖或內容更簡單的圖片");
          return;
        }
        setChatImage(picked);
        showToast(`已壓縮圖片 ${picked.width}x${picked.height} / ${Math.round(picked.bytes / 1024)}KB`);
      };
      imgEl.onerror = () => showToast("圖片讀取失敗");
      imgEl.src = safe;
    };
    r.readAsDataURL(f);
    e.target.value = "";
  };

  const addCharacter = (c) => {
    const nc = {
      ...c,
      id: gid(),
      createdAt: Date.now(),
      name: sanitizeText(c.name, 80),
      description: sanitizeText(c.description, 500),
      personality: sanitizeText(c.personality, 1200),
      scenario: sanitizeText(c.scenario, 1200),
      firstMessage: sanitizeText(c.firstMessage, 1200),
      messageExamples: sanitizeText(c.messageExamples, 3000),
      systemPrompt: sanitizeText(c.systemPrompt, 3000),
      relationshipToUser: sanitizeText(c.relationshipToUser, 120),
      creator: sanitizeText(c.creator, 80),
      creatorNotes: sanitizeText(c.creatorNotes, 1200),
      avatar: sanitizeUserImageUrl(c.avatar) || null,
      tags: Array.isArray(c.tags) ? c.tags.map((t) => sanitizeText(t, 30)).filter(Boolean).slice(0, 20) : [],
      statusText: sanitizeText(c.statusText || "", 80),
      statusUpdatedAt: c.statusUpdatedAt || 0,
    };
    setCharacters(p => [...p, nc]);
    if (!activeCharId) setActiveCharId(nc.id);
    setModal(null);
    showToast(`${nc.name} 已加入`);
  };
  const updateCharacter = (id, patch) => {
    setCharacters((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch, statusText: sanitizeText((patch.statusText ?? c.statusText) || "", 80) } : c)));
    setModal(null);
    setEditingCharacter(null);
    showToast("角色已更新");
  };
  const canUseCurrentProvider = () => {
    const isOllamaLocal = apiConfig.provider === "ollama" && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(apiConfig.baseUrl || "");
    const providerNeedsApiKey = !(apiConfig.provider === "ollama" && isOllamaLocal);
    return !providerNeedsApiKey || !!apiConfig.apiKey;
  };
  const refreshCharacterStatus = async (charId, force = false) => {
    const char = characters.find((x) => x.id === charId);
    if (!char) { showToast("找不到角色"); return; }
    const nowTs = Date.now();
    const fourHours = 4 * 60 * 60 * 1000;
    if (!force && char.statusUpdatedAt && nowTs - char.statusUpdatedAt < fourHours) return;
    const msgs = (chatHistory[charId] || []).slice(-12);
    if (!force && msgs.length === 0) return;
    if (!canUseCurrentProvider()) { showToast("請先完成 AI 連線設定（API Key）"); return; }
    try {
      const roleProfile = [
        char.description ? `角色設定：${sanitizeText(char.description, 400)}` : "",
        char.personality ? `個性：${sanitizeText(char.personality, 200)}` : "",
        char.scenario ? `情境：${sanitizeText(char.scenario, 200)}` : "",
        char.systemPrompt ? `補充規則：${sanitizeText(char.systemPrompt, 240)}` : "",
      ].filter(Boolean).join("\n");
      const mems = (memories[charId] || []).filter((m) => m.pinned).slice(0, 2).map((m) => `- ${m.text}`).join("\n");
      const conv = msgs.map((m) => `${m.role === "user" ? "{{user}}" : char.name}: ${m.content || "[圖片]"}`).join("\n");
      const prompt = [{
        role: "user",
        content: `請根據以下資訊，生成一則「符合角色人設」的手機狀態文字。\n規則：僅輸出 1 句，20~40 字，口語自然、對外可見，不要內心獨白、不要動作描述、不要引號包整句。\n\n角色：${char.name}\n${roleProfile ? `角色資料：\n${roleProfile}\n\n` : ""}最近對話：\n${conv}\n${mems ? `\n參考記憶：\n${mems}\n` : ""}`,
      }];
      const status = sanitizeText(await callAI(prompt, apiConfig, "你是狀態文字助理。"), 80);
      if (!status) { showToast("未取得狀態內容"); return; }
      setCharacters((prev) => prev.map((c) => c.id === charId ? { ...c, statusText: status, statusUpdatedAt: Date.now() } : c));
      showToast("狀態已更新");
    } catch (err) {
      showToast(`刷新失敗：${sanitizeText(err?.message || "未知錯誤", 120)}`);
    }
  };
  const togglePinMemory = (charId, memoryId) => {
    setMemories((prev) => {
      const arr = [...(prev[charId] || [])];
      const pinCount = arr.filter((x) => x.pinned).length;
      const idx = arr.findIndex((x) => x.id === memoryId);
      if (idx < 0) return prev;
      const target = arr[idx];
      if (!target.pinned && pinCount >= 5) {
        showToast("釘選最多 5 條");
        return prev;
      }
      arr[idx] = { ...target, pinned: !target.pinned };
      return { ...prev, [charId]: arr };
    });
  };
  const deleteMemory = (charId, memoryId) => {
    if (!confirm("確定要刪除這條記憶嗎？")) return;
    setMemories((prev) => ({ ...prev, [charId]: (prev[charId] || []).filter((x) => x.id !== memoryId) }));
    showToast("記憶已刪除");
  };
  const deleteCharacter = (id) => {
    const c = characters.find(x => x.id === id);
    setCharacters(p => p.filter(x => x.id !== id));
    if (activeCharId === id) setActiveCharId(characters.find(x => x.id !== id)?.id || null);
    setChatHistory(h => { const n = { ...h }; delete n[id]; return n; });
    setMemories(m => { const n = { ...m }; delete n[id]; return n; });
    setPhoneInboxCache((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    showToast(`${c?.name || "角色"} 已刪除`);
  };

  const parseJsonObjectFromText = (raw) => {
    const t = String(raw || "").trim();
    try { return JSON.parse(t); } catch {}
    const start = t.indexOf("{");
    const end = t.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try { return JSON.parse(t.slice(start, end + 1)); } catch {}
    }
    return null;
  };

  const generatePhoneNpcChats = async (char) => {
    if (!char) return;
    if (!canUseCurrentProvider()) { showToast("請先完成 AI 連線設定（API Key）"); return; }
    setPhoneGenLoading(true);
    try {
      const recent = (chatHistory[char.id] || []).slice(-10).map((m) => `${m.role === "user" ? "{{user}}" : char.name}: ${m.content || "[圖片]"}`).join("\n");
      const roleProfile = [char.description, char.personality, char.scenario].filter(Boolean).join("\n");
      const prompt = [{
        role: "user",
        content: `請幫我生成 ${char.name} 的手機「其他聊天」資料（不含玩家），輸出 JSON 且只能輸出 JSON。
格式：
{
  "threads":[
    {
      "name":"聯絡人名稱",
      "relation":"與角色關係（簡短）",
      "messages":[
        {"from":"other","text":"..."},
        {"from":"char","text":"..."}
      ]
    }
  ]
}
規則：
1) 只產生 3~5 個 threads。
2) 每個 thread 產生 4~8 則短訊息，語氣像通訊軟體。
3) from 只能是 "char" 或 "other"。
4) 不要時間戳、不要 markdown、不要多餘欄位。

角色設定：
${roleProfile || "（無）"}

最近和 {{user}} 對話（供語氣參考）：
${recent || "（尚無）"}
`,
      }];
      const raw = await callAI(prompt, apiConfig, "你是手機聊天資料生成器，只能輸出有效 JSON。");
      const parsed = parseJsonObjectFromText(raw);
      const threadsRaw = Array.isArray(parsed?.threads) ? parsed.threads : [];
      const threads = threadsRaw.slice(0, 5).map((t, idx) => {
        const msgs = Array.isArray(t?.messages) ? t.messages : [];
        return {
          id: `npc-${idx}-${gid()}`,
          name: sanitizeText(t?.name || `聯絡人${idx + 1}`, 24),
          relation: sanitizeText(t?.relation || "", 40),
          messages: msgs.slice(0, 8).map((m, mi) => ({
            id: `m-${idx}-${mi}-${gid()}`,
            from: m?.from === "char" ? "char" : "other",
            text: sanitizeText(m?.text || "", 120),
            time: Date.now() - (8 - mi) * 60000,
          })).filter((m) => !!m.text),
        };
      }).filter((t) => t.messages.length > 0);
      if (!threads.length) throw new Error("模型未回傳可用的聊天資料");
      setPhoneInboxCache((prev) => ({
        ...prev,
        [char.id]: { updatedAt: Date.now(), threads },
      }));
      showToast(`已更新其他聊天（${threads.length} 人）`);
    } catch (err) {
      showToast(`生成失敗：${sanitizeText(err?.message || "未知錯誤", 120)}`);
    }
    setPhoneGenLoading(false);
  };

  const generateMemory = async (char) => {
    const msgs = chatHistory[char.id] || [];
    if (msgs.length < 4) { showToast("對話太少，先多聊幾句再生成記憶"); return; }
    const existing = memories[char.id] || [];
    if (existing.length >= 30) { showToast("記憶已滿 30 條，請先刪除後再生成"); return; }
    const isOllamaLocal = apiConfig.provider === "ollama" && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(apiConfig.baseUrl || "");
    const providerNeedsApiKey = !(apiConfig.provider === "ollama" && isOllamaLocal);
    if (providerNeedsApiKey && !apiConfig.apiKey) { showToast("請先設定 API Key"); return; }
    setGenLoading(true);
    try {
      const recent = msgs
        .slice(-30)
        .map((m) => `${m.role === "user" ? "{{user}}" : char.name}: ${m.content || "[圖片]"}`)
        .join("\n");
      const roleProfile = [
        char.description ? `角色描述：${sanitizeText(char.description, 320)}` : "",
        char.personality ? `角色個性：${sanitizeText(char.personality, 220)}` : "",
        char.scenario ? `角色情境：${sanitizeText(char.scenario, 220)}` : "",
        char.relationshipToUser ? `與玩家關係：${sanitizeText(char.relationshipToUser, 120)}` : "",
      ].filter(Boolean).join("\n");
      const prompt = [{
        role: "user",
        content: `你要為角色「${char.name}」整理長期記憶，務必嚴格遵守角色人設。
規則：
1) 只能輸出 1 則記憶，20~80 字，繁中。
2) 記憶必須具體、可持續（偏好/事實/關係/約定），避免空話。
3) 不得臆測或改寫角色的性別、身分、關係設定；若對話未提及就不要補。
4) 不要使用「她/他」等可能造成性別偏移的主詞，優先用角色名「${char.name}」。
5) 只輸出記憶文字本身，不要解釋。

角色設定：
${roleProfile || "（無）"}

最近對話：
${recent}`,
      }];
      const text = await callAI(prompt, apiConfig, "你是角色記憶整理助手。");
      const safeText = sanitizeText(text, 120);
      if (!safeText || safeText.length < 8) throw new Error("模型未產生有效記憶");
      const duplicated = existing.some((mem) => memorySimilarity(mem.text, safeText) >= 0.78);
      if (duplicated) {
        showToast("記憶過於相似，已略過新增");
      } else {
        setMemories(m => ({ ...m, [char.id]: [...(m[char.id] || []), { id: gid(), text: safeText, date: Date.now(), pinned: false }] }));
        showToast("記憶生成成功");
      }
    } catch (err) {
      showToast(`記憶生成失敗：${err.message}`);
    }
    setGenLoading(false);
  };

  const generatePost = async (char) => {
    const isOllamaLocal = apiConfig.provider === "ollama" && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(apiConfig.baseUrl || "");
    const providerNeedsApiKey = !(apiConfig.provider === "ollama" && isOllamaLocal);
    if (providerNeedsApiKey && !apiConfig.apiKey) { showToast("請先設定 API Key"); return; }
    try {
      const sysP = buildSystemPrompt(char, getPlayerContextBlock());
      const t = await callAI([{
        role: "user",
        content: "請寫一則 50 字內、口吻自然、可發在社群上的近況貼文。",
      }], apiConfig, sysP);
        setPosts(p => [{ id: gid(), charId: char.id, charName: char.name, charAvatar: char.avatar, content: t, comments: [], time: Date.now(), likes: Math.floor(Math.random() * 50), liked: false }, ...p]);
        showToast(`${char.name} 已發佈貼文`);
      } catch (err) {
        showToast(`發文失敗：${err.message}`);
      }
    };
  const handleRandomSocialPost = () => {
    const nowTs = Date.now();
    const globalLeft = SOCIAL_GLOBAL_COOLDOWN_MS - (nowTs - (socialLastGlobalPostAtRef.current || 0));
    if (globalLeft > 0) {
      showToast(`刷新太快，請 ${Math.ceil(globalLeft / 1000)} 秒後再試`);
      return;
    }
    const c = pickRandomSocialCharacter();
    if (!c) return;
    const lastForChar = socialLastPostByCharRef.current?.[c.id] || 0;
    const charLeft = SOCIAL_CHAR_COOLDOWN_MS - (nowTs - lastForChar);
    if (charLeft > 0) {
      showToast(`${c.name} 剛發過文，請 ${Math.ceil(charLeft / 1000)} 秒後再試`);
      return;
    }
    socialLastGlobalPostAtRef.current = nowTs;
    socialLastPostByCharRef.current = { ...(socialLastPostByCharRef.current || {}), [c.id]: nowTs };
    generatePost(c);
  };
  const pickRandomSocialCharacter = () => {
    if (!Array.isArray(characters) || characters.length === 0) return null;
    if (characters.length === 1) return characters[0];
    const lastCharId = posts?.[0]?.charId || null;
    const pool = characters.filter((c) => c.id !== lastCharId);
    const list = pool.length ? pool : characters;
    return list[Math.floor(Math.random() * list.length)] || null;
  };
  const addPostComment = async (postId) => {
    const raw = postCommentInputs[postId] || "";
    const text = sanitizeText(raw, 240).trim();
    if (!text) return;
    const post = posts.find((x) => x.id === postId);
    if (!post) return;
    setPostCommentInputs((prev) => ({ ...prev, [postId]: "" }));
    const userComment = { id: gid(), role: "user", content: text, time: Date.now() };
    setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, comments: [...(p.comments || []), userComment] } : p));
    const char = characters.find((c) => c.id === post.charId);
    if (!char) return;
    try {
      const sysP = buildSystemPrompt(char, getPlayerContextBlock());
      const ai = await callAI([{
        role: "user",
        content: `你剛發了一則貼文：「${post.content}」\n{{user}} 留言：「${text}」\n請用角色口吻回覆 1~2 句自然留言。`,
      }], apiConfig, sysP);
      const reply = sanitizeText(ai || "", 240).trim() || "收到，謝謝你的留言。";
      const charComment = { id: gid(), role: "assistant", content: reply, time: Date.now() };
      setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, comments: [...(p.comments || []), charComment] } : p));
    } catch (_) {}
  };
  const sharePostToChat = (post) => {
    if (!window.confirm("要分享到此角色聊天室嗎？")) return;
    const char = characters.find((c) => c.id === post.charId);
    if (!char) return;
    const lines = (post.comments || []).slice(-4).map((c) => `${c.role === "assistant" ? post.charName : "{{user}}"}：${c.content}`);
    const rawBody = [`貼文：${post.content}`, ...(lines.length ? ["留言：", ...lines] : [])].join("\n");
    const approxTokens = Math.ceil(rawBody.length / 3.5);
    const content = approxTokens <= SHARE_RAW_TOKEN_LIMIT
      ? [
          `[APP_SHARE_EVENT]`,
          `source=social`,
          `mode=raw`,
          `actor=${post.charName}`,
          `token_estimate=${approxTokens}`,
          rawBody,
        ].join("\n")
      : [
          `[APP_SHARE_EVENT]`,
          `source=social`,
          `mode=summary`,
          `actor=${post.charName}`,
          `token_estimate=${approxTokens}`,
          `摘要：${sanitizeText(post.content, 220)}`,
          ...(lines.length ? [`互動重點：${sanitizeText(lines.join(" / "), 260)}`] : []),
        ].join("\n");
    const notice = { id: gid(), role: "system_notice", content, time: Date.now() };
    setChatHistory((h) => ({ ...h, [post.charId]: [...(h[post.charId] || []), notice] }));
    showToast(approxTokens <= SHARE_RAW_TOKEN_LIMIT ? "已分享到聊天室（原文）" : "已分享到聊天室（摘要）");
  };
  useEffect(() => {
    if (!hydrated || !activeCharId) return;
    refreshCharacterStatus(activeCharId, false);
    const t = setInterval(() => { refreshCharacterStatus(activeCharId, false); }, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [hydrated, activeCharId, chatHistory, memories, apiConfig, characters]);

  if (locked) return (<><style>{css}</style><div className="mp-wrap"><div className="mp-phone"><div className={`mp-lock ${unlocking?"out":""}`} onTouchStart={onLockTouchStart} onTouchEnd={onLockTouchEnd} onMouseDown={onLockMouseDown} onMouseUp={onLockMouseUp} onPointerDown={onLockPointerDown} onPointerUp={onLockPointerUp} onDoubleClick={handleUnlock}><BarClock ft={ft} /><LockClock ft={ft} fd={fd} /><div className="mp-lock-hint">向上滑動解鎖 MaliPhone（或雙擊）</div></div></div></div></>);

  const appById = Object.fromEntries(DEFAULT_APPS.map(a => [a.id, a]));
  const renderAppIcon = (app, size = 26) => {
    if (app?.iconUrl) {
      return <img className="mp-app-icon-img" src={app.iconUrl} alt={app?.name || ""} draggable={false} onContextMenu={(e)=>e.preventDefault()} style={{ width: size, height: size }} />;
    }
    return app?.icon || "";
  };
  const allAppIds = DEFAULT_APPS.map((a) => a.id);
  const safeDock = dockOrder.filter((id) => allAppIds.includes(id)).slice(0, 4);
  const dockSet = new Set(safeDock);
  const cleanedSlots = homeSlots.map((id) => (id && allAppIds.includes(id) && !dockSet.has(id) ? id : null));
  const used = new Set();
  for (let i = 0; i < cleanedSlots.length; i++) {
    const id = cleanedSlots[i];
    if (!id) continue;
    if (used.has(id)) cleanedSlots[i] = null;
    else used.add(id);
  }
  const missingForHome = allAppIds.filter((id) => !dockSet.has(id) && !used.has(id));
  for (let i = PAGE_SIZE; i < PAGE_SIZE * 2 && missingForHome.length; i++) {
    if (!cleanedSlots[i]) cleanedSlots[i] = missingForHome.shift();
  }
  for (let i = 0; i < cleanedSlots.length && missingForHome.length; i++) {
    if (!cleanedSlots[i]) cleanedSlots[i] = missingForHome.shift();
  }
  const homePages = [
    cleanedSlots.slice(0, PAGE_SIZE),
    cleanedSlots.slice(PAGE_SIZE, PAGE_SIZE * 2),
    cleanedSlots.slice(PAGE_SIZE * 2, PAGE_SIZE * 3),
  ];
  const dockApps = safeDock.map(id => appById[id]).filter(Boolean);

  const findSlotIndex = (slots, appId) => slots.findIndex((id) => id === appId);
  const moveAppToHomeSlot = (appId, targetSlotIndex) => {
    if (!allAppIds.includes(appId)) return;
    if (safeDock.includes(appId) && safeDock.length <= 2) return;
    const nextDock = safeDock.filter((id) => id !== appId);
    const nextSlots = [...cleanedSlots];
    const fromSlot = findSlotIndex(nextSlots, appId);
    if (fromSlot >= 0) nextSlots[fromSlot] = null;
    const occupant = nextSlots[targetSlotIndex];
    nextSlots[targetSlotIndex] = appId;
    if (occupant && occupant !== appId) {
      if (fromSlot >= 0) nextSlots[fromSlot] = occupant;
      else {
        const emptyIdx = nextSlots.findIndex((id) => id === null);
        if (emptyIdx >= 0) nextSlots[emptyIdx] = occupant;
      }
    }
    setDockOrder(nextDock);
    setHomeSlots(nextSlots);
  };
  const moveAppToDock = (appId, targetDockIndex) => {
    if (!allAppIds.includes(appId)) return;
    const isFromDock = safeDock.includes(appId);
    let nextDock = safeDock.filter((id) => id !== appId);
    if (!isFromDock && nextDock.length >= 4) return;
    if (isFromDock && nextDock.length < 2) return;
    const idx = Math.max(0, Math.min(targetDockIndex, nextDock.length));
    nextDock.splice(idx, 0, appId);
    const nextSlots = cleanedSlots.map((id) => (id === appId ? null : id));
    setDockOrder(nextDock);
    setHomeSlots(nextSlots);
  };
  const onHomeTouchStart = (e) => {
    if (isDraggingApp || pointerDrag) return;
    swipeStartXRef.current = e.touches?.[0]?.clientX ?? null;
    swipeStartYRef.current = e.touches?.[0]?.clientY ?? null;
  };
  const switchHomePageBySwipe = (sx, sy, ex, ey) => {
    if (isDraggingApp) return;
    if (sx === null || ex === null || sy === null || ey === null) return;
    const diffX = sx - ex;
    const diffY = sy - ey;
    const absX = Math.abs(diffX);
    const absY = Math.abs(diffY);
    // 更接近手機手感：降低觸發門檻，並允許些微斜向滑動
    if (absX < 18) return;
    if (absY > absX * 1.35) return;
    if (diffX > 0) setHomePage(p => Math.min(p + 1, homePages.length - 1));
    else setHomePage(p => Math.max(p - 1, 0));
  };
  const onHomeTouchEnd = (e) => {
    if (isDraggingApp || pointerDrag) {
      swipeStartXRef.current = null;
      swipeStartYRef.current = null;
      return;
    }
    const sx = swipeStartXRef.current;
    const sy = swipeStartYRef.current;
    const ex = e.changedTouches?.[0]?.clientX ?? null;
    const ey = e.changedTouches?.[0]?.clientY ?? null;
    swipeStartXRef.current = null;
    swipeStartYRef.current = null;
    switchHomePageBySwipe(sx, sy, ex, ey);
  };
  const onHomeMouseDown = (e) => {
    if (isDraggingApp || pointerDrag) return;
    swipeStartXRef.current = e.clientX ?? null;
    swipeStartYRef.current = e.clientY ?? null;
  };
  const onHomeMouseUp = (e) => {
    if (isDraggingApp || pointerDrag) {
      swipeStartXRef.current = null;
      swipeStartYRef.current = null;
      return;
    }
    const sx = swipeStartXRef.current;
    const sy = swipeStartYRef.current;
    const ex = e.clientX ?? null;
    const ey = e.clientY ?? null;
    swipeStartXRef.current = null;
    swipeStartYRef.current = null;
    switchHomePageBySwipe(sx, sy, ex, ey);
  };
  const onHomePointerDown = (e) => {
    if (pointerDrag) return;
    swipeStartXRef.current = e.clientX ?? null;
    swipeStartYRef.current = e.clientY ?? null;
  };
  const onHomePointerUp = (e) => {
    if (pointerDrag) {
      const dragging = pointerDrag;
      setPointerDrag(null);
      setIsDraggingApp(false);
      clearTimeout(edgeTurnTimerRef.current);
      edgeTurnTimerRef.current = null;
      edgeTurnDirRef.current = null;
      const upDx = Math.abs((e.clientX || 0) - (dragging.startX || 0));
      const upDy = Math.abs((e.clientY || 0) - (dragging.startY || 0));
      const movedByDistance = (upDx + upDy) > 8;
      if (!dragging.moved && !movedByDistance) {
        openApp(dragging.appId);
        return;
      }
      suppressAppClickUntilRef.current = Date.now() + 350;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const slotEl = el?.closest?.("[data-drop-slot]");
      const dockEl = el?.closest?.("[data-drop-dock]");
      const dockWrap = el?.closest?.("[data-drop-dock-wrap]");
      if (slotEl) {
        const slot = Number(slotEl.getAttribute("data-drop-slot"));
        if (!Number.isNaN(slot)) moveAppToHomeSlot(dragging.appId, slot);
      } else if (dockWrap) {
        const rect = dockWrap.getBoundingClientRect();
        const relX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
        const slotCount = Math.max(1, dockApps.length);
        const ratio = relX / rect.width;
        const targetIndex = Math.max(0, Math.min(dockApps.length, Math.round(ratio * slotCount)));
        moveAppToDock(dragging.appId, targetIndex);
      } else if (dockEl) {
        const idx = Number(dockEl.getAttribute("data-drop-dock"));
        if (!Number.isNaN(idx)) moveAppToDock(dragging.appId, idx);
      }
      return;
    }
    const sx = swipeStartXRef.current;
    const sy = swipeStartYRef.current;
    const ex = e.clientX ?? null;
    const ey = e.clientY ?? null;
    swipeStartXRef.current = null;
    swipeStartYRef.current = null;
    switchHomePageBySwipe(sx, sy, ex, ey);
  };
  const onHomePointerMove = (e) => {
    if (!pointerDrag) return;
    const dx = Math.abs((e.clientX || 0) - pointerDrag.startX);
    const dy = Math.abs((e.clientY || 0) - pointerDrag.startY);
    const moved = dx + dy > 8;
    setPointerDrag((p) => ({ ...p, x: e.clientX || 0, y: e.clientY || 0, moved }));
    const vw = window.innerWidth || 0;
    const x = e.clientX || 0;
    const edge = 28;
    let dir = null;
    const maxPage = Math.max(0, homePages.length - 1);
    if (x <= edge && homePage > 0) dir = -1;
    else if (x >= vw - edge && homePage < maxPage) dir = 1;
    if (dir !== edgeTurnDirRef.current) {
      clearTimeout(edgeTurnTimerRef.current);
      edgeTurnTimerRef.current = null;
      edgeTurnDirRef.current = dir;
      if (dir) {
        edgeTurnTimerRef.current = setTimeout(() => {
          setHomePage((p) => Math.max(0, Math.min(maxPage, p + dir)));
          edgeTurnTimerRef.current = null;
          edgeTurnDirRef.current = null;
        }, 450);
      }
    }
  };

    // ---- Status (RPG) ----
  const renderStatus = () => (
      <div className="mp-page">
        <div className="mp-hdr"><div className="mp-back" onClick={closeApp}>←</div><div className="mp-htitle">狀態</div></div>
        <div className="mp-cm">
          {characters.length === 0 ? <div className="mp-empty"><div className="mp-empty-i">🧩</div><div className="mp-empty-t">目前尚未建立角色</div></div>
          : characters.map(c => {
            const msgs = chatHistory[c.id] || [];
            const mems = memories[c.id] || [];
            const uMsgs = msgs.filter(m => m.role === "user").length;
            const aMsgs = msgs.filter(m => m.role === "assistant").length;
            const firstD = msgs.length > 0 ? new Date(msgs[0].time).toLocaleDateString("zh-TW") : "--";
            const lastD = msgs.length > 0 ? new Date(msgs[msgs.length-1].time).toLocaleDateString("zh-TW") : "--";
            const days = msgs.length > 0 ? Math.max(1, Math.ceil((Date.now() - msgs[0].time) / 86400000)) : 0;
            const exp = statusExpandedCharId === c.id;
            return (
              <div key={c.id} className="mp-sc">
                <div className="mp-sc-ban" />
                <div className="mp-sc-avl">{sanitizeUserImageUrl(c.avatar) ? <img src={sanitizeUserImageUrl(c.avatar)} alt="" /> : "🦊"}</div>
                <div className="mp-sc-body">
                  <div className="mp-sc-nm">{c.name}</div>
                  <div style={{fontSize:12,color:"var(--mp-txt-l)",marginTop:4,lineHeight:1.5}}>{(c.statusText || "尚無狀態").slice(0,80)}</div>
                  {c.statusUpdatedAt ? <div style={{fontSize:10,color:"var(--mp-txt-l)",opacity:.8,marginTop:2}}>更新時間：{new Date(c.statusUpdatedAt).toLocaleTimeString("zh-TW",{hour:"2-digit",minute:"2-digit"})}</div> : null}
                  <div style={{marginTop:6}}>
                    <button className="mp-ibtn" onClick={()=>refreshCharacterStatus(c.id, true)}>刷新狀態</button>
                  </div>
                  {c.tags?.length > 0 && <div className="mp-sc-tags">{c.tags.map((t,i) => <span key={i} className="mp-tag">{t}</span>)}</div>}
                  {c.creator && <div style={{fontSize:10,color:"var(--mp-txt-l)",marginTop:4}}>by {c.creator}</div>}
                  <div className="mp-sc-stats">
                    <div className="mp-stat"><div className="mp-stat-v">{msgs.length}</div><div className="mp-stat-lb">訊息</div></div>
                    <div className="mp-stat"><div className="mp-stat-v">{days}</div><div className="mp-stat-lb">互動天數</div></div>
                    <div className="mp-stat"><div className="mp-stat-v">{mems.length}</div><div className="mp-stat-lb">記憶</div></div>
                    <div className="mp-stat"><div className="mp-stat-v">{posts.filter(p=>p.charId===c.id).length}</div><div className="mp-stat-lb">貼文</div></div>
                  </div>
                  <div className="mp-sec">
                    <div className="mp-sec-t">對話摘要</div>
                    <div className="mp-sec-ct">
                      <div className="mp-sec-row"><span>使用者訊息</span><span style={{color:"var(--mp-pink-dk)"}}>{uMsgs}</span></div>
                      <div className="mp-sec-row"><span>{c.name} 回覆</span><span style={{color:"var(--mp-purple)"}}>{aMsgs}</span></div>
                      <div className="mp-sec-row"><span>首次對話</span><span>{firstD}</span></div>
                      <div className="mp-sec-row"><span>最近對話</span><span>{lastD}</span></div>
                    </div>
                  </div>
                  <div className="mp-sec">
                    <div className="mp-sec-t">記憶片段</div>
                    {mems.length === 0 ? <div style={{fontSize:11,color:"var(--mp-txt-l)",textAlign:"center",padding:6}}>目前尚無記憶，點擊下方按鈕可生成</div>
                    : <div className="mp-tl">{[...mems].sort((a, b) => {
                      if (!!b.pinned !== !!a.pinned) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
                      return (b.date || 0) - (a.date || 0);
                    }).slice(0, 5).map((m,i) => (
                      <div key={m.id || i} className="mp-tl-item">
                        <div className="mp-tl-dot" style={{top:6}} />
                        <div className="mp-mem" onClick={() => setActiveMemoryId((p) => (p === m.id ? null : m.id))}>{m.text}</div>
                        <div className="mp-mem-d" style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:6}}>
                          <span>{new Date(m.date).toLocaleDateString("zh-TW")}{m.pinned ? " · 已釘選" : ""}</span>
                          <span style={{display:"flex",gap:6}}>
                            <button className={`mp-ibtn ${activeMemoryId===m.id?"":"mp-ibtn-hidden"}`} onClick={() => setMemoryEditor({ charId: c.id, memoryId: m.id, text: m.text || "" })}>✎</button>
                            <button className={`mp-ibtn ${activeMemoryId===m.id?"":"mp-ibtn-hidden"}`} onClick={() => togglePinMemory(c.id, m.id)}>{m.pinned ? "📌" : "📍"}</button>
                            <button className={`mp-ibtn-r ${activeMemoryId===m.id?"":"mp-ibtn-hidden"}`} onClick={() => deleteMemory(c.id, m.id)}>🗑</button>
                          </span>
                        </div>
                      </div>
                    ))}</div>}
                    <button className="mp-gbtn" onClick={() => generateMemory(c)} disabled={genLoading}>{genLoading ? "生成中..." : "生成記憶"}</button>
                  </div>
                  {(c.description || c.systemPrompt || c.personality || c.scenario) && (
                    <div className="mp-sec">
                      <div className="mp-sec-t" style={{cursor:"pointer"}} onClick={() => setStatusExpandedCharId(exp ? null : c.id)}>角色設定 {exp ? "收起" : "展開"}</div>
                      {exp && <div className="mp-persona">{c.description && <><strong>角色設定：</strong>{c.description}{"\n\n"}</>}{c.systemPrompt && <><strong>System Prompt：</strong>{c.systemPrompt}{"\n\n"}</>}{c.personality && <><strong>個性：</strong>{c.personality}{"\n\n"}</>}{c.scenario && <><strong>情境：</strong>{c.scenario}</>}</div>}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
  );

  // ---- Chat ----
  const renderChat = () => {
    if (currentChatChar) {
      const msgs = chatHistory[currentChatChar.id] || [];
      const binding = getChatLorebookBinding(currentChatChar.id);
      return (
        <div className="mp-page">
          <div className="mp-hdr">
            <div className="mp-back" onClick={() => { setCurrentChatChar(null); setChatSettingsOpen(false); }}>←</div>
            <div className="mp-htitle">{currentChatChar.name}</div>
            <button className="mp-ibtn" style={{ marginLeft: "auto" }} onClick={() => setChatSettingsOpen(true)}>設定</button>
          </div>
          {chatSettingsOpen ? (
            <div className="mp-cm" style={{ paddingTop: 8 }}>
              <div className="mp-cc" style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>聊天室設定</div>
              </div>
              <div className="mp-cc">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>世界書綁定</div>
                  <div style={{ fontSize: 11, color: "var(--mp-txt-l)" }}>{binding.enabledBookIds.length} 本啟用</div>
                </div>
                {(lorebooks || []).length === 0 && <div style={{ fontSize: 11, color: "var(--mp-txt-l)" }}>尚未建立世界書</div>}
                {(lorebooks || []).map((book) => {
                  const bookOn = binding.enabledBookIds.includes(book.id);
                  const isExpanded = !!chatSettingsExpandedBooks[book.id];
                  return (
                    <div key={book.id} style={{ marginBottom: 10, border: "1px solid rgba(244,143,177,.2)", borderRadius: 10, overflow: "hidden" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 700, padding: "10px 10px 8px", background: "rgba(244,143,177,.08)" }}>
                        <input type="checkbox" checked={bookOn} onChange={() => toggleChatLorebookBook(currentChatChar.id, book.id)} />
                        <span style={{ flex: 1 }}>{book.name || "未命名世界書"}</span>
                        <span style={{ fontSize: 10, color: "var(--mp-txt-l)", fontWeight: 600 }}>{(book.entries || []).length} 條</span>
                        <button
                          className="mp-ibtn"
                          style={{ padding: "2px 8px", fontSize: 10 }}
                          onClick={() => setChatSettingsExpandedBooks((prev) => ({ ...prev, [book.id]: !isExpanded }))}
                        >
                          {isExpanded ? "收合" : "展開"}
                        </button>
                      </div>
                      {isExpanded && (
                        <div style={{ padding: "8px 10px 10px", background: "#fff" }}>
                          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                            <button className="mp-ibtn" style={{ fontSize: 10, padding: "2px 8px" }} disabled={!bookOn} onClick={() => setAllChatLorebookEntries(currentChatChar.id, book, true)}>全選</button>
                            <button className="mp-ibtn" style={{ fontSize: 10, padding: "2px 8px" }} disabled={!bookOn} onClick={() => setAllChatLorebookEntries(currentChatChar.id, book, false)}>全不選</button>
                            {!bookOn && <span style={{ fontSize: 10, color: "var(--mp-txt-l)", marginLeft: "auto" }}>先勾選此世界書才會套用</span>}
                          </div>
                          <div style={{ display: "grid", gap: 6, maxHeight: 220, overflowY: "auto", paddingRight: 2 }}>
                          {(book.entries || []).map((entry) => {
                            const entryOn = Object.prototype.hasOwnProperty.call(binding.entryOverrides, entry.id)
                              ? !!binding.entryOverrides[entry.id]
                              : !!entry.enabled;
                            const mode = binding.entryModes?.[entry.id] || "AUTO";
                            const modeColor = mode === "PIN" ? "#1e88e5" : "#43a047";
                            return (
                              <label key={entry.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "var(--mp-txt-l)", padding: "4px 2px" }}>
                                <input type="checkbox" checked={entryOn} disabled={!bookOn} onChange={() => toggleChatLorebookEntry(currentChatChar.id, entry.id, !!entry.enabled)} />
                                <span style={{flex:1}}>{entry.title || "未命名條目"}</span>
                                <button
                                  className="mp-ibtn"
                                  disabled={!bookOn}
                                  style={{ fontSize: 10, padding: "1px 8px", borderColor: modeColor, color: modeColor }}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    cycleChatLorebookEntryMode(currentChatChar.id, entry.id);
                                  }}
                                  title="AUTO=關鍵字命中觸發, PIN=常駐"
                                >
                                  {mode}
                                </button>
                              </label>
                            );
                          })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="mp-cr">
            <div className="mp-msgs">
              {msgs.map(m => {
                  if (m.role === "system_notice") {
                    const share = parseShareEventNotice(m.content);
                    return (
                      <div key={m.id} className="mp-msg-note-wrap">
                        <div
                          className="mp-msg-note"
                          onPointerDown={() => startNoticeLongPress(m.id)}
                        onPointerUp={cancelNoticeLongPress}
                        onPointerLeave={cancelNoticeLongPress}
                      >
                          {share ? (
                            <div style={{ textAlign: "left" }}>
                              <div style={{ fontWeight: 700, marginBottom: 4 }}>社交分享</div>
                              <div style={{ fontSize: 11, color: "var(--mp-txt-l)", marginBottom: 6 }}>
                                來源：{share.meta.source || "-"}
                              </div>
                              <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5, maxHeight: 180, overflowY: "auto", paddingRight: 2 }}>{applyUserPlaceholder(share.body)}</div>
                            </div>
                          ) : m.content}
                        </div>
                      {activeMessageId === m.id && (
                        <button className="mp-msg-editbtn" onClick={() => deleteChatMessage(currentChatChar.id, m.id)}>🗑</button>
                      )}
                    </div>
                  );
                }
                const isUser = m.role === "user";
                const isActive = activeMessageId === m.id;
                return (
                  <div key={m.id} className={`mp-msg-wrap ${isUser?"mp-msg-wrap-user":"mp-msg-wrap-ai"}`}>
                    {isUser && <button className={`mp-msg-editbtn ${isActive ? "" : "mp-msg-editbtn-hidden"}`} onClick={() => setMessageEditor({ id: m.id, content: m.content || "" })}>✎</button>}
                    <div className={`mp-msg ${isUser?"mp-msg-user":"mp-msg-ai"}`} onClick={() => setActiveMessageId((p) => (p === m.id ? null : m.id))}>
                      {m.image && <img src={`data:image/png;base64,${m.image}`} className="mp-msg-img" alt="" />}
                      {m.content && <div>{m.content}</div>}
                      <div className="mp-msg-t">{new Date(m.time).toLocaleTimeString("zh-TW",{hour:"2-digit",minute:"2-digit"})}</div>
                    </div>
                    {!isUser && <button className={`mp-msg-editbtn ${isActive ? "" : "mp-msg-editbtn-hidden"}`} onClick={() => setMessageEditor({ id: m.id, content: m.content || "" })}>✎</button>}
                  </div>
                );
              })}
              {isTyping && <div className="mp-typing"><span /><span /><span /></div>}
              <div ref={messagesEndRef} />
            </div>
            {chatImage && (
              <div className="mp-imgprev">
                <img src={`data:${chatImage.mime};base64,${chatImage.data}`} alt="" />
                <div style={{ fontSize: 10, color: "var(--mp-txt-l)", marginTop: 4 }}>
                  {chatImage.width}x{chatImage.height} · {Math.round(chatImage.bytes / 1024)}KB
                </div>
                <button onClick={() => setChatImage(null)}>×</button>
              </div>
            )}
              <div className="mp-inp-bar">
                <button className="mp-btn mp-btn-img" onClick={()=>fileInputRef.current?.click()}>🖼</button>
                <input type="file" ref={fileInputRef} accept="image/*" style={{display:"none"}} onChange={handleImgUp} />
                <textarea
                  className="mp-inp"
                  placeholder="輸入訊息..."
                  name="mali_chat_text"
                  rows={1}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="sentences"
                  spellCheck={false}
                  data-form-type="other"
                  data-lpignore="true"
                  value={chatInput}
                  onChange={e=>setChatInput(e.target.value)}
                  onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();}}}
                />
                <button className="mp-btn mp-btn-send" onClick={sendMessage}>➤</button>
              </div>
            </div>
          )}
        </div>
      );
    }
    return (
      <div className="mp-page">
        <div className="mp-hdr"><div className="mp-back" onClick={closeApp}>←</div><div className="mp-htitle">聊天</div></div>
        <div className="mp-cl">
          {characters.length === 0 ? <div className="mp-empty"><div className="mp-empty-i">💬</div><div className="mp-empty-t">還沒有角色可聊天<br/>請先在角色頁新增</div></div>
          : characters.map(c => { const ms = chatHistory[c.id]||[]; const lm = ms[ms.length-1]; return (
            <div key={c.id} className="mp-ci" onClick={()=>setCurrentChatChar(c)}>
              <div className="mp-ci-av">{sanitizeUserImageUrl(c.avatar)?<img src={sanitizeUserImageUrl(c.avatar)} alt=""/>:"🦊"}</div>
              <div className="mp-ci-info"><div className="mp-ci-name">{c.name}</div><div className="mp-ci-prev">{lm?(lm.image?"[圖片]":lm.content?.slice(0,30)):"尚無訊息"}</div></div>
              {lm && <div className="mp-ci-time">{new Date(lm.time).toLocaleTimeString("zh-TW",{hour:"2-digit",minute:"2-digit"})}</div>}
            </div>); })}
        </div>
      </div>
    );
  };

  const renderSocial = () => (
      <div className="mp-page">
        <div className="mp-hdr"><div className="mp-back" onClick={closeApp}>←</div><div className="mp-htitle">社交</div>{characters.length>0&&<button style={{marginLeft:"auto",background:"linear-gradient(135deg,#f48fb1,#e91e63)",color:"#fff",border:"none",borderRadius:16,padding:"5px 12px",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"var(--mp-font)"}} onClick={handleRandomSocialPost}>隨機發文</button>}</div>
        <div className="mp-feed">
          {posts.length===0?<div className="mp-empty"><div className="mp-empty-i">📰</div><div className="mp-empty-t">目前沒有貼文<br/>可先讓角色生成一篇</div></div>
          :posts.map(p=>(<div key={p.id} className="mp-post"><div className="mp-post-hd"><div className="mp-post-av">{sanitizeUserImageUrl(p.charAvatar)?<img src={sanitizeUserImageUrl(p.charAvatar)} alt=""/>:"🦊"}</div><div><div className="mp-post-au">{p.charName}</div><div className="mp-post-tm">{new Date(p.time).toLocaleString("zh-TW")}</div></div></div><div className="mp-post-ct">{p.content}</div><div className="mp-post-acts"><button className={`mp-post-act ${p.liked?"liked":""}`} onClick={()=>setPosts(ps=>ps.map(x=>x.id===p.id?{...x,liked:!x.liked,likes:x.liked?x.likes-1:x.likes+1}:x))}>{p.liked?"❤️":"🤍"} {p.likes}</button><button className="mp-post-act" onClick={()=>setActiveCommentPostId(id=>id===p.id?null:p.id)}>留言</button><button className="mp-post-act" onClick={()=>sharePostToChat(p)}>分享</button></div><div style={{marginTop:8,display:"grid",gap:6}}>{(p.comments||[]).slice(-6).map(c=><div key={c.id} style={{fontSize:11,color:"var(--mp-txt-l)"}}>{c.role==="assistant"?p.charName:(playerProfile?.nickname||playerProfile?.name||"你")}：{c.content}</div>)}{activeCommentPostId===p.id&&<div style={{display:"flex",gap:6}}><input className="mp-sinp" style={{flex:1,padding:"6px 8px",fontSize:11}} placeholder="留言..." value={postCommentInputs[p.id]||""} onChange={e=>setPostCommentInputs(prev=>({...prev,[p.id]:e.target.value}))} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();addPostComment(p.id);}}}/><button className="mp-ibtn" onClick={()=>addPostComment(p.id)}>送出</button></div>}</div></div>))}
        </div>
      </div>
    );

  const renderLorebook = () => {
    const activeBook = lorebooks.find((b) => b.id === activeLorebookId) || null;
    const entries = activeBook?.entries || [];
    const sortedEntries = [...entries].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    const sortedBooks = [...lorebooks].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    const saveBook = () => {
      if (!editingLorebookBook?.name?.trim()) return showToast("請輸入世界書名稱");
        const payload = {
          id: editingLorebookBook.id || gid(),
          name: sanitizeText(editingLorebookBook.name, 80),
          description: sanitizeText(editingLorebookBook.description, 400),
          enabled: true,
          updatedAt: Date.now(),
          entries: editingLorebookBook.id ? (lorebooks.find((b) => b.id === editingLorebookBook.id)?.entries || []) : [],
        };
      setLorebooks((prev) => {
        const idx = prev.findIndex((x) => x.id === payload.id);
        if (idx < 0) return [payload, ...prev];
        const next = [...prev];
        next[idx] = payload;
        return next;
      });
      setActiveLorebookId(payload.id);
      setEditingLorebookBook(null);
      showToast("世界書已儲存");
    };
    const saveEntry = () => {
      if (!activeBook) return;
      if (!editingLorebookEntry?.title?.trim()) return showToast("請輸入條目標題");
      const keywords = editingLorebookEntry.keywords.split(",").map((k) => sanitizeText(k.trim(), 32)).filter(Boolean).slice(0, 20);
      const payload = {
        id: editingLorebookEntry.id || gid(),
        title: sanitizeText(editingLorebookEntry.title, 120),
        keywords,
        content: sanitizeText(editingLorebookEntry.content, 3000),
        enabled: !!editingLorebookEntry.enabled,
        updatedAt: Date.now(),
      };
      setLorebooks((prev) => prev.map((b) => {
        if (b.id !== activeBook.id) return b;
        const entriesNext = [...(b.entries || [])];
        const idx = entriesNext.findIndex((x) => x.id === payload.id);
        if (idx < 0) entriesNext.unshift(payload);
        else entriesNext[idx] = payload;
        return { ...b, entries: entriesNext, updatedAt: Date.now() };
      }));
      setEditingLorebookEntry(null);
      showToast("條目已儲存");
    };
    const deleteBook = (id) => {
      if (!confirm("確定要刪除這本世界書嗎？")) return;
      setLorebooks((prev) => prev.filter((x) => x.id !== id));
      if (activeLorebookId === id) setActiveLorebookId(null);
      showToast("世界書已刪除");
    };
    const deleteEntry = (id) => {
      if (!activeBook) return;
      if (!confirm("確定要刪除這個條目嗎？")) return;
      setLorebooks((prev) => prev.map((b) => b.id === activeBook.id ? { ...b, entries: (b.entries || []).filter((x) => x.id !== id), updatedAt: Date.now() } : b));
      showToast("條目已刪除");
    };
    return (
      <div className="mp-page">
          <div className="mp-hdr"><div className="mp-back" onClick={() => { if (activeBook) setActiveLorebookId(null); else closeApp(); }}>←</div><div className="mp-htitle">世界書 Lorebook</div></div>
        <div className="mp-cm">
          {!activeBook ? <>
              <button className="mp-add" onClick={() => setEditingLorebookBook({ id: null, name: "", description: "", enabled: true })}>新增世界書</button>
            <div style={{height:8}} />
            {sortedBooks.length === 0 ? <div className="mp-empty"><div className="mp-empty-i">📚</div><div className="mp-empty-t">目前沒有世界書</div></div> : sortedBooks.map((b) => (
              <div key={b.id} className="mp-cc">
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
                    <div style={{fontWeight:700,fontSize:13}}>{b.name}</div>
                  </div>
                <div style={{fontSize:11,color:"var(--mp-txt-l)",marginTop:4}}>條目數：{(b.entries || []).length}</div>
                {b.description && <div style={{fontSize:12,lineHeight:1.55,marginTop:8}}>{b.description}</div>}
                <div style={{display:"flex",gap:6,marginTop:10}}>
                  <button className="mp-ibtn-chat" onClick={() => setActiveLorebookId(b.id)}>開啟</button>
                    <button className="mp-ibtn" onClick={() => setEditingLorebookBook({ id: b.id, name: b.name || "", description: b.description || "", enabled: true })}>編輯</button>
                    <button className="mp-ibtn-r" onClick={() => deleteBook(b.id)}>刪除</button>
                  </div>
                </div>
            ))}
          </> : <>
            <div className="mp-cc" style={{marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
                <div style={{fontWeight:700,fontSize:14}}>{activeBook.name}</div>
                <button className="mp-ibtn" onClick={() => setActiveLorebookId(null)}>返回書本列表</button>
              </div>
              {activeBook.description && <div style={{fontSize:12,color:"var(--mp-txt-l)",marginTop:6}}>{activeBook.description}</div>}
            </div>
            <button className="mp-add" onClick={() => setEditingLorebookEntry({ id: null, title: "", keywords: "", content: "", enabled: true })}>新增條目</button>
            <div style={{height:8}} />
            {sortedEntries.length === 0 ? <div className="mp-empty"><div className="mp-empty-i">📖</div><div className="mp-empty-t">這本世界書尚無條目</div></div> : sortedEntries.map((e) => (
              <div key={e.id} className="mp-cc">
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
                  <div style={{fontWeight:700,fontSize:13}}>{e.title}</div>
                  <span className="mp-active-badge" style={{background:e.enabled?"rgba(129,199,132,.2)":"rgba(120,144,156,.18)",color:e.enabled?"#2e7d32":"#546e7a"}}>{e.enabled?"啟用":"停用"}</span>
                </div>
                <div style={{fontSize:11,color:"var(--mp-txt-l)",marginTop:4}}>關鍵字：{(e.keywords||[]).join("、") || "無"}</div>
                <div style={{fontSize:12,lineHeight:1.55,marginTop:8,display:"-webkit-box",WebkitLineClamp:3,WebkitBoxOrient:"vertical",overflow:"hidden",whiteSpace:"pre-wrap"}}>{e.content || ""}</div>
                <div style={{display:"flex",gap:6,marginTop:10}}>
                  <button className="mp-ibtn" style={{background:"rgba(144,202,249,.16)",border:"1px solid rgba(144,202,249,.35)",color:"#1565c0"}} onClick={() => setViewingLorebookEntry(e)}>展開</button>
                  <button className="mp-ibtn" onClick={() => setLorebooks((prev) => prev.map((b) => b.id === activeBook.id ? { ...b, entries: (b.entries || []).map((x) => x.id === e.id ? { ...x, enabled: !x.enabled, updatedAt: Date.now() } : x), updatedAt: Date.now() } : b))}>{e.enabled ? "停用" : "啟用"}</button>
                  <div style={{marginLeft:"auto"}} />
                  <button className="mp-ibtn-r" onClick={() => deleteEntry(e.id)}>刪除</button>
                </div>
              </div>
            ))}
          </>}
        </div>
        {viewingLorebookEntry && (
          <div className="mp-overlay" onClick={() => setViewingLorebookEntry(null)}>
            <div className="mp-modal" onClick={(ev) => ev.stopPropagation()}>
              <div className="mp-modal-t" style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
                <span>{viewingLorebookEntry.title || "條目"}</span>
                <span className="mp-active-badge" style={{background:viewingLorebookEntry.enabled?"rgba(129,199,132,.2)":"rgba(120,144,156,.18)",color:viewingLorebookEntry.enabled?"#2e7d32":"#546e7a"}}>{viewingLorebookEntry.enabled?"啟用":"停用"}</span>
              </div>
              <div className="mp-row"><div className="mp-lbl">關鍵字</div><div style={{fontSize:12,color:"var(--mp-txt-l)"}}>{(viewingLorebookEntry.keywords || []).join("、") || "無"}</div></div>
              <div className="mp-row"><div className="mp-lbl">內容</div><div style={{fontSize:12,lineHeight:1.6,whiteSpace:"pre-wrap",maxHeight:260,overflowY:"auto",padding:10,border:"1px solid rgba(244,143,177,.18)",borderRadius:8,background:"rgba(255,255,255,.55)"}}>{viewingLorebookEntry.content || ""}</div></div>
              <div style={{display:"flex",gap:8,marginTop:8}}>
                <button className="mp-save" style={{flex:1,background:"linear-gradient(135deg,#b0bec5,#90a4ae)"}} onClick={() => setViewingLorebookEntry(null)}>關閉</button>
                <button className="mp-save" style={{flex:1}} onClick={() => { setViewingLorebookEntry(null); setEditingLorebookEntry({ id: viewingLorebookEntry.id, title: viewingLorebookEntry.title || "", keywords: (viewingLorebookEntry.keywords || []).join(", "), content: viewingLorebookEntry.content || "", enabled: !!viewingLorebookEntry.enabled }); }}>編輯</button>
              </div>
            </div>
          )}
          </div>
        )}
        {editingLorebookBook && (
          <div className="mp-overlay" onClick={() => setEditingLorebookBook(null)}>
            <div className="mp-modal" onClick={(ev) => ev.stopPropagation()}>
              <div className="mp-modal-t">{editingLorebookBook.id ? "編輯世界書" : "新增世界書"}</div>
              <div className="mp-row"><div className="mp-lbl">名稱 *</div><input className="mp-sinp" value={editingLorebookBook.name} onChange={(ev)=>setEditingLorebookBook((s)=>({ ...s, name: ev.target.value }))} placeholder="例如：學園設定、組織規範" /></div>
              <div className="mp-row"><div className="mp-lbl">描述</div><textarea className="mp-ta" value={editingLorebookBook.description} onChange={(ev)=>setEditingLorebookBook((s)=>({ ...s, description: ev.target.value }))} style={{minHeight:100,resize:"vertical"}} /></div>
                <div style={{display:"flex",gap:8,marginTop:8}}>
                <button className="mp-save" style={{flex:1,background:"linear-gradient(135deg,#b0bec5,#90a4ae)"}} onClick={() => setEditingLorebookBook(null)}>取消</button>
                <button className="mp-save" style={{flex:1}} onClick={saveBook}>儲存</button>
              </div>
            </div>
          </div>
        )}
        {editingLorebookEntry && (
          <div className="mp-overlay" onClick={() => setEditingLorebookEntry(null)}>
            <div className="mp-modal" onClick={(ev) => ev.stopPropagation()}>
              <div className="mp-modal-t">{editingLorebookEntry.id ? "編輯條目" : "新增條目"}</div>
              <div className="mp-row"><div className="mp-lbl">標題 *</div><input className="mp-sinp" value={editingLorebookEntry.title} onChange={(ev)=>setEditingLorebookEntry((s)=>({ ...s, title: ev.target.value }))} placeholder="例如：學校、地區、組織" /></div>
              <div className="mp-row"><div className="mp-lbl">關鍵字（逗號分隔）</div><input className="mp-sinp" value={editingLorebookEntry.keywords} onChange={(ev)=>setEditingLorebookEntry((s)=>({ ...s, keywords: ev.target.value }))} placeholder="例如：十支局, 受訓, 規範" /></div>
              <div className="mp-row"><div className="mp-lbl">內容</div><textarea className="mp-ta" value={editingLorebookEntry.content} onChange={(ev)=>setEditingLorebookEntry((s)=>({ ...s, content: ev.target.value }))} style={{minHeight:160,resize:"vertical"}} /></div>
              <div className="mp-row" style={{display:"flex",alignItems:"center",gap:8}}><input id="lb_enabled" type="checkbox" checked={!!editingLorebookEntry.enabled} onChange={(ev)=>setEditingLorebookEntry((s)=>({ ...s, enabled: ev.target.checked }))} /><label htmlFor="lb_enabled" className="mp-lbl" style={{margin:0}}>啟用此條目</label></div>
              <div style={{display:"flex",gap:8,marginTop:8}}>
                <button className="mp-save" style={{flex:1,background:"linear-gradient(135deg,#b0bec5,#90a4ae)"}} onClick={() => setEditingLorebookEntry(null)}>取消</button>
                <button className="mp-save" style={{flex:1}} onClick={saveEntry}>儲存</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderCharacters = () => (
    <div className="mp-page">
      <div className="mp-hdr"><div className="mp-back" onClick={closeApp}>←</div><div className="mp-htitle">聯絡人</div></div>
      <div className="mp-cm">
        <button className="mp-add" onClick={()=>{setEditingCharacter(null);setModal("addChar");}}>新增 / 匯入角色</button><div style={{height:8}} />
        {characters.map(c=>(<div key={c.id} className="mp-cc"><div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}><div className="mp-av">{sanitizeUserImageUrl(c.avatar)?<img src={sanitizeUserImageUrl(c.avatar)} alt=""/>:"🦊"}</div><div style={{flex:1}}><div style={{fontWeight:700,fontSize:13}}>{c.name}</div><div style={{fontSize:11,color:"var(--mp-txt-l)"}}>{(c.description || c.personality || "尚無角色設定").slice(0,52)}</div></div>{activeCharId===c.id?<span className="mp-active-badge">ACTIVE</span>:<button className="mp-ibtn" onClick={()=>{setActiveCharId(c.id);showToast(`${c.name} 已設為主角色`);}}>設為主角色</button>}</div><div style={{display:"flex",gap:6}}><button className="mp-ibtn-chat" onClick={()=>{setCurrentChatChar(c);openApp("chat");}}>開始聊天</button><button className="mp-ibtn" onClick={()=>{setEditingCharacter(c);setModal("addChar");}}>編輯</button><button className="mp-ibtn-r" onClick={()=>{ if (window.confirm(`確定要刪除角色「${c.name}」嗎？`)) deleteCharacter(c.id); }}>刪除</button></div></div>))}
      </div>
    </div>
  );

  const renderSettings = () => {
    const tc = tempConfig || apiConfig;
    const cp = API_PROVIDERS.find(p=>p.id===tc.provider);
    const modelOptions = providerModelOptions[tc.provider] || cp?.models || [];
    const applyApiPreset = (idx) => {
      const p = apiPresets[idx];
      if (!p) return;
      setTempConfig((c) => ({
        ...(c || {}),
        provider: p.provider || c?.provider || "openai",
        baseUrl: p.baseUrl || c?.baseUrl || "",
        apiKey: p.apiKey || "",
        model: p.model || c?.model || "",
      }));
      showToast(`已套用 ${p.name || `預設 ${idx + 1}`}`);
    };
    const activePresetIndex = (apiPresets || []).findIndex((p) =>
      p &&
      p.provider === tc.provider &&
      p.baseUrl === tc.baseUrl &&
      p.apiKey === tc.apiKey &&
      p.model === tc.model
    );
    const saveApiPreset = (idx) => {
      const p = tc || apiConfig;
      setApiPresets((prev) => {
        const list = [...(prev || [])];
        const fallback = defaultAppState.apiPresets[idx] || { id: `preset-${idx + 1}`, name: `預設 ${idx + 1}` };
        list[idx] = {
          id: list[idx]?.id || fallback.id,
          name: list[idx]?.name || fallback.name,
          provider: p.provider,
          baseUrl: p.baseUrl,
          apiKey: p.apiKey,
          model: p.model,
        };
        return list;
      });
      showToast(`已儲存到預設 ${idx + 1}`);
    };
    const clearSiteCache = async () => {
      try {
        if (!clearCacheArmed) {
          setClearCacheArmed(true);
          showToast("再按一次清除快取");
          setTimeout(() => setClearCacheArmed(false), 3000);
          return;
        }
        setClearCacheArmed(false);
        if (!window.confirm("確定要清除網站快取並重新載入嗎？")) return;
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
        if ("serviceWorker" in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister()));
        }
        showToast("快取已清除，正在重新載入");
        setTimeout(() => window.location.reload(), 250);
      } catch (err) {
        showToast(`清除快取失敗：${err?.message || "未知錯誤"}`);
      }
    };
    return (
      <div className="mp-page">
        <div className="mp-hdr"><div className="mp-back" onClick={closeApp}>←</div><div className="mp-htitle">設定</div></div>
        <div className="mp-set">
          <div className="mp-sg">
            <div className="mp-sg-t">API 預設儲存</div>
            <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
              {[0,1,2].map((idx) => (
                <button key={idx} className="mp-ibtn" style={{minWidth:44,padding:"4px 8px"}} onClick={() => applyApiPreset(idx)}>{`P${idx + 1}`}</button>
              ))}
            </div>
            <div style={{fontSize:10,color:"var(--mp-txt-l)",marginTop:6}}>
              {activePresetIndex >= 0
                ? `當前預設：P${activePresetIndex + 1} · ${tc.provider || "-"} · ${tc.model || "-"}`
                : `當前預設：自訂 · ${tc.provider || "-"} · ${tc.model || "-"}`}
            </div>
          </div>
          <div className="mp-sg">
            <div className="mp-sg-t" style={{display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}} onClick={() => setSettingsApiOpen((v) => !v)}>
              <span>AI 連線設定</span>
              <span>{settingsApiOpen ? "收合" : "展開"}</span>
            </div>
            {settingsApiOpen && <>
            <div className="mp-row"><div className="mp-lbl">API 供應商</div><select className="mp-ssel" value={tc.provider} onChange={e=>{const p=API_PROVIDERS.find(x=>x.id===e.target.value);setTempConfig(c=>({...c,provider:p.id,baseUrl:p.baseUrl,model:p.models[0]||""}));}}>{API_PROVIDERS.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            <div className="mp-row"><div className="mp-lbl">Base URL</div><input className="mp-sinp" value={tc.baseUrl} onChange={e=>setTempConfig(c=>({...c,baseUrl:e.target.value}))} placeholder="https://..." /></div>
            <div className="mp-row"><div className="mp-lbl">API Key</div><input className="mp-sinp" type="password" value={tc.apiKey} onChange={e=>setTempConfig(c=>({...c,apiKey:e.target.value}))} placeholder="sk-..." /></div>
            <div className="mp-row">
              <div className="mp-lbl" style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
                <span>模型</span>
                <button
                  type="button"
                  className="mp-ibtn"
                  disabled={fetchingModels}
                  onClick={async ()=>{
                    try {
                      setFetchingModels(true);
                      const models = sortModelsByProvider(tc.provider, await fetchAvailableModels(tc));
                      if (!models.length) throw new Error("未取得任何模型");
                      setProviderModelOptions(prev => ({ ...prev, [tc.provider]: models }));
                      setTempConfig(c => ({ ...c, model: models.includes(c.model) ? c.model : models[0] }));
                      showToast(`已抓取 ${models.length} 個模型`);
                    } catch (err) {
                      showToast(`抓取失敗：${err.message}`);
                    } finally {
                      setFetchingModels(false);
                    }
                  }}
                >
                  {fetchingModels ? "抓取中..." : "抓取最新模型"}
                </button>
              </div>
              {modelOptions?.length>0
                ? <select className="mp-ssel" value={tc.model} onChange={e=>setTempConfig(c=>({...c,model:e.target.value}))}>{modelOptions.map(m=><option key={m} value={m}>{m}</option>)}<option value="__custom">自訂...</option></select>
                : <input className="mp-sinp" value={tc.model} onChange={e=>setTempConfig(c=>({...c,model:e.target.value}))} placeholder="model-name" />}
            </div>
            {tc.model==="__custom"&&<div className="mp-row"><div className="mp-lbl">自訂模型名稱</div><input className="mp-sinp" onChange={e=>setTempConfig(c=>({...c,model:e.target.value}))} placeholder="model-name" /></div>}
            <div style={{display:"flex",gap:8}}>
              <button className="mp-save" style={{flex:1}} onClick={()=>{setApiConfig(tc);showToast("設定已儲存");}}>儲存設定</button>
              <button type="button" className="mp-save" style={{flex:1,background:"linear-gradient(135deg,#90caf9,#42a5f5)"}} onClick={()=>setPresetSavePickerOpen(true)}>另存預設</button>
            </div>
            </>}
          </div>
          {presetSavePickerOpen && (
            <div className="mp-overlay" style={{zIndex:120}} onClick={() => setPresetSavePickerOpen(false)}>
              <div className="mp-modal" onClick={(e) => e.stopPropagation()}>
                <div className="mp-modal-t">另存 API 預設</div>
                <div style={{display:"grid",gap:8}}>
                  {[0,1,2].map((idx) => (
                    <button
                      type="button"
                      key={idx}
                      className="mp-ibtn-chat"
                      onClick={() => {
                        const ok = window.confirm(`確定要覆寫 P${idx + 1} 嗎？`);
                        if (!ok) return;
                        saveApiPreset(idx);
                        setPresetSavePickerOpen(false);
                      }}
                    >
                      存到 P{idx + 1}
                    </button>
                  ))}
                </div>
                <div style={{marginTop:10}}>
                  <button type="button" className="mp-save" style={{background:"linear-gradient(135deg,#b0bec5,#90a4ae)"}} onClick={() => setPresetSavePickerOpen(false)}>取消</button>
                </div>
              </div>
            </div>
          )}
            <div className="mp-sg"><div className="mp-sg-t">版本資訊</div><div style={{fontSize:12,color:"var(--mp-txt-l)",lineHeight:1.7}}><strong>MaliPhone</strong> v{VERSION}<br/>AI 角色互動小手機介面</div></div>
            <div className="mp-sg">
              <div className="mp-sg-t" style={{display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer"}} onClick={() => setSettingsResetOpen((v) => !v)}>
                <span>重置資料</span>
                <span>{settingsResetOpen ? "收合" : "展開"}</span>
              </div>
              {settingsResetOpen && (
                <div style={{display:"grid",gap:8}}>
                  <button className="mp-save" style={{background:"linear-gradient(135deg,#ef9a9a,#e53935)"}} onClick={()=>{if(confirm("確定要清空所有資料嗎？")){setCharacters([]);setActiveCharId(null);setChatHistory({});setPosts([]);setMemories({});setLorebooks([]);setActiveLorebookId(null);setPhoneInboxCache({});showToast("資料已清空");}}}>清空全部資料</button>
                  <button type="button" className="mp-save" style={{background:clearCacheArmed?"linear-gradient(135deg,#ffb74d,#f57c00)":"linear-gradient(135deg,#b0bec5,#78909c)"}} onClick={clearSiteCache}>{clearCacheArmed ? "再次確認清除快取" : "清除快取"}</button>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    };

  const renderPlayer = () => (
    <div className="mp-page">
      <div className="mp-hdr"><div className="mp-back" onClick={closeApp}>←</div><div className="mp-htitle">個人資料</div></div>
      <div className="mp-cm">
          <div className="mp-cc">
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>個人設定</div>
            <div className="mp-row">
              <div className="mp-lbl">大頭貼</div>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div className="mp-av" style={{cursor:"pointer"}} onClick={() => playerAvatarRef.current?.click()}>
                  {sanitizeUserImageUrl(playerProfile?.avatar) ? <img src={sanitizeUserImageUrl(playerProfile?.avatar)} alt="" /> : "🐱"}
                </div>
                <input type="file" ref={playerAvatarRef} accept="image/*" style={{display:"none"}} onChange={handlePlayerAvatarUpload} />
                <button className="mp-ibtn" onClick={() => playerAvatarRef.current?.click()}>更換</button>
                <button className="mp-ibtn-r" onClick={() => setPlayerProfile(p => ({ ...(p||{}), avatar: "" }))}>移除</button>
              </div>
            </div>
            <div className="mp-row"><div className="mp-lbl">名稱</div><input className="mp-sinp" value={playerProfile?.name || ""} onChange={e=>setPlayerProfile(p=>({ ...(p||{}), name:e.target.value }))} placeholder="例如：小明" /></div>
            <div className="mp-row"><div className="mp-lbl">暱稱</div><input className="mp-sinp" value={playerProfile?.nickname || ""} onChange={e=>setPlayerProfile(p=>({ ...(p||{}), nickname:e.target.value }))} placeholder="例如：小雨、阿喵" /></div>
            <div className="mp-row"><div className="mp-lbl">個人簡介</div><textarea className="mp-ta" value={playerProfile?.bio || ""} onChange={e=>setPlayerProfile(p=>({ ...(p||{}), bio:e.target.value }))} placeholder="例如：喜歡貓、講話直接、晚上常上線" style={{minHeight:100,resize:"vertical"}} /></div>
          </div>
          <div className="mp-cc">
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>紙娃娃（三層）</div>
            <div style={{fontSize:12,color:"var(--mp-txt-l)",lineHeight:1.7}}>即將推出</div>
          </div>
      </div>
      {playerAvatarCrop && (
        <div className="mp-overlay" onClick={() => setPlayerAvatarCrop(null)}>
          <div className="mp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mp-modal-t">裁切大頭貼</div>
            <div style={{display:"grid",placeItems:"center",marginBottom:10}}>
              <div
                style={{width:220,height:220,borderRadius:18,overflow:"hidden",border:"1px solid rgba(244,143,177,.35)",background:"#fff",touchAction:"none",cursor: playerAvatarCrop.dragging ? "grabbing" : "grab",position:"relative"}}
                onPointerDown={onPlayerAvatarPointerDown}
                onPointerMove={onPlayerAvatarPointerMove}
                onPointerUp={onPlayerAvatarPointerUp}
                onPointerCancel={onPlayerAvatarPointerUp}
              >
                <img
                  src={playerAvatarCrop.src}
                  alt=""
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    transform: `translate(${playerAvatarCrop.panX || 0}%, ${playerAvatarCrop.panY || 0}%) scale(${playerAvatarCrop.zoom})`,
                    transformOrigin: "center center",
                    userSelect: "none",
                    WebkitUserDrag: "none",
                    pointerEvents: "none",
                  }}
                />
              </div>
            </div>
            <div className="mp-row"><div className="mp-lbl">縮放</div><input type="range" min="1" max="3" step="0.01" value={playerAvatarCrop.zoom} onChange={e=>setPlayerAvatarCrop(s=>({...(s||{}),zoom:Number(e.target.value)}))} /></div>
            <div style={{fontSize:11,color:"var(--mp-txt-l)",marginTop:4}}>拖曳圖片調整位置，裁切框固定為方形</div>
            <div style={{display:"flex",gap:8,marginTop:8}}>
              <button className="mp-save" style={{flex:1,background:"linear-gradient(135deg,#b0bec5,#90a4ae)"}} onClick={() => setPlayerAvatarCrop(null)}>取消</button>
              <button className="mp-save" style={{flex:1}} onClick={applyPlayerAvatarCrop}>套用</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const addWalletTransaction = (type, amount, note) => {
    const safeAmount = Math.max(0, Number(amount) || 0);
    if (!safeAmount) return;
    setWallet((w) => {
      const prev = w || { balance: 0, transactions: [], assets: [] };
      const delta = type === "expense" ? -safeAmount : safeAmount;
      const nextBalance = Math.max(0, (prev.balance || 0) + delta);
      const tx = {
        id: gid(),
        type,
        amount: safeAmount,
        note: sanitizeText(note || "", 80) || (type === "income" ? "入帳" : "消費"),
        time: Date.now(),
      };
      return { ...prev, balance: nextBalance, transactions: [tx, ...(prev.transactions || [])].slice(0, 120) };
    });
  };
  const addWalletAsset = (name, qty = 1) => {
    const title = sanitizeText(name || "", 40).trim();
    if (!title) return;
    const count = Math.max(1, Number(qty) || 1);
    setWallet((w) => {
      const prev = w || { balance: 0, transactions: [], assets: [] };
      const list = [...(prev.assets || [])];
      const idx = list.findIndex((a) => a.name === title);
      if (idx >= 0) list[idx] = { ...list[idx], qty: (list[idx].qty || 0) + count, updatedAt: Date.now() };
      else list.unshift({ id: gid(), name: title, qty: count, updatedAt: Date.now() });
      return { ...prev, assets: list.slice(0, 120) };
    });
  };
  const renderWallet = () => (
    <div className="mp-page">
      <div className="mp-hdr"><div className="mp-back" onClick={closeApp}>←</div><div className="mp-htitle">錢包</div></div>
      <div className="mp-cm">
        <div className="mp-cc">
          <div style={{ fontSize: 12, color: "var(--mp-txt-l)" }}>可用餘額</div>
          <div style={{ fontSize: 28, fontWeight: 800, marginTop: 2 }}>${wallet?.balance || 0}</div>
          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            <button className="mp-ibtn-chat" onClick={() => addWalletTransaction("income", 50, "系統獎勵")}>+50</button>
            <button className="mp-ibtn" onClick={() => addWalletTransaction("expense", 30, "角色互動消費")}>-30</button>
            <button className="mp-ibtn" onClick={() => addWalletAsset("折價券", 1)}>+券</button>
          </div>
        </div>
        <div className="mp-cc">
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>資產（道具/券）</div>
          {(wallet?.assets || []).length === 0 ? <div style={{ fontSize: 11, color: "var(--mp-txt-l)" }}>目前沒有資產</div> : (
            <div style={{ display: "grid", gap: 6 }}>
              {wallet.assets.slice(0, 12).map((a) => <div key={a.id} style={{ fontSize: 12 }}>{a.name} x {a.qty}</div>)}
            </div>
          )}
        </div>
        <div className="mp-cc">
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>交易流水</div>
          {(wallet?.transactions || []).length === 0 ? <div style={{ fontSize: 11, color: "var(--mp-txt-l)" }}>目前沒有交易</div> : (
            <div style={{ display: "grid", gap: 8, maxHeight: 220, overflowY: "auto" }}>
              {wallet.transactions.slice(0, 24).map((t) => (
                <div key={t.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12 }}>
                  <div>
                    <div>{t.note}</div>
                    <div style={{ fontSize: 10, color: "var(--mp-txt-l)" }}>{new Date(t.time).toLocaleString("zh-TW")}</div>
                  </div>
                  <div style={{ fontWeight: 700, color: t.type === "expense" ? "#e53935" : "#2e7d32" }}>{t.type === "expense" ? "-" : "+"}{t.amount}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderPhone = () => {
    const selectedCharId = phoneViewCharId || activeCharId || characters[0]?.id || null;
    const selectedChar = characters.find((c) => c.id === selectedCharId) || null;
    const playerMsgs = selectedChar ? (chatHistory[selectedChar.id] || []).slice(-20) : [];
    const npcThreads = selectedChar ? (phoneInboxCache[selectedChar.id]?.threads || []) : [];
    const now = new Date();
    const phoneTime = now.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false });
    const phoneDate = now.toLocaleDateString("zh-TW", { month: "2-digit", day: "2-digit" });
    const allThreads = [
      {
        id: "player",
        name: "你",
        relation: "玩家",
        messages: playerMsgs.map((m, i) => ({
          id: `p-${i}-${m.id || gid()}`,
          from: m.role === "assistant" ? "char" : "other",
          text: m.content || "[圖片]",
          time: m.time || Date.now(),
        })),
      },
      ...npcThreads,
    ];
    const activeThread = allThreads.find((t) => t.id === phoneActiveThreadId) || allThreads[0] || null;
    const openDesktop = (charId) => {
      setPhoneViewCharId(charId);
      setPhoneActiveThreadId("player");
      setPhonePage("desktop");
    };
    const inImmersivePhone = phonePage === "desktop" || phonePage === "chatlist" || phonePage === "thread";
    return (
      <div className="mp-page" style={inImmersivePhone ? { padding: 0 } : undefined}>
        {!inImmersivePhone && (
          <div className="mp-hdr">
            <div className="mp-back" onClick={closeApp}>←</div>
            <div className="mp-htitle">角色手機</div>
          </div>
        )}
        <div className="mp-cm" style={inImmersivePhone ? { padding: 0 } : undefined}>
          {characters.length === 0 && <div className="mp-empty"><div className="mp-empty-i">📱</div><div className="mp-empty-t">尚無角色可預覽手機</div></div>}
          {characters.length > 0 && phonePage !== "desktop" && phonePage !== "chatlist" && phonePage !== "thread" && (
            <div className="mp-sc" style={{padding:12}}>
              <div style={{fontWeight:700,fontSize:14,marginBottom:8}}>選擇要查看的角色手機</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr",gap:8}}>
                {characters.map((c) => (
                  <button key={c.id} className="mp-cc" style={{textAlign:"left",background:"#fff"}} onClick={() => openDesktop(c.id)}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <div className="mp-av">{sanitizeUserImageUrl(c.avatar)?<img src={sanitizeUserImageUrl(c.avatar)} alt=""/>:"🦊"}</div>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:700,fontSize:13}}>{c.name}</div>
                        <div style={{fontSize:11,color:"var(--mp-txt-l)"}}>點擊進入手機桌面</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
          {characters.length > 0 && selectedChar && phonePage === "desktop" && (
            <div style={{position:"relative",height:"100%",minHeight:640,background:"linear-gradient(180deg,#ffd2e6 0%,#d1ecff 100%)",padding:"14px 14px 24px"}}>
              <button className="mp-back" style={{position:"absolute",left:12,top:12,zIndex:5}} onClick={closeApp}>←</button>
              <div style={{display:"flex",justifyContent:"space-between",fontWeight:700,color:"#29485d",fontSize:13,padding:"2px 8px 0 56px"}}>
                <span>{phoneTime}</span>
                <span>{phoneDate}</span>
              </div>
              <div style={{marginTop:14,background:"rgba(255,255,255,.45)",borderRadius:14,padding:"10px 12px"}}>
                <div style={{fontSize:12,color:"#39596e"}}>{selectedChar.name} 的手機</div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:12,marginTop:16}}>
                <button className="mp-icon" style={{background:"rgba(255,255,255,.62)"}} onClick={() => setPhonePage("chatlist")}>
                  <div className="mp-icon-c mp-icon-c-img">{renderAppIcon({ id: "chat", name: "聊天", icon: "💬", iconUrl: "./app-icons/chat.png" }, 56)}</div>
                  <span className="mp-icon-l">聊天</span>
                </button>
                {[
                  { icon: "📷", label: "相機" },
                  { icon: "🗂️", label: "檔案" },
                  { icon: "⚙️", label: "設定" },
                ].map((item, idx) => (
                  <div key={idx} className="mp-icon" style={{opacity:.45,background:"rgba(255,255,255,.45)"}}>
                    <div className="mp-icon-c">{renderAppIcon({ name: item.label, icon: item.icon })}</div>
                    <span className="mp-icon-l">鎖定</span>
                  </div>
                ))}
              </div>
              <div style={{marginTop:18,display:"flex",gap:6}}>
                <button className="mp-ibtn" onClick={() => setPhonePage("picker")}>換角色</button>
                <button className="mp-ibtn" disabled={phoneGenLoading} onClick={() => generatePhoneNpcChats(selectedChar)}>
                  {phoneGenLoading ? "刷新中..." : "刷新其他聊天"}
                </button>
                <span style={{fontSize:10,color:"#5f7f93",marginLeft:"auto",alignSelf:"center"}}>
                  快取：{phoneInboxCache[selectedChar.id]?.updatedAt ? new Date(phoneInboxCache[selectedChar.id].updatedAt).toLocaleTimeString("zh-TW",{hour:"2-digit",minute:"2-digit"}) : "--:--"}
                </span>
              </div>
              <div style={{position:"absolute",left:"50%",bottom:10,transform:"translateX(-50%)",width:120,height:5,borderRadius:999,background:"rgba(28,44,55,.3)"}} />
            </div>
          )}
          {characters.length > 0 && selectedChar && phonePage === "chatlist" && (
            <div style={{position:"relative",height:"100%",minHeight:640,background:"linear-gradient(180deg,#ffd2e6 0%,#d1ecff 100%)",padding:"14px 10px 24px"}}>
              <button className="mp-back" style={{position:"absolute",left:12,top:12,zIndex:5}} onClick={closeApp}>←</button>
              <div style={{padding:"2px 8px 0 56px",display:"flex",justifyContent:"space-between",fontWeight:700,color:"#29485d",fontSize:13}}>
                <span>{phoneTime}</span><span>{phoneDate}</span>
              </div>
              <div className="mp-sc" style={{padding:10,marginTop:12,background:"rgba(255,255,255,.5)"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                <button className="mp-ibtn" onClick={() => setPhonePage("desktop")}>返回桌面</button>
                <div style={{fontSize:12,color:"var(--mp-txt-l)"}}>只讀聊天列表</div>
              </div>
              <div style={{display:"grid",gap:8}}>
                {allThreads.map((t) => {
                  const last = (t.messages || [])[t.messages.length - 1];
                  return (
                    <button key={t.id} className="mp-cc" style={{textAlign:"left",background:"#fff"}} onClick={() => { setPhoneActiveThreadId(t.id); setPhonePage("thread"); }}>
                      <div style={{display:"flex",justifyContent:"space-between",gap:8}}>
                        <div style={{fontWeight:700,fontSize:13}}>{t.name}</div>
                        <div style={{fontSize:10,color:"var(--mp-txt-l)"}}>{last?.time ? new Date(last.time).toLocaleTimeString("zh-TW",{hour:"2-digit",minute:"2-digit"}) : ""}</div>
                      </div>
                      <div style={{fontSize:11,color:"var(--mp-txt-l)",marginTop:2}}>{t.relation || ""}</div>
                      <div style={{fontSize:11,color:"var(--mp-txt)",marginTop:5,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{last?.text || "目前無訊息"}</div>
                    </button>
                  );
                })}
              </div>
              </div>
            </div>
          )}
          {characters.length > 0 && selectedChar && phonePage === "thread" && (
            <div style={{position:"relative",height:"100%",minHeight:640,background:"linear-gradient(180deg,#ffd2e6 0%,#d1ecff 100%)",padding:"14px 10px 24px"}}>
              <button className="mp-back" style={{position:"absolute",left:12,top:12,zIndex:5}} onClick={closeApp}>←</button>
              <div style={{padding:"2px 8px 0 56px",display:"flex",justifyContent:"space-between",fontWeight:700,color:"#29485d",fontSize:13}}>
                <span>{phoneTime}</span><span>{phoneDate}</span>
              </div>
              <div className="mp-sc" style={{padding:10,marginTop:12,background:"rgba(255,255,255,.5)"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                <button className="mp-ibtn" onClick={() => setPhonePage("chatlist")}>返回列表</button>
                <div style={{fontWeight:700,fontSize:13}}>{activeThread?.name || "聊天室"}</div>
                <span style={{fontSize:10,color:"var(--mp-txt-l)"}}>唯讀</span>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:430,overflowY:"auto",border:"1px solid var(--mp-border)",borderRadius:12,padding:8,background:"rgba(255,255,255,.45)"}}>
                {(activeThread?.messages || []).map((m) => (
                  <div key={m.id} style={{display:"flex",justifyContent:m.from==="char"?"flex-end":"flex-start"}}>
                    <div style={{maxWidth:"82%",fontSize:12,lineHeight:1.45,padding:"7px 10px",borderRadius:10,background:m.from==="char"?"linear-gradient(135deg,#f48fb1,#ec407a)":"#fff",color:m.from==="char"?"#fff":"var(--mp-txt)",border:m.from==="char"?"none":"1px solid var(--mp-border)"}}>
                      {m.text}
                    </div>
                  </div>
                ))}
                {(!activeThread || (activeThread.messages || []).length === 0) && <div style={{fontSize:11,color:"var(--mp-txt-l)",textAlign:"center"}}>目前沒有可顯示的訊息</div>}
              </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderPlaceholder = (i, n) => (<div className="mp-page"><div className="mp-hdr"><div className="mp-back" onClick={closeApp}>←</div><div className="mp-htitle">{i} {n}</div></div><div className="mp-empty" style={{flex:1}}><div className="mp-empty-i">{i}</div><div className="mp-empty-t">即將推出<br/>敬請期待</div></div></div>);

  const renderApp = () => {
    switch(currentApp) {
      case "chat": return renderChat();
      case "status": return renderStatus();
      case "social": return renderSocial();
      case "lorebook": return renderLorebook();
      case "characters": return renderCharacters();
      case "settings": return renderSettings();
      case "player": return renderPlayer();
      case "wallet": return renderWallet();
      case "gallery": return renderPlaceholder("🖼️","相簿");
      case "notebook": return renderPlaceholder("📒","筆記");
      case "phone": return renderPhone();
      default: return null;
    }
  };
  const onPointerDragStartApp = (e, appId, fromArea) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    swipeStartXRef.current = null;
    swipeStartYRef.current = null;
    clearTimeout(edgeTurnTimerRef.current);
    edgeTurnTimerRef.current = null;
    edgeTurnDirRef.current = null;
    setIsDraggingApp(true);
    setPointerDrag({
      appId,
      fromArea,
      startX: e.clientX || 0,
      startY: e.clientY || 0,
      x: e.clientX || 0,
      y: e.clientY || 0,
      moved: false,
    });
  };
  const cancelPointerDrag = () => {
    setPointerDrag(null);
    setIsDraggingApp(false);
    clearTimeout(edgeTurnTimerRef.current);
    edgeTurnTimerRef.current = null;
    edgeTurnDirRef.current = null;
  };
  const onDropToHome = (e, slotIndex) => {
    e.preventDefault();
    try {
      const { appId } = JSON.parse(e.dataTransfer.getData("text/plain"));
      moveAppToHomeSlot(appId, slotIndex);
    } catch (_) {}
  };
  const onDropToHomeGrid = (e, pageIdx) => {
    e.preventDefault();
    // 目前以主畫面(中間頁)為主：拖放一律落在中間頁 4x3
    const targetPage = 1;
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const relY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
    const col = Math.max(0, Math.min(3, Math.floor((relX / rect.width) * 4)));
    const row = Math.max(0, Math.min(2, Math.floor((relY / rect.height) * 3)));
    const slot = targetPage * PAGE_SIZE + row * 4 + col;
    onDropToHome(e, slot);
  };
  const onDropToDock = (e, index) => {
    e.preventDefault();
    try {
      const { appId } = JSON.parse(e.dataTransfer.getData("text/plain"));
      moveAppToDock(appId, index);
    } catch (_) {}
  };
  const onDropToDockContainer = (e) => {
    e.preventDefault();
    try {
      const { appId } = JSON.parse(e.dataTransfer.getData("text/plain"));
      const rect = e.currentTarget.getBoundingClientRect();
      const relX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      const slotCount = Math.max(1, dockApps.length);
      const ratio = relX / rect.width;
      const targetIndex = Math.max(0, Math.min(dockApps.length, Math.round(ratio * slotCount)));
      moveAppToDock(appId, targetIndex);
    } catch (_) {}
  };
  const onHomeDragOverPageEdge = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const edge = 28;
    const maxPage = Math.max(0, homePages.length - 1);
    if (x <= rect.left + edge) setHomePage(p => Math.max(0, p - 1));
    else if (x >= rect.right - edge) setHomePage(p => Math.min(maxPage, p + 1));
  };
  return (<><style>{css}</style><div className="mp-wrap"><div className="mp-phone">
    <div className="mp-desk" onTouchStart={onHomeTouchStart} onTouchEnd={onHomeTouchEnd} onMouseDown={onHomeMouseDown} onMouseUp={onHomeMouseUp} onPointerDown={onHomePointerDown} onPointerUp={onHomePointerUp} onPointerMove={onHomePointerMove} onPointerCancel={cancelPointerDrag} onDragOver={onHomeDragOverPageEdge}><BarClock ft={ft} /><div className="mp-desk-scroll">
      <div className="mp-badge">SYSTEM READY</div>
      <DeskClock ft={ft} fd={fd} />
      {activeChar && <div className="mp-cw" onClick={()=>openApp("status")}><div className="mp-av">{sanitizeUserImageUrl(activeChar.avatar)?<img src={sanitizeUserImageUrl(activeChar.avatar)} alt=""/>:"??"}</div><div className="mp-cw-info"><div className="mp-cw-name">{activeChar.name}<span className="mp-active-badge">ACTIVE</span></div><div className="mp-cw-desc">{(activeChar.statusText || activeChar.description || "在線中").slice(0,34)}</div><div style={{fontSize:10,color:"var(--mp-txt-l)",marginTop:2}}>更新：{activeChar.statusUpdatedAt ? new Date(activeChar.statusUpdatedAt).toLocaleTimeString("zh-TW",{hour:"2-digit",minute:"2-digit"}) : "--:--"}</div></div></div>}
      <div className="mp-home-mid">
        <div className="mp-pages">
          <div className="mp-pages-track" style={{ transform: `translateX(-${homePage * 100}%)` }}>
            {homePages.map((apps, idx) => (
              <div key={idx} className="mp-grid" onDragOver={(e)=>e.preventDefault()} onDrop={(e)=>onDropToHomeGrid(e, idx)}>
                {Array.from({ length: PAGE_SIZE }).map((_, slotIdx) => {
                  const app = apps[slotIdx] ? appById[apps[slotIdx]] : null;
                  const absoluteIdx = idx * PAGE_SIZE + slotIdx;
                  return (
                    <div
                      key={`slot-${absoluteIdx}`}
                      className={`mp-icon ${app ? "" : "mp-icon-empty"}`}
                      onDragOver={(e)=>e.preventDefault()}
                      onDrop={(e)=>onDropToHome(e, absoluteIdx)}
                      data-drop-slot={absoluteIdx}
                      onClick={()=>app && !isDraggingApp && Date.now() > suppressAppClickUntilRef.current && openApp(app.id)}
                      draggable={false}
                      onPointerDown={(e)=>app && onPointerDragStartApp(e, app.id, "home")}
                    >
                      <div className={`mp-icon-c ${app?.iconUrl ? "mp-icon-c-img" : ""}`}>{app ? renderAppIcon(app, app.iconUrl ? 56 : 26) : ""}</div>
                      <span className="mp-icon-l">{app ? app.name : ""}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div><div className="mp-page-dots">
      {homePages.map((_, idx) => <span key={idx} className={`mp-page-dot ${homePage===idx ? "active" : ""}`} />)}
    </div><div className="mp-dock" data-drop-dock-wrap="1" onDragOver={(e)=>e.preventDefault()} onDrop={onDropToDockContainer} style={{justifyContent: "center", gap: dockApps.length <= 2 ? 22 : 14}}>
      {dockApps.map((app, idx) => {
        return (
          <div
            key={`dock-${idx}`}
            className="mp-dock-i"
            onDragOver={(e)=>e.preventDefault()}
            onDrop={(e)=>onDropToDock(e, idx)}
            data-drop-dock={idx}
            onClick={()=>!isDraggingApp && Date.now() > suppressAppClickUntilRef.current && openApp(app.id)}
            draggable={false}
            onPointerDown={(e)=>onPointerDragStartApp(e, app.id, "dock")}
          >
            {renderAppIcon(app, app.iconUrl ? 56 : 24)}
          </div>
        );
      })}
    </div></div>
    {pointerDrag && pointerDrag.moved && (
      <div style={{position:"fixed",left:pointerDrag.x-22,top:pointerDrag.y-22,width:44,height:44,borderRadius:14,background:"rgba(255,255,255,.92)",border:"1px solid rgba(231,197,214,.9)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,pointerEvents:"none",zIndex:9999,boxShadow:"0 8px 18px rgba(0,0,0,.15)"}}>
        {appById[pointerDrag.appId]?.icon || "🧩"}
      </div>
    )}
    {currentApp && renderApp()}
    {modal === "addChar" && <AddCharModal setModal={setModal} addCharacter={addCharacter} updateCharacter={updateCharacter} editingCharacter={editingCharacter} sanitizeUserImageUrl={sanitizeUserImageUrl} />}
    {memoryEditor && (
      <div className="mp-overlay" onClick={() => setMemoryEditor(null)}>
        <div className="mp-modal" onClick={(e) => e.stopPropagation()}>
          <div className="mp-modal-t">編輯記憶</div>
          <div className="mp-row">
            <div className="mp-lbl">記憶內容（最多 500 字）</div>
            <textarea className="mp-ta" value={memoryEditor.text} maxLength={500} onChange={(e)=>setMemoryEditor((s)=>({ ...s, text: e.target.value }))} style={{minHeight:140,resize:"vertical"}} />
          </div>
          <div style={{display:"flex",gap:8,marginTop:10}}>
            <button className="mp-save" style={{flex:1,background:"linear-gradient(135deg,#b0bec5,#90a4ae)"}} onClick={() => setMemoryEditor(null)}>取消</button>
            <button className="mp-save" style={{flex:1}} onClick={() => {
              const t = sanitizeText(memoryEditor.text, 500);
              setMemories((prev) => ({
                ...prev,
                [memoryEditor.charId]: (prev[memoryEditor.charId] || []).map((m) =>
                  m.id === memoryEditor.memoryId ? { ...m, text: t } : m
                ),
              }));
              setMemoryEditor(null);
              showToast("記憶已更新");
            }}>儲存</button>
          </div>
        </div>
      </div>
    )}
    {messageEditor && (
      <div className="mp-overlay" onClick={closeMessageEditor}>
        <div className="mp-modal" onClick={(e)=>e.stopPropagation()}>
          <div className="mp-modal-t" style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <span>編輯對話</span>
            <button className="mp-ibtn-r" onClick={deleteMessageWithConfirm} title="刪除此段訊息">🗑️</button>
          </div>
          <div className="mp-row">
            <div className="mp-lbl">訊息內容</div>
            <textarea className="mp-ta" value={messageEditor.content} onChange={(e)=>setMessageEditor((s)=>({ ...s, content: e.target.value }))} style={{minHeight:120,resize:"vertical"}} />
          </div>
          <div style={{display:"flex",gap:8,marginTop:10}}>
            <button className="mp-save" style={{flex:1,background:"linear-gradient(135deg,#b0bec5,#90a4ae)"}} onClick={closeMessageEditor}>取消</button>
            <button className="mp-save" style={{flex:1}} onClick={saveEditedMessage}>儲存</button>
          </div>
        </div>
      </div>
    )}
    {toast && <div className="mp-toast">{toast}</div>}
  </div></div></>);
}




