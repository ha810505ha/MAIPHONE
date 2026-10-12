import React, { useCallback, useEffect, useState } from "react";
import { deleteAllLocalSnapshots, listLocalSnapshots, SNAPSHOT_REASONS } from "../../services/backup/localSnapshotService";

const reasonLabel = (reason, tr) => {
  if (reason === SNAPSHOT_REASONS.daily) return tr("每日自動", "Daily", "毎日自動", "매일 자동");
  if (reason === SNAPSHOT_REASONS.beforeOverwrite) return tr("覆蓋資料前", "Before overwrite", "上書き前", "덮어쓰기 전");
  if (reason === SNAPSHOT_REASONS.beforeReset) return tr("清空資料前", "Before reset", "データ消去前", "데이터 삭제 전");
  if (reason === SNAPSHOT_REASONS.manual) return tr("手動建立", "Manual", "手動作成", "수동 생성");
  return tr("快照", "Snapshot", "スナップショット", "스냅샷");
};

const formatTime = (time) => {
  try {
    return new Date(time).toLocaleString(undefined, { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
};

export default function LocalSnapshotSettings({ tr, takeSnapshot, restoreSnapshot, showToast }) {
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setItems(await listLocalSnapshots());
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const createNow = async () => {
    if (busy) return;
    setBusy(true);
    const saved = await takeSnapshot?.(SNAPSHOT_REASONS.manual);
    showToast?.(saved
      ? tr("已建立快照", "Snapshot created", "スナップショットを作成しました", "스냅샷을 만들었습니다")
      : tr("建立快照失敗，可能是手機空間不足", "Couldn't create a snapshot. Your device may be low on storage.", "スナップショットを作成できませんでした。空き容量が不足している可能性があります", "스냅샷을 만들지 못했습니다. 저장 공간이 부족할 수 있습니다"));
    await refresh();
    setBusy(false);
  };

  const restore = async (item) => {
    if (busy) return;
    const proceed = window.confirm(tr(
      `要把文字資料還原到 ${formatTime(item.createdAt)} 的狀態嗎？之後的聊天與進度會回到那時候；這台裝置的圖片會保留。會嘗試先存目前資料的快照；若儲存失敗，還原仍會繼續，但無法用這份快照反悔。`,
      `Restore text data to ${formatTime(item.createdAt)}? Later chats and progress will go back to that time; images on this device are kept. We'll try to save a snapshot first. If saving fails, restoration continues but that snapshot won't be available to undo it.`,
      `テキストデータを ${formatTime(item.createdAt)} の状態に戻しますか？それ以降のチャットや進行はその時点に戻ります。この端末の画像は保持されます。先に現在のデータの保存を試みます。保存できなくても復元は続きますが、そのスナップショットで元に戻すことはできません。`,
      `텍스트 데이터를 ${formatTime(item.createdAt)} 상태로 복원할까요? 이후 채팅과 진행은 그 시점으로 돌아가며 이 기기의 이미지는 유지됩니다. 먼저 현재 데이터의 스냅샷 저장을 시도합니다. 저장에 실패해도 복원은 계속되지만 해당 스냅샷으로 되돌릴 수는 없습니다.`,
    ));
    if (!proceed) return;
    setBusy(true);
    try {
      const result = await restoreSnapshot(item.id);
      showToast?.(result?.snapshotCreated
        ? tr("已還原快照", "Snapshot restored", "スナップショットを復元しました", "스냅샷을 복원했습니다")
        : tr("已還原，但還原前的快照未能保存，無法用它反悔", "Restored, but the pre-restore snapshot couldn't be saved, so it can't be used to undo this", "復元しましたが、復元前のスナップショットを保存できなかったため、それで元に戻すことはできません", "복원했지만 복원 전 스냅샷을 저장하지 못해 해당 스냅샷으로 되돌릴 수 없습니다"));
    } catch (error) {
      const message = error?.restoreStatus === "busy"
        ? tr("正在還原，請稍候", "Restoration is in progress. Please wait", "復元中です。しばらくお待ちください", "복원 중입니다. 잠시 기다려 주세요")
        : error?.restoreStatus === "rolled-back"
          ? tr("還原失敗，已回復還原前的資料", "Restore failed; the original data was restored", "復元に失敗しました。復元前のデータに戻しました", "복원에 실패하여 복원 전 데이터로 되돌렸습니다")
          : error?.restoreStatus === "rollback-failed" || error?.restoreStatus === "blocked"
            ? tr("還原未完成，已暫停自動存檔。請先匯出還原前備份", "Restore is incomplete. Automatic saving is paused; export the pre-restore backup first", "復元が完了せず、自動保存を停止しました。まず復元前のバックアップを書き出してください", "복원이 완료되지 않아 자동 저장을 중지했습니다. 먼저 복원 전 백업을 내보내세요")
            : tr("無法開始還原，原資料沒有變動", "Restore could not start; the original data is unchanged", "復元を開始できませんでした。元のデータは変更されていません", "복원을 시작하지 못했습니다. 원래 데이터는 바뀌지 않았습니다");
      showToast?.(message);
    } finally {
      await refresh();
      setBusy(false);
    }
  };

  const clearAll = async () => {
    if (busy || !items.length) return;
    if (!window.confirm(tr(
      "要刪除這台裝置上的所有自動快照嗎？刪除後無法用快照救回資料。",
      "Delete all snapshots on this device? You won't be able to recover data from them afterward.",
      "この端末のスナップショットをすべて削除しますか？削除後はスナップショットからデータを戻せません。",
      "이 기기의 모든 스냅샷을 삭제할까요? 삭제하면 스냅샷으로 데이터를 되돌릴 수 없습니다.",
    ))) return;
    setBusy(true);
    try {
      await deleteAllLocalSnapshots();
    } catch {
      showToast?.(tr("刪除失敗", "Delete failed", "削除に失敗しました", "삭제에 실패했습니다"));
    }
    await refresh();
    setBusy(false);
  };

  const rowStyle = { display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderTop: "1px solid var(--mp-border, rgba(0,0,0,.08))" };
  return (
    <div className="mp-sg">
      <div className="mp-sg-t">{tr("自動快照", "Automatic snapshots", "自動スナップショット", "자동 스냅샷")}</div>
      <div style={{ fontSize: 12, color: "var(--mp-txt-l)", lineHeight: 1.7, marginBottom: 8 }}>
        {tr(
          "每天、以及匯入／下載雲端／還原／清空資料前，會自動在這台裝置留一份文字資料（不含圖片與 API Key）。資料被蓋掉或回溯時可以從這裡救回。手機或瀏覽器清除網站資料時快照也會一起消失，重要資料仍請匯出備份。",
          "A text-only copy (no images or API keys) is saved on this device every day and before importing, downloading from the cloud, restoring, or resetting. Use it to recover if data gets overwritten or rolled back. Snapshots are removed if the device or browser clears site data, so keep exporting backups for important data.",
          "毎日、およびインポート／クラウドからのダウンロード／復元／データ消去の前に、テキストデータ（画像と API キーを除く）をこの端末に自動保存します。データが上書きされたり巻き戻ったりしたときに、ここから戻せます。端末やブラウザがサイトデータを消去するとスナップショットも消えるため、大切なデータはバックアップを書き出してください。",
          "매일, 그리고 가져오기/클라우드 다운로드/복원/데이터 삭제 전에 텍스트 데이터(이미지와 API 키 제외)를 이 기기에 자동으로 저장합니다. 데이터가 덮어써지거나 되돌아갔을 때 여기서 복구할 수 있습니다. 기기나 브라우저가 사이트 데이터를 지우면 스냅샷도 함께 사라지므로 중요한 데이터는 백업을 내보내세요.",
        )}
      </div>
      {loadError && <div style={{ fontSize: 12, color: "var(--mp-txt-l)" }}>{tr("目前讀不到快照。", "Snapshots can't be read right now.", "現在スナップショットを読み込めません。", "지금은 스냅샷을 읽을 수 없습니다.")}</div>}
      {!loadError && !items.length && <div style={{ fontSize: 12, color: "var(--mp-txt-l)" }}>{tr("還沒有快照。", "No snapshots yet.", "スナップショットはまだありません。", "아직 스냅샷이 없습니다.")}</div>}
      {items.map((item) => (
        <div key={item.id} style={rowStyle}>
          <div style={{ flex: 1, minWidth: 0, fontSize: 12, lineHeight: 1.5 }}>
            <div style={{ fontWeight: 600 }}>{formatTime(item.createdAt)} · {reasonLabel(item.reason, tr)}</div>
            <div style={{ color: "var(--mp-txt-l)" }}>{tr(
              `${item.summary?.characters || 0} 位角色 · ${item.summary?.messages || 0} 則訊息`,
              `${item.summary?.characters || 0} characters · ${item.summary?.messages || 0} messages`,
              `キャラ ${item.summary?.characters || 0} 人 · メッセージ ${item.summary?.messages || 0} 件`,
              `캐릭터 ${item.summary?.characters || 0}명 · 메시지 ${item.summary?.messages || 0}개`,
            )}</div>
          </div>
          <button type="button" className="mp-ibtn" disabled={busy} onClick={() => restore(item)}>{tr("還原", "Restore", "復元", "복원")}</button>
        </div>
      ))}
      <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
        <button type="button" className="mp-ibtn" disabled={busy} onClick={createNow}>{busy ? tr("處理中…", "Working…", "処理中…", "처리 중…") : tr("立即建立快照", "Create snapshot now", "今すぐスナップショットを作成", "지금 스냅샷 만들기")}</button>
        {items.length > 0 && <button type="button" className="mp-ibtn" disabled={busy} onClick={clearAll}>{tr("刪除所有快照", "Delete all snapshots", "すべてのスナップショットを削除", "모든 스냅샷 삭제")}</button>}
      </div>
    </div>
  );
}
