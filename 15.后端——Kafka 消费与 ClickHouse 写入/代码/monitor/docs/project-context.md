# 项目上下文文档

> 本文档描述**第 15 章结束后**项目的完整状态，供后续章节开发时快速建立上下文，避免重复探索代码。

---

## 一、项目基本信息

| 项目 | 说明 |
|---|---|
| **根目录** | `15.后端——Kafka 消费与 ClickHouse 写入/代码/monitor/` |
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
│   ├── dsn-server/      ← 第 14 章实现完成
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── report/
│   │   │   │   ├── report.module.ts
│   │   │   │   ├── report.controller.ts  POST /report 接口
│   │   │   │   ├── report.service.ts     appId 校验 + Kafka 写入
│   │   │   │   └── dto/
│   │   │   │       └── report-event.dto.ts  请求体 DTO 定义
│   │   │   └── kafka/
│   │   │       ├── kafka.module.ts       全局 Kafka 模块
│   │   │       └── kafka.service.ts      Producer 封装
│   │   ├── .env.example
│   │   ├── nest-cli.json
│   │   └── package.json
│   ├── consumer-server/ ← 第 15 章新增
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── health.controller.ts      GET /health
│   │   │   ├── clickhouse/
│   │   │   │   ├── clickhouse.module.ts  @Global() 全局模块
│   │   │   │   └── clickhouse.service.ts @clickhouse/client 封装
│   │   │   └── consumer/
│   │   │       ├── consumer.module.ts
│   │   │       ├── consumer.service.ts   Kafka Consumer 主逻辑
│   │   │       └── handlers/
│   │   │           ├── event.types.ts    Payload 类型 + toClickHouseDateTime
│   │   │           ├── error.handler.ts
│   │   │           ├── performance.handler.ts
│   │   │           ├── behavior.handler.ts
│   │   │           └── api.handler.ts
│   │   ├── .env.example
│   │   ├── nest-cli.json
│   │   └── package.json
│   └── monitor-server/  平台 API 服务（骨架，第 16 章实现）
├── demos/
│   ├── vue3-demo/       Vue3 接入演示（DSN 已更新 → http://localhost:3000/report）
│   ├── react-demo/      React 接入演示（DSN 已更新 → http://localhost:3000/report）
│   ├── mock-server/     本地 Mock API 服务器（端口 3002）
│   └── collect-server/  本地上报接收服务器（端口 3001，第 14 章后已弃用）
├── docker/              第 12 章建立
│   ├── docker-compose.yml
│   ├── clickhouse/
│   │   └── listen.xml
│   ├── .env
│   └── .env.example
├── db/                  第 13 章新增
│   └── clickhouse/
│       ├── 01_create_tables.sql
│       ├── 02_mock_data.sql
│       └── 03_query_examples.sql
├── docs/project-context.md
├── pnpm-workspace.yaml
└── turbo.json
```

---

## 三、DSN Server 状态（第 14 章完成，第 15 章无改动）

### 服务概览

| 项目 | 值 |
|---|---|
| 包名 | `@monitor/dsn-server` |
| 端口 | 3000（可通过 `PORT` 环境变量覆盖）|
| 框架 | NestJS v10 + Express |
| 启动命令 | `pnpm dsn-server` 或 `pnpm --filter @monitor/dsn-server dev` |

### 目录结构

```
apps/backend/dsn-server/
├── src/
│   ├── main.ts                         应用入口（CORS + 全局校验管道）
│   ├── app.module.ts                   根模块（Throttler + Kafka + Report）
│   ├── report/
│   │   ├── report.module.ts
│   │   ├── report.controller.ts        POST /report（批量上报入口）
│   │   ├── report.service.ts           appId 校验 + 分发到 Kafka
│   │   └── dto/
│   │       └── report-event.dto.ts     ReportBatchDto / ReportEventDto
│   └── kafka/
│       ├── kafka.module.ts             @Global() 全局 Kafka 模块
│       └── kafka.service.ts            Producer 封装（onModuleInit 自动连接）
├── .env.example                        环境变量模板
├── nest-cli.json
├── package.json
└── tsconfig.json
```

### 环境变量（.env）

| 变量名 | 默认值 | 说明 |
|---|---|---|
| `PORT` | 3000 | 服务监听端口 |
| `KAFKA_BROKERS` | localhost:9094 | Kafka Broker 地址（宿主机访问容器用 9094）|
| `VALID_APP_IDS` | （空）| 合法 appId 白名单，逗号分隔；空=跳过校验 |

### API 端点

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/report` | 批量接收监控事件，写入 Kafka |
| POST | `/health` | 健康检查 |

### 请求体格式（ReportBatchDto）

```json
{
  "events": [
    {
      "traceId": "uuid-v4",
      "appId": "vue3-demo",
      "userId": "user_123",
      "type": "error",
      "payload": { ... },
      "timestamp": 1715000000000,
      "page": "https://example.com/",
      "ua": "Mozilla/5.0 ..."
    }
  ]
}
```

### Kafka Topic 分发规则

