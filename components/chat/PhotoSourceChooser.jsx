import React from "react";
import { createPortal } from "react-dom";

// 點「相片」後的來源選單：上傳真照片 vs 傳示意色塊。兩者平行呈現，不預設主角。
export default function PhotoSourceChooser({ onUpload, onPseudo, onCancel, tr }) {
  const overlay = <div className="mp-overlay" onClick={onCancel}>
    <div className="mp-modal" style={{ maxWidth: 340 }} onClick={(event) => event.stopPropagation()}>
      <div className="mp-modal-t">{tr("傳送相片", "Send a photo", "写真を送る", "사진 보내기")}</div>
      <div style={{ display: "flex", gap: 10 }}>
        <button type="button" className="mp-photo-source" onClick={onUpload}>
          <span className="mp-photo-source-i">📷</span>
          <span className="mp-photo-source-t">{tr("上傳照片", "Upload photo", "写真をアップロード", "사진 업로드")}</span>
          <span className="mp-photo-source-d">{tr("傳真實圖片", "Send a real image", "実際の画像を送る", "실제 이미지 전송")}</span>
        </button>
        <button type="button" className="mp-photo-source" onClick={onPseudo}>
          <span className="mp-photo-source-i">🎨</span>
          <span className="mp-photo-source-t">{tr("示意照片", "Mock photo", "イメージ写真", "가상 사진")}</span>
          <span className="mp-photo-source-d">{tr("只顯示色塊", "Color block only", "色ブロックのみ", "색 블록만")}</span>
        </button>
      </div>
      <button className="mp-save" style={{ width: "100%", marginTop: 12, background: "linear-gradient(135deg,#b0bec5,#90a4ae)" }} onClick={onCancel}>{tr("取消", "Cancel", "キャンセル", "취소")}</button>
    </div>
  </div>;

  return createPortal(overlay, document.querySelector(".mp-phone") || document.body);
}
