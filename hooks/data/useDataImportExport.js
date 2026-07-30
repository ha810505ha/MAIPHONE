import { useCallback, useRef, useState } from "react";
import { exportToastMessage } from "../../utils/exportFile";

export default function useDataImportExport({ getExportableState, getRollbackState, downloadJsonFile, summarizeImportedData, validateImportedState, applyImportedState, showToast, tr, sanitizeText }) {
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
      const raw = JSON.parse(await file.text());
      validateImportedState?.(raw);
      setPreview({ fileName: file.name, fileSize: file.size, summary: summarizeImportedData(raw), raw });
    } catch (error) {
      showToast(`${tr("匯入失敗", "Import failed", "インポートに失敗しました", "가져오기에 실패했습니다")}：${sanitizeText(error?.message || tr("未知錯誤", "Unknown error", "不明なエラー", "알 수 없는 오류"), 80)}`);
      setImporting(false);
    } finally {
      if (importRef.current) importRef.current.value = "";
    }
  }, [summarizeImportedData, validateImportedState, showToast, tr, sanitizeText]);

  const confirmImport = useCallback(async () => {
    if (!preview?.raw) return;
    if (!window.confirm(tr("確認匯入後，將覆蓋目前裝置上的全域資料。確定要繼續嗎？", "Import will overwrite the current device's global data. Continue?", "インポートすると現在の端末の全体データが上書きされます。続けますか？", "가져오기를 하면 현재 기기의 전체 데이터가 덮어써집니다. 계속할까요?"))) return;
    let rollbackState = null;
    try {
      rollbackState = await getRollbackState();
      await applyImportedState(preview.raw);
      showToast(tr("資料已匯入", "Data imported", "データを取り込みました", "데이터를 가져왔습니다"));
      setPreview(null);
    } catch (error) {
      let rollbackError = null;
      if (rollbackState) {
        try { await applyImportedState(rollbackState, { rollback: true }); } catch (restoreError) { rollbackError = restoreError; }
      }
      const detail = rollbackError
        ? tr("匯入失敗，且自動還原未完成", "Import failed and automatic restore did not complete", "インポートに失敗し、自動復元も完了できませんでした", "가져오기에 실패했고 자동 복원도 완료되지 않았습니다")
        : tr("匯入失敗，原資料已還原", "Import failed; original data was restored", "インポートに失敗しました。元のデータは復元されました", "가져오기에 실패하여 원래 데이터를 복원했습니다");
      showToast(`${detail}：${sanitizeText(error?.message || tr("未知錯誤", "Unknown error", "不明なエラー", "알 수 없는 오류"), 80)}`);
    } finally { setImporting(false); }
  }, [preview, getRollbackState, applyImportedState, showToast, tr, sanitizeText]);

  const cancelImport = useCallback(() => { setPreview(null); setImporting(false); }, []);
  return { importRef, importing, preview, exportAllData, importAllData, confirmImport, cancelImport };
}
