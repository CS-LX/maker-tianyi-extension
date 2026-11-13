(() => {
  'use strict';
  const C = MakerCard, $ = id => document.getElementById(id);
  let baseline = { ...C.DEFAULTS }, draft = { ...C.DEFAULTS }, tara = C.TARA;
  let ready = false, importing = false, saving = false, conflict = false, sequence = 0, revision = 0, sourceTicket = 0;
  const dirty = () => !C.equal(draft, baseline);
  const message = (text, kind = '') => { $('card-status').textContent = text; $('card-status').dataset.kind = kind; };
  function render() {
    $('card-preview-image').src = draft.preset === 'frog' ? C.FROG : draft.preset === 'custom' ? draft.image : tara;
    $('card-tara-image').src = tara;
    $('card-custom-image').hidden = !draft.image;
    if (draft.image) $('card-custom-image').src = draft.image;
    else $('card-custom-image').removeAttribute('src');
    $('card-upload-plus').hidden = Boolean(draft.image);
    $('card-upload-label').textContent = draft.image ? '已上传' : '上传图片';
    for (const preset of ['tara', 'frog', 'custom']) {
      $(`card-${preset}`).setAttribute('aria-pressed', String(draft.preset === preset));
      $(`card-${preset}`).disabled = !ready || saving;
    }
    $('card-replace').hidden = !draft.image;
    $('card-replace').disabled = !ready || saving;
    $('card-reset').disabled = !ready || saving;
    $('card-save').disabled = !ready || saving || importing || conflict || !dirty();
    $('card-save').textContent = saving ? '正在保存…' : '保存并应用';
    $('card-reload').hidden = !(conflict || !ready);
    $('card-source').textContent = tara === C.TARA ? '嗒啦啦 · 内置素材' : '嗒啦啦 · 来自 Maker 网页';
  }
  function dirtyMessage() { message(dirty() ? '预览尚未保存，点击“保存并应用”生效。' : '卡面已保存，可直接关闭。'); }
  async function load() {
    const ticket = ++sequence;
    ready = importing = false;
    render();
    try {
      let next, start, attempts = 0;
      do {
        start = revision;
        next = await C.load();
        if (ticket !== sequence) return;
        if (++attempts >= 3 && start !== revision) throw new Error('Settings keep changing');
      } while (start !== revision);
      baseline = next;
      draft = { ...next };
      ready = true;
      conflict = false;
      dirtyMessage();
    } catch { message('读取卡面设置失败，请重新载入；扩展刚升级时请重新打开面板。', 'error'); }
    render();
  }
  async function requestSource() {
    const ticket = ++sourceTicket;
    $('card-refresh-source').disabled = true;
    try {
      // Tab IDs are available without the broad tabs permission; no titles/URLs are read.
      const tabs = await chrome.tabs.query({});
      tabs.sort((a, b) => Number(b.active) - Number(a.active));
      const ask = async tab => {
        let timeout;
        try {
          const reply = await Promise.race([
            chrome.tabs.sendMessage(tab.id, { type: C.MESSAGE }, { frameId: 0 }),
            new Promise(resolve => { timeout = setTimeout(() => resolve(null), 1200); })
          ]);
          return C.siteImage(reply?.source);
        } catch { return ''; }
        finally { clearTimeout(timeout); }
      };
      const sources = await Promise.all(tabs.map(ask));
      if (ticket !== sourceTicket) return;
      tara = sources.find(Boolean) || C.TARA;
    } catch { if (ticket === sourceTicket) tara = C.TARA; }
    finally {
      if (ticket === sourceTicket) { $('card-refresh-source').disabled = false; render(); }
    }
  }
  const tabs = [$('chat-tab'), $('card-tab')];
  function showTab(tab) {
    for (const item of tabs) {
      item.setAttribute('aria-selected', String(item === tab));
      item.tabIndex = item === tab ? 0 : -1;
      $(item.getAttribute('aria-controls')).hidden = item !== tab;
    }
    if (tab === $('card-tab')) requestSource();
  }
  for (const [index, tab] of tabs.entries()) {
    tab.addEventListener('click', () => showTab(tab));
    tab.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = tabs[event.key === 'Home' ? 0 : event.key === 'End' ? 1 : 1 - index];
      showTab(next); next.focus();
    });
  }
  function select(preset) {
    ++sequence; importing = false;
    draft.preset = preset;
    dirtyMessage(); render();
  }
  $('card-tara').addEventListener('click', () => select('tara'));
  $('card-frog').addEventListener('click', () => select('frog'));
  $('card-custom').addEventListener('click', () => { if (draft.image) select('custom'); else $('card-file').click(); });
  $('card-replace').addEventListener('click', () => $('card-file').click());
  $('card-refresh-source').addEventListener('click', requestSource);
  $('card-file').addEventListener('change', async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !ready || saving) return;
    const ticket = ++sequence;
    importing = true; message('正在处理卡面图片…'); render();
    try {
      const image = await MakerAvatar.importFile(file, { fit: 'contain' });
      if (ticket !== sequence) return;
      draft.image = image; draft.preset = 'custom';
      message('图片已准备好，保存后应用到黑金卡。');
    } catch (error) { if (ticket === sequence) message(error.message || '图片处理失败，请重试。', 'error'); }
    finally { if (ticket === sequence) { importing = false; render(); } }
  });
  $('card-reset').addEventListener('click', () => { ++sequence; importing = false; draft = { ...C.DEFAULTS }; dirtyMessage(); render(); });
  $('card-reload').addEventListener('click', load);
  $('card-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (!ready || importing || saving || conflict || !dirty()) return;
    saving = true; render();
    try {
      if (!C.equal(await C.load(), baseline)) { conflict = true; throw new Error('卡面已在其他窗口更新，请重新载入后再修改。'); }
      baseline = await C.save(draft); draft = { ...baseline };
      message('已保存，已打开的 Maker 黑金卡会自动更新。', 'success');
    } catch (error) { message(conflict ? error.message : '保存失败，修改仍保留，请重试。', 'error'); }
    finally { saving = false; render(); }
  });
  $('card-tara-image').addEventListener('error', () => {
    if (tara !== C.TARA) { tara = C.TARA; render(); }
  });
  $('card-preview-image').addEventListener('error', () => {
    if ($('card-preview-image').src !== C.TARA) $('card-preview-image').src = C.TARA;
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[C.KEY]) return;
    revision++;
    if (!ready || saving) return;
    const next = C.normalize(changes[C.KEY].newValue);
    if (C.equal(next, baseline)) return;
    if (dirty() || importing) { conflict = true; message('卡面已在其他窗口更新，请重新载入后再修改。', 'error'); }
    else { baseline = next; draft = { ...next }; dirtyMessage(); }
    render();
  });
  load();
})();
