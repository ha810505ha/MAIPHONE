import { useRef } from "react";
import { gid, sanitizeText } from "../../utils/coreUtils";
import { callAI } from "../../services/aiService";

export default function useWalletController({
  wallet,
  setWallet,
  chatHistory,
  characterWallets,
  setCharacterWallets,
  characterBlockStates,
  transfers,
  setTransfers,
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
  const transferExpiryMs = 24 * 60 * 60 * 1000;
  const settlingTransferIdsRef = useRef(new Set());
  // 商店 → 錢包同步：先清除舊 shop 明細（餘額加回），再寫入新明細（餘額扣掉）。更新不會重複扣款。
  const syncShopOrdersToWallet = (charId, orders) => {
    setCharacterWallets((prev) => {
      const w = prev[charId];
      if (!w) return prev; // 錢包尚未生成就不寫，等錢包生成後玩家再更新商店即可
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
  const updateTransfer = (transferId, patch) => {
    setTransfers((items) => (items || []).map((item) => item.id === transferId && item.status === "pending"
      ? { ...item, ...patch }
      : item));
  };
  const appendPlayerWalletTx = (type, amount, note, transfer, time = Date.now()) => {
    setWallet((current) => ({
      ...(current || { balance: 0, transactions: [], assets: [] }),
      balance: Math.max(0, Number(current?.balance || 0) + (type === "income" ? amount : -amount)),
      transactions: [{ id: gid(), type, amount, note, time, charId: transfer.characterId, source: "chat_transfer", transferId: transfer.id }, ...(current?.transactions || [])].slice(0, 1000),
    }));
  };
  const appendCharacterWalletTx = (type, amount, note, transfer, time = Date.now()) => {
    setCharacterWallets((current) => {
      const existing = current[transfer.characterId] || { balance: 0, transactions: [], summary: "", generatedAt: Date.now() };
      return {
        ...current,
        [transfer.characterId]: {
          ...existing,
          balance: Math.max(0, Number(existing.balance || 0) + (type === "income" ? amount : -amount)),
          transactions: [{ id: gid(), type, amount, note, time, source: "chat_transfer", transferId: transfer.id }, ...(existing.transactions || [])].slice(0, characterWalletTxLimit),
        },
      };
    });
  };
  const resolveTransfer = (transferOrId, decision, resolutionSource = "manual") => {
    const transfer = typeof transferOrId === "object" ? transferOrId : (transfers || []).find((item) => item.id === transferOrId);
    if (!transfer || transfer.status !== "pending" || !["accepted", "returned", "expired"].includes(decision)) return false;
    if (settlingTransferIdsRef.current.has(transfer.id)) return false;
    settlingTransferIdsRef.current.add(transfer.id);
    const now = Date.now();
    updateTransfer(transfer.id, { status: decision, resolvedAt: now, resolutionSource });
    if (decision === "accepted") {
      if (transfer.receiverType === "player") {
        appendPlayerWalletTx("income", transfer.amount, transfer.note ? stripUserPlaceholder(`收到${transfer.characterName}轉帳｜${transfer.note}`) : `收到${transfer.characterName}轉帳`, transfer, now);
      } else {
        appendCharacterWalletTx("income", transfer.amount, transfer.note ? stripUserPlaceholder(`收到玩家轉帳｜${transfer.note}`) : "收到玩家轉帳", transfer, now);
      }
    } else if (transfer.senderType === "player") {
      appendPlayerWalletTx("income", transfer.amount, decision === "expired" ? `逾期退回｜轉帳給${transfer.characterName}` : `退回｜轉帳給${transfer.characterName}`, transfer, now);
    } else {
      appendCharacterWalletTx("income", transfer.amount, decision === "expired" ? "逾期退回｜轉帳給玩家" : "玩家退回轉帳", transfer, now);
    }
    return true;
  };
  const handleCharacterTransferDecision = (transferOrId, decision) => {
    const transfer = typeof transferOrId === "object" ? transferOrId : (transfers || []).find((item) => item.id === transferOrId);
    if (!transfer || transfer.status !== "pending" || transfer.receiverType !== "character") return false;
    if (decision === "accept") return resolveTransfer(transfer, "accepted", "character");
    if (decision === "return") return resolveTransfer(transfer, "returned", "character");
    if (decision === "pending") {
      const nextCount = Math.min(2, Number(transfer.pendingCount || 0) + 1);
      updateTransfer(transfer.id, { pendingCount: nextCount, lastDecisionAt: Date.now() });
      return true;
    }
    return false;
  };
  const decideIncomingTransferForCharacter = async (transfer, char) => {
    if (!canUseCurrentProvider()) return;
    const recent = (chatHistory?.[char.id] || []).slice(-8).map((message) => {
      if (message.role === "transfer") return `[轉帳] 玩家轉給你 ${formatMoney(message.amount || 0)}${message.note ? `，備註：${message.note}` : ""}`;
      if (message.role === "user") return `玩家：${sanitizeText(message.content || "", 240)}`;
      if (message.role === "assistant") return `${char.name}：${sanitizeText(message.content || "", 240)}`;
      return "";
    }).filter(Boolean).join("\n");
    const prompt = `${getOutputLanguageDirective()}

你是角色「${char.name}」，請依角色設定、與玩家的關係、最近對話、轉帳金額與備註，判斷是否收下玩家的轉帳。
大部分情況應當場選擇 accept 或 return；只有缺少關鍵資訊、確實需要先詢問玩家，或角色當下無法決定時才能選 pending。
decision 只能是 accept、return、pending。reply 是角色對玩家說的自然回覆，可以為空字串。只輸出有效 JSON。

角色描述：${sanitizeText(char.description || char.personality || char.systemPrompt || "（無）", 1200)}
與玩家關係：${sanitizeText(char.relationshipToUser || "（無）", 200)}
目前角色餘額：${formatMoney(characterWallets[char.id]?.balance || 0)}
線上封鎖狀態：${characterBlockStates?.[char.id]?.playerBlocksCharacter || characterBlockStates?.[char.id]?.blocked ? "玩家目前已封鎖你的線上聯絡方式；你知道自己被封鎖，回覆仍會被攔截且無法確認送達。" : "玩家沒有封鎖你"}${characterBlockStates?.[char.id]?.characterBlocksPlayer ? "；你目前也封鎖了玩家，但仍能看到這筆轉帳與玩家訊息。" : ""}
玩家轉帳：${formatMoney(transfer.amount)}
備註：${transfer.note || "（無）"}
最近對話：
${recent || "（無）"}

格式：{"decision":"accept","reply":"謝謝，那我就收下了。"}`;
    try {
      const raw = await callAI([{ role: "user", content: prompt }], apiConfig, "你是角色轉帳處理器，只能輸出有效 JSON。");
      const match = String(raw || "").match(/\{[\s\S]*\}/);
      if (!match) return;
      const parsed = JSON.parse(match[0]);
      const decision = ["accept", "return", "pending"].includes(parsed.decision) ? parsed.decision : "return";
      handleCharacterTransferDecision(transfer, decision);
      const reply = sanitizeText(parsed.reply || "", 800).trim();
      if (reply) setChatHistory((history) => ({ ...history, [char.id]: [...(history[char.id] || []), { id: gid(), role: "assistant", content: reply, mode: "online", interceptedByBlock: characterBlockStates?.[char.id]?.playerBlocksCharacter === true || characterBlockStates?.[char.id]?.blocked === true, time: Date.now() }] }));
    } catch (error) {
      showToast(`${tr("角色暫時無法處理轉帳", "The character cannot process the transfer right now", "キャラクターは現在送金を処理できません", "캐릭터가 지금 이체를 처리할 수 없습니다")}：${sanitizeText(error?.message || "", 100)}`);
    }
  };
  const transferToCurrentChar = async () => {
    if (!currentChatChar || transferSubmitting) return;
    const amount = Math.max(0, Math.round(Number(transferAmount) || 0));
    if (!amount) { showToast(tr("請輸入轉帳金額", "Please enter a transfer amount", "振込金額を入力してください", "송금 금액을 입력해주세요")); return; }
    const currentBalance = Number(wallet?.balance || 0);
    if (currentBalance < amount) { showToast(tr("餘額不足", "Insufficient balance", "残高不足", "잔액 부족")); return; }
    const cid = currentChatChar.id;
    const note = sanitizeText(transferNote, 60);
    const now = Date.now();
    const transferId = gid();
    const transferMsg = {
      id: gid(),
      role: "transfer",
      transferId,
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
    const transfer = {
      id: transferId, messageId: transferMsg.id, characterId: cid, characterName: currentChatChar.name,
      senderType: "player", receiverType: "character", amount, note, status: "pending",
      pendingCount: 0, createdAt: now, expiresAt: now + transferExpiryMs, resolvedAt: null,
    };
    setTransferSubmitting(true);
    try {
      appendPlayerWalletTx("expense", amount, note ? stripUserPlaceholder(`轉帳給${currentChatChar.name}（待收下）｜${note}`) : `轉帳給${currentChatChar.name}（待收下）`, transfer, now);
      setTransfers((items) => [transfer, ...(items || [])]);
      setChatHistory((h) => ({ ...h, [cid]: [...(h[cid] || []), transferMsg] }));
      setTransferAmount("");
      setTransferNote("");
      setTransferModalOpen(false);
      showToast(tr("轉帳已送出，等待對方處理", "Transfer sent and awaiting a response", "送金しました。相手の処理を待っています", "이체를 보냈으며 상대방의 처리를 기다리는 중입니다"));
      await decideIncomingTransferForCharacter(transfer, currentChatChar);
    } finally {
      setTransferSubmitting(false);
    }
  };
  const applyCharacterTransferToPlayer = ({ cid, char, amount, note, time, displayAtEnd = true }) => {
    const safeAmount = Math.max(0, Math.round(Number(amount) || 0));
    if (!cid || !char || !safeAmount) return null;
    const safeNote = sanitizeText(note || "", 60);
    const now = Number(time) || Date.now();
    const transferId = gid();
    const transferMsg = {
      id: gid(),
      role: "transfer",
      transferId,
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
    const transfer = {
      id: transferId, messageId: transferMsg.id, characterId: cid, characterName: char.name || "角色",
      senderType: "character", receiverType: "player", amount: safeAmount, note: safeNote, status: "pending",
      pendingCount: 0, createdAt: now, expiresAt: now + transferExpiryMs, resolvedAt: null,
    };
    appendCharacterWalletTx("expense", safeAmount, safeNote ? stripUserPlaceholder(`轉帳給玩家（待收下）｜${safeNote}`) : "轉帳給玩家（待收下）", transfer, now);
    setTransfers((items) => [transfer, ...(items || [])]);
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
    if (mode === "refresh" && (transfers || []).some((item) => item.status === "pending" && item.characterId === char.id)) {
      showToast(tr("此角色目前有尚未完成的轉帳，暫時不能更新錢包", "This character has a pending transfer, so the wallet cannot be refreshed yet", "このキャラクターには未処理の送金があるため、ウォレットを更新できません", "이 캐릭터에게 처리되지 않은 이체가 있어 지갑을 새로고침할 수 없습니다"));
      return;
    }
    if (!canUseCurrentProvider()) { showToast(tr("請先完成 AI 連線設定（API Key）", "Please finish AI connection setup (API key) first", "先にAI接続設定（APIキー）を完了してください", "먼저 AI 연결 설정(API 키)을 완료해주세요")); return; }
    setWalletGenLoading(true);
    try {
      const currentWallet = characterWallets[char.id] || null;
      const walletProfile = currentWallet?.walletProfile || currentWallet?.summary || "";
      const refreshHistory = buildWalletRefreshHistory(currentWallet);
      const isRefresh = mode === "refresh";
      const refreshRequestedAt = Date.now();
      const refreshFrom = Number(currentWallet?.refreshedAt || currentWallet?.generatedAt || refreshRequestedAt);
      const currentWalletBalance = Math.max(0, Math.round(Number(currentWallet?.balance) || 0));
      const refreshElapsedDays = Math.max(0, (refreshRequestedAt - refreshFrom) / 86400000);
      const refreshTransactionLimit = refreshElapsedDays <= 2 ? 3
        : refreshElapsedDays <= 7 ? 5
          : refreshElapsedDays <= 31 ? 8
            : 10;
      const refreshTransactionRange = refreshElapsedDays <= 2 ? "0~3"
        : refreshElapsedDays <= 7 ? "1~5"
          : refreshElapsedDays <= 31 ? "2~8"
            : "3~10";
      const roleProfile = isRefresh ? "" : buildWalletRoleProfile(char);
      const walletPrompt = isRefresh
        ? `請根據角色的錢包摘要，補充角色「${char.name}」自上次更新至今可能發生、但尚未記錄的生活收支，只輸出有效 JSON。
規則：
1) 本次補完區間約 ${refreshElapsedDays.toFixed(1)} 天，請依期間長短生成 ${refreshTransactionRange} 筆 transactions；短期間沒有合理事件時可回傳空陣列。
2) 不要生成轉帳事件，轉帳已由聊天室事件另外處理。
3) 不要生成商店訂單；商店與玩家、角色間的轉帳都由程式直接記帳。
4) 不要重做整個錢包、不要回傳 balance，也不要清空、複製或改寫既有交易；只回傳這次要補上的增量流水。
5) 不要改寫 summary 或 walletProfile。
6) 流水筆數只是顯示上限，收入與支出金額必須涵蓋完整補完期間，不能只生成幾筆單日金額而讓長期間的收入或生活費被低估。
7) 長期間內重複發生的同類項目請合併成彙總流水，例如「本月薪資」「本月餐飲與交通」「近三月生活支出」；固定薪資、房租與其他週期性收支應依實際跨過的週期合理計算。
8) 彙總後的所有 transactions 加總必須就是本次完整期間要套用的實際增量，不要另外留下未顯示、未計入的隱藏金額。
9) 目前可用餘額是 ${currentWalletBalance}；支出總額必須能由目前餘額加上這段期間較早發生的合理收入支撐。錢不夠時請縮小支出，不要為了補足餘額憑空生成收入。
10) 每筆 time 必須介於 ${refreshFrom} 與 ${refreshRequestedAt} 之間，並使用毫秒 timestamp；彙總流水可使用該期間末端或實際結算日。
格式：
{"transactions":[{"type":"income","amount":300,"note":"午班收入","time":1710000000000}]}

補流水期間：${new Date(refreshFrom).toISOString()} ～ ${new Date(refreshRequestedAt).toISOString()}
目前可用餘額：${currentWalletBalance}

錢包摘要：
${walletProfile || "（無）"}

最近流水摘要：
${refreshHistory || "（無）"}

角色設定補充：已由 walletProfile 取代，更新時不要重新閱讀完整角色設定。`
        : `請根據角色設定，生成角色「${char.name}」自己的錢包狀態與錢包摘要，只輸出有效 JSON。
規則：
1) balance 是合理餘額，整數，不要太誇張。
2) transactions 產生 8~12 筆，包含 income/expense，金額與備註要貼近角色職業、生活、興趣、作息、社交圈。
3) 收入/支出要明顯符合角色身分，不要出現與角色設定衝突的來源或消費。例：學生不要有高薪月薪；居家型角色不要頻繁高額外出消費；上班族收入可來自薪資/兼職/獎金，但不要莫名其妙像企業老闆。
4) 若角色是醫生，收入/支出可部分和醫療、值班、書籍、交通有關，但不能全部都醫療；也要有飲食、娛樂、興趣、人際等生活花費。
5) 不要提到 {{user}}，這是角色自己的錢包。
6) 另外產生一份只用於錢包的 summary，並同步產生 walletProfile。walletProfile 只保留職業、收入來源、消費習慣、生活風格、財務風格等財務相關資訊，不要包含對 {{user}} 的態度、性行為、曖昧互動或私密感情。
7) walletProfile 會用於之後的錢包更新，請寫得簡短、穩定、方便長期重複使用。
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
        if (isRefresh) {
          // 目前餘額已經包含舊明細與聊天室轉帳；更新只能套用 AI 本次補出的增量，
          // 不可再次重播舊明細，否則每次更新都會重複加減歷史交易。
          const incremental = reconcileWalletLedger(current.balance || 0, (next.transactions || []).slice(0, refreshTransactionLimit), refreshTransactionLimit);
          return {
            ...prev,
            [char.id]: {
              ...current,
              balance: incremental.balance,
              transactions: [...incremental.transactions, ...(current.transactions || [])].slice(0, characterWalletTxLimit),
              refreshedAt,
              lastRefreshedSlot,
            },
          };
        }
        const orderedTransactions = [...(next.transactions || [])].sort((a, b) => Number(a?.time || 0) - Number(b?.time || 0));
        const reconciled = reconcileWalletLedger(Number(parsed.balance) || 0, orderedTransactions, characterWalletTxLimit);
        return {
          ...prev,
          [char.id]: {
            ...current,
            ...next,
            summary: next.summary || current.summary || "",
            walletProfile: next.walletProfile || next.summary || current.walletProfile || current.summary || "",
            balance: reconciled.balance,
            transactions: reconciled.transactions,
            refreshedAt,
            lastRefreshedSlot,
          },
        };
      });
      showToast(`${char.name} 的錢包已更新`);
    } catch (err) {
      showToast(`${tr("角色錢包生成失敗", "Character wallet generation failed", "キャラのウォレット生成に失敗しました", "캐릭터 지갑 생성에 실패했습니다")}：${sanitizeText(err?.message || tr("未知錯誤", "Unknown error", "不明なエラー", "알 수 없는 오류"), 120)}`);
    }
    setWalletGenLoading(false);
  };
  const regenerateCharacterWallet = async (char) => {
    if (!char) return;
    if ((transfers || []).some((item) => item.status === "pending" && item.characterId === char.id)) {
      showToast(tr("此角色目前有尚未完成的轉帳，暫時不能重新生成錢包", "This character has a pending transfer, so the wallet cannot be regenerated yet", "このキャラクターには未処理の送金があるため、ウォレットを再生成できません", "이 캐릭터에게 처리되지 않은 이체가 있어 지갑을 다시 생성할 수 없습니다"));
      return;
    }
    const ok = window.confirm(tr("重新生成會清空舊的錢包資料，並重新讀取角色設定建立新錢包，確定要繼續嗎？", "Regenerating will clear the old wallet data and rebuild a new wallet from the character settings. Continue?", "再生成すると古いウォレットデータが消去され、キャラ設定を読み直して新しいウォレットが作成されます。続けますか？", "다시 생성하면 기존 지갑 데이터가 지워지고 캐릭터 설정을 다시 읽어 새 지갑이 만들어집니다. 계속할까요?"));
    if (!ok) return;
    setCharacterWallets((prev) => ({ ...prev, [char.id]: { balance: 0, transactions: [], summary: "", generatedAt: Date.now() } }));
    await generateCharacterWallet(char, { mode: "initial" });
  };
  const clearWalletData = () => {
    if ((transfers || []).some((item) => item.status === "pending")) {
      showToast(tr("目前有尚未完成的轉帳，暫時不能清除錢包資料", "Pending transfers must be resolved before wallet data can be cleared", "未処理の送金があるため、ウォレットデータを削除できません", "처리되지 않은 이체가 있어 지갑 데이터를 지울 수 없습니다"));
      return;
    }
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
    resolveTransfer,
    handleCharacterTransferDecision,
    generateCharacterWallet,
    regenerateCharacterWallet,
    clearWalletData,
  };
}
