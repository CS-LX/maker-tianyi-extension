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
  '自定义 TapTap Maker 聊天助手的昵称和头像，默认使用天一一。自动适应新增消息、状态更新和会话切换。\n\n' +
  '## 新增谷月轩卡面预设\n\n' +
  '- 核对 ty.jpg 的角色为《侠客风云传》的谷月轩，制作了同风格的透明底金色剪影，保留高马尾、回望表情和衣领。\n' +
  '- 黑金卡大图网格现在包含嗒啦啦、奶蛙、谷月轩三个预设，自定义上传保留在下方。\n' +
  '- 新预设支持保存、多页面即时同步、重开面板恢复及图片失败回退。切换预设会保留已有上传图。\n\n' +
  '## 黑金卡图案定制\n\n' +
  '- 嗒啦啦优先使用网页原图，缺失或加载失败时使用包内素材；奶蛙采用透明底金色剪影。\n' +
  '- 上传图保留比例与透明度，最长边最多 512 像素。卡面与聊天头像、昵称分别保存。\n' +
  '- 保留卡片文字、积分、渐隐和窄屏隐藏规则，支持多个页面同步及新卡片动态挂载。\n' +
  '- 不增加权限，不上传图片。设置面板只加载 Maker 公开目录的网页原图。\n\n' +
  '## 自定义聊天形象\n\n' +
  '- 点击扩展图标，修改昵称、选择头像，查看预览后保存；已打开的 Maker 标签页自动同步。\n' +
  '- 支持 JPG、PNG、WebP、GIF、AVIF、BMP、ICO、SVG 等浏览器可解码格式。最大 10 MB，自动裁为正方形并缩至最多 512×512；动图保存为静态头像。\n' +
  '- 设置保存在本机，可恢复默认。storage 权限用于保存设置，不上传图片或昵称。\n' +
  '- 包含损坏/超大图片、保存失败、多窗口冲突、流式更新与头像加载失败的恢复处理。\n\n' +
  '## 安装\n\n' +
  `1. 下载附件 **${filename}** 并完整解压。\n` +
  '2. 打开 Chrome 的 `chrome://extensions`（Edge 使用 `edge://extensions`），开启开发者模式。\n' +
  '3. 点击“加载已解压的扩展程序”，选择包含 manifest.json 的解压目录。\n' +
  '4. 刷新 Maker 页面。已安装旧版时更新同一扩展目录中的文件，在扩展管理页重新加载，再刷新网页。\n' +
  '5. 点击扩展图标即可自定义昵称和头像；也可从扩展详情打开“扩展程序选项”。\n\n' +
  '下载扩展 ZIP 附件即可安装；GitHub 自动生成的 Source code 附件用于查看源码。\n\n' +
  '## 校验\n\nSHA256SUMS.txt 提供安装包的 SHA-256 校验值。\n\n' +
  'MIT License · Copyright (c) 2026 Linxium (CS-LX)\n');
console.log(`Built dist/${filename} (${zip.byteLength} bytes)\nSHA-256 ${checksum}`);
