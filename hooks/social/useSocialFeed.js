import { useEffect } from "react";
import { gid, sanitizeText } from "../../utils/coreUtils";
import { buildSystemPrompt } from "../../utils/characterParser";
import { callAI } from "../../services/aiService";

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
  getPlayerContextBlock,
  buildSocialPostPrompt,
  rollCharacterPostLikes,
  getPlayerDisplayName,
  getPlayerAvatar,
  pickPlayerPostReactors,
  pickPlayerPostResponders,
  buildPlayerPostReplyPrompt,
  getCommentDepth,
  insertCommentAfterThread,
  buildSocialCommentReplyPrompt,
  getPostAuthorType,
}) {
  const generatePost = async (char) => {
    if (!canUseCurrentProvider()) { showToast(tr("請先完成 AI 連線設定（API Key）", "Please finish AI connection setup (API key) first", "先にAI接続設定（APIキー）を完了してください", "먼저 AI 연결 설정(API 키)을 완료해주세요")); return; }
    try {
      const sysP = `${buildSystemPrompt(char, getPlayerContextBlock())}

[目前輸出模式：社群貼文]
以下社群貼文規則優先於上方「聊天規則」中關於即時通訊、只輸出私訊內容的限制。
你正在替 {{char}} 產生一則公開/半公開社群動態。貼文要像角色自己發的近況，不是對 {{user}} 的私訊。`;
      const t = await callAI([{
        role: "user",
        content: buildSocialPostPrompt(char),
      }], apiConfig, sysP);
        const content = sanitizeText(String(t || "").replace(/^["「]|["」]$/g, "").trim(), 120) || "今天也算是有好好過完了。";
        setPosts(p => [{
          id: gid(),
          authorType: "character",
          authorName: char.name,
          authorAvatar: char.avatar,
          charId: char.id,
          charName: char.name,
          charAvatar: char.avatar,
          content,
          comments: [],
          time: Date.now(),
          likes: rollCharacterPostLikes(char),
          liked: false,
        }, ...p]);
        showToast(tr(`${char.name} 已發佈貼文`, `${char.name} published a post`, `${char.name} が投稿しました`, `${char.name}님이 게시물을 올렸습니다`));
      } catch (err) {
        showToast(`${tr("發文失敗", "Failed to post", "投稿に失敗しました", "게시 실패")}：${err.message}`);
      }
    };
  const handleRandomSocialPost = () => {
    const nowTs = Date.now();
    const globalLeft = SOCIAL_GLOBAL_COOLDOWN_MS - (nowTs - (socialLastGlobalPostAtRef.current || 0));
    if (globalLeft > 0) {
      showToast(tr(`刷新太快，請 ${Math.ceil(globalLeft / 1000)} 秒後再試`, `Too fast, try again in ${Math.ceil(globalLeft / 1000)}s`, `更新が早すぎます。${Math.ceil(globalLeft / 1000)}秒後にもう一度お試しください`, `너무 빨라요. ${Math.ceil(globalLeft / 1000)}초 후 다시 시도해주세요`));
      return;
    }
    const c = pickRandomSocialCharacter();
    if (!c) return;
    const lastForChar = socialLastPostByCharRef.current?.[c.id] || 0;
    const charLeft = SOCIAL_CHAR_COOLDOWN_MS - (nowTs - lastForChar);
    if (charLeft > 0) {
      showToast(tr(`${c.name} 剛發過文，請 ${Math.ceil(charLeft / 1000)} 秒後再試`, `${c.name} just posted, try again in ${Math.ceil(charLeft / 1000)}s`, `${c.name} は投稿したばかりです。${Math.ceil(charLeft / 1000)}秒後にお試しください`, `${c.name}님이 방금 게시했어요. ${Math.ceil(charLeft / 1000)}초 후 다시 시도해주세요`));
      return;
    }
    socialLastGlobalPostAtRef.current = nowTs;
    socialLastPostByCharRef.current = { ...(socialLastPostByCharRef.current || {}), [c.id]: nowTs };
    generatePost(c);
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
        const sysP = `${buildSystemPrompt(char, getPlayerContextBlock())}

[目前輸出模式：社群留言]
以下規則優先於上方聊天規則。你正在替 {{char}} 在公開/半公開社群貼文下方留言，內容要像社群互動，不是私訊。`;
        const ai = await callAI([{
          role: "user",
          content: buildPlayerPostReplyPrompt(char, post),
        }], apiConfig, sysP);
        const reply = sanitizeText(String(ai || "").replace(/^["「]|["」]$/g, "").trim(), 120);
        if (!reply) continue;
        const charComment = {
          id: gid(),
          role: "assistant",
          charId: char.id,
          charName: char.name,
          charAvatar: char.avatar,
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
      authorAvatar: getPlayerAvatar(),
      charId: null,
      charName: getPlayerDisplayName(),
      charAvatar: getPlayerAvatar(),
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
      depth: target ? Math.min(3, parentDepth + 1) : 1,
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
    if (!char || userComment.depth >= 3) return;
    try {
      const sysP = buildSystemPrompt(char, getPlayerContextBlock());
      const ai = await callAI([{
        role: "user",
        content: target
          ? buildSocialCommentReplyPrompt({ char, post, targetComment: target, userText: text })
          : `你剛發了一則貼文：「${post.content}」\n{{user}} 留言：「${text}」\n請用角色口吻回覆 1 句自然留言，最多 45 字。`,
      }], apiConfig, sysP);
      const reply = sanitizeText(ai || "", 120).trim() || "收到，謝謝你的留言。";
      const charComment = {
        id: gid(),
        role: "assistant",
        charId: char.id,
        charName: char.name,
        charAvatar: char.avatar,
        content: reply,
        parentId: userComment.id,
        replyToName: getPlayerDisplayName(),
        depth: Math.min(3, userComment.depth + 1),
        time: Date.now(),
      };
      setPosts((prev) => prev.map((p) => (
        p.id === postId
          ? { ...p, comments: insertCommentAfterThread(p.comments || [], userComment.id, charComment) }
          : p
      )));
    } catch (_) {}
  };
  const sharePostToChat = (post) => {
    if (getPostAuthorType(post) !== "character" || !post.charId) {
      showToast(tr("玩家貼文目前不分享到角色聊天室", "Player posts can't be shared to character chats yet", "プレイヤーの投稿は今のところキャラのチャットに共有できません", "플레이어 게시물은 아직 캐릭터 채팅에 공유할 수 없습니다"));
      return;
    }
    if (!window.confirm("要分享到此角色聊天室嗎？")) return;
    const char = characters.find((c) => c.id === post.charId);
    if (!char) return;
    const lines = (post.comments || []).slice(-4).map((c) => `${c.role === "assistant" ? (c.charName || post.charName) : "{{user}}"}：${c.content}`);
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
    generatePost(c).finally(() => { socialAutoPostingRef.current = false; });
  };
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
    sharePostToChat,
  };
}
