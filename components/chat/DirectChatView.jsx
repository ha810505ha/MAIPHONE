import React from "react";
import ChatHeader from "./ChatHeader";
import ChatSettingsPanel from "./settings/ChatSettingsPanel";
import DirectMessageList from "./DirectMessageList";
import DirectChatComposer from "./DirectChatComposer";
import ChatMessageRenderer from "./ChatMessageRenderer";

export default function DirectChatView({
  onPageClick,
  header,
  settingsOpen,
  settings,
  messageList,
  messageRenderer,
  composer,
  blockBanner,
  overlay,
  tr,
}) {
  return (
    <div className="mp-page" onClick={onPageClick}>
      <ChatHeader {...header} tr={tr} />
      {settingsOpen ? (
        <ChatSettingsPanel {...settings} tr={tr} />
      ) : (
        <>
          {(blockBanner?.playerBlocksCharacter || blockBanner?.characterBlocksPlayer) && <div className={`mp-chat-block-banner ${blockBanner.mode === "reality" ? "is-reality" : ""}`}>
            <div><b>{blockBanner.playerBlocksCharacter && blockBanner.characterBlocksPlayer ? tr("你們已互相封鎖", "You blocked each other", "相互にブロック中", "서로 차단함") : blockBanner.characterBlocksPlayer ? tr(`${blockBanner.character?.name} 已封鎖你`, `${blockBanner.character?.name} blocked you`, "相手にブロックされています", "상대가 나를 차단함") : tr(`已封鎖 ${blockBanner.character?.name}`, `Blocked ${blockBanner.character?.name}`, "ブロック中", "차단됨")}</b><span>{blockBanner.mode === "reality" ? tr("線上封鎖不影響現實互動", "Online blocking does not affect reality interaction", "オンラインのブロックは現実の交流に影響しません", "온라인 차단은 현실 상호작용에 영향을 주지 않습니다") : blockBanner.characterBlocksPlayer ? tr("你傳出的訊息會顯示失敗，但角色仍能看見", "Your messages show as failed, but the character can still see them", "送信失敗と表示されますが、相手には見えます", "전송 실패로 표시되지만 상대는 볼 수 있습니다") : tr("角色訊息仍會顯示，但無法確認送達或已讀", "Messages remain visible but cannot confirm delivery or read status", "メッセージは表示されますが、配信・既読は確認できません", "메시지는 보이지만 전송·읽음 확인은 되지 않습니다")}</span></div>
            {blockBanner.playerBlocksCharacter && <button type="button" onClick={blockBanner.onUnblock}>{tr("解除", "Unblock", "解除", "차단 해제")}</button>}
          </div>}
          <DirectMessageList {...messageList} tr={tr}>
            <ChatMessageRenderer {...messageRenderer} tr={tr} />
          </DirectMessageList>
          <DirectChatComposer {...composer} tr={tr} />
        </>
      )}
      {overlay}
    </div>
  );
}
