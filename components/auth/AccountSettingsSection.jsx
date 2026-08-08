import React, { useEffect, useState } from "react";
import { Eye, EyeOff, KeyRound, LogIn, LogOut, Mail, UserPlus } from "lucide-react";
import { getCloudDataConfig, runCloudDatabaseConnectionTest } from "../../services/cloud/cloudDataService.js";

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

export default function AccountSettingsSection({ auth, tr, notify }) {
  const text = (zh, en, ja = en, ko = en) => tr(zh, en, ja, ko);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");
  const [cloudTestBusy, setCloudTestBusy] = useState(false);
  const [cloudTestStatus, setCloudTestStatus] = useState("");
  const user = auth?.user;
  const cloudDataConfigured = getCloudDataConfig().configured;

  useEffect(() => {
    if (auth?.isPasswordRecovery) {
      setOpen(true);
      setMode("reset");
    }
  }, [auth?.isPasswordRecovery]);

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
    }
  };

  const resetPassword = async () => {
    const result = await auth.updatePassword(password);
    if (!result.error) {
      setPassword("");
      setMode("login");
      notify?.(text("密碼已更新，請用新密碼登入。", "Password updated. Please sign in with your new password."));
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
          <div style={{ marginTop: 4, fontSize: 11, color: "var(--mp-txt-l)" }}>{text("雲端資料同步功能準備中", "Cloud sync is being prepared")}</div>
        </div>
        <button type="button" style={secondaryButton} disabled={auth.busy} onClick={() => auth.signOut()}><LogOut size={16} style={{ verticalAlign: "-3px", marginRight: 6 }} />{text("登出", "Sign out")}</button>
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
          <input style={inputStyle} type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" />
          {renderPasswordInput(mode === "register" ? "new-password" : "current-password", text("密碼（至少 8 碼）", "Password (8+ characters)"))}
          <button type="button" style={primaryButton} disabled={auth.busy || !email.trim() || password.length < 8} onClick={submit}>{mode === "register" ? <UserPlus size={16} style={{ verticalAlign: "-3px", marginRight: 6 }} /> : <LogIn size={16} style={{ verticalAlign: "-3px", marginRight: 6}} />}{mode === "register" ? text("建立帳號", "Create account") : text("登入", "Sign in")}</button>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
            <button type="button" disabled={auth.busy} onClick={() => setMode("forgot")} style={{ border: "none", background: "transparent", color: "var(--mp-pink-dk)", padding: 0, cursor: "pointer", fontWeight: 800, fontSize: 11 }}><Mail size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} />{text("忘記密碼？", "Forgot password?")}</button>
          </div>
        </>}
        {message && <div role="alert" style={{ color: "var(--mp-danger)", fontSize: 12, lineHeight: 1.5 }}>{message}</div>}
      </>}
    </div>}
  </div>;
}
