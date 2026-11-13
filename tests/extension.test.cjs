const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const extension = path.resolve(__dirname, '..');
const script = fs.readFileSync(path.join(extension, 'content.js'), 'utf8');
const profileScript = fs.readFileSync(path.join(extension, 'profile.js'), 'utf8');
const feedback = fs.readFileSync(path.join(extension, 'tests/fixtures/feedback.html'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(extension, 'manifest.json'), 'utf8'));
const avatar = 'chrome-extension://test-extension/assets/tianyi.jpg';
const original = '/assets/tap-BM8wfTgR.webp';
const bot = `<img alt="Bot Avatar" src="${original}" class="w-6 h-6 object-cover rounded-full">`;
const row = `<div class="flex items-center gap-2"><div class="relative flex h-8 w-8 items-center justify-center">${bot}<svg id="progress-ring"></svg></div><div class="chat-thinking-shimmer text-sm">嗒啦啦正在执行命令...</div><span>6m38s</span></div>`;

function fixture(t, html = '', stored = undefined) {
  const dom = new JSDOM(`<!doctype html><html><body>${html}</body></html>`, {
    url: 'https://maker.taptap.cn/app/test?chatId=first', runScripts: 'outside-only'
  });
  const listeners = new Set();
  dom.window.chrome = {
    runtime: { getURL: file => `chrome-extension://test-extension/${file}` },
    storage: { local: { get: async () => ({ makerIdentity: stored }) }, onChanged: { addListener: listener => listeners.add(listener) } }
  };
  dom.changeProfile = value => {
    stored = value;
    for (const listener of listeners) listener({ makerIdentity: { newValue: value } }, 'local');
  };
  t.after(() => dom.window.close());
  return dom;
}
const tick = () => new Promise(resolve => setTimeout(resolve, 10));
const run = dom => { dom.window.eval(profileScript); dom.window.eval(script); };

test('replaces the observed rating prompt while preserving quotes, authors, and feedback controls', async t => {
  const dom = fixture(t, feedback + '<blockquote><span id="author">新东方在逃学员</span><p id="quote">评价一下嗒啦啦的工作</p></blockquote>');
  const doc = dom.window.document;
  const buttons = [...doc.querySelectorAll('#feedback button')];
  let clicks = 0;
  buttons[0].addEventListener('click', () => clicks++);
  run(dom);
  await tick();
  assert.equal(doc.querySelector('#feedback-caption').textContent, '评价一下天一一的工作');
  assert.equal(doc.querySelector('#author').textContent, '新东方在逃学员');
  assert.equal(doc.querySelector('#quote').textContent, '评价一下嗒啦啦的工作');
  assert.deepEqual([...doc.querySelectorAll('#feedback button')], buttons);
  buttons[0].click();
  assert.equal(clicks, 1);
});

test('rating prompt handles late mount, live renames, page rewrites, and conversation replacement', async t => {
  const dom = fixture(t, '', { nickname: '小明', avatar: '' });
  const doc = dom.window.document;
  run(dom);
  await tick();
  doc.body.innerHTML = feedback;
  await tick();
  const caption = doc.querySelector('#feedback-caption');
  assert.equal(caption.textContent, '评价一下小明的工作');
  dom.changeProfile({ nickname: '嗒啦啦-$&<b>🙂', avatar: '' });
  await tick();
  assert.equal(caption.textContent, '评价一下嗒啦啦-$&<b>🙂的工作');
  assert.equal(caption.querySelector('b'), null);
  dom.changeProfile({ nickname: '新名字', avatar: '' });
  await tick();
  assert.equal(caption.textContent, '评价一下新名字的工作');
  caption.firstChild.nodeValue = '评价一下嗒啦啦的工作';
  await tick();
  assert.equal(caption.textContent, '评价一下新名字的工作');
  doc.body.innerHTML = feedback;
  await tick();
  assert.equal(doc.querySelector('#feedback-caption').textContent, '评价一下新名字的工作');
  dom.changeProfile(undefined);
  await tick();
  assert.equal(doc.querySelector('#feedback-caption').textContent, '评价一下天一一的工作');
});

