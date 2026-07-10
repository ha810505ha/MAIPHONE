import React from "react";
import ChatModeSettings from "./ChatModeSettings";
import InnerThoughtSettings from "./InnerThoughtSettings";
import ProactiveMessageSettings from "./ProactiveMessageSettings";
import ChatRealTimeSettings from "./ChatRealTimeSettings";
import ChatBackgroundSettings from "./ChatBackgroundSettings";
import ChatLorebookSettings from "./ChatLorebookSettings";
import ChatroomManagement from "./ChatroomManagement";

export default function ChatSettingsPanel({ tr, mode, innerThought, proactive, realTime, background, lorebook, management }) {
  return (
    <div className="mp-cm" style={{ paddingTop: 8 }}>
      <div className="mp-cc" style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{tr("聊天室設定", "Chat settings", "チャット設定", "채팅 설정")}</div>
      </div>
      <ChatModeSettings {...mode} tr={tr} />
      <InnerThoughtSettings {...innerThought} tr={tr} />
      <ProactiveMessageSettings {...proactive} tr={tr} />
      <ChatRealTimeSettings {...realTime} tr={tr} />
      <ChatBackgroundSettings {...background} tr={tr} />
      <ChatLorebookSettings {...lorebook} tr={tr} />
      <ChatroomManagement {...management} tr={tr} />
    </div>
  );
}
