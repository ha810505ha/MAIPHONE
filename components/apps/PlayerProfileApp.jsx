import React from "react";

export default function PlayerProfileApp({ t, tr, closeApp, profile, setProfile, avatarRef, sanitizeImage, onAvatarUpload, crop, setCrop, onCropPointerDown, onCropPointerMove, onCropPointerUp, onApplyCrop }) {
  return <div className="mp-page">
    <div className="mp-hdr"><div className="mp-back" onClick={closeApp}>←</div><div className="mp-htitle">{t("playerProfile")}</div></div>
    <div className="mp-cm">
      <div className="mp-cc">
        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>{t("personalSettings")}</div>
        <div className="mp-row"><div className="mp-lbl">{t("avatar")}</div><div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="mp-av" style={{ cursor: "pointer", width: 84, height: 84, borderRadius: 22 }} onClick={() => avatarRef.current?.click()}>{sanitizeImage(profile?.avatar) ? <img src={sanitizeImage(profile?.avatar)} alt="" /> : "🐱"}</div>
          <input type="file" ref={avatarRef} accept="image/*" style={{ display: "none" }} onChange={onAvatarUpload} />
          <button className="mp-ibtn" onClick={() => avatarRef.current?.click()}>{t("changeAvatar")}</button><button className="mp-ibtn-r" onClick={() => setProfile((current) => ({ ...(current || {}), avatar: "" }))}>{t("remove")}</button>
        </div></div>
        <div className="mp-row"><div className="mp-lbl">{t("name")}</div><input className="mp-sinp" value={profile?.name || ""} onChange={(event) => setProfile((current) => ({ ...(current || {}), name: event.target.value }))} placeholder={tr("例如：小明", "e.g. Alex", "例: アレックス", "예: 알렉스")} /></div>
        <div className="mp-row"><div className="mp-lbl">{tr("暱稱", "Nickname", "ニックネーム", "닉네임")}</div><input className="mp-sinp" value={profile?.nickname || ""} onChange={(event) => setProfile((current) => ({ ...(current || {}), nickname: event.target.value }))} placeholder={tr("例如：小雨、阿喵", "e.g. Sunny, Miao", "例: しずく、ニャン", "예: 비, 냥이")} /></div>
        <div className="mp-row"><div className="mp-lbl">{t("description")}</div><textarea className="mp-ta" value={profile?.bio || ""} onChange={(event) => setProfile((current) => ({ ...(current || {}), bio: event.target.value }))} placeholder={tr("例如：喜歡貓、講話直接、晚上常上線", "e.g. likes cats, speaks directly, often online at night", "例: 猫が好き、話し方は率直、夜にオンラインが多い", "예: 고양이를 좋아함, 말투가 직설적, 밤에 자주 접속")} style={{ minHeight: 100, resize: "vertical" }} /></div>
      </div>
      <div className="mp-cc"><div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>{tr("紙娃娃（三層）", "Paper doll (3 layers)", "紙人形（3層）", "종이 인형(3단)")}</div><div style={{ fontSize: 12, color: "var(--mp-txt-l)", lineHeight: 1.7 }}>{t("comingSoon")}</div></div>
    </div>
    {crop && <div className="mp-overlay" onClick={() => setCrop(null)}><div className="mp-modal" onClick={(event) => event.stopPropagation()}>
      <div className="mp-modal-t">{tr("裁切大頭貼", "Crop avatar", "アバターをトリミング", "프로필 사진 자르기")}</div>
      <div style={{ display: "grid", placeItems: "center", marginBottom: 10 }}><div style={{ width: 220, height: 220, borderRadius: 18, overflow: "hidden", border: "1px solid rgba(244,143,177,.35)", background: "#fff", touchAction: "none", cursor: crop.dragging ? "grabbing" : "grab", position: "relative" }} onPointerDown={onCropPointerDown} onPointerMove={onCropPointerMove} onPointerUp={onCropPointerUp} onPointerCancel={onCropPointerUp}><img src={crop.src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", transform: `translate(${crop.panX || 0}%, ${crop.panY || 0}%) scale(${crop.zoom})`, transformOrigin: "center center", userSelect: "none", WebkitUserDrag: "none", pointerEvents: "none" }} /></div></div>
      <div className="mp-row"><div className="mp-lbl">{tr("縮放", "Zoom", "ズーム", "확대")}</div><input type="range" min="1" max="3" step="0.01" value={crop.zoom} onChange={(event) => setCrop((current) => ({ ...(current || {}), zoom: Number(event.target.value) }))} /></div>
      <div style={{ fontSize: 11, color: "var(--mp-txt-l)", marginTop: 4 }}>{tr("拖曳圖片調整位置，裁切框固定為方形", "Drag the image to adjust its position. The crop frame stays square.", "画像をドラッグして位置を調整できます。トリミング枠は正方形固定です。", "이미지를 드래그해 위치를 조정하세요. 자르기 프레임은 정사각형으로 고정됩니다.")}</div>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}><button className="mp-save" style={{ flex: 1, background: "linear-gradient(135deg,#b0bec5,#90a4ae)" }} onClick={() => setCrop(null)}>{tr("取消", "Cancel", "キャンセル", "취소")}</button><button className="mp-save" style={{ flex: 1 }} onClick={onApplyCrop}>{tr("套用", "Apply", "適用", "적용")}</button></div>
    </div></div>}
  </div>;
}
