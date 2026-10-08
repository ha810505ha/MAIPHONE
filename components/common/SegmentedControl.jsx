import React from "react";

// 通用分段控制（iOS 式）：灰底軌道＋浮起滑塊，切換時滑塊滑到新選項。
// items: [{ id, label, badge? }]；badge 為 true 顯示預設小紅點，也可傳入自訂的小紅點元素。
export default function SegmentedControl({ items, value, onChange, ariaLabel, className = "" }) {
  const index = Math.max(0, items.findIndex((item) => item.id === value));
  return (
    <div className={`mp-seg ${className}`.trim()} role="tablist" aria-label={ariaLabel} style={{ "--mp-seg-count": items.length, "--mp-seg-index": index }}>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={item.id === value}
          aria-label={item.ariaLabel}
          className={`mp-seg-btn ${item.id === value ? "active" : ""}`}
          onClick={() => onChange(item.id)}
        >
          <span>{item.label}</span>
          {item.badge === true ? <i className="mp-seg-dot" aria-hidden="true" /> : item.badge || null}
        </button>
      ))}
    </div>
  );
}
