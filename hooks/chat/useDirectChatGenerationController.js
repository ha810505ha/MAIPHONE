import { loadDirectChatGenerator } from "../../utils/featurePreload";
import { hasChatCalendarEvent } from "../../services/calendar/calendarEventStore";
import { gid } from "../../utils/coreUtils";
import {
  REALITY_CHAT_TEXT_LIMIT,
  estimateTokens,
  extractTransferDirective,
  extractTransferResponseDirective,
  normalizeAssistantReply,
  normalizeRealityReply,
  splitAssistantBubbles,
  stripInternalBlocks,
  stripModeLabel,
} from "../../utils/chatMessageUtils";
import {
  buildCharacterBlockCapabilityContext,
  buildCharacterBlockPromptContext,
  extractCharacterBlockDirective,
} from "../../services/chat/characterBlockState";

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Bridges the direct-chat generator with the app's domain state.
 *
 * The generator remains lazy-loaded and provider-agnostic; this controller
 * only supplies the current prompt context, wallet/block/calendar callbacks,
 * and message persistence boundary.
 */
export default function useDirectChatGenerationController({
  isChatRealTimeEnabled,
  formatMessagesForPrompt,
  pickMemoriesForPrompt,
  pickLorebookEntriesForPrompt,
  characterWallets,
  formatMoney,
  tr,
  getPlayerContextBlock,
  getCalendarContext,
  getCalendarReminderContext,
  estimateContextTokens = estimateTokens,
  totalContextTokenLimit = 40000,
  apiConfig,
  applyUserPlaceholder,
  buildChatSystemPrompt,
  callAI,
  sanitizeText,
  updateChatMessages,
  applyCharacterTransferToPlayer,
  transfers,
  handleCharacterTransferDecision,
  characterBlockStates,
  applyCharacterBlockDirective,
  isInnerThoughtAutoEnabled,
  generateInnerThought,
  createId = gid,
}) {
  const generateAssistantForHistory = async (args) => {
    const { generateDirectAssistant } = await loadDirectChatGenerator();
    return generateDirectAssistant(
      { ...args, includeRealTime: isChatRealTimeEnabled(args.cid) },
      {
        formatMessagesForPrompt,
        pickMemoriesForPrompt,
        pickLorebookEntriesForPrompt,
        characterWallets,
        formatMoney,
        tr,
        getPlayerContextBlock,
        getCalendarContext,
        getCalendarReminderContext,
        isCalendarProposalDuplicate: (proposal, characterId) => (
          hasChatCalendarEvent({ proposal, characterId }).catch(() => false)
        ),
        estimateTokens: estimateContextTokens,
        totalContextTokenLimit,
        apiConfig,
        applyUserPlaceholder,
        buildChatSystemPrompt,
        callAI,
        sanitizeText,
        normalizeRealityReply,
        realityChatTextLimit: REALITY_CHAT_TEXT_LIMIT,
        normalizeAssistantReply,
        extractTransferDirective,
        extractTransferResponseDirective,
        stripModeLabel,
        stripInternalBlocks,
        splitAssistantBubbles,
        createId,
        wait,
        updateChatMessages,
        applyCharacterTransferToPlayer,
        transfers,
        handleCharacterTransferDecision,
        characterBlockStates,
        buildCharacterBlockPromptContext,
        buildCharacterBlockCapabilityContext,
        extractCharacterBlockDirective,
        applyCharacterBlockDirective,
        isInnerThoughtAutoEnabled,
        generateInnerThought,
      },
    );
  };

  return { generateAssistantForHistory };
}
