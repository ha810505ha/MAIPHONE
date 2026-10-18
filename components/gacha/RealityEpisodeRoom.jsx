import React, { useEffect, useRef, useState } from "react";
import { useGacha } from "../../contexts/GachaContext";
import useGachaEpisodeAI from "../../hooks/gacha/useGachaEpisodeAI";
import useAutoResizeTextarea from "../../hooks/chat/useAutoResizeTextarea";
import SpecialMemorySection from "./SpecialMemoryCard";
import { confirmLocalized, translate } from "../../utils/i18n";
import { AppHeader } from "../shell/LargeTitle";
import { withGachaCardArt } from "../../data/gacha/cardArt.js";

const uiLocale = () => (typeof document !== "undefined" && document.documentElement.lang) || "zh-TW";

export default function RealityEpisodeRoom({ episode, character, playerProfile, apiConfig, recentMessages, onBack, tr: trProp }) {
  const tr = typeof trProp === "function" ? trProp : (...translations) => translate(uiLocale(), ...translations);
  const { sendEpisodeMessage, appendEpisodeAssistantMessage, setEpisodeOpening, endEpisode } = useGacha();
  const [input, setInput] = useState("");
  const openingStarted = useRef(false);
  const inputRef = useAutoResizeTextarea(input, 92);
  const { send: sendWithAI, finishEarly, prepareOpening, retry, canRetry, isGenerating, streamingText, error, clearError } = useGachaEpisodeAI({ episode, character, playerProfile, apiConfig, recentMessages, sendUserMessage: sendEpisodeMessage, appendAssistantMessage: appendEpisodeAssistantMessage, setEpisodeOpening, tr });
  useEffect(() => { if (episode.openingStatus === "pending" && !openingStarted.current) { openingStarted.current = true; void prepareOpening(); } }, [episode.openingStatus, prepareOpening]);
  const send = async () => { const text = input.trim(); if (!text) return; setInput(""); await sendWithAI(text); };
  const endEarly = async () => {
    if (isGenerating || !confirmLocalized(tr("確定要提前結束這段特別篇嗎？\n\n角色會先為目前的故事留下最後一段收尾。", "End this special episode early?\n\nThe character will write one final passage to close the story.", "この特別編を早めに終了しますか？\n\nキャラクターが物語の最後の一節を書き残します。", "이 특별편을 일찍 끝낼까요?\n\n캐릭터가 이야기를 마무리하는 마지막 구절을 남깁니다."))) return;
    if (await finishEarly()) endEpisode(episode.id, true);
  };
  // 頁首以卡圖淡化當背景，不用 emoji（避免撞圖、部分裝置無法顯示）；沒有卡圖時只顯示卡名。
  const chapterArt = withGachaCardArt(episode.item)?.artThumbnail || withGachaCardArt(episode.item)?.art || "";
  const completed = episode.status !== "active";
  const playerDisplayName = String(playerProfile?.name || "").trim() || tr("玩家", "Player", "プレイヤー", "플레이어");
  const inputDisabled = completed || episode.openingStatus === "pending" || isGenerating || episode.playerMessageCount >= 20;
  const placeholder = completed
    ? tr("這段故事已結束", "This story has ended", "この物語は終わりました", "이 이야기는 끝났어요")
    : episode.openingStatus === "pending"
      ? tr("正在準備故事……", "Preparing the story…", "物語を準備中……", "이야기를 준비하는 중……")
      : episode.playerMessageCount >= 20
        ? tr("故事正在等待最後結算", "Waiting for the story's final conclusion", "物語の最終結末を待っています", "이야기의 마지막 마무리를 기다리는 중")
        : isGenerating
          ? tr("等待故事繼續……", "Waiting for the story to continue…", "物語の続きを待っています……", "이야기가 이어지길 기다리는 중……")
          : tr("寫下你的回應……", "Write your response…", "あなたの返事を書こう……", "당신의 답을 적어 보세요……");
  return <div className="mp-page sg-novel-page">
    <style>{`
      .sg-novel-page{display:flex;flex-direction:column;min-height:0;background:linear-gradient(180deg,#fffaf5 0%,#fff5f2 100%);color:#4b3d3c}.sg-novel-header{flex:0 0 auto;background:rgba(255,250,245,.9);border-bottom:1px solid rgba(173,125,137,.14)}.sg-novel-header .mp-hdr{background:transparent;border-bottom:0}.sg-novel-header .mp-hdr .mp-htitle{color:#704c58}.mp-theme-night .sg-novel-header .mp-hdr .mp-htitle{color:#e8dde2}.sg-novel-end{border:1px solid #ddbdc5;border-radius:12px;background:#fff8f8;color:#a5526d;padding:7px 10px;font-size:11px;font-weight:800}.sg-novel-end:disabled{opacity:.45}.sg-novel-chapter{text-align:center;padding:2px 18px 13px}.sg-novel-chapter{position:relative;overflow:hidden}.sg-novel-chapter.has-art{padding-top:9px}.sg-novel-chapter>*{position:relative;z-index:1}.sg-novel-chapter.has-art:before{content:"";position:absolute;inset:0;background:var(--sg-chapter-art) center 35%/cover no-repeat;opacity:.22;filter:blur(1px)}.sg-novel-chapter.has-art:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,250,245,.35),rgba(255,248,245,.92))}.mp-theme-night .sg-novel-chapter.has-art:after{background:linear-gradient(180deg,rgba(29,24,33,.4),rgba(29,24,33,.92))}.sg-novel-kicker{font:10px/1.4 var(--mp-font);letter-spacing:.18em;color:#b18791}.sg-novel-chapter h2{margin:5px 0 4px;font:700 17px/1.4 "Noto Serif TC","PMingLiU",serif;color:#704c58}.sg-novel-progress{font:10px/1.4 var(--mp-font);color:#aa9195}.sg-novel-rule{display:flex;align-items:center;gap:10px;width:72%;margin:9px auto 0;color:#d2aeb8}.sg-novel-rule:before,.sg-novel-rule:after{content:"";height:1px;flex:1;background:currentColor}.sg-novel-scroll{flex:1;min-height:0;overflow-y:auto;padding:22px 8% 45px;scrollbar-width:none}.sg-novel-scroll::-webkit-scrollbar{display:none}.sg-novel-system,.sg-novel-narrator{margin:0 auto 22px;max-width:90%;font:12px/1.9 var(--mp-font);color:#a18a8c;text-align:center;white-space:pre-wrap}.sg-novel-narrator:before,.sg-novel-narrator:after{content:"✦";display:block;margin:8px;color:#d0afb8;font-size:9px}.sg-novel-prose{font:15px/2 "Noto Serif TC","Songti TC","PMingLiU",serif;letter-spacing:.035em;color:#4b3d3c;white-space:pre-wrap;word-break:break-word;margin:0 0 22px}.sg-novel-prose:before{content:"";display:block;width:18px;height:1px;margin:0 0 12px;background:#d7b2bc}.sg-novel-player{max-width:88%;margin:20px 0 25px auto;padding:3px 0;font:13px/1.9 var(--mp-font);letter-spacing:.025em;color:#b05f79;text-align:right;white-space:pre-wrap;word-break:break-word}.sg-novel-player-name{display:block;margin-bottom:2px;font-size:9px;letter-spacing:.15em;color:#c697a5}.sg-novel-stream{min-height:2em}.sg-novel-stream.pending:after{content:"│";color:#b85f7c;animation:sgNovelCursor .7s step-end infinite}.sg-novel-complete{margin:30px auto 0;text-align:center;font:11px/1.8 var(--mp-font);color:#a68c8d}.sg-novel-complete:before{content:"──  終  ──";display:block;margin-bottom:7px;letter-spacing:.2em}.sg-novel-error{display:block;margin:15px auto;border:1px solid #e3a5b7;border-radius:12px;padding:8px 12px;background:#fff1f5;color:#a84e6c}.sg-novel-compose{flex:0 0 auto;padding:10px 12px;background:rgba(255,250,247,.95);border-top:1px solid rgba(173,125,137,.18)}.sg-novel-compose-row{display:flex;align-items:flex-end;gap:8px}.sg-novel-compose textarea{flex:1;min-height:42px;max-height:92px;border:1px solid #e8cdd2;border-radius:16px;background:#fffdfb;padding:11px 13px;color:#594548;font:13px/1.5 var(--mp-font);resize:none;outline:none}.sg-novel-retry{display:block;margin:10px auto;min-height:36px;border:1px solid #e3a5b7;border-radius:999px;padding:6px 16px;background:#fffdfb;color:#a84e6c;font:800 12px/1.4 var(--mp-font)}.mp-theme-night .sg-novel-retry{background:#29212d;color:#efaec2;border-color:#553c4b}.sg-novel-send{width:42px;height:42px;border:0;border-radius:50%;background:linear-gradient(135deg,#df91a8,#bd5b7a);color:#fff}.sg-novel-send:disabled{opacity:.4}@keyframes sgNovelCursor{50%{opacity:0}}@media(prefers-color-scheme:dark){.mp-theme-night .sg-novel-page{background:#19151d;color:#e8dde2}.mp-theme-night .sg-novel-header{background:#1d1821}.mp-theme-night .sg-novel-prose{color:#e8dde2}.mp-theme-night .sg-novel-player{color:#efaec2}.mp-theme-night .sg-novel-compose{background:#1d1821}.mp-theme-night .sg-novel-compose textarea{background:#29212d;color:#eee;border-color:#493747}}
    `}</style>
    <header className="sg-novel-header">
      <AppHeader
        title={`${episode.characterName} · ${tr("特別篇", "Special", "特別編", "특별편")}`}
        onBack={onBack}
        backLabel={tr("返回", "Back", "戻る", "뒤로")}
        right={episode.status === "active" ? <button type="button" className="sg-novel-end" disabled={isGenerating} onClick={endEarly}>{isGenerating ? tr("收尾中…", "Wrapping up…", "締めくくり中…", "마무리 중…") : tr("提前結束", "End early", "早めに終了", "일찍 종료")}</button> : null}
      />
      <div className={`sg-novel-chapter ${chapterArt ? "has-art" : ""}`} style={chapterArt ? { "--sg-chapter-art": `url(${JSON.stringify(chapterArt)})` } : undefined}><div className="sg-novel-kicker">SAKURA VOW · REALITY</div><h2>{episode.item.name}</h2><div className="sg-novel-progress">{completed ? (episode.endedEarly ? tr("已提前結束", "Ended early", "早期終了", "일찍 종료됨") : tr("已完成", "Completed", "完了", "완료")) : tr(`第 ${episode.playerMessageCount} / 20 則`, `Entry ${episode.playerMessageCount} / 20`, `${episode.playerMessageCount} / 20 通目`, `${episode.playerMessageCount} / 20번째`)}</div><div className="sg-novel-rule">✦</div></div>
    </header>
    <main className="sg-novel-scroll">{episode.messages.map((message) => message.role === "narrator" ? <div key={message.id} className="sg-novel-narrator">{message.content}</div> : message.role === "system" ? <div key={message.id} className="sg-novel-system">{message.content}</div> : message.role === "user" ? <div key={message.id} className="sg-novel-player"><span className="sg-novel-player-name">{playerDisplayName} ·</span>{message.content}</div> : <div key={message.id} className="sg-novel-prose">{message.content}</div>)}{episode.openingStatus === "pending" && isGenerating && <div className="sg-novel-narrator">{tr("故事正在展開……", "The story is unfolding…", "物語が始まります……", "이야기가 펼쳐지는 중……")}</div>}{isGenerating && episode.openingStatus !== "pending" && <div className="sg-novel-prose sg-novel-stream pending">{streamingText || tr("故事仍在紙頁間醞釀……", "The story is still taking shape on the page…", "物語はまだページの間で紡がれています……", "이야기가 아직 페이지 사이에서 익어가는 중……")}</div>}{error && <button type="button" className="sg-novel-error" onClick={clearError}>{error}</button>}{canRetry && <button type="button" className="sg-novel-retry" onClick={() => void retry()}>{tr("重新生成", "Regenerate", "再生成", "다시 생성")}</button>}{completed && <div className="sg-novel-complete">{tr("這段故事已經寫下句點，內容會繼續保留。", "This story has reached its end; its pages will be kept.", "この物語は結末を迎えました。内容はこのまま保存されます。", "이 이야기는 마침표를 찍었어요. 내용은 계속 보관됩니다.")}</div>}{completed && <SpecialMemorySection episode={episode} character={character} playerProfile={playerProfile} apiConfig={apiConfig} tr={tr} />}</main>
    <footer className="sg-novel-compose"><div className="sg-novel-compose-row"><textarea ref={inputRef} rows={1} value={input} disabled={inputDisabled} onChange={(event) => setInput(event.target.value)} placeholder={placeholder} aria-label={tr("寫下你的回應", "Write your response", "返事を書く", "답을 적기")} /><button type="button" className="sg-novel-send" disabled={inputDisabled || !input.trim()} onClick={send} aria-label={tr("送出回應", "Send response", "返事を送信", "답 보내기")}>➤</button></div></footer>
  </div>;
}
