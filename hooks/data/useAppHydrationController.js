import { DEFAULT_APPS, DOCK_APPS } from "../../constants/appConstants";
import { FONT_PRESETS } from "../../styles/themePresets";
import { normalizeCharacterBlockStates } from "../../services/chat/characterBlockState";
import { normalizeUiLanguage } from "../../utils/i18n";
import { HOME_PAGE_SIZE, HOME_SLOT_COUNT, normalizeHomeSlots } from "../../utils/homeLayout";

/**
 * Owns the persisted app-state hydration and legacy migration boundary.
 *
 * Loading a snapshot touches several domains at once (personas, chat rooms,
 * notifications, settings, home layout, and feature caches). Keeping that
 * orchestration here prevents the root phone component from becoming another
 * persistence implementation whenever a field is added.
 */
export default function useAppHydrationController({
  defaultAppState,
  personaController,
  loadRoomState,
  notificationCenter,
  createId,
  setters,
}) {
  const {
    setCharacters,
    setActiveCharId,
    setChatHistory,
    setChatModes,
    setChatBackgrounds,
    setGroupChats,
    setChatScenes,
    setGroupScenes,
    setChatTimeSettings,
    setInnerThoughtSettings,
    setProactiveSettings,
    setProactiveUnread,
    setPosts,
    setSocialSettings,
    setMemories,
    setPhoneInboxCache,
    setPhoneAppCache,
    setWallet,
    setCharacterWallets,
    setTransfers,
    setCharacterBlockStates,
    setScreenLockTimeout,
    setCustomPrompts,
    setApiPresets,
    setPlayerProfile,
    setChatLorebookBindings,
    setLorebooks,
    setActiveLorebookId,
    setApiConfig,
    setTtsConfig,
    setThemeName,
    setFontName,
    setFontSizeScale,
    setUiLanguage,
    setDockOrder,
    setHomeSlots,
    setCurrentChatChar,
    setCurrentChatGroup,
    setChatInput,
    setChatImage,
    setIsTyping,
  } = setters;

  const applyLoadedAppState = (input = {}) => {
    const personaState = personaController.hydratePersonas(input);
    const data = { ...input, ...personaState.activeData };
    const roomState = loadRoomState(data, data.characters || []);
    const characterChatMeta = data.characterChatMeta || {};

    setCharacters(roomState.characters.map((character) => {
      const meta = characterChatMeta[character.id];
      if (!meta) return character;
      return {
        ...character,
        pinned: !!meta.pinned,
        chatOpenedAt: Number(meta.chatOpenedAt) || 0,
        chatroomDeleted: !!meta.chatroomDeleted,
        chatroomDeletedAt: Number(meta.chatroomDeletedAt) || 0,
      };
    }));
    setActiveCharId(data.activeCharId ?? null);
    setChatHistory(roomState.chatHistory);
    setChatModes(data.chatModes || {});
    setChatBackgrounds(
      data.chatBackgrounds && typeof data.chatBackgrounds === "object"
        ? data.chatBackgrounds
        : defaultAppState.chatBackgrounds,
    );
    setGroupChats(Array.isArray(data.groupChats) ? data.groupChats : []);
    setChatScenes(roomState.chatScenes);
    setGroupScenes(
      data.groupScenes && typeof data.groupScenes === "object"
        ? data.groupScenes
        : defaultAppState.groupScenes,
    );
    setChatTimeSettings(
      data.chatTimeSettings && typeof data.chatTimeSettings === "object"
        ? data.chatTimeSettings
        : defaultAppState.chatTimeSettings,
    );
    setInnerThoughtSettings(
      data.innerThoughtSettings && typeof data.innerThoughtSettings === "object"
        ? data.innerThoughtSettings
        : defaultAppState.innerThoughtSettings,
    );
    setProactiveSettings(
      data.proactiveSettings && typeof data.proactiveSettings === "object"
        ? data.proactiveSettings
        : defaultAppState.proactiveSettings,
    );
    setProactiveUnread(
      data.proactiveUnread && typeof data.proactiveUnread === "object"
        ? data.proactiveUnread
        : defaultAppState.proactiveUnread,
    );
    notificationCenter.hydrate(data);
    setPosts(data.posts || []);
    setSocialSettings({
      ...defaultAppState.socialSettings,
      ...(data.socialSettings && typeof data.socialSettings === "object" ? data.socialSettings : {}),
    });
    setMemories(roomState.memories);
    setPhoneInboxCache(data.phoneInboxCache || {});
    setPhoneAppCache(data.phoneAppCache || {});
    setWallet(data.wallet || defaultAppState.wallet);
    setCharacterWallets(data.characterWallets || {});
    setTransfers(Array.isArray(data.transfers) ? data.transfers : []);
    setCharacterBlockStates(normalizeCharacterBlockStates(data.characterBlockStates));
    setScreenLockTimeout(
      Number.isFinite(Number(data.screenLockTimeout))
        ? Number(data.screenLockTimeout)
        : defaultAppState.screenLockTimeout,
    );
    setCustomPrompts(
      data.customPrompts && typeof data.customPrompts === "object"
        ? { ...defaultAppState.customPrompts, ...data.customPrompts }
        : { ...defaultAppState.customPrompts },
    );
    setApiPresets(
      Array.isArray(data.apiPresets) && data.apiPresets.length
        ? data.apiPresets
        : defaultAppState.apiPresets,
    );
    setPlayerProfile(data.playerProfile || defaultAppState.playerProfile);
    setChatLorebookBindings(data.chatLorebookBindings || {});

    const loadedLorebooks = Array.isArray(data.lorebooks) ? data.lorebooks : [];
    if (loadedLorebooks.length) {
      setLorebooks(loadedLorebooks);
      setActiveLorebookId(loadedLorebooks[0]?.id || null);
    } else if (Array.isArray(data.lorebookEntries) && data.lorebookEntries.length) {
      const migrated = [{
        id: createId(),
        name: "預設世界書",
        description: "",
        enabled: true,
        updatedAt: Date.now(),
        entries: data.lorebookEntries,
      }];
      setLorebooks(migrated);
      setActiveLorebookId(migrated[0].id);
    } else {
      setLorebooks([]);
      setActiveLorebookId(null);
    }

    setApiConfig({
      ...defaultAppState.apiConfig,
      ...(data.apiConfig && typeof data.apiConfig === "object" ? data.apiConfig : {}),
      aiSource: data.apiConfig?.aiSource === "hosted_test" ? "hosted_test" : "personal",
    });
    setTtsConfig(
      data.ttsConfig && typeof data.ttsConfig === "object"
        ? {
          ...defaultAppState.ttsConfig,
          ...data.ttsConfig,
          elevenlabs: { ...defaultAppState.ttsConfig.elevenlabs, ...(data.ttsConfig.elevenlabs || {}) },
          minimax: { ...defaultAppState.ttsConfig.minimax, ...(data.ttsConfig.minimax || {}) },
        }
        : defaultAppState.ttsConfig,
    );
    setThemeName(data.themeName || defaultAppState.themeName);
    setFontName(FONT_PRESETS[data.fontName] ? data.fontName : defaultAppState.fontName);
    setFontSizeScale(
      ["normal", "large", "xlarge", "xxlarge"].includes(data.fontSizeScale)
        ? data.fontSizeScale
        : defaultAppState.fontSizeScale,
    );
    setUiLanguage(normalizeUiLanguage(data.uiLanguage, defaultAppState.uiLanguage));

    const initialDock = Array.isArray(data.dockOrder) ? data.dockOrder : DOCK_APPS;
    setDockOrder(initialDock);
    if (Array.isArray(data.homeSlots) && data.homeSlots.length === HOME_SLOT_COUNT) {
      setHomeSlots(normalizeHomeSlots(data.homeSlots, DEFAULT_APPS.map((app) => app.id), initialDock));
    } else {
      const fallbackOrder = Array.isArray(data.homeOrder)
        ? data.homeOrder
        : DEFAULT_APPS.filter((app) => !DOCK_APPS.includes(app.id)).map((app) => app.id);
      const nextSlots = Array.from({ length: HOME_SLOT_COUNT }, () => null);
      fallbackOrder
        .filter((id) => !initialDock.includes(id))
        .slice(0, HOME_PAGE_SIZE)
        .forEach((id, index) => { nextSlots[HOME_PAGE_SIZE + index] = id; });
      setHomeSlots(normalizeHomeSlots(nextSlots, DEFAULT_APPS.map((app) => app.id), initialDock));
    }

    setCurrentChatChar(null);
    setCurrentChatGroup(null);
    setChatInput("");
    setChatImage(null);
    setIsTyping(false);
  };

  return { applyLoadedAppState };
}
