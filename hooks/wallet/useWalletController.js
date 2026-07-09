import { gid, sanitizeText } from "../../utils/coreUtils";
import { callAI } from "../../services/aiService";

export default function useWalletController({
  wallet,
  setWallet,
  characterWallets,
  setCharacterWallets,
  currentChatChar,
  transferSubmitting,
  transferAmount,
  transferNote,
  setTransferSubmitting,
  setTransferAmount,
  setTransferNote,
  setTransferModalOpen,
  setChatHistory,
  setWalletGenLoading,
  setWalletSettingsPage,
  setWalletSettingsOpen,
  defaultWallet,
  characterWalletTxLimit,
  apiConfig,
  canUseCurrentProvider,
  showToast,
  tr,
  getPlayerDisplayName,
  formatMoney,
  stripUserPlaceholder,
  getOutputLanguageDirective,
  getWalletTimeSlot,
}) {
  // 商店 → 錢包同步：先清舊 shop 流水（餘額加回），再寫新流水（餘額扣掉）。刷新不會重複扣款。
  const syncShopOrdersToWallet = (charId, orders) => {
    setCharacterWallets((prev) => {
      const w = prev[charId];
      if (!w) return prev; // 錢包尚未生成就不寫，等錢包生成後玩家再刷新商店即可
      const oldTx = Array.isArray(w.transactions) ? w.transactions : [];
      const oldShopTotal = oldTx.filter((t) => t.source === "shop").reduce((s, t) => s + (+t.amount || 0), 0);
      const kept = oldTx.filter((t) => t.source !== "shop");
      const newTx = orders.map((o, i) => ({
        id: gid(), type: "expense", source: "shop",
        amount: o.price, note: `${o.emoji} ${o.item}`,
        time: Date.now() - i * 3600000,
      }));
      const newTotal = newTx.reduce((s, t) => s + t.amount, 0);
      return { ...prev, [charId]: {
        ...w,
        balance: Math.max(0, (+w.balance || 0) + oldShopTotal - newTotal),
        transactions: [...newTx, ...kept],
      } };
    });
  };

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
        source: "manual",
      };
      return { ...prev, balance: nextBalance, transactions: [tx, ...(prev.transactions || [])].slice(0, 1000) };
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
          charId: cid,
          source: "chat",
        }, ...(w?.transactions || [])].slice(0, 1000),
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
            }, ...(cw.transactions || [])].slice(0, characterWalletTxLimit),
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
        charId: cid,
        source: "chat",
      }, ...(w?.transactions || [])].slice(0, 1000),
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
          }, ...(cw.transactions || [])].slice(0, characterWalletTxLimit),
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
      transactions: txs.slice(0, characterWalletTxLimit).map((t) => ({
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
  const reconcileWalletLedger = (openingBalance, transactions, limit = characterWalletTxLimit) => {
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
          ? [...(next.transactions || []), ...(current.transactions || [])].slice(0, characterWalletTxLimit)
          : (next.transactions || []).slice(0, characterWalletTxLimit);
        const orderedTransactions = [...mergedTransactions].sort((a, b) => Number(a?.time || 0) - Number(b?.time || 0));
        const openingBalance = isRefresh ? (current.balance || 0) : (Number(parsed.balance) || 0);
        const reconciled = reconcileWalletLedger(openingBalance, orderedTransactions, characterWalletTxLimit);
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
  const clearWalletData = () => {
    if (!window.confirm(tr("確定要清除錢包頁面的資料嗎？", "Clear the wallet page data?", "ウォレットページのデータを消去しますか？", "지갑 페이지 데이터를 지울까요?"))) return;
    if (!window.confirm(tr("請再次確認：這只會清除錢包頁面內容，不會影響聊天室，確定要繼續嗎？", "Please confirm again: this only clears the wallet page content and won't affect chats. Continue?", "再確認してください。これはウォレットページの内容のみを消去し、チャットには影響しません。続けますか？", "다시 확인해주세요. 이것은 지갑 페이지만 지우며 채팅에는 영향을 주지 않습니다. 계속할까요?"))) return;
    setWallet(defaultWallet); setCharacterWallets({}); setWalletSettingsPage("main"); setWalletSettingsOpen(false);
    showToast(tr("錢包資料已清除", "Wallet data cleared", "ウォレットデータを消去しました", "지갑 데이터를 지웠습니다"));
  };

  return {
    syncShopOrdersToWallet,
    addWalletTransaction,
    addWalletAsset,
    transferToCurrentChar,
    applyCharacterTransferToPlayer,
    generateCharacterWallet,
    regenerateCharacterWallet,
    clearWalletData,
  };
}
