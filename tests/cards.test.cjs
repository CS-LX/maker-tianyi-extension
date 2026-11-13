const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const fixture = read('tests/fixtures/card.html');
const png = 'data:image/png;base64,' + fs.readFileSync(path.join(root, 'assets/icons/icon32.png')).toString('base64');
const site = 'https://maker.taptap.cn/membership/ultra-tara.webp';
const tick = () => new Promise(resolve => setTimeout(resolve, 15));
function setup(t, { popup = false, stored, failed = [] } = {}) {
  const html = popup ? read('popup.html') : '<style>.membership-art{background-image:url(' + site + ')}</style>' + fixture;
  const dom = new JSDOM(html, { url: 'https://maker.taptap.cn/credits', runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  const w = dom.window, listeners = [], messages = [];
  const state = { stored, readError: false, writeError: false, requests: [], source: site, writes: 0 };
  w.chrome = {
    runtime: { id: 'test', getURL: file => `https://extension.test/${file}`, onMessage: { addListener: fn => messages.push(fn) } },
    storage: { local: {
      get: async () => { if (state.readError) throw new Error('read error'); return { makerCardArt: state.stored }; },
      set: async data => { if (state.writeError) throw new Error('write error'); state.writes++; state.external(data.makerCardArt); }
    }, onChanged: { addListener: fn => listeners.push(fn) } },
    tabs: { query: async () => [{ id: 1, active: true }], sendMessage: async () => ({ source: state.source }) }
  };
  state.external = value => { state.stored = value; listeners.forEach(fn => fn({ makerCardArt: { newValue: value } }, 'local')); };
  w.Image = class {
    set src(url) { state.requests.push(url); w.queueMicrotask(() => { if (failed.includes(url)) this.onerror?.(); else this.onload?.(); }); }
  };
  w.MakerAvatar = { importFile: async () => png };
  const $ = selector => w.document.querySelector(selector);
  const run = () => ['profile.js', 'card-profile.js', popup ? 'card-popup.js' : 'cards.js'].forEach(file => w.eval(read(file)));
  const submit = () => $('#card-form').dispatchEvent(new w.Event('submit', { cancelable: true }));
  const upload = () => {
    Object.defineProperty($('#card-file'), 'files', { configurable: true, value: [{ name: 'card.png' }] });
    $('#card-file').dispatchEvent(new w.Event('change'));
  };
  return { w, state, $, run, submit, upload, messages };
}

test('card defaults preserve the live page source and reject untrusted preset URLs', async t => {
  const s = setup(t); s.run(); await tick();
  assert.equal(s.$('[data-decoration]').hasAttribute('data-maker-card-art'), false);
  const C = s.w.MakerCard;
  for (const value of ['https://evil.invalid/assets/a.png', 'javascript:alert(1)', 'data:image/svg+xml,<svg/>', 'https://user:pass@maker.taptap.cn/assets/a.png', '/api/private.png']) assert.equal(C.siteImage(value), '');
  assert.equal(C.siteImage('/assets/tara-new.webp'), 'https://maker.taptap.cn/assets/tara-new.webp');
  assert.equal(C.normalize({ preset: 'custom', image: 'bad' }).preset, 'tara');
  let reply;
  s.messages[0]({ type: C.MESSAGE }, { id: 'test' }, value => { reply = value; });
  assert.equal(reply.source, site);
});

test('card art updates multiple cards, restores native style, and leaves other tiers untouched', async t => {
  const s = setup(t); s.w.document.body.insertAdjacentHTML('beforeend', fixture + fixture.replace('data-tier="ultra"', 'data-tier="pro"') + fixture.replace('data-audience="standard"', 'data-audience="student"'));
  s.run(); await tick();
  s.state.external({ preset: 'frog', image: '' }); await tick();
  assert.equal(s.w.document.querySelectorAll('[data-maker-card-art]').length, 2);
  assert.match(s.$('[data-decoration]').style.getPropertyValue('--maker-card-background'), /frog.png/);
  assert.equal(s.$('dd').textContent, '600,000');
  s.state.external({ preset: 'custom', image: png }); await tick();
  assert.ok(s.$('[data-decoration]').style.getPropertyValue('--maker-card-background').includes(png));
  let reply;
  s.messages[0]({ type: s.w.MakerCard.MESSAGE }, { id: 'test' }, value => { reply = value; });
  assert.equal(reply.source, site, 'source discovery must not return our replacement');
  s.state.external(undefined); await tick();
  assert.equal(s.w.document.querySelectorAll('[data-maker-card-art]').length, 0);
  assert.equal(s.$('[data-decoration]').style.getPropertyValue('--maker-card-background'), '');
});

test('missing or failed native art falls back once without an observer loop', async t => {
  const s = setup(t, { failed: [site] }); s.run(); await tick();
  assert.match(s.$('[data-decoration]').style.getPropertyValue('--maker-card-background'), /assets\/cards\/tara.webp/);
  const count = s.state.requests.length; await tick(); await tick();
  assert.equal(s.state.requests.length, count);
  s.$('style').textContent = '.membership-art{background-image:none}'; await tick();
  assert.match(s.$('[data-decoration]').style.getPropertyValue('--maker-card-background'), /tara.webp/);
  s.$('style').textContent = '.membership-art{background-image:url(/assets/tara-new.webp)}'; await tick();
  assert.equal(s.$('[data-decoration]').hasAttribute('data-maker-card-art'), false);
});

test('card observer follows late mount, recycled roles, and detached cards', async t => {
  const s = setup(t, { stored: { preset: 'frog', image: '' } }); s.run(); await tick();
  const article = s.$('article');
  article.dataset.tier = 'pro'; await tick();
  assert.equal(s.$('[data-decoration]').hasAttribute('data-maker-card-art'), false);
  article.dataset.tier = 'ultra'; await tick();
  assert.equal(s.$('[data-decoration]').hasAttribute('data-maker-card-art'), true);
  article.remove(); await tick();
  assert.equal(article.querySelector('[data-decoration]').hasAttribute('data-maker-card-art'), false);
  s.w.document.body.append(article); await tick();
  assert.equal(s.$('[data-decoration]').hasAttribute('data-maker-card-art'), true);
  s.w.document.body.innerHTML = fixture; await tick();
  assert.match(s.$('[data-decoration]').style.getPropertyValue('--maker-card-background'), /frog.png/);
});

test('card storage races prefer the latest event and malformed images fall back', async t => {
  const s = setup(t, { failed: [png] });
  let resolve;
  s.w.chrome.storage.local.get = () => new Promise(done => { resolve = done; });
  s.run();
  s.state.external({ preset: 'frog', image: '' });
  resolve({ makerCardArt: { preset: 'tara', image: '' } }); await tick();
  assert.match(s.$('[data-decoration]').style.getPropertyValue('--maker-card-background'), /frog.png/);
  s.state.external({ preset: 'custom', image: png }); await tick();
  assert.equal(s.$('[data-decoration]').hasAttribute('data-maker-card-art'), false, 'undecodable custom data restores the native preset');
});

test('card grid previews then saves independently, with source discovery and keyboard tabs', async t => {
  const s = setup(t, { popup: true }); s.run(); await tick();
  s.$('#card-tab').click(); await tick();
  assert.equal(s.$('#chat-panel').hidden, true);
  assert.equal(s.$('#card-panel').hidden, false);
  assert.equal(s.$('#card-tara-image').src, site);
  s.$('#card-frog').click();
  assert.match(s.$('#card-preview-image').src, /frog.png/);
  assert.equal(s.state.writes, 0);
  s.submit(); await tick();
  assert.equal(s.state.stored.preset, 'frog');
  s.upload(); await tick(); s.submit(); await tick();
  assert.equal(s.state.stored.image, png);
  s.$('#card-tara').click();
  assert.equal(s.$('#card-custom-image').src, png, 'switching presets retains the uploaded choice');
  s.$('#card-tab').dispatchEvent(new s.w.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
  assert.equal(s.$('#chat-panel').hidden, false);
  s.$('#card-reset').click(); s.submit(); await tick();
  assert.equal(s.state.stored.preset, 'tara');
  assert.equal(s.state.stored.image, '');
});

test('card imports and reset use latest intent while failed uploads preserve the draft', async t => {
  const s = setup(t, { popup: true }); s.run(); await tick();
  s.$('#card-frog').click();
  s.w.MakerAvatar.importFile = async () => { throw new Error('图片损坏'); };
  s.upload(); await tick();
  assert.match(s.$('#card-preview-image').src, /frog.png/);
  assert.match(s.$('#card-status').textContent, /图片损坏/);
  let finish;
  s.w.MakerAvatar.importFile = () => new Promise(resolve => { finish = resolve; });
  s.upload(); s.$('#card-tara').click(); finish(png); await tick();
  assert.equal(s.$('#card-tara').getAttribute('aria-pressed'), 'true');
  assert.equal(s.$('#card-custom-image').hidden, true);
});

test('card settings retain drafts on storage failure and detect conflicting windows', async t => {
  const s = setup(t, { popup: true }); s.state.readError = true; s.run(); await tick();
  assert.equal(s.$('#card-frog').disabled, true);
  s.state.readError = false; s.$('#card-reload').click(); await tick();
  s.$('#card-frog').click(); s.state.writeError = true; s.submit(); await tick();
  assert.match(s.$('#card-status').textContent, /保存失败/);
  assert.equal(s.$('#card-frog').getAttribute('aria-pressed'), 'true');
  s.state.writeError = false; s.submit(); await tick();
  s.$('#card-tara').click(); s.state.external({ preset: 'custom', image: png });
  assert.equal(s.$('#card-save').disabled, true);
  assert.equal(s.$('#card-tara').getAttribute('aria-pressed'), 'true');
  s.$('#card-reload').click(); await tick();
  assert.equal(s.$('#card-custom').getAttribute('aria-pressed'), 'true');
});
