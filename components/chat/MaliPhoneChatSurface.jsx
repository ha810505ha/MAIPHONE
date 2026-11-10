import React from "react";
import { loadChatView } from "../../utils/featurePreload";
import { lazyWithRetry } from "../../utils/lazyWithRetry.js";

const ChatView = lazyWithRetry(loadChatView);
const DirectChatView = lazyWithRetry(() => import("./DirectChatView.jsx"));
const ChatScreenshotModal = lazyWithRetry(() => import("./ChatScreenshotModal.jsx"));
const MemoryToastCard = lazyWithRetry(() => import("./MemoryToastCard.jsx"));

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
  if (apiConfig?.aiSource === "hosted_test") {
    return {
      modelShort: "TEST",
      modelFull: `Test LLM · ${apiConfig?.hostedTestModel || "-"}`,
    };
  }
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
  directCalendarReminder,
  directStoryStatus,
  directStoryNote,
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
          calendarReminder={directCalendarReminder}
          storyStatus={directStoryStatus}
          storyNote={directStoryNote}
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