| 事件 type | Kafka Topic |
|---|---|
| error | monitor.error |
| performance | monitor.performance |
| behavior | monitor.behavior |
| api | monitor.api |

---

## 四、Consumer Server 状态（第 15 章新增）

### 服务概览

| 项目 | 值 |
|---|---|
| 包名 | `@monitor/consumer-server` |
| 端口 | 3001（可通过 `PORT` 环境变量覆盖）|
| 框架 | NestJS v10 + Express |
| 启动命令 | `pnpm consumer-server` 或 `pnpm --filter @monitor/consumer-server dev` |
| Kafka Consumer Group | `monitor-consumer-group` |

### 目录结构

```
apps/backend/consumer-server/
├── src/
│   ├── main.ts                              应用入口（端口 3001）
│   ├── app.module.ts                        根模块
│   ├── health.controller.ts                 GET /health
│   ├── clickhouse/
│   │   ├── clickhouse.module.ts             @Global() 全局模块
│   │   └── clickhouse.service.ts            @clickhouse/client 封装
│   └── consumer/
│       ├── consumer.module.ts
│       ├── consumer.service.ts              Kafka Consumer 主逻辑
│       └── handlers/
│           ├── event.types.ts               Payload 类型定义 + toClickHouseDateTime()
│           ├── error.handler.ts             monitor.error → error_logs
│           ├── performance.handler.ts       monitor.performance → performance_logs
│           ├── behavior.handler.ts          monitor.behavior → behavior_logs
│           └── api.handler.ts               monitor.api → api_logs
├── .env.example
├── nest-cli.json
├── package.json
└── tsconfig.json
```

### 环境变量（.env）

| 变量名 | 默认值 | 说明 |
|---|---|---|
| `PORT` | 3001 | 服务监听端口 |
| `KAFKA_BROKERS` | localhost:9094 | Kafka Broker 地址（宿主机） |
| `KAFKA_GROUP_ID` | monitor-consumer-group | Consumer Group ID |
| `CLICKHOUSE_HOST` | http://localhost:8123 | ClickHouse HTTP 地址 |
| `CLICKHOUSE_DATABASE` | monitor | 数据库名 |
| `CLICKHOUSE_USER` | monitor | 用户名 |
| `CLICKHOUSE_PASSWORD` | 123456 | 密码 |

### Payload → ClickHouse 字段映射

**错误事件 → error_logs**

| payload.subType | error_type 列 | 特殊处理 |
|---|---|---|
| 'js' | 'js_error' | 直接映射 message/stack/filename/lineno/colno |
| 'resource' | 'resource_error' | message = "Failed to load TAG: src"，filename = src |
| 'promise' | 'promise_error' | filename/lineno/colno 填 ''/0/0 |
| 'vue'/'react' | 'framework_error' | componentInfo 追加到 stack 末尾 |

**性能事件 → performance_logs**

| payload.subType | 说明 |
|---|---|
| 'web-vital' | 每条只有一个指标；FCP→fcp，LCP→lcp，INP→fid，CLS→cls，TTFB→ttfb；其余为 0 |
| 'navigation-timing' | ttfb 和 load_time 有值，其余为 0 |

**行为事件 → behavior_logs**

| payload.subType | action_type | element | extra |
|---|---|---|---|
| 'pv' | 'page_view' | '' | {referrer} |
| 'click' | 'click' | elementPath | {text: elementText} |
| 'route-change' | 'route_change' | '' | {from, to} |
| 'custom' | 'custom' | '' | payload.extra ?? {} |

**API 事件 → api_logs**

直接映射 method/url/status/duration/success；request_size=0，response_size=-1（SDK 未采集）。

---

## 五、基础设施状态（第 12-13 章，本章无改动）

### docker/docker-compose.yml

四个服务：

| 服务 | 镜像 | 端口 | 用途 |
|---|---|---|---|
| postgres | postgres:16-alpine | 5432 | 业务数据库（用户/项目） |
| clickhouse | clickhouse/clickhouse-server:24.3-alpine | 8123 / 9000 | 监控数据分析库（OLAP）|
| kafka | apache/kafka:3.9.2 | 9094（宿主机） | 消息队列（KRaft 模式）|
| kafka-ui | provectuslabs/kafka-ui:v0.7.2 | 8081 | Kafka 可视化管理 |

**ClickHouse 额外配置（第 13 章修复）**：
- `docker/clickhouse/listen.xml` 挂载进容器
- 强制 IPv4 监听（`<listen_host>0.0.0.0</listen_host>`），修复 macOS/Linux 部分环境 IPv6 不可用导致 ClickHouse 启动失败

**Kafka 双 Listener 配置**：
- `PLAINTEXT://kafka:9092`：容器内服务互访（第 14/15 章 Consumer 用）
- `EXTERNAL://localhost:9094`：宿主机 NestJS dev 进程访问

### 连接信息

**PostgreSQL**：localhost:5432 / database=monitor / user=monitor / password=123456

**ClickHouse**（DataGrip 选 HTTP 驱动）：localhost:8123 / database=monitor / user=monitor / password=123456

