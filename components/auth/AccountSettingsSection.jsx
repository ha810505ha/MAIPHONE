import React, { useEffect, useState } from "react";
import { Eye, EyeOff, KeyRound, LogIn, LogOut, Mail, UserPlus } from "lucide-react";
import {
  getCloudDataConfig,
  getCloudDocument,
  putCloudDocument,
  runCloudDatabaseConnectionTest,
} from "../../services/cloud/cloudDataService.js";
import { mergeWalletSyncData } from "../../utils/walletSync.js";
import { mergeGameProgressSyncData } from "../../utils/gameProgressSync.js";

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

const TEXT_SYNC_DOCUMENT_KEY = "app-text-sync-v1";
const TEXT_SYNC_META_PREFIX = "maliphone_text_sync_meta:";

function readTextSyncMeta(userId) {
  if (!userId) return null;
  try {
    const value = JSON.parse(localStorage.getItem(`${TEXT_SYNC_META_PREFIX}${userId}`) || "null");
    return value && typeof value === "object" ? value : null;
  } catch {
    return null;
  }
}

function saveTextSyncMeta(userId, value) {
  if (!userId) return;
  try { localStorage.setItem(`${TEXT_SYNC_META_PREFIX}${userId}`, JSON.stringify(value)); } catch {}
}

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
  const [textSyncMeta, setTextSyncMeta] = useState(null);
  const [remoteTextSyncMeta, setRemoteTextSyncMeta] = useState(null);
  const user = auth?.user;
  const cloudDataConfigured = getCloudDataConfig().configured;

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
        setRemoteTextSyncMeta({ revision: document?.revision || 1, updatedAt: document?.updatedAt || null });
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
      notify?.(text(
        "帳號已建立。此裝置資料尚未自動上傳；請先建立完整備份，再按「上傳此裝置文字」啟用跨裝置同步。",
        "Account created. This device's data has not been uploaded automatically; make a full backup first, then choose “Upload this device” to enable cross-device sync.",
        "アカウントを作成しました。この端末のデータは自動アップロードされていません。完全バックアップ後に「この端末をアップロード」を押して端末間同期を有効にしてください。",
        "계정을 만들었어요. 이 기기의 데이터는 자동 업로드되지 않았습니다. 전체 백업 후 “이 기기 업로드”를 눌러 기기 간 동기화를 켜 주세요.",
      ));
    } else {
      notify?.(text(
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
      notify?.(text(
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

  const uploadTextSync = async () => {
    if (!textSyncProps?.getTextSyncDocument || !auth?.session) return;
    const proceed = window.confirm(text(
      "同步前請先確認你已有本機備份。這會用此裝置的文字資料覆蓋雲端文字資料；圖片、相簿與 API Key 不會上傳。要繼續嗎？",
      "Make sure you have a local backup first. This replaces the cloud text data with this device's text data; images, the gallery, and API keys are not uploaded. Continue?",
      "先にローカルバックアップがあることを確認してください。この端末のテキストデータでクラウドのテキストデータを上書きします。画像、アルバム、API キーはアップロードされません。続行しますか？",
      "먼저 로컬 백업이 있는지 확인하세요. 이 기기의 텍스트 데이터로 클라우드 텍스트 데이터를 덮어씁니다. 이미지, 앨범, API 키는 업로드되지 않습니다. 계속할까요？",
    ));
    if (!proceed) return;
    setTextSyncBusy(true);
    setTextSyncStatus("");
    try {
      const document = await textSyncProps.getTextSyncDocument();
      // Text state intentionally uses manual overwrite. Wallet entries are an
      // exception: merge the current cloud ledger before replacing the document
      // so a second device cannot erase transactions it has not downloaded yet.
      const existing = await getCloudDocument(auth.session, TEXT_SYNC_DOCUMENT_KEY).catch(() => null);
      if (existing?.data?.state?.walletData) {
        document.state.walletData = mergeWalletSyncData(
          document.state.walletData,
          existing.data.state.walletData,
        );
      }
      if (existing?.data?.state?.featureData) {
        document.state.featureData = {
          ...(document.state.featureData || {}),
          ...mergeGameProgressSyncData(document.state.featureData, existing.data.state.featureData),
        };
      }
      const saved = await putCloudDocument(auth.session, TEXT_SYNC_DOCUMENT_KEY, document);
      const success = text(
        "文字資料已上傳到帳號雲端。",
        "Text data was uploaded to your account cloud.",
        "テキストデータをアカウントのクラウドにアップロードしました。",
        "텍스트 데이터가 계정 클라우드에 업로드되었습니다.",
      );
      setTextSyncStatus(`${success} r${saved?.revision || 1}`);
      const meta = {
        action: "upload",
        at: new Date().toISOString(),
        revision: saved?.revision || 1,
        remoteUpdatedAt: saved?.updatedAt || null,
      };
      saveTextSyncMeta(auth.user?.id, meta);
      setTextSyncMeta(meta);
      setRemoteTextSyncMeta({ revision: meta.revision, updatedAt: meta.remoteUpdatedAt });
      notify?.(success);
    } catch (error) {
      setTextSyncStatus(error?.message || text("文字同步上傳失敗。", "Text sync upload failed.", "テキスト同期のアップロードに失敗しました。", "텍스트 동기화 업로드에 실패했습니다."));
    } finally {
      setTextSyncBusy(false);
    }
  };

  const downloadTextSync = async () => {
    if (!textSyncProps?.applyTextSyncDocument || !auth?.session) return;
    const proceed = window.confirm(text(
      "同步前請先確認你已有本機備份。這會以雲端文字資料更新此裝置；此裝置的圖片、相簿與 API Key 會保留。要繼續嗎？",
      "Make sure you have a local backup first. This updates this device from cloud text data; this device's images, gallery, and API keys are kept. Continue?",
      "先にローカルバックアップがあることを確認してください。クラウドのテキストデータでこの端末を更新します。この端末の画像、アルバム、API キーは保持されます。続行しますか？",
      "먼저 로컬 백업이 있는지 확인하세요. 클라우드 텍스트 데이터로 이 기기를 업데이트합니다. 이 기기의 이미지, 앨범, API 키는 유지됩니다. 계속할까요？",
    ));
    if (!proceed) return;
    setTextSyncBusy(true);
    setTextSyncStatus("");
    try {
      const remote = await getCloudDocument(auth.session, TEXT_SYNC_DOCUMENT_KEY);
      await textSyncProps.applyTextSyncDocument(remote?.data);
      const success = text(
        "雲端文字資料已套用到此裝置。",
        "Cloud text data was applied to this device.",
        "クラウドのテキストデータをこの端末に適用しました。",
        "클라우드 텍스트 데이터가 이 기기에 적용되었습니다.",
      );
      setTextSyncStatus(`${success} r${remote?.revision || 1}`);
      const meta = {
        action: "download",
        at: new Date().toISOString(),
        revision: remote?.revision || 1,
        remoteUpdatedAt: remote?.updatedAt || null,
      };
      saveTextSyncMeta(auth.user?.id, meta);
      setTextSyncMeta(meta);
      setRemoteTextSyncMeta({ revision: meta.revision, updatedAt: meta.remoteUpdatedAt });
      notify?.(success);
    } catch (error) {
      setTextSyncStatus(error?.message || text("文字同步下載失敗。", "Text sync download failed.", "テキスト同期のダウンロードに失敗しました。", "텍스트 동기화 다운로드에 실패했습니다."));
    } finally {
      setTextSyncBusy(false);
    }
  };

  return <div className="mp-sg">
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
          <div style={{ marginTop: 4, fontSize: 11, color: "var(--mp-txt-l)" }}>{text("可使用手動文字同步測試跨裝置登入", "Manual text sync is available for cross-device testing", "手動テキスト同期で複数端末のログインをテストできます", "수동 텍스트 동기화로 여러 기기 로그인을 테스트할 수 있습니다")}</div>
        </div>
        <div style={{ ...cloudTestCard, lineHeight: 1.65 }}>
          <div style={{ fontSize: 12, fontWeight: 900 }}>{text("文字同步測試", "Text sync test", "テキスト同期テスト", "텍스트 동기화 테스트")}</div>
          <div style={{ marginTop: 3, fontSize: 11, color: "var(--mp-txt-l)" }}>{text("目前採手動上傳與下載。只同步文字與設定；圖片、相簿、語音快取與 API Key 都留在裝置上。同步前請先匯出完整備份。", "This is manual upload/download for now. Only text and settings sync; images, the gallery, voice cache, and API keys stay on the device. Export a full backup first.", "現在は手動アップロード／ダウンロードです。テキストと設定だけを同期し、画像、アルバム、音声キャッシュ、API キーは端末に残ります。先に完全バックアップを書き出してください。", "현재는 수동 업로드/다운로드 방식입니다. 텍스트와 설정만 동기화되며 이미지, 앨범, 음성 캐시, API 키는 기기에 남습니다. 먼저 전체 백업을 내보내세요.")}</div>
          {!cloudDataConfigured && <div style={{ marginTop: 6, fontSize: 11, color: "var(--mp-warning)" }}>{text("尚未設定 Cloudflare 資料庫 URL，因此無法啟用文字同步。", "Cloudflare database URL is not configured, so text sync is unavailable.", "Cloudflare データベース URL が未設定のため、テキスト同期は利用できません。", "Cloudflare 데이터베이스 URL이 설정되지 않아 텍스트 동기화를 사용할 수 없습니다.")}</div>}
          {(remoteTextSyncMeta || textSyncMeta) && <div style={{ marginTop: 7, display: "grid", gap: 2, fontSize: 10.5, color: "var(--mp-txt-l)" }}>
            {remoteTextSyncMeta && <div>{text("雲端版本", "Cloud version", "クラウド版", "클라우드 버전")}: r{remoteTextSyncMeta.revision}{remoteTextSyncMeta.updatedAt ? ` · ${formatSyncTime(remoteTextSyncMeta.updatedAt)}` : ""}</div>}
            {textSyncMeta && <div>{text("此裝置上次同步", "This device last synced", "この端末の最終同期", "이 기기의 마지막 동기화")}: {textSyncMeta.action === "upload" ? text("上傳", "upload", "アップロード", "업로드") : text("下載", "download", "ダウンロード", "다운로드")} · {formatSyncTime(textSyncMeta.at)} · r{textSyncMeta.revision}</div>}
          </div>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginTop: 9 }}>
            <button type="button" style={secondaryButton} disabled={auth.busy || textSyncBusy || !cloudDataConfigured} onClick={uploadTextSync}>{textSyncBusy ? text("處理中…", "Working…", "処理中…", "처리 중…") : text("上傳此裝置文字", "Upload this device", "この端末をアップロード", "이 기기 업로드")}</button>
            <button type="button" style={secondaryButton} disabled={auth.busy || textSyncBusy || !cloudDataConfigured} onClick={downloadTextSync}>{textSyncBusy ? text("處理中…", "Working…", "処理中…", "처리 중…") : text("下載雲端文字", "Download cloud text", "クラウドからダウンロード", "클라우드에서 다운로드")}</button>
          </div>
          {textSyncStatus && <div role="status" style={{ marginTop: 7, fontSize: 11, color: textSyncStatus.includes("失敗") || textSyncStatus.includes("failed") ? "var(--mp-danger)" : "var(--mp-success)" }}>{textSyncStatus}</div>}
        </div>
        <button type="button" style={secondaryButton} disabled={auth.busy} onClick={confirmSignOut}><LogOut size={16} style={{ verticalAlign: "-3px", marginRight: 6 }} />{text("登出", "Sign out")}</button>
        <div style={{ ...cloudTestCard, lineHeight: 1.65 }}>
          <div style={{ fontSize: 12, fontWeight: 900 }}>{text("雲端資料庫測試", "Cloud database test")}</div>
          <div style={{ marginTop: 3, fontSize: 11, color: "var(--mp-txt-l)" }}>{text("只會寫入並讀回一筆屬於此帳號的測試文字，不會搬移現有資料。", "Writes and reads one private test document only. Existing app data is not moved.")}</div>
          {!cloudDataConfigured && <div style={{ marginTop: 6, fontSize: 11, color: "var(--mp-warning)" }}>{text("尚未設定 Cloudflare 資料庫網址。", "Cloudflare database URL is not configured.")}</div>}
          <button type="button" style={{ ...secondaryButton, marginTop: 9 }} disabled={auth.busy || cloudTestBusy || !cloudDataConfigured} onClick={testCloudDatabase}>{cloudTestBusy ? text("測試中…", "Testing…") : text("測試雲端資料庫", "Test cloud database")}</button>
          {cloudTestStatus && <div role="status" style={{ marginTop: 7, fontSize: 11, color: cloudTestStatus.includes("passed") || cloudTestStatus.includes("成功") ? "var(--mp-success)" : "var(--mp-danger)" }}>{cloudTestStatus}</div>}
        </div>
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
