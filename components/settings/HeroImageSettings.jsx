import React from "react";
import { sanitizeUserImageUrl } from "../../utils/coreUtils";

export default function HeroImageSettings({
  tr, activeChar, heroFileRef, onHeroFile, heroDraft, setHeroDraft,
  beginHeroEdit, removeHero, startDrag, moveDrag, endDrag, heroImgStyle, saveDraft,
}) {
  if (!activeChar) return null;
  const previewSrc = sanitizeUserImageUrl(activeChar.heroImage || activeChar.avatarOriginal || activeChar.avatar);
  const savedView = activeChar.heroView || { x: 0, y: 0, zoom: 1 };
  return (
    <div className="mp-sg" style={{ padding: 12, margin: "10px 0", order: 2 }}>
      <div className="mp-sg-t">{tr("桌面立繪", "Desktop hero image", "デスクトップ立ち絵", "데스크톱 이미지")}</div>
      <div style={{ fontSize: 10, color: "var(--mp-txt-l)", lineHeight: 1.5, marginBottom: 8 }}>{tr("預設使用角色頭像；可調整上下左右與縮放，或另外上傳完整立繪。", "Uses the character avatar by default; reposition, zoom, or upload a full hero image.", "初期状態ではキャラ画像を使用し、位置・拡大率の調整や立ち絵の追加ができます。", "기본으로 캐릭터 프로필을 사용하며 위치, 확대 또는 별도 이미지를 설정할 수 있습니다.")}</div>
      <input ref={heroFileRef} type="file" accept="image/*" hidden onChange={onHeroFile} />
      {!heroDraft ? (
        <>
          <div className="mp-hero-setting-preview" style={{ touchAction: "auto", cursor: "default" }}>
            {previewSrc ? <>
              <img className="mp-hero-blur-bg" src={previewSrc} alt="" aria-hidden="true" draggable={false} />
              <img src={previewSrc} alt={activeChar.name || ""} draggable={false} style={heroImgStyle(savedView.x, savedView.y, savedView.zoom)} />
            </> : <span>{tr("尚無可預覽的角色圖片", "No character image to preview", "プレビューできるキャラクター画像がありません", "미리 볼 캐릭터 이미지가 없습니다")}</span>}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button className="mp-ibtn" onClick={() => heroFileRef.current?.click()}>{activeChar.heroImage ? tr("更換立繪", "Replace image", "立ち絵を変更", "이미지 변경") : tr("上傳立繪", "Upload image", "立ち絵をアップロード", "이미지 업로드")}</button>
            {previewSrc && <button className="mp-ibtn" onClick={() => beginHeroEdit()}>{tr("調整顯示位置", "Adjust position", "表示位置を調整", "표시 위치 조정")}</button>}
            {activeChar.heroImage && <button className="mp-ibtn-r" onClick={removeHero}>{tr("移除", "Remove", "削除", "제거")}</button>}
          </div>
        </>
      ) : <>
        <div className="mp-hero-setting-preview" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>
          <img className="mp-hero-blur-bg" src={heroDraft.src} alt="" aria-hidden="true" draggable={false} />
          <img src={heroDraft.src} alt="" draggable={false} style={heroImgStyle(heroDraft.x, heroDraft.y, heroDraft.zoom)} />
          <span>{tr("拖曳圖片調整位置", "Drag to reposition", "ドラッグして位置を調整", "드래그하여 위치 조정")}</span>
        </div>
        <div className="mp-row"><div className="mp-lbl">{tr("縮放", "Zoom", "拡大", "확대")}：{heroDraft.zoom.toFixed(2)}</div><input style={{ width: "100%" }} type="range" min="1" max="2.5" step="0.05" value={heroDraft.zoom} onChange={(event) => setHeroDraft((old) => ({ ...old, zoom: Number(event.target.value) }))} /></div>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}><button className="mp-ibtn" onClick={() => setHeroDraft((old) => ({ ...old, x: 0, y: 0, zoom: 1 }))}>{tr("重設", "Reset", "リセット", "초기화")}</button><button className="mp-ibtn" onClick={() => setHeroDraft(null)}>{tr("取消", "Cancel", "キャンセル", "취소")}</button><button className="mp-save" style={{ flex: 1, padding: 7 }} onClick={saveDraft}>{tr("儲存套用", "Save and apply", "保存して適用", "저장 및 적용")}</button></div>
      </>}
    </div>
  );
}
