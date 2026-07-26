import React from "react";

export default function ChatScreenshotSettings({ onOpen, tr }) {
  return <div className="mp-cc"><div style={{fontSize:13,fontWeight:700}}>{tr("聊天截圖", "Chat screenshot", "チャット画像", "채팅 캡처")}</div><div style={{fontSize:11,color:"var(--mp-txt-l)",lineHeight:1.7,margin:"6px 0 9px"}}>{tr("選取最多 15 則訊息，保留聊天室中的氣泡、圖片與轉帳卡樣式。", "Select up to 15 messages while preserving bubbles, images, and transfer cards.", "最大15件を選び、吹き出し・画像・送金カードの見た目を保ちます。", "최대 15개 메시지를 선택하고 말풍선, 이미지, 송금 카드 모양을 유지합니다.")}</div><button type="button" className="mp-save" onClick={onOpen}>{tr("製作聊天截圖", "Create chat screenshot", "チャット画像を作成", "채팅 캡처 만들기")}</button></div>;
}
