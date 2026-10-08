import React from "react";

// 通用返回鍵：一律是 <button>、有可翻譯的 aria-label，顏色跟著主題文字色，夜色與淺色主題都清楚。
export default function BackButton({ onClick, label, className = "", style }) {
  return (
    <button type="button" className={`mp-back ${className}`.trim()} style={style} onClick={onClick} aria-label={label} title={label}>
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>
  );
}
