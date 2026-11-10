import React, { useCallback, useState } from "react";
import BackButton from "../common/BackButton";

// iOS 式大標題：標題先以大字放在捲動內容最上方，往下捲超過門檻後收進頂欄小標題。
const COLLAPSE_AT = 34;

export function useLargeTitle() {
  const [collapsed, setCollapsed] = useState(false);
  const onScroll = useCallback((event) => {
    const next = event.currentTarget.scrollTop > COLLAPSE_AT;
    setCollapsed((current) => (current === next ? current : next));
  }, []);
  return { collapsed, onScroll, pageClassName: `mp-page mp-page--large mp-type-floor ${collapsed ? "is-collapsed" : ""}` };
}

// 第二層頁面（點進去的設定、排序、明細等）：精簡頁首＋置中小標題，外觀與大標題收起後相同。
export const SUB_PAGE_CLASS = "mp-page mp-page--sub mp-type-floor";

export function AppHeader({ title, subtitle = null, onBack, backLabel, right = null, style }) {
  return (
    <div className="mp-hdr mp-hdr--compact" style={style}>
      <BackButton onClick={onBack} label={backLabel} />
      <div className="mp-htitle">{title}{subtitle && <small className="mp-hsub">{subtitle}</small>}</div>
      {right || <span className="mp-hdr-spacer" aria-hidden="true" />}
    </div>
  );
}

export function LargeTitleHeader({ title, onBack, backLabel, right = null }) {
  return (
    <div className="mp-hdr mp-hdr--large">
      <BackButton onClick={onBack} label={backLabel} />
      <div className="mp-htitle" aria-hidden="true">{title}</div>
      {right || <span className="mp-hdr-spacer" aria-hidden="true" />}
    </div>
  );
}

export function LargeTitle({ title, subtitle = null, children = null }) {
  return (
    <div className="mp-large-title">
      <div className="mp-large-title-text">
        <h1>{title}</h1>
        {subtitle && <p className="mp-large-sub">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
