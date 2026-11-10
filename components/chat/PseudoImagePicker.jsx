import React, { useState } from "react";
import { createPortal } from "react-dom";
import { createPseudoImage, pseudoImageStyle, PSEUDO_IMAGE_DESC_LIMIT } from "../../utils/pseudoImage";

// 讓玩家用文字「假裝」傳一張照片：對方（AI）只會讀到描述，畫面上則顯示色塊。
export default function PseudoImagePicker({ onCancel, onConfirm, tr }) {
  const [desc, setDesc] = useState("");
  const preview = createPseudoImage(desc);
  const overlay = <div className="mp-overlay" onClick={onCancel}>
    <div className="mp-modal" onClick={(event) => event.stopPropagation()}>
      <div className="mp-modal-t">{tr("傳送示意照片", "Send a mock photo", "イメージ写真を送る", "가상 사진 보내기")}</div>
      <div style={{ fontSize: 11, color: "var(--mp-txt-l)", lineHeight: 1.5, marginBottom: 10 }}>
        {tr(
          "不會真的傳圖片，畫面上顯示色塊，對方只會讀到你寫的描述。",
          "No real image is sent — a color block is shown, and the other side only reads your description.",
          "実際の画像は送られません。色ブロックが表示され、相手は説明文だけを読みます。",
          "실제 이미지는 전송되지 않으며, 색 블록이 표시되고 상대는 설명만 읽습니다."
        )}
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 10 }}>
        <div className="mp-pseudo-img" style={{ ...pseudoImageStyle(preview || { hue: 0 }), opacity: preview ? 1 : 0.35, cursor: "default", flexShrink: 0 }} />
        <textarea
          className="mp-ta"
          style={{ flex: 1, minHeight: 72 }}
          rows={3}
          autoFocus
          maxLength={PSEUDO_IMAGE_DESC_LIMIT}
          placeholder={tr("例：窗外正在下雨的街景", "e.g. a rainy street seen from my window", "例: 窓の外の雨の街並み", "예: 창밖 비 오는 거리 풍경")}
          value={desc}
          onChange={(event) => setDesc(event.target.value.slice(0, PSEUDO_IMAGE_DESC_LIMIT))}
        />
      </div>
      <div className="mp-char-counter" style={{ textAlign: "right", marginBottom: 10 }}>{desc.length}/{PSEUDO_IMAGE_DESC_LIMIT}</div>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="mp-save" style={{ flex: 1, background: "linear-gradient(135deg,#b0bec5,#90a4ae)" }} onClick={onCancel}>{tr("取消", "Cancel", "キャンセル", "취소")}</button>
        <button className="mp-save" style={{ flex: 1 }} disabled={!preview} onClick={() => preview && onConfirm(preview)}>{tr("加入", "Attach", "添付", "첨부")}</button>
      </div>
    </div>
  </div>;

  return createPortal(overlay, document.querySelector(".mp-phone") || document.body);
}
