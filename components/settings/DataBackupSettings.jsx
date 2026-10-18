import React from "react";
import CloudBackupSettings from "./CloudBackupSettings";
import LocalSnapshotSettings from "./LocalSnapshotSettings";
import { openBackupViewer } from "../../utils/openBackupViewer";

export default function DataBackupSettings({ tr, dataImporting, dataImportRef, onExport, onImport, cloudBackupProps, snapshotProps }) {
  return <>
    <div className="mp-sg">
      <div className="mp-sg-t">{tr("全域資料備份", "Global data backup", "全体データバックアップ", "전체 데이터 백업")}</div>
      <div style={{ fontSize: 12, color: "var(--mp-txt-l)", lineHeight: 1.7, marginBottom: 8 }}>
        {tr("將小手機的主要遊玩進度匯出為備份檔，或從備份檔匯入後繼續使用。", "Export this phone's main play progress as a backup file, or import a backup to continue.", "このスマホの主なプレイ進行をバックアップとして書き出すか、バックアップを取り込んで続けられます。", "이 휴대폰의 주요 플레이 진행 상황을 백업 파일로 내보내거나 백업을 가져와 계속할 수 있습니다.")}
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        <button type="button" className="mp-save" onClick={onExport}>{tr("匯出全域資料", "Export global data", "全体データを書き出す", "전체 데이터 내보내기")}</button>
        <button type="button" className="mp-save mp-save--secondary" onClick={() => dataImportRef.current?.click()}>{dataImporting ? tr("等待選擇檔案…", "Waiting for file selection…", "ファイル選択待ち…", "파일 선택 대기 중…") : tr("匯入全域資料", "Import global data", "全体データを取り込む", "전체 데이터 가져오기")}</button>
        <input ref={dataImportRef} type="file" accept=".json,application/json" style={{ display: "none" }} onChange={onImport} />
        <button type="button" className="mp-ibtn" onClick={openBackupViewer}>{tr("唯讀檢視備份檔／救援檔", "View a backup or rescue file (read-only)", "バックアップ／救出ファイルを閲覧（読み取り専用）", "백업/복구 파일 보기 (읽기 전용)")}</button>
      </div>
      <div style={{ fontSize: 11, color: "var(--mp-txt-l)", lineHeight: 1.6, marginTop: 6 }}>
        {tr("唯讀檢視會開啟另一個頁面，可以逛聊天室、社群、筆記等內容，確認檔案是不是你的；不會讀取或修改這台小手機的資料。", "The read-only viewer opens a separate page where you can browse chats, social posts, notes and more to check the file. It never reads or changes the data on this phone.", "読み取り専用ビューアは別ページで開き、チャットやSNS、ノートなどを見てファイルを確認できます。このスマホのデータは読み込みも変更もしません。", "읽기 전용 뷰어는 별도 페이지에서 열리며 채팅, 소셜, 노트 등을 둘러보며 파일을 확인할 수 있습니다. 이 휴대폰의 데이터는 읽거나 바꾸지 않습니다.")}
      </div>
    </div>
    {snapshotProps && <LocalSnapshotSettings tr={tr} {...snapshotProps} />}
    {cloudBackupProps && <CloudBackupSettings tr={tr} {...cloudBackupProps} />}
    <div className="mp-sg">
      <div className="mp-sg-t">{tr("使用提醒", "Usage notes", "使用上の注意", "사용 안내")}</div>
      <div style={{ fontSize: 12, color: "var(--mp-txt-l)", lineHeight: 1.8 }}>
        <div>• {tr("匯入或雲端還原會覆蓋目前裝置上的全域資料。", "Importing or restoring from cloud overwrites this device's global data.", "取り込みまたはクラウド復元は、現在の端末の全体データを上書きします。", "가져오기 또는 클라우드 복원은 이 기기의 전체 데이터를 덮어씁니다.")}</div>
        <div>• {tr("建議先匯出一份本機備份，再進行跨裝置還原。", "Export a local backup before restoring on another device.", "別の端末で復元する前に、まずローカルバックアップを書き出してください。", "다른 기기에서 복원하기 전에 먼저 로컬 백업을 내보내세요.")}</div>
        <div>• {tr("全域備份不會包含自帶 API Key 或雲端登入權杖。", "Global backups never include your own API keys or cloud sign-in tokens.", "全体バックアップには自前の API キーやクラウドのログイントークンは含まれません。", "전체 백업에는 개인 API 키나 클라우드 로그인 토큰이 포함되지 않습니다.")}</div>
      </div>
    </div>
  </>;
}
