import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { readManifest, root, validateVersion } from './project.mjs';

if (process.argv.length !== 3) throw new Error('Usage: npm run version:set -- X.X.X.X');
const version = validateVersion(process.argv[2]);
const manifest = await readManifest();
manifest.version = version;
await writeFile(path.join(root, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`manifest.json version → ${version}`);
