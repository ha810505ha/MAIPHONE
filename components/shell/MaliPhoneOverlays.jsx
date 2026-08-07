import React from "react";
import DesktopPet from "../../DesktopPet";
import { lazyWithRetry } from "../../utils/lazyWithRetry.js";
import MotionPresence from "../motion/MotionPresence";

const GroupChatModals = lazyWithRetry(() => import("../chat/GroupChatModals.jsx"));
const AddCharacterModal = lazyWithRetry(() => import("../characters/AddCharacterModal.jsx"));
const DataImportPreviewModal = lazyWithRetry(() => import("../settings/DataImportPreviewModal.jsx"));
const ChatroomImportPreviewModal = lazyWithRetry(() => import("../settings/ChatroomImportPreviewModal.jsx"));
const CustomCssGuide = lazyWithRetry(() => import("../../CustomCssGuide.jsx"));

export default function MaliPhoneOverlays({
  currentApp,
  tr,
  dataImport,
  chatroomImport,
  customCssGuide,
  character,
  memory,
  message,
  updateNotice,
  playerPost,
  transfer,
  groupChat,
  toast,
}) {
  const memoryValue = memory?.value || null;
  const messageValue = message?.value || null;
  const messageLimit = messageValue ? message.getLimit(messageValue) : 0;

  return (
    <>
      <MotionPresence show={Boolean(dataImport?.preview)}>
        {dataImport?.preview && (
          <React.Suspense fallback={null}>
            <DataImportPreviewModal
              tr={tr}
              preview={dataImport.preview}
              onCancel={dataImport.onCancel}
              onConfirm={dataImport.onConfirm}
            />
          </React.Suspense>
        )}
      </MotionPresence>

      <MotionPresence show={Boolean(chatroomImport?.preview)}>
        {chatroomImport?.preview && (
          <React.Suspense fallback={null}>
            <ChatroomImportPreviewModal
              tr={tr}
              preview={chatroomImport.preview}
              onCancel={chatroomImport.onCancel}
              onConfirm={chatroomImport.onConfirm}
            />
          </React.Suspense>
        )}
      </MotionPresence>

      {customCssGuide?.open && (
        <React.Suspense fallback={null}>
          <CustomCssGuide onClose={customCssGuide.onClose} />
        </React.Suspense>
      )}

      <DesktopPet currentApp={currentApp} />

      <MotionPresence show={Boolean(character?.open)}>
        {character?.open && (
          <React.Suspense fallback={null}>
            <AddCharacterModal key={character.sessionKey} {...character.props} />
          </React.Suspense>
        )}
      </MotionPresence>

      <MotionPresence show={Boolean(memoryValue)}>
        {memoryValue && (
          <div className="mp-overlay" onClick={memory.onClose}>
            <div className="mp-modal" onClick={(event) => event.stopPropagation()}>
              <div className="mp-modal-t">{tr("編輯記憶", "Edit memory", "メモリを編集", "기억 편집")}</div>
              <div className="mp-row">
                <div className="mp-lbl">{tr("記憶內容（最多 500 字）", "Memory content (up to 500 chars)", "メモ内容（500文字以内）", "기억 내용(최대 500자)")}</div>
                <textarea
                  className="mp-ta"
                  value={memoryValue.text}
                  maxLength={500}
                  onChange={(event) => memory.onChange((current) => ({ ...current, text: event.target.value }))}
                  style={{ minHeight: 140, resize: "vertical" }}
                />
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button className="mp-save" style={{ flex: 1, background: "linear-gradient(135deg,#b0bec5,#90a4ae)" }} onClick={memory.onClose}>
                  {tr("取消", "Cancel", "キャンセル", "취소")}
                </button>
                <button className="mp-save" style={{ flex: 1 }} onClick={memory.onSave}>
                  {tr("儲存", "Save", "保存", "저장")}
                </button>
              </div>
            </div>
          </div>
        )}
      </MotionPresence>

      <MotionPresence show={Boolean(messageValue)}>
        {messageValue && (
          <div className="mp-overlay" onClick={message.onClose}>
            <div className="mp-modal" onClick={(event) => event.stopPropagation()}>
              <div className="mp-modal-t" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span>{tr("編輯對話", "Edit message", "メッセージを編集", "메시지 편집")}</span>
                <button
                  className="mp-ibtn-r"
                  onClick={message.onDelete}
                  title={tr("刪除此段訊息", "Delete this message", "このメッセージを削除", "이 메시지 삭제")}
                >
                  🗑️
                </button>
              </div>
              <div className="mp-row">
                <div className="mp-lbl">{tr("訊息內容", "Message content", "メッセージ内容", "메시지 내용")}</div>
                <textarea
                  className="mp-ta"
                  value={messageValue.content}
                  maxLength={messageLimit}
                  onChange={(event) => message.onChange((current) => ({
                    ...current,
                    content: event.target.value.slice(0, message.getLimit(current)),
                  }))}
                  style={{ minHeight: 120, resize: "vertical" }}
                />
                <div className="mp-char-counter mp-char-counter-modal">{(messageValue.content || "").length}/{messageLimit}</div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button className="mp-save" style={{ flex: 1, background: "linear-gradient(135deg,#b0bec5,#90a4ae)" }} onClick={message.onClose}>
                  {tr("取消", "Cancel", "キャンセル", "취소")}
                </button>
                <button className="mp-save" style={{ flex: 1 }} onClick={message.onSave}>
                  {tr("儲存", "Save", "保存", "저장")}
                </button>
              </div>
            </div>
          </div>
        )}
      </MotionPresence>

      <MotionPresence show={Boolean(updateNotice?.open)}>
        {updateNotice?.open && (
          <div className="mp-overlay" onClick={updateNotice.onClose}>
            <div className="mp-modal" onClick={(event) => event.stopPropagation()}>
              <div className="mp-modal-t">MaliPhone v{updateNotice.version} {tr("更新", "Update", "更新", "업데이트")}</div>
              <div className="mp-update-list">
                {(updateNotice.items.length
                  ? updateNotice.items
                  : [tr("這個版本沒有填寫更新內容。", "No update notes were added for this version.", "このバージョンの更新内容は未記入です。", "이 버전의 업데이트 내용이 없습니다.")]
                ).map((item, index) => {
                  const [title, ...detail] = String(item).split("｜");
                  return (
                    <div key={index} className="mp-update-item">
                      {detail.length
                        ? <><strong>{title}</strong><span>{detail.join("｜")}</span></>
                        : <span>{item}</span>}
                    </div>
                  );
                })}
              </div>
              <button className="mp-save" style={{ marginTop: 12 }} onClick={updateNotice.onClose}>
                {tr("知道了", "Got it", "OK", "확인")}
              </button>
            </div>
          </div>
        )}
      </MotionPresence>

      <MotionPresence show={Boolean(playerPost?.open)}>
        {playerPost?.open && (
          <div className="mp-overlay" onClick={playerPost.onClose}>
            <div className="mp-modal" onClick={(event) => event.stopPropagation()}>
              <div className="mp-modal-t">{tr("發佈社群貼文", "Create social post", "投稿を作成", "소셜 게시물 작성")}</div>
              <div className="mp-row">
                <textarea
                  className="mp-ta"
                  value={playerPost.text}
                  maxLength={playerPost.limit}
                  placeholder={tr("今天想分享什麼？", "What would you like to share today?", "今日は何を共有しますか？", "오늘 무엇을 공유할까요?")}
                  onChange={(event) => playerPost.onTextChange(event.target.value.slice(0, playerPost.limit))}
                  style={{ minHeight: 130, resize: "vertical" }}
                />
                <div className="mp-char-counter mp-char-counter-modal">{playerPost.text.length}/{playerPost.limit}</div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button className="mp-save" style={{ flex: 1, background: "linear-gradient(135deg,#b0bec5,#90a4ae)" }} onClick={playerPost.onClose}>
                  {tr("取消", "Cancel", "キャンセル", "취소")}
                </button>
                <button className="mp-save" style={{ flex: 1 }} disabled={playerPost.submitting} onClick={playerPost.onSubmit}>
                  {playerPost.submitting
                    ? tr("發佈中...", "Posting...", "投稿中...", "게시 중...")
                    : tr("發佈", "Post", "投稿", "게시")}
                </button>
              </div>
            </div>
          </div>
        )}
      </MotionPresence>

      <MotionPresence show={Boolean(transfer?.open && transfer.character)}>
        {transfer?.open && transfer.character && (
          <div className="mp-overlay" onClick={transfer.onClose}>
            <div className="mp-modal" onClick={(event) => event.stopPropagation()}>
              <div className="mp-modal-t">{tr("轉帳給", "Transfer to", "送金先", "송금 대상")} {transfer.character.name}</div>
              <div className="mp-row">
                <div className="mp-lbl">{tr("金額", "Amount", "金額", "금액")}</div>
                <input
                  className="mp-sinp"
                  inputMode="numeric"
                  value={transfer.amount}
                  onChange={(event) => transfer.onAmountChange(event.target.value.replace(/[^\d]/g, ""))}
                  placeholder={tr("輸入金額", "Enter amount", "金額を入力", "금액을 입력")}
                />
              </div>
              <div className="mp-row">
                <div className="mp-lbl">{tr("備註", "Note", "メモ", "메모")}</div>
                <input
                  className="mp-sinp"
                  value={transfer.note}
                  maxLength={60}
                  onChange={(event) => transfer.onNoteChange(event.target.value)}
                  placeholder={tr("可不填，例如：下午茶 / 車資 / 還款", "Optional, e.g. snacks / fare / repayment", "任意入力。例: おやつ / 交通費 / 返済", "선택 사항. 예: 간식 / 교통비 / 상환")}
                />
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button className="mp-save" style={{ flex: 1, background: "linear-gradient(135deg,#b0bec5,#90a4ae)" }} onClick={transfer.onClose}>
                  {tr("取消", "Cancel", "キャンセル", "취소")}
                </button>
                <button className="mp-save" style={{ flex: 1 }} disabled={transfer.submitting} onClick={transfer.onSubmit}>
                  {transfer.submitting
                    ? tr("轉帳中...", "Transferring...", "送金中...", "송금 중...")
                    : tr("確認轉帳", "Confirm transfer", "送金を確定", "송금 확인")}
                </button>
              </div>
            </div>
          </div>
        )}
      </MotionPresence>

      <MotionPresence show={Boolean(groupChat?.open)}>
        {groupChat?.open && (
          <React.Suspense fallback={null}>
            <GroupChatModals {...groupChat.props} />
          </React.Suspense>
        )}
      </MotionPresence>

      {toast && (
        <div className="mp-toast" data-phase={toast.phase} role="status" aria-live="polite">
          {toast.value}
        </div>
      )}
    </>
  );
}
