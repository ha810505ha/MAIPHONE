import React, { createContext, useContext, useMemo } from "react";
import { localizeFallbackText, normalizeUiLanguage, translate } from "../../utils/i18n.js";
import { YUNYIN_PANEL_TEXT } from "./YunyinPanelText.js";
import { YUNYIN_DATA_NAMES } from "./YunyinDataNames.js";
import { YUNYIN_DUNGEON_TEXT } from "./YunyinDungeonText.js";
import { YUNYIN_WORLD_TEXT } from "./YunyinWorldText.js";

const TEXT = {
  ...YUNYIN_PANEL_TEXT,
  "common.back": ["返回", "Back", "戻る", "돌아가기"],
  "common.close": ["關閉", "Close", "閉じる", "닫기"],
  "common.cancel": ["取消", "Cancel", "キャンセル", "취소"],
  "common.none": ["－ 無 －", "— None —", "－ なし －", "－ 없음 －"],
  "common.edit": ["編輯", "Edit", "編集", "편집"],
  "common.collect": ["收取", "Collect", "受け取る", "받기"],
  "common.done": ["完成", "Done", "完了", "완료"],
  "common.random": ["🎲 隨機", "🎲 Random", "🎲 ランダム", "🎲 무작위"],
  "common.reset": ["還原", "Reset", "元に戻す", "초기화"],
  "save.loading": ["正在讀取山莊存檔⋯", "Loading villa save…", "山荘のセーブデータを読み込み中…", "산장 저장 데이터를 불러오는 중…"],
  "save.loadFailed": ["存檔載入失敗", "Failed to load save", "セーブデータを読み込めませんでした", "저장 데이터를 불러오지 못했습니다"],
  "save.villaLoadFailed": ["雲隱山莊存檔載入失敗", "Failed to load the Cloudveil Villa save", "雲隠山荘のセーブデータを読み込めませんでした", "운은산장 저장 데이터를 불러오지 못했습니다"],
  "panel.settings": ["遊戲設定", "Game Settings", "ゲーム設定", "게임 설정"],
  "panel.inventory": ["🎒 背包", "🎒 Inventory", "🎒 バッグ", "🎒 가방"],
  "panel.homeExpand": ["擴建居所", "Expand Home", "住居を拡張", "거처 확장"],
  "panel.residents": ["入住管理", "Resident Management", "入居管理", "입주 관리"],
  "panel.playerAppearance": ["玩家服裝與外觀", "Player Outfit & Appearance", "プレイヤーの服装と外見", "플레이어 의상 및 외형"],
  "panel.residentAppearance": ["{name}的外觀", "{name}'s Appearance", "{name}の外見", "{name}의 외형"],
  "panel.resident": ["居民", "Resident", "住民", "주민"],
  "hud.title": ["雲隱山莊 · {map}", "Cloudveil Villa · {map}", "雲隠山荘 · {map}", "운은산장 · {map}"],
  "hud.coins": ["金錢", "Coins", "所持金", "금화"],
  "hud.crystals": ["結晶", "Crystals", "結晶", "결정"],
  "hud.settings": ["山莊設定", "Villa Settings", "山荘設定", "산장 설정"],
  "hud.inventory": ["背包", "Inventory", "バッグ", "가방"],
  "hud.decorate": ["家園佈置", "Decorate Home", "住居を飾る", "거처 꾸미기"],
  "camera.zoom": ["鏡頭倍數", "Camera Zoom", "カメラ倍率", "카메라 배율"],
  "camera.adjust": ["調整鏡頭倍率", "Adjust Camera Zoom", "カメラ倍率を調整", "카메라 배율 조절"],
  "camera.current": ["目前 {value} 倍", "Currently {value}×", "現在 {value} 倍", "현재 {value}배"],
  "camera.option": ["鏡頭 {value} 倍", "Camera {value}×", "カメラ {value} 倍", "카메라 {value}배"],
  "home.previewActions": ["家具預覽操作", "Furniture Preview Controls", "家具プレビュー操作", "가구 미리보기 조작"],
  "home.confirmPosition": ["確認家具位置", "Confirm Furniture Position", "家具の位置を確定", "가구 위치 확인"],
  "home.confirm": ["確認位置", "Confirm Position", "位置を確定", "위치 확인"],
  "home.store": ["收起家具", "Store Furniture", "家具をしまう", "가구 보관"],
  "home.cancelPreview": ["取消預覽", "Cancel Preview", "プレビューをキャンセル", "미리보기 취소"],
  "home.moveStoredHint": ["點地面移動；✓確認位置，✕收起家具", "Tap the floor to move; ✓ confirm, ✕ store", "床をタップして移動。✓で確定、✕で収納", "바닥을 눌러 이동; ✓ 확인, ✕ 보관"],
  "home.movePreviewHint": ["點地面移動；✓確認放置，✕取消預覽", "Tap the floor to move; ✓ place, ✕ cancel", "床をタップして移動。✓で配置、✕で取消", "바닥을 눌러 이동; ✓ 배치, ✕ 취소"],
  "home.invalidHint": ["紅色表示不能放，請換個位置", "Red means it cannot be placed here. Try another spot.", "赤色の場所には置けません。別の場所を選んでください。", "빨간색 위치에는 놓을 수 없습니다. 다른 곳을 선택하세요."],
  "home.previewHint": ["點室內地板預覽家具位置", "Tap an indoor floor tile to preview placement", "室内の床をタップして家具の位置を確認", "실내 바닥을 눌러 가구 위치 미리보기"],
  "home.selectHint": ["選家具放置，或點屋內家具直接移動", "Choose furniture to place, or tap placed furniture to move it", "家具を選んで配置するか、室内の家具をタップして移動", "가구를 선택해 배치하거나 실내 가구를 눌러 이동"],
  "home.expand": ["🔨擴建", "🔨 Expand", "🔨 拡張", "🔨 확장"],
  "home.residents": ["👥入住", "👥 Residents", "👥 入居", "👥 입주"],
  "home.finishSave": ["完成並儲存", "Finish & Save", "完了して保存", "완료 및 저장"],
  "offline.title": ["閉關歸來", "Return from Retreat", "修行から帰還", "수련에서 귀환"],
  "offline.trained": ["你潛修了", "You trained for", "修行時間", "수련 시간"],
  "offline.cultivation": ["修為", "Cultivation", "修為", "수련치"],
  "offline.farmReady": ["靈田熟了 {count} 格", "{count} farm plot(s) ripened", "霊田が {count} マス実りました", "영전 {count}칸이 익었습니다"],
  "offline.sold": ["貨架賣出 {count} 件，進帳 🪙{earned}", "Sold {count} shelf item(s), earning 🪙{earned}", "商品棚で {count} 個売れ、🪙{earned} を獲得", "진열대에서 {count}개 판매, 🪙{earned} 획득"],
  "offline.crafted": ["丹爐煉好 {count} 爐待收", "{count} furnace batch(es) are ready", "丹炉の完成品が {count} 炉分あります", "단로 {count}회분이 완성되었습니다"],
  "duration.hoursMinutes": ["{hours} 小時 {minutes} 分", "{hours}h {minutes}m", "{hours}時間{minutes}分", "{hours}시간 {minutes}분"],
  "duration.minutes": ["{minutes} 分鐘", "{minutes}m", "{minutes}分", "{minutes}분"],
  "appearance.skin": ["膚色", "Skin", "肌色", "피부색"],
  "appearance.eyes": ["眼睛", "Eyes", "目", "눈"],
  "appearance.hair": ["髮型", "Hair", "髪型", "헤어"],
  "appearance.bald": ["光頭", "Bald", "なし", "민머리"],
  "appearance.hairColor": ["髮色", "Hair Color", "髪色", "머리색"],
  "appearance.outfit": ["服裝", "Outfit", "服装", "의상"],
  "appearance.outfitColor": ["衣色", "Outfit Color", "服の色", "의상 색"],
  "appearance.accessory": ["配飾", "Accessory", "アクセサリー", "액세서리"],
  "appearance.accessoryColor": ["飾色", "Accessory Color", "アクセサリー色", "액세서리 색"],
  "appearance.turn": ["轉身 ↻", "Turn ↻", "向きを変える ↻", "돌기 ↻"],
  "settings.player": ["玩家設定", "Player Settings", "プレイヤー設定", "플레이어 설정"],
  "settings.appearanceDescription": ["調整山莊角色的服裝、髮型與配飾", "Adjust your villa character's outfit, hair, and accessories", "山荘キャラクターの服装・髪型・アクセサリーを調整", "산장 캐릭터의 의상, 헤어, 액세서리를 조절합니다"],
  "settings.residents": ["角色入駐", "Character Residents", "キャラクター入居", "캐릭터 입주"],
  "settings.residentsDescription": ["把你的角色綁到山莊的居民身上，他們會在你修行時搭話。取消綁定就回歸原本的居民。", "Bind your characters to villa residents. They may talk to you while you train; unbinding restores the original resident.", "キャラクターを山荘の住民に割り当てると、修行中に話しかけてくれます。解除すると元の住民に戻ります。", "캐릭터를 산장 주민과 연결하면 수련 중 말을 걸어옵니다. 연결을 해제하면 원래 주민으로 돌아갑니다."],
  "settings.noCharacters": ["（還沒有任何角色，先去聯絡人建立吧）", "(No characters yet. Create one in Contacts first.)", "（キャラクターがいません。先に連絡先で作成してください）", "(아직 캐릭터가 없습니다. 먼저 연락처에서 만들어 주세요.)"],
  "settings.residing": ["（{name} 入駐中）", "({name} is residing)", "（{name} が入居中）", "({name} 입주 중)"],
  "settings.editAppearance": ["編輯外觀", "Edit Appearance", "外見を編集", "외형 편집"],
  "settings.lineLibrary": ["角色句庫", "Character Line Library", "キャラクター台詞集", "캐릭터 대사 모음"],
  "settings.lineLibraryDescription": ["用角色的設定生成一批專屬台詞，之後所有搭話都從這裡抽、不再花費。句庫跟著角色，換綁或解綁都會保留。", "Generate reusable custom lines from each character's settings. The library follows the character and remains after rebinding or unbinding.", "キャラクター設定から再利用できる専用台詞を生成します。割り当てを変更・解除しても台詞集は残ります。", "캐릭터 설정으로 재사용 가능한 전용 대사를 생성합니다. 연결을 바꾸거나 해제해도 대사 모음은 유지됩니다."],
  "settings.generateFailed": ["生成失敗", "Generation failed", "生成に失敗しました", "생성 실패"],
  "settings.generating": ["生成中…", "Generating…", "生成中…", "생성 중…"],
  "settings.generateLibrary": ["🔄 生成句庫", "🔄 Generate Lines", "🔄 台詞を生成", "🔄 대사 생성"],
  "settings.version": ["版本{number}{active}", "Version {number}{active}", "バージョン{number}{active}", "버전 {number}{active}"],
  "settings.collapse": ["收合 ▴", "Collapse ▴", "閉じる ▴", "접기 ▴"],
  "settings.viewLines": ["查看台詞 ▾", "View Lines ▾", "台詞を見る ▾", "대사 보기 ▾"],
  "settings.apiRequired": ["（需要先在 MaliPhone 設定好 API 才能生成）", "(Configure an API in MaliPhone before generating.)", "（生成する前に MaliPhone で API を設定してください）", "(생성하려면 먼저 MaliPhone에서 API를 설정하세요.)"],
  "settings.replies": ["角色回覆", "Character Replies", "キャラクター応答", "캐릭터 응답"],
  "settings.replyBreakthrough": ["突破時", "During Breakthrough", "突破時", "돌파 시"],
  "settings.replyDungeon": ["秘境同行", "Dungeon Companion", "秘境同行", "비경 동행"],
  "settings.replyFarm": ["靈田收成", "Farm Harvest", "霊田の収穫", "영전 수확"],
  "settings.poolBreakthroughOk": ["突破成功", "Breakthrough Success", "突破成功", "돌파 성공"],
  "settings.poolBreakthroughFail": ["突破失敗", "Breakthrough Failure", "突破失敗", "돌파 실패"],
  "settings.poolDungeon": ["秘境同行", "Dungeon Companion", "秘境同行", "비경 동행"],
  "settings.poolDungeonBoss": ["秘境 Boss", "Dungeon Boss", "秘境ボス", "비경 보스"],
  "settings.poolHarvest": ["收成", "Harvest", "収穫", "수확"],
  "settings.poolRareHarvest": ["稀有收成", "Rare Harvest", "レア収穫", "희귀 수확"],
  "settings.poolChat": ["閒聊", "Chat", "雑談", "잡담"],
  "settings.backup": ["山莊獨立備份", "Villa Backup", "山荘専用バックアップ", "산장 전용 백업"],
  "settings.backupDescription": ["只包含雲隱山莊進度、角色句庫與未來的家園資料，不包含聊天、寵物小屋或其他 App 資料。", "Includes only Cloudveil Villa progress, character lines, and home data—not chats, Pet Home, or other app data.", "雲隠山荘の進行状況・キャラクター台詞・住居データのみを含み、チャット・ペットハウス・他のアプリデータは含みません。", "운은산장 진행도, 캐릭터 대사, 거처 데이터만 포함하며 채팅, 펫 하우스 및 다른 앱 데이터는 포함하지 않습니다."],
  "settings.backupExported": ["山莊備份已匯出", "Villa backup exported", "山荘バックアップを書き出しました", "산장 백업을 내보냈습니다"],
  "settings.exportFailed": ["匯出失敗", "Export failed", "書き出しに失敗しました", "내보내기 실패"],
  "settings.export": ["匯出山莊", "Export Villa", "山荘を書き出す", "산장 내보내기"],
  "settings.import": ["匯入山莊", "Import Villa", "山荘を読み込む", "산장 가져오기"],
  "settings.imported": ["匯入完成，重新進入山莊後生效", "Import complete. Re-enter the villa to apply it.", "読み込み完了。山荘に入り直すと反映されます。", "가져오기가 완료되었습니다. 산장에 다시 들어오면 적용됩니다."],
  "settings.importFailed": ["匯入失敗", "Import failed", "読み込みに失敗しました", "가져오기 실패"],
  "settings.invalidBackup": ["不是有效的雲隱山莊備份檔", "This is not a valid Cloudveil Villa backup", "有効な雲隠山荘のバックアップではありません", "올바른 운은산장 백업 파일이 아닙니다"],
  "panel.generateFailedApi": ["生成失敗，請檢查 API 設定。", "Generation failed. Check your API settings.", "生成に失敗しました。API 設定を確認してください。", "생성에 실패했습니다. API 설정을 확인하세요."],
  "panel.placeholder": ["這個功能尚未開放。", "This feature is not available yet.", "この機能はまだ利用できません。", "이 기능은 아직 사용할 수 없습니다."],
};

