# 第 15 章：后端——Kafka 消费与 ClickHouse 写入

> **目标**：实现 Kafka Consumer，消费四个监控 Topic 的消息，将数据解析后写入 ClickHouse 对应表，打通从浏览器到数据库的最后一公里。
>
> ❗ **课程深度说明**：本章不展开 Kafka 的分区负载均衡、副本高可用等进阶特性，也不展开 ClickHouse 的性能调优。重点是打通数据链路：消息从 Kafka 被消费 → 解析 payload → 写入 ClickHouse 四张表。

---

> ## ⚠️ 第 14 章代码勘误
>
> **影响文件**：`apps/backend/dsn-server/src/report/dto/report-event.dto.ts`
>
> **问题**：`payload` 字段没有加 `@IsOptional()` 装饰器。  
> `ValidationPipe(whitelist: true)` 的规则是：**只保留有 class-validator 装饰器的字段**，没有任何装饰器的字段会被视为"额外字段"直接剥除。  
> 这导致 dsn-server 接收到 SDK 上报数据后，`payload` 在写入 Kafka 前就被删掉了，consumer-server 消费时 `event.payload` 永远是 `undefined`。
>
> **修复**：给 `payload` 加上 `@IsOptional()`：
>
> ```typescript
> // 修改前（第 14 章原始代码）
> payload: unknown
>
> // 修改后
> @IsOptional()
> payload: unknown
> ```
>
> 第 14 章和第 15 章的代码已同步更新此修复。

---

## 本章课程元信息

```json
{
  "chapter": 15,
  "title": "后端——Kafka 消费与 ClickHouse 写入",
  "duration": "约 90 分钟",
  "skills": [
    "kafkajs Consumer groupId / subscribe / run / eachMessage",
    "Kafka Consumer Group Offset 消费进度管理",
    "@clickhouse/client createClient / insert / JSONEachRow",
    "ClickHouse DateTime 字段格式处理",
    "TypeScript 判别联合类型 switch-case 收窄",
    "NestJS OnModuleInit / OnModuleDestroy 生命周期（Consumer 启停）",
    "NestJS @Global() 单例模块共享"
  ],
  "output": "apps/backend/consumer-server 完整可运行；SDK 上报的数据可在 ClickHouse 四张表中查询到"
}
```

---

## 15.1 接续第 14 章：消息现在在哪里？

第 14 章的工作到 Kafka 为止。让我们先回顾一下整条链路的当前状态：

```
SDK（浏览器）
  ↓ fetch POST /report
dsn-server（端口 3000）   ← ✅ 第 14 章已完成
  ↓ Kafka Producer
Kafka Topics
  ├── monitor.error        ← 消息在这里等待被消费
  ├── monitor.performance  ← 消息在这里等待被消费
  ├── monitor.behavior     ← 消息在这里等待被消费
  └── monitor.api          ← 消息在这里等待被消费
  ↓ [本章要做的事]
consumer-server（Consumer）
  ↓ 解析 payload，写入对应 ClickHouse 表
ClickHouse
  ├── error_logs           ← 第 13 章已建好
  ├── performance_logs     ← 第 13 章已建好
  ├── behavior_logs        ← 第 13 章已建好
  └── api_logs             ← 第 13 章已建好
```

**本章任务**：在第 14 章的基础上，新建一个独立的 `consumer-server` 应用，实现 Kafka Consumer，把 Kafka 中等待的消息取出来，写进 ClickHouse。

---

## 15.2 Kafka 消费模型核心概念

> 📖 **术语：Consumer Group（消费者组）**
>
> 白话：一组"工人"共同处理同一批任务，每个任务只被一个工人处理，不会重复。
>
> 术语：Kafka 中同一个 groupId 的多个 Consumer 实例组成一个 Consumer Group。Kafka 保证每个分区（Partition）的消息只被 Group 内的一个 Consumer 消费，从而实现消息不重复消费。

