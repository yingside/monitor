# 第 03 章：Monorepo 工程化搭建（一）——基础结构

> **本章目标**：用 pnpm workspace 搭建 `monitor` Monorepo 项目骨架，建立所有子包的目录结构与 TypeScript 多包配置，为后续各章的功能开发打好地基。
>
> ⚡ **本章涉及代码**：本章开始正式写代码。代码快照位于 `03.Monorepo工程化搭建（一）——基础结构/代码/monitor/`。

---

## 3.1 Monorepo 是什么，为什么监控系统适合用它

### 先问自己：我们有几个"项目"？

回顾第 2 章的架构图，我们要做的东西有这些：

```
SDK 包
├── @monitor/core          框架无关的核心逻辑
├── @monitor/browser       浏览器入口（组合各采集能力）
├── @monitor/browser-utils 工具函数
├── @monitor/vue           Vue3 适配层
└── @monitor/react         React 适配层

后端服务
├── dsn-server             数据接收服务（NestJS）
└── monitor-server         平台 API 服务（NestJS）

前端平台
└── monitor                可视化看板（Vite + React）

示例项目
├── vue3-demo              接入 SDK 的 Vue3 示例
└── react-demo             接入 SDK 的 React 示例
```

这一共是 **10 个独立的"包/应用"**，而且它们之间有依赖关系：
- `@monitor/browser` 依赖 `@monitor/core` 和 `@monitor/browser-utils`
- `demos/vue3-demo` 依赖 `@monitor/vue`（进而依赖 `@monitor/core`）
- `demos/react-demo` 依赖 `@monitor/react`

### 如果不用 Monorepo，会怎样？

如果每个包都是一个独立的 Git 仓库：

- 改了 `@monitor/core` 的一个接口，需要：发布新版本 → 去 `@monitor/browser` 改依赖版本 → 再发布 → 去 `demos` 改版本……**一次改动要操作 N 个仓库**
- 本地调试时，你需要 `npm link` 或者 `yalc` 来让包相互引用，**非常容易出错**
- 跑完整的测试需要在多个仓库各自跑，**难以保证一致性**

> 📖 **术语：Monorepo（单仓库多包）**：将多个相关的项目/包放在同一个 Git 仓库里管理。与之对应的是 Polyrepo（多仓库模式）。Monorepo 的核心价值是：**统一版本管理、本地直接引用、统一构建和测试流程**。

> 🏗️ **架构思考：Monorepo 不是"把代码放在一起"，而是"让依赖关系变得明确可管理"**
>
> 选择 Monorepo 的关键判断条件：
> 1. **包之间有强依赖关系**（监控 SDK 的 5 个包相互依赖，频繁同步改动）
> 2. **需要统一的技术规范**（ESLint / Prettier / TypeScript 配置只维护一份）
> 3. **需要跨包联调**（改了 core 立刻能在 demos 里看到效果，不需要发布）
>
> 如果你的多个项目几乎没有代码共享，各自独立演进，那 Polyrepo 反而更轻松。**架构选型是权衡，不是"Monorepo 永远更好"。**

### 为什么选 pnpm workspace 而不是 Yarn workspaces 或 Lerna？

| 工具 | 特点 |
|------|------|
| **pnpm workspace** | 原生支持 workspace 协议；磁盘利用率最高（硬链接机制，不重复安装）；速度快；符号链接正确 |
| Yarn workspaces | 功能类似，但磁盘空间占用更多；Yarn v1 有幽灵依赖问题 |
| Lerna | 老牌工具，版本发布能力强；但现在多配合 Turborepo 使用，不单独用了 |
| npm workspaces | Node.js 内置，无需额外安装；但功能不如 pnpm 完善 |

> **结论**：pnpm workspace 是目前 Monorepo 的业界最佳选择，配合 Turborepo（下一章）使用体验极好。

---

## 3.2 pnpm workspace 初始化

### 前置检查

开始之前，确认环境：

```bash
node --version   # 建议 v20+（本课程使用 v25.x）
pnpm --version   # 建议 v9+（本课程使用 v10.x）
```

### 第一步：创建项目根目录

