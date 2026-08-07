import { messagePlainText } from "../../utils/pseudoImage";

export function createSocialFeedHelpers({
  chatHistory,
  getModeLabel,
  getMessageMode,
  sanitizeText,
  posts,
  getOutputLanguageDirective,
  tr,
  uiLanguage,
  playerProfile,
  sanitizeUserImageUrl,
  normalizeForMatch,
  tokenizeForRecall,
  memories,
  activeCharId,
  characters,
  socialTick,
}) {
  const buildRecentChatForSocialPost = (char) => {
    const list = (chatHistory[char.id] || [])
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-8)
      .map((m) => {
        const speaker = m.role === "user" ? "{{user}}" : char.name;
        const mode = getModeLabel(getMessageMode(m));
        const body = sanitizeText(messagePlainText(m, "[圖片]"), 120).replace(/\s+/g, " ").trim();
        return body ? `[${mode}] ${speaker}：${body}` : "";
      })
      .filter(Boolean);
    return list.join("\n");
  };
  const buildSocialSystemPrompt = (
    char,
    { mode = "社群互動", includePlayerRelationship = false } = {},
  ) => {
    const compactField = (value, maximum) => sanitizeText(String(value || "").trim(), maximum).trim();
    const name = compactField(char?.name, 80) || "角色";
    const description = compactField(char?.description, 500);
    const personality = compactField(char?.personality, 500);
    const coreStyle = compactField(char?.systemPrompt, 600);
    const relationship = includePlayerRelationship
      ? compactField(char?.relationshipToUser, 300)
      : "";
    const playerName = includePlayerRelationship
      ? compactField(playerProfile?.nickname || playerProfile?.name || "玩家", 40)
      : "";
    return [
      getOutputLanguageDirective({ includePlayerContext: includePlayerRelationship }),
      `[社群角色]\n名稱：${name}`,
      description ? `[角色描述]\n${description}` : "",
      personality ? `[個性／說話方式]\n${personality}` : "",
      coreStyle ? `[核心設定／說話方式]\n${coreStyle}` : "",
      relationship ? `[與玩家關係]\n${relationship}` : "",
      playerName ? `[玩家稱呼]\n${playerName}` : "",
      `[目前輸出模式：${mode}]
[社群輸出規則]
- 維持角色人格與說話方式，只輸出最終要發佈的內容。
- 這是公開／半公開社群，不是即時私訊；不要輸出角色名、前綴、旁白、Markdown 或規則說明。
- 只根據當次提供的公開貼文與留言內容互動，不得捏造未提供的共同經歷。`,
    ].filter(Boolean).join("\n\n");
  };
  const buildSocialPostPrompt = (char) => {
    const recentChat = buildRecentChatForSocialPost(char);
    const recentPosts = (posts || [])
      .filter((p) => p.charId === char.id)
      .slice(0, 3)
      .map((p, i) => `${i + 1}. ${sanitizeText(p.content || "", 80)}`)
      .filter(Boolean)
      .join("\n");
    return `請替角色「${char.name}」寫一則可發在社群上的近況貼文。

社群定位：
- 這是朋友或熟人可能看得到的動態，不是私訊。
- 可以融合近期聊天的主題、情緒、事件後續或衍生想法，讓角色像有自己的生活延續。
- 不可以直接複述私聊內容，不可以像在對 {{user}} 單獨說話。
- 不要提到「剛剛跟你聊」「我們私訊」「{{user}}」或玩家姓名。
- 不要公開私密、曖昧、敏感、只屬於兩人之間的細節；若要引用，只能轉成模糊的心情或日常感想。
- 不要使用第二人稱「你」指向玩家。
- 內容 20~50 字，自然像真人隨手發文，不要標題、不要引號、不要解釋。

近期私聊脈絡（只能參考主題/情緒，不可外洩原文）：
${recentChat || "（近期沒有可參考的聊天）"}

近期貼文（避免重複語氣與主題）：
${recentPosts || "（無）"}`;
  };
  const formatPostTime = (ts) => {
    const time = Number(ts) || 0;
    const diff = Date.now() - time;
    if (diff < 60 * 1000) return tr("剛剛", "Just now", "たった今", "방금");
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return tr(`${mins} 分鐘前`, `${mins}m ago`, `${mins}分前`, `${mins}분 전`);
    const hours = Math.floor(mins / 60);
    if (hours < 24) return tr(`${hours} 小時前`, `${hours}h ago`, `${hours}時間前`, `${hours}시간 전`);
    const days = Math.floor(hours / 24);
    if (days === 1) return tr("昨天", "Yesterday", "昨日", "어제");
    if (days <= 3) return tr(`${days} 天前`, `${days}d ago`, `${days}日前`, `${days}일 전`);
    const locale = { "zh-TW": "zh-TW", "zh-CN": "zh-CN", en: "en-US", ja: "ja-JP", ko: "ko-KR" }[uiLanguage] || "zh-TW";
    return new Date(time).toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" });
  };
  const getPostAuthorType = (post) => post?.authorType || (post?.charId ? "character" : "player");
  const getPlayerDisplayName = () => playerProfile?.nickname || playerProfile?.name || tr("你", "You", "あなた", "나");
  const getPlayerAvatar = () => sanitizeUserImageUrl(playerProfile?.avatar) || null;
  const getPostAuthorName = (post) => getPostAuthorType(post) === "player"
    ? getPlayerDisplayName()
    : (post?.authorName || post?.charName || tr("未知", "Unknown", "不明", "알 수 없음"));
  const getPostAuthorAvatar = (post) => getPostAuthorType(post) === "player"
    ? getPlayerAvatar()
    : (sanitizeUserImageUrl(characters.find((character) => String(character.id) === String(post?.charId))?.avatar) || post?.authorAvatar || post?.charAvatar || null);
  const getConnectionErrorPrefix = () => tr("連線錯誤：", "Connection error: ", "接続エラー: ", "연결 오류: ");
  const isConnectionErrorNotice = (content) => {
    const text = String(content || "");
    return text.startsWith("連線錯誤：") || text.startsWith("Connection error: ") || text.startsWith("接続エラー: ") || text.startsWith("연결 오류: ");
  };
  const formatSocialCount = (value) => {
    const n = Math.max(0, Math.round(Number(value) || 0));
    if (n >= 10000) return `${(n / 10000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, "")}萬`;
    if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "")}K`;
    return String(n);
  };
  const getCharacterSocialReach = (char) => {
    const text = normalizeForMatch([
      char?.name,
      char?.description,
      char?.personality,
      char?.scenario,
      char?.systemPrompt,
      char?.relationshipToUser,
      char?.creatorNotes,
      Array.isArray(char?.tags) ? char.tags.join(" ") : "",
    ].filter(Boolean).join(" "));
    const high = /(偶像|明星|藝人|歌手|演員|直播主|實況主|網紅|kol|influencer|model|模特|名人|人氣|粉絲|公眾人物|vtuber|youtuber)/i;
    const publicJob = /(醫生|律師|老師|教授|店長|老闆|企業家|主播|記者|作家|漫畫家|攝影師|設計師|學生會|社長)/i;
    const hidden = /(殺手|刺客|傭兵|特工|間諜|黑道|犯罪|通緝|逃亡|隱居|低調|孤僻|神秘|秘密|不擅社交|社恐|少朋友|無朋友|獨來獨往)/i;
    if (high.test(text)) return "celebrity";
    if (hidden.test(text)) return "private";
    if (publicJob.test(text)) return "local";
    return "normal";
  };
  const rollCharacterPostLikes = (char) => {
    const reach = getCharacterSocialReach(char);
    const rand = (min, max) => Math.floor(min + Math.random() * (max - min + 1));
    if (reach === "celebrity") return rand(1200, 28000);
    if (reach === "private") return rand(0, 18);
    if (reach === "local") return rand(24, 360);
    return rand(4, 95);
  };
  const shouldClampSocialPost = (content) => {
    const text = String(content || "");
    const manualLines = text.split(/\r?\n/).length;
    return manualLines > 5 || text.length > 115;
  };
  const shouldScrollComments = (comments) => {
    const list = comments || [];
    const totalChars = list.reduce((sum, c) => sum + String(c?.content || "").length, 0);
    const totalLines = list.reduce((sum, c) => sum + Math.ceil(String(c?.content || "").length / 26) + String(c?.content || "").split(/\r?\n/).length - 1, 0);
    return list.length > 6 || totalChars > 420 || totalLines > 10;
  };
  const getCommentDepth = (comment) => {
    const savedDepth = Number(comment?.depth);
    if (Number.isFinite(savedDepth) && savedDepth >= 1) {
      return Math.floor(savedDepth);
    }
    return comment?.parentId ? 2 : 1;
  };
  const getCommentAuthorName = (comment, fallback = "") => (
    comment?.role === "assistant" ? (comment.charName || fallback) : getPlayerDisplayName()
  );
  const insertCommentAfterThread = (comments, anchorId, nextComment) => {
    const list = [...(comments || [])];
    if (!anchorId) return [...list, nextComment];
    const anchorIndex = list.findIndex((c) => c.id === anchorId);
    if (anchorIndex < 0) return [...list, nextComment];
    const anchorDepth = getCommentDepth(list[anchorIndex]);
    let insertAt = anchorIndex + 1;
    while (insertAt < list.length && getCommentDepth(list[insertAt]) > anchorDepth) insertAt += 1;
    list.splice(insertAt, 0, nextComment);
    return list;
  };
  const buildMemoryDigest = (memoriesList) => {
    const seen = new Set();
    return (memoriesList || [])
      .slice()
      .sort((a, b) => (b.date || 0) - (a.date || 0))
      .map((mem) => sanitizeText(mem?.text || "", 60))
      .filter(Boolean)
      .filter((text) => {
        const key = normalizeForMatch(text);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 5)
      .map((text, idx) => `- ${idx + 1}. ${text}`)
      .join("\n");
  };
  const buildSocialCommentReplyPrompt = ({ char, post, targetComment, userText }) => `社群貼文：「${post.content}」