> 📖 **术语：Offset（消费偏移量）**
>
> 白话：Kafka 给每条消息编了序号（第 1 条、第 2 条……），Consumer 消费到哪里，就记下这个序号，下次从这里接着消费。这个"记到哪里了"就叫 Offset。
>
> 术语：Offset 是每个分区内消息的递增编号。Consumer Group 会定期向 Kafka 提交（commit）自己消费到的 Offset，这样即使 Consumer 重启，也能从上次中断的地方继续，不会丢消息也不会重复消费。

> 🏗️ **架构思考：为什么要有 Consumer Group？**
>
> **问题**：如果流量突增，单个 Consumer 处理速度跟不上 Kafka 的消息堆积速度，怎么办？
>
> **答案**：水平扩展——启动多个相同 groupId 的 Consumer 实例，Kafka 自动把各个分区分配给不同的实例，多个实例并行处理。
>
> 本课程只运行一个 Consumer 实例，但 groupId 的设计使得未来扩容时只需要多启动几个进程，代码不需要任何修改。

---

### Kafka UI 查看当前状态

在开始写代码前，先打开 Kafka UI（http://localhost:8081）确认消息状态：

1. 左侧导航点 **Topics**，确认能看到四个 Topic（有时需要先用 SDK 发一条消息才会出现）
2. 点击 `monitor.error`，进入 **Messages** 标签，能看到第 14 章测试时写入的原始 JSON 消息
3. 点击 **Consumers** 标签，此时应该是空的——因为我们还没有 Consumer

看完之后，就知道第 15 章结束后这里应该多出一个消费者，且 Lag（消息积压量）应该接近 0。

---

## 15.3 新建 consumer-server 项目

### 项目结构设计

> 🏗️ **架构思考：为什么 consumer-server 要和 dsn-server 分开？**
>
> 完全可以把 Consumer 代码直接加进 dsn-server。但分开有明确的好处：
>
> - **职责分离**：dsn-server 只负责"快速接收上报"，consumer-server 只负责"消费并写入"，互不干扰
> - **独立扩容**：上报量突增时只需扩 dsn-server；ClickHouse 写入有瓶颈时只需扩 consumer-server
> - **故障隔离**：consumer-server 宕机不影响 dsn-server 继续接收——消息在 Kafka 里积压，等 consumer-server 恢复后补消费即可
>
> 这正是 Kafka 作为"缓冲区"的核心价值：生产者和消费者**解耦**，各自独立运行。

在 `apps/backend/` 下新建 `consumer-server/` 目录，最终结构如下：

```
apps/backend/consumer-server/
├── src/
│   ├── main.ts                              应用入口（端口 3001）
│   ├── app.module.ts                        根模块
│   ├── health.controller.ts                 GET /health（健康检查）
│   ├── clickhouse/
│   │   ├── clickhouse.module.ts             @Global() ClickHouse 全局模块
│   │   └── clickhouse.service.ts            @clickhouse/client 封装
│   └── consumer/
│       ├── consumer.module.ts
│       ├── consumer.service.ts              Kafka Consumer 主逻辑
│       └── handlers/
│           ├── event.types.ts               Payload 类型定义 + 工具函数
│           ├── error.handler.ts             monitor.error → error_logs
│           ├── performance.handler.ts       monitor.performance → performance_logs
│           ├── behavior.handler.ts          monitor.behavior → behavior_logs
│           └── api.handler.ts               monitor.api → api_logs
├── .env.example
├── nest-cli.json
└── package.json
```

---

### package.json

```json
{
  "name": "@monitor/consumer-server",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "nest start --watch",
    "build": "nest build",
    "start": "node dist/main.js"
  },
  "dependencies": {
    "@clickhouse/client": "^1.8.0",
    "@nestjs/common": "^10.4.0",
    "@nestjs/core": "^10.4.0",
    "@nestjs/platform-express": "^10.4.0",
    "kafkajs": "^2.2.4",
    "reflect-metadata": "^0.2.1",
    "rxjs": "^7.8.0"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.4.0",
    "@nestjs/schematics": "^10.1.0",
    "@types/express": "^5.0.0",
    "@types/node": "^20.0.0"
  }
}
```

