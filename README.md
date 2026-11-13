# Maker · 天一一

[![CI](https://github.com/CS-LX/maker-tianyi-extension/actions/workflows/ci.yml/badge.svg)](https://github.com/CS-LX/maker-tianyi-extension/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/CS-LX/maker-tianyi-extension)](https://github.com/CS-LX/maker-tianyi-extension/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

一个 Chrome / Edge Manifest V3 扩展，将 [TapTap Maker](https://maker.taptap.cn/) 聊天里的“嗒啦啦”名字和头像替换为“天一一”。

<img src="assets/icon-master.png" width="160" height="160" alt="嗒啦啦通过薄荷绿箭头变为天一一的扩展图标">

## 安装

1. 在 [Releases](https://github.com/CS-LX/maker-tianyi-extension/releases/latest) 下载 `maker-tianyi-extension-vX.X.X.X.zip` 并完整解压。
2. Chrome 地址栏输入 `chrome://extensions`；Edge 输入 `edge://extensions`。
3. 开启“开发者模式”，点击“加载已解压的扩展程序”。
4. 选择解压后包含 `manifest.json` 的目录，然后刷新 Maker 网页。

也可以克隆本仓库，直接将仓库根目录作为已解压扩展加载。安装扩展无需 Node.js 或 npm。加载后请保留该目录。

升级时更新扩展目录中的文件，在扩展管理页点击“重新加载”，再刷新 Maker。停用时关闭或移除扩展，再刷新网页。

## 功能

- 作用于 `https://maker.taptap.cn/*` 下的聊天界面。
- 替换聊天头像、头像旁的姓名标签和“嗒啦啦正在执行命令...”等状态。
- 支持折叠聊天行、流式状态更新、新增消息和页面内切换会话。
- 保留头像圆形裁切、尺寸及进度外圈。
- 仅修改本机显示，聊天正文、代码、输入框和用户头像保持原样。
- 扩展自身不发送网络请求，不读取 Cookie，不使用存储或统计服务。

适配标记：`img[alt="Bot Avatar"]`、`.chat-thinking-shimmer`、`.chat-collapsed-row`。若 Maker 修改页面结构，需要更新 `content.js`。这是非官方界面定制扩展。

## 修改头像和名字

用新的 JPG 替换 `assets/tianyi.jpg`；在 `content.js` 中修改 `DISPLAY_NAME`。修改后重新加载扩展并刷新 Maker。

扩展图标采用“嗒啦啦 → 天一一”的双头像和单向箭头设计。原图位于 `assets/icon-master.png`，16、32、48、128 像素 PNG 位于 `assets/icons/`，用于工具栏和扩展管理页。

## 开发与测试

推荐 Node.js 24.15.0 或更新的 24.x，CI 使用 Node.js 24。

```sh
npm ci
npm run check
npm test
npm run build
```

测试覆盖已确认的聊天布局、动态更新、会话切换、头像节点复用，以及版本校验、工作流触发配置和 ZIP 内容。构建结果写入 `dist/`，安装包只包含运行所需的文件、安装说明和 MIT 许可证，同时生成 SHA-256 校验值。

## CI 与发布

- **CI**：推送到 `main` 或向 `main` 提交 PR 时，自动校验、运行测试、构建并上传工作流产物；也支持手动运行。
- **Release**：推送 `vX.X.X.X` 标签后自动校验、测试、打包并创建 GitHub Release，附上扩展 ZIP 和 `SHA256SUMS.txt`。
- 标签必须与 `manifest.json` 的四段版本号完全一致，并且指向已合入 `main` 的提交，否则发布失败。
- `manifest.json` 是产品版本号的唯一来源。每段是 0–65535 的整数，不允许前导零，四段不能全为零。

例如发布 `1.0.0.2`：

```sh
git switch main
git pull --ff-only
npm run version:set -- 1.0.0.2
npm run check
npm test
git add manifest.json
git commit -m "chore: release 1.0.0.2"
git push origin main
# 等待该提交的 CI 成功，再创建并推送标签：
git tag -a v1.0.0.2 -m "Release v1.0.0.2"
git push origin v1.0.0.2
```

Release 包可解压后直接加载。GitHub 自动附带的 Source code 压缩包是源码归档。

## 许可证

[MIT](LICENSE) · Copyright (c) 2026 Linxium (CS-LX)
