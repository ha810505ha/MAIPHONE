import { DOCK_APPS } from "../../constants/appConstants";
import { HOME_SLOT_COUNT } from "../../utils/homeLayout";
import { clearDeviceSecrets } from "../../utils/indexedDbStorage";
import { resetFeatureData } from "../../services/featureBackupService";

/**
 * Resets local app data after the user confirms. The reset contract lives
 * beside the snapshot/import controller so destructive data operations do not
 * grow inside the main MaliPhone component.
 */
export default function useAppReset({
  defaultAppState,
  applyLocalAppDataSnapshot,
  personaController,
  resetChatroomImport,
  resetDataImport,
  clearRooms,
  clearVoicePlaybackCache,
  armAppClickSuppression,
  tr,
  sanitizeText,
  showToast,
  setters,
}) {
  const {
    setCharacters,
    setActiveCharId,
    setCurrentChatChar,
    setCurrentChatGroup,
    setChatHistory,
    setChatModes,
    setChatBackgrounds,
    setGroupChats,
    setInnerThoughtSettings,
    setProactiveSettings,
    setProactiveUnread,
    setExpandedInnerThoughts,
    setInnerThoughtLoading,
    setChatScenes,
    setGroupScenes,
    setChatLorebookBindings,
    setPosts,
    setMemories,
    setLorebooks,
    setActiveLorebookId,
    setPhoneInboxCache,
    setPhoneAppCache,
    setWallet,
    setCharacterWallets,
    setTransfers,
    setCharacterBlockStates,
    setApiPresets,
    setPlayerProfile,
    setApiConfig,
    setTtsConfig,
    setScreenLockTimeout,
    setHomeSlots,
    setDockOrder,
    setPhonePage,
    setPhoneViewCharId,
    setPhoneActiveThreadId,
    setCurrentApp,
    setModal,
    setUpdateNoticeOpen,
    setChatSettingsOpen,
    setChatSettingsBackgroundOpen,
    setChatSettingsLorebookOpen,
    setChatroomManageOpen,
    setChatSettingsExpandedBooks,
    setChatBgEditor,
    setChatVisibleCounts,
    setActiveMessageId,
    setMessageEditor,
    setIsTyping,
    setChatInput,
    setChatImage,
    setPlayerPostModalOpen,
    setPlayerPostText,
    setTransferModalOpen,
    setTransferAmount,
    setTransferNote,
    setSocialReplyTarget,
    setExpandedSocialPosts,
  } = setters;

  return async function clearAllData() {
    if (!confirm(tr(
      "確定要清空所有資料嗎？",
      "Are you sure you want to clear all data?",
      "本当にすべてのデータを消去しますか？",
      "정말 모든 데이터를 삭제할까요?",
    ))) return;

    try {
      await resetFeatureData();
      await clearDeviceSecrets();
      const { clearImageApiConfig } = await import("../../services/images/galleryImageStorage");
      await clearImageApiConfig();
      applyLocalAppDataSnapshot({}, { replace: true });
    } catch (error) {
      showToast(`${tr(
        "清空資料失敗",
        "Failed to clear data",
        "データの消去に失敗しました",
        "데이터 삭제 실패",
      )}：${sanitizeText(error?.message || "Unknown error", 80)}`);
      return;
    }

    setCharacters([]);
    setActiveCharId(null);
    setCurrentChatChar(null);
    setCurrentChatGroup(null);
    setChatHistory({});
    clearRooms();
    setChatModes({});
    setChatBackgrounds({});
    setGroupChats([]);
    setInnerThoughtSettings({});
    setProactiveSettings({});
    setProactiveUnread({});
    setExpandedInnerThoughts({});
    setInnerThoughtLoading({});
    setChatScenes({});
    setGroupScenes({});
    setChatLorebookBindings({});
    setPosts([]);
    setMemories({});
    setLorebooks([]);
    setActiveLorebookId(null);
    setPhoneInboxCache({});
    setPhoneAppCache({});
    setWallet(defaultAppState.wallet);
    setCharacterWallets({});
    setTransfers([]);
    setCharacterBlockStates({});
    personaController.resetPersonas(defaultAppState);
    setApiPresets(defaultAppState.apiPresets);
    setPlayerProfile(defaultAppState.playerProfile);
    setApiConfig(defaultAppState.apiConfig);
    setTtsConfig(defaultAppState.ttsConfig);
    clearVoicePlaybackCache();
    setScreenLockTimeout(defaultAppState.screenLockTimeout);
    setHomeSlots(Array.from({ length: HOME_SLOT_COUNT }, () => null));
    setDockOrder(DOCK_APPS);
    setPhonePage("picker");
    setPhoneViewCharId(null);
    setPhoneActiveThreadId("player");
    armAppClickSuppression();
    setCurrentApp(null);
    setModal(null);
    setUpdateNoticeOpen(false);
    setChatSettingsOpen(false);
    setChatSettingsBackgroundOpen(false);
    setChatSettingsLorebookOpen(false);
    setChatroomManageOpen(false);
    setChatSettingsExpandedBooks({});
    setChatBgEditor(null);
    setChatVisibleCounts({});
    setActiveMessageId(null);
    setMessageEditor(null);
    setIsTyping(false);
    setChatInput("");
    setChatImage(null);
    setPlayerPostModalOpen(false);
    setPlayerPostText("");
    setTransferModalOpen(false);
    setTransferAmount("");
    setTransferNote("");
    setSocialReplyTarget(null);
    setExpandedSocialPosts({});
    resetChatroomImport?.();
    resetDataImport?.();
    try { localStorage.removeItem("mali_seen_version"); } catch {}
    showToast(tr("資料已清空", "Data cleared", "データを消去しました", "데이터를 삭제했습니다"));
  };
}
