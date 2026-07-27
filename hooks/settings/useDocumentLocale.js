import { useLayoutEffect, useRef, useState } from "react";
import { loadSimplifiedChineseConverter, toSimplifiedChinese } from "../../utils/i18n.js";

const CONVERTED_ATTRIBUTES = ["aria-label", "placeholder", "title", "alt"];

function shouldSkipNode(node) {
  const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  return !!element?.closest?.("script, style, .ignore-opencc");
}

function createDomLocaleController() {
  const textRecords = new Map();
  const attributeRecords = new Map();
  let locale = "zh-TW";
  let observer = null;
  let observing = false;

  const localize = (value) => (locale === "zh-CN" ? toSimplifiedChinese(value) : value);

  const updateTextNode = (node) => {
    if (!node?.isConnected || shouldSkipNode(node)) return;
    const current = node.nodeValue || "";
    const record = textRecords.get(node);
    const source = record && current === record.rendered ? record.source : current;
    const rendered = localize(source);
    textRecords.set(node, { source, rendered });
    if (current !== rendered) node.nodeValue = rendered;
  };

  const updateElementAttributes = (element) => {
    if (!element?.isConnected || shouldSkipNode(element)) return;
    let records = attributeRecords.get(element);
    if (!records) {
      records = new Map();
      attributeRecords.set(element, records);
    }

    for (const attribute of CONVERTED_ATTRIBUTES) {
      if (!element.hasAttribute(attribute)) {
        records.delete(attribute);
        continue;
      }
      const current = element.getAttribute(attribute) || "";
      const record = records.get(attribute);
      const source = record && current === record.rendered ? record.source : current;
      const rendered = localize(source);
      records.set(attribute, { source, rendered });
      if (current !== rendered) element.setAttribute(attribute, rendered);
    }
  };

  const updateSubtree = (root) => {
    if (!root?.isConnected || shouldSkipNode(root)) return;
    if (root.nodeType === Node.TEXT_NODE) {
      updateTextNode(root);
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE) return;

    updateElementAttributes(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      if (node.nodeType === Node.TEXT_NODE) updateTextNode(node);
      else updateElementAttributes(node);
      node = walker.nextNode();
    }
  };

  const removeSubtreeRecords = (root) => {
    if (!root) return;
    if (root.nodeType === Node.TEXT_NODE) textRecords.delete(root);
    if (root.nodeType === Node.ELEMENT_NODE) attributeRecords.delete(root);
    root.childNodes?.forEach(removeSubtreeRecords);
  };

  const observe = () => {
    if (!observer || observing || !document.body) return;
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: CONVERTED_ATTRIBUTES,
    });
    observing = true;
  };

  const pause = () => {
    if (!observer || !observing) return;
    observer.disconnect();
    observing = false;
  };

  observer = new MutationObserver((mutations) => {
    pause();
    for (const mutation of mutations) {
      if (mutation.type === "characterData") {
        updateTextNode(mutation.target);
      } else if (mutation.type === "attributes") {
        updateElementAttributes(mutation.target);
      } else {
        mutation.removedNodes.forEach(removeSubtreeRecords);
        mutation.addedNodes.forEach(updateSubtree);
      }
    }
    observe();
  });

  return {
    setLocale(nextLocale) {
      locale = nextLocale;
      document.documentElement.lang = nextLocale;
      pause();
      updateSubtree(document.body);
      observe();
    },
    disconnect() {
      pause();
      textRecords.clear();
      attributeRecords.clear();
    },
  };
}

export default function useDocumentLocale(uiLanguage) {
  const controllerRef = useRef(null);
  const [, setConverterRevision] = useState(0);

  useLayoutEffect(() => {
    controllerRef.current = createDomLocaleController();
    controllerRef.current.setLocale(uiLanguage);
    return () => controllerRef.current?.disconnect();
  }, []);

  useLayoutEffect(() => {
    controllerRef.current?.setLocale(uiLanguage);
    if (uiLanguage !== "zh-CN") return undefined;

    let cancelled = false;
    loadSimplifiedChineseConverter().then(() => {
      if (cancelled) return;
      controllerRef.current?.setLocale(uiLanguage);
      setConverterRevision((revision) => revision + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [uiLanguage]);
}
