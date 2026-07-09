import React from "react";
import { sanitizeUserImageUrl } from "../../utils/coreUtils";

function formatMessageTime(time) {
  return time ? new Date(time).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" }) : "";
}

export default function ChatListView({
  tab,
  setTab,
  characters,
  chatHistory,
  groups,
  proactiveUnread,
  closeApp,
  openCreateGroup,
  onOpenCharacter,
  onOpenGroup,
  getGroupMembers,
  t,
  tr,
}) {
  return (
    <div className="mp-page">
      <div className="mp-hdr">
        <div className="mp-back" onClick={closeApp}>←</div>
        <div className="mp-htitle">{t("chat")}</div>
        {tab === "groups" && (
          <button
            type="button"
            className="mp-ibtn"
            style={{ marginLeft: "auto", padding: "4px 10px", background: "linear-gradient(135deg,#f9e6ee,#fff6fb)" }}
            onClick={openCreateGroup}
            title="Add group"
          >
            ＋
          </button>
        )}
      </div>
      <div className="mp-cm" style={{ paddingTop: 2 }}>
        <div className="mp-chat-switch">
          <button className={`mp-chat-switch-btn ${tab === "friends" ? "active" : ""}`} onClick={() => setTab("friends")}>
            <span>{tr("好友", "Friends", "フレンド", "친구")}</span>
          </button>
          <button className={`mp-chat-switch-btn ${tab === "groups" ? "active" : ""}`} onClick={() => setTab("groups")}>
            <span>{t("chatroom")}</span>
          </button>
        </div>

        {tab === "friends" ? (
          characters.length === 0 ? (
            <div className="mp-empty mp-chat-empty">
              <div className="mp-empty-i">💬</div>
              <div className="mp-empty-t">No friend chats yet</div>
            </div>
          ) : (
            <div className="mp-chat-list mp-chat-list-line">
              {characters.map((character) => {
                const messages = chatHistory[character.id] || [];
                const lastMessage = messages[messages.length - 1];
                const pinned = !!character.pinned || !!character.chatPinned;
                const unreadCount = Number(proactiveUnread?.[character.id]) || 0;
                const unread = unreadCount > 0;
                const avatar = sanitizeUserImageUrl(character.avatar);
                return (
                  <button key={character.id} className={`mp-chat-row ${pinned ? "pinned" : ""}`} onClick={() => onOpenCharacter(character, unread)}>
                    <div className="mp-chat-row-avatar">{avatar ? <img src={avatar} alt="" /> : (character.name?.[0] || "🙂")}</div>
                    <div className="mp-chat-row-body">
                      <div className="mp-chat-row-top">
                        <div className="mp-chat-row-name">
                          {pinned && <span className="mp-chat-row-pin">♥</span>}
                          <span>{character.name}</span>
                        </div>
                        <div className="mp-chat-row-time">{formatMessageTime(lastMessage?.time)}</div>
                      </div>
                      <div className="mp-chat-row-bottom">
                        <div className="mp-chat-row-preview" style={unread ? { fontWeight: 700, color: "var(--mp-txt)" } : undefined}>{lastMessage?.content || t("noMessagesShort")}</div>
                        {unread && <span className="mp-chat-row-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )
        ) : (
          <div className="mp-chat-list mp-chat-list-line">
            {groups.map((group) => {
              const messages = group.messages || [];
              const lastMessage = messages[messages.length - 1];
              const members = getGroupMembers(group);
              const cover = sanitizeUserImageUrl(group.cover);
              const memberAvatar = sanitizeUserImageUrl(members[0]?.avatar);
              return (
                <button key={group.id} className={`mp-chat-row ${group.pinned ? "pinned" : ""}`} onClick={() => onOpenGroup(group)}>
                  <div className="mp-chat-row-avatar">
                    {cover ? <img src={cover} alt="" /> : (memberAvatar ? <img src={memberAvatar} alt="" /> : "👥")}
                  </div>
                  <div className="mp-chat-row-body">
                    <div className="mp-chat-row-top">
                      <div className="mp-chat-row-name">
                        {group.pinned && <span className="mp-chat-row-pin">♥</span>}
                        <span>{group.name}</span>
                      </div>
                      <div className="mp-chat-row-time">{formatMessageTime(lastMessage?.time)}</div>
                    </div>
                    <div className="mp-chat-row-preview">{lastMessage?.content || `${members.length || characters.length} ${tr("位成員", "members", "人のメンバー", "명의 멤버")}`}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
