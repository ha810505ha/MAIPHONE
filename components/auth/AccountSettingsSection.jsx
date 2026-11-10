import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Eye, EyeOff, KeyRound, LogIn, LogOut, Mail, UserPlus } from "lucide-react";
import {
  getCloudDataConfig,
  getCloudDocument,
  getCloudDocumentHistoryVersion,
  isCloudUploadRateLimited,
  listCloudDocumentHistory,
  runCloudDatabaseConnectionTest,
} from "../../services/cloud/cloudDataService.js";
import { metaAfterHistoryRestore } from "../../services/cloud/cloudSyncRevision.js";
import { CLOUD_SYNC_REVISION_TEXT, fillCloudSyncText } from "../../constants/cloudSyncRevisionText.js";
import { validateTextSyncDocument } from "../../utils/textSyncDocument.js";
import { dataRestoreFailureMessage } from "../../services/backup/dataRestoreTransaction.js";
import { CLOUD_MEDIA_SYNC_TEXT, cloudMediaSyncSummary } from "../../constants/cloudMediaSyncText.js";
import { isCloudUploadAllowed, isOfficialSite } from "../../config/featureFlags.js";
import {
  TEXT_SYNC_DOCUMENT_KEY, TextSyncDocumentTooLargeError, TextSyncRemoteReadError, readTextSyncMeta, saveTextSyncMeta, uploadTextSyncDocument,
} from "../../services/cloud/textSyncService.js";

const inputStyle = {
  width: "100%",
  padding: "10px 11px",
  borderRadius: 11,
  border: "1px solid var(--mp-card-border)",
  boxSizing: "border-box",
  background: "var(--mp-page-control-bg,var(--mp-surface))",
  color: "var(--mp-page-text,var(--mp-txt))",
};

const primaryButton = {
  width: "100%",
  border: "none",
  borderRadius: 999,
  padding: "11px 14px",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
  background: "linear-gradient(135deg,#ff9abd,#e86c9b)",
};

const secondaryButton = {
  ...primaryButton,
  color: "var(--mp-accent,var(--mp-pink-dk))",
  background: "var(--mp-page-control-bg,var(--mp-surface))",
  border: "1px solid var(--mp-card-border)",
};

const accountDetailCard = {
  padding: 12,
  borderRadius: 13,
  background: "var(--mp-card-bg,var(--mp-surface))",
  border: "1px solid var(--mp-card-border)",
  color: "var(--mp-page-text,var(--mp-txt))",
  lineHeight: 1.75,
};

const cloudTestCard = {
  ...accountDetailCard,
  background: "color-mix(in srgb,var(--mp-info) 8%,var(--mp-card-bg,var(--mp-surface)))",
  borderColor: "color-mix(in srgb,var(--mp-info) 28%,var(--mp-card-border))",
};


