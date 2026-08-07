const asContent = (value) => String(value || "").trim();

export function getSwipeContents(swipe) {
  if (Array.isArray(swipe?.contents)) return swipe.contents.map(asContent).filter(Boolean);
  const content = typeof swipe === "string" ? swipe : swipe?.content;
  return asContent(content) ? [asContent(content)] : [];
}

export function findAssistantSwipeGroup(messages, anchorId) {
  const list = Array.isArray(messages) ? messages : [];
  const targetIndex = list.findIndex((message) => message?.id === anchorId);
  const target = list[targetIndex];
  if (targetIndex < 0 || target?.role !== "assistant") return null;

  const groupId = target.replyGroupId;
  const entries = groupId
    ? list.map((message, index) => ({ message, index }))
      .filter(({ message }) => message?.role === "assistant" && message.replyGroupId === groupId)
    : [{ message: target, index: targetIndex }];
  if (!entries.length) return null;
  const anchor = entries.at(-1)?.message || target;
  return {
    anchor,
    entries,
    startIndex: entries[0].index,
    endIndex: entries.at(-1).index,
  };
}

export function findTailAssistantSwipeAnchor(messages) {
  const list = Array.isArray(messages) ? messages : [];
  const lastUserIndex = list.map((message) => message?.role).lastIndexOf("user");
  for (let index = list.length - 1; index > lastUserIndex; index -= 1) {
    const message = list[index];
    if (message?.role !== "assistant" || !asContent(message.content)) continue;
    if (message.image || message.pseudoImage || message.pseudoVoice || message.calendarProposal) continue;
    const group = findAssistantSwipeGroup(list, message.id);
    if (group?.anchor?.id) return group.anchor.id;
  }
  return null;
}

const getVariants = (group) => {
  const rawSwipes = Array.isArray(group?.anchor?.swipes) ? group.anchor.swipes : [];
  const normalized = rawSwipes.map(getSwipeContents).filter((contents) => contents.length);
  const hasGroupedSwipe = rawSwipes.some((swipe) => Array.isArray(swipe?.contents));
  return hasGroupedSwipe
    ? normalized
    : [group.entries.map(({ message }) => asContent(message.content)).filter(Boolean), ...normalized];
};

const createGroupMessages = ({ group, contents, variants, swipeIndex, time, createId }) => {
  const groupId = group.anchor.replyGroupId || group.anchor.id;
  const lastIndex = contents.length - 1;
  return contents.map((content, index) => {
    const previous = group.entries[index]?.message || group.entries.at(-1)?.message || group.anchor;
    const {
      id: _oldId,
      content: _oldContent,
      swipes: _oldSwipes,
      swipeIndex: _oldSwipeIndex,
      replyGroupIndex: _oldGroupIndex,
      replyGroupSize: _oldGroupSize,
      innerThought: _oldThought,
      calendarProposal: _oldProposal,
      ...base
    } = previous;
    const reusableId = group.entries[index]?.message?.id;
    const id = index === lastIndex
      ? group.anchor.id
      : (reusableId && reusableId !== group.anchor.id ? reusableId : createId());
    return {
      ...base,
      id,
      role: "assistant",
      content,
      replyGroupId: groupId,
      replyGroupIndex: index,
      replyGroupSize: contents.length,
      time,
      ...(index === lastIndex ? {
        swipes: variants.map((variant) => ({ contents: variant, time })),
        swipeIndex,
      } : {}),
    };
  });
};

export function replaceAssistantSwipeGroup(messages, anchorId, swipeIndex, createId) {
  const list = Array.isArray(messages) ? messages : [];
  const group = findAssistantSwipeGroup(list, anchorId);
  if (!group || !Number.isInteger(swipeIndex) || swipeIndex < 0) return list;
  const variants = getVariants(group);
  const contents = variants[swipeIndex];
  if (!contents?.length) return list;
  const replacement = createGroupMessages({
    group,
    contents,
    variants,
    swipeIndex,
    time: Date.now(),
    createId,
  });
  return [...list.slice(0, group.startIndex), ...replacement, ...list.slice(group.endIndex + 1)];
}

export function appendAssistantSwipeGroup(messages, anchorId, contents, time, createId) {
  const list = Array.isArray(messages) ? messages : [];
  const group = findAssistantSwipeGroup(list, anchorId);
  const nextContents = (Array.isArray(contents) ? contents : []).map(asContent).filter(Boolean);
  if (!group || !nextContents.length) return list;
  const variants = [...getVariants(group), nextContents];
  const replacement = createGroupMessages({
    group,
    contents: nextContents,
    variants,
    swipeIndex: variants.length - 1,
    time: Number(time) || Date.now(),
    createId,
  });
  return [...list.slice(0, group.startIndex), ...replacement, ...list.slice(group.endIndex + 1)];
}
