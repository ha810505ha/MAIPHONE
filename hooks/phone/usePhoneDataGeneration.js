import { PHONE_APP_META, sanitizePhoneTheme, buildPhonePromptContext, buildPhoneAppPrompt, sanitizePhoneAppData } from "../../utils/phoneAppGen";

export default function usePhoneDataGeneration({
  phoneInboxCache, phoneAppCache, chatHistory, playerProfile, characterWallets, apiConfig,
  setPhoneInboxCache, setPhoneAppCache, setPhoneGenLoading, setPhonePlayerContactLoading,
  setPhoneAppGenLoading, setDiaryPage, syncShopOrdersToWallet, canUseCurrentProvider,
  getOutputLanguageDirective, callAI, sanitizeText, gid, showToast, tr,
}) {
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
    if (!window.confirm("刷新其他聊天只會重新生成其他聯絡人的聊天內容，不包含與玩家的聊天，也不會修改玩家暱稱或備註。確定要繼續嗎？")) return;
    if (!canUseCurrentProvider()) { showToast(tr("請先完成 AI 連線設定（API Key）", "Please finish AI connection setup (API key) first", "先にAI接続設定（APIキー）を完了してください", "먼저 AI 연결 설정(API 키)을 완료해주세요")); return; }
    setPhoneGenLoading(true);
    try {
      const playerFormalName = sanitizeText(playerProfile?.name || "玩家", 40);
      const playerNickname = sanitizeText(playerProfile?.nickname || "", 40);
      const recent = (chatHistory[char.id] || []).slice(-10).map((m) => `${m.role === "user" ? playerFormalName : char.name}: ${m.content || "[圖片]"}`).join("\n");
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
5) 玩家正式名稱是「${playerFormalName}」${playerNickname ? `，暱稱是「${playerNickname}」` : "，未設定暱稱"}。暱稱屬於較私密的稱呼，其他 NPC 預設不要使用；只有能從設定合理判斷該 NPC 與玩家很親近、而且知道這個暱稱時，才可以偶爾使用。一般情況請使用正式名稱、代稱或自然省略稱呼。
6) 不要讓所有 NPC 都認識玩家，也不要讓所有 NPC 都用相同方式稱呼玩家；依每個 NPC 與角色、玩家的關係自然判斷。

角色設定：
${roleProfile || "（無）"}

最近和 {{user}} 對話（供語氣參考）：
${recent || "（尚無）"}
`,
      }];
      const raw = await callAI(prompt, apiConfig, "你是手機聊天資料生成器，只能輸出有效 JSON。");
      const parsed = parseJsonObjectFromText(raw);
      const threadsRaw = Array.isArray(parsed?.threads) ? parsed.threads : [];
      const generatedAt = Date.now();
      const threads = threadsRaw.slice(0, 5).map((t, idx) => {
        const msgs = Array.isArray(t?.messages) ? t.messages : [];
        const lastMessageOffsetMinutes = 3 + idx * 19 + Math.floor(Math.random() * 12);
        const lastMessageTime = generatedAt - lastMessageOffsetMinutes * 60000;
        const messageGapMinutes = 2 + (idx % 4);
        return {
          id: `npc-${idx}-${gid()}`,
          name: sanitizeText(t?.name || `聯絡人${idx + 1}`, 24),
          relation: sanitizeText(t?.relation || "", 40),
          messages: msgs.slice(0, 8).map((m, mi) => ({
            id: `m-${idx}-${mi}-${gid()}`,
            from: m?.from === "char" ? "char" : "other",
            text: sanitizeText(m?.text || "", 120),
            time: lastMessageTime - Math.max(0, msgs.length - 1 - mi) * messageGapMinutes * 60000,
          })).filter((m) => !!m.text),
        };
      }).filter((t) => t.messages.length > 0);
      if (!threads.length) throw new Error("模型未回傳可用的聊天資料");
      setPhoneInboxCache((prev) => ({
        ...prev,
        [char.id]: { ...(prev[char.id] || {}), updatedAt: Date.now(), threads },
      }));
      showToast(`已更新其他聊天（${threads.length} 人）`);
    } catch (err) {
      showToast(`${tr("生成失敗", "Generation failed", "生成に失敗しました", "생성 실패")}：${sanitizeText(err?.message || tr("未知錯誤", "Unknown error", "不明なエラー", "알 수 없는 오류"), 120)}`);
    }
    setPhoneGenLoading(false);
  };

  const refreshPhonePlayerContact = async (char) => {
    if (!char) return;
    if (!window.confirm("確定刷新玩家聊天室？\n\n只會更新玩家名稱、括號稱呼與關係備註；與玩家的對話內容、其他聯絡人聊天都不會改變。")) return;
    if (!canUseCurrentProvider()) { showToast(tr("請先完成 AI 連線設定（API Key）", "Please finish AI connection setup (API key) first", "先にAI接続設定（APIキー）を完了してください", "먼저 AI 연결 설정(API 키)을 완료해주세요")); return; }
    setPhonePlayerContactLoading(true);
    try {
      const currentPlayerContact = phoneInboxCache[char.id]?.playerContact || {};
      const recentPlayerChat = (chatHistory[char.id] || []).slice(-6)
        .map((message) => `${message.role === "user" ? "玩家" : char.name}：${sanitizeText(message.content || "[圖片]", 300)}`)
        .join("\n");
      const prompt = [{
        role: "user",
        content: `${getOutputLanguageDirective()}

