import React, { useState, useEffect, useRef } from "react";
import { VERSION, CHANGELOG, API_PROVIDERS, DEFAULT_APPS, DOCK_APPS } from "./constants/appConstants";
import { gid, ft, fd, sanitizeText, sanitizeUserImageUrl } from "./utils/coreUtils";
import { parseSillyTavernJSON, parseSillyTavernPNG, buildSystemPrompt } from "./utils/characterParser";
import { callAI, fetchAvailableModels } from "./services/aiService";
import { loadAppState, saveAppState } from "./utils/indexedDbStorage";
import css, { THEME_PRESETS } from "./styles/maliPhoneCss";

function AddCharModal({ setModal, setEditingCharacter, addCharacter, updateCharacter, exportCharacter, deleteCharacter, editingCharacter, sanitizeUserImageUrl }) {
  const [tab, setTab] = useState("manual");
  const [n, sn] = useState(""); const [d, sd] = useState(""); const [p, sp] = useState(""); const [rel, srel] = useState(""); const [av, sav] = useState("");
  const [importErr, setImportErr] = useState(""); const [importing, setImporting] = useState(false);
  const [avatarCrop, setAvatarCrop] = useState(null);
  const AVATAR_MAX_BYTES = 400 * 1024;
  const avRef = useRef(null); const importRef = useRef(null);
  const closeModal = () => {
    setModal(null);
    setEditingCharacter?.(null);
  };
  useEffect(() => {
    if (!editingCharacter) return;
    setTab("manual");
    sn(editingCharacter.name || "");
    sd(editingCharacter.description || "");
    sp(editingCharacter.systemPrompt || "");
    srel(editingCharacter.relationshipToUser || "");
    sav(editingCharacter.avatar || "");
  }, [editingCharacter]);
  const onAv = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      const safe = sanitizeUserImageUrl(String(r.result || ""));
      if (!safe) {
        alert("頭像格式不支援");
        return;
      }
      const img = new Image();
      img.onload = () => {
        setAvatarCrop({ src: safe, width: img.width, height: img.height, zoom: 1, panX: 0, panY: 0, dragging: false, dragStartX: 0, dragStartY: 0, startPanX: 0, startPanY: 0 });
      };
      img.onerror = () => alert("頭像讀取失敗");
      img.src = safe;
    };
    r.readAsDataURL(f);
    e.target.value = "";
  };
  const applyAvatarCrop = () => {
    if (!avatarCrop?.src) return;
    const img = new Image();
    img.onload = () => {
        const candidates = [
          { size: 512, quality: 0.82 },
          { size: 448, quality: 0.76 },
          { size: 384, quality: 0.7 },
          { size: 320, quality: 0.64 },
        ];
        let picked = null;
        for (const c of candidates) {
          const canvas = document.createElement("canvas");
          canvas.width = c.size;
          canvas.height = c.size;
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 0, c.size, c.size);
          const scale = Math.max(c.size / img.width, c.size / img.height) * Math.max(1, avatarCrop.zoom || 1);
          const dw = img.width * scale;
          const dh = img.height * scale;
          const maxShiftX = Math.max(0, (dw - c.size) / 2);
          const maxShiftY = Math.max(0, (dh - c.size) / 2);
          const dx = (c.size - dw) / 2 + (maxShiftX * Number(avatarCrop.panX || 0)) / 100;
          const dy = (c.size - dh) / 2 + (maxShiftY * Number(avatarCrop.panY || 0)) / 100;
          ctx.drawImage(img, dx, dy, dw, dh);
          const out = canvas.toDataURL("image/jpeg", c.quality);
          const b64 = out.split(",")[1] || "";
          const bytes = Math.ceil((b64.length * 3) / 4);
          picked = { out, bytes, size: c.size };
          if (bytes <= AVATAR_MAX_BYTES) break;
        }
        if (!picked || picked.bytes > AVATAR_MAX_BYTES) {
          alert("頭像壓縮後仍超過 400KB，請改用尺寸更小或內容更簡單的圖片");
          return;
        }
        sav(picked.out);
        setAvatarCrop(null);
    };
    img.onerror = () => alert("頭像讀取失敗");
    img.src = avatarCrop.src;
  };
  const startAvatarDrag = (e) => {
    if (!avatarCrop) return;
    const px = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
    const py = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
    setAvatarCrop((s) => ({ ...(s || {}), dragging: true, dragStartX: px, dragStartY: py, startPanX: s?.panX || 0, startPanY: s?.panY || 0 }));
  };
  const moveAvatarDrag = (e) => {
    setAvatarCrop((s) => {
      if (!s?.dragging) return s;
      const px = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
      const py = e.clientY ?? e.touches?.[0]?.clientY ?? 0;
      const nextPanX = (s.startPanX || 0) + ((px - (s.dragStartX || 0)) / 1.8);
      const nextPanY = (s.startPanY || 0) + ((py - (s.dragStartY || 0)) / 1.8);
      return { ...s, panX: Math.max(-100, Math.min(100, nextPanX)), panY: Math.max(-100, Math.min(100, nextPanY)) };
    });
  };
  const endAvatarDrag = () => setAvatarCrop((s) => s ? { ...s, dragging: false } : s);
  const onAvatarPointerDown = (e) => {
    e.preventDefault();
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch (_) {}
    startAvatarDrag(e);
  };
  const onAvatarPointerMove = (e) => {
    if (!avatarCrop?.dragging) return;
    e.preventDefault();
    moveAvatarDrag(e);
  };
  const onAvatarPointerUp = (e) => {
    try { e.currentTarget.releasePointerCapture?.(e.pointerId); } catch (_) {}
    endAvatarDrag();
  };
  const getAvatarCropImageStyle = () => {
    const box = 220;
    const iw = Number(avatarCrop?.width || 1);
    const ih = Number(avatarCrop?.height || 1);
    const scale = Math.max(box / iw, box / ih) * Math.max(1, Number(avatarCrop?.zoom || 1));
    const dw = iw * scale;
    const dh = ih * scale;
    const maxShiftX = Math.max(0, (dw - box) / 2);
    const maxShiftY = Math.max(0, (dh - box) / 2);
    return {
      position: "absolute",
      width: dw,
      height: dh,
      left: (box - dw) / 2 + (maxShiftX * Number(avatarCrop?.panX || 0)) / 100,
      top: (box - dh) / 2 + (maxShiftY * Number(avatarCrop?.panY || 0)) / 100,
      userSelect: "none",
      WebkitUserDrag: "none",
      pointerEvents: "none",
    };
  };
  const handleImport = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setImportErr(""); setImporting(true);
    try {
      if (file.name.endsWith(".json")) {
        const t = await file.text();
        const raw = JSON.parse(t);
        if (raw?.format === "maliphone-character" && raw?.character) addCharacter(raw.character);
        else addCharacter(parseSillyTavernJSON(raw));
      }
      else if (file.type === "image/png") { addCharacter(await parseSillyTavernPNG(file)); }
      else setImportErr("不支援的檔案格式，請使用 .json 或 .png");
    } catch (err) { setImportErr(err.message || "匯入失敗"); }
    setImporting(false); if (importRef.current) importRef.current.value = "";
  };
  return (
    <div className="mp-overlay" onClick={closeModal}>
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
            MaliPhone 角色卡 JSON<br/>
            SillyTavern V1/V2 JSON<br/>
            SillyTavern PNG（含 chara tEXt chunk）<br/>
            會自動讀取 name、description、personality、scenario、first_mes、mes_example、system_prompt、tags
          </div>
        </>) : (<>
          <div className="mp-row"><div className="mp-lbl">角色頭像</div><div style={{display:"flex",alignItems:"center",gap:10}}><div className="mp-av" style={{cursor:"pointer"}} onClick={() => avRef.current?.click()}>{av ? <img src={av} alt="" /> : "🦊"}</div><input type="file" ref={avRef} accept="image/*" style={{display:"none"}} onChange={onAv} /><span style={{fontSize:11,color:"var(--mp-txt-l)"}}>點擊更換</span></div></div>
          <div className="mp-row"><div className="mp-lbl">角色名稱 *</div><input className="mp-sinp" value={n} onChange={e=>sn(e.target.value)} placeholder="例如 Luna" /></div>
          <div className="mp-row"><div className="mp-lbl">角色設定（Character Description）</div><textarea className="mp-ta" value={d} maxLength={8000} onChange={e=>sd(e.target.value.slice(0, 8000))} placeholder="描述角色背景、行為、語氣與互動方式" style={{minHeight:90,resize:"vertical"}} /><div className="mp-char-counter mp-char-counter-modal">{d.length}/8000</div></div>
            <div className="mp-row"><div className="mp-lbl">系統提示詞（System Prompt）</div><textarea className="mp-ta" value={p} maxLength={8000} onChange={e=>sp(e.target.value.slice(0, 8000))} placeholder="定義角色語氣、人格、回覆方式" /><div className="mp-char-counter mp-char-counter-modal">{p.length}/8000</div></div>
            <div className="mp-row"><div className="mp-lbl">與玩家關係</div><input className="mp-sinp" value={rel} onChange={e=>srel(e.target.value)} placeholder="例如：青梅竹馬、同事、戀人、陌生人" /></div>
            <div className={editingCharacter ? "mp-char-actions" : ""} style={{marginTop:10}}>
            <button className="mp-save" style={editingCharacter ? {} : {marginTop:10}} onClick={() => {
              if(!n.trim()) return alert("請輸入角色名稱");
              if (editingCharacter && !window.confirm(`確定要儲存角色「${n.trim()}」的變更嗎？`)) return;
              const payload = {name:n.trim(),description:d.trim(),systemPrompt:p.trim(),relationshipToUser:rel.trim(),avatar:av,personality:editingCharacter?.personality||"",scenario:editingCharacter?.scenario||"",firstMessage:editingCharacter?.firstMessage||"",messageExamples:editingCharacter?.messageExamples||"",tags:editingCharacter?.tags||[],creator:editingCharacter?.creator||"",creatorNotes:editingCharacter?.creatorNotes||""};
              if (editingCharacter) updateCharacter(editingCharacter.id, payload);
              else addCharacter(payload);
            }}>{editingCharacter ? "儲存變更" : "建立角色"}</button>
            {editingCharacter && <>
              <button className="mp-ibtn" onClick={() => {
                if (!window.confirm(`要匯出角色「${editingCharacter.name}」的角色卡嗎？`)) return;
                exportCharacter?.(editingCharacter);
              }}>匯出</button>
              <button className="mp-ibtn-r" onClick={() => {
                if (!window.confirm(`確定要刪除角色「${editingCharacter.name}」嗎？這會一併刪除此角色的聊天室、記憶與其他聊天快取。`)) return;
                deleteCharacter?.(editingCharacter.id);
                closeModal();
              }}>刪除</button>
            </>}
            </div>
        </>)}
      </div>
      {avatarCrop && (
        <div className="mp-overlay" style={{zIndex:130}} onClick={(e) => { e.stopPropagation(); setAvatarCrop(null); }}>
          <div className="mp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mp-modal-t">裁切角色頭像</div>
            <div style={{display:"grid",placeItems:"center",marginBottom:10}}>
              <div
                style={{width:220,height:220,borderRadius:18,overflow:"hidden",border:"1px solid rgba(244,143,177,.35)",background:"#fff",touchAction:"none",cursor: avatarCrop.dragging ? "grabbing" : "grab",position:"relative"}}
                onPointerDown={onAvatarPointerDown}
                onPointerMove={onAvatarPointerMove}
                onPointerUp={onAvatarPointerUp}
                onPointerCancel={onAvatarPointerUp}
              >
                <img
                  src={avatarCrop.src}
                  alt=""
                  style={getAvatarCropImageStyle()}
                />
              </div>
            </div>
            <div className="mp-row"><div className="mp-lbl">縮放</div><input type="range" min="1" max="3" step="0.01" value={avatarCrop.zoom} onChange={e=>setAvatarCrop(s=>({...(s||{}),zoom:Number(e.target.value)}))} /></div>
            <div style={{fontSize:11,color:"var(--mp-txt-l)",marginTop:4}}>拖曳圖片調整位置，套用後會自動壓縮到 400KB 以內</div>
            <div style={{display:"flex",gap:8,marginTop:8}}>
              <button className="mp-save" style={{flex:1,background:"linear-gradient(135deg,#b0bec5,#90a4ae)"}} onClick={() => setAvatarCrop(null)}>取消</button>
              <button className="mp-save" style={{flex:1}} onClick={applyAvatarCrop}>套用</button>
            </div>
          </div>
        </div>
      )}
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
    chatModes: {},
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
    characterWallets: {},
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
    apiConfig: { provider: "openai", baseUrl: "https://api.openai.com/v1", apiKey: "", model: "gpt-4o-mini", location: "global" },
    themeName: "莓果蘇打",
    screenLockTimeout: 5,
  };
  const [locked, setLocked] = useState(true);
  const [unlocking, setUnlocking] = useState(false);
  const [currentApp, setCurrentApp] = useState(null);
  const [toast, setToast] = useState(null);
  const [characters, setCharacters] = useState(defaultAppState.characters);
  const [activeCharId, setActiveCharId] = useState(defaultAppState.activeCharId);
  const [chatHistory, setChatHistory] = useState(defaultAppState.chatHistory);
  const [chatModes, setChatModes] = useState(defaultAppState.chatModes);
  const [chatInput, setChatInput] = useState("");
  const [chatImage, setChatImage] = useState(null);
  const [chatActionPanelOpen, setChatActionPanelOpen] = useState(false);
  const CHAT_IMAGE_MAX_BYTES = 1024 * 1024; // 1MB
  const [isTyping, setIsTyping] = useState(false);
  const [currentChatChar, setCurrentChatChar] = useState(null);
  const [activeMessageId, setActiveMessageId] = useState(null);
  const [messageEditor, setMessageEditor] = useState(null);
  const [posts, setPosts] = useState(defaultAppState.posts);
  const [postCommentInputs, setPostCommentInputs] = useState({});
  const [activeCommentPostId, setActiveCommentPostId] = useState(null);
  const [activeLikePostId, setActiveLikePostId] = useState(null);
  const [socialReplyTarget, setSocialReplyTarget] = useState(null);
  const [expandedSocialPosts, setExpandedSocialPosts] = useState({});
  const [socialTick, setSocialTick] = useState(Date.now());
  const [playerPostModalOpen, setPlayerPostModalOpen] = useState(false);
  const [playerPostText, setPlayerPostText] = useState("");
  const [playerPostSubmitting, setPlayerPostSubmitting] = useState(false);
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferAmount, setTransferAmount] = useState("");
  const [transferNote, setTransferNote] = useState("");
  const [transferSubmitting, setTransferSubmitting] = useState(false);
  const ONLINE_CHAT_TEXT_LIMIT = 800;
  const REALITY_CHAT_TEXT_LIMIT = 4000;
  const SHARE_RAW_TOKEN_LIMIT = 1000;
  const PLAYER_SOCIAL_POST_LIMIT = 500;
  const CHARACTER_WALLET_TX_LIMIT = 15;
  const TOTAL_CONTEXT_TOKEN_LIMIT = 40000;
  const [memories, setMemories] = useState(defaultAppState.memories);
  const [lorebooks, setLorebooks] = useState(defaultAppState.lorebooks);
  const [chatLorebookBindings, setChatLorebookBindings] = useState(defaultAppState.chatLorebookBindings);
  const [phoneInboxCache, setPhoneInboxCache] = useState(defaultAppState.phoneInboxCache);
  const [wallet, setWallet] = useState(defaultAppState.wallet);
  const [characterWallets, setCharacterWallets] = useState(defaultAppState.characterWallets);
  const [walletGenLoading, setWalletGenLoading] = useState(false);
  const [apiPresets, setApiPresets] = useState(defaultAppState.apiPresets);
  const [playerProfile, setPlayerProfile] = useState(defaultAppState.playerProfile);
  const [themeName, setThemeName] = useState(defaultAppState.themeName);
  const [playerAvatarCrop, setPlayerAvatarCrop] = useState(null);
  const [screenLockTimeout, setScreenLockTimeout] = useState(defaultAppState.screenLockTimeout);
  const [phoneViewCharId, setPhoneViewCharId] = useState(null);
  const [phonePage, setPhonePage] = useState("picker");
  const [phoneActiveThreadId, setPhoneActiveThreadId] = useState("player");
  const [phoneGenLoading, setPhoneGenLoading] = useState(false);
  const [memoryEditor, setMemoryEditor] = useState(null);
  const [activeMemoryId, setActiveMemoryId] = useState(null);
  const [apiConfig, setApiConfig] = useState(defaultAppState.apiConfig);
  const [modelBadgeOpen, setModelBadgeOpen] = useState(false);
  const [modal, setModal] = useState(null);
  const [updateNoticeOpen, setUpdateNoticeOpen] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState(null);
  const [tempConfig, setTempConfig] = useState(null);
  const [providerModelOptions, setProviderModelOptions] = useState({});
  const [fetchingModels, setFetchingModels] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [presetSavePickerOpen, setPresetSavePickerOpen] = useState(false);
  const [clearCacheArmed, setClearCacheArmed] = useState(false);
  const [statusExpandedCharId, setStatusExpandedCharId] = useState(null);
  const [statusMemoryExpandedCharId, setStatusMemoryExpandedCharId] = useState(null);
  const [settingsApiOpen, setSettingsApiOpen] = useState(true);
  const [settingsResetOpen, setSettingsResetOpen] = useState(false);
  const [settingsVersionOpen, setSettingsVersionOpen] = useState(false);
  const [settingsDisclaimerOpen, setSettingsDisclaimerOpen] = useState(false);
  const [settingsResetDataOpen, setSettingsResetDataOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState("appearance");
  const [dataImporting, setDataImporting] = useState(false);
  const [dataImportPreview, setDataImportPreview] = useState(null);
  const [editingLorebookEntry, setEditingLorebookEntry] = useState(null);
  const [editingLorebookBook, setEditingLorebookBook] = useState(null);
  const [activeLorebookId, setActiveLorebookId] = useState(null);
  const [viewingLorebookEntry, setViewingLorebookEntry] = useState(null);
  const [chatSettingsOpen, setChatSettingsOpen] = useState(false);
  const [chatSettingsExpandedBooks, setChatSettingsExpandedBooks] = useState({});
  const [chatSettingsLorebookOpen, setChatSettingsLorebookOpen] = useState(false);
  const [chatroomManageOpen, setChatroomManageOpen] = useState(false);
  const [chatVisibleCounts, setChatVisibleCounts] = useState({});
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
  const walletAutoRefreshBusyRef = useRef(false);
  const SOCIAL_GLOBAL_COOLDOWN_MS = 60 * 1000;
  const SOCIAL_CHAR_COOLDOWN_MS = 3 * 60 * 1000;
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const noticeLongPressTimerRef = useRef(null);
  const swipeStartXRef = useRef(null);
  const swipeStartYRef = useRef(null);
  const lockStartYRef = useRef(null);
  const autoLockTimerRef = useRef(null);
  const edgeTurnTimerRef = useRef(null);
  const edgeTurnDirRef = useRef(null);
  const suppressAppClickUntilRef = useRef(0);
  const serviceWorkerReloadingRef = useRef(false);
  const serviceWorkerHadControllerRef = useRef(false);
  const dataImportRef = useRef(null);
  const chatroomImportRef = useRef(null);
  const [chatroomImportTarget, setChatroomImportTarget] = useState(null);
  const [chatroomImportPreview, setChatroomImportPreview] = useState(null);
  const [chatroomImporting, setChatroomImporting] = useState(false);
  const chatMsgsRef = useRef(null);
  const chatLoadAdjustRef = useRef(null);
  const [walletSettingsOpen, setWalletSettingsOpen] = useState(false);
  const [walletSettingsPage, setWalletSettingsPage] = useState("main");

  useEffect(() => {
    let mounted = true;
    loadAppState(defaultAppState).then((data) => {
      if (!mounted) return;
      setCharacters(data.characters || []);
      setActiveCharId(data.activeCharId ?? null);
      setChatHistory(data.chatHistory || {});
      setChatModes(data.chatModes || {});
      setPosts(data.posts || []);
      setMemories(data.memories || {});
      setPhoneInboxCache(data.phoneInboxCache || {});
      setWallet(data.wallet || defaultAppState.wallet);
      setCharacterWallets(data.characterWallets || {});
      setScreenLockTimeout(Number.isFinite(Number(data.screenLockTimeout)) ? Number(data.screenLockTimeout) : defaultAppState.screenLockTimeout);
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
      setThemeName(data.themeName || defaultAppState.themeName);
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
      saveAppState({ characters, activeCharId, chatHistory, chatModes, posts, memories, lorebooks, chatLorebookBindings, phoneInboxCache, wallet, characterWallets, screenLockTimeout, apiPresets, playerProfile, apiConfig, themeName, homeSlots, dockOrder }).catch(() => {});
    }, 180);
    return () => clearTimeout(timer);
  }, [hydrated, characters, activeCharId, chatHistory, chatModes, posts, memories, lorebooks, chatLorebookBindings, phoneInboxCache, wallet, characterWallets, screenLockTimeout, apiPresets, playerProfile, apiConfig, themeName, homeSlots, dockOrder]);
  useEffect(() => {
    if (locked) return;
    const timeoutMs = screenLockTimeout === 0 ? null : Math.max(1, Number(screenLockTimeout) || 0) * 60 * 1000;
    if (!timeoutMs) return;
    const schedule = () => {
      clearTimeout(autoLockTimerRef.current);
      autoLockTimerRef.current = setTimeout(() => {
        setLocked(true);
        setUnlocking(false);
      }, timeoutMs);
    };
    schedule();
    const events = ["pointerdown", "mousedown", "touchstart", "keydown", "scroll"];
    const onActivity = () => schedule();
    events.forEach((ev) => window.addEventListener(ev, onActivity, { passive: true }));
    return () => {
      clearTimeout(autoLockTimerRef.current);
      events.forEach((ev) => window.removeEventListener(ev, onActivity));
    };
  }, [locked, screenLockTimeout]);
  useEffect(() => {
    if (!hydrated || currentApp !== "social") return;
    setSocialTick(Date.now());
    const hasPendingLikes = (posts || []).some((p) => (
      (p.likedBy || []).some((x) => (x.time || 0) > Date.now())
    ));
    if (!hasPendingLikes) return;
    const timer = setInterval(() => setSocialTick(Date.now()), 15000);
    return () => clearInterval(timer);
  }, [hydrated, currentApp, posts]);
  const getWalletTimeSlot = (ts) => {
    const h = new Date(ts || Date.now()).getHours();
    if (h >= 6 && h < 12) return "morning";
    if (h >= 12 && h < 18) return "afternoon";
    return "night";
  };
  const shouldAutoRefreshWallet = (cw) => {
    if (!cw?.summary) return false;
    const currentSlot = getWalletTimeSlot(Date.now());
    const lastSlot = cw.lastRefreshedSlot || getWalletTimeSlot(cw.refreshedAt || cw.generatedAt || Date.now());
    return currentSlot !== lastSlot;
  };
  useEffect(() => {
    if (!hydrated || phonePage !== "wallet") return;
    const selectedCharId = phoneViewCharId || activeCharId || characters[0]?.id || null;
    const selectedChar = characters.find((c) => c.id === selectedCharId) || null;
    const phoneWallet = selectedChar ? characterWallets[selectedChar.id] : null;
    if (!selectedChar || !phoneWallet?.summary || walletAutoRefreshBusyRef.current) return;
    if (!shouldAutoRefreshWallet(phoneWallet)) return;
    walletAutoRefreshBusyRef.current = true;
    generateCharacterWallet(selectedChar, { mode: "refresh" })
      .finally(() => {
        walletAutoRefreshBusyRef.current = false;
      });
  }, [hydrated, phonePage, phoneViewCharId, activeCharId, characters, characterWallets]);
  useEffect(() => {
    if (!hydrated) return;
    try {
      const seen = localStorage.getItem("mali_seen_version");
      if (seen !== VERSION) setUpdateNoticeOpen(true);
    } catch {}
  }, [hydrated]);
  useEffect(() => {
    if (!(typeof import.meta !== "undefined" && import.meta.env && import.meta.env.PROD)) return;
    if (!("serviceWorker" in navigator)) return;
    const base = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.BASE_URL) ? import.meta.env.BASE_URL : "/";
    serviceWorkerHadControllerRef.current = !!navigator.serviceWorker.controller;
    const onControllerChange = () => {
      if (!serviceWorkerHadControllerRef.current) {
        serviceWorkerHadControllerRef.current = true;
        return;
      }
      if (serviceWorkerReloadingRef.current) return;
      serviceWorkerReloadingRef.current = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    navigator.serviceWorker.register(`${base}sw.js`).then((reg) => {
      reg.update().catch(() => {});
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
    return () => navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
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
  useEffect(() => {
    if (!currentChatChar) return;
    const el = chatMsgsRef.current || messagesEndRef.current?.parentElement;
    if (!el) return;
    const t = setTimeout(() => {
      el.scrollTop = el.scrollHeight;
    }, 0);
    return () => clearTimeout(t);
  }, [currentChatChar?.id, chatHistory, isTyping, chatVisibleCounts]);
  useEffect(() => {
    if (!currentChatChar) return;
    setChatVisibleCounts((prev) => {
      const current = prev[currentChatChar.id];
      if (current === 50) return prev;
      return { ...prev, [currentChatChar.id]: 50 };
    });
  }, [currentChatChar?.id]);
  useEffect(() => {
    const adjust = chatLoadAdjustRef.current;
    if (!adjust?.charId) return;
    if (adjust.charId !== currentChatChar?.id) return;
    const el = chatMsgsRef.current;
    if (!el) return;
    const diff = el.scrollHeight - (adjust.prevScrollHeight || el.scrollHeight);
    if (diff > 0) el.scrollTop = (adjust.prevScrollTop || 0) + diff;
    chatLoadAdjustRef.current = null;
  }, [currentChatChar?.id, chatVisibleCounts]);
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
  const currentChangelogRaw = CHANGELOG[VERSION] || [];
  const currentChangelogTitle = currentChangelogRaw[0] || "版本更新";
  const currentChangelog = currentChangelogRaw.slice(1);
  const closeUpdateNotice = () => {
    try { localStorage.setItem("mali_seen_version", VERSION); } catch {}
    setUpdateNoticeOpen(false);
  };
  const playerAvatarRef = useRef(null);
  const estimateTokens = (s) => Math.ceil(String(s || "").length / 3.5);
  const getUserDisplayName = () => sanitizeText(playerProfile?.name || "玩家", 40) || "玩家";
  const applyUserPlaceholder = (text) => String(text || "").replace(/\{\{user\}\}/g, getUserDisplayName());
  const replaceUserPlaceholderForWallet = (text) => String(text || "")
    .replace(/\{\{user\}\}/gi, getUserDisplayName())
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([，。！？、,.!?；;：:])/g, "$1")
    .trim();
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
    const limit = getChatTextLimit(messageEditor.mode);
    const next = (chatHistory[cid] || []).map((m) =>
      m.id === messageEditor.id ? { ...m, content: sanitizeText(messageEditor.content, limit) } : m
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
    t = t.replace(/<internal>[\s\S]*?<\/internal>/gi, " ");
    t = t.replace(/<think>[\s\S]*?<\/think>/gi, " ");
    t = stripModeLabel(t);
    // 移除常見動作描寫格式：*...*、（...）、(...)
    t = t.replace(/\*[^*]{1,120}\*/g, " ");
    t = t.replace(/（[^（）]{1,120}）/g, " ");
    t = t.replace(/\([^()]{1,120}\)/g, " ");
    // 收斂空白與空行
    t = t.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    return t || "嗯，我在。";
  };
  const normalizeRealityReply = (text) => {
    const t = String(text || "")
      .replace(/\\n/g, "\n")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    return t || "他安靜地看著你，像是在等你把話說完。";
  };
  const splitAssistantBubbles = (text) => {
    const normalized = String(text || "")
      .replace(/\\n/g, "\n")
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (normalized.length <= 1) return [String(text || "").trim()].filter(Boolean);
    const maxBubbles = 6;
    if (normalized.length <= maxBubbles) return normalized;
    return [...normalized.slice(0, maxBubbles - 1), normalized.slice(maxBubbles - 1).join("\n")];
  };
  const isChatMode = (mode) => mode === "reality" || mode === "online";
  const getMessageMode = (m) => (isChatMode(m?.mode) ? m.mode : "online");
  const getLastCommittedChatMode = (charId) => {
    const list = chatHistory[charId] || [];
    for (let i = list.length - 1; i >= 0; i--) {
      const m = list[i];
      if (m?.role === "mode_transition") return isChatMode(m.toMode) ? m.toMode : "online";
      if (m?.role === "user" || m?.role === "assistant") return getMessageMode(m);
    }
    return "online";
  };
  const getSelectedChatMode = (charId) => chatModes?.[charId] || getLastCommittedChatMode(charId);
  const setSelectedChatMode = (charId, mode) => {
    if (!charId || !isChatMode(mode)) return;
    setChatModes((prev) => ({ ...(prev || {}), [charId]: mode }));
    setChatInput((value) => sanitizeText(value, getChatTextLimit(mode)));
  };
  const getModeLabel = (mode) => (mode === "reality" ? "現實模式" : "線上聊天");
  const stripModeLabel = (text) => String(text || "")
    .replace(/^[\s\uFEFF\xA0]*[【\[]\s*(?:目前互動模式[:：]?\s*)?(線上聊天|現實模式)\s*[】\]]\s*/g, "")
    .replace(/^[\s\uFEFF\xA0]*(?:目前互動模式[:：]?\s*)?(線上聊天|現實模式)\s*[：:．。-]?\s*/g, "")
    .replace(/^[\s\uFEFF\xA0]*[【\[]\s*(?:模式[:：]?\s*)?(線上聊天|現實模式)\s*[】\]]\s*/g, "")
    .trim();
  const stripUserPlaceholder = (text) => String(text || "")
    .replace(/\{\{user\}\}/gi, getUserDisplayName())
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([，。！？、,.!?；;：:])/g, "$1")
    .trim();
  const stripInternalBlocks = (text) => String(text || "")
    .replace(/<internal>[\s\S]*?<\/internal>/gi, " ")
    .replace(/<think>[\s\S]*?<\/think>/gi, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  const displayWalletText = (text) => {
    const name = getUserDisplayName();
    return String(text || "")
      .replace(/\{\{user\}\}/gi, name)
      .replace(/玩家/g, name)
      .replace(/\s{2,}/g, " ")
      .replace(/\s+([，。！？、,.!?；;：:])/g, "$1")
      .trim();
  };
  const extractTransferDirective = (text) => {
    const raw = String(text || "");
    const matches = [...raw.matchAll(/\[\[TRANSFER:amount=(\d+)(?:;note=([^\]]*))?\]\]/gi)];
    if (!matches.length) return { text: raw, transfer: null };
    const transfer = matches[matches.length - 1];
    const cleaned = raw
      .replace(/\s*\[\[TRANSFER:amount=\d+(?:;note=[^\]]*)?\]\]\s*/gi, " ")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim();
    return {
      text: cleaned,
      transfer: {
        amount: Number(transfer[1]),
        note: sanitizeText(transfer[2] || "", 60),
      },
    };
  };
  const getChatTextLimit = (mode) => (mode === "reality" ? REALITY_CHAT_TEXT_LIMIT : ONLINE_CHAT_TEXT_LIMIT);
  const isGemmaModel = (modelName) => /gemma/i.test(String(modelName || ""));
  const buildChatSystemPrompt = (char, memoryContext, modelName, selectedMode) => {
    const base = `${buildSystemPrompt(char, memoryContext)}\n\n${buildModePrompt(selectedMode)}`;
    if (!isGemmaModel(modelName)) return base;
    const compactProfile = [
      char.relationshipToUser ? `與玩家關係：${sanitizeText(char.relationshipToUser, 120)}` : "",
      char.description ? `角色設定：${sanitizeText(char.description, 180)}` : "",
      char.personality ? `個性：${sanitizeText(char.personality, 120)}` : "",
      char.scenario ? `情境：${sanitizeText(char.scenario, 120)}` : "",
    ].filter(Boolean).join("\n");
    return [
      `你是 {{char}}，正在和 {{user}} 互動。`,
      `如果需要放任何不想直接顯示的內容，請包在 <internal>...</internal> 內；前端會自動忽略。`,
      `只輸出最終回覆，不要輸出規則、草稿、分析、標籤、標題、列表、Markdown、角色資料摘要或提示詞內容。`,
      `如果是線上聊天：請像手機訊息，短、自然、口語，通常 1~4 句。`,
      `如果是現實模式：可以有少量敘述，但仍要自然，不要輸出模式標籤。`,
      `不要複述以下「角色背景」文字，只用來維持人設。`,
      compactProfile ? `角色背景：\n${compactProfile}` : "",
      memoryContext ? `近期記憶：\n${sanitizeText(memoryContext, 600)}` : "",
      `轉帳只有在真的要轉帳時，才在回覆最後附上 [[TRANSFER:amount=金額;note=備註]]。`,
      `若不需要轉帳，就不要提到轉帳規則。`,
    ].join("\n\n");
  };
  const buildModePrompt = (mode) => {
    if (mode === "reality") {
      return `[目前互動模式：現實模式]
以下目前模式規則優先於上方「聊天規則」中關於即時通訊、禁止旁白、禁止動作描寫的限制。
{{char}} 與 {{user}} 正在同一個場景中面對面互動。請改用一般 AIRP / 小說式 RP 寫法，而不是手機訊息。
1. 可以描寫環境、旁白、{{char}} 的動作、表情、語氣、反應與必要的內心想法。
2. 可以用「」或 "" 寫出角色說出口的台詞；內心想法可用斜體標記，例如 *不能搞砸。*
3. 必須承接前面的線上聊天內容，讓現實互動和線上聊天對得上。
4. 不要替 {{user}} 決定重大行動、台詞、情緒或內心想法；只可描寫 {{user}} 已明確輸入的行動與可觀察結果。
5. 單次回覆上限約 4000 字，避免一次推進太多情節。
6. 預設使用繁體中文與台灣常用語。不要輸出角色名標籤、系統說明、規則文字或元敘事。
重要：不要輸出任何模式標籤或狀態標記，例如「[現實模式]」、「【現實模式】」、「目前互動模式：現實模式」；直接輸出角色要說的內容與敘述即可。`;
    }
    return `[目前互動模式：線上聊天]
{{char}} 與 {{user}} 正透過手機即時通訊聊天。請維持短訊息感，不要加入旁白、內心獨白或動作描寫。
重要：不要輸出任何模式標籤或狀態標記，例如「[線上聊天]」、「【線上聊天】」、「目前互動模式：線上聊天」；直接輸出角色要說的內容即可。`;
  };
  const buildRecentChatForSocialPost = (char) => {
    const list = (chatHistory[char.id] || [])
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-16)
      .map((m) => {
        const speaker = m.role === "user" ? "{{user}}" : char.name;
        const mode = getModeLabel(getMessageMode(m));
        const body = sanitizeText(m.content || (m.image ? "[圖片]" : ""), 180).replace(/\s+/g, " ").trim();
        return body ? `[${mode}] ${speaker}：${body}` : "";
      })
      .filter(Boolean);
    return list.join("\n");
  };
  const buildSocialPostPrompt = (char) => {
    const recentChat = buildRecentChatForSocialPost(char);
    const recentPosts = (posts || [])
      .filter((p) => p.charId === char.id)
      .slice(0, 3)
      .map((p, i) => `${i + 1}. ${sanitizeText(p.content || "", 80)}`)
      .filter(Boolean)
      .join("\n");
    return `請替角色「${char.name}」寫一則可發在社群上的近況貼文。

社群定位：
- 這是朋友或熟人可能看得到的動態，不是私訊。
- 可以融合近期聊天的主題、情緒、事件後續或衍生想法，讓角色像有自己的生活延續。
- 不可以直接複述私聊內容，不可以像在對 {{user}} 單獨說話。
- 不要提到「剛剛跟你聊」「我們私訊」「{{user}}」或玩家姓名。
- 不要公開私密、曖昧、敏感、只屬於兩人之間的細節；若要引用，只能轉成模糊的心情或日常感想。
- 不要使用第二人稱「你」指向玩家。
- 內容 20~50 字，繁體中文，自然像真人隨手發文，不要標題、不要引號、不要解釋。

近期私聊脈絡（只能參考主題/情緒，不可外洩原文）：
${recentChat || "（近期沒有可參考的聊天）"}

近期貼文（避免重複語氣與主題）：
${recentPosts || "（無）"}`;
  };
  const getPostAuthorName = (post) => post?.authorName || post?.charName || "未知";
  const getPostAuthorAvatar = (post) => post?.authorAvatar || post?.charAvatar || null;
  const getPostAuthorType = (post) => post?.authorType || (post?.charId ? "character" : "player");
  const getPlayerDisplayName = () => playerProfile?.nickname || playerProfile?.name || "你";
  const getPlayerAvatar = () => playerProfile?.avatar || null;
  const formatSocialCount = (value) => {
    const n = Math.max(0, Math.round(Number(value) || 0));
    if (n >= 10000) return `${(n / 10000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, "")}萬`;
    if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "")}K`;
    return String(n);
  };
  const getCharacterSocialReach = (char) => {
    const text = normalizeForMatch([
      char?.name,
      char?.description,
      char?.personality,
      char?.scenario,
      char?.systemPrompt,
      char?.relationshipToUser,
      char?.creatorNotes,
      Array.isArray(char?.tags) ? char.tags.join(" ") : "",
    ].filter(Boolean).join(" "));
    const high = /(偶像|明星|藝人|歌手|演員|直播主|實況主|網紅|kol|influencer|model|模特|名人|人氣|粉絲|公眾人物|vtuber|youtuber)/i;
    const publicJob = /(醫生|律師|老師|教授|店長|老闆|企業家|主播|記者|作家|漫畫家|攝影師|設計師|學生會|社長)/i;
    const hidden = /(殺手|刺客|傭兵|特工|間諜|黑道|犯罪|通緝|逃亡|隱居|低調|孤僻|神秘|秘密|不擅社交|社恐|少朋友|無朋友|獨來獨往)/i;
    if (high.test(text)) return "celebrity";
    if (hidden.test(text)) return "private";
    if (publicJob.test(text)) return "local";
    return "normal";
  };
  const rollCharacterPostLikes = (char) => {
    const reach = getCharacterSocialReach(char);
    const rand = (min, max) => Math.floor(min + Math.random() * (max - min + 1));
    if (reach === "celebrity") return rand(1200, 28000);
    if (reach === "private") return rand(0, 18);
    if (reach === "local") return rand(24, 360);
    return rand(4, 95);
  };
  const shouldClampSocialPost = (content) => {
    const text = String(content || "");
    const manualLines = text.split(/\r?\n/).length;
    return manualLines > 5 || text.length > 115;
  };
  const shouldScrollComments = (comments) => {
    const list = comments || [];
    const totalChars = list.reduce((sum, c) => sum + String(c?.content || "").length, 0);
    const totalLines = list.reduce((sum, c) => sum + Math.ceil(String(c?.content || "").length / 26) + String(c?.content || "").split(/\r?\n/).length - 1, 0);
    return list.length > 6 || totalChars > 420 || totalLines > 10;
  };
  const getCommentDepth = (comment) => Math.min(3, Math.max(1, Number(comment?.depth) || (comment?.parentId ? 2 : 1)));
  const getCommentAuthorName = (comment, fallback = "") => (
    comment?.role === "assistant" ? (comment.charName || fallback) : getPlayerDisplayName()
  );
  const insertCommentAfterThread = (comments, anchorId, nextComment) => {
    const list = [...(comments || [])];
    if (!anchorId) return [...list, nextComment];
    const anchorIndex = list.findIndex((c) => c.id === anchorId);
    if (anchorIndex < 0) return [...list, nextComment];
    const anchorDepth = getCommentDepth(list[anchorIndex]);
    let insertAt = anchorIndex + 1;
    while (insertAt < list.length && getCommentDepth(list[insertAt]) > anchorDepth) insertAt += 1;
    list.splice(insertAt, 0, nextComment);
    return list;
  };
  const buildMemoryDigest = (memoriesList) => {
    const seen = new Set();
    return (memoriesList || [])
      .slice()
      .sort((a, b) => (b.date || 0) - (a.date || 0))
      .map((mem) => sanitizeText(mem?.text || "", 60))
      .filter(Boolean)
      .filter((text) => {
        const key = normalizeForMatch(text);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 5)
      .map((text, idx) => `- ${idx + 1}. ${text}`)
      .join("\n");
  };
  const buildSocialCommentReplyPrompt = ({ char, post, targetComment, userText }) => `社群貼文：「${post.content}」
