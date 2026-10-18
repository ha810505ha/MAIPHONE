import React, { useLayoutEffect, useRef, useState } from "react";
import { DEFAULT_GACHA_RATES, SSR_HARD_PITY_COUNTER, SSR_SOFT_PITY_START, SSR_SOFT_PITY_STEP } from "../../services/gacha/gachaDraw.js";

// MP-074：抽卡機率與保底說明（數字一律從抽卡引擎常數算，改規則時畫面跟著變）。
export const PITY_DRAW = SSR_HARD_PITY_COUNTER + 1;

export function drawsUntilGuaranteedSsr(progress) {
  const counter = Math.min(SSR_HARD_PITY_COUNTER, Math.max(0, Number(progress?.drawsSinceLastSSR) || 0));
  return PITY_DRAW - counter;
}

// App 沒有在 DOM 上標示夜色主題（只換 CSS 變數），所以用主題文字色的亮度判斷：文字很亮＝深色主題。
// 小舞 2026-10-18 決定只有這個視窗跟著夜色變深，特別篇維持原樣。
function detectDarkTheme(host) {
  if (!host || typeof getComputedStyle === "undefined") return false;
  const probe = document.createElement("span");
  probe.style.cssText = "position:absolute;visibility:hidden;color:var(--mp-txt)";
  host.appendChild(probe);
  const match = getComputedStyle(probe).color.match(/\d+(\.\d+)?/g);
  probe.remove();
  if (!match) return false;
  const [r, g, b] = match.map(Number);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
}

const TIERS = [
  { rarity: "SSR", bg: "#fff3d6", fg: "#8a5a0a" },
  { rarity: "SR", bg: "#fce4ee", fg: "#993556" },
  { rarity: "R", bg: "#ebeefa", fg: "#3c4a89" },
];