請從 ${char.name} 的視角，生成玩家在角色手機通訊錄中的資料，只能輸出 JSON：
{"suffix":"放在玩家名稱括號內的關係稱呼，可空白","note":"角色替玩家設定的短備註名"}

規則：
1) suffix 放在玩家名稱後方括號內，通常留空；只有角色個性或關係非常適合時才填寫，最多 8 字。
2) suffix 以雙方關係為主，例如「老婆」「男友」「室友」「青梅竹馬」，最多 8 字；不要填 thought、note、玩家等系統詞。
3) note 是 ${char.name} 替玩家設定的短備註名，例如「我家那位」「最重要的人」「總忘記帶傘」，2~16 字，不要寫成完整句子，但詞語與語意必須完整，禁止輸出「值得信任的後」這類未完成片段。
4) suffix 與 note 都必須使用目前介面語言，不要中英混搭，不要輸出 thought、note、memo、remark、角色設定等標籤。
5) 如果「與玩家關係」未設定，請從角色描述、System prompt、性格、情境與近期互動推斷最自然的稱呼與備註。
6) 目前備註是「${sanitizeText(currentPlayerContact.note || "尚無", 16)}」。這次刷新請生成不同的新備註，不要原樣重複。

角色設定：${sanitizeText([char.description, char.systemPrompt, char.personality, char.scenario].filter(Boolean).join("\n") || "未設定", 3200)}
與玩家關係：${sanitizeText(char.relationshipToUser || "未設定", 120)}
玩家名稱：${sanitizeText(playerProfile?.name || "玩家", 40)}
玩家暱稱：${sanitizeText(playerProfile?.nickname || "未設定", 40)}
近期互動：\n${recentPlayerChat || "尚無對話"}`,
      }];
      const raw = await callAI(prompt, { ...apiConfig, maxTokens: 300 }, "你是角色手機聯絡人資料生成器，只能輸出有效 JSON。");
      const parsed = parseJsonObjectFromText(raw) || {};
      const parsedContact = parsed.playerContact && typeof parsed.playerContact === "object"
        ? parsed.playerContact
        : parsed.contact && typeof parsed.contact === "object"
          ? parsed.contact
          : parsed;
      let nextNote = sanitizeText(
        parsedContact.note || parsedContact.remark || parsedContact.memo || parsedContact.contactNote || parsedContact["備註"] || "",
        16,
      ).replace(/^\s*(?:thought|note|memo|remark|備註)\s*[:：-]?\s*/i, "").trim();
      if (!nextNote) {
        const noteMatch = String(raw || "").match(/["']?(?:note|remark|memo|contactNote|備註)["']?\s*[:：]\s*["']([^"'\n}]{1,40})/i);
        nextNote = sanitizeText(noteMatch?.[1] || "", 16).replace(/^\s*(?:thought|note|memo|remark|備註)\s*[:：-]?\s*/i, "").trim();
      }
      const isIncompleteContactNote = (value) => /(?:的後|的前|的這|的那|[的與和或但而把被在向從為])$/.test(String(value || "").trim());
      if (!nextNote || /[a-z]{3,}/i.test(nextNote) || isIncompleteContactNote(nextNote)) {
        const retryRaw = await callAI([{
          role: "user",
          content: `${getOutputLanguageDirective()}\n請以 ${char.name} 的視角，只輸出一則 2~16 字、詞語完整的玩家聯絡人短備註名，例如「我家那位」或「最重要的人」。不要輸出未完成片段，不要 JSON、英文、標籤、引號或說明。玩家關係：${sanitizeText(char.relationshipToUser || "未設定", 120)}`,
        }], { ...apiConfig, maxTokens: 100 }, "你只輸出聯絡人備註文字。");
        nextNote = sanitizeText(String(retryRaw || "").replace(/^[「『"']+|[」』"']+$/g, "").trim(), 16)
          .replace(/^\s*(?:thought|note|memo|remark|備註)\s*[:：-]?\s*/i, "").trim();
      }
      if (!nextNote || isIncompleteContactNote(nextNote)) throw new Error("模型沒有產生完整的玩家聯絡人備註");
      const generatedSuffix = sanitizeText(parsedContact.suffix || "", 8)
        .replace(/^\s*(?:thought|note|memo|remark|稱呼)\s*[:：-]?\s*/i, "").trim();
      const playerContact = {
        suffix: Math.random() < 0.5 && !/[a-z]{3,}/i.test(generatedSuffix) ? generatedSuffix : "",
        note: nextNote,
      };
      setPhoneInboxCache((prev) => ({
        ...prev,
        [char.id]: { ...(prev[char.id] || {}), playerContact, playerContactUpdatedAt: Date.now() },
      }));
      showToast("玩家暱稱與備註已刷新");
    } catch (err) {
      showToast(`${tr("生成失敗", "Generation failed", "生成に失敗しました", "생성 실패")}：${sanitizeText(err?.message || "", 120)}`);
    } finally {
      setPhonePlayerContactLoading(false);
    }
  };

  const generatePhoneApp = async (char, appId) => {
    if (!char || !PHONE_APP_META[appId]) return;
    if (!canUseCurrentProvider()) { showToast(tr("請先完成 AI 連線設定（API Key）", "Please finish AI connection setup first", "先にAI接続設定を完了してください", "먼저 AI 연결 설정을 완료해주세요")); return; }
    setPhoneAppGenLoading(appId);
    try {
      const theme = sanitizePhoneTheme(phoneAppCache[char.id]?.theme?.data);
      const extra = appId === "shop"
        ? { balance: characterWallets[char.id]?.balance }
        : appId === "diary"
          ? { prevTitles: (phoneAppCache[char.id]?.diary?.data?.entries || []).map((e) => e.title) }
          : { mode: theme.mode };
      const ctx = buildPhonePromptContext(char, chatHistory);
      const prompt = [{ role: "user", content: buildPhoneAppPrompt(appId, getOutputLanguageDirective(), ctx, extra) }];
      const raw = await callAI(prompt, apiConfig, "你是手機 App 資料生成器，只能輸出有效 JSON。");
      const data = sanitizePhoneAppData(appId, parseJsonObjectFromText(raw), phoneAppCache[char.id]?.[appId]?.data);
      if (!data) throw new Error(tr("模型未回傳可用資料", "Model returned no usable data", "モデルが有効なデータを返しませんでした", "모델이 사용 가능한 데이터를 반환하지 않았습니다"));
      setPhoneAppCache((prev) => ({
        ...prev,
        [char.id]: { ...(prev[char.id] || {}), [appId]: { updatedAt: Date.now(), data } },
      }));
      if (appId === "shop") syncShopOrdersToWallet(char.id, data.orders);
      if (appId === "diary") setDiaryPage(0);
      showToast(`已更新${PHONE_APP_META[appId].name}`);
    } catch (err) {
      showToast(`${tr("生成失敗", "Generation failed", "生成に失敗しました", "생성 실패")}：${sanitizeText(err?.message || "", 120)}`);
    }
    setPhoneAppGenLoading(null);
  };

  return { generatePhoneNpcChats, refreshPhonePlayerContact, generatePhoneApp };
}

