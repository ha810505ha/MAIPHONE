import React, { useEffect, useMemo, useState } from "react";
import { sanitizeUserImageUrl } from "../../utils/coreUtils";
import { messagePreviewText } from "../../utils/pseudoImage";
import { useGacha } from "../../contexts/GachaContext";
import EpisodeRoom from "../gacha/EpisodeRoom";
import PlayerPersonaIndicator from "./PlayerPersonaIndicator";
import { LargeTitle, LargeTitleHeader, useLargeTitle } from "../shell/LargeTitle";
import SegmentedControl from "../common/SegmentedControl";
import { AvatarFallback } from "../common/Avatar";
import Icon from "../common/Icon";

const PAGE_SIZE = 10;

function formatMessageTime(time) {
  return time ? new Date(time).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" }) : "";
}

function ListPager({ page, pageCount, onChange, tr }) {
  if (pageCount <= 1) return null;
  const buttonStyle = {
    width: 34,
    height: 34,
    borderRadius: "50%",
    border: "1px solid var(--mp-line)",
    background: "var(--mp-surface)",
    color: "var(--mp-txt)",
    fontSize: 22,
    lineHeight: 1,
  };
  return (
    <div style={{ position: "sticky", bottom: 0, zIndex: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: "13px 0 7px", background: "linear-gradient(180deg, transparent, var(--mp-bg) 35%)" }}>
      <button type="button" aria-label={tr("上一頁", "Previous page", "前のページ", "이전 페이지")} disabled={page === 0} onClick={() => onChange(page - 1)} style={{ ...buttonStyle, opacity: page === 0 ? 0.35 : 1, cursor: page === 0 ? "default" : "pointer" }}>‹</button>
      <span style={{ minWidth: 58, textAlign: "center", color: "var(--mp-txt-l)", fontSize: 13, fontWeight: 800 }}>{page + 1} / {pageCount}</span>
      <button type="button" aria-label={tr("下一頁", "Next page", "次のページ", "다음 페이지")} disabled={page >= pageCount - 1} onClick={() => onChange(page + 1)} style={{ ...buttonStyle, opacity: page >= pageCount - 1 ? 0.35 : 1, cursor: page >= pageCount - 1 ? "default" : "pointer" }}>›</button>
    </div>
  );
}

