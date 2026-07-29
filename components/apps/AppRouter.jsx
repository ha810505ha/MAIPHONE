import React, { Suspense, lazy } from "react";
import { yunyinGenerateLinePack } from "../../services/yunyinAiBridge.js";
import { loadMusicApp } from "../../utils/featurePreload.js";

// App 畫面一律按需載入，避免首頁先解析玩家尚未開啟的完整功能。
const PetHome = lazy(() => import("../../PetHome.jsx"));
const GameCenter = lazy(() => import("./GameCenter.jsx"));
const AnswerBookApp = lazy(() => import("./AnswerBookApp.jsx"));
const NotesApp = lazy(() => import("./NotesApp.jsx"));
const MusicApp = lazy(loadMusicApp);
const CoupleApp = lazy(() => import("./CoupleApp.jsx"));
const CalendarApp = lazy(() => import("./CalendarApp.jsx"));
const YunyinGame = lazy(() => import("../../yunyin/YunyinGame.jsx"));

function AppLoading({ dark = false }) {
  return <div className="mp-page" style={{ display: "grid", placeItems: "center", background: dark ? "#1c2733" : "var(--mp-page-bg)", color: dark ? "#fff" : "var(--mp-txt)" }}>載入中⋯</div>;
}

const withSuspense = (content, options = {}) => (
  <Suspense fallback={<AppLoading dark={!!options.dark} />}>{content}</Suspense>
);

function PlaceholderApp({ icon, title, closeApp, t }) {
  return <div className="mp-page"><div className="mp-hdr"><div className="mp-back" onClick={closeApp}>←</div><div className="mp-htitle">{icon} {title}</div></div><div className="mp-empty" style={{ flex: 1 }}><div className="mp-empty-i">{icon}</div><div className="mp-empty-t">{t("comingSoon")}<br />{t("stayTuned")}</div></div></div>;
}

export default function AppRouter({ currentApp, renderers, game, closeApp, t, tr, yunyin, apiConfig, playerProfile, chatHistory, setChatHistory }) {
  if (!currentApp) return null;
  if (renderers[currentApp]) return withSuspense(renderers[currentApp]());
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
    case "notebook": return withSuspense(<NotesApp onBack={closeApp} />);
    case "music": return withSuspense(<MusicApp closeApp={closeApp} apiConfig={apiConfig} characters={game?.characters || []} playerProfile={playerProfile} tr={tr} />);
    case "couple": return withSuspense(<CoupleApp closeApp={closeApp} characters={game?.characters || []} chatHistory={chatHistory || {}} setChatHistory={setChatHistory} playerProfile={playerProfile} apiConfig={apiConfig} tr={tr} />);
    case "calendar": return withSuspense(<CalendarApp closeApp={closeApp} tr={tr} />);
    default: return null;
  }
}
