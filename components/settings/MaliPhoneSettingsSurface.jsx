import React, { useRef, useState } from "react";
import { API_PROVIDERS, VERSION } from "../../constants/appConstants";
import { DEFAULT_APP_STATE } from "../../constants/defaultAppState";
import { callAI, fetchAvailableModels } from "../../services/aiService";
import { countUnreadMails } from "../../services/mailbox/mailboxService";
import { hasBalancedBraces, sanitizeCustomCss } from "../../utils/customCss";
import { clampCropPan } from "../../utils/imageCrop";
import { sanitizeText } from "../../utils/coreUtils";
import { lazyWithRetry } from "../../utils/lazyWithRetry.js";
import { heroImgStyle } from "../home/PeachHero";

const SettingsApp = lazyWithRetry(() => import("./SettingsApp.jsx"));

function sortModelsByProvider(provider, models) {
  const list = [...(models || [])];
  if (provider !== "openrouter") return list;
  const companyOf = (model) => {
    const value = String(model || "");
    const slash = value.indexOf("/");
    return slash > 0 ? value.slice(0, slash).toLowerCase() : "zzz";
  };
  const isFree = (model) => /:free$/i.test(String(model || ""));
  return list.sort((a, b) => {
    const freeDiff = Number(isFree(b)) - Number(isFree(a));
    if (freeDiff !== 0) return freeDiff;
    const companyA = companyOf(a);
    const companyB = companyOf(b);
    if (companyA !== companyB) return companyA.localeCompare(companyB);
    return String(a).localeCompare(String(b));
  });
}

