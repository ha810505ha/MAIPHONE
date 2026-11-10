import React from "react";
import ChatHeader from "./ChatHeader";
import ChatListView from "./ChatListView";
import GroupChatContent from "./GroupChatContent";

export default function ChatView({ currentGroup, currentCharacter, group, list, directView, tr }) {
  if (currentGroup) {
    return (
      <div className="mp-page" onClick={group.onPageClick} style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
        <ChatHeader {...group.header} tr={tr} />
        <div className="mp-cm" style={{ paddingTop: 8, paddingLeft: 0, paddingRight: 0, paddingBottom: 0, display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
          <div style={{ margin: "0 14px 8px", fontSize: 11, color: "var(--mp-txt-l)", lineHeight: 1.5, textAlign: "center" }}>
            {tr("群組成員：", "Group members: ", "グループメンバー: ", "그룹 멤버: ")}
            {group.members.length ? group.members.map((member) => member.name).join("、") : tr("暫無成員", "No members yet", "まだメンバーがいません", "아직 멤버가 없습니다")}
          </div>
          {group.sceneBar}
          <GroupChatContent {...group.content} tr={tr} />
        </div>
      </div>
    );
  }
  if (currentCharacter) return directView;
  return <ChatListView {...list} tr={tr} />;
}
