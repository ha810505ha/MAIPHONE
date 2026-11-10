const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);

function withoutKeys(value, keys) {
  if (!value || typeof value !== "object") return value;
  const present = keys.filter((key) => hasOwn(value, key));
  if (!present.length) return value;
  const next = { ...value };
  present.forEach((key) => { delete next[key]; });
  return next;
}

const characterMapById = (characters) => new Map(
  (Array.isArray(characters) ? characters : [])
    .filter((character) => character?.id !== null && character?.id !== undefined)
    .map((character) => [String(character.id), character]),
);

// Keep one canonical copy of a character image. When avatarOriginal is exactly
// the same data URL as avatar, every existing fallback already reaches avatar.
export function compactCharacterImages(characters) {
  if (!Array.isArray(characters)) return characters;
  let changed = false;
  const next = characters.map((character) => {
    if (!character) return character;
    const redundant = [];
    if (character.avatar && character.avatarOriginal === character.avatar) redundant.push("avatarOriginal");
    const heroFallback = redundant.includes("avatarOriginal") ? character.avatar : (character.avatarOriginal || character.avatar);
    if (character.heroImage && character.heroImage === heroFallback) redundant.push("heroImage");
    if (!redundant.length) return character;
    changed = true;
    return withoutKeys(character, redundant);
  });
  return changed ? next : characters;
}

// Gacha episodes already keep characterId, so a live character can provide
// the avatar. Keep the legacy snapshot only when the character was deleted,
// otherwise old stories would lose their last available image.
export function compactGachaEpisodeImages(episodes, characters) {
  if (!Array.isArray(episodes)) return episodes;
  const characterById = characterMapById(characters);
  let changed = false;
  const next = episodes.map((episode) => {
    if (!episode || !hasOwn(episode, "characterAvatar")) return episode;
    if (!characterById.has(String(episode.characterId))) return episode;
    changed = true;
    return withoutKeys(episode, ["characterAvatar"]);
  });
  return changed ? next : episodes;
}

// Social records only need IDs. Legacy snapshots are retained only when their
// character no longer exists, so old posts can still display an orphan avatar.
export function compactSocialPostImages(posts, characters) {
  if (!Array.isArray(posts)) return posts;
  const charactersById = characterMapById(characters);
  let changed = false;
  const next = posts.map((post) => {
    if (!post || typeof post !== "object") return post;
    let normalized = post;
    const isPlayerPost = post.authorType === "player" || (!post.authorType && !post.charId);
    const hasLiveCharacter = post.charId !== null && post.charId !== undefined && charactersById.has(String(post.charId));

    if (isPlayerPost || hasLiveCharacter) {
      normalized = withoutKeys(normalized, ["authorAvatar", "charAvatar"]);
    } else if (hasOwn(normalized, "authorAvatar") && hasOwn(normalized, "charAvatar")) {
      normalized = withoutKeys(normalized, ["charAvatar"]);
    }

    if (Array.isArray(post.comments)) {
      let commentsChanged = false;
      const comments = post.comments.map((comment) => {
        const compacted = withoutKeys(comment, ["charAvatar", "authorAvatar"]);
        if (compacted !== comment) commentsChanged = true;
        return compacted;
      });
      if (commentsChanged) normalized = { ...normalized, comments };
    }

    if (Array.isArray(post.likedBy)) {
      let likedByChanged = false;
      const likedBy = post.likedBy.map((reaction) => {
        const compacted = withoutKeys(reaction, ["charAvatar", "authorAvatar"]);
        if (compacted !== reaction) likedByChanged = true;
        return compacted;
      });
      if (likedByChanged) normalized = { ...normalized, likedBy };
    }

    if (normalized !== post) changed = true;
    return normalized;
  });
  return changed ? next : posts;
}

// New group messages resolve avatars through speakerId. For legacy messages,
// infer the ID from a unique member name; keep the old image only for an
// orphan/ambiguous speaker that cannot be resolved safely.
export function compactGroupMessageImages(groups, characters) {
  if (!Array.isArray(groups)) return groups;
  const charactersById = characterMapById(characters);
  let changed = false;
  const next = groups.map((group) => {
    if (!group || !Array.isArray(group.messages)) return group;
    const memberIds = Array.isArray(group.memberIds) && group.memberIds.length
      ? new Set(group.memberIds.map(String))
      : null;
    const members = [...charactersById.values()].filter((character) => !memberIds || memberIds.has(String(character.id)));
    const membersByName = new Map();
    members.forEach((character) => {
      const name = String(character.name || "").trim();
      if (!name) return;
      const existing = membersByName.get(name);
      membersByName.set(name, existing ? null : character);
    });

    let messagesChanged = false;
    const messages = group.messages.map((message) => {
      if (!message || typeof message !== "object") return message;
      if (message.role === "user") {
        const compacted = withoutKeys(message, ["speakerAvatar"]);
        if (compacted !== message) messagesChanged = true;
        return compacted;
      }

      const existingCharacter = message.speakerId !== null && message.speakerId !== undefined
        ? charactersById.get(String(message.speakerId))
        : null;
      const inferredCharacter = existingCharacter || membersByName.get(String(message.speakerName || "").trim());
      if (!inferredCharacter) return message;

      let compacted = message;
      if (message.speakerId === null || message.speakerId === undefined) compacted = { ...compacted, speakerId: inferredCharacter.id };
      compacted = withoutKeys(compacted, ["speakerAvatar"]);
      if (compacted !== message) messagesChanged = true;
      return compacted;
    });

    if (!messagesChanged) return group;
    changed = true;
    return { ...group, messages };
  });
  return changed ? next : groups;
}

// The active room is mirrored into the top-level chatHistory/memories/chatScenes
// state so the live chat UI can update cheaply. Keeping the same active room
// payload inside chatRooms makes JSON backups serialize every embedded base64
// image twice. Export an explicit marker instead; loadRoomState restores the
// omitted fields from their top-level canonical copies during import.
export function compactActiveRoomMirrors(chatRooms, activeRoomIds) {
  if (!chatRooms || typeof chatRooms !== "object") return chatRooms;
  let changed = false;
  const next = {};
  for (const [characterId, rooms] of Object.entries(chatRooms)) {
    if (!Array.isArray(rooms)) {
      next[characterId] = rooms;
      continue;
    }
    const activeRoomId = activeRoomIds?.[characterId];
    next[characterId] = rooms.map((room) => {
      if (!room || String(room.id) !== String(activeRoomId)) return room;
      changed = true;
      const compacted = withoutKeys(room, ["messages", "memories", "scene"]);
      return { ...compacted, activeDataInTopLevel: true };
    });
  }
  return changed ? next : chatRooms;
}
