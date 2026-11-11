# 开发说明

运行目录是 `extension/`，JavaScript 模块、CSS、图标、语言资源及榜单全部随包安装，无远程执行代码。

入口 `entry.js` 先等待 `app/consent.mjs` 的明确同意，再启动 `app/scholar.mjs`。署名、匹配和统计分别由 `model.mjs`、`catalog.mjs` 及对应页面模块处理。元数据查询位于 `local/`，`online-access.mjs` 每次检查首次同意与联网开关。

`chrome.storage.local` 保存偏好、署名别名和名单。页面数据与网络查询缓存主要在内存中，网络请求省略 Cookie 和来源网址。测试模拟 Chrome API 与外部响应。

## 检查

```sh
npm ci --ignore-scripts
npm run check
```

检查包含资源/导入路径、隐私副本一致性、常见凭据与本机路径扫描，以及默认离线、明确同意、联网开关、请求字段、取消请求、中文署名、分轨和核心期刊匹配。它不替代登录后的 Google 学术页面或 Chrome 商店审核。

## 打包

```sh
npm run package
```

只打包 `extension/` 的运行文件。测试、文档和本机数据不进入商店 ZIP。修改隐私政策时，同步 `docs/index.html` 和 `extension/privacy.html`；本仓库通过 `main` 分支的 `/docs` 提供独立 GitHub Pages 政策站点。

新版本更新 `extension/manifest.json` 与 `package.json` 的版本，并在原 Chrome 商店项目上传。商店状态独立于源码公开状态，不以 GitHub 提交代替审核通过。