test('rating prompt requires both the observed structure and fixed UI wording', async t => {
  const dom = fixture(t, feedback);
  const doc = dom.window.document;
  const caption = doc.querySelector('#feedback-caption');
  for (const value of ['嗒啦啦', '嗒啦啦的用户昵称', '用户说：评价一下嗒啦啦的工作']) {
    const author = caption.cloneNode(false);
    author.removeAttribute('id');
    author.textContent = value;
    caption.after(author);
  }
  const lookalike = caption.cloneNode(true);
  lookalike.id = 'lookalike';
  doc.body.append(lookalike);
  run(dom);
  await tick();
  assert.deepEqual([...doc.querySelectorAll('#feedback span')].map(el => el.textContent).sort(), [
    '评价一下天一一的工作', '嗒啦啦', '嗒啦啦的用户昵称', '用户说：评价一下嗒啦啦的工作'
  ].sort());
  assert.equal(lookalike.textContent, '评价一下嗒啦啦的工作');
  for (const wrapper of ['<div class="prose">', '<div class="markdown">', '<pre>', '<code>', '<div contenteditable="true">', '<div role="textbox">']) {
    const holder = doc.createElement('div');
    holder.innerHTML = wrapper + feedback;
    doc.body.append(holder);
    await tick();
    assert.equal(holder.querySelector('#feedback-caption').textContent, '评价一下嗒啦啦的工作', wrapper);
  }
});

test('rating prompt restores recycled nodes and settles after its own mutations', async t => {
  const dom = fixture(t, feedback + '<div id="editor" contenteditable="true"></div>');
  const doc = dom.window.document;
  let mutations = 0;
  const counter = new dom.window.MutationObserver(records => { mutations += records.length; });
  counter.observe(doc, { subtree: true, characterData: true, childList: true });
  run(dom);
  await tick();
  const settled = mutations;
  await tick();
  assert.equal(mutations, settled);
  const box = doc.querySelector('#feedback');
  const caption = doc.querySelector('#feedback-caption');
  box.classList.remove('border-t');
  await tick();
  assert.equal(caption.textContent, '评价一下嗒啦啦的工作');
  box.classList.add('border-t');
  await tick();
  assert.equal(caption.textContent, '评价一下天一一的工作');
  box.remove();
  await tick();
  dom.changeProfile({ nickname: '更新后的昵称', avatar: '' });
  doc.body.append(box);
  await tick();
  assert.equal(caption.textContent, '评价一下更新后的昵称的工作');
  doc.querySelector('#editor').append(box);
  await tick();
  assert.equal(caption.textContent, '评价一下嗒啦啦的工作');
  counter.disconnect();
});

test('manifest limits injection and the bundled avatar to Maker', () => {
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.content_scripts[0].matches, ['https://maker.taptap.cn/*']);
  assert.equal(manifest.content_scripts[0].run_at, 'document_start');
  assert.deepEqual(manifest.web_accessible_resources[0].matches, ['https://maker.taptap.cn/*']);
  assert.deepEqual(manifest.permissions, ['storage']);
  assert.equal(manifest.background, undefined);
  for (const file of [...manifest.content_scripts[0].js, ...manifest.web_accessible_resources[0].resources]) {
    assert.ok(fs.existsSync(path.join(extension, file)), file);
  }
  assert.deepEqual([...fs.readFileSync(path.join(extension, 'assets/tianyi.jpg')).subarray(0, 2)], [0xff, 0xd8]);
});

test('replaces both observed avatar layouts and the status without losing the progress ring', async t => {
  const dom = fixture(t, `<div class="chat-collapsed-row flex justify-start gap-2">${bot}<div class="prose">保留聊天正文</div></div>${row}`);
  const doc = dom.window.document;
  const ring = doc.querySelector('svg');
  run(dom);
  await tick();
  assert.deepEqual([...doc.querySelectorAll('img')].map(img => img.getAttribute('src')), [avatar, avatar]);
  assert.equal(doc.querySelector('.chat-thinking-shimmer').textContent, '天一一正在执行命令...');
  assert.strictEqual(doc.querySelector('svg'), ring);
  assert.equal(doc.querySelector('span').textContent, '6m38s');
  assert.equal(doc.querySelector('img').className, 'w-6 h-6 object-cover rounded-full');
});

test('handles streamed text, rewritten src/srcset, and changing asset hashes', async t => {
  const dom = fixture(t, row);
  const doc = dom.window.document;
  run(dom);
  const img = doc.querySelector('img');
  const status = doc.querySelector('.chat-thinking-shimmer');
  status.firstChild.nodeValue = '嗒啦啦正在思考...';
  img.src = '/assets/tap-new-build.webp';
  img.srcset = '/assets/tap-hidpi.webp 2x';
  await tick();
  assert.equal(status.textContent, '天一一正在思考...');
  assert.equal(img.getAttribute('src'), avatar);
  assert.equal(img.hasAttribute('srcset'), false);
  status.replaceChildren(doc.createTextNode('嗒啦啦正在读取文件...'));
  await tick();
  assert.equal(status.textContent, '天一一正在读取文件...');
});

