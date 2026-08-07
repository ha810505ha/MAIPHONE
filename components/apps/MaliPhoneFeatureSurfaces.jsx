import React from "react";
import { sortDisplayCharacters } from "../../utils/characterSorting";
import { lazyWithRetry } from "../../utils/lazyWithRetry.js";

const PlayerProfileApp = lazyWithRetry(() => import("./PlayerProfileApp.jsx"));
const DatingApp = lazyWithRetry(() => import("./DatingApp.jsx"));
const ContactsApp = lazyWithRetry(() => import("./ContactsApp.jsx"));
const SocialApp = lazyWithRetry(() => import("./SocialApp.jsx"));
const LorebookApp = lazyWithRetry(() => import("./LorebookApp.jsx"));
const StatusApp = lazyWithRetry(() => import("./StatusApp.jsx"));

export function MaliPhoneStatusSurface({ actions, core, data, state, memoryPrompt }) {
  return (
    <StatusApp
      {...core}
      {...data}
      {...state}
      {...actions}
      memoryPrompt={memoryPrompt}
      characters={sortDisplayCharacters(data.characters)}
    />
  );
}

export function MaliPhoneSocialSurface({ actions, core, helpers, state }) {
  return (
    <SocialApp
      {...core}
      {...state}
      {...actions}
      {...helpers}
    />
  );
}

export function MaliPhoneLorebookSurface({ core, state }) {
  return (
    <LorebookApp
      {...core}
      {...state}
    />
  );
}

export function MaliPhoneContactsSurface({ actions, core, data }) {
  const { showToast, tr, ...contactCore } = core;

  return (
    <ContactsApp
      {...contactCore}
      tr={tr}
      characters={sortDisplayCharacters(data.characters)}
      activeCharId={data.activeCharId}
      onAdd={actions.onAdd}
      onSetActive={actions.onSetActive}
      onChat={actions.onChat}
      onView={actions.onView}
      onSaveDisplayOrder={(draft) => {
        const metadata = new Map(draft.map((item, index) => [
          item.id,
          { displayOrder: index, displayPinned: Boolean(item.pinned) },
        ]));
        data.setCharacters((items) => items.map((item) => ({
          ...item,
          ...(metadata.get(item.id) || {}),
        })));
        showToast(tr("角色順序已儲存", "Character order saved", "キャラクターの順番を保存しました", "캐릭터 순서를 저장했습니다"));
      }}
    />
  );
}

export function MaliPhoneDatingSurface({ actions, core, dating, playerProfile }) {
  return (
    <DatingApp
      {...core}
      dating={dating}
      playerProfile={playerProfile}
      {...actions}
    />
  );
}

export function MaliPhonePlayerSurface({ core, crop, profile, persona }) {
  return (
    <PlayerProfileApp
      {...core}
      {...profile}
      {...crop}
      persona={persona}
    />
  );
}
