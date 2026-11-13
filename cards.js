(() => {
  'use strict';
  const C = MakerCard;
  const MARKER = 'data-maker-card-art', PROPERTY = '--maker-card-background';
  let profile = { ...C.DEFAULTS }, revision = 0, scheduled = false;
  const tracked = new Map(), probes = new Map();
  function nativeSource(element) {
    // Temporarily disable only our CSS rule; the page's own styles remain intact.
    // MARKER is deliberately absent from the observer's attributeFilter.
    const marker = element.getAttribute(MARKER);
    if (marker !== null) element.removeAttribute(MARKER);
    const result = C.cssImage(getComputedStyle(element).backgroundImage);
    if (marker !== null) element.setAttribute(MARKER, marker);
    return result;
  }
  function probe(url) {
    if (probes.has(url)) return probes.get(url).status;
    const image = new Image();
    const record = { status: 'pending', image };
    probes.set(url, record);
    const finish = status => {
      clearTimeout(record.timer);
      image.onload = image.onerror = null;
      record.image = null;
      record.status = status;
      schedule();
    };
    record.timer = setTimeout(() => finish('failed'), 8000);
    image.onload = () => finish('loaded');
    image.onerror = () => finish('failed');
    image.src = url;
    return record.status;
  }
  function restore(element, record) {
    element.removeAttribute(MARKER);
    if (element.style.getPropertyValue(PROPERTY) === record.applied) {
      if (record.value) element.style.setProperty(PROPERTY, record.value, record.priority);
      else element.style.removeProperty(PROPERTY);
    }
    tracked.delete(element);
  }
  function scan() {
    scheduled = false;
    for (const [element, record] of tracked) {
      if (!element.isConnected || !element.matches(C.SELECTOR)) restore(element, record);
    }
    const used = new Set();
    for (const element of document.querySelectorAll(C.SELECTOR)) {
      const native = nativeSource(element);
      if (native) used.add(native);
      const tara = native && probe(native) !== 'failed' ? native : C.TARA;
      let target = profile.preset === 'frog' ? C.FROG : profile.preset === 'custom' ? profile.image : tara;
      used.add(target);
      if (target !== tara && probe(target) === 'failed') target = tara;
      if (target === native) {
        const record = tracked.get(element);
        if (record) restore(element, record);
        continue;
      }
      let record = tracked.get(element);
      if (!record) {
        record = { value: element.style.getPropertyValue(PROPERTY), priority: element.style.getPropertyPriority(PROPERTY), applied: '' };
        tracked.set(element, record);
      }
      record.applied = `url(${JSON.stringify(target)})`;
      if (element.style.getPropertyValue(PROPERTY) !== record.applied) element.style.setProperty(PROPERTY, record.applied);
      if (!element.hasAttribute(MARKER)) element.setAttribute(MARKER, '');
    }
    // Bound memory retained by old uploaded images and conversations.
    for (const [url, record] of probes) if (!used.has(url) && record.status !== 'pending') probes.delete(url);
  }
  function schedule() {
    if (!scheduled) { scheduled = true; queueMicrotask(scan); }
  }
  function relevant(element) {
    return element?.nodeType === Node.ELEMENT_NODE &&
      (element.matches('article, [data-decoration="tara"], style, link[rel="stylesheet"]') ||
       element.closest('article[data-tier="ultra"]') || element.querySelector(C.SELECTOR));
  }
  const observer = new MutationObserver(records => {
    if (records.some(record => relevant(record.target) ||
        (record.type === 'attributes' && [document.documentElement, document.body].includes(record.target)) ||
        [...record.addedNodes, ...record.removedNodes].some(relevant))) schedule();
  });
  observer.observe(document, { subtree: true, childList: true, attributes: true,
    attributeFilter: ['class', 'style', 'data-tier', 'data-audience', 'data-decoration'] });
  document.addEventListener('load', event => { if (event.target.matches?.('link[rel="stylesheet"]')) schedule(); }, true);
  function apply(value) { profile = C.normalize(value); schedule(); }
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes[C.KEY]) return;
      revision++;
      apply(changes[C.KEY].newValue);
    });
    const initialRevision = revision;
    C.load().then(value => { if (revision === initialRevision) apply(value); }).catch(() => {});
    chrome.runtime.onMessage.addListener((message, sender, respond) => {
      if (message?.type !== C.MESSAGE || sender.id !== chrome.runtime.id) return;
      const sources = [...document.querySelectorAll(C.SELECTOR)].map(nativeSource).filter(Boolean);
      respond({ source: sources.find(source => probes.get(source)?.status !== 'failed') || '' });
    });
  } catch { /* An extension update invalidated this page's context; refreshing reconnects it. */ }
  scan();
})();
