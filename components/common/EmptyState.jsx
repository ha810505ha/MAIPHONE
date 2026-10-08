import React from "react";
import Icon from "./Icon";

// 共用空白頁：線條插圖＋標題＋一句「下一步」＋選填按鈕。取代各頁的 emoji 空白狀態。
export default function EmptyState({ icon = "sparkle", title, text, actionLabel, onAction, compact = false, className = "" }) {
  return (
    <div className={`mp-empty-state ${compact ? "mp-empty-state--compact" : ""} ${className}`.trim()}>
      <div className="mp-empty-icon" aria-hidden="true"><Icon name={icon} size={compact ? 30 : 38} /></div>
      {title && <div className="mp-empty-state-title">{title}</div>}
      {text && <div className="mp-empty-state-text">{text}</div>}
      {actionLabel && onAction && <button type="button" className="mp-empty-state-cta" onClick={onAction}>{actionLabel}</button>}
    </div>
  );
}
