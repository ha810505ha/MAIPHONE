import React from "react";

export default function SocialApp({
  socialSettingsOpen, setSocialSettingsOpen, socialSettings, setSocialSettings, posts, setPosts,
  closeApp, t, tr, characters, setPlayerPostModalOpen, handleRandomSocialPost, socialFeedRef,
  setPendingPostScrollId, getPostAuthorName, getPostAuthorAvatar, getPostAuthorType, formatPostTime,
  sanitizeUserImageUrl, getLikedByListText, activeCommentPostId, setActiveCommentPostId,
  socialReplyTarget, setSocialReplyTarget, activeLikePostId, setActiveLikePostId,
  expandedSocialPosts, setExpandedSocialPosts, shouldClampSocialPost, shouldScrollComments,
  highlightedPostId, activePostMenuId, setActivePostMenuId, showToast, sharePostToChat,
  formatSocialCount, getPostLikeCount, getCommentDepth, getCommentAuthorName,
  postCommentInputs, setPostCommentInputs, addPostComment,
}) {
  return (
    socialSettingsOpen ? (
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
        </div>
      </div>
    ) : (
    <div className="mp-page">
      <div className="mp-hdr">
        <div className="mp-back" onClick={closeApp}>←</div>
            <div className="mp-htitle">{t("social")}</div>
        <div className="mp-social-head-actions">
          <button className="mp-pill-btn mp-pill-btn-ghost" onClick={() => setPlayerPostModalOpen(true)}>{tr("發文", "Post", "投稿", "게시")}</button>
          {characters.length > 0 && (
            <button className="mp-pill-btn" onClick={handleRandomSocialPost}>{t("refresh")}</button>
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
        ) : posts.map((p) => {
          const authorName = getPostAuthorName(p);
          const authorAvatar = sanitizeUserImageUrl(getPostAuthorAvatar(p));
          const isPlayerPost = getPostAuthorType(p) === "player";
          const likeListText = isPlayerPost ? getLikedByListText(p) : "";
          const comments = p.comments || [];
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
                {activePostMenuId === p.id && (
                  <div className="mp-post-menu">
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
                    const canReply = c.role === "assistant" && depth < 2 && c.charId;
                    const targetForThis = canReply ? {
                      postId: p.id,
                      commentId: c.id,
                      charId: c.charId,
                      authorName: author,
                      content: c.content,
                      depth,
                    } : null;
                    const isReplyOpen = replyTarget?.commentId === c.id;
                    const replyInputKey = `${p.id}:${c.id}`;
                    return (
                    <div key={c.id} className={`mp-comment ${depth > 1 ? "reply" : ""} ${canReply ? "clickable" : ""}`}>
                      <div
                        onClick={() => {
                          if (!targetForThis) return;
                          setSocialReplyTarget((prev) => prev?.postId === p.id && prev?.commentId === c.id ? null : targetForThis);
                        }}
                      >
                        <span>{author}：</span>
                        {c.replyToName && <em>{tr(`回覆 ${c.replyToName} `, `Replying to ${c.replyToName} `, `${c.replyToName} に返信 `, `${c.replyToName}에게 답글 `)}</em>}
                        {c.content}
                      </div>
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
      </div>
    </div>
    )
  );
}
