import React from "react";
import Icon from "./Icon";

// 名字第一個「字」（含 emoji、韓文等組合字也只取一個）。
function firstGlyph(name) {
  const text = String(name || "").trim();
  if (!text) return "";
  try {
    const segmenter = typeof Intl !== "undefined" && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;
    if (segmenter) return segmenter.segment(text)[Symbol.iterator]().next().value?.segment || "";
  } catch { /* 舊瀏覽器退回 Array.from */ }
  return Array.from(text)[0] || "";
}

// 沒有頭像圖片時的共用替代：名字第一個字放在主題色漸層上；沒有名字時顯示線條人像。
// 放在既有頭像容器裡會填滿容器並沿用容器圓角，所以各頁原本的尺寸與形狀都不用改。
export function AvatarFallback({ name, icon = "user" }) {
  const glyph = firstGlyph(name);
  return (
    <span className="mp-av-fallback" aria-hidden="true">
      {glyph ? <span className="mp-av-glyph">{glyph}</span> : <Icon name={icon} size={20} />}
    </span>
  );
}

// 獨立使用的頭像：有圖顯示圖，沒圖顯示 AvatarFallback。
export default function Avatar({ src, name, size = 40, shape = "circle", icon = "user", className = "", alt = "" }) {
  return (
    <span
      className={`mp-avatar mp-avatar--${shape} ${className}`.trim()}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
    >
      {src ? <img src={src} alt={alt} draggable={false} /> : <AvatarFallback name={name} icon={icon} />}
    </span>
  );
}
