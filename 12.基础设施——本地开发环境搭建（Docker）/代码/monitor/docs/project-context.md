# 项目上下文文档

> 本文档描述**第 12 章结束后**项目的完整状态，供后续章节开发时快速建立上下文，避免重复探索代码。

---

## 一、项目基本信息

| 项目 | 说明 |
|---|---|
| **根目录** | `12.基础设施——本地开发环境搭建（Docker）/代码/monitor/` |
| **包管理器** | pnpm 10.x |
| **构建工具** | Turborepo v2 |
| **Node.js** | v25.x |
| **语言** | 全量 TypeScript，禁用 `any`，SDK 边界处用 `unknown` |
| **模块规范** | 全量 ES Module |
| **代码风格** | 2 空格缩进 / 单引号 / 不加分号（Prettier 管理）|

---

## 二、Monorepo 目录结构

```
monitor/
├── packages/
│   ├── core/            @monitor/core — 框架无关核心逻辑（含 Transport 层）
│   ├── browser/         @monitor/browser — 浏览器入口包 + 采集插件
│   ├── browser-utils/   @monitor/browser-utils — 纯工具函数
│   ├── vue/             @monitor/vue — Vue3 框架错误适配层
│   └── react/           @monitor/react — React 框架错误适配层
├── apps/backend/
│   ├── dsn-server/      数据接收服务（骨架，第 14 章实现）
│   └── monitor-server/  平台 API 服务（骨架，第 16 章实现）
├── demos/
│   ├── vue3-demo/       Vue3 接入演示
│   ├── react-demo/      React 接入演示
│   ├── mock-server/     本地 Mock API 服务器（端口 3002）
│   └── collect-server/  本地上报接收服务器（端口 3001，第 14 章前临时使用）
├── docker/              第 12 章新增
│   ├── docker-compose.yml   容器编排（提交到 Git）
│   ├── .env                 本地配置（不提交到 Git）
│   └── .env.example         配置模板（提交到 Git）
├── docs/project-context.md
├── pnpm-workspace.yaml
└── turbo.json
```

---

## 三、第 12 章新增内容

### docker/docker-compose.yml（新增）

四个服务：

| 服务 | 镜像 | 端口 | 用途 |
|---|---|---|---|
| postgres | postgres:16-alpine | 5432 | 业务数据库（用户/项目） |
| clickhouse | clickhouse/clickhouse-server:24.3-alpine | 8123 / 9000 | 监控数据分析库（OLAP）|
| kafka | apache/kafka:3.9.2 | 9094（宿主机） | 消息队列（KRaft 模式）|
| kafka-ui | provectuslabs/kafka-ui:v0.7.2 | 8081 | Kafka 可视化管理 |

Kafka Listener 配置（关键）：
- PLAINTEXT://kafka:9092：容器内服务互访（第 14/15 章 Consumer 用）
- EXTERNAL://localhost:9094：宿主机本机进程访问（NestJS dev 时用）

Volume 持久化：
- monitor_postgres_data → PostgreSQL 数据
- monitor_clickhouse_data → ClickHouse 数据
- monitor_clickhouse_logs → ClickHouse 日志
- monitor_kafka_data → Kafka 消息数据

### 根目录 package.json 新增脚本

```json
{
  "infra:start": "docker compose -f docker/docker-compose.yml --env-file docker/.env up -d",
  "infra:stop":  "docker compose -f docker/docker-compose.yml --env-file docker/.env stop",
  "infra:reset": "docker compose -f docker/docker-compose.yml --env-file docker/.env down -v",
  "infra:logs":  "docker compose -f docker/docker-compose.yml --env-file docker/.env logs -f"
}
```

---

## 四、SDK 状态（继承自第 11 章，本章无修改）

### MonitorOptions

```typescript
interface MonitorOptions {
  dsn: string           // 当前指向 http://localhost:3001/collect（临时）
  appId: string
  userId?: string
  sampleRate?: number   // 默认 1
  plugins?: Plugin[]
  debug?: boolean       // 默认 false
  flushInterval?: number  // 默认 5000ms
  maxBatchSize?: number   // 默认 10
}
```

### MonitorEvent（上报结构）

```typescript
interface MonitorEvent {
  traceId: string
  appId: string
  userId?: string
  type: 'error' | 'performance' | 'behavior' | 'api'
  payload: unknown
  timestamp: number
  page: string
  ua: string
}
```

---

## 五、基础设施连接信息（DataGrip / 代码中使用）

### PostgreSQL

- Host: localhost
- Port: 5432
- Database: monitor
- User: monitor
- Password: Monitor2024

### ClickHouse（DataGrip 选 HTTP 驱动）

- Host: localhost
- Port: 8123 (HTTP Interface)
- Database: monitor
- User: monitor
- Password: Monitor2024

### Kafka

- Bootstrap Server（宿主机 NestJS 用）: localhost:9094
- Bootstrap Server（容器内服务用）: kafka:9092
- Kafka UI: http://localhost:8081

---

## 六、数据流当前状态

```
SDK（浏览器）
  ↓ fetch POST / sendBeacon
collect-server (localhost:3001)    ← 临时验证用，第 14 章替换

[第 14 章] dsn-server NestJS → Kafka (localhost:9094) ← 已就绪
                                       ↓ [第 15 章]
                               Consumer → ClickHouse ← 已就绪
                               PostgreSQL ← 已就绪（用户/项目）
```

---

## 七、下一章（第 13 章）需要的前置知识

第 13 章：ClickHouse 数据表设计

- 在 DataGrip 中连接 ClickHouse（localhost:8123，monitor 用户）
- 为四类监控数据创建表：error_logs / performance_logs / behavior_logs / api_logs
- 表引擎：MergeTree()，排序键：(app_id, toDateTime(timestamp))，分区：按月
- SDK 代码不需要改动，只需确保 demos 项目的 dsn 将来改为指向 dsn-server（第 14 章）
