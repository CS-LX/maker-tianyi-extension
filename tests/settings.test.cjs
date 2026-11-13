const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'popup.html'), 'utf8');
const scripts = ['profile.js', 'popup.js'].map(file => fs.readFileSync(path.join(root, file), 'utf8'));
const png = 'data:image/png;base64,' + fs.readFileSync(path.join(root, 'assets/icons/icon32.png')).toString('base64');
const tick = () => new Promise(done => setTimeout(done, 10));

function setup(t, initial) {
  const dom = new JSDOM(html, { url: 'https://extension.test/popup.html', runScripts: 'outside-only' });
  const listeners = new Set();
  const state = { stored: initial, failRead: false, failWrite: false, writes: 0 };
  const w = dom.window;
  w.chrome = {
    runtime: { getURL: file => `https://extension.test/${file}`, getManifest: () => ({ version: '1.1.0.0' }) },
    storage: {
      local: {
        get: async () => { if (state.failRead) throw new Error('read failed'); return { makerIdentity: state.stored }; },
        set: async value => {
          if (state.failWrite) throw new Error('QUOTA_BYTES');
          state.stored = value.makerIdentity;
          state.writes++;
          for (const fn of listeners) fn({ makerIdentity: { newValue: state.stored } }, 'local');
        }
      },
      onChanged: { addListener: fn => listeners.add(fn) }
    }
  };
  w.MakerAvatar = { importFile: async () => png };
  state.external = value => { state.stored = value; for (const fn of listeners) fn({ makerIdentity: { newValue: value } }, 'local'); };
  t.after(() => w.close());
  const $ = id => w.document.getElementById(id);
  const input = name => { $('nickname').value = name; $('nickname').dispatchEvent(new w.Event('input')); };
  const submit = () => $('settings-form').dispatchEvent(new w.Event('submit', { cancelable: true }));
  const choose = file => {
    Object.defineProperty($('avatar-file'), 'files', { configurable: true, value: [file] });
    $('avatar-file').dispatchEvent(new w.Event('change'));
  };
  return { dom, w, state, $, input, submit, choose, run: () => scripts.forEach(code => w.eval(code)) };
}

test('nickname and stored-avatar validation handle Unicode, empty values, oversized data, and unsafe URLs', t => {
  const s = setup(t);
  s.w.eval(scripts[0]);
  const P = s.w.MakerProfile;
  assert.equal(P.validateNickname('  林🙂  '), '林🙂');
  assert.equal(P.validateNickname('🙂'.repeat(32)), '🙂'.repeat(32));
  for (const name of ['', ' '.repeat(3), '🙂'.repeat(33), 'a\nb', '\u202etest', null]) assert.throws(() => P.validateNickname(name));
  assert.equal(P.validAvatar(png), true);
  for (const value of ['javascript:alert(1)', 'https://remote.invalid/image.png', 'data:image/svg+xml,<svg/>', 'data:image/png;base64,bad', 'x'.repeat(P.MAX_AVATAR_LENGTH + 1)]) assert.equal(P.validAvatar(value), false);
});

test('popup previews literal text, persists settings, and restores defaults only after saving', async t => {
  const s = setup(t);
  s.run(); await tick();
  s.input('<b>$&🙂</b>');
  assert.equal(s.$('preview-name').textContent, '<b>$&🙂</b>');
  assert.equal(s.$('preview-name').children.length, 0);
  s.choose({ name: 'avatar.svg' }); await tick();
  s.submit(); await tick();
  assert.equal(s.state.stored.nickname, '<b>$&🙂</b>');
  assert.equal(s.state.stored.avatar, png);
  s.$('reset').click();
  assert.equal(s.state.stored.nickname, '<b>$&🙂</b>');
  s.submit(); await tick();
  assert.equal(s.state.stored.nickname, '天一一');
  assert.equal(s.state.stored.avatar, '');
});

test('read and write errors are visible, retain the draft, and permit retry', async t => {
  const s = setup(t);
  s.state.failRead = true;
  s.run(); await tick();
  assert.equal(s.$('nickname').disabled, true);
  assert.match(s.$('status').textContent, /读取设置失败/);
  s.state.failRead = false;
  s.$('reload').click(); await tick();
  s.input('保留我的修改');
  s.state.failWrite = true;
  s.submit(); await tick();
  assert.equal(s.$('nickname').value, '保留我的修改');
  assert.match(s.$('status').textContent, /保存失败/);
  assert.equal(s.state.writes, 0);
  s.state.failWrite = false;
  s.submit(); await tick();
  assert.equal(s.state.stored.nickname, '保留我的修改');
});

test('failed image decoding keeps the previous avatar and latest selection wins an import race', async t => {
  const s = setup(t, { nickname: '已保存', avatar: png });
  s.run(); await tick();
  s.w.MakerAvatar.importFile = async () => { throw new Error('损坏图片'); };
  s.choose({ name: 'bad.png' }); await tick();
  assert.equal(s.$('preview-avatar').src, png);
  assert.match(s.$('status').textContent, /损坏图片/);
  const jobs = [];
  s.w.MakerAvatar.importFile = () => new Promise(resolve => jobs.push(resolve));
  s.choose({ name: 'slow.png' });
  s.choose({ name: 'fast.png' });
  jobs[1](png); await tick();
  jobs[0]('outdated-value'); await tick();
  assert.equal(s.$('preview-avatar').src, png);
});

test('external changes refresh a clean popup but do not silently overwrite a dirty draft', async t => {
  const s = setup(t);
  s.run(); await tick();
  s.state.external({ nickname: '来自另一个窗口', avatar: '' });
  assert.equal(s.$('nickname').value, '来自另一个窗口');
  s.input('本地草稿');
  s.state.external({ nickname: '外部更新', avatar: '' });
  assert.equal(s.$('nickname').value, '本地草稿');
  assert.equal(s.$('save').disabled, true);
  assert.equal(s.$('reload').hidden, false);
  s.submit(); await tick();
  assert.equal(s.state.stored.nickname, '外部更新');
  s.$('reload').click(); await tick();
  assert.equal(s.$('nickname').value, '外部更新');
});

test('a storage change during popup initialization is reread instead of showing stale settings', async t => {
  const s = setup(t);
  const normalGet = s.w.chrome.storage.local.get;
  let complete;
  s.w.chrome.storage.local.get = () => new Promise(resolve => { complete = resolve; });
  s.run();
  s.state.external({ nickname: '最新保存', avatar: '' });
  s.w.chrome.storage.local.get = normalGet;
  complete({ makerIdentity: { nickname: '过期读取', avatar: '' } });
  await tick();
  assert.equal(s.$('nickname').value, '最新保存');
});