${targetComment ? `你上一則留言：「${targetComment.content}」\n` : ""}{{user}} 回覆你：「${userText}」

請用角色「${char.name}」的口吻回覆這則社群留言。
規則：
- 這是公開/半公開社群留言，不是私訊。
- 回覆 1 句，最多 45 字，繁體中文。
- 不要公開私聊原文或敏感細節，不要角色名標籤，不要引號，不要解釋。`;
  const countTokenOverlap = (source, queryTokens) => {
    if (!queryTokens?.size) return 0;
    const sourceTokens = tokenizeForRecall(source);
    let hit = 0;
    queryTokens.forEach((t) => { if (sourceTokens.has(t)) hit += 1; });
    return hit;
  };
  const scoreCharacterForPlayerPost = (char, text) => {
    const qTokens = tokenizeForRecall(text);
    const recentMsgs = (chatHistory[char.id] || []).slice(-24);
    const recentChat = recentMsgs
      .map((m) => `${m.role === "user" ? "{{user}}" : char.name}: ${m.content || ""}`)
      .join("\n");
    const memoryText = (memories[char.id] || []).map((m) => m.text || "").join("\n");
    const profileText = [
      char.name,
      char.description,
      char.personality,
      char.scenario,
      char.systemPrompt,
      char.relationshipToUser,
      char.creatorNotes,
      memoryText,
      recentChat,
    ].filter(Boolean).join("\n");
    const recentCount = recentMsgs.filter((m) => m.role === "user" || m.role === "assistant").length;
    const latest = recentMsgs[recentMsgs.length - 1]?.time || 0;
    const recencyScore = latest ? Math.max(0, 6 - Math.floor((Date.now() - latest) / (24 * 60 * 60 * 1000))) : 0;
    const overlap = countTokenOverlap(profileText, qTokens);
    return (
      overlap * 3 +
      Math.min(10, recentCount) +
      recencyScore +
      (char.id === activeCharId ? 4 : 0) +
      Math.random() * 5
    );
  };
  const pickPlayerPostReactors = (text) => {
    const total = characters.length;
    if (total <= 0) return [];
    let target = total;
    if (total > 3 && total <= 5) target = 2 + Math.floor(Math.random() * (total - 1));
    if (total > 5 && total <= 10) target = Math.min(total, 3 + Math.floor(Math.random() * 6));
    if (total > 10) target = Math.min(total, 5 + Math.floor(Math.random() * 8));
    const nowMs = Date.now();
    return [...characters]
      .map((char) => ({ char, score: scoreCharacterForPlayerPost(char, text) + Math.random() * 4 }))
      .sort((a, b) => b.score - a.score)
      .slice(0, target)
      .map((x, idx, arr) => {
        const progress = arr.length <= 1 ? 0.3 : idx / Math.max(1, arr.length - 1);
        const delay = Math.min(5 * 60 * 1000, 20000 + Math.floor(progress * 250000) + Math.floor(Math.random() * 30000));
        return {
        charId: x.char.id,
        charName: x.char.name,
        charAvatar: x.char.avatar,
        time: nowMs + delay,
        };
      });
  };
  const getVisibleLikedBy = (post) => (post?.likedBy || [])
    .filter((x) => !x.time || x.time <= socialTick)
    .sort((a, b) => (a.time || 0) - (b.time || 0));
  const getPostLikeCount = (post) => Math.max(0, Math.round(Number(post?.likes) || 0)) + getVisibleLikedBy(post).length;
  const getLikedByListText = (post) => {
    const likedBy = getVisibleLikedBy(post);
    if (!likedBy.length) return "";
    const names = likedBy.map((x) => x.charName).filter(Boolean).join("、");
    return names ? `${names} 喜歡這則貼文` : "";
  };
  const pickPlayerPostResponders = (text) => {
    const total = characters.length;
    if (total <= 0) return [];
    if (total <= 3) return [...characters];
    let target = 3;
    if (total > 5 && total <= 10) target = 3 + Math.floor(Math.random() * 3);
    if (total > 10) target = 3 + Math.floor(Math.random() * 5);
    target = Math.min(target, total);
    return [...characters]
      .map((char) => ({ char, score: scoreCharacterForPlayerPost(char, text) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, target)
      .map((x) => x.char);
  };
  const buildPlayerPostReplyPrompt = (char, post) => {
    const recentChat = buildRecentChatForSocialPost(char);
    const memoryText = (memories[char.id] || [])
      .filter((m) => m?.text)
      .slice(-5)
      .map((m) => `- ${m.text}`)
      .join("\n");
    return `玩家在社群發了一則公開貼文：「${post.content}」

