import React, { Suspense, lazy } from "react";
import PetHome from "../../PetHome";
import GameCenter from "./GameCenter";
import AnswerBookApp from "./AnswerBookApp";
import { yunyinGenerateLinePack } from "../../services/yunyinAiBridge";

// 雲隱山莊：lazy load，不進主 bundle
const YunyinGame = lazy(() => import("../../yunyin/YunyinGame"));

function PlaceholderApp({ icon, title, closeApp, t }) {
  return <div className="mp-page"><div className="mp-hdr"><div className="mp-back" onClick={closeApp}>←</div><div className="mp-htitle">{icon} {title}</div></div><div className="mp-empty" style={{ flex: 1 }}><div className="mp-empty-i">{icon}</div><div className="mp-empty-t">{t("comingSoon")}<br />{t("stayTuned")}</div></div></div>;
}

export default function AppRouter({ currentApp, renderers, game, closeApp, t, tr, yunyin }) {
  if (!currentApp) return null;
  if (renderers[currentApp]) return renderers[currentApp]();
  switch (currentApp) {
    case "gallery": return <PlaceholderApp icon="🖼️" title={t("gallery")} closeApp={closeApp} t={t} />;
    case "game": return <GameCenter page={game.page} setPage={game.setPage} closeApp={closeApp} t={t} tr={tr} />;
    case "petHome": return <PetHome onClose={closeApp} />;
    case "yunyin": return <Suspense fallback={<div className="mp-page" style={{ display: "grid", placeItems: "center", background: "#1c2733", color: "#fff" }}>載入中⋯</div>}>
      <YunyinGame
        onBack={closeApp}
        characters={yunyin?.characters || []}
        onAiGenerate={yunyin ? (charId, poolSpec) => yunyinGenerateLinePack(charId, poolSpec, yunyin.apiConfig, yunyin.characters) : null}
      />
    </Suspense>;
    case "lbook": return <AnswerBookApp closeApp={closeApp} title={t("answerBook")} />;
    case "notebook": return <PlaceholderApp icon="📒" title={t("notebook")} closeApp={closeApp} t={t} />;
    default: return null;
  }
}