function formatSyncTime(value, locale) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(locale || undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

export default function AccountSettingsSection({ auth, tr, notify, textSyncProps }) {
  const text = (zh, en, ja = en, ko = en) => tr(zh, en, ja, ko);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");
  const [cloudTestBusy, setCloudTestBusy] = useState(false);
  const [cloudTestStatus, setCloudTestStatus] = useState("");
  const [textSyncBusy, setTextSyncBusy] = useState(false);
  const [textSyncStatus, setTextSyncStatus] = useState("");
  const [textSyncFailed, setTextSyncFailed] = useState(false);
  const [textSyncMeta, setTextSyncMeta] = useState(null);
  const [remoteTextSyncMeta, setRemoteTextSyncMeta] = useState(null);
  // MP-032 P2：雲端較新時先擋下來請玩家選擇；P5：雲端舊版本列表。
  const [syncConflict, setSyncConflict] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyState, setHistoryState] = useState({ loading: false, versions: null, failed: false });
  const user = auth?.user;
  const cloudDataConfigured = getCloudDataConfig().configured;
  // 正式站只讀雲端，不上傳（MP-090）。
  const uploadAllowed = isCloudUploadAllowed();
  // 這台裝置沒有任何角色而雲端有存檔：多半是新瀏覽器或資料被清掉，提示一鍵載入；絕不自動覆蓋。
  const localCharacterCount = Number(textSyncProps?.localCharacterCount);
  const offerCloudLoad = Number.isFinite(localCharacterCount) && localCharacterCount === 0 && !!remoteTextSyncMeta;
  // 自動同步（MP-094）：狀態由 MaliPhone 的 useCloudAutoSync 提供。
  const autoSync = textSyncProps?.autoSync;
  // 正式站（2026-10-29）：像一般 AI 聊天平台，只留登入／登出、自動同步開關與一行狀態，不顯示手動上傳／下載與雲端舊版本。
  // 自動同步不可用（旗標關閉等）時退回原本的手動按鈕，避免正式站完全沒有同步方式。
  const officialMode = isOfficialSite() && Boolean(autoSync?.available);
  // 正式站登入後存檔會自動同步，提示文字不能再說「請手動上傳」。
  const officialSignedInText = text(
    "登入成功。存檔會自動同步到雲端：這台裝置是空的會自動載入雲端存檔，之後有變動會自動上傳。",
    "Signed in. Your save syncs automatically: an empty device loads the cloud save, and later changes upload on their own.",
    "ログインしました。セーブデータは自動で同期されます。この端末が空ならクラウドのセーブを読み込み、以後の変更は自動でアップロードされます。",
    "로그인했어요. 저장 데이터가 자동으로 동기화됩니다. 이 기기가 비어 있으면 클라우드 저장을 불러오고, 이후 변경은 자동 업로드됩니다.",
  );
  const [, setStatusTick] = useState(0);
  const countdownActive = officialMode && open && Boolean(autoSync?.pending) && !autoSync?.uploading;
  useEffect(() => {
    if (!countdownActive) return undefined;
    const timer = setInterval(() => setStatusTick((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [countdownActive]);
  const officialStatusText = (() => {
    if (!officialMode) return "";
    const last = autoSync?.state || {};
    if (!autoSync?.enabled) return text("自動同步已關閉，資料只留在這台裝置。", "Auto sync is off; your data stays on this device.", "自動同期はオフです。データはこの端末にだけ残ります。", "자동 동기화가 꺼져 있어 데이터는 이 기기에만 남습니다.");
    if (autoSync?.uploading) return text("正在上傳…", "Uploading…", "アップロード中…", "업로드 중…");
    switch (last.lastStatus) {
      case "cloud-newer": return text("雲端有較新版本，請選擇要用哪一份。", "The cloud has a newer version. Choose which one to keep.", "クラウドに新しいバージョンがあります。どちらを使うか選んでください。", "클라우드에 더 새로운 버전이 있습니다. 사용할 쪽을 선택하세요.");
      case "too-large": return text("存檔太大無法自動上傳，請整理舊對話；資料仍在這台裝置。", "Your save is too large to upload automatically. Tidy old chats; your data is still on this device.", "セーブデータが大きすぎて自動アップロードできません。古い会話を整理してください。データは端末に残っています。", "저장 데이터가 너무 커서 자동 업로드할 수 없습니다. 오래된 대화를 정리하세요. 데이터는 이 기기에 남아 있습니다.");
      case "rate-limited": return text("上傳太頻繁，稍後自動再試。", "Too many uploads; will retry automatically soon.", "アップロードが多すぎます。しばらくして自動で再試行します。", "업로드가 너무 잦아 잠시 후 자동으로 다시 시도합니다.");
      case "failed": return text("上次自動上傳失敗，稍後會自動再試。", "The last auto upload failed; it will retry automatically.", "前回の自動アップロードに失敗しました。自動で再試行します。", "마지막 자동 업로드에 실패했습니다. 자동으로 다시 시도합니다.");
      default: break;
    }
    if (autoSync?.pending) {
      const nextAt = Number(autoSync.getNextUploadAt?.()) || 0;
      const seconds = Math.max(1, Math.ceil((nextAt - Date.now()) / 1000));
      return text(`等待上傳（約 ${seconds} 秒後）`, `Waiting to upload (in about ${seconds}s)`, `アップロード待ち（約 ${seconds} 秒後）`, `업로드 대기 중 (약 ${seconds}초 후)`);
    }
    if (last.lastSyncAt && ["uploaded", "uploaded-large", "downloaded"].includes(last.lastStatus)) {
      const when = formatSyncTime(last.lastSyncAt);
      const synced = text(`已同步（${when}，版本 ${last.lastRevision}）`, `Synced (${when}, revision ${last.lastRevision})`, `同期済み（${when}、版 ${last.lastRevision}）`, `동기화됨 (${when}, 버전 ${last.lastRevision})`);
      return last.lastStatus === "uploaded-large"
        ? `${synced} ${text("存檔已經很大，建議整理舊對話。", "Your save is getting large; consider tidying old chats.", "セーブデータが大きくなっています。古い会話の整理をおすすめします。", "저장 데이터가 커지고 있어요. 오래된 대화를 정리해 보세요.")}`
        : synced;
    }
    return text("登入中：資料有變動就會自動上傳，雲端較新時會自動載入。", "Signed in: changes upload automatically, and newer cloud saves load automatically.", "ログイン中：変更は自動でアップロードされ、クラウドの方が新しければ自動で読み込みます。", "로그인 중: 변경 사항은 자동 업로드되고, 클라우드가 더 새로우면 자동으로 불러옵니다.");
  })();
  const autoSyncStatusText = (() => {
    const last = autoSync?.state || {};
    const when = formatSyncTime(last.lastSyncAt);
    if (!autoSync?.enabled) return text("已關閉。資料只留在這台裝置，可用上面的按鈕手動上傳。", "Off. Data stays on this device; use the buttons above to upload manually.", "オフ。データはこの端末に残ります。上のボタンで手動アップロードできます。", "꺼짐. 데이터는 이 기기에만 남으며 위 버튼으로 수동 업로드할 수 있습니다.");
    switch (last.lastStatus) {
      case "uploaded": return text(`上次自動上傳：${when}（版本 ${last.lastRevision}）`, `Last auto upload: ${when} (revision ${last.lastRevision})`, `前回の自動アップロード：${when}（版 ${last.lastRevision}）`, `마지막 자동 업로드: ${when} (버전 ${last.lastRevision})`);
      case "uploaded-large": return text(`上次自動上傳：${when}。存檔已經很大，建議整理舊對話。`, `Last auto upload: ${when}. Your save is getting large; consider tidying old chats.`, `前回の自動アップロード：${when}。セーブデータが大きくなっています。古い会話の整理をおすすめします。`, `마지막 자동 업로드: ${when}. 저장 데이터가 커지고 있어요. 오래된 대화를 정리해 보세요.`);
      case "downloaded": return text(`上次下載雲端存檔：${when}。之後有變動會自動上傳。`, `Last cloud download: ${when}. Changes will upload automatically.`, `前回のダウンロード：${when}。以後の変更は自動でアップロードされます。`, `마지막 클라우드 다운로드: ${when}. 이후 변경 사항은 자동 업로드됩니다.`);
      case "cloud-newer": return text("雲端有較新的存檔（可能是另一台裝置上傳的），自動上傳先暫停，請你決定。", "The cloud has a newer save (maybe from another device). Auto upload is paused until you decide.", "クラウドに新しいセーブがあります（別の端末からかもしれません）。自動アップロードは判断待ちで停止中です。", "클라우드에 더 새로운 저장이 있습니다(다른 기기일 수 있음). 결정할 때까지 자동 업로드를 멈춥니다.");
      case "rate-limited": return text("上傳太頻繁，稍後會自動再試。", "Too many uploads; will retry automatically later.", "アップロードが多すぎます。後で自動的に再試行します。", "업로드가 너무 잦아 잠시 후 자동으로 다시 시도합니다.");
      case "too-large": return text("存檔太大無法自動上傳，請整理舊對話；資料仍在這台裝置。", "Your save is too large to upload automatically. Tidy old chats; your data is still on this device.", "セーブデータが大きすぎて自動アップロードできません。古い会話を整理してください。データは端末に残っています。", "저장 데이터가 너무 커서 자동 업로드할 수 없습니다. 오래된 대화를 정리하세요. 데이터는 이 기기에 남아 있습니다.");
      case "failed": return text(`上次自動上傳失敗，稍後會再試。${last.lastMessage ? `（${last.lastMessage}）` : ""}`, `Last auto upload failed; will retry later.${last.lastMessage ? ` (${last.lastMessage})` : ""}`, `前回の自動アップロードに失敗しました。後で再試行します。${last.lastMessage ? `（${last.lastMessage}）` : ""}`, `마지막 자동 업로드에 실패했습니다. 나중에 다시 시도합니다.${last.lastMessage ? ` (${last.lastMessage})` : ""}`);
      default: return text("登入後，資料有變動就會自動上傳（最多每 5 分鐘一次）；這台裝置是空的、或雲端較新而這台沒有未上傳的變動時，會自動載入雲端存檔。只有這台有還沒傳上去的變動時才會先問你。", "While signed in, changes upload automatically (at most every 5 minutes). When this device is empty, or the cloud is newer and nothing here is waiting to upload, the cloud save loads automatically. You are only asked when this device has unsynced changes.", "ログイン中は変更が自動でアップロードされます（最大 5 分に 1 回）。この端末が空のとき、またはクラウドの方が新しく未送信の変更がないときは、クラウドのセーブを自動で読み込みます。未送信の変更がある場合だけ先に確認します。", "로그인 중에는 변경 사항이 자동 업로드됩니다(최대 5분에 한 번). 이 기기가 비어 있거나 클라우드가 더 새롭고 올리지 않은 변경이 없으면 클라우드 저장을 자동으로 불러옵니다. 올리지 않은 변경이 있을 때만 먼저 묻습니다.");
    }
  })();

  useEffect(() => {
    if (auth?.isPasswordRecovery) {
      setOpen(true);
      setMode("reset");
    }
  }, [auth?.isPasswordRecovery]);

  useEffect(() => {
    const userId = auth?.user?.id;
    setTextSyncMeta(readTextSyncMeta(userId));
    if (!open || !cloudDataConfigured || !auth?.session || !userId) {
      setRemoteTextSyncMeta(null);
      return undefined;
    }
    let active = true;
    getCloudDocument(auth.session, TEXT_SYNC_DOCUMENT_KEY)
      .then((document) => {
        if (!active) return;
        setRemoteTextSyncMeta({ revision: document?.revision || 1, updatedAt: document?.updatedAt || null, updatedBy: document?.updatedBy || null });
      })
      .catch(() => { if (active) setRemoteTextSyncMeta(null); });
    return () => { active = false; };
  }, [open, cloudDataConfigured, auth?.session, auth?.user?.id]);

  const message = auth?.error || "";
  const renderPasswordInput = (autoComplete, placeholder) => <div style={{ position: "relative" }}>
    <input
      style={{ ...inputStyle, paddingRight: 44 }}
      type={passwordVisible ? "text" : "password"}
      autoComplete={autoComplete}
      value={password}
      onChange={(event) => setPassword(event.target.value)}
      placeholder={placeholder}
    />
    <button
      type="button"
      aria-label={passwordVisible ? text("隱藏密碼", "Hide password") : text("顯示密碼", "Show password")}
      title={passwordVisible ? text("隱藏密碼", "Hide password") : text("顯示密碼", "Show password")}
      onClick={() => setPasswordVisible((visible) => !visible)}
      style={{ position: "absolute", right: 5, top: "50%", transform: "translateY(-50%)", display: "grid", placeItems: "center", width: 34, height: 34, padding: 0, border: "none", borderRadius: 9, color: "var(--mp-pink-dk)", background: "transparent", cursor: "pointer" }}
    >
      {passwordVisible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
    </button>
  </div>;
  const submit = async () => {
    if (!auth || !email.trim() || password.length < 8) return;
    const result = mode === "register"
      ? await auth.signUpWithPassword(email, password)
      : await auth.signInWithPassword(email, password);
    if (result.error) return;
    if (mode === "register" && !result.data?.session) {
      setVerificationEmail(email.trim());
      setMode("verify");
      notify?.(text("驗證信已寄出，請完成驗證後再登入。", "Verification email sent. Please verify it before signing in."));
    } else if (mode === "register") {
      notify?.(officialMode ? officialSignedInText : text(
        "帳號已建立。此裝置資料尚未自動上傳；請先建立完整備份，再按「上傳此裝置存檔」啟用跨裝置同步。",
        "Account created. This device's data has not been uploaded automatically; make a full backup first, then choose “Upload this device” to enable cross-device sync.",
        "アカウントを作成しました。この端末のデータは自動アップロードされていません。完全バックアップ後に「この端末をアップロード」を押して端末間同期を有効にしてください。",
        "계정을 만들었어요. 이 기기의 데이터는 자동 업로드되지 않았습니다. 전체 백업 후 “이 기기 업로드”를 눌러 기기 간 동기화를 켜 주세요.",
      ));
    } else {
      notify?.(officialMode ? officialSignedInText : text(
        "登入成功。此裝置資料不會自動覆蓋雲端；請先建立完整備份，再依需要上傳或下載文字資料。",
        "Signed in. This device will not automatically overwrite cloud data; make a full backup first, then upload or download text data when needed.",
        "ログインしました。この端末のデータがクラウドを自動で上書きすることはありません。完全バックアップ後、必要に応じてテキストをアップロードまたはダウンロードしてください。",
        "로그인했어요. 이 기기 데이터가 클라우드를 자동으로 덮어쓰지 않습니다. 전체 백업 후 필요할 때 텍스트 데이터를 업로드하거나 다운로드해 주세요.",
      ));
    }
  };

  const confirmSignOut = () => {
    const proceed = window.confirm(text(
      "登出前，已完成完整備份了嗎？登出不會刪除這台裝置的資料，但若要在其他裝置繼續遊玩，請先上傳文字資料或匯出完整備份。要登出嗎？",
      "Have you completed a full backup? Signing out will not delete data on this device, but upload text data or export a full backup before continuing on another device. Sign out now?",
      "ログアウト前に完全バックアップは済んでいますか？ログアウトしてもこの端末のデータは削除されませんが、別の端末で続ける前にテキストをアップロードするか完全バックアップをエクスポートしてください。ログアウトしますか？",
      "로그아웃하기 전에 전체 백업을 완료했나요? 로그아웃해도 이 기기의 데이터는 삭제되지 않지만, 다른 기기에서 계속하기 전 텍스트를 업로드하거나 전체 백업을 내보내 주세요. 로그아웃할까요?",
    ));
    if (proceed) void auth.signOut();
  };

  const resetPassword = async () => {
    const result = await auth.updatePassword(password);
    if (!result.error) {
      setPassword("");
      setMode("login");
      notify?.(text("密碼已更新，請用新密碼登入。", "Password updated. Please sign in with your new password."));
    }
  };

  const signInWithGoogle = async () => {
    const result = await auth.signInWithGoogle();
    if (!result.error) {
      notify?.(officialMode ? officialSignedInText : text(
        "Google 登入完成。此裝置不會自動覆蓋雲端資料；請先建立完整備份，再依需求手動上傳或下載文字資料。",
        "Google sign-in is complete. This device will not automatically overwrite cloud data; make a full backup first, then upload or download text data when needed.",
        "Google ログインが完了しました。この端末がクラウドのデータを自動で上書きすることはありません。まず完全バックアップを作成し、必要に応じてテキストデータを手動でアップロードまたはダウンロードしてください。",
        "Google 로그인이 완료되었습니다. 이 기기는 클라우드 데이터를 자동으로 덮어쓰지 않습니다. 먼저 전체 백업을 만든 후 필요에 따라 텍스트 데이터를 수동으로 업로드하거나 다운로드하세요.",
      ));
    }
  };

  const testCloudDatabase = async () => {
    setCloudTestBusy(true);
    setCloudTestStatus("");
    try {
      await runCloudDatabaseConnectionTest(auth?.session);
      const success = text("D1 雲端資料庫測試成功：已安全寫入並讀回你的測試文字。", "D1 cloud database test passed: your private test text was saved and read back.");
      setCloudTestStatus(success);
      notify?.(success);
    } catch (error) {
      setCloudTestStatus(error?.message || text("雲端資料庫測試失敗。", "Cloud database test failed."));
    } finally {
      setCloudTestBusy(false);
    }
  };

  const uploadTextSync = async ({ force = false } = {}) => {
    if (!textSyncProps?.getTextSyncDocument || !auth?.session) return;
    if (!force) {
      const proceed = window.confirm(tr(CLOUD_MEDIA_SYNC_TEXT.uploadConfirm));
      if (!proceed) return;
    }
    setTextSyncBusy(true);
    setTextSyncStatus("");
    setTextSyncFailed(false);
    try {
      // 手動與自動同步走同一條上傳核心（MP-094）。
      const result = await uploadTextSyncDocument({ session: auth.session, userId: auth.user?.id, getTextSyncDocument: textSyncProps.getTextSyncDocument, force });
      if (result.status === "conflict") {
        setSyncConflict(result.conflict);
        return;
      }
      const success = [
        fillCloudSyncText(tr(CLOUD_SYNC_REVISION_TEXT.uploadedRevision), { revision: result.revision }),
        cloudMediaSyncSummary(result.mediaResult, tr),
        result.warning === "large" ? text("存檔已經很大，建議整理舊對話。", "Your save is getting large; consider tidying old chats.", "セーブデータが大きくなっています。古い会話の整理をおすすめします。", "저장 데이터가 커지고 있어요. 오래된 대화를 정리해 보세요.") : "",
      ].filter(Boolean).join(" ");
      setTextSyncStatus(success);
      setTextSyncMeta(result.meta);
      textSyncProps?.onUploaded?.();
      textSyncProps?.autoSync?.noteManualSync?.(result.meta);
      setRemoteTextSyncMeta(result.remote);
      setHistoryState({ loading: false, versions: null, failed: false });
      setHistoryOpen(false);
      notify?.(success);
    } catch (error) {
      setTextSyncFailed(true);
      if (isCloudUploadRateLimited(error)) {
        const minutes = Math.max(1, Math.ceil((Number(error.retryAfter) || 3600) / 60));
        setTextSyncStatus(fillCloudSyncText(tr(CLOUD_SYNC_REVISION_TEXT.rateLimited), { minutes }));
        return;
      }
      if (error instanceof TextSyncDocumentTooLargeError) {
        setTextSyncStatus(text("存檔太大，雲端不收。請先刪除或整理舊對話再上傳；資料仍完整保存在這台裝置。", "Your save is too large for the cloud. Delete or tidy old chats and try again; your data is still safe on this device.", "セーブデータが大きすぎてクラウドに保存できません。古い会話を削除・整理してから再試行してください。データはこの端末に残っています。", "저장 데이터가 너무 커서 클라우드에 올릴 수 없습니다. 오래된 대화를 삭제하거나 정리한 뒤 다시 시도하세요. 데이터는 이 기기에 그대로 남아 있습니다."));
        return;
      }
      if (error instanceof TextSyncRemoteReadError) {
        setTextSyncStatus(text(
          "無法讀取雲端原資料，已停止上傳。請確認連線與登入狀態後重試。",
          "Could not read the existing cloud data. Upload stopped. Check your connection and sign-in status, then retry.",
          "クラウドの元データを読み取れないため、アップロードを停止しました。接続とログイン状態を確認して再試行してください。",
          "기존 클라우드 데이터를 읽을 수 없어 업로드를 중지했습니다. 연결과 로그인 상태를 확인한 후 다시 시도하세요.",
        ));
        return;
      }
      setTextSyncStatus(error?.message || text("上傳到雲端失敗。", "Cloud upload failed.", "クラウドへのアップロードに失敗しました。", "클라우드 업로드에 실패했습니다."));
    } finally {
      setTextSyncBusy(false);
    }
  };

  const downloadTextSync = async ({ confirm = true } = {}) => {
    if (!textSyncProps?.applyTextSyncDocument || !auth?.session) return;
    const proceed = !confirm || window.confirm(tr(CLOUD_MEDIA_SYNC_TEXT.downloadConfirm));
    if (!proceed) return;
    setTextSyncBusy(true);
    setTextSyncStatus("");
    setTextSyncFailed(false);
    try {
      const remote = await getCloudDocument(auth.session, TEXT_SYNC_DOCUMENT_KEY);
      let mediaResult;
      await textSyncProps.applyTextSyncDocument(remote?.data, {
        session: auth.session,
        onMediaSync: (result) => { mediaResult = result; },
      });
      const success = [
        fillCloudSyncText(tr(CLOUD_SYNC_REVISION_TEXT.downloadedRevision), { revision: remote?.revision || 1 }),
        cloudMediaSyncSummary(mediaResult, tr),
      ].filter(Boolean).join(" ");
      setTextSyncStatus(success);
      const meta = {
        action: "download",
        at: new Date().toISOString(),
        revision: remote?.revision || 1,
        remoteUpdatedAt: remote?.updatedAt || null,
      };
      saveTextSyncMeta(auth.user?.id, meta);
      setTextSyncMeta(meta);
      textSyncProps?.autoSync?.noteManualSync?.(meta);
      setRemoteTextSyncMeta({ revision: meta.revision, updatedAt: meta.remoteUpdatedAt, updatedBy: remote?.updatedBy || null });
      notify?.(success);
    } catch (error) {
      setTextSyncFailed(true);
      setTextSyncStatus(error?.restoreStatus ? dataRestoreFailureMessage(error, text) : error?.message || text("從雲端下載失敗。", "Cloud download failed.", "クラウドからのダウンロードに失敗しました。", "클라우드 다운로드에 실패했습니다."));
    } finally {
      setTextSyncBusy(false);
    }
  };

  const loadSyncHistory = async () => {
    if (!auth?.session) return;
    setHistoryState({ loading: true, versions: null, failed: false });
    try {
      const result = await listCloudDocumentHistory(auth.session, TEXT_SYNC_DOCUMENT_KEY);
      setHistoryState({ loading: false, versions: Array.isArray(result?.versions) ? result.versions : [], failed: false });
    } catch (error) {
      // 雲端還沒有任何存檔時，舊版本自然是空的。
      if (error?.status === 404) {
        setHistoryState({ loading: false, versions: [], failed: false });
        return;
      }
      setHistoryState({ loading: false, versions: null, failed: true });
    }
  };

  const toggleSyncHistory = () => {
    const next = !historyOpen;
    setHistoryOpen(next);
    if (next) loadSyncHistory();
  };

  const restoreSyncHistory = async (revision) => {
    if (!textSyncProps?.applyTextSyncDocument || !auth?.session) return;
    if (!window.confirm(fillCloudSyncText(tr(CLOUD_SYNC_REVISION_TEXT.historyConfirm), { revision }))) return;
    setTextSyncBusy(true);
    setTextSyncStatus("");
    setTextSyncFailed(false);
    try {
      const [version, head] = await Promise.all([
        getCloudDocumentHistoryVersion(auth.session, TEXT_SYNC_DOCUMENT_KEY, revision),
        getCloudDocument(auth.session, TEXT_SYNC_DOCUMENT_KEY),
      ]);
      validateTextSyncDocument(version?.data);
      let mediaResult;
      // 與一般下載走同一個受保護的套用流程（快照、失敗回復、保留本機圖片與 API Key）。
      await textSyncProps.applyTextSyncDocument(version.data, {
        session: auth.session,
        onMediaSync: (result) => { mediaResult = result; },
      });
      const meta = metaAfterHistoryRestore({ restoredRevision: revision, headRevision: head?.revision, headUpdatedAt: head?.updatedAt || null });
      saveTextSyncMeta(auth.user?.id, meta);
      setTextSyncMeta(meta);
      setRemoteTextSyncMeta({ revision: head?.revision || meta.revision, updatedAt: head?.updatedAt || null, updatedBy: head?.updatedBy || null });
      const success = [
        fillCloudSyncText(tr(CLOUD_SYNC_REVISION_TEXT.historyRestored), { revision }),
        cloudMediaSyncSummary(mediaResult, tr),
      ].filter(Boolean).join(" ");
      setTextSyncStatus(success);
      notify?.(success);
    } catch (error) {
      setTextSyncFailed(true);
      setTextSyncStatus(error?.restoreStatus ? dataRestoreFailureMessage(error, text) : error?.message || tr(CLOUD_SYNC_REVISION_TEXT.historyUnavailable));
    } finally {
      setTextSyncBusy(false);
    }
  };

  const conflictDownload = () => {
    setSyncConflict(null);
    downloadTextSync();
  };

  // 用這台的資料覆蓋雲端（強制上傳）：衝突對話框與正式站「用這台的版本」共用，確認文字相同。
  const keepLocalVersion = (current) => {
    if (!window.confirm(fillCloudSyncText(tr(CLOUD_SYNC_REVISION_TEXT.overwriteConfirm), { current: current ?? "—" }))) return;
    setSyncConflict(null);
    uploadTextSync({ force: true });
  };
  const conflictOverwrite = () => keepLocalVersion(syncConflict?.currentRevision);

  const syncActionLabel = (action) => (action === "upload"
    ? text("上傳", "upload", "アップロード", "업로드")
    : action === "restore-history"
      ? tr(CLOUD_SYNC_REVISION_TEXT.restoredAction)
      : text("下載", "download", "ダウンロード", "다운로드"));

  const conflictModal = syncConflict && typeof document !== "undefined" && createPortal(<div className="mp-overlay" onClick={() => setSyncConflict(null)}>
    <div className="mp-modal" role="dialog" aria-modal="true" aria-label={tr(CLOUD_SYNC_REVISION_TEXT.conflictTitle)} onClick={(event) => event.stopPropagation()} style={{ display: "grid", gap: 10, lineHeight: 1.65 }}>
      <div style={{ fontSize: 15, fontWeight: 900, color: "var(--mp-txt)" }}>{tr(syncConflict.reason === "never-synced" ? CLOUD_SYNC_REVISION_TEXT.conflictNeverSyncedTitle : CLOUD_SYNC_REVISION_TEXT.conflictTitle)}</div>
      <div style={{ fontSize: 12, color: "var(--mp-txt-l)" }}>
        <div>{fillCloudSyncText(tr(CLOUD_SYNC_REVISION_TEXT.conflictCloudLine), {
          current: syncConflict.currentRevision,
          time: formatSyncTime(syncConflict.updatedAt) || "—",
          device: syncConflict.updatedBy ? fillCloudSyncText(tr(CLOUD_SYNC_REVISION_TEXT.conflictDeviceSuffix), { device: syncConflict.updatedBy }) : "",
        })}</div>
        <div>{syncConflict.reason === "never-synced"
          ? tr(CLOUD_SYNC_REVISION_TEXT.conflictNeverSyncedLine)
          : fillCloudSyncText(tr(CLOUD_SYNC_REVISION_TEXT.conflictLocalLine), { local: syncConflict.localRevision })}</div>
        <div style={{ marginTop: 4, color: "var(--mp-warning)" }}>{tr(CLOUD_SYNC_REVISION_TEXT.conflictWarning)}</div>
      </div>
      <button type="button" style={primaryButton} onClick={conflictDownload}>{tr(CLOUD_SYNC_REVISION_TEXT.conflictDownload)}</button>
      <button type="button" style={secondaryButton} onClick={conflictOverwrite}>{tr(CLOUD_SYNC_REVISION_TEXT.conflictOverwrite)}</button>
      <button type="button" style={{ ...secondaryButton, border: "none", background: "transparent" }} onClick={() => setSyncConflict(null)}>{tr(CLOUD_SYNC_REVISION_TEXT.conflictCancel)}</button>
    </div>
  </div>, document.querySelector(".mp-phone") || document.body);

  return <div className="mp-sg">
    {conflictModal}
    <div onClick={() => setOpen((value) => !value)} style={{ display: "flex", justifyContent: "space-between", gap: 10, cursor: "pointer", alignItems: "center" }}>
      <div>
        <div className="mp-sg-t" style={{ marginBottom: 3 }}>{text("帳號", "Account")}</div>
        <div style={{ fontSize: 10, color: "var(--mp-txt-l)" }}>
          {!auth?.configured ? text("雲端帳號尚未設定", "Cloud account is not configured") : user?.email || text("訪客模式：資料僅保留在此裝置", "Guest mode: data stays on this device")}
        </div>
      </div>
      <span style={{ fontSize: 11, fontWeight: 900, color: "var(--mp-pink-dk)" }}>{open ? text("收合", "Close") : text("開啟", "Open")}</span>
    </div>

    {open && <div style={{ display: "grid", gap: 10, marginTop: 13 }}>
      {!auth?.configured && <div style={{ padding: 11, borderRadius: 12, background: "color-mix(in srgb,var(--mp-accent) 9%,var(--mp-card-bg,var(--mp-surface)))", border: "1px solid color-mix(in srgb,var(--mp-accent) 20%,var(--mp-card-border))", fontSize: 12, lineHeight: 1.65, color: "var(--mp-page-text-muted,var(--mp-txt-l))" }}>{text("尚未設定雲端帳號。你仍可繼續以訪客身分使用所有本機功能。", "Cloud account is not configured. You can continue using all local features as a guest.")}</div>}
      {auth?.configured && auth.loading && <div style={{ fontSize: 12, color: "var(--mp-txt-l)" }}>{text("正在確認帳號狀態…", "Checking account status...")}</div>}
      {auth?.configured && !auth.loading && user && <>
        <div style={accountDetailCard}>
          <div style={{ fontSize: 11, color: "var(--mp-txt-l)" }}>{text("目前帳號", "Current account")}</div>
          <div style={{ fontWeight: 900, overflowWrap: "anywhere" }}>{user.email || text("Google 帳號", "Google account")}</div>
          <div style={{ marginTop: 5, fontSize: 11, color: "var(--mp-txt-l)", overflowWrap: "anywhere" }}>{text("帳號 ID", "Account ID")}: {user.id}</div>
          <div style={{ marginTop: 4, fontSize: 11, color: "var(--mp-txt-l)" }}>{user.email_confirmed_at ? text("Email 已驗證", "Email verified") : text("Email 尚待驗證", "Email verification pending")}</div>
          {!officialMode && <div style={{ marginTop: 4, fontSize: 11, color: "var(--mp-txt-l)" }}>{text("可用手動同步在不同裝置間使用同一份存檔", "Use manual sync to share one save across devices", "手動同期で複数の端末から同じセーブデータを使えます", "수동 동기화로 여러 기기에서 같은 저장 데이터를 사용할 수 있습니다")}</div>}
        </div>
        <div style={{ ...cloudTestCard, lineHeight: 1.65 }}>
          <div style={{ fontSize: 12, fontWeight: 900 }}>{text("雲端同步", "Cloud sync", "クラウド同期", "클라우드 동기화")}</div>
          {!officialMode && <div style={{ marginTop: 3, fontSize: 11, color: "var(--mp-txt-l)" }}>{tr(CLOUD_MEDIA_SYNC_TEXT.description)}</div>}
          {!cloudDataConfigured && <div style={{ marginTop: 6, fontSize: 11, color: "var(--mp-warning)" }}>{text("尚未設定 Cloudflare 資料庫 URL，因此無法啟用雲端同步。", "Cloudflare database URL is not configured, so cloud sync is unavailable.", "Cloudflare データベース URL が未設定のため、クラウド同期は利用できません。", "Cloudflare 데이터베이스 URL이 설정되지 않아 클라우드 동기화를 사용할 수 없습니다.")}</div>}
          {(remoteTextSyncMeta || textSyncMeta) && <div style={{ marginTop: 7, display: "grid", gap: 2, fontSize: 10.5, color: "var(--mp-txt-l)" }}>
            {remoteTextSyncMeta && <div>{text("雲端版本", "Cloud version", "クラウド版", "클라우드 버전")}: r{remoteTextSyncMeta.revision}{remoteTextSyncMeta.updatedAt ? ` · ${formatSyncTime(remoteTextSyncMeta.updatedAt)}` : ""}{remoteTextSyncMeta.updatedBy ? ` · ${remoteTextSyncMeta.updatedBy}` : ""}</div>}
            {textSyncMeta && <div>{text("此裝置上次同步", "This device last synced", "この端末の最終同期", "이 기기의 마지막 동기화")}: {syncActionLabel(textSyncMeta.action)} · {formatSyncTime(textSyncMeta.at)} · r{textSyncMeta.revision}</div>}
          </div>}
          {offerCloudLoad && <div role="status" style={{ marginTop: 9, padding: 10, borderRadius: 12, background: "color-mix(in srgb,var(--mp-accent) 12%,var(--mp-card-bg,var(--mp-surface)))", border: "1px solid color-mix(in srgb,var(--mp-accent) 24%,var(--mp-card-border))", fontSize: 12, lineHeight: 1.65 }}>
            <div>{text("這台裝置還沒有任何角色，雲端已經有一份存檔。要把雲端存檔載入到這台裝置嗎？", "This device has no characters yet, and your cloud save exists. Load the cloud save onto this device?", "この端末にはまだキャラがなく、クラウドにセーブデータがあります。この端末に読み込みますか？", "이 기기에는 아직 캐릭터가 없고 클라우드에 저장 데이터가 있습니다. 이 기기로 불러올까요?")}</div>
            <button type="button" style={{ ...secondaryButton, marginTop: 8 }} disabled={auth.busy || textSyncBusy || !cloudDataConfigured} onClick={() => downloadTextSync({ confirm: false })}>{textSyncBusy ? text("處理中…", "Working…", "処理中…", "처리 중…") : text("載入雲端存檔", "Load cloud save", "クラウドのセーブデータを読み込む", "클라우드 저장 불러오기")}</button>
          </div>}
          {autoSync?.available && <div style={{ marginTop: 9, padding: 10, borderRadius: 12, border: "1px solid var(--mp-card-border)", background: "var(--mp-card-bg,var(--mp-surface))", fontSize: 12, lineHeight: 1.65 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800 }}>{text("自動同步到雲端", "Auto sync to cloud", "クラウドへ自動同期", "클라우드 자동 동기화")}</div>
                <div data-cloud-sync-status={officialMode ? (autoSync.uploading ? "uploading" : autoSync.state?.lastStatus || (autoSync.pending ? "pending" : "idle")) : undefined} style={{ fontSize: 11, color: "var(--mp-txt-l)", marginTop: 2 }}>{officialMode ? officialStatusText : autoSyncStatusText}</div>
              </div>
              {!officialMode && <button type="button" role="switch" aria-checked={!!autoSync.enabled} className={`mp-switch ${autoSync.enabled ? "active" : ""}`} onClick={() => autoSync.setEnabled(!autoSync.enabled)}><span /></button>}
            </div>
            {officialMode && autoSync.enabled && autoSync.state?.lastStatus === "cloud-newer" && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginTop: 8 }}>
              <button type="button" style={secondaryButton} disabled={auth.busy || textSyncBusy || autoSync.busy} onClick={() => downloadTextSync({ confirm: false })}>{textSyncBusy ? text("處理中…", "Working…", "処理中…", "처리 중…") : text("用雲端的版本", "Use the cloud version", "クラウドの版を使う", "클라우드 버전 사용")}</button>
              <button type="button" style={secondaryButton} disabled={auth.busy || textSyncBusy || autoSync.busy} onClick={() => keepLocalVersion(autoSync.state?.remoteRevision || remoteTextSyncMeta?.revision)}>{textSyncBusy ? text("處理中…", "Working…", "処理中…", "처리 중…") : text("用這台的版本", "Use this device's version", "この端末の版を使う", "이 기기 버전 사용")}</button>
            </div>}
            {!officialMode && autoSync.state?.lastStatus === "cloud-newer" && <button type="button" className="mp-ibtn" style={{ marginTop: 8 }} disabled={auth.busy || textSyncBusy} onClick={() => uploadTextSync()}>{text("雲端有較新的存檔，點我選擇下載或覆蓋", "The cloud has a newer save. Tap to choose download or overwrite", "クラウドに新しいセーブがあります。タップしてダウンロードか上書きを選択", "클라우드에 더 새로운 저장이 있습니다. 눌러서 다운로드 또는 덮어쓰기 선택")}</button>}
          </div>}
          {!uploadAllowed && <div style={{ marginTop: 7, fontSize: 11, color: "var(--mp-txt-l)", lineHeight: 1.6 }}>{text("這個網站只會讀取雲端存檔，不會上傳。要更新雲端存檔，請在手機 App 上傳；本機備份可用匯出檔或 Google 雲端硬碟。", "This site only reads your cloud save and never uploads. Upload from the mobile app to update it; use export files or Google Drive for local backups.", "このサイトはクラウドのセーブデータを読み込むだけで、アップロードはしません。更新はモバイルアプリからアップロードしてください。ローカルのバックアップは書き出しファイルか Google ドライブを使えます。", "이 사이트는 클라우드 저장 데이터를 읽기만 하고 업로드하지 않습니다. 업데이트는 모바일 앱에서 업로드해 주세요. 로컬 백업은 내보내기 파일이나 Google 드라이브를 사용할 수 있습니다.")}</div>}
          {!officialMode && <div style={{ display: "grid", gridTemplateColumns: uploadAllowed ? "1fr 1fr" : "1fr", gap: 7, marginTop: 9 }}>
            {uploadAllowed && <button type="button" style={secondaryButton} disabled={auth.busy || textSyncBusy || !cloudDataConfigured} onClick={() => uploadTextSync()}>{textSyncBusy ? text("處理中…", "Working…", "処理中…", "처리 중…") : text("上傳此裝置存檔", "Upload this device", "この端末をアップロード", "이 기기 업로드")}</button>}
            <button type="button" style={secondaryButton} disabled={auth.busy || textSyncBusy || !cloudDataConfigured} onClick={() => downloadTextSync()}>{textSyncBusy ? text("處理中…", "Working…", "処理中…", "처리 중…") : text("下載雲端存檔", "Download cloud save", "クラウドからダウンロード", "클라우드에서 다운로드")}</button>
          </div>}
          {textSyncStatus && <div role="status" style={{ marginTop: 7, fontSize: 11, color: textSyncFailed ? "var(--mp-danger)" : "var(--mp-success)" }}>{textSyncStatus}</div>}
          {!officialMode && <div style={{ marginTop: 10, borderTop: "1px solid var(--mp-card-border)", paddingTop: 8 }}>
            <div className="mp-version-row" role="button" tabIndex={0} onClick={toggleSyncHistory} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggleSyncHistory(); } }}>
              <span>{tr(CLOUD_SYNC_REVISION_TEXT.historyTitle)}</span>
              <span>{historyOpen ? text("收合", "Close", "閉じる", "접기") : text("查看", "View", "表示", "보기")}</span>
            </div>
            {historyOpen && <div style={{ marginTop: 6, display: "grid", gap: 6, fontSize: 11, color: "var(--mp-txt-l)" }}>
              <div>{tr(CLOUD_SYNC_REVISION_TEXT.historyHint)}</div>
              {historyState.loading && <div>{tr(CLOUD_SYNC_REVISION_TEXT.historyLoading)}</div>}
              {historyState.failed && <div style={{ color: "var(--mp-warning)" }}>{tr(CLOUD_SYNC_REVISION_TEXT.historyUnavailable)}</div>}
              {historyState.versions && historyState.versions.length === 0 && <div>{tr(CLOUD_SYNC_REVISION_TEXT.historyEmpty)}</div>}
              {historyState.versions?.map((version) => <div key={version.revision} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span>{fillCloudSyncText(tr(CLOUD_SYNC_REVISION_TEXT.historyItem), { revision: version.revision })}{version.updatedAt ? ` · ${formatSyncTime(version.updatedAt)}` : ""}{version.updatedBy ? ` · ${version.updatedBy}` : ""}</span>
                <button type="button" style={{ ...secondaryButton, width: "auto", padding: "6px 10px", fontSize: 11, flexShrink: 0 }} disabled={auth.busy || textSyncBusy} onClick={() => restoreSyncHistory(version.revision)}>{tr(CLOUD_SYNC_REVISION_TEXT.historyDownload)}</button>
              </div>)}
            </div>}
          </div>}
        </div>
        <button type="button" style={secondaryButton} disabled={auth.busy} onClick={confirmSignOut}><LogOut size={16} style={{ verticalAlign: "-3px", marginRight: 6 }} />{text("登出", "Sign out")}</button>
        {!officialMode && (
        <div style={{ ...cloudTestCard, lineHeight: 1.65 }}>
          <div style={{ fontSize: 12, fontWeight: 900 }}>{text("雲端資料庫測試", "Cloud database test")}</div>
          <div style={{ marginTop: 3, fontSize: 11, color: "var(--mp-txt-l)" }}>{text("只會寫入並讀回一筆屬於此帳號的測試文字，不會搬移現有資料。", "Writes and reads one private test document only. Existing app data is not moved.")}</div>
          {!cloudDataConfigured && <div style={{ marginTop: 6, fontSize: 11, color: "var(--mp-warning)" }}>{text("尚未設定 Cloudflare 資料庫網址。", "Cloudflare database URL is not configured.")}</div>}
          <button type="button" style={{ ...secondaryButton, marginTop: 9 }} disabled={auth.busy || cloudTestBusy || !cloudDataConfigured} onClick={testCloudDatabase}>{cloudTestBusy ? text("測試中…", "Testing…") : text("測試雲端資料庫", "Test cloud database")}</button>
          {cloudTestStatus && <div role="status" style={{ marginTop: 7, fontSize: 11, color: cloudTestStatus.includes("passed") || cloudTestStatus.includes("成功") ? "var(--mp-success)" : "var(--mp-danger)" }}>{cloudTestStatus}</div>}
        </div>
        )}
      </>}
      {auth?.configured && !auth.loading && !user && <>
        {mode === "verify" ? <>
          <div style={{ ...accountDetailCard, background: "color-mix(in srgb,var(--mp-accent) 12%,var(--mp-card-bg,var(--mp-surface)))", fontSize: 12, lineHeight: 1.7 }}>{text("驗證信已寄到", "Verification email was sent to")}<br /><strong>{verificationEmail}</strong><br />{text("完成驗證後，回到這裡登入即可。", "After verification, come back here and sign in.")}</div>
          <button type="button" style={secondaryButton} disabled={auth.busy} onClick={() => auth.resendVerificationEmail(verificationEmail)}>{text("重新寄送驗證信", "Resend verification email")}</button>
          <button type="button" style={secondaryButton} disabled={auth.busy} onClick={() => setMode("login")}>{text("返回登入", "Back to sign in")}</button>
        </> : mode === "forgot" ? <>
          <div style={{ fontSize: 12, color: "var(--mp-txt-l)", lineHeight: 1.6 }}>{text("輸入 Email 後，我們會寄出重設密碼連結。", "Enter your email and we will send a password reset link.")}</div>
          <input style={inputStyle} type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" />
          <button type="button" style={primaryButton} disabled={auth.busy || !email.trim()} onClick={async () => { const result = await auth.sendPasswordResetEmail(email); if (!result.error) notify?.(text("若此 Email 已註冊，重設密碼信已寄出。", "If this email is registered, a reset link has been sent.")); }}>{text("寄送重設連結", "Send reset link")}</button>
          <button type="button" style={secondaryButton} disabled={auth.busy} onClick={() => setMode("login")}>{text("返回登入", "Back to sign in")}</button>
        </> : mode === "reset" ? <>
          <div style={{ fontSize: 12, color: "var(--mp-txt-l)" }}>{text("請設定至少 8 個字元的新密碼。", "Set a new password with at least 8 characters.")}</div>
          {renderPasswordInput("new-password", text("新密碼（至少 8 碼）", "New password (8+ characters)"))}
          <button type="button" style={primaryButton} disabled={auth.busy || password.length < 8} onClick={resetPassword}><KeyRound size={16} style={{ verticalAlign: "-3px", marginRight: 6 }} />{text("更新密碼", "Update password")}</button>
        </> : <>
          <button type="button" style={{ ...secondaryButton, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }} disabled={auth.busy} onClick={signInWithGoogle}>
            <span aria-hidden="true" style={{ display: "inline-grid", placeItems: "center", width: 18, height: 18, borderRadius: "50%", color: "#4285f4", background: "white", fontSize: 13, fontWeight: 900, fontFamily: "Arial,sans-serif" }}>G</span>
            {text("使用 Google 登入", "Continue with Google", "Google で続ける", "Google로 계속하기")}
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--mp-txt-l)", fontSize: 10 }} aria-hidden="true"><span style={{ height: 1, flex: 1, background: "var(--mp-card-border)" }} /><span>{text("或使用 Email", "or use email", "またはメールアドレス", "또는 이메일")}</span><span style={{ height: 1, flex: 1, background: "var(--mp-card-border)" }} /></div>
          <input style={inputStyle} type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" />
          {renderPasswordInput(mode === "register" ? "new-password" : "current-password", text("密碼（至少 8 碼）", "Password (8+ characters)"))}
          <button type="button" style={primaryButton} disabled={auth.busy || !email.trim() || password.length < 8} onClick={submit}>{mode === "register" ? <UserPlus size={16} style={{ verticalAlign: "-3px", marginRight: 6 }} /> : <LogIn size={16} style={{ verticalAlign: "-3px", marginRight: 6}} />}{mode === "register" ? text("建立帳號", "Create account") : text("登入", "Sign in")}</button>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <button type="button" disabled={auth.busy} onClick={() => setMode("forgot")} style={{ border: "none", background: "transparent", color: "var(--mp-pink-dk)", padding: 0, cursor: "pointer", fontWeight: 800, fontSize: 11 }}><Mail size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />{text("忘記密碼？", "Forgot password?")}</button>
            <button type="button" disabled={auth.busy} onClick={() => { setPassword(""); setMode((current) => current === "register" ? "login" : "register"); }} style={{ border: "none", background: "transparent", color: "var(--mp-pink-dk)", padding: 0, cursor: "pointer", fontWeight: 800, fontSize: 11 }}>
              {mode === "register"
                ? text("已有帳號？登入", "Already have an account? Sign in", "アカウントをお持ちですか？ログイン", "이미 계정이 있나요? 로그인")
                : text("還沒有帳號？建立帳號", "New here? Create account", "はじめてですか？アカウントを作成", "처음이신가요? 계정 만들기")}
            </button>
          </div>
        </>}
        {message && <div role="alert" style={{ color: "var(--mp-danger)", fontSize: 12, lineHeight: 1.5 }}>{message}</div>}
      </>}
    </div>}
  </div>;
}