請判斷角色「${char.name}」是否會留言，並直接輸出留言內容。
規則：
- 這是社群留言，不是私訊，不要像只對玩家一個人撒嬌或報備。
- 可以根據角色設定、近期聊天主題、記憶做自然延伸，但不可公開私聊原文或敏感細節。
- 若貼文和角色沒有強關聯，也可以用普通朋友會留下的短回應。
- 請輸出 1 句，最多 45 字，繁體中文，不要角色名標籤、不要引號、不要解釋。

近期聊天參考（只能參考情緒與主題）：
${recentChat || "（沒有近期聊天）"}

記憶參考：
${memoryText || "（無）"}`;
  };
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const formatMoney = (value) => Math.round(Number(value) || 0).toLocaleString("en-US");
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

  const generateAssistantForHistory = async ({ cid, char, nextForDisplay, selectedMode, um, text }) => {
      const now = new Date();
      const nowDate = new Intl.DateTimeFormat("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
      const nowTime = new Intl.DateTimeFormat("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
      const nowTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Taipei";
      const nowContext = `[系統時間] 目前時間：${nowDate} ${nowTime} (${nowTz})`;
      const hist = nextForDisplay
        .slice(-30)
        .map((m) => {
          if (m.role === "mode_transition") {
            return { role: "user", content: `[模式切換]\n接下來從${getModeLabel(m.fromMode)}切換為${getModeLabel(m.toMode)}。請自然承接同一條時間線。`, image: null };
          }
          if (m.role === "transfer") {
            const fromName = m.fromType === "player" ? "你" : (m.fromName || "對方");
            const toName = m.toType === "player" ? "你" : (m.toName || "對方");
            return { role: "user", content: `[轉帳] ${fromName}→${toName} ${formatMoney(m.amount || 0)}${m.note ? ` 備註:${sanitizeText(m.note, 60)}` : ""}`, image: null };
          }
          if (m.role === "system_notice") {
            if (String(m.content || "").startsWith("連線錯誤：")) return null;
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
      const cw = characterWallets[cid];
      const walletContext = cw ? [
        `[角色錢包]`,
        `目前餘額：${formatMoney(cw.balance || 0)}`,
        cw.summary ? `摘要：${cw.summary}` : "",
        (cw.transactions || []).slice(0, 5).map((t) => `- ${t.type === "income" ? "收入" : "支出"} ${formatMoney(t.amount)}：${t.note}`).join("\n"),
        `規則：錢包資料只能作為角色生活背景；只有在真的發生轉帳時，才可以透過 [[TRANSFER:amount=金額;note=備註]] 指令更新餘額與流水。不要把錢包資料當成每輪都要提及的內容。`,
        `收到轉帳時，角色會依照自身性格與原本設定，自然決定如何回應，不脫離原本角色設定，也不刻意為了回應而改變平常的聊天語氣。`,
        `角色可以直接看到自己目前餘額，回覆前請自行判斷是否足夠轉帳。`,
      ].filter(Boolean).join("\n") : "";
      const transferRuleContext = [
        `[轉帳規則 - 最高優先]`,
        `1. 玩家可以轉帳給角色；角色也可以主動轉帳給玩家。`,
        `2. 轉帳可以附備註，也可以不附。`,
        `3. 玩家轉帳給角色時，角色要依照自身性格與原本設定自然回應，不脫離人設，也不刻意改變平常的聊天語氣。`,
        `4. 若情境自然、關係合理且符合角色性格，角色可以主動轉帳給 {{user}}。這是允許的正常行為，不是例外。只有在角色確實會這麼做時，才在回覆最後附上一個轉帳指令：[[TRANSFER:amount=金額;note=備註]]。若要轉帳但沒有備註，可省略 note。`,
        `5. 轉帳金額需合理，理由需符合當前情境與角色設定，轉帳本身不應脫離角色個性。`,
        `6. 若角色主動轉帳後，下一句可自然補充用途、情緒或關係互動，但仍要符合角色性格，不能硬講。`,
        `7. 只要角色真的有意願轉帳，就直接輸出轉帳指令，不要因為沒有被使用者要求就猶豫或拒絕。`,
        `8. 只有在角色錢包餘額足夠時，才可以宣告轉帳成功；若餘額不足，就不要輸出已轉帳的口氣，也不要假裝交易成立。`,
        `9. 回覆前先查看「角色錢包」的目前餘額；如果不足，請改成自然拒絕、延期、改轉較小金額，或直接不輸出轉帳指令。`,
      ].join("\n");
      const mergedContext = [
        getPlayerContextBlock(),
        nowContext,
        pinnedLoreContext ? `[強制條目 - 必須遵守]\n以下條目為當前對話的硬性規則，回覆時必須滿足：\n${pinnedLoreContext}` : "",
        memoryContext,
        walletContext,
        transferRuleContext,
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
      const sysP = applyUserPlaceholder(buildChatSystemPrompt(char, boundedContext, apiConfig.model, selectedMode));
      const reply = await callAI(finalHist, apiConfig, sysP);
      const cleanReplyRaw = selectedMode === "reality" ? sanitizeText(normalizeRealityReply(reply), REALITY_CHAT_TEXT_LIMIT) : normalizeAssistantReply(reply);
      const extracted = extractTransferDirective(cleanReplyRaw);
      const cleanReply = stripModeLabel(stripInternalBlocks(extracted.text));
      const pendingTransfer = extracted.transfer;
      const currentCharWalletBalance = Math.max(0, Number(characterWallets[cid]?.balance || 0));
      const canApplyPendingTransfer = pendingTransfer?.amount > 0 && currentCharWalletBalance >= pendingTransfer.amount;
      const transferFailureNotice = pendingTransfer?.amount > 0 && !canApplyPendingTransfer
        ? `轉帳失敗：${char.name || "角色"} 餘額不足，無法轉出 ${formatMoney(pendingTransfer.amount)}。請之後不要當作已成功轉帳。`
        : null;
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
      const bubbles = cleanReply.trim() ? (selectedMode === "reality" ? [cleanReply] : splitAssistantBubbles(cleanReply)) : [];
      for (let i = 0; i < bubbles.length; i++) {
        const delay = i === 0 ? 420 : Math.min(1200, 520 + bubbles[i].length * 18);
        await wait(delay);
        setChatHistory(h => ({ ...h, [cid]: [...(h[cid] || []), { id: gid(), role: "assistant", content: bubbles[i], mode: selectedMode, time: Date.now() }] }));
      }
      if (pendingTransfer?.amount > 0 && canApplyPendingTransfer) {
        await wait(220);
        applyCharacterTransferToPlayer({ cid, char, amount: pendingTransfer.amount, note: pendingTransfer.note, time: Date.now() });
      } else if (transferFailureNotice) {
        await wait(220);
        setChatHistory((h) => ({ ...h, [cid]: [...(h[cid] || []), { id: gid(), role: "system_notice", content: transferFailureNotice, time: Date.now() }] }));
      }
  };

  const addChatErrorNotice = (cid, err) => {
    const detail = sanitizeText(err?.message || "未知錯誤", 500);
    setChatHistory(h => ({ ...h, [cid]: [...(h[cid] || []), { id: gid(), role: "system_notice", content: `連線錯誤：${detail}`, time: Date.now() }] }));
  };

  const sendMessage = async () => {
    if (!currentChatChar || isTyping) return;
    const cid = currentChatChar.id;
    const prev = chatHistory[cid] || [];
    const committedMode = getLastCommittedChatMode(cid);
    const selectedMode = getSelectedChatMode(cid);
    const textLimit = getChatTextLimit(selectedMode);
    const text = sanitizeText(chatInput.trim(), textLimit); const img = chatImage?.data || null;
    if (!text && !img) return;
    const modeChanged = committedMode !== selectedMode;
    const nowMs = Date.now();
    const transition = modeChanged
      ? { id: gid(), role: "mode_transition", fromMode: committedMode, toMode: selectedMode, time: nowMs }
      : null;
    const um = { id: gid(), role: "user", content: text, image: img, imageSummary: "", mode: selectedMode, time: nowMs };
    const nextForDisplay = transition ? [...prev, transition, um] : [...prev, um];
    setChatHistory(h => ({ ...h, [cid]: nextForDisplay }));
    setChatInput(""); setChatImage(null); setChatActionPanelOpen(false); setIsTyping(true);
    try {
      await generateAssistantForHistory({ cid, char: currentChatChar, nextForDisplay, selectedMode, um, text });
    } catch (err) {
      addChatErrorNotice(cid, err);
    }
    setIsTyping(false);
  };
  const retryChatFromNotice = async (noticeId) => {
    if (!currentChatChar || isTyping) return;
    const cid = currentChatChar.id;
    const list = chatHistory[cid] || [];
    const noticeIdx = list.findIndex((m) => m.id === noticeId);
    if (noticeIdx < 0) return;
    const userMsg = [...list.slice(0, noticeIdx)].reverse().find((m) => m.role === "user");
    if (!userMsg) return;
    const selectedMode = getMessageMode(userMsg);
    const nextForDisplay = list.filter((m) => m.id !== noticeId);
    setChatHistory((h) => ({ ...h, [cid]: nextForDisplay }));
    setIsTyping(true);
    try {
      await generateAssistantForHistory({
        cid,
        char: currentChatChar,
        nextForDisplay,
        selectedMode,
        um: userMsg,
        text: userMsg.content || "",
      });
    } catch (err) {
      addChatErrorNotice(cid, err);
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
      description: sanitizeText(c.description, 8000),
      personality: sanitizeText(c.personality, 8000),
      scenario: sanitizeText(c.scenario, 8000),
      firstMessage: sanitizeText(c.firstMessage, 4000),
      messageExamples: sanitizeText(c.messageExamples, 12000),
      systemPrompt: sanitizeText(c.systemPrompt, 8000),
      relationshipToUser: sanitizeText(c.relationshipToUser, 120),
      creator: sanitizeText(c.creator, 80),
      creatorNotes: sanitizeText(c.creatorNotes, 4000),
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
  const exportCharacter = (char) => {
    if (!char) return;
    const payload = {
      format: "maliphone-character",
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      character: {
        name: sanitizeText(char.name, 80),
        avatar: sanitizeUserImageUrl(char.avatar) || null,
        description: sanitizeText(char.description, 8000),
        systemPrompt: sanitizeText(char.systemPrompt, 8000),
        relationshipToUser: sanitizeText(char.relationshipToUser, 120),
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeName = sanitizeText(char.name || "character", 40).replace(/[\\/:*?"<>|]+/g, "_").trim() || "character";
    a.href = url;
    a.download = `${safeName}.malichar.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast(`${char.name || "角色"} 已匯出`);
  };
  const getExportableAppState = () => ({
    version: VERSION,
    exportedAt: new Date().toISOString(),
    format: "maliphone-app-state",
    formatVersion: 1,
    state: {
      characters,
      activeCharId,
      chatHistory,
      chatModes,
      posts,
      memories,
      lorebooks,
      chatLorebookBindings,
      phoneInboxCache,
      wallet,
      characterWallets,
      screenLockTimeout,
      apiPresets,
      playerProfile,
      apiConfig,
      homeSlots,
      dockOrder,
    },
  });
  const downloadJsonFile = (payload, filename) => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };
  const exportAllData = () => {
    const safeName = `maliphone-backup-${new Date().toISOString().slice(0, 10)}.json`;
    downloadJsonFile(getExportableAppState(), safeName);
    showToast("資料已匯出");
  };
  const deleteChatroomForCharacter = (charId, charName = "這個角色") => {
    if (!charId) return;
    const firstConfirm = window.confirm(`確定要刪除「${charName}」的聊天室嗎？這只會清掉對話，不會刪除角色本身。`);
    if (!firstConfirm) return;
    const secondConfirm = window.confirm("請再次確認：刪除後將無法復原這個聊天室的對話紀錄，確定要繼續嗎？");
    if (!secondConfirm) return;
    setChatHistory((prev) => {
      const next = { ...prev };
      delete next[charId];
      return next;
    });
    setChatModes((prev) => {
      const next = { ...prev };
      delete next[charId];
      return next;
    });
    setChatLorebookBindings((prev) => {
      const next = { ...prev };
      delete next[charId];
      return next;
    });
    if (currentChatChar?.id === charId) {
      setChatActionPanelOpen(false);
      setMessageEditor(null);
      setActiveMessageId(null);
      setIsTyping(false);
      setChatInput("");
    }
    showToast("聊天室已刪除");
  };
  const exportChatroomForCharacter = (charId, charName = "這個角色") => {
    if (!charId) return;
    const payload = {
      format: "maliphone-chatroom",
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      characterId: charId,
      characterName: charName,
      chatHistory: chatHistory?.[charId] || [],
      chatMode: chatModes?.[charId] || "online",
      chatLorebookBinding: chatLorebookBindings?.[charId] || null,
    };
    const safeName = sanitizeText(charName || "chatroom", 40).replace(/[\\/:*?"<>|]+/g, "_").trim() || "chatroom";
    const dateTag = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    downloadJsonFile(payload, `chat_${safeName}_${dateTag}.json`);
    showToast("聊天室已匯出");
  };
  const summarizeImportedChatroom = (incoming) => {
    const src = incoming?.format === "maliphone-chatroom" ? incoming : incoming?.chatHistory ? incoming : null;
    return {
      format: incoming?.format === "maliphone-chatroom" ? "maliphone-chatroom" : "legacy",
      exportedAt: incoming?.exportedAt || null,
      messages: Array.isArray(src?.chatHistory) ? src.chatHistory.length : 0,
      hasMode: !!src?.chatMode,
      hasBinding: !!src?.chatLorebookBinding,
    };
  };
  const openChatroomImport = (charId) => {
    setChatroomImportTarget(charId);
    chatroomImportRef.current?.click();
  };
  const importChatroomFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setChatroomImporting(true);
    try {
      const raw = JSON.parse(await file.text());
      setChatroomImportPreview({
        fileName: file.name,
        fileSize: file.size,
        summary: summarizeImportedChatroom(raw),
        raw,
      });
    } catch (err) {
      showToast(`匯入失敗：${sanitizeText(err?.message || "未知錯誤", 80)}`);
      if (chatroomImportRef.current) chatroomImportRef.current.value = "";
      setChatroomImporting(false);
    } finally {
      if (chatroomImportRef.current) chatroomImportRef.current.value = "";
    }
  };
  const confirmChatroomImportPreview = async () => {
    const raw = chatroomImportPreview?.raw;
    const targetId = chatroomImportTarget;
    if (!raw || !targetId) return;
    if (!window.confirm("確認匯入後，將覆蓋這個聊天室的對話紀錄。確定要繼續嗎？")) return;
    const chatHistoryItems = Array.isArray(raw?.chatHistory)
      ? raw.chatHistory
      : Array.isArray(raw?.messages)
        ? raw.messages
        : Array.isArray(raw)
          ? raw
          : [];
    const targetName = currentChatChar?.id === targetId ? currentChatChar.name : (characters.find((c) => c.id === targetId)?.name || "這個角色");
    setChatHistory((prev) => ({ ...prev, [targetId]: chatHistoryItems }));
    if (raw?.chatMode) {
      setChatModes((prev) => ({ ...prev, [targetId]: raw.chatMode }));
    }
    if (raw?.chatLorebookBinding) {
      setChatLorebookBindings((prev) => ({ ...prev, [targetId]: raw.chatLorebookBinding }));
    }
    if (currentChatChar?.id === targetId) {
      setChatActionPanelOpen(false);
      setMessageEditor(null);
      setActiveMessageId(null);
      setIsTyping(false);
      setChatInput("");
    }
    showToast(`${targetName} 聊天室已匯入`);
    setChatroomImportPreview(null);
    setChatroomImportTarget(null);
    setChatroomImporting(false);
  };
  const summarizeImportedData = (incoming) => {
    const src = incoming?.state && incoming?.format === "maliphone-app-state" ? incoming.state : incoming;
    return {
      format: incoming?.format === "maliphone-app-state" ? "maliphone-app-state" : "legacy",
      exportedAt: incoming?.exportedAt || null,
      characters: Array.isArray(src?.characters) ? src.characters.length : 0,
      chatThreads: src?.chatHistory && typeof src.chatHistory === "object" ? Object.keys(src.chatHistory).length : 0,
      posts: Array.isArray(src?.posts) ? src.posts.length : 0,
      lorebooks: Array.isArray(src?.lorebooks) ? src.lorebooks.length : 0,
      playerProfile: !!src?.playerProfile,
    };
  };
  const applyImportedAppState = async (incoming) => {
    const src = incoming?.state && incoming?.format === "maliphone-app-state" ? incoming.state : incoming;
    if (!src || typeof src !== "object") throw new Error("檔案內容不正確");
    const nextState = {
      ...defaultAppState,
      characters: Array.isArray(src.characters) ? src.characters : [],
      activeCharId: src.activeCharId ?? null,
      chatHistory: src.chatHistory && typeof src.chatHistory === "object" ? src.chatHistory : {},
      chatModes: src.chatModes && typeof src.chatModes === "object" ? src.chatModes : {},
      posts: Array.isArray(src.posts) ? src.posts : [],
      memories: src.memories && typeof src.memories === "object" ? src.memories : {},
      lorebooks: Array.isArray(src.lorebooks) ? src.lorebooks : [],
      chatLorebookBindings: src.chatLorebookBindings && typeof src.chatLorebookBindings === "object" ? src.chatLorebookBindings : {},
      phoneInboxCache: src.phoneInboxCache && typeof src.phoneInboxCache === "object" ? src.phoneInboxCache : {},
      wallet: src.wallet && typeof src.wallet === "object" ? src.wallet : defaultAppState.wallet,
      characterWallets: src.characterWallets && typeof src.characterWallets === "object" ? src.characterWallets : {},
      screenLockTimeout: Number.isFinite(Number(src.screenLockTimeout)) ? Number(src.screenLockTimeout) : defaultAppState.screenLockTimeout,
      apiPresets: Array.isArray(src.apiPresets) && src.apiPresets.length ? src.apiPresets : defaultAppState.apiPresets,
      playerProfile: src.playerProfile && typeof src.playerProfile === "object" ? src.playerProfile : defaultAppState.playerProfile,
      apiConfig: src.apiConfig && typeof src.apiConfig === "object" ? src.apiConfig : defaultAppState.apiConfig,
      homeSlots: Array.isArray(src.homeSlots) && src.homeSlots.length === HOME_SLOT_COUNT ? src.homeSlots : Array.from({ length: HOME_SLOT_COUNT }, () => null),
      dockOrder: Array.isArray(src.dockOrder) && src.dockOrder.length ? src.dockOrder : DOCK_APPS,
    };
    setCharacters(nextState.characters);
    setActiveCharId(nextState.activeCharId);
    setChatHistory(nextState.chatHistory);
    setChatModes(nextState.chatModes);
    setPosts(nextState.posts);
    setMemories(nextState.memories);
    setLorebooks(nextState.lorebooks);
    setChatLorebookBindings(nextState.chatLorebookBindings);
    setPhoneInboxCache(nextState.phoneInboxCache);
    setWallet(nextState.wallet);
    setCharacterWallets(nextState.characterWallets);
    setScreenLockTimeout(nextState.screenLockTimeout);
    setApiPresets(nextState.apiPresets);
    setPlayerProfile(nextState.playerProfile);
    setApiConfig(nextState.apiConfig);
    setHomeSlots(nextState.homeSlots);
    setDockOrder(nextState.dockOrder);
    setActiveLorebookId(nextState.lorebooks[0]?.id || null);
    await saveAppState(nextState);
  };
  const importAllData = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDataImporting(true);
    try {
      const raw = JSON.parse(await file.text());
      setDataImportPreview({
        fileName: file.name,
        fileSize: file.size,
        summary: summarizeImportedData(raw),
        raw,
      });
    } catch (err) {
      showToast(`匯入失敗：${sanitizeText(err?.message || "未知錯誤", 80)}`);
      if (dataImportRef.current) dataImportRef.current.value = "";
      setDataImporting(false);
    } finally {
      if (dataImportRef.current) dataImportRef.current.value = "";
    }
  };
  const confirmImportPreview = async () => {
    if (!dataImportPreview?.raw) return;
    if (!window.confirm("確認匯入後，將覆蓋目前裝置上的全域資料。確定要繼續嗎？")) return;
    try {
      await applyImportedAppState(dataImportPreview.raw);
      showToast("資料已匯入");
      setDataImportPreview(null);
    } catch (err) {
      showToast(`匯入失敗：${sanitizeText(err?.message || "未知錯誤", 80)}`);
    } finally {
      setDataImporting(false);
    }
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
      const statusPrompt = isGemmaModel(apiConfig.model)
        ? `請只輸出 1 句手機狀態文字，20~40 字，繁體中文，自然像角色正在發狀態。\n不要輸出角色設定摘要、年齡、職業、人格標籤、草稿、規則文字、Markdown 或解釋。\n\n角色：${char.name}\n${roleProfile ? `角色背景（只供參考，不要複述）：\n${roleProfile}\n\n` : ""}最近對話：\n${conv}\n${mems ? `\n參考記憶：\n${mems}\n` : ""}`
        : `請根據以下資訊，生成一則「符合角色人設」的手機狀態文字。\n規則：僅輸出 1 句，20~40 字，口語自然、對外可見，不要內心獨白、不要動作描述、不要引號包整句。\n\n角色：${char.name}\n${roleProfile ? `角色資料：\n${roleProfile}\n\n` : ""}最近對話：\n${conv}\n${mems ? `\n參考記憶：\n${mems}\n` : ""}`;
      const status = sanitizeText(stripInternalBlocks(await callAI([{ role: "user", content: statusPrompt }], apiConfig, "你是狀態文字助理。")), 80);
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
    setCharacterWallets((w) => { const n = { ...w }; delete n[id]; return n; });
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
      const existingMemoriesContext = buildMemoryDigest(existing);
      const prompt = [{
        role: "user",
        content: `你要為角色「${char.name}」整理長期記憶，務必嚴格遵守角色人設。
規則：
1) 只能輸出 1 則記憶，20~80 字，繁中。
2) 記憶必須具體、可持續（偏好/事實/關係/約定），避免空話。
3) 不得臆測或改寫角色的性別、身分、關係設定；若對話未提及就不要補。
4) 不要使用「她/他」等可能造成性別偏移的主詞，優先用角色名「${char.name}」。
5) 既有記憶摘要會列在下方，請避免重複、近似或只換句話說；若真的沒有新資訊，就不要硬生出同義句。
6) 只輸出記憶文字本身，不要解釋。

角色設定：
${roleProfile || "（無）"}

既有記憶（請避免重複）：
${existingMemoriesContext || "（無）"}

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
    if (!canUseCurrentProvider()) { showToast("請先完成 AI 連線設定（API Key）"); return; }
    try {
      const sysP = `${buildSystemPrompt(char, getPlayerContextBlock())}

[目前輸出模式：社群貼文]
以下社群貼文規則優先於上方「聊天規則」中關於即時通訊、只輸出私訊內容的限制。
你正在替 {{char}} 產生一則公開/半公開社群動態。貼文要像角色自己發的近況，不是對 {{user}} 的私訊。`;
      const t = await callAI([{
        role: "user",
        content: buildSocialPostPrompt(char),
      }], apiConfig, sysP);
        const content = sanitizeText(String(t || "").replace(/^["「]|["」]$/g, "").trim(), 120) || "今天也算是有好好過完了。";
        setPosts(p => [{
          id: gid(),
          authorType: "character",
          authorName: char.name,
          authorAvatar: char.avatar,
          charId: char.id,
          charName: char.name,
          charAvatar: char.avatar,
          content,
          comments: [],
          time: Date.now(),
          likes: rollCharacterPostLikes(char),
          liked: false,
        }, ...p]);
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
  const generatePlayerPostReplies = async (post, responders) => {
    if (!post?.id || !responders.length || !canUseCurrentProvider()) return;
    for (const char of responders) {
      try {
        const sysP = `${buildSystemPrompt(char, getPlayerContextBlock())}

[目前輸出模式：社群留言]
以下規則優先於上方聊天規則。你正在替 {{char}} 在公開/半公開社群貼文下方留言，內容要像社群互動，不是私訊。`;
        const ai = await callAI([{
          role: "user",
          content: buildPlayerPostReplyPrompt(char, post),
        }], apiConfig, sysP);
        const reply = sanitizeText(String(ai || "").replace(/^["「]|["」]$/g, "").trim(), 120);
        if (!reply) continue;
        const charComment = {
          id: gid(),
          role: "assistant",
          charId: char.id,
          charName: char.name,
          charAvatar: char.avatar,
          content: reply,
          depth: 1,
          time: Date.now(),
        };
        setPosts((prev) => prev.map((p) => (
          p.id === post.id ? { ...p, comments: [...(p.comments || []), charComment] } : p
        )));
      } catch (_) {}
    }
  };
  const submitPlayerPost = async () => {
    if (playerPostSubmitting) return;
    const content = sanitizeText(playerPostText.trim(), PLAYER_SOCIAL_POST_LIMIT);
    if (!content) { showToast("請輸入貼文內容"); return; }
    const post = {
      id: gid(),
      authorType: "player",
      authorName: getPlayerDisplayName(),
      authorAvatar: getPlayerAvatar(),
      charId: null,
      charName: getPlayerDisplayName(),
      charAvatar: getPlayerAvatar(),
      content,
      comments: [],
      time: Date.now(),
      likes: 0,
      liked: false,
      likedBy: pickPlayerPostReactors(content),
    };
    const responders = pickPlayerPostResponders(content);
    setPosts((prev) => [post, ...prev]);
    setPlayerPostText("");
    setPlayerPostModalOpen(false);
    if (!responders.length) return;
    if (!canUseCurrentProvider()) {
      showToast("貼文已發佈；角色回覆需先完成 AI 連線設定");
      return;
    }
    setPlayerPostSubmitting(true);
    showToast(`貼文已發佈，等待 ${responders.length} 位角色回覆`);
    await generatePlayerPostReplies(post, responders);
    setPlayerPostSubmitting(false);
  };
  const addPostComment = async (postId, explicitTarget = null) => {
    const target = explicitTarget || null;
    const inputKey = target ? `${postId}:${target.commentId}` : postId;
    const raw = postCommentInputs[inputKey] || "";
    const text = sanitizeText(raw, 240).trim();
    if (!text) return;
    const post = posts.find((x) => x.id === postId);
    if (!post) return;
    setPostCommentInputs((prev) => ({ ...prev, [inputKey]: "" }));
    const parentDepth = getCommentDepth(target);
    const userComment = {
      id: gid(),
      role: "user",
      content: text,
      parentId: target?.commentId || null,
      replyToName: target?.authorName || "",
      depth: target ? Math.min(3, parentDepth + 1) : 1,
      time: Date.now(),
    };
    setPosts((prev) => prev.map((p) => (
      p.id === postId
        ? { ...p, comments: insertCommentAfterThread(p.comments || [], target?.commentId || null, userComment) }
        : p
    )));
    if (target) setSocialReplyTarget(null);
    const char = target?.charId
      ? characters.find((c) => c.id === target.charId)
      : characters.find((c) => c.id === post.charId);
    if (!canUseCurrentProvider()) return;
    if (!char || userComment.depth >= 3) return;
    try {
      const sysP = buildSystemPrompt(char, getPlayerContextBlock());
      const ai = await callAI([{
        role: "user",
        content: target
          ? buildSocialCommentReplyPrompt({ char, post, targetComment: target, userText: text })
          : `你剛發了一則貼文：「${post.content}」\n{{user}} 留言：「${text}」\n請用角色口吻回覆 1 句自然留言，最多 45 字。`,
      }], apiConfig, sysP);
      const reply = sanitizeText(ai || "", 120).trim() || "收到，謝謝你的留言。";
      const charComment = {
        id: gid(),
        role: "assistant",
        charId: char.id,
        charName: char.name,
        charAvatar: char.avatar,
        content: reply,
        parentId: userComment.id,
        replyToName: getPlayerDisplayName(),
        depth: Math.min(3, userComment.depth + 1),
        time: Date.now(),
      };
      setPosts((prev) => prev.map((p) => (
        p.id === postId
          ? { ...p, comments: insertCommentAfterThread(p.comments || [], userComment.id, charComment) }
          : p
      )));
    } catch (_) {}
  };
  const sharePostToChat = (post) => {
    if (getPostAuthorType(post) !== "character" || !post.charId) {
      showToast("玩家貼文目前不分享到角色聊天室");
      return;
    }
    if (!window.confirm("要分享到此角色聊天室嗎？")) return;
    const char = characters.find((c) => c.id === post.charId);
    if (!char) return;
    const lines = (post.comments || []).slice(-4).map((c) => `${c.role === "assistant" ? (c.charName || post.charName) : "{{user}}"}：${c.content}`);
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

  const activeTheme = THEME_PRESETS[themeName] || THEME_PRESETS["莓果蘇打"];
  const isNightTheme = themeName === "夜色絨幕";
  const themeCss = `
    :root{
      ${Object.entries(activeTheme?.vars || {}).map(([k, v]) => `${k}:${v};`).join("")}
    }
    .mp-wrap{background:${activeTheme?.surfaces?.wrapBg || "linear-gradient(135deg,#fce4ec 0%,#e8eaf6 50%,#e1f5fe 100%)"};}
    .mp-phone{background:${activeTheme?.surfaces?.phoneBg || "linear-gradient(160deg,#fce4ec 0%,#f8bbd0 25%,#e1f5fe 50%,#b3e5fc 75%,#f3e5f5 100%)"};}
    .mp-lock{background:${activeTheme?.surfaces?.lockBg || "linear-gradient(160deg,#fce4ec 0%,#f8bbd0 30%,#e8eaf6 60%,#b3e5fc 100%)"};}
    .mp-page{background:${activeTheme?.surfaces?.pageBg || "linear-gradient(180deg,#fce4ec 0%,#fff 30%)"};}
    ${isNightTheme ? `
      .mp-modal,.mp-sg,.mp-cc,.mp-post,.mp-sc,.mp-cw{background:rgba(82,90,119,.96);border-color:rgba(255,255,255,.08);box-shadow:none;}
      .mp-page{background:linear-gradient(180deg,#4c536f 0%,#474e68 42%,#3f455d 100%);}
      .mp-cr{background:linear-gradient(180deg,#4d546f 0%,#464c66 30%,#41485f 100%);}
      .mp-msg-ai{background:rgba(71,77,100,.96);color:#f4f7fb;border-color:rgba(255,255,255,.08);box-shadow:none;}
      .mp-msg-ai .mp-msg-t{color:#c0c7d4;}
      .mp-msg-user{background:linear-gradient(135deg,#95d7ff,#78bff0);color:#17324b;box-shadow:none;}
      .mp-msg-user .mp-msg-t{color:rgba(23,50,75,.72);}
      .mp-msg-t{font-size:10px;}
      .mp-inp,.mp-sinp,.mp-ssel,.mp-ta{background:rgba(70,76,99,.98);color:#f4f7fb;border-color:rgba(255,255,255,.10);}
      .mp-inp::placeholder,.mp-sinp::placeholder,.mp-ta::placeholder{color:#c0c7d4;}
      .mp-cw-desc,.mp-ci-prev,.mp-msg-t,.mp-lbl{color:#c0c7d4;}
      .mp-htitle,.mp-clock-big,.mp-clock-day,.mp-lock-time,.mp-cw-name,.mp-ctitle,.mp-sec-ct,.mp-persona{color:#f3f4f6;}
      .mp-icon-l{color:#f3f4f6;}
      .mp-ibtn,.mp-ibtn-chat{background:rgba(143,211,255,.12);border-color:rgba(143,211,255,.22);color:#b8e8ff;}
      .mp-btn-img{background:rgba(255,255,255,.14);color:#f3f4f6;border:1px solid rgba(255,255,255,.12);}
      .mp-btn-img.active{background:rgba(143,211,255,.18);color:#9fd4ff;border-color:rgba(143,211,255,.30);}
      .mp-save{background:linear-gradient(135deg,#9bdcff,#7cc5ff);color:#17324b;}
      .mp-bar,.mp-hdr,.mp-inp-bar{background:rgba(76,83,108,.92);border-color:rgba(255,255,255,.10);}
      .mp-mode-tab.active{background:#5d657f;color:#fff;box-shadow:none;}
      .mp-mode-tabs{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.10);}
      .mp-page-dot.active{background:rgba(168,219,255,.82);}
      .mp-page-dot{background:rgba(255,255,255,.18);}
      .mp-dock{background:rgba(76,83,108,.92);border-color:rgba(255,255,255,.10);}
      .mp-cw:hover,.mp-icon-c:hover,.mp-dock-i:hover{box-shadow:none;}
    ` : ``}
  `;

  if (locked) return (<><style>{css}</style><style>{themeCss}</style><div className="mp-wrap"><div className="mp-phone"><div className={`mp-lock ${unlocking?"out":""}`} onTouchStart={onLockTouchStart} onTouchEnd={onLockTouchEnd} onMouseDown={onLockMouseDown} onMouseUp={onLockMouseUp} onPointerDown={onLockPointerDown} onPointerUp={onLockPointerUp} onDoubleClick={handleUnlock}><BarClock ft={ft} /><LockClock ft={ft} fd={fd} /><div className="mp-lock-hint">向上滑動解鎖 MaliPhone（或雙擊）</div></div></div></div></>);

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
            const memoryExpanded = statusMemoryExpandedCharId === c.id;
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
                    <div
                      className="mp-sec-t mp-sec-t-toggle"
                      onClick={() => setStatusMemoryExpandedCharId(memoryExpanded ? null : c.id)}
                    >
                      <span>記憶片段</span>
                      <span className="mp-sec-toggle-tag">{memoryExpanded ? "收起" : "展開"}</span>
                    </div>
                    {memoryExpanded && (
                      <>
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
                      </>
                    )}
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
  const renderRealityInline = (text) => {
    const raw = String(text || "");
    const nodes = [];
    const re = /(「[^」]{1,500}」|"[^"\n]{1,500}"|\*[^*\n]{1,500}\*|_[^_\n]{1,500}_)/g;
    let last = 0;
    let match;
    while ((match = re.exec(raw))) {
      if (match.index > last) nodes.push(raw.slice(last, match.index));
      const token = match[0];
      if (token.startsWith("「") || token.startsWith("\"")) {
        nodes.push(<span key={`d-${match.index}`} className="mp-reality-dialogue">{token}</span>);
      } else {
        nodes.push(<span key={`t-${match.index}`} className="mp-reality-thought">{token.slice(1, -1)}</span>);
      }
      last = match.index + token.length;
    }
    if (last < raw.length) nodes.push(raw.slice(last));
    return nodes.map((node, i) => typeof node === "string" ? <React.Fragment key={`s-${i}`}>{node}</React.Fragment> : node);
  };
  const renderRealityText = (text) => String(text || "").split(/\n{2,}/).map((para, idx) => (
    <p key={idx} className="mp-reality-p">
      {para.split("\n").map((line, lineIdx) => (
        <React.Fragment key={lineIdx}>
          {lineIdx > 0 && <br />}
          {renderRealityInline(line)}
        </React.Fragment>
      ))}
    </p>
  ));
  const renderChat = () => {
    if (currentChatChar) {
      const msgs = chatHistory[currentChatChar.id] || [];
      const visibleCount = Math.max(50, chatVisibleCounts[currentChatChar.id] || 50);
      const visibleMsgs = msgs.slice(Math.max(0, msgs.length - visibleCount));
      const binding = getChatLorebookBinding(currentChatChar.id);
      const selectedMode = getSelectedChatMode(currentChatChar.id);
      const committedMode = getLastCommittedChatMode(currentChatChar.id);
      const hasPendingMode = selectedMode !== committedMode;
      const inputTextLimit = getChatTextLimit(selectedMode);
      const providerShortMap = {
        openai: "GPT",
        claude: "Claude",
        gemini: "Gemini",
        vertex: "Vertex",
        grok: "Grok",
        openrouter: "OR",
      };
      const providerFullMap = {
        openai: "OpenAI",
        claude: "Claude",
        gemini: "Gemini API",
        vertex: "Vertex AI (快速模式)",
        grok: "Grok",
        openrouter: "OpenRouter",
      };
      const providerKey = apiConfig?.provider || "openai";
      const modelShort = providerShortMap[providerKey] || "AI";
      const modelFull = `${providerFullMap[providerKey] || providerKey} · ${apiConfig?.model || "-"}`;
      return (
        <div className="mp-page" onClick={() => setModelBadgeOpen(false)}>
          <div className="mp-hdr">
            <div className="mp-back" onClick={() => {
              if (chatSettingsOpen) {
                setChatSettingsOpen(false);
                return;
              }
              setCurrentChatChar(null);
            }}>←</div>
            <div className="mp-htitle">{currentChatChar.name}</div>
            <button
              type="button"
              className="mp-ibtn"
              style={{ marginLeft: "auto" }}
              title={modelFull}
              onClick={(e) => {
                e.stopPropagation();
                setModelBadgeOpen((v) => !v);
              }}
            >
              {modelShort}
            </button>
            <button className="mp-ibtn" onClick={() => { setChatSettingsExpandedBooks({}); setChatSettingsLorebookOpen(false); setChatroomManageOpen(false); setChatSettingsOpen(true); }}>設定</button>
          </div>
          {modelBadgeOpen && (
            <div
              style={{ position: "absolute", top: 56, right: 74, zIndex: 40, background: "#fff", border: "1px solid rgba(244,143,177,.35)", borderRadius: 12, padding: "8px 10px", boxShadow: "0 8px 24px rgba(0,0,0,.12)", maxWidth: 220 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ fontSize: 11, fontWeight: 800, color: "#666", marginBottom: 2 }}>目前模型</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#222" }}>{modelFull}</div>
            </div>
          )}
          {chatSettingsOpen ? (
            <div className="mp-cm" style={{ paddingTop: 8 }}>
              <div className="mp-cc" style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>聊天室設定</div>
              </div>
              <div className="mp-cc">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>互動模式</div>
                  {hasPendingMode && <div style={{ fontSize: 10, color: "var(--mp-txt-l)" }}>下次送出後切換</div>}
                </div>
                <div className="mp-mode-tabs">
                  <button className={`mp-mode-tab ${selectedMode === "online" ? "active" : ""}`} onClick={() => setSelectedChatMode(currentChatChar.id, "online")}>線上聊天</button>
                  <button className={`mp-mode-tab ${selectedMode === "reality" ? "active" : ""}`} onClick={() => setSelectedChatMode(currentChatChar.id, "reality")}>現實模式</button>
                </div>
                <div className="mp-mode-hint">
                  {selectedMode === "reality"
                    ? "現實模式會以全寬段落呈現，支援旁白、動作、角色內心與台詞。"
                    : "線上聊天會維持手機訊息氣泡與短訊息節奏。"}
                </div>
              </div>
              <div className="mp-cc">
                <div
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                  onClick={() => setChatSettingsLorebookOpen((v) => !v)}
                >
                  <div style={{ fontSize: 13, fontWeight: 700 }}>世界書綁定</div>
                  <div style={{ fontSize: 11, color: "var(--mp-txt-l)" }}>{chatSettingsLorebookOpen ? `收合 · ${binding.enabledBookIds.length} 本啟用` : `展開 · ${binding.enabledBookIds.length} 本啟用`}</div>
                </div>
                {chatSettingsLorebookOpen && (
                  <div style={{ marginTop: 8 }}>
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
                )}
              </div>
              <div className="mp-cc">
                <div
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                  onClick={() => setChatroomManageOpen((v) => !v)}
                >
                  <div style={{ fontSize: 13, fontWeight: 700 }}>聊天室管理</div>
                  <div style={{ fontSize: 11, color: "var(--mp-txt-l)" }}>{chatroomManageOpen ? "收合" : "展開"}</div>
                </div>
                {chatroomManageOpen && (
                  <>
                    <div style={{ fontSize: 11, color: "var(--mp-txt-l)", lineHeight: 1.7, marginTop: 8, marginBottom: 8 }}>
                      可以單獨匯出 / 匯入這個角色的聊天室，也可以刪掉對話重新開始，不會影響角色本身。
                    </div>
                    <div style={{ display: "grid", gap: 8 }}>
                      <button
                        type="button"
                        className="mp-save"
                        style={{ background: "linear-gradient(135deg,#90caf9,#42a5f5)" }}
                        onClick={() => exportChatroomForCharacter(currentChatChar.id, currentChatChar.name)}
                      >
                        匯出聊天室
                      </button>
                      <button
                        type="button"
                        className="mp-save"
                        style={{ background: "linear-gradient(135deg,#b0bec5,#78909c)" }}
                        onClick={() => openChatroomImport(currentChatChar.id)}
                      >
                        {chatroomImporting ? "等待選擇檔案..." : "匯入聊天室"}
                      </button>
                      <button
                        type="button"
                        className="mp-save"
                        style={{ background: "linear-gradient(135deg,#ef9a9a,#e53935)" }}
                        onClick={() => deleteChatroomForCharacter(currentChatChar.id, currentChatChar.name)}
                      >
                        刪除此聊天室
                      </button>
                      <input ref={chatroomImportRef} type="file" accept=".json,application/json" style={{display:"none"}} onChange={importChatroomFile} />
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="mp-cr">
            <div
              className="mp-msgs"
              ref={chatMsgsRef}
              onScroll={(e) => {
                const el = e.currentTarget;
                if (el.scrollTop > 0) return;
                if (visibleCount >= msgs.length) return;
                const nextCount = Math.min(msgs.length, visibleCount + 50);
                chatLoadAdjustRef.current = {
                  charId: currentChatChar.id,
                  prevScrollHeight: el.scrollHeight,
                  prevScrollTop: el.scrollTop,
                };
                setChatVisibleCounts((prev) => ({ ...prev, [currentChatChar.id]: nextCount }));
              }}
            >
              {visibleCount < msgs.length && (
                <div style={{display:"flex",justifyContent:"center",padding:"6px 0 10px"}}>
                  <button
                    type="button"
                    className="mp-ibtn"
                    style={{fontSize:11,padding:"4px 10px"}}
                    onClick={(ev) => {
                      ev.preventDefault();
                      ev.stopPropagation();
                      const el = chatMsgsRef.current;
                      if (!el) return;
                      const nextCount = Math.min(msgs.length, visibleCount + 50);
                      chatLoadAdjustRef.current = {
                        charId: currentChatChar.id,
                        prevScrollHeight: el.scrollHeight,
                        prevScrollTop: el.scrollTop,
                      };
                      setChatVisibleCounts((prev) => ({ ...prev, [currentChatChar.id]: nextCount }));
                    }}
                  >
                    載入更早訊息
                  </button>
                </div>
              )}
              {visibleMsgs.map(m => {
                  if (m.role === "mode_transition") {
                    return (
                      <div key={m.id} className="mp-mode-sep">
                        <span>{getModeLabel(m.toMode)}</span>
                      </div>
                    );
                  }
                  if (m.role === "system_notice") {
                    const share = parseShareEventNotice(m.content);
                    const isConnectionError = String(m.content || "").startsWith("連線錯誤：");
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
                              <div style={{ fontWeight: 700, marginBottom: 4 }}>社群分享</div>
                              <div style={{ fontSize: 11, color: "var(--mp-txt-l)", marginBottom: 6 }}>
                                來源：{share.meta.source || "-"}
                              </div>
                              <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5, maxHeight: 180, overflowY: "auto", paddingRight: 2 }}>{applyUserPlaceholder(share.body)}</div>
                            </div>
                          ) : (
                            <div>
                              <div>{m.content}</div>
                              {isConnectionError && (
                                <button className="mp-retry-btn" disabled={isTyping} onClick={(e) => { e.stopPropagation(); retryChatFromNotice(m.id); }}>
                                  重新生成
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      {activeMessageId === m.id && (
                        <button className="mp-msg-editbtn" onClick={() => deleteChatMessage(currentChatChar.id, m.id)}>🗑</button>
                      )}
                    </div>
                  );
                }
                const isUser = m.role === "user";
                const isActive = activeMessageId === m.id;
                if (m.role === "transfer") {
                  const fromName = m.fromType === "player" ? "你" : (m.fromName || "對方");
                  const toName = m.toType === "player" ? "你" : (m.toName || "對方");
                  const heading = m.fromType === "player" ? `你 轉帳給 ${toName}` : `${fromName} 轉帳給 你`;
                  const statusText = m.fromType === "player" ? "已送出" : "已收到";
                  return (
                    <div key={m.id} className="mp-msg-wrap mp-msg-wrap-transfer">
                      <div
                        className="mp-msg mp-transfer-card"
                        onClick={() => setActiveMessageId((p) => (p === m.id ? null : m.id))}
                      >
                        <div className="mp-transfer-success">
                          <div className="mp-transfer-check">✓</div>
                          <div className="mp-transfer-success-text">轉帳成功</div>
                        </div>
                        <div className="mp-transfer-line">{heading}</div>
                        <div className="mp-transfer-meta">
                          <div className="mp-transfer-row"><span className="mp-transfer-k">轉帳金額</span><span className="mp-transfer-v">${formatMoney(m.amount || 0)}</span></div>
                          <div className="mp-transfer-row"><span className="mp-transfer-k">轉帳日期</span><span className="mp-transfer-v">{new Date(m.time).toLocaleDateString("zh-TW")}</span></div>
                        </div>
                        <div className="mp-transfer-note">{m.note ? `備註：${m.note}` : "無備註"}</div>
                        <div className="mp-transfer-footer">
                          <span>{new Date(m.time).toLocaleTimeString("zh-TW",{hour:"2-digit",minute:"2-digit"})}</span>
                          <span className="mp-transfer-status">{statusText}</span>
                        </div>
                      </div>
                      {activeMessageId === m.id && <button className="mp-msg-editbtn" onClick={() => {
                        if (!window.confirm("刪除後不保留這筆交易紀錄，確定嗎？")) return;
                        deleteChatMessage(currentChatChar.id, m.id);
                      }}>🗑</button>}
                    </div>
                  );
                }
                const isReality = getMessageMode(m) === "reality";
                const displayContent = stripModeLabel(stripInternalBlocks(m.content));
                if (isReality) {
                  return (
                    <div key={m.id} className={`mp-reality-wrap ${isUser ? "mp-reality-user" : "mp-reality-ai"}`}>
                      {isUser && <button className={`mp-msg-editbtn ${isActive ? "" : "mp-msg-editbtn-hidden"}`} onClick={() => setMessageEditor({ id: m.id, content: m.content || "", mode: getMessageMode(m) })}>✎</button>}
                      <div className="mp-reality-msg" onClick={() => setActiveMessageId((p) => (p === m.id ? null : m.id))}>
                        {m.image && <img src={`data:image/png;base64,${m.image}`} className="mp-msg-img" alt="" />}
                        {displayContent && renderRealityText(displayContent)}
                        <div className="mp-reality-t">{new Date(m.time).toLocaleTimeString("zh-TW",{hour:"2-digit",minute:"2-digit"})}</div>
                      </div>
                      {!isUser && <button className={`mp-msg-editbtn ${isActive ? "" : "mp-msg-editbtn-hidden"}`} onClick={() => setMessageEditor({ id: m.id, content: m.content || "", mode: getMessageMode(m) })}>✎</button>}
                    </div>
                  );
                }
                return (
                  <div key={m.id} className={`mp-msg-wrap ${isUser?"mp-msg-wrap-user":"mp-msg-wrap-ai"}`}>
                    {isUser && <button className={`mp-msg-editbtn ${isActive ? "" : "mp-msg-editbtn-hidden"}`} onClick={() => setMessageEditor({ id: m.id, content: m.content || "", mode: getMessageMode(m) })}>✎</button>}
                    <div className={`mp-msg ${isUser?"mp-msg-user":"mp-msg-ai"}`} onClick={() => setActiveMessageId((p) => (p === m.id ? null : m.id))}>
                      {m.image && <img src={`data:image/png;base64,${m.image}`} className="mp-msg-img" alt="" />}
                      {displayContent && <div>{displayContent}</div>}
                      <div className="mp-msg-t">{new Date(m.time).toLocaleTimeString("zh-TW",{hour:"2-digit",minute:"2-digit"})}</div>
                    </div>
                    {!isUser && <button className={`mp-msg-editbtn ${isActive ? "" : "mp-msg-editbtn-hidden"}`} onClick={() => setMessageEditor({ id: m.id, content: m.content || "", mode: getMessageMode(m) })}>✎</button>}
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
            {chatActionPanelOpen && (
              <div className="mp-chat-actions">
                <button className="mp-chat-action" onClick={() => { setChatActionPanelOpen(false); fileInputRef.current?.click(); }}>
                  <span className="mp-chat-action-i">🖼</span>
                  <span>相片</span>
                </button>
                <button className="mp-chat-action" onClick={() => { setChatActionPanelOpen(false); setTransferModalOpen(true); }}>
                  <span className="mp-chat-action-i">💸</span>
                  <span>轉帳</span>
                </button>
                <button className="mp-chat-action" disabled>
                  <span className="mp-chat-action-i">📅</span>
                  <span>日程</span>
                </button>
                <button className="mp-chat-action" disabled>
                  <span className="mp-chat-action-i">⚙️</span>
                  <span>更多</span>
                </button>
              </div>
            )}
              <div className="mp-inp-bar">
                <button className={`mp-btn mp-btn-img ${chatActionPanelOpen ? "active" : ""}`} onClick={()=>setChatActionPanelOpen((v) => !v)}>＋</button>
                <input type="file" ref={fileInputRef} accept="image/*" style={{display:"none"}} onChange={handleImgUp} />
                <div className="mp-inp-wrap">
                  <textarea
                    className="mp-inp"
                    placeholder="輸入訊息..."
                    name="mali_chat_text"
                    rows={1}
                    maxLength={inputTextLimit}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="sentences"
                    spellCheck={false}
                    data-form-type="other"
                    data-lpignore="true"
                    value={chatInput}
                    onChange={e=>setChatInput(e.target.value.slice(0, inputTextLimit))}
                    onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();}}}
                  />
                  <div className="mp-char-counter">{chatInput.length}/{inputTextLimit}</div>
                </div>
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
              <div className="mp-ci-info"><div className="mp-ci-name">{c.name}</div><div className="mp-ci-prev">{lm?(lm.role==="transfer"?(lm.note?`轉帳 ${formatMoney(lm.amount)}｜${lm.note}`:`轉帳 ${formatMoney(lm.amount)}`):(lm.image?"[圖片]":stripModeLabel(stripInternalBlocks(lm.content))?.slice(0,30))):"尚無訊息"}</div></div>
              {lm && <div className="mp-ci-time">{new Date(lm.time).toLocaleTimeString("zh-TW",{hour:"2-digit",minute:"2-digit"})}</div>}
            </div>); })}
        </div>
      </div>
    );
  };

  const renderSocial = () => (
    <div className="mp-page">
      <div className="mp-hdr">
        <div className="mp-back" onClick={closeApp}>←</div>
        <div className="mp-htitle">社群</div>
        <div className="mp-social-head-actions">
          <button className="mp-pill-btn mp-pill-btn-ghost" onClick={() => setPlayerPostModalOpen(true)}>發文</button>
          {characters.length > 0 && (
            <button className="mp-pill-btn" onClick={handleRandomSocialPost}>刷新</button>
          )}
        </div>
      </div>
      <div className="mp-feed">
        {posts.length === 0 ? (
          <div className="mp-empty">
            <div className="mp-empty-i">📰</div>
            <div className="mp-empty-t">目前沒有貼文<br/>可以先發一則近況</div>
          </div>
        ) : posts.map((p) => {
          const authorName = getPostAuthorName(p);
          const authorAvatar = sanitizeUserImageUrl(getPostAuthorAvatar(p));
          const isPlayerPost = getPostAuthorType(p) === "player";
          const likeListText = isPlayerPost ? getLikedByListText(p) : "";
          const comments = p.comments || [];
          const commentsOpen = activeCommentPostId === p.id;
          const replyTarget = socialReplyTarget?.postId === p.id ? socialReplyTarget : null;
          const likesOpen = activeLikePostId === p.id;
          const postExpanded = !!expandedSocialPosts[p.id];
          const canExpandPost = shouldClampSocialPost(p.content);
          const scrollComments = shouldScrollComments(comments);
          return (
            <div key={p.id} className="mp-post">
              <div className="mp-post-hd">
                <div className={`mp-post-av ${isPlayerPost ? "player" : ""}`}>
                  {authorAvatar ? <img src={authorAvatar} alt="" /> : (isPlayerPost ? "👤" : "🦊")}
                </div>
                <div>
                  <div className="mp-post-au">{authorName}</div>
                  <div className="mp-post-tm">{new Date(p.time).toLocaleString("zh-TW")}</div>
                </div>
              </div>
              <div className={`mp-post-ct ${canExpandPost && !postExpanded ? "clamped" : ""}`}>{p.content}</div>
              {canExpandPost && (
                <button
                  className="mp-post-more"
                  onClick={() => setExpandedSocialPosts((prev) => ({ ...prev, [p.id]: !prev[p.id] }))}
                >
                  {postExpanded ? "收起" : "顯示更多"}
                </button>
              )}
              <div className="mp-post-acts">
                <button
                  className={`mp-post-act ${p.liked ? "liked" : ""}`}
                  onClick={() => setPosts((ps) => ps.map((x) => (
                    x.id === p.id ? { ...x, liked: !x.liked, likes: x.liked ? x.likes - 1 : x.likes + 1 } : x
                  )))}
                >
                  {p.liked ? "❤️" : "🤍"}
                </button>
                <button className="mp-post-act mp-post-like-count" onClick={() => setActiveLikePostId((id) => id === p.id ? null : p.id)}>
                  {formatSocialCount(getPostLikeCount(p))}
                </button>
                <button className="mp-post-act" onClick={() => { setSocialReplyTarget(null); setActiveCommentPostId((id) => id === p.id ? null : p.id); }}>
                  留言 {comments.length}
                </button>
                {!isPlayerPost && <button className="mp-post-act" onClick={() => sharePostToChat(p)}>分享</button>}
              </div>
              {isPlayerPost && likesOpen && (
                <div className="mp-liked-by">{likeListText || "目前還沒有角色按愛心"}</div>
              )}
              {commentsOpen && (
                <div className={`mp-comments ${scrollComments ? "scroll" : ""}`}>
                  {comments.length === 0 && <div className="mp-comment empty">尚無留言</div>}
                  {comments.map((c) => {
                    const depth = getCommentDepth(c);
                    const author = getCommentAuthorName(c, p.charName || authorName);
                    const canReply = c.role === "assistant" && depth < 2 && c.charId;
                    const targetForThis = canReply ? {
                      postId: p.id,
                      commentId: c.id,
                      charId: c.charId,
                      authorName: author,
                      content: c.content,
                      depth,
                    } : null;
                    const isReplyOpen = replyTarget?.commentId === c.id;
                    const replyInputKey = `${p.id}:${c.id}`;
                    return (
                    <div key={c.id} className={`mp-comment ${depth > 1 ? "reply" : ""} ${canReply ? "clickable" : ""}`}>
                      <div
                        onClick={() => {
                          if (!targetForThis) return;
                          setSocialReplyTarget((prev) => prev?.postId === p.id && prev?.commentId === c.id ? null : targetForThis);
                        }}
                      >
                        <span>{author}：</span>
                        {c.replyToName && <em>回覆 {c.replyToName} </em>}
                        {c.content}
                      </div>
                      {isReplyOpen && (
                        <div className="mp-comment-input mp-comment-inline-input">
                          <input
                            className="mp-sinp"
                            placeholder={`回覆 ${author}...`}
                            value={postCommentInputs[replyInputKey] || ""}
                            maxLength={240}
                            onChange={(e) => setPostCommentInputs((prev) => ({ ...prev, [replyInputKey]: e.target.value }))}
                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPostComment(p.id, targetForThis); } }}
                            autoFocus
                          />
                          <button className="mp-ibtn" onClick={() => setSocialReplyTarget(null)}>取消</button>
                          <button className="mp-ibtn" onClick={() => addPostComment(p.id, targetForThis)}>送出</button>
                        </div>
                      )}
                    </div>
                  );})}
                  <div className="mp-comment-input">
                    <input
                      className="mp-sinp"
                      placeholder="留言..."
                      value={postCommentInputs[p.id] || ""}
                      maxLength={240}
                      onChange={(e) => setPostCommentInputs((prev) => ({ ...prev, [p.id]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPostComment(p.id); } }}
                    />
                    <button className="mp-ibtn" onClick={() => addPostComment(p.id)}>送出</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
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
        {characters.map(c=>(
            <div key={c.id} className="mp-cc">
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                <div className="mp-av">{sanitizeUserImageUrl(c.avatar)?<img src={sanitizeUserImageUrl(c.avatar)} alt=""/>:"🦊"}</div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:13}}>{c.name}</div>
                  <div style={{fontSize:11,color:"var(--mp-txt-l)"}}>{(c.description || c.personality || "尚無角色設定").slice(0,52)}</div>
                </div>
                {activeCharId===c.id?<span className="mp-active-badge">ACTIVE</span>:<button className="mp-ibtn" onClick={()=>{setActiveCharId(c.id);showToast(`${c.name} 已設為主角色`);}}>設為主角色</button>}
              </div>
              <div style={{display:"flex",gap:6}}>
                <button className="mp-ibtn-chat" onClick={()=>{setCurrentChatChar(c);openApp("chat");}}>開始聊天</button>
                <button className="mp-ibtn-chat" onClick={()=>{setEditingCharacter(c);setModal("addChar");}}>展開</button>
              </div>
            </div>
        ))}
      </div>
    </div>
  );

  const renderSettings = () => {
    const tc = tempConfig || apiConfig;
    const cp = API_PROVIDERS.find(p=>p.id===tc.provider);
    const modelOptions = providerModelOptions[tc.provider] || cp?.models || [];
    const getProviderBaseUrl = (provider, fallback = "") => {
      const found = API_PROVIDERS.find((p) => p.id === provider);
      return provider === "custom" ? fallback : (found?.baseUrl || fallback || "");
    };
    const applyApiPreset = (idx) => {
      const p = apiPresets[idx];
      if (!p) return;
      const provider = p.provider || "openai";
      setTempConfig((c) => ({
        ...(c || {}),
        provider,
        baseUrl: getProviderBaseUrl(provider, p.baseUrl || c?.baseUrl || ""),
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
          baseUrl: getProviderBaseUrl(p.provider, p.baseUrl),
          apiKey: p.apiKey,
          model: p.model,
        };
        return list;
      });
      showToast(`已儲存到預設 ${idx + 1}`);
    };
    const testApiConnection = async () => {
      if (testingConnection) return;
      setTestingConnection(true);
      try {
        const reply = await callAI([{ role: "user", content: "請只回覆 OK" }], tc, "你是連線測試助手，只能回覆 OK。");
        const ok = /\bOK\b|ＯＫ/i.test(String(reply || "").trim());
        showToast(ok ? "連線成功" : `連線成功，但回覆異常：${sanitizeText(reply, 40) || "空白"}`);
      } catch (err) {
        showToast(`連線失敗：${sanitizeText(err?.message || "未知錯誤", 120)}`);
      }
      setTestingConnection(false);
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
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:4}}>
            {[
              { id: "appearance", label: "外觀" },
              { id: "api", label: "API / LLM" },
              { id: "data", label: "資料" },
              { id: "about", label: "關於" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                className="mp-ibtn"
                style={{
                  padding: "8px 6px",
                  minWidth: 0,
                  fontWeight: 800,
                  background: settingsTab === tab.id ? "linear-gradient(135deg,#9aa8b3,#7b8791)" : "rgba(255,255,255,.72)",
                  color: settingsTab === tab.id ? "#fff" : "var(--mp-txt)",
                  border: settingsTab === tab.id ? "1px solid rgba(123,135,145,.35)" : "1px solid rgba(160,176,186,.25)",
                }}
                onClick={() => setSettingsTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {settingsTab === "appearance" && (
            <div className="mp-sg">
              <div className="mp-sg-t">主題</div>
              <div className="mp-row">
                <div className="mp-lbl">介面主題</div>
                <select className="mp-ssel" value={themeName} onChange={(e) => setThemeName(e.target.value)}>
                  <option value="莓果蘇打">莓果蘇打</option>
                  <option value="夜色絨幕">夜色絨幕</option>
                </select>
              </div>
              <div style={{fontSize:10,color:"var(--mp-txt-l)",lineHeight:1.6,marginBottom:10}}>
                目前預設主題：莓果蘇打
              </div>
              <div className="mp-sg-t">螢幕鎖定</div>
              <div className="mp-row">
                <div className="mp-lbl">待機後自動鎖定</div>
                <select className="mp-ssel" value={String(screenLockTimeout)} onChange={(e) => setScreenLockTimeout(Number(e.target.value))}>
                  <option value="1">1 分鐘</option>
                  <option value="3">3 分鐘</option>
                  <option value="5">5 分鐘</option>
                  <option value="10">10 分鐘</option>
                  <option value="0">永不鎖定</option>
                </select>
              </div>
              <div style={{fontSize:10,color:"var(--mp-txt-l)",lineHeight:1.6}}>
                目前設定：{screenLockTimeout === 0 ? "永不鎖定" : `${screenLockTimeout} 分鐘後自動鎖定`}
              </div>
            </div>
          )}
          {settingsTab === "api" && (
            <>
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
                <div className="mp-sg-t">AI 連線設定</div>
                <div className="mp-row"><div className="mp-lbl">API 供應商</div><select className="mp-ssel" value={tc.provider} onChange={e=>{const p=API_PROVIDERS.find(x=>x.id===e.target.value);setTempConfig(c=>({...c,provider:p.id,baseUrl:getProviderBaseUrl(p.id,c?.baseUrl || ""),model:p.models[0]||""}));}}>{API_PROVIDERS.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                {tc.provider === "custom" && <div className="mp-row"><div className="mp-lbl">Base URL</div><input className="mp-sinp" value={tc.baseUrl} onChange={e=>setTempConfig(c=>({...c,baseUrl:e.target.value}))} placeholder="https://..." /></div>}
                {tc.provider === "vertex" && <div className="mp-row"><div className="mp-lbl">區域</div><input className="mp-sinp" value={tc.location || "global"} onChange={e=>setTempConfig(c=>({...c,location:e.target.value}))} placeholder="global" /></div>}
                <div className="mp-row"><div className="mp-lbl">API Key</div><input className="mp-sinp" type="password" value={tc.apiKey} onChange={e=>setTempConfig(c=>({...c,apiKey:e.target.value}))} placeholder={tc.provider === "vertex" ? "AIza..." : "sk-..."} /></div>
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
                          if (tc.provider === "vertex") {
                            showToast(`Vertex 抓取失敗，可直接手動輸入模型名稱：${err.message}`);
                            return;
                          }
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
                  <button type="button" className="mp-save" disabled={testingConnection} style={{flex:1,background:"linear-gradient(135deg,#80cbc4,#26a69a)"}} onClick={testApiConnection}>{testingConnection ? "測試中..." : "測試連線"}</button>
                  <button className="mp-save" style={{flex:1}} onClick={()=>{setApiConfig(tc);showToast("設定已儲存");}}>儲存設定</button>
                  <button type="button" className="mp-save" style={{flex:1,background:"linear-gradient(135deg,#90caf9,#42a5f5)"}} onClick={()=>setPresetSavePickerOpen(true)}>另存預設</button>
                </div>
              </div>
            </>
          )}
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
          {settingsTab === "data" && (
            <>
              <div className="mp-sg">
                <div className="mp-sg-t">全域資料備份</div>
                <div style={{fontSize:12,color:"var(--mp-txt-l)",lineHeight:1.7,marginBottom:8}}>
                  這裡可以把整個 App 的主要進度打包下載，或從備份檔匯入後直接接續。
                </div>
                <div style={{display:"grid",gap:8}}>
                  <button className="mp-save" style={{background:"linear-gradient(135deg,#90caf9,#42a5f5)"}} onClick={exportAllData}>匯出全域資料</button>
                  <button type="button" className="mp-save" style={{background:"linear-gradient(135deg,#b0bec5,#78909c)"}} onClick={() => dataImportRef.current?.click()}>
                    {dataImporting ? "等待選擇檔案..." : "匯入全域資料"}
                  </button>
                  <input ref={dataImportRef} type="file" accept=".json,application/json" style={{display:"none"}} onChange={importAllData} />
                </div>
              </div>
              <div className="mp-sg">
                <div className="mp-sg-t">使用提醒</div>
                <div style={{fontSize:12,color:"var(--mp-txt-l)",lineHeight:1.8}}>
                  <div>• 匯入會覆蓋目前裝置上的全域資料。</div>
                  <div>• 最適合拿來做手機和電腦之間的無痛銜接。</div>
                  <div>• 建議先保留一份原始備份，避免覆蓋到不想改動的內容。</div>
                </div>
              </div>
            </>
          )}
          {dataImportPreview && (
            <div className="mp-overlay" style={{zIndex:125}} onClick={() => { setDataImportPreview(null); setDataImporting(false); }}>
              <div className="mp-modal" onClick={(e) => e.stopPropagation()}>
                <div className="mp-modal-t">匯入預覽</div>
                <div style={{fontSize:12,color:"var(--mp-txt-l)",lineHeight:1.8}}>
                  <div>檔名：{dataImportPreview.fileName}</div>
                  <div>大小：{Math.max(1, Math.round((dataImportPreview.fileSize || 0) / 1024))} KB</div>
                  <div>格式：{dataImportPreview.summary.format === "maliphone-app-state" ? "MaliPhone 全域備份" : "舊版或通用 JSON"}</div>
                  {dataImportPreview.summary.exportedAt && <div>匯出時間：{dataImportPreview.summary.exportedAt}</div>}
                </div>
                <div style={{marginTop:10,padding:10,borderRadius:12,background:"rgba(255,255,255,.7)",border:"1px solid rgba(160,176,186,.2)",fontSize:12,lineHeight:1.8,color:"var(--mp-txt)"}}>
                  <div>角色：{dataImportPreview.summary.characters}</div>
                  <div>聊天串：{dataImportPreview.summary.chatThreads}</div>
                  <div>貼文：{dataImportPreview.summary.posts}</div>
                  <div>世界書：{dataImportPreview.summary.lorebooks}</div>
                  <div>玩家資料：{dataImportPreview.summary.playerProfile ? "有" : "無"}</div>
                </div>
                <div style={{marginTop:10,fontSize:11,color:"var(--mp-txt-l)",lineHeight:1.6}}>
                  先確認這份備份內容是不是你要的，再按下面的確認匯入。
                </div>
                <div style={{display:"flex",gap:8,marginTop:12}}>
                  <button type="button" className="mp-save" style={{flex:1,background:"linear-gradient(135deg,#b0bec5,#90a4ae)"}} onClick={() => { setDataImportPreview(null); setDataImporting(false); }}>取消</button>
                  <button type="button" className="mp-save" style={{flex:1,background:"linear-gradient(135deg,#ffb74d,#f57c00)"}} onClick={confirmImportPreview}>確認匯入</button>
                </div>
              </div>
            </div>
          )}
          {chatroomImportPreview && (
            <div className="mp-overlay" style={{zIndex:125}} onClick={() => { setChatroomImportPreview(null); setChatroomImportTarget(null); setChatroomImporting(false); }}>
              <div className="mp-modal" onClick={(e) => e.stopPropagation()}>
                <div className="mp-modal-t">聊天室匯入預覽</div>
                <div style={{fontSize:12,color:"var(--mp-txt-l)",lineHeight:1.8}}>
                  <div>檔名：{chatroomImportPreview.fileName}</div>
                  <div>大小：{Math.max(1, Math.round((chatroomImportPreview.fileSize || 0) / 1024))} KB</div>
                  <div>格式：{chatroomImportPreview.summary.format === "maliphone-chatroom" ? "MaliPhone 聊天室備份" : "舊版或通用 JSON"}</div>
                  {chatroomImportPreview.summary.exportedAt && <div>匯出時間：{chatroomImportPreview.summary.exportedAt}</div>}
                </div>
                <div style={{marginTop:10,padding:10,borderRadius:12,background:"rgba(255,255,255,.7)",border:"1px solid rgba(160,176,186,.2)",fontSize:12,lineHeight:1.8,color:"var(--mp-txt)"}}>
                  <div>訊息數：{chatroomImportPreview.summary.messages}</div>
                  <div>互動模式：{chatroomImportPreview.summary.hasMode ? "有" : "無"}</div>
                  <div>世界書綁定：{chatroomImportPreview.summary.hasBinding ? "有" : "無"}</div>
                </div>
                <div style={{marginTop:10,fontSize:11,color:"var(--mp-txt-l)",lineHeight:1.6}}>
                  先確認這是不是你要接續的聊天室內容，再按下面的確認匯入。
                </div>
                <div style={{display:"flex",gap:8,marginTop:12}}>
                  <button type="button" className="mp-save" style={{flex:1,background:"linear-gradient(135deg,#b0bec5,#90a4ae)"}} onClick={() => { setChatroomImportPreview(null); setChatroomImportTarget(null); setChatroomImporting(false); }}>取消</button>
                  <button type="button" className="mp-save" style={{flex:1,background:"linear-gradient(135deg,#ffb74d,#f57c00)"}} onClick={confirmChatroomImportPreview}>確認匯入</button>
                </div>
              </div>
            </div>
          )}
          {settingsTab === "about" && (
            <>
              <div className="mp-sg">
                <div className="mp-sg-t">版本資訊</div>
                <div style={{fontSize:12,color:"var(--mp-txt-l)",lineHeight:1.7,marginBottom:8}}>
                  <strong>MaliPhone</strong> v{VERSION}<br/>AI 角色互動小手機介面
                </div>
                <div className="mp-version-row" onClick={() => setSettingsVersionOpen((v) => !v)}>
                  <span>{currentChangelogTitle}　版本：{VERSION}</span>
                  <span>{settingsVersionOpen ? "收合" : "展開"}</span>
                </div>
                {settingsVersionOpen && (
                  <ol className="mp-version-list">
                    {(currentChangelog.length ? currentChangelog : ["這個版本沒有填寫更新內容。"]).map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ol>
                )}
              </div>
              <div className="mp-sg">
                <div className="mp-sg-t">服務條款與免責聲明</div>
                <div style={{fontSize:12,color:"var(--mp-txt-l)",lineHeight:1.7,marginBottom:8}}>
                  最後更新：2026年6月2日
                </div>
                <div className="mp-version-row" onClick={() => setSettingsDisclaimerOpen((v) => !v)}>
                  <span>查看完整條款</span>
                  <span>{settingsDisclaimerOpen ? "收合" : "展開"}</span>
                </div>
                {settingsDisclaimerOpen && (
                  <div style={{fontSize:12,color:"var(--mp-txt-l)",lineHeight:1.8,padding:"10px 4px 2px"}}>
                    <div style={{fontWeight:700,color:"var(--mp-txt)"}}>歡迎使用 MaliPhone</div>
                    <div style={{marginTop:8}}>本應用是一個提供給玩家自由遊玩的 AI 角色互動平台。玩家可以依照自己的方式建立、設定與使用內容，所有玩法都由玩家自行決定，開發者不會介入、限制或替玩家做出遊玩選擇。</div>
                    <div style={{marginTop:8}}>本應用不會主動取得玩家的個人設定、遊玩偏好或私人操作內容，也無法控制玩家如何使用本服務。所有角色、對話、情節、觀點與回應皆可能為演算法生成內容，僅供娛樂、創作與測試用途，不代表真實人物、事件或事實。</div>
                    <div style={{marginTop:8}}>請勿將本應用產出的內容視為專業建議。若涉及醫療、法律、財務、心理健康或其他重大決策，請自行判斷並諮詢合格專業人士。</div>
                    <div style={{marginTop:8}}>使用者應對自己在本應用中的操作、輸入與產出內容負責，並遵守所在地法律、平台規範與公共秩序。請勿利用本服務製作、散播或引導任何非法、侵害他人權益、仇恨、騷擾、暴力、自殘或其他高風險內容。</div>
                    <div style={{marginTop:8}}>本應用不保證服務永遠可用、完全正確、完全安全或完全無誤。AI 生成內容可能出現不準確、過時、偏差、重複或不完整的情況，開發者不對因此造成的任何直接或間接損失負責。</div>
                    <div style={{marginTop:8}}>若您不同意上述內容，請停止使用本應用。開發者保留在必要時調整、暫停或終止服務的權利，並可依實際情況更新本條款，更新後於應用程式內公告時即生效。</div>
                  </div>
                )}
              </div>
              <div className="mp-sg">
                <div
                  className="mp-sg-t"
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                  onClick={() => setSettingsResetDataOpen((v) => !v)}
                >
                  <span>重置資料</span>
                  <span style={{ fontSize: 11, color: "var(--mp-txt-l)", fontWeight: 600 }}>{settingsResetDataOpen ? "收合" : "展開"}</span>
                </div>
                {settingsResetDataOpen && (
                  <>
                    <div style={{fontSize:11,color:"var(--mp-txt-l)",lineHeight:1.8,marginBottom:8}}>
                      <div><strong>全域資料</strong>：清空所有遊玩內容，包含角色與玩家資料，把小手機回歸初始狀態。</div>
                      <div><strong>清除快取</strong>：清除網站暫存與更新殘留，讓 App 重新載入最新版本。</div>
                    </div>
                    <div style={{display:"grid",gap:8}}>
                      <button className="mp-save" style={{background:"linear-gradient(135deg,#ef9a9a,#e53935)"}} onClick={()=>{
                        if(!confirm("確定要清空所有資料嗎？")) return;
                        setCharacters([]);
                        setActiveCharId(null);
                        setCurrentChatChar(null);
                        setChatHistory({});
                        setChatModes({});
                        setChatLorebookBindings({});
                        setPosts([]);
                        setMemories({});
                        setLorebooks([]);
                        setActiveLorebookId(null);
                        setPhoneInboxCache({});
                        setWallet(defaultAppState.wallet);
                        setCharacterWallets({});
                        setApiPresets(defaultAppState.apiPresets);
                        setPlayerProfile(defaultAppState.playerProfile);
                        setApiConfig(defaultAppState.apiConfig);
                        setScreenLockTimeout(defaultAppState.screenLockTimeout);
                        setHomeSlots(Array.from({ length: HOME_SLOT_COUNT }, () => null));
                        setDockOrder(DOCK_APPS);
                        setPhonePage("picker");
                        setPhoneViewCharId(null);
                        setPhoneActiveThreadId("player");
                        setCurrentApp(null);
                        setModal(null);
                        setUpdateNoticeOpen(false);
                        setChatSettingsOpen(false);
                        setChatSettingsLorebookOpen(false);
                        setChatroomManageOpen(false);
                        setChatSettingsExpandedBooks({});
                        setChatVisibleCounts({});
                        setActiveMessageId(null);
                        setMessageEditor(null);
                        setIsTyping(false);
                        setChatInput("");
                        setChatImage(null);
                        setPlayerPostModalOpen(false);
                        setPlayerPostText("");
                        setTransferModalOpen(false);
                        setTransferAmount("");
                        setTransferNote("");
                        setSocialReplyTarget(null);
                        setExpandedSocialPosts({});
                        setChatroomImportPreview(null);
                        setChatroomImportTarget(null);
                        setDataImportPreview(null);
                        try { localStorage.removeItem("mali_seen_version"); } catch {}
                        showToast("資料已清空");
                      }}>清空全部資料</button>
                      <button type="button" className="mp-save" style={{background:clearCacheArmed?"linear-gradient(135deg,#ffb74d,#f57c00)":"linear-gradient(135deg,#b0bec5,#78909c)"}} onClick={clearSiteCache}>{clearCacheArmed ? "再次確認清除快取" : "清除快取"}</button>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
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
  const transferToCurrentChar = () => {
    if (!currentChatChar || transferSubmitting) return;
    const amount = Math.max(0, Math.round(Number(transferAmount) || 0));
    if (!amount) { showToast("請輸入轉帳金額"); return; }
    const currentBalance = Number(wallet?.balance || 0);
    if (currentBalance < amount) { showToast("餘額不足"); return; }
    const cid = currentChatChar.id;
    const note = sanitizeText(transferNote, 60);
    const now = Date.now();
    const transferMsg = {
      id: gid(),
      role: "transfer",
      fromType: "player",
      fromName: getPlayerDisplayName(),
      toType: "character",
      toId: cid,
      toName: currentChatChar.name,
      amount,
      note,
      content: note ? `轉帳 $${formatMoney(amount)}｜${note}` : `轉帳 $${formatMoney(amount)}`,
      time: now,
    };
    setTransferSubmitting(true);
    try {
      setWallet((w) => ({
        ...(w || { balance: 0, transactions: [], assets: [] }),
        balance: Math.max(0, (w?.balance || 0) - amount),
        transactions: [{
          id: gid(),
          type: "expense",
          amount,
          note: note ? stripUserPlaceholder(`轉帳給${currentChatChar.name}｜${note}`) : `轉帳給${currentChatChar.name}`,
          time: now,
        }, ...(w?.transactions || [])].slice(0, 120),
      }));
      setCharacterWallets((prev) => {
        const cw = prev[cid] || { balance: 0, transactions: [], summary: "", generatedAt: Date.now() };
        return {
          ...prev,
          [cid]: {
            ...cw,
            balance: Math.max(0, (cw.balance || 0) + amount),
            transactions: [{
              id: gid(),
              type: "income",
              amount,
            note: note ? stripUserPlaceholder(`收到玩家轉帳｜${note}`) : "收到玩家轉帳",
              time: now,
            }, ...(cw.transactions || [])].slice(0, CHARACTER_WALLET_TX_LIMIT),
          },
        };
      });
      setChatHistory((h) => ({ ...h, [cid]: [...(h[cid] || []), transferMsg] }));
      setTransferAmount("");
      setTransferNote("");
      setTransferModalOpen(false);
      showToast("已完成轉帳");
    } finally {
      setTransferSubmitting(false);
    }
  };
  const applyCharacterTransferToPlayer = ({ cid, char, amount, note, time, displayAtEnd = true }) => {
    const safeAmount = Math.max(0, Math.round(Number(amount) || 0));
    if (!cid || !char || !safeAmount) return null;
    const safeNote = sanitizeText(note || "", 60);
    const now = Number(time) || Date.now();
    const transferMsg = {
      id: gid(),
      role: "transfer",
      fromType: "character",
      fromId: cid,
      fromName: char.name || "角色",
      toType: "player",
      toName: getPlayerDisplayName(),
      amount: safeAmount,
      note: safeNote,
      content: safeNote ? `轉帳 $${formatMoney(safeAmount)}｜${safeNote}` : `轉帳 $${formatMoney(safeAmount)}`,
      time: now,
    };
    setWallet((w) => ({
      ...(w || { balance: 0, transactions: [], assets: [] }),
      balance: Math.max(0, (w?.balance || 0) + safeAmount),
      transactions: [{
        id: gid(),
        type: "income",
        amount: safeAmount,
        note: safeNote ? stripUserPlaceholder(`收到${char.name || "角色"}轉帳｜${safeNote}`) : `收到${char.name || "角色"}轉帳`,
        time: now,
      }, ...(w?.transactions || [])].slice(0, 120),
    }));
    setCharacterWallets((prev) => {
      const cw = prev[cid] || { balance: 0, transactions: [], summary: "", generatedAt: Date.now() };
      return {
        ...prev,
        [cid]: {
          ...cw,
          balance: Math.max(0, (cw.balance || 0) - safeAmount),
          transactions: [{
            id: gid(),
            type: "expense",
            amount: safeAmount,
            note: safeNote ? stripUserPlaceholder(`轉帳給玩家｜${safeNote}`) : "轉帳給玩家",
            time: now,
          }, ...(cw.transactions || [])].slice(0, CHARACTER_WALLET_TX_LIMIT),
        },
      };
    });
    setChatHistory((h) => {
      const next = [...(h[cid] || []), transferMsg];
      return { ...h, [cid]: displayAtEnd ? next : next };
    });
    return transferMsg;
  };
  const normalizeWalletData = (data) => {
    const txs = Array.isArray(data?.transactions) ? data.transactions : [];
    return {
      balance: Math.max(0, Math.round(Number(data?.balance) || 0)),
      transactions: txs.slice(0, CHARACTER_WALLET_TX_LIMIT).map((t) => ({
        id: t.id || gid(),
        type: t.type === "income" ? "income" : "expense",
        amount: Math.max(1, Math.round(Number(t.amount) || 1)),
        note: stripUserPlaceholder(sanitizeText(t.note || "", 80)) || (t.type === "income" ? "入帳" : "消費"),
        time: Number(t.time) || Date.now(),
      })),
      summary: stripUserPlaceholder(sanitizeText(data?.summary || "", 120)),
      walletProfile: stripUserPlaceholder(sanitizeText(data?.walletProfile || data?.summary || "", 220)),
      generatedAt: data?.generatedAt || Date.now(),
      refreshedAt: data?.refreshedAt || data?.generatedAt || Date.now(),
      lastRefreshedSlot: data?.lastRefreshedSlot || null,
    };
  };
  const reconcileWalletLedger = (openingBalance, transactions, limit = CHARACTER_WALLET_TX_LIMIT) => {
    let balance = Math.max(0, Math.round(Number(openingBalance) || 0));
    const reconciled = [];
    (transactions || []).forEach((tx) => {
      if (!tx) return;
      const type = tx.type === "income" ? "income" : "expense";
      let amount = Math.max(1, Math.round(Number(tx.amount) || 0));
      if (!amount) return;
      if (type === "expense") {
        if (balance <= 0) return;
        if (amount > balance) amount = balance;
        if (amount <= 0) return;
        balance -= amount;
      } else {
        balance += amount;
      }
      reconciled.push({
        id: tx.id || gid(),
        type,
        amount,
        note: stripUserPlaceholder(sanitizeText(tx.note || "", 80)) || (type === "income" ? "入帳" : "消費"),
        time: Number(tx.time) || Date.now(),
      });
    });
    return { balance, transactions: reconciled.slice(0, limit) };
  };
  const buildWalletRoleProfile = (char) => [
    char.description ? `角色描述：${sanitizeText(char.description, 900)}` : "",
    char.systemPrompt ? `系統提示詞：${sanitizeText(char.systemPrompt, 600)}` : "",
    char.relationshipToUser ? `與玩家關係：${sanitizeText(char.relationshipToUser, 120)}` : "",
  ].filter(Boolean).join("\n");
  const buildWalletRefreshHistory = (cw) => (cw?.transactions || [])
    .slice(0, 3)
    .map((t) => `${t.type === "income" ? "收入" : "支出"} ${formatMoney(t.amount)}：${stripUserPlaceholder(t.note)}`)
    .join("\n");
  const generateCharacterWallet = async (char, { mode = "initial" } = {}) => {
    if (!char) return;
    if (!canUseCurrentProvider()) { showToast("請先完成 AI 連線設定（API Key）"); return; }
    setWalletGenLoading(true);
    try {
      const currentWallet = characterWallets[char.id] || null;
      const walletProfile = currentWallet?.walletProfile || currentWallet?.summary || "";
      const refreshHistory = buildWalletRefreshHistory(currentWallet);
      const isRefresh = mode === "refresh";
      const roleProfile = isRefresh ? "" : buildWalletRoleProfile(char);
      const raw = await callAI([{
        role: "user",
        content: isRefresh
          ? `請根據角色的錢包摘要，補充角色「${char.name}」在當前時段的新流水，只輸出有效 JSON。
規則：
1) 只生成 1~3 筆新的 transactions，內容必須是日常收入或日常支出。
2) 不要生成轉帳事件，轉帳已由聊天室事件另外處理。
3) 不要重做整個錢包，也不要清空既有交易；只回傳增量結果。
4) balance 請回傳本次刷新後、可對帳的整數餘額起點；實際最後餘額會由程式依流水逐筆計算。
5) summary 與 walletProfile 原樣沿用，不要重寫成全新摘要。
6) 所有支出必須能被目前餘額支撐，若錢不夠，請改成較小額支出、臨時收入、借貸、預支，或直接不產生支出。
7) time 使用目前時間附近的毫秒 timestamp，可用 ${Date.now()} 往前推。
格式：
{"balance":1200,"summary":"原摘要可沿用","walletProfile":"原摘要可沿用","transactions":[{"type":"income","amount":300,"note":"午班收入","time":1710000000000}]}