**Kafka**：bootstrap=localhost:9094（宿主机）/ kafka:9092（容器内）/ Kafka UI: http://localhost:8081

---

## 六、ClickHouse 表结构（第 13 章，本章无改动）

### 四张表共同配置

```sql
ENGINE = MergeTree()
PARTITION BY toYYYYMM(created_at)   -- 按月分区
ORDER BY (app_id, created_at)        -- 排序键
TTL created_at + INTERVAL 90 DAY    -- 90 天自动过期
```

### 公共字段（四张表相同）

| 字段 | 类型 | 说明 |
|---|---|---|
| trace_id | String | 每次上报唯一 ID（来自 MonitorEvent.traceId）|
| app_id | String | 项目标识（来自 MonitorEvent.appId）|
| user_id | String | 用户标识（未设置时为空字符串）|
| page | String | 页面 URL |
| ua | String | User-Agent |
| created_at | DateTime | 上报时间 |

### error_logs（type = 'error'）特有字段

| 字段 | 类型 | 说明 |
|---|---|---|
| error_type | LowCardinality(String) | js_error / resource_error / promise_error / framework_error |
| message | String | Error.message |
| stack | String | Error.stack，可能为空 |
| filename | String | 出错脚本或资源 URL |
| lineno | Int32 | 行号，无法获取为 0 |
| colno | Int32 | 列号，无法获取为 0 |

### performance_logs（type = 'performance'）特有字段

| 字段 | 类型 | 说明 |
|---|---|---|
| fcp | Float64 | First Contentful Paint（ms）|
| lcp | Float64 | Largest Contentful Paint（ms）|
| fid | Float64 | First Input Delay（ms）|
| cls | Float64 | Cumulative Layout Shift（无单位）|
| ttfb | Float64 | Time to First Byte（ms）|
| load_time | Float64 | 页面完整加载耗时（ms）|

### behavior_logs（type = 'behavior'）特有字段

| 字段 | 类型 | 说明 |
|---|---|---|
| action_type | LowCardinality(String) | page_view / click / custom |
| element | String | 被点击元素 CSS 路径，page_view 为空 |
| extra | String | 自定义埋点 JSON 字符串 |

### api_logs（type = 'api'）特有字段

| 字段 | 类型 | 说明 |
|---|---|---|
| method | LowCardinality(String) | GET / POST / PUT / DELETE / PATCH |
| url | String | 请求完整 URL |
| status | Int32 | HTTP 状态码，网络错误为 0 |
| duration | Float64 | 请求耗时（ms）|
| request_size | Int32 | 请求体大小（bytes）|
| response_size | Int32 | 响应体大小（bytes），无法获取为 -1 |
| success | Bool | status 200-299 且无网络错误 |

---

## 七、模拟数据状态（第 13 章建立，本章无改动）

执行 `db/clickhouse/02_mock_data.sql`（在 DataGrip 中粘贴执行）后写入：

| 表 | 行数 | app_id | 时间范围 |
|---|---|---|---|
| error_logs | ~20 条 | app_001 / app_002 | 近 7 天 |
| performance_logs | 16 条 | app_001 / app_002 | 近 7 天 |
| behavior_logs | 20 条 | app_001 / app_002 | 近 7 天 |
| api_logs | 20 条 | app_001 / app_002 | 近 7 天 |

重新执行 02_mock_data.sql 会追加数据（不去重）。如需清空重来：
```bash
curl -u monitor:123456 'http://localhost:8123/?database=monitor&query=TRUNCATE+TABLE+error_logs'
# 同样操作其余三张表
```

---

## 八、SDK 状态（第 11 章，本章无改动）

### MonitorOptions

```typescript
interface MonitorOptions {
  dsn: string           // 第 14 章已更新为 http://localhost:3000/report（dsn-server）
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

## 九、数据流完整状态

```
SDK（浏览器）
  ↓ fetch POST / sendBeacon POST /report
dsn-server (localhost:3000)       ← ✅ 第 14 章
  ↓ Kafka Producer (localhost:9094)
Kafka Topics: monitor.error / .performance / .behavior / .api
  ↓ Kafka Consumer (consumer-server)
consumer-server (localhost:3001)  ← ✅ 第 15 章
  ↓ @clickhouse/client HTTP 写入
ClickHouse 四张表已有真实数据  ← ✅
PostgreSQL（用户/项目，第 16 章建表）
```

---

## 十、常用命令

```bash
# 启动基础设施
pnpm infra:start

# 启动 DSN Server（生产者，端口 3000）
pnpm dsn-server

# 启动 Consumer Server（消费者，端口 3001）
pnpm consumer-server

# 健康检查
curl http://localhost:3001/health
```

```sql
-- 写入模拟数据：在 DataGrip 中打开 db/clickhouse/02_mock_data.sql，全选执行

-- 验证四张表行数（DataGrip 中执行）
SELECT name, total_rows
FROM system.tables
WHERE database = 'monitor' AND engine = 'MergeTree';

-- 运行聚合查询示例：在 DataGrip 中打开 db/clickhouse/03_query_examples.sql
```
