import React, { useEffect, useId, useRef, useState } from "react";
import { AppHeader } from "../shell/LargeTitle";
import { sanitizeUserImageUrl } from "../../utils/coreUtils";
import { useGacha } from "../../contexts/GachaContext";
import useGachaEpisodeAI from "../../hooks/gacha/useGachaEpisodeAI";
import useAutoResizeTextarea from "../../hooks/chat/useAutoResizeTextarea";
import RealityEpisodeRoom from "./RealityEpisodeRoom";
import SpecialMemorySection from "./SpecialMemoryCard";
import { confirmLocalized } from "../../utils/i18n";
import { splitAssistantBubbles } from "../../utils/chatMessageUtils";
import { withGachaCardArt } from "../../data/gacha/cardArt.js";

function OnlineEpisodeRoom({ episode, character, playerProfile, apiConfig, recentMessages, onBack, tr = (zh) => zh }) {
  const { sendEpisodeMessage, queueEpisodeMessage, commitEpisodeTurn, setEpisodeReplyTiming, appendEpisodeAssistantMessage, setEpisodeOpening, endEpisode } = useGacha();
  const [input, setInput] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const openingStarted = useRef(false);
  const settingsDialogRef = useRef(null);
  const replyTimingSwitchRef = useRef(null);
  const inputRef = useAutoResizeTextarea(input);
  const avatar = sanitizeUserImageUrl(character?.avatar || episode.characterAvatar);
  const { send: sendWithAI, generatePending, finishEarly, prepareOpening, retry, canRetry, isGenerating, streamingText, error, clearError } = useGachaEpisodeAI({
    episode, character, playerProfile, apiConfig, recentMessages,
    sendUserMessage: sendEpisodeMessage,
    appendAssistantMessage: appendEpisodeAssistantMessage,
    setEpisodeOpening,
    commitEpisodeTurn,
    tr,
  });

  const replyTiming = episode.replyTiming === "batch" ? "batch" : "instant";
  const pendingBatchCount = (episode.messages || []).filter((message) => message.role === "user" && message.batchPending === true).length;
  const batchMode = replyTiming === "batch";
  const settingsDialogId = useId();
  const settingsTitleId = useId();
  const settingsScopeId = useId();
  const manualDescriptionId = useId();
  const timingLocked = isGenerating || pendingBatchCount > 0;
  const settingsLabel = tr("設定", "Settings", "設定", "설정");
  const manualReplyLabel = tr("手動生成回應", "Generate replies manually", "返信を手動生成", "답장 수동 생성");
  const timingLockedReason = isGenerating
    ? tr("角色回應生成中，暫時無法切換。", "A reply is being generated, so this setting is temporarily locked.", "返信を生成中のため、一時的に切り替えられません。", "답장을 생성 중이라 잠시 설정을 바꿀 수 없어요.")
    : pendingBatchCount > 0
      ? tr("請先生成目前累積的角色回應。", "Generate the accumulated reply first.", "先にたまったメッセージの返信を生成してください。", "먼저 쌓인 메시지의 답장을 생성해 주세요.")
      : undefined;
  const manualDescription = pendingBatchCount > 0
    ? tr("請先生成目前累積的訊息，才能切換此設定。", "Generate the accumulated messages before changing this setting.", "設定を切り替える前に、たまったメッセージの返信を生成してください。", "이 설정을 바꾸기 전에 쌓인 메시지의 답장을 생성해 주세요.")
    : batchMode
      ? tr("可連續送出多個氣泡，再手動生成角色回應。", "Send several bubbles, then generate the character's reply manually.", "複数の吹き出しを送り、キャラクターの返信を手動で生成できます。", "여러 말풍선을 보낸 뒤 캐릭터의 답장을 직접 생성할 수 있어요.")
      : tr("關閉時，送出訊息後角色會立即回應。", "When off, the character responds immediately after each message.", "オフの場合、メッセージを送るとキャラクターがすぐに返信します。", "끄면 메시지를 보낼 때마다 캐릭터가 바로 답장합니다.");

  useEffect(() => {
    if (episode.openingStatus === "pending" && !openingStarted.current) {
      openingStarted.current = true;
      void prepareOpening();
    }
  }, [episode.openingStatus, prepareOpening]);

  useEffect(() => {
    const dialog = settingsDialogRef.current;
    if (!dialog) return;
    if (settingsOpen && !dialog.open) {
      dialog.showModal();
      window.requestAnimationFrame(() => replyTimingSwitchRef.current?.focus());
    } else if (!settingsOpen && dialog.open) {
      dialog.close();
    }
  }, [settingsOpen]);

  useEffect(() => {
    if (episode.status !== "active") setSettingsOpen(false);
  }, [episode.status]);

  const send = async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    if (batchMode) {
      queueEpisodeMessage(episode.id, text);
      return;
    }
    await sendWithAI(text);
  };
  const endEarly = async () => {
    if (isGenerating || pendingBatchCount > 0) return;
    if (!confirmLocalized(tr("確定要提前結束這段特別篇嗎？\n\n角色會先根據目前劇情做最後的收尾回覆，完成後便無法繼續傳送訊息。", "End this special episode early?\n\nThe character will send one final reply to wrap up the story; after that you can no longer send messages.", "この特別編を早めに終了しますか？\n\nキャラクターが現在の展開に合わせて最後の返信をし、その後はメッセージを送れなくなります。", "이 특별편을 일찍 끝낼까요?\n\n캐릭터가 지금 이야기에 맞춰 마지막 답장을 보내고, 그 후에는 메시지를 보낼 수 없어요."))) return;
    const completed = await finishEarly();
    if (completed) endEpisode(episode.id, true);
  };
  const renderAiRow = (key, content, pending = false) => {
    const bubbles = splitAssistantBubbles(content);
    if (!bubbles.length) bubbles.push(String(content || ""));
    return bubbles.map((bubble, index) => {
      const last = index === bubbles.length - 1;
      return (
        <div key={`${key}-${index}`} className="sg-episode-row sg-episode-row-ai">
          <div className="mp-av sg-episode-avatar" style={last ? undefined : { visibility: "hidden" }}>{avatar ? <img src={avatar} alt="" /> : episode.characterName?.[0]}</div>
          <div className={`sg-episode-bubble sg-episode-bubble-ai ${pending && last ? "pending" : ""}`}>{bubble}</div>
        </div>
      );
    });
  };
  const inputDisabled = episode.status !== "active" || episode.openingStatus === "pending" || isGenerating || episode.playerMessageCount >= 20;
  const placeholder = episode.status !== "active"
    ? tr("這段特別篇已結束", "This special episode has ended", "この特別編は終了しました", "이 특별편은 끝났어요")
    : episode.openingStatus === "pending"
      ? tr("正在準備故事……", "Preparing the story…", "物語を準備中……", "이야기를 준비하는 중……")
      : episode.playerMessageCount >= 20
        ? tr("已達 20 回合，等待劇情結算", "All 20 turns are complete; waiting for the story to conclude", "20ターンに達しました。物語の完結を待っています", "20턴에 도달했습니다. 이야기 마무리를 기다리고 있습니다")
        : isGenerating
          ? tr("等待角色回覆…", "Waiting for the character's reply…", "キャラクターの返信を待っています…", "캐릭터의 답장을 기다리는 중…")
          : batchMode
            ? tr("輸入下一個訊息氣泡…", "Type the next message bubble…", "次の吹き出しを入力…", "다음 말풍선을 입력하세요…")
            : tr("輸入劇情訊息…", "Type a story message…", "ストーリーメッセージを入力…", "스토리 메시지를 입력하세요…");

  // 頁首以卡圖淡化當背景，不用 emoji（避免撞圖、部分裝置無法顯示）；沒有卡圖時只顯示卡名。
  const chapterArt = withGachaCardArt(episode.item)?.artThumbnail || withGachaCardArt(episode.item)?.art || "";

  return (
    <div className="mp-page sg-episode-page" style={{ display: "flex", flexDirection: "column" }}>
      <style>{`.sg-episode-chapter{flex:0 0 auto;text-align:center;padding:4px 18px 13px;border-bottom:1px solid var(--mp-line)}.sg-episode-chapter{position:relative;overflow:hidden}.sg-episode-chapter.has-art{padding-top:9px}.sg-episode-chapter>*{position:relative;z-index:1}.sg-episode-chapter.has-art:before{content:"";position:absolute;inset:0;background:var(--sg-chapter-art) center 35%/cover no-repeat;opacity:.22;filter:blur(1px)}.sg-episode-chapter.has-art:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,color-mix(in srgb,var(--mp-surface) 35%,transparent),color-mix(in srgb,var(--mp-surface) 92%,transparent))}.sg-episode-kicker{font:10px/1.4 var(--mp-font);letter-spacing:.18em;color:color-mix(in srgb,var(--mp-pink-dk) 55%,var(--mp-txt-l))}.sg-episode-chapter h2{margin:5px 0 4px;font:700 17px/1.4 "Noto Serif TC","PMingLiU",serif;color:var(--mp-txt)}.sg-episode-progress{font:10px/1.4 var(--mp-font);color:var(--mp-txt-l)}.sg-episode-rule{display:flex;align-items:center;gap:10px;width:72%;margin:9px auto 0;color:color-mix(in srgb,var(--mp-pink) 55%,transparent)}.sg-episode-rule:before,.sg-episode-rule:after{content:"";height:1px;flex:1;background:currentColor}.sg-episode-timing{display:flex;align-items:center;justify-content:center;gap:5px;padding:7px 10px;border-bottom:1px solid var(--mp-line);background:color-mix(in srgb,var(--mp-surface) 78%,transparent)}.sg-episode-timing button{border:0;border-radius:999px;padding:5px 10px;background:transparent;color:var(--mp-txt-l);font-size:10px;font-weight:800}.sg-episode-timing button.active{background:var(--mp-pink-lt);color:var(--mp-pink-dk)}.sg-episode-timing button:disabled{opacity:.48}.sg-episode-timing span{margin-left:3px;color:var(--mp-txt-l);font-size:10px}.sg-episode-end{min-height:44px;border:1px solid color-mix(in srgb,var(--mp-pink) 45%,transparent);border-radius:12px;background:color-mix(in srgb,var(--mp-pink-lt) 68%,var(--mp-surface));color:var(--mp-pink-dk);padding:7px 10px;font-size:11px;font-weight:800;white-space:nowrap}.sg-episode-end:disabled{opacity:.45}.sg-episode-messages{flex:1;overflow-y:auto;padding:16px 13px 24px;display:flex;flex-direction:column;gap:10px}.sg-episode-system{align-self:center;max-width:88%;padding:7px 11px;border-radius:12px;background:rgba(255,255,255,.42);color:var(--mp-txt-l);font-size:11px;line-height:1.5;text-align:center;white-space:pre-wrap}.sg-episode-narrator{margin:8px auto 14px;max-width:86%;color:var(--mp-txt-l);font-size:12px;line-height:1.85;text-align:center;white-space:pre-wrap}.sg-episode-row{display:flex;width:100%;gap:7px;align-items:flex-end}.sg-episode-row-ai{justify-content:flex-start}.sg-episode-row-user{justify-content:flex-end}.sg-episode-avatar{width:34px!important;height:34px!important;flex:0 0 34px}.sg-episode-bubble{max-width:76%;padding:10px 13px;border-radius:17px;font-size:14px;line-height:1.65;white-space:pre-wrap;word-break:break-word}.sg-episode-bubble-ai{background:var(--mp-surface);color:var(--mp-txt);border-bottom-left-radius:5px;box-shadow:0 4px 13px rgba(60,42,52,.07)}.sg-episode-bubble-user{background:linear-gradient(135deg,var(--mp-bubble),var(--mp-bubble-2));color:#fff;border-bottom-right-radius:5px}.sg-episode-bubble.pending:after{content:"▋";margin-left:2px;color:var(--mp-pink-dk);animation:sgEpisodeCursor .75s step-end infinite}.sg-episode-generate{min-height:42px;border:0;border-radius:14px;padding:0 11px;background:var(--mp-pink-lt);color:var(--mp-pink-dk);font-size:11px;font-weight:900;white-space:nowrap}.sg-episode-generate:disabled{opacity:.42}.sg-episode-retry{align-self:center;min-height:36px;border:1px solid #e3a5b7;border-radius:999px;padding:6px 16px;background:#fff;color:#a84e6c;font-size:12px;font-weight:800}.mp-theme-night .sg-episode-retry{background:#29212d;color:#efaec2;border-color:#553c4b}@keyframes sgEpisodeCursor{50%{opacity:0}}.sg-episode-page{background:linear-gradient(180deg,#fffaf5 0%,#fff4f0 100%);color:#4b3d3c}.sg-episode-page .mp-hdr{background:rgba(255,250,245,.92);border-bottom:0}.sg-episode-page .mp-hdr .mp-htitle{color:#704c58}.sg-episode-page .sg-episode-chapter{border-bottom:0;background:rgba(255,250,245,.92)}.sg-episode-page .sg-episode-chapter.has-art:after{background:linear-gradient(180deg,rgba(255,250,245,.35) 0%,rgba(255,250,245,.85) 72%,#fffaf5 100%)}.sg-episode-page .sg-episode-kicker{color:#b18791}.sg-episode-page .sg-episode-chapter h2{color:#704c58}.sg-episode-page .sg-episode-progress{color:#aa9195}.sg-episode-page .sg-episode-rule{color:#d2aeb8}.sg-episode-page .sg-episode-messages{background:repeating-linear-gradient(180deg,transparent 0 27px,rgba(215,178,188,.16) 27px 28px);background-attachment:local}.sg-episode-page .sg-episode-narrator{color:#a18a8c;font-style:italic}.sg-episode-page .sg-episode-system{background:rgba(255,253,250,.75);color:#a18a8c}.sg-episode-page .sg-episode-bubble-ai{position:relative;background:#fff;color:#4b3d3c;border:1px solid #f0d9de;border-radius:14px;box-shadow:2px 3px 0 rgba(223,145,168,.18)}.sg-episode-page .sg-episode-bubble-ai:before{content:"✦";position:absolute;right:-5px;top:-7px;font-size:10px;line-height:1;color:#df91a8}.sg-episode-page .sg-episode-bubble-user{background:#fcf1f4;color:#a0566e;border:1px solid #f3dbe2;border-radius:16px 4px 16px 16px}.sg-episode-page .sg-episode-compose{background:rgba(255,250,247,.95);border-top:1px dashed rgba(173,125,137,.3)}.sg-episode-page .sg-episode-compose .mp-inp{background:#fffdfb;border-color:#e8cdd2}.mp-theme-night .sg-episode-page{background:#19151d;color:#e8dde2}.mp-theme-night .sg-episode-page .mp-hdr,.mp-theme-night .sg-episode-page .sg-episode-chapter{background:#1d1821}.mp-theme-night .sg-episode-page .mp-hdr .mp-htitle,.mp-theme-night .sg-episode-page .sg-episode-chapter h2{color:#e8dde2}.mp-theme-night .sg-episode-page .sg-episode-chapter.has-art:after{background:linear-gradient(180deg,rgba(29,24,33,.4) 0%,rgba(29,24,33,.88) 72%,#19151d 100%)}.mp-theme-night .sg-episode-page .sg-episode-messages{background:repeating-linear-gradient(180deg,transparent 0 27px,rgba(255,255,255,.04) 27px 28px);background-attachment:local}.mp-theme-night .sg-episode-page .sg-episode-bubble-ai{background:#29212d;color:#eee;border-color:#493747;box-shadow:2px 3px 0 rgba(0,0,0,.25)}.mp-theme-night .sg-episode-page .sg-episode-bubble-user{background:#3a2a35;color:#f2c3d2;border-color:#553c4b}.mp-theme-night .sg-episode-page .sg-episode-system{background:rgba(255,255,255,.06)}.mp-theme-night .sg-episode-page .sg-episode-compose{background:#1d1821}.mp-theme-night .sg-episode-page .sg-episode-compose .mp-inp{background:#29212d;color:#eee;border-color:#493747}`}</style>
      <AppHeader
        title={`${episode.characterName} · ${tr("特別篇", "Special", "特別編", "특별편")}`}
        onBack={onBack}
        backLabel={tr("返回", "Back", "戻る", "뒤로")}
        right={episode.status === "active" ? <div className="sg-episode-header-actions">
          <button
            type="button"
            className="sg-episode-settings-trigger"
            data-state={settingsOpen ? "active" : "default"}
            aria-expanded={settingsOpen}
            aria-controls={settingsDialogId}
            aria-label={tr("開啟特別篇設定", "Open special episode settings", "特別編の設定を開く", "특별편 설정 열기")}
            title={settingsLabel}
            onClick={() => setSettingsOpen(true)}
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M3 5h14M3 10h14M3 15h14" />
              <circle cx="7" cy="5" r="1.8" />
              <circle cx="13" cy="10" r="1.8" />
              <circle cx="8" cy="15" r="1.8" />
            </svg>
            <span>{settingsLabel}</span>
          </button>
          <button className="sg-episode-end" disabled={isGenerating || pendingBatchCount > 0} title={pendingBatchCount > 0 ? tr("請先生成這一回合的角色回覆", "Generate this turn's reply first", "先にこのターンの返信を生成してください", "먼저 이번 턴의 답장을 생성해 주세요") : undefined} onClick={endEarly}>{tr("提前結束", "End early", "早めに終了", "일찍 종료")}</button>
        </div> : null}
      />
      <div className={`sg-episode-chapter ${chapterArt ? "has-art" : ""}`} style={chapterArt ? { "--sg-chapter-art": `url(${JSON.stringify(chapterArt)})` } : undefined}>
        <div className="sg-episode-kicker">SAKURA VOW · {episode.mode === "reality" ? "REALITY" : "ONLINE"}</div>
        <h2>{episode.item.name}</h2>
        <div className="sg-episode-progress">{episode.status === "completed" ? (episode.endedEarly ? tr("已提前結束", "Ended early", "早期終了", "일찍 종료됨") : tr("已完成", "Completed", "完了", "완료")) : `${tr("劇情回合", "Story turn", "ストーリーターン", "스토리 턴")} ${episode.playerMessageCount} / 20`}</div>
        <div className="sg-episode-rule" aria-hidden="true">✦</div>
      </div>
      {episode.status === "active" && <dialog
        ref={settingsDialogRef}
        id={settingsDialogId}
        className="sg-episode-settings-dialog"
        aria-labelledby={settingsTitleId}
        aria-describedby={settingsScopeId}
        onCancel={() => setSettingsOpen(false)}
        onClose={() => setSettingsOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setSettingsOpen(false);
        }}
      >
        <div className="sg-episode-settings-panel">
          <div className="sg-episode-settings-heading">
            <div>
              <h2 id={settingsTitleId}>{tr("特別篇設定", "Special episode settings", "特別編の設定", "특별편 설정")}</h2>
              <p id={settingsScopeId}>{tr("只套用於這段特別篇的線上聊天。", "Applies only to this special episode's online chat.", "この特別編のオンラインチャットにのみ適用されます。", "이 특별편의 온라인 채팅에만 적용돼요.")}</p>
            </div>
            <button
              type="button"
              className="sg-episode-settings-close"
              aria-label={tr("關閉設定", "Close settings", "設定を閉じる", "설정 닫기")}
              onClick={() => setSettingsOpen(false)}
            >×</button>
          </div>
          <div className="mp-manual-reply-setting sg-episode-settings-row">
            <div className="mp-manual-reply-copy">
              <div className="mp-manual-reply-title">{manualReplyLabel}</div>
              <p id={manualDescriptionId}>{manualDescription}</p>
            </div>
            <button
              ref={replyTimingSwitchRef}
              type="button"
              role="switch"
              aria-checked={batchMode}
              aria-describedby={manualDescriptionId}
              aria-label={manualReplyLabel}
              className="mp-manual-reply-switch"
              data-state={isGenerating ? "loading" : "default"}
              disabled={timingLocked}
              title={timingLockedReason}
              onClick={() => setEpisodeReplyTiming(episode.id, batchMode ? "instant" : "batch")}
            >
              <span aria-hidden="true" />
            </button>
          </div>
        </div>
      </dialog>}
      <div className="sg-episode-messages">
        {episode.messages.map((message) => message.role === "narrator"
          ? <div key={message.id} className="sg-episode-narrator">{message.content}</div>
          : message.role === "system"
            ? <div key={message.id} className="sg-episode-system">{message.content}</div>
            : message.role === "assistant"
              ? renderAiRow(message.id, message.content)
              : <div key={message.id} className="sg-episode-row sg-episode-row-user"><div className="sg-episode-bubble sg-episode-bubble-user">{message.content}</div></div>)}
        {episode.openingStatus === "pending" && isGenerating && <div className="sg-episode-narrator">{tr("正在準備故事……", "Preparing the story…", "物語を準備中……", "이야기를 준비하는 중……")}</div>}
        {isGenerating && episode.openingStatus !== "pending" && renderAiRow("streaming", streamingText || tr("正在回覆…", "Replying…", "返信中…", "답장 중…"), true)}
        {episode.status === "completed" && <div className="sg-episode-system">{tr("這段特別篇已結束，對話內容會繼續保留。", "This special episode has ended; the conversation will be kept.", "この特別編は終了しました。会話内容はこのまま保存されます。", "이 특별편은 끝났어요. 대화 내용은 계속 보관됩니다.")}</div>}
        {episode.status === "completed" && <SpecialMemorySection episode={episode} character={character} playerProfile={playerProfile} apiConfig={apiConfig} tr={tr} />}
        {error && <button type="button" onClick={clearError} style={{ alignSelf: "center", border: "1px solid #ef9db8", borderRadius: 12, padding: "8px 12px", background: "#fff2f6", color: "#bd5277" }}>{error}</button>}
        {canRetry && <button type="button" className="sg-episode-retry" onClick={() => void retry()}>{tr("重新生成", "Regenerate", "再生成", "다시 생성")}</button>}
      </div>
      <div className="sg-episode-compose">
        {batchMode && <div className="sg-episode-generate-row">
          <div className="sg-episode-generate-copy" aria-live="polite">
            <span>{tr("手動生成回應", "Manual reply", "手動返信", "수동 답장")}</span>
            <small>{pendingBatchCount > 0
              ? tr(`已累積 ${pendingBatchCount} 則訊息`, `${pendingBatchCount} ${pendingBatchCount === 1 ? "message" : "messages"} ready`, `${pendingBatchCount}件のメッセージを累積中`, `${pendingBatchCount}개 메시지 준비됨`)
              : tr("先送出想說的訊息氣泡", "Send the message bubbles you want first", "先に送りたい吹き出しを送信してください", "먼저 전하고 싶은 말풍선을 보내세요")}</small>
          </div>
          <button
            type="button"
            className="mp-manual-reply-action sg-episode-generate-action"
            data-state={isGenerating ? "loading" : error ? "error" : "default"}
            disabled={isGenerating || pendingBatchCount === 0}
            aria-label={isGenerating
              ? tr("正在生成回應", "Generating reply", "返信を生成中", "답장 생성 중")
              : pendingBatchCount > 0
                ? tr(`生成回應，已累積 ${pendingBatchCount} 則訊息`, `Generate reply for ${pendingBatchCount} ${pendingBatchCount === 1 ? "message" : "messages"}`, `${pendingBatchCount}件のメッセージへの返信を生成`, `${pendingBatchCount}개 메시지의 답장 생성`)
                : tr("生成回應；請先送出訊息氣泡", "Generate reply; send a message bubble first", "返信を生成するには、先に吹き出しを送信してください", "답장을 생성하려면 먼저 말풍선을 보내세요")}
            title={pendingBatchCount === 0 ? tr("請先送出訊息氣泡", "Send a message bubble first", "先に吹き出しを送信してください", "먼저 말풍선을 보내세요") : undefined}
            onClick={generatePending}
          >
            {isGenerating
              ? tr("生成中…", "Generating…", "生成中…", "생성 중…")
              : error
                ? tr("再試一次", "Try again", "もう一度試す", "다시 시도")
                : tr("生成回應", "Generate reply", "返信を生成", "답장 생성")}
            {pendingBatchCount > 0 && <span className="mp-manual-reply-badge" aria-hidden="true">{pendingBatchCount > 99 ? "99+" : pendingBatchCount}</span>}
          </button>
        </div>}
        <div className="sg-episode-compose-row">
          <textarea
            ref={inputRef}
            className="mp-inp"
            rows={1}
            value={input}
            disabled={inputDisabled}
            onChange={(event) => setInput(event.target.value)}
            placeholder={placeholder}
          />
          <button className="sg-episode-send" data-state={isGenerating ? "loading" : error ? "error" : "default"} disabled={inputDisabled || !input.trim()} aria-label={batchMode ? tr("加入訊息氣泡", "Add message bubble", "吹き出しを追加", "말풍선 추가") : tr("送出訊息", "Send message", "メッセージを送信", "메시지 보내기")} onClick={send}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 12h13M13 7l5 5-5 5" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EpisodeRoom(props) {
  return props.episode?.mode === "reality" ? <RealityEpisodeRoom {...props} /> : <OnlineEpisodeRoom {...props} />;
}
