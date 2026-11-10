import React from "react";
import { openBackupViewer } from "../../utils/openBackupViewer";

const formatTime = (value) => {
  const time = typeof value === "number" ? value : Date.parse(value);
  if (!Number.isFinite(time) || time <= 0) return "";
  try {
    return new Date(time).toLocaleString(undefined, { year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
};

// 卡片底色與文字用語意變數，夜色主題才看得清楚（test-theme-safety 會檢查）。
const boxStyle = { background: "var(--mp-card-bg,var(--mp-surface))", border: "1px solid var(--mp-card-border,var(--mp-line))", color: "var(--mp-page-text,var(--mp-txt))" };

export default function DataImportPreviewModal({ tr, preview, onCancel, onConfirm }) {
  if (!preview) return null;
  const summary = preview.summary;
  const content = summary.content || { characterNames: [], totalMessages: 0, recentChats: [] };
  const yesNo = (value) => (value ? tr("有", "Yes", "あり", "있음") : tr("無", "No", "なし", "없음"));
  const names = content.characterNames.slice(0, 5).join(tr("、", ", ", "、", ", "));
  const moreNames = content.characterNames.length > 5 ? tr(" 等", " and more", " など", " 등") : "";
  const formatLabel = summary.isRescue
    ? tr("救援檔", "Rescue file", "救出ファイル", "복구 파일")
    : summary.format === "maliphone-app-state"
      ? tr("MaliPhone 全域備份", "MaliPhone global backup", "MaliPhone 全体バックアップ", "MaliPhone 전체 백업")
      : tr("舊版或通用 JSON", "Legacy or generic JSON", "旧版または汎用 JSON", "구버전 또는 일반 JSON");
  return <div className="mp-overlay" style={{ zIndex: 125 }} onClick={onCancel}>
    <div className="mp-modal mp-import-preview" onClick={(event) => event.stopPropagation()}>
      <div className="mp-modal-t">{tr("匯入預覽", "Import preview", "インポートプレビュー", "가져오기 미리보기")}</div>
      <div className="mp-import-preview-body">
        <div style={{ fontSize: 12, color: "var(--mp-txt-l)", lineHeight: 1.8 }}>
          <div>{tr("檔名", "File name", "ファイル名", "파일 이름")}：{preview.fileName}</div>
          <div>{tr("格式", "Format", "形式", "형식")}：{formatLabel}{summary.exportedAt ? `（${formatTime(summary.exportedAt)}）` : ""}</div>
        </div>
        <div className="mp-import-preview-box" style={boxStyle}>
          <div><b>{tr(`角色 ${content.characterNames.length} 位`, `${content.characterNames.length} characters`, `キャラ ${content.characterNames.length} 人`, `캐릭터 ${content.characterNames.length}명`)}</b>{names ? `：${names}${moreNames}` : ""}</div>
          <div><b>{tr(`訊息 ${content.totalMessages.toLocaleString()} 則`, `${content.totalMessages.toLocaleString()} messages`, `メッセージ ${content.totalMessages.toLocaleString()} 件`, `메시지 ${content.totalMessages.toLocaleString()}개`)}</b> · {tr("群組", "Groups", "グループ", "그룹")} {summary.groupChats} · {tr("貼文", "Posts", "投稿", "게시물")} {summary.posts} · {tr("筆記", "Notes", "ノート", "노트")} {summary.notes || 0}</div>
        </div>
        {content.recentChats.length > 0 && <div className="mp-import-preview-box" style={boxStyle}>
          <b>{tr("最近的聊天", "Recent chats", "最近のチャット", "최근 채팅")}</b>
          {content.recentChats.map((item) => <div key={`${item.name}-${item.at}`} className="mp-import-preview-row"><span>{item.name}</span><span>{formatTime(item.at)}</span></div>)}
        </div>}
        <details className="mp-import-preview-all">
          <summary>{tr("全部項目", "All items", "すべての項目", "전체 항목")}</summary>
          <div style={{ marginTop: 6 }}>
            <div>{tr("大小", "Size", "サイズ", "크기")}：{Math.max(1, Math.round((preview.fileSize || 0) / 1024))} KB</div>
            <div>{tr("角色", "Characters", "キャラ", "캐릭터")}：{summary.characters}</div><div>{tr("聊天串", "Chat threads", "チャットスレッド", "채팅 스레드")}：{summary.chatThreads}</div><div>{tr("聊天室背景", "Chat backgrounds", "チャット背景", "채팅 배경")}：{summary.chatBackgrounds}</div><div>{tr("群組聊天室", "Group chats", "グループチャット", "그룹 채팅")}：{summary.groupChats}</div><div>{tr("場景", "Scenes", "シーン", "장면")}：{summary.scenes}</div><div>{tr("貼文", "Posts", "投稿", "게시물")}：{summary.posts}</div><div>{tr("世界書", "Lorebooks", "世界観", "월드북")}：{summary.lorebooks}</div><div>{tr("玩家資料", "Player profile", "プレイヤー情報", "플레이어 정보")}：{yesNo(summary.playerProfile)}</div><div>{tr("筆記", "Notes", "ノート", "노트")}：{summary.notes || 0}</div><div>{tr("每日登入", "Daily login", "ログイン報酬", "로그인 보상")}：{yesNo(summary.loginReward)}</div><div>{tr("寵物小屋", "Pet home", "ペットのおうち", "펫 하우스")}：{yesNo(summary.petHome)}</div><div>{tr("雲隱山莊", "Yunyin Villa", "雲隠山荘", "운은산장")}：{yesNo(summary.yunyin)}</div><div>{tr("自訂 CSS", "Custom CSS", "カスタム CSS", "사용자 CSS")}：{yesNo(summary.customCss)}</div>
          </div>
        </details>
        <div style={{ marginTop: 10, fontSize: 11, color: "var(--mp-txt-l)", lineHeight: 1.6 }}>
          {tr("匯入前會自動替目前資料留一份快照，匯錯了可以到「設定 → 資料 → 自動快照」還原。", "A snapshot of your current data is saved before importing, so you can undo it from Settings → Data → Automatic snapshots.", "インポート前に現在のデータのスナップショットを自動保存します。間違えた場合は「設定 → データ → 自動スナップショット」から戻せます。", "가져오기 전에 현재 데이터의 스냅샷을 자동 저장합니다. 잘못 가져왔다면 \"설정 → 데이터 → 자동 스냅샷\"에서 되돌릴 수 있습니다.")}
          {summary.isRescue && <> {tr("救援檔不含圖片，會保留這台裝置現有的圖片。", "Rescue files don't include images; images on this device are kept.", "救出ファイルには画像が含まれないため、この端末の画像はそのまま残ります。", "복구 파일에는 이미지가 없으므로 이 기기의 이미지는 유지됩니다.")}</>}
        </div>
        <button type="button" className="mp-import-preview-link" onClick={openBackupViewer}>{tr("想先逐頁看看？用「唯讀檢視」開這個檔案 ›", "Want to look through it first? Open this file in the read-only viewer ›", "先に中身を見たい場合は「読み取り専用ビューア」で開く ›", "먼저 내용을 보고 싶다면 \"읽기 전용 뷰어\"로 열기 ›")}</button>
      </div>
      <div className="mp-import-preview-actions"><button type="button" className="mp-save" style={{ flex: 1, background: "linear-gradient(135deg,#b0bec5,#90a4ae)" }} onClick={onCancel}>{tr("取消", "Cancel", "キャンセル", "취소")}</button><button type="button" className="mp-save" style={{ flex: 1, background: "linear-gradient(135deg,#ffb74d,#f57c00)" }} onClick={onConfirm}>{tr("確認匯入", "Confirm import", "インポートを確認", "가져오기 확인")}</button></div>
    </div>
  </div>;
}
