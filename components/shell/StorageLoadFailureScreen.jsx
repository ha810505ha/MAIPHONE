import { useState } from "react";
import { VERSION } from "../../constants/appConstants.js";
import { copyRuntimeDiagnostics, getRuntimeDiagnostics } from "../../services/diagnostics/runtimeDiagnostics";
import { readRescueEntries } from "../../utils/indexedDbStorage";
import { downloadJsonFile, exportToastMessage } from "../../utils/exportFile";
import { openBackupViewer } from "../../utils/openBackupViewer";
import { AppHeader, SUB_PAGE_CLASS } from "./LargeTitle";

// 讀取或還原失敗時的保護畫面，提供重新讀取、唯讀救援與還原前備份匯出。
export function classifyStorageLoadError(error) {
  if (typeof indexedDB === "undefined") return "unavailable";
  const name = String(error?.name || "");
  const message = String(error?.message || "");
  if (name === "VersionError") return "version";
  if (name === "QuotaExceededError" || /quota|space|disk|backing store/i.test(message)) return "space";
  if (name === "SecurityError" || name === "InvalidAccessError") return "unavailable";
  return "other";
}

const hintFor = (category, tr) => {
  if (category === "version") return tr(
    "你的資料是由較新的版本存的，目前這個版本讀不了。請更新到最新版（網頁版請重新整理，App 請到商店更新），資料都還在。",
    "Your data was saved by a newer version that this one can't read. Update to the latest version (refresh the web page, or update the app). Your data is still there.",
    "データは新しいバージョンで保存されているため、このバージョンでは読み込めません。最新版に更新してください（ウェブ版は再読み込み、アプリはストアで更新）。データは残っています。",
    "데이터가 더 새로운 버전으로 저장되어 이 버전에서는 읽을 수 없습니다. 최신 버전으로 업데이트해 주세요(웹은 새로고침, 앱은 스토어에서 업데이트). 데이터는 그대로 있습니다.",
  );
  if (category === "space") return tr(
    "手機儲存空間可能不足。請先清出一些空間（例如刪除不用的照片或 App），再完全關閉並重新開啟。",
    "Your device may be low on storage. Free up some space (for example, delete unused photos or apps), then fully close and reopen.",
    "端末の空き容量が不足している可能性があります。不要な写真やアプリを削除して空きを作り、完全に閉じてから開き直してください。",
    "기기 저장 공간이 부족할 수 있습니다. 사용하지 않는 사진이나 앱을 삭제해 공간을 확보한 뒤 완전히 종료하고 다시 열어 주세요.",
  );
  if (category === "unavailable") return tr(
    "瀏覽器目前不允許存取資料（例如無痕模式或封鎖了網站資料）。請改用一般模式開啟。",
    "The browser isn't allowing data access right now (for example, private mode or blocked site data). Open it in normal mode.",
    "ブラウザがデータへのアクセスを許可していません（シークレットモードやサイトデータのブロックなど）。通常モードで開いてください。",
    "브라우저가 현재 데이터 접근을 허용하지 않습니다(시크릿 모드나 사이트 데이터 차단 등). 일반 모드로 열어 주세요.",
  );
  return tr(
    "請完全關閉 App 後重新開啟，或重新啟動手機再試。",
    "Fully close and reopen the app, or restart your device and try again.",
    "アプリを完全に閉じて開き直すか、端末を再起動してもう一度お試しください。",
    "앱을 완전히 종료한 뒤 다시 열거나, 기기를 재시작한 후 다시 시도해 주세요.",
  );
};

const timestampForFilename = () => new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/, "").replace("T", "-");

