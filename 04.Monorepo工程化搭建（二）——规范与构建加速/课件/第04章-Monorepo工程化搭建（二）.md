# 第 04 章：Monorepo 工程化搭建（二）——规范与构建加速

> **本章目标**：在第 03 章骨架基础上，接入 ESLint + Prettier 统一代码规范，配置 CSpell 拼写检查，配置 `.gitignore` / `.npmrc`，最后引入 Turborepo 实现构建任务调度与缓存加速。
>
> ⚡ **本章代码**：在第 03 章代码快照基础上继续修改。代码快照位于 `04.Monorepo工程化搭建（二）——规范与构建加速/代码/monitor/`。

---

## 开篇：Monorepo 为什么更需要工程规范化？

学完第 03 章，我们有了 Monorepo 的基本骨架：多个包、共享依赖、workspace 连接。但这只是"能跑起来"，距离"适合团队协作"还有一段距离。

**单个项目和 Monorepo 项目的核心区别**：

| | 单个项目 | Monorepo |
|--|------|----------|
| 代码规范 | 一份配置，问题局限在一个地方 | **10 个包可能各自为政**，规则悄悄漂移 |
| 依赖升级 | 改一个文件就好 | 每个包都有自己的版本，升级就是改 10 个地方 |
| 构建效率 | 一次构建一个包 | 每次全量构建所有包，代码没变也从头跑 |

> 🏗️ **架构思考：Monorepo 的核心价值不是"把多个项目放到一个文件夹里"，而是利用这个结构强制共享规范、共享工具、共享标准。**
>
> 比喻：你招了开发团队，如果每个人都按自己的运作规则各行其是，就是一滩散沙。你需要一套"团队标准手册"——Monorepo 的规范层就是这本手册。

**不做规范化，具体会出什么问题？**

- 团队 A 用单引号，团队 B 用双引号，代码 review 时死扣细节，能跑就行的东西却没有强制执行
- `@monitor/browser` 和 `@monitor/vue` 分别载入了两个版本的 TypeScript，出了类型报错查半天才发现是版本对不上
- 改动一个已知有 bug 的工具包，但各个包各自管理自己的升级，最终线上三个包还在用老版本
- 每次改一行代码，所有包全量重新构建，10 个包等 2 分钟，在 CI 上等 10 分钟

**本章就是来解决这些问题的**：用 ESLint + Prettier 消除风格漂移，用 CSpell 在写代码时就拦截拼写错误，用 `.npmrc` 封堵幽灵依赖隐患，用 Turborepo 让构建从"工具能用"升级到"团队日常不卡顿"。

---

## 4.1 ESLint 统一规范配置

### 先问自己：为什么要 ESLint？

代码规范不只是"风格统一"，更重要的是**在写代码时拦截常见错误**：

- 忘记处理 `undefined`？ESLint 可以报警
- 在 React 组件里忘写 `key`？ESLint 可以报错
- 引入了某个包却从没使用？ESLint 可以提示删除
- `@typescript-eslint/no-explicit-any` 规则能在 CI 阶段阻止 `any` 类型扩散

> 📖 **术语：ESLint**：JavaScript/TypeScript 的静态分析工具（Linter）。它不运行代码，只"阅读"代码，根据预设规则检查问题。与 Prettier 的区别：ESLint 管"代码逻辑正确性"，Prettier 管"代码格式美观性"。

> 🏗️ **架构思考：为什么 ESLint 装在根目录，用单份配置覆盖全仓库？**
>
> 如果每个包都有自己独立的 ESLint 配置：
> - 10 个包 = 10 份 `.eslintrc`，规则可能悄悄漂移，A 包允许 `any`，B 包禁止
> - 升级 ESLint 需要改 10 个地方
> - CI 无法一眼看出规范是否一致
>
> Monorepo 的核心价值之一就是**把规范提升到仓库级别统一管理**。ESLint 的 flat config（扁平配置）天然支持"从根目录单份配置覆盖所有子目录"。

### ESLint v9 Flat Config 是什么？

