import React from "react";
import GachaGame from "../gacha/GachaGame";
import LoginRewardApp from "./LoginRewardApp";
import { AppHeader, LargeTitle, LargeTitleHeader, SUB_PAGE_CLASS, useLargeTitle } from "../shell/LargeTitle";
import { GACHA_ENABLED } from "../../config/featureFlags";

export default function GameCenter({ page, setPage, closeApp, t, tr, characters, onOpenChat }) {
  const largeTitle = useLargeTitle();
  const backGames = tr("返回遊戲中心", "Back to Game Center", "ゲームセンターに戻る", "게임 센터로 돌아가기");
  if (page === "gacha" && GACHA_ENABLED) return <GachaGame characters={characters} onBack={() => setPage("hub")} onOpenChat={onOpenChat} />;
  if (page === "loginReward") return <LoginRewardApp onBack={() => setPage("hub")} tr={tr} />;
  if (page === "football") return <div className="mp-page" style={{ background: "#071b16" }}>
    <AppHeader title={tr("世足Kick", "World Cup Kick", "ワールドカップKick", "월드컵 Kick")} onBack={() => setPage("hub")} backLabel={backGames} />
    <iframe title={tr("世界盃射門小遊戲", "World Cup shooting mini-game", "ワールドカップシュートミニゲーム", "월드컵 슈팅 미니게임")} src="./game.html" style={{ flex: 1, width: "100%", border: 0, background: "#071b16" }} />
  </div>;
  return <div className={`${largeTitle.pageClassName} game-center-page`} onScroll={largeTitle.onScroll} style={{ overflowY: "auto" }}>
    <LargeTitleHeader title={t("gameCenter")} onBack={closeApp} backLabel={tr("返回首頁", "Back to Home", "ホームに戻る", "홈으로 돌아가기")} />
    <LargeTitle title={t("gameCenter")} />
    <style>{`.game-center-icon{width:72px;height:72px;border-radius:20px;overflow:hidden;flex:0 0 auto;display:grid;place-items:center;font-size:34px;line-height:1}.game-center-sub{font-size:var(--mp-fs-caption);color:var(--mp-txt-l);font-weight:700;min-height:15px}`}</style>
    <div style={{ padding: "0 16px 16px", display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
      <button className="mp-cw" onClick={() => setPage("football")} style={{ width: "100%", border: "1px solid var(--mp-line)", background: "var(--mp-surface)", textAlign: "center", padding: 14, flexDirection: "column", alignItems: "center", gap: 10, borderRadius: 22 }}>
        <div className="game-center-icon"><img src="./app-icons/game-football.webp?v=20260802" alt={tr("世足射門", "World Cup shooting", "ワールドカップシュート", "월드컵 슈팅")} style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>
        <div className="mp-cw-name" style={{ fontSize: 16, marginTop: 2 }}>{tr("世足Kick", "World Cup Kick", "ワールドカップKick", "월드컵 Kick")}</div>
        <div className="game-center-sub">{tr("小遊戲", "Mini-game", "ミニゲーム", "미니게임")}</div>
      </button>
      {GACHA_ENABLED && <button className="mp-cw" type="button" onClick={() => setPage("gacha")} style={{ width: "100%", border: "1px solid var(--mp-line)", background: "var(--mp-surface)", textAlign: "center", padding: 14, flexDirection: "column", alignItems: "center", gap: 10, borderRadius: 22 }}>
        <div className="game-center-icon" style={{ background: "linear-gradient(145deg,#ffd6e3,#f5a9c1)" }}>🌸</div>
        <div className="mp-cw-name" style={{ fontSize: 16, marginTop: 2 }}>{tr("櫻色誓約", "Sakura Vow", "桜色の誓い", "벚꽃빛 서약")}</div>
        <div className="game-center-sub">{tr("測試版", "Beta", "ベータ版", "베타")}</div>
      </button>}
      <button className="mp-cw" type="button" onClick={() => setPage("loginReward")} style={{ width: "100%", border: "1px solid var(--mp-line)", background: "var(--mp-surface)", textAlign: "center", padding: 14, flexDirection: "column", alignItems: "center", gap: 10, borderRadius: 22 }}>
        <div className="game-center-icon" style={{ background: "linear-gradient(145deg,#fff0c9,#f5bfd2)" }}>🎁</div>
        <div className="mp-cw-name" style={{ fontSize: 16, marginTop: 2 }}>{tr("登入獎勵", "Login rewards", "ログイン報酬", "로그인 보상")}</div>
        <div className="game-center-sub">{tr("每日領取", "Claim daily", "毎日受け取る", "매일 받기")}</div>
      </button>
    </div>
  </div>;
}
