import React, { useEffect, useRef, useState } from "react";
import { parseSillyTavernJSON, parseSillyTavernPNG } from "../../utils/characterParser";
import { createDefaultVoiceSettings, normalizeCharacterVoiceSettings } from "../../utils/voiceSettings";
import { calculateCoverCrop, calculateCropDrag, createImageCropState, drawCoverCrop } from "../../utils/imageCrop";

export default function AddCharacterModal({ setModal, setEditingCharacter, addCharacter, updateCharacter, exportCharacter, deleteCharacter, editingCharacter, sanitizeUserImageUrl, uiLanguage, ttsConfig, ttsVoices, onVoicePreview }) {
  const [tab, setTab] = useState("manual");
  const [n, sn] = useState(""); const [d, sd] = useState(""); const [p, sp] = useState(""); const [rel, srel] = useState(""); const [av, sav] = useState(""); const [avatarOriginal, setAvatarOriginal] = useState("");
  const [importErr, setImportErr] = useState(""); const [importing, setImporting] = useState(false);
  const [pendingStImport, setPendingStImport] = useState(null);
  const [avatarCrop, setAvatarCrop] = useState(null);
  const [voiceSettings, setVoiceSettings] = useState(createDefaultVoiceSettings);
  const [voicePreviewing, setVoicePreviewing] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [tagsText, setTagsText] = useState("");
  const [creator, setCreator] = useState("");
  const [creatorNotes, setCreatorNotes] = useState("");
  const [characterVersion, setCharacterVersion] = useState("");
  const [privateNotes, setPrivateNotes] = useState("");
  const [initialOnlineMessage, setInitialOnlineMessage] = useState("");
  const [initialRealityMessage, setInitialRealityMessage] = useState("");
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
    setAvatarOriginal(editingCharacter.avatarOriginal || editingCharacter.avatar || "");
    setVoiceSettings(normalizeCharacterVoiceSettings(editingCharacter.voiceSettings));
    setTagsText(Array.isArray(editingCharacter.tags) ? editingCharacter.tags.join("、") : "");
    setCreator(editingCharacter.creator || "");
    setCreatorNotes(editingCharacter.creatorNotes || "");
    setCharacterVersion(editingCharacter.characterVersion || "");
    setPrivateNotes(editingCharacter.privateNotes || "");
    setInitialOnlineMessage(editingCharacter.initialOnlineMessage ?? editingCharacter.firstMessage ?? "");
    setInitialRealityMessage(editingCharacter.initialRealityMessage || "");
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
        setAvatarOriginal(safe);
        setAvatarCrop(createImageCropState({ src: safe, width: img.width, height: img.height }));
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
          drawCoverCrop(ctx, img, avatarCrop, c.size);
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
      return { ...s, ...calculateCropDrag(s, px, py) };
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
    const geometry = calculateCoverCrop({ width: avatarCrop?.width, height: avatarCrop?.height, frameWidth: box, zoom: avatarCrop?.zoom, panX: avatarCrop?.panX, panY: avatarCrop?.panY });
    return {
      position: "absolute",
      width: geometry.width,
      height: geometry.height,
      left: geometry.left,
      top: geometry.top,
      userSelect: "none",
      WebkitUserDrag: "none",
      pointerEvents: "none",
    };
  };
  const queueStImport = (character) => {
    if (String(character?.firstMessage || "").trim()) setPendingStImport(character);
    else addCharacter({ ...character, firstMessage: "", initialOnlineMessage: "", initialRealityMessage: "" });
  };
  const handleImport = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    setImportErr(""); setImporting(true);
    try {
      if (file.name.endsWith(".json")) {
        const t = await file.text();
        const raw = JSON.parse(t);
        if (raw?.format === "maliphone-character" && raw?.character) addCharacter(raw.character);
        else queueStImport(parseSillyTavernJSON(raw));
      }
      else if (file.type === "image/png") { queueStImport(await parseSillyTavernPNG(file)); }
      else setImportErr(tr("不支援的檔案格式，請使用 .json 或 .png", "Unsupported file format. Use .json or .png.", "対応していないファイル形式です。.json または .png を使用してください。", "지원하지 않는 파일 형식입니다. .json 또는 .png를 사용하세요."));
    } catch (err) { setImportErr(err.message || tr("匯入失敗", "Import failed", "インポートに失敗しました", "가져오기에 실패했습니다")); }
    setImporting(false); if (importRef.current) importRef.current.value = "";
  };
  const confirmStImport = (openingMode) => {
    if (!pendingStImport) return;
    const firstMessage = pendingStImport.firstMessage || "";
    addCharacter({
      ...pendingStImport,
      firstMessage: openingMode === "online" ? firstMessage : "",
      initialOnlineMessage: openingMode === "online" ? firstMessage : "",
      initialRealityMessage: openingMode === "reality" ? firstMessage : "",
    });
    setPendingStImport(null);
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
          {pendingStImport && <div className="mp-sg" style={{padding:12,marginTop:12}}>
            <div className="mp-sg-t">{tr("是否匯入 ST 開場白？", "Import the ST opening message?", "STの初回メッセージを取り込みますか？", "ST 첫 인사를 가져올까요?")}</div>
            <div style={{fontSize:11,color:"var(--mp-txt-l)",lineHeight:1.6,marginBottom:10}}>
              {tr(`已讀取「${pendingStImport.name}」的 first_mes。多數 ST 角色以面對面情境為主，建議匯入為現實開場白。`, `The first_mes for "${pendingStImport.name}" was found. Most ST cards assume face-to-face interaction, so Reality is recommended.`, `「${pendingStImport.name}」の first_mes を読み込みました。多くのSTカードは対面を想定しているため、現実モードを推奨します。`, `"${pendingStImport.name}"의 first_mes를 읽었습니다. 대부분의 ST 카드는 대면 상황을 전제로 하므로 현실 모드를 권장합니다.`)}
            </div>
            <div style={{display:"grid",gap:8}}>
              <button type="button" className="mp-save" onClick={() => confirmStImport("reality")}>{tr("現實開場白（建議）", "Reality opening (recommended)", "現実モード（推奨）", "현실 모드 (권장)")}</button>
              <button type="button" className="mp-save" style={{background:"linear-gradient(135deg,#90caf9,#42a5f5)"}} onClick={() => confirmStImport("online")}>{tr("線上開場白", "Online opening", "オンライン初回メッセージ", "온라인 첫 인사")}</button>
              <button type="button" className="mp-ibtn" onClick={() => confirmStImport("none")}>{tr("不匯入開場白", "Import without opening message", "初回メッセージなしで取り込む", "첫 인사 없이 가져오기")}</button>
              <button type="button" className="mp-ibtn-r" onClick={() => setPendingStImport(null)}>{tr("取消匯入", "Cancel import", "取り込みをキャンセル", "가져오기 취소")}</button>
            </div>
          </div>}
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
            <div className="mp-row"><div className="mp-lbl">{tr("線上初始開場白（選填）", "Online opening message (optional)", "オンライン初回メッセージ（任意）", "온라인 첫 인사 (선택)")}</div><textarea className="mp-ta" value={initialOnlineMessage} maxLength={4000} onChange={(e) => setInitialOnlineMessage(e.target.value.slice(0, 4000))} placeholder={tr("留空則聊天室不會有預設開場白", "Leave blank for no default opening message", "空欄の場合、初回メッセージは表示されません", "비워두면 기본 첫 인사가 없습니다")} style={{minHeight:72,resize:"vertical"}} /><div className="mp-char-counter mp-char-counter-modal">{initialOnlineMessage.length}/4000</div></div>
            <div className="mp-row"><div className="mp-lbl">{tr("現實初始開場白（選填）", "Reality opening message (optional)", "現実モード初回メッセージ（任意）", "현실 모드 첫 인사 (선택)")}</div><textarea className="mp-ta" value={initialRealityMessage} maxLength={4000} onChange={(e) => setInitialRealityMessage(e.target.value.slice(0, 4000))} placeholder={tr("首次切換到現實模式時顯示；留空則不顯示", "Shown the first time reality mode is opened; leave blank for none", "初めて現実モードに切り替えた時に表示。空欄なら表示しません", "현실 모드로 처음 전환할 때 표시되며, 비워두면 표시하지 않습니다")} style={{minHeight:72,resize:"vertical"}} /><div className="mp-char-counter mp-char-counter-modal">{initialRealityMessage.length}/4000</div></div>
            <div className="mp-sg" style={{padding:12,marginTop:12}}>
              <button type="button" onClick={() => setAdvancedOpen((open) => !open)} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",border:0,background:"transparent",padding:0,color:"var(--mp-txt)",fontWeight:800,fontSize:13,textAlign:"left"}}>
                <span>{tr("進階資料", "Advanced details", "詳細情報", "고급 정보")}</span>
                <span style={{color:"var(--mp-txt-l)",fontSize:12}}>{advancedOpen ? "▲" : "▼"}</span>
              </button>
              <div style={{fontSize:10,color:"var(--mp-txt-l)",marginTop:4}}>{tr("管理角色卡來源與補充資料", "Manage character-card source and metadata", "キャラカードの出典と補足情報を管理", "캐릭터 카드 출처와 추가 정보 관리")}</div>
              {advancedOpen && <div style={{marginTop:10}}>
                <div className="mp-row"><div className="mp-lbl">{tr("標籤", "Tags", "タグ", "태그")}</div><input className="mp-sinp" value={tagsText} maxLength={619} onChange={(e) => setTagsText(e.target.value)} placeholder={tr("例如：偶像、校園、傲嬌（用逗號分隔）", "e.g. idol, school, tsundere (comma-separated)", "例：アイドル、学園、ツンデレ（カンマ区切り）", "예: 아이돌, 학교, 츤데레 (쉼표로 구분)")} /><div style={{fontSize:9,color:"var(--mp-txt-l)",marginTop:4}}>{tr("最多 20 個；部分功能會參考標籤", "Up to 20; some features use tags as context", "最大20個。一部機能が参照します", "최대 20개; 일부 기능에서 참고합니다")}</div></div>
                <div className="mp-row"><div className="mp-lbl">{tr("原作者", "Original creator", "原作者", "원작자")}</div><input className="mp-sinp" value={creator} maxLength={80} onChange={(e) => setCreator(e.target.value)} placeholder={tr("角色卡作者或來源署名", "Character-card creator or attribution", "キャラカード作者・出典", "캐릭터 카드 제작자 또는 출처")} /></div>
                <div className="mp-row"><div className="mp-lbl">{tr("作者備註", "Creator notes", "作者メモ", "제작자 메모")}</div><textarea className="mp-ta" value={creatorNotes} maxLength={4000} onChange={(e) => setCreatorNotes(e.target.value)} placeholder={tr("原作者提供的設定補充；部分功能可能參考", "Supplemental setup from the creator; some features may use it", "作者による設定補足。一部機能が参照する場合があります", "제작자가 제공한 설정 보충; 일부 기능에서 참고할 수 있습니다")} style={{minHeight:72,resize:"vertical"}} /><div className="mp-char-counter mp-char-counter-modal">{creatorNotes.length}/4000</div></div>
                <div className="mp-row"><div className="mp-lbl">{tr("角色卡版本", "Character-card version", "キャラカード版", "캐릭터 카드 버전")}</div><input className="mp-sinp" value={characterVersion} maxLength={40} onChange={(e) => setCharacterVersion(e.target.value)} placeholder="1.0" /></div>
                <div className="mp-row"><div className="mp-lbl">{tr("玩家私人備註", "Private player notes", "プレイヤー非公開メモ", "플레이어 비공개 메모")}</div><textarea className="mp-ta" value={privateNotes} maxLength={4000} onChange={(e) => setPrivateNotes(e.target.value)} placeholder={tr("只供你查看，不會提供給 AI", "Only visible to you and never sent to AI", "自分だけが閲覧でき、AIには送信されません", "나만 볼 수 있으며 AI에 전송되지 않습니다")} style={{minHeight:72,resize:"vertical"}} /><div style={{fontSize:9,color:"var(--mp-txt-l)",marginTop:4}}>{tr("此欄位不會影響角色回覆", "This field does not affect character replies", "キャラの返答には影響しません", "캐릭터 답변에 영향을 주지 않습니다")}</div><div className="mp-char-counter mp-char-counter-modal">{privateNotes.length}/4000</div></div>
              </div>}
            </div>
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
              const tags = tagsText.split(/[,，、\n]/).map((tag) => tag.trim().slice(0, 30)).filter(Boolean).filter((tag, index, list) => list.indexOf(tag) === index).slice(0, 20);
              const payload = {name:n.trim(),description:d.trim(),systemPrompt:p.trim(),relationshipToUser:rel.trim(),avatar:av,avatarOriginal,voiceSettings:normalizeCharacterVoiceSettings(voiceSettings),personality:editingCharacter?.personality||"",scenario:editingCharacter?.scenario||"",firstMessage:initialOnlineMessage.trim(),initialOnlineMessage:initialOnlineMessage.trim(),initialRealityMessage:initialRealityMessage.trim(),messageExamples:editingCharacter?.messageExamples||"",tags,creator:creator.trim(),creatorNotes:creatorNotes.trim(),characterVersion:characterVersion.trim(),privateNotes:privateNotes.trim()};
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