${targetComment ? `你上一則留言：「${targetComment.content}」\n` : ""}{{user}} 回覆你：「${userText}」

請用角色「${char.name}」的口吻回覆這則社群留言。
規則：
- 這是公開/半公開社群留言，不是私訊。
- 回覆 1 句，最多 45 字。
- 不要公開私聊原文或敏感細節，不要角色名標籤，不要引號，不要解釋。`;
  const getCharacterPersonaText = (char) => [
    char?.name,
    char?.description,
    char?.personality,
    char?.scenario,
    char?.systemPrompt,
    char?.relationshipToUser,
    char?.creatorNotes,
    Array.isArray(char?.tags) ? char.tags.join(" ") : "",
  ].filter(Boolean).join("\n");
  const getCharacterSocialDisposition = (char) => {
    const persona = normalizeForMatch(getCharacterPersonaText(char));
    const outgoing = /(健談|外向|活潑|熱情|幽默|話多|親切|開朗|愛聊天|吐槽|關心|社交|talkative|outgoing|lively|friendly|cheerful|sociable|chatty|おしゃべり|明るい|사교적|수다)/i;
    const reserved = /(內向|寡言|冷淡|沉默|怕生|害羞|孤僻|不善言辭|安靜|introvert|quiet|reserved|shy|aloof|無口|人見知り|内向的|과묵|내향|낯가림)/i;
    if (outgoing.test(persona)) return "outgoing";
    if (reserved.test(persona)) return "reserved";
    return "normal";
  };
  const scoreCharacterForCharacterPost = (char, post, author) => {
    const queryTokens = tokenizeForRecall(post?.content || "");
    const overlap = countTokenOverlap(getCharacterPersonaText(char), queryTokens);
    const disposition = getCharacterSocialDisposition(char);
    const dispositionScore = disposition === "outgoing" ? 7 : disposition === "reserved" ? -4 : 1;
    const selfCommentAdjustment = String(char?.id) === String(author?.id) ? -1 : 0;
    return overlap * 3 + dispositionScore + selfCommentAdjustment;
  };
  const getCharacterCommentReplyChance = (char) => {
    const disposition = getCharacterSocialDisposition(char);
    if (disposition === "outgoing") return 0.85;
    if (disposition === "reserved") return 0.4;
    return 0.65;
  };
  const buildCharacterPostInteractionPrompt = ({ char, post, author, isSelfComment }) => `${isSelfComment
    ? `這是你剛發佈的社群貼文：「${post.content}」`
    : `社群成員「${author?.name || post?.charName || "某位角色"}」發佈了貼文：「${post.content}」`}

