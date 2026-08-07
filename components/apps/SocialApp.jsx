import React, { useEffect, useMemo, useState } from "react";
import MotionPresence from "../motion/MotionPresence.jsx";

const SOCIAL_PAGE_SIZE = 5;
const SOCIAL_NOTIFICATION_GROUP_WINDOW_MS = 5 * 60 * 1000;
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;",
}[char]));
const getVisibleComments = (post, now = Date.now()) => (
  (post?.comments || []).filter((comment) => !comment?.time || comment.time <= now)
);
const groupSocialActivities = (activities) => {
  const groups = [];
  (activities || []).slice(0, 80).forEach((activity) => {
    if (activity.kind === "post") {
      groups.push({
        ...activity,
        events: [activity],
        actorNames: [activity.actorName].filter(Boolean),
      });
      return;
    }
    const existing = groups.find((group) => (
      group.kind !== "post"
      && group.postId === activity.postId
      && group.time - activity.time <= SOCIAL_NOTIFICATION_GROUP_WINDOW_MS
    ));
    if (!existing) {
      groups.push({
        ...activity,
        events: [activity],
        actorNames: [activity.actorName].filter(Boolean),
      });
      return;
    }
    existing.events.push(activity);
    existing.isUnread = existing.isUnread || activity.isUnread;
    if (activity.actorName && !existing.actorNames.includes(activity.actorName)) {
      existing.actorNames.push(activity.actorName);
    }
  });
  return groups;
};

