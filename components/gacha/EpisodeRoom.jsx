import React, { useEffect, useRef, useState } from "react";
import { sanitizeUserImageUrl } from "../../utils/coreUtils";
import { useGacha } from "../../contexts/GachaContext";
import useGachaEpisodeAI from "../../hooks/gacha/useGachaEpisodeAI";
import useAutoResizeTextarea from "../../hooks/chat/useAutoResizeTextarea";
import RealityEpisodeRoom from "./RealityEpisodeRoom";
import SpecialMemorySection from "./SpecialMemoryCard";
import { confirmLocalized } from "../../utils/i18n";

function OnlineEpisodeRoom({ episode, character, playerProfile, apiConfig, recentMessages, onBack }) {
  const { sendEpisodeMessage, appendEpisodeAssistantMessage, setEpisodeOpening, endEpisode } = useGacha();
  const [input, setInput] = useState("");
  const openingStarted = useRef(false);
  const inputRef = useAutoResizeTextarea(input);
  const avatar = sanitizeUserImageUrl(character?.avatar || episode.characterAvatar);
  const { send: sendWithAI, finishEarly, prepareOpening, isGenerating, streamingText, error, clearError } = useGachaEpisodeAI({
    episode, character, playerProfile, apiConfig, recentMessages,
    sendUserMessage: sendEpisodeMessage,
    appendAssistantMessage: appendEpisodeAssistantMessage,
    setEpisodeOpening,
  });

  useEffect(() => {
    if (episode.openingStatus === "pending" && !openingStarted.current) {
      openingStarted.current = true;
      void prepareOpening();
    }
  }, [episode.openingStatus, prepareOpening]);

  const send = async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    await sendWithAI(text);
  };
  const endEarly = async () => {
    if (isGenerating) return;
    if (!confirmLocalized("確定要提前結束這段特別篇嗎？\n\n角色會先根據目前劇情做最後的收尾回覆，完成後便無法繼續傳送訊息。")) return;
    const completed = await finishEarly();
    if (completed) endEpisode(episode.id, true);
  };
  const renderAiRow = (key, content, pending = false) => (
    <div key={key} className="sg-episode-row sg-episode-row-ai">
      <div className="mp-av sg-episode-avatar">{avatar ? <img src={avatar} alt="" /> : episode.characterName?.[0]}</div>
      <div className={`sg-episode-bubble sg-episode-bubble-ai ${pending ? "pending" : ""}`}>{content}</div>
    </div>
  );
  const inputDisabled = episode.status !== "active" || episode.openingStatus === "pending" || isGenerating || episode.playerMessageCount >= 20;
  const placeholder = episode.status !== "active"
    ? "這段特別篇已結束"
    : episode.openingStatus === "pending"
      ? "正在準備故事……"
      : episode.playerMessageCount >= 20
        ? "已達 20 則訊息，等待劇情結算"
        : isGenerating ? "等待角色回覆…" : "輸入劇情訊息…";

  return (
    <div className="mp-page sg-episode-page" style={{ display: "flex", flexDirection: "column" }}>
      <style>{`.sg-episode-meta{padding:9px 14px;text-align:center;font-size:11px;color:var(--mp-txt-l);border-bottom:1px solid var(--mp-line)}.sg-episode-end{margin-left:auto;border:1px solid color-mix(in srgb,var(--mp-pink) 45%,transparent);border-radius:12px;background:#fff4f7;color:var(--mp-pink-dk);padding:7px 10px;font-size:11px;font-weight:800}.sg-episode-end:disabled{opacity:.45}.sg-episode-messages{flex:1;overflow-y:auto;padding:16px 13px 24px;display:flex;flex-direction:column;gap:10px}.sg-episode-system{align-self:center;max-width:88%;padding:7px 11px;border-radius:12px;background:rgba(255,255,255,.42);color:var(--mp-txt-l);font-size:11px;line-height:1.5;text-align:center;white-space:pre-wrap}.sg-episode-narrator{margin:8px auto 14px;max-width:86%;color:var(--mp-txt-l);font-size:12px;line-height:1.85;text-align:center;white-space:pre-wrap}.sg-episode-row{display:flex;width:100%;gap:7px;align-items:flex-end}.sg-episode-row-ai{justify-content:flex-start}.sg-episode-row-user{justify-content:flex-end}.sg-episode-avatar{width:34px!important;height:34px!important;flex:0 0 34px}.sg-episode-bubble{max-width:76%;padding:10px 13px;border-radius:17px;font-size:14px;line-height:1.65;white-space:pre-wrap;word-break:break-word}.sg-episode-bubble-ai{background:var(--mp-surface);color:var(--mp-txt);border-bottom-left-radius:5px;box-shadow:0 4px 13px rgba(60,42,52,.07)}.sg-episode-bubble-user{background:linear-gradient(135deg,var(--mp-bubble),var(--mp-bubble-2));color:#fff;border-bottom-right-radius:5px}.sg-episode-bubble.pending:after{content:"▋";margin-left:2px;color:var(--mp-pink-dk);animation:sgEpisodeCursor .75s step-end infinite}@keyframes sgEpisodeCursor{50%{opacity:0}}`}</style>
      <div className="mp-hdr">
        <div className="mp-back" onClick={onBack}>←</div>
        <div className="mp-htitle">{episode.characterName} · 特別篇</div>
        {episode.status === "active" && <button className="sg-episode-end" disabled={isGenerating} onClick={endEarly}>提前結束</button>}
      </div>
      <div className="sg-episode-meta">
        {episode.item.icon} {episode.item.name} · {episode.mode === "reality" ? "現實" : "線上"} · {episode.status === "completed" ? (episode.endedEarly ? "已提前結束" : "已完成") : `玩家訊息 ${episode.playerMessageCount}/20`}
      </div>
      <div className="sg-episode-messages">
        {episode.messages.map((message) => message.role === "narrator"
          ? <div key={message.id} className="sg-episode-narrator">{message.content}</div>
          : message.role === "system"
            ? <div key={message.id} className="sg-episode-system">{message.content}</div>
            : message.role === "assistant"
              ? renderAiRow(message.id, message.content)
              : <div key={message.id} className="sg-episode-row sg-episode-row-user"><div className="sg-episode-bubble sg-episode-bubble-user">{message.content}</div></div>)}
        {episode.openingStatus === "pending" && isGenerating && <div className="sg-episode-narrator">正在準備故事……</div>}
        {isGenerating && episode.openingStatus !== "pending" && renderAiRow("streaming", streamingText || "正在回覆…", true)}
        {episode.status === "completed" && <div className="sg-episode-system">這段特別篇已結束，對話內容會繼續保留。</div>}
        {episode.status === "completed" && <SpecialMemorySection episode={episode} character={character} playerProfile={playerProfile} apiConfig={apiConfig} />}
        {error && <button type="button" onClick={clearError} style={{ alignSelf: "center", border: "1px solid #ef9db8", borderRadius: 12, padding: "8px 12px", background: "#fff2f6", color: "#bd5277" }}>{error}</button>}
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, padding: 10, borderTop: "1px solid var(--mp-line)" }}>
        <textarea
          ref={inputRef}
          className="mp-inp"
          rows={1}
          value={input}
          disabled={inputDisabled}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              void send();
            }
          }}
          placeholder={placeholder}
        />
        <button className="mp-send" disabled={inputDisabled || !input.trim()} onClick={send}>➤</button>
      </div>
    </div>
  );
}

export default function EpisodeRoom(props) {
  return props.episode?.mode === "reality" ? <RealityEpisodeRoom {...props} /> : <OnlineEpisodeRoom {...props} />;
}