const DATA_TEXT = { ...YUNYIN_DATA_NAMES, ...YUNYIN_DUNGEON_TEXT, ...YUNYIN_WORLD_TEXT };
const DATA_SOURCE_ENTRIES = Object.entries(DATA_TEXT).sort(([, a], [, b]) => b[0].length - a[0].length);
const DATA_SOURCE_KEYS = new Map(DATA_SOURCE_ENTRIES.map(([key, translations]) => [translations[0], key]));

const SYSTEM_MESSAGE_KEYS = {
  "無法煉製": "system.cannotCraft", "丹爐都在忙碌中": "system.furnacesBusy", "材料不足": "system.materialsInsufficient",
  "無法上架": "system.cannotStock", "請輸入正確的上架數量": "system.invalidQuantity", "背包數量不足": "system.inventoryInsufficient",
  "訂單無效": "system.invalidOrder", "數量不足": "system.quantityInsufficient", "已有進行中的探索": "system.activeDungeon",
  "今日探索次數已用盡": "system.noDungeonRuns", "境界不足，無法踏入此層迷霧": "system.realmDungeonLocked",
  "找不到住宅": "system.homeNotFound", "要先擴建客房才能邀請入住": "system.guestRoomRequired", "已經住在這裡了": "system.alreadyResident",
  "客床不足，先擺一張客床": "system.guestBedRequired", "不在住客名單裡": "system.notResident", "目前沒有請求": "system.noRequest",
  "今天的請求已經完成了": "system.requestDone", "條件還沒達成": "system.requestConditions", "此家具不販售": "system.furnitureNotSold",
  "已經解鎖過了": "system.furnitureAlreadyUnlocked", "需要先取得圖紙": "system.blueprintFirst", "🪙 不足": "system.coinsInsufficient",
  "靈魂結晶不足": "system.crystalsInsufficient", "無法擴建此區域": "system.cannotExpand", "已經開通了": "system.alreadyExpanded",
  "無法種植": "system.cannotPlant", "🔒 境界不足，尚未開墾": "system.plotLocked", "沒有種子": "system.noSeeds",
  "尚未解鎖此家具": "system.furnitureLocked", "這款家具已達擺放上限": "system.furniturePlacementLimit",
};

