import { useCallback, useRef, useState } from "react";
import { exportToastMessage } from "../../utils/exportFile";
import { isRescueFile, rescueToAppState } from "../../utils/backupInspect";
import { dataRestoreFailureMessage } from "../../services/backup/dataRestoreTransaction";

export default function useDataImportExport({ getExportableState, downloadJsonFile, summarizeImportedData, validateImportedState, applyImportedState, showToast, tr, sanitizeText }) {
  const importRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState(null);

  const exportAllData = useCallback(async () => {
    try {
      const result = await downloadJsonFile(await getExportableState(), `maliphone-backup-${new Date().toISOString().slice(0, 10)}.json`);
      const message = exportToastMessage(result, tr);
      if (message) showToast(`${tr("資料", "Data", "データ", "데이터")}${message}`);
    } catch (error) {
      showToast(`${tr("匯出失敗", "Export failed", "書き出しに失敗しました", "내보내기 실패")}：${sanitizeText(error?.message || "Unknown error", 80)}`);
    }
  }, [downloadJsonFile, getExportableState, showToast, tr, sanitizeText]);

  const importAllData = useCallback(async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const parsed = JSON.parse(await file.text());
      // 救援檔先轉成一般全域備份格式，之後與一般匯入走同一條流程（含預覽與匯入前快照）。
      const raw = isRescueFile(parsed) ? rescueToAppState(parsed) : parsed;
      validateImportedState?.(raw);
      setPreview({ fileName: file.name, fileSize: file.size, summary: summarizeImportedData(raw), raw });
    } catch (error) {
      showToast(error?.code === "RESCUE_CORE_MISSING"
        ? tr("救援檔缺少核心資料，不能直接還原。請從「唯讀檢視備份檔／救援檔」查看剩餘內容", "The rescue file is missing core data and can't be restored. Use the read-only backup/rescue viewer to see the remaining content", "救出ファイルにコアデータがないため復元できません。バックアップ／救出ファイルの読み取り専用ビューアで残った内容を確認してください", "복구 파일에 핵심 데이터가 없어 복원할 수 없습니다. 읽기 전용 백업/복구 뷰어에서 남은 내용을 확인해 주세요")
        : `${tr("匯入失敗", "Import failed", "インポートに失敗しました", "가져오기에 실패했습니다")}：${sanitizeText(error?.message || tr("未知錯誤", "Unknown error", "不明なエラー", "알 수 없는 오류"), 80)}`);
      setImporting(false);
    } finally {
      if (importRef.current) importRef.current.value = "";
    }
  }, [summarizeImportedData, validateImportedState, showToast, tr, sanitizeText]);

  const confirmImport = useCallback(async () => {
    if (!preview?.raw) return;
    if (!window.confirm(tr("確認匯入後，將覆蓋目前裝置上的全域資料。確定要繼續嗎？", "Import will overwrite the current device's global data. Continue?", "インポートすると現在の端末の全体データが上書きされます。続けますか？", "가져오기를 하면 현재 기기의 전체 데이터가 덮어써집니다. 계속할까요?"))) return;
    try {
      await applyImportedState(preview.raw);
      showToast(tr("資料已匯入", "Data imported", "データを取り込みました", "데이터를 가져왔습니다"));
      setPreview(null);
    } catch (error) {
      showToast(dataRestoreFailureMessage(error, tr));
    } finally { setImporting(false); }
  }, [preview, applyImportedState, showToast, tr]);

  const cancelImport = useCallback(() => { setPreview(null); setImporting(false); }, []);
  return { importRef, importing, preview, exportAllData, importAllData, confirmImport, cancelImport };
}
