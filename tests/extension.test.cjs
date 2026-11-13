const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const extension = path.resolve(__dirname, '..');
const script = fs.readFileSync(path.join(extension, 'content.js'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(extension, 'manifest.json'), 'utf8'));
const avatar = 'chrome-extension://test-extension/assets/tianyi.jpg';
const original = '/assets/tap-BM8wfTgR.webp';
const bot = `<img alt="Bot Avatar" src="${original}" class="w-6 h-6 object-cover rounded-full">`;
const row = `<div class="flex items-center gap-2"><div class="relative flex h-8 w-8 items-center justify-center">${bot}<svg id="progress-ring"></svg></div><div class="chat-thinking-shimmer text-sm">嗒啦啦正在执行命令...</div><span>6m38s</span></div>`;

function fixture(t, html = '') {
  const dom = new JSDOM(`<!doctype html><html><body>${html}</body></html>`, {
    url: 'https://maker.taptap.cn/app/test?chatId=first', runScripts: 'outside-only'
  });
  dom.window.chrome = { runtime: { getURL: file => `chrome-extension://test-extension/${file}` } };
  t.after(() => dom.window.close());
  return dom;
}
const tick = () => new Promise(resolve => setTimeout(resolve, 10));
const run = dom => dom.window.eval(script);

test('manifest limits injection and the bundled avatar to Maker', () => {
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.content_scripts[0].matches, ['https://maker.taptap.cn/*']);
  assert.equal(manifest.content_scripts[0].run_at, 'document_start');
  assert.deepEqual(manifest.web_accessible_resources[0].matches, ['https://maker.taptap.cn/*']);
  assert.equal(manifest.permissions, undefined);
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
