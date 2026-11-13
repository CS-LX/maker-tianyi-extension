# Maker · 天一一

[![CI](https://github.com/CS-LX/maker-tianyi-extension/actions/workflows/ci.yml/badge.svg)](https://github.com/CS-LX/maker-tianyi-extension/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/CS-LX/maker-tianyi-extension)](https://github.com/CS-LX/maker-tianyi-extension/releases/latest)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

一个 Chrome / Edge Manifest V3 扩展，可自定义 [TapTap Maker](https://maker.taptap.cn/) 聊天助手的昵称、头像和黑金卡图案，默认聊天昵称为“天一一”。

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

## 自定义黑金卡（1.2）

打开扩展的“黑金卡”页签，在大图网格中选择 **嗒啦啦**、**奶蛙**或**谷月轩**，也可使用下方的**自定义**上传图片，查看卡片预览后点击“保存并应用”。卡面设置独立保存，不影响聊天昵称和头像。

- **嗒啦啦**：默认选项。卡片沿用网页当前的原图，找不到或加载失败时使用包内备用图。面板从已打开的 Maker 卡片读取图源；需要时点击“刷新网页素材”。没有打开卡片页面时，面板显示内置图。
- **奶蛙**：根据提供的奶蛙参考图制作的透明底金色剪影，与黑金卡的渐隐效果结合。
- **谷月轩**（1.2.1 新增）：用户提供的 `ty.jpg` 对应《侠客风云传》的谷月轩，已与[官网角色介绍和立绘](https://wulin.fhyx.com/malerole.html)核对。预设保留高马尾、回望表情和衣领，处理为透明底金色剪影。
- **自定义**：选择浏览器可解码的图片，保留比例与透明度，最长边缩至最多 512 像素；格式及文件大小限制同头像。推荐透明底 PNG/WebP，动图保存为静态图。切换到其他预设会保留上传图，点击“更换上传图片”可替换；“恢复嗒啦啦”会清除上传图，保存后生效。

适配 `article[data-tier="ultra"]:not([data-audience="student"]) > [data-decoration="tara"]`，只替换卡片装饰图，保留原有文字、积分、渐隐和窄屏隐藏规则。页面内切换、新卡片挂载和多个标签页都自动应用。页面需要刷新才能连接刚升级的扩展。

设置面板只从 Maker 的公开素材目录加载网页原图；上传图片保存在本机，不上传到服务器。原始嗒啦啦备用图来自 Maker 的 `/membership/ultra-tara.webp`，奶蛙和谷月轩预设通过内置 image_gen 依据用户提供的角色图制作，文件位于 `assets/cards/`；谷月轩同时参考官方完整立绘补全了头像裁掉的发型及衣领。

## 功能

- 作用于 `https://maker.taptap.cn/*` 下的聊天界面。
- 替换聊天头像、头像旁的姓名标签和“嗒啦啦正在执行命令...”等状态。
- 评分按钮旁的“评价一下嗒啦啦的工作”随自定义昵称更新。
- 支持折叠聊天行、流式状态更新、新增消息和页面内切换会话。
- 保留头像圆形裁切、尺寸及进度外圈。
- 设置预览、保存、恢复默认；实时同步所有已打开的 Maker 标签页。
- 黑金卡提供嗒啦啦、奶蛙、谷月轩三个大图预设及独立上传入口，聊天形象与卡面分别保存。
- 仅修改本机显示，用户昵称、引用的用户原文、聊天正文、代码、输入框和用户头像保持原样。
- 不读取 Cookie，没有统计服务；仅申请保存设置所需的 `storage` 权限。除加载 Maker 公开原图外，不发送网络请求，不上传昵称或图片。

适配标记：`img[alt="Bot Avatar"]`、`.chat-thinking-shimmer`、`.chat-collapsed-row`。若 Maker 修改页面结构，需要更新 `content.js`。这是非官方界面定制扩展。

评价提示使用 `div.border-t.border-border > div.flex.flex-wrap.items-center > span.select-none.text-xs.text-muted-foreground`，并要求原文恰好为“评价一下嗒啦啦的工作”。已有的代码、Markdown 正文和可编辑区域保护仍然生效。

### 1.1.0.1 修复

[Issue #1](https://github.com/CS-LX/maker-tianyi-extension/issues/1) 报告了这句话遗漏替换。根据用户提供的 DOM 和 Maker 前端代码，已确认的节点是评分按钮旁的固定提示；此版本修复该提示。真正的用户提问引用及引用作者昵称保持原文，不进行全文替换。

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

测试覆盖聊天布局、评价提示与引用/作者边界、动态更新、会话切换、头像节点复用、连续改名、读取/保存失败、过期读取、多窗口修改冲突、文件选择竞态，以及版本校验和 ZIP 内容。浏览器测试会在独立 Chromium 配置中实际加载扩展，验证真实 DOM 样本中的评价提示、八种图片格式、设置持久化、多标签页同步、黑金卡原图发现与回退、透明图比例及响应式布局；使用拦截的 Maker 测试页面，不读取真实账号或聊天。Linux 初次运行可用 `npx playwright install --with-deps chromium --no-shell` 安装运行依赖。

网页原图通过扩展内部消息读取，不申请广泛的 `tabs` 权限，也不读取标签页标题、地址或聊天内容。实现依据 Chrome 的 [Tabs API 权限说明](https://developer.chrome.com/docs/extensions/reference/api/tabs#permissions)和[消息传递文档](https://developer.chrome.com/docs/extensions/develop/concepts/messaging)。

构建结果写入 `dist/`，安装包只包含运行所需文件、安装说明和 MIT 许可证，同时生成 SHA-256 校验值。

## CI 与发布

- **CI**：推送到 `main` 或向 `main` 提交 PR 时，自动校验、运行测试、构建并上传工作流产物；也支持手动运行。
- **Release**：推送 `vX.X.X.X` 标签后自动校验、测试、打包并创建 GitHub Release，附上扩展 ZIP 和 `SHA256SUMS.txt`。
- 标签必须与 `manifest.json` 的四段版本号完全一致，并且指向已合入 `main` 的提交，否则发布失败。
- `manifest.json` 是产品版本号的唯一来源。每段是 0–65535 的整数，不允许前导零，四段不能全为零。

例如发布 `1.2.0.1`：

```sh
git switch main
git pull --ff-only
npm run version:set -- 1.2.0.1
npm run check
npm test
git add manifest.json
git commit -m "chore: release 1.2.0.1"
git push origin main
# 等待该提交的 CI 成功，再创建并推送标签：
git tag -a v1.2.0.1 -m "Release v1.2.0.1"
git push origin v1.2.0.1
```

Release 包可解压后直接加载。GitHub 自动附带的 Source code 压缩包是源码归档。

## 许可证

[MIT](LICENSE) · Copyright (c) 2026 Linxium (CS-LX)
