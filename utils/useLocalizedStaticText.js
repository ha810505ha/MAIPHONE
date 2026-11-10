import { useLayoutEffect } from "react";

const TEXT_ATTRIBUTES = ["aria-label", "placeholder", "title"];

function shouldSkip(node) {
  const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  return element?.closest?.("[contenteditable='true'], input, textarea, [data-i18n-user-content]");
}

function localizeTextNode(node, localize) {
  if (shouldSkip(node)) return;
  const value = node.nodeValue;
  const match = value?.match(/^(\s*)([\s\S]*?)(\s*)$/);
  if (!match || !match[2]) return;
  const next = localize(match[2]);
  if (next !== match[2]) node.nodeValue = `${match[1]}${next}${match[3]}`;
}

function localizeTree(root, localize) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    localizeTextNode(node, localize);
    node = walker.nextNode();
  }

  root.querySelectorAll("*").forEach((element) => {
    if (shouldSkip(element)) return;
    TEXT_ATTRIBUTES.forEach((attribute) => {
      const value = element.getAttribute(attribute);
      if (!value) return;
      const next = localize(value);
      if (next !== value) element.setAttribute(attribute, next);
    });
  });
}

// Use this only for isolated legacy screens whose UI copy is still inline.
// New screens should render translated text directly through `tr` instead.
export function useLocalizedStaticText(rootRef, localize) {
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    localizeTree(root, localize);
    const observer = new MutationObserver(() => localizeTree(root, localize));
    observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: TEXT_ATTRIBUTES });
    return () => observer.disconnect();
  }, [rootRef, localize]);
}