```bash
mkdir monitor
cd monitor
```

### 第二步：初始化根目录 package.json

```bash
pnpm init
```

然后修改 `package.json`，**注意关键字段**：

```json
{
  "name": "monitor",
  "private": true,
  "version": "0.0.1",
  "scripts": {
    "build": "pnpm -r run build",
    "dev": "pnpm -r run dev",
    "type-check": "pnpm -r run type-check"
  },
  "devDependencies": {
    "typescript": "^5.4.0"
  }
}
```

> **为什么 `"private": true`？**
>
> 根目录本身不是一个要发布到 npm 的包，加上 `"private": true` 可以防止误执行 `pnpm publish` 把根目录发布出去。所有真正需要发布的子包（`@monitor/core` 等）才不加这个字段。

> **为什么 `typescript` 装在根目录？**
>
> TypeScript 编译器是所有包的共同工具，装在根目录一份即可，所有子包通过 pnpm 的 hoisting（提升）机制都能访问到。不需要每个包都装一遍，节省磁盘空间，也确保所有包用同一个 TS 版本。

### 第三步：创建 `pnpm-workspace.yaml`

这是 pnpm workspace 的核心配置文件，告诉 pnpm 哪些目录是工作区中的包：

```yaml
# pnpm-workspace.yaml
packages:
  - 'packages/*'      # SDK 各子包
  - 'apps/backend/*'  # 后端服务
  - 'apps/frontend/*' # 前端平台（注意：不是 apps/frontend/monitor，而是 *）
  - 'demos/*'         # 示例项目
```

> ⚠️ **注意**：`apps/frontend/` 目录下只有一个 `monitor/` 应用，所以 `apps/frontend/*` 匹配到的就是 `apps/frontend/monitor`。如果将来有多个前端应用，直接新建目录即可，无需改这个配置。

---

## 3.3 目录结构与各子包 package.json 初始化

### 创建完整目录结构

```bash
# SDK 子包
mkdir -p packages/{core,browser,browser-utils,vue,react}/src

# 后端服务
mkdir -p apps/backend/{dsn-server,monitor-server}/src

# 前端平台
mkdir -p apps/frontend/monitor/src

# 示例项目
mkdir -p demos/{vue3-demo,react-demo}/src

# Docker 基础设施（本章暂时只创建目录）
mkdir -p docker
```

执行完之后，目录结构如下：

```
monitor/
├── packages/
│   ├── core/src/
│   ├── browser/src/
│   ├── browser-utils/src/
│   ├── vue/src/
│   └── react/src/
├── apps/
│   ├── backend/
│   │   ├── dsn-server/src/
│   │   └── monitor-server/src/
│   └── frontend/
│       └── monitor/src/
├── demos/
│   ├── vue3-demo/src/
│   └── react-demo/src/
├── docker/
├── pnpm-workspace.yaml
└── package.json
```

---

### SDK 子包初始化

#### `packages/core` — SDK 核心

```json
// packages/core/package.json
{
  "name": "@monitor/core",
  "version": "0.1.0",
  "description": "Monitor SDK 核心模块（框架无关逻辑）",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "type-check": "tsc --noEmit"
  },
  "devDependencies": {
    "tsup": "^8.0.0"
  }
}
```

> 📖 **术语：`main` / `module` / `exports` 字段**
>
> - `main`：CommonJS 入口（Node.js `require()` 时使用）
> - `module`：ESM 入口（现代打包工具如 Vite / Webpack 会优先用这个）
> - `exports`：现代 Node.js 和打包工具识别的"条件导出"，可以根据导入方式（`import` 或 `require`）返回不同文件
>
> 三者并存是为了兼容不同的消费者：老项目用 `require`，新项目用 `import`。

> 📖 **术语：tsup**：一个基于 esbuild 的 TypeScript 打包工具，专为「发布到 npm 的包」设计。
> 与直接用 `tsc` 相比，tsup 速度快 10x 以上，且能一条命令同时输出 ESM + CJS + `.d.ts`；
> 与 Rollup 相比，配置极简（5 行搞定），不需要手写各种插件组合。
> 详细介绍见 3.7 节「tsup 构建配置」。

