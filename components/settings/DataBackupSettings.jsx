import React from "react";
import CloudBackupSettings from "./CloudBackupSettings";

export default function DataBackupSettings({ tr, dataImporting, dataImportRef, onExport, onImport, cloudBackupProps }) {
  return <>
    <div className="mp-sg">
      <div className="mp-sg-t">{tr("全域資料備份", "Global data backup", "全体データバックアップ", "전체 데이터 백업")}</div>
      <div style={{ fontSize: 12, color: "var(--mp-txt-l)", lineHeight: 1.7, marginBottom: 8 }}>
        {tr("將小手機的主要遊玩進度匯出為備份檔，或從備份檔匯入後繼續使用。", "Export this phone's main play progress as a backup file, or import a backup to continue.", "このスマホの主なプレイ進行をバックアップとして書き出すか、バックアップを取り込んで続けられます。", "이 휴대폰의 주요 플레이 진행 상황을 백업 파일로 내보내거나 백업을 가져와 계속할 수 있습니다.")}
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        <button className="mp-save" style={{ background: "linear-gradient(135deg,#90caf9,#42a5f5)" }} onClick={onExport}>{tr("匯出全域資料", "Export global data", "全体データを書き出す", "전체 데이터 내보내기")}</button>
        <button type="button" className="mp-save" style={{ background: "linear-gradient(135deg,#b0bec5,#78909c)" }} onClick={() => dataImportRef.current?.click()}>{dataImporting ? tr("等待選擇檔案…", "Waiting for file selection…", "ファイル選択待ち…", "파일 선택 대기 중…") : tr("匯入全域資料", "Import global data", "全体データを取り込む", "전체 데이터 가져오기")}</button>
        <input ref={dataImportRef} type="file" accept=".json,application/json" style={{ display: "none" }} onChange={onImport} />
      </div>
    </div>
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
