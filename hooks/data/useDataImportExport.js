import { useCallback, useRef, useState } from "react";

export default function useDataImportExport({ getExportableState, downloadJsonFile, summarizeImportedData, applyImportedState, showToast, tr, sanitizeText }) {
  const importRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState(null);

  const exportAllData = useCallback(() => {
    downloadJsonFile(getExportableState(), `maliphone-backup-${new Date().toISOString().slice(0, 10)}.json`);
    showToast(tr("資料已匯出", "Data exported", "データを書き出しました", "데이터를 내보냈습니다"));
  }, [downloadJsonFile, getExportableState, showToast, tr]);

  const importAllData = useCallback(async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const raw = JSON.parse(await file.text());
      setPreview({ fileName: file.name, fileSize: file.size, summary: summarizeImportedData(raw), raw });
    } catch (error) {
      showToast(`${tr("匯入失敗", "Import failed", "インポートに失敗しました", "가져오기에 실패했습니다")}：${sanitizeText(error?.message || tr("未知錯誤", "Unknown error", "不明なエラー", "알 수 없는 오류"), 80)}`);
      setImporting(false);
    } finally {
      if (importRef.current) importRef.current.value = "";
    }
  }, [summarizeImportedData, showToast, tr, sanitizeText]);

  const confirmImport = useCallback(async () => {
    if (!preview?.raw) return;
    if (!window.confirm(tr("確認匯入後，將覆蓋目前裝置上的全域資料。確定要繼續嗎？", "Import will overwrite the current device's global data. Continue?", "インポートすると現在の端末の全体データが上書きされます。続けますか？", "가져오기를 하면 현재 기기의 전체 데이터가 덮어써집니다. 계속할까요?"))) return;
    try {
      await applyImportedState(preview.raw);
      showToast(tr("資料已匯入", "Data imported", "データを取り込みました", "데이터를 가져왔습니다"));
      setPreview(null);
    } catch (error) {
      showToast(`${tr("匯入失敗", "Import failed", "インポートに失敗しました", "가져오기 실패")}：${sanitizeText(error?.message || tr("未知錯誤", "Unknown error", "不明なエラー", "알 수 없는 오류"), 80)}`);
    } finally { setImporting(false); }
  }, [preview, applyImportedState, showToast, tr, sanitizeText]);

  const cancelImport = useCallback(() => { setPreview(null); setImporting(false); }, []);
  return { importRef, importing, preview, exportAllData, importAllData, confirmImport, cancelImport };
}
