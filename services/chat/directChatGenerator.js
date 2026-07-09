export async function generateDirectAssistant({ cid, char, nextForDisplay, selectedMode, um, text }, context) {
  const { formatMessagesForPrompt, pickMemoriesForPrompt, pickLorebookEntriesForPrompt, characterWallets, formatMoney, tr, getPlayerContextBlock, estimateTokens, totalContextTokenLimit, apiConfig, applyUserPlaceholder, buildChatSystemPrompt, callAI, sanitizeText, normalizeRealityReply, realityChatTextLimit, normalizeAssistantReply, extractTransferDirective, stripModeLabel, stripInternalBlocks, splitAssistantBubbles, createId, wait, setChatHistory, applyCharacterTransferToPlayer, isInnerThoughtAutoEnabled, generateInnerThought } = context;
      const now = new Date();
      const nowDate = new Intl.DateTimeFormat("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
      const nowTime = new Intl.DateTimeFormat("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
      const nowTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Taipei";
      const nowContext = `[系統時間] 目前時間：${nowDate} ${nowTime} (${nowTz})`;
      const hist = formatMessagesForPrompt(nextForDisplay.slice(-30)).slice(-20);
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
      // 現實模式不提供轉帳功能：不注入轉帳規則、不解析轉帳指令（轉帳屬於線上聊天的手機世界觀）
      const allowTransfer = selectedMode !== "reality";
      const cw = characterWallets[cid];
      // 兩層注入：常駐迷你版確保角色隨時能出轉帳卡片；聊到錢才追加完整禮儀規則與交易紀錄
      const moneyTalkRe = /轉帳|轉錢|匯款|還錢|借錢|借我|付錢|買單|請客|紅包|零用錢|薪水|欠|[$＄]|\d\s*元|\d\s*塊/;
      const recentMoneyTalk = allowTransfer && [...safeHist.slice(-6).map((m) => m.content || ""), text || ""].some((s) => moneyTalkRe.test(String(s)));
      let walletContext = "";
      let transferRuleContext = "";
      if (!allowTransfer) {
        walletContext = cw ? [
          `[角色錢包]`,
          `目前餘額：${formatMoney(cw.balance || 0)}`,
          cw.summary ? `摘要：${cw.summary}` : "",
          `規則：錢包資料只能作為角色生活背景，不要把錢包資料當成每輪都要提及的內容。目前不提供轉帳功能，不要輸出任何轉帳指令。`,
        ].filter(Boolean).join("\n") : "";
      } else {
        walletContext = [
          `[角色錢包] 目前餘額：${formatMoney(Math.max(0, Number(cw?.balance || 0)))}`,
          `若情境自然、符合角色性格且你（{{char}}）真的決定轉帳給 {{user}}，就在回覆最後附上一個轉帳指令：[[TRANSFER:amount=金額;note=備註]]（note 可省略）。`,
          `餘額不足時不得宣稱轉帳成功，改為自然拒絕、延期或改轉較小金額。錢包資料只作為生活背景，不要每輪主動提及。`,
        ].join("\n");
        if (recentMoneyTalk) {
          transferRuleContext = [
            `[轉帳規則]`,
            `1. 玩家可以轉帳給角色，角色也可以主動轉帳給玩家；雙方轉帳與回應都要符合角色性格與當前情境，金額需合理，不因迎合而破壞人設。`,
            `2. 收到玩家轉帳時，依角色個性自然回應，不刻意改變平常的聊天語氣。`,
            `3. 只要角色真的有意願且餘額足夠，就直接輸出轉帳指令，不必等玩家要求；轉帳後可自然補充用途或情緒，但不能硬講。`,
            cw?.summary ? `錢包摘要：${cw.summary}` : "",
            (cw?.transactions || []).length ? `最近交易：\n${(cw.transactions || []).slice(0, 5).map((t) => `- ${t.type === "income" ? "收入" : "支出"} ${formatMoney(t.amount)}：${t.note}`).join("\n")}` : "",
          ].filter(Boolean).join("\n");
        }
      }
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
      const contextTokenLimit = Math.min(
        totalContextTokenLimit,
        Math.max(10000, Number(apiConfig.contextTokens) || totalContextTokenLimit)
      );
      while (boundedHist.length > 6 && countAllTokens() > contextTokenLimit) {
        boundedHist.shift();
      }
      if (countAllTokens() > contextTokenLimit) {
        const overflow = countAllTokens() - contextTokenLimit;
        const trimChars = Math.max(0, Math.ceil(overflow * 3.5));
        if (trimChars > 0 && boundedContext.length > trimChars) {
          boundedContext = boundedContext.slice(0, boundedContext.length - trimChars);
        }
      }
      const finalHist = boundedHist.map((m) => ({ ...m, content: applyUserPlaceholder(m.content) }));
      const sysP = applyUserPlaceholder(buildChatSystemPrompt(char, boundedContext, apiConfig.model, selectedMode));
      const reply = await callAI(finalHist, apiConfig, sysP);
      const cleanReplyRaw = selectedMode === "reality" ? sanitizeText(normalizeRealityReply(reply), realityChatTextLimit) : normalizeAssistantReply(reply);
      const extracted = extractTransferDirective(cleanReplyRaw);
      const cleanReply = stripModeLabel(stripInternalBlocks(extracted.text));
      const pendingTransfer = allowTransfer ? extracted.transfer : null;
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
      const replyGroupId = createId();
      const assistantMessages = bubbles.map((content, index) => ({
        id: createId(),
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
        setChatHistory((h) => ({ ...h, [cid]: [...(h[cid] || []), { id: createId(), role: "system_notice", content: transferFailureNotice, time: Date.now() }] }));
      }
      if (lastAssistantMessage && isInnerThoughtAutoEnabled(cid) && Math.random() < 0.25) {
        const snapshot = [...nextForDisplay, ...assistantMessages];
        void generateInnerThought({ char, messageId: lastAssistantMessage.id, source: "auto", historySnapshot: snapshot });
      }
}
