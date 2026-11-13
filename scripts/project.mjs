import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const packageFiles = [
  'LICENSE', 'assets/tianyi.jpg', 'content.js', 'manifest.json', '安装说明.txt'
];

export function validateVersion(version) {
  if (typeof version !== 'string' || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
    throw new Error('Version must contain exactly four integers, e.g. 1.0.0.0.');
  }
  const parts = version.split('.').map(Number);
  if (parts.some(part => part > 65535) || parts.every(part => part === 0)) {
    throw new Error('Version components must be 0–65535 and not all zero.');
  }
  return version;
}

export function validateTag(tag, version) {
  validateVersion(version);
  if (tag !== `v${version}`) {
    throw new Error(`Release tag ${tag} does not match manifest version v${version}.`);
  }
}

export async function readManifest() {
  const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
  validateVersion(manifest.version);
  return manifest;
}
