import React from "react";
import { getGachaPool, isLimitedGachaPool, resolveGachaPoolId } from "../../data/gacha/cardPools";
import { translate } from "../../utils/i18n";

const uiLocale = () => (typeof document !== "undefined" && document.documentElement.lang) || "zh-TW";

/**
 * MP-054：卡片角落的卡池小標籤（常駐／限定池名稱）。
 * 需放在 position:relative 的卡片容器內；舊卡沒有 poolId 時視為常駐。
 * size="sm" 給揭曉結果五宮格等小卡使用。
 */
export function GachaPoolBadge({ poolId, tr: trProp, size = "md" }) {
  const tr = typeof trProp === "function" ? trProp : (...translations) => translate(uiLocale(), ...translations);
  const pool = getGachaPool(resolveGachaPoolId(poolId));
  if (!pool) return null;
  const limited = isLimitedGachaPool(pool.id);
  // 小舞 2026-10-14：常駐池不標示，只有限定池（例如「賽博雨夜」）顯示專屬標籤。
  if (!limited) return null;
  return <span className={`sg-pool-badge ${limited ? "limited" : "standard"} ${size === "sm" ? "sm" : ""}`} aria-label={tr("卡池", "Pool", "ガチャプール", "카드 풀")}>
    <style>{`.sg-pool-badge{position:absolute;left:8px;top:8px;z-index:5;max-width:calc(100% - 16px);padding:3px 7px;border-radius:10px;background:rgba(48,35,44,.72);border:1px solid rgba(255,255,255,.32);color:#fff;font-size:11px;font-weight:700;line-height:1;letter-spacing:.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}.sg-pool-badge.standard{opacity:.78}.sg-pool-badge.limited{background:linear-gradient(135deg,#ef8db0,#c8537b);border-color:rgba(255,255,255,.55);box-shadow:0 2px 8px rgba(160,50,90,.4)}.sg-pool-badge.sm{left:4px;top:4px;padding:2px 5px;font-size:9px;border-radius:7px}`}</style>
    {tr(pool.label)}
  </span>;
}

export default function GachaCardVisual({ item, fit = "cover", thumbnail = false }) {
  if (!item?.art) return null;
  const image = thumbnail ? item.artThumbnail || item.art : item.art;

  return <div className="sg-v3-card plain">
    <style>{`.sg-v3-card{position:absolute;inset:0;overflow:hidden;border-radius:inherit}.sg-v3-card-art{position:absolute;inset:0;width:100%;height:100%;object-fit:var(--sg-card-fit,cover)}.sg-v3-card.plain .sg-v3-card-art{background:#17121c}`}</style>
    <span aria-hidden="true" style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>{item.icon}</span>
    <img key={image} className="sg-v3-card-art" src={image} alt={item.name} loading={thumbnail ? "lazy" : "eager"} decoding="async" onError={(event) => { event.currentTarget.style.display = "none"; }} style={{ "--sg-card-fit": fit }} />
  </div>;
}