錢包摘要：
${walletProfile || "（無）"}

最近流水摘要：
${refreshHistory || "（無）"}

角色設定補充：已由 walletProfile 取代，刷新時不要重新閱讀完整角色設定。`
          : `請根據角色設定，生成角色「${char.name}」自己的錢包狀態與錢包摘要，只輸出有效 JSON。
規則：
1) balance 是合理餘額，整數，不要太誇張。
2) transactions 產生 8~12 筆，包含 income/expense，金額與備註要貼近角色職業、生活、興趣。
3) 若角色是醫生，收入/支出可部分和醫療、值班、書籍、交通有關，但不能全部都醫療；也要有飲食、娛樂、興趣、人際等生活花費。
4) 不要提到 {{user}}，這是角色自己的錢包。
5) 另外產生一份只用於錢包的 summary，並同步產生 walletProfile。walletProfile 只保留職業、收入來源、消費習慣、生活風格、財務風格等財務相關資訊，不要包含對 {{user}} 的態度、性行為、曖昧互動或私密感情。
6) walletProfile 會用於之後的錢包刷新，請寫得簡短、穩定、方便長期重複使用。
7) 所有支出必須能被目前餘額支撐，若錢不夠，請改成較小額支出、臨時收入、借貸、預支，或直接不產生支出。
8) time 使用目前時間附近的毫秒 timestamp，可用 ${Date.now()} 往前推。
格式：
{"balance":1200,"summary":"一句 20~50 字生活摘要","walletProfile":"一句更短的錢包摘要","transactions":[{"type":"income","amount":3000,"note":"薪資入帳","time":1710000000000}]}

