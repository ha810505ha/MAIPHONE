import useGroupChatAI from "./useGroupChatAI";
import { getGroupMemberProfileText, buildGroupChatSystemPrompt, parseGroupReplies } from "../../services/chat/groupChatHelpers";
import { generateGroupReplies } from "../../services/chat/groupChatGenerator";
import { stripInternalBlocks } from "../../utils/chatMessageUtils";

/**
 * Adapts the group-chat UI state to the group reply generator.
 *
 * Group CRUD remains in useGroupChatController; this boundary owns only
 * prompt construction, member profile projection, reply parsing, and the
 * send/retry hook wiring.
 */
export default function useGroupChatGenerationController({
  currentGroup,
  isTyping,
  input,
  image,
  pseudoImage,
  setInput,
  setImage,
  setPseudoImage,
  setActionPanelOpen,
  setIsTyping,
  setGroups,
  getMembers,
  getPlayerName,
  isGroupRealTimeEnabled,
  groupScenes,
  apiConfig,
  callAI,
  sanitizeText,
  createId,
  connectionErrorPrefix,
  tr,
  outputLanguageDirective,
}) {
  const buildGroupPrompt = (group, memberNames, memberProfiles, recent) => buildGroupChatSystemPrompt({
    group,
    memberNames,
    memberProfiles,
    recent,
    groupScenes,
    sanitizeText,
    outputLanguageDirective,
  });

  const parseGroupReplyPayload = (raw) => parseGroupReplies(raw, sanitizeText);

  const generateReplies = ({ group, members, messages, currentImage, signal }) => generateGroupReplies({
    group,
    members: members.map((member) => ({ ...member, profileText: getGroupMemberProfileText(member, sanitizeText) })),
    messages,
    currentImage,
    signal,
    includeRealTime: isGroupRealTimeEnabled(group),
    apiConfig,
    callAI,
    buildSystemPrompt: buildGroupPrompt,
    parseReplies: parseGroupReplyPayload,
    stripInternalBlocks,
    sanitizeText,
    tr,
  });

  return useGroupChatAI({
    currentGroup,
    isTyping,
    input,
    image,
    pseudoImage,
    setInput,
    setImage,
    setPseudoImage,
    setActionPanelOpen,
    setIsTyping,
    setGroups,
    getMembers,
    getPlayerName,
    sanitizeText,
    createId,
    generateReplies,
    connectionErrorPrefix,
    tr,
  });
}