> 📖 **术语：Flat Config（扁平配置）**：ESLint v9 引入的新配置格式。之前是 `.eslintrc.json` / `.eslintrc.js`（可以在每一级目录都放一个），现在改为根目录单一的 `eslint.config.mjs`，用 JS 数组组合规则，逻辑更清晰，也更适合 Monorepo。
>
> 与旧格式对比：
> - 旧：多文件级联，`extends` 字符串引用，难以追踪生效规则
> - 新（flat）：一个 JS 数组，每项是 `{ files, rules }` 对象，所见即所得

### 安装 ESLint 及相关插件

所有 ESLint 相关包**装在根目录**（`-w` 表示 workspace root）：

```bash
pnpm add -w -D \
  eslint \
  @eslint/js \
  typescript-eslint \
  eslint-plugin-react-hooks \
  eslint-plugin-react-refresh \
  eslint-plugin-vue \
  vue-eslint-parser \
  eslint-config-prettier
```

各包的作用：

| 包 | 作用 |
|----|------|
| `eslint` | ESLint 核心，v9+ |
| `@eslint/js` | 官方 JS 推荐规则集 |
| `typescript-eslint` | TypeScript 语法支持 + TS 专属规则（替代原来的 `@typescript-eslint/parser` + `@typescript-eslint/eslint-plugin`） |
| `eslint-plugin-react-hooks` | Hooks 规则（deps 数组检查等） |
| `eslint-plugin-react-refresh` | Vite HMR 友好组件导出规则 |
| `eslint-plugin-vue` | Vue3 单文件组件规则 |
| `vue-eslint-parser` | 解析 `.vue` 文件的 `<template>` 部分 |
| `eslint-config-prettier` | 关闭所有与 Prettier 冲突的 ESLint 格式化规则 |

### 创建 `eslint.config.mjs`

在根目录创建 `eslint.config.mjs`（注意是 `.mjs`，必须用 ESM 格式）：

```js
// eslint.config.mjs
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import pluginVue from 'eslint-plugin-vue'
import vueParser from 'vue-eslint-parser'
import prettier from 'eslint-config-prettier'

export default tseslint.config(
  // ——— 全局忽略 ———
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/.turbo/**',
      '**/pnpm-lock.yaml',
    ],
  },

  // ——— TypeScript 文件（所有 .ts / .tsx）———
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    rules: {
      // 未使用变量：以 _ 开头的允许（用于占位参数）
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // 禁止 any，SDK 代码边界处用 unknown
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },

  // ——— React 相关文件（监控平台 + React Demo + React 适配包）———
  {
    files: [
      'apps/frontend/**/*.{ts,tsx}',
      'demos/react-demo/**/*.{ts,tsx}',
      'packages/react/**/*.{ts,tsx}',
    ],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Vite HMR 要求：组件文件只导出组件（或允许常量导出）
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },

  // ——— Vue 文件（Vue3 适配包 + Vue3 Demo）———
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        // vue-eslint-parser 内部用 typescript-eslint 解析 <script> 块
        parser: tseslint.parser,
        extraFileExtensions: ['.vue'],
        sourceType: 'module',
      },
    },
    plugins: {
      vue: pluginVue,
    },
    rules: {
      // Vue3 官方推荐规则集
      ...pluginVue.configs['vue3-recommended'].rules,
    },
  },

  // ——— 最后应用 Prettier：关闭所有格式化冲突规则 ———
  prettier,
)
```

> ⚠️ **为什么用 `.mjs` 而不是 `.js`？**
>
> 根目录的 `package.json` 没有 `"type": "module"`（Node.js 默认把 `.js` 当 CommonJS）。用 `.mjs` 后缀可以强制 Node.js 用 ESM 模式解析这个文件，从而正常使用 `import` 语法。

---

## 4.2 Prettier 格式化配置

### ESLint 和 Prettier 的分工

> 🏗️ **架构思考：ESLint 和 Prettier 各管什么？**
>
> | | ESLint | Prettier |
> |--|--------|----------|
> | **关注点** | 代码逻辑问题（潜在 bug、规范约束） | 代码排版格式（缩进、换行、引号） |
> | **修复方式** | `eslint --fix`（有些问题不能自动修复） | `prettier --write`（全自动格式化） |
> | **运行时机** | 编写时 IDE 提示 + CI 校验 | 保存时自动格式化（配合 editor.formatOnSave） |
>
> 两者互补，但会有冲突：ESLint 的一些格式规则（比如引号、分号）和 Prettier 的决定不一样。解决方案就是用 `eslint-config-prettier` **关闭所有 ESLint 的格式规则**，把格式化完全交给 Prettier。

