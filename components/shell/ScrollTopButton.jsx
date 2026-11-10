import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// 任何 App 頁面往下捲超過約八成畫面高時，右下角浮出「回到頂部」；點頂欄空白處也會捲回頂端（iOS 習慣）。
// 聊天室訊息區（.mp-msgs）往上捲是看舊訊息，方向相反，不套用；個別區塊可用 data-scroll-top="off" 排除。
const SHOW_RATIO = 0.8;
const MIN_SCROLLABLE = 480;
const EXCLUDE = '.mp-msgs,[data-scroll-top="off"]';

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;

function isVerticalScroller(node) {
  return node instanceof HTMLElement
    && !node.closest(EXCLUDE)
    && node.scrollHeight - node.clientHeight >= MIN_SCROLLABLE;
}

function scrollToTop(node) {
  node?.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" });
}

export default function ScrollTopButton({ currentApp, tr }) {
  const [target, setTarget] = useState(null);
  const lastScrollerRef = useRef(null);

  useEffect(() => {
    setTarget(null);
    lastScrollerRef.current = null;
    const stage = document.querySelector('[data-runtime-phone="true"] .mp-app-stage');
    if (!stage || !currentApp) return undefined;
    const onScroll = (event) => {
      const node = event.target;
      if (!isVerticalScroller(node)) return;
      lastScrollerRef.current = node;
      // 狀態相同時 React 不會重繪，捲動中頻繁呼叫也只在跨過門檻時更新一次。
      const next = node.scrollTop > node.clientHeight * SHOW_RATIO ? node : null;
      setTarget((current) => (current === next ? current : next));
    };
    // 點頂欄（不是按鈕或輸入框）時，把同一頁最近捲動過的區塊捲回頂端。
    const onHeaderClick = (event) => {
      const header = event.target.closest?.(".mp-hdr");
      if (!header || event.target.closest("button,a,input,select,textarea,label,[role='button'],.mp-back")) return;
      const page = header.closest(".mp-page");
      const scroller = lastScrollerRef.current;
      if (page && scroller && page.contains(scroller)) scrollToTop(scroller);
    };
    stage.addEventListener("scroll", onScroll, { capture: true, passive: true });
    stage.addEventListener("click", onHeaderClick, true);
    return () => {
      stage.removeEventListener("scroll", onScroll, { capture: true });
      stage.removeEventListener("click", onHeaderClick, true);
    };
  }, [currentApp]);

  // 放進該頁 .mp-page 裡，讓頁面自己的彈窗（z-index 較高）仍能蓋過按鈕。
  const page = target?.isConnected ? target.closest(".mp-page") : null;
  if (!page) return null;
  const label = tr("回到頂部", "Back to top", "トップへ戻る", "맨 위로");
  return createPortal(
    <button type="button" className="mp-scroll-top" aria-label={label} title={label} onClick={() => scrollToTop(target)}>
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 14l6-6 6 6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </button>,
    page,
  );
}