test('works when loaded before the chat and after SPA conversation replacement', async t => {
  const dom = fixture(t);
  const doc = dom.window.document;
  run(dom);
  doc.body.innerHTML = row;
  await tick();
  assert.equal(doc.querySelector('img').getAttribute('src'), avatar);
  dom.window.history.pushState({}, '', '/app/second?chatId=next');
  doc.body.innerHTML = `<main>${row}</main>`;
  await tick();
  assert.equal(doc.querySelector('.chat-thinking-shimmer').textContent, '天一一正在执行命令...');
  assert.equal(doc.querySelector('img').getAttribute('src'), avatar);
});

test('does not change prose, code, inputs, user avatars, or unrelated site branding', async t => {
  const dom = fixture(t, `${row}<p>嗒啦啦在正文里</p><div class="prose">嗒啦啦${bot}</div><pre><code>嗒啦啦</code></pre><textarea>嗒啦啦</textarea><div contenteditable="true"><div class="chat-thinking-shimmer">嗒啦啦</div>${bot}</div><img alt="User Avatar" src="/user.jpg"><img alt="Site Logo" src="${original}"><h1>嗒啦啦</h1>`);
  const doc = dom.window.document;
  run(dom);
  await tick();
  for (const selector of ['p', '.prose', 'code', 'textarea', '[contenteditable]', 'h1']) {
    assert.ok(doc.querySelector(selector).textContent.includes('嗒啦啦'), selector);
  }
  assert.equal(doc.querySelector('.prose img').getAttribute('src'), original);
  assert.equal(doc.querySelector('[contenteditable] img').getAttribute('src'), original);
  assert.equal(doc.querySelector('[alt="User Avatar"]').getAttribute('src'), '/user.jpg');
  assert.equal(doc.querySelector('[alt="Site Logo"]').getAttribute('src'), original);
});

test('handles exact name labels when the avatar is mounted later', async t => {
  const dom = fixture(t, '<div class="flex items-center"><div id="avatar-slot" class="relative flex items-center"></div><span> 嗒啦啦 </span></div>');
  const doc = dom.window.document;
  run(dom);
  doc.querySelector('#avatar-slot').innerHTML = bot;
  await tick();
  assert.equal(doc.querySelector('span').textContent, ' 天一一 ');
  assert.equal(doc.querySelector('img').getAttribute('src'), avatar);
});

test('adapts when a previously unmarked element becomes a status label', async t => {
  const dom = fixture(t, '<div id="status">嗒啦啦正在工作...</div>');
  run(dom);
  const status = dom.window.document.querySelector('#status');
  assert.equal(status.textContent, '嗒啦啦正在工作...');
  status.className = 'chat-thinking-shimmer text-sm';
  await tick();
  assert.equal(status.textContent, '天一一正在工作...');
});

test('does not leave a Tianyi portrait on an image reused for the user', async t => {
  const dom = fixture(t, row);
  run(dom);
  const img = dom.window.document.querySelector('img');
  img.alt = 'User Avatar';
  await tick();
  assert.equal(img.getAttribute('src'), original);
  img.alt = 'Bot Avatar';
  img.srcset = '/old-bot-2x.webp 2x';
  await tick();
  img.alt = 'User Avatar';
  img.src = '/actual-user.jpg';
  await tick();
  assert.equal(img.getAttribute('src'), '/actual-user.jpg');
  assert.equal(img.hasAttribute('srcset'), false, 'old bot srcset must not override the new user avatar');
});

test('settles after its own mutations and ignores unrelated streaming prose', async t => {
  const dom = fixture(t, row + '<p id="reply"></p>');
  const doc = dom.window.document;
  let mutations = 0;
  const counter = new dom.window.MutationObserver(records => { mutations += records.length; });
  counter.observe(doc, { subtree: true, attributes: true, characterData: true, childList: true });
  run(dom);
  await tick();
  const settled = mutations;
  await tick();
  assert.equal(mutations, settled, 'observer should not repeatedly rewrite its own changes');
  doc.querySelector('#reply').textContent = '回复中引用嗒啦啦，不应替换';
  await tick();
  assert.equal(doc.querySelector('#reply').textContent, '回复中引用嗒啦啦，不应替换');
  counter.disconnect();
});

