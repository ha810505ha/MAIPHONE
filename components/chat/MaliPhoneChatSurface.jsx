import React from "react";
import { loadChatView } from "../../utils/featurePreload";

const ChatView = React.lazy(loadChatView);
const DirectChatView = React.lazy(() => import("./DirectChatView.jsx"));
const ChatScreenshotModal = React.lazy(() => import("./ChatScreenshotModal.jsx"));
const MemoryToastCard = React.lazy(() => import("./MemoryToastCard.jsx"));

const MODEL_LABELS = {
  openai: { short: "GPT", full: "OpenAI" },
  deepseek: { short: "DS", full: "DeepSeek" },
  claude: { short: "Claude", full: "Claude" },
  gemini: { short: "Gemini", full: "Gemini API" },
  vertex: { short: "Vertex", full: "Vertex AI (快速模式)" },
  grok: { short: "Grok", full: "Grok" },
  openrouter: { short: "OR", full: "OpenRouter" },
  nvidia: { short: "NVIDIA", full: "NVIDIA NIM" },
};

function getModelLabels(apiConfig) {
  const provider = apiConfig?.provider || "openai";
  const labels = MODEL_LABELS[provider] || { short: "AI", full: provider };
  return {
    modelShort: labels.short,
    modelFull: `${labels.full} · ${apiConfig?.model || "-"}`,
  };
}

export default function MaliPhoneChatSurface({
  apiConfig,
  currentGroup,
  currentCharacter,
  directBlockBanner,
  directComposer,
  directHeader,
  directMessageList,
  directMessageRenderer,
  directSettings,
  directSettingsOpen,
  group,
  list,
  memoryToast,
  onDirectPageClick,
  screenshot,
  tr,
}) {
  const { modelShort, modelFull } = getModelLabels(apiConfig);

  if (currentGroup) {
    return (
      <ChatView
        currentGroup={currentGroup}
        tr={tr}
        group={{
          ...group,
          header: { ...group.header, modelShort, modelFull },
        }}
      />
    );
  }

  if (!currentCharacter) return <ChatView tr={tr} list={list} />;

  return (
    <ChatView
      currentCharacter={currentCharacter}
      tr={tr}
      directView={(
        <DirectChatView
          onPageClick={onDirectPageClick}
          tr={tr}
          header={{ ...directHeader, modelShort, modelFull }}
          settingsOpen={directSettingsOpen}
          settings={directSettings}
          blockBanner={directBlockBanner}
          messageList={directMessageList}
          messageRenderer={directMessageRenderer}
          composer={directComposer}
          overlay={(
            <>
              <ChatScreenshotModal {...screenshot} modelShort={modelShort} tr={tr} />
              <MemoryToastCard {...memoryToast} tr={tr} />
            </>
          )}
        />
      )}
    />
  );
}
