# 刊迹 · CiteLocus

沿着引用，看清论文出处。

刊迹是在 Google 学术页面显示作者署名、期刊与会议标签及引用统计的 Chrome 扩展。本仓库集中维护刊迹源码、独立隐私页和开发工具，当前版本为 **1.0.10**。

[隐私政策 / Privacy policy](https://leeguandong.github.io/citelocus/) · [安装与使用](docs/usage.md) · [开发说明](docs/development.md)

## 功能

- 在学者主页显示一作和根据星号判断的通讯作者，适配中文姓名、拼音及常见缩写，可手动设置署名别名。
- 在搜索、被引用、论文详情和学者主页显示匹配到的多个期刊或会议标签。
- 随包提供 CCF、北大核心、JCR 分区与影响因子、中科院分区、新锐期刊分区、国际期刊预警和 SCI（SCIE）七套榜单。
- Workshop、Findings 和 Short Paper 保留关联的 CCF 等级与分轨名称，主会统计单独计算。
- 支持 DOI、ISSN、IEEE 文章编号和出版商链接匹配，以及默认关闭、单独启用的在线元数据补全。
- 展示当前已显示论文的引用、署名位次、合作作者和发表源统计，支持简体中文与英文。

未匹配不等于未收录，未确认的来源不会被推断为 SCI。统计覆盖当前页面已显示的论文，点击 Google 学术的“显示更多”可纳入后续条目。

## 安装源码版

1. 下载本仓库源码 ZIP 并解压，或克隆仓库。
2. 在 Chrome 打开 `chrome://extensions`，开启开发者模式。
3. 点击“加载已解压的扩展程序”，选择本仓库里的 **`extension/`** 文件夹。
4. 打开 Google 学术，阅读首次说明并选择“同意并启用”。七套榜单会自动初始化。

弹窗可以选择标签、署名和语言。“标注与语言 → 管理本地名单”打开完整设置，包括在线补全的独立开关。

源码加载版与商店版可能使用不同扩展 ID，原有偏好、手动名单和署名别名不会自动共享。保留原安装及原始导入文件，按需要在新安装中重新设置。

## 隐私

首次同意前不启动学术页面标注。在线补全默认关闭；开启后可能向 Crossref、DOI 服务或 IEEE Xplore 发送公开论文标题或论文标识，作者姓名与年份留在浏览器校验。榜单、偏好和署名别名保存在本机，不接入开发者统计、广告或远程模型。

独立政策站点由本仓库的 `docs/index.html` 发布，扩展内的副本在 `extension/privacy.html`。两份内容由检查脚本核对一致。

## 项目结构

```text
citelocus/
├── extension/          # 可直接加载的 Manifest V3 扩展
│   ├── app/            # 页面标注、统计、弹窗与设置逻辑
│   ├── local/          # 内置榜单、核实记录和可选元数据查询
│   ├── vendor/         # 随包依赖及其许可证
│   └── privacy.html    # 扩展内隐私政策
├── docs/               # 独立政策站点、使用说明与演示截图
├── scripts/            # 资源检查与打包工具
└── tests/              # 使用合成数据和模拟请求的功能检查
```

## 开发

需要 Node.js 24.12 或更新版本，以及 Python 3.10 或更新版本。扩展运行不需要 npm 构建，npm 依赖仅用于开发测试。

```sh
npm ci --ignore-scripts
npm run check
npm run package
```

打包结果位于被 Git 忽略的 `dist/`，ZIP 根目录直接包含 `manifest.json`。测试使用合成姓名、页面结构和模拟外部响应，不连接真实学术账号或发送论文检索请求。

## 反馈

请在本仓库提交 Issue，附版本、复现步骤和脱敏示例。隐私问题可联系 [leeguandon@gmail.com](mailto:leeguandon@gmail.com)。第三方说明见 [extension/THIRD_PARTY_NOTICES.txt](extension/THIRD_PARTY_NOTICES.txt)。

## English

CiteLocus adds authorship and publication venue badges to Google Scholar, with seven bundled catalogs and visible-paper citation statistics. The optional online venue lookup is off by default and requires a separate opt-in. Load the `extension/` directory as an unpacked Chrome extension. The bilingual privacy policy is hosted by this repository at <https://leeguandong.github.io/citelocus/>.