export default function GachaOddsSheet({ pool = [], rates = DEFAULT_GACHA_RATES, progress, poolLabel, onClose, tr }) {
  const overlayRef = useRef(null);
  const [dark, setDark] = useState(false);
  useLayoutEffect(() => { setDark(detectDarkTheme(overlayRef.current)); }, []);
  const softFrom = SSR_SOFT_PITY_START + 1;
  const softTo = PITY_DRAW - 1;
  const baseSsr = Number(rates.SSR) || 0;
  const firstBoost = baseSsr + SSR_SOFT_PITY_STEP;
  const lastBoost = Math.min(100, baseSsr + (softTo - SSR_SOFT_PITY_START) * SSR_SOFT_PITY_STEP);
  const counted = PITY_DRAW - drawsUntilGuaranteedSsr(progress);
  const left = drawsUntilGuaranteedSsr(progress);
  const countOf = (rarity) => pool.filter((card) => card.rarity === rarity).length;
  return <div ref={overlayRef} className="mp-overlay sg-odds-overlay" onClick={onClose}>
    <style>{`.sg-odds-sheet{width:min(340px,90%);max-height:82%;overflow-y:auto;border-radius:18px;background:#fffaf5;border:1px solid #efd9e2;padding:16px 18px 18px;color:#5a3a48;box-shadow:0 16px 50px rgba(60,30,45,.22)}.sg-odds-head{display:flex;justify-content:space-between;align-items:center;gap:8px}.sg-odds-head h3{margin:0;font-size:16px}.sg-odds-close{width:36px;height:36px;border:0;border-radius:50%;background:transparent;color:inherit;font-size:20px;line-height:1;cursor:pointer}.sg-odds-pool{font-size:12px;color:#a0566e;margin-top:-4px}.sg-odds-tiers{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px}.sg-odds-tier{border-radius:10px;padding:8px 4px;text-align:center}.sg-odds-tier b{display:block;font-size:19px}.sg-odds-tier small{font-size:11px}.sg-odds-title{font-size:13px;font-weight:800;margin-top:16px}.sg-odds-bar{display:flex;height:24px;margin-top:8px;border-radius:7px;overflow:hidden;font-size:11px;font-weight:700;color:#fff}.sg-odds-bar span{display:flex;align-items:center;justify-content:center;white-space:nowrap;overflow:hidden}.sg-odds-scale{position:relative;height:14px;font-size:11px;color:#a0566e;margin-top:3px}.sg-odds-scale span{position:absolute;top:0}.sg-odds-rules{font-size:12px;line-height:1.75;margin:10px 0 0;padding-left:18px}.sg-odds-now{margin-top:12px;background:#fce4ee;border-radius:10px;padding:8px 10px;font-size:12px;color:#993556;font-weight:700}.sg-odds-sheet.dark{background:#2b2128;border-color:#4a3642;color:#f1dfe7}.sg-odds-sheet.dark .sg-odds-pool,.sg-odds-sheet.dark .sg-odds-scale{color:#e6a9c0}.sg-odds-sheet.dark .sg-odds-now{background:#3a2a35;color:#f2c3d2}`}</style>
    <div className={`sg-odds-sheet ${dark ? "dark" : ""}`} role="dialog" aria-modal="true" aria-labelledby="sg-odds-title" onClick={(event) => event.stopPropagation()}>
      <div className="sg-odds-head">
        <h3 id="sg-odds-title">{tr("機率與保底說明", "Rates and pity", "提供割合と天井", "확률 및 천장 안내")}</h3>
        <button type="button" className="sg-odds-close" aria-label={tr("關閉說明", "Close", "閉じる", "닫기")} onClick={onClose}>×</button>
      </div>
      <div className="sg-odds-pool">{tr(`${poolLabel}卡池 · 共 ${pool.length} 張`, `${poolLabel} pool · ${pool.length} cards`, `${poolLabel}プール・全${pool.length}枚`, `${poolLabel} 카드 풀 · 총 ${pool.length}장`)}</div>
      <div className="sg-odds-tiers">
        {TIERS.map(({ rarity, bg, fg }) => <div key={rarity} className="sg-odds-tier" style={{ background: bg, color: fg }}>
          <b>{Number(rates[rarity]) || 0}%</b>
          <small>{tr(`${rarity} · ${countOf(rarity)} 張`, `${rarity} · ${countOf(rarity)} cards`, `${rarity}・${countOf(rarity)}枚`, `${rarity} · ${countOf(rarity)}장`)}</small>
        </div>)}
      </div>
      <div className="sg-odds-title">{tr(`SSR 保底：第 ${PITY_DRAW} 抽必得`, `SSR pity: guaranteed by draw ${PITY_DRAW}`, `SSR天井：${PITY_DRAW}回目で確定`, `SSR 천장: ${PITY_DRAW}번째 뽑기 확정`)}</div>
      <div className="sg-odds-bar" aria-hidden="true">
        <span style={{ flex: SSR_SOFT_PITY_START, background: "#d9b9c6", color: "#5a3a48" }}>{tr(`第 1–${SSR_SOFT_PITY_START} 抽 · ${baseSsr}%`, `Draws 1–${SSR_SOFT_PITY_START} · ${baseSsr}%`, `1–${SSR_SOFT_PITY_START}回・${baseSsr}%`, `1–${SSR_SOFT_PITY_START}회 · ${baseSsr}%`)}</span>
        <span style={{ flex: softTo - SSR_SOFT_PITY_START, background: "#e48aa9" }}>+{SSR_SOFT_PITY_STEP}%</span>
        <span style={{ flex: 4, background: "#d4a017" }}>{PITY_DRAW}</span>
      </div>
      <div className="sg-odds-scale" aria-hidden="true">
        <span style={{ left: 0 }}>1</span>
        <span style={{ left: `${(SSR_SOFT_PITY_START / (softTo + 4)) * 100}%` }}>{softFrom}</span>
        <span style={{ right: 0 }}>{PITY_DRAW}</span>
      </div>
      <ul className="sg-odds-rules">
        <li>{tr(`第 ${softFrom} 抽起，每抽 SSR 機率再加 ${SSR_SOFT_PITY_STEP}%（${firstBoost}%、${firstBoost + SSR_SOFT_PITY_STEP}%…第 ${softTo} 抽 ${lastBoost}%）`, `From draw ${softFrom}, the SSR rate rises by ${SSR_SOFT_PITY_STEP}% each draw (${firstBoost}%, ${firstBoost + SSR_SOFT_PITY_STEP}%… ${lastBoost}% on draw ${softTo})`, `${softFrom}回目からSSR確率が1回ごとに${SSR_SOFT_PITY_STEP}%上昇（${firstBoost}%、${firstBoost + SSR_SOFT_PITY_STEP}%…${softTo}回目は${lastBoost}%）`, `${softFrom}번째부터 SSR 확률이 매회 ${SSR_SOFT_PITY_STEP}% 상승 (${firstBoost}%, ${firstBoost + SSR_SOFT_PITY_STEP}%… ${softTo}번째 ${lastBoost}%)`)}</li>
        <li>{tr(`第 ${PITY_DRAW} 抽必定是 SSR`, `Draw ${PITY_DRAW} is always an SSR`, `${PITY_DRAW}回目は必ずSSR`, `${PITY_DRAW}번째는 반드시 SSR`)}</li>
        <li>{tr("抽到 SSR 後，保底次數從 0 重新算", "Getting an SSR resets the pity count to 0", "SSRが出ると天井カウントは0に戻ります", "SSR이 나오면 천장 횟수가 0으로 초기화돼요")}</li>
        <li>{tr("十連若沒有 SR 以上，最後一張保證 SR", "A ten-draw with no SR or better turns its last card into an SR", "十連でSR以上がなければ最後の1枚はSR確定", "10연속에 SR 이상이 없으면 마지막 1장은 SR 확정")}</li>
        <li>{tr("限定卡池的保底各自計算，不互相累積", "Limited pools keep their own pity count", "限定プールの天井はそれぞれ別にカウントされます", "한정 카드 풀의 천장은 각각 따로 계산돼요")}</li>
      </ul>
      <div className="sg-odds-now">{tr(`目前已累積 ${counted} 抽，再 ${left} 抽內必得 SSR`, `${counted} draws so far — an SSR is guaranteed within ${left} more`, `現在${counted}回、あと${left}回以内にSSR確定`, `현재 ${counted}회 누적, ${left}회 안에 SSR 확정`)}</div>
    </div>
  </div>;
}
