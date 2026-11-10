import React, { useState } from "react";
import { pseudoImageStyle } from "../../utils/pseudoImage";

// 示意圖片：只是色塊，不是真的圖。點一下才展開描述，平常看起來就像傳了一張照片。
export default function PseudoImageBubble({ pseudoImage, tr }) {
  const [open, setOpen] = useState(false);
  if (!pseudoImage?.desc) return null;
  return <div className="mp-pseudo-img-wrap">
    <button
      type="button"
      className="mp-pseudo-img"
      style={pseudoImageStyle(pseudoImage)}
      title={tr ? tr("點一下看說明", "Tap to view description", "タップして説明を見る", "탭하여 설명 보기") : "點一下看說明"}
      aria-label={tr ? tr("示意照片", "Mock photo", "イメージ写真", "가상 사진") : "示意照片"}
      onClick={(event) => { event.stopPropagation(); setOpen((previous) => !previous); }}
    />
    {open && <div className="mp-pseudo-img-desc">{pseudoImage.desc}</div>}
  </div>;
}
