import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { zipSync } from 'fflate';
import { packageFiles, readManifest, root } from './project.mjs';

const { version } = await readManifest();
const entries = {};
for (const file of packageFiles) entries[file] = new Uint8Array(await readFile(path.join(root, file)));
// Use a fixed local ZIP timestamp so Windows and Linux produce identical bytes.
const zip = zipSync(entries, { level: 9, mtime: new Date(2020, 0, 1, 0, 0, 0) });
const filename = `maker-tianyi-extension-v${version}.zip`;
const checksum = createHash('sha256').update(zip).digest('hex');
const dist = path.join(root, 'dist');
await mkdir(dist, { recursive: true });
await writeFile(path.join(dist, filename), zip);
await writeFile(path.join(dist, 'SHA256SUMS.txt'), `${checksum}  ${filename}\n`);
await writeFile(path.join(dist, 'RELEASE_NOTES.md'), `# Maker · 天一一 v${version}\n\n` +
  '将 TapTap Maker 聊天中的嗒啦啦名字与头像替换为天一一，自动适应新增消息、状态更新和会话切换。\n\n' +
  '## 安装\n\n' +
  `1. 下载附件 **${filename}** 并完整解压。\n` +
  '2. 打开 Chrome 的 `chrome://extensions`（Edge 使用 `edge://extensions`），开启开发者模式。\n' +
  '3. 点击“加载已解压的扩展程序”，选择包含 manifest.json 的解压目录。\n' +
  '4. 刷新 Maker 页面。已安装旧版时替换目录文件，在扩展管理页重新加载，再刷新网页。\n\n' +
  '下载扩展 ZIP 附件即可安装；GitHub 自动生成的 Source code 附件用于查看源码。\n\n' +
  '## 校验\n\nSHA256SUMS.txt 提供安装包的 SHA-256 校验值。\n\n' +
  'MIT License · Copyright (c) 2026 Linxium (CS-LX)\n');
console.log(`Built dist/${filename} (${zip.byteLength} bytes)\nSHA-256 ${checksum}`);