### 安装 Prettier

```bash
pnpm add -w -D prettier
```

### 创建 `.prettierrc`

在根目录创建 `.prettierrc`：

```json
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "all",
  "printWidth": 100,
  "endOfLine": "lf"
}
```

配置项说明：

| 配置项 | 值 | 含义 |
|--------|-----|------|
| `semi` | `false` | 不加分号（与课程代码风格规范一致） |
| `singleQuote` | `true` | 使用单引号 |
| `tabWidth` | `2` | 2 空格缩进 |
| `trailingComma` | `"all"` | 多行时末尾加逗号（减少 Git diff 的噪音） |
| `printWidth` | `100` | 单行最多 100 字符（比默认 80 稍宽，适合 TS 类型写法） |
| `endOfLine` | `"lf"` | 统一换行符为 LF（跨 macOS/Linux/Windows 协作必要） |

### 创建 `.prettierignore`

```
dist/
node_modules/
pnpm-lock.yaml
*.md
```

---

## 4.3 `.gitignore` 与 `.npmrc` 的 Monorepo 最佳实践

### `.gitignore`

Monorepo 的 `.gitignore` 放根目录，覆盖全仓库：

```gitignore
# ——— 依赖 ———
node_modules/
.pnpm-store/

# ——— 构建产物 ———
dist/
.turbo/

# ——— 环境变量（不能提交到 Git）———
.env
.env.local
.env.*.local

# ——— 编辑器配置（个人偏好，不强制统一）———
.vscode/settings.json
.idea/

# ——— macOS 系统文件 ———
.DS_Store

# ——— 日志 ———
*.log
pnpm-debug.log*
```

> ⚠️ **注意**：`dist/` 整体忽略——SDK 包的构建产物不需要提交到 Git，使用者通过 npm 安装或 workspace 本地链接即可访问。这也意味着 CI 环境每次都需要先 `pnpm build` 再做其他操作。

### `.npmrc`

> 📖 **术语：`.npmrc`**
>
> `.npmrc` 是 npm / pnpm 的**运行时配置文件**（rc = runtime config）。它不声明"项目要用哪些依赖"，而是告诉包管理器"**应该怎么工作**"——去哪里下载包、如何处理依赖结构、允不允许某些行为。
>
> **白话理解**：`package.json` 是菜单，写明要点哪些菜；`.npmrc` 是厨房规则，写明厨师做菜的操作方式。两者互补，没有互相引用，各自被 pnpm 独立读取后生效。
>
> **优先级（从高到低）**：
> - 项目根目录的 `.npmrc` → 只影响本项目，**提交到 Git 后所有人共享同一套配置**
> - `~/.npmrc` → 影响当前用户的所有项目
> - 全局 `/etc/npmrc` → 影响整台机器
>
> 普通单包项目可能一辈子用不到 `.npmrc`。但 pnpm + Monorepo 场景下，有几个安装行为必须显式声明，否则会埋坑——这也是本节要配置它的原因。

`.npmrc` 是 pnpm 的配置文件，Monorepo 中有几个重要选项：

```ini
# 禁止幽灵依赖：每个包只能访问自己声明的依赖
shamefully-hoist=false

# 宽松的 peerDependencies 处理：不因 peer 版本不匹配就报错
strict-peer-dependencies=false

# 自动安装缺失的 peerDependencies
auto-install-peers=true
```

> 📖 **术语：幽灵依赖（Phantom Dependencies）**
>
> npm/Yarn v1 会把所有包的依赖"提升"（hoist）到根目录的 `node_modules/`，导致一个包可以引用它自己没有声明的包（因为那个包被别人的依赖带进来了）。
>
> 比如：你的代码里 `import lodash from 'lodash'`，但你的 `package.json` 里没有写 `lodash`，却能运行——因为某个依赖包把 lodash 安装到了根目录。这就是幽灵依赖，在升级某个无关依赖时可能突然崩溃。
>
> pnpm 默认就禁止幽灵依赖（`shamefully-hoist=false`），明确写出来是为了让阅读代码的人知道这是有意为之。

