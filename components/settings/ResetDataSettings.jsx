import React from "react";

export default function ResetDataSettings({ tr, open, setOpen, clearCacheArmed, onClearAll, onClearCache }) {
  return <div className="mp-sg">
    <div className="mp-sg-t" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={() => setOpen((value) => !value)}>
      <span>{tr("重置資料", "Reset data", "データをリセット", "데이터 초기화")}</span>
      <span style={{ fontSize: 11, color: "var(--mp-txt-l)", fontWeight: 600 }}>{open ? tr("收合", "Collapse", "折りたたむ", "접기") : tr("展開", "Expand", "展開", "펼치기")}</span>
    </div>
    {open && <>
      <div style={{ fontSize: 11, color: "var(--mp-txt-l)", lineHeight: 1.8, marginBottom: 8 }}>
        <div><strong>{tr("全域資料", "Global data", "全体データ", "전체 데이터")}</strong>：{tr("清空所有遊玩內容，包含角色與玩家資料，把小手機回歸初始狀態。", "Clear all play data, including characters and player data, and return the phone to its initial state.", "すべてのプレイデータを消去し、キャラやプレイヤー情報も含めて初期状態に戻します。", "플레이 내용을 모두 지우고 캐릭터와 플레이어 데이터를 포함해 초기 상태로 되돌립니다.")}</div>
        <div><strong>{tr("清除快取", "Clear cache", "キャッシュを消去", "캐시 삭제")}</strong>：{tr("清除網站暫存與更新殘留，讓 App 重新載入最新版本。", "Clear cached site data and leftover update files so the app reloads the latest version.", "サイトの一時データと更新の残留ファイルを消去し、アプリを最新状態で再読み込みします。", "사이트 임시 데이터와 업데이트 잔여 파일을 지워 앱이 최신 버전으로 다시 불러오게 합니다.")}</div>
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        <button className="mp-save" style={{ background: "linear-gradient(135deg,#ef9a9a,#e53935)" }} onClick={onClearAll}>{tr("清空全部資料", "Clear all data", "すべてのデータを消去", "모든 데이터 삭제")}</button>
        <button type="button" className="mp-save" style={{ background: clearCacheArmed ? "linear-gradient(135deg,#ffb74d,#f57c00)" : "linear-gradient(135deg,#b0bec5,#78909c)" }} onClick={onClearCache}>{clearCacheArmed ? tr("再次確認清除快取", "Confirm cache clear again", "キャッシュ削除を再確認", "캐시 삭제 재확인") : tr("清除快取", "Clear cache", "キャッシュを消去", "캐시 삭제")}</button>
      </div>
    </>}
  </div>;
}