```ts
// packages/core/src/index.ts
// 第 03 章：骨架占位
// SDK 核心逻辑将在第 05 章开始逐步实现

export const MONITOR_VERSION = '0.1.0'
```

---

#### `packages/browser` — 浏览器 SDK 入口

```json
// packages/browser/package.json
{
  "name": "@monitor/browser",
  "version": "0.1.0",
  "description": "Monitor 浏览器 SDK 入口包",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "@monitor/core": "workspace:*",
    "@monitor/browser-utils": "workspace:*"
  },
  "devDependencies": {
    "tsup": "^8.0.0"
  }
}
```

```ts
// packages/browser/src/index.ts
// 第 03 章：骨架占位
// 浏览器 SDK 将在第 06~10 章逐步实现各采集插件

export { MONITOR_VERSION } from '@monitor/core'
```

---

#### `packages/browser-utils` — 工具函数包

```json
// packages/browser-utils/package.json
{
  "name": "@monitor/browser-utils",
  "version": "0.1.0",
  "description": "Monitor SDK 浏览器工具函数",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "type-check": "tsc --noEmit"
  },
  "devDependencies": {
    "tsup": "^8.0.0"
  }
}
```

```ts
// packages/browser-utils/src/index.ts
// 第 03 章：骨架占位
// 工具函数将在第 05 章开始实现（UUID 生成、元素路径解析、设备信息等）

export {}
```

---

#### `packages/vue` — Vue3 适配包

```json
// packages/vue/package.json
{
  "name": "@monitor/vue",
  "version": "0.1.0",
  "description": "Monitor SDK Vue3 适配层",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "@monitor/core": "workspace:*"
  },
  "peerDependencies": {
    "vue": "^3.0.0"
  },
  "devDependencies": {
    "tsup": "^8.0.0",
    "vue": "^3.4.0"
  }
}
```

> 📖 **术语：`peerDependencies`（同伴依赖）**
>
> 白话理解：`@monitor/vue` 需要和 Vue3 "配合工作"，但它不把 Vue 打包进自己里面——那会导致项目里出现两份 Vue（一份来自你的项目，一份来自 SDK）。
>
> `peerDependencies` 的意思是：**"我需要 Vue，但你（使用这个 SDK 的项目）来负责安装它，我来使用你安装的那份。"**
>
> 额外加 `devDependencies.vue` 是为了在开发时能本地编译（类型检查、构建），不影响消费者的行为。

```ts
// packages/vue/src/index.ts
// 第 03 章：骨架占位
// Vue3 适配层将在第 07 章实现

export {}
```

---

#### `packages/react` — React 适配包

```json
// packages/react/package.json
{
  "name": "@monitor/react",
  "version": "0.1.0",
  "description": "Monitor SDK React 适配层",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "@monitor/core": "workspace:*"
  },
  "peerDependencies": {
    "react": "^18.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "react": "^18.3.0",
    "tsup": "^8.0.0"
  }
}
```

```ts
// packages/react/src/index.ts
// 第 03 章：骨架占位
// React 适配层将在第 07 章实现

export {}
```

---

### 后端服务骨架

后端服务（NestJS）的完整实现在第 14-16 章。本章只建立目录和包描述文件，**不安装 NestJS 依赖**，避免在工程化阶段引入大量与 SDK 无关的包。

```json
// apps/backend/dsn-server/package.json
{
  "name": "@monitor/dsn-server",
  "version": "0.1.0",
  "description": "Monitor 数据接收服务（DSN Server）",
  "private": true,
  "scripts": {
    "dev": "echo '后端服务将在第 14 章实现'",
    "build": "echo '后端服务将在第 14 章实现'"
  }
}
```

```ts
// apps/backend/dsn-server/src/main.ts
// 第 03 章：骨架占位
// DSN 接收服务将在第 14 章用 NestJS 实现
// 职责：接收 SDK 上报 → 验证 DSN → 写入 Kafka
```

```json
// apps/backend/monitor-server/package.json
{
  "name": "@monitor/monitor-server",
  "version": "0.1.0",
  "description": "Monitor 平台 API 服务",
  "private": true,
  "scripts": {
    "dev": "echo '后端服务将在第 16 章实现'",
    "build": "echo '后端服务将在第 16 章实现'"
  }
}
```

