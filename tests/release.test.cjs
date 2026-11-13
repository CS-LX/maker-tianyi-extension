const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { unzipSync, strFromU8 } = require('fflate');
const YAML = require('yaml');
const root = path.resolve(__dirname, '..');

test('four-part versions enforce Chrome numeric limits and reject unsafe tag values', async () => {
  const { validateVersion } = await import('../scripts/project.mjs');
  for (const value of ['1.0.0.0', '0.0.0.1', '65535.65535.65535.65535']) {
    assert.equal(validateVersion(value), value);
  }
  for (const value of ['1.0.0', '1.0.0.0.1', '01.0.0.0', '0.0.0.0', '65536.0.0.0',
    '1.-1.0.0', '1.0.0.0-beta', '1.0.0.0; echo unexpected', undefined]) {
    assert.throws(() => validateVersion(value));
  }
});

test('release validation requires a literal v prefix and the exact manifest version', async () => {
  const { validateTag } = await import('../scripts/project.mjs');
  assert.doesNotThrow(() => validateTag('v1.0.0.0', '1.0.0.0'));
  for (const tag of ['1.0.0.0', 'v1.0.0', 'v1.0.0.1', 'v1.0.0.0-beta', 'v01.0.0.0']) {
    assert.throws(() => validateTag(tag, '1.0.0.0'));
  }
});

test('workflows route main pushes to CI and version tags to Release', () => {
  const ci = YAML.parse(fs.readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8'));
  const release = YAML.parse(fs.readFileSync(path.join(root, '.github/workflows/release.yml'), 'utf8'));
  assert.deepEqual(ci.on.push.branches, ['main']);
  assert.equal(ci.on.push.tags, undefined);
  assert.deepEqual(release.on.push.tags, ['v*.*.*.*']);
  assert.equal(release.on.push.branches, undefined);
  assert.equal(ci.permissions.contents, 'read');
  assert.equal(release.jobs.release.permissions.contents, 'write');
  const steps = release.jobs.release.steps;
  const check = steps.findIndex(step => step.run?.includes('npm run check -- --tag'));
  const testStep = steps.findIndex(step => step.run === 'npm test');
  const build = steps.findIndex(step => step.run === 'npm run build');
  const publish = steps.findIndex(step => step.run?.includes('gh release create'));
  assert.ok(check >= 0 && testStep > check && build > testStep && publish > build);
  assert.ok(steps.some(step => step.run?.includes('git merge-base --is-ancestor')));
});

test('ZIP is deterministic, loads from its root, and excludes development or private files', () => {
  const { version } = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  const filename = `maker-tianyi-extension-v${version}.zip`;
  const zipPath = path.join(root, 'dist', filename);
  execFileSync(process.execPath, ['scripts/build.mjs'], { cwd: root });
  const first = fs.readFileSync(zipPath);
  execFileSync(process.execPath, ['scripts/build.mjs'], { cwd: root });
  assert.deepEqual(fs.readFileSync(zipPath), first);
  const files = unzipSync(first);
  assert.deepEqual(Object.keys(files).sort(), [
    'LICENSE', 'assets/tianyi.jpg',
    'assets/icons/icon16.png', 'assets/icons/icon32.png',
    'assets/icons/icon48.png', 'assets/icons/icon128.png',
    'profile.js', 'avatar.js', 'popup.html', 'popup.css', 'popup.js',
    'card-profile.js', 'card-popup.js', 'cards.js', 'cards.css',
    'assets/cards/tara.webp', 'assets/cards/frog.png', 'assets/cards/gu-yuexuan.png',
    'content.js', 'manifest.json', '安装说明.txt'
  ].sort());
  assert.equal(JSON.parse(strFromU8(files['manifest.json'])).version, version);
  assert.deepEqual(Buffer.from(files['assets/tianyi.jpg']), fs.readFileSync(path.join(root, 'assets/tianyi.jpg')));
  assert.ok(strFromU8(files.LICENSE).startsWith('MIT License\n'));
  const checksum = createHash('sha256').update(first).digest('hex');
  assert.equal(fs.readFileSync(path.join(root, 'dist/SHA256SUMS.txt'), 'utf8'), `${checksum}  ${filename}\n`);
});
