import { useCallback, useEffect, useState } from "react";
import { listLocalSnapshots, SNAPSHOT_REASONS } from "../../services/backup/localSnapshotService";

// 開機發現資料庫是空的、但上次存檔有資料（通常是系統清掉了 App 的網頁資料庫，MP-090）。
// 先讓玩家從快照還原，或明確選擇先進入空的 App；在此之前不建立任何新存檔。
const reasonLabel = (reason, tr) => {
  if (reason === SNAPSHOT_REASONS.daily) return tr("每日自動", "Daily", "毎日自動", "매일 자동");
  if (reason === SNAPSHOT_REASONS.beforeOverwrite) return tr("覆蓋資料前", "Before overwrite", "上書き前", "덮어쓰기 전");
  if (reason === SNAPSHOT_REASONS.beforeReset) return tr("清空資料前", "Before reset", "データ消去前", "데이터 삭제 전");
  if (reason === SNAPSHOT_REASONS.manual) return tr("手動建立", "Manual", "手動作成", "수동 생성");
  if (reason === SNAPSHOT_REASONS.latest) return tr("最後一次存檔", "Latest save", "最後の保存", "마지막 저장");
  return tr("快照", "Snapshot", "スナップショット", "스냅샷");
};

const formatTime = (time) => {
  try {
    return new Date(time).toLocaleString(undefined, { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
};

export default function StorageWipedScreen({ tr, themeCss, notice, restoreSnapshot, onRestored, onContinue }) {
  const [items, setItems] = useState(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const refresh = useCallback(async () => {
    try {
      setItems(await listLocalSnapshots());
    } catch {
      setItems([]);
    }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const restore = async (item) => {
    if (busy) return;
    setBusy(true);
    setStatus(tr("正在還原…", "Restoring…", "復元中…", "복원 중…"));
    try {
      await restoreSnapshot(item.id);
      onRestored?.();
    } catch (error) {
      setStatus(error?.restoreStatus === "busy"
        ? tr("正在還原，請稍候", "Restoration is in progress. Please wait", "復元中です。しばらくお待ちください", "복원 중입니다. 잠시 기다려 주세요")
        : tr("還原失敗，請再試一次或先進入 App 再匯入備份", "Restore failed. Try again, or open the app and import a backup", "復元に失敗しました。もう一度試すか、アプリを開いてバックアップを取り込んでください", "복원에 실패했습니다. 다시 시도하거나 앱을 열어 백업을 가져오세요"));
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const continueEmpty = () => {
    if (busy) return;
    if (!window.confirm(tr(
      "確定先用空的資料進入 App 嗎？進入後仍可到「設定 → 匯入備份檔」或「下載雲端存檔」救回資料；這個提醒不會再出現。",
      "Open the app with empty data? You can still recover from Settings → Import backup or Download cloud save later; this notice won't show again.",
      "空のデータでアプリを開きますか？あとから「設定 → バックアップを取り込む」や「クラウドからダウンロード」で戻せます。この通知は再表示されません。",
      "빈 데이터로 앱을 열까요? 나중에 설정 → 백업 가져오기 또는 클라우드 저장 다운로드로 복구할 수 있으며 이 알림은 다시 표시되지 않습니다.",
    ))) return;
    onContinue?.();
  };

  const characters = Number(notice?.characters) || 0;
  const messages = Number(notice?.messages) || 0;
  const savedAt = Number(notice?.savedAt) || 0;
  const rowStyle = { display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderTop: "1px solid var(--mp-border, rgba(0,0,0,.08))", width: "100%", maxWidth: 320, textAlign: "left" };
  const buttonTextStyle = { color: "var(--mp-txt)" };

  return (
    <div role="alert" data-runtime-fallback="storage-wiped" style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "safe center", gap: 14, padding: 24, textAlign: "center", overflowY: "auto", background: "var(--mp-page-bg, #fff5f8)", color: "var(--mp-txt, #4a3540)" }}>
      {themeCss && <style>{themeCss}</style>}
      <div style={{ fontSize: 17, fontWeight: 700 }}>{tr("這台裝置上的資料不見了", "Your data on this device is gone", "この端末のデータが見つかりません", "이 기기의 데이터가 사라졌습니다")}</div>
      <div style={{ fontSize: 13, lineHeight: 1.7, maxWidth: 320 }}>{tr(
        `上次存檔${savedAt ? `（${formatTime(savedAt)}）` : ""}還有 ${characters} 位角色、${messages} 則訊息，這次開啟時手機裡的資料庫是空的。這通常是系統在空間不足或資料庫損毀時清掉了 App 的網頁資料，不是你刪的。`,
        `Your last save${savedAt ? ` (${formatTime(savedAt)})` : ""} had ${characters} characters and ${messages} messages, but the database on this device is empty now. This usually happens when the system clears the app's web storage because of low space or corruption, not because you deleted anything.`,
        `前回の保存${savedAt ? `（${formatTime(savedAt)}）` : ""}にはキャラ ${characters} 人・メッセージ ${messages} 件がありましたが、今回は端末のデータベースが空でした。空き容量不足やデータベース破損でシステムがアプリのウェブデータを消したときに起こります。あなたが消したわけではありません。`,
        `마지막 저장${savedAt ? ` (${formatTime(savedAt)})` : ""}에는 캐릭터 ${characters}명, 메시지 ${messages}개가 있었지만 지금 기기의 데이터베이스가 비어 있습니다. 보통 저장 공간 부족이나 손상으로 시스템이 앱의 웹 데이터를 지웠을 때 생기며, 직접 삭제한 것이 아닙니다.`,
      )}</div>
      <div style={{ fontSize: 13, lineHeight: 1.7, maxWidth: 320, fontWeight: 600 }}>{tr(
        "為了不蓋掉任何還能救回的東西，App 先停在這裡。請從下面的快照還原；沒有合適的快照，就先進入 App，再到設定匯入備份檔或下載雲端存檔。",
        "To avoid overwriting anything recoverable, the app stops here. Restore from a snapshot below, or open the app and then import a backup or download your cloud save from Settings.",
        "戻せるものを上書きしないため、アプリはここで止まっています。下のスナップショットから復元するか、アプリを開いてから設定でバックアップの取り込みやクラウドからのダウンロードをしてください。",
        "복구할 수 있는 것을 덮어쓰지 않도록 앱이 여기서 멈춥니다. 아래 스냅샷에서 복원하거나, 앱을 연 뒤 설정에서 백업 가져오기 또는 클라우드 저장 다운로드를 해 주세요.",
      )}</div>
      <div style={{ width: "100%", maxWidth: 320, fontSize: 12 }}>
        {items === null && <div style={{ color: "var(--mp-txt-l)" }}>{tr("正在讀取快照…", "Loading snapshots…", "スナップショットを読み込み中…", "스냅샷을 불러오는 중…")}</div>}
        {items && !items.length && <div style={{ color: "var(--mp-txt-l)" }}>{tr("這台裝置沒有可用的快照。", "No snapshots are available on this device.", "この端末に使えるスナップショットはありません。", "이 기기에 사용할 수 있는 스냅샷이 없습니다.")}</div>}
        {(items || []).map((item) => (
          <div key={item.id} style={rowStyle}>
            <div style={{ flex: 1, minWidth: 0, lineHeight: 1.5 }}>
              <div style={{ fontWeight: 600 }}>{formatTime(item.createdAt)} · {reasonLabel(item.reason, tr)}</div>
              <div style={{ color: "var(--mp-txt-l)" }}>{tr(
                `${item.summary?.characters || 0} 位角色 · ${item.summary?.messages || 0} 則訊息`,
                `${item.summary?.characters || 0} characters · ${item.summary?.messages || 0} messages`,
                `キャラ ${item.summary?.characters || 0} 人 · メッセージ ${item.summary?.messages || 0} 件`,
                `캐릭터 ${item.summary?.characters || 0}명 · 메시지 ${item.summary?.messages || 0}개`,
              )}</div>
            </div>
            <button type="button" className="mp-ibtn" style={buttonTextStyle} disabled={busy} onClick={() => restore(item)}>{tr("還原", "Restore", "復元", "복원")}</button>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 260 }}>
        <button type="button" className="mp-ibtn" style={buttonTextStyle} disabled={busy} onClick={continueEmpty}>{tr("先進入 App（資料是空的）", "Open the app (empty data)", "アプリを開く（データは空）", "앱 열기(빈 데이터)")}</button>
      </div>
      {status && <div role="status" style={{ fontSize: 12, lineHeight: 1.6, maxWidth: 320 }}>{status}</div>}
    </div>
  );
}
