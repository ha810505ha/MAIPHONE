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
  tr,
}) {
  return (
    <div className="mp-page" onClick={onPageClick}>
      <ChatHeader {...header} tr={tr} />
      {settingsOpen ? (
        <ChatSettingsPanel {...settings} tr={tr} />
      ) : (
        <>
          <DirectMessageList {...messageList} tr={tr}>
            <ChatMessageRenderer {...messageRenderer} tr={tr} />
          </DirectMessageList>
          <DirectChatComposer {...composer} tr={tr} />
        </>
      )}
    </div>
  );
}
