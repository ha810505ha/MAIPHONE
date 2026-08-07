import { PHOTO_RULE_CONTEXT, extractPhotoDirectives, pseudoImagePromptLine } from "../../utils/pseudoImage";

export async function generateGroupReplies({ group, members, messages, currentImage, includeRealTime = true, apiConfig, callAI, buildSystemPrompt, parseReplies, stripInternalBlocks, sanitizeText, tr, signal }) {
  const now = new Date();
  const date = new Intl.DateTimeFormat("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const time = new Intl.DateTimeFormat("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Taipei";
  const memberNames = members.map((member) => member.name).join("、") || tr("群組成員", "Group members", "グループメンバー", "그룹 멤버");
  const memberProfiles = members.map((member) => member.profileText).filter(Boolean).join("\n\n");
  const history = messages.slice(-18).map((message) => {
    const summary = message.imageSummary ? `\n[圖片摘要]\n${message.imageSummary}` : "";
    // 示意圖片只送描述文字，永遠不帶 image。
    const pseudo = pseudoImagePromptLine(message.pseudoImage, message.role === "user" ? "玩家" : (message.speakerName || "對方"));
    return { role: message.role, content: `${message.content || ""}${pseudo}${summary}`.trim(), image: message.image || null, speakerName: message.speakerName };
  });
  const safeHistory = history.map((message, index) => currentImage && index === history.length - 1 ? message : { ...message, image: null });
  const recent = safeHistory.map((message) => `${message.role === "user" ? "玩家" : (message.speakerName || "群組")}: ${message.content || "[圖片]"}`).join("\n");
  const systemPrompt = [includeRealTime ? `[系統時間] 目前時間：${date} ${time} (${timezone})` : "", buildSystemPrompt(group, memberNames, memberProfiles, recent), PHOTO_RULE_CONTEXT].filter(Boolean).join("\n\n");
  const raw = await callAI(safeHistory, apiConfig, systemPrompt, {
    signal,
    feature: "chat",
    mode: "group",
    app: "chat",
    action: "group_reply",
  });
  const parsed = parseReplies(stripInternalBlocks(raw));
  const normalizeSpeaker = (value) => String(value || "")
    .trim()
    .replace(/^[「『【\[(]+|[」』】\])]+$/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
  const memberMap = new Map(members.map((member) => [normalizeSpeaker(member.name), member]));
  const resolveMember = (speaker) => {
    const normalized = normalizeSpeaker(speaker);
    const exact = memberMap.get(normalized);
    if (exact) return exact;
    if (!normalized) return null;
    const profileMatches = members.filter((member) => normalizeSpeaker(member.profileText).includes(normalized));
    return profileMatches.length === 1 ? profileMatches[0] : null;
  };
  const seen = new Set();
  const replies = [];
  for (const item of parsed) {
    const matched = resolveMember(item.speaker);
    const name = matched?.name;
    if (!matched || !name || !item.content || seen.has(name)) continue;
    seen.add(name);
    // 標記必須在這裡剝除，否則 [[PHOTO:...]] 會原樣顯示在訊息裡。
    const photoExtracted = extractPhotoDirectives(item.content);
    if (!photoExtracted.text.trim() && !photoExtracted.photos.length) continue;
    replies.push({ speakerId: matched.id, speakerName: name, content: photoExtracted.text, pseudoImage: photoExtracted.photos[0] || null });
  }
  if (!replies.length) {
    const fallback = members[0];
    const fallbackExtracted = extractPhotoDirectives(raw);
    const content = sanitizeText(stripInternalBlocks(fallbackExtracted.text), 4000).trim();
    if (fallback && (content || fallbackExtracted.photos.length)) replies.push({ speakerId: fallback.id, speakerName: fallback.name, content, pseudoImage: fallbackExtracted.photos[0] || null });
  }
  return replies;
}
