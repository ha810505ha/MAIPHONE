import React, { useMemo, useState } from "react";
import { sanitizeUserImageUrl } from "../../utils/coreUtils";
import { useGacha } from "../../contexts/GachaContext";
import EpisodeRoom from "../gacha/EpisodeRoom";

function formatMessageTime(time) {
  return time ? new Date(time).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" }) : "";
}

function EpisodeLibrary({ episodes, characters, onOpen }) {
  const [characterId, setCharacterId] = useState(null);
  const characterGroups = useMemo(() => {
    const grouped = new Map();
    episodes.forEach((episode) => {
      const key = String(episode.characterId);
      const current = grouped.get(key) || { characterId: episode.characterId, characterName: episode.characterName, characterAvatar: episode.characterAvatar, episodes: [], updatedAt: 0 };
      current.episodes.push(episode);
      current.updatedAt = Math.max(current.updatedAt, Number(episode.updatedAt || episode.createdAt || 0));
      grouped.set(key, current);
    });
    return [...grouped.values()].map((group) => {
      const character = characters.find((item) => String(item.id) === String(group.characterId));
      return { ...group, active: group.episodes.find((episode) => episode.status === "active"), displayPinned: !!character?.displayPinned, displayOrder: Number.isFinite(Number(character?.displayOrder)) ? Number(character.displayOrder) : Number.MAX_SAFE_INTEGER };
    }).sort((a, b) => Number(!!b.active) - Number(!!a.active) || Number(b.displayPinned) - Number(a.displayPinned) || a.displayOrder - b.displayOrder || b.updatedAt - a.updatedAt);
  }, [episodes]);
  const selected = characterGroups.find((group) => String(group.characterId) === String(characterId));
  if (!selected) return <div className="sg-episode-library"><style>{`.sg-episode-library{padding:8px 12px 30px}.sg-library-intro{padding:8px 5px 12px;color:var(--mp-txt-l);font-size:11px}.sg-library-row{width:100%;display:flex;align-items:center;gap:12px;border:0;border-bottom:1px solid var(--mp-line);background:transparent;color:var(--mp-txt);padding:14px 8px;text-align:left}.sg-library-avatar{width:54px;height:54px;flex:0 0 54px;border-radius:50%;display:grid;place-items:center;overflow:hidden;background:var(--mp-surface);border:2px solid color-mix(in srgb,var(--mp-pink) 45%,#fff);font-size:20px}.sg-library-avatar img{width:100%;height:100%;object-fit:cover}.sg-library-body{min-width:0;flex:1}.sg-library-name{font-size:15px;font-weight:900}.sg-library-meta{margin-top:4px;color:var(--mp-txt-l);font-size:11px}.sg-library-progress{flex:0 0 auto;color:var(--mp-pink-dk);font-size:11px;font-weight:800}.sg-library-arrow{color:var(--mp-txt-l)}`}</style><div className="sg-library-intro">只顯示曾經建立過特別篇的角色</div>{characterGroups.map((group) => { const character = characters.find((item) => String(item.id) === String(group.characterId)); const avatar = sanitizeUserImageUrl(character?.avatar || group.characterAvatar); const completedCount = group.episodes.filter((episode) => episode.status !== "active").length; return <button key={group.characterId} className="sg-library-row" onClick={() => setCharacterId(group.characterId)}><div className="sg-library-avatar">{avatar ? <img src={avatar} alt="" /> : (group.characterName?.[0] || "🌸")}</div><div className="sg-library-body"><div className="sg-library-name">{character?.name || group.characterName}</div><div className="sg-library-meta">共 {group.episodes.length} 篇{completedCount ? ` · ${completedCount} 篇回憶` : ""}{group.active ? " · 進行中" : " · 目前無進行中劇情"}</div></div>{group.active && <span className="sg-library-progress">{group.active.playerMessageCount}/20</span>}<span className="sg-library-arrow">›</span></button>; })}</div>;
  const activeEpisodes = selected.episodes.filter((episode) => episode.status === "active").sort((a, b) => b.updatedAt - a.updatedAt);
  const pastEpisodes = selected.episodes.filter((episode) => episode.status !== "active").sort((a, b) => (b.completedAt || b.updatedAt) - (a.completedAt || a.updatedAt));
  const renderEpisode = (episode) => <button key={episode.id} className="sg-chapter-row" onClick={() => onOpen(episode.id)}><div className="sg-chapter-icon">{episode.item.icon}</div><div className="sg-chapter-body"><b>{episode.item.name}</b><small>{episode.mode === "reality" ? "現實劇情" : "線上劇情"} · {episode.status === "active" ? `${episode.playerMessageCount}/20` : episode.endedEarly ? "已提前結束" : "已完成"}</small></div><span>›</span></button>;
  return <div className="sg-chapter-list"><style>{`.sg-chapter-list{padding:5px 12px 30px}.sg-chapter-back{display:flex;align-items:center;gap:8px;width:100%;border:0;background:transparent;color:var(--mp-txt);padding:9px 4px 13px;font-size:15px;font-weight:900;text-align:left}.sg-chapter-section{margin:8px 4px;color:var(--mp-txt-l);font-size:10px;font-weight:800;letter-spacing:.12em}.sg-chapter-row{width:100%;display:flex;align-items:center;gap:11px;border:0;border-bottom:1px solid var(--mp-line);background:transparent;color:var(--mp-txt);padding:12px 7px;text-align:left}.sg-chapter-icon{width:48px;height:48px;flex:0 0 48px;border-radius:15px;display:grid;place-items:center;background:linear-gradient(145deg,var(--mp-pink-lt),var(--mp-surface));font-size:24px}.sg-chapter-body{min-width:0;flex:1}.sg-chapter-body b{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sg-chapter-body small{display:block;margin-top:4px;color:var(--mp-txt-l)}`}</style><button className="sg-chapter-back" onClick={() => setCharacterId(null)}>← {selected.characterName}的特別篇</button>{activeEpisodes.length > 0 && <><div className="sg-chapter-section">進行中</div>{activeEpisodes.map(renderEpisode)}</>}{pastEpisodes.length > 0 && <><div className="sg-chapter-section">過往篇章</div>{pastEpisodes.map(renderEpisode)}</>}</div>;
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
  apiConfig,
  playerProfile,
  t,
  tr,
}) {
  const { episodes, selectedEpisodeId, setSelectedEpisodeId } = useGacha();
  const selectedEpisode = episodes.find((episode) => episode.id === selectedEpisodeId);
  if (selectedEpisode) return <EpisodeRoom episode={selectedEpisode} character={characters.find((character) => String(character.id) === String(selectedEpisode.characterId))} playerProfile={playerProfile} apiConfig={apiConfig} recentMessages={chatHistory[selectedEpisode.characterId] || []} onBack={() => setSelectedEpisodeId(null)} />;
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
            <span>{tr("群組", "Groups", "グループ", "그룹")}</span>
          </button>
          <button className={`mp-chat-switch-btn ${tab === "episodes" ? "active" : ""}`} onClick={() => setTab("episodes")}>
            <span>特別篇</span>
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
        ) : tab === "groups" ? (
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
        ) : episodes.length ? <EpisodeLibrary episodes={episodes} characters={characters} onOpen={setSelectedEpisodeId} /> : <div className="mp-empty mp-chat-empty"><div className="mp-empty-i">🌸</div><div className="mp-empty-t">尚未建立特別篇</div></div>}
      </div>
    </div>
  );
}
