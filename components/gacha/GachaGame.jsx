import React, { useEffect, useMemo, useState } from "react";
import { withGachaCardArt } from "../../data/gacha/cardArt.js";
import { preloadSummonVideos } from "../../data/gacha/summonFx.js";
import { createPortal } from "react-dom";
import { GACHA_POOL, useGacha } from "../../contexts/GachaContext";
import GachaRevealSequence from "./GachaRevealSequence";
import GachaCardVisual, { GachaPoolBadge } from "./GachaCardVisual";
import { DEFAULT_GACHA_POOL_ID, getGachaPool, getGachaPoolLabel, listGachaPools, resolveGachaPoolId } from "../../data/gacha/cardPools";
import { DEFAULT_GACHA_RATES } from "../../services/gacha/gachaDraw.js";
import { confirmLocalized, translate } from "../../utils/i18n";
import { AppHeader, SUB_PAGE_CLASS } from "../shell/LargeTitle";
import SegmentedControl from "../common/SegmentedControl";
import EmptyState from "../common/EmptyState";
import GachaMuteButton from "./GachaMuteButton";
import GachaOddsSheet, { drawsUntilGuaranteedSsr } from "./GachaOddsSheet";
import { useMusicPlayer } from "../../contexts/MusicPlayerContext";
import { playGachaBgm, setGachaBgmSuppressed, stopGachaBgm } from "../../services/gacha/gachaAudio";

const colors = { SSR: ["#504160", "#f0bfd5"], SR: ["#a66f81", "#f5d2dc"], R: ["#74769c", "#dddff3"] };
const uiLocale = () => (typeof document !== "undefined" && document.documentElement.lang) || "zh-TW";
const BRAND = ["櫻色誓約", "Sakura Vow", "桜色の誓い", "벚꽃빛 서약"];