export default function SocialApp({
  socialSettingsOpen, setSocialSettingsOpen, socialSettings, setSocialSettings, posts, setPosts,
  closeApp, t, tr, characters, setPlayerPostModalOpen, handleRandomSocialPost, socialFeedRef,
  setPendingPostScrollId, getPostAuthorName, getPostAuthorAvatar, getPostAuthorType, formatPostTime,
  sanitizeUserImageUrl, getLikedByListText, activeCommentPostId, setActiveCommentPostId,
  socialReplyTarget, setSocialReplyTarget, activeLikePostId, setActiveLikePostId,
  expandedSocialPosts, setExpandedSocialPosts, shouldClampSocialPost, shouldScrollComments,
  highlightedPostId, activePostMenuId, setActivePostMenuId, showToast, sharePostToChat,
  formatSocialCount, getPostLikeCount, getCommentDepth, getCommentAuthorName,
  postCommentInputs, setPostCommentInputs, addPostComment, editPlayerComment, deletePlayerComment,
  socialActivities = [], socialUnreadCount = 0, markSocialReadThrough,
  postLimit = 100, downloadTextFile, exportToastMessage,
}) {
  const [characterSearch, setCharacterSearch] = useState("");
  const [characterPostingOpen, setCharacterPostingOpen] = useState(true);
  const [characterPostRefreshing, setCharacterPostRefreshing] = useState(false);
  const [feedPage, setFeedPage] = useState(1);
  const [socialNotificationsOpen, setSocialNotificationsOpen] = useState(false);
  const [highlightedNotificationCommentId, setHighlightedNotificationCommentId] = useState(null);
  const [activePlayerCommentMenu, setActivePlayerCommentMenu] = useState(null);
  const [editingPlayerComment, setEditingPlayerComment] = useState(null);
  const totalFeedPages = Math.max(1, Math.ceil(posts.length / SOCIAL_PAGE_SIZE));
  const visiblePosts = posts.slice((feedPage - 1) * SOCIAL_PAGE_SIZE, feedPage * SOCIAL_PAGE_SIZE);
  const groupedSocialActivities = useMemo(
    () => groupSocialActivities(socialActivities),
    [socialActivities],
  );
  const interactionChanceOptions = [25, 50, 75, 100];
  const savedInteractionChance = Number(socialSettings?.characterInteractionChance);
  const interactionChance = interactionChanceOptions.includes(savedInteractionChance)
    ? savedInteractionChance
    : 50;
  useEffect(() => setFeedPage((page) => Math.min(page, totalFeedPages)), [totalFeedPages]);
  useEffect(() => setFeedPage(1), [posts[0]?.id]);
  useEffect(() => {
    if (
      !highlightedNotificationCommentId
      || socialNotificationsOpen
      || socialSettingsOpen
    ) return undefined;
    const scrollTimer = setTimeout(() => {
      const container = socialFeedRef.current;
      const target = container
        ? Array.from(container.querySelectorAll("[data-comment-id]")).find(
          (node) => node.dataset.commentId === String(highlightedNotificationCommentId),
        )
        : null;
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 180);
    const clearTimer = setTimeout(() => setHighlightedNotificationCommentId(null), 2000);
    return () => {
      clearTimeout(scrollTimer);
      clearTimeout(clearTimer);
    };
  }, [
    activeCommentPostId,
    feedPage,
    highlightedNotificationCommentId,
    socialFeedRef,
    socialNotificationsOpen,
    socialSettingsOpen,
  ]);

  const goToFeedPage = (page) => {
    setFeedPage(Math.max(1, Math.min(totalFeedPages, page)));
    requestAnimationFrame(() => {
      if (socialFeedRef.current) socialFeedRef.current.scrollTop = 0;
    });
  };

  const refreshCharacterPost = async () => {
    if (characterPostRefreshing) return;
    setCharacterPostRefreshing(true);
    try {
      await handleRandomSocialPost();
    } finally {
      setCharacterPostRefreshing(false);
    }
  };

  const getSocialActivityTitle = (activity) => {
    const eventCount = activity.events?.length || 1;
    const names = activity.actorNames || [activity.actorName].filter(Boolean);
    if (eventCount > 1) {
      if (names.length === 1) {
        return tr(
          `${names[0]} 在 ${activity.postAuthorName} 的貼文留下了 ${eventCount} 則回覆`,
          `${names[0]} left ${eventCount} replies on ${activity.postAuthorName}'s post`,
          `${names[0]}が${activity.postAuthorName}の投稿に${eventCount}件返信しました`,
          `${names[0]}님이 ${activity.postAuthorName}님의 게시물에 답글 ${eventCount}개를 남겼습니다`,
        );
      }
      const shownNames = names.slice(0, 2).join("、");
      const actorLabel = names.length > 2
        ? tr(`${shownNames} 等 ${names.length} 位角色`, `${shownNames} and ${names.length - 2} others`, `${shownNames}ほか${names.length - 2}人`, `${shownNames} 외 ${names.length - 2}명`)
        : shownNames;
      return tr(
        `${actorLabel}回覆了 ${activity.postAuthorName} 的貼文`,
        `${actorLabel} replied to ${activity.postAuthorName}'s post`,
        `${actorLabel}が${activity.postAuthorName}の投稿に返信しました`,
        `${actorLabel}님이 ${activity.postAuthorName}님의 게시물에 답글을 남겼습니다`,
      );
    }
    if (activity.kind === "post") {
      return tr(
        `${activity.actorName} 發布了新貼文`,
        `${activity.actorName} published a new post`,
        `${activity.actorName}が新しい投稿を公開しました`,
        `${activity.actorName}님이 새 게시물을 올렸습니다`,
      );
    }
    if (activity.kind === "self-comment") {
      return tr(
        `${activity.actorName} 補充了自己的貼文`,
        `${activity.actorName} added to their post`,
        `${activity.actorName}が自分の投稿に追記しました`,
        `${activity.actorName}님이 자신의 게시물에 내용을 덧붙였습니다`,
      );
    }
    if (activity.targetKind === "comment") {
      return tr(
        `${activity.actorName} 回覆了 ${activity.targetName} 的留言`,
        `${activity.actorName} replied to ${activity.targetName}'s comment`,
        `${activity.actorName}が${activity.targetName}のコメントに返信しました`,
        `${activity.actorName}님이 ${activity.targetName}님의 댓글에 답글을 남겼습니다`,
      );
    }
    return tr(
      `${activity.actorName} 回覆了 ${activity.postAuthorName} 的貼文`,
      `${activity.actorName} replied to ${activity.postAuthorName}'s post`,
      `${activity.actorName}が${activity.postAuthorName}の投稿に返信しました`,
      `${activity.actorName}님이 ${activity.postAuthorName}님의 게시물에 답글을 남겼습니다`,
    );
  };

  const openSocialActivity = (activity) => {
    const targetIndex = posts.findIndex((post) => post.id === activity.postId);
    if (targetIndex < 0) return;
    markSocialReadThrough?.(activity.time);
    setFeedPage(Math.floor(targetIndex / SOCIAL_PAGE_SIZE) + 1);
    setActiveCommentPostId(activity.commentId ? activity.postId : null);
    setSocialReplyTarget(null);
    setHighlightedNotificationCommentId(activity.commentId || null);
    setPendingPostScrollId(activity.postId);
    setSocialNotificationsOpen(false);
  };

  const exportSocialArchive = async (bookmarkedOnly = false) => {
    if (typeof downloadTextFile !== "function") return;
    const exportedPosts = bookmarkedOnly ? posts.filter((post) => post.bookmarked) : posts;
    if (!exportedPosts.length) {
      showToast(bookmarkedOnly ? "目前沒有珍藏貼文" : "目前沒有可匯出的貼文");
      return;
    }
    const avatarAssets = {};
    const avatarIdByData = new Map();
    const registerAvatar = (value) => {
      const data = String(value || "");
      if (!data.startsWith("data:image/")) return null;
      if (avatarIdByData.has(data)) return avatarIdByData.get(data);
      const id = `avatar_${avatarIdByData.size + 1}`;
      avatarIdByData.set(data, id);
      avatarAssets[id] = data;
      return id;
    };
    const compactAvatarFields = (record, fallbackAvatar = "") => {
      if (!record || typeof record !== "object") return record;
      const avatarAssetId = registerAvatar(record.authorAvatar || record.charAvatar || fallbackAvatar);
      const compacted = { ...record };
      delete compacted.authorAvatar;
      delete compacted.charAvatar;
      return avatarAssetId ? { ...compacted, avatarAssetId } : compacted;
    };
    const archivePosts = exportedPosts.map((post) => {
      const authorAvatar = getPostAuthorAvatar(post);
      const compactedPost = compactAvatarFields(post, authorAvatar);
      return {
        ...compactedPost,
        comments: getVisibleComments(post).map((comment) => compactAvatarFields(comment)),
        ...(Array.isArray(post.likedBy) ? { likedBy: post.likedBy.map((reaction) => compactAvatarFields(reaction)) } : {}),
      };
    });
    const cards = exportedPosts.map((post) => {
      const authorName = getPostAuthorName(post);
      const visibleComments = getVisibleComments(post);
      const comments = visibleComments.map((comment) => {
        const commentAuthor = getCommentAuthorName(comment, post.charName || authorName);
        const commentContent = comment.deleted
          ? tr("此留言已刪除", "This comment was deleted", "このコメントは削除されました", "삭제된 댓글입니다")
          : comment.content;
        return `<li><b>${escapeHtml(commentAuthor)}</b><span>${escapeHtml(new Date(comment.time || post.time || Date.now()).toLocaleString("zh-TW"))}</span><p>${escapeHtml(commentContent)}</p></li>`;
      }).join("");
      return `<article>
        <header><div><b>${escapeHtml(authorName)}</b>${post.bookmarked ? "<em>珍藏</em>" : ""}</div><time>${escapeHtml(new Date(post.time || Date.now()).toLocaleString("zh-TW"))}</time></header>
        <div class="content">${escapeHtml(post.content)}</div>
        <div class="meta">❤️ ${escapeHtml(getPostLikeCount(post))}　💬 ${visibleComments.length}</div>
        ${comments ? `<details><summary>查看留言</summary><ol>${comments}</ol></details>` : ""}
      </article>`;
    }).join("\n");
    const sourceJson = JSON.stringify({
      format: "maliphone-social-archive",
      version: 1,
      exportedAt: Date.now(),
      bookmarkedOnly,
      avatarAssets,
      posts: archivePosts,
    }).replace(/</g, "\\u003c");
    const html = `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MaliPhone 社群紀錄</title><style>
      :root{color-scheme:light}*{box-sizing:border-box}body{margin:0;background:#fff1f6;color:#5f3948;font-family:system-ui,-apple-system,"Noto Sans TC",sans-serif}main{width:min(760px,100%);margin:auto;padding:28px 16px 60px}h1{margin:0;font-size:24px}header.top{margin-bottom:20px}.sub{color:#a56d82;font-size:13px;margin-top:6px}article{background:#fff;border:1px solid #f0cbd8;border-radius:18px;padding:16px;margin:12px 0;box-shadow:0 7px 20px #b45b7b18}article header{display:flex;justify-content:space-between;gap:12px}article header div{display:flex;align-items:center;gap:8px}time,li span{color:#ad7c8f;font-size:12px}em{font-style:normal;background:#ef6998;color:#fff;border-radius:99px;padding:2px 7px;font-size:10px}.content{white-space:pre-wrap;line-height:1.75;margin:13px 0}.meta{font-size:12px;color:#a56d82}details{margin-top:12px;border-top:1px solid #f3d9e2;padding-top:9px}summary{cursor:pointer;font-weight:700}ol{padding-left:22px}li{margin:10px 0}li b{margin-right:8px}li p{white-space:pre-wrap;margin:4px 0;line-height:1.55}@media print{body{background:#fff}article{break-inside:avoid;box-shadow:none}}
    </style></head><body><main><header class="top"><h1>💞 MaliPhone 社群紀錄</h1><div class="sub">匯出時間：${escapeHtml(new Date().toLocaleString("zh-TW"))} · 共 ${exportedPosts.length} 則貼文${bookmarkedOnly ? " · 僅珍藏" : ""}</div></header>${cards}</main><script id="maliphone-social-data" type="application/json">${sourceJson}</script></body></html>`;
    try {
      const date = new Date().toISOString().slice(0, 10);
      const result = await downloadTextFile(html, `maliphone-social-${bookmarkedOnly ? "saved-" : ""}${date}.html`, "text/html;charset=utf-8");
      const message = exportToastMessage?.(result, tr);
      if (message) showToast(message);
    } catch (error) {
      showToast(`匯出失敗：${error?.message || "未知錯誤"}`);
    }
  };

  return (
    socialNotificationsOpen ? (
      <div className="mp-page">
        <div className="mp-hdr">
          <div className="mp-back" onClick={() => setSocialNotificationsOpen(false)}>←</div>
          <div className="mp-htitle">{tr("通知", "Notifications", "通知", "알림")}</div>
          {socialUnreadCount > 0 && (
            <button
              type="button"
              className="mp-social-notification-read-all"
              onClick={() => markSocialReadThrough?.(socialActivities[0]?.time)}
            >
              {tr("全部已讀", "Mark all read", "すべて既読", "모두 읽음")}
            </button>
          )}
        </div>
        <div className="mp-social-notification-list">
          {groupedSocialActivities.length === 0 ? (
            <div className="mp-empty">
              <div className="mp-empty-i">🔔</div>
              <div className="mp-empty-t">
                {tr("目前沒有社群通知", "No social notifications yet", "通知はまだありません", "아직 소셜 알림이 없습니다")}
              </div>
            </div>
          ) : groupedSocialActivities.map((activity) => {
            const avatar = sanitizeUserImageUrl(activity.avatar);
            const eventCount = activity.events?.length || 1;
            return (
              <button
                type="button"
                key={activity.id}
                className={`mp-social-notification-item ${activity.isUnread ? "unread" : ""}`}
                onClick={() => openSocialActivity(activity)}
              >
                <span className="mp-social-notification-avatar">
                  {avatar
                    ? <img src={avatar} alt="" />
                    : (activity.actorName?.slice(0, 1) || "💬")}
                </span>
                <span className="mp-social-notification-content">
                  <strong>{getSocialActivityTitle(activity)}</strong>
                  <span className="mp-social-notification-preview">{activity.body}</span>
                  <small>{formatPostTime(activity.time)}</small>
                </span>
                {eventCount > 1 && (
                  <span className="mp-social-notification-group-count">{eventCount}</span>
                )}
                {activity.isUnread && <span className="mp-social-notification-unread-dot" />}
              </button>
            );
          })}
        </div>
      </div>
    ) : socialSettingsOpen ? (
      <div className="mp-page">
        <div className="mp-hdr">
          <div className="mp-back" onClick={() => setSocialSettingsOpen(false)}>←</div>
          <div className="mp-htitle">{t("settings")}</div>
        </div>
        <div className="mp-set">
          <div className="mp-sg">
            <div className="mp-sg-t">{tr("動態", "Feed", "フィード", "피드")}</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{tr("自動貼文", "Auto posts", "自動投稿", "자동 게시")}</div>
                <div style={{ fontSize: 10, color: "var(--mp-txt-l)", marginTop: 3, lineHeight: 1.5 }}>
                  {tr("開啟後，角色會不定時自己發佈新貼文。", "When on, characters will occasionally publish new posts on their own.", "オンにすると、キャラが時々自分から新しい投稿をします。", "켜면 캐릭터가 가끔 스스로 새 게시물을 올립니다.")}
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={!!socialSettings?.autoPost}
                className={`mp-switch ${socialSettings?.autoPost ? "active" : ""}`}
                onClick={() => setSocialSettings((prev) => ({ ...(prev || {}), autoPost: !prev?.autoPost }))}
              >
                <span />
              </button>
            </div>
          </div>
          <div className="mp-sg">
            <div className="mp-sg-t">{tr("角色互動", "Character interactions", "キャラ交流", "캐릭터 상호작용")}</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{tr("角色之間可以互動", "Characters can interact", "キャラ同士の交流を許可", "캐릭터끼리 상호작용")}</div>
                <div style={{ fontSize: 10, color: "var(--mp-txt-l)", marginTop: 3, lineHeight: 1.5 }}>
                  {tr(
                    "開啟後，角色可能留言其他角色的貼文；玩家貼文維持原本的回覆方式。",
                    "When on, characters may comment on other character posts. Player posts keep their current reply behavior.",
                    "オンにすると、キャラが他のキャラの投稿にコメントすることがあります。プレイヤー投稿の返信方法は変わりません。",
                    "켜면 캐릭터가 다른 캐릭터 게시물에 댓글을 달 수 있습니다. 플레이어 게시물의 답글 방식은 그대로 유지됩니다.",
                  )}
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={!!socialSettings?.characterInteractionsEnabled}
                className={`mp-switch ${socialSettings?.characterInteractionsEnabled ? "active" : ""}`}
                onClick={() => setSocialSettings((prev) => ({
                  ...(prev || {}),
                  characterInteractionsEnabled: !prev?.characterInteractionsEnabled,
                }))}
              >
                <span />
              </button>
            </div>
            {socialSettings?.characterInteractionsEnabled && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700 }}>{tr("每篇貼文的互動機率", "Interaction chance per post", "投稿ごとの交流確率", "게시물당 상호작용 확률")}</div>
                <select
                  className="mp-input"
                  value={interactionChance}
                  onChange={(event) => setSocialSettings((prev) => ({
                    ...(prev || {}),
                    characterInteractionChance: Number(event.target.value),
                  }))}
                  style={{ marginTop: 6 }}
                >
                  {interactionChanceOptions.map((chance) => (
                    <option key={chance} value={chance}>{chance}%</option>
                  ))}
                </select>
                <div style={{ fontSize: 9.5, color: "var(--mp-txt-l)", marginTop: 6, lineHeight: 1.55 }}>
                  {tr(
                    "觸發時會依貼文與人設挑選角色，通常 1～2 位、最多 5 位。留言會延遲 30 秒至 5 分鐘顯示。",
                    "When triggered, characters are chosen from the post and their personas—usually 1–2, up to 5. Comments appear after 30 seconds to 5 minutes.",
                    "発生時は投稿と設定からキャラを選び、通常1～2人、最大5人が参加します。コメントは30秒～5分後に表示されます。",
                    "발생 시 게시물과 캐릭터 설정에 따라 보통 1~2명, 최대 5명이 참여합니다. 댓글은 30초~5분 뒤 표시됩니다.",
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="mp-sg">
            <div className="mp-sg-t" onClick={() => setCharacterPostingOpen((open) => !open)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}><span>{tr("角色發文設定", "Character posting", "キャラ投稿設定", "캐릭터 게시 설정")}</span><span style={{ fontSize: 11, color: "var(--mp-pink-dk)", fontWeight: 700 }}>{characterPostingOpen ? tr("收合", "Collapse", "折りたたむ", "접기") : tr("展開", "Expand", "展開", "펼치기")}</span></div>
            {characterPostingOpen && <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: "var(--mp-txt-l)" }}>{tr("允許哪些角色自動發文", "Choose which characters may post automatically", "自動投稿するキャラを選択", "자동 게시 캐릭터 선택")}</span>
              <button type="button" className="mp-ibtn" onClick={() => setSocialSettings((prev) => {
                const current = Array.isArray(prev?.enabledCharacterIds) ? prev.enabledCharacterIds : characters.map((c) => c.id);
                const allSelected = characters.length > 0 && current.length === characters.length && characters.every((c) => current.includes(c.id));
                return { ...(prev || {}), enabledCharacterIds: allSelected ? [] : characters.map((c) => c.id) };
              })}>{(() => { const ids = Array.isArray(socialSettings?.enabledCharacterIds) ? socialSettings.enabledCharacterIds : characters.map((c) => c.id); const all = characters.length > 0 && ids.length === characters.length && characters.every((c) => ids.includes(c.id)); return all ? tr("全不選", "None", "なし", "없음") : tr("全選", "All", "全選", "전체"); })()}</button>
            </div>
            <input className="mp-input" value={characterSearch} onChange={(e) => setCharacterSearch(e.target.value)} placeholder={tr("搜尋角色名稱", "Search characters", "キャラを検索", "캐릭터 검색")} style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 10, color: "var(--mp-txt-l)", marginBottom: 6 }}>{tr(`已選 ${Array.isArray(socialSettings?.enabledCharacterIds) ? socialSettings.enabledCharacterIds.length : characters.length} 位`, `${Array.isArray(socialSettings?.enabledCharacterIds) ? socialSettings.enabledCharacterIds.length : characters.length} selected`, `${Array.isArray(socialSettings?.enabledCharacterIds) ? socialSettings.enabledCharacterIds.length : characters.length}人選択`, `${Array.isArray(socialSettings?.enabledCharacterIds) ? socialSettings.enabledCharacterIds.length : characters.length}명 선택`)}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8, maxHeight: 390, overflowY: "auto", overscrollBehavior: "contain", padding: "2px 2px 8px" }}>
              {characters.filter((char) => !characterSearch.trim() || String(char.name || "").toLowerCase().includes(characterSearch.trim().toLowerCase())).map((char) => {
                const enabledIds = Array.isArray(socialSettings?.enabledCharacterIds) ? socialSettings.enabledCharacterIds : characters.map((c) => c.id);
                const checked = enabledIds.includes(char.id);
                const avatar = sanitizeUserImageUrl(char.avatar);
                return <div key={char.id} style={{ position: "relative", minWidth: 0 }}>
                  <button type="button" onClick={() => setSocialSettings((prev) => {
                    const current = Array.isArray(prev?.enabledCharacterIds) ? prev.enabledCharacterIds : characters.map((c) => c.id);
                    return { ...(prev || {}), enabledCharacterIds: checked ? current.filter((id) => id !== char.id) : [...new Set([...current, char.id])] };
                  })} style={{ width: "100%", aspectRatio: "1", borderRadius: 14, border: checked ? "2px solid var(--mp-pink-dk)" : "1px solid var(--mp-glass-b)", background: avatar ? `linear-gradient(180deg, transparent 55%, rgba(0,0,0,.62)), url(${avatar}) center/cover` : "var(--mp-glass)", color: avatar ? "#fff" : "var(--mp-txt)", fontWeight: 700, fontSize: 10, padding: 4, display: "flex", alignItems: "flex-end", justifyContent: "center", textAlign: "center", overflow: "hidden" }} title={char.name}>{avatar ? "" : char.name}</button>
                  <div style={{ fontSize: 11, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "center", marginTop: 4, lineHeight: 1.25 }}>{char.name}</div>
                  <select style={{ display: "none" }} defaultValue="normal">
                    <option value="occasional">偶爾</option><option value="normal">一般</option><option value="active">活躍</option>
                  </select>
                </div>;
              })}
            </div>
            <div style={{ marginTop: 12, fontSize: 11, fontWeight: 700 }}>{tr("預設發文頻率", "Default posting frequency", "投稿頻度", "기본 게시 빈도")}</div>
            <select
              className="mp-input"
              value={["occasional", "normal", "active"].includes(socialSettings?.frequency) ? socialSettings.frequency : "normal"}
              onChange={(event) => setSocialSettings((prev) => ({
                ...(prev || {}),
                frequency: event.target.value,
              }))}
              style={{ marginTop: 6 }}
            >
              <option value="occasional">{tr("偶爾：每天最多 1 篇", "Occasional: up to 1/day", "時々：1日最大1件", "가끔: 하루 최대 1개")}</option>
              <option value="normal">{tr("一般：每天最多 2～3 篇", "Normal: up to 2–3/day", "通常：1日最大2～3件", "일반: 하루 최대 2~3개")}</option>
              <option value="active">{tr("活躍：每天最多 4～5 篇", "Active: up to 4–5/day", "活発：1日最大4～5件", "활발: 하루 최대 4~5개")}</option>
            </select>
            </>}
          </div>
          <div className="mp-sg">
            <div className="mp-sg-t">{tr("珍藏的貼文", "Saved posts", "保存した投稿", "저장한 게시물")}</div>
            {(posts || []).filter((p) => p.bookmarked).length === 0 ? (
              <div style={{ fontSize: 11, color: "var(--mp-txt-l)", lineHeight: 1.6 }}>
                {tr("還沒有珍藏任何貼文。在貼文右上角的「⋯」選單即可珍藏。", "No saved posts yet. Use the ⋯ menu at the top right of a post to save it.", "まだ保存した投稿はありません。投稿右上の「⋯」メニューから保存できます。", "저장한 게시물이 없습니다. 게시물 오른쪽 위 ⋯ 메뉴에서 저장할 수 있어요.")}
              </div>
            ) : (
              (posts || []).filter((p) => p.bookmarked).map((p) => (
                <div
                  key={p.id}
                  style={{ padding: "8px 0", borderBottom: "1px solid rgba(128,128,128,.14)", cursor: "pointer" }}
                  onClick={() => {
                    const targetIndex = posts.findIndex((post) => post.id === p.id);
                    if (targetIndex >= 0) setFeedPage(Math.floor(targetIndex / SOCIAL_PAGE_SIZE) + 1);
                    setSocialSettingsOpen(false);
                    setPendingPostScrollId(p.id);
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{getPostAuthorName(p)}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      <span style={{ fontSize: 10, color: "var(--mp-txt-l)" }}>{formatPostTime(p.time)}</span>
                      <button
                        className="mp-ibtn"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!window.confirm(tr("確定要取消珍藏這則貼文嗎？", "Remove this post from saved?", "この投稿の保存を解除しますか？", "이 게시물의 저장을 해제할까요?"))) return;
                          setPosts((ps) => ps.map((x) => (x.id === p.id ? { ...x, bookmarked: false } : x)));
                          showToast(tr("已取消珍藏", "Removed from saved", "保存を解除しました", "저장을 해제했습니다"));
                        }}
                      >
                        {tr("取消珍藏", "Unsave", "保存解除", "저장 해제")}
                      </button>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, lineHeight: 1.5, marginTop: 4, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{p.content}</div>
                </div>
              ))
            )}
          </div>
          <div className="mp-sg">
            <div className="mp-sg-t">{tr("社群資料", "Social data", "ソーシャルデータ", "소셜 데이터")}</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800 }}>{tr(`已珍藏 ${posts.length} / ${postLimit} 則`, `${posts.length} / ${postLimit} posts saved`, `${posts.length} / ${postLimit}件保存`, `${posts.length} / ${postLimit}개 저장됨`)}</div>
                <div style={{ fontSize: 10, color: posts.length >= Math.floor(postLimit * .8) ? "#b45f3c" : "var(--mp-txt-l)", marginTop: 4, lineHeight: 1.55 }}>
                  {posts.length >= Math.floor(postLimit * .8)
                    ? tr("貼文即將達到上限，建議先匯出備份。珍藏貼文不會自動刪除。", "The limit is near. Export a copy first. Saved posts are never auto-deleted.", "上限が近づいています。先に書き出してください。保存済み投稿は自動削除されません。", "한도에 가까워졌습니다. 먼저 내보내세요. 저장한 게시물은 자동 삭제되지 않습니다.")
                    : tr("超過上限後會從最舊、未珍藏的貼文開始清除。", "Past the limit, the oldest unsaved posts are removed first.", "上限を超えると、古い未保存投稿から削除されます。", "한도를 넘으면 오래된 미저장 게시물부터 삭제됩니다.")}
                </div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
              <button type="button" className="mp-save" onClick={() => exportSocialArchive(false)}>{tr("匯出全部貼文", "Export all", "すべて書き出す", "전체 내보내기")}</button>
              <button type="button" className="mp-save" onClick={() => exportSocialArchive(true)}>{tr("匯出珍藏貼文", "Export saved", "保存済みを書き出す", "저장 게시물 내보내기")}</button>
            </div>
            <div style={{ fontSize: 9.5, color: "var(--mp-txt-l)", marginTop: 8, lineHeight: 1.5 }}>{tr("將匯出成可直接閱讀的單一 HTML 紀錄檔，內含完整貼文資料。", "Exports one readable HTML archive containing the complete post data.", "完全な投稿データを含む、閲覧可能な単一HTMLとして書き出します。", "전체 게시물 데이터가 포함된 읽기 가능한 단일 HTML로 내보냅니다.")}</div>
          </div>
        </div>
      </div>
    ) : (
    <div className="mp-page">
      <div className="mp-hdr">
        <div className="mp-back" onClick={closeApp}>←</div>
            <div className="mp-htitle">{t("social")}</div>
        <div className="mp-social-head-actions">
          <button
            type="button"
            className="mp-social-notification-bell"
            aria-label={tr("社群通知", "Social notifications", "ソーシャル通知", "소셜 알림")}
            onClick={() => setSocialNotificationsOpen(true)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
            </svg>
            {socialUnreadCount > 0 && (
              <span className="mp-social-notification-badge">
                {socialUnreadCount > 99 ? "99+" : socialUnreadCount}
              </span>
            )}
          </button>
          <button className="mp-pill-btn mp-pill-btn-ghost" onClick={() => setPlayerPostModalOpen(true)}>{tr("發文", "Post", "投稿", "게시")}</button>
          {characters.length > 0 && (
            <button
              className="mp-pill-btn"
              onClick={refreshCharacterPost}
              disabled={characterPostRefreshing}
              aria-busy={characterPostRefreshing}
            >
              {characterPostRefreshing
                ? tr("發文中…", "Posting…", "投稿中…", "게시 중…")
                : t("refresh")}
            </button>
          )}
          <button className="mp-pill-btn mp-pill-btn-ghost" onClick={() => setSocialSettingsOpen(true)}>{t("settings")}</button>
        </div>
      </div>
      <div className="mp-feed" ref={socialFeedRef}>
        {posts.length === 0 ? (
          <div className="mp-empty">
            <div className="mp-empty-i">📰</div>
            <div className="mp-empty-t">{tr("目前還沒有貼文", "No posts yet", "まだ投稿はありません", "아직 게시물이 없습니다")}<br/>{tr("發一則動態試試吧", "Try posting an update", "投稿してみましょう", "게시물을 올려보세요")}</div>
          </div>
        ) : <>
          {visiblePosts.map((p) => {
          const authorName = getPostAuthorName(p);
          const authorAvatar = sanitizeUserImageUrl(getPostAuthorAvatar(p));
          const isPlayerPost = getPostAuthorType(p) === "player";
          const likeListText = isPlayerPost ? getLikedByListText(p) : "";
          const comments = getVisibleComments(p);
          const commentsOpen = activeCommentPostId === p.id;
          const replyTarget = socialReplyTarget?.postId === p.id ? socialReplyTarget : null;
          const likesOpen = activeLikePostId === p.id;
          const postExpanded = !!expandedSocialPosts[p.id];
          const canExpandPost = shouldClampSocialPost(p.content);
          const scrollComments = shouldScrollComments(comments);
          return (
            <div key={p.id} data-post-id={p.id} className={`mp-post ${highlightedPostId === p.id ? "mp-thought-jump-highlight" : ""}`}>
              <div className="mp-post-hd">
                <div className={`mp-post-av ${isPlayerPost ? "player" : ""}`}>
                  {authorAvatar ? <img src={authorAvatar} alt="" /> : (isPlayerPost ? "👤" : "🦊")}
                </div>
                <div>
                  <div className="mp-post-au">{authorName}</div>
                  <div className="mp-post-tm">{formatPostTime(p.time)}{p.bookmarked ? " · 🔖" : ""}</div>
                </div>
                <button
                  type="button"
                  className="mp-post-menu-btn"
                  aria-label={tr("更多選項", "More options", "その他のオプション", "더 보기")}
                  onClick={() => setActivePostMenuId((id) => (id === p.id ? null : p.id))}
                >⋯</button>
                <MotionPresence show={activePostMenuId === p.id} exitMs={140}>
                {activePostMenuId === p.id && (
                  <div className="mp-post-menu mp-popover">
                    <button
                      className="mp-post-menu-item"
                      onClick={() => {
                        setPosts((ps) => ps.map((x) => (x.id === p.id ? { ...x, bookmarked: !x.bookmarked } : x)));
                        setActivePostMenuId(null);
                        showToast(p.bookmarked
                          ? tr("已取消珍藏", "Removed from saved", "保存を解除しました", "저장을 해제했습니다")
                          : tr("已珍藏貼文", "Post saved", "投稿を保存しました", "게시물을 저장했습니다"));
                      }}
                    >
                      {p.bookmarked ? tr("取消珍藏", "Unsave", "保存解除", "저장 해제") : tr("珍藏", "Save", "保存", "저장")}
                    </button>
                    <button
                      className="mp-post-menu-item danger"
                      onClick={() => {
                        if (!window.confirm(tr("確定要刪除這則貼文嗎？", "Delete this post?", "この投稿を削除しますか？", "이 게시물을 삭제할까요?"))) return;
                        setPosts((ps) => ps.filter((x) => x.id !== p.id));
                        setActivePostMenuId(null);
                        showToast(tr("貼文已刪除", "Post deleted", "投稿を削除しました", "게시물을 삭제했습니다"));
                      }}
                    >
                      {tr("刪除", "Delete", "削除", "삭제")}
                    </button>
                  </div>
                )}
                </MotionPresence>
              </div>
              <div className={`mp-post-ct ${canExpandPost && !postExpanded ? "clamped" : ""}`}>{p.content}</div>
              {canExpandPost && (
                <button
                  className="mp-post-more"
                  onClick={() => setExpandedSocialPosts((prev) => ({ ...prev, [p.id]: !prev[p.id] }))}
                >
                  {postExpanded ? tr("收合", "Collapse", "折りたたむ", "접기") : tr("顯示更多", "Show more", "もっと見る", "더 보기")}
                </button>
              )}
              <div className="mp-post-acts">
                <button
                  className={`mp-post-act ${p.liked ? "liked" : ""}`}
                  onClick={() => setPosts((ps) => ps.map((x) => (
                    x.id === p.id ? { ...x, liked: !x.liked, likes: x.liked ? x.likes - 1 : x.likes + 1 } : x
                  )))}
                >
                  {p.liked ? "❤️" : "🤍"}
                </button>
                <button className="mp-post-act mp-post-like-count" onClick={() => setActiveLikePostId((id) => id === p.id ? null : p.id)}>
                  {formatSocialCount(getPostLikeCount(p))}
                </button>
                <button className="mp-post-act" onClick={() => { setSocialReplyTarget(null); setActiveCommentPostId((id) => id === p.id ? null : p.id); }}>
                  {tr("留言", "Comments", "コメント", "댓글")} {comments.length}
                </button>
                {!isPlayerPost && <button className="mp-post-act" onClick={() => sharePostToChat(p)}>{tr("分享", "Share", "共有", "공유")}</button>}
              </div>
              {isPlayerPost && likesOpen && (
                <div className="mp-liked-by">{likeListText || tr("還沒有人按讚", "No likes yet", "まだいいねはありません", "아직 좋아요가 없습니다")}</div>
              )}
              {commentsOpen && (
                <div className={`mp-comments ${scrollComments ? "scroll" : ""}`}>
                  {comments.length === 0 && <div className="mp-comment empty">{tr("目前沒有留言", "No comments yet", "まだコメントはありません", "아직 댓글이 없습니다")}</div>}
                  {comments.map((c) => {
                    const depth = getCommentDepth(c);
                    const author = getCommentAuthorName(c, p.charName || authorName);
                    const canReply = c.role === "assistant" && c.charId;
                    const isPlayerOwned = c.role === "user"
                      && (c.charId === null || c.charId === undefined);
                    const canManage = isPlayerOwned && !c.deleted;
                    const targetForThis = canReply ? {
                      postId: p.id,
                      commentId: c.id,
                      charId: c.charId,
                      authorName: author,
                      content: c.content,
                      depth,
                    } : null;
                    const isReplyOpen = replyTarget?.commentId === c.id;
                    const isPlayerMenuOpen = activePlayerCommentMenu?.postId === p.id
                      && activePlayerCommentMenu?.commentId === c.id;
                    const isEditing = editingPlayerComment?.postId === p.id
                      && editingPlayerComment?.commentId === c.id;
                    const replyInputKey = `${p.id}:${c.id}`;
                    return (
                    <div
                      key={c.id}
                      data-comment-id={c.id}
                      className={`mp-comment ${depth > 1 ? "reply" : ""} ${canReply || canManage ? "clickable" : ""} ${c.deleted ? "deleted" : ""} ${highlightedNotificationCommentId === c.id ? "notification-highlight" : ""}`}
                    >
                      <div
                        className="mp-comment-body"
                        onClick={() => {
                          if (canManage) {
                            setSocialReplyTarget(null);
                            setActivePlayerCommentMenu((prev) => (
                              prev?.postId === p.id && prev?.commentId === c.id
                                ? null
                                : { postId: p.id, commentId: c.id }
                            ));
                            return;
                          }
                          if (targetForThis) {
                            setActivePlayerCommentMenu(null);
                            setSocialReplyTarget((prev) => prev?.postId === p.id && prev?.commentId === c.id ? null : targetForThis);
                          }
                        }}
                      >
                        <span>{author}：</span>
                        {!c.deleted && c.replyToName && <em>{tr(`回覆 ${c.replyToName} `, `Replying to ${c.replyToName} `, `${c.replyToName} に返信 `, `${c.replyToName}에게 답글 `)}</em>}
                        {c.deleted
                          ? <i className="mp-comment-deleted">{tr("此留言已刪除", "This comment was deleted", "このコメントは削除されました", "삭제된 댓글입니다")}</i>
                          : c.content}
                        {!c.deleted && c.editedAt && (
                          <small className="mp-comment-edited">
                            {tr("已編輯", "Edited", "編集済み", "수정됨")}
                          </small>
                        )}
                      </div>
                      {isPlayerMenuOpen && !isEditing && (
                        <div className="mp-comment-manage">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingPlayerComment({
                                postId: p.id,
                                commentId: c.id,
                                draft: c.content,
                              });
                              setActivePlayerCommentMenu(null);
                            }}
                          >
                            {tr("編輯", "Edit", "編集", "수정")}
                          </button>
                          <button
                            type="button"
                            className="danger"
                            onClick={() => {
                              if (!window.confirm(tr("確定要刪除這則留言嗎？", "Delete this comment?", "このコメントを削除しますか？", "이 댓글을 삭제할까요?"))) return;
                              deletePlayerComment(p.id, c.id);
                              setActivePlayerCommentMenu(null);
                              setEditingPlayerComment(null);
                            }}
                          >
                            {tr("刪除", "Delete", "削除", "삭제")}
                          </button>
                        </div>
                      )}
                      {isEditing && (
                        <div className="mp-comment-input mp-comment-inline-input">
                          <input
                            className="mp-sinp"
                            value={editingPlayerComment.draft}
                            maxLength={240}
                            onChange={(event) => setEditingPlayerComment((current) => ({
                              ...current,
                              draft: event.target.value,
                            }))}
                            onKeyDown={(event) => {
                              if (event.key !== "Enter") return;
                              event.preventDefault();
                              if (editPlayerComment(p.id, c.id, editingPlayerComment.draft)) {
                                setEditingPlayerComment(null);
                              }
                            }}
                            autoFocus
                          />
                          <button className="mp-ibtn" onClick={() => setEditingPlayerComment(null)}>{t("cancel")}</button>
                          <button
                            className="mp-ibtn"
                            onClick={() => {
                              if (editPlayerComment(p.id, c.id, editingPlayerComment.draft)) {
                                setEditingPlayerComment(null);
                              }
                            }}
                          >
                            {tr("儲存", "Save", "保存", "저장")}
                          </button>
                        </div>
                      )}
                      {isReplyOpen && (
                        <div className="mp-comment-input mp-comment-inline-input">
                          <input
                            className="mp-sinp"
                            placeholder={tr(`回覆 ${author}...`, `Reply to ${author}...`, `${author} に返信...`, `${author}에게 답글...`)}
                            value={postCommentInputs[replyInputKey] || ""}
                            maxLength={240}
                            onChange={(e) => setPostCommentInputs((prev) => ({ ...prev, [replyInputKey]: e.target.value }))}
                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPostComment(p.id, targetForThis); } }}
                            autoFocus
                          />
                          <button className="mp-ibtn" onClick={() => setSocialReplyTarget(null)}>{t("cancel")}</button>
                          <button className="mp-ibtn" onClick={() => addPostComment(p.id, targetForThis)}>{tr("送出", "Send", "送信", "보내기")}</button>
                        </div>
                      )}
                    </div>
                  );})}
                  <div className="mp-comment-input">
                    <input
                      className="mp-sinp"
                      placeholder={tr("寫下留言...", "Write a comment...", "コメントを書く...", "댓글을 입력...")}
                      value={postCommentInputs[p.id] || ""}
                      maxLength={240}
                      onChange={(e) => setPostCommentInputs((prev) => ({ ...prev, [p.id]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPostComment(p.id); } }}
                    />
                    <button className="mp-ibtn" onClick={() => addPostComment(p.id)}>{tr("送出", "Send", "送信", "보내기")}</button>
                  </div>
                </div>
              )}
            </div>
          );
          })}
          {totalFeedPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 14, padding: "8px 0 20px" }}>
              <button type="button" className="mp-ibtn" disabled={feedPage <= 1} onClick={() => goToFeedPage(feedPage - 1)}>‹</button>
              <span style={{ minWidth: 54, textAlign: "center", fontSize: 11, fontWeight: 800, color: "var(--mp-txt-l)" }}>{feedPage}/{totalFeedPages}</span>
              <button type="button" className="mp-ibtn" disabled={feedPage >= totalFeedPages} onClick={() => goToFeedPage(feedPage + 1)}>›</button>
            </div>
          )}
        </>}
      </div>
    </div>
    )
  );
}
