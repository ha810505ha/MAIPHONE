import React, { useState } from "react";
import {
  createGitHubPrivateRepository,
  getGitHubBackupConfig,
  getGitHubBackupFile,
  getGitHubViewer,
  listGitHubBackups,
  listGitHubPrivateRepositories,
  pollGitHubDeviceAuthorization,
  putGitHubBackupFile,
  startGitHubDeviceAuthorization,
} from "../../services/backup/githubBackupService";
import {
  getGoogleDriveBackup,
  getGoogleDriveBackupConfig,
  listGoogleDriveBackups,
  putGoogleDriveBackup,
  signInToGoogleDrive,
  takePendingGoogleDriveWebSession,
} from "../../services/backup/googleDriveBackupService";

const cardStyle = {
  border: "1px solid var(--mp-card-border)",
  borderRadius: 14,
  padding: 11,
  background: "var(--mp-card-bg,var(--mp-surface))",
  color: "var(--mp-page-text,var(--mp-txt))",
  marginTop: 9,
};
const buttonStyle = { width: "100%", marginTop: 8 };

function messageOf(error) {
  return String(error?.message || "Unknown error").slice(0, 160);
}

export default function CloudBackupSettings({ tr, getExportableState, getRollbackState, validateImportedState, summarizeImportedData, applyImportedState, showToast }) {
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [deviceRequest, setDeviceRequest] = useState(null);
  const [accessToken, setAccessToken] = useState("");
  const [viewer, setViewer] = useState(null);
  const [repositories, setRepositories] = useState([]);
  const [repository, setRepository] = useState(null);
  const [githubBackups, setGitHubBackups] = useState([]);
  const [githubBackupPath, setGitHubBackupPath] = useState("");
  const [newRepositoryName, setNewRepositoryName] = useState("maliphone-backup");
  const [googleSession, setGoogleSession] = useState(() => takePendingGoogleDriveWebSession());
  const [googleBackups, setGoogleBackups] = useState([]);
  const [googleBackupId, setGoogleBackupId] = useState("");

  const config = getGitHubBackupConfig();
  const googleConfig = getGoogleDriveBackupConfig();
  const clearGitHubSession = () => {
    setDeviceRequest(null);
    setAccessToken("");
    setViewer(null);
    setRepositories([]);
    setRepository(null);
    setGitHubBackups([]);
    setGitHubBackupPath("");
  };
  const close = () => {
    clearGitHubSession();
    setProvider("");
    setNotice("");
    setGoogleSession(null);
    setOpen(false);
  };

  const connectGoogleDrive = async () => {
    try {
      setBusy(true);
      setNotice("");
      const result = await signInToGoogleDrive();
      if (!result?.accessToken) throw new Error(tr("Google 沒有提供 Drive 存取權杖", "Google did not provide a Drive access token", "Google から Drive アクセストークンが提供されませんでした", "Google에서 Drive 액세스 토큰을 제공하지 않았습니다."));
      setGoogleSession({ accessToken: result.accessToken, email: result.email || "" });
      const backups = await listGoogleDriveBackups(result.accessToken);
      setGoogleBackups(backups);
      setGoogleBackupId(backups[0]?.id || "");
      setNotice(tr("Google Drive 已連結。", "Google Drive is connected.", "Google Drive が接続されました。", "Google Drive가 연결되었습니다."));
    } catch (error) { showError(error); } finally { setBusy(false); }
  };

  const uploadGoogleBackup = async () => {
    try {
      setBusy(true);
      await putGoogleDriveBackup(googleSession.accessToken, await getExportableState());
      const backups = await listGoogleDriveBackups(googleSession.accessToken);
      setGoogleBackups(backups);
      setGoogleBackupId(backups[0]?.id || "");
      setNotice(tr("已新增一份 Google Drive 備份版本。", "A new Google Drive backup version was created.", "Google Drive に新しいバックアップ版を作成しました。", "새 Google Drive 백업 버전을 만들었습니다."));
      showToast(tr("Google Drive 雲端備份完成", "Google Drive cloud backup complete", "Google Drive クラウドバックアップが完了しました", "Google Drive 클라우ド 백업이 완료되었습니다"));
    } catch (error) { showError(error); } finally { setBusy(false); }
  };

  const restoreGoogleBackup = async () => {
    try {
      setBusy(true);
      const file = await getGoogleDriveBackup(googleSession.accessToken, googleBackupId);
      if (!file) throw new Error(tr("Google Drive 尚未有 MaliPhone 備份檔", "Your Google Drive does not have a MaliPhone backup yet", "Google Drive に MaliPhone バックアップがまだありません", "Google Drive에 아직 MaliPhone 백업이 없습니다."));
      const payload = JSON.parse(file.content);
      validateImportedState(payload);
      if (!window.confirm(tr("即將以 Google Drive 備份覆蓋此手機的全域資料。目前資料會先建立還原點。確定繼續嗎？", "This will overwrite this phone's global data with the Google Drive backup. A rollback point will be created first. Continue?", "Google Drive バックアップでこの端末の全体データを上書きします。現在のデータは先に復元用として保存します。続けますか？", "Google Drive 백업으로 이 휴대폰의 전체 데이터를 덮어씁니다. 현재 데이터는 먼저 복원 지점으로 저장됩니다. 계속할까요?"))) return;
      const rollback = await getRollbackState();
      try { await applyImportedState(payload); } catch (error) { try { await applyImportedState(rollback, { rollback: true }); } catch {} throw error; }
      setNotice(tr("Google Drive 備份已還原到此手機。", "Google Drive backup restored to this phone.", "Google Drive バックアップをこの端末に復元しました。", "Google Drive 백업을このスマホに復元しました。"));
      showToast(tr("雲端備份已還原", "Cloud backup restored", "クラウドバックアップを復元しました", "클라우드 백업을 복원했습니다"));
    } catch (error) { showError(error); } finally { setBusy(false); }
  };
  const showError = (error) => {
    const message = messageOf(error);
    setNotice(`${tr("操作失敗", "Action failed", "操作に失敗しました", "작업에 실패했습니다")}：${message}`);
  };

  const beginGitHubAuthorization = async () => {
    try {
      setBusy(true);
      setNotice("");
      const request = await startGitHubDeviceAuthorization({ clientId: config.clientId, proxyUrl: config.proxyUrl });
      setDeviceRequest({ ...request, expiresAt: Date.now() + request.expiresIn * 1000 });
    } catch (error) { showError(error); } finally { setBusy(false); }
  };

  const loadGitHubBackups = async (nextRepository, token = accessToken) => {
    if (!nextRepository || !token) {
      setGitHubBackups([]);
      setGitHubBackupPath("");
      return;
    }
    try {
      const backups = await listGitHubBackups(token, nextRepository);
      setGitHubBackups(backups);
      setGitHubBackupPath(backups[0]?.path || "");
    } catch (error) {
      setGitHubBackups([]);
      setGitHubBackupPath("");
      showError(error);
    }
  };

  const finishGitHubAuthorization = async () => {
    if (!deviceRequest) return;
    try {
      setBusy(true);
      setNotice("");
      if (Date.now() >= deviceRequest.expiresAt) throw new Error(tr("授權代碼已過期，請重新開始", "The authorization code expired. Start again.", "認証コードの有効期限が切れました。やり直してください。", "인증 코드가 만료되었습니다. 다시 시작하세요."));
      const result = await pollGitHubDeviceAuthorization({ clientId: config.clientId, proxyUrl: config.proxyUrl, deviceCode: deviceRequest.deviceCode });
      if (result.status === "authorization_pending") {
        setNotice(tr("GitHub 尚未完成授權；請在瀏覽器輸入代碼後再按一次確認。", "GitHub authorization is still pending. Enter the code in your browser, then confirm again.", "GitHub の認証はまだ完了していません。ブラウザでコードを入力してから、もう一度確認してください。", "GitHub 인증이 아직 완료되지 않았습니다. 브라우저에서 코드를 입력한 뒤 다시 확인하세요."));
        return;
      }
      if (result.status === "slow_down") {
        setNotice(tr("請稍候幾秒再確認授權。", "Please wait a few seconds before confirming again.", "数秒待ってからもう一度確認してください。", "몇 초 후 다시 확인하세요."));
        return;
      }
      const account = await getGitHubViewer(result.accessToken);
      const privateRepos = await listGitHubPrivateRepositories(result.accessToken);
      setAccessToken(result.accessToken);
      setViewer(account);
      setRepositories(privateRepos);
      setDeviceRequest(null);
      setNotice(tr("GitHub 已連結。請選擇自己的私有 repository，或建立新的備份 repository。", "GitHub is connected. Choose one of your private repositories or create a backup repository.", "GitHub が接続されました。自分の非公開リポジトリを選ぶか、新しいバックアップ用リポジトリを作成してください。", "GitHub이 연결되었습니다. 본인의 비공개 저장소를 선택하거나 새 백업 저장소를 만드세요."));
    } catch (error) { showError(error); } finally { setBusy(false); }
  };

  const createRepository = async () => {
    try {
      setBusy(true);
      const created = await createGitHubPrivateRepository(accessToken, newRepositoryName);
      setRepositories((current) => [created, ...current]);
      setRepository(created);
      setGitHubBackups([]);
      setGitHubBackupPath("");
      setNotice(tr("已建立你的私有備份 repository。", "Your private backup repository was created.", "非公開のバックアップ用リポジトリを作成しました。", "비공개 백업 저장소를 만들었습니다."));
    } catch (error) { showError(error); } finally { setBusy(false); }
  };

  const uploadBackup = async () => {
    try {
      setBusy(true);
      const payload = await getExportableState();
      await putGitHubBackupFile(accessToken, repository, payload);
      await loadGitHubBackups(repository);
      const destination = repository.fullName || `${repository.owner}/${repository.name}`;
      setNotice(tr(`已新增備份版本到 ${destination}。`, `A new backup version was added to ${destination}.`, `${destination} に新しいバックアップ版を追加しました。`, `${destination}에 새 백업 버전을 추가했습니다.`));
      showToast(tr("GitHub 雲端備份完成", "GitHub cloud backup complete", "GitHub クラウドバックアップが完了しました", "GitHub 클라우드 백업이 완료되었습니다"));
    } catch (error) { showError(error); } finally { setBusy(false); }
  };

  const restoreBackup = async () => {
    try {
      setBusy(true);
      const file = await getGitHubBackupFile(accessToken, repository, { path: githubBackupPath });
      if (!file) throw new Error(tr("此 repository 尚未有 MaliPhone 備份檔", "This repository does not have a MaliPhone backup yet", "このリポジトリには MaliPhone のバックアップがまだありません", "이 저장소에는 아직 MaliPhone 백업이 없습니다"));
      const payload = JSON.parse(file.content);
      validateImportedState(payload);
      const summary = summarizeImportedData(payload);
      const counts = [summary?.characters != null ? `${summary.characters} ${tr("位角色", "characters", "キャラクター", "명의 캐릭터")}` : "", summary?.memories != null ? `${summary.memories} ${tr("筆記憶", "memories", "件の記憶", "개의 기억")}` : ""].filter(Boolean).join("、");
      if (!window.confirm(tr(`即將以 GitHub 備份覆蓋此手機的全域資料${counts ? `（${counts}）` : ""}。目前資料會先建立還原點。確定繼續嗎？`, `This will overwrite this phone's global data with the GitHub backup${counts ? ` (${counts})` : ""}. A rollback point will be created first. Continue?`, `GitHub バックアップでこの端末の全体データを上書きします${counts ? `（${counts}）` : ""}。現在のデータは先に復元用として保存します。続けますか？`, `GitHub 백업으로 이 휴대폰의 전체 데이터를 덮어씁니다${counts ? ` (${counts})` : ""}. 현재 데이터는 먼저 복원 지점으로 저장됩니다. 계속할까요?`))) return;
      const rollback = await getRollbackState();
      try {
        await applyImportedState(payload);
      } catch (error) {
        try { await applyImportedState(rollback, { rollback: true }); } catch {}
        throw error;
      }
      setNotice(tr("GitHub 備份已還原到此手機。", "GitHub backup restored to this phone.", "GitHub バックアップをこの端末に復元しました。", "GitHub 백업을 이 휴대폰에 복원했습니다."));
      showToast(tr("雲端備份已還原", "Cloud backup restored", "クラウドバックアップを復元しました", "클라우드 백업을 복원했습니다"));
    } catch (error) { showError(error); } finally { setBusy(false); }
  };

  return <div className="mp-sg">
    <div className="mp-sg-t">{tr("雲端備份", "Cloud backup", "クラウドバックアップ", "클라우드 백업")}</div>
    <div style={{ fontSize: 12, color: "var(--mp-txt-l)", lineHeight: 1.7 }}>
      {tr("只有在你按下雲端備份後，才會選擇自己的 Google Drive 或 GitHub。API Key 不會包含在備份中。", "Only when you choose cloud backup will you select your own Google Drive or GitHub. API keys are not included.", "クラウドバックアップを選んだときだけ、自分の Google Drive または GitHub を選択します。API キーはバックアップに含まれません。", "클라우드 백업을 선택할 때만 본인의 Google Drive 또는 GitHub을 선택합니다. API 키는 백업에 포함되지 않습니다.")}
      <br />
      {tr("相簿目前僅保存在此裝置，不包含在雲端備份或帳號同步中。", "The gallery currently stays on this device and is not included in cloud backups or account sync.", "アルバムは現在この端末のみに保存され、クラウドバックアップとアカウント同期には含まれません。", "앨범은 현재 이 기기에만 저장되며 클라우드 백업이나 계정 동기화에는 포함되지 않습니다.")}
    </div>
    {!open ? <button type="button" className="mp-save" style={{ ...buttonStyle, background: "linear-gradient(135deg,#8ec5fc,#4a90e2)" }} onClick={() => setOpen(true)}>{tr("☁ 開啟雲端備份", "☁ Open cloud backup", "☁ クラウドバックアップを開く", "☁ 클라우드 백업 열기")}</button> : <div style={cardStyle}>
      {!provider && <>
        <div style={{ fontWeight: 800, fontSize: 12 }}>{tr("選擇你的備份空間", "Choose your backup space", "バックアップ先を選択", "백업 공간 선택")}</div>
        <button type="button" className="mp-save" style={{ ...buttonStyle, background: "linear-gradient(135deg,#fbbc04,#4285f4)" }} onClick={() => { setProvider("google"); setNotice(""); }}>{tr("Google Drive", "Google Drive", "Google Drive", "Google Drive")}</button>
        <button type="button" className="mp-save" style={{ ...buttonStyle, background: "linear-gradient(135deg,#495057,#24292f)" }} onClick={() => { setProvider("github"); setNotice(""); }}>{tr("GitHub（私有 repository）", "GitHub (private repository)", "GitHub（非公開リポジトリ）", "GitHub (비공개 저장소)")}</button>
      </>}
      {provider === "google" && !googleSession && <>
        <div style={{ fontSize: 12, fontWeight: 800 }}>{tr("Google Drive 登入", "Google Drive sign in", "Google Drive にログイン", "Google Drive 로그인")}</div>
        <div style={{ fontSize: 11, color: "var(--mp-txt-l)", lineHeight: 1.65, marginTop: 6 }}>{tr("登入的是你自己的 Google 帳號，只授權 MaliPhone 建立與管理自己的備份檔。", "You sign in to your own Google account and only authorize MaliPhone to create and manage its own backup file.", "自分の Google アカウントにログインし、MaliPhone 自身のバックアップファイルの作成・管理だけを許可します。", "본인의 Google 계정으로 로그인하며 MaliPhone 자체 백업 파일의 생성 및 관리만 허용합니다.")}</div>
        {!googleConfig.configured && <div style={{ fontSize: 11, color: "#b26a00", marginTop: 7 }}>{tr("此測試版尚未加入 Google Drive Client ID。", "This build does not yet include the Google Drive Client ID.", "このテスト版には Google Drive Client ID がまだ含まれていません。", "이 테스트 빌드에는 Google Drive Client ID가 아직 포함되지 않았습니다.")}</div>}
        <button type="button" className="mp-save" disabled={!googleConfig.configured || busy} style={{ ...buttonStyle, background: "linear-gradient(135deg,#fbbc04,#4285f4)" }} onClick={connectGoogleDrive}>{busy ? tr("連線中…", "Connecting…", "接続中…", "연결 중…") : tr("登入 Google Drive", "Sign in to Google Drive", "Google Drive にログイン", "Google Drive 로그인")}</button>
      </>}
      {provider === "google" && googleSession && <>
        <div style={{ fontSize: 12, fontWeight: 800 }}>{tr("Google Drive 已連結", "Google Drive connected", "Google Drive 接続済み", "Google Drive 연결됨")}{googleSession.email ? `：${googleSession.email}` : ""}</div>
        <div style={{ fontSize: 10.5, color: "var(--mp-txt-l)", lineHeight: 1.6, marginTop: 6 }}>{tr("每次備份都會新增一份帶時間的版本；若不需要舊版本，可直接在自己的 Google Drive 刪除。", "Each backup creates a timestamped version. Delete old versions directly from your own Google Drive when no longer needed.", "バックアップのたびに日時付きの版を追加します。不要な旧版は自分の Google Drive から削除できます。", "백업할 때마다 시간 정보가 있는 버전을 추가합니다. 필요 없는 이전 버전은 자신의 Google Drive에서 삭제할 수 있습니다.")}</div>
        <select className="mp-ssel" value={googleBackupId} onChange={(event) => setGoogleBackupId(event.target.value)} style={{ width: "100%", marginTop: 8 }}>
          <option value="">{tr("還原時選擇雲端備份版本", "Choose a cloud backup version to restore", "復元するクラウドバックアップ版を選択", "복원할 클라우드 백업 버전 선택")}</option>
          {googleBackups.map((file) => <option key={file.id} value={file.id}>{file.name}{file.modifiedTime ? ` · ${new Date(file.modifiedTime).toLocaleString()}` : ""}</option>)}
        </select>
        <div style={{ display: "grid", gap: 7, marginTop: 10 }}>
          <button type="button" className="mp-save" disabled={busy} style={{ background: "linear-gradient(135deg,#5ac8a5,#2da87c)" }} onClick={uploadGoogleBackup}>{busy ? tr("處理中…", "Working…", "処理中…", "처리 중…") : tr("備份到 Google Drive", "Back up to Google Drive", "Google Drive にバックアップ", "Google Drive에 백업")}</button>
          <button type="button" className="mp-save" disabled={busy || !googleBackupId} style={{ background: "linear-gradient(135deg,#90a4ae,#607d8b)" }} onClick={restoreGoogleBackup}>{tr("從選定版本還原", "Restore selected version", "選択した版から復元", "선택한 버전에서 복원")}</button>
        </div>
      </>}
      {provider === "github" && !accessToken && !deviceRequest && <>
        <div style={{ fontSize: 12, fontWeight: 800 }}>{tr("GitHub 登入", "GitHub sign in", "GitHub にログイン", "GitHub 로그인")}</div>
        <div style={{ fontSize: 11, color: "var(--mp-txt-l)", lineHeight: 1.65, marginTop: 6 }}>{tr("會使用 GitHub Device Flow。你將在 GitHub 瀏覽器頁面確認授權，權杖只在這次操作期間保留。", "GitHub Device Flow opens a GitHub browser authorization. The token only remains for this operation.", "GitHub Device Flow を使用します。GitHub のブラウザ画面で認証し、トークンはこの操作中のみ保持します。", "GitHub Device Flow를 사용합니다. GitHub 브라우저 화면에서 인증하며 토큰은 이번 작업 중에만 유지됩니다.")}</div>
        {!config.configured && <div style={{ fontSize: 11, color: "#b26a00", marginTop: 7 }}>{tr("此測試版尚未加入 GitHub Client ID。", "This build does not yet include the GitHub Client ID.", "このテスト版には GitHub Client ID がまだ含まれていません。", "이 테스트 빌드에는 GitHub Client ID가 아직 포함되지 않았습니다.")}</div>}
        <button type="button" className="mp-save" disabled={!config.configured || busy} style={buttonStyle} onClick={beginGitHubAuthorization}>{busy ? tr("準備中…", "Preparing…", "準備中…", "준비 중…") : tr("登入 GitHub", "Sign in to GitHub", "GitHub にログイン", "GitHub 로그인")}</button>
      </>}
      {provider === "github" && deviceRequest && <>
        <div style={{ fontSize: 12, fontWeight: 800 }}>{tr("在 GitHub 確認授權", "Confirm authorization in GitHub", "GitHub で認証を確認", "GitHub에서 인증 확인")}</div>
        <div style={{ marginTop: 8, padding: "9px 10px", textAlign: "center", borderRadius: 10, background: "rgba(66,133,244,.12)", fontSize: 18, fontWeight: 900, letterSpacing: 1.4 }}>{deviceRequest.userCode}</div>
        <a href={deviceRequest.verificationUri} target="_blank" rel="noreferrer" style={{ display: "block", textAlign: "center", fontSize: 11, marginTop: 8, color: "#2f6fca" }}>{tr("開啟 GitHub 授權頁", "Open GitHub authorization", "GitHub の認証ページを開く", "GitHub 인증 페이지 열기")}</a>
        <div style={{ fontSize: 10.5, color: "var(--mp-txt-l)", lineHeight: 1.6, marginTop: 7 }}>{tr("在網頁輸入上方代碼並允許後，回到這裡按確認。", "Enter the code above and allow access in the browser, then return here to confirm.", "ブラウザで上のコードを入力して許可した後、ここに戻って確認してください。", "브라우저에서 위 코드를 입력하고 허용한 다음 여기로 돌아와 확인하세요.")}</div>
        <button type="button" className="mp-save" disabled={busy} style={buttonStyle} onClick={finishGitHubAuthorization}>{busy ? tr("確認中…", "Checking…", "確認中…", "확인 중…") : tr("我已完成 GitHub 授權", "I completed GitHub authorization", "GitHub の認証を完了しました", "GitHub 인증을 완료했습니다")}</button>
      </>}
      {provider === "github" && accessToken && <>
        <div style={{ fontSize: 12, fontWeight: 800 }}>{tr("已登入", "Signed in", "ログイン済み", "로그인됨")}：{viewer?.login || "GitHub"}</div>
        <select className="mp-ssel" value={repository ? `${repository.owner}/${repository.name}` : ""} onChange={(event) => { const selected = repositories.find((item) => `${item.owner}/${item.name}` === event.target.value) || null; setRepository(selected); void loadGitHubBackups(selected); }} style={{ width: "100%", marginTop: 8 }}>
          <option value="">{tr("選擇你的私有 repository", "Choose your private repository", "自分の非公開リポジトリを選択", "본인의 비공개 저장소 선택")}</option>
          {repositories.map((item) => <option key={`${item.owner}/${item.name}`} value={`${item.owner}/${item.name}`}>{item.fullName}</option>)}
        </select>
        {repository && <select className="mp-ssel" value={githubBackupPath} onChange={(event) => setGitHubBackupPath(event.target.value)} style={{ width: "100%", marginTop: 8 }}>
          <option value="">Choose a backup version to restore</option>
          {githubBackups.map((file) => <option key={file.path} value={file.path}>{file.name}</option>)}
        </select>}
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}><input className="mp-sinp" value={newRepositoryName} onChange={(event) => setNewRepositoryName(event.target.value)} placeholder="maliphone-backup" style={{ minWidth: 0, flex: 1 }} /><button type="button" className="mp-save" disabled={busy} onClick={createRepository}>{tr("建立私有 repo", "Create private repo", "非公開 repo を作成", "비공개 repo 만들기")}</button></div>
        {repository && <div style={{ display: "grid", gap: 7, marginTop: 10 }}>
          <button type="button" className="mp-save" disabled={busy} style={{ background: "linear-gradient(135deg,#5ac8a5,#2da87c)" }} onClick={uploadBackup}>{busy ? tr("處理中…", "Working…", "処理中…", "처리 중…") : tr("備份到 GitHub", "Back up to GitHub", "GitHub にバックアップ", "GitHub에 백업")}</button>
          <button type="button" className="mp-save" disabled={busy} style={{ background: "linear-gradient(135deg,#90a4ae,#607d8b)" }} onClick={restoreBackup}>{tr("從 GitHub 還原", "Restore from GitHub", "GitHub から復元", "GitHub에서 복원")}</button>
        </div>}
      </>}
      {notice && <div style={{ fontSize: 11, lineHeight: 1.6, color: "var(--mp-txt-l)", marginTop: 9 }}>{notice}</div>}
      <button type="button" style={{ border: 0, background: "transparent", color: "var(--mp-txt-l)", display: "block", margin: "10px auto 0", fontSize: 11 }} onClick={close}>{tr("關閉雲端備份", "Close cloud backup", "クラウドバックアップを閉じる", "클라우드 백업 닫기")}</button>
    </div>}
  </div>;
}