test('saved settings and successive live renames preserve original status text and literal nicknames', async t => {
  const dom = fixture(t, row, { nickname: '小明', avatar: '' });
  run(dom);
  await tick();
  const status = dom.window.document.querySelector('.chat-thinking-shimmer');
  assert.equal(status.textContent, '小明正在执行命令...');
  dom.changeProfile({ nickname: '嗒啦啦-$&<b>🙂', avatar: '' });
  await tick();
  assert.equal(status.textContent, '嗒啦啦-$&<b>🙂正在执行命令...');
  assert.equal(status.querySelector('b'), null);
  dom.changeProfile({ nickname: '新名字', avatar: '' });
  await tick();
  assert.equal(status.textContent, '新名字正在执行命令...');
  status.firstChild.nodeValue = '嗒啦啦正在读取文件...';
  await tick();
  assert.equal(status.textContent, '新名字正在读取文件...');
  dom.changeProfile(undefined);
  await tick();
  assert.equal(status.textContent, '天一一正在读取文件...');
});

test('a newer storage event wins over a stale initial read', async t => {
  const dom = fixture(t, row);
  let resolve;
  dom.window.chrome.storage.local.get = () => new Promise(done => { resolve = done; });
  run(dom);
  dom.changeProfile({ nickname: '最新名字', avatar: '' });
  resolve({ makerIdentity: { nickname: '过期名字', avatar: '' } });
  await tick();
  assert.equal(dom.window.document.querySelector('.chat-thinking-shimmer').textContent, '最新名字正在执行命令...');
});

test('storage read errors and malformed data recover to defaults', async t => {
  const dom = fixture(t, row);
  dom.window.chrome.storage.local.get = async () => { throw new Error('storage unavailable'); };
  run(dom);
  await tick();
  dom.changeProfile({ nickname: null, avatar: 'https://untrusted.invalid/avatar.svg' });
  await tick();
  assert.equal(dom.window.document.querySelector('.chat-thinking-shimmer').textContent, '天一一正在执行命令...');
  assert.equal(dom.window.document.querySelector('img').getAttribute('src'), avatar);
});

test('detached chat nodes keep weak provenance and update when reinserted', async t => {
  const dom = fixture(t, row);
  const doc = dom.window.document;
  run(dom);
  const container = doc.body.firstElementChild;
  const status = container.querySelector('.chat-thinking-shimmer');
  container.remove();
  await tick();
  dom.changeProfile({ nickname: '换个名字', avatar: '' });
  await tick();
  assert.equal(status.textContent, '天一一正在执行命令...');
  doc.body.append(container);
  await tick();
  assert.equal(status.textContent, '换个名字正在执行命令...');
});

test('role changes and moving modified nodes into an editor restore the original UI', async t => {
  const dom = fixture(t, row + '<div id="editor" contenteditable="true"></div>');
  const doc = dom.window.document;
  run(dom);
  const status = doc.querySelector('.chat-thinking-shimmer');
  status.className = '';
  await tick();
  assert.equal(status.textContent, '嗒啦啦正在执行命令...');
  const image = doc.querySelector('img');
  doc.querySelector('#editor').append(image);
  await tick();
  assert.equal(image.getAttribute('src'), original);
});

test('custom avatars update live and image failures fall back without an observer loop', async t => {
  const data = 'data:image/png;base64,' + fs.readFileSync(path.join(extension, 'assets/icons/icon32.png')).toString('base64');
  const dom = fixture(t, row);
  run(dom);
  const image = dom.window.document.querySelector('img');
  dom.changeProfile({ nickname: '自定义', avatar: data });
  await tick();
  assert.equal(image.getAttribute('src'), data);
  image.dispatchEvent(new dom.window.Event('error'));
  await tick();
  assert.equal(image.getAttribute('src'), avatar);
  image.dispatchEvent(new dom.window.Event('error'));
  await tick();
  assert.equal(image.getAttribute('src'), original);
  image.dispatchEvent(new dom.window.Event('error'));
  await tick();
  assert.equal(image.getAttribute('src'), original);
  dom.changeProfile({ nickname: '重置', avatar: '' });
  await tick();
  assert.equal(image.getAttribute('src'), avatar);
});
