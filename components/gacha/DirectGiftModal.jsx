import React, { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useGacha } from "../../contexts/GachaContext";
import { translate } from "../../utils/i18n";
import GachaCardVisual, { GachaPoolBadge } from "./GachaCardVisual";
import { resolveGachaPoolId } from "../../data/gacha/cardPools";
import { withGachaCardArt } from "../../data/gacha/cardArt.js";

// 卡多時好找：稀有度高的排前面，同稀有度張數多的在前，再依卡名。
const RARITY_RANK = { SSR: 0, SR: 1, R: 2 };
const RARITY_FILTERS = ["ALL", "SSR", "SR", "R"];
// 已選卡片圓框顏色，與珍藏頁卡框一致。
const RARITY_RING = { SSR: "#f4d574", SR: "#e9a1ca", R: "#aeb9ea" };

const uiLocale = () => (typeof document !== "undefined" && document.documentElement.lang) || "zh-TW";

export default function DirectGiftModal({ character, onClose, onStarted, tr: trProp }) {
  const tr = typeof trProp === "function" ? trProp : (...translations) => translate(uiLocale(), ...translations);
  const { inventory, startEpisode } = useGacha();
  const [selectedUid, setSelectedUid] = useState("");
  const [mode, setMode] = useState("reality");
  // MP-069：兩步選擇。先選珍藏，再選現實／線上，避免同畫面兩組選項混在一起。
  const [step, setStep] = useState("pick");
  const [rarityFilter, setRarityFilter] = useState("ALL");
  const gifts = useMemo(() => {
    const grouped = new Map();
    inventory.forEach((item) => {
      // 同一張卡若來自不同卡池分開列出（MP-054）
      const key = `${resolveGachaPoolId(item.poolId)}:${item.id}`;
      const existing = grouped.get(key);
      if (existing) existing.count += 1;
      else grouped.set(key, { ...withGachaCardArt(item), groupKey: key, count: 1 });
    });
    return [...grouped.values()].sort((a, b) => (RARITY_RANK[a.rarity] ?? 9) - (RARITY_RANK[b.rarity] ?? 9) || b.count - a.count || String(a.name).localeCompare(String(b.name)));
  }, [inventory]);
  const rarityCounts = useMemo(() => gifts.reduce((counts, item) => ({ ...counts, [item.rarity]: (counts[item.rarity] || 0) + 1 }), {}), [gifts]);
  const visibleGifts = rarityFilter === "ALL" ? gifts : gifts.filter((item) => item.rarity === rarityFilter);
  const selected = gifts.find((item) => item.uid === selectedUid);
  const confirmGift = () => {
    if (!selected || !character) return;
    const episode = startEpisode({ itemUid: selected.uid, characterId: character.id, characterName: character.name, mode });
    if (episode) onStarted?.(episode);
  };
  // 從聊天輸入列開啟；不掛到手機根節點的話，遮罩會被輸入列的範圍框住而跑版。
  const overlay = <div className="mp-overlay" onClick={onClose}>
    <style>{`
      .sg-direct-gift{width:90%;max-height:78%;padding:18px}.sg-direct-gift h3{margin:0 0 4px}.sg-direct-gift-sub{font-size:12px;color:var(--mp-txt-l);margin-bottom:12px}.sg-direct-gift-filters{display:flex;gap:6px;margin-bottom:10px}.sg-direct-gift-filter{flex:1;min-width:0;min-height:32px;display:flex;align-items:center;justify-content:center;gap:4px;border:1px solid color-mix(in srgb,var(--mp-pink) 28%,transparent);border-radius:999px;background:var(--mp-surface);color:var(--mp-txt);font-size:12px;font-weight:800;padding:0 6px}.sg-direct-gift-filter span{font-size:11px;font-weight:600;opacity:.6}.sg-direct-gift-filter.active{border-color:transparent;background:var(--mp-txt);color:var(--mp-lv0,#fff)}.sg-direct-gift-filter.active span{opacity:.8}.sg-direct-gift-filter:disabled{opacity:.35}.sg-direct-gift-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;max-height:270px;overflow-y:auto;padding:2px}.sg-direct-gift-item{position:relative;min-width:0;border:1px solid color-mix(in srgb,var(--mp-pink) 28%,transparent);border-radius:14px;background:var(--mp-surface);color:var(--mp-txt);padding:6px;text-align:left}.sg-direct-gift-item.active{border-color:var(--mp-pink-dk);box-shadow:0 0 0 2px color-mix(in srgb,var(--mp-pink) 35%,transparent)}.sg-direct-gift-icon{position:relative;display:grid;place-items:center;height:58px;font-size:31px;border-radius:10px;background:linear-gradient(145deg,#eee5f2,#f8dce6)}.sg-direct-gift-icon.has-art{height:auto;aspect-ratio:2/3;overflow:hidden}.sg-direct-gift-item b{display:block;margin-top:5px;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sg-direct-gift-count{position:absolute;right:5px;top:5px;padding:2px 5px;border-radius:10px;background:#4f3d46;color:#fff;font-size:10px}.sg-direct-gift-modes{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:13px 0}.sg-direct-gift-button{min-height:42px;padding:10px 8px;white-space:normal;line-height:1.5;border:1px solid var(--mp-line);border-radius:13px;background:var(--mp-surface);color:var(--mp-txt);font-weight:800}.sg-direct-gift-button small{display:block;font-size:var(--mp-fs-caption);font-weight:400}.sg-direct-gift-button.active{border-color:var(--mp-pink-dk);background:color-mix(in srgb,var(--mp-pink) 18%,var(--mp-surface));color:var(--mp-pink-dk)}.sg-direct-gift-confirm{width:100%;min-height:44px;border:0;border-radius:14px;background:var(--mp-primary-gradient,linear-gradient(135deg,#ec8eae,#d95d87));color:var(--mp-on-accent,#fff);font-weight:900}.sg-direct-gift-confirm:disabled{opacity:.4}.sg-direct-gift-tag{display:block;margin-top:6px;text-align:center;font-size:var(--mp-fs-caption);font-weight:600;letter-spacing:.08em;opacity:.65}.sg-direct-gift-back{width:100%;min-height:40px;margin-top:8px;border:0;border-radius:14px;background:transparent;color:var(--mp-txt-l);font-weight:600}.sg-direct-gift-picked{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid color-mix(in srgb,var(--mp-pink) 28%,transparent);border-radius:14px;background:var(--mp-surface)}.sg-direct-gift-picked-icon{flex:none;width:46px;height:46px;display:grid;place-items:center;border:2.5px solid;border-radius:50%;overflow:hidden;font-size:24px;background:var(--mp-surface)}.sg-direct-gift-picked-icon img{width:100%;height:100%;object-fit:cover;display:block}.sg-direct-gift-picked b{display:block;font-size:13px}.sg-direct-gift-picked small{display:block;font-size:var(--mp-fs-caption);color:var(--mp-txt-l)}.sg-direct-gift-empty{text-align:center;padding:35px 10px;color:var(--mp-txt-l)}
    `}</style>
    <div className="mp-modal sg-direct-gift" onClick={(event) => event.stopPropagation()}><h3>{tr(`與 ${character?.name || ""} 開啟特別篇`, `Start a special episode with ${character?.name || ""}`, `${character?.name || ""}と特別編を始める`, `${character?.name || ""}와 특별편 시작`)}</h3><div className="sg-direct-gift-sub">{tr("選擇一張「櫻色誓約」珍藏，展開屬於你們的故事。", "Choose a Sakura Vow card and begin a story of your own.", "「桜色の誓い」のカードを選んで、ふたりだけの物語を始めよう。", "「벚꽃빛 서약」 카드를 골라 두 사람만의 이야기를 시작해요.")}</div>
      {gifts.length ? (step === "pick"
        ? <><div className="sg-direct-gift-filters" role="group" aria-label={tr("依稀有度篩選", "Filter by rarity", "レア度で絞り込み", "희귀도로 필터")}>{RARITY_FILTERS.map((key) => { const count = key === "ALL" ? gifts.length : rarityCounts[key] || 0; return <button key={key} type="button" className={`sg-direct-gift-filter ${rarityFilter === key ? "active" : ""}`} aria-pressed={rarityFilter === key} disabled={key !== "ALL" && !count} onClick={() => setRarityFilter(key)}>{key === "ALL" ? tr("全部", "All", "すべて", "전체") : key}<span>{count}</span></button>; })}</div><div className="sg-direct-gift-list">{visibleGifts.map((item) => <button key={item.groupKey || item.id} className={`sg-direct-gift-item ${selectedUid === item.uid ? "active" : ""}`} onClick={() => setSelectedUid(item.uid)}><div className={`sg-direct-gift-icon ${item.art ? "has-art" : ""}`}><GachaPoolBadge poolId={item.poolId} tr={tr} size="sm" />{item.art ? <GachaCardVisual item={item} thumbnail /> : item.icon}</div>{item.count > 1 && <span className="sg-direct-gift-count">×{item.count}</span>}<b>{item.name}</b><small>{item.rarity}</small></button>)}</div><button className="sg-direct-gift-confirm" disabled={!selectedUid} onClick={() => setStep("mode")}>{tr("下一步：選擇相處方式", "Next: choose how you meet", "次へ：過ごし方を選ぶ", "다음: 만남 방식 선택")}</button></>
        : <><div className="sg-direct-gift-picked"><span className={`sg-direct-gift-picked-icon ${selected?.art ? "has-art" : ""}`} style={{ borderColor: RARITY_RING[selected?.rarity] || RARITY_RING.R }}>{selected?.art ? <img src={selected.artThumbnail || selected.art} alt="" /> : selected?.icon}</span><b>{selected?.name}</b><small>{tr("將消耗此珍藏 ×1", "Uses 1 copy of this card", "このカードを1枚消費します", "이 카드 1장을 사용해요")}</small></div><div className="sg-direct-gift-sub">{tr("這段故事要怎麼發生？", "How does this story happen?", "この物語はどう始まる？", "이 이야기는 어떻게 시작될까요?")}</div><div className="sg-direct-gift-modes"><button className={`sg-direct-gift-button ${mode === "reality" ? "active" : ""}`} onClick={() => setMode("reality")}>{tr("就在你身邊", "Right by your side", "すぐそばで", "바로 네 곁에서")}<small>{tr("面對面相處，一起走進這段故事。", "Meet face to face and step into this story together.", "顔を合わせて、一緒にこの物語へ。", "얼굴을 마주하고 함께 이 이야기 속으로.")}</small><span className="sg-direct-gift-tag">{tr("現實", "In person", "現実", "현실")}</span></button><button className={`sg-direct-gift-button ${mode === "online" ? "active" : ""}`} onClick={() => setMode("online")}>{tr("在螢幕那一端", "On the other side of the screen", "画面の向こうで", "화면 너머에서")}<small>{tr("隔著手機聊天，從一則訊息展開你們的故事。", "Chat over the phone and let your story begin with a message.", "スマホ越しに、ひとつのメッセージから物語が始まる。", "휴대폰 너머로, 메시지 하나로 이야기를 시작해요.")}</small><span className="sg-direct-gift-tag">{tr("線上", "Online", "オンライン", "온라인")}</span></button></div><button className="sg-direct-gift-confirm" onClick={confirmGift}>{tr("開啟特別篇", "Start a special episode", "特別編を始める", "특별편 시작")}</button><button className="sg-direct-gift-back" onClick={() => setStep("pick")}>{tr("返回重選珍藏", "Back to choose another card", "カードを選び直す", "카드 다시 고르기")}</button></>)
        : <div className="sg-direct-gift-empty">{tr("目前沒有可使用的珍藏", "No cards available yet", "使えるカードがありません", "사용할 수 있는 카드가 없어요")}<br/><small>{tr("請先到遊戲中心的「櫻色誓約」召喚", "Summon first in Game Center › Sakura Vow", "ゲームセンターの「桜色の誓い」で召喚してください", "게임 센터의 「벚꽃빛 서약」에서 먼저 소환하세요")}</small></div>}
    </div>
  </div>;
  return createPortal(overlay, document.querySelector(".mp-phone") || document.body);
}
