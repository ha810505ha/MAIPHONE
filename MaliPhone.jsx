import React, { useState, useEffect, useRef } from "react";
import { VERSION, CHANGELOG, API_PROVIDERS, DEFAULT_APPS, DOCK_APPS } from "./constants/appConstants";
import { ArrowDown, ChevronLeft, ChevronRight, Eye, LoaderCircle, Pause, RefreshCw, Volume2 } from "lucide-react";
import { gid, ft, fd, sanitizeText, sanitizeUserImageUrl } from "./utils/coreUtils";
import { parseSillyTavernJSON, parseSillyTavernPNG, buildSystemPrompt } from "./utils/characterParser";
import { callAI, fetchAvailableModels } from "./services/aiService";
import { fetchElevenLabsDefaultVoices, synthesizeSpeech } from "./services/ttsService";
import { loadAppState, saveAppState } from "./utils/indexedDbStorage";
import css, { THEME_PRESETS } from "./styles/maliPhoneCss";

const createDefaultVoiceSettings = () => ({
  enabled: false,
  elevenlabs: { voiceId: "", speed: 1, stability: 0.5, similarity: 0.75 },
  minimax: { voiceId: "", speed: 1, pitch: 0, volume: 1, emotion: "auto" },
});

const normalizeCharacterVoiceSettings = (value) => {
  const defaults = createDefaultVoiceSettings();
  const source = value && typeof value === "object" ? value : {};
  return {
    ...defaults,
    ...source,
    enabled: !!source.enabled,
    elevenlabs: { ...defaults.elevenlabs, ...(source.elevenlabs || {}) },
    minimax: { ...defaults.minimax, ...(source.minimax || {}) },
  };
};