```ts
// apps/backend/monitor-server/src/main.ts
// 第 03 章：骨架占位
// 监控平台 API 服务将在第 16 章用 NestJS 实现
// 职责：用户/项目管理 + 监控数据查询 API
```

---

### 前端平台骨架

前端监控平台的完整实现在第 17-21 章。本章建立 Vite + React 项目骨架。

```json
// apps/frontend/monitor/package.json
{
  "name": "@monitor/frontend",
  "version": "0.1.0",
  "description": "Monitor 前端可视化平台",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "vite": "^6.0.0"
  }
}
```

---

### demos 示例项目

示例项目是最终展示 SDK 接入效果的地方，也是课程中演示 SDK 功能的"测试场"。

```json
// demos/react-demo/package.json
{
  "name": "@monitor/react-demo",
  "version": "0.1.0",
  "description": "Monitor SDK React 接入示例",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "@monitor/browser": "workspace:*",
    "@monitor/react": "workspace:*",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "vite": "^6.0.0"
  }
}
```

```json
// demos/vue3-demo/package.json
{
  "name": "@monitor/vue3-demo",
  "version": "0.1.0",
  "description": "Monitor SDK Vue3 接入示例",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "@monitor/browser": "workspace:*",
    "@monitor/vue": "workspace:*",
    "vue": "^3.4.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@vitejs/plugin-vue": "^5.0.0",
    "vite": "^6.0.0"
  }
}
```

---

## 3.4 子包命名规范

### 为什么用 `@monitor/` 这个 scope？

```
@monitor/core
@monitor/browser
@monitor/browser-utils
@monitor/vue
@monitor/react
```

> 📖 **术语：npm scope（包的命名空间）**：`@xxx/yyy` 这种格式中，`@xxx` 叫做 scope（作用域），`yyy` 是包名。scope 有两个作用：
> 1. **避免命名冲突**：`core` 这个名字早就被别人注册了，`@monitor/core` 是我们私有的命名空间
> 2. **表明归属**：一看 `@monitor/xxx` 就知道是我们监控系统的包

### 命名原则

| 包名 | 对应职责 | 命名逻辑 |
|------|---------|---------|
| `@monitor/core` | SDK 核心，框架无关 | 最基础的核心，直接叫 core |
| `@monitor/browser` | 浏览器端入口 | 运行环境是 browser |
| `@monitor/browser-utils` | 浏览器工具函数 | browser 的工具集 |
| `@monitor/vue` | Vue3 适配 | 框架名即包名，简洁 |
| `@monitor/react` | React 适配 | 框架名即包名 |
| `@monitor/dsn-server` | 后端接收服务 | 职责描述 |
| `@monitor/monitor-server` | 后端业务 API | 职责描述 |
| `@monitor/frontend` | 前端平台 | 模块位置描述 |

---

## 3.5 子包互相引用：workspace 协议

### 问题：子包之间怎么引用？

`@monitor/browser` 依赖 `@monitor/core`。在普通项目里，你会写：
```json
"dependencies": {
  "@monitor/core": "^0.1.0"
}
```

但问题是：`@monitor/core` 根本还没发布到 npm！在本地开发时，怎么让 `@monitor/browser` 找到 `@monitor/core`？

### 解决方案：`workspace:*` 协议

```json
// packages/browser/package.json
"dependencies": {
  "@monitor/core": "workspace:*",
  "@monitor/browser-utils": "workspace:*"
}
```

> 📖 **术语：`workspace:*` 协议**：pnpm workspace 专有的依赖版本写法。它的意思是：**"不去 npm 上找这个包，直接用 workspace 里对应的本地包"**。
>
> `workspace:*` 中的 `*` 表示"当前 workspace 里任何版本都行"（等同于 `workspace:^` 或 `workspace:~`，但更宽松）。
>
> 当运行 `pnpm install` 后，pnpm 会在 `packages/browser/node_modules/@monitor/core` 创建一个**符号链接**，指向 `packages/core/`，实现本地直接引用。

