import React from "react";

export default function ChatroomImportPreviewModal({ tr, preview, onCancel, onConfirm }) {
  if (!preview) return null;
  const summary = preview.summary;
  return <div className="mp-overlay" style={{ zIndex: 125 }} onClick={onCancel}>
    <div className="mp-modal" onClick={(event) => event.stopPropagation()}>
      <div className="mp-modal-t">{tr("聊天室匯入預覽", "Chatroom import preview", "チャットルームのインポート確認", "채팅방 가져오기 미리보기")}</div>
      <div style={{ marginBottom: 10, padding: "9px 10px", borderRadius: 12, background: "rgba(255,183,77,.18)", border: "1px solid rgba(245,124,0,.28)", fontSize: 13, fontWeight: 800, color: "var(--mp-txt)" }}>{tr("即將匯入至", "Import into", "インポート先", "가져올 대상")}：{preview.targetCharacterName || tr("未知角色", "Unknown character", "不明なキャラ", "알 수 없는 캐릭터")}</div>
      <div style={{ fontSize: 12, color: "var(--mp-txt-l)", lineHeight: 1.8 }}><div>{tr("檔名", "File name", "ファイル名", "파일 이름")}：{preview.fileName}</div><div>{tr("大小", "Size", "サイズ", "크기")}：{Math.max(1, Math.round((preview.fileSize || 0) / 1024))} KB</div><div>{tr("格式", "Format", "形式", "형식")}：{summary.format === "maliphone-chatroom" ? tr("MaliPhone 聊天室備份", "MaliPhone chatroom backup", "MaliPhone チャットルームバックアップ", "MaliPhone 채팅방 백업") : tr("舊版或通用 JSON", "Legacy or generic JSON", "旧版または汎用 JSON", "구버전 또는 일반 JSON")}</div>{summary.exportedAt && <div>{tr("匯出時間", "Export time", "書き出し時刻", "내보낸 시간")}：{summary.exportedAt}</div>}</div>
      <div style={{ marginTop: 10, padding: 10, borderRadius: 12, background: "rgba(255,255,255,.7)", border: "1px solid rgba(160,176,186,.2)", fontSize: 12, lineHeight: 1.8, color: "var(--mp-txt)" }}><div>{tr("訊息數", "Message count", "メッセージ数", "메시지 수")}：{summary.messages}</div><div>{tr("互動模式", "Interaction mode", "インタラクションモード", "상호작용 모드")}：{summary.hasMode ? tr("有", "Yes", "あり", "있음") : tr("無", "No", "なし", "없음")}</div><div>{tr("聊天室背景", "Chat background", "チャット背景", "채팅 배경")}：{summary.hasBackground ? tr("有", "Yes", "あり", "있음") : tr("無", "No", "なし", "없음")}</div><div>{tr("世界書綁定", "Lorebook binding", "ワールドブック連携", "월드북 연결")}：{summary.hasBinding ? tr("有", "Yes", "あり", "있음") : tr("無", "No", "なし", "없음")}</div><div>{tr("現實時間設定", "Real-time setting", "現実時間設定", "현실 시간 설정")}：{summary.hasTimeSetting ? tr("有", "Yes", "あり", "있음") : tr("無", "No", "なし", "없음")}</div></div>
      <div style={{ marginTop: 10, fontSize: 11, color: "var(--mp-txt-l)", lineHeight: 1.6 }}>{tr("先確認這是不是你要接續的聊天室內容，再按下面的確認匯入。", "Please confirm this is the chatroom you want to continue, then tap confirm import below.", "続けたいチャットルームか確認してから、下のインポート確認を押してください。", "계속할 채팅방이 맞는지 확인한 뒤 아래의 가져오기 확인을 눌러주세요.")}</div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}><button type="button" className="mp-save" style={{ flex: 1, background: "linear-gradient(135deg,#b0bec5,#90a4ae)" }} onClick={onCancel}>{tr("取消", "Cancel", "キャンセル", "취소")}</button><button type="button" className="mp-save" style={{ flex: 1, background: "linear-gradient(135deg,#ffb74d,#f57c00)" }} onClick={onConfirm}>{tr("確認匯入", "Confirm import", "インポートを確認", "가져오기 확인")}</button></div>
    </div>
  </div>;
}
