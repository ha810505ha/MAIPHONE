import React from "react";
import { calculateCoverCrop } from "../../utils/imageCrop";
import { LargeTitle, LargeTitleHeader, useLargeTitle } from "../shell/LargeTitle";
import Avatar from "../common/Avatar";
import Icon from "../common/Icon";

export default function PlayerProfileApp({
  t, tr, closeApp, profile, setProfile, avatarRef, sanitizeImage, onAvatarUpload,
  crop, setCrop, onCropPointerDown, onCropPointerMove, onCropPointerUp, onApplyCrop,
  persona,
}) {
  const largeTitle = useLargeTitle();
  const cropPreview = crop ? (() => {
    const frame = 220;
    return calculateCoverCrop({ width: crop.width, height: crop.height, frameWidth: frame, zoom: crop.zoom, panX: crop.panX, panY: crop.panY });
  })() : null;
  const personaCount = Object.keys(persona?.personas || {}).length;
  const personaLimitReached = personaCount >= (persona?.maxPersonas || Infinity);
  const profileAvatar = sanitizeImage(profile?.avatar);
  const profileName = String(profile?.name || "").trim() || tr("玩家", "Player", "プレイヤー", "플레이어");
  const activePersona = persona?.personas?.[persona?.activePersonaId];
  // 人格 label 只在切換／存檔時才從玩家姓名同步；使用中的人格直接顯示即時姓名，改名時才會馬上跟著變（跟下方人格清單一致）。
  const activePersonaLabel = activePersona ? profileName : "";
  return <div className={largeTitle.pageClassName}>
    <LargeTitleHeader title={t("playerProfile")} onBack={closeApp} backLabel={tr("返回首頁", "Back to Home", "ホームに戻る", "홈으로 돌아가기")} />
    <div className="mp-cm" onScroll={largeTitle.onScroll}>
      <LargeTitle title={t("playerProfile")} />
      {/* 頭像主卡：點頭像更換；有頭像時才顯示「移除」 */}
      <div className="mp-group mp-profile-hero">
        <button type="button" className="mp-profile-avatar" onClick={() => avatarRef.current?.click()} aria-label={t("changeAvatar")}>
          <Avatar src={profileAvatar} name={profileName} size={96} />
          <span className="mp-profile-camera" aria-hidden="true"><Icon name="camera" size={16} /></span>
        </button>
        <input type="file" ref={avatarRef} accept="image/*" style={{ display: "none" }} onChange={onAvatarUpload} />
        <div className="mp-profile-name">{profileName}</div>
        {String(profile?.nickname || "").trim() && <div className="mp-profile-sub">{tr("暱稱", "Nickname", "ニックネーム", "닉네임")}：{profile.nickname}</div>}
        {activePersonaLabel && <div className="mp-profile-tag">{tr("使用中的人格", "Active persona", "使用中の人格", "사용 중인 페르소나")}・{activePersonaLabel}</div>}
        {profileAvatar && <button type="button" className="mp-profile-remove" onClick={() => setProfile((current) => ({ ...(current || {}), avatar: "" }))}>{tr("移除頭像", "Remove photo", "写真を削除", "사진 삭제")}</button>}
      </div>

      <div className="mp-list-section">{t("personalSettings")}</div>
      <div className="mp-group mp-form-list">
        <label className="mp-form-row"><span>{t("name")}</span><input value={profile?.name || ""} onChange={(event) => setProfile((current) => ({ ...(current || {}), name: event.target.value }))} placeholder={tr("例如：小明", "e.g. Alex", "例: アレックス", "예: 알렉스")} /></label>
        <label className="mp-form-row"><span>{tr("暱稱", "Nickname", "ニックネーム", "닉네임")}</span><input value={profile?.nickname || ""} onChange={(event) => setProfile((current) => ({ ...(current || {}), nickname: event.target.value }))} placeholder={tr("例如：小雨、阿喵", "e.g. Rain, Kitty", "例: レイン、ミャオ", "예: 비, 냥이")} /></label>
        {/* 性別自由填寫：玩家角色可能不是人類，不限制選項 */}
        <label className="mp-form-row"><span>{tr("性別", "Gender", "性別", "성별")}</span><input value={profile?.gender || ""} maxLength={80} onChange={(event) => setProfile((current) => ({ ...(current || {}), gender: event.target.value }))} placeholder={tr("自由填寫，例如：女、男、不設限、精靈", "Anything, e.g. female, male, nonbinary, elf", "自由入力（例: 女性、男性、指定なし、エルフ）", "자유 입력 (예: 여성, 남성, 무관, 엘프)")} /></label>
        <label className="mp-form-row mp-form-row--stack"><span>{t("description")}</span><textarea value={profile?.bio || ""} onChange={(event) => setProfile((current) => ({ ...(current || {}), bio: event.target.value }))} placeholder={tr("例如：喜歡貓、講話直接、晚上常上線", "e.g. likes cats, speaks directly, often online at night", "例: 猫が好き、はっきり話す、夜によくオンライン", "예: 고양이를 좋아함, 직설적, 밤에 자주 접속")} /></label>
      </div>

      {persona && <>
        <div className="mp-list-section">{tr("玩家人格", "Player personas", "プレイヤー人格", "플레이어 페르소나")}</div>
        <div className="mp-group mp-persona-list">
          {Object.values(persona.personas || {}).map((item) => {
            const active = item.id === persona.activePersonaId;
            const itemProfile = active ? profile : item.data?.playerProfile;
            const itemName = String(itemProfile?.name || item.label || tr("玩家人格", "Persona", "人格", "페르소나")).trim();
            return <div key={item.id} className={`mp-persona-row ${active ? "is-active" : ""}`}>
              <Avatar src={sanitizeImage(itemProfile?.avatar)} name={itemName} size={42} />
              <div className="mp-persona-copy">
                <b>{itemName}</b>
                <small>{itemProfile?.gender || tr("未設定性別", "Gender not set", "性別未設定", "성별 미설정")}</small>
              </div>
              {active && <span className="mp-persona-active">{tr("使用中", "Active", "使用中", "사용 중")}</span>}
              {!active && <button type="button" className="mp-hdr-action" onClick={() => persona.onSwitch(item.id)}>{tr("切換", "Switch", "切り替え", "전환")}</button>}
              {active && Object.keys(persona.personas || {}).length > 1 && <button type="button" className="mp-persona-delete" onClick={() => {
                if (window.confirm(tr(
                  `刪除「${itemName}」？此人格的聊天與關係資料將無法復原。`,
                  `Delete “${itemName}”? This persona's chats and relationship data cannot be restored.`,
                  `「${itemName}」を削除しますか？この人格のチャットと関係データは復元できません。`,
                  `“${itemName}” 페르소나를 삭제할까요? 이 페르소나의 채팅과 관계 데이터는 복구할 수 없습니다.`
                ))) persona.onDelete(item.id);
              }}>{tr("刪除", "Delete", "削除", "삭제")}</button>}
            </div>;
          })}
          <button type="button" className="mp-persona-row mp-persona-add" disabled={personaLimitReached} onClick={() => {
            if (personaLimitReached) return;
            const label = window.prompt(
              tr("新玩家姓名", "New player name", "新しいプレイヤー名", "새 플레이어 이름"),
              tr("新玩家", "New player", "新しいプレイヤー", "새 플레이어")
            );
            if (label?.trim()) persona.onCreate(label.trim());
          }}>
            <span className="mp-persona-plus" aria-hidden="true"><Icon name="plus" size={20} /></span>
            <span className="mp-persona-copy"><b>{personaLimitReached
              ? tr("已達人格上限", "Persona limit reached", "人格の上限に達しました", "페르소나 한도에 도달했습니다")
              : tr("新增玩家人格", "Add persona", "プレイヤー人格を追加", "플레이어 페르소나 추가")}</b></span>
            <span className="mp-persona-count">{personaCount} / {persona.maxPersonas}</span>
          </button>
        </div>
        <div className="mp-list-note">{tr(
          "不同人格擁有獨立的聊天、記憶、手機錢包、社群、交友與情侶空間；水晶、抽卡物品、日記、寵物及山莊共用。",
          "Each persona has separate chats, memories, phone wallet, social, dating, and couple space. Crystals, gacha items, diary, pets, and the manor are shared.",
          "人格ごとにチャット、記憶、スマホ財布、SNS、出会い、カップルスペースが分かれます。クリスタル、ガチャアイテム、日記、ペット、山荘は共通です。",
          "페르소나마다 채팅, 기억, 휴대폰 지갑, 소셜, 데이팅, 커플 공간이 분리됩니다. 크리스털, 뽑기 아이템, 일기, 반려동물, 산장은 공유됩니다."
        )}</div>
      </>}

      <div className="mp-list-section">{tr("紙娃娃（三層）", "Paper doll (3 layers)", "紙人形（3層）", "종이 인형(3단)")}</div>
      <div className="mp-group mp-persona-list"><div className="mp-persona-row"><span className="mp-persona-plus is-soft" aria-hidden="true"><Icon name="doll" size={20} /></span><span className="mp-persona-copy"><small>{t("comingSoon")}</small></span></div></div>
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