> 🏗️ **架构思考：为什么不用相对路径 `../../core` 来引用？**
>
> 技术上可行，但有几个问题：
> 1. **类型推断问题**：相对路径引用的是源码，但 TypeScript 的模块解析和打包工具期望的是完整的包（含 `package.json`、`exports` 字段）
> 2. **路径硬编码**：如果包移动了位置，所有引用都要改
> 3. **生产行为不一致**：本地和发布后的行为会不同（发布后是从 npm 安装的，有版本号）
>
> `workspace:*` 让本地引用和"将来发布后"的引用语义完全一致，是更可靠的方案。

### 运行 pnpm install 后发生了什么？

```bash
pnpm install
```

pnpm 会：
1. 读取所有包的 `package.json`，收集所有依赖
2. 从 npm registry 下载非 workspace 包
3. 对于 `workspace:*` 依赖，**在使用它的子包自己的 `node_modules/@monitor/` 里创建符号链接**，指向对应的本地包目录

> 📖 **术语：pnpm 隔离模式（Isolated Node Modules）**
>
> pnpm 默认不会将依赖提升到根目录的 `node_modules/`（npm/Yarn 的默认行为）。
> 每个包只能访问它在 `package.json` 里明确声明的依赖——这叫做「严格依赖」，防止「幽灵依赖」（突然能用一个自己没有声明却被其他包带进来的包）的问题。
>
> 所以：**根目录的 `node_modules/@monitor/` 是空的**，这是正常表现。

验证链接是否正确：
```bash
# ✅ 正确姿势：查看使用 workspace 包的子包里的链接
# 以 @monitor/browser 依赖 @monitor/core 为例：
ls -la packages/browser/node_modules/@monitor/
# 输出：
# browser-utils -> ../../../browser-utils
# core -> ../../../core

# ❌ 错误姿势（npm/Yarn 的思维）：
# ls -la node_modules/@monitor/   ← pnpm 下这里不会有内容
```

---

## 3.6 根目录 package.json 的脚本设计

当前阶段（未引入 Turborepo 之前），根目录脚本使用 pnpm 的 `-r` 标志（recursive，递归执行）：

```json
// package.json（根目录）
{
  "scripts": {
    "build": "pnpm -r run build",
    "dev": "pnpm -r run dev",
    "type-check": "pnpm -r run type-check"
  }
}
```

> 📖 **术语：`pnpm -r run <script>`**：递归地在所有工作区子包里执行指定 script。pnpm 会自动处理依赖顺序——如果 `browser` 依赖 `core`，pnpm 会先构建 `core`，再构建 `browser`。

> ⚠️ **课程深度说明**：下一章（第 04 章）会引入 Turborepo，它比 `pnpm -r` 更强大——支持任务缓存（没变的包不重新构建）和并行执行。本章先用 `pnpm -r` 是为了让你理解最基础的工作原理。Turborepo 不是必须的，是性能优化工具。

---

## 3.7 TypeScript 多包配置

### 为什么需要多个 tsconfig？

不同类型的包有不同的 TypeScript 编译需求：

| 包类型 | 特殊需求 |
|--------|---------|
| SDK 包（core/browser/browser-utils） | 面向浏览器，需要 DOM 类型；产出 ESM + CJS 双格式 |
| Vue / React 适配包 | 需要 JSX 支持（React）或 Vue 类型 |
| 后端服务（NestJS） | 面向 Node.js；需要 `experimentalDecorators`（装饰器）支持 |
| 前端平台 / demos（Vite） | 面向浏览器；需要 JSX；`module` 用 `ESNext` |

所以我们设计三层 tsconfig 继承结构：

```
tsconfig.base.json          ← 所有包共同的基础配置
   ├── tsconfig.app.json    ← 前端/浏览器包的配置（扩展 DOM 类型、JSX）
   └── tsconfig.server.json ← 后端 Node.js 包的配置（装饰器、CommonJS）

每个子包的 tsconfig.json 继承对应的上层配置
```

