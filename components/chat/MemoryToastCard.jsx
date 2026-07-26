import React from "react";

// 聊天室內生成記憶後的確認小卡。純 UI 層，不進 chatHistory、不影響上下文
// （記憶本體另走召回路徑被讀取）。停在畫面上、點「知道了」才關。
export default function MemoryToastCard({ card, onClose, applyUserPlaceholder, tr }) {
  if (!card) return null;
  const applyName = (text) => (applyUserPlaceholder ? applyUserPlaceholder(text) : text);
  const added = card.status === "added";
  const message = added
    ? null
    : card.status === "duplicate"
      ? tr("這次沒有新增，內容太接近既有記憶", "Nothing added — too close to an existing memory", "追加なし：既存の記憶に近すぎます", "추가 안 됨 — 기존 기억과 너무 유사")
      : card.message || tr("記憶生成失敗", "Failed to generate memory", "記憶の生成に失敗しました", "기억 생성 실패");
  return <div className="mp-mem-card-mask" onClick={onClose}>
    <div className="mp-mem-card" onClick={(event) => event.stopPropagation()}>
      {added ? <>
        <div className="mp-mem-card-title">✦ {tr("已存入長期記憶", "Saved to long-term memory", "長期記憶に保存しました", "장기 기억에 저장됨")}</div>
        <div className="mp-mem-card-text">「{applyName(card.text)}」</div>
        {card.noNewChat && <div className="mp-mem-card-hint">{tr("自上次生成後沒有新對話，這則是就同一段內容再整理的。", "No new chat since last time — this is drawn from the same conversation.", "前回から新しい会話はありません。同じ会話から整理したものです。", "지난번 이후 새 대화가 없어 같은 대화에서 정리한 기억입니다.")}</div>}
      </> : (
        <div className="mp-mem-card-note">{message}</div>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
        <button type="button" className="mp-save" style={{ width: "auto", minWidth: 88, padding: "8px 16px" }} onClick={onClose}>{tr("知道了", "Got it", "OK", "확인")}</button>
      </div>
    </div>
  </div>;
}
