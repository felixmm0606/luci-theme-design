# LuCI Design Theme for OpenWrt

[![License](https://img.shields.io/github/license/felixmm0606/luci-theme-design?style=flat)](./LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat)](https://github.com/felixmm0606/luci-theme-design/pulls)
[![Issues Welcome](https://img.shields.io/badge/Issues-welcome-brightgreen.svg?style=flat)](https://github.com/felixmm0606/luci-theme-design/issues/new)
[![Release](https://img.shields.io/github/release/felixmm0606/luci-theme-design.svg?style=flat)](https://github.com/felixmm0606/luci-theme-design/releases)
[![Downloads](https://img.shields.io/github/downloads/felixmm0606/luci-theme-design/total?style=flat)](https://github.com/felixmm0606/luci-theme-design/releases)

`luci-theme-design` 是一个针对移动端和 PC 端沉浸式 WebApp 体验进行优化的 OpenWrt LuCI 主题。

- 基于 `luci-theme-neobird` 二次开发。在完成 ucode 架构重构后，原生适用于官方 OpenWrt 23.05+、ImmortalWrt 以及所有采用现代 ucode-based LuCI 的 OpenWrt 发行版及衍生固件。
- 模板已迁移到 ucode（`ucode/template/themes/design/*.ut`），**不再依赖 `luci-lua-runtime`**。
- 需要支持 ucode 模板的 LuCI（官方 OpenWrt 23.05 及以上、ImmortalWrt 或 LuCI master）。
- 登录页由主题自带的 `ucode/template/themes/design/sysauth.ut` 提供，沿用主题 CSS 需要的 `fieldset`、`cbi-input-user`、`cbi-input-password` 结构。
- JS 分支由 [papagaye744](https://github.com/papagaye744) 维护。

> [!IMPORTANT]
> 本仓库 `ucode` 分支为主要开发分支，已完成从 Lua 到 ucode 的完整迁移。`main` 分支保留旧版 Lua 实现仅供参考。

## 主要特点

- 适配移动端响应式布局，适合在手机端作为 WebApp 使用。
- 修改并优化了大量插件显示，完善设备图标，视觉统一。
- 简洁的登录界面、底部导航栏，以及类 App 的沉浸式体验。
- 适配深色模式、系统自动切换和插件式自定义模式。
- 支持插件式配置主题。
- 流畅度比肩 Bootstrap。

## 分支说明

| 分支 | 模板引擎 | 运行时依赖 | 说明 |
| --- | --- | --- | --- |
| `ucode` (推荐) | ucode (`.ut`) | `luci-base` | 适用于官方 OpenWrt 23.05+、ImmortalWrt 及现代 LuCI master 架构 |
| `main` | Lua (`.htm`) | `luci-lua-runtime` | 旧版，适用于早期基于 Lua 的 OpenWrt 18.06 / 旧版 LEDE 固件 |
| `js` | — | — | 由 [papagaye744](https://github.com/papagaye744) 维护 |

## 技术说明

### ucode 模板

主题模板位于：

```text
ucode/template/themes/design/
├── header.ut      # 页面头部、导航栏、JS/CSS 资源加载
├── footer.ut      # 页面底部
└── sysauth.ut     # 登录页
```

不再依赖 `luci-lua-runtime`。

### 登录页

登录页由以下模板提供：

```text
ucode/template/themes/design/sysauth.ut
```

模板沿用主题 CSS 依赖的结构：

```text
fieldset
cbi-input-user
cbi-input-password
```

### CSS 构建

主题 CSS 使用大小写敏感的自定义属性（例如 `--activeColor`）。构建系统默认的 `csstidy` 会把属性名小写化，导致配色、输入框和按钮失效。

因此 `Makefile` 中设置了：

```make
LUCI_MINIFY_CSS:=0
```

### 必需的 JS 资源

`header.ut` 必须加载：

```text
{{ resource }}/cbi.js
```

`luci.js` 依赖 `cbi.js` 提供的 `String.prototype.format`。缺失时 `new LuCI()` 会直接抛错，所有 JS 视图会永远停留在"正在载入视图"。

同时必须加载：

```text
{{ dispatcher.build_url('admin/translations', dispatcher.lang) }}
```

JS 界面的翻译表 `window.TR` 由它提供，`cbi.js` 的 `_()` 会查表翻译。缺失时，由 JS 渲染的页面（系统、网络、服务等）只会显示英文。

### 标签页 CSS

JS 表单的标签页通过 `data-tab-title` 和 `data-tab-active="true"` 切换面板。

`style.css` 末尾必须保留：

```css
[data-tab-title] {
  height: 0;
  opacity: 0;
  overflow: hidden;
}

[data-tab-active="true"] {
  height: auto;
  opacity: 1;
  overflow: visible;
}
```

否则 4 个面板会同时显示，点击标签只会移动下划线。

## 目录结构

```text
luci-theme-design/
├── Makefile                                      # OpenWrt 构建配置
├── dev/
│   └── style.css                                 # 开发版 CSS（未压缩）
├── htdocs/luci-static/design/
│   ├── css/style.css                             # 生产版 CSS
│   └── js/apply.js                               # 应用配置 JS
├── ucode/template/themes/design/
│   ├── header.ut                                 # 页面头部模板 (ucode)
│   ├── footer.ut                                 # 页面底部模板 (ucode)
│   └── sysauth.ut                                # 登录页模板 (ucode)
├── root/etc/uci-defaults/30_luci-theme-design    # 主题注册脚本
└── preview/                                      # 预览截图
```

## 主题配置插件

可以使用 [luci-app-design-config](https://github.com/felixmm0606/luci-app-design-config) 配置主题：

- 更改深色/浅色模式。
- 显示/隐藏导航栏。
- 更换常用的代理图标。

> [!NOTE]
> 配置插件同样提供 `ucode` 分支版本，已从 Lua CBI 迁移为纯 JS 视图，不再依赖 `luci-compat` 和 `luci-lua-runtime`。

## 体验 WebApp

在移动端（iOS/iPadOS、Android Chrome）浏览器中打开 LuCI，然后选择"添加到主屏幕"。

## 编译

```bash
# 使用 ucode 分支
git clone -b ucode https://github.com/felixmm0606/luci-theme-design.git package/luci-theme-design
make menuconfig # 选择 LUCI -> Theme -> luci-theme-design
make V=s
```

## Q&A

- 有 bug 欢迎提交 issue。
- 主题个人配色可能不符合所有人的喜好，欢迎提出配色建议。

## 致谢

- 上游仓库：[0x676e67/luci-theme-design](https://github.com/0x676e67/luci-theme-design)
- 基础主题：[thinktip/luci-theme-neobird](https://github.com/thinktip/luci-theme-neobird)

## 预览

<details>
<summary>iOS</summary>

<img src="./preview/webapp_home.PNG" alt="iOS 首页">
<img src="./preview/webapp_vssr.PNG" alt="iOS VSSR">

</details>

<details>
<summary>iPadOS</summary>

<img src="./preview/IMG_0328.PNG" alt="iPadOS 预览 1">
<img src="./preview/IMG_0329.PNG" alt="iPadOS 预览 2">

</details>

<img src="./preview/login.png" alt="登录页">
<img src="./preview/login1.png" alt="登录页 2">
<img src="./preview/page.png" alt="页面预览">
<img src="./preview/home.png" alt="首页">
<img src="./preview/light.png" alt="浅色模式">
<img src="./preview/home1.png" alt="首页 2">
<img src="./preview/wifi.png" alt="WiFi">
<img src="./preview/iface.png" alt="接口">
<img src="./preview/firewall.png" alt="防火墙">