---

## 4.4 CSpell 拼写检查

### 为什么代码也需要拼写检查？

代码中的拼写错误比你想象的更常见，而且往往隐藏得很深：

```typescript
// 变量名拼写错误，IDE 不会报错，但阅读代码的人会困惑
const resposneData = await fetch(...)  // response 拼错了
const messgae = 'hello'               // message 拼错了

// 注释、错误信息里的拼写错误，直接暴露给用户
throw new Error('Invaild token')      // Invalid 拼错了
```

> 🏗️ **架构思考：拼写检查和 ESLint 有什么区别？**
>
> - ESLint：检查代码的**逻辑结构**是否合规（类型、规则、风格）
> - CSpell：检查代码中**英文单词的拼写**是否正确
>
> 两者互补，都是在写代码时就发现问题，而不是等 code review 或上线后才发现。

### CSpell 的两种使用方式

> 📖 **术语：CSpell**：一个专门为代码仓库设计的命令行拼写检查工具，能识别 TypeScript、JavaScript、Vue、CSS、Markdown 等几十种文件格式，并且理解驼峰命名（camelCase）和下划线命名（snake_case）——不会把 `getUserName` 拆成 `getusernam` 来检查，而是正确拆分成 `get`、`user`、`name` 三个单词分别检查。

CSpell 有两种使用方式，**配合使用才能获得最佳体验**：

| 使用方式 | 工具 | 触发时机 | 作用 |
|--|--|--|--|
| **编辑器插件**（乱数假文插件） | VS Code 扩展：Code Spell Checker | 实时，写代码时即时反馈 | 在编辑器中用蓝色波浪线标出拼写错误，`Cmd+.` 可快速添加到自定义词典 |
| **CLI 命令行** | `cspell` npm 包 | 手动执行 或 CI 流程中 | 扫描整个仓库，输出所有拼写问题的文件和行号 |

两者**读取同一份配置文件 `cspell.json`**，只需要配置一次，编辑器和 CI 都生效。

### 第一步：安装 VS Code 插件——Code Spell Checker

> 📖 **术语：Code Spell Checker（乱数假文插件）**
>
> VS Code 插件市场中的拼写检查扩展，插件 ID 为 `streetsidesoftware.code-spell-checker`。
>
> 它在中文开发者圈子里被戏称为**"乱数假文插件"**——原因是安装后，代码里大量技术专用词（如 `tsup`、`pnpm`、`turborepo`）会被标为未知词，蓝色波浪线密密麻麻，看起来像"Lorem Ipsum 乱数假文占位文字"一样让人摸不着头脑。
>
> **解决方法**：配置 `cspell.json` 的自定义词典，把项目专用术语加进去，让它认识这些词。

在项目根目录创建 `.vscode/extensions.json`，让所有打开这个项目的同学都收到安装提示：

```json
// .vscode/extensions.json
{
  "recommendations": [
    "streetsidesoftware.code-spell-checker"
  ]
}
```

> ⚠️ **注意**：`extensions.json` 只是"推荐"，不会强制安装。拉取代码后 VS Code 会弹出提示"此工作区推荐安装以下扩展"，点击安装即可。

### 第二步：安装 CSpell CLI 和乱数假文词典

```bash
pnpm add -w -D cspell @cspell/dict-lorem-ipsum
```

| 包 | 作用 |
|----|------|
| `cspell` | CSpell 命令行工具，用于在终端和 CI 中执行拼写扫描 |
| `@cspell/dict-lorem-ipsum` | 乱数假文词典包——包含 Lorem Ipsum 占位文字里的所有"单词"，避免模板里的占位文本触发误报 |

### 第三步：创建 `cspell.json` 配置文件

在根目录创建 `cspell.json`：