const YunyinLocaleContext = createContext({ locale: "zh-TW", yt: (key) => key, yd: (key) => key, yv: (value) => value, ym: (message) => message });

function interpolate(value, variables) {
  return String(value ?? "").replace(/\{(\w+)\}/g, (_, key) => variables?.[key] ?? `{${key}}`);
}

export function yunyinText(locale, key, variables) {
  const entry = TEXT[key];
  if (!entry) return key;
  return interpolate(translate(normalizeUiLanguage(locale), entry[0], entry[1], entry[2], entry[3]), variables);
}

export function yunyinDataText(locale, key, fallback = key) {
  const entry = DATA_TEXT[key];
  if (!entry) return fallback;
  return translate(normalizeUiLanguage(locale), entry[0], entry[1], entry[2], entry[3]);
}

export function localizeYunyinDataValue(locale, value) {
  if (typeof value !== "string" || !value || locale === "zh-TW") return value;
  if (locale === "zh-CN") return localizeFallbackText(locale, value);
  const exactKey = DATA_SOURCE_KEYS.get(value);
  if (exactKey) return yunyinDataText(locale, exactKey, value);
  let localized = value;
  for (const [key, translations] of DATA_SOURCE_ENTRIES) {
    if (localized.includes(translations[0])) localized = localized.replaceAll(translations[0], yunyinDataText(locale, key, translations[0]));
  }
  return localized;
}

