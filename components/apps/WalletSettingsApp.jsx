import React from "react";

export default function WalletSettingsApp({ tr, onBack, onClear }) {
  return <div className="mp-page"><div className="mp-hdr"><div className="mp-back" onClick={onBack}>←</div><div className="mp-htitle">{tr("錢包設定", "Wallet settings", "ウォレット設定", "지갑 설정")}</div></div><div className="mp-cm"><div className="mp-cc">
    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{tr("錢包管理", "Wallet management", "ウォレット管理", "지갑 관리")}</div>
    <div style={{ fontSize: 11, color: "var(--mp-txt-l)", lineHeight: 1.8, marginBottom: 8 }}>{tr("這個頁面只會管理錢包相關內容，不會影響當前角色聊天室或其他全域資料。", "This page only manages wallet-related content and won't affect the current character chatroom or other global data.", "このページはウォレット関連のみを管理し、現在のキャラのチャットルームや他の全体データには影響しません。", "이 페이지는 지갑 관련 내용만 관리하며 현재 캐릭터 채팅방이나 다른 전역 데이터에는 영향을 주지 않습니다.")}</div>
    <button type="button" className="mp-save" style={{ background: "linear-gradient(135deg,#ef9a9a,#e53935)" }} onClick={onClear}>{tr("清除資料", "Clear data", "データを消去", "지갑 데이터 지우기")}</button>
  </div></div></div>;
}