${isSelfComment
    ? `請依照「${char.name}」的人格，在自己的貼文下補充一則自然留言，像是突然想到的後續、補充說明或生活感的小句子。`
    : `請依照「${char.name}」的人格與說話方式，在這則貼文下留一則自然回應。`}
- 只根據貼文公開內容互動，把對方視為同一社群中的普通成員。
- 不要捏造共同回憶、私下關係、世界觀事件或未提供的經歷。
- 除非貼文明確提到 {{user}}，否則不要把玩家帶進留言。
- 只輸出 1 則留言，最多 45 字；不要輸出姓名、引號、旁白或格式標記。
- ${isSelfComment ? "不要只是重複原貼文，也不要假裝在回覆另一個人。" : "可以認同、提問、關心、吐槽或延續話題，但不要過度熟絡。"} `;
  const buildCharacterReplyToCommentPrompt = ({ char, post, targetComment }) => `你剛發佈的社群貼文：「${post.content}」
社群成員「${targetComment?.charName || "某位角色"}」留言：「${targetComment?.content || ""}」

請依照「${char.name}」的人格與說話方式，自然回覆這則留言：
- 只根據貼文與留言內容互動，不要捏造共同回憶、私下關係或世界觀事件。
- 除非內容明確提到 {{user}}，否則不要把玩家帶進回覆。
- 回覆 1 句，最多 45 字；不要輸出姓名、引號、旁白或格式標記。`;
  const countTokenOverlap = (source, queryTokens) => {
    if (!queryTokens?.size) return 0;
    const sourceTokens = tokenizeForRecall(source);
    let hit = 0;
    queryTokens.forEach((t) => { if (sourceTokens.has(t)) hit += 1; });
    return hit;
  };
  const scoreCharacterForPlayerPost = (char, text) => {
    const qTokens = tokenizeForRecall(text);
    const recentMsgs = (chatHistory[char.id] || []).slice(-24);
    const recentChat = recentMsgs
      .map((m) => `${m.role === "user" ? "{{user}}" : char.name}: ${m.content || ""}`)
      .join("\n");
    const memoryText = (memories[char.id] || []).map((m) => m.text || "").join("\n");
    const profileText = [
      char.name,
      char.description,
      char.personality,
      char.scenario,
      char.systemPrompt,
      char.relationshipToUser,
      char.creatorNotes,
      memoryText,
      recentChat,
    ].filter(Boolean).join("\n");
    const recentCount = recentMsgs.filter((m) => m.role === "user" || m.role === "assistant").length;
    const latest = recentMsgs[recentMsgs.length - 1]?.time || 0;
    const recencyScore = latest ? Math.max(0, 6 - Math.floor((Date.now() - latest) / (24 * 60 * 60 * 1000))) : 0;
    const overlap = countTokenOverlap(profileText, qTokens);
    return (
      overlap * 3 +
      Math.min(10, recentCount) +
      recencyScore +
      (char.id === activeCharId ? 4 : 0) +
      Math.random() * 5
    );
  };
  const pickPlayerPostReactors = (text) => {
    const total = characters.length;
    if (total <= 0) return [];
    let target = total;
    if (total > 3 && total <= 5) target = 2 + Math.floor(Math.random() * (total - 1));
    if (total > 5 && total <= 10) target = Math.min(total, 3 + Math.floor(Math.random() * 6));
    if (total > 10) target = Math.min(total, 5 + Math.floor(Math.random() * 8));
    const nowMs = Date.now();
    return [...characters]
      .map((char) => ({ char, score: scoreCharacterForPlayerPost(char, text) + Math.random() * 4 }))
      .sort((a, b) => b.score - a.score)
      .slice(0, target)
      .map((x, idx, arr) => {
        const progress = arr.length <= 1 ? 0.3 : idx / Math.max(1, arr.length - 1);
        const delay = Math.min(5 * 60 * 1000, 20000 + Math.floor(progress * 250000) + Math.floor(Math.random() * 30000));
        return {
        charId: x.char.id,
        charName: x.char.name,
        time: nowMs + delay,
        };
      });
  };
  const getVisibleLikedBy = (post) => (post?.likedBy || [])
    .filter((x) => !x.time || x.time <= socialTick)
    .sort((a, b) => (a.time || 0) - (b.time || 0));
  const getPostLikeCount = (post) => Math.max(0, Math.round(Number(post?.likes) || 0)) + getVisibleLikedBy(post).length;
  const getLikedByListText = (post) => {
    const likedBy = getVisibleLikedBy(post);
    if (!likedBy.length) return "";
    const names = likedBy.map((x) => x.charName).filter(Boolean).join("、");
    return names ? `${names} 喜歡這則貼文` : "";
  };
  const pickPlayerPostResponders = (text) => {
    const total = characters.length;
    if (total <= 0) return [];
    if (total <= 3) return [...characters];
    let target = 3;
    if (total > 5 && total <= 10) target = 3 + Math.floor(Math.random() * 3);
    if (total > 10) target = 3 + Math.floor(Math.random() * 5);
    target = Math.min(target, total);
    return [...characters]
      .map((char) => ({ char, score: scoreCharacterForPlayerPost(char, text) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, target)
      .map((x) => x.char);
  };
  const buildPlayerPostReplyPrompt = (char, post) => {
    return `玩家在社群發了一則公開貼文：「${post.content}」

