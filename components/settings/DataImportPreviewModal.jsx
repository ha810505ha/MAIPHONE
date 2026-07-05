import React from "react";

export default function DataImportPreviewModal({ tr, preview, onCancel, onConfirm }) {
  if (!preview) return null;
  const summary = preview.summary;
  return <div className="mp-overlay" style={{ zIndex: 125 }} onClick={onCancel}>
    <div className="mp-modal" onClick={(event) => event.stopPropagation()}>
      <div className="mp-modal-t">{tr("匯入預覽", "Import preview", "インポートプレビュー", "가져오기 미리보기")}</div>
      <div style={{ fontSize: 12, color: "var(--mp-txt-l)", lineHeight: 1.8 }}>
        <div>{tr("檔名", "File name", "ファイル名", "파일 이름")}：{preview.fileName}</div>
        <div>{tr("大小", "Size", "サイズ", "크기")}：{Math.max(1, Math.round((preview.fileSize || 0) / 1024))} KB</div>
        <div>{tr("格式", "Format", "形式", "형식")}：{summary.format === "maliphone-app-state" ? tr("MaliPhone 全域備份", "MaliPhone global backup", "MaliPhone 全体バックアップ", "MaliPhone 전체 백업") : tr("舊版或通用 JSON", "Legacy or generic JSON", "旧版または汎用 JSON", "구버전 또는 일반 JSON")}</div>
        {summary.exportedAt && <div>{tr("匯出時間", "Export time", "書き出し時刻", "내보낸 시간")}：{summary.exportedAt}</div>}
      </div>
      <div style={{ marginTop: 10, padding: 10, borderRadius: 12, background: "rgba(255,255,255,.7)", border: "1px solid rgba(160,176,186,.2)", fontSize: 12, lineHeight: 1.8, color: "var(--mp-txt)" }}>
        <div>{tr("角色", "Characters", "キャラ", "캐릭터")}：{summary.characters}</div><div>{tr("聊天串", "Chat threads", "チャットスレッド", "채팅 스레드")}：{summary.chatThreads}</div><div>{tr("聊天室背景", "Chat backgrounds", "チャット背景", "채팅 배경")}：{summary.chatBackgrounds}</div><div>{tr("群組聊天室", "Group chats", "グループチャット", "그룹 채팅")}：{summary.groupChats}</div><div>{tr("場景", "Scenes", "シーン", "장면")}：{summary.scenes}</div><div>{tr("貼文", "Posts", "投稿", "게시물")}：{summary.posts}</div><div>{tr("世界書", "Lorebooks", "世界観", "월드북")}：{summary.lorebooks}</div><div>{tr("玩家資料", "Player profile", "プレイヤー情報", "플레이어 정보")}：{summary.playerProfile ? tr("有", "Yes", "あり", "있음") : tr("無", "No", "なし", "없음")}</div>
      </div>
      <div style={{ marginTop: 10, fontSize: 11, color: "var(--mp-txt-l)", lineHeight: 1.6 }}>{tr("先確認這份備份內容是不是你要的，再按下面的確認匯入。", "Please confirm this backup is the one you want, then tap confirm import below.", "このバックアップ内容が目的のものか確認してから、下のインポート確認を押してください。", "이 백업 내용이 맞는지 확인한 뒤 아래의 가져오기 확인을 눌러주세요.")}</div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}><button type="button" className="mp-save" style={{ flex: 1, background: "linear-gradient(135deg,#b0bec5,#90a4ae)" }} onClick={onCancel}>{tr("取消", "Cancel", "キャンセル", "취소")}</button><button type="button" className="mp-save" style={{ flex: 1, background: "linear-gradient(135deg,#ffb74d,#f57c00)" }} onClick={onConfirm}>{tr("確認匯入", "Confirm import", "インポートを確認", "가져오기 확인")}</button></div>
    </div>
  </div>;
}
