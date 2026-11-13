import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { packageFiles, readManifest, root, validateTag } from './project.mjs';

const manifest = await readManifest();
const args = process.argv.slice(2);
if (args.length) {
  assert.equal(args.length, 2, 'Usage: npm run check -- --tag vX.X.X.X');
  assert.equal(args[0], '--tag');
  validateTag(args[1], manifest.version);
}
assert.equal(manifest.manifest_version, 3);
assert.deepEqual(manifest.content_scripts[0].matches, ['https://maker.taptap.cn/*']);
assert.deepEqual(manifest.web_accessible_resources[0].matches, ['https://maker.taptap.cn/*']);
for (const file of packageFiles) await readFile(path.join(root, file));
for (const entry of manifest.content_scripts) {
  for (const file of [...(entry.js ?? []), ...(entry.css ?? [])]) {
    assert.ok(packageFiles.includes(file), `Missing packaged content script: ${file}`);
  }
}
for (const entry of manifest.web_accessible_resources) {
  for (const file of entry.resources) {
    assert.ok(packageFiles.includes(file), `Missing packaged resource: ${file}`);
  }
}
for (const icons of [manifest.icons, manifest.action?.default_icon]) {
  for (const [size, file] of Object.entries(icons ?? {})) {
    assert.ok(packageFiles.includes(file), `Missing packaged icon: ${file}`);
    const png = await readFile(path.join(root, file));
    assert.equal(png.subarray(1, 4).toString(), 'PNG', `Icon must be PNG: ${file}`);
    assert.equal(png.readUInt32BE(16), Number(size), `Wrong icon width: ${file}`);
    assert.equal(png.readUInt32BE(20), Number(size), `Wrong icon height: ${file}`);
  }
}
const license = await readFile(path.join(root, 'LICENSE'), 'utf8');
assert.ok(license.startsWith('MIT License\n'));
assert.ok(license.includes('Linxium (CS-LX)'));
console.log(`Validated Maker · 天一一 ${manifest.version}${args.length ? ` / ${args[1]}` : ''}`);