export default function StorageLoadFailureScreen({ error, tr, beforeRestoreBackup, themeCss, featureTitle, onRetry, onBack }) {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const restoreFailed = Boolean(beforeRestoreBackup);
  const category = classifyStorageLoadError(restoreFailed ? error?.rollbackError || error : error);

  const exportBeforeRestore = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await downloadJsonFile(beforeRestoreBackup, `maliphone-before-restore-${timestampForFilename()}.json`);
      setStatus(exportToastMessage(result, tr) || "");
    } catch {
      setStatus(tr("備份匯出失敗，請保留這個畫面並再試一次", "Backup export failed. Keep this screen open and try again", "バックアップを書き出せませんでした。この画面を開いたまま再試行してください", "백업 내보내기에 실패했습니다. 이 화면을 유지하고 다시 시도해 주세요"));
    } finally { setBusy(false); }
  };

  const reload = () => {
    if (restoreFailed && !window.confirm(tr("請先匯出還原前備份。重新讀取會失去記憶體中的這份備份，仍要繼續嗎？", "Export the pre-restore backup first. Reloading will discard this backup from memory. Continue?", "まず復元前のバックアップを書き出してください。再読み込みするとメモリ内のバックアップが失われます。続けますか？", "먼저 복원 전 백업을 내보내세요. 다시 읽으면 메모리에 있는 이 백업이 사라집니다. 계속할까요?"))) return;
    if (onRetry) onRetry();
    else window.location.reload();
  };

  const viewFile = () => {
    if (restoreFailed && !window.confirm(tr("請先匯出還原前備份。離開這個畫面可能失去記憶體中的備份，仍要前往檢視頁嗎？", "Export the pre-restore backup first. Leaving this screen may discard the backup from memory. Open the viewer?", "まず復元前のバックアップを書き出してください。この画面を離れるとメモリ内のバックアップが失われる可能性があります。閲覧ページを開きますか？", "먼저 복원 전 백업을 내보내세요. 이 화면을 떠나면 메모리의 백업이 사라질 수 있습니다. 뷰어를 열까요?"))) return;
    openBackupViewer();
  };

  const copyDetails = async () => {
    const copied = await copyRuntimeDiagnostics(getRuntimeDiagnostics().slice(0, 10));
    setStatus(copied
      ? tr("已複製錯誤資訊，可以貼給我們。", "Error details copied. You can paste them to us.", "エラー情報をコピーしました。貼り付けて送ってください。", "오류 정보를 복사했습니다. 붙여 넣어 보내 주세요.")
      : tr("無法複製，請截圖這個畫面回報。", "Couldn't copy. Please send a screenshot of this screen.", "コピーできませんでした。この画面のスクリーンショットを送ってください。", "복사하지 못했습니다. 이 화면을 캡처해 보내 주세요."));
  };

  const exportRescue = async () => {
    if (busy) return;
    setBusy(true);
    setStatus(tr("正在讀取還能讀到的資料…", "Reading whatever data is still readable…", "読み込めるデータを読み取っています…", "읽을 수 있는 데이터를 읽는 중…"));
    try {
      const { entries, skipped } = await readRescueEntries();
      const count = Object.keys(entries).length;
      if (!count) {
        setStatus(tr("找不到可以匯出的資料。請先不要清除資料或重裝，並把錯誤資訊回報給我們。", "No exportable data was found. Don't clear data or reinstall; please send us the error details.", "書き出せるデータが見つかりませんでした。データ消去や再インストールはせず、エラー情報を送ってください。", "내보낼 수 있는 데이터를 찾지 못했습니다. 데이터 삭제나 재설치를 하지 말고 오류 정보를 보내 주세요."));
        return;
      }
      const payload = {
        format: "maliphone-rescue",
        formatVersion: 1,
        appVersion: VERSION,
        exportedAt: new Date().toISOString(),
        loadError: { name: String(error?.name || "Error"), message: String(error?.message || "").slice(0, 300) },
        skipped,
        entries,
      };
      const result = await downloadJsonFile(payload, `maliphone-rescue-${timestampForFilename()}.json`);
      const exported = exportToastMessage(result, tr);
      if (!exported) {
        setStatus("");
        return;
      }
      const skippedNote = skipped.length
        ? tr(`（有 ${skipped.length} 筆讀不到，已略過）`, ` (${skipped.length} unreadable item(s) skipped)`, `（読み込めない ${skipped.length} 件はスキップしました）`, ` (읽을 수 없는 ${skipped.length}건은 건너뛰었습니다)`)
        : "";
      setStatus(`${exported}${skippedNote}${tr("。請保留這個檔案，回報時一起提供。", ". Keep this file and include it when you report.", "。このファイルを保管し、報告時に添えてください。", ". 이 파일을 보관하고 문의할 때 함께 보내 주세요.")}`);
    } catch (rescueError) {
      setStatus(`${tr("救援匯出失敗", "Rescue export failed", "救出エクスポートに失敗しました", "복구 내보내기에 실패했습니다")}: ${String(rescueError?.name || rescueError?.message || rescueError).slice(0, 80)}`);
    } finally {
      setBusy(false);
    }
  };

  const buttonRow = { display: "flex", flexDirection: "column", gap: 10, width: "100%", maxWidth: 260 };
  const buttonTextStyle = { color: "var(--mp-txt)" };
  return (
    <div className={featureTitle ? SUB_PAGE_CLASS : undefined} style={featureTitle ? { display: "flex", flexDirection: "column", minHeight: 0, background: "var(--mp-page-bg)", color: "var(--mp-txt)" } : undefined}>
      {featureTitle && <AppHeader title={featureTitle} onBack={onBack} backLabel={tr("返回", "Back", "戻る", "돌아가기")} />}
    <div role="alert" data-runtime-fallback="storage-load" style={{ ...(featureTitle ? { flex: 1, minHeight: 0, overflowY: "auto" } : { minHeight: "100dvh" }), display: "flex", flexDirection: "column", alignItems: "center", justifyContent: featureTitle ? "safe center" : "center", gap: 14, padding: 24, textAlign: "center", background: "var(--mp-page-bg, #fff5f8)", color: "var(--mp-txt, #4a3540)" }}>
      {themeCss && <style>{themeCss}</style>}
      <div style={{ fontSize: 17, fontWeight: 700 }}>{restoreFailed
        ? tr("還原未完成，已暫停自動存檔", "Restore incomplete; automatic saving paused", "復元が完了せず、自動保存を停止しました", "복원이 완료되지 않아 자동 저장을 중지했습니다")
        : tr("暫時讀不到你的資料", "Couldn't read your data", "データを読み込めませんでした", "데이터를 불러오지 못했습니다")}</div>
      <div style={{ fontSize: 13, lineHeight: 1.7, maxWidth: 320 }}>{restoreFailed ? tr(
        "資料套用失敗，回復原資料也未完成，目前存檔可能只有部分資料。請先匯出還原前備份（不含 API Key）；這份備份只暫存在記憶體，離開或重開後會失去。",
        "Applying data and rollback both failed. Saved data may be incomplete. Export the pre-restore backup first (without API keys). It is only held in memory and will be lost if you leave or reopen.",
        "データの適用と元データへの復帰に失敗し、保存データが不完全な可能性があります。まず復元前のバックアップ（API キーを除く）を書き出してください。メモリ内のみのため、画面を離れたり開き直すと失われます。",
        "데이터 적용과 원래 데이터 복구가 모두 실패해 저장 데이터가 불완전할 수 있습니다. 먼저 복원 전 백업(API 키 제외)을 내보내세요. 메모리에만 있으므로 화면을 떠나거나 다시 열면 사라집니다.",
      ) : featureTitle ? tr(
        "為了保護原有內容，此 App 已暫停編輯與存檔。重新讀取成功後才能繼續。",
        "Editing and saving in this app are paused to protect your existing content. Try again to continue once loading succeeds.",
        "既存の内容を守るため、このアプリの編集と保存を停止しました。再読み込みに成功すると続行できます。",
        "기존 내용을 보호하기 위해 이 앱의 편집과 저장을 중지했습니다. 다시 읽기에 성공하면 계속할 수 있습니다.",
      ) : tr(
        "為了保護你的資料，這次不會存檔，也不會覆蓋原本的內容。",
        "To protect your data, nothing will be saved and your existing data won't be overwritten.",
        "データを守るため、今回は保存せず、既存のデータも上書きしません。",
        "데이터 보호를 위해 이번에는 저장하지 않으며 기존 데이터도 덮어쓰지 않습니다.",
      )}</div>
      <div style={{ fontSize: 13, lineHeight: 1.7, maxWidth: 320, fontWeight: 600 }}>{hintFor(category, tr)}</div>
      <div style={{ fontSize: 12, lineHeight: 1.7, maxWidth: 320, opacity: 0.8 }}>{tr(
        "若一直出現，請先不要清除資料或重裝。可以先匯出救援檔保住還讀得到的資料，再複製錯誤資訊回報給我們。",
        "If this keeps happening, don't clear data or reinstall. Export a rescue file to keep whatever is still readable, then copy the error details and report them to us.",
        "繰り返し起きる場合は、データ消去や再インストールをしないでください。まず救出ファイルを書き出して読み込めるデータを確保し、エラー情報をコピーして報告してください。",
        "계속 발생하면 데이터 삭제나 재설치를 하지 마세요. 먼저 복구 파일을 내보내 읽을 수 있는 데이터를 지키고, 오류 정보를 복사해 알려 주세요.",
      )}</div>
      <div style={buttonRow}>
        {restoreFailed && <button type="button" className="mp-ibtn" style={buttonTextStyle} disabled={busy} onClick={exportBeforeRestore}>{tr("匯出還原前備份", "Export pre-restore backup", "復元前のバックアップを書き出す", "복원 전 백업 내보내기")}</button>}
        <button type="button" className="mp-ibtn" style={buttonTextStyle} disabled={busy} onClick={reload}>{tr("重新讀取", "Try again", "再読み込み", "다시 시도")}</button>
        <button type="button" className="mp-ibtn" style={buttonTextStyle} disabled={busy} onClick={exportRescue}>{busy ? tr("匯出中…", "Exporting…", "書き出し中…", "내보내는 중…") : tr("匯出救援檔", "Export rescue file", "救出ファイルを書き出す", "복구 파일 내보내기")}</button>
        <button type="button" className="mp-ibtn" style={buttonTextStyle} onClick={copyDetails}>{tr("複製錯誤資訊", "Copy error details", "エラー情報をコピー", "오류 정보 복사")}</button>
        <button type="button" className="mp-ibtn" style={buttonTextStyle} disabled={busy} onClick={viewFile}>{tr("檢視救援檔內容", "View a rescue file", "救出ファイルの中身を見る", "복구 파일 내용 보기")}</button>
      </div>
      {status && <div role="status" style={{ fontSize: 12, lineHeight: 1.6, maxWidth: 320 }}>{status}</div>}
    </div>
    </div>
  );
}