export default function MaliPhoneSettingsSurface({
  auth,
  api,
  appearance,
  core,
  data,
  mailboxMails,
  notifications,
  release,
  voice,
}) {
  const { closeApp, isNightTheme, notify, settingsTab, setSettingsTab, showToast, t, tr } = core;
  const [tempConfig, setTempConfig] = useState(() => ({ ...(api.config || {}) }));
  const [providerModelOptions, setProviderModelOptions] = useState({});
  const [fetchingModels, setFetchingModels] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [presetSavePickerOpen, setPresetSavePickerOpen] = useState(false);
  const [clearCacheArmed, setClearCacheArmed] = useState(false);
  const [versionOpen, setVersionOpen] = useState(false);
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);
  const [aiConnectionOpen, setAiConnectionOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [resetDataOpen, setResetDataOpen] = useState(false);
  const [heroDraft, setHeroDraft] = useState(null);
  const heroFileRef = useRef(null);
  const heroDragRef = useRef(null);

  const config = tempConfig || api.config;
  const provider = API_PROVIDERS.find((item) => item.id === config.provider);
  const modelOptions = providerModelOptions[config.provider] || provider?.models || [];
  const activeVoiceConfig = voice.config[voice.config.provider] || {};
  const availableVoices = voice.voices.length
    ? voice.voices
    : (voice.config.elevenlabs?.availableVoices || []);

  const updateHostedTestModel = (providerId, model) => {
    const patch = { hostedTestProvider: providerId || "", hostedTestModel: model || "" };
    setTempConfig((current) => ({ ...current, ...patch }));
    if (api.config?.aiSource === "hosted_test") {
      api.setConfig((current) => ({ ...current, ...patch }));
    }
  };

  const changeAiSource = (source, providerId = "", model = "") => {
    const patch = {
      aiSource: source === "hosted_test" ? "hosted_test" : "personal",
      ...(source === "hosted_test" ? { hostedTestProvider: providerId, hostedTestModel: model } : {}),
    };
    setTempConfig((current) => ({ ...current, ...patch }));
    api.setConfig((current) => ({ ...current, ...patch }));
    if (source === "hosted_test") setAiConnectionOpen(false);
  };

  const getProviderBaseUrl = (providerId, fallback = "") => {
    const found = API_PROVIDERS.find((item) => item.id === providerId);
    return providerId === "custom" ? fallback : (found?.baseUrl || fallback || "");
  };

  const applyApiPreset = (index) => {
    const preset = api.presets[index];
    if (!preset) return;
    const providerId = preset.provider || "openai";
    const nextConfig = {
      ...(api.config || {}),
      provider: providerId,
      baseUrl: getProviderBaseUrl(providerId, preset.baseUrl || api.config?.baseUrl || ""),
      apiKey: preset.apiKey || "",
      model: preset.model || api.config?.model || "",
    };
    setTempConfig(nextConfig);
    api.setConfig(nextConfig);
    showToast(`已套用 ${preset.name || `預設 ${index + 1}`}`);
  };

  const activePresetIndex = (api.presets || []).findIndex((preset) => (
    preset
    && preset.provider === config.provider
    && preset.baseUrl === config.baseUrl
    && preset.apiKey === config.apiKey
    && preset.model === config.model
  ));

  const saveApiPreset = (index) => {
    api.setPresets((previous) => {
      const list = [...(previous || [])];
      const fallback = DEFAULT_APP_STATE.apiPresets[index]
        || { id: `preset-${index + 1}`, name: `預設 ${index + 1}` };
      list[index] = {
        id: list[index]?.id || fallback.id,
        name: list[index]?.name || fallback.name,
        provider: config.provider,
        baseUrl: getProviderBaseUrl(config.provider, config.baseUrl),
        apiKey: config.apiKey,
        model: config.model,
      };
      return list;
    });
    notify(
      tr("已儲存到預設", `Saved to preset ${index + 1}`, `プリセット ${index + 1} に保存しました`, `프리셋 ${index + 1}에 저장되었습니다`),
      `Saved to preset ${index + 1}`,
    );
  };

  const fetchLatestModels = async () => {
    try {
      setFetchingModels(true);
      const models = sortModelsByProvider(config.provider, await fetchAvailableModels(config));
      if (!models.length) {
        throw new Error(tr("找不到可用模型", "No models found", "利用可能なモデルが見つかりません", "사용 가능한 모델을 찾을 수 없습니다"));
      }
      setProviderModelOptions((previous) => ({ ...previous, [config.provider]: models }));
      setTempConfig((current) => ({
        ...current,
        model: models.includes(current.model) ? current.model : models[0],
      }));
      showToast(tr(`已抓取 ${models.length} 個模型`, `Fetched ${models.length} models`, `${models.length}件のモデルを取得しました`, `모델 ${models.length}개를 가져왔습니다`));
    } catch (error) {
      const message = config.provider === "vertex"
        ? tr("抓取失敗，可手動輸入模型名稱", "Fetch failed; you can type the model name manually", "取得に失敗しました。モデル名を手動入力できます", "가져오기에 실패했습니다. 모델 이름을 직접 입력할 수 있습니다")
        : tr("抓取失敗", "Fetch failed", "取得に失敗しました", "가져오기 실패");
      showToast(`${message}：${error.message}`);
    } finally {
      setFetchingModels(false);
    }
  };

  const testApiConnection = async () => {
    if (testingConnection) return;
    setTestingConnection(true);
    try {
      const reply = await callAI(
        [{ role: "user", content: "請只回覆 OK" }],
        config,
        "你是連線測試助手，只能回覆 OK。",
        { app: "settings", action: "connection_test" },
      );
      const ok = /\bOK\b|ＯＫ/i.test(String(reply || "").trim());
      notify("連線成功", ok
        ? "Connection successful"
        : `Connected, but the reply looks odd: ${sanitizeText(reply, 40) || "empty"}`);
    } catch (error) {
      notify("連線失敗", `Connection failed: ${sanitizeText(error?.message || "unknown error", 120)}`);
    }
    setTestingConnection(false);
  };

  const clearSiteCache = async () => {
    try {
      if (!clearCacheArmed) {
        setClearCacheArmed(true);
        showToast(tr("再按一次清除快取", "Tap again to clear cache", "もう一度押すとキャッシュを削除します", "한 번 더 누르면 캐시를 삭제합니다"));
        setTimeout(() => setClearCacheArmed(false), 3000);
        return;
      }
      setClearCacheArmed(false);
      if (!window.confirm(tr("確定要清除網站快取並重新載入嗎？", "Clear site cache and reload?", "サイトキャッシュを削除して再読み込みしますか？", "사이트 캐시를 삭제하고 다시 불러올까요?"))) return;
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
      if ("serviceWorker" in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration) => registration.unregister()));
      }
      showToast(tr("快取已清除，正在重新載入", "Cache cleared, reloading now", "キャッシュを削除しました。再読み込みしています", "캐시를 삭제했습니다. 다시 불러오는 중입니다"));
      setTimeout(() => window.location.reload(), 250);
    } catch (error) {
      showToast(`${tr("清除快取失敗", "Failed to clear cache", "キャッシュ削除に失敗しました", "캐시 삭제 실패")}：${error?.message || tr("未知錯誤", "Unknown error", "不明なエラー", "알 수 없는 오류")}`);
    }
  };

  const beginHeroEdit = (
    src = appearance.hero.sanitizeImage(
      appearance.hero.activeCharacter?.heroImage
      || appearance.hero.activeCharacter?.avatarOriginal
      || appearance.hero.activeCharacter?.avatar,
    ),
    sourceType = appearance.hero.activeCharacter?.heroImage ? "hero" : "avatar",
  ) => {
    const activeCharacter = appearance.hero.activeCharacter;
    if (!activeCharacter) return;
    const saved = activeCharacter.heroView || {};
    setHeroDraft({
      src: src || "",
      sourceType,
      x: Number(saved.x) || 0,
      y: Number(saved.y) || 0,
      zoom: Number(saved.zoom) || 1,
    });
  };

  const onHeroFile = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !appearance.hero.activeCharacter) return;
    if (!file.type.startsWith("image/")) {
      showToast(tr("請選擇圖片檔案", "Choose an image file", "画像ファイルを選択してください", "이미지 파일을 선택하세요"));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast(tr("立繪圖片請小於 5MB", "Hero image must be under 5MB", "立ち絵は5MB未満にしてください", "이미지는 5MB 이하여야 합니다"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const safe = appearance.hero.sanitizeImage(String(reader.result || ""));
      if (safe) setHeroDraft({ src: safe, sourceType: "hero", x: 0, y: 0, zoom: 1 });
    };
    reader.readAsDataURL(file);
  };

  const startHeroDrag = (event) => {
    if (!heroDraft?.src) return;
    event.preventDefault();
    heroDragRef.current = {
      px: event.clientX,
      py: event.clientY,
      x: heroDraft.x,
      y: heroDraft.y,
    };
    try { event.currentTarget.setPointerCapture?.(event.pointerId); } catch (_) {}
  };

  const moveHeroDrag = (event) => {
    const drag = heroDragRef.current;
    if (!drag) return;
    event.preventDefault();
    setHeroDraft((current) => {
      if (!current) return current;
      const zoom = Math.max(1, Number(current.zoom) || 1);
      return {
        ...current,
        x: clampCropPan(drag.x + (event.clientX - drag.px) / (2 * zoom), 50),
        y: clampCropPan(drag.y + (event.clientY - drag.py) / (1.5 * zoom), 50),
      };
    });
  };

  const endHeroDrag = (event) => {
    heroDragRef.current = null;
    try { event.currentTarget.releasePointerCapture?.(event.pointerId); } catch (_) {}
  };

  const saveHeroDraft = () => {
    const activeCharacter = appearance.hero.activeCharacter;
    if (!activeCharacter || !heroDraft?.src) return;
    appearance.hero.setCharacters((list) => list.map((item) => (
      item.id === activeCharacter.id
        ? {
            ...item,
            ...(heroDraft.sourceType === "hero" ? { heroImage: heroDraft.src } : {}),
            heroView: { x: heroDraft.x, y: heroDraft.y, zoom: heroDraft.zoom },
          }
        : item
    )));
    setHeroDraft(null);
    showToast(tr("桌面立繪已儲存", "Hero image saved", "立ち絵を保存しました", "이미지를 저장했습니다"));
  };

  const settingsAppearance = {
    open: appearance.open,
    toggleOpen: () => appearance.setOpen((value) => !value),
    themeProps: { t, tr, ...appearance.theme },
    cssProps: {
      tr,
      ...appearance.css,
      sanitize: sanitizeCustomCss,
      onReset: () => {
        appearance.css.setDraft("");
        appearance.css.setValue("");
        appearance.css.setEnabled(false);
        appearance.css.setNotice(tr("已重設", "Reset", "リセットしました", "초기화됨"));
        try { localStorage.removeItem("mali_custom_css"); } catch {}
      },
      onApply: (safe) => {
        if (!hasBalancedBraces(safe)) {
          appearance.css.setNotice(tr("大括號 { } 不成對，請檢查後再儲存", "Unbalanced braces { }, please check before saving", "波かっこ { } が対応していません。確認してください", "중괄호 { }가 맞지 않습니다. 확인해주세요"));
          return;
        }
        appearance.css.setDraft(safe);
        appearance.css.setValue(safe);
        appearance.css.setEnabled(true);
        appearance.css.setNotice(tr("已儲存並套用", "Saved and applied", "保存して適用しました", "저장 및 적용됨"));
        try { localStorage.setItem("mali_custom_css", safe); } catch {}
      },
    },
    heroProps: {
      tr,
      activeChar: appearance.hero.activeCharacter,
      heroFileRef,
      onHeroFile,
      heroDraft,
      setHeroDraft,
      beginHeroEdit,
      removeHero: () => {
        const activeCharacter = appearance.hero.activeCharacter;
        if (!activeCharacter) return;
        appearance.hero.setCharacters((list) => list.map((item) => (
          item.id === activeCharacter.id ? { ...item, heroImage: "", heroView: null } : item
        )));
      },
      startDrag: startHeroDrag,
      moveDrag: moveHeroDrag,
      endDrag: endHeroDrag,
      heroImgStyle,
      saveDraft: saveHeroDraft,
    },
    interfaceProps: { t, tr, ...appearance.interface },
  };

  const settingsApi = {
    presetProps: {
      tr,
      activePresetIndex,
      config,
      onApplyPreset: applyApiPreset,
    },
    connectionProps: {
      t,
      tr,
      open: aiConnectionOpen,
      setOpen: setAiConnectionOpen,
      config,
      setConfig: setTempConfig,
      providers: API_PROVIDERS,
      modelOptions,
      fetchingModels,
      onFetchModels: fetchLatestModels,
      testingConnection,
      onTest: testApiConnection,
      onProviderChange: (providerId) => {
        const nextProvider = API_PROVIDERS.find((item) => item.id === providerId);
        setTempConfig((current) => ({
          ...current,
          provider: nextProvider.id,
          baseUrl: getProviderBaseUrl(nextProvider.id, current?.baseUrl || ""),
          model: nextProvider.models[0] || "",
        }));
      },
      disabled: config.aiSource === "hosted_test",
      onSave: () => {
        api.setConfig(config);
        notify(tr("設定已儲存", "Settings saved", "設定を保存しました", "설정이 저장되었습니다"), "Settings saved");
      },
      onSavePreset: () => setPresetSavePickerOpen(true),
    },
    hostedTestProps: {
      auth,
      tr,
      showToast,
      apiConfig: config,
      onSourceChange: changeAiSource,
      onHostedModelChange: updateHostedTestModel,
    },
    voiceProps: {
      tr,
      open: voiceOpen,
      setOpen: setVoiceOpen,
      config: voice.config,
      setConfig: voice.setConfig,
      activeConfig: activeVoiceConfig,
      updateConfig: (patch) => {
        voice.setConnectionState("idle");
        voice.setVoices([]);
        voice.setConfig((current) => ({
          ...current,
          [current.provider]: { ...(current[current.provider] || {}), ...patch },
        }));
      },
      voices: availableVoices,
      connectionState: voice.connectionState,
      onLoadVoices: () => void voice.loadDefaultVoices(),
      onPreview: () => void voice.previewDefaultVoice(),
    },
  };

  return (
    <SettingsApp
      closeApp={closeApp}
      t={t}
      tr={tr}
      tab={settingsTab}
      setTab={setSettingsTab}
      nightTheme={isNightTheme}
      appearance={settingsAppearance}
      api={settingsApi}
      data={{
        accountProps: { auth, tr, notify },
        backupProps: {
          tr,
          dataImporting: data.importing,
          dataImportRef: data.importRef,
          onExport: data.onExport,
          onImport: data.onImport,
          cloudBackupProps: data.cloudBackupProps,
        },
      }}
      about={{
        infoProps: {
          tr,
          version: VERSION,
          currentChangelogTitle: release.changelogTitle,
          currentChangelog: release.changelog,
          versionOpen,
          setVersionOpen,
          disclaimerOpen,
          setDisclaimerOpen,
        },
        resetProps: {
          tr,
          open: resetDataOpen,
          setOpen: setResetDataOpen,
          clearCacheArmed,
          onClearAll: release.onClearAll,
          onClearCache: clearSiteCache,
        },
      }}
      modals={{
        preset: presetSavePickerOpen
          ? {
              tr,
              t,
              onClose: () => setPresetSavePickerOpen(false),
              onSave: (index) => {
                saveApiPreset(index);
                setPresetSavePickerOpen(false);
              },
            }
          : null,
      }}
      notifications={notifications}
      mailboxUnreadCount={countUnreadMails(mailboxMails)}
    />
  );
}