同时在根目录 `package.json` 的 `scripts` 中补充启动命令：

```json
"consumer-server": "pnpm --filter @monitor/consumer-server dev"
```

---

### 环境变量（.env.example）

将 `.env.example` 复制为 `.env`：

```bash
cp apps/backend/consumer-server/.env.example apps/backend/consumer-server/.env
```

```bash
# Kafka Broker 地址（本地开发用宿主机端口 9094）
KAFKA_BROKERS=localhost:9094

# Consumer Group ID（Kafka UI 中用于标识消费者组）
KAFKA_GROUP_ID=monitor-consumer-group

# ClickHouse 连接配置（对应 docker-compose.yml）
CLICKHOUSE_HOST=http://localhost:8123
CLICKHOUSE_DATABASE=monitor
CLICKHOUSE_USER=monitor
CLICKHOUSE_PASSWORD=123456

# 服务端口（与 dsn-server 的 3000 区分开）
PORT=3001
```

---

## 15.4 封装 ClickHouse 写入服务

### ClickhouseService

这是本章最重要的基础设施代码。先看实际的使用方式，再看封装：

```typescript
// 使用示例（error.handler.ts 中）
await this.clickhouse.insert('error_logs', [
  {
    trace_id: 'uuid...',
    app_id: 'vue3-demo',
    error_type: 'js_error',
    message: 'Cannot read properties of undefined',
    stack: 'TypeError: Cannot read...',
    filename: 'http://localhost:5173/src/App.vue',
    lineno: 42,
    colno: 15,
    created_at: '2024-05-07 12:00:00',
    // ... 其他公共字段
  }
])
```

`insert` 方法接收表名和行数组，内部通过 `@clickhouse/client` 的 HTTP API 写入。

> 📖 **术语：JSONEachRow 格式**
>
> 白话：把每一行数据写成一个 JSON 对象，多行用换行符分隔。`@clickhouse/client` 在发 HTTP 请求时会自动把 JS 对象数组转换成这种格式。
>
> 术语：这是 ClickHouse HTTP 接口的一种数据传输格式（`FORMAT JSONEachRow`），每行数据是一个完整的 JSON 对象，ClickHouse 按字段名匹配列名进行写入。

**完整实现**（`src/clickhouse/clickhouse.service.ts`）：

```typescript
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common'
import { createClient, ClickHouseClient } from '@clickhouse/client'

@Injectable()
export class ClickhouseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ClickhouseService.name)
  private client!: ClickHouseClient

  onModuleInit() {
    this.client = createClient({
      host: process.env.CLICKHOUSE_HOST ?? 'http://localhost:8123',
      database: process.env.CLICKHOUSE_DATABASE ?? 'monitor',
      username: process.env.CLICKHOUSE_USER ?? 'monitor',
      password: process.env.CLICKHOUSE_PASSWORD ?? '123456',
    })
    this.logger.log(`ClickHouse 客户端已初始化 → ${process.env.CLICKHOUSE_HOST}`)
  }

  async onModuleDestroy() {
    await this.client.close()
  }

  async insert<T extends Record<string, unknown>>(
    table: string,
    values: T[],
  ): Promise<void> {
    await this.client.insert({
      table,
      values,
      format: 'JSONEachRow',
    })
  }
}
```