```json
{
  "import": ["@cspell/dict-lorem-ipsum/cspell-ext.json"],
  "caseSensitive": false,
  "dictionaries": ["custom-dictionary"],
  "dictionaryDefinitions": [
    {
      "name": "custom-dictionary",
      "path": "./.cspell/custom-dictionary.txt",
      "addWords": true
    }
  ],
  "ignorePaths": [
    "**/node_modules/**",
    "**/dist/**",
    "**/build/**",
    "**/lib/**",
    "**/docs/**",
    "**/vendor/**",
    "**/public/**",
    "**/static/**",
    "**/out/**",
    "**/tmp/**",
    "**/.turbo/**",
    "**/*.d.ts",
    "**/package.json",
    "**/*.md",
    "**/stats.html",
    "eslint.config.mjs",
    ".gitignore",
    ".prettierignore",
    "cspell.json",
    "pnpm-lock.yaml"
  ]
}
```

各字段详解：

> 📖 **`import`**：导入外部词典。这里导入了 `@cspell/dict-lorem-ipsum`，让 cspell 认识 Lorem Ipsum 占位词，避免在 HTML 模板或测试文件中使用占位文字时误报。

> 📖 **`dictionaries` + `dictionaryDefinitions`**：这是本配置的核心。
>
> - `dictionaryDefinitions`：**定义**一个名为 `custom-dictionary` 的自定义词典，词典文件路径为 `.cspell/custom-dictionary.txt`
> - **`addWords: true`**：关键配置！开启后，VS Code 插件的 `Cmd+.` → "Add to dictionary" 快捷操作会**自动把单词写入这个 `.txt` 文件**，而不是写入 `cspell.json` 本身
> - `dictionaries`：告诉 cspell 使用这个自定义词典
>
> 这种方式比直接在 `cspell.json` 里写 `words` 数组更好：`.txt` 文件一行一词，清晰简洁，也便于 Git diff 追踪谁添加了什么词。

> 📖 **`ignorePaths`**：告诉 cspell 哪些文件不检查。
> - `**/*.md`：Markdown 里有大量中文，cspell 不识别中文会全部报错，直接忽略
> - `**/package.json`：包名里全是第三方术语，没有意义检查
> - `pnpm-lock.yaml` / `**/*.d.ts`：自动生成的文件，不需要检查

### 第四步：创建 `.cspell/custom-dictionary.txt`

在根目录创建 `.cspell/` 文件夹，并在其中创建 `custom-dictionary.txt`：

```
# 构建工具
tsup
vite
vitest
esbuild
# 包管理 / Monorepo
pnpm
turbo
turborepo
monorepo
# 项目特定术语
dsn
clickhouse
# Vue 相关
composable
composables
unmount
# 通用前端术语
readonly
stringify
trackable
hoist
hoisted
hoisting
sourcemap
sourcemaps
typecheck
nullable
devtools
polyfill
polyfills
middleware
memoize
debounce
throttle
wasm
```

> ⚠️ **`.txt` 文件里不能写注释**，上面带 `#` 的行只是为了说明，实际文件里**每行只放一个单词**，不要加 `#` 注释，否则 cspell 会把 `#` 也当成词典内容。

### 第五步：在 `package.json` 添加 `spellcheck` 脚本

```json
// package.json（根目录）scripts 中添加：
"spellcheck": "cspell lint --no-progress --show-suggestions --no-summary --no-color \"(packages|apps)/**/*.{js,ts,mjs,cjs,json,tsx,css,less,scss,vue,html,md}\""
```

各参数的作用：

| 参数 | 作用 |
|------|------|
| `lint` | cspell 的子命令，表示执行拼写检查 |
| `--no-progress` | 不显示进度条（减少无用输出） |
| `--show-suggestions` | 显示拼写建议（告诉你可能正确的单词是什么） |
| `--no-summary` | 不显示汇总行 |
| `--no-color` | 不输出颜色代码（适合 CI 日志） |
| glob 范围 | 只检查 `packages/` 和 `apps/` 下的源码文件，不扫描根目录配置文件 |

> ⚠️ **为什么 `spellcheck` 不放进 Turborepo？**
>
> `lint`、`build` 等命令是每个子包各自执行（`turbo run lint` 并行跑所有包的 `eslint src`），Turborepo 的价值在于并行 + 缓存。
>
> 而 `spellcheck` 是**一条命令扫描所有包的文件**，本质是根目录级别的全局任务，不需要 Turborepo 调度，直接从根目录执行即可。

### 执行拼写检查

```bash
pnpm spellcheck
```

首次运行时，如果有未识别的单词，cspell 会输出类似：

