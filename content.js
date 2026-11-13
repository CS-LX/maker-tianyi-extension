(() => {
  "use strict";

  const ORIGINAL_NAME = "嗒啦啦";
  const DISPLAY_NAME = "天一一";
  const AVATAR_URL = chrome.runtime.getURL("assets/tianyi.jpg");
  const AVATAR_SELECTOR = 'img[alt="Bot Avatar"]';
  const STATUS_SELECTOR = ".chat-thinking-shimmer";
  const IDENTITY_ROW_SELECTOR = ".chat-collapsed-row, .flex.items-center";
  const EXCLUDED_SELECTOR = [
    "script", "style", "noscript", "template", "textarea", "input",
    "select", "option", "pre", "code", '[role="textbox"]',
    '[contenteditable]:not([contenteditable="false"])',
    ".prose", ".markdown", ".markdown-body", ".markdown-content"
  ].join(",");

  const originals = new WeakMap();
  const pending = new Set();
  let scheduled = false;

  function isExcluded(element) {
    return Boolean(element?.closest(EXCLUDED_SELECTOR));
  }

  function patchAvatar(image) {
    if (!image.matches(AVATAR_SELECTOR) || isExcluded(image)) {
      // A virtualized chat can reuse a former bot image for another speaker.
      const original = originals.get(image);
      if (original) {
        if (image.getAttribute("src") === AVATAR_URL) {
          if (original.src === null) image.removeAttribute("src");
          else image.setAttribute("src", original.src);
          if (!image.hasAttribute("srcset") && original.srcset !== null) {
            image.setAttribute("srcset", original.srcset);
          }
        }
        originals.delete(image);
      }
      return;
    }

    const src = image.getAttribute("src");
    const srcset = image.getAttribute("srcset");
    const original = originals.get(image) ?? { src, srcset };
    if (src !== AVATAR_URL) original.src = src;
    if (srcset !== null) original.srcset = srcset;
    originals.set(image, original);

    if (src !== AVATAR_URL) image.setAttribute("src", AVATAR_URL);
    if (srcset !== null) image.removeAttribute("srcset");
    // Keep classes, alt, size, and the sibling SVG progress ring untouched.
    // A name can already exist when its avatar is mounted into a child wrapper.
    for (let row = image.parentElement, depth = 0; row && depth < 3;
         row = row.parentElement, depth++) {
      if (!row.matches(IDENTITY_ROW_SELECTOR) || row.textContent.length >= 200) continue;
      const labels = document.createTreeWalker(row, NodeFilter.SHOW_TEXT);
      while (labels.nextNode()) patchText(labels.currentNode);
    }
  }

  function isNameLabel(text) {
    if (text.nodeValue.trim() !== ORIGINAL_NAME) return false;
    let element = text.parentElement;
    for (let depth = 0; element && depth < 3; depth++, element = element.parentElement) {
      if (element.matches(IDENTITY_ROW_SELECTOR) &&
          element.textContent.length < 200 &&
          element.querySelector(AVATAR_SELECTOR)) return true;
    }
    return false;
  }

  function patchText(text) {
    const value = text.nodeValue;
    if (!value?.includes(ORIGINAL_NAME)) return;
    const parent = text.parentElement;
    if (!parent || isExcluded(parent)) return;
    // Replace identity/status UI only, preserving chat prose and code examples.
    if (parent.closest(STATUS_SELECTOR) || isNameLabel(text)) {
      text.nodeValue = value.replaceAll(ORIGINAL_NAME, DISPLAY_NAME);
    }
  }

  function scan(root) {
    if (!root.isConnected) return;
    if (root.nodeType === Node.TEXT_NODE) {
      patchText(root);
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
    if (root.nodeType === Node.ELEMENT_NODE) {
      if (root.matches("img")) patchAvatar(root);
      if (isExcluded(root)) return;
    }

    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          return node.nodeType === Node.ELEMENT_NODE && node.matches(EXCLUDED_SELECTOR)
            ? NodeFilter.FILTER_REJECT
            : NodeFilter.FILTER_ACCEPT;
        }
      }
    );
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.nodeType === Node.TEXT_NODE) patchText(node);
      else if (node.matches("img")) patchAvatar(node);
    }
  }

  function enqueue(node) {
    pending.add(node);
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      const roots = new Set(pending);
      pending.clear();
      for (const root of roots) {
        // If an ancestor is already queued, its walk includes this subtree.
        let covered = false;
        for (let parent = root.parentNode; parent; parent = parent.parentNode) {
          if (roots.has(parent)) { covered = true; break; }
        }
        if (!covered) scan(root);
      }
    });
  }

  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === "characterData") {
        if (record.target.nodeValue?.includes(ORIGINAL_NAME)) enqueue(record.target);
      } else if (record.type === "attributes") {
        const target = record.target;
        if (target.matches("img") || target.matches(STATUS_SELECTOR) ||
            target.matches(IDENTITY_ROW_SELECTOR)) enqueue(target);
      } else {
        for (const node of record.addedNodes) enqueue(node);
        // Also cover an existing name label when its avatar arrives later.
        if (record.target.nodeType === Node.ELEMENT_NODE &&
            record.target.matches(`${STATUS_SELECTOR}, ${IDENTITY_ROW_SELECTOR}`)) {
          enqueue(record.target);
        }
      }
    }
  });

  observer.observe(document, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["src", "srcset", "alt", "class"]
  });
  scan(document);
})();