function EpisodeLibrary({ episodes, characters, onOpen }) {
  const [characterId, setCharacterId] = useState(null);
  const [page, setPage] = useState(0);
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
  const pageCount = Math.max(1, Math.ceil(characterGroups.length / PAGE_SIZE));
  useEffect(() => setPage((current) => Math.min(current, pageCount - 1)), [pageCount]);
  const visibleCharacterGroups = characterGroups.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const selected = characterGroups.find((group) => String(group.characterId) === String(characterId));
  if (!selected) return <div className="sg-episode-library"><style>{`.sg-episode-library{padding:8px 12px 30px}.sg-library-intro{padding:8px 5px 12px;color:var(--mp-txt-l);font-size:11px}.sg-library-row{width:100%;display:flex;align-items:center;gap:12px;border:0;border-bottom:1px solid var(--mp-line);background:transparent;color:var(--mp-txt);padding:14px 8px;text-align:left}.sg-library-avatar{width:54px;height:54px;flex:0 0 54px;border-radius:50%;display:grid;place-items:center;overflow:hidden;background:var(--mp-surface);border:2px solid color-mix(in srgb,var(--mp-pink) 45%,#fff);font-size:20px}.sg-library-avatar img{width:100%;height:100%;object-fit:cover}.sg-library-body{min-width:0;flex:1}.sg-library-name{font-size:15px;font-weight:900}.sg-library-meta{margin-top:4px;color:var(--mp-txt-l);font-size:11px}.sg-library-progress{flex:0 0 auto;color:var(--mp-pink-dk);font-size:11px;font-weight:800}.sg-library-arrow{color:var(--mp-txt-l)}`}</style><div className="sg-library-intro">只顯示曾經建立過特別篇的角色</div>{visibleCharacterGroups.map((group) => { const character = characters.find((item) => String(item.id) === String(group.characterId)); const avatar = sanitizeUserImageUrl(character?.avatar || group.characterAvatar); const completedCount = group.episodes.filter((episode) => episode.status !== "active").length; return <button key={group.characterId} className="sg-library-row" onClick={() => setCharacterId(group.characterId)}><div className="sg-library-avatar">{avatar ? <img src={avatar} alt="" /> : (group.characterName?.[0] || "🌸")}</div><div className="sg-library-body"><div className="sg-library-name">{character?.name || group.characterName}</div><div className="sg-library-meta">共 {group.episodes.length} 篇{completedCount ? ` · ${completedCount} 篇回憶` : ""}{group.active ? " · 進行中" : " · 目前無進行中劇情"}</div></div>{group.active && <span className="sg-library-progress">{group.active.playerMessageCount}/20</span>}<span className="sg-library-arrow">›</span></button>; })}<ListPager page={page} pageCount={pageCount} onChange={setPage} /></div>;
  const activeEpisodes = selected.episodes.filter((episode) => episode.status === "active").sort((a, b) => b.updatedAt - a.updatedAt);
  const pastEpisodes = selected.episodes.filter((episode) => episode.status !== "active").sort((a, b) => (b.completedAt || b.updatedAt) - (a.completedAt || a.updatedAt));
  const renderEpisode = (episode) => <button key={episode.id} className="sg-chapter-row" onClick={() => onOpen(episode.id)}><div className="sg-chapter-icon">{episode.item.icon}</div><div className="sg-chapter-body"><b>{episode.item.name}</b><small>{episode.mode === "reality" ? "現實劇情" : "線上劇情"} · {episode.status === "active" ? `${episode.playerMessageCount}/20` : episode.endedEarly ? "已提前結束" : "已完成"}{episode.specialMemoryId ? " · ✦ 已凝結記憶" : ""}</small></div><span>›</span></button>;
  return <div className="sg-chapter-list"><style>{`.sg-chapter-list{padding:5px 12px 30px}.sg-chapter-back{display:flex;align-items:center;gap:8px;width:100%;border:0;background:transparent;color:var(--mp-txt);padding:9px 4px 13px;font-size:15px;font-weight:900;text-align:left}.sg-chapter-section{margin:8px 4px;color:var(--mp-txt-l);font-size:10px;font-weight:800;letter-spacing:.12em}.sg-chapter-row{width:100%;display:flex;align-items:center;gap:11px;border:0;border-bottom:1px solid var(--mp-line);background:transparent;color:var(--mp-txt);padding:12px 7px;text-align:left}.sg-chapter-icon{width:48px;height:48px;flex:0 0 48px;border-radius:15px;display:grid;place-items:center;background:linear-gradient(145deg,var(--mp-pink-lt),var(--mp-surface));font-size:24px}.sg-chapter-body{min-width:0;flex:1}.sg-chapter-body b{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sg-chapter-body small{display:block;margin-top:4px;color:var(--mp-txt-l)}`}</style><button className="sg-chapter-back" onClick={() => setCharacterId(null)}>← {selected.characterName}的特別篇</button>{activeEpisodes.length > 0 && <><div className="sg-chapter-section">進行中</div>{activeEpisodes.map(renderEpisode)}</>}{pastEpisodes.length > 0 && <><div className="sg-chapter-section">過往篇章</div>{pastEpisodes.map(renderEpisode)}</>}</div>;
}

