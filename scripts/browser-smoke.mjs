import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { root } from './project.mjs';

const profileDir = await mkdtemp(path.join(os.tmpdir(), 'maker-tianyi-browser-'));
let context;
let passed = 0;
const pass = label => { passed++; console.log(`PASS ${label}`); };
const errors = [];
try {
  context = await chromium.launchPersistentContext(profileDir, {
    channel: 'chromium', headless: true, viewport: { width: 368, height: 640 },
    ignoreDefaultArgs: ['--disable-extensions'],
    args: ['--enable-unsafe-extension-debugging']
  });
  context.setDefaultTimeout(15000);
  context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
  const extensionSession = await context.browser().newBrowserCDPSession();
  const { id: extensionId } = await extensionSession.send('Extensions.loadUnpacked', { path: root });
  assert.match(extensionId, /^[a-p]{32}$/);
  console.log(`Loaded unpacked extension ${extensionId} in ${context.browser().version()}`);
  const jpg = await readFile(path.join(root, 'assets/tianyi.jpg'));
  const feedback = await readFile(path.join(root, 'tests/fixtures/feedback.html'), 'utf8');
  const card = await readFile(path.join(root, 'tests/fixtures/card.html'), 'utf8');
  const cardCSS = await readFile(path.join(root, 'tests/fixtures/card.css'), 'utf8');
  const taraImage = await readFile(path.join(root, 'assets/cards/tara.webp'));
  const fixture = '<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/test-card.css"></head><body><div class="flex items-center"><div class="relative flex items-center"><img alt="Bot Avatar" src="/assets/tap-test.webp"><svg id="ring"></svg></div><div class="chat-thinking-shimmer">嗒啦啦正在思考...</div></div><p id="prose">正文提到嗒啦啦</p><blockquote><span id="author">新东方在逃学员</span><p id="quote">评价一下嗒啦啦的工作</p></blockquote>' + feedback + card + '</body></html>';
  await context.route('https://maker.taptap.cn/**', route => {
    if (new URL(route.request().url()).pathname === '/test-card.css') return route.fulfill({ contentType: 'text/css', body: cardCSS });
    if (new URL(route.request().url()).pathname === '/membership/ultra-tara.webp') return route.fulfill({ contentType: 'image/webp', body: taraImage });
    if (new URL(route.request().url()).pathname.startsWith('/assets/')) return route.fulfill({ contentType: 'image/jpeg', body: jpg });
    return route.fulfill({ contentType: 'text/html; charset=utf-8', body: fixture });
  });
  const maker = await context.newPage();
  await maker.goto('https://maker.taptap.cn/app/browser-test');
  await maker.waitForFunction(() => document.querySelector('.chat-thinking-shimmer').textContent === '天一一正在思考...');
  const popupUrl = `chrome-extension://${extensionId}/popup.html`;
  const popup = await context.newPage();
  await popup.goto(popupUrl);
  await popup.waitForFunction(() => !document.querySelector('#nickname').disabled);
  assert.equal(await popup.locator('#nickname').inputValue(), '天一一');
  assert.equal(await popup.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  pass('extension loads, default settings render, popup fits its viewport');

  assert.equal(await maker.locator('#feedback-caption').textContent(), '评价一下天一一的工作');
  await maker.locator('#feedback button').first().evaluate(button => {
    button.addEventListener('click', () => { button.dataset.clicked = 'yes'; });
  });
  await maker.locator('#feedback button').first().dispatchEvent('click');
  assert.equal(await maker.locator('#feedback button').first().getAttribute('data-clicked'), 'yes');
  pass('observed rating caption uses the default nickname and feedback controls still work');

  const nickname = '<b>小林 $&🙂</b>';
  await popup.locator('#nickname').fill(nickname);
  await popup.locator('#save').click();
  await popup.waitForFunction(() => document.querySelector('#status').dataset.kind === 'success');
  await maker.waitForFunction(name => document.querySelector('.chat-thinking-shimmer').textContent === name + '正在思考...', nickname);
  assert.equal(await maker.locator('.chat-thinking-shimmer b').count(), 0);
  assert.equal(await maker.locator('#prose').textContent(), '正文提到嗒啦啦');
  assert.equal(await maker.locator('#feedback-caption').textContent(), `评价一下${nickname}的工作`);
  assert.equal(await maker.locator('#feedback-caption b').count(), 0);
  assert.equal(await maker.locator('#author').textContent(), '新东方在逃学员');
  assert.equal(await maker.locator('#quote').textContent(), '评价一下嗒啦啦的工作');
  pass('literal nickname persists and updates the already-open chat');

  await maker.locator('#feedback-caption').evaluate(caption => { caption.firstChild.nodeValue = '评价一下嗒啦啦的工作'; });
  await maker.waitForFunction(name => document.querySelector('#feedback-caption').textContent === `评价一下${name}的工作`, nickname);
  await maker.locator('#feedback').evaluate(box => box.remove());
  await maker.locator('body').evaluate((body, html) => body.insertAdjacentHTML('beforeend', html), feedback);
  await maker.waitForFunction(name => document.querySelector('#feedback-caption').textContent === `评价一下${name}的工作`, nickname);
  pass('rating caption follows page rewrites and newly mounted replies');

  const png = await readFile(path.join(root, 'assets/icons/icon128.png'));
  const ico = Buffer.alloc(22 + png.length);
  ico.writeUInt16LE(1, 2); ico.writeUInt16LE(1, 4); ico[6] = ico[7] = 128;
  ico.writeUInt16LE(1, 10); ico.writeUInt16LE(32, 12); ico.writeUInt32LE(png.length, 14); ico.writeUInt32LE(22, 18); png.copy(ico, 22);
  const bmp = Buffer.alloc(70);
  bmp.write('BM'); bmp.writeUInt32LE(70, 2); bmp.writeUInt32LE(54, 10); bmp.writeUInt32LE(40, 14);
  bmp.writeInt32LE(2, 18); bmp.writeInt32LE(2, 22); bmp.writeUInt16LE(1, 26); bmp.writeUInt16LE(24, 28); bmp.fill(180, 54);
  const webp = await popup.evaluate(() => { const c = document.createElement('canvas'); c.width = c.height = 4; c.getContext('2d').fillRect(0, 0, 4, 4); return c.toDataURL('image/webp').split(',')[1]; });
  const images = [
    { name: 'avatar.jpg', mimeType: 'image/jpeg', buffer: jpg },
    { name: 'avatar.png', mimeType: 'image/png', buffer: png },
    { name: 'avatar.webp', mimeType: 'image/webp', buffer: Buffer.from(webp, 'base64') },
    { name: 'avatar.gif', mimeType: 'image/gif', buffer: Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64') },
    { name: 'avatar.avif', mimeType: 'image/avif', buffer: await readFile(path.join(root, 'tests/fixtures/avatar.avif')) },
    { name: 'avatar.bmp', mimeType: 'image/bmp', buffer: bmp },
    { name: 'avatar.ico', mimeType: 'image/x-icon', buffer: ico },
    { name: 'avatar.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40"><script>globalThis.compromised=true</script><rect width="80" height="40" fill="#5ed9b9"/></svg>') }
  ];
  for (const image of images) {
    await popup.locator('#avatar-file').setInputFiles(image);
    await popup.waitForFunction(() => /图片已准备好/.test(document.querySelector('#status').textContent));
    const dimensions = await popup.locator('#preview-avatar').evaluate(async image => { await image.decode(); return [image.naturalWidth, image.naturalHeight]; });
    assert.equal(dimensions[0], dimensions[1]);
    assert.ok(dimensions[0] <= 512);
    assert.match(await popup.locator('#preview-avatar').getAttribute('src'), /^data:image\/png;base64,/);
    pass(`real decoder imports ${image.name.split('.').pop().toUpperCase()}`);
  }
  assert.equal(await popup.evaluate(() => globalThis.compromised), undefined);
  const customAvatar = await popup.locator('#preview-avatar').getAttribute('src');
  await popup.locator('#save').click();
  await popup.waitForFunction(() => document.querySelector('#status').dataset.kind === 'success');
  await maker.waitForFunction(src => document.querySelector('[alt="Bot Avatar"]').getAttribute('src') === src, customAvatar);
  assert.equal(await maker.locator('[alt="Bot Avatar"]').evaluate(async img => { await img.decode(); return img.naturalWidth > 0; }), true);
  await popup.reload();
  await popup.waitForFunction(() => !document.querySelector('#nickname').disabled);
  assert.equal(await popup.locator('#nickname').inputValue(), nickname);
  assert.equal(await popup.locator('#preview-avatar').getAttribute('src'), customAvatar);
  const secondMaker = await context.newPage();
  await secondMaker.goto('https://maker.taptap.cn/app/second-conversation');
  await secondMaker.waitForFunction(name => document.querySelector('.chat-thinking-shimmer').textContent === name + '正在思考...', nickname);
  assert.equal(await secondMaker.locator('#feedback-caption').textContent(), `评价一下${nickname}的工作`);
  pass('custom PNG displays in live chat and survives reopening settings and a new tab');

  await popup.locator('#avatar-file').setInputFiles({ name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('not an image') });
  await popup.waitForFunction(() => document.querySelector('#status').dataset.kind === 'error');
  assert.equal(await popup.locator('#preview-avatar').getAttribute('src'), customAvatar);
  await popup.locator('#avatar-file').setInputFiles({ name: 'oversize.png', mimeType: 'image/png', buffer: Buffer.alloc(10 * 1024 * 1024 + 1) });
  await popup.waitForFunction(() => /不能超过 10 MB/.test(document.querySelector('#status').textContent));
  assert.equal(await popup.locator('#preview-avatar').getAttribute('src'), customAvatar);
  await popup.locator('#avatar-file').setInputFiles({ name: 'huge.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="20000" height="20000"/>') });
  await popup.waitForFunction(() => /图片尺寸过大/.test(document.querySelector('#status').textContent));
  assert.equal(await popup.locator('#preview-avatar').getAttribute('src'), customAvatar);
  pass('corrupt, oversized, and excessive-dimension files retain the previous avatar');

  await popup.locator('#reset').click();
  await popup.locator('#save').click();
  await popup.waitForFunction(() => document.querySelector('#status').dataset.kind === 'success');
  for (const page of [maker, secondMaker]) {
    await page.waitForFunction(() => document.querySelector('.chat-thinking-shimmer').textContent === '天一一正在思考...');
    assert.equal(await page.locator('#feedback-caption').textContent(), '评价一下天一一的工作');
  }
  assert.equal(await popup.locator('#preview-avatar').getAttribute('src'), `chrome-extension://${extensionId}/assets/tianyi.jpg`);
  pass('restoring defaults updates every open Maker tab');
  await mkdir(path.join(root, 'test-results'), { recursive: true });
  await popup.screenshot({ path: path.join(root, 'test-results/settings.png'), fullPage: true });

  await maker.setViewportSize({ width: 1000, height: 700 });
  await popup.locator('#card-tab').click();
  await popup.waitForFunction(() => document.querySelector('#card-tara-image').src === 'https://maker.taptap.cn/membership/ultra-tara.webp');
  await popup.locator('#card-tara-image').evaluate(image => image.decode());
  assert.equal(await popup.locator('#chat-panel').isVisible(), false);
  assert.equal(await popup.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  pass('card grid discovers the website preset without additional permissions');

  await popup.locator('#card-frog').click();
  await popup.locator('#card-save').click();
  await popup.waitForFunction(() => document.querySelector('#card-status').dataset.kind === 'success');
  for (const page of [maker, secondMaker]) await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-decoration="tara"]')).backgroundImage.includes('/assets/cards/frog.png'));
  const decoration = maker.locator('[data-decoration="tara"]');
  const geometry = await decoration.evaluate(el => {
    const style = getComputedStyle(el);
    return { position: style.position, pointer: style.pointerEvents, mask: style.maskImage, fade: getComputedStyle(el, '::after').backgroundImage, display: style.display };
  });
  assert.equal(geometry.position, 'absolute');
  assert.equal(geometry.pointer, 'none');
  assert.equal(geometry.display, 'block');
  assert.match(geometry.mask, /gradient/); assert.match(geometry.fade, /gradient/);
  assert.equal(await maker.locator('dd').textContent(), '600,000');
  await popup.screenshot({ path: path.join(root, 'test-results/card-settings.png'), fullPage: true });
  await maker.locator('article').screenshot({ path: path.join(root, 'test-results/frog-card.png') });
  await maker.setViewportSize({ width: 360, height: 640 });
  assert.equal(await decoration.evaluate(el => getComputedStyle(el).display), 'none');
  pass('frog preset updates all cards while preserving fade, text, and responsive visibility');

  const upload = { name: 'tall.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="400"><rect x="50" y="20" width="100" height="380" fill="#e9cb7c"/></svg>') };
  await popup.locator('#card-file').setInputFiles(upload);
  await popup.waitForFunction(() => /图片已准备好/.test(document.querySelector('#card-status').textContent));
  const customCard = await popup.locator('#card-preview-image').getAttribute('src');
  assert.deepEqual(await popup.locator('#card-preview-image').evaluate(async image => {
    await image.decode(); const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
    return [image.naturalWidth, image.naturalHeight, ctx.getImageData(0, 0, 1, 1).data[3]];
  }), [200, 400, 0]);
  await popup.locator('#card-save').click();
  await popup.waitForFunction(() => document.querySelector('#card-status').dataset.kind === 'success');
  await maker.waitForFunction(data => getComputedStyle(document.querySelector('[data-decoration="tara"]')).backgroundImage.includes(data), customCard);
  await popup.reload(); await popup.locator('#card-tab').click();
  await popup.waitForFunction(() => document.querySelector('#card-custom').getAttribute('aria-pressed') === 'true');
  assert.equal(await popup.locator('#card-preview-image').getAttribute('src'), customCard);
  assert.equal(await popup.locator('#nickname').inputValue(), '天一一');
  pass('uploaded card art keeps aspect ratio and alpha, persists separately from chat settings');

  await popup.locator('#card-file').setInputFiles({ name: 'bad.png', mimeType: 'image/png', buffer: Buffer.from('broken') });
  await popup.waitForFunction(() => document.querySelector('#card-status').dataset.kind === 'error');
  assert.equal(await popup.locator('#card-preview-image').getAttribute('src'), customCard);
  await maker.locator('section[aria-label="制造会员"]').evaluate(el => el.remove());
  await maker.locator('body').evaluate((el, html) => el.insertAdjacentHTML('beforeend', html), card);
  await maker.waitForFunction(data => getComputedStyle(document.querySelector('[data-decoration="tara"]')).backgroundImage.includes(data), customCard);
  pass('broken uploads preserve the card choice and newly mounted cards receive saved art');

  await popup.locator('#card-reset').click(); await popup.locator('#card-save').click();
  await popup.waitForFunction(() => document.querySelector('#card-status').dataset.kind === 'success');
  for (const page of [maker, secondMaker]) await page.waitForFunction(() => !document.querySelector('[data-decoration="tara"]').hasAttribute('data-maker-card-art'));
  await maker.addStyleTag({ content: '.membership-art{background-image:none!important}' });
  await maker.waitForFunction(() => document.querySelector('[data-decoration="tara"]').style.getPropertyValue('--maker-card-background').includes('/assets/cards/tara.webp'));
  await popup.evaluate(() => { document.querySelector('#card-tara-image').dispatchEvent(new Event('error')); });
  assert.equal(await popup.locator('#card-tara-image').getAttribute('src'), `chrome-extension://${extensionId}/assets/cards/tara.webp`);
  pass('reset restores native art; missing page art and failed preview use the bundled fallback');
  assert.deepEqual(errors, []);
  console.log(`Browser smoke: ${passed} checks passed.`);
} catch (error) {
  console.error('Browser errors:', errors);
  if (context) {
    await mkdir(path.join(root, 'test-results'), { recursive: true });
    for (const [index, page] of context.pages().entries()) {
      console.error(`Page ${index}: ${page.url()}`);
      console.error(await page.locator('body').textContent().catch(() => 'No body'));
      await page.screenshot({ path: path.join(root, `test-results/failure-${index}.png`), fullPage: true }).catch(() => {});
    }
  }
  throw error;
} finally {
  await context?.close();
  // Only the freshly-created, isolated test profile is removed; no user's browser is involved.
  const resolved = path.resolve(profileDir);
  if (path.dirname(resolved) === path.resolve(os.tmpdir()) && path.basename(resolved).startsWith('maker-tianyi-browser-')) {
    await rm(resolved, { recursive: true, force: true, maxRetries: 3 });
  }
}