請直接用角色「${char.name}」的口吻輸出留言內容。
規則：
- 這是社群留言，不是私訊，不要像只對玩家一個人撒嬌或報備。
- 只根據角色設定、與玩家的關係及這篇公開貼文回應。
- 若貼文和角色沒有強關聯，也可以用普通朋友會留下的短回應。
- 請輸出 1 句，最多 45 字，不要角色名標籤、不要引號、不要解釋。`;
  };

  return {
    buildRecentChatForSocialPost,
    buildSocialSystemPrompt,
    buildSocialPostPrompt,
    formatPostTime,
    getPostAuthorName,
    getPostAuthorAvatar,
    getPostAuthorType,
    getPlayerDisplayName,
    getPlayerAvatar,
    getConnectionErrorPrefix,
    isConnectionErrorNotice,
    formatSocialCount,
    getCharacterSocialReach,
    rollCharacterPostLikes,
    shouldClampSocialPost,
    shouldScrollComments,
    getCommentDepth,
    getCommentAuthorName,
    insertCommentAfterThread,
    buildMemoryDigest,
    buildSocialCommentReplyPrompt,
    scoreCharacterForCharacterPost,
    getCharacterCommentReplyChance,
    buildCharacterPostInteractionPrompt,
    buildCharacterReplyToCommentPrompt,
    countTokenOverlap,
    scoreCharacterForPlayerPost,
    pickPlayerPostReactors,
    getVisibleLikedBy,
    getPostLikeCount,
    getLikedByListText,
    pickPlayerPostResponders,
    buildPlayerPostReplyPrompt,
  };
}
