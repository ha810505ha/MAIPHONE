import React from "react";

export default function DataBackupSettings({ tr, dataImporting, dataImportRef, onExport, onImport }) {
  return <>
    <div className="mp-sg">
      <div className="mp-sg-t">{tr("全域資料備份", "Global data backup", "全体データバックアップ", "전체 데이터 백업")}</div>
      <div style={{ fontSize: 12, color: "var(--mp-txt-l)", lineHeight: 1.7, marginBottom: 8 }}>{tr("這裡可以把整個 App 的主要進度打包下載，或從備份檔匯入後直接接續。", "You can export the app's main progress as a package, or import a backup file and continue from there.", "この場所では、アプリ全体の進行状況をまとめて書き出したり、バックアップファイルを取り込んで続きから再開できます。", "여기에서는 앱의 주요 진행 상황을 묶어서 내보내거나, 백업 파일을 가져와 이어서 사용할 수 있습니다.")}</div>
      <div style={{ display: "grid", gap: 8 }}>
        <button className="mp-save" style={{ background: "linear-gradient(135deg,#90caf9,#42a5f5)" }} onClick={onExport}>{tr("匯出全域資料", "Export global data", "全体データを書き出す", "전체 데이터 내보내기")}</button>
        <button type="button" className="mp-save" style={{ background: "linear-gradient(135deg,#b0bec5,#78909c)" }} onClick={() => dataImportRef.current?.click()}>{dataImporting ? tr("等待選擇檔案...", "Waiting for file selection...", "ファイル選択待ち...", "파일 선택 대기 중...") : tr("匯入全域資料", "Import global data", "全体データを取り込む", "전체 데이터 가져오기")}</button>
        <input ref={dataImportRef} type="file" accept=".json,application/json" style={{ display: "none" }} onChange={onImport} />
      </div>
    </div>
    <div className="mp-sg">
      <div className="mp-sg-t">{tr("使用提醒", "Usage notes", "使用上の注意", "사용 안내")}</div>
      <div style={{ fontSize: 12, color: "var(--mp-txt-l)", lineHeight: 1.8 }}>
        <div>• {tr("匯入會覆蓋目前裝置上的全域資料。", "Importing will overwrite the current device's global data.", "取り込むと現在の端末の全体データが上書きされます。", "가져오기를 하면 현재 기기의 전체 데이터가 덮어써집니다.")}</div>
        <div>• {tr("最適合拿來做手機和電腦之間的無痛銜接。", "Best for seamless handoff between phone and desktop.", "スマホとPCの間をスムーズに引き継ぐのに最適です。", "휴대폰과 PC 사이를 자연스럽게 이어 쓰기에 가장 좋습니다.")}</div>
        <div>• {tr("建議先保留一份原始備份，避免覆蓋到不想改動的內容。", "Keep an original backup first to avoid overwriting anything you didn't mean to change.", "元のバックアップを残しておくと、変更したくない内容を上書きせずに済みます。", "원본 백업을 먼저 보관해 두면 원치 않는 덮어쓰기를 피할 수 있습니다.")}</div>
      </div>
    </div>
  </>;
}
