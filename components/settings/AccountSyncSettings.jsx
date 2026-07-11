import React, { useEffect, useState } from "react";
import { ArrowLeft, LockKeyhole, LogIn, Mail, UserPlus, UserRound } from "lucide-react";
import {
  isServerReachable, ensureAccount, syncNow, getSyncAccount, getMe,
  bindEmail, loginAccount, logoutAccount, logoutDevice,
  getServerUrl, setServerUrl, getPendingSyncCount, OFFICIAL_SERVER_URL,
} from "../../services/syncService";
import { getDeviceId as getLocalDeviceId } from "../../utils/indexedDbStorage";
import { SYNC_ENABLED } from "../../config/featureFlags";

const fieldStyle = {
  width: "100%",
  padding: "11px 12px",
  borderRadius: 12,
  border: "1px solid rgba(218, 137, 166, .35)",
  fontSize: 13,
  background: "rgba(255,255,255,.78)",
  color: "var(--mp-txt)",
  boxSizing: "border-box",
};

const iconFieldStyle = {
  position: "relative",
  display: "flex",
  alignItems: "center",
};

// 帳號/同步系統還在調整中：先鎖住整個區塊不讓玩家展開，改好後把這個旗標改回 false
const ACCOUNT_SECTION_LOCKED = !SYNC_ENABLED;

