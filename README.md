# Maker · 天一一

[![CI](https://github.com/CS-LX/maker-tianyi-extension/actions/workflows/ci.yml/badge.svg)](https://github.com/CS-LX/maker-tianyi-extension/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/CS-LX/maker-tianyi-extension)](https://github.com/CS-LX/maker-tianyi-extension/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

一个 Chrome / Edge Manifest V3 扩展，可自定义 [TapTap Maker](https://maker.taptap.cn/) 聊天助手的昵称和头像，默认使用“天一一”。

<img src="assets/icon-master.png" width="160" height="160" alt="嗒啦啦通过薄荷绿箭头变为天一一的扩展图标">

## 安装

1. 在 [Releases](https://github.com/CS-LX/maker-tianyi-extension/releases/latest) 下载 `maker-tianyi-extension-vX.X.X.X.zip` 并完整解压。
2. Chrome 地址栏输入 `chrome://extensions`；Edge 输入 `edge://extensions`。
3. 开启“开发者模式”，点击“加载已解压的扩展程序”。
4. 选择解压后包含 `manifest.json` 的目录，然后刷新 Maker 网页。

也可以克隆本仓库，直接将仓库根目录作为已解压扩展加载。安装扩展无需 Node.js 或 npm。加载后请保留该目录。

升级时更新扩展目录中的文件，在扩展管理页点击“重新加载”，再刷新 Maker。停用时关闭或移除扩展，再刷新网页。

## 自定义昵称和头像

1. 点击浏览器工具栏上的扩展图标；如果图标未显示，先在拼图菜单中固定“Maker · 天一一”。也可在扩展详情中打开“扩展程序选项”。
2. 输入 1–32 个字符的昵称，点击“选择图片”导入头像。
3. 检查实时预览，点击“保存并应用”。所有已打开的 Maker 页面自动更新，重新打开浏览器仍会保留设置。
4. “使用默认头像”只还原头像；“恢复默认”还原头像和昵称。两者都需要再点击保存才生效。

支持浏览器能解码的 JPG/JPEG/JFIF、PNG/APNG、WebP、GIF、AVIF、BMP、ICO、SVG 等图片。单个文件最大 10 MB、最多 4000 万像素、单边最大 16384 像素。图片会居中裁成正方形、缩至不超过 512×512，并转成 PNG 存储；透明度保留，动图保存为静态头像。HEIC、TIFF 等无法解码的格式会提示转换为 PNG/JPG，不会覆盖原来的头像。

昵称与头像保存在 `chrome.storage.local`，不上传、不跨设备同步。升级时请继续使用同一扩展目录；卸载扩展会清除设置。

## 功能

- 作用于 `https://maker.taptap.cn/*` 下的聊天界面。
- 替换聊天头像、头像旁的姓名标签和“嗒啦啦正在执行命令...”等状态。
- 支持折叠聊天行、流式状态更新、新增消息和页面内切换会话。
- 保留头像圆形裁切、尺寸及进度外圈。
- 设置预览、保存、恢复默认；实时同步所有已打开的 Maker 标签页。
- 仅修改本机显示，聊天正文、代码、输入框和用户头像保持原样。
- 扩展自身不发送网络请求，不读取 Cookie，没有统计服务；仅申请保存设置所需的 `storage` 权限。

适配标记：`img[alt="Bot Avatar"]`、`.chat-thinking-shimmer`、`.chat-collapsed-row`。若 Maker 修改页面结构，需要更新 `content.js`。这是非官方界面定制扩展。

## 图标

扩展图标采用“嗒啦啦 → 天一一”的双头像和单向箭头设计。原图位于 `assets/icon-master.png`，16、32、48、128 像素 PNG 位于 `assets/icons/`，用于工具栏和扩展管理页。

## 开发与测试

推荐 Node.js 24.15.0 或更新的 24.x，CI 使用 Node.js 24。

```sh
npm ci
npm run check
npm test
npx playwright install chromium --no-shell
npm run test:browser
npm run build
```

测试覆盖聊天布局、动态更新、会话切换、头像节点复用、连续改名、读取/保存失败、过期读取、多窗口修改冲突、文件选择竞态，以及版本校验和 ZIP 内容。浏览器测试会在独立 Chromium 配置中实际加载扩展，验证八种图片格式、设置持久化、多标签页同步和异常图片恢复；使用拦截的 Maker 测试页面，不读取真实账号或聊天。Linux 初次运行可用 `npx playwright install --with-deps chromium --no-shell` 安装运行依赖。

构建结果写入 `dist/`，安装包只包含运行所需文件、安装说明和 MIT 许可证，同时生成 SHA-256 校验值。

## CI 与发布

- **CI**：推送到 `main` 或向 `main` 提交 PR 时，自动校验、运行测试、构建并上传工作流产物；也支持手动运行。
- **Release**：推送 `vX.X.X.X` 标签后自动校验、测试、打包并创建 GitHub Release，附上扩展 ZIP 和 `SHA256SUMS.txt`。
- 标签必须与 `manifest.json` 的四段版本号完全一致，并且指向已合入 `main` 的提交，否则发布失败。
- `manifest.json` 是产品版本号的唯一来源。每段是 0–65535 的整数，不允许前导零，四段不能全为零。

例如发布 `1.1.0.1`：

```sh
git switch main
git pull --ff-only
npm run version:set -- 1.1.0.1
npm run check
npm test
git add manifest.json
git commit -m "chore: release 1.1.0.1"
git push origin main
# 等待该提交的 CI 成功，再创建并推送标签：
git tag -a v1.1.0.1 -m "Release v1.1.0.1"
git push origin v1.1.0.1
```

Release 包可解压后直接加载。GitHub 自动附带的 Source code 压缩包是源码归档。

## 许可证

[MIT](LICENSE) · Copyright (c) 2026 Linxium (CS-LX)
