import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { GACHA_POOL, useGacha } from "../../contexts/GachaContext";
import GachaRevealSequence from "./GachaRevealSequence";
import GachaCardVisual from "./GachaCardVisual";

const colors = { SSR: ["#504160", "#f0bfd5"], SR: ["#a66f81", "#f5d2dc"], R: ["#74769c", "#dddff3"] };

function GachaCarousel({ items = [] }) {
  const slides = items.length ? items : [{ id: "placeholder", name: "櫻色誓約", icon: "🌸", rarity: "SSR" }];
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (slides.length < 2) return undefined;
    const timer = window.setInterval(() => setActive((current) => (current + 1) % slides.length), 4500);
    return () => window.clearInterval(timer);
  }, [slides.length]);
  const current = slides[active] || slides[0];
  const palette = colors[current.rarity] || colors.SR;
  return <section className="sg-carousel" aria-label="召喚卡面輪播">
    <div className="sg-carousel-track" style={{ background: `linear-gradient(145deg,${palette[0]},${palette[1]})` }}>
      <div key={current.id} className="sg-carousel-slide">
        {current.art ? <img className="sg-carousel-image" src={current.art} alt={current.name} /> : <div className="sg-carousel-placeholder"><span>{current.icon || "🌸"}</span><small>SAKURA VOW</small></div>}
        <div className="sg-carousel-shade" />
        <div className="sg-carousel-copy"><small>{current.rarity || "LIMITED"} · 櫻色誓約</small><h1>{current.name}</h1><p>{current.quote || "翻開命運，收藏一份能送給他的心意"}</p></div>
      </div>
    </div>
  </section>;
}
export default function GachaGame({ characters = [], onBack, onOpenChat }) {
  const { inventory, crystals, draw, startEpisode } = useGacha();
  const [tab, setTab] = useState("summon");
  const [filter, setFilter] = useState("ALL");
  const [reveals, setReveals] = useState([]);
  const [preview, setPreview] = useState(null);
  const [showPreviewFrame, setShowPreviewFrame] = useState(true);
  const [gift, setGift] = useState(null);
  const [characterId, setCharacterId] = useState("");
  const [mode, setMode] = useState("reality");
  const groupedInventory = useMemo(() => {
    const groups = new Map();
    inventory.forEach((item) => {
      const existing = groups.get(item.id);
      if (existing) existing.count += 1;
      else groups.set(item.id, { ...item, count: 1 });
    });
    return [...groups.values()];
  }, [inventory]);
  const visible = useMemo(() => filter === "ALL" ? groupedInventory : groupedInventory.filter((item) => item.rarity === filter), [groupedInventory, filter]);
  const summon = (count) => {
    const cost = count === 10 ? 1800 : 180;
    if (crystals < cost || !confirm(`確定消耗 ${cost.toLocaleString()} 靈魂結晶進行召喚？`)) return;
    setReveals(draw(count) || []);
  };
  const confirmGift = () => {
    const character = characters.find((item) => String(item.id) === String(characterId));
    if (!gift || !character) return;
    startEpisode({ itemUid: gift.uid, characterId: character.id, characterName: character.name, mode });
    setGift(null); onOpenChat?.();
  };
  return <div className="mp-page sg-game" style={{ background: "#fffaf8", color: "#4f3d46", overflowY: "auto" }}>
    <style>{`
      .sg-game button{font-family:inherit}.sg-button{width:auto;min-width:0;min-height:42px;height:auto;border:1px solid #ead9df;border-radius:14px;padding:9px 12px;display:flex;align-items:center;justify-content:center;background:#fff;color:#59464f;font-size:14px;font-weight:800;line-height:1.35;white-space:normal;cursor:pointer}.sg-button:active{transform:scale(.98)}.sg-button:disabled{opacity:.42}.sg-button-primary{background:linear-gradient(135deg,#70545f,#4d3d45);border-color:transparent;color:#fff}.sg-tabs{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:8px 18px}.sg-tab-button{border:0;border-radius:12px;padding:10px;background:transparent;color:#9a858e;font-size:15px;font-weight:800;line-height:1.2}.sg-tab-button.active{background:#f8e7ed;color:#c85f83}.sg-draw-buttons{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:18px}.sg-draw-buttons .sg-button{min-height:62px}.sg-collection-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:14px}.sg-collection-count{display:flex;flex-direction:column;gap:2px}.sg-collection-count small{color:#9c8991;font-weight:500}.sg-filter-row{display:flex;flex-wrap:nowrap;gap:3px}.sg-filter-button{border:0;background:transparent;color:inherit;border-radius:8px;padding:6px 8px;font-size:12px}.sg-filter-button.active{background:#57454e;color:#fff}.sg-card-art{position:relative}.sg-card-count{position:absolute;right:9px;top:9px;z-index:1;min-width:31px;padding:4px 7px;border-radius:14px;background:rgba(48,35,44,.82);border:1px solid rgba(255,255,255,.48);box-shadow:0 3px 10px rgba(0,0,0,.18);color:#fff;font-size:11px;font-weight:900;text-align:center;line-height:1}.sg-gift-modal h3{margin-top:2px;line-height:1.4}.sg-gift-modal .mp-inp{display:block;margin:10px 0 12px;min-height:44px;font-size:14px}.sg-gift-modes{display:grid;grid-template-columns:1fr;gap:8px;margin:12px 0}.sg-gift-confirm{width:100%;margin-top:14px}@media(max-width:360px){.sg-collection-head{align-items:flex-start;flex-direction:column}.sg-filter-row{align-self:stretch}.sg-filter-button{flex:1}.sg-tabs{padding-inline:12px}}
    `}</style>
    <style>{`
      .sg-carousel{position:relative}.sg-carousel-track{position:relative;aspect-ratio:4/3;min-height:310px;border-radius:28px;overflow:hidden;box-shadow:0 18px 40px rgba(87,54,70,.22);isolation:isolate}.sg-carousel-image{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.sg-carousel-placeholder{position:absolute;inset:0;display:grid;place-content:center;gap:10px;color:#fff;text-shadow:0 4px 16px #0005}.sg-carousel-placeholder span{font-size:76px}.sg-carousel-placeholder small{font-weight:900;letter-spacing:.28em}.sg-carousel-shade{position:absolute;inset:0;background:linear-gradient(180deg,transparent 38%,rgba(33,21,31,.78) 100%)}.sg-carousel-copy{position:absolute;z-index:1;left:24px;right:24px;bottom:23px;color:#fff;text-align:left;text-shadow:0 2px 12px #0008}.sg-carousel-copy small{font-size:10px;font-weight:900;letter-spacing:.12em}.sg-carousel-copy h1{margin:5px 0 3px;font:900 27px serif}.sg-carousel-copy p{margin:0;font-size:12px;opacity:.88;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sg-carousel-arrow{position:absolute;z-index:2;top:50%;width:34px;height:44px;border:0;border-radius:18px;background:rgba(30,20,29,.3);color:#fff;font-size:29px;line-height:1;transform:translateY(-50%);backdrop-filter:blur(5px)}.sg-carousel-arrow.prev{left:9px}.sg-carousel-arrow.next{right:9px}.sg-carousel-dots{display:flex;justify-content:center;gap:6px;padding-top:11px}.sg-carousel-dots button{width:6px;height:6px;padding:0;border:0;border-radius:99px;background:#d9cbd1;transition:.2s}.sg-carousel-dots button.active{width:20px;background:#c85f83}.sg-carousel+div{display:none!important}@media(max-width:360px){.sg-carousel-copy{left:18px;right:18px}.sg-carousel-arrow{display:none}}
    `}</style>
    <style>{`
      .sg-card-art img{width:100%;height:100%;object-fit:cover;border-radius:inherit}.sg-preview-overlay{z-index:105;background:rgba(25,18,29,.92);padding:18px}.sg-preview-shell{position:relative;width:min(100%,430px);height:min(92vh,760px);display:flex;flex-direction:column;align-items:center;gap:12px}.sg-preview-close,.sg-preview-frame-toggle{position:absolute;z-index:3;top:4px;width:42px;height:42px;border:1px solid #ffffff55;border-radius:50%;background:#241a2dcc;color:#fff;font-size:19px;backdrop-filter:blur(8px)}.sg-preview-close{right:0}.sg-preview-frame-toggle{left:0}.sg-preview-card{position:relative;max-width:100%;flex:1;min-height:0;aspect-ratio:3/4;border-radius:26px;overflow:hidden;display:grid;place-items:center;background:linear-gradient(145deg,#504160,#f0bfd5);font-size:80px;transition:.2s}.sg-preview-card img{width:100%;height:100%;object-fit:contain;background:#17121c}.sg-preview-card.framed{padding:7px;border:2px solid var(--rarity-color);box-shadow:0 0 0 2px #211827,0 0 24px var(--rarity-glow),0 18px 45px #0009}.sg-preview-card.framed:before{content:"";position:absolute;z-index:1;inset:7px;border:1px solid color-mix(in srgb,var(--rarity-color) 70%,#fff);border-radius:18px;pointer-events:none}.sg-preview-meta{color:#fff;text-align:center}.sg-preview-meta h2{margin:0 0 3px;font:900 23px serif}.sg-preview-meta small{opacity:.72}.sg-preview-actions{display:grid;grid-template-columns:1fr 1.35fr;gap:10px;width:100%}.sg-preview-actions button{min-height:46px;border-radius:15px}.sg-preview-secondary{border:1px solid #ffffff55;background:#ffffff14;color:#fff}.sg-preview-gift{border:0;background:linear-gradient(135deg,#ed8dae,#c8537b);color:#fff;font-weight:900}
    `}</style>
    <style>{`.sg-carousel-track{width:min(100%,360px);min-height:0;margin:0 auto;aspect-ratio:3/4}.sg-carousel-slide{position:absolute;inset:0;animation:sgCarouselReveal .8s cubic-bezier(.2,.75,.25,1) both}.sg-carousel-slide .sg-carousel-image,.sg-carousel-slide .sg-carousel-placeholder{animation:sgCarouselArt 1.1s ease-out both}@keyframes sgCarouselReveal{from{opacity:0;transform:translateY(9px) scale(.975)}to{opacity:1;transform:translateY(0) scale(1)}}@keyframes sgCarouselArt{from{transform:scale(1.055)}to{transform:scale(1)}}@media(prefers-reduced-motion:reduce){.sg-carousel-slide,.sg-carousel-slide .sg-carousel-image,.sg-carousel-slide .sg-carousel-placeholder{animation:none}}`}</style>
    <style>{`.sg-carousel-slide{animation-duration:1.45s}.sg-carousel-slide .sg-carousel-image,.sg-carousel-slide .sg-carousel-placeholder{animation-duration:1.8s}@keyframes sgCarouselReveal{from{opacity:0;transform:translateX(42px) scale(.985)}to{opacity:1;transform:translateX(0) scale(1)}}.sg-game>.mp-hdr .mp-htitle{color:#4f3d46!important;text-shadow:none}.sg-game>.mp-hdr .mp-back{color:#fff!important;background:rgba(79,61,70,.94)!important;border-color:rgba(79,61,70,.24)!important;box-shadow:0 3px 10px rgba(79,61,70,.2)!important}`}</style>
    <style>{`.sg-card-art{box-sizing:border-box;overflow:hidden}.sg-card-art.sg-card-ssr{border:3px solid #f4d574;box-shadow:0 0 0 1px #fff3bd88,0 8px 20px #d3a83b55}.sg-card-art.sg-card-sr{border:3px solid #e9a1ca;box-shadow:0 0 0 1px #ffd9ee77,0 7px 18px #d76fa24d}.sg-card-art.sg-card-r{border:2px solid #aeb9ea;box-shadow:0 0 0 1px #dce2ff66,0 6px 15px #6875ad44}.sg-preview-card.framed{border-width:4px;box-shadow:0 0 0 2px #211827,0 0 30px var(--rarity-glow),inset 0 0 0 1px var(--rarity-color),0 18px 45px #0009}`}</style>
    <style>{`.sg-card-art.has-art{border:0!important;box-shadow:0 7px 18px #49344244!important}.sg-card-art.has-art .sg-card-count{z-index:5}.sg-preview-card:has(.sg-v3-card){width:min(82vw,380px);max-width:100%;height:auto;flex:0 0 auto;aspect-ratio:2/3;padding:0;border-radius:18px}.sg-preview-card .sg-v3-card-art{object-fit:var(--sg-card-fit,cover);background:transparent}.sg-preview-card .sg-v3-card-frame{object-fit:fill;background:transparent}`}</style>
    <style>{`.sg-preview-shell{box-sizing:border-box;padding-top:50px}.sg-preview-close{top:0;right:0}`}</style>
    <div className="mp-hdr" style={{ position: "sticky", top: 0, zIndex: 3, background: "rgba(255,250,248,.94)" }}><div className="mp-back" onClick={onBack}>←</div><div className="mp-htitle">櫻色誓約</div><b style={{ marginLeft: "auto", fontSize: 12 }}>💎 {crystals.toLocaleString()}</b></div>
    <div className="sg-tabs">{[["summon","心動召喚"],["collection","我的珍藏"]].map(([key,label]) => <button key={key} className={`sg-tab-button ${tab === key ? "active" : ""}`} onClick={() => setTab(key)}>{label}</button>)}</div>
    {tab === "summon" ? <div style={{ padding: 20, textAlign: "center" }}>
      <GachaCarousel items={GACHA_POOL} />
      <div style={{ minHeight: 310, borderRadius: 28, padding: 30, display: "grid", placeItems: "center", background: "radial-gradient(circle at 50% 30%,#fff 0,#f8d8e3 32%,#71617c 100%)", boxShadow: "0 18px 40px rgba(87,54,70,.22)" }}><div><div style={{ fontSize: 70 }}>🌸</div><h1 style={{ fontFamily: "serif", margin: "10px 0" }}>櫻色誓約</h1><p>翻閱命運，收藏一份能送給他的心意</p></div></div>
      <div className="sg-draw-buttons"><button className="sg-button" disabled={crystals < 180} onClick={() => summon(1)}><span>單次思念<br/><small>180 靈魂結晶</small></span></button><button className="sg-button sg-button-primary" disabled={crystals < 1800} onClick={() => summon(10)}><span>十連守候<br/><small>1,800 靈魂結晶</small></span></button></div><small style={{ display: "block", marginTop: 16, opacity: .65 }}>SSR 4% · SR 26% · R 70%</small>
    </div> : <div style={{ padding: 18 }}>
      <div className="sg-collection-head"><div className="sg-collection-count"><b>已收藏 {inventory.length} 份</b><small>{groupedInventory.length} 種心意</small></div><div className="sg-filter-row">{["ALL","SSR","SR","R"].map((key) => <button key={key} className={`sg-filter-button ${filter === key ? "active" : ""}`} onClick={() => setFilter(key)}>{key === "ALL" ? "全部" : key}</button>)}</div></div>
      {visible.length ? <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>{visible.map((item) => { const palette = colors[item.rarity]; return <button key={item.id} onClick={() => { setPreview(item); setShowPreviewFrame(true); }} style={{ border: 0, background: "transparent", color: "inherit", textAlign: "left", padding: 0 }}><div className={`sg-card-art sg-card-${item.rarity.toLowerCase()} ${item.art ? "has-art" : ""}`} style={{ aspectRatio: item.art ? "2/3" : "3/4", borderRadius: 18, display: "grid", placeItems: "center", fontSize: 48, background: `linear-gradient(145deg,${palette[0]},${palette[1]})` }}>{item.count > 1 && <span className="sg-card-count">×{item.count}</span>}{item.art ? <GachaCardVisual item={item} /> : item.icon}</div><b style={{ display: "block", marginTop: 7 }}>{item.name}</b><small>{item.rarity} · 點擊查看</small></button>; })}</div> : <div className="mp-empty"><div className="mp-empty-i">🌸</div><div>尚未收藏任何心意</div></div>}
    </div>}
    {!!reveals.length && createPortal(<GachaRevealSequence items={reveals} onClose={() => setReveals([])} />, document.querySelector(".mp-phone") || document.body)}
    {preview && createPortal(<div className="mp-overlay sg-preview-overlay" onClick={() => setPreview(null)}><div className="sg-preview-shell" onClick={(event) => event.stopPropagation()}><button className="sg-preview-close" type="button" aria-label="關閉卡片" onClick={() => setPreview(null)}>×</button><div className={`sg-preview-card ${showPreviewFrame && !preview.art ? "framed" : ""}`} style={{ aspectRatio: preview.art ? "2/3" : "3/4", "--rarity-color": preview.rarity === "SSR" ? "#f2cf67" : preview.rarity === "SR" ? "#e79ac2" : "#aeb7e8", "--rarity-glow": preview.rarity === "SSR" ? "#ffd86d88" : preview.rarity === "SR" ? "#ef9ac877" : "#9aa8dc66", background: `linear-gradient(145deg,${colors[preview.rarity]?.[0] || colors.R[0]},${colors[preview.rarity]?.[1] || colors.R[1]})` }}>{preview.art ? <GachaCardVisual item={preview} framed={showPreviewFrame} fit={showPreviewFrame ? "cover" : "contain"} /> : preview.icon}</div><div className="sg-preview-meta"><h2>{preview.name}</h2><small>{preview.rarity} · 收藏 ×{preview.count || 1}</small></div><div className="sg-preview-actions"><button className="sg-preview-secondary" type="button" onClick={() => setShowPreviewFrame((value) => !value)}>{showPreviewFrame ? "查看純圖片" : "顯示卡框"}</button><button className="sg-preview-gift" type="button" onClick={() => { setGift(preview); setCharacterId(""); setPreview(null); }}>贈送給角色</button></div></div></div>, document.querySelector(".mp-phone") || document.body)}
    {gift && createPortal(<div className="mp-overlay" onClick={() => setGift(null)}><div className="mp-modal sg-gift-modal" onClick={(event) => event.stopPropagation()}><h3>把「{gift.name}」送給誰？</h3><select className="mp-inp" value={characterId} onChange={(event) => setCharacterId(event.target.value)}><option value="">選擇角色</option>{characters.map((character) => <option key={character.id} value={character.id}>{character.name}</option>)}</select><div className="sg-gift-modes"><button className="sg-button" onClick={() => setMode("reality")} style={{ outline: mode === "reality" ? "2px solid #ef8eb0" : "none" }}>親手送給他（現實）</button><button className="sg-button" onClick={() => setMode("online")} style={{ outline: mode === "online" ? "2px solid #ef8eb0" : "none" }}>將禮物寄給他（線上）</button></div><small>確認後才會消耗這份珍藏，並建立特別篇房間。</small><button className="sg-button sg-button-primary sg-gift-confirm" disabled={!characterId} onClick={confirmGift}>確認並進入特別篇</button></div></div>, document.querySelector(".mp-phone") || document.body)}
  </div>;
}
