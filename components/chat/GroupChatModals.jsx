import React, { useRef } from "react";
import GroupMemberPicker from "./GroupMemberPicker";
import { calculateCoverCrop, calculateCropDrag } from "../../utils/imageCrop";

const COVER_BOX_SIZE = 220;

function getCoverImageStyle(crop) {
  const geometry = calculateCoverCrop({ width: crop?.width, height: crop?.height, frameWidth: COVER_BOX_SIZE, zoom: crop?.zoom, panX: crop?.panX, panY: crop?.panY });

  return {
    position: "absolute",
    width: geometry.width,
    height: geometry.height,
    left: geometry.left,
    top: geometry.top,
    objectFit: "cover",
    pointerEvents: "none",
    userSelect: "none",
  };
}

function GroupFormModal({
  mode,
  characters,
  name,
  setName,
  cover,
  setCover,
  memberIds,
  setMemberIds,
  search,
  setSearch,
  rulePrompt,
  setRulePrompt,
  useRealTime,
  setUseRealTime,
  onCoverUpload,
  onClose,
  onSubmit,
  onDelete,
  tr,
  showToast,
}) {
  const coverInputRef = useRef(null);
  const editing = mode === "edit";

  return (
    <div className="mp-overlay" onClick={onClose}>
      <div className="mp-modal" onClick={(event) => event.stopPropagation()}>
        <div className="mp-modal-t">
          {editing
            ? tr("編輯群組", "Edit group", "グループを編集", "그룹 편집")
            : tr("新增群組", "Create group", "グループを作成", "그룹 만들기")}
        </div>
        <div className="mp-row">
          <div className="mp-lbl">{tr("群組名稱", "Group name", "グループ名", "그룹 이름")}</div>
          <input
            className="mp-sinp"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={editing
              ? tr("可留空，儲存後再命名", "Optional, name it later", "未入力でも可。保存後に名前を変更できます", "비워도 됩니다. 저장 후 이름을 정하세요")
              : tr("可留空，建立後再命名", "Optional, name it later", "未入力でも可。後で名前を変更できます", "비워도 됩니다. 나중에 이름을 정하세요")}
          />
          <div style={{ fontSize: 11, color: "var(--mp-txt-l)", marginTop: 6 }}>
            {tr("未命名時，會自動依成員名稱生成群組名。", "If left blank, the group name will be generated from the members.", "未入力の場合はメンバー名から自動生成されます。", "비워두면 멤버 이름으로 자동 생성됩니다.")}
          </div>
        </div>
        <div className="mp-row">
          <div className="mp-lbl">{tr("群組圖片", "Group cover", "グループ画像", "그룹 이미지")}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="mp-av" style={{ cursor: "pointer" }} onClick={() => coverInputRef.current?.click()}>
              {cover ? <img src={cover} alt="" /> : "👥"}
            </div>
            <input type="file" ref={coverInputRef} accept="image/*" style={{ display: "none" }} onChange={onCoverUpload} />
            <button className="mp-ibtn" style={{ padding: "6px 12px", fontSize: 12, lineHeight: 1 }} onClick={() => coverInputRef.current?.click()}>
              {tr("上傳", "Upload", "アップロード", "업로드")}
            </button>
            <button className="mp-ibtn-r" style={{ padding: "6px 12px", fontSize: 12, lineHeight: 1 }} onClick={() => setCover("")}>
              {tr("移除", "Remove", "削除", "제거")}
            </button>
          </div>
          <div style={{ fontSize: 11, color: "var(--mp-txt-l)", marginTop: 6 }}>
            {tr("會顯示在群組聊天室列表。", "Shown in the group chat list.", "グループチャット一覧に表示されます。", "그룹 채팅 목록에 표시됩니다.")}
          </div>
        </div>
        <div className="mp-row">
          <div className="mp-lbl">{tr("要加入的角色", "Characters to add", "追加するキャラ", "추가할 캐릭터")}</div>
          <GroupMemberPicker
            characters={characters}
            selectedIds={memberIds}
            setSelectedIds={setMemberIds}
            search={search}
            setSearch={setSearch}
            tr={tr}
            showToast={showToast}
          />
        </div>
        <div className="mp-row">
          <div className="mp-lbl">{tr("群組聊天規則", "Group chat rules", "グループチャットのルール", "그룹 채팅 규칙")}</div>
          <textarea
            className="mp-ta"
            value={rulePrompt}
            onChange={(event) => setRulePrompt(event.target.value)}
            placeholder={tr("例如：自然聊天、可互相吐槽、不要提系統...", "For example: natural chat, playful teasing, no system talk...", "例: 自然な会話、軽いツッコミ可、システムの話はしない...", "예: 자연스러운 대화, 가벼운 농담 가능, 시스템 언급 금지...")}
            style={{ minHeight: 120, resize: "vertical" }}
          />
          <div style={{ fontSize: 11, color: "var(--mp-txt-l)", marginTop: 6 }}>
            {tr("之後可作為群組 AI 回覆的專屬 Prompt。", "Can be used later as the group AI's dedicated prompt.", "後でグループAIの専用プロンプトとして使えます。", "나중에 그룹 AI 전용 프롬프트로 사용할 수 있습니다.")}
          </div>
        </div>
        {editing && (
          <div className="mp-row">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div className="mp-lbl" style={{ marginBottom: 3 }}>{tr("讀取現實時間", "Use real-world time", "現実時間を参照", "현실 시간 사용")}</div>
                <div style={{ fontSize: 11, color: "var(--mp-txt-l)", lineHeight: 1.5 }}>
                  {tr("關閉後，群聊不會把目前日期與時間交給 AI，適合長篇劇情或時間凍結的 RP。", "When off, the group chat will not pass the current date and time to AI; useful for long-running stories or frozen-time roleplay.", "オフにすると、グループチャットは現在の日付と時刻をAIに渡しません。長編シナリオや時間固定RPに向いています。", "끄면 그룹 채팅이 현재 날짜와 시간을 AI에 전달하지 않습니다. 장기 스토리나 시간이 고정된 RP에 적합합니다.")}
                </div>
              </div>
              <button type="button" role="switch" aria-checked={useRealTime} className={`mp-switch ${useRealTime ? "active" : ""}`} onClick={() => setUseRealTime((value) => !value)}><span /></button>
            </div>
          </div>
        )}
        {editing && (
          <button
            type="button"
            className="mp-ibtn-r"
            style={{ width: "100%", marginTop: 12, padding: "10px 12px", fontWeight: 800 }}
            onClick={onDelete}
          >
            {tr("刪除群組", "Delete group", "グループを削除", "그룹 삭제")}
          </button>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button className="mp-save" style={{ flex: 1, background: "linear-gradient(135deg,#b0bec5,#90a4ae)" }} onClick={onClose}>
            {tr("取消", "Cancel", "キャンセル", "취소")}
          </button>
          <button className="mp-save" style={{ flex: 1 }} onClick={onSubmit}>
            {editing ? tr("儲存", "Save", "保存", "저장") : tr("建立群組", "Create group", "グループを作成", "그룹 만들기")}
          </button>
        </div>
      </div>
    </div>
  );
}

function GroupCoverCropModal({ crop, setCrop, mode, onApply, onClose, tr }) {
  const updateCrop = (patch) => setCrop((current) => current ? { ...current, ...patch } : current);

  return (
    <div className="mp-overlay" onClick={onClose}>
      <div className="mp-modal" onClick={(event) => event.stopPropagation()}>
        <div className="mp-modal-t">{tr("裁切群組圖片", "Crop group cover", "グループ画像をトリミング", "그룹 이미지 자르기")}</div>
        <div style={{ fontSize: 11, color: "var(--mp-txt-l)", marginBottom: 10 }}>
          {tr("可拖曳調整位置，完成後會自動壓縮。", "Drag to adjust the position; it will be compressed automatically when done.", "ドラッグで位置を調整できます。完了時に自動で圧縮されます。", "드래그로 위치를 조정할 수 있으며 완료 시 자동 압축됩니다.")}
        </div>
        <div
          style={{ width: COVER_BOX_SIZE, height: COVER_BOX_SIZE, borderRadius: 18, overflow: "hidden", border: "1px solid rgba(244,143,177,.35)", background: "#fff", touchAction: "none", cursor: "grab", position: "relative", margin: "0 auto" }}
          onPointerDown={(event) => {
            event.preventDefault();
            try { event.currentTarget.setPointerCapture?.(event.pointerId); } catch (_) {}
            updateCrop({ dragging: true, dragStartX: event.clientX ?? 0, dragStartY: event.clientY ?? 0, startPanX: crop.panX || 0, startPanY: crop.panY || 0 });
          }}
          onPointerMove={(event) => {
            if (!crop.dragging) return;
            event.preventDefault();
            updateCrop(calculateCropDrag(crop, event.clientX, event.clientY));
          }}
          onPointerUp={(event) => {
            try { event.currentTarget.releasePointerCapture?.(event.pointerId); } catch (_) {}
            updateCrop({ dragging: false });
          }}
          onPointerCancel={() => updateCrop({ dragging: false })}
        >
          <img src={crop.src} alt="" style={getCoverImageStyle(crop)} />
        </div>
        <div className="mp-row">
          <div className="mp-lbl">{tr("縮放", "Zoom", "ズーム", "확대")}</div>
          <input type="range" min="1" max="3" step="0.01" value={crop.zoom || 1} onChange={(event) => updateCrop({ zoom: Number(event.target.value) })} />
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button className="mp-save" style={{ flex: 1, background: "linear-gradient(135deg,#b0bec5,#90a4ae)" }} onClick={onClose}>{tr("取消", "Cancel", "キャンセル", "취소")}</button>
          <button className="mp-save" style={{ flex: 1 }} onClick={() => onApply(mode)}>{tr("完成裁切", "Finish crop", "トリミング完了", "자르기 완료")}</button>
        </div>
      </div>
    </div>
  );
}

export default function GroupChatModals({ create, edit, crop, characters, tr, showToast }) {
  const activeCrop = crop.editValue || crop.createValue;
  const cropMode = crop.editValue ? "edit" : "create";

  return (
    <>
      {create.open && <GroupFormModal mode="create" characters={characters} tr={tr} showToast={showToast} {...create} />}
      {edit.open && <GroupFormModal mode="edit" characters={characters} tr={tr} showToast={showToast} {...edit} />}
      {activeCrop && (
        <GroupCoverCropModal
          crop={activeCrop}
          setCrop={cropMode === "edit" ? crop.setEditValue : crop.setCreateValue}
          mode={cropMode}
          onApply={crop.onApply}
          onClose={crop.onClose}
          tr={tr}
        />
      )}
    </>
  );
}