export function yunyinSystemText(locale, message) {
  if (!message) return message;
  const key = SYSTEM_MESSAGE_KEYS[message];
  if (key) return yunyinText(locale, key);
  const realmMatch = /^境界不足，需要(.+)$/.exec(message);
  if (realmMatch) return yunyinText(locale, "system.realmRequired", { realm: localizeYunyinDataValue(locale, realmMatch[1]) });
  const materialMatch = /^材料不足：(.+)$/.exec(message);
  if (materialMatch) {
    const details = materialMatch[1].split("、").map((part) => {
      const itemMatch = /^(.+) 還缺 (\d+)$/.exec(part);
      if (!itemMatch) return localizeYunyinDataValue(locale, part);
      return yunyinText(locale, "system.missingMaterialItem", {
        item: localizeYunyinDataValue(locale, itemMatch[1]),
        count: itemMatch[2],
      });
    }).join(yunyinText(locale, "system.materialListSeparator"));
    return yunyinText(locale, "system.missingMaterials", { details });
  }
  return localizeYunyinDataValue(locale, localizeFallbackText(normalizeUiLanguage(locale), message));
}

export function YunyinLocaleProvider({ locale, children }) {
  const normalizedLocale = normalizeUiLanguage(locale);
  const value = useMemo(() => ({
    locale: normalizedLocale,
    yt: (key, variables) => yunyinText(normalizedLocale, key, variables),
    yd: (key, fallback) => yunyinDataText(normalizedLocale, key, fallback),
    yv: (dataValue) => localizeYunyinDataValue(normalizedLocale, dataValue),
    ym: (message) => yunyinSystemText(normalizedLocale, message),
  }), [normalizedLocale]);
  return <YunyinLocaleContext.Provider value={value}>{children}</YunyinLocaleContext.Provider>;
}

export function useYunyinLocale() {
  return useContext(YunyinLocaleContext);
}