> 🏗️ **架构思考：为什么不给每个包都写一个完整的 tsconfig？**
>
> 如果有 10 个包，每个包都有独立的完整 tsconfig，那意味着：
> - 修改一个公共配置项（比如 `strict` 模式）需要改 10 个文件
> - 各包的配置可能悄悄漂移，导致不一致的编译行为
>
> 通过「继承」，公共选项只维护一份，各包只声明自己的特殊需求。**这和 SDK 的分层设计是同一种思维：变化点隔离，稳定点共享。**

---

### `tsconfig.base.json` — 公共基础配置

```json
// tsconfig.base.json（根目录）
{
  "compilerOptions": {
    // ——— 语言与目标 ———
    "target": "ES2020",           // 编译产物的 JS 版本（ES2020 在现代浏览器和 Node 18+ 均支持）
    "module": "ESNext",           // 模块系统（tsup/vite 处理最终格式，TS 本身输出 ESM）
    "moduleResolution": "bundler", // 模块解析策略：告诉 TS 这段代码会被打包工具处理
                                   // （支持 package.json exports 字段，比 node 模式更现代）
    // ——— 类型检查严格性 ———
    "strict": true,               // 启用所有严格检查（null 检查、隐式 any 等）
    "noUnusedLocals": true,       // 报错：有未使用的局部变量
    "noUnusedParameters": true,   // 报错：有未使用的函数参数
    "noFallthroughCasesInSwitch": true, // 报错：switch case 没有 break
    // ——— 模块互操作 ———
    "esModuleInterop": true,      // 允许 import foo from 'cjs-package' 的写法
    "skipLibCheck": true,         // 跳过 .d.ts 文件的类型检查（加速编译，避免第三方库类型 bug）
    // ——— 输出控制 ———
    "declaration": true,          // 生成 .d.ts 类型声明文件
    "declarationMap": true,       // 生成 .d.ts.map（让 IDE 能从 .d.ts 跳转到源码）
    "sourceMap": true             // 生成 sourcemap（方便调试）
  }
}
```

---

### `tsconfig.app.json` — 浏览器端/前端配置

```json
// tsconfig.app.json（根目录）
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    // 浏览器端额外的类型库
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    // 支持 <Component /> 的 JSX 语法（React 17+ 无需 import React）
    "jsx": "react-jsx",
    // 处理 class 字段的方式（Vite 项目要求）
    "useDefineForClassFields": true
  }
}
```

---

### `tsconfig.server.json` — 后端 Node.js 配置

