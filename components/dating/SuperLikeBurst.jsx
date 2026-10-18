import React from "react";

/**
 * Super Like 的爆散特效。滑卡頁（SwipeDeck）與個人簡介頁（ProfileDetail）共用，
 * 確保玩家不論從哪裡按下 Super Like 都看得到同一套回饋：閃光＋SUPER LIKE 蓋章＋星星愛心四散。
 * 呼叫端在 SUPER_BURST_MS 後再做真正的送出／關閉，特效期間按鈕應鎖住避免連按。
 */
export const SUPER_BURST_MS = 520;
export const SUPER_FLY_MS = 260;

const SUPER_PARTICLES = Array.from({ length: 14 }, (_, i) => {
  const angle = (i / 14) * Math.PI * 2 + (i % 2 ? 0.18 : -0.12);
  const distance = 92 + (i % 3) * 26;
  return {
    glyph: i % 3 === 1 ? "♥" : "★",
    dx: Math.round(Math.cos(angle) * distance),
    dy: Math.round(Math.sin(angle) * distance),
    rotate: (i % 2 ? 1 : -1) * (40 + i * 9),
    delay: (i % 4) * 22,
    size: 15 + (i % 3) * 5,
  };
});

export const prefersReducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export default function SuperLikeBurst() {
  if (prefersReducedMotion()) return null;
  return <div className="dt-super-burst" aria-hidden="true">
    {SUPER_PARTICLES.map((p, i) => <span key={i} className={p.glyph === "♥" ? "heart" : "star"} style={{ "--dx": `${p.dx}px`, "--dy": `${p.dy}px`, "--rot": `${p.rotate}deg`, "--size": `${p.size}px`, animationDelay: `${p.delay}ms` }}>{p.glyph}</span>)}
  </div>;
}