function GachaCarousel({ items = [], tr }) {
  const slides = items.length ? items : [{ id: "placeholder", name: tr(...BRAND), icon: "🌸", rarity: "SSR" }];
  const [active, setActive] = useState(0);
  // MP-069：進抽卡頁就預載召喚影片，避免召喚時先看到 WebView 的灰底播放鈕。
  useEffect(() => { preloadSummonVideos(); }, []);
  useEffect(() => {
    if (slides.length < 2) return undefined;
    const timer = window.setInterval(() => setActive((current) => (current + 1) % slides.length), 4500);
    return () => window.clearInterval(timer);
  }, [slides.length]);
  const current = withGachaCardArt(slides[active] || slides[0]);
  const palette = colors[current.rarity] || colors.SR;
  return <section className="sg-carousel" aria-label={tr("召喚卡面輪播", "Summon card carousel", "召喚カードのカルーセル", "소환 카드 캐러셀")}>
    <div className="sg-carousel-track" style={{ background: `linear-gradient(145deg,${palette[0]},${palette[1]})` }}>
      <div key={current.id} className="sg-carousel-slide">
        {current.art ? <img className="sg-carousel-image" src={current.art} alt={current.name} /> : <div className="sg-carousel-placeholder"><span>{current.icon || "🌸"}</span><small>SAKURA VOW</small></div>}
        <div className="sg-carousel-shade" />
        <div className="sg-carousel-copy"><small>{current.rarity || "LIMITED"} · {tr(...BRAND)}</small><h1>{current.name}</h1><p>{current.quote || tr("翻開命運，收藏屬於你們的故事", "Turn over fate and collect your stories", "運命をめくり、ふたりの物語を集めよう", "운명을 펼쳐 두 사람의 이야기를 모아 보세요")}</p></div>
      </div>
    </div>
  </section>;
}
export default function GachaGame({ characters = [], onBack, onOpenChat, tr: trProp }) {
  const tr = typeof trProp === "function" ? trProp : (...translations) => translate(uiLocale(), ...translations);
  const { inventory, crystals, draw, startEpisode, gachaProgress } = useGacha();
  const [oddsOpen, setOddsOpen] = useState(false);
  // MP-074：十連角標與說明用的保底剩餘抽數（目前只有常駐池；限定池上線時改成依卡池讀計數）。
  const pityLeft = drawsUntilGuaranteedSsr(gachaProgress);
  const poolRates = getGachaPool(DEFAULT_GACHA_POOL_ID)?.rates || DEFAULT_GACHA_RATES;
  const [tab, setTab] = useState("summon");
  const [filter, setFilter] = useState("ALL");
  const [reveals, setReveals] = useState([]);
  const [preview, setPreview] = useState(null);
  const [gift, setGift] = useState(null);
  const [characterId, setCharacterId] = useState("");
  const [mode, setMode] = useState("reality");
  // 抽卡畫面循環播放背景音樂（召喚演出時不中斷），離開就停；玩家在聽音樂 App 時不放。
  const { isPlaying: musicAppPlaying } = useMusicPlayer();
  useEffect(() => { setGachaBgmSuppressed(musicAppPlaying); }, [musicAppPlaying]);
  useEffect(() => { playGachaBgm(); return () => stopGachaBgm(); }, []);
  const groupedInventory = useMemo(() => {
    const groups = new Map();
    inventory.forEach((item) => {
      // 同一張卡若來自不同卡池分開計數（MP-054）
      const key = `${resolveGachaPoolId(item.poolId)}:${item.id}`;
      const existing = groups.get(key);
      if (existing) existing.count += 1;
      else groups.set(key, { ...withGachaCardArt(item), groupKey: key, count: 1 });
    });
    return [...groups.values()];
  }, [inventory]);
  // MP-054：只有存在兩個以上卡池時才顯示卡池篩選列
  const pools = useMemo(() => listGachaPools(), []);
  const showPoolFilter = pools.length > 1;
  const [poolFilter, setPoolFilter] = useState("ALL");
  const visible = useMemo(() => groupedInventory.filter((item) => (filter === "ALL" || item.rarity === filter) && (!showPoolFilter || poolFilter === "ALL" || resolveGachaPoolId(item.poolId) === poolFilter)), [groupedInventory, filter, poolFilter, showPoolFilter]);
  const crystalsLabel = tr("靈魂結晶", "Soul crystals", "ソウルクリスタル", "영혼 결정");
  const summon = (count) => {
    const cost = count === 10 ? 1800 : 180;
    const costText = cost.toLocaleString();
    if (crystals < cost || !confirmLocalized(tr(`確定消耗 ${costText} 靈魂結晶進行召喚？`, `Spend ${costText} soul crystals on this summon?`, `ソウルクリスタル ${costText} 個を消費して召喚しますか？`, `영혼 결정 ${costText}개를 사용해 소환할까요?`))) return;
    setReveals(draw(count) || []);
  };
  const confirmGift = () => {
    const character = characters.find((item) => String(item.id) === String(characterId));
    if (!gift || !character) return;
    startEpisode({ itemUid: gift.uid, characterId: character.id, characterName: character.name, mode });
    setGift(null); onOpenChat?.();
  };
  return <div className={`${SUB_PAGE_CLASS} sg-game`} style={{ color: "var(--mp-txt)", overflowY: "auto" }}>
    <style>{`
      .sg-game button{font-family:inherit}.sg-button{width:auto;min-width:0;min-height:42px;height:auto;border:1px solid var(--mp-line);border-radius:14px;padding:9px 12px;display:flex;align-items:center;justify-content:center;background:var(--mp-lv1);color:var(--mp-txt);font-size:14px;font-weight:800;line-height:1.35;white-space:normal;cursor:pointer}.sg-button:active{transform:scale(.98)}.sg-button:disabled{opacity:.42}.sg-button-primary{background:var(--mp-primary-gradient);border-color:transparent;color:#fff}.sg-tabs{padding:8px 18px 0}.sg-tabs .mp-seg{margin-bottom:8px}.sg-draw-buttons{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:18px}.sg-draw-buttons .sg-button{min-height:62px}.sg-collection-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:14px}.sg-collection-count{display:flex;flex-direction:column;gap:2px}.sg-collection-count small{color:var(--mp-txt-l);font-weight:500}.sg-filter-row{display:flex;flex-wrap:nowrap;gap:3px}.sg-filter-button{border:0;background:transparent;color:inherit;border-radius:8px;padding:6px 8px;font-size:12px}.sg-filter-button.active{background:var(--mp-txt);color:var(--mp-lv0)}.sg-card-art{position:relative}.sg-card-count{position:absolute;right:9px;top:9px;z-index:1;min-width:31px;padding:4px 7px;border-radius:14px;background:rgba(48,35,44,.82);border:1px solid rgba(255,255,255,.48);box-shadow:0 3px 10px rgba(0,0,0,.18);color:#fff;font-size:11px;font-weight:900;text-align:center;line-height:1}.sg-gift-modal h3{margin-top:2px;line-height:1.4}.sg-gift-modal .mp-inp{display:block;margin:10px 0 12px;min-height:44px;font-size:14px}.sg-gift-modes{display:grid;grid-template-columns:1fr;gap:8px;margin:12px 0}.sg-gift-modes .sg-button{flex-direction:column;gap:3px}.sg-gift-modes small{font-size:var(--mp-fs-caption);font-weight:400}.sg-gift-confirm{width:100%;margin-top:14px}.sg-crystals{margin-left:auto;font-size:12px;font-weight:800;white-space:nowrap}.sg-header-right{display:flex;align-items:center;gap:2px;margin-left:auto}@media(max-width:360px){.sg-collection-head{align-items:flex-start;flex-direction:column}.sg-filter-row{align-self:stretch}.sg-filter-button{flex:1}.sg-tabs{padding-inline:12px}}
    `}</style>
    <style>{`
      .sg-carousel{position:relative}.sg-carousel-track{position:relative;aspect-ratio:4/3;min-height:310px;border-radius:28px;overflow:hidden;box-shadow:0 18px 40px rgba(87,54,70,.22);isolation:isolate}.sg-carousel-image{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.sg-carousel-placeholder{position:absolute;inset:0;display:grid;place-content:center;gap:10px;color:#fff;text-shadow:0 4px 16px #0005}.sg-carousel-placeholder span{font-size:76px}.sg-carousel-placeholder small{font-weight:900;letter-spacing:.28em}.sg-carousel-shade{position:absolute;inset:0;background:linear-gradient(180deg,transparent 38%,rgba(33,21,31,.78) 100%)}.sg-carousel-copy{position:absolute;z-index:1;left:24px;right:24px;bottom:23px;color:#fff;text-align:left;text-shadow:0 2px 12px #0008}.sg-carousel-copy small{font-size:11px;font-weight:900;letter-spacing:.12em}.sg-carousel-copy h1{margin:5px 0 3px;font:900 27px serif}.sg-carousel-copy p{margin:0;font-size:12px;opacity:.88;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sg-carousel-arrow{position:absolute;z-index:2;top:50%;width:34px;height:44px;border:0;border-radius:18px;background:rgba(30,20,29,.3);color:#fff;font-size:29px;line-height:1;transform:translateY(-50%);backdrop-filter:blur(5px)}.sg-carousel-arrow.prev{left:9px}.sg-carousel-arrow.next{right:9px}.sg-carousel-dots{display:flex;justify-content:center;gap:6px;padding-top:11px}.sg-carousel-dots button{width:6px;height:6px;padding:0;border:0;border-radius:99px;background:#d9cbd1;transition:.2s}.sg-carousel-dots button.active{width:20px;background:#c85f83}@media(max-width:360px){.sg-carousel-copy{left:18px;right:18px}.sg-carousel-arrow{display:none}}
    `}</style>
    <style>{`
      .sg-card-art img{width:100%;height:100%;object-fit:cover;border-radius:inherit}.sg-preview-overlay{z-index:105;background:rgba(25,18,29,.92);padding:18px}.sg-preview-shell{position:relative;width:min(100%,430px);height:min(92vh,760px);display:flex;flex-direction:column;align-items:center;gap:12px}.sg-preview-close,.sg-preview-frame-toggle{position:absolute;z-index:3;top:4px;width:42px;height:42px;border:1px solid #ffffff55;border-radius:50%;background:#241a2dcc;color:#fff;font-size:19px;backdrop-filter:blur(8px)}.sg-preview-close{right:0}.sg-preview-frame-toggle{left:0}.sg-preview-card{position:relative;max-width:100%;flex:1;min-height:0;aspect-ratio:3/4;border-radius:26px;overflow:hidden;display:grid;place-items:center;background:linear-gradient(145deg,#504160,#f0bfd5);font-size:80px;transition:.2s}.sg-preview-card img{width:100%;height:100%;object-fit:contain;background:#17121c}.sg-preview-card.framed{padding:7px;border:2px solid var(--rarity-color);box-shadow:0 0 0 2px #211827,0 0 24px var(--rarity-glow),0 18px 45px #0009}.sg-preview-card.framed:before{content:"";position:absolute;z-index:1;inset:7px;border:1px solid color-mix(in srgb,var(--rarity-color) 70%,#fff);border-radius:18px;pointer-events:none}.sg-preview-meta{color:#fff;text-align:center}.sg-preview-meta h2{margin:0 0 3px;font:900 23px serif}.sg-preview-meta small{opacity:.72}.sg-preview-actions{display:grid;grid-template-columns:1fr;gap:10px;width:100%}.sg-preview-actions button{min-height:46px;border-radius:15px}.sg-preview-secondary{border:1px solid #ffffff55;background:#ffffff14;color:#fff}.sg-preview-gift{border:0;background:linear-gradient(135deg,#ed8dae,#c8537b);color:#fff;font-weight:900}
    `}</style>
    <style>{`.sg-carousel-track{width:min(100%,360px);min-height:0;margin:0 auto;aspect-ratio:3/4}.sg-carousel-slide{position:absolute;inset:0;animation:sgCarouselReveal .8s cubic-bezier(.2,.75,.25,1) both}.sg-carousel-slide .sg-carousel-image,.sg-carousel-slide .sg-carousel-placeholder{animation:sgCarouselArt 1.1s ease-out both}@keyframes sgCarouselReveal{from{opacity:0;transform:translateY(9px) scale(.975)}to{opacity:1;transform:translateY(0) scale(1)}}@keyframes sgCarouselArt{from{transform:scale(1.055)}to{transform:scale(1)}}@media(prefers-reduced-motion:reduce){.sg-carousel-slide,.sg-carousel-slide .sg-carousel-image,.sg-carousel-slide .sg-carousel-placeholder{animation:none}}`}</style>
    <style>{`.sg-carousel-slide{animation-duration:1.45s}.sg-carousel-slide .sg-carousel-image,.sg-carousel-slide .sg-carousel-placeholder{animation-duration:1.8s}@keyframes sgCarouselReveal{from{opacity:0;transform:translateX(42px) scale(.985)}to{opacity:1;transform:translateX(0) scale(1)}}`}</style>
    <style>{`.sg-card-art{box-sizing:border-box;overflow:hidden}.sg-card-art.sg-card-ssr{border:3px solid #f4d574;box-shadow:0 0 0 1px #fff3bd88,0 8px 20px #d3a83b55}.sg-card-art.sg-card-sr{border:3px solid #e9a1ca;box-shadow:0 0 0 1px #ffd9ee77,0 7px 18px #d76fa24d}.sg-card-art.sg-card-r{border:2px solid #aeb9ea;box-shadow:0 0 0 1px #dce2ff66,0 6px 15px #6875ad44}.sg-preview-card.framed{border-width:4px;box-shadow:0 0 0 2px #211827,0 0 30px var(--rarity-glow),inset 0 0 0 1px var(--rarity-color),0 18px 45px #0009}`}</style>
    <style>{`.sg-card-art.has-art{border:0;box-shadow:none;border:0!important;box-shadow:0 7px 18px #49344244!important}.sg-card-art.has-art .sg-card-count{z-index:5}.sg-preview-card:has(.sg-v3-card){width:min(82vw,380px);max-width:100%;height:auto;flex:0 0 auto;aspect-ratio:2/3;padding:0;border-radius:18px}.sg-preview-card .sg-v3-card-art{object-fit:var(--sg-card-fit,cover);background:transparent}.sg-preview-card .sg-v3-card-frame{object-fit:fill;background:transparent}`}</style>
    <style>{`.sg-preview-shell{box-sizing:border-box;padding-top:50px}.sg-preview-close{top:0;right:0}`}</style>
    <style>{`.sg-pool-filter-row{flex-wrap:wrap;margin:-6px 0 12px}.sg-pool-filter-row .sg-filter-button{border:1px solid var(--mp-line);background:var(--mp-lv1)}.sg-pool-filter-row .sg-filter-button.active{border-color:transparent}.sg-preview-card .sg-pool-badge{left:14px;top:14px;font-size:12px;padding:4px 9px}`}</style>
    <style>{`
      .sg-summon-stage{position:relative;flex:1 1 auto;min-height:0;overflow:hidden;text-align:left}
      .sg-summon-stage .sg-carousel{position:absolute;inset:0;height:100%}
      .sg-summon-stage .sg-carousel-track{width:100%;height:100%;min-height:0;margin:0;border-radius:0;aspect-ratio:auto;box-shadow:none}
      .sg-summon-stage .sg-carousel-slide{inset:0}
      .sg-summon-stage .sg-carousel-image{object-fit:cover}
      .sg-summon-stage .sg-carousel-shade{background:linear-gradient(180deg,rgba(18,11,18,.18) 0,transparent 24%,transparent 44%,rgba(18,11,18,.62) 74%,rgba(14,9,15,.94) 100%)}
      .sg-summon-stage .sg-carousel-copy{bottom:158px}
      .sg-summon-actions{position:absolute;left:0;right:0;bottom:0;z-index:2;padding:14px 20px calc(18px + env(safe-area-inset-bottom))}
      .sg-summon-actions .sg-draw-buttons{margin-top:0}
      .sg-summon-actions .sg-odds{display:block;margin:10px 0 0;text-align:center;color:rgba(255,255,255,.72);font-size:11px;font-weight:500;letter-spacing:.02em;text-shadow:0 1px 4px rgba(0,0,0,.5)}
      .sg-odds-link{border:0;background:transparent;padding:6px 2px;color:#fff;font:inherit;font-weight:700;text-decoration:underline;text-underline-offset:2px;cursor:pointer}
      .sg-summon-stage .sg-draw-ten{position:relative;overflow:visible}
      .sg-pity-badge{position:absolute;top:-9px;right:-4px;padding:2px 7px;border-radius:9px;background:#ffd88a;color:#5c3a06;font-size:11px;font-weight:800;line-height:1.3;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.25);text-shadow:none}
      .sg-summon-stage .sg-draw-single{background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.55);color:#fff;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);text-shadow:0 1px 4px rgba(0,0,0,.45)}
      .sg-summon-stage .sg-draw-single small{opacity:.86}
      .sg-summon-stage .sg-draw-ten{background:linear-gradient(135deg,#ef8db0,#c8537b);border-color:transparent;color:#fff;box-shadow:0 10px 24px rgba(160,50,90,.5)}
      .sg-summon-stage .sg-draw-ten small{opacity:.9}
      .sg-summon-stage .sg-button:disabled{opacity:.5}
    `}</style>
    <AppHeader
      title={tr(...BRAND)}
      onBack={onBack}
      backLabel={tr("返回遊戲中心", "Back to Game Center", "ゲームセンターに戻る", "게임 센터로 돌아가기")}
      right={<div className="sg-header-right"><GachaMuteButton tr={tr} /><b className="sg-crystals" aria-label={`${crystalsLabel} ${crystals.toLocaleString()}`}>💎 {crystals.toLocaleString()}</b></div>}
    />
    <div className="sg-tabs">
      <SegmentedControl
        ariaLabel={tr("櫻色誓約分頁", "Sakura Vow tabs", "桜色の誓いのタブ", "벚꽃빛 서약 탭")}
        value={tab}
        onChange={setTab}
        items={[
          { id: "summon", label: tr("心動召喚", "Summon", "ときめき召喚", "두근 소환") },
          { id: "collection", label: tr("我的珍藏", "Collection", "コレクション", "내 컬렉션") },
        ]}
      />
    </div>
    {tab === "summon" ? <div className="sg-summon-stage">
      <GachaCarousel items={GACHA_POOL} tr={tr} />
      <div className="sg-summon-actions">
        <div className="sg-draw-buttons"><button className="sg-button sg-draw-single" disabled={crystals < 180} onClick={() => summon(1)}><span>{tr("單次思念", "Single wish", "一回召喚", "1회 소환")}<br/><small>180 {crystalsLabel}</small></span></button><button className="sg-button sg-button-primary sg-draw-ten" disabled={crystals < 1800} onClick={() => summon(10)}><span>{tr("十連守候", "Ten wishes", "十連召喚", "10연속 소환")}<br/><small>1,800 {crystalsLabel}</small></span><b className="sg-pity-badge" aria-hidden="true">{tr(`再 ${pityLeft} 抽`, `${pityLeft} to go`, `あと${pityLeft}回`, `${pityLeft}회 남음`)}</b></button></div>
        <p className="sg-odds">{tr(`再 ${pityLeft} 抽必得 SSR`, `SSR guaranteed within ${pityLeft} draws`, `あと${pityLeft}回以内にSSR確定`, `${pityLeft}회 안에 SSR 확정`)} · <button type="button" className="sg-odds-link" onClick={() => setOddsOpen(true)}>{tr("機率說明", "Rates", "提供割合", "확률 안내")}</button></p>
      </div>
    </div> : <div style={{ padding: 18 }}>
      <div className="sg-collection-head"><div className="sg-collection-count"><b>{tr(`已收藏 ${inventory.length} 份`, `${inventory.length} collected`, `${inventory.length} 枚を収集`, `${inventory.length}개 수집`)}</b><small>{tr(`${groupedInventory.length} 種心意`, `${groupedInventory.length} kinds`, `${groupedInventory.length} 種類の想い`, `${groupedInventory.length}종류의 마음`)}</small></div><div className="sg-filter-row">{["ALL","SSR","SR","R"].map((key) => <button key={key} className={`sg-filter-button ${filter === key ? "active" : ""}`} onClick={() => setFilter(key)}>{key === "ALL" ? tr("全部", "All", "すべて", "전체") : key}</button>)}</div></div>
      {showPoolFilter && <div className="sg-filter-row sg-pool-filter-row" role="group" aria-label={tr("卡池篩選", "Pool filter", "ガチャプールで絞り込み", "카드 풀 필터")}><button className={`sg-filter-button ${poolFilter === "ALL" ? "active" : ""}`} onClick={() => setPoolFilter("ALL")}>{tr("全部卡池", "All pools", "すべてのプール", "모든 카드 풀")}</button>{pools.map((pool) => <button key={pool.id} className={`sg-filter-button ${poolFilter === pool.id ? "active" : ""}`} onClick={() => setPoolFilter(pool.id)}>{tr(pool.label)}</button>)}</div>}
      {visible.length ? <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>{visible.map((item) => { const palette = colors[item.rarity]; return <button key={item.groupKey || item.id} onClick={() => { setPreview(item); }} style={{ border: 0, background: "transparent", color: "inherit", textAlign: "left", padding: 0 }}><div className={`sg-card-art sg-card-${item.rarity.toLowerCase()} ${item.art ? "has-art" : ""}`} style={{ aspectRatio: item.art ? "2/3" : "3/4", borderRadius: 18, display: "grid", placeItems: "center", fontSize: 48, background: `linear-gradient(145deg,${palette[0]},${palette[1]})` }}><GachaPoolBadge poolId={item.poolId} tr={tr} />{item.count > 1 && <span className="sg-card-count">×{item.count}</span>}{item.art ? <GachaCardVisual item={item} thumbnail /> : item.icon}</div><b style={{ display: "block", marginTop: 7 }}>{item.name}</b><small>{item.rarity} · {tr("點擊查看", "Tap to view", "タップして表示", "눌러서 보기")}</small></button>; })}</div> : <EmptyState icon="flower" compact title={tr("尚未收藏任何心意", "No cards collected yet", "まだ想いを収集していません", "아직 수집한 마음이 없어요")} text={tr("到「心動召喚」抽一次試試", "Try a summon in the Summon tab", "「ときめき召喚」で引いてみよう", "소환 탭에서 한 번 뽑아 보세요")} />}
    </div>}
    {oddsOpen && createPortal(<GachaOddsSheet pool={GACHA_POOL} rates={poolRates} progress={gachaProgress} poolLabel={getGachaPoolLabel(DEFAULT_GACHA_POOL_ID, uiLocale())} onClose={() => setOddsOpen(false)} tr={tr} />, document.querySelector(".mp-phone") || document.body)}
    {!!reveals.length && createPortal(<GachaRevealSequence items={reveals} onClose={() => setReveals([])} tr={tr} />, document.querySelector(".mp-phone") || document.body)}
    {preview && createPortal(<div className="mp-overlay sg-preview-overlay" onClick={() => setPreview(null)}><div className="sg-preview-shell" onClick={(event) => event.stopPropagation()}><button className="sg-preview-close" type="button" aria-label={tr("關閉卡片", "Close card", "カードを閉じる", "카드 닫기")} onClick={() => setPreview(null)}>×</button><div className="sg-preview-card" style={{ aspectRatio: preview.art ? "2/3" : "3/4", "--rarity-color": preview.rarity === "SSR" ? "#f2cf67" : preview.rarity === "SR" ? "#e79ac2" : "#aeb7e8", "--rarity-glow": preview.rarity === "SSR" ? "#ffd86d88" : preview.rarity === "SR" ? "#ef9ac877" : "#9aa8dc66", background: `linear-gradient(145deg,${colors[preview.rarity]?.[0] || colors.R[0]},${colors[preview.rarity]?.[1] || colors.R[1]})` }}><GachaPoolBadge poolId={preview.poolId} tr={tr} />{preview.art ? <GachaCardVisual item={preview} fit="contain" /> : preview.icon}</div><div className="sg-preview-meta"><h2>{preview.name}</h2><small>{preview.rarity} · {tr("收藏", "Owned", "所持", "보유")} ×{preview.count || 1}</small></div><div className="sg-preview-actions"><button className="sg-preview-gift" type="button" onClick={() => { setGift(preview); setCharacterId(""); setPreview(null); }}>{tr("開啟特別篇", "Start a special episode", "特別編を始める", "특별편 시작")}</button></div></div></div>, document.querySelector(".mp-phone") || document.body)}
    {gift && createPortal(<div className="mp-overlay" onClick={() => setGift(null)}><div className="mp-modal sg-gift-modal" onClick={(event) => event.stopPropagation()}><h3>{tr(`與誰展開「${gift.name}」的故事？`, `Who will share the story of "${gift.name}"?`, `誰と「${gift.name}」の物語を始めますか？`, `누구와 「${gift.name}」 이야기를 시작할까요?`)}</h3><select className="mp-inp" value={characterId} onChange={(event) => setCharacterId(event.target.value)}><option value="">{tr("選擇角色", "Choose a character", "キャラクターを選択", "캐릭터 선택")}</option>{characters.map((character) => <option key={character.id} value={character.id}>{character.name}</option>)}</select><div className="sg-gift-modes"><button className="sg-button" onClick={() => setMode("reality")} style={{ outline: mode === "reality" ? "2px solid var(--mp-pink-dk)" : "none" }}>{tr("就在你身邊", "Right by your side", "すぐそばで", "바로 네 곁에서")}<small>{tr("一起走進這段故事。", "Step into this story together.", "一緒に、この物語へ。", "함께 이 이야기 속으로.")}</small></button><button className="sg-button" onClick={() => setMode("online")} style={{ outline: mode === "online" ? "2px solid var(--mp-pink-dk)" : "none" }}>{tr("在螢幕那一端", "On the other side of the screen", "画面の向こうで", "화면 너머에서")}<small>{tr("從一則訊息，展開你們的故事。", "Let your story begin with a message.", "ひとつのメッセージから、ふたりの物語が始まる。", "메시지 하나로 두 사람의 이야기를 시작해요.")}</small></button></div><small>{tr("將消耗此珍藏 ×1", "Uses 1 copy of this card", "このカードを1枚消費します", "이 카드 1장을 사용해요")}</small><button className="sg-button sg-button-primary sg-gift-confirm" disabled={!characterId} onClick={confirmGift}>{tr("開啟特別篇", "Start a special episode", "特別編を始める", "특별편 시작")}</button></div></div>, document.querySelector(".mp-phone") || document.body)}
  </div>;
}
