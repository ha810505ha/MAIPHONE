import { applyCoupleInviteReply, applyCoupleTaskChatState, buildCoupleChatContext, extractCoupleDirectives } from "../couple/coupleDailyService";
import { CALENDAR_APPOINTMENT_RULE_CONTEXT, extractCalendarEventDirective } from "../calendar/calendarChatAppointments.js";
import { PHOTO_RULE_CONTEXT, extractPhotoDirectives } from "../../utils/pseudoImage";
import { VOICE_MESSAGE_RULE_CONTEXT, extractPseudoVoiceDirectives } from "../../utils/pseudoVoice";
import { appendAssistantSwipeGroup } from "../../utils/assistantSwipeGroups.js";
import { extractThinking } from "../../utils/chatMessageUtils";

export async function generateDirectAssistant({ cid, roomId, char, nextForDisplay, selectedMode, um, text, includeRealTime = true, swipeTargetId = null, signal }, context) {
  const { formatMessagesForPrompt, pickMemoriesForPrompt, pickLorebookEntriesForPrompt, characterWallets, formatMoney, tr, getPlayerContextBlock, getCalendarContext, getCalendarReminderContext, isCalendarProposalDuplicate, estimateTokens, totalContextTokenLimit, apiConfig, applyUserPlaceholder, buildChatSystemPrompt, callAI, sanitizeText, normalizeRealityReply, realityChatTextLimit, normalizeAssistantReply, extractTransferDirective, extractTransferResponseDirective, stripModeLabel, stripInternalBlocks, splitAssistantBubbles, createId, wait, updateChatMessages, applyCharacterTransferToPlayer, transfers, handleCharacterTransferDecision, characterBlockStates, buildCharacterBlockPromptContext, buildCharacterBlockCapabilityContext, extractCharacterBlockDirective, applyCharacterBlockDirective, isInnerThoughtAutoEnabled, generateInnerThought, getRealityMaxTokens } = context;
      const requestCancelled = () => signal?.aborted === true;
      const now = new Date();
      const nowDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const nowWeekday = new Intl.DateTimeFormat("zh-TW", { weekday: "long" }).format(now);
      const nowTime = new Intl.DateTimeFormat("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
      const nowTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Taipei";
      const nowContext = includeRealTime ? `[系統時間] 目前日期：${nowDate}（${nowWeekday}）；目前時間：${nowTime}；時區：${nowTz}` : "";
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
      const coupleTaskContext = await buildCoupleChatContext(cid);
      const calendarContext = getCalendarContext?.(text || safeHist.at(-1)?.content || "", cid) || "";
      const calendarReminderContext = um?.noticeType === "calendar_story_start" ? "" : (getCalendarReminderContext?.(cid) || "");
      const blockContext = buildCharacterBlockPromptContext?.({ state: characterBlockStates?.[cid], mode: selectedMode, now: Date.now() }) || "";
      const blockCapabilityContext = buildCharacterBlockCapabilityContext?.(selectedMode) || "";
      const pinnedLore = loreHits.filter((x) => x.mode === "PIN");
      const autoLore = loreHits.filter((x) => x.mode !== "PIN");
      const pinnedLoreContext = pinnedLore.map((x, i) => `${i + 1}. [${x.bookName}] ${x.entry.title || "條目"}：${x.entry.content || ""}`).join("\n");
      const autoLoreContext = autoLore.map((x, i) => `- ${i + 1}. [${x.bookName}] ${x.entry.title || "條目"}：${x.entry.content || ""}`).join("\n");
      // 現實模式不提供轉帳功能：不注入轉帳規則、不解析轉帳指令（轉帳屬於線上聊天的手機世界觀）
      const allowTransfer = selectedMode !== "reality";
      const cw = characterWallets[cid];
      const incomingPendingTransfer = allowTransfer ? (transfers || []).find((item) => item.status === "pending" && item.characterId === cid && item.receiverType === "character") : null;
      // 兩層注入：常駐迷你版確保角色隨時能出轉帳卡片；聊到錢才追加完整禮儀規則與交易紀錄
      const moneyTalkRe = /轉帳|轉錢|匯款|還錢|借錢|借我|付錢|買單|請客|紅包|零用錢|薪水|欠|[$＄]|\d\s*元|\d\s*塊/;
      const recentMoneyTalk = allowTransfer && (!!incomingPendingTransfer || [...safeHist.slice(-6).map((m) => m.content || ""), text || ""].some((s) => moneyTalkRe.test(String(s))));
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
            `1. 玩家可以轉帳給角色，角色也可以主動轉帳給玩家；雙方轉帳與回應都要符合角色性格與目前情境，金額需合理，不因迎合而破壞人設。`,
            `2. 收到玩家轉帳時，依角色個性自然回應，不刻意改變平常的聊天語氣。`,
            `3. 只要角色真的有意願且餘額足夠，就直接輸出轉帳指令，不必等玩家要求；轉帳後可自然補充用途或情緒，但不能硬講。`,
            incomingPendingTransfer ? `[待處理轉帳]
玩家先前轉給你 ${formatMoney(incomingPendingTransfer.amount)}${incomingPendingTransfer.note ? `，備註：${incomingPendingTransfer.note}` : ""}。
你必須依角色個性與目前對話決定 accept、return 或 pending，並在回覆最後附上：[[TRANSFER_RESPONSE:id=${incomingPendingTransfer.id};decision=決定]]。
大部分情況應直接收下或退回；只有確實需要詢問或猶豫時才能 pending。
目前已暫不處理 ${Number(incomingPendingTransfer.pendingCount || 0)} 次；若已達 2 次，本輪只能 accept 或 return。` : "",
            cw?.summary ? `錢包摘要：${cw.summary}` : "",
            (cw?.transactions || []).length ? `最近交易：\n${(cw.transactions || []).slice(0, 5).map((t) => `- ${t.type === "income" ? "收入" : "支出"} ${formatMoney(t.amount)}：${t.note}`).join("\n")}` : "",
          ].filter(Boolean).join("\n");
        }
      }
      // 陣列順序＝送進 prompt 的順序；keep 值＝爆 token 時的保留優先度（越低越先被丟）。
      const contextBlocks = [
        { text: getPlayerContextBlock(), keep: 100 },
        { text: nowContext, keep: 90 },
        { text: pinnedLoreContext ? `[強制條目 - 必須遵守]\n以下條目為目前對話的硬性規則，回覆時必須滿足：\n${pinnedLoreContext}` : "", keep: 95 },
        { text: memoryContext, keep: 60 },
        { text: coupleTaskContext, keep: 30 },
        { text: calendarContext, keep: 35 },
        { text: calendarReminderContext, keep: 75 },
        { text: CALENDAR_APPOINTMENT_RULE_CONTEXT, keep: 72 },
        { text: blockContext, keep: 85 },
        { text: blockCapabilityContext, keep: 82 },
        { text: walletContext, keep: 70 },
        { text: transferRuleContext, keep: 10 },
        { text: PHOTO_RULE_CONTEXT, keep: 20 },
        { text: selectedMode === "online" ? VOICE_MESSAGE_RULE_CONTEXT : "", keep: 20 },
        { text: autoLoreContext ? `[世界書]\n${autoLoreContext}` : "", keep: 50 },
      ].filter((b) => b.text);
      const renderContext = (blocks) => blocks.map((b) => b.text).join("\n\n");
      const realityMaxTokens = selectedMode === "reality" ? getRealityMaxTokens?.(cid, roomId) : null;
      const buildCompleteSystemPrompt = (contextText) => applyUserPlaceholder(
        buildChatSystemPrompt(char, contextText, apiConfig.model, selectedMode, realityMaxTokens)
      );
      // 全域 token 硬上限涵蓋完整 system prompt、角色資料、固定規則、額外 context 與歷史。
      // 先裁歷史，再整塊丟棄最不重要的 context 區塊。
      // 不能直接切字串尾巴——那會把排在最後的世界書截成半截殘句送進模型。
      let boundedHist = [...safeHist];
      let keptBlocks = [...contextBlocks];
      const countAllTokens = (contextText = renderContext(keptBlocks)) => (
        estimateTokens(buildCompleteSystemPrompt(contextText)) +
        boundedHist.reduce((sum, m) => sum + estimateTokens(applyUserPlaceholder(m?.content || "")), 0)
      );
      const contextTokenLimit = Math.min(
        totalContextTokenLimit,
        Math.max(10000, Number(apiConfig.contextTokens) || totalContextTokenLimit)
      );
      while (boundedHist.length > 6 && countAllTokens() > contextTokenLimit) {
        boundedHist.shift();
      }
      while (keptBlocks.length > 1 && countAllTokens() > contextTokenLimit) {
        let worstIdx = 0;
        keptBlocks.forEach((b, i) => { if (b.keep < keptBlocks[worstIdx].keep) worstIdx = i; });
        keptBlocks = keptBlocks.filter((_, i) => i !== worstIdx);
      }
      while (boundedHist.length > 1 && countAllTokens() > contextTokenLimit) {
        boundedHist.shift();
      }
      let boundedContext = renderContext(keptBlocks);
      // 最後保險：保留最新訊息，對剩餘 context 做二分裁切，確保最終組裝結果不超標。
      if (countAllTokens() > contextTokenLimit) {
        let low = 0;
        let high = boundedContext.length;
        let best = "";
        while (low <= high) {
          const mid = Math.floor((low + high) / 2);
          const candidate = boundedContext.slice(0, mid);
          if (countAllTokens(candidate) <= contextTokenLimit) {
            best = candidate;
            low = mid + 1;
          } else {
            high = mid - 1;
          }
        }
        boundedContext = best;
      }
      if (countAllTokens(boundedContext) > contextTokenLimit) {
        throw new Error(tr(
          "角色設定與固定提示本身已超過上下文上限，請縮短角色設定後再試。",
          "The character definition and fixed prompts exceed the context limit. Shorten the character definition and try again.",
          "キャラクター設定と固定プロンプトだけでコンテキスト上限を超えています。設定を短くして再試行してください。",
          "캐릭터 설정과 고정 프롬프트만으로 컨텍스트 한도를 초과했어요. 캐릭터 설정을 줄인 뒤 다시 시도해 주세요."
        ));
      }
      const finalHist = boundedHist.map((m) => ({ ...m, content: applyUserPlaceholder(m.content) }));
      const requestApiConfig = realityMaxTokens ? { ...apiConfig, maxTokens: realityMaxTokens } : apiConfig;
      const sysP = buildCompleteSystemPrompt(boundedContext);
      const reply = await callAI(finalHist, requestApiConfig, sysP, {
        signal,
        feature: "chat",
        mode: selectedMode === "reality" ? "reality" : "online",
        app: "chat",
        action: "direct_reply",
      });
      if (requestCancelled()) return;
      // 攔截思考鏈（角色真心話）；顯示路徑照舊會被 stripInternalBlocks 清乾淨，只是這裡先留一份。
      const replyThinking = extractThinking(reply).thinking;
      const blockDirective = extractCharacterBlockDirective?.(reply) || { action: null, text: reply };
      const coupleDirective = extractCoupleDirectives(blockDirective.text);
      const calendarDirective = extractCalendarEventDirective(coupleDirective.text);
      const calendarProposalIsDuplicate = calendarDirective.proposal
        ? await isCalendarProposalDuplicate?.(calendarDirective.proposal, cid)
        : false;
      const cleanReplyRaw = selectedMode === "reality" ? sanitizeText(normalizeRealityReply(calendarDirective.text), realityChatTextLimit) : normalizeAssistantReply(calendarDirective.text);
      const responseExtracted = extractTransferResponseDirective(cleanReplyRaw);
      const extracted = extractTransferDirective(responseExtracted.text);
      // 標記必須在切氣泡前剝除，否則 [[PHOTO:...]] 會原樣顯示在氣泡裡。
      const voiceExtracted = selectedMode === "online"
        ? extractPseudoVoiceDirectives(extracted.text)
        : { text: extracted.text, voices: [] };
      const photoExtracted = extractPhotoDirectives(voiceExtracted.text);
      const cleanReply = stripModeLabel(stripInternalBlocks(photoExtracted.text));
      if (swipeTargetId) {
        const candidateBubbles = cleanReply.trim()
          ? (selectedMode === "reality" ? [cleanReply] : splitAssistantBubbles(cleanReply))
          : [];
        if (!candidateBubbles.length) throw new Error(tr("沒有收到可用的替代回覆", "No usable alternative reply was received", "代替の返信を受け取れませんでした", "사용할 수 있는 대체 답변을 받지 못했어요"));
        const candidateTime = Date.now();
        updateChatMessages(cid, roomId, (messages) => (
          appendAssistantSwipeGroup(messages, swipeTargetId, candidateBubbles, candidateTime, createId)
        ));
        return;
      }
      const pendingTransfer = allowTransfer ? extracted.transfer : null;
      const transferResponse = allowTransfer ? responseExtracted.response : null;
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
        updateChatMessages(cid, roomId, (messages) => (
          messages.map((message) => (message.id === um.id ? { ...message, imageSummary } : message))
        ));
      }
      const bubbles = cleanReply.trim() ? (selectedMode === "reality" ? [cleanReply] : splitAssistantBubbles(cleanReply)) : [];
      const photoMessages = photoExtracted.photos.map((photo) => ({
        id: createId(),
        role: "assistant",
        content: "",
        pseudoImage: photo,
        mode: selectedMode,
        interceptedByBlock: selectedMode === "online" && characterBlockStates?.[cid]?.blocked === true,
        time: Date.now(),
      }));
      const voiceMessages = voiceExtracted.voices.map((pseudoVoice) => ({
        id: createId(),
        role: "assistant",
        content: pseudoVoice.transcript,
        pseudoVoice,
        mode: "online",
        interceptedByBlock: characterBlockStates?.[cid]?.blocked === true,
        time: Date.now(),
      }));
      if (coupleDirective.taskState) void applyCoupleTaskChatState(cid, coupleDirective.taskState);
      const replyGroupId = createId();
      const assistantMessages = bubbles.map((content, index) => ({
        id: createId(),
        replyGroupId,
        replyGroupIndex: index,
        replyGroupSize: bubbles.length,
        role: "assistant",
        content,
        mode: selectedMode,
        interceptedByBlock: selectedMode === "online" && characterBlockStates?.[cid]?.blocked === true,
        time: Date.now(),
        ...(calendarDirective.proposal && !calendarProposalIsDuplicate && index === bubbles.length - 1
          ? { calendarProposal: { ...calendarDirective.proposal, status: "pending" } }
          : {}),
        // 思考鏈掛在整組回覆的第一則氣泡上，只顯示一次。
        ...(index === 0 && replyThinking ? { thinking: { content: replyThinking } } : {}),
      }));
      let lastAssistantMessage = null;
      for (let i = 0; i < bubbles.length; i++) {
        const delay = i === 0 ? 420 : Math.min(1200, 520 + bubbles[i].length * 18);
        await wait(delay);
        if (requestCancelled()) return;
        lastAssistantMessage = { ...assistantMessages[i], time: Date.now() };
        assistantMessages[i] = lastAssistantMessage;
        updateChatMessages(cid, roomId, (messages) => [...messages, lastAssistantMessage]);
      }
      for (const voiceMessage of voiceMessages) {
        await wait(320);
        if (requestCancelled()) return;
        const sent = { ...voiceMessage, time: Date.now() };
        lastAssistantMessage = sent;
        updateChatMessages(cid, roomId, (messages) => [...messages, sent]);
      }
      for (const photoMessage of photoMessages) {
        await wait(320);
        if (requestCancelled()) return;
        const sent = { ...photoMessage, time: Date.now() };
        updateChatMessages(cid, roomId, (messages) => [...messages, sent]);
      }
      if (requestCancelled()) return;
      const inviteResult = await applyCoupleInviteReply(cid, coupleDirective.inviteState);
      if (inviteResult && inviteResult.status !== "pending") {
        const inviteNotice = inviteResult.status === "accepted"
          ? "💞 對方接受了邀請，專屬情侶空間已開通。"
          : inviteResult.status === "declined"
            ? "💞 對方婉拒了這次情侶空間邀請。"
            : "💞 這次情侶空間邀請暫時沒有得到明確回覆。";
        updateChatMessages(cid, roomId, (messages) => [...messages, { id: createId(), role: "system_notice", content: inviteNotice, time: Date.now() }]);
      }
      if (pendingTransfer?.amount > 0 && canApplyPendingTransfer) {
        await wait(220);
        if (requestCancelled()) return;
        applyCharacterTransferToPlayer({
          cid,
          char,
          amount: pendingTransfer.amount,
          note: pendingTransfer.note,
          time: Date.now(),
          appendMessage: (message) => updateChatMessages(cid, roomId, (messages) => [...messages, message]),
        });
      } else if (transferFailureNotice) {
        await wait(220);
        if (requestCancelled()) return;
        updateChatMessages(cid, roomId, (messages) => [...messages, { id: createId(), role: "system_notice", content: transferFailureNotice, time: Date.now() }]);
      }
      if (transferResponse?.transferId && incomingPendingTransfer?.id === transferResponse.transferId) {
        const forcedDecision = Number(incomingPendingTransfer.pendingCount || 0) >= 2 && transferResponse.decision === "pending" ? "return" : transferResponse.decision;
        handleCharacterTransferDecision(incomingPendingTransfer, forcedDecision);
      }
      if (lastAssistantMessage && isInnerThoughtAutoEnabled(cid) && Math.random() < 0.25) {
        const snapshot = [...nextForDisplay, ...assistantMessages];
        void generateInnerThought({
          char,
          messageId: lastAssistantMessage.id,
          source: "auto",
          historySnapshot: snapshot,
          updateMessages: (updater) => updateChatMessages(cid, roomId, updater),
        });
      }
      if (blockDirective.action) applyCharacterBlockDirective?.(cid, blockDirective.action);
}
