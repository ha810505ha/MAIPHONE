import React from "react";
import MotionPresence from "../motion/MotionPresence.jsx";

function getSwipeContent(swipe) {
  if (Array.isArray(swipe?.contents)) return swipe.contents.filter(Boolean).join("\n");
  return typeof swipe === "string" ? swipe : (swipe?.content || "");
}

export default function SwipePicker({ open, message, onClose, onSelect, onDelete, onGenerate, onCreateBranch, tr }) {
  const swipes = Array.isArray(message?.swipes) && message.swipes.length
    ? message.swipes
    : (message ? [{ content: message.content || "" }] : []);
  const activeIndex = Math.min(Math.max(0, Number(message?.swipeIndex) || 0), Math.max(0, swipes.length - 1));
  return <MotionPresence show={open} exitMs={150}>
    {open && message && <div className="mp-overlay mp-swipe-picker-overlay" onClick={onClose}>
      <section className="mp-swipe-picker" role="dialog" aria-modal="true" aria-label={tr("其他回覆", "Other replies", "ほかの返信", "다른 답장")} onClick={(event) => event.stopPropagation()}>
        <div className="mp-swipe-picker-handle" />
        <div className="mp-swipe-picker-heading">
          <div><b>{tr("其他回覆", "Other replies", "ほかの返信", "다른 답장")}</b><small>{activeIndex + 1} / {swipes.length}</small></div>
          <button type="button" onClick={onClose} aria-label={tr("關閉", "Close", "閉じる", "닫기")}>×</button>
        </div>
        <div className="mp-swipe-picker-list">
          {swipes.map((swipe, index) => {
            const active = index === activeIndex;
            return <div key={`${message.id}-${index}`} className={`mp-swipe-picker-card ${active ? "active" : ""}`} role="button" tabIndex={0}
              onClick={() => { onSelect(index); onClose(); }}
              onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(index); onClose(); } }}>
              <div className="mp-swipe-picker-card-top"><span>{index + 1}</span>{active && <b>{tr("採用中", "In use", "使用中", "사용 중")}</b>}{!active && <button type="button" onClick={(event) => { event.stopPropagation(); onDelete(index); }} aria-label={tr("刪除這個回覆", "Delete this reply", "この返信を削除", "이 답장 삭제")}>×</button>}</div>
              <div className="mp-swipe-picker-preview">{getSwipeContent(swipe)}</div>
            </div>;
          })}
        </div>
        <div className="mp-swipe-picker-actions">
          <button type="button" className="mp-ibtn" onClick={() => { onCreateBranch?.(activeIndex); onClose(); }}>⌁ {tr("以此版本開分支", "Branch from this reply", "この返信から分岐", "이 답변에서 분기")}</button>
          <button type="button" className="mp-save mp-swipe-picker-generate" onClick={() => { onGenerate(); onClose(); }}>↻ {tr("再生成一個", "Generate another", "もう一つ生成", "하나 더 생성")}</button>
        </div>
      </section>
    </div>}
  </MotionPresence>;
}