```
packages/core/src/index.ts:5:7 - Unknown word (monitr)
  Suggestions: [monitor, monit, monte]
```

> ⚠️ **注意**：`monitorSdk` 这类驼峰命名单词，cspell 会自动拆成 `monitor` 和 `sdk` 分别检查。如果拆开后的每一段都合法，就**不会报错**。
>
> 所以演示时要故意写成 `monitrSdk`、`resposneData`、`qwertyuiopasdf` 这类真正包含错误片段的单词，才能看到提示。

**处理方式**（二选一）：
1. **在编辑器中**：光标放到蓝色波浪线单词上 → `Cmd+.` → `Add: "xxx" to project word list`，自动写入 `.cspell/custom-dictionary.txt`
2. **手动编辑**：直接在 `.cspell/custom-dictionary.txt` 末尾追加该单词

> ⚠️ **如果安装插件后编辑器没有波浪线提示**，可能是因为你的 VS Code 用户设置里已有 `cSpell.ignoreWords` 配置，或者之前全局安装了其他版本的 CSpell 插件导致冲突。检查方式：`Cmd+Shift+P` → `CSpell: Show CSpell Info Panel`，查看当前生效的配置。

---

## 4.5 Turborepo：是什么、为什么用、用了有什么好处

### 先说结论——用 Turborepo 能解决什么

在还没引入 Turborepo 之前，用 `pnpm -r run build` 构建所有包存在两个明显问题：

1. **没有缓存**：每次构建都从头来过，即使代码没有任何改动
2. **串行执行**：按依赖顺序一个一个跑，没有利用多核 CPU 并行

引入 Turborepo 之后，这两个问题都得到解决：

| | 引入前（`pnpm -r`） | 引入后（Turborepo） |
|--|---------|---------|
| 代码没变再构建 | 全量重跑，等 N 秒 | 全部命中缓存，18ms 完成 |
| 无依赖关系的包 | 串行等待 | 自动并行，多核同时跑 |
| 知道哪些包变了 | 不知道，全量跑 | 精确感知，只跑变化链路 |
| CI 构建时间 | 每次都重新来 | 缓存命中后接近零耗时 |

> 📖 **术语：Turborepo**：专门为 Monorepo 设计的**任务调度与构建缓存工具**。它通过分析包之间的依赖关系，决定哪些任务必须串行、哪些可以并行；同时对每个任务的输入文件做 hash 比对，输入没变就直接复用上次的输出结果，完全跳过实际构建。
>
> 类比：你有 10 道菜要做。`pnpm -r` 是一道一道按顺序来，Turborepo 是厨师团队同时开多个灶台——而且做过的菜直接从冰箱（缓存）取出来热一下就好，不用重新备料炒锅。

### 为什么不直接用 `pnpm -r` 加 `--parallel`？

可以，但解决不了缓存问题。`pnpm -r --parallel` 只是"并行跑所有包"，它：
- 不知道 `core` 必须在 `browser` 之前构建完（会出错）
- 不维护任何缓存，每次还是全量构建
- 没有 task graph 的概念，无法精准描述"什么依赖什么"

Turborepo 把构建任务建模成**有向无环图（DAG）**，精准调度：

```
build(@monitor/core)
        ↓
build(@monitor/browser-utils)
        ↓
build(@monitor/browser)  ← 依赖 core + browser-utils，等它们完成后才开始
      ↓         ↓
build(vue3-demo)   build(react-demo)  ← 互不依赖，自动并行！
```

> 🏗️ **架构思考：Turborepo 的缓存机制**
>
> Turborepo 对每个任务计算一个 hash，hash 的输入包括：
> - 任务涉及的源文件内容（`src/**`）
> - `tsup.config.ts`、`package.json` 等配置文件
> - 环境变量
>
> 只要 hash 没变，直接从 `.turbo/` 目录恢复上次的输出，完全不执行构建命令。
>
> ```
> 第一次 build：hash=abc123 → 执行构建 → 结果缓存到 .turbo/
> 第二次 build：hash=abc123 → 命中缓存 → 直接输出 "cache hit"，18ms 完成
> 改了 core/src/index.ts：hash=xyz789 → 重新构建 core + 依赖 core 的所有包（其他包不动）
> ```
>
> **最直观的体感**：改了一行 `@monitor/core` 的代码，Turborepo 只重新构建 core 和依赖它的包，其他 5 个无关包直接从缓存恢复，整体时间从 30 秒缩短到 5 秒。

