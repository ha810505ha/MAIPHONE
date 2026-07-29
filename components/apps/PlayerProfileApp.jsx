import React from "react";
import { calculateCoverCrop } from "../../utils/imageCrop";

export default function PlayerProfileApp({
  t, tr, closeApp, profile, setProfile, avatarRef, sanitizeImage, onAvatarUpload,
  crop, setCrop, onCropPointerDown, onCropPointerMove, onCropPointerUp, onApplyCrop,
  persona,
}) {
  const cropPreview = crop ? (() => {
    const frame = 220;
    return calculateCoverCrop({ width: crop.width, height: crop.height, frameWidth: frame, zoom: crop.zoom, panX: crop.panX, panY: crop.panY });
  })() : null;
  const personaCount = Object.keys(persona?.personas || {}).length;
  const personaLimitReached = personaCount >= (persona?.maxPersonas || Infinity);
  return <div className="mp-page">
    <div className="mp-hdr"><div className="mp-back" onClick={closeApp}>←</div><div className="mp-htitle">{t("playerProfile")}</div></div>
    <div className="mp-cm">
      {persona && <div className="mp-cc">
        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 8 }}>{tr("玩家人格", "Player personas", "プレイヤー人格", "플레이어 페르소나")}</div>
        <div style={{ fontSize: 11, color: "var(--mp-txt-l)", lineHeight: 1.7, marginBottom: 10 }}>
          {tr(
            "不同人格擁有獨立的聊天、記憶、手機錢包、社群、交友與情侶空間；水晶、抽卡物品、日記、寵物及山莊共用。",
            "Each persona has separate chats, memories, phone wallet, social, dating, and couple space. Crystals, gacha items, diary, pets, and the manor are shared.",
            "人格ごとにチャット、記憶、スマホ財布、SNS、出会い、カップルスペースが分かれます。クリスタル、ガチャアイテム、日記、ペット、山荘は共通です。",
            "페르소나마다 채팅, 기억, 휴대폰 지갑, 소셜, 데이팅, 커플 공간이 분리됩니다. 크리스털, 뽑기 아이템, 일기, 반려동물, 산장은 공유됩니다."
          )}
        </div>
        <div style={{ display: "grid", gap: 8, maxHeight: 320, overflowY: "auto", overscrollBehavior: "contain", paddingRight: 2 }}>
          {Object.values(persona.personas || {}).map((item) => {
            const active = item.id === persona.activePersonaId;
            const avatar = sanitizeImage(active ? profile?.avatar : item.data?.playerProfile?.avatar);
            return <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 10px", borderRadius: 14, background: active ? "rgba(244,143,177,.15)" : "rgba(255,255,255,.55)", border: active ? "1px solid rgba(244,143,177,.45)" : "1px solid rgba(0,0,0,.06)" }}>
              <div className="mp-av" style={{ width: 38, height: 38 }}>{avatar ? <img src={avatar} alt="" /> : "👤"}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 800 }}>{item.label}</div>
                <div style={{ fontSize: 10, color: "var(--mp-txt-l)" }}>{item.data?.playerProfile?.gender || tr("未設定性別", "Gender not set", "性別未設定", "성별 미설정")}{active ? ` · ${tr("使用中", "Active", "使用中", "사용 중")}` : ""}</div>
              </div>
              {!active && <button className="mp-ibtn" onClick={() => persona.onSwitch(item.id)}>{tr("切換", "Switch", "切り替え", "전환")}</button>}
              {active && <button className="mp-ibtn" onClick={() => {
                const label = window.prompt(tr("人格名稱", "Persona name", "人格名", "페르소나 이름"), item.label);
                if (label?.trim()) persona.onRename(item.id, label.trim());
              }}>{tr("改名", "Rename", "名前変更", "이름 변경")}</button>}
              {active && Object.keys(persona.personas || {}).length > 1 && <button className="mp-ibtn-r" onClick={() => {
                if (window.confirm(tr(
                  `刪除「${item.label}」？此人格的聊天與關係資料將無法復原。`,
                  `Delete “${item.label}”? This persona's chats and relationship data cannot be restored.`,
                  `「${item.label}」を削除しますか？この人格のチャットと関係データは復元できません。`,
                  `“${item.label}” 페르소나를 삭제할까요? 이 페르소나의 채팅과 관계 데이터는 복구할 수 없습니다.`
                ))) persona.onDelete(item.id);
              }}>{tr("刪除", "Delete", "削除", "삭제")}</button>}
            </div>;
          })}
        </div>
        <button className="mp-save" disabled={personaLimitReached} style={{ width: "100%", marginTop: 10, opacity: personaLimitReached ? 0.55 : 1, cursor: personaLimitReached ? "not-allowed" : "pointer" }} onClick={() => {
          if (personaLimitReached) return;
          const label = window.prompt(
            tr("新玩家人格名稱", "New persona name", "新しいプレイヤー人格名", "새 플레이어 페르소나 이름"),
            tr("新人格", "New persona", "新しい人格", "새 페르소나")
          );
          if (label?.trim()) persona.onCreate(label.trim());
        }}>{personaLimitReached
          ? tr(`已達人格上限（${persona.maxPersonas}）`, `Persona limit reached (${persona.maxPersonas})`, `人格の上限に達しました（${persona.maxPersonas}）`, `페르소나 한도에 도달했습니다(${persona.maxPersonas})`)
          : tr(`＋ 新增玩家人格（${personaCount}/${persona.maxPersonas}）`, `＋ Add persona (${personaCount}/${persona.maxPersonas})`, `＋ プレイヤー人格を追加（${personaCount}/${persona.maxPersonas}）`, `＋ 플레이어 페르소나 추가(${personaCount}/${persona.maxPersonas})`)}</button>
      </div>}
      <div className="mp-cc">
        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>{t("personalSettings")}</div>
        <div className="mp-row"><div className="mp-lbl">{t("avatar")}</div><div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="mp-av" style={{ cursor: "pointer", width: 84, height: 84, borderRadius: 22 }} onClick={() => avatarRef.current?.click()}>{sanitizeImage(profile?.avatar) ? <img src={sanitizeImage(profile?.avatar)} alt="" /> : "🐱"}</div>
          <input type="file" ref={avatarRef} accept="image/*" style={{ display: "none" }} onChange={onAvatarUpload} />
          <button className="mp-ibtn" onClick={() => avatarRef.current?.click()}>{t("changeAvatar")}</button><button className="mp-ibtn-r" onClick={() => setProfile((current) => ({ ...(current || {}), avatar: "" }))}>{t("remove")}</button>
        </div></div>
        <div className="mp-row"><div className="mp-lbl">{t("name")}</div><input className="mp-sinp" value={profile?.name || ""} onChange={(event) => setProfile((current) => ({ ...(current || {}), name: event.target.value }))} placeholder={tr("例如：小明", "e.g. Alex", "例: アレックス", "예: 알렉스")} /></div>
        <div className="mp-row"><div className="mp-lbl">{tr("暱稱", "Nickname", "ニックネーム", "닉네임")}</div><input className="mp-sinp" value={profile?.nickname || ""} onChange={(event) => setProfile((current) => ({ ...(current || {}), nickname: event.target.value }))} placeholder={tr("例如：小雨、阿喵", "e.g. Sunny, Miao", "例: しずく、ニャン", "예: 비, 냥이")} /></div>
        <div className="mp-row"><div className="mp-lbl">{tr("性別", "Gender", "性別", "성별")}</div><input className="mp-sinp" value={profile?.gender || ""} maxLength={80} onChange={(event) => setProfile((current) => ({ ...(current || {}), gender: event.target.value }))} /></div>
        <div className="mp-row"><div className="mp-lbl">{t("description")}</div><textarea className="mp-ta" value={profile?.bio || ""} onChange={(event) => setProfile((current) => ({ ...(current || {}), bio: event.target.value }))} placeholder={tr("例如：喜歡貓、講話直接、晚上常上線", "e.g. likes cats, speaks directly, often online at night", "例: 猫が好き、話し方は率直、夜にオンラインが多い", "예: 고양이를 좋아함, 말투가 직설적, 밤에 자주 접속")} style={{ minHeight: 100, resize: "vertical" }} /></div>
      </div>
      <div className="mp-cc"><div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>{tr("紙娃娃（三層）", "Paper doll (3 layers)", "紙人形（3層）", "종이 인형(3단)")}</div><div style={{ fontSize: 12, color: "var(--mp-txt-l)", lineHeight: 1.7 }}>{t("comingSoon")}</div></div>
    </div>
    {crop && <div className="mp-overlay" onClick={() => setCrop(null)}><div className="mp-modal" onClick={(event) => event.stopPropagation()}>
      <div className="mp-modal-t">{tr("裁切大頭貼", "Crop avatar", "アバターをトリミング", "프로필 사진 자르기")}</div>
      <div style={{ display: "grid", placeItems: "center", marginBottom: 10 }}><div style={{ width: 220, height: 220, borderRadius: 18, overflow: "hidden", border: "1px solid rgba(244,143,177,.35)", background: "#fff", touchAction: "none", cursor: crop.dragging ? "grabbing" : "grab", position: "relative" }} onPointerDown={onCropPointerDown} onPointerMove={onCropPointerMove} onPointerUp={onCropPointerUp} onPointerCancel={onCropPointerUp}><img src={crop.src} alt="" style={{ position: "absolute", left: cropPreview.left, top: cropPreview.top, width: cropPreview.width, height: cropPreview.height, maxWidth: "none", userSelect: "none", WebkitUserDrag: "none", pointerEvents: "none" }} /></div></div>
      <div className="mp-row"><div className="mp-lbl">{tr("縮放", "Zoom", "ズーム", "확대")}</div><input type="range" min="1" max="3" step="0.01" value={crop.zoom} onChange={(event) => setCrop((current) => ({ ...(current || {}), zoom: Number(event.target.value) }))} /></div>
      <div style={{ fontSize: 11, color: "var(--mp-txt-l)", marginTop: 4 }}>{tr("拖曳圖片選擇要顯示的部位，套用後輸出為正方形頭像", "Drag to choose the visible area. The applied avatar will be square.", "画像をドラッグして表示範囲を選びます。適用後は正方形のアバターになります。", "이미지를 드래그해 표시할 영역을 선택하세요. 적용 후 정사각형 프로필 사진으로 저장됩니다.")}</div>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}><button className="mp-save" style={{ flex: 1, background: "linear-gradient(135deg,#b0bec5,#90a4ae)" }} onClick={() => setCrop(null)}>{tr("取消", "Cancel", "キャンセル", "취소")}</button><button className="mp-save" style={{ flex: 1 }} onClick={onApplyCrop}>{tr("套用", "Apply", "適用", "적용")}</button></div>
    </div></div>}
  </div>;
}
