import React, { Suspense } from "react";
import { yunyinGenerateLinePack } from "../../services/yunyinAiBridge.js";
import { loadMusicApp } from "../../utils/featurePreload.js";
import { lazyWithRetry } from "../../utils/lazyWithRetry.js";

// App 畫面一律按需載入，避免首頁先解析玩家尚未開啟的完整功能。
const PetHome = lazyWithRetry(() => import("../../PetHome.jsx"));
const GameCenter = lazyWithRetry(() => import("./GameCenter.jsx"));
const AnswerBookApp = lazyWithRetry(() => import("./AnswerBookApp.jsx"));
const NotesApp = lazyWithRetry(() => import("./NotesApp.jsx"));
const MusicApp = lazyWithRetry(loadMusicApp);
const CoupleApp = lazyWithRetry(() => import("./CoupleApp.jsx"));
const CalendarApp = lazyWithRetry(() => import("./CalendarApp.jsx"));
const YunyinGame = lazyWithRetry(() => import("../../yunyin/YunyinGame.jsx"));

function AppLoading({ dark = false }) {
  return <div className="mp-page" style={{ display: "grid", placeItems: "center", background: dark ? "#1c2733" : "var(--mp-page-bg)", color: dark ? "#fff" : "var(--mp-txt)" }}>載入中⋯</div>;
}

const withSuspense = (content, options = {}) => (
  <Suspense fallback={<AppLoading dark={!!options.dark} />}>{content}</Suspense>
);

function UnknownApp({ appId, closeApp, tr }) {
  return (
    <div className="mp-page" role="alert" style={{ background: "var(--mp-page-bg)", color: "var(--mp-txt)" }}>
      <div className="mp-hdr">
        <button type="button" className="mp-back" onClick={closeApp} aria-label={tr("返回首頁", "Back to Home", "ホームに戻る", "홈으로 돌아가기")}>←</button>
        <div className="mp-htitle">{tr("App 無法開啟", "App could not open", "Appを開けません", "앱을 열 수 없습니다")}</div>
      </div>
      <div className="mp-empty" style={{ flex: 1, padding: 24, textAlign: "center" }}>
        <div className="mp-empty-i">⚠️</div>
        <div className="mp-empty-t" style={{ lineHeight: 1.7 }}>
          {tr("這個 App 版本不相容，請返回首頁後再試一次。", "This App is not available in this version. Return Home and try again.", "このAppは現在のバージョンで利用できません。ホームに戻って再試行してください。", "이 앱은 현재 버전에서 사용할 수 없습니다. 홈으로 돌아가 다시 시도해 주세요.")}
        </div>
        <button type="button" className="mp-save" style={{ marginTop: 16 }} onClick={closeApp}>
          {tr("返回首頁", "Back to Home", "ホームに戻る", "홈으로 돌아가기")}
        </button>
        <div style={{ marginTop: 12, fontSize: 10, color: "var(--mp-txt-l)", overflowWrap: "anywhere" }}>{String(appId || "unknown")}</div>
      </div>
    </div>
  );
}

function PlaceholderApp({ icon, title, closeApp, t }) {
  return <div className="mp-page"><div className="mp-hdr"><div className="mp-back" onClick={closeApp}>←</div><div className="mp-htitle">{icon} {title}</div></div><div className="mp-empty" style={{ flex: 1 }}><div className="mp-empty-i">{icon}</div><div className="mp-empty-t">{t("comingSoon")}<br />{t("stayTuned")}</div></div></div>;
}

export default function AppRouter({ currentApp, renderers, game, closeApp, t, tr, yunyin, apiConfig, playerProfile, chatHistory, setChatHistory }) {
  if (!currentApp) return null;
  if (renderers?.[currentApp]) {
    return withSuspense(renderers[currentApp]());
  }
  switch (currentApp) {
    case "gallery": return <PlaceholderApp icon="🖼️" title={t("gallery")} closeApp={closeApp} t={t} />;
    case "game": return withSuspense(<GameCenter page={game.page} setPage={game.setPage} closeApp={closeApp} t={t} tr={tr} characters={game.characters} onOpenChat={game.onOpenChat} />);
    case "petHome": return withSuspense(<PetHome onClose={closeApp} apiConfig={apiConfig} />);
    case "yunyin": return withSuspense(
      <YunyinGame
        onBack={closeApp}
        characters={yunyin?.characters || []}
        onAiGenerate={yunyin ? (charId, poolSpec) => yunyinGenerateLinePack(charId, poolSpec, yunyin.apiConfig, yunyin.characters) : null}
      />,
      { dark: true },
    );
    case "lbook": return withSuspense(<AnswerBookApp closeApp={closeApp} title={t("answerBook")} />);
    case "notebook": return withSuspense(<NotesApp onBack={closeApp} tr={tr} />);
    case "music": return withSuspense(<MusicApp closeApp={closeApp} apiConfig={apiConfig} characters={game?.characters || []} playerProfile={playerProfile} tr={tr} />);
    case "couple": return withSuspense(<CoupleApp closeApp={closeApp} characters={game?.characters || []} chatHistory={chatHistory || {}} setChatHistory={setChatHistory} playerProfile={playerProfile} apiConfig={apiConfig} tr={tr} />);
    case "calendar": return withSuspense(<CalendarApp closeApp={closeApp} tr={tr} />);
    default: return <UnknownApp appId={currentApp} closeApp={closeApp} tr={tr} />;
  }
}