export default function ChatListView({
  tab,
  setTab,
  characters,
  chatHistory,
  groups,
  proactiveUnread,
  characterBlockStates,
  closeApp,
  openCreateGroup,
  onOpenCharacters,
  onOpenCharacter,
  onOpenGroup,
  getGroupMembers,
  apiConfig,
  playerProfile,
  persona,
  t,
  tr,
}) {
  const { episodes, selectedEpisodeId, setSelectedEpisodeId } = useGacha();
  const [friendPage, setFriendPage] = useState(0);
  const [groupPage, setGroupPage] = useState(0);
  const friendPageCount = Math.max(1, Math.ceil(characters.length / PAGE_SIZE));
  const groupPageCount = Math.max(1, Math.ceil(groups.length / PAGE_SIZE));
  useEffect(() => setFriendPage((current) => Math.min(current, friendPageCount - 1)), [friendPageCount]);
  useEffect(() => setGroupPage((current) => Math.min(current, groupPageCount - 1)), [groupPageCount]);
  const visibleCharacters = characters.slice(friendPage * PAGE_SIZE, (friendPage + 1) * PAGE_SIZE);
  const visibleGroups = groups.slice(groupPage * PAGE_SIZE, (groupPage + 1) * PAGE_SIZE);
  const playerName = String(playerProfile?.name || "").trim() || tr("玩家", "Player", "プレイヤー", "플레이어");
  const imagePreview = (message, fallbackSender) => {
    const sender = message?.role === "user"
      ? playerName
      : (String(message?.speakerName || "").trim() || fallbackSender);
    return tr(
      `${sender}傳送了圖片`,
      `${sender} sent an image`,
      `${sender}が画像を送信しました`,
      `${sender}님이 이미지를 보냈습니다`,
    );
  };
  const largeTitle = useLargeTitle();
  const renderFriendRow = (character) => {
    const messages = chatHistory[character.id] || [];
    const lastMessage = messages[messages.length - 1];
    const pinned = !!character.pinned || !!character.chatPinned;
    const unreadCount = Number(proactiveUnread?.[character.id]) || 0;
    const unread = unreadCount > 0;
    const playerBlocksCharacter = characterBlockStates?.[character.id]?.playerBlocksCharacter === true || characterBlockStates?.[character.id]?.blocked === true;
    const characterBlocksPlayer = characterBlockStates?.[character.id]?.characterBlocksPlayer === true;
    const blockLabel = playerBlocksCharacter && characterBlocksPlayer ? tr("互相封鎖", "Mutual block", "相互ブロック", "서로 차단") : characterBlocksPlayer ? tr("對方封鎖你", "Blocked you", "相手がブロック", "상대가 차단") : playerBlocksCharacter ? tr("已封鎖", "Blocked", "ブロック中", "차단됨") : "";
    const lastMessageIntercepted = lastMessage?.interceptedByBlock === true || lastMessage?.interceptedByCharacterBlock === true;
    const avatar = sanitizeUserImageUrl(character.avatar);
    const preview = messagePreviewText(lastMessage, {
      imageText: imagePreview(lastMessage, character.name),
      voiceText: tr("[語音訊息]", "[Voice message]", "[ボイスメッセージ]", "[음성 메시지]"),
      fallback: t("noMessagesShort"),
    });
    return (
      <button key={character.id} className={`mp-chat-row ${pinned ? "pinned" : ""}`} onClick={() => onOpenCharacter(character, unread)}>
        <div className="mp-chat-row-avatar">{avatar ? <img src={avatar} alt="" /> : <AvatarFallback name={character.name} />}</div>
        <div className="mp-chat-row-body">
          <div className="mp-chat-row-top">
            <div className="mp-chat-row-name">
              {pinned && <span className="mp-chat-row-pin">♥</span>}
              <span>{character.name}</span>
              {blockLabel && <span className="mp-chat-row-blocked">{blockLabel}</span>}
            </div>
            <div className="mp-chat-row-time">{formatMessageTime(lastMessage?.time)}</div>
          </div>
          <div className="mp-chat-row-bottom">
            <div className="mp-chat-row-preview" style={unread ? { fontWeight: 700, color: "var(--mp-txt)" } : undefined}>{preview}{lastMessageIntercepted && <span className="mp-chat-row-intercepted" title={tr("訊息已攔截", "Message intercepted", "メッセージを遮断", "메시지 차단됨")}>!</span>}</div>
            {unread && <span className="mp-chat-row-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
          </div>
        </div>
      </button>
    );
  };
  const pinnedFriends = visibleCharacters.filter((character) => !!character.pinned || !!character.chatPinned);
  const otherFriends = visibleCharacters.filter((character) => !character.pinned && !character.chatPinned);
  const friendSections = [
    { key: "pinned", label: pinnedFriends.length && otherFriends.length ? tr("置頂", "Pinned", "ピン留め", "고정됨") : "", items: pinnedFriends },
    { key: "recent", label: pinnedFriends.length && otherFriends.length ? tr("最近", "Recent", "最近", "최근") : "", items: otherFriends },
  ].filter((section) => section.items.length);
  const selectedEpisode = episodes.find((episode) => episode.id === selectedEpisodeId);
  if (selectedEpisode) return <EpisodeRoom episode={selectedEpisode} character={characters.find((character) => String(character.id) === String(selectedEpisode.characterId))} playerProfile={playerProfile} apiConfig={apiConfig} recentMessages={chatHistory[selectedEpisode.characterId] || []} onBack={() => setSelectedEpisodeId(null)} tr={tr} />;
  return (
    <div className={largeTitle.pageClassName}>
      <LargeTitleHeader
        title={t("chat")}
        onBack={closeApp}
        backLabel={tr("返回首頁", "Back to Home", "ホームに戻る", "홈으로 돌아가기")}
        right={<PlayerPersonaIndicator playerProfile={playerProfile} persona={persona} tr={tr} compact />}
      />
      <div className="mp-cm" onScroll={largeTitle.onScroll}>
        <LargeTitle title={t("chat")} />
        <SegmentedControl
          items={[
            { id: "friends", label: tr("好友", "Friends", "フレンド", "친구") },
            { id: "groups", label: tr("群組", "Groups", "グループ", "그룹") },
            { id: "episodes", label: tr("特別篇", "Specials", "特別編", "특별편") },
          ]}
          value={tab}
          onChange={setTab}
          ariaLabel={t("chat")}
        />

        {tab === "friends" ? (
          characters.length === 0 ? (
            <div className="mp-empty-state">
              <div className="mp-empty-art" aria-hidden="true"><span><i /><i /><i /></span><span /></div>
              <div className="mp-empty-state-title">{tr("還沒有好友聊天", "No friend chats yet", "まだフレンドとのチャットはありません", "아직 친구 채팅이 없어요")}</div>
              <div className="mp-empty-state-text">{tr("先在「聯絡人」建立或匯入一位角色，就能開始和對方聊天。", "Create or import a character in Contacts to start chatting.", "「連絡先」でキャラクターを作成またはインポートすると、チャットを始められます。", "'연락처'에서 캐릭터를 만들거나 가져오면 대화를 시작할 수 있어요.")}</div>
              {onOpenCharacters && <button type="button" className="mp-empty-state-cta" onClick={onOpenCharacters}>{tr("前往聯絡人", "Open Contacts", "連絡先を開く", "연락처 열기")}</button>}
            </div>
          ) : (
            <div className="mp-chat-list mp-chat-list-line">
              {friendSections.map((section) => (
                <React.Fragment key={section.key}>
                  {section.label && <div className="mp-list-section">{section.label}</div>}
                  <div className="mp-chat-group">{section.items.map(renderFriendRow)}</div>
                </React.Fragment>
              ))}
              <ListPager page={friendPage} pageCount={friendPageCount} onChange={setFriendPage} tr={tr} />
            </div>
          )
        ) : tab === "groups" ? (
          <div className="mp-chat-list mp-chat-list-line" style={{ paddingBottom: 76 }}>
            {visibleGroups.length > 0 && <div className="mp-chat-group">{visibleGroups.map((group) => {
              const messages = group.messages || [];
              const lastMessage = messages[messages.length - 1];
              const members = getGroupMembers(group);
              const cover = sanitizeUserImageUrl(group.cover);
              const memberAvatar = sanitizeUserImageUrl(members[0]?.avatar);
              const preview = messagePreviewText(lastMessage, {
                imageText: imagePreview(lastMessage, group.name),
                voiceText: tr("[語音訊息]", "[Voice message]", "[ボイスメッセージ]", "[음성 메시지]"),
                fallback: `${members.length || characters.length} ${tr("位成員", "members", "人のメンバー", "명의 멤버")}`,
              });
              return (
                <button key={group.id} className={`mp-chat-row ${group.pinned ? "pinned" : ""}`} onClick={() => onOpenGroup(group)}>
                  <div className="mp-chat-row-avatar">
                    {cover ? <img src={cover} alt="" /> : (memberAvatar ? <img src={memberAvatar} alt="" /> : <AvatarFallback name={group.name} icon="users" />)}
                  </div>
                  <div className="mp-chat-row-body">
                    <div className="mp-chat-row-top">
                      <div className="mp-chat-row-name">
                        {group.pinned && <span className="mp-chat-row-pin">♥</span>}
                        <span>{group.name}</span>
                      </div>
                      <div className="mp-chat-row-time">{formatMessageTime(lastMessage?.time)}</div>
                    </div>
                    <div className="mp-chat-row-preview">{preview}</div>
                  </div>
                </button>
              );
            })}</div>}
            <ListPager page={groupPage} pageCount={groupPageCount} onChange={setGroupPage} tr={tr} />
          </div>
        ) : episodes.length ? <EpisodeLibrary episodes={episodes} characters={characters} onOpen={setSelectedEpisodeId} /> : <div className="mp-empty mp-chat-empty"><div className="mp-empty-icon" aria-hidden="true"><Icon name="flower" size={34} /></div><div className="mp-empty-t">{tr("尚未建立特別篇", "No specials yet", "特別編はまだありません", "아직 특별편이 없어요")}</div></div>}
      </div>
      {tab === "groups" && (
        <button
          type="button"
          onClick={openCreateGroup}
          title={tr("新增群組", "Add group", "グループを追加", "그룹 추가")}
          aria-label={tr("新增群組", "Add group", "グループを追加", "그룹 추가")}
          style={{ position: "absolute", right: 18, bottom: 20, zIndex: 4, width: 50, height: 50, display: "grid", placeItems: "center", border: "1px solid color-mix(in srgb,var(--mp-pink) 42%,transparent)", borderRadius: "50%", background: "var(--mp-primary-gradient)", color: "#fff", boxShadow: "0 8px 22px color-mix(in srgb,var(--mp-pink) 38%,transparent)", fontSize: 25, lineHeight: 1, cursor: "pointer" }}
        >
          ＋
        </button>
      )}
    </div>
  );
}
