(() => {
  'use strict';
  const P = MakerProfile;
  const ORIGINAL_NAME = '嗒啦啦';
  const DEFAULT_AVATAR = chrome.runtime.getURL('assets/tianyi.jpg');
  const AVATAR_SELECTOR = 'img[alt="Bot Avatar"]';
  const STATUS_SELECTOR = '.chat-thinking-shimmer';
  const FEEDBACK_PROMPT = '评价一下嗒啦啦的工作';
  const FEEDBACK_SELECTOR = 'div.border-t.border-border > div.flex.flex-wrap.items-center > span.select-none.text-xs.text-muted-foreground';
  const ROW_SELECTOR = '.chat-collapsed-row, .flex.items-center';
  const EXCLUDED_SELECTOR = [
    'script', 'style', 'noscript', 'template', 'textarea', 'input', 'select',
    'option', 'pre', 'code', '[role="textbox"]',
    '[contenteditable]:not([contenteditable="false"])',
    '.prose', '.markdown', '.markdown-body', '.markdown-content'
  ].join(',');
  let profile = { ...P.DEFAULTS }, settingsRevision = 0;
  const avatars = new WeakMap(), texts = new WeakMap();
  const liveAvatars = new Set(), liveTexts = new Set(), pending = new Set();
  let scheduled = false;
  const excluded = element => Boolean(element?.closest(EXCLUDED_SELECTOR));

  function restoreText(text) {
    const record = texts.get(text);
    if (record && text.nodeValue === record.rendered) text.nodeValue = record.original;
    texts.delete(text);
    liveTexts.delete(text);
  }
  function restoreAvatar(image) {
    const record = avatars.get(image);
    if (record) {
      if (image.getAttribute('src') === record.applied) {
        if (record.src === null) image.removeAttribute('src');
        else image.setAttribute('src', record.src);
        if (!image.hasAttribute('srcset') && record.srcset !== null) image.setAttribute('srcset', record.srcset);
      }
      image.removeEventListener('error', record.onError);
      avatars.delete(image);
    }
    liveAvatars.delete(image);
  }
  function restoreSubtree(root) {
    for (const text of liveTexts) if (root.contains(text)) restoreText(text);
    for (const image of liveAvatars) if (root.contains(image)) restoreAvatar(image);
  }

  function isNameLabel(text, original) {
    if (original.trim() !== ORIGINAL_NAME) return false;
    for (let element = text.parentElement, depth = 0; element && depth < 3; element = element.parentElement, depth++) {
      if (element.matches(ROW_SELECTOR) && element.textContent.length < 240 && element.querySelector(AVATAR_SELECTOR)) return true;
    }
    return false;
  }
  function patchText(text) {
    const current = text.nodeValue;
    let record = texts.get(text);
    // Only reuse provenance while the page still contains our last rendered value.
    const original = record && current === record.rendered ? record.original : current;
    const parent = text.parentElement;
    // Maker renders this fixed rating caption beside its feedback buttons.
    // Match both its structure and original wording, never arbitrary quoted messages.
    const isFeedbackPrompt = original?.trim() === FEEDBACK_PROMPT && parent?.matches(FEEDBACK_SELECTOR);
    if (!original?.includes(ORIGINAL_NAME) || !parent || excluded(parent) ||
        !(parent.closest(STATUS_SELECTOR) || isNameLabel(text, original) || isFeedbackPrompt)) {
      restoreText(text);
      return;
    }
    record = { original, rendered: original.split(ORIGINAL_NAME).join(profile.nickname) };
    texts.set(text, record);
    liveTexts.add(text);
    if (current !== record.rendered) text.nodeValue = record.rendered;
  }

  function patchAvatar(image) {
    if (!image.matches(AVATAR_SELECTOR) || excluded(image)) { restoreAvatar(image); return; }
    const current = image.getAttribute('src');
    const srcset = image.getAttribute('srcset');
    let record = avatars.get(image);
    if (!record) {
      record = { src: current, srcset, applied: null, requested: null, failed: 0 };
      record.onError = () => {
        if (!image.isConnected || image.getAttribute('src') !== record.applied || record.failed >= 2) return;
        // Invalid saved images or a restrictive site CSP get a bounded fallback, never a retry loop.
        record.failed = record.failed === 0 && profile.avatar ? 1 : 2;
        patchAvatar(image);
      };
      image.addEventListener('error', record.onError);
      avatars.set(image, record);
    }
    if (current !== record.applied) record.src = current;
    if (srcset !== null) record.srcset = srcset;
    const requested = profile.avatar || DEFAULT_AVATAR;
    if (record.requested !== requested) { record.requested = requested; record.failed = 0; }
    const target = record.failed >= 2 ? (record.src || DEFAULT_AVATAR) : record.failed === 1 ? DEFAULT_AVATAR : requested;
    record.applied = target;
    liveAvatars.add(image);
    if (current !== target) image.setAttribute('src', target);
    if (srcset !== null && record.failed < 2) image.removeAttribute('srcset');
    // Include an existing sibling name when an avatar is mounted later.
    for (let row = image.parentElement, depth = 0; row && depth < 3; row = row.parentElement, depth++) {
      if (!row.matches(ROW_SELECTOR) || row.textContent.length >= 240) continue;
      const walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) patchText(walker.currentNode);
    }
  }

  function scan(root) {
    if (!root.isConnected) return;
    if (root.nodeType === Node.TEXT_NODE) { patchText(root); return; }
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
    if (root.nodeType === Node.ELEMENT_NODE) {
      if (excluded(root)) { restoreSubtree(root); return; }
      if (root.matches('img')) patchAvatar(root);
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (node.nodeType === Node.ELEMENT_NODE && node.matches(EXCLUDED_SELECTOR)) {
          restoreSubtree(node);
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node.nodeType === Node.TEXT_NODE) patchText(node);
      else if (node.matches('img')) patchAvatar(node);
    }
  }
  function pruneDetached() {
    // WeakMap provenance survives detach/reinsert without retaining removed conversation trees.
    for (const text of liveTexts) if (!text.isConnected) liveTexts.delete(text);
    for (const image of liveAvatars) if (!image.isConnected) liveAvatars.delete(image);
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
        let covered = false;
        for (let parent = root.parentNode; parent; parent = parent.parentNode) {
          if (roots.has(parent)) { covered = true; break; }
        }
        if (!covered) scan(root);
      }
      pruneDetached();
    });
  }
  const observer = new MutationObserver(records => {
    let removed = false;
    for (const record of records) {
      if (record.type === 'characterData') {
        if (texts.has(record.target) || record.target.nodeValue?.includes(ORIGINAL_NAME)) enqueue(record.target);
      } else if (record.type === 'attributes') {
        // Attribute changes stay scoped to the changed subtree, including role reuse and excluded editors.
        enqueue(record.target);
      } else {
        for (const node of record.addedNodes) enqueue(node);
        if (record.target.nodeType === Node.ELEMENT_NODE && record.target.matches(`${STATUS_SELECTOR}, ${ROW_SELECTOR}`)) enqueue(record.target);
        if (record.removedNodes.length) removed = true;
      }
    }
    if (removed) pruneDetached();
  });
  observer.observe(document, {
    subtree: true, childList: true, characterData: true, attributes: true,
    attributeFilter: ['src', 'srcset', 'alt', 'class', 'contenteditable']
  });
  function applySettings(value) {
    const next = P.normalize(value);
    if (P.equal(next, profile)) return;
    profile = next;
    // Settings change rarely; a single pass also catches any newly visible chat UI.
    scan(document);
    pruneDetached();
  }
  // Subscribe before the initial read so a slow read cannot overwrite a newer save.
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes[P.KEY]) return;
      settingsRevision++;
      applySettings(changes[P.KEY].newValue);
    });
    const revision = settingsRevision;
    P.load().then(value => { if (revision === settingsRevision) applySettings(value); }).catch(() => {
      // Storage failure never prevents default replacement or the page's own rendering.
    });
  } catch { /* Extension context was invalidated during an upgrade; refresh reconnects it. */ }
  scan(document);
})();
