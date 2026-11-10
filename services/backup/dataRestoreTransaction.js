// Callers capture the original data before starting and keep automatic writes paused.
export async function runDataRestoreTransaction({ apply, rollback }) {
  try {
    return await apply();
  } catch (cause) {
    try {
      await rollback();
    } catch (rollbackError) {
      const error = new Error("Restore and rollback failed", { cause });
      error.restoreStatus = "rollback-failed";
      error.rollbackError = rollbackError;
      throw error;
    }
    const error = new Error("Restore failed; original data restored", { cause });
    error.restoreStatus = "rolled-back";
    throw error;
  }
}

export function dataRestoreFailureMessage(error, tr) {
  if (error?.restoreStatus === "busy") return tr("正在套用資料，請稍候", "Data is being applied. Please wait", "データを適用中です。しばらくお待ちください", "데이터를 적용 중입니다. 잠시 기다려 주세요");
  if (error?.restoreStatus === "rolled-back") return tr("套用失敗，已回復原資料", "Data could not be applied; the original data was restored", "適用に失敗しました。元のデータに戻しました", "적용에 실패하여 원래 데이터를 복원했습니다");
  if (error?.restoreStatus === "rollback-failed" || error?.restoreStatus === "blocked") return tr("資料套用與回復未完成，已暫停自動存檔。請先匯出還原前備份", "Applying and restoring data did not complete. Automatic saving is paused; export the pre-restore backup first", "データの適用と復帰が完了せず、自動保存を停止しました。まず復元前のバックアップを書き出してください", "데이터 적용과 복구가 완료되지 않아 자동 저장을 중지했습니다. 먼저 복원 전 백업을 내보내세요");
  return tr("無法開始套用資料，原資料沒有變動", "Data could not be applied; the original data is unchanged", "データの適用を開始できませんでした。元のデータは変更されていません", "데이터 적용을 시작하지 못했습니다. 원래 데이터는 변경되지 않았습니다");
}