```json
// tsconfig.server.json（根目录）
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    // 后端编译目标（Node 18+ 支持 ES2021）
    "target": "ES2021",
    "module": "Node16",
    "moduleResolution": "Node16",
    // Node.js 类型库（不包含 DOM）
    "lib": ["ES2021"],
    // NestJS 依赖装饰器特性（@Controller(), @Injectable() 等语法）
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

---

### 各子包的 `tsconfig.json`

每个子包的 tsconfig 只需继承对应的上层配置，声明自己的 `include` 和 `outDir`：

**SDK 包（core / browser / browser-utils）** — 继承 `tsconfig.app.json`（有 DOM 类型）：

```json
// packages/core/tsconfig.json
// packages/browser/tsconfig.json
// packages/browser-utils/tsconfig.json
{
  "extends": "../../tsconfig.app.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

**Vue / React 适配包** — 同样继承 `tsconfig.app.json`：

```json
// packages/vue/tsconfig.json
// packages/react/tsconfig.json
{
  "extends": "../../tsconfig.app.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

**后端服务** — 继承 `tsconfig.server.json`：

```json
// apps/backend/dsn-server/tsconfig.json
// apps/backend/monitor-server/tsconfig.json
{
  "extends": "../../../tsconfig.server.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

**前端平台** — 继承 `tsconfig.app.json`，额外配置路径别名：

```json
// apps/frontend/monitor/tsconfig.json
{
  "extends": "../../../tsconfig.app.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src", "vite.config.ts"]
}
```

> ⚠️ **关于路径别名 `paths`**：这里配置的 `@/*` 仅告诉 TypeScript 类型系统如何解析 `@/` 开头的导入。实际打包时还需要在 `vite.config.ts` 里配置 `resolve.alias`，两者缺一不可。

**demos（React/Vue）** — 继承 `tsconfig.app.json`：

```json
// demos/react-demo/tsconfig.json
// demos/vue3-demo/tsconfig.json
{
  "extends": "../../tsconfig.app.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src", "vite.config.ts"]
}
```

---

### tsup 构建配置

#### tsup 是什么，为什么不直接用 tsc？

> 📖 **术语：tsup**
>
> **白话理解**：你写了一个 TypeScript 库，想打包成别人能 `npm install` 使用的包。直接用 `tsc` 可以，但有几个痛点：
> 1. `tsc` 只输出单一格式——如果你想同时支持 `import`（ESM）和 `require`（CJS），需要跑两次 `tsc` 并手动配置两套 tsconfig
> 2. `tsc` 不会打包依赖，输出的还是一堆 `.js` 文件，不是一个完整的 bundle
> 3. `tsc` 速度慢，每次改动都要等
>
> tsup 解决了上面所有问题：底层用 esbuild（Golang 写的，速度极快），一个配置文件同时产出 ESM + CJS + `.d.ts` 类型声明。

**tsup vs 其他方案对比：**

| 工具 | 适用场景 | 配置复杂度 | 速度 |
|------|---------|-----------|------|
| **tsup** | npm 包构建（SDK / 组件库） | 极低（5 行） | 极快（esbuild） |
| tsc | 简单包或仅需 ESM 的情况 | 低 | 慢 |
| Rollup | 需要精细 tree-shaking 控制的库 | 高（需配插件） | 中 |
| Vite（库模式） | Vue/React 组件库 | 低 | 快 |
| Webpack | 应用打包，不适合库 | 非常高 | 慢 |

> tsup 官网：https://tsup.egoist.dev

#### 配置说明

每个需要打包的 SDK 子包都需要一个 `tsup.config.ts`：

```ts
// packages/core/tsup.config.ts
// packages/browser/tsup.config.ts
// packages/browser-utils/tsup.config.ts
// packages/vue/tsup.config.ts
// packages/react/tsup.config.ts
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],    // 入口文件
  format: ['esm', 'cjs'],     // 同时输出 ESM 和 CommonJS 格式
  dts: true,                  // 生成 TypeScript 类型声明文件（.d.ts）
  clean: true,                // 构建前清空 dist/ 目录
  sourcemap: true,            // 生成 sourcemap
})
```

> 🏗️ **架构思考：为什么 SDK 包要同时输出 ESM 和 CJS？**
>
> SDK 的消费者多种多样：
> - 用 Vite/Webpack 5 构建的现代项目 → 使用 ESM（`.js`）
> - 用 Jest 跑单测的项目（Node.js 环境）→ 可能需要 CJS（`.cjs`）
> - 一些老的构建工具或 SSR 框架 → 需要 CJS
>
> 输出双格式是 SDK 包的标配，通过 `package.json` 的 `exports` 字段让消费者自动选到正确的格式，**我们不需要操心消费者用什么构建工具**。

---

## Vite 应用的额外配置

前端平台和 demos 的 Vite 配置文件：

```ts
// apps/frontend/monitor/vite.config.ts
// demos/react-demo/vite.config.ts（相同结构）
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // 配合 tsconfig.json 的 paths，让 @/xxx 解析到 src/xxx
      '@': resolve(__dirname, './src'),
    },
  },
})
```

```ts
// demos/vue3-demo/vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'node:path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
})
```

---

## 动手验证：跑通 pnpm install

完成以上所有文件创建后，在根目录执行：

```bash
# 在 monitor/ 根目录下
pnpm install
```

预期输出（大致）：
```
Packages: +xxx
Progress: resolved xxx, reused xxx, downloaded xxx, added xxx, done

devDependencies:
+ typescript 5.x.x
```

验证 workspace 链接是否正确：
```bash
# ✅ pnpm 的正确姿势：链接在使用该包的子包自己的 node_modules 里
# 以 @monitor/browser 包为例（它依赖 core 和 browser-utils）：
ls -la packages/browser/node_modules/@monitor/
# 输出：
# browser-utils -> ../../../browser-utils
# core -> ../../../core

# demos 也一样，比如 react-demo 依赖 @monitor/browser 和 @monitor/react：
ls -la demos/react-demo/node_modules/@monitor/
# 输出：
# browser -> ../../packages/browser
# react  -> ../../packages/react

# ❌ 这个命令在 pnpm 下不会有效果（npm/Yarn 的思维）：
# ls -la node_modules/@monitor/
```

验证 TypeScript 类型检查能通过：
```bash
# 在根目录执行，递归检查所有包（backend 的占位文件也会通过）
pnpm type-check
```

验证 SDK 包可以构建：
```bash
# 在 packages/core 下构建，验证 tsup 配置正确
cd packages/core
pnpm build
ls dist/
# 应该看到：index.js  index.cjs  index.d.ts  index.d.ts.map
```

---

## 下一章安装依赖前的注意事项：哪些包装在根目录，哪些装在子包

本章的 `pnpm install` 只安装了 `typescript` 到根目录，以及各子包各自声明的依赖（tsup、vite 等）。下一章（第 04 章）引入代码规范工具时，需要决定每个新包装在哪里。

### 判断原则

> **装根目录**：这个工具是**所有子包共用的**，不属于任何一个具体包的运行时或构建时逻辑
>
> **装子包**：这个工具**只为这个包服务**，或者是这个包的运行依赖

### 对应到我们的项目

**根目录（`pnpm add -w -D xxx`）**：

| 包 | 原因 |
|----|------|
| `typescript` ✅ 已装 | 所有子包共用同一个 TS 编译器版本 |
| `eslint` + 配置插件 | 代码规范是全局统一的，下一章安装 |
| `prettier` | 代码格式化是全局统一的，下一章安装 |
| `turbo`（Turborepo） | 任务调度工具，管理所有子包的构建，下一章安装 |
| `lint-staged` / `husky` | Git hook 是仓库级别的，下一章安装 |

**各子包自己装（`pnpm add -D xxx --filter @monitor/core`）**：

| 包 | 装在哪里 | 原因 |
|----|---------|------|
| `tsup` ✅ 已装 | 各 SDK 子包 | 只有 SDK 包需要 tsup 构建 |
| `vite` + `@vitejs/plugin-react/vue` ✅ 已装 | 各 Vite 应用 | 只有前端应用需要 Vite |
| `vue` / `react` ✅ 已装 | 对应适配包和 demo | 框架是各包自己的依赖 |
| NestJS 相关 | dsn-server / monitor-server | 第 14 章再装，只有后端服务需要 |

### 实操命令格式

```bash
# 装到根目录（-w 表示 workspace root）
pnpm add -w -D eslint prettier

# 装到指定子包（--filter 指定包名）
pnpm add -D tsup --filter @monitor/core

# 装到所有 SDK 子包（--filter 支持通配符）
pnpm add -D tsup --filter "./packages/*"
```

> ⚠️ **常见错误**：把 `eslint` 装到某一个子包里，导致其他子包的 lint 规则不生效；或者把 `vite` 装到根目录，导致根目录无故多了一个前端构建工具。**装包之前先问自己：这个包是全局规范工具，还是某个包的专属工具？**

---

## 本章小结

| 知识点 | 要点 |
|--------|------|
| Monorepo 适用场景 | 多包强依赖、需统一规范、需要跨包联调 |
| `pnpm-workspace.yaml` | 声明哪些目录是 workspace 子包，pnpm 自动处理依赖图 |
| `workspace:*` | 本地包引用协议，pnpm 创建符号链接，等同于"本地 npm 包" |
| tsconfig 三层继承 | base → app/server → 各子包，共享变，隔离差异 |
| `peerDependencies` | "我需要这个库，但你来安装"——SDK 适配包的标准做法 |
| tsup | TypeScript 包构建工具，输出 ESM + CJS 双格式 |
| `exports` 字段 | 现代包入口声明，根据导入方式自动选择正确文件 |

> **下一章**（第 04 章）：在这个骨架基础上，接入 ESLint、Prettier 代码规范工具，然后引入 Turborepo 实现构建加速和任务缓存。