### 安装 Turborepo

```bash
pnpm add -w -D turbo
```

---

## 4.6 `turbo.json` pipeline 配置

### 创建 `turbo.json`

在根目录创建 `turbo.json`：

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["src/**", "tsup.config.ts", "tsconfig.json", "package.json"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "persistent": true,
      "cache": false
    },
    "type-check": {
      "dependsOn": ["^build"]
    },
    "lint": {
      "outputs": []
    }
  }
}
```

> 📖 **术语：`tasks`（任务定义）**：`turbo.json` 中每个 key 对应一个可调度的任务名，与各包 `package.json` 中的 `scripts` 名称对应。Turborepo v2 用 `tasks` 替代了旧版的 `pipeline`，含义相同。

各字段详细说明：

**`build` 任务**：
```json
"build": {
  "dependsOn": ["^build"],   // ^ 表示：先跑所有依赖包的 build
  "inputs": ["src/**", ...], // 影响缓存 hash 的文件（这些文件变了才重新构建）
  "outputs": ["dist/**"]     // 构建产物目录（缓存命中时从这里恢复）
}
```

**`dev` 任务**：
```json
"dev": {
  "persistent": true,  // 长驻进程（不会退出，如 vite dev server）
  "cache": false       // 不缓存（dev 模式永远重新运行）
}
```

**`type-check` 任务**：
```json
"type-check": {
  "dependsOn": ["^build"]  // 需要先构建依赖包（才能检查类型引用）
}
```

**`lint` 任务**：
```json
"lint": {
  "outputs": []  // lint 没有产物（只有 stdout），outputs 为空
}
```

> 🏗️ **架构思考：`dependsOn: ["^build"]` vs `dependsOn: ["build"]`**
>
> - `"^build"`（带 `^`）：等待**我的依赖包**的 build 完成后，再运行我自己的 build
> - `"build"`（不带 `^`）：等待**同一个包**的 build 完成后，再运行（很少用）
>
> 对 SDK 这种有依赖链的项目，`^build` 是核心配置——它让 Turborepo 能自动推导出构建顺序，不需要手动声明"先 core 再 browser"。

---

## 4.7 更新根目录脚本，接入 Turborepo

将根目录 `package.json` 的脚本从 `pnpm -r run xxx` 改为 `turbo run xxx`：

```json
// package.json（根目录）- 修改后
{
  "name": "monitor",
  "private": true,
  "version": "0.0.1",
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "type-check": "turbo run type-check",
    "lint": "turbo run lint",
    "format": "prettier --write \"**/*.{ts,tsx,vue,js,mjs,json}\""
  },
  "devDependencies": {
    "@eslint/js": "^9.0.0",
    "eslint": "^9.0.0",
    "eslint-config-prettier": "^10.0.0",
    "eslint-plugin-react-hooks": "^5.0.0",
    "eslint-plugin-react-refresh": "^0.4.0",
    "eslint-plugin-vue": "^9.0.0",
    "prettier": "^3.0.0",
    "turbo": "^2.0.0",
    "typescript": "^5.4.0",
    "typescript-eslint": "^8.0.0",
    "vue-eslint-parser": "^9.0.0"
  },
  "pnpm": {
    "onlyBuiltDependencies": ["esbuild"]
  },
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=9.0.0"
  }
}
```

同时，各子包都需要增加 `lint` 脚本，Turborepo 才能调度到它们：

```json
// 每个子包的 package.json scripts 中添加：
"lint": "eslint src"
```

---

## 4.8 给各子包添加 lint 脚本（逐包说明）

### SDK 包（packages/*）

以 `@monitor/core` 为例：

```json
// packages/core/package.json
"scripts": {
  "build": "tsup",
  "dev": "tsup --watch",
  "type-check": "tsc --noEmit",
  "lint": "eslint src"
}
```

其他 SDK 包（`browser` / `browser-utils` / `vue` / `react`）同理，全部加 `"lint": "eslint src"`。

### 后端占位包（apps/backend/*）

后端占位包的 `src/main.ts` 是纯注释，可以直接 lint（注释内容不会触发规则）：

```json
// apps/backend/dsn-server/package.json
"scripts": {
  "dev": "echo '后端服务将在第 14 章实现'",
  "build": "echo '后端服务将在第 14 章实现'",
  "type-check": "tsc --noEmit",
  "lint": "eslint src"
}
```

### 前端平台（apps/frontend/monitor）

```json
// apps/frontend/monitor/package.json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "preview": "vite preview",
  "type-check": "tsc --noEmit",
  "lint": "eslint src"
}
```

### demos

```json
// demos/react-demo/package.json 和 demos/vue3-demo/package.json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "type-check": "tsc --noEmit",
  "lint": "eslint src"
}
```

---

## 4.9 验证：跑通构建与 lint 流程

完成以上所有改动后，在根目录执行：

```bash
# 1. 安装新加入的依赖
pnpm install