角色設定：
${roleProfile || "（無）"}`,
      }], apiConfig, "你是角色生活流水生成器，只能輸出有效 JSON。");
      const match = String(raw || "").match(/\{[\s\S]*\}/);
      if (!match) throw new Error("模型未回傳 JSON");
      const parsed = JSON.parse(match[0]);
      const next = normalizeWalletData(parsed);
      const refreshedAt = Date.now();
      const lastRefreshedSlot = getWalletTimeSlot(refreshedAt);
      setCharacterWallets((prev) => {
        const current = prev[char.id] || { balance: 0, transactions: [], summary: "", generatedAt: Date.now() };
        const mergedTransactions = isRefresh
          ? [...(next.transactions || []), ...(current.transactions || [])].slice(0, CHARACTER_WALLET_TX_LIMIT)
          : (next.transactions || []).slice(0, CHARACTER_WALLET_TX_LIMIT);
        const openingBalance = isRefresh ? (current.balance || 0) : (Number(parsed.balance) || 0);
        const reconciled = reconcileWalletLedger(openingBalance, mergedTransactions, CHARACTER_WALLET_TX_LIMIT);
        return {
          ...prev,
          [char.id]: {
            ...current,
            ...next,
            summary: next.summary || current.summary || "",
            walletProfile: isRefresh ? (current.walletProfile || current.summary || "") : (next.walletProfile || next.summary || current.walletProfile || current.summary || ""),
            balance: reconciled.balance,
            transactions: reconciled.transactions,
            refreshedAt,
            lastRefreshedSlot,
          },
        };
      });
      showToast(isRefresh ? `${char.name} 的錢包已刷新` : `${char.name} 的錢包已更新`);
    } catch (err) {
      showToast(`角色錢包生成失敗：${sanitizeText(err?.message || "未知錯誤", 120)}`);
    }
    setWalletGenLoading(false);
  };
  const regenerateCharacterWallet = async (char) => {
    if (!char) return;
    const ok = window.confirm("重新生成會清空舊的錢包資料，並重新讀取角色設定建立新錢包，確定要繼續嗎？");
    if (!ok) return;
    setCharacterWallets((prev) => ({ ...prev, [char.id]: { balance: 0, transactions: [], summary: "", generatedAt: Date.now() } }));
    await generateCharacterWallet(char, { mode: "initial" });
  };
  const renderWallet = () => {
    if (walletSettingsOpen && walletSettingsPage === "settings") {
      return (
        <div className="mp-page">
          <div className="mp-hdr">
            <div className="mp-back" onClick={() => setWalletSettingsPage("main")}>←</div>
            <div className="mp-htitle">錢包設定</div>
          </div>
          <div className="mp-cm">
            <div className="mp-cc">
              <div style={{fontSize:13,fontWeight:700,marginBottom:8}}>錢包管理</div>
              <div style={{fontSize:11,color:"var(--mp-txt-l)",lineHeight:1.8,marginBottom:8}}>
                這個頁面只會管理錢包相關內容，不會影響當前角色聊天室或其他全域資料。
              </div>
              <button
                type="button"
                className="mp-save"
                style={{ background: "linear-gradient(135deg,#ef9a9a,#e53935)" }}
                onClick={() => {
                  if (!window.confirm("確定要清除錢包頁面的資料嗎？")) return;
                  if (!window.confirm("請再次確認：這只會清除錢包頁面內容，不會影響聊天室，確定要繼續嗎？")) return;
                  setWallet(defaultAppState.wallet);
                  setCharacterWallets({});
                  setWalletSettingsPage("main");
                  setWalletSettingsOpen(false);
                  showToast("錢包資料已清除");
                }}
              >
                清除資料
              </button>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="mp-page">
        <div className="mp-hdr">
          <div className="mp-back" onClick={closeApp}>←</div>
          <div className="mp-htitle">錢包</div>
          <button className="mp-ibtn" style={{ marginLeft: "auto" }} onClick={() => { setWalletSettingsPage("settings"); setWalletSettingsOpen(true); }}>設定</button>
        </div>
        <div className="mp-cm">
          <div className="mp-cc">
            <div style={{ fontSize: 12, color: "var(--mp-txt-l)" }}>餘額</div>
            <div style={{ fontSize: 28, fontWeight: 800, marginTop: 2 }}>${formatMoney(wallet?.balance || 0)}</div>
            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
              <button className="mp-ibtn-chat" onClick={() => {
                const v = prompt("設定玩家錢包餘額", String(wallet?.balance || 0));
                if (v === null) return;
                setWallet((w) => ({ ...(w || { transactions: [], assets: [] }), balance: Math.max(0, Math.round(Number(v) || 0)) }));
              }}>設定餘額</button>
            </div>
          </div>
          <div className="mp-cc" style={{ marginTop: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>近期流水</div>
            {(wallet?.transactions || []).length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--mp-txt-l)", lineHeight: 1.7 }}>目前沒有交易紀錄。</div>
            ) : (
              <div style={{ display: "grid", gap: 8, maxHeight: 360, overflowY: "auto" }}>
                {(wallet?.transactions || []).slice(0, 12).map((t) => (
                  <div key={t.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, padding: "7px 9px", borderRadius: 10, background: "rgba(255,255,255,.62)" }}>
                    <div>
                      <div>{displayWalletText(t.note)}</div>
                      <div style={{ fontSize: 10, color: "var(--mp-txt-l)" }}>{new Date(t.time).toLocaleString("zh-TW")}</div>
                    </div>
                    <div style={{ fontWeight: 800, color: t.type === "expense" ? "#e53935" : "#2e7d32" }}>{t.type === "expense" ? "-" : "+"}{formatMoney(t.amount)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

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
    const phoneWallet = selectedChar ? characterWallets[selectedChar.id] : null;
    const inImmersivePhone = phonePage === "desktop" || phonePage === "chatlist" || phonePage === "thread" || phonePage === "wallet";
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
          {characters.length > 0 && phonePage !== "desktop" && phonePage !== "chatlist" && phonePage !== "thread" && phonePage !== "wallet" && (
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
                  <div className="mp-icon-c mp-icon-c-img">{renderAppIcon({ id: "chat", name: "聊天", icon: "💬", iconUrl: "./app-icons/chat.png?v=1.1.5" }, 56)}</div>
                  <span className="mp-icon-l">聊天</span>
                </button>
                <button className="mp-icon" style={{background:"rgba(255,255,255,.62)"}} onClick={() => setPhonePage("wallet")}>
                  <div className="mp-icon-c mp-icon-c-img">{renderAppIcon({ id: "wallet", name: "錢包", icon: "💳", iconUrl: "./app-icons/wallet.png?v=1.1.5" }, 56)}</div>
                  <span className="mp-icon-l">錢包</span>
                </button>
                {[
                  { icon: "📷", label: "相機" },
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
          {characters.length > 0 && selectedChar && phonePage === "wallet" && (
            <div style={{position:"relative",height:"100%",minHeight:640,background:"linear-gradient(180deg,#ffd2e6 0%,#d1ecff 100%)",padding:"14px 10px 24px"}}>
              <button className="mp-back" style={{position:"absolute",left:12,top:12,zIndex:5}} onClick={closeApp}>←</button>
              <div style={{padding:"2px 8px 0 56px",display:"flex",justifyContent:"space-between",fontWeight:700,color:"#29485d",fontSize:13}}>
                <span>{phoneTime}</span><span>{phoneDate}</span>
              </div>
              <div className="mp-sc" style={{padding:10,marginTop:12,background:"rgba(255,255,255,.5)"}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                  <button className="mp-ibtn" onClick={() => setPhonePage("desktop")}>返回桌面</button>
                  <div style={{fontWeight:700,fontSize:13}}>{selectedChar.name} 的錢包</div>
                </div>
                {!phoneWallet ? (
                  <div>
                    <div style={{fontSize:12,color:"var(--mp-txt-l)",lineHeight:1.7}}>尚未生成角色錢包。</div>
                    <button className="mp-save" style={{marginTop:10}} disabled={walletGenLoading} onClick={() => generateCharacterWallet(selectedChar)}>{walletGenLoading ? "生成中..." : "生成角色錢包"}</button>
                  </div>
                ) : (
                  <>
                    <div style={{fontSize:12,color:"var(--mp-txt-l)"}}>可用餘額</div>
                    <div style={{fontSize:30,fontWeight:900,margin:"2px 0 6px"}}>${formatMoney(phoneWallet.balance || 0)}</div>
                    {phoneWallet.summary && <div style={{fontSize:12,color:"var(--mp-txt-l)",lineHeight:1.6,marginBottom:10}}>{displayWalletText(phoneWallet.summary)}</div>}
                    <div style={{display:"flex",gap:8,marginBottom:10}}>
                      <button className="mp-ibtn" style={{flex:1}} disabled={walletGenLoading} onClick={() => generateCharacterWallet(selectedChar, { mode: "refresh" })}>{walletGenLoading ? "刷新中..." : "刷新錢包"}</button>
                      <button className="mp-ibtn" style={{flex:1}} disabled={walletGenLoading} onClick={() => regenerateCharacterWallet(selectedChar)}>{walletGenLoading ? "處理中..." : "重新生成"}</button>
                    </div>
                    <div style={{fontSize:13,fontWeight:800,marginBottom:6}}>近期流水</div>
                    <div style={{display:"grid",gap:8,maxHeight:360,overflowY:"auto"}}>
                      {(phoneWallet.transactions || []).slice(0, 12).map((t) => (
                        <div key={t.id} style={{display:"flex",justifyContent:"space-between",gap:8,fontSize:12,padding:"7px 9px",borderRadius:10,background:"rgba(255,255,255,.62)"}}>
                          <div>
                            <div>{displayWalletText(t.note)}</div>
                            <div style={{fontSize:10,color:"var(--mp-txt-l)"}}>{new Date(t.time).toLocaleString("zh-TW")}</div>
                          </div>
                          <div style={{fontWeight:800,color:t.type==="expense"?"#e53935":"#2e7d32"}}>{t.type==="expense"?"-":"+"}{formatMoney(t.amount)}</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
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
  return (<><style>{css}</style><style>{themeCss}</style><div className="mp-wrap"><div className="mp-phone">
    <div className="mp-desk" onTouchStart={onHomeTouchStart} onTouchEnd={onHomeTouchEnd} onMouseDown={onHomeMouseDown} onMouseUp={onHomeMouseUp} onPointerDown={onHomePointerDown} onPointerUp={onHomePointerUp} onPointerMove={onHomePointerMove} onPointerCancel={cancelPointerDrag} onDragOver={onHomeDragOverPageEdge}><BarClock ft={ft} /><div className="mp-desk-scroll">
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
    {modal === "addChar" && <AddCharModal setModal={setModal} setEditingCharacter={setEditingCharacter} addCharacter={addCharacter} updateCharacter={updateCharacter} exportCharacter={exportCharacter} deleteCharacter={deleteCharacter} editingCharacter={editingCharacter} sanitizeUserImageUrl={sanitizeUserImageUrl} />}
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
            <textarea
              className="mp-ta"
              value={messageEditor.content}
              maxLength={getChatTextLimit(messageEditor.mode)}
              onChange={(e)=>setMessageEditor((s)=>({ ...s, content: e.target.value.slice(0, getChatTextLimit(s?.mode)) }))}
              style={{minHeight:120,resize:"vertical"}}
            />
            <div className="mp-char-counter mp-char-counter-modal">{(messageEditor.content || "").length}/{getChatTextLimit(messageEditor.mode)}</div>
          </div>
          <div style={{display:"flex",gap:8,marginTop:10}}>
            <button className="mp-save" style={{flex:1,background:"linear-gradient(135deg,#b0bec5,#90a4ae)"}} onClick={closeMessageEditor}>取消</button>
            <button className="mp-save" style={{flex:1}} onClick={saveEditedMessage}>儲存</button>
          </div>
        </div>
      </div>
    )}
    {updateNoticeOpen && (
      <div className="mp-overlay" onClick={closeUpdateNotice}>
        <div className="mp-modal" onClick={(e)=>e.stopPropagation()}>
          <div className="mp-modal-t">MaliPhone v{VERSION} 更新</div>
          <div className="mp-update-list">
            {(currentChangelog.length ? currentChangelog : ["這個版本沒有填寫更新內容。"]).map((item, idx) => (
              <div key={idx} className="mp-update-item">{item}</div>
            ))}
          </div>
          <button className="mp-save" style={{marginTop:12}} onClick={closeUpdateNotice}>知道了</button>
        </div>
      </div>
    )}
    {playerPostModalOpen && (
      <div className="mp-overlay" onClick={() => setPlayerPostModalOpen(false)}>
        <div className="mp-modal" onClick={(e) => e.stopPropagation()}>
          <div className="mp-modal-t">發佈社群貼文</div>
          <div className="mp-row">
            <textarea
              className="mp-ta"
              value={playerPostText}
              maxLength={PLAYER_SOCIAL_POST_LIMIT}
              placeholder="今天想分享什麼？"
              onChange={(e) => setPlayerPostText(e.target.value.slice(0, PLAYER_SOCIAL_POST_LIMIT))}
              style={{minHeight:130,resize:"vertical"}}
            />
            <div className="mp-char-counter mp-char-counter-modal">{playerPostText.length}/{PLAYER_SOCIAL_POST_LIMIT}</div>
          </div>
          <div style={{display:"flex",gap:8,marginTop:12}}>
            <button className="mp-save" style={{flex:1,background:"linear-gradient(135deg,#b0bec5,#90a4ae)"}} onClick={() => setPlayerPostModalOpen(false)}>取消</button>
            <button className="mp-save" style={{flex:1}} disabled={playerPostSubmitting} onClick={submitPlayerPost}>{playerPostSubmitting ? "發佈中..." : "發佈"}</button>
          </div>
        </div>
      </div>
    )}
    {transferModalOpen && currentChatChar && (
      <div className="mp-overlay" onClick={() => setTransferModalOpen(false)}>
        <div className="mp-modal" onClick={(e) => e.stopPropagation()}>
          <div className="mp-modal-t">轉帳給 {currentChatChar.name}</div>
          <div className="mp-row">
            <div className="mp-lbl">金額</div>
            <input
              className="mp-sinp"
              inputMode="numeric"
              value={transferAmount}
              onChange={(e) => setTransferAmount(e.target.value.replace(/[^\d]/g, ""))}
              placeholder="輸入金額"
            />
          </div>
          <div className="mp-row">
            <div className="mp-lbl">備註</div>
            <input
              className="mp-sinp"
              value={transferNote}
              maxLength={60}
              onChange={(e) => setTransferNote(e.target.value)}
              placeholder="可不填，例如：下午茶 / 車資 / 還款"
            />
          </div>
          <div style={{display:"flex",gap:8,marginTop:12}}>
            <button className="mp-save" style={{flex:1,background:"linear-gradient(135deg,#b0bec5,#90a4ae)"}} onClick={() => setTransferModalOpen(false)}>取消</button>
            <button className="mp-save" style={{flex:1}} disabled={transferSubmitting} onClick={transferToCurrentChar}>{transferSubmitting ? "轉帳中..." : "確認轉帳"}</button>
          </div>
        </div>
      </div>
    )}
    {toast && <div className="mp-toast">{toast}</div>}
  </div></div></>);
}