> ⚠️ **课程深度说明**：`@clickhouse/client` 还支持 `query`（查询）、`command`（DDL 命令）、流式插入（`stream`）等 API。
> 本课程只用到 `insert`，其余用法可参考 [官方文档](https://github.com/ClickHouse/clickhouse-js)。

---

### ClickHouse DateTime 字段处理

ClickHouse 的 `DateTime` 类型（精确到秒）接受以下格式的字符串：`'YYYY-MM-DD HH:MM:SS'`（UTC 时间）。

SDK 上报的 `timestamp` 是**毫秒级** Unix 时间戳（如 `1715000000000`），需要转换：

```typescript
// src/consumer/handlers/event.types.ts
export function toClickHouseDateTime(timestampMs: number): string {
  return new Date(timestampMs)
    .toISOString()       // '2024-05-07T12:00:00.000Z'
    .replace('T', ' ')   // '2024-05-07 12:00:00.000Z'
    .slice(0, 19)        // '2024-05-07 12:00:00'  ← ClickHouse 接受的格式
}
```

---

## 15.5 Kafka Consumer 实现

### 整体流程

```
consumer.service.ts
  onModuleInit()
    │
    ├─ 创建 kafka.consumer({ groupId })
    ├─ consumer.connect()
    ├─ consumer.subscribe({ topics: [4个 topic], fromBeginning: false })
    └─ consumer.run({
         eachMessage: async ({ topic, message }) => {
           // 1. 把 message.value（Buffer）转成字符串，JSON.parse 成 JS 对象
           // 2. 按 topic 路由到对应 Handler
           // 3. Handler 解析 payload，写入 ClickHouse
         }
       })
  
  onModuleDestroy()
    └─ consumer.disconnect()
```

**完整实现**（`src/consumer/consumer.service.ts`）：

```typescript
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common'
import { Kafka, Consumer, logLevel } from 'kafkajs'
import { MonitorEventMessage } from './handlers/event.types'
import { ErrorHandlerService } from './handlers/error.handler'
import { PerformanceHandlerService } from './handlers/performance.handler'
import { BehaviorHandlerService } from './handlers/behavior.handler'
import { ApiHandlerService } from './handlers/api.handler'

@Injectable()
export class ConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ConsumerService.name)
  private readonly kafka: Kafka
  private consumer!: Consumer

  private readonly topics = [
    'monitor.error',
    'monitor.performance',
    'monitor.behavior',
    'monitor.api',
  ]

  constructor(
    private readonly errorHandler: ErrorHandlerService,
    private readonly performanceHandler: PerformanceHandlerService,
    private readonly behaviorHandler: BehaviorHandlerService,
    private readonly apiHandler: ApiHandlerService,
  ) {
    const brokers = (process.env.KAFKA_BROKERS ?? 'localhost:9094')
      .split(',').map((b) => b.trim())
    this.kafka = new Kafka({ clientId: 'consumer-server', brokers, logLevel: logLevel.ERROR })
  }

  async onModuleInit() {
    const groupId = process.env.KAFKA_GROUP_ID ?? 'monitor-consumer-group'
    this.consumer = this.kafka.consumer({ groupId })

    await this.consumer.connect()
    this.logger.log(`Kafka Consumer 连接成功 [groupId: ${groupId}]`)

    await this.consumer.subscribe({ topics: this.topics, fromBeginning: false })
    this.logger.log(`已订阅 Topics：${this.topics.join(', ')}`)

    // void：有意不 await，这是长期运行的后台任务
    void this.consumer.run({
      eachMessage: async ({ topic, message }) => {
        if (!message.value) return
        try {
          const event = JSON.parse(message.value.toString()) as MonitorEventMessage
          await this.dispatch(topic, event)
        } catch (err) {
          this.logger.error(`消息处理失败 [topic: ${topic}]`, err)
        }
      },
    })
  }

  async onModuleDestroy() {
    await this.consumer.disconnect()
  }

  private async dispatch(topic: string, event: MonitorEventMessage): Promise<void> {
    switch (topic) {
      case 'monitor.error':       await this.errorHandler.handle(event); break
      case 'monitor.performance': await this.performanceHandler.handle(event); break
      case 'monitor.behavior':    await this.behaviorHandler.handle(event); break
      case 'monitor.api':         await this.apiHandler.handle(event); break
    }
  }
}
```

> ⚠️ **课程深度说明**：
> NestJS 提供了 `@nestjs/microservices` 包，支持用 `@MessagePattern('monitor.error')` 装饰器的方式声明式地处理 Kafka 消息，更"NestJS 化"。本课程与第 14 章保持一致，使用 kafkajs 原生 Consumer API，便于理解底层机制。感兴趣可查阅 [NestJS Microservices 文档](https://docs.nestjs.com/microservices/kafka)。

---

## 15.6 四个 Topic 的 Handler 实现

每个 Handler 都只做一件事：**从 MonitorEventMessage 中提取字段 → 映射为 ClickHouse 表的列 → 调用 `clickhouse.insert()`**。

---

### 公共结构：MonitorEventMessage

每条 Kafka 消息的 JSON 反序列化后是这个结构（与 dsn-server 写入时完全一致）：

```typescript
interface MonitorEventMessage {
  traceId: string        // UUID，唯一追踪 ID
  appId: string          // 项目标识
  userId?: string        // 用户标识（可能为 undefined）
  type: 'error' | 'performance' | 'behavior' | 'api'
  payload: unknown       // 具体内容，由 type 决定，需要 Handler 做类型收窄
  timestamp: number      // 客户端毫秒时间戳
  page: string           // 页面 URL
  ua: string             // User-Agent
}
```

公共字段（四张表都有）的映射：

| MonitorEventMessage 字段 | ClickHouse 列 | 备注 |
|---|---|---|
| traceId | trace_id | 消息唯一 ID |
| appId | app_id | 项目标识 |
| userId ?? '' | user_id | 未设置时存空字符串 |
| page | page | 页面 URL |
| ua | ua | User-Agent |
| toClickHouseDateTime(timestamp) | created_at | 毫秒→字符串转换 |

---

### 15.6.1 error.handler.ts：错误消息处理

`payload` 是错误事件的**判别联合类型**，通过 `subType` 字段区分来源：

```typescript
type ErrorPayload =
  | JsErrorPayload       // subType: 'js'
  | ResourceErrorPayload // subType: 'resource'
  | PromiseErrorPayload  // subType: 'promise'
  | FrameworkErrorPayload // subType: 'vue' | 'react'
```

用 `switch-case` 做类型收窄，为每种子类型生成不同的字段值：

```
subType: 'js'
  → error_type: 'js_error'
  → message: payload.message
  → stack: payload.stack
  → filename: payload.filename（脚本 URL）
  → lineno: payload.lineno
  → colno: payload.colno

subType: 'resource'
  → error_type: 'resource_error'
  → message: 'Failed to load IMG: https://...'（构造描述）
  → stack: ''
  → filename: payload.src（资源 URL）
  → lineno: 0, colno: 0

subType: 'promise'
  → error_type: 'promise_error'
  → message: payload.message
  → stack: payload.stack
  → filename: '', lineno: 0, colno: 0

subType: 'vue' | 'react'
  → error_type: 'framework_error'
  → message: payload.message
  → stack: payload.stack（+ componentInfo 追加）
  → filename: '', lineno: 0, colno: 0
```

---

### 15.6.2 performance.handler.ts：性能消息处理

性能数据也是联合类型，两种子类型的数据结构差异较大：

**`web-vital`（每条只有一个指标值）**：

SDK 通过 web-vitals 库异步采集，每个指标就绪时单独上报一条消息。同一页面可能产生最多 5 条 web-vital 事件（FCP / LCP / CLS / INP / TTFB）。

```
metric: 'FCP'  → fcp = value,  lcp = 0, fid = 0, cls = 0, ttfb = 0, load_time = 0
metric: 'LCP'  → lcp = value,  其他为 0
metric: 'INP'  → fid = value,  其他为 0  ← INP 映射到 fid 列（INP 是 FID 的继任者）
metric: 'CLS'  → cls = value,  其他为 0
metric: 'TTFB' → ttfb = value, 其他为 0
```

**`navigation-timing`（页面加载完成后上报一次，包含完整时序数据）**：

```
ttfb = payload.ttfb
load_time = payload.loadTime
其他指标 = 0
```

> 💡 **为什么每条性能消息只有部分字段有值，其他为 0？**
>
> ClickHouse 的 Float64 列无法存 NULL（MergeTree 引擎默认不支持 NULL），所以用 0 表示"本次上报未包含此指标"。
> 查询时用 `WHERE fcp > 0` 可以过滤掉无效数据；在第 16 章聚合查询时，会使用 `avgIf(fcp, fcp > 0)` 只对有值的行计算均值。

---

### 15.6.3 behavior.handler.ts：行为消息处理

行为事件的特有字段较简单，主要是 `action_type`、`element`、`extra`：

```
subType: 'pv'
  → action_type: 'page_view'
  → element: ''
  → extra: JSON.stringify({ referrer: payload.referrer })

subType: 'click'
  → action_type: 'click'
  → element: payload.elementPath   ← CSS 选择器路径（如 div#app > button.login-btn）
  → extra: JSON.stringify({ text: payload.elementText })

subType: 'route-change'
  → action_type: 'route_change'
  → element: ''
  → extra: JSON.stringify({ from: payload.from, to: payload.to })

subType: 'custom'
  → action_type: 'custom'
  → element: ''
  → extra: JSON.stringify(payload.extra ?? {})
```

`extra` 列设计为 JSON 字符串，存储各子类型的差异化信息，保持表结构稳定的同时支持灵活扩展。

---

### 15.6.4 api.handler.ts：API 消息处理

API 数据结构是四种类型中最简单的，字段几乎可以直接映射：

```typescript
{
  method: payload.method.toUpperCase(),  // 'get' → 'GET'
  url: payload.url,
  status: payload.status,
  duration: payload.duration,
  request_size: 0,   // SDK 不采集，填 0
  response_size: -1, // SDK 不采集，-1 表示"未知"
  success: payload.success,
}
```

---

## 15.7 全链路追踪：一条消息从 Kafka 到 ClickHouse 的完整旅程

> 第 14 章追踪到了"消息躺在 Kafka 里"。本节从 Kafka 接续，把剩下的链路补全。

---

### 第五步接续（第 14 章结束处）

此时消息在 Kafka 的 `monitor.error` Topic 中，等待 consumer-server 来消费。

---

### 第六步：ConsumerService 轮询 Kafka，收到新消息

`consumer.run()` 启动了一个持续运行的轮询循环（内部通过长轮询实现）。

当 `monitor.error` 有新消息时，kafkajs 触发 `eachMessage` 回调：

```
Kafka Topic: monitor.error
  │  (Consumer Group: monitor-consumer-group 收到通知：有新消息)
  ▼
eachMessage({ topic: 'monitor.error', partition: 0, message: {...} })
  │
  ▼
message.value → Buffer（二进制数据）
JSON.parse(message.value.toString())
  │
  ▼
MonitorEventMessage = {
  traceId: 'a3f2-...',
  appId: 'vue3-demo',
  type: 'error',
  payload: { subType: 'js', message: 'Cannot read...', ... },
  timestamp: 1715000000000,
  page: 'http://localhost:5173/',
  ua: 'Mozilla/5.0 ...'
}
```

---

### 第七步：dispatch 按 topic 路由到 ErrorHandlerService

```
dispatch('monitor.error', event)
  │  switch (topic)
  ▼  case 'monitor.error': 
errorHandler.handle(event)
```

---

### 第八步：ErrorHandlerService 解析 payload，映射为 ClickHouse 行

```typescript
// payload.subType = 'js' → 走 case 'js' 分支
const mapped = {
  error_type: 'js_error',
  message: 'Cannot read properties of undefined',
  stack: 'TypeError: Cannot read...\n  at App.vue:42',
  filename: 'http://localhost:5173/src/App.vue',
  lineno: 42,
  colno: 15,
}
```

---

### 第九步：ClickhouseService.insert() 写入数据库

```typescript
await clickhouse.insert('error_logs', [{
  trace_id: 'a3f2-...',
  app_id: 'vue3-demo',
  user_id: 'user_123',
  page: 'http://localhost:5173/',
  ua: 'Mozilla/5.0 ...',
  error_type: 'js_error',
  message: 'Cannot read properties of undefined',
  stack: 'TypeError: ...',
  filename: 'http://localhost:5173/src/App.vue',
  lineno: 42,
  colno: 15,
  created_at: '2024-05-07 19:33:20',  // toClickHouseDateTime(1715000000000)
}])
```

`@clickhouse/client` 内部：
1. 将 JS 对象数组序列化为 JSONEachRow 格式
2. 发起 HTTP POST 请求到 `http://localhost:8123/?database=monitor`
3. ClickHouse 解析请求体，写入 `error_logs` 表
4. 返回 HTTP 200，Promise resolved

---

### 第十步：Consumer 自动提交 Offset

消息处理成功后，kafkajs 自动向 Kafka 提交当前消费进度（Offset + 1）。

下次 Consumer 重启时，会从这个 Offset 继续消费，不会重复处理已成功写入的消息。

---

### 完整链路总览

```
浏览器 SDK
  │  fetch POST { events: [...] }
  ▼
dsn-server（端口 3000）
  │  ThrottlerGuard + ValidationPipe
  │  ReportService.handleReport()
  │  KafkaService.send('monitor.error', event)
  ▼
Kafka（localhost:9094）
  │  Topic: monitor.error
  │  消息以 JSON 字符串持久化存储
  ▼
consumer-server（端口 3001）
  │  ConsumerService.eachMessage()
  │  JSON.parse(message.value) → MonitorEventMessage
  │  dispatch() → ErrorHandlerService.handle()
  │  mapPayload() → ClickHouse 行数据
  ▼
ClickhouseService.insert('error_logs', [...])
  │  HTTP POST → ClickHouse localhost:8123
  ▼
ClickHouse error_logs 表
  （可在 DataGrip 中查询验证）
```

> 📖 **Kafka 在整条链路中的核心价值**
>
> 对比没有 Kafka 的方案：`dsn-server` 直接写 ClickHouse。
>
> 问题：上报流量洪峰时，大量并发写入会压垮 ClickHouse，同时 dsn-server 的 `/report` 接口会因等待 ClickHouse 而响应变慢，影响 SDK 的上报成功率。
>
> 有了 Kafka：
> - `dsn-server` 只需把消息写进 Kafka（微秒级），立刻返回成功响应
> - `consumer-server` 按 ClickHouse 能承受的速度稳定写入
> - 洪峰期间消息在 Kafka 里"排队"，等峰值过去后 Consumer 慢慢追完

---

## 15.8 安装依赖并启动服务

### 安装依赖

```bash
pnpm install
```

### 配置环境变量

```bash
cp apps/backend/consumer-server/.env.example apps/backend/consumer-server/.env
```

### 启动顺序

同时打开三个终端，按顺序执行：

**终端 1：确保基础设施运行中**

```bash
pnpm infra:start

# 确认 Kafka 和 ClickHouse 已启动：
docker ps
# 应看到 kafka、clickhouse、postgres、kafka-ui 四个容器
```

**终端 2：启动 dsn-server（数据生产者）**

```bash
pnpm dsn-server
# 看到 [DSN Server] 运行中 → http://localhost:3000 表示启动成功
```

**终端 3：启动 consumer-server（数据消费者）**

```bash
pnpm consumer-server
# 看到以下日志表示启动成功：
# [Consumer Server] 运行中 → http://localhost:3001
# Kafka Consumer 连接成功 [groupId: monitor-consumer-group]
# 已订阅 Topics：monitor.error, monitor.performance, monitor.behavior, monitor.api
```

---

## 15.9 用 Kafka UI 查看消费进度

启动 consumer-server 后，打开 Kafka UI（http://localhost:8081）：

### 查看 Consumer Group

1. 左侧点 **Consumers**
2. 能看到 `monitor-consumer-group` 已出现
3. 点击进入，查看每个 Topic 的消费状态：
   - **Lag**（积压）：当前未消费的消息数量。Lag = 0 表示 Consumer 已追上最新消息
   - **Committed Offset**：已成功处理并提交的消息偏移量

### 查看 Topic 消息流通

在 **Topics** 页面进入任意 Topic，点 **Messages** 标签：
- 可以看到消息被消费后状态更新
- 配合 DataGrip 查询 ClickHouse，验证数据已写入

---

## 15.10 联调验证

### 第一步：触发一条 JS 错误

在 vue3-demo 中（确保 dsn-server 已启动），打开 `http://localhost:5173`，在浏览器控制台执行：

```javascript
// 制造一个 JS 错误
window.notExistObj.doSomething()
// → Uncaught TypeError: Cannot read properties of undefined (reading 'doSomething')
```

SDK 会在 5 秒内自动批量上报。

### 第二步：观察 consumer-server 日志

```
收到消息 [topic: monitor.error, partition: 0, traceId: a3f2-...]
error_logs 写入成功 [traceId: a3f2-..., type: js_error]
```

### 第三步：DataGrip 查询验证

在 DataGrip 中连接 ClickHouse（localhost:8123），运行：

```sql
-- 查看最新写入的错误（按时间倒序）
SELECT trace_id, app_id, error_type, message, filename, lineno, created_at
FROM monitor.error_logs
ORDER BY created_at DESC
LIMIT 10;
```

能看到刚刚制造的 `js_error` 记录，说明整条链路已打通。

```sql
-- 验证四张表都有数据
SELECT
  'error_logs'      AS table_name, count() AS rows FROM monitor.error_logs UNION ALL
  SELECT 'performance_logs', count() FROM monitor.performance_logs UNION ALL
  SELECT 'behavior_logs',    count() FROM monitor.behavior_logs UNION ALL
  SELECT 'api_logs',         count() FROM monitor.api_logs;
```

---

## 本章小结

本章完成了整条数据链路的最后一段：

| 组件 | 职责 | 状态 |
|---|---|---|
| SDK | 浏览器端采集 + 批量上报 | ✅ 第 1-11 章 |
| docker 基础设施 | Kafka + ClickHouse + PostgreSQL | ✅ 第 12 章 |
| ClickHouse 表结构 | 四张表 | ✅ 第 13 章 |
| dsn-server | 接收上报 → 写入 Kafka | ✅ 第 14 章 |
| **consumer-server** | **消费 Kafka → 写入 ClickHouse** | **✅ 本章** |

完整数据流：

```
浏览器 SDK → dsn-server → Kafka → consumer-server → ClickHouse
```

**下一章（第 16 章）**：在 `monitor-server` 中实现监控平台的后端 API，从 ClickHouse 聚合查询数据，为前端看板提供接口。

---

## 扩展方向（供感兴趣的同学探索）

- **死信队列（DLQ）**：消息处理失败时，发送到单独的"死信 Topic"，人工处理后重新消费，避免直接丢弃
- **批量消费优化**：当前实现是每条消息立刻写入一次 ClickHouse。高吞吐场景下，可以在 Consumer 侧维护一个内存缓冲区（如 100 条或 1 秒），批量写入，减少 HTTP 请求次数
- **`@nestjs/microservices` Kafka 适配**：用装饰器 `@MessagePattern('monitor.error')` 声明消息处理方法，是更 NestJS 化的写法，可参考 [NestJS Microservices 文档](https://docs.nestjs.com/microservices/kafka)
- **Kafka Consumer Lag 告警**：当 Lag 持续增长超过阈值，说明 Consumer 处理速度跟不上，需要告警或扩容
