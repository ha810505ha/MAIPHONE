export async function generateGroupReplies({ group, members, messages, currentImage, apiConfig, callAI, buildSystemPrompt, parseReplies, stripInternalBlocks, sanitizeText, sanitizeImageUrl, tr }) {
  const now = new Date();
  const date = new Intl.DateTimeFormat("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const time = new Intl.DateTimeFormat("zh-TW", { hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Taipei";
  const memberNames = members.map((member) => member.name).join("、") || tr("群組成員", "Group members", "グループメンバー", "그룹 멤버");
  const memberProfiles = members.map((member) => member.profileText).filter(Boolean).join("\n\n");
  const history = messages.slice(-18).map((message) => {
    const summary = message.imageSummary ? `\n[圖片摘要]\n${message.imageSummary}` : "";
    return { role: message.role, content: `${message.content || ""}${summary}`.trim(), image: message.image || null, speakerName: message.speakerName };
  });
  const safeHistory = history.map((message, index) => currentImage && index === history.length - 1 ? message : { ...message, image: null });
  const recent = safeHistory.map((message) => `${message.role === "user" ? "玩家" : (message.speakerName || "群組")}: ${message.content || "[圖片]"}`).join("\n");
  const systemPrompt = `[系統時間] 目前時間：${date} ${time} (${timezone})\n\n${buildSystemPrompt(group, memberNames, memberProfiles, recent)}`;
  const raw = await callAI(safeHistory, apiConfig, systemPrompt);
  const parsed = parseReplies(stripInternalBlocks(raw));
  const memberMap = new Map(members.map((member) => [member.name, member]));
  const seen = new Set();
  const replies = [];
  for (const item of parsed) {
    const matched = memberMap.get(item.speaker) || members.find((member) => member.name === item.speaker);
    const name = matched?.name || item.speaker;
    if (!name || !item.content || seen.has(name)) continue;
    seen.add(name);
    replies.push({ speakerName: name, speakerAvatar: sanitizeImageUrl(matched?.avatar || ""), content: item.content });
  }
  if (!replies.length) {
    const fallback = members[0];
    const content = sanitizeText(stripInternalBlocks(raw), 4000).trim();
    if (fallback && content) replies.push({ speakerName: fallback.name, speakerAvatar: sanitizeImageUrl(fallback.avatar || ""), content });
  }
  return replies;
}