function AddCharModal({ setModal, setEditingCharacter, addCharacter, updateCharacter, exportCharacter, deleteCharacter, editingCharacter, sanitizeUserImageUrl, uiLanguage, ttsConfig, ttsVoices, onVoicePreview }) {
  const [tab, setTab] = useState("manual");
  const [n, sn] = useState(""); const [d, sd] = useState(""); const [p, sp] = useState(""); const [rel, srel] = useState(""); const [av, sav] = useState("");
  const [importErr, setImportErr] = useState(""); const [importing, setImporting] = useState(false);
  const [avatarCrop, setAvatarCrop] = useState(null);
  const [voiceSettings, setVoiceSettings] = useState(createDefaultVoiceSettings);
  const [voicePreviewing, setVoicePreviewing] = useState(false);
  const AVATAR_MAX_BYTES = 400 * 1024;
  const tr = (zh, en, ja, ko) => ({ "zh-TW": zh, en, ja, ko }[uiLanguage] || zh);
  const ask = (zh, en = zh, ja = zh, ko = zh) => window.confirm(tr(zh, en, ja, ko));
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
    setVoiceSettings(normalizeCharacterVoiceSettings(editingCharacter.voiceSettings));
  }, [editingCharacter]);
  const voiceProvider = ttsConfig?.provider || "elevenlabs";
  const activeVoice = voiceSettings[voiceProvider] || createDefaultVoiceSettings()[voiceProvider];
  const updateActiveVoice = (patch) => setVoiceSettings((current) => ({
    ...current,
    [voiceProvider]: { ...(current[voiceProvider] || {}), ...patch },
  }));
  const onAv = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      const safe = sanitizeUserImageUrl(String(r.result || ""));
      if (!safe) {
        alert(tr("頭像格式不支援", "Unsupported avatar format", "アバター形式に対応していません", "아바타 형식을 지원하지 않습니다"));
        return;
      }
      const img = new Image();
      img.onload = () => {
        setAvatarCrop({ src: safe, width: img.width, height: img.height, zoom: 1, panX: 0, panY: 0, dragging: false, dragStartX: 0, dragStartY: 0, startPanX: 0, startPanY: 0 });
      };
      img.onerror = () => alert(tr("頭像讀取失敗", "Image load failed", "画像の読み込みに失敗しました", "이미지 읽기에 실패했습니다"));
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
          alert(tr("頭像壓縮後仍超過 400KB，請改用尺寸更小或內容更簡單的圖片", "The compressed avatar is still larger than 400KB. Please use a smaller or simpler image.", "圧縮後も400KBを超えています。もっと小さい、またはシンプルな画像を使ってください。", "압축 후에도 400KB를 초과했습니다. 더 작거나 단순한 이미지를 사용해주세요."));
          return;
        }
        sav(picked.out);
        setAvatarCrop(null);
    };
    img.onerror = () => alert(tr("頭像讀取失敗", "Image load failed", "画像の読み込みに失敗しました", "이미지 읽기에 실패했습니다"));
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
      else setImportErr(tr("不支援的檔案格式，請使用 .json 或 .png", "Unsupported file format. Use .json or .png.", "対応していないファイル形式です。.json または .png を使用してください。", "지원하지 않는 파일 형식입니다. .json 또는 .png를 사용하세요."));
    } catch (err) { setImportErr(err.message || tr("匯入失敗", "Import failed", "インポートに失敗しました", "가져오기에 실패했습니다")); }
    setImporting(false); if (importRef.current) importRef.current.value = "";
  };
  return (
    <div className="mp-overlay" onClick={closeModal}>
      <div className="mp-modal" onClick={e => e.stopPropagation()}>
        <div className="mp-modal-t">{editingCharacter ? tr("編輯角色", "Edit character", "キャラを編集", "캐릭터 편집") : tr("新增角色", "Create character", "キャラを作成", "캐릭터 생성")}</div>
        {!editingCharacter && <div className="mp-tabs">
          <div className={`mp-tab ${tab==="manual"?"active":""}`} onClick={() => setTab("manual")}>{tr("手動建立", "Manual create", "手動作成", "수동 생성")}</div>
          <div className={`mp-tab ${tab==="import"?"active":""}`} onClick={() => setTab("import")}>{tr("匯入角色卡", "Import character card", "キャラカードを取り込む", "캐릭터 카드 가져오기")}</div>
        </div>}
        {tab === "import" ? (<>
          <div className="mp-drop" onClick={() => importRef.current?.click()}>
            <div className="mp-drop-icon">📥</div>
            <div className="mp-drop-text">
              {importing ? tr("匯入中...", "Importing...", "インポート中...", "가져오는 중...") : tr("點擊選擇 SillyTavern 角色卡", "Tap to choose a SillyTavern character card", "タップしてSillyTavernキャラカードを選択", "탭하여 SillyTavern 캐릭터 카드를 선택")}
              <br />
              <span style={{fontSize:10,color:"var(--mp-txt-l)"}}>{tr("支援 .json 與 .png", "Supports .json and .png", ".json と .png に対応", ".json 및 .png 지원")}</span>
            </div>
          </div>
          <input type="file" ref={importRef} accept=".json,.png" style={{display:"none"}} onChange={handleImport} />
          {importErr && <div style={{fontSize:12,color:"#e53935",marginTop:6,textAlign:"center"}}>{importErr}</div>}
          <div style={{marginTop:12,padding:10,background:"rgba(244,143,177,.05)",borderRadius:10,fontSize:11,color:"var(--mp-txt-l)",lineHeight:1.6}}>
            <strong>{tr("支援格式：", "Supported formats:", "対応形式:", "지원 형식:")}</strong><br/>
            MaliPhone {tr("角色卡", "character card", "キャラカード", "캐릭터 카드")} JSON<br/>
            SillyTavern V1/V2 JSON<br/>
            SillyTavern PNG（{tr("含", "including", "含む", "포함")} chara tEXt chunk）<br/>
            {tr("會自動讀取", "Auto-reads", "自動で読み込み", "자동으로 읽음")} name、description、personality、scenario、first_mes、mes_example、system_prompt、tags
          </div>
        </>) : (<>
          <div className="mp-row"><div className="mp-lbl">{tr("角色頭像", "Avatar", "アバター", "아바타")}</div><div style={{display:"flex",alignItems:"center",gap:10}}><div className="mp-av" style={{cursor:"pointer"}} onClick={() => avRef.current?.click()}>{av ? <img src={av} alt="" /> : "🦊"}</div><input type="file" ref={avRef} accept="image/*" style={{display:"none"}} onChange={onAv} /><span style={{fontSize:11,color:"var(--mp-txt-l)"}}>{tr("點擊更換", "Tap to change", "タップして変更", "탭하여 변경")}</span></div></div>
          <div className="mp-row"><div className="mp-lbl">{tr("角色名稱 *", "Character name *", "キャラ名 *", "캐릭터 이름 *")}</div><input className="mp-sinp" value={n} onChange={e=>sn(e.target.value)} placeholder={tr("例如 Luna", "e.g. Luna", "例: Luna", "예: Luna")} /></div>
          <div className="mp-row"><div className="mp-lbl">{tr("角色設定（Character Description）", "Character description", "キャラ説明", "캐릭터 설명")}</div><textarea className="mp-ta" value={d} maxLength={8000} onChange={e=>sd(e.target.value.slice(0, 8000))} placeholder={tr("描述角色背景、行為、語氣與互動方式", "Describe the character's background, behavior, tone, and interaction style", "背景、行動、口調、やり取りの雰囲気を説明", "배경, 행동, 말투, 상호작용 분위기를 설명")} style={{minHeight:90,resize:"vertical"}} /><div className="mp-char-counter mp-char-counter-modal">{d.length}/8000</div></div>
            <div className="mp-row"><div className="mp-lbl">{tr("System prompt", "System prompt", "システムプロンプト", "시스템 프롬프트")}</div><textarea className="mp-ta" value={p} maxLength={8000} onChange={e=>sp(e.target.value.slice(0, 8000))} placeholder={tr("Define tone, personality, and reply style", "Define tone, personality, and reply style", "口調、人柄、返答方針を定義", "말투, 성격, 응답 방식을 정의")} /><div className="mp-char-counter mp-char-counter-modal">{p.length}/8000</div></div>
            <div className="mp-row"><div className="mp-lbl">{tr("與玩家關係", "Relationship to player", "プレイヤーとの関係", "플레이어와의 관계")}</div><input className="mp-sinp" value={rel} onChange={e=>srel(e.target.value)} placeholder={tr("例如：青梅竹馬、同事、戀人、陌生人", "e.g. childhood friend, coworker, lover, stranger", "例: 幼なじみ、同僚、恋人、見知らぬ人", "예: 소꿉친구, 동료, 연인, 낯선 사람")} /></div>
            <div className="mp-sg" style={{padding:12,marginTop:12}}>
              <div className="mp-sg-t">{tr("角色語音", "Character voice", "キャラクターボイス", "캐릭터 음성")}</div>
              <div className="mp-row" style={{display:"flex",alignItems:"center",gap:8}}>
                <input id="char_voice_enabled" type="checkbox" checked={!!voiceSettings.enabled} onChange={(e) => setVoiceSettings((current) => ({ ...current, enabled: e.target.checked }))} />
                <label htmlFor="char_voice_enabled" className="mp-lbl" style={{margin:0}}>{tr("啟用這個角色的語音", "Enable voice for this character", "このキャラの音声を有効にする", "이 캐릭터 음성 활성화")}</label>
              </div>
              <div style={{fontSize:10,color:"var(--mp-txt-l)",marginBottom:8}}>{tr("目前全域供應商", "Current global provider", "現在の共通プロバイダー", "현재 전역 제공업체")}：{voiceProvider === "minimax" ? "MiniMax" : "ElevenLabs"}</div>
              {voiceSettings.enabled && <>
                {voiceProvider === "elevenlabs" && <div className="mp-row"><div className="mp-lbl">{tr("選擇可用聲音", "Choose an available voice", "利用可能な音声を選択", "사용 가능한 음성 선택")}</div><select className="mp-ssel" value={(ttsVoices || []).some((voice) => voice.id === activeVoice.voiceId) ? activeVoice.voiceId : "__custom"} onChange={(e) => { if (e.target.value !== "__custom") updateActiveVoice({ voiceId: e.target.value }); }}><option value="__custom">{tr("手動輸入 Voice ID", "Enter Voice ID manually", "Voice ID を手動入力", "Voice ID 직접 입력")}</option>{(ttsVoices || []).map((voice) => <option key={voice.id} value={voice.id}>{voice.name}{voice.category ? ` · ${voice.category}` : ""}</option>)}</select>{!(ttsVoices || []).length && <div style={{fontSize:10,color:"var(--mp-txt-l)",marginTop:4}}>{tr("請先到語音 API 設定載入可用聲音。", "Load available voices in Voice API settings first.", "先に音声 API 設定で利用可能な音声を読み込んでください。", "먼저 음성 API 설정에서 사용 가능한 음성을 불러오세요.")}</div>}</div>}
                <div className="mp-row"><div className="mp-lbl">Voice ID</div><input className="mp-sinp" value={activeVoice.voiceId || ""} onChange={(e) => updateActiveVoice({ voiceId: e.target.value })} placeholder={voiceProvider === "minimax" ? "female-shaonv" : "JBFqnCBsd6RMkjVDRZzb"} /></div>
                <div className="mp-row"><div className="mp-lbl">{tr("語速", "Speed", "速度", "속도")}：{Number(activeVoice.speed || 1).toFixed(2)}</div><input style={{width:"100%"}} type="range" min={voiceProvider === "minimax" ? "0.5" : "0.7"} max={voiceProvider === "minimax" ? "2" : "1.2"} step="0.05" value={activeVoice.speed ?? 1} onChange={(e) => updateActiveVoice({ speed: Number(e.target.value) })} /></div>
                {voiceProvider === "elevenlabs" ? <>
                  <div className="mp-row"><div className="mp-lbl">{tr("穩定度", "Stability", "安定性", "안정성")}：{Number(activeVoice.stability ?? .5).toFixed(2)}</div><input style={{width:"100%"}} type="range" min="0" max="1" step="0.05" value={activeVoice.stability ?? .5} onChange={(e) => updateActiveVoice({ stability: Number(e.target.value) })} /></div>
                  <div className="mp-row"><div className="mp-lbl">{tr("相似度", "Similarity", "類似度", "유사도")}：{Number(activeVoice.similarity ?? .75).toFixed(2)}</div><input style={{width:"100%"}} type="range" min="0" max="1" step="0.05" value={activeVoice.similarity ?? .75} onChange={(e) => updateActiveVoice({ similarity: Number(e.target.value) })} /></div>
                </> : <>
                  <div className="mp-row"><div className="mp-lbl">{tr("音高", "Pitch", "ピッチ", "피치")}：{activeVoice.pitch ?? 0}</div><input style={{width:"100%"}} type="range" min="-12" max="12" step="1" value={activeVoice.pitch ?? 0} onChange={(e) => updateActiveVoice({ pitch: Number(e.target.value) })} /></div>
                  <div className="mp-row"><div className="mp-lbl">{tr("音量", "Volume", "音量", "볼륨")}：{Number(activeVoice.volume ?? 1).toFixed(1)}</div><input style={{width:"100%"}} type="range" min="0.1" max="2" step="0.1" value={activeVoice.volume ?? 1} onChange={(e) => updateActiveVoice({ volume: Number(e.target.value) })} /></div>
                  <div className="mp-row"><div className="mp-lbl">{tr("情緒", "Emotion", "感情", "감정")}</div><select className="mp-ssel" value={activeVoice.emotion || "auto"} onChange={(e) => updateActiveVoice({ emotion: e.target.value })}><option value="auto">Auto</option><option value="happy">Happy</option><option value="sad">Sad</option><option value="angry">Angry</option><option value="fearful">Fearful</option><option value="disgusted">Disgusted</option><option value="surprised">Surprised</option><option value="neutral">Neutral</option></select></div>
                </>}
                <button type="button" className="mp-ibtn-chat" disabled={voicePreviewing || !activeVoice.voiceId?.trim()} onClick={async () => { try { setVoicePreviewing(true); await onVoicePreview?.(voiceSettings, tr("你好，這是我的聲音。", "Hello, this is my voice.", "こんにちは、これが私の声です。", "안녕하세요, 제 목소리예요.")); } finally { setVoicePreviewing(false); } }}>{voicePreviewing ? tr("試聽生成中...", "Generating preview...", "試聴を生成中...", "미리듣기 생성 중...") : tr("試聽語音", "Preview voice", "音声を試聴", "음성 미리듣기")}</button>
              </>}
            </div>
            <div className={editingCharacter ? "mp-char-actions" : ""} style={{marginTop:10}}>
            <button className="mp-save" style={editingCharacter ? {} : {marginTop:10}} onClick={() => {
              if(!n.trim()) return alert(tr("請輸入角色名稱", "Please enter a character name", "キャラ名を入力してください", "캐릭터 이름을 입력해주세요"));
              if (editingCharacter && !ask(`確定要儲存角色「${n.trim()}」的變更嗎？`, `Save changes for ${n.trim()}?`)) return;
              const payload = {name:n.trim(),description:d.trim(),systemPrompt:p.trim(),relationshipToUser:rel.trim(),avatar:av,voiceSettings:normalizeCharacterVoiceSettings(voiceSettings),personality:editingCharacter?.personality||"",scenario:editingCharacter?.scenario||"",firstMessage:editingCharacter?.firstMessage||"",messageExamples:editingCharacter?.messageExamples||"",tags:editingCharacter?.tags||[],creator:editingCharacter?.creator||"",creatorNotes:editingCharacter?.creatorNotes||""};
              if (editingCharacter) updateCharacter(editingCharacter.id, payload);
              else addCharacter(payload);
            }}>{editingCharacter ? tr("儲存變更", "Save changes", "変更を保存", "변경 저장") : tr("建立角色", "Create character", "キャラを作成", "캐릭터 생성")}</button>
            {editingCharacter && <>
              <button className="mp-ibtn" onClick={() => {
                if (!ask(`要匯出角色「${editingCharacter.name}」的角色卡嗎？`, `Export ${editingCharacter.name}?`)) return;
                exportCharacter?.(editingCharacter);
              }}>{tr("匯出", "Export", "エクスポート", "내보내기")}</button>
              <button className="mp-ibtn-r" onClick={() => {
                if (!ask(`確定要刪除角色「${editingCharacter.name}」嗎？這會一併刪除此角色的聊天室、記憶與其他聊天快取。`, `Delete ${editingCharacter.name}? This also removes chats and memories.`)) return;
                deleteCharacter?.(editingCharacter.id);
                closeModal();
              }}>{tr("刪除", "Delete", "削除", "삭제")}</button>
            </>}
            </div>
        </>)}
      </div>
      {avatarCrop && (
        <div className="mp-overlay" style={{zIndex:130}} onClick={(e) => { e.stopPropagation(); setAvatarCrop(null); }}>
          <div className="mp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mp-modal-t">{tr("裁切角色頭像", "Crop avatar", "アバターをトリミング", "아바타 자르기")}</div>
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
            <div className="mp-row"><div className="mp-lbl">{tr("縮放", "Zoom", "ズーム", "확대")}</div><input type="range" min="1" max="3" step="0.01" value={avatarCrop.zoom} onChange={e=>setAvatarCrop(s=>({...(s||{}),zoom:Number(e.target.value)}))} /></div>
            <div style={{fontSize:11,color:"var(--mp-txt-l)",marginTop:4}}>{tr("拖曳圖片調整位置，套用後會自動壓縮到 400KB 以內", "Drag the image to adjust its position. It will be compressed under 400KB when applied.", "画像をドラッグして位置を調整できます。適用後は400KB以内に自動圧縮されます。", "이미지를 드래그해 위치를 조정하세요. 적용 후 400KB 이하로 자동 압축됩니다.")}</div>
            <div style={{display:"flex",gap:8,marginTop:8}}>
              <button className="mp-save" style={{flex:1,background:"linear-gradient(135deg,#b0bec5,#90a4ae)"}} onClick={() => setAvatarCrop(null)}>{tr("取消", "Cancel", "キャンセル", "취소")}</button>
              <button className="mp-save" style={{flex:1}} onClick={applyAvatarCrop}>{tr("套用", "Apply", "適用", "적용")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BarClock({ ft, hideTime = false }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className={`mp-bar ${hideTime ? "mp-lock-bar" : ""}`}>
      {!hideTime && <span>{ft(now)}</span>}
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
    chatBackgrounds: {},
    groupChats: [],
    chatScenes: {},
    groupScenes: {},
    innerThoughtSettings: {},
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
    ttsConfig: {
      enabled: false,
      provider: "elevenlabs",
      elevenlabs: { apiKey: "", model: "eleven_flash_v2_5", defaultVoiceId: "JBFqnCBsd6RMkjVDRZzb" },
      minimax: { apiKey: "", model: "speech-2.8-turbo", baseUrl: "https://api.minimax.io", defaultVoiceId: "English_expressive_narrator" },
    },
    themeName: "莓果蘇打",
    uiLanguage: "zh-TW",
    screenLockTimeout: 5,
  };
  const UI_TEXT = {
    "zh-TW": { settings: "設定", appearance: "外觀", api: "API / LLM", data: "資料", about: "關於", language: "介面語言", theme: "主題", screenLock: "螢幕鎖定", autoLock: "待機後自動鎖定", neverLock: "永不鎖定", save: "儲存設定", cancel: "取消", ok: "知道了", characters: "聯絡人", wallet: "錢包", gameCenter: "遊戲中心", answerBook: "解答之書", notebook: "筆記", gallery: "相簿", phone: "手機", social: "社群", status: "狀態", chat: "聊天", lorebook: "世界觀", player: "玩家", english: "英文", japanese: "日文", korean: "韓文", traditionalChinese: "繁體中文", comingSoon: "即將推出", stayTuned: "敬請期待", contactsHint: "點擊進入手機桌面", noMessages: "目前沒有可顯示的訊息", backToDesktop: "返回桌面", backToList: "返回列表", startChat: "開始聊天", openSettings: "設定", refresh: "刷新", refreshOtherChats: "刷新其他聊天", refreshWallet: "刷新錢包", generate: "生成", generating: "生成中...", updating: "更新中...", loading: "載入中...", clearData: "清空全部資料", clearCache: "清除快取", confirmTransfer: "確認轉帳", transfering: "轉帳中...", close: "關閉", edit: "編輯", enable: "啟用", disable: "停用", title: "標題", content: "內容", keywords: "關鍵字", name: "名稱", description: "描述", import: "匯入", export: "匯出", add: "新增", manualCreate: "手動建立", importCard: "匯入角色卡", chooseCard: "點擊選擇 SillyTavern 角色卡", avatar: "角色頭像", clickChange: "點擊更換", roleConfig: "角色設定", saveChange: "儲存變更", createRole: "建立角色", editRole: "編輯角色", open: "展開", collapse: "收合", noRoleConfig: "尚無角色設定", startChatting: "開始聊天", viewMore: "展開", rolePhone: "角色手機", pickRolePhone: "選擇要查看的角色手機", tapPhoneDesktop: "點擊進入手機桌面", noRolePhone: "尚無角色可預覽手機", switchRole: "換角色", setAsMainCharacter: "設為主要角色", playerProfile: "個人資料", personalSettings: "個人設定", changeAvatar: "更換", remove: "移除", clearAll: "清空全部資料", clearDataConfirm: "確定要清空所有資料嗎？", resetData: "重置資料", fullTerms: "查看完整條款", versionInfo: "版本資訊", versionUpdate: "更新", clearNotice: "清除快取", reloadNow: "重新載入", defaultTheme: "目前預設主題：莓果蘇打", autoLockStatus: "目前設定", imported: "已匯入", exporting: "匯出中...", notReady: "尚未建立", noMessagesShort: "目前沒有可顯示的訊息", loadingFiles: "等待選擇檔案...", waitingFiles: "等待選擇檔案...", chatroom: "聊天室", chatroomSettings: "聊天室設定", worldbookBind: "世界書綁定", manageChatroom: "聊天室管理", dataBackup: "全域資料備份", importPreview: "匯入預覽", chatroomImportPreview: "聊天室匯入預覽", termsDisclaimer: "服務條款與免責聲明", clearCacheAgain: "再次確認清除快取", reopen: "重新開啟", openContact: "聯絡人", languageLabel: "介面語言", roleDescription: "角色設定", roleDescriptionPlaceholder: "描述角色背景、行為、語氣與互動方式", systemPrompt: "系統提示詞", systemPromptPlaceholder: "定義角色語氣、人格、回覆方式", relationship: "與玩家關係", relationshipPlaceholder: "例如：青梅竹馬、同事、戀人、陌生人", importSuccess: "匯入成功", lorebookTitle: "世界書", addLorebook: "新增世界書", noLorebooks: "目前沒有世界書", lorebookEntries: "條目", untitledLorebook: "未命名世界書", lorebookEntry: "條目", noLorebookEntries: "這本世界書尚無條目", delete: "刪除" },
    en: { settings: "Settings", appearance: "Appearance", api: "API / LLM", data: "Data", about: "About", language: "UI Language", theme: "Theme", screenLock: "Screen Lock", autoLock: "Auto-lock after idle", neverLock: "Never lock", save: "Save Settings", cancel: "Cancel", ok: "OK", characters: "Contacts", wallet: "Wallet", gameCenter: "Game Center", answerBook: "Answer Book", notebook: "Notebook", gallery: "Gallery", phone: "Phone", social: "Social", status: "Status", chat: "Chat", lorebook: "Lorebook", player: "Player", english: "English", japanese: "Japanese", korean: "Korean", traditionalChinese: "繁體中文", comingSoon: "Coming soon", stayTuned: "Stay tuned", contactsHint: "Tap to open the phone desktop", noMessages: "No messages to display", backToDesktop: "Back to desktop", backToList: "Back to list", startChat: "Start chat", openSettings: "Settings", refresh: "Refresh", refreshOtherChats: "Refresh other chats", refreshWallet: "Refresh wallet", generate: "Generate", generating: "Generating...", updating: "Updating...", loading: "Loading...", clearData: "Clear all data", clearCache: "Clear cache", confirmTransfer: "Confirm transfer", transfering: "Transferring...", close: "Close", edit: "Edit", enable: "Enable", disable: "Disable", title: "Title", content: "Content", keywords: "Keywords", name: "Name", description: "Description", import: "Import", export: "Export", add: "Add", manualCreate: "Manual create", importCard: "Import character card", chooseCard: "Tap to choose a SillyTavern character card", avatar: "Avatar", clickChange: "Tap to change", roleConfig: "Character description", saveChange: "Save changes", createRole: "Create character", editRole: "Edit character", open: "Expand", collapse: "Collapse", noRoleConfig: "No character settings yet", startChatting: "Start chatting", viewMore: "Expand", rolePhone: "Character phone", pickRolePhone: "Choose a character phone to view", tapPhoneDesktop: "Tap to open the phone desktop", noRolePhone: "No character available to preview", switchRole: "Switch character", setAsMainCharacter: "Set as main character", playerProfile: "Profile", personalSettings: "Personal settings", changeAvatar: "Change", remove: "Remove", clearAll: "Clear all data", clearDataConfirm: "Are you sure you want to clear all data?", resetData: "Reset data", fullTerms: "View full terms", versionInfo: "Version info", versionUpdate: "Update", clearNotice: "Clear cache", reloadNow: "Reload now", defaultTheme: "Default theme: Berry Soda", autoLockStatus: "Current setting", imported: "Imported", exporting: "Exporting...", notReady: "Not created yet", noMessagesShort: "No messages to display", loadingFiles: "Waiting for file selection...", waitingFiles: "Waiting for file selection...", chatroom: "Chatroom", chatroomSettings: "Chatroom settings", worldbookBind: "Worldbook binding", manageChatroom: "Chatroom management", dataBackup: "Global data backup", importPreview: "Import preview", chatroomImportPreview: "Chatroom import preview", termsDisclaimer: "Terms and disclaimer", clearCacheAgain: "Confirm cache clear again", reopen: "Reopen", openContact: "Contacts", languageLabel: "UI Language", roleDescription: "Character description", roleDescriptionPlaceholder: "Describe the character's background, behavior, tone, and interaction style", systemPrompt: "System prompt", systemPromptPlaceholder: "Define tone, personality, and reply style", relationship: "Relationship to player", relationshipPlaceholder: "e.g. childhood friend, coworker, lover, stranger", importSuccess: "Import successful" },
    ja: { settings: "設定", appearance: "外観", api: "API / LLM", data: "データ", about: "情報", language: "UI 言語", theme: "テーマ", screenLock: "画面ロック", autoLock: "待機後に自動ロック", neverLock: "ロックしない", save: "設定を保存", cancel: "キャンセル", ok: "OK", characters: "連絡先", wallet: "財布", gameCenter: "ゲームセンター", answerBook: "答えの書", notebook: "ノート", gallery: "アルバム", phone: "スマホ", social: "SNS", status: "ステータス", chat: "チャット", lorebook: "世界観", player: "プレイヤー", english: "英語", japanese: "日本語", korean: "韓国語", traditionalChinese: "繁體中文", comingSoon: "近日公開", stayTuned: "お楽しみに", contactsHint: "タップしてスマホを開く", noMessages: "表示できるメッセージがありません", backToDesktop: "デスクトップへ", backToList: "一覧へ戻る", startChat: "チャット開始", openSettings: "設定", refresh: "更新", refreshOtherChats: "他のチャットを更新", refreshWallet: "財布を更新", generate: "生成", generating: "生成中...", updating: "更新中...", loading: "読み込み中...", clearData: "すべてのデータを消去", clearCache: "キャッシュを消去", confirmTransfer: "振込を確定", transfering: "振込中...", close: "閉じる", edit: "編集", enable: "有効", disable: "無効", title: "タイトル", content: "内容", keywords: "キーワード", name: "名前", description: "説明", import: "インポート", export: "エクスポート", add: "追加", manualCreate: "手動作成", importCard: "キャラカードを取り込む", chooseCard: "SillyTavern キャラカードを選択", avatar: "アバター", clickChange: "変更する", roleConfig: "キャラ設定", saveChange: "変更を保存", createRole: "キャラを作成", editRole: "キャラを編集", open: "展開", collapse: "折りたたむ", noRoleConfig: "まだキャラ設定はありません", startChatting: "チャットを始める", viewMore: "展開", rolePhone: "キャラスマホ", pickRolePhone: "表示するキャラスマホを選択", tapPhoneDesktop: "タップしてスマホデスクトップを開く", noRolePhone: "プレビューできるキャラがいません", switchRole: "キャラ切替", playerProfile: "プロフィール", personalSettings: "個人設定", changeAvatar: "変更", remove: "削除", clearAll: "すべてのデータを消去", clearDataConfirm: "本当にすべてのデータを消去しますか？", resetData: "データをリセット", fullTerms: "利用規約を表示", versionInfo: "バージョン情報", versionUpdate: "更新", clearNotice: "キャッシュを消去", reloadNow: "再読み込み", defaultTheme: "デフォルトテーマ：Berry Soda", autoLockStatus: "現在の設定", imported: "取り込み完了", exporting: "書き出し中...", notReady: "まだ未作成", noMessagesShort: "表示できるメッセージがありません", loadingFiles: "ファイル選択待ち...", waitingFiles: "ファイル選択待ち...", chatroom: "チャットルーム", chatroomSettings: "チャットルーム設定", worldbookBind: "ワールドブック連携", manageChatroom: "チャットルーム管理", dataBackup: "全体データバックアップ", importPreview: "インポートプレビュー", chatroomImportPreview: "チャットルームインポートプレビュー", termsDisclaimer: "利用規約と免責事項", clearCacheAgain: "キャッシュ削除を再確認", reopen: "開く", openContact: "連絡先", languageLabel: "UI 言語", roleDescription: "キャラ説明", roleDescriptionPlaceholder: "背景、行動、口調、やり取りの雰囲気を説明", systemPrompt: "システムプロンプト", systemPromptPlaceholder: "口調、人柄、返答方針を定義", relationship: "プレイヤーとの関係", relationshipPlaceholder: "例: 幼なじみ、同僚、恋人、見知らぬ人", importSuccess: "インポート成功" },
    ko: { settings: "설정", appearance: "외관", api: "API / LLM", data: "데이터", about: "정보", language: "UI 언어", theme: "테마", screenLock: "화면 잠금", autoLock: "대기 후 자동 잠금", neverLock: "잠금 안 함", save: "설정 저장", cancel: "취소", ok: "확인", characters: "연락처", wallet: "지갑", gameCenter: "게임 센터", answerBook: "정답의 책", notebook: "노트", gallery: "앨범", phone: "폰", social: "소셜", status: "상태", chat: "채팅", lorebook: "세계관", player: "플레이어", english: "영어", japanese: "일본어", korean: "한국어", traditionalChinese: "繁體中文", comingSoon: "곧 출시", stayTuned: "기대해 주세요", contactsHint: "탭하여 휴대폰 화면 열기", noMessages: "표시할 메시지가 없습니다", backToDesktop: "데스크톱으로", backToList: "목록으로", startChat: "채팅 시작", openSettings: "설정", refresh: "새로고침", refreshOtherChats: "다른 채팅 새로고침", refreshWallet: "지갑 새로고침", generate: "생성", generating: "생성 중...", updating: "업데이트 중...", loading: "불러오는 중...", clearData: "모든 데이터 삭제", clearCache: "캐시 삭제", confirmTransfer: "송금 확인", transfering: "송금 중...", close: "닫기", edit: "편집", enable: "활성화", disable: "비활성화", title: "제목", content: "내용", keywords: "키워드", name: "이름", description: "설명", import: "가져오기", export: "내보내기", add: "추가", manualCreate: "수동 생성", importCard: "캐릭터 카드 가져오기", chooseCard: "SillyTavern 캐릭터 카드를 선택", avatar: "아바타", clickChange: "눌러 변경", roleConfig: "캐릭터 설명", saveChange: "변경 저장", createRole: "캐릭터 생성", editRole: "캐릭터 편집", open: "펼치기", collapse: "접기", noRoleConfig: "아직 캐릭터 설정이 없습니다", startChatting: "채팅 시작", viewMore: "펼치기", rolePhone: "캐릭터 폰", pickRolePhone: "볼 캐릭터 폰 선택", tapPhoneDesktop: "탭하여 폰 데스크톱 열기", noRolePhone: "미리 볼 캐릭터가 없습니다", switchRole: "캐릭터 전환", playerProfile: "프로필", personalSettings: "개인 설정", changeAvatar: "변경", remove: "삭제", clearAll: "모든 데이터 삭제", clearDataConfirm: "정말 모든 데이터를 삭제할까요?", resetData: "데이터 초기화", fullTerms: "전체 약관 보기", versionInfo: "버전 정보", versionUpdate: "업데이트", clearNotice: "캐시 삭제", reloadNow: "다시 불러오기", defaultTheme: "기본 테마: Berry Soda", autoLockStatus: "현재 설정", imported: "가져오기 완료", exporting: "내보내는 중...", notReady: "아직 생성되지 않음", noMessagesShort: "표시할 메시지가 없습니다", loadingFiles: "파일 선택 대기 중...", waitingFiles: "파일 선택 대기 중...", chatroom: "채팅방", chatroomSettings: "채팅방 설정", worldbookBind: "월드북 연결", manageChatroom: "채팅방 관리", dataBackup: "전체 데이터 백업", importPreview: "가져오기 미리보기", chatroomImportPreview: "채팅방 가져오기 미리보기", termsDisclaimer: "이용약관 및 면책", clearCacheAgain: "캐시 삭제 재확인", reopen: "열기", openContact: "연락처", languageLabel: "UI 언어", roleDescription: "캐릭터 설명", roleDescriptionPlaceholder: "배경, 행동, 말투, 상호작용 분위기를 설명", systemPrompt: "시스템 프롬프트", systemPromptPlaceholder: "말투, 성격, 응답 방식을 정의", relationship: "플레이어와의 관계", relationshipPlaceholder: "예: 소꿉친구, 동료, 연인, 낯선 사람", importSuccess: "가져오기 성공" },
  };
  const [locked, setLocked] = useState(true);
  const [unlocking, setUnlocking] = useState(false);
  const [currentApp, setCurrentApp] = useState(null);
  const [toast, setToast] = useState(null);
  const [characters, setCharacters] = useState(defaultAppState.characters);
  const [activeCharId, setActiveCharId] = useState(defaultAppState.activeCharId);
  const [chatHistory, setChatHistory] = useState(defaultAppState.chatHistory);
  const [chatModes, setChatModes] = useState(defaultAppState.chatModes);
  const [chatBackgrounds, setChatBackgrounds] = useState(defaultAppState.chatBackgrounds);
  const [chatBgEditor, setChatBgEditor] = useState(null);
  const [groupChats, setGroupChats] = useState(defaultAppState.groupChats);
  const [chatScenes, setChatScenes] = useState(defaultAppState.chatScenes);
  const [groupScenes, setGroupScenes] = useState(defaultAppState.groupScenes);
  const [innerThoughtSettings, setInnerThoughtSettings] = useState(defaultAppState.innerThoughtSettings);
  const [expandedInnerThoughts, setExpandedInnerThoughts] = useState({});
  const [innerThoughtLoading, setInnerThoughtLoading] = useState({});
  const [chatInput, setChatInput] = useState("");
  const [chatImage, setChatImage] = useState(null);
  const [chatActionPanelOpen, setChatActionPanelOpen] = useState(false);
  const [chatListTab, setChatListTab] = useState("friends");
  const [groupCreateOpen, setGroupCreateOpen] = useState(false);
  const [groupCreateName, setGroupCreateName] = useState("");
  const [groupCreateRulePrompt, setGroupCreateRulePrompt] = useState("");
  const [groupCreateMemberIds, setGroupCreateMemberIds] = useState([]);
  const [groupCreateSearch, setGroupCreateSearch] = useState("");
  const [groupCreateCover, setGroupCreateCover] = useState("");
  const [groupEditOpen, setGroupEditOpen] = useState(false);
  const [groupEditGroupId, setGroupEditGroupId] = useState(null);
  const [groupEditName, setGroupEditName] = useState("");
  const [groupEditRulePrompt, setGroupEditRulePrompt] = useState("");
  const [groupEditMemberIds, setGroupEditMemberIds] = useState([]);
  const [groupEditSearch, setGroupEditSearch] = useState("");
  const [groupEditCover, setGroupEditCover] = useState("");
  const [groupCoverCrop, setGroupCoverCrop] = useState(null);
  const [groupEditCoverCrop, setGroupEditCoverCrop] = useState(null);
  const [sceneEditor, setSceneEditor] = useState(null);
  const groupCoverInputRef = useRef(null);
  const groupEditCoverInputRef = useRef(null);
  const CHAT_IMAGE_MAX_BYTES = 1024 * 1024; // 1MB
  const [isTyping, setIsTyping] = useState(false);
  const [currentChatChar, setCurrentChatChar] = useState(null);
  const [currentChatGroup, setCurrentChatGroup] = useState(null);
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
  const lorebookImportInputRef = useRef(null);
  const [chatLorebookBindings, setChatLorebookBindings] = useState(defaultAppState.chatLorebookBindings);
  const [phoneInboxCache, setPhoneInboxCache] = useState(defaultAppState.phoneInboxCache);
  const [wallet, setWallet] = useState(defaultAppState.wallet);
  const [characterWallets, setCharacterWallets] = useState(defaultAppState.characterWallets);
  const [walletGenLoading, setWalletGenLoading] = useState(false);
  const [apiPresets, setApiPresets] = useState(defaultAppState.apiPresets);
  const [playerProfile, setPlayerProfile] = useState(defaultAppState.playerProfile);
  const [themeName, setThemeName] = useState(defaultAppState.themeName);
  const [uiLanguage, setUiLanguage] = useState(defaultAppState.uiLanguage);
  const [playerAvatarCrop, setPlayerAvatarCrop] = useState(null);
  const [screenLockTimeout, setScreenLockTimeout] = useState(defaultAppState.screenLockTimeout);
  const [phoneViewCharId, setPhoneViewCharId] = useState(null);
  const [phonePage, setPhonePage] = useState("picker");
  const [phoneActiveThreadId, setPhoneActiveThreadId] = useState("player");
  const [phoneGenLoading, setPhoneGenLoading] = useState(false);
  const [memoryEditor, setMemoryEditor] = useState(null);
  const [activeMemoryId, setActiveMemoryId] = useState(null);
  const [apiConfig, setApiConfig] = useState(defaultAppState.apiConfig);
  const [ttsConfig, setTtsConfig] = useState(defaultAppState.ttsConfig);
  const [ttsVoices, setTtsVoices] = useState([]);
  const [ttsConnectionState, setTtsConnectionState] = useState("idle");
  const [voicePlayback, setVoicePlayback] = useState({ key: null, status: "idle" });
  const voiceAudioRef = useRef(null);
  const voiceAudioCacheRef = useRef(new Map());
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
  const [pendingLorebookExport, setPendingLorebookExport] = useState(null);
  const [activeLorebookId, setActiveLorebookId] = useState(null);
  const [viewingLorebookEntry, setViewingLorebookEntry] = useState(null);
  const [chatSettingsOpen, setChatSettingsOpen] = useState(false);
  const [chatSettingsExpandedBooks, setChatSettingsExpandedBooks] = useState({});
  const [chatSettingsBackgroundOpen, setChatSettingsBackgroundOpen] = useState(false);
  const [chatSettingsLorebookOpen, setChatSettingsLorebookOpen] = useState(false);
  const [chatSettingsThoughtsOpen, setChatSettingsThoughtsOpen] = useState(false);
  const [thoughtHistoryPage, setThoughtHistoryPage] = useState(0);
  const [pendingThoughtScrollId, setPendingThoughtScrollId] = useState(null);
  const [highlightedThoughtMessageId, setHighlightedThoughtMessageId] = useState(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [chatroomManageOpen, setChatroomManageOpen] = useState(false);
  const [chatVisibleCounts, setChatVisibleCounts] = useState({});
  const [genLoading, setGenLoading] = useState(false);
  const [gamePage, setGamePage] = useState("hub");
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
  const thoughtJumpInProgressRef = useRef(false);
  const [walletSettingsOpen, setWalletSettingsOpen] = useState(false);
  const [walletSettingsPage, setWalletSettingsPage] = useState("main");
  const t = (key) => UI_TEXT[uiLanguage]?.[key] || UI_TEXT["zh-TW"]?.[key] || key;
  const tr = (zh, en, ja, ko) => ({ "zh-TW": zh, en, ja, ko }[uiLanguage] || zh);
  const getUiLanguageLabel = () => ({
    "zh-TW": "繁體中文",
    en: "English",
    ja: "日本語",
    ko: "한국어",
  }[uiLanguage] || uiLanguage);
  const getOutputLanguageDirective = () => `UI language: ${getUiLanguageLabel()}\n請使用${getUiLanguageLabel()}回覆。`;
  const notify = (keyOrText, fallback) => {
    const message = UI_TEXT[uiLanguage]?.[keyOrText] || fallback || keyOrText;
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  };
  const armAppClickSuppression = (ms = 600) => {
    suppressAppClickUntilRef.current = Date.now() + ms;
  };
  const ask = (keyOrText, fallback) => window.confirm(UI_TEXT[uiLanguage]?.[keyOrText] || fallback || keyOrText);
  const askInput = (keyOrText, defaultValue = "", fallback) => prompt(UI_TEXT[uiLanguage]?.[keyOrText] || fallback || keyOrText, defaultValue);

  useEffect(() => {
    let mounted = true;
    loadAppState(defaultAppState).then((data) => {
      if (!mounted) return;
      setCharacters(data.characters || []);
      setActiveCharId(data.activeCharId ?? null);
      setChatHistory(data.chatHistory || {});
      setChatModes(data.chatModes || {});
      setChatBackgrounds(data.chatBackgrounds && typeof data.chatBackgrounds === "object" ? data.chatBackgrounds : defaultAppState.chatBackgrounds);
      setGroupChats(Array.isArray(data.groupChats) ? data.groupChats : []);
      setChatScenes(data.chatScenes && typeof data.chatScenes === "object" ? data.chatScenes : defaultAppState.chatScenes);
      setGroupScenes(data.groupScenes && typeof data.groupScenes === "object" ? data.groupScenes : defaultAppState.groupScenes);
      setInnerThoughtSettings(data.innerThoughtSettings && typeof data.innerThoughtSettings === "object" ? data.innerThoughtSettings : defaultAppState.innerThoughtSettings);
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
      setTtsConfig(data.ttsConfig && typeof data.ttsConfig === "object" ? {
        ...defaultAppState.ttsConfig,
        ...data.ttsConfig,
        elevenlabs: { ...defaultAppState.ttsConfig.elevenlabs, ...(data.ttsConfig.elevenlabs || {}) },
        minimax: { ...defaultAppState.ttsConfig.minimax, ...(data.ttsConfig.minimax || {}) },
      } : defaultAppState.ttsConfig);
      setThemeName(data.themeName || defaultAppState.themeName);
      setUiLanguage(data.uiLanguage || defaultAppState.uiLanguage);
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
      saveAppState({ characters, activeCharId, chatHistory, chatModes, chatBackgrounds, groupChats, chatScenes, groupScenes, innerThoughtSettings, posts, memories, lorebooks, chatLorebookBindings, phoneInboxCache, wallet, characterWallets, screenLockTimeout, apiPresets, playerProfile, apiConfig, ttsConfig, themeName, uiLanguage, homeSlots, dockOrder }).catch(() => {});
    }, 180);
    return () => clearTimeout(timer);
  }, [hydrated, characters, activeCharId, chatHistory, chatModes, chatBackgrounds, groupChats, chatScenes, groupScenes, innerThoughtSettings, posts, memories, lorebooks, chatLorebookBindings, phoneInboxCache, wallet, characterWallets, screenLockTimeout, apiPresets, playerProfile, apiConfig, ttsConfig, themeName, uiLanguage, homeSlots, dockOrder]);
  useEffect(() => {
    if (!hydrated || ttsConfig.provider !== "minimax") return;
    setTtsConfig((current) => ({ ...current, provider: "elevenlabs" }));
  }, [hydrated, ttsConfig.provider]);
  useEffect(() => {
    if (!currentChatGroup?.id) return;
    const latest = groupChats.find((g) => g.id === currentChatGroup.id);
    if (!latest) return;
    if (latest === currentChatGroup) return;
    setCurrentChatGroup(latest);
  }, [groupChats, currentChatGroup?.id]);
  useEffect(() => {
    if (!pendingThoughtScrollId || chatSettingsOpen) return;
    const frame = requestAnimationFrame(() => {
      const container = chatMsgsRef.current;
      const target = container
        ? Array.from(container.querySelectorAll("[data-message-id]")).find((node) => node.dataset.messageId === pendingThoughtScrollId)
        : null;
      if (!target) return;
      const targetTop = target.offsetTop - (container.clientHeight - target.clientHeight) / 2;
      container.scrollTop = Math.max(0, targetTop);
      setExpandedInnerThoughts((prev) => ({ ...prev, [pendingThoughtScrollId]: true }));
      setHighlightedThoughtMessageId(pendingThoughtScrollId);
      setPendingThoughtScrollId(null);
      setTimeout(() => { thoughtJumpInProgressRef.current = false; }, 500);
      setTimeout(() => setHighlightedThoughtMessageId(null), 1800);
    });
    return () => cancelAnimationFrame(frame);
  }, [pendingThoughtScrollId, chatSettingsOpen, chatVisibleCounts, chatHistory]);
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
    const selectedCharId = phoneViewCharId || null;
    const selectedChar = characters.find((c) => c.id === selectedCharId) || null;
    const phoneWallet = selectedChar ? characterWallets[selectedChar.id] : null;
    if (!selectedChar || !phoneWallet?.summary || walletAutoRefreshBusyRef.current) return;
    if (!shouldAutoRefreshWallet(phoneWallet)) return;
    walletAutoRefreshBusyRef.current = true;
    generateCharacterWallet(selectedChar, { mode: "refresh" })
      .finally(() => {
        walletAutoRefreshBusyRef.current = false;
      });
  }, [hydrated, phonePage, phoneViewCharId, characters, characterWallets]);
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
    if (thoughtJumpInProgressRef.current) return;
    const el = chatMsgsRef.current || messagesEndRef.current?.parentElement;
    if (!el) return;
    const t = setTimeout(() => {
      el.scrollTop = el.scrollHeight;
      setShowScrollToBottom(false);
    }, 0);
    return () => clearTimeout(t);
  }, [currentChatChar?.id, chatHistory, isTyping, chatVisibleCounts]);
  useEffect(() => {
    if (!currentChatGroup) return;
    const el = chatMsgsRef.current || messagesEndRef.current?.parentElement;
    if (!el) return;
    const t = setTimeout(() => {
      el.scrollTop = el.scrollHeight;
      setShowScrollToBottom(false);
    }, 0);
    return () => clearTimeout(t);
  }, [currentChatGroup?.id, groupChats, isTyping]);
  const updateScrollToBottomVisibility = (element) => {
    if (!element) return;
    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    setShowScrollToBottom(distanceFromBottom > 250);
  };
  const scrollCurrentChatToBottom = () => {
    const element = chatMsgsRef.current;
    if (!element) return;
    thoughtJumpInProgressRef.current = false;
    setHighlightedThoughtMessageId(null);
    element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
    setShowScrollToBottom(false);
  };
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
  const stopCurrentVoiceAudio = () => {
    const current = voiceAudioRef.current;
    if (!current) return;
    current.audio.pause();
    URL.revokeObjectURL(current.url);
    voiceAudioRef.current = null;
  };
  const playVoiceBlob = async (blob, key) => {
    stopCurrentVoiceAudio();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    voiceAudioRef.current = { audio, url, key };
    audio.onended = () => {
      if (voiceAudioRef.current?.audio === audio) voiceAudioRef.current = null;
      URL.revokeObjectURL(url);
      setVoicePlayback({ key: null, status: "idle" });
    };
    audio.onerror = () => {
      if (voiceAudioRef.current?.audio === audio) voiceAudioRef.current = null;
      URL.revokeObjectURL(url);
      setVoicePlayback({ key: null, status: "idle" });
      showToast(tr("語音播放失敗", "Voice playback failed", "音声の再生に失敗しました", "음성 재생 실패"));
    };
    await audio.play();
    setVoicePlayback({ key, status: "playing" });
  };
  const previewCharacterVoice = async (voiceSettings, text) => {
    try {
      const blob = await synthesizeSpeech({ text, config: ttsConfig, voiceSettings });
      await playVoiceBlob(blob, "voice-preview");
    } catch (err) {
      showToast(`${tr("語音試聽失敗", "Voice preview failed", "音声試聴に失敗しました", "음성 미리듣기 실패")}：${sanitizeText(err?.message || "", 120)}`);
    }
  };
  const loadElevenLabsDefaultVoices = async () => {
    const apiKey = ttsConfig.elevenlabs?.apiKey || "";
    try {
      setTtsConnectionState("loading");
      const voices = await fetchElevenLabsDefaultVoices(apiKey);
      if (!voices.length) throw new Error(tr("找不到可用聲音", "No available voices found", "利用可能な音声が見つかりません", "사용 가능한 음성을 찾을 수 없습니다"));
      setTtsVoices(voices);
      setTtsConfig((current) => ({
        ...current,
        elevenlabs: {
          ...current.elevenlabs,
          availableVoices: voices,
          defaultVoiceId: voices.some((voice) => voice.id === current.elevenlabs?.defaultVoiceId) ? current.elevenlabs.defaultVoiceId : voices[0].id,
        },
      }));
      setTtsConnectionState("success");
      showToast(tr(`連線成功，已載入 ${voices.length} 個可用聲音`, `Connected; loaded ${voices.length} available voices`, `接続成功：${voices.length}件の音声を読み込みました`, `연결 성공: 사용 가능한 음성 ${voices.length}개를 불러왔습니다`));
    } catch (err) {
      setTtsVoices([]);
      setTtsConnectionState("error");
      showToast(`${tr("ElevenLabs 連線失敗", "ElevenLabs connection failed", "ElevenLabs 接続失敗", "ElevenLabs 연결 실패")}：${sanitizeText(err?.message || "", 120)}`);
    }
  };
  const previewDefaultTtsVoice = async () => {
    const provider = ttsConfig.provider || "elevenlabs";
    const voiceId = ttsConfig[provider]?.defaultVoiceId || "";
    try {
      setTtsConnectionState("previewing");
      const voiceSettings = createDefaultVoiceSettings();
      voiceSettings.enabled = true;
      voiceSettings[provider].voiceId = voiceId;
      const blob = await synthesizeSpeech({
        text: tr("你好，語音 API 已連線成功。", "Hello, the voice API is connected.", "こんにちは、音声 API の接続に成功しました。", "안녕하세요, 음성 API 연결에 성공했습니다."),
        config: ttsConfig,
        voiceSettings,
      });
      await playVoiceBlob(blob, "tts-default-preview");
      setTtsConnectionState("success");
    } catch (err) {
      setTtsConnectionState("error");
      showToast(`${tr("語音測試失敗", "Voice test failed", "音声テストに失敗しました", "음성 테스트 실패")}：${sanitizeText(err?.message || "", 120)}`);
    }
  };
  const extractRealitySpeech = (text) => {
    const parts = [];
    const source = String(text || "");
    const pattern = /「([^」]+)」|“([^”]+)”|"([^"]+)"/g;
    let match;
    while ((match = pattern.exec(source))) parts.push(match[1] || match[2] || match[3]);
    return parts.join(" ").trim();
  };
  const getReplySpeechText = (charId, message) => {
    const history = chatHistory[charId] || [];
    const group = message.replyGroupId
      ? history.filter((item) => item.role === "assistant" && item.replyGroupId === message.replyGroupId)
      : [message];
    const combined = group.map((item) => stripModeLabel(stripInternalBlocks(item.content || ""))).filter(Boolean).join("\n");
    const speech = getMessageMode(message) === "reality" ? extractRealitySpeech(combined) : combined;
    return speech.replace(/\*\*|__|[*_`#]/g, "").trim();
  };
  const toggleCharacterVoice = async (char, message) => {
    const voiceSettings = char?.voiceSettings;
    if (!ttsConfig.enabled || !voiceSettings?.enabled) return;
    const provider = ttsConfig.provider || "elevenlabs";
    const voiceId = voiceSettings?.[provider]?.voiceId?.trim();
    if (!ttsConfig?.[provider]?.apiKey) return showToast(tr("請先到設定填寫語音 API Key", "Set the voice API key in Settings first", "設定で音声 API Key を入力してください", "설정에서 음성 API Key를 입력해주세요"));
    if (!voiceId) return showToast(tr("請先在角色設定填寫 Voice ID", "Set a Voice ID in character settings first", "キャラ設定で Voice ID を入力してください", "캐릭터 설정에서 Voice ID를 입력해주세요"));
    const key = `${provider}:${char.id}:${message.replyGroupId || message.id}`;
    if (voicePlayback.key === key && voicePlayback.status === "playing" && voiceAudioRef.current?.audio) {
      voiceAudioRef.current.audio.pause();
      setVoicePlayback({ key, status: "paused" });
      return;
    }
    if (voicePlayback.key === key && voicePlayback.status === "paused" && voiceAudioRef.current?.audio) {
      await voiceAudioRef.current.audio.play();
      setVoicePlayback({ key, status: "playing" });
      return;
    }
    const text = getReplySpeechText(char.id, message);
    if (!text) return showToast(tr("這段回覆沒有可朗讀的角色台詞", "This reply has no character dialogue to read", "この返信には読み上げる台詞がありません", "이 답변에는 읽을 캐릭터 대사가 없습니다"));
    const cacheKey = `${key}:${ttsConfig[provider]?.model || ""}:${voiceId}:${text}`;
    try {
      setVoicePlayback({ key, status: "loading" });
      let blob = voiceAudioCacheRef.current.get(cacheKey);
      if (!blob) {
        blob = await synthesizeSpeech({ text, config: ttsConfig, voiceSettings });
        voiceAudioCacheRef.current.set(cacheKey, blob);
      }
      await playVoiceBlob(blob, key);
    } catch (err) {
      setVoicePlayback({ key: null, status: "idle" });
      showToast(`${tr("語音生成失敗", "Voice generation failed", "音声生成に失敗しました", "음성 생성 실패")}：${sanitizeText(err?.message || "", 120)}`);
    }
  };
  const renderCharacterVoiceAction = (char, message, isActive, collapseWhenHidden = false) => {
    if (!ttsConfig.enabled || !char?.voiceSettings?.enabled) return null;
    const key = `${ttsConfig.provider || "elevenlabs"}:${char.id}:${message.replyGroupId || message.id}`;
    const status = voicePlayback.key === key ? voicePlayback.status : "idle";
    const isVisible = isActive || status !== "idle";
    return (
      <button
        type="button"
        className={`mp-voice-action ${isVisible ? "" : (collapseWhenHidden ? "mp-voice-action-collapsed" : "mp-voice-action-hidden")} ${status === "playing" ? "mp-voice-action-playing" : ""}`}
        disabled={status === "loading"}
        title={status === "playing" ? tr("暫停語音", "Pause voice", "音声を一時停止", "음성 일시정지") : tr("播放角色語音", "Play character voice", "キャラクター音声を再生", "캐릭터 음성 재생")}
        aria-label={status === "playing" ? tr("暫停語音", "Pause voice", "音声を一時停止", "음성 일시정지") : tr("播放角色語音", "Play character voice", "キャラクター音声を再生", "캐릭터 음성 재생")}
        onClick={(event) => { event.stopPropagation(); void toggleCharacterVoice(char, message); }}
      >
        {status === "loading" ? <LoaderCircle size={14} className="mp-voice-spinner" aria-hidden="true" /> : status === "playing" ? <Pause size={14} aria-hidden="true" /> : <Volume2 size={14} aria-hidden="true" />}
      </button>
    );
  };
  const CHANGELOG_TEXT = {
    "1.1.9": {
      en: ["06/29 Update", "Added character inner thoughts with automatic generation, manual viewing, and thought history", "Added character voice support (beta), including ElevenLabs voice settings, previews, and manual playback in chat"],
      ja: ["06/29 更新", "キャラの心の声機能を追加し、自動生成・手動表示・履歴に対応", "キャラクター音声機能（テスト版）を追加し、ElevenLabs の音声設定・試聴・チャットでの手動再生に対応"],
      ko: ["06/29 업데이트", "캐릭터 속마음 기능을 추가하고 자동 생성, 수동 확인, 속마음 기록을 지원", "캐릭터 음성 기능(테스트 버전)을 추가하고 ElevenLabs 음성 설정, 미리듣기, 채팅 수동 재생을 지원"],
    },
    "1.1.8": {
      en: ["06/25 Update", "Added English, Japanese, and Korean UI languages; character replies now follow the selected UI language", "Added chatroom background image uploads", "Adjusted the player dialogue box in Reality mode"],
      ja: ["06/25 更新", "英語・日本語・韓国語の UI 言語を追加し、キャラの返信が選択中の UI 言語に合わせるようになりました", "チャットルーム背景画像のアップロード機能を追加", "現実モードのプレイヤー会話ボックスを調整"],
      ko: ["06/25 업데이트", "영어, 일본어, 한국어 UI 언어를 추가했으며 캐릭터 답변이 선택한 UI 언어를 따르도록 했습니다", "채팅방 배경 이미지 업로드 기능 추가", "현실 모드의 플레이어 대화 상자 조정"],
    },
    "1.1.6": {
      en: ["06/19 Update", "Added DeepSeek API", "Added group chat in chatrooms", "Added chatroom scene settings", "Added chatroom pinning"],
      ja: ["06/19 更新", "API に DeepSeek を追加", "チャットルームにグループチャットを追加", "チャットルームのシーン設定を追加", "チャットルームのピン留めを追加"],
      ko: ["06/19 업데이트", "API에 DeepSeek 추가", "채팅방에 그룹 채팅 기능 추가", "채팅방 장면 설정 추가", "채팅방 고정 기능 추가"],
    },
    "1.1.5": {
      en: ["06/13 Update", "Added Vertex AI API", "Fixed character settings and UI display"],
      ja: ["06/13 更新", "API に Vertex AI を追加", "キャラ関連設定と UI 表示を修正"],
      ko: ["06/13 업데이트", "API에 Vertex AI 추가", "캐릭터 관련 설정과 UI 표시 수정"],
    },
    "1.1.4": {
      en: ["06/03 Update", "Fixed Gemma / character settings and UI display"],
      ja: ["06/03 更新", "Gemma / キャラ関連設定と UI 表示を修正"],
      ko: ["06/03 업데이트", "Gemma / 캐릭터 관련 설정과 UI 표시 수정"],
    },
    "1.1.3": {
      en: ["06/02 Update", "Added character status / settings / import / export", "Fixed character and chat display", "Fixed player profile settings", "Improved settings stability"],
      ja: ["06/02 更新", "キャラのステータス / 設定 / インポート / エクスポートを追加", "キャラとチャット表示を修正", "プロフィール設定を修正", "設定の安定性を改善"],
      ko: ["06/02 업데이트", "캐릭터 상태 / 설정 / 가져오기 / 내보내기 추가", "캐릭터와 채팅 표시 수정", "프로필 설정 수정", "설정 안정성 개선"],
    },
    "1.1.2": {
      en: ["05/28 Update", "Added AI / chat / memory / character cards", "Added AIRP and chat prompts", "Added character management", "Fixed several bugs"],
      ja: ["05/28 更新", "AI / チャット / メモリ / キャラカードを追加", "AIRP とチャットプロンプトを追加", "キャラ管理を追加", "一部の不具合を修正"],
      ko: ["05/28 업데이트", "AI / 대화 / 기억 / 캐릭터 카드 추가", "AIRP 및 채팅 프롬프트 추가", "캐릭터 관리 추가", "일부 오류 수정"],
    },
  };
  const currentChangelogRaw = uiLanguage === "zh-TW"
    ? (CHANGELOG[VERSION] || [])
    : (CHANGELOG_TEXT[VERSION]?.[uiLanguage] || CHANGELOG[VERSION] || []);
  const currentChangelogTitle = currentChangelogRaw[0] || tr("版本更新", "Version update", "バージョン更新", "버전 업데이트");
  const currentChangelog = currentChangelogRaw.slice(1);
  const closeUpdateNotice = () => {
    try { localStorage.setItem("mali_seen_version", VERSION); } catch {}
    setUpdateNoticeOpen(false);
  };
  const playerAvatarRef = useRef(null);
  const estimateTokens = (s) => Math.ceil(String(s || "").length / 3.5);
  const getUserDisplayName = () => sanitizeText(playerProfile?.name || t("player"), 40) || t("player");
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
      if (!safe) return notify("頭像格式不支援", tr("頭像格式不支援", "Unsupported avatar format", "アバター形式に対応していません", "아바타 형식을 지원하지 않습니다"));
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
      if (!safe) return notify("頭像處理失敗", tr("頭像處理失敗", "Avatar processing failed", "アバターの処理に失敗しました", "아바타 처리가 실패했습니다"));
      setPlayerProfile((p) => ({ ...(p || {}), avatar: safe }));
      setPlayerAvatarCrop(null);
      notify("大頭貼已更新", tr("大頭貼已更新", "Avatar updated", "アバターを更新しました", "프로필 사진이 업데이트되었습니다"));
    };
    img.onerror = () => notify("圖片讀取失敗", tr("圖片讀取失敗", "Image load failed", "画像の読み込みに失敗しました", "이미지 읽기에 실패했습니다"));
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
    armAppClickSuppression(220);
    if (id === "settings") setTempConfig({ ...apiConfig });
    if (id === "lorebook") setActiveLorebookId(null);
    if (id === "game") setGamePage("hub");
    if (id === "chat") {
      setCurrentChatChar(null);
      setCurrentChatGroup(null);
      setChatListTab("friends");
    }
    if (id === "phone") {
      setPhonePage(phoneViewCharId ? "desktop" : "picker");
      setPhoneActiveThreadId("player");
    }
    setCurrentApp(id);
  };
  const openAppFromTouch = (id, e) => {
    if (!e) return;
    e.preventDefault();
    e.stopPropagation();
    armAppClickSuppression(220);
    openApp(id);
  };
  const blockRecentAppClicks = (e) => {
    if (Date.now() <= suppressAppClickUntilRef.current) {
      e.stopPropagation();
      e.preventDefault();
    }
  };
  const closeApp = () => {
    armAppClickSuppression(220);
    setCurrentApp(null);
    setCurrentChatChar(null);
    setCurrentChatGroup(null);
  };
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
    if (!messageEditor) return;
    if (currentChatGroup && !currentChatChar) {
      const next = (currentChatGroup.messages || []).map((m) =>
        m.id === messageEditor.id ? { ...m, content: sanitizeText(messageEditor.content, 4000) } : m
      );
      setGroupChats((prev) => prev.map((g) => g.id === currentChatGroup.id ? { ...g, messages: next, updatedAt: Date.now() } : g));
    } else if (currentChatChar) {
      const cid = currentChatChar.id;
      const limit = getChatTextLimit(messageEditor.mode);
      const next = (chatHistory[cid] || []).map((m) =>
        m.id === messageEditor.id ? { ...m, content: sanitizeText(messageEditor.content, limit) } : m
      );
      setChatHistory((h) => ({ ...h, [cid]: next }));
    } else {
      return;
    }
    setMessageEditor(null);
    setActiveMessageId(null);
    showToast(tr("訊息已更新", "Message updated", "メッセージを更新しました", "메시지가 업데이트되었습니다"));
  };
  const deleteMessageWithConfirm = () => {
    if (!messageEditor) return;
    if (!window.confirm(tr("確定要刪除這則對話嗎？", "Delete this message?", "このメッセージを削除しますか？", "이 메시지를 삭제할까요?"))) return;
    if (currentChatGroup && !currentChatChar) {
      const next = (currentChatGroup.messages || []).filter((m) => m.id !== messageEditor.id);
      setGroupChats((prev) => prev.map((g) => g.id === currentChatGroup.id ? { ...g, messages: next, updatedAt: Date.now() } : g));
    } else if (currentChatChar) {
      const cid = currentChatChar.id;
      const next = (chatHistory[cid] || []).filter((m) => m.id !== messageEditor.id);
      setChatHistory((h) => ({ ...h, [cid]: next }));
    } else {
      return;
    }
    setMessageEditor(null);
    setActiveMessageId(null);
    showToast(tr("訊息已刪除", "Message deleted", "メッセージを削除しました", "메시지가 삭제되었습니다"));
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
  const isInnerThoughtAutoEnabled = (charId) => innerThoughtSettings?.[charId]?.auto !== false;
  const setInnerThoughtAutoEnabled = (charId, enabled) => {
    setInnerThoughtSettings((prev) => ({
      ...(prev || {}),
      [charId]: { ...(prev?.[charId] || {}), auto: !!enabled },
    }));
  };
  const normalizeInnerThought = (text) => {
    let clean = stripInternalBlocks(String(text || ""))
      .replace(/^\s*(?:心聲|內心(?:想法|獨白)?|想法)\s*[：:]\s*/i, "")
      .replace(/^[「『\"']+|[」』\"']+$/g, "")
      .replace(/\{\{char\}\}/gi, "")
      .replace(/\{\{user\}\}/gi, getUserDisplayName())
      .replace(/\n{2,}/g, "\n")
      .trim();
    return sanitizeText(clean, 240);
  };
  const generateInnerThought = async ({ char, messageId, source = "manual", historySnapshot = null }) => {
    if (!char?.id || !messageId || innerThoughtLoading[messageId]) return;
    const fullHistory = Array.isArray(historySnapshot) ? historySnapshot : (chatHistory[char.id] || []);
    const targetIndex = fullHistory.findIndex((m) => m.id === messageId);
    if (targetIndex < 0 || fullHistory[targetIndex]?.role !== "assistant") return;
    const target = fullHistory[targetIndex];
    const replyMessages = target.replyGroupId
      ? fullHistory.slice(0, targetIndex + 1).filter((m) => m.role === "assistant" && m.replyGroupId === target.replyGroupId)
      : (() => {
          const group = [];
          for (let index = targetIndex; index >= 0 && fullHistory[index]?.role === "assistant"; index -= 1) group.unshift(fullHistory[index]);
          return group;
        })();
    const targetReply = replyMessages.map((m) => m.content || "").filter(Boolean).join("\n");
    const contextMessages = fullHistory
      .slice(0, targetIndex + 1)
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-14)
      .map((m) => ({
        role: m.role,
        content: sanitizeText(m.content || (m.image ? "[圖片]" : ""), 1200),
      }));
    const memoryContext = pickMemoriesForPrompt(char.id, contextMessages)
      .map((m, i) => `- ${i + 1}. ${m.text}`)
      .join("\n");
    const scene = chatScenes?.[char.id] || {};
    const sceneContext = [scene.location ? `地點：${sanitizeText(scene.location, 30)}` : "", scene.note ? `備註：${sanitizeText(scene.note, 100)}` : ""].filter(Boolean).join("\n");
    const prompt = `${getOutputLanguageDirective()}

你要寫的是角色「${char.name}」在目標訊息當下沒有說出口的心聲。

規則：
1. 必須使用角色第一人稱，並與目標訊息及當時劇情直接相關。
2. 只輸出心聲本身，不要角色名、標籤、引號、旁白、Markdown 或「我心想」。
3. 只寫 1 到 2 句，簡短自然，最多 80 字。
4. 可以呈現嘴硬、猶豫、期待、隱瞞或話語與真心的反差，但不要為了反差硬加感情。
5. 不要替玩家描述內心、感受或未說出口的意圖。
6. 不要使用角色在當時不可能知道的資訊，也不要參考目標訊息之後的劇情。
7. 保留曖昧與留白，不要一次揭露角色所有秘密。

${sceneContext ? `[當時場景]\n${sceneContext}\n` : ""}${memoryContext ? `[相關記憶]\n${memoryContext}\n` : ""}
目標回覆（前端可能拆成多個氣泡，但屬於同一次回覆）：
${targetReply || target.content || "（無文字）"}`;
    setInnerThoughtLoading((prev) => ({ ...prev, [messageId]: true }));
    try {
      const raw = await callAI(contextMessages, apiConfig, applyUserPlaceholder(prompt));
      const content = normalizeInnerThought(raw);
      if (!content) throw new Error(tr("模型沒有產生心聲", "No inner thought was generated", "心の声が生成されませんでした", "속마음이 생성되지 않았습니다"));
      setChatHistory((prev) => ({
        ...prev,
        [char.id]: (prev[char.id] || []).map((m) => m.id === messageId ? {
          ...m,
          innerThought: { content, generatedAt: Date.now(), source, seen: source !== "auto" },
        } : m),
      }));
      setExpandedInnerThoughts((prev) => ({ ...prev, [messageId]: source !== "auto" }));
    } catch (err) {
      showToast(`${tr("心聲生成失敗", "Failed to generate inner thought", "心の声の生成に失敗しました", "속마음 생성 실패")}：${sanitizeText(err?.message || "", 120)}`);
    } finally {
      setInnerThoughtLoading((prev) => ({ ...prev, [messageId]: false }));
    }
  };
  const renderInnerThought = (char, message) => {
    if (message?.role !== "assistant") return null;
    const thought = message.innerThought?.content || "";
    const expanded = !!expandedInnerThoughts[message.id];
    const loading = !!innerThoughtLoading[message.id];
    const unseenAutoThought = !!thought && message.innerThought?.source === "auto" && message.innerThought?.seen === false;
    const markInnerThoughtSeen = () => {
      if (!unseenAutoThought) return;
      setChatHistory((prev) => ({
        ...prev,
        [char.id]: (prev[char.id] || []).map((m) => m.id === message.id ? {
          ...m,
          innerThought: { ...m.innerThought, seen: true },
        } : m),
      }));
    };
    return (
      <div className={`mp-thought ${expanded && thought ? "expanded" : ""}`} onClick={(e) => e.stopPropagation()}>
        <div className="mp-thought-bar">
          <button
            type="button"
            className="mp-thought-peek"
            disabled={loading}
            title={thought ? tr("顯示或收起心聲", "Show or hide inner thought", "心の声を表示・非表示", "속마음 표시 또는 숨기기") : tr("窺探心聲", "Peek at inner thought", "心の声をのぞく", "속마음 엿보기")}
            onClick={() => {
              if (thought) {
                if (!expanded) markInnerThoughtSeen();
                setExpandedInnerThoughts((prev) => ({ ...prev, [message.id]: !prev[message.id] }));
              } else {
                void generateInnerThought({ char, messageId: message.id, source: "manual" });
              }
            }}
          >
            <span className={unseenAutoThought ? "mp-thought-unseen-icon" : ""} aria-hidden="true">
              <Eye size={12} strokeWidth={2.1} />
            </span>
            <span>{loading ? tr("讀取中...", "Reading...", "読込中...", "읽는 중...") : tr("心聲", "Inner thought", "心の声", "속마음")}</span>
          </button>
          {thought && (
            <button
              type="button"
              className="mp-thought-refresh"
              disabled={loading}
              title={tr("重新生成心聲", "Regenerate inner thought", "心の声を再生成", "속마음 다시 생성")}
              aria-label={tr("重新生成心聲", "Regenerate inner thought", "心の声を再生成", "속마음 다시 생성")}
              onClick={() => void generateInnerThought({ char, messageId: message.id, source: "manual" })}
            >
              <RefreshCw size={13} strokeWidth={2.1} aria-hidden="true" />
            </button>
          )}
        </div>
        {thought && expanded && <div className="mp-thought-content">{thought}</div>}
      </div>
    );
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
  const getModeLabel = (mode) => (mode === "reality" ? tr("現實模式", "Reality mode", "現実モード", "현실 모드") : tr("線上聊天", "Online chat", "オンラインチャット", "온라인 채팅"));
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
    const scene = chatScenes?.[char?.id] || {};
    const sceneText = [
      scene.location ? `地點：${sanitizeText(scene.location, 15)}` : "",
      scene.note ? `小備註：${sanitizeText(scene.note, 50)}` : "",
    ].filter(Boolean).join(" · ");
    const base = `${getOutputLanguageDirective()}\n\n${buildSystemPrompt(char, memoryContext)}${sceneText ? `\n\n[目前場景]\n${sceneText}` : ""}\n\n${buildModePrompt(selectedMode)}`;
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
    return `${getOutputLanguageDirective()}

請替角色「${char.name}」寫一則可發在社群上的近況貼文。

社群定位：
- 這是朋友或熟人可能看得到的動態，不是私訊。
- 可以融合近期聊天的主題、情緒、事件後續或衍生想法，讓角色像有自己的生活延續。
- 不可以直接複述私聊內容，不可以像在對 {{user}} 單獨說話。
- 不要提到「剛剛跟你聊」「我們私訊」「{{user}}」或玩家姓名。
- 不要公開私密、曖昧、敏感、只屬於兩人之間的細節；若要引用，只能轉成模糊的心情或日常感想。
- 不要使用第二人稱「你」指向玩家。
- 內容 20~50 字，自然像真人隨手發文，不要標題、不要引號、不要解釋。

近期私聊脈絡（只能參考主題/情緒，不可外洩原文）：
${recentChat || "（近期沒有可參考的聊天）"}

近期貼文（避免重複語氣與主題）：
${recentPosts || "（無）"}`;
  };
  const getPostAuthorName = (post) => post?.authorName || post?.charName || tr("未知", "Unknown", "不明", "알 수 없음");
  const getPostAuthorAvatar = (post) => post?.authorAvatar || post?.charAvatar || null;
  const getPostAuthorType = (post) => post?.authorType || (post?.charId ? "character" : "player");
  const getPlayerDisplayName = () => playerProfile?.nickname || playerProfile?.name || tr("你", "You", "あなた", "나");
  const getPlayerAvatar = () => sanitizeUserImageUrl(playerProfile?.avatar) || null;
  const getConnectionErrorPrefix = () => tr("連線錯誤：", "Connection error: ", "接続エラー: ", "연결 오류: ");
  const isConnectionErrorNotice = (content) => {
    const text = String(content || "");
    return text.startsWith("連線錯誤：") || text.startsWith("Connection error: ") || text.startsWith("接続エラー: ") || text.startsWith("연결 오류: ");
  };
  const getSceneState = (kind, id) => {
    if (kind === "group") return groupScenes?.[id] || { location: "", note: "" };
    return chatScenes?.[id] || { location: "", note: "" };
  };
  const getSceneLabel = (kind, id) => {
    const scene = getSceneState(kind, id);
    const bits = [
      scene.location ? sanitizeText(scene.location, 15) : "",
      scene.note ? sanitizeText(scene.note, 50) : "",
    ].filter(Boolean);
    return bits.join(" · ");
  };
  const renderSceneBar = (kind, id, title = tr("場景", "Scene", "シーン", "장면")) => {
    const scene = getSceneState(kind, id);
    const label = getSceneLabel(kind, id);
    const editing = sceneEditor?.kind === kind && sceneEditor?.id === id;
    const icon = "⌁";
    return (
      <div
        style={{
          margin: "0 14px 6px",
          padding: "0 2px",
        }}
      >
        {!editing ? (
          <div
            style={{
              fontSize: 11,
              color: "var(--mp-txt-l)",
              cursor: "pointer",
              lineHeight: 1.35,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 5,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            onClick={() => setSceneEditor({ kind, id, location: scene.location || "", note: scene.note || "" })}
          >
            <span style={{ flexShrink: 0 }}>{icon}</span>
            <span style={{ fontWeight: 800, color: "var(--mp-txt)", flexShrink: 0 }}>{title}：</span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{label || tr("點擊設定", "Tap to set", "タップして設定", "탭하여 설정")}</span>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            <input
              className="mp-sinp"
              value={sceneEditor.location}
              onChange={(e) => setSceneEditor((s) => ({ ...s, location: e.target.value.slice(0, 15) }))}
              maxLength={15}
              placeholder={tr("地點（15字內）", "Location (up to 15 chars)", "場所（15文字以内）", "장소(15자 이내)")}
            />
            <input
              className="mp-sinp"
              value={sceneEditor.note}
              onChange={(e) => setSceneEditor((s) => ({ ...s, note: e.target.value.slice(0, 50) }))}
              maxLength={50}
              placeholder={tr("小備註（50字內）", "Note (up to 50 chars)", "メモ（50文字以内）", "메모(50자 이내)")}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, alignItems: "center" }}>
              <button
                className="mp-ibtn"
                style={{ padding: "3px 9px", minHeight: 24, fontSize: 10 }}
                onClick={() => {
                  const next = {
                    location: sanitizeText(sceneEditor.location || "", 15),
                    note: sanitizeText(sceneEditor.note || "", 50),
                  };
                  if (kind === "group") {
                    setGroupScenes((prev) => ({ ...prev, [id]: next }));
                  } else {
                    setChatScenes((prev) => ({ ...prev, [id]: next }));
                  }
                  setSceneEditor(null);
                }}
              >
                {tr("完成", "Done", "完了", "완료")}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };
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
  const buildSocialCommentReplyPrompt = ({ char, post, targetComment, userText }) => `${getOutputLanguageDirective()}

社群貼文：「${post.content}」
${targetComment ? `你上一則留言：「${targetComment.content}」\n` : ""}{{user}} 回覆你：「${userText}」

請用角色「${char.name}」的口吻回覆這則社群留言。
規則：
- 這是公開/半公開社群留言，不是私訊。
- 回覆 1 句，最多 45 字。
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
    return `${getOutputLanguageDirective()}

玩家在社群發了一則公開貼文：「${post.content}」

請判斷角色「${char.name}」是否會留言，並直接輸出留言內容。
規則：
- 這是社群留言，不是私訊，不要像只對玩家一個人撒嬌或報備。
- 可以根據角色設定、近期聊天主題、記憶做自然延伸，但不可公開私聊原文或敏感細節。
- 若貼文和角色沒有強關聯，也可以用普通朋友會留下的短回應。
- 請輸出 1 句，最多 45 字，不要角色名標籤、不要引號、不要解釋。

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
            if (isConnectionErrorNotice(m.content)) return null;
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
        ? tr(
            `轉帳失敗：${char.name || "角色"} 餘額不足，無法轉出 ${formatMoney(pendingTransfer.amount)}。請之後不要當作已成功轉帳。`,
            `Transfer failed: ${char.name || "Character"} has insufficient balance and cannot transfer ${formatMoney(pendingTransfer.amount)}. Do not treat it as completed later.`,
            `送金失敗: ${char.name || "キャラ"} の残高が不足しているため、${formatMoney(pendingTransfer.amount)} を送金できません。以後、成功したものとして扱わないでください。`,
            `이체 실패: ${char.name || "캐릭터"}의 잔액이 부족해 ${formatMoney(pendingTransfer.amount)}를 보낼 수 없습니다. 이후 성공한 것으로 처리하지 마세요.`
          )
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
      const replyGroupId = gid();
      const assistantMessages = bubbles.map((content, index) => ({
        id: gid(),
        replyGroupId,
        replyGroupIndex: index,
        replyGroupSize: bubbles.length,
        role: "assistant",
        content,
        mode: selectedMode,
        time: Date.now(),
      }));
      let lastAssistantMessage = null;
      for (let i = 0; i < bubbles.length; i++) {
        const delay = i === 0 ? 420 : Math.min(1200, 520 + bubbles[i].length * 18);
        await wait(delay);
        lastAssistantMessage = { ...assistantMessages[i], time: Date.now() };
        assistantMessages[i] = lastAssistantMessage;
        setChatHistory(h => ({ ...h, [cid]: [...(h[cid] || []), lastAssistantMessage] }));
      }
      if (pendingTransfer?.amount > 0 && canApplyPendingTransfer) {
        await wait(220);
        applyCharacterTransferToPlayer({ cid, char, amount: pendingTransfer.amount, note: pendingTransfer.note, time: Date.now() });
      } else if (transferFailureNotice) {
        await wait(220);
        setChatHistory((h) => ({ ...h, [cid]: [...(h[cid] || []), { id: gid(), role: "system_notice", content: transferFailureNotice, time: Date.now() }] }));
      }
      if (lastAssistantMessage && isInnerThoughtAutoEnabled(cid) && Math.random() < 0.25) {
        const snapshot = [...nextForDisplay, ...assistantMessages];
        void generateInnerThought({ char, messageId: lastAssistantMessage.id, source: "auto", historySnapshot: snapshot });
      }
  };

  const addChatErrorNotice = (cid, err) => {
    const detail = sanitizeText(err?.message || tr("未知錯誤", "Unknown error", "不明なエラー", "알 수 없는 오류"), 500);
    setChatHistory(h => ({ ...h, [cid]: [...(h[cid] || []), { id: gid(), role: "system_notice", content: `${getConnectionErrorPrefix()}${detail}`, time: Date.now() }] }));
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
        showToast(tr("圖片格式不支援", "Unsupported image format", "画像形式に対応していません", "이미지 형식을 지원하지 않습니다"));
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
          showToast(tr("圖片壓縮到最低設定後仍超過 1MB，請改用裁切圖或內容更簡單的圖片", "Even after maximum compression, the image is still over 1MB. Please use a cropped or simpler image.", "最小圧縮後も1MBを超えています。トリミングした画像か、よりシンプルな画像を使ってください。", "최저 압축 후에도 1MB를 초과합니다. 잘라낸 이미지나 더 단순한 이미지를 사용해주세요."));
          return;
        }
        setChatImage(picked);
        showToast(`已壓縮圖片 ${picked.width}x${picked.height} / ${Math.round(picked.bytes / 1024)}KB`);
      };
      imgEl.onerror = () => showToast(tr("圖片讀取失敗", "Image load failed", "画像の読み込みに失敗しました", "이미지 읽기에 실패했습니다"));
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
      pinned: !!c.pinned,
      voiceSettings: normalizeCharacterVoiceSettings(c.voiceSettings),
    };
    setCharacters(p => [...p, nc]);
    if (!activeCharId) setActiveCharId(nc.id);
    setModal(null);
    showToast(`${nc.name} 已加入`);
  };
  const updateCharacter = (id, patch) => {
    setCharacters((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch, voiceSettings: normalizeCharacterVoiceSettings(patch.voiceSettings ?? c.voiceSettings), avatar: sanitizeUserImageUrl(patch.avatar ?? c.avatar) || null, statusText: sanitizeText((patch.statusText ?? c.statusText) || "", 80), pinned: typeof patch.pinned === "boolean" ? patch.pinned : !!c.pinned } : c)));
    setModal(null);
    setEditingCharacter(null);
    showToast(tr("角色已更新", "Character updated", "キャラを更新しました", "캐릭터가 업데이트되었습니다"));
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
        voiceSettings: char.voiceSettings || createDefaultVoiceSettings(),
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
    showToast(`${char.name || tr("角色", "character", "キャラ", "캐릭터")} ${tr("已匯出", "exported", "書き出しました", "내보냈습니다")}`);
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
      chatBackgrounds,
      groupChats,
      chatScenes,
      groupScenes,
      innerThoughtSettings,
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
      ttsConfig,
      themeName,
      uiLanguage,
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
    showToast(tr("資料已匯出", "Data exported", "データを書き出しました", "데이터를 내보냈습니다"));
  };
  const deleteChatroomForCharacter = (charId, charName = "這個角色") => {
    if (!charId) return;
    const firstConfirm = window.confirm(`確定要刪除「${charName}」的聊天室嗎？這只會清掉對話，不會刪除角色本身。`);
    if (!firstConfirm) return;
    const secondConfirm = window.confirm(tr("請再次確認：刪除後將無法復原這個聊天室的對話紀錄，確定要繼續嗎？", "Please confirm again: this chat history cannot be restored after deletion. Continue?", "再確認してください。削除後はこのチャット履歴を復元できません。続けますか？", "다시 확인해주세요. 삭제 후에는 이 채팅 기록을 복구할 수 없습니다. 계속할까요?"));
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
    setChatBackgrounds((prev) => {
      const next = { ...prev };
      delete next[charId];
      return next;
    });
    setChatScenes((prev) => {
      const next = { ...prev };
      delete next[charId];
      return next;
    });
    setInnerThoughtSettings((prev) => {
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
    showToast(tr("聊天室已刪除", "Chatroom deleted", "チャットルームを削除しました", "채팅방을 삭제했습니다"));
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
      chatBackground: chatBackgrounds?.[charId] || "",
      chatLorebookBinding: chatLorebookBindings?.[charId] || null,
      innerThoughtSetting: innerThoughtSettings?.[charId] || null,
    };
    const safeName = sanitizeText(charName || "chatroom", 40).replace(/[\\/:*?"<>|]+/g, "_").trim() || "chatroom";
    const dateTag = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    downloadJsonFile(payload, `chat_${safeName}_${dateTag}.json`);
    showToast(tr("聊天室已匯出", "Chatroom exported", "チャットルームを書き出しました", "채팅방을 내보냈습니다"));
  };
  const summarizeImportedChatroom = (incoming) => {
    const src = incoming?.format === "maliphone-chatroom" ? incoming : incoming?.chatHistory ? incoming : null;
    return {
      format: incoming?.format === "maliphone-chatroom" ? "maliphone-chatroom" : "legacy",
      exportedAt: incoming?.exportedAt || null,
      messages: Array.isArray(src?.chatHistory) ? src.chatHistory.length : 0,
      hasMode: !!src?.chatMode,
      hasBackground: !!src?.chatBackground,
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
      showToast(`${tr("匯入失敗", "Import failed", "インポートに失敗しました", "가져오기에 실패했습니다")}：${sanitizeText(err?.message || tr("未知錯誤", "Unknown error", "不明なエラー", "알 수 없는 오류"), 80)}`);
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
    if (!window.confirm(tr("確認匯入後，將覆蓋這個聊天室的對話紀錄。確定要繼續嗎？", "Import will overwrite this chatroom's conversation history. Continue?", "インポートするとこのチャットルームの会話履歴が上書きされます。続けますか？", "가져오기를 하면 이 채팅방의 대화 기록이 덮어써집니다. 계속할까요?"))) return;
    const chatHistoryItems = Array.isArray(raw?.chatHistory)
      ? raw.chatHistory
      : Array.isArray(raw?.messages)
        ? raw.messages
        : Array.isArray(raw)
          ? raw
          : [];
    const targetName = currentChatChar?.id === targetId ? currentChatChar.name : (characters.find((c) => c.id === targetId)?.name || tr("這個角色", "this character", "このキャラ", "이 캐릭터"));
    setChatHistory((prev) => ({ ...prev, [targetId]: chatHistoryItems }));
    if (raw?.chatMode) {
      setChatModes((prev) => ({ ...prev, [targetId]: raw.chatMode }));
    }
    if (Object.prototype.hasOwnProperty.call(raw || {}, "chatBackground")) {
      setChatBackgrounds((prev) => ({ ...prev, [targetId]: normalizeChatBackground(raw.chatBackground) }));
    }
    if (raw?.chatLorebookBinding) {
      setChatLorebookBindings((prev) => ({ ...prev, [targetId]: raw.chatLorebookBinding }));
    }
    if (raw?.innerThoughtSetting) {
      setInnerThoughtSettings((prev) => ({ ...prev, [targetId]: raw.innerThoughtSetting }));
    }
    if (currentChatChar?.id === targetId) {
      setChatActionPanelOpen(false);
      setMessageEditor(null);
      setActiveMessageId(null);
      setIsTyping(false);
      setChatInput("");
    }
    showToast(tr("聊天室已匯入", "Chatroom imported", "チャットルームを取り込みました", "채팅방을 가져왔습니다").replace("聊天室", targetName));
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
      chatBackgrounds: src?.chatBackgrounds && typeof src.chatBackgrounds === "object" ? Object.keys(src.chatBackgrounds).length : 0,
      groupChats: Array.isArray(src?.groupChats) ? src.groupChats.length : 0,
      scenes: (src?.chatScenes && typeof src.chatScenes === "object" ? Object.keys(src.chatScenes).length : 0) + (src?.groupScenes && typeof src.groupScenes === "object" ? Object.keys(src.groupScenes).length : 0),
      posts: Array.isArray(src?.posts) ? src.posts.length : 0,
      lorebooks: Array.isArray(src?.lorebooks) ? src.lorebooks.length : 0,
      playerProfile: !!src?.playerProfile,
    };
  };
  const applyImportedAppState = async (incoming) => {
    const src = incoming?.state && incoming?.format === "maliphone-app-state" ? incoming.state : incoming;
    if (!src || typeof src !== "object") throw new Error(tr("檔案內容不正確", "Invalid file content", "ファイル内容が正しくありません", "파일 내용이 올바르지 않습니다"));
    const nextState = {
      ...defaultAppState,
      characters: Array.isArray(src.characters) ? src.characters : [],
      activeCharId: src.activeCharId ?? null,
      chatHistory: src.chatHistory && typeof src.chatHistory === "object" ? src.chatHistory : {},
      chatModes: src.chatModes && typeof src.chatModes === "object" ? src.chatModes : {},
      chatBackgrounds: src.chatBackgrounds && typeof src.chatBackgrounds === "object" ? src.chatBackgrounds : {},
      groupChats: Array.isArray(src.groupChats) ? src.groupChats : [],
      chatScenes: src.chatScenes && typeof src.chatScenes === "object" ? src.chatScenes : {},
      groupScenes: src.groupScenes && typeof src.groupScenes === "object" ? src.groupScenes : {},
      innerThoughtSettings: src.innerThoughtSettings && typeof src.innerThoughtSettings === "object" ? src.innerThoughtSettings : {},
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
      ttsConfig: src.ttsConfig && typeof src.ttsConfig === "object" ? {
        ...defaultAppState.ttsConfig,
        ...src.ttsConfig,
        elevenlabs: { ...defaultAppState.ttsConfig.elevenlabs, ...(src.ttsConfig.elevenlabs || {}) },
        minimax: { ...defaultAppState.ttsConfig.minimax, ...(src.ttsConfig.minimax || {}) },
      } : defaultAppState.ttsConfig,
      themeName: src.themeName || defaultAppState.themeName,
      uiLanguage: src.uiLanguage || defaultAppState.uiLanguage,
      homeSlots: Array.isArray(src.homeSlots) && src.homeSlots.length === HOME_SLOT_COUNT ? src.homeSlots : Array.from({ length: HOME_SLOT_COUNT }, () => null),
      dockOrder: Array.isArray(src.dockOrder) && src.dockOrder.length ? src.dockOrder : DOCK_APPS,
    };
    setCharacters(nextState.characters);
    setActiveCharId(nextState.activeCharId);
    setChatHistory(nextState.chatHistory);
    setChatModes(nextState.chatModes);
    setChatBackgrounds(nextState.chatBackgrounds);
    setGroupChats(nextState.groupChats);
    setChatScenes(nextState.chatScenes);
    setGroupScenes(nextState.groupScenes);
    setInnerThoughtSettings(nextState.innerThoughtSettings);
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
    setTtsConfig(nextState.ttsConfig);
    setThemeName(nextState.themeName);
    setUiLanguage(nextState.uiLanguage);
    setHomeSlots(nextState.homeSlots);
    setDockOrder(nextState.dockOrder);
    setActiveLorebookId(nextState.lorebooks[0]?.id || null);
    setCurrentChatChar(null);
    setCurrentChatGroup(null);
    setChatBgEditor(null);
    setChatSettingsBackgroundOpen(false);
    setChatSettingsLorebookOpen(false);
    setChatroomManageOpen(false);
    setChatSettingsExpandedBooks({});
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
      showToast(`${tr("匯入失敗", "Import failed", "インポートに失敗しました", "가져오기에 실패했습니다")}：${sanitizeText(err?.message || tr("未知錯誤", "Unknown error", "不明なエラー", "알 수 없는 오류"), 80)}`);
      if (dataImportRef.current) dataImportRef.current.value = "";
      setDataImporting(false);
    } finally {
      if (dataImportRef.current) dataImportRef.current.value = "";
    }
  };
  const confirmImportPreview = async () => {
    if (!dataImportPreview?.raw) return;
    if (!window.confirm(tr("確認匯入後，將覆蓋目前裝置上的全域資料。確定要繼續嗎？", "Import will overwrite the current device's global data. Continue?", "インポートすると現在の端末の全体データが上書きされます。続けますか？", "가져오기를 하면 현재 기기의 전체 데이터가 덮어써집니다. 계속할까요?"))) return;
    try {
      await applyImportedAppState(dataImportPreview.raw);
      showToast(tr("資料已匯入", "Data imported", "データを取り込みました", "데이터를 가져왔습니다"));
      setDataImportPreview(null);
    } catch (err) {
      showToast(`${tr("匯入失敗", "Import failed", "インポートに失敗しました", "가져오기에 실패했습니다")}：${sanitizeText(err?.message || tr("未知錯誤", "Unknown error", "不明なエラー", "알 수 없는 오류"), 80)}`);
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
    const msgs = (chatHistory[charId] || [])
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-12);
    if (!force && msgs.length === 0) return;
    if (!canUseCurrentProvider()) { showToast(tr("請先完成 AI 連線設定（API Key）", "Please finish AI connection setup (API key) first", "先にAI接続設定（APIキー）を完了してください", "먼저 AI 연결 설정(API 키)을 완료해주세요")); return; }
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
        ? `${getOutputLanguageDirective()}\n\n請只輸出 1 句手機狀態文字，20~40 字，自然像角色正在發狀態。\n不要輸出角色設定摘要、年齡、職業、人格標籤、草稿、規則文字、Markdown 或解釋。\n\n角色：${char.name}\n${roleProfile ? `角色背景（只供參考，不要複述）：\n${roleProfile}\n\n` : ""}最近對話：\n${conv}\n${mems ? `\n參考記憶：\n${mems}\n` : ""}`
        : `${getOutputLanguageDirective()}\n\n請根據以下資訊，生成一則「符合角色人設」的手機狀態文字。\n規則：僅輸出 1 句，20~40 字，口語自然、對外可見，不要內心獨白、不要動作描述、不要引號包整句。\n\n角色：${char.name}\n${roleProfile ? `角色資料：\n${roleProfile}\n\n` : ""}最近對話：\n${conv}\n${mems ? `\n參考記憶：\n${mems}\n` : ""}`;
      const status = sanitizeText(stripInternalBlocks(await callAI([{ role: "user", content: statusPrompt }], apiConfig, "你是狀態文字助理。")), 80);
      if (!status) { showToast("未取得狀態內容"); return; }
      setCharacters((prev) => prev.map((c) => c.id === charId ? { ...c, statusText: status, statusUpdatedAt: Date.now() } : c));
      showToast("狀態已更新");
    } catch (err) {
      showToast(`${tr("刷新失敗", "Refresh failed", "更新に失敗しました", "새로고침 실패")}：${sanitizeText(err?.message || tr("未知錯誤", "Unknown error", "不明なエラー", "알 수 없는 오류"), 120)}`);
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
        showToast(tr("釘選最多 5 條", "You can pin up to 5 items.", "固定できるのは最大5件です。", "최대 5개까지 고정할 수 있습니다."));
        return prev;
      }
      arr[idx] = { ...target, pinned: !target.pinned };
      return { ...prev, [charId]: arr };
    });
  };
  const deleteMemory = (charId, memoryId) => {
    if (!window.confirm(tr("確定要刪除這條記憶嗎？", "Delete this memory?", "このメモリを削除しますか？", "이 기억을 삭제할까요?"))) return;
    setMemories((prev) => ({ ...prev, [charId]: (prev[charId] || []).filter((x) => x.id !== memoryId) }));
    showToast(tr("記憶已刪除", "Memory deleted", "メモリを削除しました", "기억이 삭제되었습니다"));
  };
  const deleteCharacter = (id) => {
    const c = characters.find(x => x.id === id);
    setCharacters(p => p.filter(x => x.id !== id));
    if (activeCharId === id) setActiveCharId(characters.find(x => x.id !== id)?.id || null);
    setChatHistory(h => { const n = { ...h }; delete n[id]; return n; });
    setChatModes(h => { const n = { ...h }; delete n[id]; return n; });
    setChatBackgrounds(h => { const n = { ...h }; delete n[id]; return n; });
    setChatScenes(h => { const n = { ...h }; delete n[id]; return n; });
    setChatLorebookBindings(h => { const n = { ...h }; delete n[id]; return n; });
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
    if (!canUseCurrentProvider()) { showToast(tr("請先完成 AI 連線設定（API Key）", "Please finish AI connection setup (API key) first", "先にAI接続設定（APIキー）を完了してください", "먼저 AI 연결 설정(API 키)을 완료해주세요")); return; }
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
      showToast(`${tr("生成失敗", "Generation failed", "生成に失敗しました", "생성 실패")}：${sanitizeText(err?.message || tr("未知錯誤", "Unknown error", "不明なエラー", "알 수 없는 오류"), 120)}`);
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
        content: `${getOutputLanguageDirective()}

你要為角色「${char.name}」整理長期記憶，務必嚴格遵守角色人設。
規則：
1) 只能輸出 1 則記憶，20~80 字。
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
      if (!safeText || safeText.length < 8) throw new Error(tr("模型未產生有效記憶", "The model did not generate a valid memory", "モデルが有効なメモリを生成しませんでした", "모델이 유효한 기억을 생성하지 않았습니다"));
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
    if (!canUseCurrentProvider()) { showToast(tr("請先完成 AI 連線設定（API Key）", "Please finish AI connection setup (API key) first", "先にAI接続設定（APIキー）を完了してください", "먼저 AI 연결 설정(API 키)을 완료해주세요")); return; }
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
        showToast(tr("貼文已發佈；角色回覆需先完成 AI 連線設定", "Post published; AI connection is required for replies", "投稿しました。キャラの返信には先にAI接続設定が必要です。", "게시물이 등록되었습니다. 캐릭터 답글에는 먼저 AI 연결 설정이 필요합니다."));
      return;
    }
    setPlayerPostSubmitting(true);
    showToast(tr(`貼文已發佈，等待 ${responders.length} 則角色回覆`, `Post published, waiting for ${responders.length} replies`, `投稿しました。${responders.length}件のキャラ返信を待っています`, `게시물이 등록되었습니다. 캐릭터 답글 ${responders.length}개를 기다리는 중입니다`));
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
    .mp-lock-hint{max-width:min(82vw,320px);padding:0 12px;text-align:center;line-height:1.4;word-break:keep-all;overflow-wrap:anywhere;font-size:12px;}
    .mp-page{background:${activeTheme?.surfaces?.pageBg || "linear-gradient(180deg,#fce4ec 0%,#fff 30%)"};}
    ${isNightTheme ? `
      .mp-page{background:${activeTheme.surfaces.pageBg};}
      .mp-cr{background:linear-gradient(180deg,rgba(36,27,51,.97),rgba(26,22,37,.99));}
      .mp-bar,.mp-hdr,.mp-inp-bar,.mp-dock{background:rgba(26,22,37,.95);border-color:#3a2d4f;}
      .mp-modal,.mp-sg,.mp-cc,.mp-post,.mp-sc,.mp-cw,.mp-transfer-card{background:rgba(36,27,51,.95);border-color:#3a2d4f;box-shadow:0 8px 24px rgba(7,4,12,.26);}
      .mp-icon-c,.mp-dock-i,.mp-back{background:rgba(47,36,64,.9);border-color:#3a2d4f;box-shadow:0 3px 12px rgba(7,4,12,.24);}
      .mp-icon-c:hover,.mp-dock-i:hover,.mp-cw:hover{background:rgba(58,45,79,.96);box-shadow:0 5px 16px rgba(7,4,12,.3);}
      .mp-chat-switch,.mp-mode-tabs{background:rgba(47,36,64,.72);border-color:#3a2d4f;box-shadow:none;}
      .mp-chat-switch-btn{color:#b8a8c9;}
      .mp-chat-switch-btn.active{color:#f0e6f5;background:rgba(244,143,177,.18);box-shadow:0 2px 8px rgba(7,4,12,.2);}
      .mp-chat-row,.mp-ci{border-color:rgba(122,107,138,.24);}
      .mp-chat-row:hover,.mp-chat-row.pinned:hover,.mp-ci:hover{background:rgba(255,255,255,.055);}
      .mp-chat-row:active{background:rgba(244,143,177,.1);}
      .mp-msg-ai{background:#2f2440;color:#f0e6f5;border-color:#3a2d4f;box-shadow:0 2px 8px rgba(7,4,12,.2);}
      .mp-msg-user{background:linear-gradient(135deg,#ec6a95,#d95e88);color:#fff;box-shadow:0 2px 8px rgba(7,4,12,.22);}
      .mp-msg-ai .mp-msg-t{color:#9384a2;}
      .mp-msg-user .mp-msg-t{color:rgba(255,255,255,.72);}
      .mp-reality-msg{background:transparent;border-color:transparent;box-shadow:none;color:#c9b8da;}
      .mp-reality-user .mp-reality-msg{background:linear-gradient(135deg,#465d79,#394b66);color:#f4f8fc;box-shadow:inset 0 0 0 1px rgba(165,201,232,.22),0 2px 10px rgba(7,4,12,.22);}
      .mp-reality-ai .mp-reality-msg{background:transparent;color:#b5a3c4;box-shadow:none;}
      .mp-reality-dialogue{color:#fff7fc;font-weight:400;}
      .mp-reality-thought{color:#d9a6e8;font-style:italic;font-weight:600;}
      .mp-reality-strong{color:#ff91b8;font-weight:800;}
      .mp-mode-sep{color:#a5c9e8;}
      .mp-mode-sep::before{background:linear-gradient(90deg,rgba(165,201,232,0),rgba(165,201,232,.42));}
      .mp-mode-sep::after{background:linear-gradient(90deg,rgba(165,201,232,.42),rgba(165,201,232,0));}
      .mp-mode-sep span{background:#26384d;border-color:rgba(165,201,232,.34);color:#c5def2;}
      .mp-chat-mode-reality .mp-inp-bar{background:rgba(30,24,43,.97);border-top-color:rgba(165,201,232,.28);box-shadow:0 -6px 18px rgba(7,4,12,.22);}
      .mp-chat-mode-reality .mp-inp{background:#292039;border-color:rgba(165,201,232,.24);}
      .mp-chat-mode-reality .mp-btn-send{background:linear-gradient(135deg,#a5c9e8,#7ba8d1);color:#1a1625;}
      .mp-thought-content{background:rgba(47,36,64,.72);border-color:rgba(200,168,224,.5);}
      .mp-inp,.mp-sinp,.mp-ssel,.mp-ta{background:#2f2440;color:#f0e6f5;border-color:#3a2d4f;}
      .mp-ssel option{background:#241b33;color:#f0e6f5;}
      .mp-inp:focus,.mp-sinp:focus,.mp-ta:focus{border-color:#7ba8d1;}
      .mp-inp::placeholder,.mp-sinp::placeholder,.mp-ta::placeholder{color:#9384a2;}
      .mp-cw-desc,.mp-ci-prev,.mp-lbl,.mp-mode-hint{color:#b8a8c9;}
      .mp-msg-t,.mp-reality-t,.mp-char-counter{color:#81728f;}
      .mp-htitle,.mp-clock-big,.mp-clock-day,.mp-lock-time,.mp-cw-name,.mp-ctitle,.mp-sec-ct,.mp-persona,.mp-icon-l{color:#f0e6f5;}
      .mp-ibtn,.mp-ibtn-chat{background:rgba(165,201,232,.1);border-color:rgba(165,201,232,.3);color:#a5c9e8;}
      .mp-ibtn-view{background:rgba(130,177,255,.12);border-color:rgba(130,177,255,.34);color:#a9c8ff;}
      .mp-ibtn-r{background:rgba(229,115,115,.1);border-color:rgba(229,115,115,.28);color:#ef9696;}
      .mp-badge-enabled{background:rgba(129,199,132,.16);color:#9bd29e;}
      .mp-badge-disabled{background:rgba(122,107,138,.18);color:#b8a8c9;}
      .mp-lorebook-content{background:#2f2440;border-color:#3a2d4f;color:#f0e6f5;}
      .mp-btn-img{background:rgba(47,36,64,.9);color:#f0e6f5;border-color:#3a2d4f;}
      .mp-btn-img.active{background:rgba(165,201,232,.14);color:#a5c9e8;border-color:rgba(165,201,232,.32);}
      .mp-save{background:linear-gradient(135deg,#f48fb1,#ec6a95);color:#1a1625;}
      .mp-mode-tab{color:#b8a8c9;}
      .mp-mode-tab.active{background:#3a2d4f;color:#f0e6f5;box-shadow:0 2px 8px rgba(7,4,12,.24);}
      .mp-msg-note{background:rgba(47,36,64,.72);border-color:#3a2d4f;color:#b8a8c9;}
      .mp-msg-editbtn{background:#2f2440;border-color:rgba(165,201,232,.34);color:#a5c9e8;box-shadow:0 2px 7px rgba(7,4,12,.32);}
      .mp-msg-editbtn:hover{background:#3a2d4f;border-color:rgba(165,201,232,.52);color:#c5def2;}
      .mp-msg-editbtn + .mp-msg-editbtn{border-color:rgba(229,115,115,.34);color:#e98a8a;}
      .mp-msg-editbtn + .mp-msg-editbtn:hover{border-color:rgba(229,115,115,.52);color:#ffaaaa;}
      .mp-page-dot{background:rgba(255,255,255,.2);}
      .mp-page-dot.active{background:#f48fb1;}
      .mp-scroll-bottom{color:#f0e6f5;filter:drop-shadow(0 1px 3px rgba(7,4,12,.78));}
    ` : ``}
  `;

  if (locked) return (<><style>{css}</style><style>{themeCss}</style><div className="mp-wrap"><div className="mp-phone"><div className={`mp-lock ${unlocking?"out":""}`} onTouchStart={onLockTouchStart} onTouchEnd={onLockTouchEnd} onMouseDown={onLockMouseDown} onMouseUp={onLockMouseUp} onPointerDown={onLockPointerDown} onPointerUp={onLockPointerUp} onDoubleClick={handleUnlock}><BarClock ft={ft} hideTime /><LockClock ft={ft} fd={fd} /><div className="mp-lock-hint">{tr("向上滑動解鎖 MaliPhone（或雙擊）", "Swipe up to unlock MaliPhone (or double-click)", "MaliPhone を上にスワイプしてロック解除（またはダブルクリック）", "MaliPhone을 위로 밀어 잠금 해제(또는 더블클릭)")}</div></div></div></div></>);

  const localizedAppById = {
    chat: { ...DEFAULT_APPS.find((a) => a.id === "chat"), name: t("chat") },
    status: { ...DEFAULT_APPS.find((a) => a.id === "status"), name: t("status") },
    social: { ...DEFAULT_APPS.find((a) => a.id === "social"), name: t("social") },
    gallery: { ...DEFAULT_APPS.find((a) => a.id === "gallery"), name: t("gallery") },
    lorebook: { ...DEFAULT_APPS.find((a) => a.id === "lorebook"), name: t("lorebook") },
    player: { ...DEFAULT_APPS.find((a) => a.id === "player"), name: t("player") },
    wallet: { ...DEFAULT_APPS.find((a) => a.id === "wallet"), name: t("wallet") },
    game: { ...DEFAULT_APPS.find((a) => a.id === "game"), name: t("gameCenter") },
    lbook: { ...DEFAULT_APPS.find((a) => a.id === "lbook"), name: t("answerBook") },
    notebook: { ...DEFAULT_APPS.find((a) => a.id === "notebook"), name: t("notebook") },
    settings: { ...DEFAULT_APPS.find((a) => a.id === "settings"), name: t("settings") },
    characters: { ...DEFAULT_APPS.find((a) => a.id === "characters"), name: t("characters") },
    phone: { ...DEFAULT_APPS.find((a) => a.id === "phone"), name: t("phone") },
  };
  const appById = Object.fromEntries(DEFAULT_APPS.map(a => [a.id, localizedAppById[a.id] || a]));
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
        <div className="mp-hdr"><div className="mp-back" onClick={closeApp}>←</div><div className="mp-htitle">{t("status")}</div></div>
        <div className="mp-cm">
          {characters.length === 0 ? <div className="mp-empty"><div className="mp-empty-i">🧩</div><div className="mp-empty-t">{tr("目前尚未建立角色", "No characters yet", "まだキャラがありません", "아직 캐릭터가 없습니다")}</div></div>
          : characters.map(c => {
            const msgs = chatHistory[c.id] || [];
            const dialogueMsgs = msgs.filter((m) => m.role === "user" || m.role === "assistant");
            const mems = memories[c.id] || [];
            const uMsgs = dialogueMsgs.filter(m => m.role === "user").length;
            const assistantReplyKeys = new Set(
              dialogueMsgs
                .filter((m) => m.role === "assistant")
                .map((m) => m.replyGroupId || m.id)
            );
            const aMsgs = assistantReplyKeys.size;
            const conversationCount = uMsgs + aMsgs;
            const firstD = dialogueMsgs.length > 0 ? new Date(dialogueMsgs[0].time).toLocaleDateString("zh-TW") : "--";
            const lastD = dialogueMsgs.length > 0 ? new Date(dialogueMsgs[dialogueMsgs.length-1].time).toLocaleDateString("zh-TW") : "--";
            const days = msgs.length > 0 ? Math.max(1, Math.ceil((Date.now() - msgs[0].time) / 86400000)) : 0;
            const exp = statusExpandedCharId === c.id;
            const memoryExpanded = statusMemoryExpandedCharId === c.id;
            return (
              <div key={c.id} className="mp-sc">
                <div className="mp-sc-ban" />
                <div className="mp-sc-avl">{sanitizeUserImageUrl(c.avatar) ? <img src={sanitizeUserImageUrl(c.avatar)} alt="" /> : "🦊"}</div>
                <div className="mp-sc-body">
                  <div className="mp-sc-nm">{c.name}</div>
                  <div style={{fontSize:12,color:"var(--mp-txt-l)",marginTop:4,lineHeight:1.5}}>{(c.statusText || tr("尚無狀態", "No status yet", "まだステータスがありません", "아직 상태가 없습니다")).slice(0,80)}</div>
                  {c.statusUpdatedAt ? <div style={{fontSize:10,color:"var(--mp-txt-l)",opacity:.8,marginTop:2}}>{tr("更新時間", "Updated", "更新時刻", "업데이트 시간")}：{new Date(c.statusUpdatedAt).toLocaleTimeString("zh-TW",{hour:"2-digit",minute:"2-digit"})}</div> : null}
                  <div style={{marginTop:6}}>
                    <button className="mp-ibtn" onClick={()=>refreshCharacterStatus(c.id, true)}>{tr("刷新狀態", "Refresh status", "ステータスを更新", "상태 새로고침")}</button>
                  </div>
                  {c.tags?.length > 0 && <div className="mp-sc-tags">{c.tags.map((t,i) => <span key={i} className="mp-tag">{t}</span>)}</div>}
                  {c.creator && <div style={{fontSize:10,color:"var(--mp-txt-l)",marginTop:4}}>by {c.creator}</div>}
                  <div className="mp-sc-stats">
                    <div className="mp-stat"><div className="mp-stat-v">{conversationCount}</div><div className="mp-stat-lb">{tr("訊息", "Messages", "メッセージ", "메시지")}</div></div>
                    <div className="mp-stat"><div className="mp-stat-v">{days}</div><div className="mp-stat-lb">{tr("互動天數", "Days", "日数", "일수")}</div></div>
                    <div className="mp-stat"><div className="mp-stat-v">{mems.length}</div><div className="mp-stat-lb">{tr("記憶", "Memories", "記憶", "기억")}</div></div>
                    <div className="mp-stat"><div className="mp-stat-v">{posts.filter(p=>p.charId===c.id).length}</div><div className="mp-stat-lb">{tr("貼文", "Posts", "投稿", "게시물")}</div></div>
                  </div>
                  <div className="mp-sec">
                    <div className="mp-sec-t">{tr("對話摘要", "Conversation summary", "会話要約", "대화 요약")}</div>
                    <div className="mp-sec-ct">
                      <div className="mp-sec-row"><span>{tr("使用者訊息", "User messages", "ユーザーメッセージ", "사용자 메시지")}</span><span style={{color:"var(--mp-pink-dk)"}}>{uMsgs}</span></div>
                      <div className="mp-sec-row"><span>{c.name} {tr("回覆", "replies", "の返信", "응답")}</span><span style={{color:"var(--mp-purple)"}}>{aMsgs}</span></div>
                      <div className="mp-sec-row"><span>{tr("首次對話", "First chat", "最初の会話", "첫 대화")}</span><span>{firstD}</span></div>
                      <div className="mp-sec-row"><span>{tr("最近對話", "Latest chat", "最近の会話", "최근 대화")}</span><span>{lastD}</span></div>
                    </div>
                  </div>
                  <div className="mp-sec">
                    <div
                      className="mp-sec-t mp-sec-t-toggle"
                      onClick={() => setStatusMemoryExpandedCharId(memoryExpanded ? null : c.id)}
                    >
                      <span>{tr("記憶片段", "Memory snippets", "記憶スニペット", "기억 조각")}</span>
                      <span className="mp-sec-toggle-tag">{memoryExpanded ? tr("收起", "Collapse", "折りたたむ", "접기") : tr("展開", "Expand", "展開", "펼치기")}</span>
                    </div>
                    {memoryExpanded && (
                      <>
                        {mems.length === 0 ? <div style={{fontSize:11,color:"var(--mp-txt-l)",textAlign:"center",padding:6}}>{tr("目前尚無記憶，點擊下方按鈕可生成", "No memories yet. Tap the button below to generate one.", "まだ記憶がありません。下のボタンで生成できます。", "아직 기억이 없습니다. 아래 버튼을 눌러 생성할 수 있습니다.")}</div>
                    : <div className="mp-tl">{[...mems].sort((a, b) => {
                      if (!!b.pinned !== !!a.pinned) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
                      return (b.date || 0) - (a.date || 0);
                    }).slice(0, 5).map((m,i) => (
                      <div key={m.id || i} className="mp-tl-item">
                        <div className="mp-tl-dot" style={{top:6}} />
                        <div className="mp-mem" onClick={() => setActiveMemoryId((p) => (p === m.id ? null : m.id))}>{m.text}</div>
                        <div className="mp-mem-d" style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:6}}>
                          <span>{new Date(m.date).toLocaleDateString("zh-TW")}{m.pinned ? ` · ${tr("已釘選", "Pinned", "固定済み", "고정됨")}` : ""}</span>
                          <span style={{display:"flex",gap:6}}>
                            <button className={`mp-ibtn ${activeMemoryId===m.id?"":"mp-ibtn-hidden"}`} onClick={() => setMemoryEditor({ charId: c.id, memoryId: m.id, text: m.text || "" })}>✎</button>
                            <button className={`mp-ibtn ${activeMemoryId===m.id?"":"mp-ibtn-hidden"}`} onClick={() => togglePinMemory(c.id, m.id)}>{m.pinned ? "📌" : "📍"}</button>
                            <button className={`mp-ibtn-r ${activeMemoryId===m.id?"":"mp-ibtn-hidden"}`} onClick={() => deleteMemory(c.id, m.id)}>🗑</button>
                          </span>
                        </div>
                      </div>
                    ))}</div>}
                        <button className="mp-gbtn" onClick={() => generateMemory(c)} disabled={genLoading}>{genLoading ? tr("生成中...", "Generating...", "生成中...", "생성 중...") : tr("生成記憶", "Generate memory", "記憶を生成", "기억 생성")}</button>
                      </>
                    )}
                  </div>
                  <div className="mp-sec">
                    <div className="mp-sec-t" style={{cursor:"pointer"}} onClick={() => setStatusExpandedCharId(exp ? null : c.id)}>
                      {tr("角色設定", "Character settings", "キャラ設定", "캐릭터 설정")} {exp ? tr("收起", "Collapse", "折りたたむ", "접기") : tr("展開", "Expand", "展開", "펼치기")}
                    </div>
                    {exp && (
                      <div className="mp-persona">
                        {c.description && <><strong>{tr("角色設定", "Description", "説明", "설명")}：</strong>{c.description}{"\n\n"}</>}
                        {c.systemPrompt && <><strong>{tr("System Prompt", "System prompt", "システムプロンプト", "시스템 프롬프트")}：</strong>{c.systemPrompt}{"\n\n"}</>}
                        {c.personality && <><strong>{tr("個性", "Personality", "個性", "개성")}：</strong>{c.personality}{"\n\n"}</>}
                        {c.scenario && <><strong>{tr("情境", "Scenario", "シナリオ", "상황")}：</strong>{c.scenario}</>}
                        {!c.description && !c.systemPrompt && !c.personality && !c.scenario && (
                          <div style={{color:"var(--mp-txt-l)"}}>{tr("目前沒有可顯示的角色設定。", "No character settings to display yet.", "表示できるキャラ設定はまだありません。", "표시할 캐릭터 설정이 없습니다.")}</div>
                        )}
                      </div>
                    )}
                  </div>
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
    const re = /(\*\*[^*\n]{1,500}\*\*|__[^_\n]{1,500}__|「[^」]{1,500}」|"[^"\n]{1,500}"|\*[^*\n]{1,500}\*|_[^_\n]{1,500}_)/g;
    let last = 0;
    let match;
    while ((match = re.exec(raw))) {
      if (match.index > last) nodes.push(raw.slice(last, match.index));
      const token = match[0];
      if (token.startsWith("**") || token.startsWith("__")) {
        nodes.push(<strong key={`b-${match.index}`} className="mp-reality-strong">{token.slice(2, -2)}</strong>);
      } else if (token.startsWith("「") || token.startsWith("\"")) {
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
  const getChatThreadSortMeta = (char) => {
    const msgs = chatHistory[char?.id] || [];
    const lastMsg = msgs[msgs.length - 1] || null;
    const lastAt = Number(lastMsg?.time || 0);
    const pinned = !!char?.pinned || !!char?.chatPinned;
    return { pinned, lastAt, name: String(char?.name || "") };
  };
  const sortChatThreads = (list) => [...list].sort((a, b) => {
    const am = getChatThreadSortMeta(a);
    const bm = getChatThreadSortMeta(b);
    if (am.pinned !== bm.pinned) return am.pinned ? -1 : 1;
    if (am.lastAt !== bm.lastAt) return bm.lastAt - am.lastAt;
    return am.name.localeCompare(bm.name, "zh-Hant");
  });
  const sortGroupChats = (list) => [...list].sort((a, b) => {
    const am = !!a?.pinned;
    const bm = !!b?.pinned;
    if (am !== bm) return am ? -1 : 1;
    const at = Number(a?.updatedAt || a?.lastAt || (a?.messages || [])[((a?.messages || []).length - 1)]?.time || 0);
    const bt = Number(b?.updatedAt || b?.lastAt || (b?.messages || [])[((b?.messages || []).length - 1)]?.time || 0);
    if (at !== bt) return bt - at;
    return String(a?.name || "").localeCompare(String(b?.name || ""), "zh-Hant");
  });
  // Pinning is a pure local UI/state action only. It must never trigger AI calls or alter prompt content.
  const toggleChatPin = (charId) => {
    setCharacters((prev) => {
      const target = prev.find((c) => c.id === charId);
      showToast(target?.pinned ? tr("已取消釘選", "Unpinned", "固定を解除しました", "고정 해제됨") : tr("已釘選", "Pinned", "固定しました", "고정됨"));
      return prev.map((c) => (c.id === charId ? { ...c, pinned: !c.pinned } : c));
    });
  };
  const getGroupMembers = (group) => {
    const ids = Array.isArray(group?.memberIds) && group.memberIds.length ? group.memberIds : characters.map((c) => c.id);
    return characters.filter((c) => ids.includes(c.id));
  };
  const compressGroupCoverFile = (file, done) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      const raw = String(r.result || "");
      const safe = sanitizeUserImageUrl(raw);
      if (!safe) return showToast(tr("圖片格式不支援", "Unsupported image format", "画像形式に対応していません", "이미지 형식을 지원하지 않습니다"));
      const img = new Image();
      img.onload = () => {
        const maxEdge = 720;
        const maxSide = Math.max(img.width, img.height);
        const scale = maxSide > maxEdge ? (maxEdge / maxSide) : 1;
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return showToast("圖片處理失敗");
        ctx.drawImage(img, 0, 0, w, h);
        const out = canvas.toDataURL("image/jpeg", 0.82);
        const next = sanitizeUserImageUrl(out);
        if (!next) return showToast("圖片處理失敗");
        done(next);
      };
      img.onerror = () => showToast(tr("圖片讀取失敗", "Image load failed", "画像の読み込みに失敗しました", "이미지 읽기에 실패했습니다"));
      img.src = safe;
    };
    r.readAsDataURL(file);
  };
  const compressChatBackgroundFile = (file, done) => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      const raw = String(r.result || "");
      const safe = sanitizeUserImageUrl(raw);
      if (!safe) return showToast(tr("圖片格式不支援", "Unsupported image format", "画像形式に対応していません", "이미지 형식을 지원하지 않습니다"));
      const img = new Image();
      img.onload = () => {
        const maxBytes = 1500 * 1024;
        const maxEdges = [1600, 1400, 1200, 1000, 820];
        const qualities = [0.82, 0.74, 0.66, 0.58, 0.5];
        let picked = null;
        const bytesFromDataUrl = (dataUrl) => Math.ceil(Math.max(0, String(dataUrl || "").length - String(dataUrl || "").indexOf(",") - 1) * 0.75);
        for (const maxEdge of maxEdges) {
          const maxSide = Math.max(img.width, img.height);
          const scale = maxSide > maxEdge ? (maxEdge / maxSide) : 1;
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) return showToast("圖片處理失敗");
          ctx.drawImage(img, 0, 0, w, h);
          for (const quality of qualities) {
            const out = canvas.toDataURL("image/jpeg", quality);
            const bytes = bytesFromDataUrl(out);
            picked = { out, bytes };
            if (bytes <= maxBytes) break;
          }
          if (picked?.bytes <= maxBytes) break;
        }
        if (!picked || picked.bytes > maxBytes) return showToast(tr("圖片壓縮後仍過大，請改用尺寸更小或內容較簡單的圖片", "The image is still too large after compression. Please use a smaller or simpler image.", "圧縮後も画像が大きすぎます。もっと小さい、またはシンプルな画像を使ってください。", "압축 후에도 이미지가 너무 큽니다. 더 작거나 단순한 이미지를 사용해주세요."));
        const next = sanitizeUserImageUrl(picked.out);
        if (!next) return showToast("圖片處理失敗");
        done(next);
      };
      img.onerror = () => showToast(tr("圖片讀取失敗", "Image load failed", "画像の読み込みに失敗しました", "이미지 읽기에 실패했습니다"));
      img.src = safe;
    };
    r.readAsDataURL(file);
  };
  const normalizeChatBackground = (bg) => {
    if (!bg) return { src: "", x: 0, y: 0, zoom: 1, blur: 0 };
    if (typeof bg === "string") return { src: sanitizeUserImageUrl(bg) || "", x: 0, y: 0, zoom: 1, blur: 0 };
    return {
      src: sanitizeUserImageUrl(bg?.src || bg?.url || "") || "",
      x: Number.isFinite(Number(bg?.x)) ? Number(bg.x) : 0,
      y: Number.isFinite(Number(bg?.y)) ? Number(bg.y) : 0,
      zoom: Number.isFinite(Number(bg?.zoom)) ? Number(bg.zoom) : 1,
      blur: Number.isFinite(Number(bg?.blur)) ? Number(bg.blur) : 0,
    };
  };
  const getChatBackgroundLayerStyle = (bg, extraScale = 1, fitAxis = "height") => {
    const normalized = normalizeChatBackground(bg);
    const zoom = Math.max(1, Math.min(2.2, Number(normalized.zoom) || 1));
    const scaledZoom = zoom * Math.max(1, Number(extraScale) || 1);
    const backgroundSize = fitAxis === "width"
      ? `calc(100% * ${scaledZoom}) auto`
      : `auto calc(100% * ${scaledZoom})`;
    return {
      position: "absolute",
      inset: 0,
      backgroundImage: `url(${normalized.src})`,
      backgroundRepeat: "no-repeat",
      backgroundSize,
      backgroundPosition: `${50 + (Number(normalized.x) || 0)}% ${50 + (Number(normalized.y) || 0)}%`,
      pointerEvents: "none",
    };
  };
  const getChatBackgroundBlurFilter = (bg) => {
    const normalized = normalizeChatBackground(bg);
    return `blur(${Math.max(0, Math.min(24, Number(normalized.blur) || 0))}px) saturate(.92) brightness(.96)`;
  };
  const updateChatBackground = (charId, bg) => {
    setChatBackgrounds((prev) => ({ ...prev, [charId]: normalizeChatBackground(bg) }));
  };
  const onChatBackgroundFile = (charId, file) => {
    if (!charId || !file) return;
    compressChatBackgroundFile(file, (safe) => {
      const next = { src: safe, x: 0, y: 0, zoom: 1, blur: 0 };
      updateChatBackground(charId, next);
      setChatBgEditor({ charId, ...next, dragging: false, dragStartX: 0, dragStartY: 0, startX: 0, startY: 0 });
      showToast(tr("聊天室背景已更新", "Chat background updated", "チャット背景を更新しました", "채팅 배경이 업데이트되었습니다"));
    });
  };
  const openGroupCoverCrop = (file, mode = "create") => {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      const safe = sanitizeUserImageUrl(String(r.result || ""));
      if (!safe) return showToast(tr("圖片格式不支援", "Unsupported image format", "画像形式に対応していません", "이미지 형식을 지원하지 않습니다"));
      const img = new Image();
      img.onload = () => {
        const crop = { src: safe, width: img.width, height: img.height, zoom: 1, panX: 0, panY: 0, dragging: false, dragStartX: 0, dragStartY: 0, startPanX: 0, startPanY: 0 };
        if (mode === "edit") setGroupEditCoverCrop(crop);
        else setGroupCoverCrop(crop);
      };
      img.onerror = () => showToast(tr("圖片讀取失敗", "Image load failed", "画像の読み込みに失敗しました", "이미지 읽기에 실패했습니다"));
      img.src = safe;
    };
    r.readAsDataURL(file);
  };
  const applyGroupCoverCrop = (mode = "create") => {
    const crop = mode === "edit" ? groupEditCoverCrop : groupCoverCrop;
    if (!crop?.src) return;
    const img = new Image();
    img.onload = () => {
      const size = 320;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return showToast("圖片處理失敗");
      const iw = img.width;
      const ih = img.height;
      const scale = Math.max(size / iw, size / ih) * Math.max(1, crop.zoom || 1);
      const dw = iw * scale;
      const dh = ih * scale;
      const panX = Number(crop.panX || 0);
      const panY = Number(crop.panY || 0);
      const maxShiftX = Math.max(0, (dw - size) / 2);
      const maxShiftY = Math.max(0, (dh - size) / 2);
      const shiftX = (maxShiftX * panX) / 100;
      const shiftY = (maxShiftY * panY) / 100;
      const dx = (size - dw) / 2 + shiftX;
      const dy = (size - dh) / 2 + shiftY;
      ctx.drawImage(img, dx, dy, dw, dh);
      const out = canvas.toDataURL("image/jpeg", 0.84);
      const safe = sanitizeUserImageUrl(out);
      if (!safe) return showToast("圖片處理失敗");
      if (mode === "edit") {
        setGroupEditCover(safe);
        setGroupEditCoverCrop(null);
      } else {
        setGroupCreateCover(safe);
        setGroupCoverCrop(null);
      }
    notify(tr("群組圖片已更新", "Group cover updated", "グループ画像を更新しました", "그룹 이미지가 업데이트되었습니다"), "Group cover updated");
    };
    img.onerror = () => showToast(tr("圖片讀取失敗", "Image load failed", "画像の読み込みに失敗しました", "이미지 읽기에 실패했습니다"));
    img.src = crop.src;
  };
  const getGroupSpeakerForAssistant = (group, messages, excludeIds = []) => {
    const members = getGroupMembers(group);
    if (!members.length) return { name: "群組", avatar: null };
    const used = new Set([...(excludeIds || [])]);
    const pool = members.filter((m) => !used.has(m.id));
    const baseList = pool.length ? pool : members;
    const assistantCount = (messages || []).filter((m) => m.role === "assistant").length;
    const idx = assistantCount % baseList.length;
    const picked = baseList[idx] || baseList[0];
    return { name: picked?.name || "群組", avatar: sanitizeUserImageUrl(picked?.avatar || null) };
  };
  const getGroupMemberProfileText = (char) => [
    `角色：${char?.name || "未命名"}`,
    char?.description ? `角色設定：${sanitizeText(char.description, 240)}` : "",
    char?.personality ? `個性：${sanitizeText(char.personality, 180)}` : "",
    char?.scenario ? `情境：${sanitizeText(char.scenario, 180)}` : "",
    char?.relationshipToUser ? `與玩家關係：${sanitizeText(char.relationshipToUser, 120)}` : "",
  ].filter(Boolean).join("\n");
  const buildGroupChatSystemPrompt = (group, memberNames, memberProfiles, recent) => {
    const scene = groupScenes?.[group?.id] || {};
    const sceneText = [
      scene.location ? `地點：${sanitizeText(scene.location, 15)}` : "",
      scene.note ? `小備註：${sanitizeText(scene.note, 50)}` : "",
    ].filter(Boolean).join(" · ");
    return `${getOutputLanguageDirective()}

你正在群組聊天室中回覆，請保持多人聊天感，不要提及系統、不要提到 AI 身份。
群組成員：${memberNames}
${sceneText ? `目前場景：${sceneText}\n` : ""}群組成員角色資料：
${memberProfiles || "（無）"}
回覆規則：
1. 你要一次產生「這一輪群聊」的多位角色回覆，不要只回一位。
2. 最多輸出 3 則回覆，至少 1 則。只有在自然適合時才讓多位角色發言，不要硬湊滿 3 則。
3. 每一則回覆都要是不同角色，不能重複同一角色兩次。
4. 每一則回覆都要維持一般聊天室的對話形式，像真的在群組裡接話，不要寫成公告、總結、條列或分析。
5. 維持「線上聊天」感，只能講角色說出口的內容，不要加入旁白、動作、表情、內心獨白。
6. 不要輸出像 *他站了起來*、（點頭）、【動作】這類格式，也不要寫成小說段落。
7. 每則內容維持短到中等長度，通常 1~3 句；如果角色對這個話題很有興趣，可以讓同一段講得更完整一點，但不要超過 3 句。
8. 若前文或這一輪明顯點名某角色，請優先安排該角色回覆。
9. 可以有角色回玩家，也可以有角色回前一位角色，但每一則只能回一個對象，不要同時回兩個人。
10. 可以自然接話、表態、提問、建議，並且主動推進話題，例如丟出新觀點、接續延伸、提出下一步或換一個相關話題，但幅度要小，不要一次推太多，也不要跳太遠。
11. 不要輸出模式標籤、解說、分析或 Markdown，只能輸出 JSON。
12. 請嚴格輸出以下格式，不要多字少字：
{"replies":[{"speaker":"角色名稱","content":"回覆內容"}]}
13. 如果這一輪只需要 1 則回覆，就只放 1 個物件。
14. 需要承接最近對話：
${recent || "（目前無內容）"}`;
  };
  const parseGroupReplies = (raw) => {
    if (!raw) return [];
    const text = String(raw).trim();
    const candidates = [];
    candidates.push(text);
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) candidates.push(fenced[1].trim());
    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      candidates.push(text.slice(firstBrace, lastBrace + 1).trim());
    }
    for (const candidate of candidates) {
      try {
        const parsed = JSON.parse(candidate);
        const replies = Array.isArray(parsed?.replies) ? parsed.replies : Array.isArray(parsed?.turns) ? parsed.turns : [];
        const cleaned = replies.map((item) => ({
          speaker: sanitizeText(item?.speaker || item?.name || "", 80),
          content: sanitizeText(item?.content || item?.reply || "", 4000).trim(),
        })).filter((item) => item.speaker && item.content);
        if (cleaned.length) return cleaned.slice(0, 3);
      } catch (_) {}
    }
    const fallbackLines = text
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const m = line.match(/^(?:[-*•]|\d+[.)]?)\s*(.+?)\s*[:：]\s*(.+)$/);
        if (m) return { speaker: sanitizeText(m[1], 80), content: sanitizeText(m[2], 4000).trim() };
        return null;
      })
      .filter(Boolean);
    return fallbackLines.slice(0, 3);
  };
  const currentGroupMessages = currentChatGroup ? (currentChatGroup.messages || []) : [];
  const getCurrentGroupModelHint = () => {
    const providerShortMap = {
      openai: "GPT",
      deepseek: "DS",
      claude: "Claude",
      gemini: "Gemini",
      vertex: "Vertex",
      grok: "Grok",
      openrouter: "OR",
    };
    return providerShortMap[apiConfig?.provider || "openai"] || "AI";
  };
  const openCreateGroup = () => {
    setGroupCreateName("");
    setGroupCreateRulePrompt("");
    setGroupCreateMemberIds([]);
    setGroupCreateSearch("");
    setGroupCreateCover("");
    setGroupCreateOpen(true);
  };
  const openEditGroup = (group) => {
    if (!group) return;
    setGroupEditGroupId(group.id);
    setGroupEditName(group.name || "");
    setGroupEditRulePrompt(group.rulePrompt || "");
    setGroupEditMemberIds(Array.isArray(group.memberIds) ? group.memberIds.slice(0, 5) : []);
    setGroupEditSearch("");
    setGroupEditCover(group.cover || "");
    setGroupEditOpen(true);
  };
  const handleGroupCreateCoverUp = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    openGroupCoverCrop(f, "create");
    e.target.value = "";
  };
  const handleGroupEditCoverUp = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    openGroupCoverCrop(f, "edit");
    e.target.value = "";
  };
  const saveEditGroup = () => {
    if (!groupEditGroupId) return;
    const members = characters.filter((c) => groupEditMemberIds.includes(c.id)).slice(0, 5);
    if (members.length === 0) {
      showToast(tr("請至少選擇 1 位角色", "Select at least 1 character", "少なくとも1人のキャラを選択してください", "캐릭터를 1명 이상 선택해주세요"));
      return;
    }
    const memberLabel = members.map((m) => m.name).join("、");
    const fallbackName = tr(`${memberLabel}的群組聊天室`, `${memberLabel}'s group chat`, `${memberLabel}のグループチャット`, `${memberLabel}의 그룹 채팅`);
    const name = sanitizeText(groupEditName.trim() || fallbackName, 80);
    setGroupChats((prev) => prev.map((g) => g.id === groupEditGroupId ? {
      ...g,
      name,
      rulePrompt: sanitizeText(groupEditRulePrompt.trim(), 3000),
      memberIds: members.map((m) => m.id),
      cover: groupEditCover || "",
      updatedAt: Date.now(),
    } : g));
    if (currentChatGroup?.id === groupEditGroupId) {
      setCurrentChatGroup((prev) => prev ? {
        ...prev,
        name,
        rulePrompt: sanitizeText(groupEditRulePrompt.trim(), 3000),
        memberIds: members.map((m) => m.id),
        cover: groupEditCover || "",
        updatedAt: Date.now(),
      } : prev);
    }
    setGroupEditOpen(false);
    showToast(tr("群組已更新", "Group updated", "グループを更新しました", "그룹이 업데이트되었습니다"));
  };
  const createGroupChat = () => {
    if (groupCreateMemberIds.length === 0) {
      showToast(tr("請至少選擇 1 位角色", "Select at least 1 character", "少なくとも1人のキャラを選択してください", "캐릭터를 1명 이상 선택해주세요"));
      return;
    }
    const members = characters.filter((c) => groupCreateMemberIds.includes(c.id)).slice(0, 5);
    const memberLabel = members.map((m) => m.name).join("、");
    const fallbackName = tr(`${memberLabel}的群組聊天室`, `${memberLabel}'s group chat`, `${memberLabel}のグループチャット`, `${memberLabel}의 그룹 채팅`);
    const name = sanitizeText(groupCreateName.trim() || fallbackName, 80);
    const payload = {
      id: gid(),
      name,
      rulePrompt: sanitizeText(groupCreateRulePrompt.trim(), 3000),
      memberIds: members.map((m) => m.id),
      cover: groupCreateCover || "",
      pinned: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
    };
    setGroupChats((prev) => [...prev, payload]);
    setGroupCreateOpen(false);
    setCurrentChatGroup(payload);
    notify(tr("已建立群組", "Group created", "グループを作成しました", "그룹이 생성되었습니다"), `Group created: ${name || fallbackName}`);
  };
  const sendGroupMessage = async () => {
    if (!currentChatGroup || isTyping) return;
    const text = sanitizeText(chatInput.trim(), 4000);
    const img = chatImage?.data || null;
    if (!text && !img) return;
    const nowMs = Date.now();
    const members = getGroupMembers(currentChatGroup);
    const now = new Date();
    const nowDate = new Intl.DateTimeFormat("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
    const nowTime = new Intl.DateTimeFormat("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
    const nowTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Taipei";
    const nowContext = `[系統時間] 目前時間：${nowDate} ${nowTime} (${nowTz})`;
    const userMsg = {
      id: gid(),
      role: "user",
      content: text,
      image: img,
      imageSummary: "",
      time: nowMs,
      speakerName: getPlayerDisplayName(),
      speakerAvatar: sanitizeUserImageUrl(getPlayerAvatar()),
    };
    const nextMessages = [...(currentChatGroup.messages || []), userMsg];
    setGroupChats((prev) => prev.map((g) => g.id === currentChatGroup.id ? { ...g, messages: nextMessages, updatedAt: nowMs } : g));
    setChatInput("");
    setChatImage(null);
    setChatActionPanelOpen(false);
    setIsTyping(true);
    try {
      const memberNames = members.map((m) => m.name).join("、") || tr("群組成員", "Group members", "グループメンバー", "그룹 멤버");
      const memberProfiles = members
        .map((c) => getGroupMemberProfileText(c))
        .filter(Boolean)
        .join("\n\n");
      const hist = nextMessages
        .slice(-18)
        .map((m) => {
          const summaryLine = m.imageSummary ? `\n[圖片摘要]\n${m.imageSummary}` : "";
          return { role: m.role, content: `${m.content || ""}${summaryLine}`.trim(), image: m.image || null };
        })
        .filter(Boolean);
      const safeHist = hist.map((m, idx) => {
        const isLast = idx === hist.length - 1;
        if (img && isLast) return m;
        return { ...m, image: null };
      });
      const recent = safeHist.map((m) => `${m.role === "user" ? "玩家" : (m.speakerName || "群組")}: ${m.content || "[圖片]"}`).join("\n");
      const sysP = `${nowContext}\n\n${buildGroupChatSystemPrompt(currentChatGroup, memberNames, memberProfiles, recent)}`;
      const reply = await callAI(safeHist, apiConfig, sysP);
      const parsedReplies = parseGroupReplies(stripInternalBlocks(reply));
      const speakerMap = new Map(members.map((m) => [m.name, m]));
      const usableReplies = [];
      const seenSpeakers = new Set();
      for (const item of parsedReplies) {
        const matched = speakerMap.get(item.speaker) || members.find((m) => m.name === item.speaker);
        const resolvedName = matched?.name || item.speaker;
        if (!resolvedName || !item.content || seenSpeakers.has(resolvedName)) continue;
        seenSpeakers.add(resolvedName);
        usableReplies.push({
          speakerName: resolvedName,
          speakerAvatar: sanitizeUserImageUrl(matched?.avatar || ""),
          content: item.content,
        });
      }
      if (!usableReplies.length) {
        const fallbackSpeaker = members[0];
        const fallbackContent = sanitizeText(stripInternalBlocks(reply), 4000).trim();
        if (fallbackSpeaker && fallbackContent) {
          usableReplies.push({
            speakerName: fallbackSpeaker.name,
            speakerAvatar: sanitizeUserImageUrl(fallbackSpeaker.avatar || ""),
            content: fallbackContent,
          });
        }
      }
      const replyMessages = usableReplies.map((r) => ({
        id: gid(),
        role: "assistant",
        content: r.content,
        time: Date.now(),
        speakerName: r.speakerName,
        speakerAvatar: r.speakerAvatar,
      }));
      if (replyMessages.length) {
        let workingMessages = [...nextMessages];
        for (let i = 0; i < replyMessages.length; i += 1) {
          const msg = replyMessages[i];
          if (i > 0) {
            const lengthFactor = Math.max(0, Math.min(1, (replyMessages[i - 1]?.content?.length || 0) / 220));
            const wait = Math.round(220 + (lengthFactor * 520));
            await new Promise((resolve) => setTimeout(resolve, wait));
          }
          workingMessages = [...workingMessages, msg];
          setGroupChats((prev) => prev.map((g) => g.id === currentChatGroup.id ? { ...g, messages: workingMessages, updatedAt: Date.now() } : g));
        }
      }
      if (img && replyMessages.length) {
        const latestReplyText = replyMessages.map((m) => m.content).join(" / ");
        const base = text ? `{{user}} 訊息：${text}\n` : "";
        const imageSummary = sanitizeText(`${base}重點：${latestReplyText}`.slice(0, 220), 220);
        if (imageSummary) {
          setGroupChats((prev) => prev.map((g) => g.id === currentChatGroup.id ? {
            ...g,
            messages: (g.messages || []).map((m) => (m.id === userMsg.id ? { ...m, imageSummary } : m)),
            updatedAt: Date.now(),
          } : g));
        }
      }
    } catch (err) {
      const notice = { id: gid(), role: "system_notice", content: `${getConnectionErrorPrefix()}${sanitizeText(err?.message || tr("未知錯誤", "Unknown error", "不明なエラー", "알 수 없는 오류"), 500)}`, time: Date.now() };
      setGroupChats((prev) => prev.map((g) => g.id === currentChatGroup.id ? { ...g, messages: [...nextMessages, notice], updatedAt: Date.now() } : g));
    }
    setIsTyping(false);
  };
  const retryGroupFromNotice = async (noticeId) => {
    if (!currentChatGroup || isTyping) return;
    const list = currentChatGroup.messages || [];
    const noticeIdx = list.findIndex((m) => m.id === noticeId);
    if (noticeIdx < 0) return;
    const userMsg = [...list.slice(0, noticeIdx)].reverse().find((m) => m.role === "user");
    if (!userMsg) return;
    const nextMessages = list.filter((m) => m.id !== noticeId);
    const members = getGroupMembers(currentChatGroup);
    const now = new Date();
    const nowDate = new Intl.DateTimeFormat("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
    const nowTime = new Intl.DateTimeFormat("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
    const nowTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Taipei";
    const nowContext = `[系統時間] 目前時間：${nowDate} ${nowTime} (${nowTz})`;
    setGroupChats((prev) => prev.map((g) => g.id === currentChatGroup.id ? { ...g, messages: nextMessages, updatedAt: Date.now() } : g));
    setIsTyping(true);
    try {
      const memberNames = members.map((m) => m.name).join("、") || tr("群組成員", "Group members", "グループメンバー", "그룹 멤버");
      const memberProfiles = members
        .map((c) => getGroupMemberProfileText(c))
        .filter(Boolean)
        .join("\n\n");
      const hist = nextMessages
        .slice(-18)
        .map((m) => {
          const summaryLine = m.imageSummary ? `\n[圖片摘要]\n${m.imageSummary}` : "";
          return { role: m.role, content: `${m.content || ""}${summaryLine}`.trim(), image: m.image || null };
        })
        .filter(Boolean);
      const safeHist = hist.map((m) => ({ ...m, image: null }));
      const recent = safeHist.map((m) => `${m.role === "user" ? "玩家" : (m.speakerName || "群組")}: ${m.content || "[圖片]"}`).join("\n");
      const sysP = `${nowContext}\n\n${buildGroupChatSystemPrompt(currentChatGroup, memberNames, memberProfiles, recent)}`;
      const reply = await callAI(safeHist, apiConfig, sysP);
      const parsedReplies = parseGroupReplies(stripInternalBlocks(reply));
      const speakerMap = new Map(members.map((m) => [m.name, m]));
      const usableReplies = [];
      const seenSpeakers = new Set();
      for (const item of parsedReplies) {
        const matched = speakerMap.get(item.speaker) || members.find((m) => m.name === item.speaker);
        const resolvedName = matched?.name || item.speaker;
        if (!resolvedName || !item.content || seenSpeakers.has(resolvedName)) continue;
        seenSpeakers.add(resolvedName);
        usableReplies.push({
          speakerName: resolvedName,
          speakerAvatar: sanitizeUserImageUrl(matched?.avatar || ""),
          content: item.content,
        });
      }
      if (!usableReplies.length) {
        const fallbackSpeaker = members[0];
        const fallbackContent = sanitizeText(stripInternalBlocks(reply), 4000).trim();
        if (fallbackSpeaker && fallbackContent) {
          usableReplies.push({
            speakerName: fallbackSpeaker.name,
            speakerAvatar: sanitizeUserImageUrl(fallbackSpeaker.avatar || ""),
            content: fallbackContent,
          });
        }
      }
      if (usableReplies.length) {
        let workingMessages = [...nextMessages];
        for (let i = 0; i < usableReplies.length; i += 1) {
          const item = usableReplies[i];
          if (i > 0) {
            const prevLen = usableReplies[i - 1]?.content?.length || 0;
            const lengthFactor = Math.max(0, Math.min(1, prevLen / 220));
            const wait = Math.round(220 + (lengthFactor * 520));
            await new Promise((resolve) => setTimeout(resolve, wait));
          }
          const msg = {
            id: gid(),
            role: "assistant",
            content: item.content,
            time: Date.now(),
            speakerName: item.speakerName,
            speakerAvatar: item.speakerAvatar,
          };
          workingMessages = [...workingMessages, msg];
          setGroupChats((prev) => prev.map((g) => g.id === currentChatGroup.id ? { ...g, messages: workingMessages, updatedAt: Date.now() } : g));
        }
      }
    } catch (err) {
      const notice = { id: gid(), role: "system_notice", content: `${getConnectionErrorPrefix()}${sanitizeText(err?.message || tr("未知錯誤", "Unknown error", "不明なエラー", "알 수 없는 오류"), 500)}`, time: Date.now() };
      setGroupChats((prev) => prev.map((g) => g.id === currentChatGroup.id ? { ...g, messages: [...nextMessages, notice], updatedAt: Date.now() } : g));
    }
    setIsTyping(false);
  };
  const renderGroupMemberGrid = (selectedIds, setSelectedIds, search, setSearch) => (
    <>
      <input
        className="mp-sinp"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={tr("搜尋角色名稱", "Search characters", "キャラを検索", "캐릭터 검색")}
      />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, fontSize: 11, color: "var(--mp-txt-l)", marginTop: 6 }}>
        <span>{tr("最多 5 位角色", "Up to 5 characters", "最大5人まで", "최대 5명")}</span>
        <span>{tr("已選", "Selected", "選択", "선택")} {selectedIds.length}/5</span>
      </div>
      <div style={{ marginTop: 6, maxHeight: 300, overflowY: "auto", paddingRight: 2 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 4 }}>
          {sortChatThreads(characters)
            .filter((c) => c.name?.includes(search.trim()) || !search.trim())
            .map((c) => {
              const selected = selectedIds.includes(c.id);
              const disabled = !selected && selectedIds.length >= 5;
              return (
                <button
                  key={c.id}
                  type="button"
                  className="mp-group-pick"
                  style={{
                    minHeight: 94,
                    border: "none",
                    boxShadow: "none",
                    opacity: disabled ? 0.45 : (selected ? 1 : 0.5),
                    background: "transparent",
                  }}
                  onClick={() => {
                    if (selected) {
                      setSelectedIds((prev) => prev.filter((id) => id !== c.id));
                      return;
                    }
                    if (selectedIds.length >= 5) {
                      showToast(tr("最多只能加入 5 位角色", "You can add up to 5 characters", "追加できるのは最大5人です", "최대 5명까지만 추가할 수 있습니다"));
                      return;
                    }
                    setSelectedIds((prev) => [...prev, c.id]);
                  }}
                >
                  <div style={{ position: "relative", width: "100%", aspectRatio: "1 / 1", borderRadius: 14, overflow: "hidden", background: "transparent", display: "flex", alignItems: "end", justifyContent: "start" }}>
                    {sanitizeUserImageUrl(c.avatar) ? (
                      <img src={sanitizeUserImageUrl(c.avatar)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", background: "linear-gradient(135deg,#fce4ec,#e1f5fe)", color: "#5c6f7b", fontSize: 24, fontWeight: 800 }}>
                        {c.name?.[0] || "🙂"}
                      </div>
                    )}
                    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "12px 5px 6px", background: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,.48) 100%)", color: "#fff", fontSize: 11, fontWeight: 700, lineHeight: 1.05, boxSizing: "border-box" }}>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                    </div>
                    {selected && <div style={{ position: "absolute", top: 4, right: 4, width: 16, height: 16, borderRadius: 999, background: "rgba(184,122,65,.95)", color: "#fff", display: "grid", placeItems: "center", fontSize: 10, boxShadow: "0 4px 10px rgba(0,0,0,.18)" }}>✓</div>}
                  </div>
                </button>
              );
            })}
        </div>
      </div>
    </>
  );
  const renderChat = () => {
    if (currentChatGroup) {
      const msgs = currentChatGroup.messages || [];
      const visibleMsgs = msgs;
      const members = getGroupMembers(currentChatGroup);
      const providerShortMap = {
        openai: "GPT",
        deepseek: "DS",
        claude: "Claude",
        gemini: "Gemini",
        vertex: "Vertex",
        grok: "Grok",
        openrouter: "OR",
      };
      const providerFullMap = {
        openai: "OpenAI",
        deepseek: "DeepSeek",
        claude: "Claude",
        gemini: "Gemini API",
        vertex: "Vertex AI (快速模式)",
        grok: "Grok",
        openrouter: "OpenRouter",
      };
      const modelShort = providerShortMap[apiConfig?.provider || "openai"] || "AI";
      const providerKey = apiConfig?.provider || "openai";
      const modelFull = `${providerFullMap[providerKey] || providerKey} · ${apiConfig?.model || "-"}`;
      return (
        <div className="mp-page" onClick={() => setModelBadgeOpen(false)} style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div className="mp-hdr">
            <div className="mp-back" onClick={() => setCurrentChatGroup(null)}>←</div>
            <button
              type="button"
              className={`mp-chat-pin ${currentChatGroup?.pinned ? "active" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setGroupChats((prev) => prev.map((g) => g.id === currentChatGroup.id ? { ...g, pinned: !g.pinned } : g));
              }}
              title={currentChatGroup?.pinned ? tr("取消釘選", "Unpin", "固定を解除", "고정 해제") : tr("釘選聊天室", "Pin chatroom", "チャットルームを固定", "채팅방 고정")}
            >
              {currentChatGroup?.pinned ? "♥" : "♡"}
            </button>
            <div className="mp-htitle" style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{currentChatGroup.name}</div>
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
            <button className="mp-ibtn" onClick={() => openEditGroup(currentChatGroup)}>{tr("設定", "Settings", "設定", "설정")}</button>
          </div>
          {modelBadgeOpen && (
            <div
              style={{ position: "absolute", top: 56, right: 74, zIndex: 40, background: "#fff", border: "1px solid rgba(244,143,177,.35)", borderRadius: 12, padding: "8px 10px", boxShadow: "0 8px 24px rgba(0,0,0,.12)", maxWidth: 220 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ fontSize: 11, fontWeight: 800, color: "#666", marginBottom: 2 }}>{tr("目前模型", "Current model", "現在のモデル", "현재 모델")}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#222" }}>{modelFull}</div>
            </div>
          )}
          <div className="mp-cm" style={{ paddingTop: 8, paddingLeft: 0, paddingRight: 0, paddingBottom: 0, display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
            <div style={{ margin: "0 14px 8px", fontSize: 11, color: "var(--mp-txt-l)", lineHeight: 1.5, textAlign: "center" }}>
              {tr("群組成員：", "Group members: ", "グループメンバー: ", "그룹 멤버: ")}{members.length ? members.map((m) => m.name).join("、") : tr("暫無成員", "No members yet", "まだメンバーがいません", "아직 멤버가 없습니다")}
            </div>
            {renderSceneBar("group", currentChatGroup.id, tr("場景", "Scene", "シーン", "장면"))}
            <div className="mp-cr" style={{ flex: 1, minHeight: 0 }}>
              <div className="mp-msgs" ref={chatMsgsRef} style={{ flex: 1, minHeight: 0, paddingBottom: 12 }} onScroll={(e) => updateScrollToBottomVisibility(e.currentTarget)}>
                {visibleMsgs.map((m) => (
                  m.role === "system_notice" ? (
                    <div key={m.id} className="mp-msg-note-wrap">
                      <div className="mp-msg-note">
                        <div>{m.content}</div>
                        {isConnectionErrorNotice(m.content) && (
                          <button className="mp-retry-btn" disabled={isTyping} onClick={(e) => { e.stopPropagation(); retryGroupFromNotice(m.id); }}>
                            {tr("重新生成", "Regenerate", "再生成", "다시 생성")}
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                  <div key={m.id} className={`mp-msg-wrap ${m.role === "user" ? "mp-msg-wrap-user mp-group-msg-wrap-user" : "mp-msg-wrap-ai mp-group-msg-wrap-ai"}`}>
                    <div className="mp-group-msg-meta">
                      <div className="mp-group-msg-avatar">
                        {m.role === "user"
                          ? (getPlayerAvatar() ? <img src={getPlayerAvatar()} alt="" /> : null)
                          : (m.speakerAvatar ? <img src={m.speakerAvatar} alt="" /> : "👥")}
                      </div>
                      {m.role !== "user" && <div className="mp-group-msg-name">{m.speakerName || tr("群組", "Group", "グループ", "그룹")}</div>}
                    </div>
                    <div
                      className={`mp-msg ${m.role === "user" ? "mp-msg-user" : "mp-msg-ai"}`}
                      onClick={() => setActiveMessageId((p) => (p === m.id ? null : m.id))}
                    >
                      {m.image && <img src={`data:image/png;base64,${m.image}`} className="mp-msg-img" alt="" />}
                      {m.content && <div>{m.content}</div>}
                      <div className="mp-msg-t">{new Date(m.time).toLocaleTimeString("zh-TW",{hour:"2-digit",minute:"2-digit"})}</div>
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <button
                        className={`mp-msg-editbtn ${activeMessageId === m.id ? "" : "mp-msg-editbtn-hidden"}`}
                        onClick={() => setMessageEditor({ id: m.id, content: m.content || "", mode: "online" })}
                      >
                        ✎
                      </button>
                      <button
                        className={`mp-msg-editbtn ${activeMessageId === m.id ? "" : "mp-msg-editbtn-hidden"}`}
                        onClick={() => {
                          if (!window.confirm(tr("確定要刪除這則對話嗎？", "Delete this message?", "このメッセージを削除しますか？", "이 메시지를 삭제할까요?"))) return;
                          if (currentChatGroup) {
                            const next = (currentChatGroup.messages || []).filter((x) => x.id !== m.id);
                            setGroupChats((prev) => prev.map((g) => g.id === currentChatGroup.id ? { ...g, messages: next, updatedAt: Date.now() } : g));
                          }
                          setActiveMessageId(null);
                        }}
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                  )
                ))}
                {visibleMsgs.length === 0 && <div style={{fontSize:11,color:"var(--mp-txt-l)",textAlign:"center",padding:"18px 0"}}>{tr("目前沒有群組訊息", "No group messages yet", "グループメッセージはまだありません", "아직 그룹 메시지가 없습니다")}</div>}
                {isTyping && <div className="mp-typing"><span /><span /><span /></div>}
                <div ref={messagesEndRef} />
              </div>
              {showScrollToBottom && (
                <button
                  type="button"
                  className="mp-scroll-bottom"
                  style={{ bottom: 8 }}
                  aria-label={tr("捲到最新訊息", "Scroll to latest message", "最新メッセージへ移動", "최신 메시지로 이동")}
                  title={tr("捲到最新訊息", "Scroll to latest message", "最新メッセージへ移動", "최신 메시지로 이동")}
                  onClick={scrollCurrentChatToBottom}
                >
                  <ArrowDown size={23} strokeWidth={2.2} aria-hidden="true" />
                </button>
              )}
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
                  <span>{tr("相片", "Photo", "写真", "사진")}</span>
                </button>
                <button className="mp-chat-action" disabled>
                  <span className="mp-chat-action-i">📅</span>
                  <span>{tr("日程", "Schedule", "予定", "일정")}</span>
                </button>
                <button className="mp-chat-action" disabled>
                  <span className="mp-chat-action-i">⚙️</span>
                  <span>{tr("更多", "More", "その他", "더보기")}</span>
                </button>
              </div>
            )}
            <div className="mp-inp-bar" style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
              <button className={`mp-btn mp-btn-img ${chatActionPanelOpen ? "active" : ""}`} onClick={()=>setChatActionPanelOpen((v) => !v)}>＋</button>
              <input type="file" ref={fileInputRef} accept="image/*" style={{display:"none"}} onChange={handleImgUp} />
              <div className="mp-inp-wrap">
                <textarea
                  className="mp-inp"
                  placeholder={tr("輸入群組訊息...", "Type a group message...", "グループメッセージを入力...", "그룹 메시지를 입력...")}
                  rows={1}
                  maxLength={4000}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="sentences"
                  spellCheck={false}
                  data-form-type="other"
                  data-lpignore="true"
                  value={chatInput}
                  onChange={e=>setChatInput(e.target.value.slice(0, 4000))}
                  onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendGroupMessage();}}}
                />
                <div className="mp-char-counter">{chatInput.length}/4000</div>
              </div>
              <button className="mp-btn mp-btn-send" onClick={sendGroupMessage}>➤</button>
            </div>
          </div>
        </div>
      );
    }
    if (!currentChatChar) {
      return (
        <div className="mp-page" onClick={() => setModelBadgeOpen(false)}>
          <div className="mp-hdr">
            <div className="mp-back" onClick={closeApp}>←</div>
            <div className="mp-htitle">{t("chat")}</div>
            {chatListTab === "groups" && (
              <button
                type="button"
                className="mp-ibtn"
                style={{ marginLeft: "auto", padding: "4px 10px", background: "linear-gradient(135deg,#f9e6ee,#fff6fb)" }}
                onClick={openCreateGroup}
                title="Add group"
              >
                ＋
              </button>
            )}
          </div>
          <div className="mp-cm" style={{ paddingTop: 2 }}>
            <div className="mp-chat-switch">
              <button
                className={`mp-chat-switch-btn ${chatListTab === "friends" ? "active" : ""}`}
                onClick={() => setChatListTab("friends")}
              >
              <span>{tr("好友", "Friends", "フレンド", "친구")}</span>
              </button>
              <button
                className={`mp-chat-switch-btn ${chatListTab === "groups" ? "active" : ""}`}
                onClick={() => setChatListTab("groups")}
              >
                <span>{t("chatroom")}</span>
              </button>
            </div>
            {chatListTab === "friends" ? (
              characters.length === 0 ? (
                <div className="mp-empty mp-chat-empty">
                  <div className="mp-empty-i">💬</div>
                  <div className="mp-empty-t">No friend chats yet</div>
                </div>
              ) : (
                <div className="mp-chat-list mp-chat-list-line">
                  {sortChatThreads(characters).map((c) => {
                    const ms = chatHistory[c.id] || [];
                    const lm = ms[ms.length - 1];
                    const isPinned = !!c.pinned || !!c.chatPinned;
                    return (
                      <button key={c.id} className={`mp-chat-row ${isPinned ? "pinned" : ""}`} onClick={() => Date.now() > suppressAppClickUntilRef.current && setCurrentChatChar(c)}>
                        <div className="mp-chat-row-avatar">
                          {sanitizeUserImageUrl(c.avatar) ? <img src={sanitizeUserImageUrl(c.avatar)} alt="" /> : (c.name?.[0] || "🙂")}
                        </div>
                        <div className="mp-chat-row-body">
                          <div className="mp-chat-row-top">
                            <div className="mp-chat-row-name">
                              {isPinned && <span className="mp-chat-row-pin">♥</span>}
                              <span>{c.name}</span>
                            </div>
                            <div className="mp-chat-row-time">{lm?.time ? new Date(lm.time).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" }) : ""}</div>
                          </div>
                          <div className="mp-chat-row-preview">{lm?.content || t("noMessagesShort")}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )
            ) : (
              <div className="mp-chat-list mp-chat-list-line">
                {sortGroupChats(groupChats).map((g) => {
                  const msgs = g.messages || [];
                  const lm = msgs[msgs.length - 1];
                  const isPinned = !!g.pinned;
                  const members = getGroupMembers(g);
                  return (
                    <button key={g.id} className={`mp-chat-row ${isPinned ? "pinned" : ""}`} onClick={() => Date.now() > suppressAppClickUntilRef.current && setCurrentChatGroup(g)}>
                      <div className="mp-chat-row-avatar">
                        {sanitizeUserImageUrl(g.cover)
                          ? <img src={sanitizeUserImageUrl(g.cover)} alt="" />
                          : (members[0]?.avatar && sanitizeUserImageUrl(members[0].avatar)
                            ? <img src={sanitizeUserImageUrl(members[0].avatar)} alt="" />
                            : "👥")}
                      </div>
                      <div className="mp-chat-row-body">
                        <div className="mp-chat-row-top">
                          <div className="mp-chat-row-name">
                            {isPinned && <span className="mp-chat-row-pin">♥</span>}
                            <span>{g.name}</span>
                          </div>
                          <div className="mp-chat-row-time">{lm?.time ? new Date(lm.time).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" }) : ""}</div>
                        </div>
                        <div className="mp-chat-row-preview">{lm?.content || `${members.length || characters.length} ${tr("位成員", "members", "人のメンバー", "명의 멤버")}`}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      );
    }
    if (currentChatChar) {
      const msgs = chatHistory[currentChatChar.id] || [];
      const visibleCount = Math.max(50, chatVisibleCounts[currentChatChar.id] || 50);
      const visibleMsgs = msgs.slice(Math.max(0, msgs.length - visibleCount));
      const innerThoughtAnchorIds = new Set();
      msgs.forEach((message, index) => {
        if (message?.role !== "assistant") return;
        if (message.replyGroupId) {
          if (message.replyGroupIndex === message.replyGroupSize - 1) innerThoughtAnchorIds.add(message.id);
          return;
        }
        if (msgs[index + 1]?.role !== "assistant") innerThoughtAnchorIds.add(message.id);
      });
      const latestInnerThoughtAnchorId = [...msgs].reverse().find((message) => message?.role === "assistant")?.id || null;
      const canRenderInnerThought = (message) => (
        innerThoughtAnchorIds.has(message.id) && (
          !!message.innerThought?.content ||
          (!isTyping && message.id === latestInnerThoughtAnchorId)
        )
      );
      const thoughtRecords = msgs
        .filter((message) => message?.role === "assistant" && message.innerThought?.content)
        .slice()
        .sort((a, b) => (b.innerThought.generatedAt || b.time || 0) - (a.innerThought.generatedAt || a.time || 0));
      const thoughtPageSize = 5;
      const thoughtPageCount = Math.max(1, Math.ceil(thoughtRecords.length / thoughtPageSize));
      const activeThoughtPage = Math.min(thoughtHistoryPage, thoughtPageCount - 1);
      const visibleThoughtRecords = thoughtRecords.slice(activeThoughtPage * thoughtPageSize, (activeThoughtPage + 1) * thoughtPageSize);
      const jumpToThoughtMessage = (messageId) => {
        thoughtJumpInProgressRef.current = true;
        setChatVisibleCounts((prev) => ({ ...prev, [currentChatChar.id]: msgs.length }));
        setPendingThoughtScrollId(messageId);
        setChatSettingsOpen(false);
      };
      const binding = getChatLorebookBinding(currentChatChar.id);
      const selectedMode = getSelectedChatMode(currentChatChar.id);
      const committedMode = getLastCommittedChatMode(currentChatChar.id);
      const hasPendingMode = selectedMode !== committedMode;
      const inputTextLimit = getChatTextLimit(selectedMode);
      const providerShortMap = {
        openai: "GPT",
        deepseek: "DS",
        claude: "Claude",
        gemini: "Gemini",
        vertex: "Vertex",
        grok: "Grok",
        openrouter: "OR",
      };
      const providerFullMap = {
        openai: "OpenAI",
        deepseek: "DeepSeek",
        claude: "Claude",
        gemini: "Gemini API",
        vertex: "Vertex AI (快速模式)",
        grok: "Grok",
        openrouter: "OpenRouter",
      };
      const providerKey = apiConfig?.provider || "openai";
      const modelShort = providerShortMap[providerKey] || "AI";
      const modelFull = `${providerFullMap[providerKey] || providerKey} · ${apiConfig?.model || "-"}`;
      const chatBg = normalizeChatBackground(chatBackgrounds?.[currentChatChar.id] || "");
      const chatBgUrl = chatBg.src;
      const chatCrStyle = chatBgUrl
        ? {
            flex: 1,
            minHeight: 0,
            position: "relative",
            overflow: "hidden",
          }
        : { flex: 1, minHeight: 0 };
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
            <button
              type="button"
              className={`mp-chat-pin ${currentChatChar?.pinned ? "active" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                toggleChatPin(currentChatChar.id);
              }}
              title={currentChatChar?.pinned ? tr("取消釘選", "Unpin", "固定を解除", "고정 해제") : tr("釘選聊天室", "Pin chatroom", "チャットルームを固定", "채팅방 고정")}
            >
              {currentChatChar?.pinned ? "♥" : "♡"}
            </button>
            <div className="mp-htitle" style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{currentChatChar.name}</div>
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
            <button className="mp-ibtn" onClick={() => { setChatSettingsExpandedBooks({}); setChatSettingsBackgroundOpen(false); setChatSettingsLorebookOpen(false); setChatSettingsThoughtsOpen(false); setThoughtHistoryPage(0); setChatroomManageOpen(false); setChatBgEditor(null); setChatSettingsOpen(true); }}>{tr("設定", "Settings", "設定", "설정")}</button>
          </div>
          {modelBadgeOpen && (
            <div
              style={{ position: "absolute", top: 56, right: 74, zIndex: 40, background: "#fff", border: "1px solid rgba(244,143,177,.35)", borderRadius: 12, padding: "8px 10px", boxShadow: "0 8px 24px rgba(0,0,0,.12)", maxWidth: 220 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ fontSize: 11, fontWeight: 800, color: "#666", marginBottom: 2 }}>{tr("目前模型", "Current model", "現在のモデル", "현재 모델")}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#222" }}>{modelFull}</div>
            </div>
          )}
          {chatSettingsOpen ? (
            <div className="mp-cm" style={{ paddingTop: 8 }}>
              <div className="mp-cc" style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{tr("聊天室設定", "Chat settings", "チャット設定", "채팅 설정")}</div>
              </div>
              <div className="mp-cc">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{tr("互動模式", "Interaction mode", "インタラクションモード", "상호작용 모드")}</div>
                  {hasPendingMode && <div style={{ fontSize: 10, color: "var(--mp-txt-l)" }}>{tr("下次送出後切換", "Switch after next send", "次の送信後に切り替え", "다음 전송 후 전환")}</div>}
                </div>
                <div className="mp-mode-tabs">
                  <button className={`mp-mode-tab ${selectedMode === "online" ? "active" : ""}`} onClick={() => setSelectedChatMode(currentChatChar.id, "online")}>{tr("線上聊天", "Online chat", "オンラインチャット", "온라인 채팅")}</button>
                  <button className={`mp-mode-tab ${selectedMode === "reality" ? "active" : ""}`} onClick={() => setSelectedChatMode(currentChatChar.id, "reality")}>{tr("現實模式", "Reality mode", "現実モード", "현실 모드")}</button>
                </div>
                <div className="mp-mode-hint">
                  {selectedMode === "reality"
                    ? tr("現實模式會以段落形式呈現，可包含敘述、動作、內心想法與對話。", "Reality mode uses full-width paragraphs and supports narration, actions, inner thoughts, and dialogue.", "現実モードは段落形式で、地の文、動作、内心、会話を含められます。", "현실 모드는 문단 형식으로 묘사, 행동, 내면, 대화를 포함할 수 있습니다.")
                    : tr("線上聊天會維持手機訊息風格與短訊節奏。", "Online chat keeps the phone-bubble style and short-message pace.", "オンラインチャットはスマホの吹き出し形式と短文ペースを維持します。", "온라인 채팅은 휴대폰 말풍선 스타일과 짧은 메시지 템포를 유지합니다.")}
                </div>
              </div>
              <div className="mp-cc">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{tr("自動心聲", "Automatic inner thoughts", "心の声の自動生成", "속마음 자동 생성")}</div>
                    <div style={{ fontSize: 10, color: "var(--mp-txt-l)", marginTop: 3, lineHeight: 1.5 }}>
                      {tr("偶爾在角色回覆後產生；關閉後仍可手動窺探。", "Occasionally appears after replies. Manual peeking remains available when off.", "返信後に時々生成されます。オフでも手動で確認できます。", "답장 후 가끔 생성됩니다. 꺼도 수동으로 볼 수 있습니다.")}
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isInnerThoughtAutoEnabled(currentChatChar.id)}
                    className={`mp-switch ${isInnerThoughtAutoEnabled(currentChatChar.id) ? "active" : ""}`}
                    onClick={() => setInnerThoughtAutoEnabled(currentChatChar.id, !isInnerThoughtAutoEnabled(currentChatChar.id))}
                  >
                    <span />
                  </button>
                </div>
                <div className="mp-thought-history-divider" />
                <button
                  type="button"
                  className="mp-thought-history-toggle"
                  onClick={() => setChatSettingsThoughtsOpen((open) => !open)}
                >
                  <span>{tr("心聲紀錄", "Inner thought history", "心の声の履歴", "속마음 기록")} · {thoughtRecords.length}</span>
                  <span>{chatSettingsThoughtsOpen ? tr("收合", "Collapse", "折りたたむ", "접기") : tr("展開", "Expand", "展開", "펼치기")}</span>
                </button>
                {chatSettingsThoughtsOpen && (
                  <div className="mp-thought-history">
                    {visibleThoughtRecords.length ? visibleThoughtRecords.map((message) => (
                      <button
                        key={message.id}
                        type="button"
                        className="mp-thought-record"
                        onClick={() => jumpToThoughtMessage(message.id)}
                      >
                        <div className="mp-thought-record-meta">
                          <Eye size={12} strokeWidth={2} aria-hidden="true" />
                          <span>{new Date(message.innerThought.generatedAt || message.time).toLocaleString(uiLanguage, { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                        <div className="mp-thought-record-content">{message.innerThought.content}</div>
                        <div className="mp-thought-record-preview">{tr("原回覆", "Reply", "元の返信", "원래 답장")}：{sanitizeText(message.content || "", 46)}</div>
                      </button>
                    )) : (
                      <div className="mp-thought-history-empty">{tr("還沒有留下任何心聲", "No inner thoughts yet", "心の声はまだありません", "아직 남겨진 속마음이 없습니다")}</div>
                    )}
                    {thoughtRecords.length > thoughtPageSize && (
                      <div className="mp-thought-history-pages">
                        <button
                          type="button"
                          aria-label={tr("上一頁", "Previous page", "前のページ", "이전 페이지")}
                          disabled={activeThoughtPage === 0}
                          onClick={() => setThoughtHistoryPage((page) => Math.max(0, page - 1))}
                        >
                          <ChevronLeft size={15} aria-hidden="true" />
                        </button>
                        <span>{activeThoughtPage + 1} / {thoughtPageCount}</span>
                        <button
                          type="button"
                          aria-label={tr("下一頁", "Next page", "次のページ", "다음 페이지")}
                          disabled={activeThoughtPage >= thoughtPageCount - 1}
                          onClick={() => setThoughtHistoryPage((page) => Math.min(thoughtPageCount - 1, page + 1))}
                        >
                          <ChevronRight size={15} aria-hidden="true" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="mp-cc">
                <div
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                  onClick={() => {
                    setChatSettingsBackgroundOpen((v) => {
                      const next = !v;
                      if (!next) setChatBgEditor(null);
                      return next;
                    });
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{tr("聊天室背景", "Chat background", "チャット背景", "채팅 배경")}</div>
                  <div style={{ fontSize: 11, color: "var(--mp-txt-l)" }}>
                    {chatSettingsBackgroundOpen ? tr("收合", "Collapse", "折りたたむ", "접기") : tr("展開", "Expand", "展開", "펼치기")} · {normalizeChatBackground(chatBackgrounds?.[currentChatChar.id] || {}).src ? tr("已設定", "Set", "設定済み", "설정됨") : tr("未設定", "Not set", "未設定", "미설정")}
                  </div>
                </div>
                {chatSettingsBackgroundOpen && (<>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <div
                    style={{
                      width: 72,
                      height: 112,
                      borderRadius: 14,
                      overflow: "hidden",
                      border: "1px solid rgba(231,197,214,.8)",
                      background: "linear-gradient(135deg,#fff,#f7eef6)",
                      boxShadow: "0 2px 8px rgba(0,0,0,.04)",
                      position: "relative",
                    }}
                  >
                    {normalizeChatBackground(chatBackgrounds?.[currentChatChar.id] || {}).src && (
                      <div
                        style={{
                          ...getChatBackgroundLayerStyle(chatBackgrounds?.[currentChatChar.id] || {}),
                          filter: getChatBackgroundBlurFilter(chatBackgrounds?.[currentChatChar.id] || {}),
                        }}
                      />
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    id={`chat-bg-${currentChatChar.id}`}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) onChatBackgroundFile(currentChatChar.id, file);
                      e.target.value = "";
                    }}
                  />
                  <button className="mp-ibtn" style={{ padding: "6px 12px", fontSize: 12, lineHeight: 1 }} onClick={() => document.getElementById(`chat-bg-${currentChatChar.id}`)?.click()}>
                    {tr("上傳", "Upload", "アップロード", "업로드")}
                  </button>
                  <button className="mp-ibtn" style={{ padding: "6px 12px", fontSize: 12, lineHeight: 1 }} onClick={() => {
                    const current = normalizeChatBackground(chatBackgrounds?.[currentChatChar.id] || {});
                    setChatBgEditor({
                      charId: currentChatChar.id,
                      ...current,
                      dragging: false,
                      dragStartX: 0,
                      dragStartY: 0,
                      startX: 0,
                      startY: 0,
                    });
                  }}>
                    {tr("調整", "Adjust", "調整", "조정")}
                  </button>
                  <button className="mp-ibtn-r" style={{ padding: "6px 12px", fontSize: 12, lineHeight: 1 }} onClick={() => { updateChatBackground(currentChatChar.id, ""); setChatBgEditor(null); }}>
                    {tr("清除", "Clear", "クリア", "지우기")}
                  </button>
                </div>
                <div style={{ fontSize: 11, color: "var(--mp-txt-l)", marginTop: 6 }}>
                  {tr("未設定時會維持原本底色。", "If not set, the default background color stays.", "未設定の場合は既定の背景色のままです。", "미설정 시 기본 배경색을 유지합니다.")}
                </div>
                {chatBgEditor?.charId === currentChatChar.id && chatBgEditor.src && (
                  <div style={{ marginTop: 10, padding: 10, borderRadius: 12, background: "rgba(255,255,255,.72)", border: "1px solid rgba(231,197,214,.55)" }}>
                    <div
                      style={{
                        width: "100%",
                        aspectRatio: "9 / 16",
                        maxHeight: 360,
                        borderRadius: 14,
                        overflow: "hidden",
                        position: "relative",
                        background: "#f8f1f6",
                        touchAction: "none",
                        border: "1px solid rgba(231,197,214,.6)",
                        marginBottom: 10,
                        boxShadow: "inset 0 0 0 1px rgba(255,255,255,.45)",
                      }}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch (_) {}
                        setChatBgEditor((s) => s ? { ...s, dragging: true, dragStartX: e.clientX || 0, dragStartY: e.clientY || 0, startX: s.x || 0, startY: s.y || 0 } : s);
                      }}
                      onPointerMove={(e) => {
                        if (!chatBgEditor?.dragging) return;
                        e.preventDefault();
                        const dx = ((e.clientX || 0) - (chatBgEditor.dragStartX || 0)) / 2;
                        const dy = ((e.clientY || 0) - (chatBgEditor.dragStartY || 0)) / 2;
                        setChatBgEditor((s) => s ? { ...s, x: Math.max(-50, Math.min(50, (s.startX || 0) - dx)), y: Math.max(-50, Math.min(50, (s.startY || 0) - dy)) } : s);
                      }}
                      onPointerUp={(e) => {
                        try { e.currentTarget.releasePointerCapture?.(e.pointerId); } catch (_) {}
                        setChatBgEditor((s) => s ? { ...s, dragging: false } : s);
                      }}
                      onPointerCancel={(e) => {
                        try { e.currentTarget.releasePointerCapture?.(e.pointerId); } catch (_) {}
                        setChatBgEditor((s) => s ? { ...s, dragging: false } : s);
                      }}
                      >
                        <div
                          style={{
                            ...getChatBackgroundLayerStyle(chatBgEditor),
                            filter: getChatBackgroundBlurFilter(chatBgEditor),
                          }}
                        />
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          backgroundImage: "linear-gradient(rgba(255,255,255,.18) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.18) 1px, transparent 1px)",
                          backgroundSize: "24px 24px",
                          backgroundPosition: "center center",
                          mixBlendMode: "soft-light",
                          opacity: .55,
                          pointerEvents: "none",
                        }}
                      />
                      <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, transform: "translateX(-50%)", background: "rgba(255,255,255,.58)", pointerEvents: "none" }} />
                      <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 1, transform: "translateY(-50%)", background: "rgba(255,255,255,.58)", pointerEvents: "none" }} />
                      <div style={{ position: "absolute", left: "50%", top: "50%", width: 12, height: 12, transform: "translate(-50%, -50%)", borderRadius: 999, border: "2px solid rgba(255,255,255,.92)", boxShadow: "0 0 0 2px rgba(244,143,177,.22)", pointerEvents: "none" }} />
                      <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,.08)" }} />
                      <div style={{ position: "absolute", inset: 0, border: "2px solid rgba(255,255,255,.88)", borderRadius: 14, boxShadow: "0 0 0 9999px rgba(255,255,255,.10)", pointerEvents: "none" }} />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 11, color: "var(--mp-txt-l)" }}>{tr("縮放", "Zoom", "ズーム", "확대")}</span>
                      <input
                        type="range"
                        min="1"
                        max="2.2"
                        step="0.01"
                        value={chatBgEditor.zoom || 1}
                        onChange={(e) => setChatBgEditor((s) => s ? { ...s, zoom: Number(e.target.value) } : s)}
                        style={{ flex: 1 }}
                      />
                      <button
                        className="mp-ibtn"
                        style={{ padding: "6px 10px", fontSize: 11, lineHeight: 1 }}
                        onClick={() => {
                          const current = normalizeChatBackground(chatBackgrounds?.[currentChatChar.id] || {});
                          setChatBgEditor({ charId: currentChatChar.id, ...current, dragging: false, dragStartX: 0, dragStartY: 0, startX: 0, startY: 0 });
                        }}
                      >
                        {tr("重置", "Reset", "リセット", "초기화")}
                      </button>
                      <button
                        className="mp-ibtn"
                        style={{ padding: "6px 10px", fontSize: 11, lineHeight: 1 }}
                        onClick={() => setChatBgEditor((s) => s ? { ...s, blur: 0 } : s)}
                      >
                        {tr("無模糊", "No blur", "ぼかしなし", "흐림 없음")}
                      </button>
                      <button
                        className="mp-save"
                        style={{ padding: "6px 10px", fontSize: 11, lineHeight: 1, minWidth: 72 }}
                        onClick={() => {
                          updateChatBackground(currentChatChar.id, {
                            src: chatBgEditor.src,
                            x: chatBgEditor.x,
                            y: chatBgEditor.y,
                            zoom: chatBgEditor.zoom,
                            blur: chatBgEditor.blur,
                          });
                          setChatBgEditor((s) => s ? { ...s, dragging: false } : s);
                        }}
                      >
                        {tr("套用", "Apply", "適用", "적용")}
                      </button>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                      <span style={{ fontSize: 11, color: "var(--mp-txt-l)" }}>{tr("模糊", "Blur", "ぼかし", "흐림")}</span>
                      <input
                        type="range"
                        min="0"
                        max="24"
                        step="1"
                        value={chatBgEditor.blur || 0}
                        onChange={(e) => setChatBgEditor((s) => s ? { ...s, blur: Number(e.target.value) } : s)}
                        style={{ flex: 1 }}
                      />
                      <span style={{ width: 32, textAlign: "right", fontSize: 11, color: "var(--mp-txt-l)" }}>{Math.round(chatBgEditor.blur || 0)}px</span>
                    </div>
                  </div>
                )}
                </>)}
              </div>
              <div className="mp-cc">
                <div
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                  onClick={() => setChatSettingsLorebookOpen((v) => !v)}
                >
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{tr("世界書綁定", "Lorebook binding", "ワールドブック連携", "월드북 연결")}</div>
                  <div style={{ fontSize: 11, color: "var(--mp-txt-l)" }}>{chatSettingsLorebookOpen ? `${tr("收合", "Collapse", "折りたたむ", "접기")} · ${binding.enabledBookIds.length} ${tr("啟用", "enabled", "有効", "활성화")}` : `${tr("展開", "Expand", "展開", "펼치기")} · ${binding.enabledBookIds.length} ${tr("啟用", "enabled", "有効", "활성화")}`}</div>
                </div>
                {chatSettingsLorebookOpen && (
                  <div style={{ marginTop: 8 }}>
                    {(lorebooks || []).length === 0 && <div style={{ fontSize: 11, color: "var(--mp-txt-l)" }}>{tr("尚無世界書", "No lorebooks yet", "まだ世界観がありません", "아직 월드북이 없습니다")}</div>}
                    {(lorebooks || []).map((book) => {
                      const bookOn = binding.enabledBookIds.includes(book.id);
                      const isExpanded = !!chatSettingsExpandedBooks[book.id];
                      return (
                        <div key={book.id} style={{ marginBottom: 10, border: "1px solid rgba(244,143,177,.2)", borderRadius: 10, overflow: "hidden" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 700, padding: "10px 10px 8px", background: "rgba(244,143,177,.08)" }}>
                            <input type="checkbox" checked={bookOn} onChange={() => toggleChatLorebookBook(currentChatChar.id, book.id)} />
                            <span style={{ flex: 1 }}>{book.name || tr("未命名世界書", "Untitled lorebook", "無題の世界観", "이름 없는 월드북")}</span>
                            <span style={{ fontSize: 10, color: "var(--mp-txt-l)", fontWeight: 600 }}>{(book.entries || []).length} {tr("條目", "entries", "項目", "항목")}</span>
                            <button
                              className="mp-ibtn"
                              style={{ padding: "2px 8px", fontSize: 10 }}
                              onClick={(e) => { e.stopPropagation(); armAppClickSuppression(); setChatSettingsExpandedBooks((prev) => ({ ...prev, [book.id]: !isExpanded })); }}
                            >
                              {isExpanded ? tr("收合", "Collapse", "折りたたむ", "접기") : tr("展開", "Expand", "展開", "펼치기")}
                            </button>
                          </div>
                          {isExpanded && (
                            <div style={{ padding: "8px 10px 10px", background: "#fff" }}>
                              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                                <button className="mp-ibtn" style={{ fontSize: 10, padding: "2px 8px" }} disabled={!bookOn} onClick={(e) => { e.stopPropagation(); armAppClickSuppression(); setAllChatLorebookEntries(currentChatChar.id, book, true); }}>Select all</button>
                                <button className="mp-ibtn" style={{ fontSize: 10, padding: "2px 8px" }} disabled={!bookOn} onClick={(e) => { e.stopPropagation(); armAppClickSuppression(); setAllChatLorebookEntries(currentChatChar.id, book, false); }}>Select none</button>
                                {!bookOn && <span style={{ fontSize: 10, color: "var(--mp-txt-l)", marginLeft: "auto" }}>Enable this lorebook first</span>}
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
                                    <span style={{flex:1}}>{entry.title || "Untitled entry"}</span>
                                    <button
                                      className="mp-ibtn"
                                      disabled={!bookOn}
                                      style={{ fontSize: 10, padding: "1px 8px", borderColor: modeColor, color: modeColor }}
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        armAppClickSuppression();
                                        cycleChatLorebookEntryMode(currentChatChar.id, entry.id);
                                      }}
                                      title={tr("AUTO=keyword match, PIN=pinned", "AUTO=keyword match, PIN=pinned", "AUTO=キーワード一致、PIN=固定", "AUTO=키워드 일치, PIN=고정")}
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
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{tr("聊天室管理", "Chatroom management", "チャットルーム管理", "채팅방 관리")}</div>
                  <div style={{ fontSize: 11, color: "var(--mp-txt-l)" }}>{chatroomManageOpen ? tr("收合", "Collapse", "折りたたむ", "접기") : tr("展開", "Expand", "展開", "펼치기")}</div>
                </div>
                {chatroomManageOpen && (
                  <>
                    <div style={{ fontSize: 11, color: "var(--mp-txt-l)", lineHeight: 1.7, marginTop: 8, marginBottom: 8 }}>
                      {tr("可獨立匯出/匯入這個角色的聊天室，或刪除對話重新開始，不會影響角色本體。", "Export/import this character's chatroom separately, or delete the conversation and start over without affecting the character itself.", "このキャラのチャットルームを個別にエクスポート/インポートしたり、会話を削除して最初からやり直せます。キャラ本体には影響しません。", "이 캐릭터의 채팅방을 따로 내보내기/가져오기 하거나 대화를 삭제하고 다시 시작할 수 있으며, 캐릭터 자체에는 영향이 없습니다.")}
                    </div>
                    <div style={{ display: "grid", gap: 8 }}>
                      <button
                        type="button"
                        className="mp-save"
                        style={{ background: "linear-gradient(135deg,#90caf9,#42a5f5)" }}
                        onClick={() => exportChatroomForCharacter(currentChatChar.id, currentChatChar.name)}
                      >
                        {tr("匯出聊天室", "Export chatroom", "チャットルームを書き出す", "채팅방 내보내기")}
                      </button>
                      <button
                        type="button"
                        className="mp-save"
                        style={{ background: "linear-gradient(135deg,#b0bec5,#78909c)" }}
                        onClick={() => openChatroomImport(currentChatChar.id)}
                      >
                        {chatroomImporting ? tr("等待選擇檔案...", "Waiting for file selection...", "ファイル選択待ち...", "파일 선택 대기 중...") : tr("匯入聊天室", "Import chatroom", "チャットルームを取り込む", "채팅방 가져오기")}
                      </button>
                      <button
                        type="button"
                        className="mp-save"
                        style={{ background: "linear-gradient(135deg,#ef9a9a,#e53935)" }}
                        onClick={() => deleteChatroomForCharacter(currentChatChar.id, currentChatChar.name)}
                      >
                        {tr("刪除聊天室", "Delete chatroom", "チャットルームを削除", "채팅방 삭제")}
                      </button>
                      <input ref={chatroomImportRef} type="file" accept=".json,application/json" style={{display:"none"}} onChange={importChatroomFile} />
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className={`mp-cr mp-chat-mode-${selectedMode}`} style={chatCrStyle}>
            {chatBgUrl && (
              <>
                <div
                  style={{
                    ...getChatBackgroundLayerStyle(chatBg, 1.08),
                    filter: getChatBackgroundBlurFilter(chatBg),
                    zIndex: 0,
                  }}
                />
                <div style={{ position: "absolute", inset: 0, background: isNightTheme ? "rgba(18,12,28,.46)" : "rgba(255,255,255,.52)", pointerEvents: "none", zIndex: 0 }} />
              </>
            )}
            <div style={{position:"relative",zIndex:1}}>
              {renderSceneBar("char", currentChatChar.id, tr("場景", "Scene", "シーン", "장면"))}
            </div>
            <div
              className="mp-msgs"
              ref={chatMsgsRef}
              style={{ position: "relative", zIndex: 1 }}
              onScroll={(e) => {
                const el = e.currentTarget;
                updateScrollToBottomVisibility(el);
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
                    Load earlier messages
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
                    const isConnectionError = isConnectionErrorNotice(m.content);
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
                              <div style={{ fontWeight: 700, marginBottom: 4 }}>{tr("社群分享", "Social share", "SNS共有", "소셜 공유")}</div>
                              <div style={{ fontSize: 11, color: "var(--mp-txt-l)", marginBottom: 6 }}>
                                {tr("來源：", "Source: ", "出典: ", "출처: ")}{share.meta.source || "-"}
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
                  const fromName = m.fromType === "player" ? tr("你", "You", "あなた", "당신") : (m.fromName || tr("對方", "The other party", "相手", "상대방"));
                  const toName = m.toType === "player" ? tr("你", "You", "あなた", "당신") : (m.toName || tr("對方", "The other party", "相手", "상대방"));
                  const heading = m.fromType === "player" ? `${tr("你", "You", "あなた", "당신")} ${tr("轉帳給", "transfer to", "送金先", "송금 대상")} ${toName}` : `${fromName} ${tr("轉帳給", "transfer to", "送金先", "송금 대상")} ${tr("你", "You", "あなた", "당신")}`;
                  const statusText = m.fromType === "player" ? tr("已送出", "Sent", "送信済み", "전송됨") : tr("已收到", "Received", "受信済み", "받음");
                  return (
                    <div key={m.id} className="mp-msg-wrap mp-msg-wrap-transfer">
                      <div
                        className="mp-msg mp-transfer-card"
                        onClick={() => setActiveMessageId((p) => (p === m.id ? null : m.id))}
                      >
                        <div className="mp-transfer-success">
                          <div className="mp-transfer-check">✓</div>
                        <div className="mp-transfer-success-text">{tr("轉帳成功", "Transfer successful", "送金成功", "송금 성공")}</div>
                        </div>
                        <div className="mp-transfer-line">{heading}</div>
                        <div className="mp-transfer-meta">
                          <div className="mp-transfer-row"><span className="mp-transfer-k">{tr("轉帳金額", "Amount", "金額", "금액")}</span><span className="mp-transfer-v">${formatMoney(m.amount || 0)}</span></div>
                          <div className="mp-transfer-row"><span className="mp-transfer-k">{tr("轉帳日期", "Date", "日付", "날짜")}</span><span className="mp-transfer-v">{new Date(m.time).toLocaleDateString("zh-TW")}</span></div>
                        </div>
                        <div className="mp-transfer-note">{m.note ? `${tr("備註", "Note", "メモ", "메모")}：${m.note}` : tr("無備註", "No note", "メモなし", "메모 없음")}</div>
                        <div className="mp-transfer-footer">
                          <span>{new Date(m.time).toLocaleTimeString("zh-TW",{hour:"2-digit",minute:"2-digit"})}</span>
                          <span className="mp-transfer-status">{statusText}</span>
                        </div>
                      </div>
                      {activeMessageId === m.id && <button className="mp-msg-editbtn" onClick={() => {
                        if (!window.confirm(tr("刪除後不保留這筆交易紀錄，確定嗎？", "This transaction record will be removed. Continue?", "削除するとこの取引記録は残りません。続けますか？", "삭제하면 이 거래 기록은 남지 않습니다. 계속할까요?"))) return;
                        deleteChatMessage(currentChatChar.id, m.id);
                      }}>🗑</button>}
                    </div>
                  );
                }
                const isReality = getMessageMode(m) === "reality";
                const displayContent = stripModeLabel(stripInternalBlocks(m.content));
                if (isReality) {
                  return (
                    <div data-message-id={m.id} key={m.id} className={`mp-reality-wrap ${isUser ? "mp-reality-user" : "mp-reality-ai"} ${highlightedThoughtMessageId === m.id ? "mp-thought-jump-highlight" : ""}`}>
                      {isUser && <button className={`mp-msg-editbtn ${isActive ? "" : "mp-msg-editbtn-hidden"}`} onClick={() => setMessageEditor({ id: m.id, content: m.content || "", mode: getMessageMode(m) })}>✎</button>}
                      <div className={`mp-thought-stack ${isUser ? "mp-thought-stack-user" : ""}`}>
                        <div className="mp-reality-msg" onClick={() => setActiveMessageId((p) => (p === m.id ? null : m.id))}>
                          {m.image && <img src={`data:image/png;base64,${m.image}`} className="mp-msg-img" alt="" />}
                          {displayContent && renderRealityText(displayContent)}
                          {isUser && <div className="mp-reality-t">{new Date(m.time).toLocaleTimeString("zh-TW",{hour:"2-digit",minute:"2-digit"})}</div>}
                        </div>
                        {!isUser && <div className="mp-reality-footer">
                          <span className="mp-reality-t">{new Date(m.time).toLocaleTimeString("zh-TW",{hour:"2-digit",minute:"2-digit"})}</span>
                          {isActive && <button className="mp-msg-editbtn" onClick={() => setMessageEditor({ id: m.id, content: m.content || "", mode: getMessageMode(m) })}>✎</button>}
                          {renderCharacterVoiceAction(currentChatChar, m, isActive, true)}
                        </div>}
                        {!isUser && canRenderInnerThought(m) && renderInnerThought(currentChatChar, m)}
                      </div>
                    </div>
                  );
                }
                return (
                  <div data-message-id={m.id} key={m.id} className={`mp-msg-wrap ${isUser?"mp-msg-wrap-user":"mp-msg-wrap-ai"} ${highlightedThoughtMessageId === m.id ? "mp-thought-jump-highlight" : ""}`}>
                    {isUser && <button className={`mp-msg-editbtn ${isActive ? "" : "mp-msg-editbtn-hidden"}`} onClick={() => setMessageEditor({ id: m.id, content: m.content || "", mode: getMessageMode(m) })}>✎</button>}
                    <div className={`mp-thought-stack ${isUser ? "mp-thought-stack-user" : ""}`}>
                      <div className={`mp-msg ${isUser?"mp-msg-user":"mp-msg-ai"}`} onClick={() => setActiveMessageId((p) => (p === m.id ? null : m.id))}>
                        {m.image && <img src={`data:image/png;base64,${m.image}`} className="mp-msg-img" alt="" />}
                        {displayContent && <div>{displayContent}</div>}
                        <div className="mp-msg-t">{new Date(m.time).toLocaleTimeString("zh-TW",{hour:"2-digit",minute:"2-digit"})}</div>
                      </div>
                      {!isUser && canRenderInnerThought(m) && renderInnerThought(currentChatChar, m)}
                    </div>
                    {!isUser && <button className={`mp-msg-editbtn ${isActive ? "" : "mp-msg-editbtn-hidden"}`} onClick={() => setMessageEditor({ id: m.id, content: m.content || "", mode: getMessageMode(m) })}>✎</button>}
                    {!isUser && renderCharacterVoiceAction(currentChatChar, m, isActive)}
                  </div>
                );
              })}
              {isTyping && <div className="mp-typing"><span /><span /><span /></div>}
              <div ref={messagesEndRef} />
            </div>
            {showScrollToBottom && (
              <button
                type="button"
                className="mp-scroll-bottom"
                style={{ bottom: chatActionPanelOpen ? 142 : (chatImage ? 148 : 68) }}
                aria-label={tr("捲到最新訊息", "Scroll to latest message", "最新メッセージへ移動", "최신 메시지로 이동")}
                title={tr("捲到最新訊息", "Scroll to latest message", "最新メッセージへ移動", "최신 메시지로 이동")}
                onClick={scrollCurrentChatToBottom}
              >
                <ArrowDown size={23} strokeWidth={2.2} aria-hidden="true" />
              </button>
            )}
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
                  <span>{tr("相片", "Photo", "写真", "사진")}</span>
                </button>
                <button className="mp-chat-action" onClick={() => { setChatActionPanelOpen(false); setTransferModalOpen(true); }}>
                  <span className="mp-chat-action-i">💸</span>
                  <span>{tr("轉帳", "Transfer", "送金", "송금")}</span>
                </button>
                <button className="mp-chat-action" disabled>
                  <span className="mp-chat-action-i">📅</span>
                  <span>{tr("日程", "Schedule", "予定", "일정")}</span>
                </button>
                <button className="mp-chat-action" disabled>
                  <span className="mp-chat-action-i">⚙️</span>
                  <span>{tr("更多", "More", "その他", "더보기")}</span>
                </button>
              </div>
            )}
              <div className="mp-inp-bar">
                <button className={`mp-btn mp-btn-img ${chatActionPanelOpen ? "active" : ""}`} onClick={()=>setChatActionPanelOpen((v) => !v)}>＋</button>
                <input type="file" ref={fileInputRef} accept="image/*" style={{display:"none"}} onChange={handleImgUp} />
                <div className="mp-inp-wrap">
                  <textarea
                    className="mp-inp"
                    placeholder={tr("輸入訊息...", "Type a message...", "メッセージを入力...", "메시지를 입력...")}
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
        <div className="mp-hdr"><div className="mp-back" onClick={closeApp}>←</div><div className="mp-htitle">{t("chat")}</div></div>
        <div className="mp-cl">
          {characters.length === 0 ? <div className="mp-empty"><div className="mp-empty-i">💬</div><div className="mp-empty-t">No characters to chat with yet<br/>Add one from Characters</div></div>
          : characters.map(c => { const ms = chatHistory[c.id]||[]; const lm = ms[ms.length-1]; return (
            <div key={c.id} className="mp-ci" onClick={()=>setCurrentChatChar(c)}>
              <div className="mp-ci-av">{sanitizeUserImageUrl(c.avatar)?<img src={sanitizeUserImageUrl(c.avatar)} alt=""/>:"🦊"}</div>
              <div className="mp-ci-info"><div className="mp-ci-name">{c.name}</div><div className="mp-ci-prev">{lm?(lm.role==="transfer"?(lm.note?`Transfer ${formatMoney(lm.amount)}｜${lm.note}`:`Transfer ${formatMoney(lm.amount)}`):(lm.image?"[Image]":stripModeLabel(stripInternalBlocks(lm.content))?.slice(0,30))):"No messages yet"}</div></div>
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
            <div className="mp-htitle">{t("social")}</div>
        <div className="mp-social-head-actions">
          <button className="mp-pill-btn mp-pill-btn-ghost" onClick={() => setPlayerPostModalOpen(true)}>Post</button>
          {characters.length > 0 && (
            <button className="mp-pill-btn" onClick={handleRandomSocialPost}>{t("refresh")}</button>
          )}
        </div>
      </div>
      <div className="mp-feed">
        {posts.length === 0 ? (
          <div className="mp-empty">
            <div className="mp-empty-i">📰</div>
            <div className="mp-empty-t">No posts yet<br/>Try posting an update</div>
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
                  {postExpanded ? "Collapse" : "Show more"}
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
                  Comments {comments.length}
                </button>
                {!isPlayerPost && <button className="mp-post-act" onClick={() => sharePostToChat(p)}>Share</button>}
              </div>
              {isPlayerPost && likesOpen && (
                <div className="mp-liked-by">{likeListText || "No likes yet"}</div>
              )}
              {commentsOpen && (
                <div className={`mp-comments ${scrollComments ? "scroll" : ""}`}>
                  {comments.length === 0 && <div className="mp-comment empty">{tr("目前沒有留言", "No comments yet", "まだコメントはありません", "아직 댓글이 없습니다")}</div>}
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
                        {c.replyToName && <em>{tr(`回覆 ${c.replyToName} `, `Replying to ${c.replyToName} `, `${c.replyToName} に返信 `, `${c.replyToName}에게 답글 `)}</em>}
                        {c.content}
                      </div>
                      {isReplyOpen && (
                        <div className="mp-comment-input mp-comment-inline-input">
                          <input
                            className="mp-sinp"
                            placeholder={tr(`回覆 ${author}...`, `Reply to ${author}...`, `${author} に返信...`, `${author}에게 답글...`)}
                            value={postCommentInputs[replyInputKey] || ""}
                            maxLength={240}
                            onChange={(e) => setPostCommentInputs((prev) => ({ ...prev, [replyInputKey]: e.target.value }))}
                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPostComment(p.id, targetForThis); } }}
                            autoFocus
                          />
                          <button className="mp-ibtn" onClick={() => setSocialReplyTarget(null)}>{t("cancel")}</button>
                          <button className="mp-ibtn" onClick={() => addPostComment(p.id, targetForThis)}>Send</button>
                        </div>
                      )}
                    </div>
                  );})}
                  <div className="mp-comment-input">
                    <input
                      className="mp-sinp"
                      placeholder="Write a comment..."
                      value={postCommentInputs[p.id] || ""}
                      maxLength={240}
                      onChange={(e) => setPostCommentInputs((prev) => ({ ...prev, [p.id]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPostComment(p.id); } }}
                    />
                    <button className="mp-ibtn" onClick={() => addPostComment(p.id)}>Send</button>
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
    const exportLorebook = (book) => {
      if (!book) return;
      const safeName = sanitizeText(book.name || "lorebook", 80)
        .replace(/[\\/:*?"<>|]+/g, "-")
        .trim() || "lorebook";
      downloadJsonFile({
        format: "maliphone-lorebook",
        version: 1,
        exportedAt: new Date().toISOString(),
        lorebook: {
          name: book.name || "",
          description: book.description || "",
          enabled: book.enabled !== false,
          entries: (book.entries || []).map((entry) => ({
            title: entry.title || "",
            keywords: Array.isArray(entry.keywords) ? entry.keywords : [],
            content: entry.content || "",
            enabled: entry.enabled !== false,
          })),
        },
      }, `${safeName}.malilorebook.json`);
      showToast(tr("世界書已匯出", "Lorebook exported", "世界観を書き出しました", "월드북을 내보냈습니다"));
    };
    const normalizeImportedLorebook = (rawBook, fallbackName) => {
      if (!rawBook || typeof rawBook !== "object") return null;
      const rawEntries = Array.isArray(rawBook.entries)
        ? rawBook.entries
        : rawBook.entries && typeof rawBook.entries === "object"
          ? Object.values(rawBook.entries)
          : [];
      const now = Date.now();
      const normalizedEntries = rawEntries.map((entry, index) => {
        if (!entry || typeof entry !== "object") return null;
        const rawKeywords = entry.keywords ?? entry.keys ?? entry.key ?? [];
        const keywords = (Array.isArray(rawKeywords) ? rawKeywords : String(rawKeywords || "").split(","))
          .map((keyword) => sanitizeText(String(keyword).trim(), 32))
          .filter(Boolean)
          .slice(0, 20);
        const title = sanitizeText(
          entry.title || entry.comment || entry.name || keywords[0] || `${tr("條目", "Entry", "項目", "항목")} ${index + 1}`,
          120
        );
        return {
          id: gid(),
          title,
          keywords,
          content: sanitizeText(entry.content || entry.text || "", 3000),
          enabled: typeof entry.enabled === "boolean" ? entry.enabled : !entry.disable,
          updatedAt: now + index,
        };
      }).filter(Boolean);
      return {
        id: gid(),
        name: sanitizeText(rawBook.name || rawBook.title || fallbackName || tr("匯入的世界書", "Imported lorebook", "インポートした世界観", "가져온 월드북"), 80),
        description: sanitizeText(rawBook.description || "", 400),
        enabled: rawBook.enabled !== false,
        updatedAt: now,
        entries: normalizedEntries,
      };
    };
    const importLorebookFile = async (event) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      try {
        const parsed = JSON.parse(await file.text());
        const fallbackName = file.name.replace(/(?:\.malilorebook)?\.json$/i, "");
        const candidates = Array.isArray(parsed?.lorebooks)
          ? parsed.lorebooks
          : Array.isArray(parsed?.state?.lorebooks)
            ? parsed.state.lorebooks
            : [parsed?.lorebook || parsed];
        const importedBooks = candidates
          .map((book, index) => normalizeImportedLorebook(book, candidates.length > 1 ? `${fallbackName} ${index + 1}` : fallbackName))
          .filter(Boolean);
        if (importedBooks.length === 0) throw new Error(tr("找不到可匯入的世界書", "No importable lorebook found", "インポートできる世界観が見つかりません", "가져올 수 있는 월드북을 찾을 수 없습니다"));
        setLorebooks((prev) => [...importedBooks, ...prev]);
        setActiveLorebookId(importedBooks[0].id);
        showToast(tr(`已匯入 ${importedBooks.length} 本世界書`, `Imported ${importedBooks.length} lorebook(s)`, `${importedBooks.length}件の世界観をインポートしました`, `월드북 ${importedBooks.length}개를 가져왔습니다`));
      } catch (err) {
        showToast(`${tr("世界書匯入失敗", "Lorebook import failed", "世界観のインポートに失敗しました", "월드북 가져오기에 실패했습니다")}：${sanitizeText(err?.message || tr("檔案格式錯誤", "Invalid file format", "ファイル形式が正しくありません", "파일 형식이 올바르지 않습니다"), 120)}`);
      }
    };
    const saveBook = () => {
      if (!editingLorebookBook?.name?.trim()) return showToast(tr("請輸入世界書名稱", "Please enter a lorebook name", "ワールドブック名を入力してください", "월드북 이름을 입력해주세요"));
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
      notify(tr("世界書已儲存", "Lorebook saved", "ワールドブックを保存しました", "월드북이 저장되었습니다"), "Lorebook saved");
    };
    const saveEntry = () => {
      if (!activeBook) return;
      if (!editingLorebookEntry?.title?.trim()) return showToast(tr("請輸入條目標題", "Please enter an entry title", "項目タイトルを入力してください", "항목 제목을 입력해주세요"));
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
      notify(tr("條目已儲存", "Entry saved", "エントリを保存しました", "항목이 저장되었습니다"), "Entry saved");
    };
    const deleteBook = (id) => {
      if (!ask("確定要刪除這本世界書嗎？", "Delete this lorebook?")) return;
      setLorebooks((prev) => prev.filter((x) => x.id !== id));
      if (activeLorebookId === id) setActiveLorebookId(null);
      notify(tr("世界書已刪除", "Lorebook deleted", "ワールドブックを削除しました", "월드북이 삭제되었습니다"), "Lorebook deleted");
    };
    const deleteEntry = (id) => {
      if (!activeBook) return;
      if (!ask("確定要刪除這個條目嗎？", "Delete this entry?")) return;
      setLorebooks((prev) => prev.map((b) => b.id === activeBook.id ? { ...b, entries: (b.entries || []).filter((x) => x.id !== id), updatedAt: Date.now() } : b));
      notify(tr("條目已刪除", "Entry deleted", "項目を削除しました", "항목이 삭제되었습니다"), "Entry deleted");
    };
    return (
      <div className="mp-page">
          <div className="mp-hdr"><div className="mp-back" onClick={() => { if (activeBook) setActiveLorebookId(null); else closeApp(); }}>←</div><div className="mp-htitle">{tr("世界書", "Lorebook", "世界観", "월드북")}</div></div>
        <div className="mp-cm">
          {!activeBook ? <>
              <div style={{display:"flex",gap:8}}>
                <button className="mp-add" style={{flex:1}} onClick={() => setEditingLorebookBook({ id: null, name: "", description: "", enabled: true })}>{tr("新增世界書", "Add lorebook", "世界観を追加", "월드북 추가")}</button>
                <button className="mp-add" style={{flex:1}} onClick={() => lorebookImportInputRef.current?.click()}>{t("import")}</button>
                <input ref={lorebookImportInputRef} type="file" accept="application/json,.json" hidden onChange={importLorebookFile} />
              </div>
            <div style={{height:8}} />
            {sortedBooks.length === 0 ? <div className="mp-empty"><div className="mp-empty-i">📚</div><div className="mp-empty-t">{tr("目前沒有世界書", "No lorebooks yet", "まだ世界観がありません", "아직 월드북이 없습니다")}</div></div> : sortedBooks.map((b) => (
              <div key={b.id} className="mp-cc">
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
                    <div style={{fontWeight:700,fontSize:13}}>{b.name}</div>
                  </div>
                <div style={{fontSize:11,color:"var(--mp-txt-l)",marginTop:4}}>{tr("條目", "Entries", "項目", "항목")}：{(b.entries || []).length}</div>
                {b.description && <div className="mp-lorebook-description" style={{fontSize:12,lineHeight:1.55,marginTop:8}}>{b.description}</div>}
                <div style={{display:"flex",gap:6,marginTop:10}}>
                  <button className="mp-ibtn-chat" onClick={() => setActiveLorebookId(b.id)}>{tr("展開", "Open", "開く", "열기")}</button>
                    <button className="mp-ibtn" onClick={() => setEditingLorebookBook({ id: b.id, name: b.name || "", description: b.description || "", enabled: true })}>{tr("編輯", "Edit", "編集", "편집")}</button>
                    <button className="mp-ibtn-r" onClick={() => deleteBook(b.id)}>{tr("刪除", "Delete", "削除", "삭제")}</button>
                  </div>
                </div>
            ))}
          </> : <>
            <div className="mp-cc" style={{marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
                <div style={{fontWeight:700,fontSize:14}}>{activeBook.name}</div>
                <div style={{display:"flex",gap:6}}>
                  <button className="mp-ibtn" onClick={() => setPendingLorebookExport(activeBook)}>{t("export")}</button>
                  <button className="mp-ibtn" onClick={() => setActiveLorebookId(null)}>{t("backToList")}</button>
                </div>
              </div>
              {activeBook.description && <div className="mp-lorebook-description" style={{fontSize:12,color:"var(--mp-txt-l)",marginTop:6}}>{activeBook.description}</div>}
            </div>
            <button className="mp-add" onClick={() => setEditingLorebookEntry({ id: null, title: "", keywords: "", content: "", enabled: true })}>{tr("新增條目", "Add entry", "項目を追加", "항목 추가")}</button>
            <div style={{height:8}} />
            {sortedEntries.length === 0 ? <div className="mp-empty"><div className="mp-empty-i">📖</div><div className="mp-empty-t">{tr("這本世界書尚無條目", "This lorebook has no entries yet", "この世界観にはまだ項目がありません", "이 월드북에는 아직 항목이 없습니다")}</div></div> : sortedEntries.map((e) => (
              <div key={e.id} className="mp-cc">
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
                  <div style={{fontWeight:700,fontSize:13}}>{e.title}</div>
                  <span className={`mp-active-badge ${e.enabled ? "mp-badge-enabled" : "mp-badge-disabled"}`}>{e.enabled ? tr("啟用", "Enabled", "有効", "활성") : tr("停用", "Disabled", "無効", "비활성")}</span>
                </div>
                <div style={{fontSize:11,color:"var(--mp-txt-l)",marginTop:4}}>{tr("關鍵字", "Keywords", "キーワード", "키워드")}：{(e.keywords||[]).join("、") || tr("無", "None", "なし", "없음")}</div>
                <div style={{fontSize:12,lineHeight:1.55,marginTop:8,display:"-webkit-box",WebkitLineClamp:3,WebkitBoxOrient:"vertical",overflow:"hidden",whiteSpace:"pre-wrap"}}>{e.content || ""}</div>
                <div style={{display:"flex",gap:6,marginTop:10}}>
                  <button className="mp-ibtn mp-ibtn-view" onClick={() => setViewingLorebookEntry(e)}>{tr("展開", "Open", "開く", "열기")}</button>
                  <button className="mp-ibtn" onClick={() => setLorebooks((prev) => prev.map((b) => b.id === activeBook.id ? { ...b, entries: (b.entries || []).map((x) => x.id === e.id ? { ...x, enabled: !x.enabled, updatedAt: Date.now() } : x), updatedAt: Date.now() } : b))}>{e.enabled ? tr("停用", "Disable", "無効", "비활성") : tr("啟用", "Enable", "有効", "활성")}</button>
                  <div style={{marginLeft:"auto"}} />
                  <button className="mp-ibtn-r" onClick={() => deleteEntry(e.id)}>{tr("刪除", "Delete", "削除", "삭제")}</button>
                </div>
              </div>
            ))}
          </>}
        </div>
        {pendingLorebookExport && (
          <div className="mp-overlay" onClick={() => setPendingLorebookExport(null)}>
            <div className="mp-modal" onClick={(ev) => ev.stopPropagation()}>
              <div className="mp-modal-t">{tr("確認匯出世界書", "Confirm lorebook export", "世界観の書き出し確認", "월드북 내보내기 확인")}</div>
              <div style={{fontSize:13,lineHeight:1.65,color:"var(--mp-txt)",marginTop:8}}>
                {tr("即將匯出", "You are about to export", "書き出す世界観", "내보낼 월드북")}：<strong>{pendingLorebookExport.name || tr("未命名世界書", "Untitled lorebook", "無題の世界観", "이름 없는 월드북")}</strong>
              </div>
              <div style={{fontSize:11,color:"var(--mp-txt-l)",marginTop:4}}>
                {tr("條目", "Entries", "項目", "항목")}：{(pendingLorebookExport.entries || []).length}
              </div>
              <div style={{display:"flex",gap:8,marginTop:16}}>
                <button className="mp-save" style={{flex:1,background:"linear-gradient(135deg,#b0bec5,#90a4ae)"}} onClick={() => setPendingLorebookExport(null)}>{t("cancel")}</button>
                <button className="mp-save" style={{flex:1}} onClick={() => { exportLorebook(pendingLorebookExport); setPendingLorebookExport(null); }}>{tr("確認匯出", "Confirm export", "書き出す", "내보내기 확인")}</button>
              </div>
            </div>
          </div>
        )}
        {viewingLorebookEntry && (
          <div className="mp-overlay" onClick={() => setViewingLorebookEntry(null)}>
            <div className="mp-modal" onClick={(ev) => ev.stopPropagation()}>
              <div className="mp-modal-t" style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
                <span>{viewingLorebookEntry.title || t("title")}</span>
                <span className={`mp-active-badge ${viewingLorebookEntry.enabled ? "mp-badge-enabled" : "mp-badge-disabled"}`}>{viewingLorebookEntry.enabled?t("enable"):t("disable")}</span>
              </div>
              <div className="mp-row"><div className="mp-lbl">{t("keywords")}</div><div style={{fontSize:12,color:"var(--mp-txt-l)"}}>{(viewingLorebookEntry.keywords || []).join("、") || "無"}</div></div>
              <div className="mp-row"><div className="mp-lbl">{t("content")}</div><div className="mp-lorebook-content">{viewingLorebookEntry.content || ""}</div></div>
              <div style={{display:"flex",gap:8,marginTop:8}}>
                <button className="mp-save" style={{flex:1,background:"linear-gradient(135deg,#b0bec5,#90a4ae)"}} onClick={() => setViewingLorebookEntry(null)}>{t("close")}</button>
                <button className="mp-save" style={{flex:1}} onClick={() => { setViewingLorebookEntry(null); setEditingLorebookEntry({ id: viewingLorebookEntry.id, title: viewingLorebookEntry.title || "", keywords: (viewingLorebookEntry.keywords || []).join(", "), content: viewingLorebookEntry.content || "", enabled: !!viewingLorebookEntry.enabled }); }}>{t("edit")}</button>
              </div>
            </div>
          </div>
        )}
        {editingLorebookBook && (
          <div className="mp-overlay" onClick={() => setEditingLorebookBook(null)}>
            <div className="mp-modal" onClick={(ev) => ev.stopPropagation()}>
              <div className="mp-modal-t">{editingLorebookBook.id ? tr("編輯世界書", "Edit lorebook", "世界観を編集", "월드북 편집") : tr("新增世界書", "Add lorebook", "世界観を追加", "월드북 추가")}</div>
              <div className="mp-row"><div className="mp-lbl">{tr("名稱", "Name", "名前", "이름")} *</div><input className="mp-sinp" value={editingLorebookBook.name} onChange={(ev)=>setEditingLorebookBook((s)=>({ ...s, name: ev.target.value }))} placeholder={tr("例如：學園設定、組織規範", "e.g. school rules, organization rules", "例: 学園設定、組織規範", "예: 학교 설정, 조직 규정")} /></div>
              <div className="mp-row"><div className="mp-lbl">{tr("描述", "Description", "説明", "설명")}</div><textarea className="mp-ta" value={editingLorebookBook.description} onChange={(ev)=>setEditingLorebookBook((s)=>({ ...s, description: ev.target.value }))} style={{minHeight:100,resize:"vertical"}} /></div>
                <div style={{display:"flex",gap:8,marginTop:8}}>
                <button className="mp-save" style={{flex:1,background:"linear-gradient(135deg,#b0bec5,#90a4ae)"}} onClick={() => setEditingLorebookBook(null)}>{tr("取消", "Cancel", "キャンセル", "취소")}</button>
                <button className="mp-save" style={{flex:1}} onClick={saveBook}>{tr("儲存", "Save", "保存", "저장")}</button>
              </div>
            </div>
          </div>
        )}
        {editingLorebookEntry && (
          <div className="mp-overlay" onClick={() => setEditingLorebookEntry(null)}>
            <div className="mp-modal" onClick={(ev) => ev.stopPropagation()}>
              <div className="mp-modal-t">{editingLorebookEntry.id ? tr("編輯條目", "Edit entry", "項目を編集", "항목 편집") : tr("新增條目", "Add entry", "項目を追加", "항목 추가")}</div>
              <div className="mp-row"><div className="mp-lbl">{tr("標題", "Title", "タイトル", "제목")} *</div><input className="mp-sinp" value={editingLorebookEntry.title} onChange={(ev)=>setEditingLorebookEntry((s)=>({ ...s, title: ev.target.value }))} placeholder={tr("例如：學校、地區、組織", "e.g. school, district, organization", "例: 学校、地域、組織", "예: 학교, 지역, 조직")} /></div>
              <div className="mp-row"><div className="mp-lbl">{tr("關鍵字", "Keywords", "キーワード", "키워드")} ({tr("逗號分隔", "Comma-separated", "カンマ区切り", "쉼표로 구분")})</div><input className="mp-sinp" value={editingLorebookEntry.keywords} onChange={(ev)=>setEditingLorebookEntry((s)=>({ ...s, keywords: ev.target.value }))} placeholder={tr("例如：十支局, 受訓, 規範", "e.g. ten squads, training, rules", "例: 十支局、訓練、規範", "예: 10부서, 훈련, 규정")} /></div>
              <div className="mp-row"><div className="mp-lbl">{tr("內容", "Content", "内容", "내용")}</div><textarea className="mp-ta" value={editingLorebookEntry.content} onChange={(ev)=>setEditingLorebookEntry((s)=>({ ...s, content: ev.target.value }))} style={{minHeight:160,resize:"vertical"}} /></div>
              <div className="mp-row" style={{display:"flex",alignItems:"center",gap:8}}><input id="lb_enabled" type="checkbox" checked={!!editingLorebookEntry.enabled} onChange={(ev)=>setEditingLorebookEntry((s)=>({ ...s, enabled: ev.target.checked }))} /><label htmlFor="lb_enabled" className="mp-lbl" style={{margin:0}}>{tr("啟用", "Enable", "有効", "활성")} {tr("此條目", "this entry", "この項目", "이 항목")}</label></div>
              <div style={{display:"flex",gap:8,marginTop:8}}>
                <button className="mp-save" style={{flex:1,background:"linear-gradient(135deg,#b0bec5,#90a4ae)"}} onClick={() => setEditingLorebookEntry(null)}>{tr("取消", "Cancel", "キャンセル", "취소")}</button>
                <button className="mp-save" style={{flex:1}} onClick={saveEntry}>{tr("儲存", "Save", "保存", "저장")}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderCharacters = () => (
    <div className="mp-page">
      <div className="mp-hdr"><div className="mp-back" onClick={closeApp}>←</div><div className="mp-htitle">{t("characters")}</div></div>
      <div className="mp-cm">
        <button className="mp-add" onClick={()=>{setEditingCharacter(null);setModal("addChar");}}>{t("add")} / {t("import")} {t("characters")}</button><div style={{height:8}} />
        {characters.map(c=>(
            <div key={c.id} className="mp-cc">
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                <div className="mp-av">{sanitizeUserImageUrl(c.avatar)?<img src={sanitizeUserImageUrl(c.avatar)} alt=""/>:"🦊"}</div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:13}}>{c.name}</div>
                  <div style={{fontSize:11,color:"var(--mp-txt-l)"}}>{(c.description || c.personality || t("noRoleConfig")).slice(0,52)}</div>
                </div>
                {activeCharId===c.id?<span className="mp-active-badge">ACTIVE</span>:<button className="mp-ibtn" onClick={()=>{setActiveCharId(c.id);showToast(`${c.name} ${t("setAsMainCharacter")}`);}}>{t("setAsMainCharacter")}</button>}
              </div>
              <div style={{display:"flex",gap:6}}>
                <button className="mp-ibtn-chat" onClick={()=>{setCurrentChatChar(c);openApp("chat");}}>{t("startChatting")}</button>
                <button className="mp-ibtn-chat" onClick={()=>{setEditingCharacter(c);setModal("addChar");}}>{t("viewMore")}</button>
              </div>
            </div>
        ))}
      </div>
    </div>
  );

  const renderSettings = () => {
    const tc = tempConfig || apiConfig;
    const activeTtsConfig = ttsConfig[ttsConfig.provider] || {};
    const availableTtsVoices = ttsVoices.length ? ttsVoices : (ttsConfig.elevenlabs?.availableVoices || []);
    const updateActiveTtsConfig = (patch) => setTtsConfig((current) => ({
      ...current,
      [current.provider]: { ...(current[current.provider] || {}), ...patch },
    }));
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
      notify(tr("已儲存到預設", `Saved to preset ${idx + 1}`, `プリセット ${idx + 1} に保存しました`, `프리셋 ${idx + 1}에 저장되었습니다`), `Saved to preset ${idx + 1}`);
    };
    const testApiConnection = async () => {
      if (testingConnection) return;
      setTestingConnection(true);
      try {
        const reply = await callAI([{ role: "user", content: "請只回覆 OK" }], tc, "你是連線測試助手，只能回覆 OK。");
        const ok = /\bOK\b|ＯＫ/i.test(String(reply || "").trim());
        notify("連線成功", ok ? "Connection successful" : `Connected, but the reply looks odd: ${sanitizeText(reply, 40) || "empty"}`);
      } catch (err) {
        notify("連線失敗", `Connection failed: ${sanitizeText(err?.message || "unknown error", 120)}`);
      }
      setTestingConnection(false);
    };
    const clearSiteCache = async () => {
      try {
        if (!clearCacheArmed) {
          setClearCacheArmed(true);
          showToast(tr("再按一次清除快取", "Tap again to clear cache", "もう一度押すとキャッシュを削除します", "한 번 더 누르면 캐시를 삭제합니다"));
          setTimeout(() => setClearCacheArmed(false), 3000);
          return;
        }
        setClearCacheArmed(false);
        if (!window.confirm(tr("確定要清除網站快取並重新載入嗎？", "Clear site cache and reload?", "サイトキャッシュを削除して再読み込みしますか？", "사이트 캐시를 삭제하고 다시 불러올까요?"))) return;
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
        if ("serviceWorker" in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister()));
        }
        showToast(tr("快取已清除，正在重新載入", "Cache cleared, reloading now", "キャッシュを削除しました。再読み込みしています", "캐시를 삭제했습니다. 다시 불러오는 중입니다"));
        setTimeout(() => window.location.reload(), 250);
      } catch (err) {
        showToast(`${tr("清除快取失敗", "Failed to clear cache", "キャッシュ削除に失敗しました", "캐시 삭제 실패")}：${err?.message || tr("未知錯誤", "Unknown error", "不明なエラー", "알 수 없는 오류")}`);
      }
    };
    return (
      <div className="mp-page">
        <div className="mp-hdr"><div className="mp-back" onClick={closeApp}>←</div><div className="mp-htitle">{t("settings")}</div></div>
        <div className="mp-set">
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:4}}>
            {[
              { id: "appearance", label: t("appearance") },
              { id: "api", label: t("api") },
              { id: "data", label: t("data") },
              { id: "about", label: t("about") },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                className="mp-ibtn"
                style={{
                  padding: "8px 6px",
                  minWidth: 0,
                  fontWeight: 800,
                  background: settingsTab === tab.id
                    ? (isNightTheme ? "linear-gradient(135deg,#4b3a62,#3a2d4f)" : "linear-gradient(135deg,#9aa8b3,#7b8791)")
                    : (isNightTheme ? "rgba(47,36,64,.72)" : "rgba(255,255,255,.72)"),
                  color: settingsTab === tab.id ? "#fff" : "var(--mp-txt)",
                  border: settingsTab === tab.id
                    ? (isNightTheme ? "1px solid rgba(200,168,224,.38)" : "1px solid rgba(123,135,145,.35)")
                    : (isNightTheme ? "1px solid #3a2d4f" : "1px solid rgba(160,176,186,.25)"),
                }}
                onClick={() => setSettingsTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {settingsTab === "appearance" && (
            <div className="mp-sg">
              <div className="mp-sg-t">{t("theme")}</div>
              <div className="mp-row">
                <div className="mp-lbl">{t("theme")}</div>
                <select className="mp-ssel" value={themeName} onChange={(e) => setThemeName(e.target.value)}>
                  <option value="莓果蘇打">{tr("莓果蘇打", "Berry Soda", "ベリーソーダ", "베리 소다")}</option>
                  <option value="夜色絨幕">{tr("夜色絨幕", "Velvet Night", "夜色ベルベット", "밤빛 벨벳")}</option>
                </select>
              </div>
              <div style={{fontSize:10,color:"var(--mp-txt-l)",lineHeight:1.6,marginBottom:10}}>{t("defaultTheme")}</div>
              <div className="mp-row">
                <div className="mp-lbl">{t("language")}</div>
                <select className="mp-ssel" value={uiLanguage} onChange={(e) => setUiLanguage(e.target.value)}>
                  <option value="zh-TW">繁體中文</option>
                  <option value="en">English</option>
                  <option value="ja">日本語</option>
                  <option value="ko">한국어</option>
                </select>
              </div>
              <div className="mp-sg-t">{t("screenLock")}</div>
              <div className="mp-row">
                <div className="mp-lbl">{t("autoLock")}</div>
                <select className="mp-ssel" value={String(screenLockTimeout)} onChange={(e) => setScreenLockTimeout(Number(e.target.value))}>
                  <option value="1">{tr("1 分鐘", "1 minute", "1分", "1분")}</option>
                  <option value="3">{tr("3 分鐘", "3 minutes", "3分", "3분")}</option>
                  <option value="5">{tr("5 分鐘", "5 minutes", "5分", "5분")}</option>
                  <option value="10">{tr("10 分鐘", "10 minutes", "10分", "10분")}</option>
                  <option value="0">{t("neverLock")}</option>
                </select>
              </div>
              <div style={{fontSize:10,color:"var(--mp-txt-l)",lineHeight:1.6}}>
                {t("autoLockStatus")}：{screenLockTimeout === 0 ? t("neverLock") : `${screenLockTimeout} 分鐘後自動鎖定`}
              </div>
            </div>
          )}
          {settingsTab === "api" && (
            <>
              <div className="mp-sg">
                <div className="mp-sg-t">{tr("API 預設", "API presets", "API プリセット", "API 프리셋")}</div>
                <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                  {[0,1,2].map((idx) => (
                    <button key={idx} className="mp-ibtn" style={{minWidth:44,padding:"4px 8px"}} onClick={() => applyApiPreset(idx)}>{`P${idx + 1}`}</button>
                  ))}
                </div>
                <div style={{fontSize:10,color:"var(--mp-txt-l)",marginTop:6}}>
                  {activePresetIndex >= 0
                    ? `${tr("目前預設", "Current preset", "現在のプリセット", "현재 프리셋")}：P${activePresetIndex + 1} · ${tc.provider || "-"} · ${tc.model || "-"}`
                  : `${tr("目前預設", "Current preset", "現在のプリセット", "현재 프리셋")}：${tr("自訂", "Custom", "カスタム", "사용자 지정")} · ${tc.provider || "-"} · ${tc.model || "-"}`}
                </div>
              </div>
              <div className="mp-sg">
                <div className="mp-sg-t">{tr("AI 連線", "AI connection", "AI 接続", "AI 연결")}</div>
                <div className="mp-row"><div className="mp-lbl">{tr("API 供應商", "API provider", "API プロバイダー", "API 제공업체")}</div><select className="mp-ssel" value={tc.provider} onChange={e=>{const p=API_PROVIDERS.find(x=>x.id===e.target.value);setTempConfig(c=>({...c,provider:p.id,baseUrl:getProviderBaseUrl(p.id,c?.baseUrl || ""),model:p.models[0]||""}));}}>{API_PROVIDERS.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
                {tc.provider === "custom" && <div className="mp-row"><div className="mp-lbl">Base URL</div><input className="mp-sinp" value={tc.baseUrl} onChange={e=>setTempConfig(c=>({...c,baseUrl:e.target.value}))} placeholder="https://..." /></div>}
                {tc.provider === "vertex" && <div className="mp-row"><div className="mp-lbl">{tr("區域", "Region", "リージョン", "리전")}</div><input className="mp-sinp" value={tc.location || "global"} onChange={e=>setTempConfig(c=>({...c,location:e.target.value}))} placeholder="global" /></div>}
                <div className="mp-row"><div className="mp-lbl">{tr("API 金鑰", "API key", "API キー", "API 키")}</div><input className="mp-sinp" type="password" value={tc.apiKey} onChange={e=>setTempConfig(c=>({...c,apiKey:e.target.value}))} placeholder={tc.provider === "vertex" ? "AIza..." : "sk-..."} /></div>
                <div className="mp-row">
                  <div className="mp-lbl" style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
                    <span>{tr("模型", "Model", "モデル", "모델")}</span>
                    <button
                      type="button"
                      className="mp-ibtn"
                      disabled={fetchingModels}
                      onClick={async ()=>{
                        try {
                          setFetchingModels(true);
                          const models = sortModelsByProvider(tc.provider, await fetchAvailableModels(tc));
                          if (!models.length) throw new Error(tr("找不到可用模型", "No models found", "利用可能なモデルが見つかりません", "사용 가능한 모델을 찾을 수 없습니다"));
                          setProviderModelOptions(prev => ({ ...prev, [tc.provider]: models }));
                          setTempConfig(c => ({ ...c, model: models.includes(c.model) ? c.model : models[0] }));
                          showToast(tr(`已抓取 ${models.length} 個模型`, `Fetched ${models.length} models`, `${models.length}件のモデルを取得しました`, `모델 ${models.length}개를 가져왔습니다`));
                        } catch (err) {
                          if (tc.provider === "vertex") {
                            showToast(`${tr("抓取失敗，可手動輸入模型名稱", "Fetch failed; you can type the model name manually", "取得に失敗しました。モデル名を手動入力できます", "가져오기에 실패했습니다. 모델 이름을 직접 입력할 수 있습니다")}：${err.message}`);
                            return;
                          }
                          showToast(`${tr("抓取失敗", "Fetch failed", "取得に失敗しました", "가져오기 실패")}：${err.message}`);
                        } finally {
                          setFetchingModels(false);
                        }
                      }}
                    >
                      {fetchingModels ? t("loading") : tr("取得最新模型", "Fetch latest models", "最新モデルを取得", "최신 모델 가져오기")}
                    </button>
                  </div>
                  {modelOptions?.length>0
                    ? <select className="mp-ssel" value={tc.model} onChange={e=>setTempConfig(c=>({...c,model:e.target.value}))}>{modelOptions.map(m=><option key={m} value={m}>{m}</option>)}<option value="__custom">{tr("自訂...", "Custom...", "カスタム...", "사용자 지정...")}</option></select>
                    : <input className="mp-sinp" value={tc.model} onChange={e=>setTempConfig(c=>({...c,model:e.target.value}))} placeholder="model-name" />}
                </div>
                {tc.model==="__custom"&&<div className="mp-row"><div className="mp-lbl">{tr("自訂模型名稱", "Custom model name", "カスタムモデル名", "사용자 지정 모델 이름")}</div><input className="mp-sinp" onChange={e=>setTempConfig(c=>({...c,model:e.target.value}))} placeholder="model-name" /></div>}
                <div style={{display:"flex",gap:8}}>
                  <button type="button" className="mp-save" disabled={testingConnection} style={{flex:1,background:"linear-gradient(135deg,#80cbc4,#26a69a)"}} onClick={testApiConnection}>{testingConnection ? tr("測試中...", "Testing...", "テスト中...", "테스트 중...") : tr("測試連線", "Test connection", "接続テスト", "연결 테스트")}</button>
                  <button className="mp-save" style={{flex:1}} onClick={()=>{setApiConfig(tc);notify(tr("設定已儲存", "Settings saved", "設定を保存しました", "설정이 저장되었습니다"), "Settings saved");}}>{tr("儲存設定", "Save settings", "設定を保存", "설정 저장")}</button>
                  <button type="button" className="mp-save" style={{flex:1,background:"linear-gradient(135deg,#90caf9,#42a5f5)"}} onClick={()=>setPresetSavePickerOpen(true)}>{tr("儲存預設", "Save preset", "プリセット保存", "프리셋 저장")}</button>
                </div>
              </div>
              <div className="mp-sg">
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
                  <div className="mp-sg-t" style={{marginBottom:0}}>{tr("語音 API", "Voice API", "音声 API", "음성 API")}</div>
                  <button type="button" className={ttsConfig.enabled ? "mp-ibtn-chat" : "mp-ibtn"} style={{flex:"0 0 auto",padding:"5px 12px"}} onClick={() => setTtsConfig((current) => ({ ...current, enabled: !current.enabled }))}>{ttsConfig.enabled ? tr("啟用", "Enabled", "有効", "활성") : tr("關閉", "Off", "オフ", "꺼짐")}</button>
                </div>
                {!ttsConfig.enabled && <div style={{fontSize:10,color:"var(--mp-txt-l)",lineHeight:1.6,marginTop:8}}>{tr("語音功能目前關閉，設定已保留。", "Voice is off; your settings are retained.", "音声機能はオフです。設定は保持されます。", "음성 기능이 꺼져 있으며 설정은 유지됩니다.")}</div>}
                {ttsConfig.enabled && <div style={{marginTop:12}}>
                  <div className="mp-row"><div className="mp-lbl">{tr("全域語音供應商", "Global voice provider", "共通音声プロバイダー", "전역 음성 제공업체")}</div><select className="mp-ssel" value="elevenlabs" onChange={(e) => { setTtsVoices([]); setTtsConnectionState("idle"); setTtsConfig((current) => ({ ...current, provider: e.target.value })); }}><option value="elevenlabs">ElevenLabs</option></select></div>
                  <div className="mp-row"><div className="mp-lbl">API Key</div><input className="mp-sinp" type="password" value={activeTtsConfig.apiKey || ""} onChange={(e) => { setTtsConnectionState("idle"); if (ttsConfig.provider === "elevenlabs") setTtsVoices([]); updateActiveTtsConfig(ttsConfig.provider === "elevenlabs" ? { apiKey: e.target.value, availableVoices: [] } : { apiKey: e.target.value }); }} placeholder={ttsConfig.provider === "elevenlabs" ? "xi-api-key" : "MiniMax API key"} /></div>
                  <div className="mp-row"><div className="mp-lbl">{tr("語音模型", "Voice model", "音声モデル", "음성 모델")}</div>{ttsConfig.provider === "elevenlabs" ? <select className="mp-ssel" value={activeTtsConfig.model || "eleven_flash_v2_5"} onChange={(e) => updateActiveTtsConfig({ model: e.target.value })}><option value="eleven_flash_v2_5">eleven_flash_v2_5</option><option value="eleven_multilingual_v2">eleven_multilingual_v2</option><option value="eleven_v3">eleven_v3</option></select> : <select className="mp-ssel" value={activeTtsConfig.model || "speech-2.8-turbo"} onChange={(e) => updateActiveTtsConfig({ model: e.target.value })}><option value="speech-2.8-turbo">speech-2.8-turbo</option><option value="speech-2.8-hd">speech-2.8-hd</option><option value="speech-2.6-turbo">speech-2.6-turbo</option><option value="speech-2.6-hd">speech-2.6-hd</option></select>}</div>
                  {ttsConfig.provider === "minimax" && <div className="mp-row"><div className="mp-lbl">Base URL</div><input className="mp-sinp" value={activeTtsConfig.baseUrl || "https://api.minimax.io"} onChange={(e) => updateActiveTtsConfig({ baseUrl: e.target.value })} /></div>}
                  {ttsConfig.provider === "elevenlabs" ? <>
                    <div className="mp-row"><div className="mp-lbl">{tr("ElevenLabs 可用聲音", "ElevenLabs available voices", "ElevenLabs 利用可能な音声", "ElevenLabs 사용 가능 음성")}</div><select className="mp-ssel" value={activeTtsConfig.defaultVoiceId || "JBFqnCBsd6RMkjVDRZzb"} onChange={(e) => updateActiveTtsConfig({ defaultVoiceId: e.target.value })}>{availableTtsVoices.length ? availableTtsVoices.map((voice) => <option key={voice.id} value={voice.id}>{voice.name}{voice.category ? ` · ${voice.category}` : ""}</option>) : <option value={activeTtsConfig.defaultVoiceId || "JBFqnCBsd6RMkjVDRZzb"}>{tr("George（文件範例）", "George (documentation example)", "George（ドキュメント例）", "George (문서 예시)")}</option>}</select></div>
                    <button type="button" className="mp-save" disabled={ttsConnectionState === "loading" || !activeTtsConfig.apiKey} style={{background:"linear-gradient(135deg,#80cbc4,#26a69a)",marginBottom:8}} onClick={() => void loadElevenLabsDefaultVoices()}>{ttsConnectionState === "loading" ? tr("連線中...", "Connecting...", "接続中...", "연결 중...") : tr("測試連線並載入可用聲音", "Test connection and load voices", "接続テストと音声の読み込み", "연결 테스트 및 음성 불러오기")}</button>
                  </> : <div className="mp-row"><div className="mp-lbl">{tr("測試 Voice ID", "Test Voice ID", "テスト Voice ID", "테스트 Voice ID")}</div><input className="mp-sinp" value={activeTtsConfig.defaultVoiceId || ""} onChange={(e) => updateActiveTtsConfig({ defaultVoiceId: e.target.value })} /></div>}
                  <button type="button" className="mp-save" disabled={ttsConnectionState === "previewing" || !activeTtsConfig.apiKey || !activeTtsConfig.defaultVoiceId} style={{background:"linear-gradient(135deg,#90caf9,#42a5f5)"}} onClick={() => void previewDefaultTtsVoice()}>{ttsConnectionState === "previewing" ? tr("生成測試語音中...", "Generating test voice...", "テスト音声を生成中...", "테스트 음성 생성 중...") : tr("試聽預設聲音", "Preview default voice", "デフォルト音声を試聴", "기본 음성 미리듣기")}</button>
                  {ttsConnectionState === "success" && <div style={{fontSize:10,color:"#43a047",marginTop:7}}>{tr("API 連線成功", "API connected", "API 接続成功", "API 연결 성공")}</div>}
                  {ttsConnectionState === "error" && <div style={{fontSize:10,color:"#e57373",marginTop:7}}>{tr("連線或測試失敗，請檢查 Key 與權限。", "Connection or test failed. Check the key and permissions.", "接続またはテストに失敗しました。Key と権限を確認してください。", "연결 또는 테스트에 실패했습니다. Key와 권한을 확인해주세요.")}</div>}
                </div>}
              </div>
            </>
          )}
          {presetSavePickerOpen && (
            <div className="mp-overlay" style={{zIndex:120}} onClick={() => setPresetSavePickerOpen(false)}>
              <div className="mp-modal" onClick={(e) => e.stopPropagation()}>
                <div className="mp-modal-t">{tr("儲存 API 預設", "Save API preset", "API プリセットを保存", "API 프리셋 저장")}</div>
                <div style={{display:"grid",gap:8}}>
                  {[0,1,2].map((idx) => (
                    <button
                      type="button"
                      key={idx}
                      className="mp-ibtn-chat"
                      onClick={() => {
                        const ok = window.confirm(tr(`確定要覆寫 P${idx + 1} 嗎？`, `Overwrite P${idx + 1}?`, `P${idx + 1} を上書きしますか？`, `P${idx + 1}을(를) 덮어쓸까요?`));
                        if (!ok) return;
                        saveApiPreset(idx);
                        setPresetSavePickerOpen(false);
                      }}
                    >
                      {tr(`儲存至 P${idx + 1}`, `Save to P${idx + 1}`, `P${idx + 1} に保存`, `P${idx + 1}에 저장`)}
                    </button>
                  ))}
                </div>
                <div style={{marginTop:10}}>
                  <button type="button" className="mp-save" style={{background:"linear-gradient(135deg,#b0bec5,#90a4ae)"}} onClick={() => setPresetSavePickerOpen(false)}>{t("cancel")}</button>
                </div>
              </div>
            </div>
          )}
          {settingsTab === "data" && (
            <>
              <div className="mp-sg">
                <div className="mp-sg-t">{tr("全域資料備份", "Global data backup", "全体データバックアップ", "전체 데이터 백업")}</div>
                <div style={{fontSize:12,color:"var(--mp-txt-l)",lineHeight:1.7,marginBottom:8}}>
                  {tr("這裡可以把整個 App 的主要進度打包下載，或從備份檔匯入後直接接續。", "You can export the app's main progress as a package, or import a backup file and continue from there.", "この場所では、アプリ全体の進行状況をまとめて書き出したり、バックアップファイルを取り込んで続きから再開できます。", "여기에서는 앱의 주요 진행 상황을 묶어서 내보내거나, 백업 파일을 가져와 이어서 사용할 수 있습니다.")}
                </div>
                <div style={{display:"grid",gap:8}}>
                  <button className="mp-save" style={{background:"linear-gradient(135deg,#90caf9,#42a5f5)"}} onClick={exportAllData}>{tr("匯出全域資料", "Export global data", "全体データを書き出す", "전체 데이터 내보내기")}</button>
                  <button type="button" className="mp-save" style={{background:"linear-gradient(135deg,#b0bec5,#78909c)"}} onClick={() => dataImportRef.current?.click()}>
                    {dataImporting ? tr("等待選擇檔案...", "Waiting for file selection...", "ファイル選択待ち...", "파일 선택 대기 중...") : tr("匯入全域資料", "Import global data", "全体データを取り込む", "전체 데이터 가져오기")}
                  </button>
                  <input ref={dataImportRef} type="file" accept=".json,application/json" style={{display:"none"}} onChange={importAllData} />
                </div>
              </div>
              <div className="mp-sg">
                <div className="mp-sg-t">{tr("使用提醒", "Usage notes", "使用上の注意", "사용 안내")}</div>
                <div style={{fontSize:12,color:"var(--mp-txt-l)",lineHeight:1.8}}>
                  <div>• {tr("匯入會覆蓋目前裝置上的全域資料。", "Importing will overwrite the current device's global data.", "取り込むと現在の端末の全体データが上書きされます。", "가져오기를 하면 현재 기기의 전체 데이터가 덮어써집니다.")}</div>
                  <div>• {tr("最適合拿來做手機和電腦之間的無痛銜接。", "Best for seamless handoff between phone and desktop.", "スマホとPCの間をスムーズに引き継ぐのに最適です。", "휴대폰과 PC 사이를 자연스럽게 이어 쓰기에 가장 좋습니다.")}</div>
                  <div>• {tr("建議先保留一份原始備份，避免覆蓋到不想改動的內容。", "Keep an original backup first to avoid overwriting anything you didn't mean to change.", "元のバックアップを残しておくと、変更したくない内容を上書きせずに済みます。", "원본 백업을 먼저 보관해 두면 원치 않는 덮어쓰기를 피할 수 있습니다.")}</div>
                </div>
              </div>
            </>
          )}
          {dataImportPreview && (
            <div className="mp-overlay" style={{zIndex:125}} onClick={() => { setDataImportPreview(null); setDataImporting(false); }}>
              <div className="mp-modal" onClick={(e) => e.stopPropagation()}>
                <div className="mp-modal-t">{tr("匯入預覽", "Import preview", "インポートプレビュー", "가져오기 미리보기")}</div>
                <div style={{fontSize:12,color:"var(--mp-txt-l)",lineHeight:1.8}}>
                  <div>{tr("檔名", "File name", "ファイル名", "파일 이름")}：{dataImportPreview.fileName}</div>
                  <div>{tr("大小", "Size", "サイズ", "크기")}：{Math.max(1, Math.round((dataImportPreview.fileSize || 0) / 1024))} KB</div>
                  <div>{tr("格式", "Format", "形式", "형식")}：{dataImportPreview.summary.format === "maliphone-app-state" ? tr("MaliPhone 全域備份", "MaliPhone global backup", "MaliPhone 全体バックアップ", "MaliPhone 전체 백업") : tr("舊版或通用 JSON", "Legacy or generic JSON", "旧版または汎用 JSON", "구버전 또는 일반 JSON")}</div>
                  {dataImportPreview.summary.exportedAt && <div>{tr("匯出時間", "Export time", "書き出し時刻", "내보낸 시간")}：{dataImportPreview.summary.exportedAt}</div>}
                </div>
                <div style={{marginTop:10,padding:10,borderRadius:12,background:"rgba(255,255,255,.7)",border:"1px solid rgba(160,176,186,.2)",fontSize:12,lineHeight:1.8,color:"var(--mp-txt)"}}>
                  <div>{tr("角色", "Characters", "キャラ", "캐릭터")}：{dataImportPreview.summary.characters}</div>
                  <div>{tr("聊天串", "Chat threads", "チャットスレッド", "채팅 스레드")}：{dataImportPreview.summary.chatThreads}</div>
                  <div>{tr("聊天室背景", "Chat backgrounds", "チャット背景", "채팅 배경")}：{dataImportPreview.summary.chatBackgrounds}</div>
                  <div>{tr("群組聊天室", "Group chats", "グループチャット", "그룹 채팅")}：{dataImportPreview.summary.groupChats}</div>
                  <div>{tr("場景", "Scenes", "シーン", "장면")}：{dataImportPreview.summary.scenes}</div>
                  <div>{tr("貼文", "Posts", "投稿", "게시물")}：{dataImportPreview.summary.posts}</div>
                  <div>{tr("世界書", "Lorebooks", "世界観", "월드북")}：{dataImportPreview.summary.lorebooks}</div>
                  <div>{tr("玩家資料", "Player profile", "プレイヤー情報", "플레이어 정보")}：{dataImportPreview.summary.playerProfile ? tr("有", "Yes", "あり", "있음") : tr("無", "No", "なし", "없음")}</div>
                </div>
                <div style={{marginTop:10,fontSize:11,color:"var(--mp-txt-l)",lineHeight:1.6}}>
                  {tr("先確認這份備份內容是不是你要的，再按下面的確認匯入。", "Please confirm this backup is the one you want, then tap confirm import below.", "このバックアップ内容が目的のものか確認してから、下のインポート確認を押してください。", "이 백업 내용이 맞는지 확인한 뒤 아래의 가져오기 확인을 눌러주세요.")}
                </div>
                <div style={{display:"flex",gap:8,marginTop:12}}>
                  <button type="button" className="mp-save" style={{flex:1,background:"linear-gradient(135deg,#b0bec5,#90a4ae)"}} onClick={() => { setDataImportPreview(null); setDataImporting(false); }}>{tr("取消", "Cancel", "キャンセル", "취소")}</button>
                  <button type="button" className="mp-save" style={{flex:1,background:"linear-gradient(135deg,#ffb74d,#f57c00)"}} onClick={confirmImportPreview}>{tr("確認匯入", "Confirm import", "インポートを確認", "가져오기 확인")}</button>
                </div>
              </div>
            </div>
          )}
          {chatroomImportPreview && (
            <div className="mp-overlay" style={{zIndex:125}} onClick={() => { setChatroomImportPreview(null); setChatroomImportTarget(null); setChatroomImporting(false); }}>
              <div className="mp-modal" onClick={(e) => e.stopPropagation()}>
                <div className="mp-modal-t">{tr("聊天室匯入預覽", "Chatroom import preview", "チャットルームのインポート確認", "채팅방 가져오기 미리보기")}</div>
                <div style={{fontSize:12,color:"var(--mp-txt-l)",lineHeight:1.8}}>
                  <div>{tr("檔名", "File name", "ファイル名", "파일 이름")}：{chatroomImportPreview.fileName}</div>
                  <div>{tr("大小", "Size", "サイズ", "크기")}：{Math.max(1, Math.round((chatroomImportPreview.fileSize || 0) / 1024))} KB</div>
                  <div>{tr("格式", "Format", "形式", "형식")}：{chatroomImportPreview.summary.format === "maliphone-chatroom" ? tr("MaliPhone 聊天室備份", "MaliPhone chatroom backup", "MaliPhone チャットルームバックアップ", "MaliPhone 채팅방 백업") : tr("舊版或通用 JSON", "Legacy or generic JSON", "旧版または汎用 JSON", "구버전 또는 일반 JSON")}</div>
                  {chatroomImportPreview.summary.exportedAt && <div>{tr("匯出時間", "Export time", "書き出し時刻", "내보낸 시간")}：{chatroomImportPreview.summary.exportedAt}</div>}
                </div>
                <div style={{marginTop:10,padding:10,borderRadius:12,background:"rgba(255,255,255,.7)",border:"1px solid rgba(160,176,186,.2)",fontSize:12,lineHeight:1.8,color:"var(--mp-txt)"}}>
                  <div>{tr("訊息數", "Message count", "メッセージ数", "메시지 수")}：{chatroomImportPreview.summary.messages}</div>
                  <div>{tr("互動模式", "Interaction mode", "インタラクションモード", "상호작용 모드")}: {chatroomImportPreview.summary.hasMode ? tr("有", "Yes", "あり", "있음") : tr("無", "No", "なし", "없음")}</div>
                  <div>{tr("聊天室背景", "Chat background", "チャット背景", "채팅 배경")}: {chatroomImportPreview.summary.hasBackground ? tr("有", "Yes", "あり", "있음") : tr("無", "No", "なし", "없음")}</div>
                  <div>{tr("世界書綁定", "Lorebook binding", "ワールドブック連携", "월드북 연결")}: {chatroomImportPreview.summary.hasBinding ? tr("有", "Yes", "あり", "있음") : tr("無", "No", "なし", "없음")}</div>
                </div>
                <div style={{marginTop:10,fontSize:11,color:"var(--mp-txt-l)",lineHeight:1.6}}>
                  {tr("先確認這是不是你要接續的聊天室內容，再按下面的確認匯入。", "Please confirm this is the chatroom you want to continue, then tap confirm import below.", "続けたいチャットルームか確認してから、下のインポート確認を押してください。", "계속할 채팅방이 맞는지 확인한 뒤 아래의 가져오기 확인을 눌러주세요.")}
                </div>
                <div style={{display:"flex",gap:8,marginTop:12}}>
                  <button type="button" className="mp-save" style={{flex:1,background:"linear-gradient(135deg,#b0bec5,#90a4ae)"}} onClick={() => { setChatroomImportPreview(null); setChatroomImportTarget(null); setChatroomImporting(false); }}>{tr("取消", "Cancel", "キャンセル", "취소")}</button>
                  <button type="button" className="mp-save" style={{flex:1,background:"linear-gradient(135deg,#ffb74d,#f57c00)"}} onClick={confirmChatroomImportPreview}>{tr("確認匯入", "Confirm import", "インポートを確認", "가져오기 확인")}</button>
                </div>
              </div>
            </div>
          )}
          {settingsTab === "about" && (
            <>
              <div className="mp-sg">
                <div className="mp-sg-t">{tr("版本資訊", "Version info", "バージョン情報", "버전 정보")}</div>
                <div style={{fontSize:12,color:"var(--mp-txt-l)",lineHeight:1.7,marginBottom:8}}>
                  <strong>MaliPhone</strong> v{VERSION}<br/>AI 角色互動小手機介面
                </div>
                <div className="mp-version-row" onClick={() => setSettingsVersionOpen((v) => !v)}>
                  <span>{currentChangelogTitle}　{tr("版本", "Version", "バージョン", "버전")}：{VERSION}</span>
                  <span>{settingsVersionOpen ? tr("收合", "Collapse", "折りたたむ", "접기") : tr("展開", "Expand", "展開", "펼치기")}</span>
                </div>
                {settingsVersionOpen && (
                  <ol className="mp-version-list">
                    {(currentChangelog.length ? currentChangelog : [tr("這個版本沒有填寫更新內容。", "No update notes were added for this version.", "このバージョンの更新内容は未記入です。", "이 버전의 업데이트 내용이 없습니다.")]).map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ol>
                )}
              </div>
              <div className="mp-sg">
                <div className="mp-sg-t">{tr("服務條款與免責聲明", "Terms and disclaimer", "利用規約と免責事項", "이용약관 및 면책")}</div>
                <div style={{fontSize:12,color:"var(--mp-txt-l)",lineHeight:1.7,marginBottom:8}}>
                  {tr("最後更新：2026年6月2日", "Last updated: June 2, 2026", "最終更新: 2026年6月2日", "마지막 업데이트: 2026년 6월 2일")}
                </div>
                <div className="mp-version-row" onClick={() => setSettingsDisclaimerOpen((v) => !v)}>
                  <span>{tr("查看完整條款", "View full terms", "利用規約を表示", "전체 약관 보기")}</span>
                  <span>{settingsDisclaimerOpen ? tr("收合", "Collapse", "折りたたむ", "접기") : tr("展開", "Expand", "展開", "펼치기")}</span>
                </div>
                {settingsDisclaimerOpen && (
                  <div style={{fontSize:12,color:"var(--mp-txt-l)",lineHeight:1.8,padding:"10px 4px 2px"}}>
                    <div style={{fontWeight:700,color:"var(--mp-txt)"}}>{tr("歡迎使用 MaliPhone", "Welcome to MaliPhone", "MaliPhoneへようこそ", "MaliPhone에 오신 것을 환영합니다")}</div>
                    <div style={{marginTop:8}}>{tr("本應用是一個提供給玩家自由遊玩的 AI 角色互動平台。玩家可以依照自己的方式建立、設定與使用內容，所有玩法都由玩家自行決定，開發者不會介入、限制或替玩家做出遊玩選擇。", "This app is an AI character interaction platform for free-form play. Players create, configure, and use content in their own way; all play choices are made by the player, and the developer does not intervene, restrict, or decide how users play.", "本アプリは、プレイヤーが自由に遊べるAIキャラクター交流プラットフォームです。コンテンツの作成、設定、利用方法はプレイヤー自身が決めるもので、開発者が遊び方に介入、制限、または選択を代行することはありません。", "이 앱은 플레이어가 자유롭게 즐길 수 있는 AI 캐릭터 상호작용 플랫폼입니다. 콘텐츠의 생성, 설정, 사용 방식은 플레이어가 직접 결정하며 개발자는 플레이 방식에 개입하거나 제한하거나 대신 선택하지 않습니다.")}</div>
                    <div style={{marginTop:8}}>{tr("本應用不會主動取得玩家的個人設定、遊玩偏好或私人操作內容，也無法控制玩家如何使用本服務。所有角色、對話、情節、觀點與回應皆可能為演算法生成內容，僅供娛樂、創作與測試用途，不代表真實人物、事件或事實。", "This app does not proactively collect personal settings, play preferences, or private actions, and cannot control how players use the service. Characters, conversations, plots, opinions, and replies may be algorithmically generated and are for entertainment, creative, and testing purposes only; they do not represent real people, events, or facts.", "本アプリは、個人設定、遊び方の好み、私的な操作内容を能動的に取得せず、プレイヤーによる本サービスの利用方法を制御することもできません。キャラクター、会話、展開、意見、返答はアルゴリズム生成である場合があり、娯楽、創作、テスト目的に限られ、実在の人物、出来事、事実を表すものではありません。", "이 앱은 개인 설정, 플레이 선호도, 사적인 조작 내용을 능동적으로 수집하지 않으며, 플레이어가 서비스를 어떻게 사용하는지 통제할 수 없습니다. 모든 캐릭터, 대화, 전개, 관점, 응답은 알고리즘으로 생성될 수 있으며 오락, 창작, 테스트 목적일 뿐 실제 인물, 사건 또는 사실을 의미하지 않습니다.")}</div>
                    <div style={{marginTop:8}}>{tr("請勿將本應用產出的內容視為專業建議。若涉及醫療、法律、財務、心理健康或其他重大決策，請自行判斷並諮詢合格專業人士。", "Do not treat content generated by this app as professional advice. For medical, legal, financial, mental health, or other major decisions, use your own judgment and consult qualified professionals.", "本アプリが生成した内容を専門的助言として扱わないでください。医療、法律、財務、メンタルヘルス、その他重大な判断に関わる場合は、ご自身で判断し、資格を持つ専門家に相談してください。", "이 앱에서 생성된 내용을 전문적인 조언으로 간주하지 마세요. 의료, 법률, 재정, 정신건강 또는 기타 중대한 결정과 관련된 경우 스스로 판단하고 자격을 갖춘 전문가와 상담하세요.")}</div>
                    <div style={{marginTop:8}}>{tr("使用者應對自己在本應用中的操作、輸入與產出內容負責，並遵守所在地法律、平台規範與公共秩序。請勿利用本服務製作、散播或引導任何非法、侵害他人權益、仇恨、騷擾、暴力、自殘或其他高風險內容。", "Users are responsible for their actions, inputs, and outputs in this app and must follow local laws, platform rules, and public order. Do not use this service to create, distribute, or encourage illegal content, rights violations, hate, harassment, violence, self-harm, or other high-risk content.", "ユーザーは、本アプリでの操作、入力、出力内容について責任を負い、所在地の法律、プラットフォーム規約、公序良俗を遵守する必要があります。違法行為、他者の権利侵害、憎悪、嫌がらせ、暴力、自傷、その他高リスクな内容の作成、拡散、誘導に本サービスを利用しないでください。", "사용자는 이 앱에서의 조작, 입력, 출력 내용에 책임을 지며, 거주 지역의 법률, 플랫폼 규정, 공공질서를 준수해야 합니다. 불법, 타인 권리 침해, 혐오, 괴롭힘, 폭력, 자해 또는 기타 고위험 콘텐츠를 제작, 유포, 유도하는 데 이 서비스를 사용하지 마세요.")}</div>
                    <div style={{marginTop:8}}>{tr("本應用不保證服務永遠可用、完全正確、完全安全或完全無誤。AI 生成內容可能出現不準確、過時、偏差、重複或不完整的情況，開發者不對因此造成的任何直接或間接損失負責。", "This app does not guarantee that the service will always be available, fully accurate, fully secure, or error-free. AI-generated content may be inaccurate, outdated, biased, repetitive, or incomplete, and the developer is not responsible for any direct or indirect losses caused by it.", "本アプリは、サービスが常に利用可能であること、完全に正確、安全、または無誤であることを保証しません。AI生成内容には不正確、古い情報、偏り、重複、不完全さが含まれる場合があり、それにより生じたいかなる直接的または間接的損失についても開発者は責任を負いません。", "이 앱은 서비스가 항상 이용 가능하거나 완전히 정확하거나 완전히 안전하거나 오류가 없음을 보장하지 않습니다. AI 생성 콘텐츠는 부정확하거나 오래되었거나 편향되었거나 반복적이거나 불완전할 수 있으며, 이로 인한 직접 또는 간접 손실에 대해 개발자는 책임지지 않습니다.")}</div>
                    <div style={{marginTop:8}}>{tr("若您不同意上述內容，請停止使用本應用。開發者保留在必要時調整、暫停或終止服務的權利，並可依實際情況更新本條款，更新後於應用程式內公告時即生效。", "If you do not agree with the above, stop using this app. The developer reserves the right to adjust, suspend, or terminate the service when necessary and may update these terms as circumstances require. Updates take effect when announced in the app.", "上記に同意しない場合は、本アプリの利用を停止してください。開発者は必要に応じてサービスを調整、一時停止、または終了する権利を有し、状況に応じて本規約を更新できます。更新内容はアプリ内で告知された時点で有効になります。", "위 내용에 동의하지 않는 경우 이 앱 사용을 중단하세요. 개발자는 필요한 경우 서비스를 조정, 일시 중단 또는 종료할 권리를 가지며, 실제 상황에 따라 본 약관을 업데이트할 수 있습니다. 업데이트는 앱 내 공지 시점부터 효력이 발생합니다.")}</div>
                  </div>
                )}
              </div>
              <div className="mp-sg">
                <div
                  className="mp-sg-t"
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                  onClick={() => setSettingsResetDataOpen((v) => !v)}
                >
                  <span>{tr("重置資料", "Reset data", "データをリセット", "데이터 초기화")}</span>
                  <span style={{ fontSize: 11, color: "var(--mp-txt-l)", fontWeight: 600 }}>{settingsResetDataOpen ? tr("收合", "Collapse", "折りたたむ", "접기") : tr("展開", "Expand", "展開", "펼치기")}</span>
                </div>
                {settingsResetDataOpen && (
                  <>
                    <div style={{fontSize:11,color:"var(--mp-txt-l)",lineHeight:1.8,marginBottom:8}}>
                      <div><strong>{tr("全域資料", "Global data", "全体データ", "전체 데이터")}</strong>：{tr("清空所有遊玩內容，包含角色與玩家資料，把小手機回歸初始狀態。", "Clear all play data, including characters and player data, and return the phone to its initial state.", "すべてのプレイデータを消去し、キャラやプレイヤー情報も含めて初期状態に戻します。", "플레이 내용을 모두 지우고 캐릭터와 플레이어 데이터를 포함해 초기 상태로 되돌립니다.")}</div>
                      <div><strong>{tr("清除快取", "Clear cache", "キャッシュを消去", "캐시 삭제")}</strong>：{tr("清除網站暫存與更新殘留，讓 App 重新載入最新版本。", "Clear cached site data and leftover update files so the app reloads the latest version.", "サイトの一時データと更新の残留ファイルを消去し、アプリを最新状態で再読み込みします。", "사이트 임시 데이터와 업데이트 잔여 파일을 지워 앱이 최신 버전으로 다시 불러오게 합니다.")}</div>
                    </div>
                    <div style={{display:"grid",gap:8}}>
                      <button className="mp-save" style={{background:"linear-gradient(135deg,#ef9a9a,#e53935)"}} onClick={()=>{
                        if(!confirm(tr("確定要清空所有資料嗎？", "Are you sure you want to clear all data?", "本当にすべてのデータを消去しますか？", "정말 모든 데이터를 삭제할까요?"))) return;
                        setCharacters([]);
                        setActiveCharId(null);
                        setCurrentChatChar(null);
                        setCurrentChatGroup(null);
                        setChatHistory({});
                        setChatModes({});
                        setChatBackgrounds({});
                        setGroupChats([]);
                        setInnerThoughtSettings({});
                        setExpandedInnerThoughts({});
                        setInnerThoughtLoading({});
                        setChatScenes({});
                        setGroupScenes({});
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
                        setTtsConfig(defaultAppState.ttsConfig);
                        stopCurrentVoiceAudio();
                        voiceAudioCacheRef.current.clear();
                        setVoicePlayback({ key: null, status: "idle" });
                        setScreenLockTimeout(defaultAppState.screenLockTimeout);
                        setHomeSlots(Array.from({ length: HOME_SLOT_COUNT }, () => null));
                        setDockOrder(DOCK_APPS);
                        setPhonePage("picker");
                        setPhoneViewCharId(null);
                        setPhoneActiveThreadId("player");
                        armAppClickSuppression();
                        setCurrentApp(null);
                        setModal(null);
                        setUpdateNoticeOpen(false);
                        setChatSettingsOpen(false);
                        setChatSettingsBackgroundOpen(false);
                        setChatSettingsLorebookOpen(false);
                        setChatroomManageOpen(false);
                        setChatSettingsExpandedBooks({});
                        setChatBgEditor(null);
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
                        showToast(tr("資料已清空", "Data cleared", "データを消去しました", "데이터를 삭제했습니다"));
                      }}>{tr("清空全部資料", "Clear all data", "すべてのデータを消去", "모든 데이터 삭제")}</button>
                      <button type="button" className="mp-save" style={{background:clearCacheArmed?"linear-gradient(135deg,#ffb74d,#f57c00)":"linear-gradient(135deg,#b0bec5,#78909c)"}} onClick={clearSiteCache}>{clearCacheArmed ? tr("再次確認清除快取", "Confirm cache clear again", "キャッシュ削除を再確認", "캐시 삭제 재확인") : tr("清除快取", "Clear cache", "キャッシュを消去", "캐시 삭제")}</button>
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
      <div className="mp-hdr"><div className="mp-back" onClick={closeApp}>←</div><div className="mp-htitle">{t("playerProfile")}</div></div>
      <div className="mp-cm">
          <div className="mp-cc">
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>{t("personalSettings")}</div>
            <div className="mp-row">
              <div className="mp-lbl">{t("avatar")}</div>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div className="mp-av" style={{cursor:"pointer",width:84,height:84,borderRadius:22}} onClick={() => playerAvatarRef.current?.click()}>
                  {sanitizeUserImageUrl(playerProfile?.avatar) ? <img src={sanitizeUserImageUrl(playerProfile?.avatar)} alt="" /> : "🐱"}
                </div>
                <input type="file" ref={playerAvatarRef} accept="image/*" style={{display:"none"}} onChange={handlePlayerAvatarUpload} />
                <button className="mp-ibtn" onClick={() => playerAvatarRef.current?.click()}>{t("changeAvatar")}</button>
                <button className="mp-ibtn-r" onClick={() => setPlayerProfile(p => ({ ...(p||{}), avatar: "" }))}>{t("remove")}</button>
              </div>
            </div>
            <div className="mp-row"><div className="mp-lbl">{t("name")}</div><input className="mp-sinp" value={playerProfile?.name || ""} onChange={e=>setPlayerProfile(p=>({ ...(p||{}), name:e.target.value }))} placeholder={tr("例如：小明", "e.g. Alex", "例: アレックス", "예: 알렉스")} /></div>
            <div className="mp-row"><div className="mp-lbl">{tr("暱稱", "Nickname", "ニックネーム", "닉네임")}</div><input className="mp-sinp" value={playerProfile?.nickname || ""} onChange={e=>setPlayerProfile(p=>({ ...(p||{}), nickname:e.target.value }))} placeholder={tr("例如：小雨、阿喵", "e.g. Sunny, Miao", "例: しずく、ニャン", "예: 비, 냥이")} /></div>
            <div className="mp-row"><div className="mp-lbl">{t("description")}</div><textarea className="mp-ta" value={playerProfile?.bio || ""} onChange={e=>setPlayerProfile(p=>({ ...(p||{}), bio:e.target.value }))} placeholder={tr("例如：喜歡貓、講話直接、晚上常上線", "e.g. likes cats, speaks directly, often online at night", "例: 猫が好き、話し方は率直、夜にオンラインが多い", "예: 고양이를 좋아함, 말투가 직설적, 밤에 자주 접속")} style={{minHeight:100,resize:"vertical"}} /></div>
          </div>
          <div className="mp-cc">
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>{tr("紙娃娃（三層）", "Paper doll (3 layers)", "紙人形（3層）", "종이 인형(3단)")}</div>
            <div style={{fontSize:12,color:"var(--mp-txt-l)",lineHeight:1.7}}>{t("comingSoon")}</div>
          </div>
      </div>
      {playerAvatarCrop && (
        <div className="mp-overlay" onClick={() => setPlayerAvatarCrop(null)}>
          <div className="mp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mp-modal-t">{tr("裁切大頭貼", "Crop avatar", "アバターをトリミング", "프로필 사진 자르기")}</div>
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
            <div className="mp-row"><div className="mp-lbl">{tr("縮放", "Zoom", "ズーム", "확대")}</div><input type="range" min="1" max="3" step="0.01" value={playerAvatarCrop.zoom} onChange={e=>setPlayerAvatarCrop(s=>({...(s||{}),zoom:Number(e.target.value)}))} /></div>
            <div style={{fontSize:11,color:"var(--mp-txt-l)",marginTop:4}}>{tr("拖曳圖片調整位置，裁切框固定為方形", "Drag the image to adjust its position. The crop frame stays square.", "画像をドラッグして位置を調整できます。トリミング枠は正方形固定です。", "이미지를 드래그해 위치를 조정하세요. 자르기 프레임은 정사각형으로 고정됩니다.")}</div>
            <div style={{display:"flex",gap:8,marginTop:8}}>
              <button className="mp-save" style={{flex:1,background:"linear-gradient(135deg,#b0bec5,#90a4ae)"}} onClick={() => setPlayerAvatarCrop(null)}>{tr("取消", "Cancel", "キャンセル", "취소")}</button>
              <button className="mp-save" style={{flex:1}} onClick={applyPlayerAvatarCrop}>{tr("套用", "Apply", "適用", "적용")}</button>
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
    if (!amount) { showToast(tr("請輸入轉帳金額", "Please enter a transfer amount", "振込金額を入力してください", "송금 금액을 입력해주세요")); return; }
    const currentBalance = Number(wallet?.balance || 0);
    if (currentBalance < amount) { showToast(tr("餘額不足", "Insufficient balance", "残高不足", "잔액 부족")); return; }
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
      showToast(tr("已完成轉帳", "Transfer completed", "振込が完了しました", "송금이 완료되었습니다"));
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
    const ordered = [...(transactions || [])].sort((a, b) => Number(a?.time || 0) - Number(b?.time || 0));
    ordered.forEach((tx) => {
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
    return { balance, transactions: reconciled.slice(0, limit).reverse() };
  };
  const buildWalletRoleProfile = (char) => [
    char.description ? `角色描述：${sanitizeText(char.description, 900)}` : "",
    char.systemPrompt ? `系統提示詞：${sanitizeText(char.systemPrompt, 600)}` : "",
    char.personality ? `個性：${sanitizeText(char.personality, 500)}` : "",
    char.scenario ? `情境：${sanitizeText(char.scenario, 500)}` : "",
    char.relationshipToUser ? `與玩家關係：${sanitizeText(char.relationshipToUser, 120)}` : "",
    Array.isArray(char.tags) && char.tags.length ? `標籤：${sanitizeText(char.tags.join("、"), 120)}` : "",
  ].filter(Boolean).join("\n");
  const buildWalletRefreshHistory = (cw) => (cw?.transactions || [])
    .slice(0, 3)
    .map((t) => `${t.type === "income" ? "收入" : "支出"} ${formatMoney(t.amount)}：${stripUserPlaceholder(t.note)}`)
    .join("\n");
  const generateCharacterWallet = async (char, { mode = "initial" } = {}) => {
    if (!char) return;
    if (!canUseCurrentProvider()) { showToast(tr("請先完成 AI 連線設定（API Key）", "Please finish AI connection setup (API key) first", "先にAI接続設定（APIキー）を完了してください", "먼저 AI 연결 설정(API 키)을 완료해주세요")); return; }
    setWalletGenLoading(true);
    try {
      const currentWallet = characterWallets[char.id] || null;
      const walletProfile = currentWallet?.walletProfile || currentWallet?.summary || "";
      const refreshHistory = buildWalletRefreshHistory(currentWallet);
      const isRefresh = mode === "refresh";
      const roleProfile = isRefresh ? "" : buildWalletRoleProfile(char);
      const walletPrompt = isRefresh
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
2) transactions 產生 8~12 筆，包含 income/expense，金額與備註要貼近角色職業、生活、興趣、作息、社交圈。
3) 收入/支出要明顯符合角色身分，不要出現與角色設定衝突的來源或消費。例：學生不要有高薪月薪；居家型角色不要頻繁高額外出消費；上班族收入可來自薪資/兼職/獎金，但不要莫名其妙像企業老闆。
4) 若角色是醫生，收入/支出可部分和醫療、值班、書籍、交通有關，但不能全部都醫療；也要有飲食、娛樂、興趣、人際等生活花費。
5) 不要提到 {{user}}，這是角色自己的錢包。
6) 另外產生一份只用於錢包的 summary，並同步產生 walletProfile。walletProfile 只保留職業、收入來源、消費習慣、生活風格、財務風格等財務相關資訊，不要包含對 {{user}} 的態度、性行為、曖昧互動或私密感情。
7) walletProfile 會用於之後的錢包刷新，請寫得簡短、穩定、方便長期重複使用。
8) 所有支出必須能被目前餘額支撐，若錢不夠，請改成較小額支出、臨時收入、借貸、預支，或直接不產生支出。
9) 每筆流水的 note 要像角色真的會有的消費/收入，不要是泛用模板。
10) time 使用目前時間附近的毫秒 timestamp，可用 ${Date.now()} 往前推。
格式：
{"balance":1200,"summary":"一句 20~50 字生活摘要","walletProfile":"一句更短的錢包摘要","transactions":[{"type":"income","amount":3000,"note":"薪資入帳","time":1710000000000}]}

角色設定：
${roleProfile || "（無）"}`;
      const raw = await callAI([{
        role: "user",
        content: `${getOutputLanguageDirective()}\n\n${walletPrompt}`,
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
        const orderedTransactions = [...mergedTransactions].sort((a, b) => Number(a?.time || 0) - Number(b?.time || 0));
        const openingBalance = isRefresh ? (current.balance || 0) : (Number(parsed.balance) || 0);
        const reconciled = reconcileWalletLedger(openingBalance, orderedTransactions, CHARACTER_WALLET_TX_LIMIT);
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
      showToast(`${tr("角色錢包生成失敗", "Character wallet generation failed", "キャラのウォレット生成に失敗しました", "캐릭터 지갑 생성에 실패했습니다")}：${sanitizeText(err?.message || tr("未知錯誤", "Unknown error", "不明なエラー", "알 수 없는 오류"), 120)}`);
    }
    setWalletGenLoading(false);
  };
  const regenerateCharacterWallet = async (char) => {
    if (!char) return;
    const ok = window.confirm(tr("重新生成會清空舊的錢包資料，並重新讀取角色設定建立新錢包，確定要繼續嗎？", "Regenerating will clear the old wallet data and rebuild a new wallet from the character settings. Continue?", "再生成すると古いウォレットデータが消去され、キャラ設定を読み直して新しいウォレットが作成されます。続けますか？", "다시 생성하면 기존 지갑 데이터가 지워지고 캐릭터 설정을 다시 읽어 새 지갑이 만들어집니다. 계속할까요?"));
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
            <div className="mp-htitle">{tr("錢包設定", "Wallet settings", "ウォレット設定", "지갑 설정")}</div>
          </div>
          <div className="mp-cm">
            <div className="mp-cc">
              <div style={{fontSize:13,fontWeight:700,marginBottom:8}}>{tr("錢包管理", "Wallet management", "ウォレット管理", "지갑 관리")}</div>
              <div style={{fontSize:11,color:"var(--mp-txt-l)",lineHeight:1.8,marginBottom:8}}>
                {tr("這個頁面只會管理錢包相關內容，不會影響當前角色聊天室或其他全域資料。", "This page only manages wallet-related content and won't affect the current character chatroom or other global data.", "このページはウォレット関連のみを管理し、現在のキャラのチャットルームや他の全体データには影響しません。", "이 페이지는 지갑 관련 내용만 관리하며 현재 캐릭터 채팅방이나 다른 전역 데이터에는 영향을 주지 않습니다.")}
              </div>
              <button
                type="button"
                className="mp-save"
                style={{ background: "linear-gradient(135deg,#ef9a9a,#e53935)" }}
                onClick={() => {
                  if (!window.confirm(tr("確定要清除錢包頁面的資料嗎？", "Clear the wallet page data?", "ウォレットページのデータを消去しますか？", "지갑 페이지 데이터를 지울까요?"))) return;
                  if (!window.confirm(tr("請再次確認：這只會清除錢包頁面內容，不會影響聊天室，確定要繼續嗎？", "Please confirm again: this only clears the wallet page content and won't affect chats. Continue?", "再確認してください。これはウォレットページの内容のみを消去し、チャットには影響しません。続けますか？", "다시 확인해주세요. 이것은 지갑 페이지만 지우며 채팅에는 영향을 주지 않습니다. 계속할까요?"))) return;
                  setWallet(defaultAppState.wallet);
                  setCharacterWallets({});
                  setWalletSettingsPage("main");
                  setWalletSettingsOpen(false);
                  showToast(tr("錢包資料已清除", "Wallet data cleared", "ウォレットデータを消去しました", "지갑 데이터를 지웠습니다"));
                }}
              >
                {tr("清除資料", "Clear data", "データを消去", "데이터 지우기")}
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
          <div className="mp-htitle">{tr("錢包", "Wallet", "ウォレット", "지갑")}</div>
          <button className="mp-ibtn" style={{ marginLeft: "auto" }} onClick={() => { setWalletSettingsPage("settings"); setWalletSettingsOpen(true); }}>{tr("設定", "Settings", "設定", "설정")}</button>
        </div>
        <div className="mp-cm">
          <div className="mp-cc">
            <div style={{ fontSize: 12, color: "var(--mp-txt-l)" }}>{tr("餘額", "Balance", "残高", "잔액")}</div>
            <div style={{ fontSize: 28, fontWeight: 800, marginTop: 2 }}>${formatMoney(wallet?.balance || 0)}</div>
            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
              <button className="mp-ibtn-chat" onClick={() => {
                const v = prompt(tr("設定玩家錢包餘額", "Set player wallet balance", "プレイヤーのウォレット残高を設定", "플레이어 지갑 잔액 설정"), String(wallet?.balance || 0));
                if (v === null) return;
                setWallet((w) => ({ ...(w || { transactions: [], assets: [] }), balance: Math.max(0, Math.round(Number(v) || 0)) }));
              }}>{tr("設定餘額", "Set balance", "残高を設定", "잔액 설정")}</button>
            </div>
          </div>
          <div className="mp-cc" style={{ marginTop: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>{tr("近期流水", "Recent transactions", "最近の取引", "최근 거래")}</div>
            {(wallet?.transactions || []).length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--mp-txt-l)", lineHeight: 1.7 }}>{tr("目前沒有交易紀錄。", "No transactions yet.", "まだ取引がありません。", "아직 거래 내역이 없습니다.")}</div>
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
    const selectedCharId = phoneViewCharId || null;
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
    armAppClickSuppression();
    setPhonePage("desktop");
  };
    const phoneWallet = selectedChar ? characterWallets[selectedChar.id] : null;
    const inImmersivePhone = phonePage === "desktop" || phonePage === "chatlist" || phonePage === "thread" || phonePage === "wallet";
    return (
      <div className="mp-page" style={inImmersivePhone ? { padding: 0 } : undefined}>
        {!inImmersivePhone && (
          <div className="mp-hdr">
            <div className="mp-back" onClick={closeApp}>←</div>
            <div className="mp-htitle">{t("phone")}</div>
          </div>
        )}
        <div className="mp-cm" style={inImmersivePhone ? { padding: 0 } : undefined}>
          {characters.length === 0 && <div className="mp-empty"><div className="mp-empty-i">📱</div><div className="mp-empty-t">{t("characters")} {t("phone")}</div></div>}
          {characters.length > 0 && phonePage !== "desktop" && phonePage !== "chatlist" && phonePage !== "thread" && phonePage !== "wallet" && (
            <div className="mp-sc" style={{padding:12}}>
              <div style={{fontWeight:700,fontSize:14,marginBottom:8}}>{t("contactsHint")}</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr",gap:8}}>
                {characters.map((c) => (
                  <button key={c.id} className="mp-cc" style={{textAlign:"left",background:"#fff"}} onClick={(e) => { e.stopPropagation(); armAppClickSuppression(); openDesktop(c.id); }}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <div className="mp-av">{sanitizeUserImageUrl(c.avatar)?<img src={sanitizeUserImageUrl(c.avatar)} alt=""/>:"🦊"}</div>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:700,fontSize:13}}>{c.name}</div>
                        <div style={{fontSize:11,color:"var(--mp-txt-l)"}}>{t("contactsHint")}</div>
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
            <div style={{fontSize:12,color:"#39596e"}}>{selectedChar.name} {t("phone")}</div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:12,marginTop:16}}>
                <button className="mp-icon" style={{background:"rgba(255,255,255,.62)"}} onClick={(e) => { e.stopPropagation(); armAppClickSuppression(); setPhonePage("chatlist"); }}>
                  <div className="mp-icon-c mp-icon-c-img">{renderAppIcon({ id: "chat", name: "聊天", icon: "💬", iconUrl: "./app-icons/chat.png?v=1.1.5" }, 56)}</div>
                  <span className="mp-icon-l">{t("chat")}</span>
                </button>
                <button className="mp-icon" style={{background:"rgba(255,255,255,.62)"}} onClick={(e) => { e.stopPropagation(); armAppClickSuppression(); setPhonePage("wallet"); }}>
                  <div className="mp-icon-c mp-icon-c-img">{renderAppIcon({ id: "wallet", name: "錢包", icon: "💳", iconUrl: "./app-icons/wallet.png?v=1.1.5" }, 56)}</div>
                  <span className="mp-icon-l">{t("wallet")}</span>
                </button>
                {[
                  { icon: "📷", label: tr("相機", "Camera", "カメラ", "카메라") },
                  { icon: "⚙️", label: t("settings") },
                ].map((item, idx) => (
                  <div key={idx} className="mp-icon" style={{opacity:.45,background:"rgba(255,255,255,.45)"}}>
                    <div className="mp-icon-c">{renderAppIcon({ name: item.label, icon: item.icon })}</div>
                    <span className="mp-icon-l">🔒</span>
                  </div>
                ))}
              </div>
              <div style={{marginTop:18,display:"flex",gap:6}}>
                <button className="mp-ibtn" onClick={(e) => { e.stopPropagation(); armAppClickSuppression(); setPhonePage("picker"); }}>{tr("換角色", "Switch character", "キャラを切り替え", "캐릭터 전환")}</button>
                <button className="mp-ibtn" disabled={phoneGenLoading} onClick={() => generatePhoneNpcChats(selectedChar)}>
                  {phoneGenLoading ? t("loading") : t("refreshOtherChats")}
                </button>
                <span style={{fontSize:10,color:"#5f7f93",marginLeft:"auto",alignSelf:"center"}}>
                  {tr("快取：", "Cache: ", "キャッシュ: ", "캐시: ")}{phoneInboxCache[selectedChar.id]?.updatedAt ? new Date(phoneInboxCache[selectedChar.id].updatedAt).toLocaleTimeString("zh-TW",{hour:"2-digit",minute:"2-digit"}) : "--:--"}
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
                <button className="mp-ibtn" onClick={(e) => { e.stopPropagation(); armAppClickSuppression(); setPhonePage("desktop"); }}>{t("backToDesktop")}</button>
                <div style={{fontWeight:700,fontSize:13}}>{selectedChar.name} {t("wallet")}</div>
                </div>
                {!phoneWallet ? (
                  <div>
                    <div style={{fontSize:12,color:"var(--mp-txt-l)",lineHeight:1.7}}>{tr("尚未生成角色錢包。", "This character wallet hasn't been generated yet.", "まだキャラクターのウォレットが生成されていません。", "아직 캐릭터 지갑이 생성되지 않았습니다.")}</div>
                    <button className="mp-save" style={{marginTop:10}} disabled={walletGenLoading} onClick={() => generateCharacterWallet(selectedChar)}>{walletGenLoading ? t("generating") : t("generate")}</button>
                  </div>
                ) : (
                  <>
                    <div style={{fontSize:12,color:"var(--mp-txt-l)"}}>{tr("可用餘額", "Available balance", "利用可能残高", "사용 가능 잔액")}</div>
                    <div style={{fontSize:30,fontWeight:900,margin:"2px 0 6px"}}>${formatMoney(phoneWallet.balance || 0)}</div>
                    {phoneWallet.summary && <div style={{fontSize:12,color:"var(--mp-txt-l)",lineHeight:1.6,marginBottom:10}}>{displayWalletText(phoneWallet.summary)}</div>}
                    <div style={{display:"flex",gap:8,marginBottom:10}}>
                      <button className="mp-ibtn" style={{flex:1}} disabled={walletGenLoading} onClick={() => generateCharacterWallet(selectedChar, { mode: "refresh" })}>{walletGenLoading ? t("loading") : t("refreshWallet")}</button>
                      <button className="mp-ibtn" style={{flex:1}} disabled={walletGenLoading} onClick={() => regenerateCharacterWallet(selectedChar)}>{walletGenLoading ? t("updating") : t("generate")}</button>
                    </div>
                    <div style={{fontSize:13,fontWeight:800,marginBottom:6}}>{tr("近期流水", "Recent transactions", "最近の取引", "최근 거래")}</div>
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
                <button className="mp-ibtn" onClick={(e) => { e.stopPropagation(); armAppClickSuppression(); setPhonePage("desktop"); }}>{t("backToDesktop")}</button>
                <div style={{fontSize:12,color:"var(--mp-txt-l)"}}>{tr("只讀聊天列表", "Read-only chat list", "閲覧専用チャット一覧", "읽기 전용 채팅 목록")}</div>
              </div>
              <div style={{display:"grid",gap:8}}>
                {allThreads.map((t) => {
                  const last = (t.messages || [])[t.messages.length - 1];
                  return (
                    <button key={t.id} className="mp-cc" style={{textAlign:"left",background:"#fff"}} onClick={() => { if (Date.now() > suppressAppClickUntilRef.current) { setPhoneActiveThreadId(t.id); setPhonePage("thread"); } }}>
                      <div style={{display:"flex",justifyContent:"space-between",gap:8}}>
                        <div style={{fontWeight:700,fontSize:13}}>{t.name}</div>
                        <div style={{fontSize:10,color:"var(--mp-txt-l)"}}>{last?.time ? new Date(last.time).toLocaleTimeString("zh-TW",{hour:"2-digit",minute:"2-digit"}) : ""}</div>
                      </div>
                      <div style={{fontSize:11,color:"var(--mp-txt-l)",marginTop:2}}>{t.relation || ""}</div>
                      <div style={{fontSize:11,color:"var(--mp-txt)",marginTop:5,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{last?.text || tr("目前無訊息", "No messages yet", "まだメッセージがありません", "아직 메시지가 없습니다")}</div>
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
                <button className="mp-ibtn" onClick={(e) => { e.stopPropagation(); armAppClickSuppression(); setPhonePage("chatlist"); }}>{t("backToList")}</button>
                <div style={{fontWeight:700,fontSize:13}}>{activeThread?.name || t("chatroom")}</div>
                <span style={{fontSize:10,color:"var(--mp-txt-l)"}}>{tr("唯讀", "Read only", "閲覧専用", "읽기 전용")}</span>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:430,overflowY:"auto",border:"1px solid var(--mp-border)",borderRadius:12,padding:8,background:"rgba(255,255,255,.45)"}}>
                {(activeThread?.messages || []).map((m) => (
                  <div key={m.id} style={{display:"flex",justifyContent:m.from==="char"?"flex-end":"flex-start"}}>
                    <div style={{maxWidth:"82%",fontSize:12,lineHeight:1.45,padding:"7px 10px",borderRadius:10,background:m.from==="char"?"linear-gradient(135deg,#f48fb1,#ec407a)":"#fff",color:m.from==="char"?"#fff":"var(--mp-txt)",border:m.from==="char"?"none":"1px solid var(--mp-border)"}}>
                      {m.text}
                    </div>
                  </div>
                ))}
                {(!activeThread || (activeThread.messages || []).length === 0) && <div style={{fontSize:11,color:"var(--mp-txt-l)",textAlign:"center"}}>{t("noMessages")}</div>}
              </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderPlaceholder = (i, n) => (<div className="mp-page"><div className="mp-hdr"><div className="mp-back" onClick={closeApp}>←</div><div className="mp-htitle">{i} {n}</div></div><div className="mp-empty" style={{flex:1}}><div className="mp-empty-i">{i}</div><div className="mp-empty-t">{t("comingSoon")}<br/>{t("stayTuned")}</div></div></div>);
  const renderGame = () => {
    if (gamePage === "football") {
      return (
        <div className="mp-page" style={{ background: "#071b16" }}>
          <div className="mp-hdr">
            <div className="mp-back" onClick={() => setGamePage("hub")}>←</div>
          <div className="mp-htitle">{tr("世足Kick", "World Cup Kick", "ワールドカップKick", "월드컵 Kick")}</div>
          </div>
          <iframe
            title={tr("世界盃射門小遊戲", "World Cup shooting mini-game", "ワールドカップシュートミニゲーム", "월드컵 슈팅 미니게임")}
            src="./game.html"
            style={{ flex: 1, width: "100%", border: 0, background: "#071b16" }}
          />
        </div>
      );
    }
    return (
      <div className="mp-page">
        <div className="mp-hdr">
          <div className="mp-back" onClick={closeApp}>←</div>
          <div className="mp-htitle">{t("gameCenter")}</div>
        </div>
        <div style={{ padding: 16, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
          <button
            className="mp-cw"
            onClick={() => setGamePage("football")}
            style={{ width: "100%", border: "1px solid rgba(231,197,214,.6)", background: "rgba(255,255,255,.88)", textAlign: "center", padding: 14, flexDirection: "column", alignItems: "center", gap: 10, borderRadius: 22 }}
          >
            <div className="mp-av" style={{ width: 72, height: 72, borderRadius: 20, overflow: "hidden", flex: "0 0 auto" }}>
              <img src="./app-icons/game-football.png?v=1.1.6" alt={tr("世足射門", "World Cup shooting", "ワールドカップシュート", "월드컵 슈팅")} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
            <div className="mp-cw-name" style={{ fontSize: 16, marginTop: 2 }}>{tr("世足Kick", "World Cup Kick", "ワールドカップKick", "월드컵 Kick")}</div>
          </button>
        </div>
      </div>
    );
  };
  const renderBook = () => (
    <div className="mp-page" style={{ background: "#f7eef6" }}>
      <div className="mp-hdr">
        <div className="mp-back" onClick={closeApp}>←</div>
        <div className="mp-htitle">{t("answerBook")}</div>
      </div>
      <iframe
        title={t("answerBook")}
        src="./book.html"
        style={{ flex: 1, width: "100%", border: 0, background: "#f7eef6" }}
      />
    </div>
  );

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
      case "gallery": return renderPlaceholder("🖼️", t("gallery"));
      case "game": return renderGame();
      case "lbook": return renderBook();
      case "notebook": return renderPlaceholder("📒", t("notebook"));
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
  return (<><style>{css}</style><style>{themeCss}</style><div className="mp-wrap" onClickCapture={blockRecentAppClicks}><div className="mp-phone">
    <div className="mp-desk" onTouchStart={onHomeTouchStart} onTouchEnd={onHomeTouchEnd} onMouseDown={onHomeMouseDown} onMouseUp={onHomeMouseUp} onPointerDown={onHomePointerDown} onPointerUp={onHomePointerUp} onPointerMove={onHomePointerMove} onPointerCancel={cancelPointerDrag} onDragOver={onHomeDragOverPageEdge}><BarClock ft={ft} /><div className="mp-desk-scroll">
      <DeskClock ft={ft} fd={fd} />
      {activeChar && <div className="mp-cw" onClick={(e)=>{e.stopPropagation(); openApp("status");}} onPointerUp={(e)=>openAppFromTouch("status", e)}><div className="mp-av">{sanitizeUserImageUrl(activeChar.avatar)?<img src={sanitizeUserImageUrl(activeChar.avatar)} alt=""/>:"??"}</div><div className="mp-cw-info"><div className="mp-cw-name">{activeChar.name}<span className="mp-active-badge">ACTIVE</span></div><div className="mp-cw-desc">{(activeChar.statusText || activeChar.description || tr("在線中", "Online", "オンライン中", "온라인 중")).slice(0,34)}</div><div style={{fontSize:10,color:"var(--mp-txt-l)",marginTop:2}}>{tr("更新：", "Updated: ", "更新: ", "업데이트: ")}{activeChar.statusUpdatedAt ? new Date(activeChar.statusUpdatedAt).toLocaleTimeString("zh-TW",{hour:"2-digit",minute:"2-digit"}) : "--:--"}</div></div></div>}
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
                      onClick={(e)=>{ e.stopPropagation(); app && !isDraggingApp && Date.now() > suppressAppClickUntilRef.current && openApp(app.id); }}
                      onPointerUp={(e)=>{ if (app && !isDraggingApp) openAppFromTouch(app.id, e); }}
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
            onClick={(e)=>{ e.stopPropagation(); !isDraggingApp && Date.now() > suppressAppClickUntilRef.current && openApp(app.id); }}
            onPointerUp={(e)=>{ if (!isDraggingApp) openAppFromTouch(app.id, e); }}
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
    {modal === "addChar" && <AddCharModal setModal={setModal} setEditingCharacter={setEditingCharacter} addCharacter={addCharacter} updateCharacter={updateCharacter} exportCharacter={exportCharacter} deleteCharacter={deleteCharacter} editingCharacter={editingCharacter} sanitizeUserImageUrl={sanitizeUserImageUrl} uiLanguage={uiLanguage} ttsConfig={ttsConfig} ttsVoices={ttsVoices.length ? ttsVoices : (ttsConfig.elevenlabs?.availableVoices || [])} onVoicePreview={previewCharacterVoice} />}
    {memoryEditor && (
      <div className="mp-overlay" onClick={() => setMemoryEditor(null)}>
        <div className="mp-modal" onClick={(e) => e.stopPropagation()}>
          <div className="mp-modal-t">{tr("編輯記憶", "Edit memory", "メモリを編集", "기억 편집")}</div>
          <div className="mp-row">
            <div className="mp-lbl">{tr("記憶內容（最多 500 字）", "Memory content (up to 500 chars)", "メモ内容（500文字以内）", "기억 내용(최대 500자)")}</div>
            <textarea className="mp-ta" value={memoryEditor.text} maxLength={500} onChange={(e)=>setMemoryEditor((s)=>({ ...s, text: e.target.value }))} style={{minHeight:140,resize:"vertical"}} />
          </div>
          <div style={{display:"flex",gap:8,marginTop:10}}>
            <button className="mp-save" style={{flex:1,background:"linear-gradient(135deg,#b0bec5,#90a4ae)"}} onClick={() => setMemoryEditor(null)}>{tr("取消", "Cancel", "キャンセル", "취소")}</button>
            <button className="mp-save" style={{flex:1}} onClick={() => {
              const t = sanitizeText(memoryEditor.text, 500);
              setMemories((prev) => ({
                ...prev,
                [memoryEditor.charId]: (prev[memoryEditor.charId] || []).map((m) =>
                  m.id === memoryEditor.memoryId ? { ...m, text: t } : m
                ),
              }));
              setMemoryEditor(null);
              showToast(tr("記憶已更新", "Memory updated", "メモリを更新しました", "기억이 업데이트되었습니다"));
            }}>{tr("儲存", "Save", "保存", "저장")}</button>
          </div>
        </div>
      </div>
    )}
    {messageEditor && (
      <div className="mp-overlay" onClick={closeMessageEditor}>
        <div className="mp-modal" onClick={(e)=>e.stopPropagation()}>
          <div className="mp-modal-t" style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <span>{tr("編輯對話", "Edit message", "メッセージを編集", "메시지 편집")}</span>
            <button className="mp-ibtn-r" onClick={deleteMessageWithConfirm} title={tr("刪除此段訊息", "Delete this message", "このメッセージを削除", "이 메시지 삭제")}>🗑️</button>
          </div>
          <div className="mp-row">
            <div className="mp-lbl">{tr("訊息內容", "Message content", "メッセージ内容", "메시지 내용")}</div>
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
            <button className="mp-save" style={{flex:1,background:"linear-gradient(135deg,#b0bec5,#90a4ae)"}} onClick={closeMessageEditor}>{tr("取消", "Cancel", "キャンセル", "취소")}</button>
            <button className="mp-save" style={{flex:1}} onClick={saveEditedMessage}>{tr("儲存", "Save", "保存", "저장")}</button>
          </div>
        </div>
      </div>
    )}
    {updateNoticeOpen && (
      <div className="mp-overlay" onClick={closeUpdateNotice}>
        <div className="mp-modal" onClick={(e)=>e.stopPropagation()}>
          <div className="mp-modal-t">MaliPhone v{VERSION} {tr("更新", "Update", "更新", "업데이트")}</div>
          <div className="mp-update-list">
            {(currentChangelog.length ? currentChangelog : [tr("這個版本沒有填寫更新內容。", "No update notes were added for this version.", "このバージョンの更新内容は未記入です。", "이 버전의 업데이트 내용이 없습니다.")]).map((item, idx) => (
              <div key={idx} className="mp-update-item">{item}</div>
            ))}
          </div>
          <button className="mp-save" style={{marginTop:12}} onClick={closeUpdateNotice}>{tr("知道了", "Got it", "OK", "확인")}</button>
        </div>
      </div>
    )}
    {playerPostModalOpen && (
      <div className="mp-overlay" onClick={() => setPlayerPostModalOpen(false)}>
        <div className="mp-modal" onClick={(e) => e.stopPropagation()}>
          <div className="mp-modal-t">{tr("發佈社群貼文", "Create social post", "投稿を作成", "소셜 게시물 작성")}</div>
          <div className="mp-row">
            <textarea
              className="mp-ta"
              value={playerPostText}
              maxLength={PLAYER_SOCIAL_POST_LIMIT}
              placeholder={tr("今天想分享什麼？", "What would you like to share today?", "今日は何を共有しますか？", "오늘 무엇을 공유할까요?")}
              onChange={(e) => setPlayerPostText(e.target.value.slice(0, PLAYER_SOCIAL_POST_LIMIT))}
              style={{minHeight:130,resize:"vertical"}}
            />
            <div className="mp-char-counter mp-char-counter-modal">{playerPostText.length}/{PLAYER_SOCIAL_POST_LIMIT}</div>
          </div>
          <div style={{display:"flex",gap:8,marginTop:12}}>
            <button className="mp-save" style={{flex:1,background:"linear-gradient(135deg,#b0bec5,#90a4ae)"}} onClick={() => setPlayerPostModalOpen(false)}>{tr("取消", "Cancel", "キャンセル", "취소")}</button>
            <button className="mp-save" style={{flex:1}} disabled={playerPostSubmitting} onClick={submitPlayerPost}>{playerPostSubmitting ? tr("發佈中...", "Posting...", "投稿中...", "게시 중...") : tr("發佈", "Post", "投稿", "게시")}</button>
          </div>
        </div>
      </div>
    )}
    {transferModalOpen && currentChatChar && (
      <div className="mp-overlay" onClick={() => setTransferModalOpen(false)}>
        <div className="mp-modal" onClick={(e) => e.stopPropagation()}>
          <div className="mp-modal-t">{tr("轉帳給", "Transfer to", "送金先", "송금 대상")} {currentChatChar.name}</div>
          <div className="mp-row">
            <div className="mp-lbl">{tr("金額", "Amount", "金額", "금액")}</div>
            <input
              className="mp-sinp"
              inputMode="numeric"
              value={transferAmount}
              onChange={(e) => setTransferAmount(e.target.value.replace(/[^\d]/g, ""))}
              placeholder={tr("輸入金額", "Enter amount", "金額を入力", "금액을 입력")}
            />
          </div>
          <div className="mp-row">
            <div className="mp-lbl">{tr("備註", "Note", "メモ", "메모")}</div>
            <input
              className="mp-sinp"
              value={transferNote}
              maxLength={60}
              onChange={(e) => setTransferNote(e.target.value)}
              placeholder={tr("可不填，例如：下午茶 / 車資 / 還款", "Optional, e.g. snacks / fare / repayment", "任意入力。例: おやつ / 交通費 / 返済", "선택 사항. 예: 간식 / 교통비 / 상환")}
            />
          </div>
          <div style={{display:"flex",gap:8,marginTop:12}}>
            <button className="mp-save" style={{flex:1,background:"linear-gradient(135deg,#b0bec5,#90a4ae)"}} onClick={() => setTransferModalOpen(false)}>{tr("取消", "Cancel", "キャンセル", "취소")}</button>
            <button className="mp-save" style={{flex:1}} disabled={transferSubmitting} onClick={transferToCurrentChar}>{transferSubmitting ? tr("轉帳中...", "Transferring...", "送金中...", "송금 중...") : tr("確認轉帳", "Confirm transfer", "送金を確定", "송금 확인")}</button>
          </div>
        </div>
      </div>
    )}
    {groupCreateOpen && (
      <div className="mp-overlay" onClick={() => setGroupCreateOpen(false)}>
        <div className="mp-modal" onClick={(e) => e.stopPropagation()}>
          <div className="mp-modal-t">{tr("新增群組", "Create group", "グループを作成", "그룹 만들기")}</div>
          <div className="mp-row">
            <div className="mp-lbl">{tr("群組名稱", "Group name", "グループ名", "그룹 이름")}</div>
            <input
              className="mp-sinp"
              value={groupCreateName}
              onChange={(e) => setGroupCreateName(e.target.value)}
              placeholder={tr("可留空，建立後再命名", "Optional, name it later", "未入力でも可。後で名前を変更できます", "비워도 됩니다. 나중에 이름을 정하세요")}
            />
            <div style={{ fontSize: 11, color: "var(--mp-txt-l)", marginTop: 6 }}>{tr("未命名時，會自動依成員名稱生成群組名。", "If left blank, the group name will be generated from the members.", "未入力の場合はメンバー名から自動生成されます。", "비워두면 멤버 이름으로 자동 생성됩니다.")}</div>
          </div>
            <div className="mp-row">
            <div className="mp-lbl">{tr("群組圖片", "Group cover", "グループ画像", "그룹 이미지")}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div className="mp-av" style={{ cursor: "pointer" }} onClick={() => groupCoverInputRef.current?.click()}>
                {groupCreateCover ? <img src={groupCreateCover} alt="" /> : "👥"}
              </div>
              <input type="file" ref={groupCoverInputRef} accept="image/*" style={{ display: "none" }} onChange={handleGroupCreateCoverUp} />
              <button className="mp-ibtn" style={{ padding: "6px 12px", fontSize: 12, lineHeight: 1 }} onClick={() => groupCoverInputRef.current?.click()}>{tr("上傳", "Upload", "アップロード", "업로드")}</button>
              <button className="mp-ibtn-r" style={{ padding: "6px 12px", fontSize: 12, lineHeight: 1 }} onClick={() => setGroupCreateCover("")}>{tr("移除", "Remove", "削除", "제거")}</button>
            </div>
            <div style={{ fontSize: 11, color: "var(--mp-txt-l)", marginTop: 6 }}>{tr("會顯示在群組聊天室列表。", "Shown in the group chat list.", "グループチャット一覧に表示されます。", "그룹 채팅 목록에 표시됩니다.")}</div>
          </div>
          <div className="mp-row">
            <div className="mp-lbl">{tr("要加入的角色", "Characters to add", "追加するキャラ", "추가할 캐릭터")}</div>
            {renderGroupMemberGrid(groupCreateMemberIds, setGroupCreateMemberIds, groupCreateSearch, setGroupCreateSearch)}
          </div>
          <div className="mp-row">
            <div className="mp-lbl">{tr("群組聊天規則", "Group chat rules", "グループチャットのルール", "그룹 채팅 규칙")}</div>
            <textarea
              className="mp-ta"
              value={groupCreateRulePrompt}
              onChange={(e) => setGroupCreateRulePrompt(e.target.value)}
              placeholder={tr("例如：自然聊天、可互相吐槽、不要提系統...", "For example: natural chat, playful teasing, no system talk...", "例: 自然な会話、軽いツッコミ可、システムの話はしない...", "예: 자연스러운 대화, 가벼운 농담 가능, 시스템 언급 금지...")}
              style={{ minHeight: 120, resize: "vertical" }}
            />
            <div style={{ fontSize: 11, color: "var(--mp-txt-l)", marginTop: 6 }}>{tr("之後可作為群組 AI 回覆的專屬 Prompt。", "Can be used later as the group AI's dedicated prompt.", "後でグループAIの専用プロンプトとして使えます。", "나중에 그룹 AI 전용 프롬프트로 사용할 수 있습니다.")}</div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button className="mp-save" style={{ flex: 1, background: "linear-gradient(135deg,#b0bec5,#90a4ae)" }} onClick={() => setGroupCreateOpen(false)}>{tr("取消", "Cancel", "キャンセル", "취소")}</button>
            <button className="mp-save" style={{ flex: 1 }} onClick={createGroupChat}>{tr("建立群組", "Create group", "グループを作成", "그룹 만들기")}</button>
          </div>
        </div>
      </div>
    )}
    {groupEditOpen && (
      <div className="mp-overlay" onClick={() => setGroupEditOpen(false)}>
        <div className="mp-modal" onClick={(e) => e.stopPropagation()}>
          <div className="mp-modal-t">{tr("編輯群組", "Edit group", "グループを編集", "그룹 편집")}</div>
          <div className="mp-row">
            <div className="mp-lbl">{tr("群組名稱", "Group name", "グループ名", "그룹 이름")}</div>
            <input
              className="mp-sinp"
              value={groupEditName}
              onChange={(e) => setGroupEditName(e.target.value)}
              placeholder={tr("可留空，儲存後再命名", "Optional, name it later", "未入力でも可。保存後に名前を変更できます", "비워도 됩니다. 저장 후 이름을 정하세요")}
            />
            <div style={{ fontSize: 11, color: "var(--mp-txt-l)", marginTop: 6 }}>{tr("未命名時，會自動依成員名稱生成群組名。", "If left blank, the group name will be generated from the members.", "未入力の場合はメンバー名から自動生成されます。", "비워두면 멤버 이름으로 자동 생성됩니다.")}</div>
          </div>
          <div className="mp-row">
            <div className="mp-lbl">{tr("群組圖片", "Group cover", "グループ画像", "그룹 이미지")}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div className="mp-av" style={{ cursor: "pointer" }} onClick={() => groupEditCoverInputRef.current?.click()}>
                {groupEditCover ? <img src={groupEditCover} alt="" /> : "👥"}
              </div>
              <input type="file" ref={groupEditCoverInputRef} accept="image/*" style={{ display: "none" }} onChange={handleGroupEditCoverUp} />
              <button className="mp-ibtn" style={{ padding: "6px 12px", fontSize: 12, lineHeight: 1 }} onClick={() => groupEditCoverInputRef.current?.click()}>{tr("上傳", "Upload", "アップロード", "업로드")}</button>
              <button className="mp-ibtn-r" style={{ padding: "6px 12px", fontSize: 12, lineHeight: 1 }} onClick={() => setGroupEditCover("")}>{tr("移除", "Remove", "削除", "제거")}</button>
            </div>
            <div style={{ fontSize: 11, color: "var(--mp-txt-l)", marginTop: 6 }}>{tr("會顯示在群組聊天室列表。", "Shown in the group chat list.", "グループチャット一覧に表示されます。", "그룹 채팅 목록에 표시됩니다.")}</div>
          </div>
          <div className="mp-row">
            <div className="mp-lbl">{tr("要加入的角色", "Characters to add", "追加するキャラ", "추가할 캐릭터")}</div>
            {renderGroupMemberGrid(groupEditMemberIds, setGroupEditMemberIds, groupEditSearch, setGroupEditSearch)}
          </div>
          <div className="mp-row">
            <div className="mp-lbl">{tr("群組聊天規則", "Group chat rules", "グループチャットのルール", "그룹 채팅 규칙")}</div>
            <textarea
              className="mp-ta"
              value={groupEditRulePrompt}
              onChange={(e) => setGroupEditRulePrompt(e.target.value)}
              placeholder={tr("例如：自然聊天、可互相吐槽、不要提系統...", "For example: natural chat, playful teasing, no system talk...", "例: 自然な会話、軽いツッコミ可、システムの話はしない...", "예: 자연스러운 대화, 가벼운 농담 가능, 시스템 언급 금지...")}
              style={{ minHeight: 120, resize: "vertical" }}
            />
            <div style={{ fontSize: 11, color: "var(--mp-txt-l)", marginTop: 6 }}>{tr("之後可作為群組 AI 回覆的專屬 Prompt。", "Can be used later as the group AI's dedicated prompt.", "後でグループAIの専用プロンプトとして使えます。", "나중에 그룹 AI 전용 프롬프트로 사용할 수 있습니다.")}</div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button className="mp-save" style={{ flex: 1, background: "linear-gradient(135deg,#b0bec5,#90a4ae)" }} onClick={() => setGroupEditOpen(false)}>{tr("取消", "Cancel", "キャンセル", "취소")}</button>
            <button className="mp-save" style={{ flex: 1 }} onClick={saveEditGroup}>{tr("儲存", "Save", "保存", "저장")}</button>
          </div>
          </div>
        </div>
      )}
      {(groupCoverCrop || groupEditCoverCrop) && (
        <div className="mp-overlay" onClick={() => { setGroupCoverCrop(null); setGroupEditCoverCrop(null); }}>
          <div className="mp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mp-modal-t">{tr("裁切群組圖片", "Crop group cover", "グループ画像をトリミング", "그룹 이미지 자르기")}</div>
            <div style={{ fontSize: 11, color: "var(--mp-txt-l)", marginBottom: 10 }}>{tr("可拖曳調整位置，完成後會自動壓縮。", "Drag to adjust the position; it will be compressed automatically when done.", "ドラッグで位置を調整できます。完了時に自動で圧縮されます。", "드래그로 위치를 조정할 수 있으며 완료 시 자동 압축됩니다.")}</div>
            <div
              style={{ width: 220, height: 220, borderRadius: 18, overflow: "hidden", border: "1px solid rgba(244,143,177,.35)", background: "#fff", touchAction: "none", cursor: "grab", position: "relative", margin: "0 auto" }}
              onPointerDown={(e) => {
                const crop = groupEditCoverCrop || groupCoverCrop;
                if (!crop) return;
                e.preventDefault();
                try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch (_) {}
                const px = e.clientX ?? 0;
                const py = e.clientY ?? 0;
                const next = { ...crop, dragging: true, dragStartX: px, dragStartY: py, startPanX: crop.panX || 0, startPanY: crop.panY || 0 };
                if (groupEditCoverCrop) setGroupEditCoverCrop(next); else setGroupCoverCrop(next);
              }}
              onPointerMove={(e) => {
                const crop = groupEditCoverCrop || groupCoverCrop;
                if (!crop?.dragging) return;
                e.preventDefault();
                const px = e.clientX ?? 0;
                const py = e.clientY ?? 0;
                const nextPanX = (crop.startPanX || 0) + ((px - (crop.dragStartX || 0)) / 1.8);
                const nextPanY = (crop.startPanY || 0) + ((py - (crop.dragStartY || 0)) / 1.8);
                const next = { ...crop, panX: Math.max(-100, Math.min(100, nextPanX)), panY: Math.max(-100, Math.min(100, nextPanY)) };
                if (groupEditCoverCrop) setGroupEditCoverCrop(next); else setGroupCoverCrop(next);
              }}
              onPointerUp={(e) => {
                try { e.currentTarget.releasePointerCapture?.(e.pointerId); } catch (_) {}
                const crop = groupEditCoverCrop || groupCoverCrop;
                if (!crop) return;
                const next = { ...crop, dragging: false };
                if (groupEditCoverCrop) setGroupEditCoverCrop(next); else setGroupCoverCrop(next);
              }}
            >
              <img
                src={(groupEditCoverCrop || groupCoverCrop)?.src}
                alt=""
                style={{
                  position: "absolute",
                  width: (() => {
                    const crop = groupEditCoverCrop || groupCoverCrop;
                    const box = 220;
                    const iw = Number(crop?.width || 1);
                    const ih = Number(crop?.height || 1);
                    return iw * Math.max(box / iw, box / ih) * Math.max(1, Number(crop?.zoom || 1));
                  })(),
                  height: (() => {
                    const crop = groupEditCoverCrop || groupCoverCrop;
                    const box = 220;
                    const iw = Number(crop?.width || 1);
                    const ih = Number(crop?.height || 1);
                    return ih * Math.max(box / iw, box / ih) * Math.max(1, Number(crop?.zoom || 1));
                  })(),
                  left: (() => {
                    const crop = groupEditCoverCrop || groupCoverCrop;
                    const box = 220;
                    const iw = Number(crop?.width || 1);
                    const ih = Number(crop?.height || 1);
                    const scale = Math.max(box / iw, box / ih) * Math.max(1, Number(crop?.zoom || 1));
                    const dw = iw * scale;
                    const maxShiftX = Math.max(0, (dw - box) / 2);
                    return (box - dw) / 2 + (maxShiftX * Number(crop?.panX || 0)) / 100;
                  })(),
                  top: (() => {
                    const crop = groupEditCoverCrop || groupCoverCrop;
                    const box = 220;
                    const iw = Number(crop?.width || 1);
                    const ih = Number(crop?.height || 1);
                    const scale = Math.max(box / iw, box / ih) * Math.max(1, Number(crop?.zoom || 1));
                    const dh = ih * scale;
                    const maxShiftY = Math.max(0, (dh - box) / 2);
                    return (box - dh) / 2 + (maxShiftY * Number(crop?.panY || 0)) / 100;
                  })(),
                  objectFit: "cover",
                  pointerEvents: "none",
                  userSelect: "none",
                }}
              />
            </div>
            <div className="mp-row">
              <div className="mp-lbl">{tr("縮放", "Zoom", "ズーム", "확대")}</div>
              <input
                type="range"
                min="1"
                max="3"
                step="0.01"
                value={(groupEditCoverCrop || groupCoverCrop)?.zoom || 1}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  if (groupEditCoverCrop) setGroupEditCoverCrop((s) => ({ ...(s || {}), zoom: value })); else setGroupCoverCrop((s) => ({ ...(s || {}), zoom: value }));
                }}
              />
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button className="mp-save" style={{ flex: 1, background: "linear-gradient(135deg,#b0bec5,#90a4ae)" }} onClick={() => { setGroupCoverCrop(null); setGroupEditCoverCrop(null); }}>{tr("取消", "Cancel", "キャンセル", "취소")}</button>
              <button className="mp-save" style={{ flex: 1 }} onClick={() => applyGroupCoverCrop(groupEditCoverCrop ? "edit" : "create")}>{tr("完成裁切", "Finish crop", "トリミング完了", "자르기 완료")}</button>
            </div>
          </div>
        </div>
      )}
      {toast && <div className="mp-toast">{toast}</div>}
  </div></div></>);
}