export default function AccountSyncSettings({ tr, notify }) {
  const text = (zh, en, ja = en, ko = en) => tr(zh, en, ja, ko);
  const [open, setOpen] = useState(false);
  const [serverOk, setServerOk] = useState(null);
  const [me, setMe] = useState(null);
  const [pending, setPending] = useState(0);
  const [busy, setBusy] = useState(false);
  const [formMode, setFormMode] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [serverUrlDraft, setServerUrlDraft] = useState(getServerUrl());
  const [lastSync, setLastSync] = useState(null);

  const refresh = async () => {
    const ok = await isServerReachable();
    setServerOk(ok);
    setPending(await getPendingSyncCount().catch(() => 0));
    setMe(ok && getSyncAccount() ? await getMe().catch(() => null) : null);
  };

  useEffect(() => { if (open) void refresh(); }, [open]);

  const reportError = (error) => {
    notify(`${text("操作失敗", "Operation failed")}：${error?.message || ""}`);
  };

  const resetForm = () => {
    setFormMode(null);
    setEmail("");
    setPassword("");
  };

  const submitAccount = async () => {
    setBusy(true);
    try {
      if (formMode === "register") {
        await ensureAccount();
        await bindEmail(email.trim(), password);
        notify(text("帳號建立完成，正在上傳本地資料…", "Account created. Uploading local data..."));
        // 註冊＝匿名帳號升級，userId 不變，本地資料全在 outbox 裡：立刻推上雲端。
        // 失敗不影響註冊結果，outbox 會保留，下次存檔或開機自動重試。
        const result = await syncNow({ pull: true }).catch(() => null);
        setLastSync(result);
        notify(result
          ? text("帳號建立完成，資料已同步", "Account created and data synced")
          : text("帳號建立完成（資料將於下次連線時同步）", "Account created (data will sync when back online)"));
        resetForm();
        await refresh();
      } else {
        // 防呆：匿名（訪客）帳號沒有 email/密碼，登入其他帳號後裝置改綁新帳號，
        // 訪客資料就再也拿不回來——先給玩家一次註冊保存的機會
        if (getSyncAccount()?.anonymous) {
          const proceed = window.confirm(text(
            "此裝置上的訪客資料在登入其他帳號後將無法取回。\n建議先「註冊」把訪客資料綁定成帳號保存。\n\n確定要直接登入其他帳號嗎？",
            "Guest data on this device cannot be recovered after signing in to another account.\nWe recommend registering first to keep your guest data.\n\nSign in to another account anyway?",
          ));
          if (!proceed) return;
        }
        await loginAccount(email.trim(), password);
        notify(text("登入成功，正在載入雲端資料…", "Signed in. Loading cloud data..."));
        setTimeout(() => window.location.reload(), 500);
      }
    } catch (error) {
      reportError(error);
    } finally {
      setBusy(false);
    }
  };

  const doSync = async () => {
    setBusy(true);
    try {
      const result = await syncNow({ pull: true });
      setLastSync(result);
      notify(text("同步完成", "Sync complete"));
      if (result?.pulled > 0 || result?.appliedRemote > 0) {
        setTimeout(() => window.location.reload(), 500);
        return;
      }
      await refresh();
    } catch (error) {
      reportError(error);
    } finally {
      setBusy(false);
    }
  };

  const doLogout = async () => {
    setBusy(true);
    try {
      await logoutAccount();
      setMe(null);
      resetForm();
      notify(text("已登出", "Signed out"));
    } catch (error) {
      reportError(error);
    } finally {
      setBusy(false);
    }
  };

  const saveUrl = () => {
    setServerUrl(serverUrlDraft);
    notify(text("伺服器網址已儲存", "Server URL saved"));
    void refresh();
  };

  const showForm = (mode) => {
    setFormMode(mode);
    setEmail("");
    setPassword("");
  };

  const isMember = !!me?.email;
  const isGuest = !!me && !me.email;
  const myDeviceId = getLocalDeviceId();
  const primaryButton = {
    width: "100%",
    border: "none",
    borderRadius: 999,
    padding: "12px 16px",
    fontWeight: 900,
    fontSize: 14,
    color: "white",
    cursor: "pointer",
    background: "linear-gradient(135deg, var(--mp-pink, #ff8eb4), var(--mp-pink-dk, #e86c9b))",
    boxShadow: "0 5px 14px rgba(224, 96, 145, .2)",
  };
  const secondaryButton = {
    ...primaryButton,
    color: "var(--mp-pink-dk, #d95889)",
    background: "rgba(255,255,255,.82)",
    border: "1px solid rgba(218, 137, 166, .35)",
    boxShadow: "none",
  };

  return (
    <div className="mp-sg">
      <div
        onClick={() => { if (!ACCOUNT_SECTION_LOCKED) setOpen((value) => !value); }}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, cursor: ACCOUNT_SECTION_LOCKED ? "default" : "pointer", opacity: ACCOUNT_SECTION_LOCKED ? 0.6 : 1 }}
      >
        <div>
          <div className="mp-sg-t" style={{ marginBottom: 3 }}>{text("帳號", "Account")}</div>
          <div style={{ fontSize: 10, color: "var(--mp-txt-l)" }}>
            {ACCOUNT_SECTION_LOCKED
              ? text("功能調整中，暫時無法使用", "Under maintenance, temporarily unavailable")
              : isMember
                ? me.email
                : text("登入帳號以同步您的所有資料", "Sign in to sync all your data")}
          </div>
        </div>
        <span style={{ fontSize: 11, fontWeight: 900, color: "var(--mp-pink-dk)" }}>
          {ACCOUNT_SECTION_LOCKED ? "🔒" : open ? text("收合", "Close") : text("展開", "Open")}
        </span>
      </div>

      {!ACCOUNT_SECTION_LOCKED && open && (
        <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
          {serverOk === null && (
            <div style={{ fontSize: 12, color: "var(--mp-txt-l)" }}>{text("正在連線…", "Connecting...")}</div>
          )}
          {serverOk === false && (
            <div style={{ padding: 10, borderRadius: 12, background: "rgba(239,83,80,.08)", color: "#d75a5a", fontSize: 12 }}>
              {text("目前無法連線至雲端伺服器", "Unable to reach the cloud server")}
            </div>
          )}

          {serverOk && !isMember && formMode === null && (
            <>
              <div style={{ lineHeight: 1.7 }}>
                <div style={{ fontWeight: 900, fontSize: 16 }}>{text("帳號", "Account")}</div>
                <div style={{ marginTop: 6, fontSize: 13, color: "var(--mp-txt-l)" }}>
                  {isGuest
                    ? text("目前為訪客模式。建立帳號後即可安全地跨裝置同步資料。", "You are using guest mode. Create an account to safely sync across devices.")
                    : text("登入或建立帳號，以同步您的所有資料。", "Sign in or create an account to sync all your data.")}
                </div>
              </div>
              <button style={primaryButton} disabled={busy} onClick={() => showForm("login")}>
                👤 {text("登入／註冊", "Sign in / Register")}
              </button>
            </>
          )}

          {serverOk && !isMember && formMode !== null && (
            <div style={{
              display: "grid",
              gap: 12,
              padding: "18px 14px 14px",
              borderRadius: 22,
              border: "1px solid rgba(255,255,255,.72)",
              background: "linear-gradient(155deg, rgba(255,255,255,.9), rgba(255,229,239,.72))",
              boxShadow: "0 12px 28px rgba(190,91,130,.12)",
            }}>
              <div style={{ display: "grid", justifyItems: "center", gap: 7, textAlign: "center" }}>
                <div style={{
                  width: 54,
                  height: 54,
                  borderRadius: 18,
                  display: "grid",
                  placeItems: "center",
                  color: "white",
                  background: "linear-gradient(145deg, #ffabc8, #e86c9b)",
                  boxShadow: "0 8px 18px rgba(222,91,143,.25)",
                }}>
                  {formMode === "login" ? <LogIn size={25} /> : <UserPlus size={25} />}
                </div>
                <div style={{ fontSize: 17, fontWeight: 950, color: "var(--mp-txt)" }}>
                  {formMode === "login" ? text("歡迎回來", "Welcome back") : text("建立您的帳號", "Create your account")}
                </div>
                <div style={{ maxWidth: 280, fontSize: 11, lineHeight: 1.6, color: "var(--mp-txt-l)" }}>
                  {formMode === "login"
                    ? text("登入後即可載入並同步您的雲端資料", "Sign in to load and sync your cloud data")
                    : text("註冊後即可跨裝置保存角色與遊戲資料", "Register to keep your characters and game data across devices")}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", padding: 4, borderRadius: 999, background: "rgba(232,108,155,.09)" }}>
                {["login", "register"].map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setFormMode(mode)}
                    style={{
                      border: "none",
                      borderRadius: 999,
                      padding: "9px 12px",
                      fontWeight: 900,
                      cursor: "pointer",
                      color: formMode === mode ? "white" : "var(--mp-txt-l)",
                      background: formMode === mode ? "linear-gradient(135deg,#ff9abd,#e86c9b)" : "transparent",
                      boxShadow: formMode === mode ? "0 4px 11px rgba(218,91,140,.2)" : "none",
                      transition: "all .18s ease",
                    }}
                  >
                    {mode === "login" ? text("登入", "Sign in") : text("註冊", "Register")}
                  </button>
                ))}
              </div>

              <div style={iconFieldStyle}>
                <Mail size={17} style={{ position: "absolute", left: 13, color: "#d8789c", pointerEvents: "none" }} />
                <input style={{ ...fieldStyle, paddingLeft: 40, background: "rgba(255,255,255,.9)" }} type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" autoComplete="email" />
              </div>
              <div style={iconFieldStyle}>
                <LockKeyhole size={17} style={{ position: "absolute", left: 13, color: "#d8789c", pointerEvents: "none" }} />
                <input
                  style={{ ...fieldStyle, paddingLeft: 40, background: "rgba(255,255,255,.9)" }}
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={text("密碼（至少 8 個字元）", "Password (8+ characters)")}
                  autoComplete={formMode === "register" ? "new-password" : "current-password"}
                />
              </div>
              {formMode === "register" && (
                <div style={{ marginTop: -5, paddingLeft: 4, fontSize: 10, color: password.length >= 8 ? "#55a77b" : "var(--mp-txt-l)" }}>
                  {password.length >= 8 ? "✓ " : ""}{text("密碼需至少 8 個字元", "Password must contain at least 8 characters")}
                </div>
              )}
              <button style={primaryButton} disabled={busy || !email.trim() || password.length < 8} onClick={submitAccount}>
                <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                  {formMode === "login" ? <UserRound size={17} /> : <UserPlus size={17} />}
                  {busy ? text("處理中…", "Please wait...") : formMode === "login" ? text("登入帳號", "Sign in") : text("建立帳號", "Create account")}
                </span>
              </button>
              <button
                disabled={busy}
                onClick={resetForm}
                style={{ border: "none", background: "transparent", color: "var(--mp-txt-l)", fontSize: 11, fontWeight: 800, cursor: "pointer", padding: 5 }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><ArrowLeft size={13} />{text("返回帳號頁", "Back to account")}</span>
              </button>
            </div>
          )}

          {serverOk && isMember && (
            <>
              <div style={{ padding: 12, borderRadius: 14, background: "rgba(255,255,255,.65)", lineHeight: 1.8 }}>
                <div style={{ fontSize: 11, color: "var(--mp-txt-l)" }}>{text("目前帳號", "Current account")}</div>
                <div style={{ fontWeight: 900, wordBreak: "break-all" }}>{me.email}</div>
                <div style={{ marginTop: 5, fontSize: 11, color: "var(--mp-txt-l)" }}>
                  {text("等待同步", "Pending")}: {pending}
                  {lastSync ? ` · ↑${lastSync.pushed || 0} ↓${lastSync.pulled || 0}` : ""}
                </div>
              </div>
              <button style={primaryButton} disabled={busy} onClick={doSync}>{text("立即同步", "Sync now")}</button>
              <button style={secondaryButton} disabled={busy} onClick={doLogout}>{text("登出此裝置", "Sign out this device")}</button>

              {me.devices?.length > 1 && (
                <div style={{ display: "grid", gap: 6, fontSize: 12 }}>
                  <div style={{ fontWeight: 900 }}>{text("已登入裝置", "Signed-in devices")}</div>
                  {me.devices.map((device) => (
                    <div key={device.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                      <span style={{ color: "var(--mp-txt-l)" }}>
                        {device.platform || "?"} · {device.id.slice(0, 8)}{device.id === myDeviceId ? ` (${text("此裝置", "this device")})` : ""}
                      </span>
                      {device.id !== myDeviceId && (
                        <button
                          disabled={busy}
                          onClick={async () => {
                            setBusy(true);
                            try { await logoutDevice(device.id); await refresh(); }
                            catch (error) { reportError(error); }
                            finally { setBusy(false); }
                          }}
                          style={{ border: "none", background: "transparent", color: "#d75a5a", fontWeight: 800, cursor: "pointer" }}
                        >
                          {text("登出", "Sign out")}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {!OFFICIAL_SERVER_URL && (
            <div style={{ borderTop: "1px solid rgba(218,137,166,.18)", paddingTop: 10 }}>
              <button
                onClick={() => setAdvanced((value) => !value)}
                style={{ border: "none", background: "transparent", padding: 0, color: "var(--mp-txt-l)", fontSize: 11, cursor: "pointer", fontWeight: 800 }}
              >
                ⚙ {text("進階設定", "Advanced settings")} {advanced ? "▴" : "▾"}
              </button>
              {advanced && (
                <div style={{ display: "grid", gap: 7, marginTop: 9 }}>
                  <div style={{ fontSize: 11, color: "var(--mp-txt-l)" }}>{text("伺服器網址（APK 必填）", "Server URL (required for APK)")}</div>
                  <input style={fieldStyle} type="url" value={serverUrlDraft} onChange={(event) => setServerUrlDraft(event.target.value)} placeholder="https://your-app.up.railway.app" />
                  <button style={secondaryButton} onClick={saveUrl}>{text("儲存網址", "Save URL")}</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
