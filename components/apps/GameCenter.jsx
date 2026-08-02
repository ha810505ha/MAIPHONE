import React from "react";
import GachaGame from "../gacha/GachaGame";
import LoginRewardApp from "./LoginRewardApp";
import { GACHA_ENABLED } from "../../config/featureFlags";

export default function GameCenter({ page, setPage, closeApp, t, tr, characters, onOpenChat }) {
  if (page === "gacha" && GACHA_ENABLED) return <GachaGame characters={characters} onBack={() => setPage("hub")} onOpenChat={onOpenChat} />;
  if (page === "loginReward") return <LoginRewardApp onBack={() => setPage("hub")} tr={tr} />;
  if (page === "football") return <div className="mp-page" style={{ background: "#071b16" }}>
    <div className="mp-hdr"><div className="mp-back" onClick={() => setPage("hub")}>←</div><div className="mp-htitle">{tr("世足Kick", "World Cup Kick", "ワールドカップKick", "월드컵 Kick")}</div></div>
    <iframe title={tr("世界盃射門小遊戲", "World Cup shooting mini-game", "ワールドカップシュートミニゲーム", "월드컵 슈팅 미니게임")} src="./game.html" style={{ flex: 1, width: "100%", border: 0, background: "#071b16" }} />
  </div>;
  return <div className="mp-page game-center-page">
    <div className="mp-hdr"><div className="mp-back" onClick={closeApp}>←</div><div className="mp-htitle">{t("gameCenter")}</div></div>
    <div style={{ padding: 16, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
      <button className="mp-cw" onClick={() => setPage("football")} style={{ width: "100%", border: "1px solid rgba(231,197,214,.6)", background: "rgba(255,255,255,.88)", textAlign: "center", padding: 14, flexDirection: "column", alignItems: "center", gap: 10, borderRadius: 22 }}>
        <div className="mp-av" style={{ width: 72, height: 72, borderRadius: 20, overflow: "hidden", flex: "0 0 auto" }}><img src="./app-icons/game-football.webp?v=20260802" alt={tr("世足射門", "World Cup shooting", "ワールドカップシュート", "월드컵 슈팅")} style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>
        <div className="mp-cw-name" style={{ fontSize: 16, marginTop: 2 }}>{tr("世足Kick", "World Cup Kick", "ワールドカップKick", "월드컵 Kick")}</div>
      </button>
      {GACHA_ENABLED && <button className="mp-cw" type="button" onClick={() => setPage("gacha")} style={{ width: "100%", border: "1px solid rgba(231,197,214,.6)", background: "rgba(255,255,255,.72)", textAlign: "center", padding: 14, flexDirection: "column", alignItems: "center", gap: 10, borderRadius: 22 }}>
        <div className="mp-av" style={{ width: 72, height: 72, borderRadius: 20, overflow: "hidden", flex: "0 0 auto", background: "linear-gradient(145deg,#ffd6e3,#f5a9c1)", display: "grid", placeItems: "center", fontSize: 34 }}>🌸</div>
        <div className="mp-cw-name" style={{ fontSize: 16, marginTop: 2 }}>櫻色誓約</div>
        <div style={{ fontSize: 11, color: "var(--mp-txt-l)", fontWeight: 700 }}>測試版</div>
      </button>}
      <button className="mp-cw" type="button" onClick={() => setPage("loginReward")} style={{ width: "100%", border: "1px solid rgba(231,197,214,.6)", background: "rgba(255,255,255,.72)", textAlign: "center", padding: 14, flexDirection: "column", alignItems: "center", gap: 10, borderRadius: 22 }}>
        <div className="mp-av" style={{ width: 72, height: 72, borderRadius: 20, overflow: "hidden", flex: "0 0 auto", background: "linear-gradient(145deg,#fff0c9,#f5bfd2)", display: "grid", placeItems: "center", fontSize: 34 }}>🎁</div>
        <div className="mp-cw-name" style={{ fontSize: 16, marginTop: 2 }}>{tr("登入獎勵", "Login rewards", "ログイン報酬", "로그인 보상")}</div>
        <div style={{ fontSize: 11, color: "var(--mp-txt-l)", fontWeight: 700 }}>{tr("每日領取", "Claim daily", "毎日受け取る", "매일 받기")}</div>
      </button>
    </div>
  </div>;
}
