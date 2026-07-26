import React from "react";

export default function GachaCardVisual({ item, framed = true, fit = "cover" }) {
  if (!item?.art) return null;
  const image = framed && item.framedArt ? item.framedArt : item.art;

  return <div className={`sg-v3-card ${framed ? "framed" : "plain"}`}>
    <style>{`.sg-v3-card{position:absolute;inset:0;overflow:hidden;border-radius:inherit}.sg-v3-card-art{position:absolute;inset:0;width:100%;height:100%;object-fit:var(--sg-card-fit,cover)}.sg-v3-card.plain .sg-v3-card-art{background:#17121c}`}</style>
    <img className="sg-v3-card-art" src={image} alt={item.name} style={{ "--sg-card-fit": fit }} />
  </div>;
}
