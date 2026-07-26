import React, { useState } from "react";
import ChatModeSettings from "./ChatModeSettings";
import InnerThoughtSettings from "./InnerThoughtSettings";
import ProactiveMessageSettings from "./ProactiveMessageSettings";
import ChatRealTimeSettings from "./ChatRealTimeSettings";
import ChatBackgroundSettings from "./ChatBackgroundSettings";
import ChatLorebookSettings from "./ChatLorebookSettings";
import ChatroomManagement from "./ChatroomManagement";

export default function ChatSettingsPanel({ tr, mode, innerThought, proactive, realTime, background, lorebook, management, contact }) {
  const [activeTab, setActiveTab] = useState("interaction");
  const characterName = management?.character?.name || tr("角色", "Character", "キャラクター", "캐릭터");
  const tabs = [
    ["interaction", tr("互動", "Interaction", "会話", "상호작용")],
    ["appearance", tr("外觀", "Appearance", "外観", "외관")],
    ["lorebook", tr("世界書", "Lorebook", "世界観", "월드북")],
    ["management", tr("管理", "Manage", "管理", "관리")],
    ["contact", tr("聯絡", "Contact", "連絡", "연락")],
  ];

  return (
    <div className="mp-cm mp-chat-settings" style={{ paddingTop: 8 }}>
      <div className="mp-chat-settings-title">
        <div>{tr("聊天室設定", "Chat settings", "チャット設定", "채팅 설정")}</div>
        <span>{characterName}</span>
      </div>

      <div className="mp-chat-settings-tabs" role="tablist" aria-label={tr("聊天室設定分類", "Chat settings categories", "チャット設定カテゴリ", "채팅 설정 카테고리")}>
        {tabs.map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={activeTab === value} className={activeTab === value ? "active" : ""} onClick={() => setActiveTab(value)}>{label}</button>)}
      </div>

      <div key={activeTab} className="mp-chat-settings-tab-content">
        {activeTab === "interaction" && <>
          <ChatModeSettings {...mode} tr={tr} />
          <InnerThoughtSettings {...innerThought} tr={tr} />
          <ProactiveMessageSettings {...proactive} tr={tr} />
          <ChatRealTimeSettings {...realTime} tr={tr} />
        </>}

        {activeTab === "appearance" && <>
          <div className="mp-chat-tab-intro"><b>{tr("聊天室外觀", "Chat appearance", "チャット外観", "채팅 외관")}</b><span>{tr("只影響這個角色的聊天畫面。", "Only affects this character's chat view.", "このキャラクターのチャット画面だけに適用されます。", "이 캐릭터의 채팅 화면에만 적용됩니다.")}</span></div>
          <ChatBackgroundSettings {...background} tr={tr} />
        </>}

        {activeTab === "lorebook" && <>
          <div className="mp-chat-tab-intro"><b>{tr("世界書綁定", "Lorebook binding", "ワールドブック連携", "월드북 연결")}</b><span>{tr("控制這個角色聊天時可以讀取的世界書與條目。", "Choose which lorebooks and entries this character can use in chat.", "このキャラクターがチャットで参照できる世界観と項目を設定します。", "이 캐릭터가 채팅에서 사용할 월드북과 항목을 설정합니다.")}</span></div>
          <ChatLorebookSettings {...lorebook} tr={tr} />
        </>}

        {activeTab === "management" && <>
          <div className="mp-chat-tab-intro"><b>{tr("當前聊天室資料", "Current chat data", "現在のチャットデータ", "현재 채팅 데이터")}</b><span>{tr("以下操作只處理聊天室資料，不會刪除角色。", "These actions affect chat data only and do not delete the character.", "以下の操作はチャットデータのみを対象とし、キャラクターは削除されません。", "아래 작업은 채팅 데이터에만 적용되며 캐릭터는 삭제되지 않습니다.")}</span></div>
          <ChatroomManagement {...management} tr={tr} />
        </>}

        {activeTab === "contact" && <>
          <div className="mp-chat-tab-intro mp-chat-tab-intro-contact"><b>{tr("角色層級設定", "Character-level settings", "キャラクター単位の設定", "캐릭터 단위 설정")}</b><span>{tr(`變更會套用至 ${characterName} 的所有線上聊天室。`, `Changes apply to all online chats with ${characterName}.`, `変更は${characterName}とのすべてのオンラインチャットに適用されます。`, `변경 사항은 ${characterName}의 모든 온라인 채팅에 적용됩니다.`)}</span></div>
          <div className="mp-cc mp-chat-contact-card">
            <div><b>{contact?.blockState?.blocked ? tr(`${characterName} 已被封鎖`, `${characterName} is blocked`, `${characterName}はブロック中`, `${characterName} 차단됨`) : tr(`封鎖 ${characterName}`, `Block ${characterName}`, `${characterName}をブロック`, `${characterName} 차단`)}</b><p>{tr("封鎖後仍能查看對方嘗試傳送的訊息；圖片、轉帳與現實模式仍可使用。", "Intercepted messages remain visible; photos, transfers, and reality mode remain available.", "ブロック後もメッセージを確認でき、画像・送金・現実モードは利用できます。", "차단 후에도 메시지를 볼 수 있으며 사진·송금·현실 모드는 사용할 수 있습니다.")}</p>{contact?.blockState?.blockedAt && <small>{tr("封鎖時間：", "Blocked since: ", "ブロック日時：", "차단 시각: ")}{new Date(contact.blockState.blockedAt).toLocaleString()}</small>}</div>
            {contact?.blockState?.blocked
              ? <button type="button" className="is-unblock" onClick={contact.onUnblock}>{tr("解除封鎖", "Unblock", "ブロック解除", "차단 해제")}</button>
              : <button type="button" onClick={() => { if (window.confirm(tr(`確定要封鎖 ${characterName}？`, `Block ${characterName}?`, `${characterName}をブロックしますか？`, `${characterName}을 차단할까요?`))) contact?.onBlock?.(); }}>{tr("封鎖", "Block", "ブロック", "차단")}</button>}
          </div>
        </>}
      </div>
    </div>
  );
}
