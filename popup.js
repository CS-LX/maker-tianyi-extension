(() => {
  'use strict';
  const P = MakerProfile;
  const $ = id => document.getElementById(id);
  const fallback = chrome.runtime.getURL('assets/tianyi.jpg');
  let baseline = { ...P.DEFAULTS }, draft = { ...P.DEFAULTS };
  let ready = false, importing = false, saving = false, conflict = false, sequence = 0;
  let storageRevision = 0;

  function message(text, kind = '') { $('status').textContent = text; $('status').dataset.kind = kind; }
  function edited() { return !P.equal(draft, baseline); }
  function render() {
    $('preview-name').textContent = draft.nickname.trim() || P.DEFAULTS.nickname;
    $('preview-avatar').src = draft.avatar || fallback;
    const length = Array.from(draft.nickname.trim()).length;
    $('name-count').textContent = `${length} / ${P.MAX_NAME}`;
    let valid = true;
    try { P.validateNickname(draft.nickname); } catch { valid = false; }
    $('nickname').setAttribute('aria-invalid', String(!valid));
    $('nickname').disabled = !ready || saving;
    $('choose-avatar').disabled = !ready || saving;
    $('default-avatar').disabled = !ready || saving || importing || !draft.avatar;
    $('reset').disabled = !ready || saving || importing;
    $('save').disabled = !ready || saving || importing || conflict || !valid || !edited();
    $('save').textContent = saving ? '正在保存…' : '保存并应用';
    $('reload').hidden = !(conflict || !ready);
  }
  function dirtyMessage() { message(edited() ? '预览尚未保存，点击“保存并应用”生效。' : '设置已保存，可直接关闭。'); }
  async function load() {
    const ticket = ++sequence;
    importing = false;
    ready = false;
    render();
    try {
      let loaded, revision, attempts = 0;
      do {
        revision = storageRevision;
        loaded = await P.load();
        if (ticket !== sequence) return;
        if (++attempts >= 3 && revision !== storageRevision) throw new Error('Settings are changing; retry the read.');
      } while (revision !== storageRevision);
      baseline = loaded;
      draft = { ...baseline };
      $('nickname').value = draft.nickname;
      ready = true;
      conflict = false;
      dirtyMessage();
    } catch { message('读取设置失败，请点击重新载入；扩展刚升级时请重新打开此面板。', 'error'); }
    render();
  }
  $('version').textContent = `v${chrome.runtime.getManifest().version.replace(/\.0\.0$/, '')}`;
  $('preview-avatar').addEventListener('error', () => {
    if ($('preview-avatar').src !== fallback) $('preview-avatar').src = fallback;
  });
  $('nickname').addEventListener('input', () => { draft.nickname = $('nickname').value; dirtyMessage(); render(); });
  $('choose-avatar').addEventListener('click', () => $('avatar-file').click());
  $('avatar-file').addEventListener('change', async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const ticket = ++sequence;
    importing = true;
    message('正在处理图片…');
    render();
    try {
      const avatar = await MakerAvatar.importFile(file);
      if (ticket !== sequence) return;
      draft.avatar = avatar;
      message('图片已准备好，保存后应用到聊天。');
    } catch (error) {
      if (ticket === sequence) message(error.message || '图片处理失败，请重新选择。', 'error');
    } finally {
      if (ticket === sequence) { importing = false; render(); }
    }
  });
  $('default-avatar').addEventListener('click', () => { draft.avatar = ''; dirtyMessage(); render(); });
  $('reset').addEventListener('click', () => {
    draft = { ...P.DEFAULTS };
    $('nickname').value = draft.nickname;
    dirtyMessage();
    render();
  });
  $('reload').addEventListener('click', load);
  $('settings-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (!ready || saving || importing || conflict) return;
    try { draft.nickname = P.validateNickname(draft.nickname); }
    catch (error) { message(error.message, 'error'); render(); return; }
    saving = true;
    render();
    try {
      const current = await P.load();
      if (!P.equal(current, baseline)) {
        conflict = true;
        throw new Error('设置已在其他窗口更新，请重新载入后再修改。');
      }
      baseline = await P.save(draft);
      draft = { ...baseline };
      $('nickname').value = draft.nickname;
      message('已保存，所有已打开的 Maker 页面会自动应用。', 'success');
    } catch (error) {
      message(conflict ? error.message : '保存失败，修改仍保留在面板中。请重试；若扩展刚升级，请重新打开面板。', 'error');
    } finally { saving = false; render(); }
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[P.KEY]) return;
    storageRevision++;
    if (!ready || saving) return;
    const next = P.normalize(changes[P.KEY].newValue);
    if (P.equal(next, baseline)) return;
    if (edited() || importing) {
      conflict = true;
      message('设置已在其他窗口更新，请重新载入后再修改。', 'error');
    } else {
      baseline = next;
      draft = { ...next };
      $('nickname').value = draft.nickname;
      dirtyMessage();
    }
    render();
  });
  load();
})();