# 2. 验证构建（Turborepo 调度）
pnpm build
# 观察输出：Turborepo 会显示任务执行顺序和耗时
# 第一次无缓存，第二次（代码未变）应显示 ">>> FULL TURBO"（全部命中缓存）

# 3. 验证 lint（从根目录扫描全仓库）
pnpm lint

# 4. 验证拼写检查
pnpm spellcheck
# 首次运行会列出所有未识别的单词，将合法术语添加到 .cspell/custom-dictionary.txt
# 直到输出无错误为止

# 5. 验证格式化
pnpm format
```

### 第二次构建：观察 Turborepo 缓存效果

```bash
pnpm build
# 预期输出类似：
#   @monitor/core:build: cache hit, replaying logs
#   @monitor/browser-utils:build: cache hit, replaying logs
#   @monitor/browser:build: cache hit, replaying logs
#   @monitor/vue:build: cache hit, replaying logs
#   @monitor/react:build: cache hit, replaying logs
#
# Tasks:    5 successful, 5 total
# Cached:   5 cached, 5 total     ← 全部命中缓存！
# Time:     18ms >>> FULL TURBO
```

> 📖 **术语：`FULL TURBO`**：Turborepo 的专属输出，意思是"所有任务都从缓存恢复，没有实际执行任何构建"。这在 CI 环境中能极大节省时间。

---

## 本章小结

| 知识点 | 要点 |
|--------|------|
| 为什么做规范化 | Monorepo 多包并存，不统一规范就会悄悄漂移；规范化是让 Monorepo 从"能跑"到"能协作"的关键 |
| ESLint Flat Config | 单文件 `eslint.config.mjs` 覆盖全仓库，用数组组合规则 |
| ESLint + Prettier 分工 | ESLint 管逻辑问题，Prettier 管格式，`eslint-config-prettier` 解除冲突 |
| CSpell 拼写检查 | 两种方式配合：VS Code 插件（Code Spell Checker，"乱数假文插件"）实时提示 + CLI 在 CI 中拦截；共用同一份 `cspell.json`；自定义词典用独立的 `.cspell/custom-dictionary.txt` 文件（`addWords: true` 使 VS Code 插件可自动写入）；用 `@cspell/dict-lorem-ipsum` 导入乱数假文词典避免占位文字误报 |
| `.npmrc` | `shamefully-hoist=false` 防止幽灵依赖 |
| `.gitignore` | `dist/` 和 `.turbo/` 不提交，每次 CI 重新构建 |
| 为什么用 Turborepo | `pnpm -r` 没有缓存、没有精准并行，代码没变也全量重跑 |
| Turborepo 带来的好处 | 缓存命中零重建、精准并行、只重建变化链路，CI 时间大幅缩短 |
| Turborepo `tasks` | `^build` 声明依赖顺序，`persistent` 标记长驻进程，`cache: false` 跳过缓存 |
| `outputs` 字段 | 告诉 Turborepo 哪些目录是构建产物，命中缓存时直接恢复 |
| `FULL TURBO` | 全部缓存命中的标志，代表零重复构建工作 |

> **下一章**（第 05 章）：在已搭好的工程骨架上，正式开始 SDK 核心架构设计——参考 Sentry 分层模型，设计 `@monitor/core` 的初始化流程、插件机制和数据管道。
