import { useEffect } from "react";
import { gid, sanitizeText } from "../../utils/coreUtils";
import { callAI } from "../../services/aiService";
import {
  CHARACTER_INTERACTION_REPLY_MAX_DELAY_MS,
  SOCIAL_COMMENT_INPUT_TOKEN_LIMIT,
  SOCIAL_COMMENT_OUTPUT_TOKEN_LIMIT,
  SOCIAL_POST_INPUT_TOKEN_LIMIT,
  SOCIAL_POST_OUTPUT_TOKEN_LIMIT,
  deletePlayerSocialComment,
  editPlayerSocialComment,
  fitSocialInputTokenLimit,
  getSocialAutoPostDailyLimit,
  rollCharacterInteractionDelay,
  selectCharacterInteractionParticipants,
  shouldStartCharacterInteraction,
  withSocialOutputTokenLimit,
} from "../../services/social/characterInteraction";

export default function useSocialFeed({
  apiConfig,
  characters,
  posts,
  setPosts,
  chatHistory,
  setChatHistory,
  memories,
  activeCharId,
  hydrated,
  socialSettings,
  playerProfile,
  playerPostText,
  setPlayerPostText,
  playerPostSubmitting,
  setPlayerPostSubmitting,
  setPlayerPostModalOpen,
  postCommentInputs,
  setPostCommentInputs,
  setSocialReplyTarget,
  socialLastGlobalPostAtRef,
  socialLastPostByCharRef,
  socialAutoPostingRef,
  socialAutoPostGapRef,
  SOCIAL_GLOBAL_COOLDOWN_MS,
  SOCIAL_CHAR_COOLDOWN_MS,
  PLAYER_SOCIAL_POST_LIMIT,
  SHARE_RAW_TOKEN_LIMIT,
  canUseCurrentProvider,
  showToast,
  tr,
  buildSocialSystemPrompt,
  buildSocialPostPrompt,
  rollCharacterPostLikes,
  getPlayerDisplayName,
  pickPlayerPostReactors,
  pickPlayerPostResponders,
  buildPlayerPostReplyPrompt,
  getCommentDepth,
  insertCommentAfterThread,
  buildSocialCommentReplyPrompt,
  getPostAuthorType,
  scoreCharacterForCharacterPost,
  getCharacterCommentReplyChance,
  buildCharacterPostInteractionPrompt,
  buildCharacterReplyToCommentPrompt,
}) {
  const socialPostApiConfig = withSocialOutputTokenLimit(
    apiConfig,
    SOCIAL_POST_OUTPUT_TOKEN_LIMIT,
  );
  const socialCommentApiConfig = withSocialOutputTokenLimit(
    apiConfig,
    SOCIAL_COMMENT_OUTPUT_TOKEN_LIMIT,
  );
  const callSocialAI = (messages, requestApiConfig, systemPrompt, inputTokenLimit, action = "generate") => {
    const request = fitSocialInputTokenLimit({
      messages,
      systemPrompt,
      maxInputTokens: inputTokenLimit,
    });
    return callAI(request.messages, requestApiConfig, request.systemPrompt, {
      app: "social",
      action,
    });
  };
  const buildCharacterInteractionSystemPrompt = (char, mode) => buildSocialSystemPrompt(char, {
    mode,
    includePlayerRelationship: false,
  });

  const generateCharacterPostInteractions = async (post, author) => {
    if (!socialSettings?.characterInteractionsEnabled || !post?.id || !author?.id) return;
    if (!canUseCurrentProvider()) return;
    if (!shouldStartCharacterInteraction(socialSettings?.characterInteractionChance)) return;

    const participants = selectCharacterInteractionParticipants({
      characters,
      authorId: author.id,
      recentPosts: posts,
      scoreCharacter: (char) => scoreCharacterForCharacterPost(char, post, author),
    });
    if (!participants.length) return;

    for (const char of participants) {
      const isSelfComment = String(char.id) === String(author.id);
      try {
        const ai = await callSocialAI([{
          role: "user",
          content: buildCharacterPostInteractionPrompt({
            char,
            post,
            author,
            isSelfComment,
          }),
        }], socialCommentApiConfig, buildCharacterInteractionSystemPrompt(char, "角色社群留言"), SOCIAL_COMMENT_INPUT_TOKEN_LIMIT, "character_post_interaction");
        const content = sanitizeText(String(ai || "").replace(/^["「]|["」]$/g, "").trim(), 120);
        if (!content) continue;
        const visibleAt = Math.max(Date.now(), Number(post.time) || 0)
          + rollCharacterInteractionDelay();
        const characterComment = {
          id: gid(),
          role: "assistant",
          charId: char.id,
          charName: char.name,
          content,
          depth: 1,
          time: visibleAt,
          interactionSource: "character-to-character",
          interactionKind: isSelfComment ? "self-comment" : "comment",
        };
        setPosts((prev) => prev.map((item) => (
          item.id === post.id
            ? { ...item, comments: insertCommentAfterThread(item.comments || [], null, characterComment) }
            : item
        )));

        if (isSelfComment || Math.random() >= getCharacterCommentReplyChance(author)) continue;
        try {
          const authorReply = await callSocialAI([{
            role: "user",
            content: buildCharacterReplyToCommentPrompt({
              char: author,
              post,
              targetComment: characterComment,
            }),
          }], socialCommentApiConfig, buildCharacterInteractionSystemPrompt(author, "貼文作者回覆"), SOCIAL_COMMENT_INPUT_TOKEN_LIMIT, "character_post_reply");
          const replyContent = sanitizeText(String(authorReply || "").replace(/^["「]|["」]$/g, "").trim(), 120);
          if (!replyContent) continue;
          const replyVisibleAt = Math.max(Date.now(), visibleAt) + rollCharacterInteractionDelay({
            maximum: CHARACTER_INTERACTION_REPLY_MAX_DELAY_MS,
          });
          const replyComment = {
            id: gid(),
            role: "assistant",
            charId: author.id,
            charName: author.name,
            content: replyContent,
            parentId: characterComment.id,
            replyToName: char.name,
            depth: 2,
            time: replyVisibleAt,
            interactionSource: "character-to-character",
            interactionKind: "author-reply",
          };
          setPosts((prev) => prev.map((item) => (
            item.id === post.id
              ? {
                  ...item,
                  comments: insertCommentAfterThread(
                    item.comments || [],
                    characterComment.id,
                    replyComment,
                  ),
                }
              : item
          )));
        } catch (_) {}
      } catch (_) {}
    }
  };

  const generatePost = async (char, generationSource = "manual") => {
    if (!canUseCurrentProvider()) { showToast(tr("請先完成 AI 連線設定（API Key）", "Please finish AI connection setup (API key) first", "先にAI接続設定（APIキー）を完了してください", "먼저 AI 연결 설정(API 키)을 완료해주세요")); return; }
    try {
      const sysP = buildSocialSystemPrompt(char, {
        mode: "社群貼文",
        includePlayerRelationship: false,
      });
      const t = await callSocialAI([{
        role: "user",
        content: buildSocialPostPrompt(char),
      }], socialPostApiConfig, sysP, SOCIAL_POST_INPUT_TOKEN_LIMIT, "character_post_generate");
        const content = sanitizeText(String(t || "").replace(/^["「]|["」]$/g, "").trim(), 120) || "今天也算是有好好過完了。";
        const post = {
          id: gid(),
          authorType: "character",
          authorName: char.name,
          charId: char.id,
          charName: char.name,
          content,
          comments: [],
          time: Date.now(),
          likes: rollCharacterPostLikes(char),
          liked: false,
          generationSource,
        };
        setPosts(p => [post, ...p]);
        showToast(tr(`${char.name} 已發佈貼文`, `${char.name} published a post`, `${char.name} が投稿しました`, `${char.name}님이 게시물을 올렸습니다`));
        void generateCharacterPostInteractions(post, char);
      } catch (err) {
        showToast(`${tr("發文失敗", "Failed to post", "投稿に失敗しました", "게시 실패")}：${err.message}`);
      }
    };
  const handleRandomSocialPost = () => {
    const nowTs = Date.now();
    const globalLeft = SOCIAL_GLOBAL_COOLDOWN_MS - (nowTs - (socialLastGlobalPostAtRef.current || 0));
    if (globalLeft > 0) {
      showToast(tr(`操作太快，請 ${Math.ceil(globalLeft / 1000)} 秒後再試`, `Too fast, try again in ${Math.ceil(globalLeft / 1000)}s`, `更新が早すぎます。${Math.ceil(globalLeft / 1000)}秒後にもう一度お試しください`, `너무 빨라요. ${Math.ceil(globalLeft / 1000)}초 후 다시 시도해주세요`));
      return;
    }
    const c = pickRandomSocialCharacter();
    if (!c) {
      showToast(tr(
        "目前沒有允許發文的角色",
        "No characters are currently allowed to post",
        "現在投稿できるキャラがいません",
        "현재 게시할 수 있는 캐릭터가 없습니다",
      ));
      return false;
    }
    const lastForChar = socialLastPostByCharRef.current?.[c.id] || 0;
    const charLeft = SOCIAL_CHAR_COOLDOWN_MS - (nowTs - lastForChar);
    if (charLeft > 0) {
      showToast(tr(`${c.name} 剛發過文，請 ${Math.ceil(charLeft / 1000)} 秒後再試`, `${c.name} just posted, try again in ${Math.ceil(charLeft / 1000)}s`, `${c.name} は投稿したばかりです。${Math.ceil(charLeft / 1000)}秒後にお試しください`, `${c.name}님이 방금 게시했어요. ${Math.ceil(charLeft / 1000)}초 후 다시 시도해주세요`));
      return;
    }
    socialLastGlobalPostAtRef.current = nowTs;
    socialLastPostByCharRef.current = { ...(socialLastPostByCharRef.current || {}), [c.id]: nowTs };
    showToast(tr(
      `${c.name} 正在準備貼文…`,
      `${c.name} is preparing a post…`,
      `${c.name} が投稿を準備しています…`,
      `${c.name}님이 게시물을 준비하고 있습니다…`,
    ));
    return generatePost(c, "manual");
  };
  const pickRandomSocialCharacter = () => {
    if (!Array.isArray(characters) || characters.length === 0) return null;
    const allowedIds = Array.isArray(socialSettings?.enabledCharacterIds)
      ? new Set(socialSettings.enabledCharacterIds) : new Set(characters.map((c) => c.id));
    const allowed = characters.filter((c) => allowedIds.has(c.id));
    if (!allowed.length) return null;
    if (allowed.length === 1) return allowed[0];
    const lastCharId = posts?.[0]?.charId || null;
    const pool = allowed.filter((c) => c.id !== lastCharId);
    const list = pool.length ? pool : allowed;
    return list[Math.floor(Math.random() * list.length)] || null;
  };
  const generatePlayerPostReplies = async (post, responders) => {
    if (!post?.id || !responders.length || !canUseCurrentProvider()) return;
    for (const char of responders) {
      try {
        const sysP = buildSocialSystemPrompt(char, {
          mode: "回覆玩家貼文",
          includePlayerRelationship: true,
        });
        const ai = await callSocialAI([{
          role: "user",
          content: buildPlayerPostReplyPrompt(char, post),
        }], socialCommentApiConfig, sysP, SOCIAL_COMMENT_INPUT_TOKEN_LIMIT, "player_post_reply");
        const reply = sanitizeText(String(ai || "").replace(/^["「]|["」]$/g, "").trim(), 120);
        if (!reply) continue;
        const charComment = {
          id: gid(),
          role: "assistant",
          charId: char.id,
          charName: char.name,
          content: reply,
          depth: 1,
          time: Date.now(),
        };
        setPosts((prev) => prev.map((p) => (
          p.id === post.id ? { ...p, comments: [...(p.comments || []), charComment] } : p
        )));
      } catch (_) {}
    }
  };
  const submitPlayerPost = async () => {
    if (playerPostSubmitting) return;
    const content = sanitizeText(playerPostText.trim(), PLAYER_SOCIAL_POST_LIMIT);
    if (!content) { showToast(tr("請輸入貼文內容", "Please enter post content", "投稿内容を入力してください", "게시물 내용을 입력해주세요")); return; }
    const post = {
      id: gid(),
      authorType: "player",
      authorName: getPlayerDisplayName(),
      charId: null,
      charName: getPlayerDisplayName(),
      content,
      comments: [],
      time: Date.now(),
      likes: 0,
      liked: false,
      likedBy: pickPlayerPostReactors(content),
    };
    const responders = pickPlayerPostResponders(content);
    setPosts((prev) => [post, ...prev]);
    setPlayerPostText("");
    setPlayerPostModalOpen(false);
    if (!responders.length) return;
    if (!canUseCurrentProvider()) {
        showToast(tr("貼文已發佈；角色回覆需先完成 AI 連線設定", "Post published; AI connection is required for replies", "投稿しました。キャラの返信には先にAI接続設定が必要です。", "게시물이 등록되었습니다. 캐릭터 답글에는 먼저 AI 연결 설정이 필요합니다."));
      return;
    }
    setPlayerPostSubmitting(true);
    showToast(tr(`貼文已發佈，等待 ${responders.length} 則角色回覆`, `Post published, waiting for ${responders.length} replies`, `投稿しました。${responders.length}件のキャラ返信を待っています`, `게시물이 등록되었습니다. 캐릭터 답글 ${responders.length}개를 기다리는 중입니다`));
    await generatePlayerPostReplies(post, responders);
    setPlayerPostSubmitting(false);
  };
  const addPostComment = async (postId, explicitTarget = null) => {
    const target = explicitTarget || null;
    const inputKey = target ? `${postId}:${target.commentId}` : postId;
    const raw = postCommentInputs[inputKey] || "";
    const text = sanitizeText(raw, 240).trim();
    if (!text) return;
    const post = posts.find((x) => x.id === postId);
    if (!post) return;
    setPostCommentInputs((prev) => ({ ...prev, [inputKey]: "" }));
    const parentDepth = getCommentDepth(target);
    const userComment = {
      id: gid(),
      role: "user",
      content: text,
      parentId: target?.commentId || null,
      replyToName: target?.authorName || "",
      depth: target ? parentDepth + 1 : 1,
      time: Date.now(),
    };
    setPosts((prev) => prev.map((p) => (
      p.id === postId
        ? { ...p, comments: insertCommentAfterThread(p.comments || [], target?.commentId || null, userComment) }
        : p
    )));
    if (target) setSocialReplyTarget(null);
    const char = target?.charId
      ? characters.find((c) => c.id === target.charId)
      : characters.find((c) => c.id === post.charId);
    if (!canUseCurrentProvider()) return;
    if (!char) return;
    try {
      const sysP = buildSocialSystemPrompt(char, {
        mode: "回覆玩家留言",
        includePlayerRelationship: true,
      });
      const ai = await callSocialAI([{
        role: "user",
        content: target
          ? buildSocialCommentReplyPrompt({ char, post, targetComment: target, userText: text })
          : `你剛發了一則貼文：「${post.content}」\n{{user}} 留言：「${text}」\n請用角色口吻回覆 1 句自然留言，最多 45 字。`,
      }], socialCommentApiConfig, sysP, SOCIAL_COMMENT_INPUT_TOKEN_LIMIT, target ? "comment_reply" : "post_comment_reply");
      const reply = sanitizeText(ai || "", 120).trim() || "收到，謝謝你的留言。";
      const charComment = {
        id: gid(),
        role: "assistant",
        charId: char.id,
        charName: char.name,
        content: reply,
        parentId: userComment.id,
        replyToName: getPlayerDisplayName(),
        depth: userComment.depth + 1,
        time: Date.now(),
      };
      setPosts((prev) => prev.map((p) => (
        p.id !== postId
          ? p
          : (() => {
              const currentComments = p.comments || [];
              const liveUserComment = currentComments.find((comment) => comment.id === userComment.id);
              if (
                !liveUserComment
                || liveUserComment.deleted
                || liveUserComment.content !== text
              ) return p;
              return {
                ...p,
                comments: insertCommentAfterThread(currentComments, userComment.id, charComment),
              };
            })()
      )));
    } catch (_) {}
  };
  const editPlayerComment = (postId, commentId, nextContent) => {
    const content = sanitizeText(nextContent, 240).trim();
    if (!content) {
      showToast(tr("留言不能是空白", "Comment can't be empty", "コメントを空にすることはできません", "댓글은 비워둘 수 없습니다"));
      return false;
    }
    const post = posts.find((item) => item.id === postId);
    const comment = (post?.comments || []).find((item) => item.id === commentId);
    if (
      comment?.role !== "user"
      || (comment?.charId !== null && comment?.charId !== undefined)
      || comment?.deleted
    ) return false;
    setPosts((prev) => prev.map((item) => (
      item.id === postId
        ? {
            ...item,
            comments: editPlayerSocialComment(item.comments, commentId, content),
          }
        : item
    )));
    showToast(tr("留言已編輯", "Comment edited", "コメントを編集しました", "댓글을 수정했습니다"));
    return true;
  };
  const deletePlayerComment = (postId, commentId) => {
    const post = posts.find((item) => item.id === postId);
    const comments = post?.comments || [];
    const comment = comments.find((item) => item.id === commentId);
    if (
      comment?.role !== "user"
      || (comment?.charId !== null && comment?.charId !== undefined)
      || comment?.deleted
    ) return false;
    setPosts((prev) => prev.map((item) => (
      item.id === postId
        ? {
            ...item,
            comments: deletePlayerSocialComment(item.comments, commentId),
          }
        : item
    )));
    showToast(tr("留言已刪除", "Comment deleted", "コメントを削除しました", "댓글을 삭제했습니다"));
    return true;
  };
  const sharePostToChat = (post) => {
    if (getPostAuthorType(post) !== "character" || !post.charId) {
      showToast(tr("玩家貼文目前不分享到角色聊天室", "Player posts can't be shared to character chats yet", "プレイヤーの投稿は今のところキャラのチャットに共有できません", "플레이어 게시물은 아직 캐릭터 채팅에 공유할 수 없습니다"));
      return;
    }
    if (!window.confirm(tr("要分享到此角色聊天室嗎？", "Share to this character's chatroom?", "このキャラクターのチャットルームに共有しますか？", "이 캐릭터의 채팅방에 공유할까요?"))) return;
    const char = characters.find((c) => c.id === post.charId);
    if (!char) return;
    const lines = (post.comments || [])
      .filter((comment) => !comment?.deleted && (!comment?.time || comment.time <= Date.now()))
      .slice(-4)
      .map((c) => `${c.role === "assistant" ? (c.charName || post.charName) : "{{user}}"}：${c.content}`);
    const rawBody = [`貼文：${post.content}`, ...(lines.length ? ["留言：", ...lines] : [])].join("\n");
    const approxTokens = Math.ceil(rawBody.length / 3.5);
    const content = approxTokens <= SHARE_RAW_TOKEN_LIMIT
      ? [
          `[APP_SHARE_EVENT]`,
          `source=social`,
          `mode=raw`,
          `actor=${post.charName}`,
          `token_estimate=${approxTokens}`,
          rawBody,
        ].join("\n")
      : [
          `[APP_SHARE_EVENT]`,
          `source=social`,
          `mode=summary`,
          `actor=${post.charName}`,
          `token_estimate=${approxTokens}`,
          `摘要：${sanitizeText(post.content, 220)}`,
          ...(lines.length ? [`互動重點：${sanitizeText(lines.join(" / "), 260)}`] : []),
        ].join("\n");
    const notice = { id: gid(), role: "system_notice", content, time: Date.now() };
    setChatHistory((h) => ({ ...h, [post.charId]: [...(h[post.charId] || []), notice] }));
    showToast(approxTokens <= SHARE_RAW_TOKEN_LIMIT ? "已分享到聊天室（原文）" : "已分享到聊天室（摘要）");
  };

  const rollSocialAutoPostGap = (char = null) => {
    const ranges = {
      occasional: [4 * 60 * 60 * 1000, 6 * 60 * 60 * 1000],
      normal: [2 * 60 * 60 * 1000, 4 * 60 * 60 * 1000],
      active: [60 * 60 * 1000, 2 * 60 * 60 * 1000],
    };
    const frequency = char ? (socialSettings?.frequencyByCharacter?.[char.id] || socialSettings?.frequency) : socialSettings?.frequency;
    const [minMs, maxMs] = ranges[frequency] || ranges.normal;
    return minMs + Math.random() * (maxMs - minMs);
  };
  const runSocialAutoPostSweep = () => {
    if (!hydrated || !socialSettings?.autoPost || socialAutoPostingRef.current || !canUseCurrentProvider()) return;
    if (!Array.isArray(characters) || !characters.length) return;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const dailyLimit = getSocialAutoPostDailyLimit(socialSettings?.frequency);
    const automaticPostsToday = (posts || []).filter((post) => (
      getPostAuthorType(post) === "character"
      && post?.generationSource === "auto"
      && (Number(post?.time) || 0) >= startOfToday.getTime()
    )).length;
    if (automaticPostsToday >= dailyLimit) return;
    if (!socialAutoPostGapRef.current) socialAutoPostGapRef.current = rollSocialAutoPostGap();
    const lastCharPost = (posts || []).find((p) => getPostAuthorType(p) === "character");
    const lastAt = Math.max(lastCharPost?.time || 0, socialLastGlobalPostAtRef.current || 0);
    if (Date.now() - lastAt < socialAutoPostGapRef.current) return;
    const c = pickRandomSocialCharacter();
    if (!c) return;
    socialAutoPostingRef.current = true;
    socialLastGlobalPostAtRef.current = Date.now();
    socialLastPostByCharRef.current = { ...(socialLastPostByCharRef.current || {}), [c.id]: Date.now() };
    socialAutoPostGapRef.current = rollSocialAutoPostGap(c);
    generatePost(c, "auto").finally(() => { socialAutoPostingRef.current = false; });
  };
  useEffect(() => {
    socialAutoPostGapRef.current = 0;
  }, [socialSettings?.frequency, socialSettings?.frequencyByCharacter]);
  useEffect(() => {
    if (!hydrated || !socialSettings?.autoPost) return;
    const onVisible = () => { if (document.visibilityState === "visible") runSocialAutoPostSweep(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    const kick = setTimeout(runSocialAutoPostSweep, 6000);
    const iv = setInterval(runSocialAutoPostSweep, 10 * 60 * 1000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      clearTimeout(kick);
      clearInterval(iv);
    };
  }, [hydrated, socialSettings, characters, posts, apiConfig]);

  return {
    generatePost,
    handleRandomSocialPost,
    submitPlayerPost,
    addPostComment,
    editPlayerComment,
    deletePlayerComment,
    sharePostToChat,
  };
}
