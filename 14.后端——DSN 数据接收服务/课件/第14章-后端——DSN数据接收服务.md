# 第 14 章：后端——DSN 数据接收服务

> **目标**：用 NestJS 创建 `/report` 接口，接收 SDK 上报的监控数据，并通过 Kafka 转发给下游消费者
>
> ❗ **课程深度说明**：本章不展开 NestJS 全量 API，假设同学已有 NestJS 基础（或已学完专项 NestJS 课程）。重点是理解**整条数据链路如何打通**：浏览器 SDK → HTTP 接口 → Kafka，以及 Kafka 在这里解决了什么问题。

---

## ⚠️ 本章对 SDK 上报格式的重要变更

> 本节务必在开始写代码前认真阅读，否则会遇到 400 / CORS 等运行时错误。

从本章起，SDK 的上报方式有 **两处关键变化**，与第 11–13 章使用的 `collect-server` 完全不同。

### 变更 1：接口地址和端口

| | 第 11–13 章（collect-server） | 第 14 章（dsn-server） |
|---|---|---|
| 端口 | 3001 | 3000 |
| 路径 | `/collect` | `/report` |
| DSN 示例 | `http://localhost:3001/collect` | `http://localhost:3000/report` |

**操作**：在 demo 项目的 `main.ts` / `main.tsx` 中，把 SDK 初始化的 `dsn` 改为 `http://localhost:3000/report`。

### 变更 2：请求体（Request Body）格式

这是本章最重要的变化，也是常见 400 错误的根源。

**旧格式（collect-server 时代）**：SDK fetch 直接发送一个 JSON 裸数组：
```json
[
  { "traceId": "...", "type": "error", ... },
  { "traceId": "...", "type": "behavior", ... }
]
```

**新格式（dsn-server，本章起）**：SDK fetch 发送一个带 `events` 字段的 JSON 对象：
```json
{
  "events": [
    { "traceId": "...", "type": "error", ... },
    { "traceId": "...", "type": "behavior", ... }
  ]
}
```

**为什么要改？**

NestJS 的 ValidationPipe 使用 class-transformer 把请求体反序列化成 DTO 类实例。class-transformer 不能直接把裸数组映射成带 `events` 字段的 `ReportBatchDto`，因此服务端必须接收一个"有字段名的对象"。

裸数组 → 无法映射到 `ReportBatchDto.events` → ValidationPipe 报 400  
带 `events` 的对象 → 正确映射 → 通过校验 ✅

**代码层面的改动**：在 `packages/core/src/transport.ts` 的 `_sendFetch` 中，`body` 从：
```typescript
body: JSON.stringify(batch)          // 旧：裸数组
```
改为：
```typescript
body: JSON.stringify({ events: batch })  // 新：包裹成对象
```
`_sendBeacon` 和 `_fallbackFetch` 同理。

### 变更 3：fetch 需显式设置 credentials: 'omit'

浏览器的 `fetch` + `keepalive: true` 在部分 Chrome 版本下会被标记为 `credentials: include`（携带 cookie），而服务端 CORS 配置了 `Access-Control-Allow-Origin: *` 时，浏览器会拒绝这类携带凭证的跨域响应。

监控上报完全不需要 cookie，在 fetch 调用中显式加一行：
```typescript
credentials: 'omit'   // 告诉浏览器：这个请求不要带任何凭证
```
这样 `origin: '*'` 就能正常工作，CORS 预检也会通过。

---

---

## 本章课程元信息

```json
{
  "chapter": 14,
  "title": "后端——DSN 数据接收服务",
  "duration": "约 90 分钟",
  "skills": [
    "NestJS Module/Controller/Service/DTO",
    "class-validator 装饰器校验",
    "@nestjs/throttler 速率限制",
    "kafkajs Producer",
    "Kafka Topic / Producer 基本使用",
    "NestJS OnModuleInit / OnModuleDestroy 生命周期",
    "CORS 跨域配置",
    "ValidationPipe whitelist/transform"
  ],
  "output": "apps/backend/dsn-server 完整可运行，SDK 上报数据可在 Kafka UI 中看到消息；理解从浏览器到 Kafka 的完整数据链路"
}
```

---

## 14.1 先理清楚我们在做什么

在正式写代码之前，先看清楚这一章在整个数据链路中处于哪个位置：

```
浏览器 SDK
  │
  │  POST /report（批量 JSON）
  ▼
dsn-server（NestJS，本章实现）
  │
  │  Kafka Producer.send()
  ▼
Kafka（Docker 容器，第 12 章启动）
  │
  │  [下一章] Kafka Consumer
  ▼
ClickHouse（Docker 容器，第 13 章建表）
```

**本章只做两件事**：
1. 接收 SDK 发来的 HTTP 请求，校验数据格式
2. 把数据写进 Kafka

从 Kafka 读出来写入 ClickHouse 是第 15 章的任务。

---

## 14.2 Kafka 是什么，为什么要用它

> 📖 **术语：消息队列（Message Queue）**
> 白话理解：快递中转站。你往里面放包裹（消息），它帮你暂存；下游人员按自己的节奏来取，不管上游有多快，下游不会被冲垮。

### 没有 Kafka 会怎样

假设用户量大时，SDK 每秒上报 10000 条数据，如果 dsn-server 直接往 ClickHouse 写：

```
10000 条/秒
  ↓ 直接写 ClickHouse
ClickHouse 最多处理 3000 条/秒 → 队列积压 → 内存溢出 → 服务崩溃
```

大量写入会直接把数据库打垮，用户上报数据丢失。

### 有 Kafka 之后

```
10000 条/秒
  ↓ 写入 Kafka（毫秒级，Kafka 专门为高吞吐设计）
Kafka 暂存
  ↓ Consumer 按 ClickHouse 能处理的速度来消费
ClickHouse 稳定写入 3000 条/秒
```

Kafka 扮演"缓冲垫"角色，让生产速度和消费速度解耦。

### Kafka 三个核心概念

> 📖 **术语：Topic（话题/频道）**
> 白话：Kafka 里的消息分类存放的"频道"。就像电视台有新闻频道、体育频道，我们有 `monitor.error` 频道、`monitor.performance` 频道。

> 📖 **术语：Producer（生产者）**
> 白话：往 Kafka 里放消息的那一方。本章的 dsn-server 就是 Producer。

> 📖 **术语：Consumer（消费者）**
> 白话：从 Kafka 里取消息处理的那一方。第 15 章写的 Kafka 消费者负责把消息写入 ClickHouse。

```
Producer（dsn-server）
  │ 发消息到
  ▼
Kafka Broker
  ├── Topic: monitor.error        ← 存放错误类事件
  ├── Topic: monitor.performance  ← 存放性能类事件
  ├── Topic: monitor.behavior     ← 存放行为类事件
  └── Topic: monitor.api          ← 存放 API 请求类事件
  │ 消费消息
  ▼
Consumer（第 15 章实现）
  │ 写入
  ▼
ClickHouse
```

我们按 `type` 字段分成 4 个 Topic，而不是所有数据放一个 Topic，好处是：
- 下游可以针对不同类型的数据做不同的消费逻辑
- 后期可以独立扩容（比如错误数据量大，单独给 error Topic 加更多 Consumer）

> 🏗️ **架构思考**
>
> **为什么 dsn-server 不直接写 ClickHouse？**
>
> 1. **解耦**：DSN 接收与 ClickHouse 写入互不影响。ClickHouse 维护重启时，dsn-server 照常接收，消息在 Kafka 里等着
> 2. **削峰填谷**：流量洪峰时，Kafka 先扛着，不让 ClickHouse 被直接冲垮
> 3. **可重放**：Kafka 消息默认保留 24 小时（开发配置），出了问题可以重新消费
>
> **备选方案**：直接写 ClickHouse（适合极小项目，省去 Kafka 复杂度），Redis Stream（轻量级，但生态不如 Kafka），RabbitMQ（适合任务队列，不适合流式数据）

⚠️ **课程深度说明**：Kafka 还有分区（Partition）、副本（Replica）、消费者组（Consumer Group）等高级概念，这些是生产环境保证高可用和扩展性用的。本课程只用单节点单分区，实现数据流通即可，有兴趣深入可以查阅 Kafka 官方文档。

---

## 14.3 项目结构预览

本章完成后，`apps/backend/dsn-server` 的目录结构如下：

```
apps/backend/dsn-server/
├── src/
│   ├── main.ts                     ← 应用入口（启动 + CORS + 全局校验）
│   ├── app.module.ts               ← 根模块（组织所有子模块）
│   ├── report/
│   │   ├── report.module.ts        ← 上报模块
│   │   ├── report.controller.ts    ← POST /report 接口定义
│   │   ├── report.service.ts       ← 业务逻辑（appId 校验 + 写 Kafka）
│   │   └── dto/
│   │       └── report-event.dto.ts ← 请求体数据结构定义
│   └── kafka/
│       ├── kafka.module.ts         ← Kafka 全局模块
│       └── kafka.service.ts        ← Kafka Producer 封装
├── .env.example                    ← 环境变量模板
├── nest-cli.json                   ← NestJS CLI 构建配置
├── package.json
└── tsconfig.json
```

---

## 14.4 新增依赖

在 `apps/backend/dsn-server/package.json` 中添加所需依赖：

```json
{
  "dependencies": {
    "@nestjs/common": "^10.4.0",
    "@nestjs/core": "^10.4.0",
    "@nestjs/platform-express": "^10.4.0",
    "@nestjs/throttler": "^6.2.0",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.0",
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

- `kafkajs`：Node.js 的 Kafka 客户端库，用于连接 Kafka 并发送消息
- `class-validator` + `class-transformer`：NestJS 的参数校验组合，配合 DTO 使用
- `@nestjs/throttler`：速率限制，防止接口被刷

执行安装：

```bash
# 在项目根目录执行，pnpm 会自动找到 dsn-server 子包
pnpm install
```

---

## 14.5 环境变量配置

在 `apps/backend/dsn-server/` 下新建 `.env.example`，再复制为 `.env`：

```bash
cp apps/backend/dsn-server/.env.example apps/backend/dsn-server/.env
```

`.env` 内容：

```bash
# 服务监听端口
PORT=3000

# Kafka Broker 地址
# 宿主机访问 Docker 内的 Kafka，使用 9094 端口（第 12 章 docker-compose 配置的外部端口）
KAFKA_BROKERS=localhost:9094

# appId 白名单（逗号分隔）
# 留空 = 跳过校验（本地开发阶段推荐留空，方便用任意 appId 测试）
# 第 16 章接入 PostgreSQL 后此配置替换为数据库查询
VALID_APP_IDS=vue3-demo,react-demo
```

---

## 14.6 应用入口（main.ts）

```typescript
import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  // SDK 从浏览器跨域上报，必须开启 CORS
  // SDK 的 fetch 上报使用 credentials: 'omit'（不带 cookie），
  // 所以这里可以用通配符 '*'；若上报携带凭证则必须改为明确域名
  app.enableCors({
    origin: '*',
    methods: ['POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
  })

  // 全局校验管道：自动校验 DTO，剔除多余字段
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,   // 剔除 DTO 未声明的字段（防止注入无关数据）
      transform: true,   // 将原始请求数据转成 DTO 类实例
    }),
  )

  const port = process.env.PORT ?? 3000
  await app.listen(port)
  console.log(`[DSN Server] 运行中 → http://localhost:${port}`)
}

bootstrap()
```

> ⚠️ 注意：第一行的 `import 'reflect-metadata'` 是 NestJS 装饰器运行的前提，不能省略。

---

## 14.7 根模块（app.module.ts）

```typescript
import { Module } from '@nestjs/common'
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'
import { APP_GUARD } from '@nestjs/core'
import { KafkaModule } from './kafka/kafka.module'
import { ReportModule } from './report/report.module'

@Module({
  imports: [
    // 速率限制：10 秒内同一 IP 最多 200 次请求
    ThrottlerModule.forRoot([{ ttl: 10000, limit: 200 }]),
    KafkaModule,
    ReportModule,
  ],
  providers: [
    // 将速率限制 Guard 注册为全局，对所有路由生效
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
```

> 提示：`ThrottlerModule.forRoot` 配置的是默认阈值，可以在具体接口上用 `@Throttle()` 装饰器覆盖。

---

## 14.8 DTO 定义——请求体的"形状合同"

> 📖 **术语：DTO（Data Transfer Object，数据传输对象）**
> 白话：就是告诉框架"我期望收到的请求体长什么样"。框架会按照这个定义自动校验，字段不对就拒绝，不用自己手写 if 判断。

`src/report/dto/report-event.dto.ts`：

```typescript
import {
  IsString, IsNumber, IsIn, IsOptional,
  IsArray, ValidateNested, ArrayMinSize
} from 'class-validator'
import { Type } from 'class-transformer'

// 单条事件（与 SDK 端 MonitorEvent 接口一一对应）
export class ReportEventDto {
  @IsString()
  traceId!: string

  @IsString()
  appId!: string

  @IsOptional()
  @IsString()
  userId?: string

  @IsIn(['error', 'performance', 'behavior', 'api'])
  type!: 'error' | 'performance' | 'behavior' | 'api'

  // payload 各类型结构不同，这里用 unknown 接收原始数据
  // 下游 Consumer 再根据 type 做具体解析
  payload: unknown

  @IsNumber()
  timestamp!: number

  @IsString()
  page!: string

  @IsString()
  ua!: string
}

// 批量上报请求体（SDK 使用批量策略，单次可携带多条事件）
export class ReportBatchDto {
  @IsArray()
  @ValidateNested({ each: true })  // 对数组中每一项做 DTO 校验
  @ArrayMinSize(1)
  @Type(() => ReportEventDto)      // 告诉 class-transformer 如何实例化
  events!: ReportEventDto[]
}
```

---

## 14.9 Controller——接口入口

`src/report/report.controller.ts`：

```typescript
import { Controller, Post, Body, HttpCode, HttpStatus, Logger } from '@nestjs/common'
import { ReportService } from './report.service'
import { ReportBatchDto } from './dto/report-event.dto'

@Controller()
export class ReportController {
  private readonly logger = new Logger(ReportController.name)

  constructor(private readonly reportService: ReportService) {}

  @Post('report')
  @HttpCode(HttpStatus.OK)   // 成功时返回 200（NestJS POST 默认 201，这里改成 200）
  async report(@Body() body: ReportBatchDto) {
    this.logger.debug(`收到上报请求，事件数量: ${body.events.length}`)
    await this.reportService.handleReport(body.events)
    return { code: 0, message: 'ok', data: null }
  }
}
```

> 提示：`@Body()` + `ReportBatchDto` 这个组合配合全局 `ValidationPipe`，会自动校验请求体。校验不通过时 NestJS 会返回 400 错误，不需要手写 if 判断。

---

## 14.10 Service——业务逻辑层

`src/report/report.service.ts`：

```typescript
import { Injectable, BadRequestException, Logger } from '@nestjs/common'
import { KafkaService } from '../kafka/kafka.service'
import { ReportEventDto } from './dto/report-event.dto'

// type 字段 → Kafka Topic 名称的映射表
const TOPIC_MAP: Record<ReportEventDto['type'], string> = {
  error: 'monitor.error',
  performance: 'monitor.performance',
  behavior: 'monitor.behavior',
  api: 'monitor.api',
}

@Injectable()
export class ReportService {
  private readonly logger = new Logger(ReportService.name)
  private readonly validAppIds: Set<string>

  constructor(private readonly kafkaService: KafkaService) {
    // 从环境变量读取合法 appId 白名单
    // ⚠️ 第 16 章接入 PostgreSQL 后替换为数据库查询
    const envIds = process.env.VALID_APP_IDS ?? ''
    this.validAppIds = new Set(
      envIds.split(',').map((id) => id.trim()).filter(Boolean)
    )
  }

  async handleReport(events: ReportEventDto[]): Promise<void> {
    // 先校验所有事件的 appId
    for (const event of events) {
      this.validateAppId(event.appId)
    }

    // 并发写入 Kafka
    await Promise.all(
      events.map((event) => this.kafkaService.send(TOPIC_MAP[event.type], event))
    )

    this.logger.debug(`写入 Kafka 成功，事件数: ${events.length}`)
  }

  private validateAppId(appId: string): void {
    // 未配置白名单 → 开发模式，跳过校验
    if (this.validAppIds.size === 0) return
    if (!this.validAppIds.has(appId)) {
      throw new BadRequestException(`非法的 appId: ${appId}`)
    }
  }
}
```

---

## 14.11 Kafka Producer 封装

这是本章的核心部分，重点理解 Kafka 连接的生命周期管理。

### kafka.service.ts

```typescript
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common'
import { Kafka, Producer, Partitioners, logLevel } from 'kafkajs'

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name)
  private readonly kafka: Kafka
  private producer: Producer

  constructor() {
    const brokers = (process.env.KAFKA_BROKERS ?? 'localhost:9094')
      .split(',')
      .map((b) => b.trim())

    this.kafka = new Kafka({
      clientId: 'dsn-server',   // 客户端标识，Kafka UI 里能看到
      brokers,
      logLevel: logLevel.ERROR, // 关闭 kafkajs 的详细日志，用 NestJS Logger 替代
    })

    this.producer = this.kafka.producer({
      createPartitioner: Partitioners.LegacyPartitioner,
    })
  }

  // NestJS 模块初始化时自动调用 → 建立 Kafka 连接
  async onModuleInit() {
    try {
      await this.producer.connect()
      this.logger.log('Kafka Producer 连接成功')
    } catch (err) {
      // 连接失败不崩溃服务，打印日志提示检查 Kafka 容器
      this.logger.error('Kafka Producer 连接失败，请检查 Kafka 容器是否启动', err)
    }
  }

  // NestJS 应用关闭时自动调用 → 优雅断开连接
  async onModuleDestroy() {
    await this.producer.disconnect()
    this.logger.log('Kafka Producer 已断开')
  }

  // 向指定 Topic 发送一条消息
  async send(topic: string, message: unknown): Promise<void> {
    await this.producer.send({
      topic,
      messages: [
        { value: JSON.stringify(message) }  // 序列化为 JSON 字符串
      ],
    })
  }
}
```

### 关键点解释

**`OnModuleInit` / `OnModuleDestroy`**

> 提示：这是 NestJS 的两个生命周期钩子接口。
> - `onModuleInit()`：模块初始化完成后调用，相当于"应用启动时做的事"
> - `onModuleDestroy()`：应用准备关闭时调用，相当于"应用关闭前的清理"
>
> 用这两个钩子管理 Kafka 连接，能保证：
> - 服务启动时自动建立连接，不用手动调用
> - 服务关闭时（Ctrl+C）优雅断开，不丢失正在发送的消息

**`Partitioners.LegacyPartitioner`**

> 提示：Kafka 消息可以根据"分区策略"决定消息存放到哪个分区。这里用 `LegacyPartitioner` 是为了与 Kafka 旧版 Java 客户端保持一致的分区行为。当前只有 1 个分区，实际影响不大，但显式声明是好习惯。

### kafka.module.ts

```typescript
import { Module, Global } from '@nestjs/common'
import { KafkaService } from './kafka.service'

// @Global() 让其他模块无需 import KafkaModule，直接注入 KafkaService
@Global()
@Module({
  providers: [KafkaService],
  exports: [KafkaService],
})
export class KafkaModule {}
```

---

## 14.12 全链路追踪：一条消息从浏览器到 Kafka 的完整旅程

> 这是本章最重要的一节。代码都写完了，现在逐帧拆解：**一条监控数据是如何从浏览器一步步流进 Kafka 的，每一行代码在哪个环节发挥作用。**
>
> 读完这节，你在 Kafka UI 里看到消息的那一刻，会清楚知道自己看到的是什么。

---

### 第一步：浏览器触发事件，SDK 打包数据

用户在浏览器里操作（比如页面报了一个 JS 错误），SDK 的 ErrorPlugin 捕获到之后，把它封装成一个 `MonitorEvent` 对象放进缓冲队列，等批量上报触发。

```
用户操作 → SDK 采集 → 缓冲队列
                         ↓ （5 秒定时 或 队列满 10 条）
                    SDK Transport 层
```

SDK 发出的 HTTP 请求体长这样（批量，可含多条）：

```json
{
  "events": [
    {
      "traceId": "a3f2-...",
      "appId": "vue3-demo",
      "type": "error",
      "payload": { "errorType": "js_error", "message": "Cannot read ..." },
      "timestamp": 1715000000000,
      "page": "http://localhost:5173/",
      "ua": "Mozilla/5.0 ..."
    }
  ]
}
```

**目标地址**：`POST http://localhost:3000/report`（我们在 `init({ dsn: '...' })` 里配置的）

---

### 第二步：HTTP 请求到达 dsn-server，NestJS 路由分发

请求进入 NestJS 后，经过两道"卡口"再到达 Controller：

```
HTTP POST /report
    │
    ▼
① ThrottlerGuard（全局速率限制）
    同一 IP 10 秒内超过 200 次 → 直接返回 429，请求到此为止
    没超过 → 放行
    │
    ▼
② ValidationPipe（全局数据校验）
    把请求 body 按 ReportBatchDto 定义做校验
    字段类型不对/必填项缺失 → 返回 400，请求到此为止
    校验通过 → body 变成一个 ReportBatchDto 实例
    │
    ▼
③ ReportController.report()
    拿到已校验的 body，交给 ReportService 处理
```

**相关代码位置**：
- 速率限制：`app.module.ts` → `ThrottlerModule.forRoot`
- 全局校验：`main.ts` → `app.useGlobalPipes(new ValidationPipe(...))`
- 路由方法：`report.controller.ts` → `@Post('report')`

---

### 第三步：ReportService 校验 appId，准备分发

```typescript
// report.service.ts
async handleReport(events: ReportEventDto[]): Promise<void> {
  // 3-1 校验每条事件的 appId 是否在白名单里
  for (const event of events) {
    this.validateAppId(event.appId)   // 不合法 → 抛 BadRequestException → 返回 400
  }

  // 3-2 通过校验 → 并发写入 Kafka
  await Promise.all(
    events.map((event) => this.kafkaService.send(TOPIC_MAP[event.type], event))
  )
}
```

关键在 `TOPIC_MAP`，它决定了每种事件去哪个 Topic：

```typescript
const TOPIC_MAP = {
  error:       'monitor.error',        // ← type='error' 的事件 → 这个 Topic
  performance: 'monitor.performance',  // ← type='performance' 的事件 → 这个 Topic
  behavior:    'monitor.behavior',     // ← type='behavior' 的事件 → 这个 Topic
  api:         'monitor.api',          // ← type='api' 的事件 → 这个 Topic
}
```

一批事件中可能混有多种类型，`Promise.all` 让它们同时发出，谁也不等谁。

---

### 第四步：KafkaService 发送消息——Topic 在这里被创建

```typescript
// kafka.service.ts
async send(topic: string, message: unknown): Promise<void> {
  await this.producer.send({
    topic,   // ← 比如 'monitor.error'
    messages: [
      { value: JSON.stringify(message) }   // 序列化为 JSON 字符串
    ],
  })
}
```

**`monitor.error` 这些 Topic 是在这里被"第一次使用"时自动创建的。**

> 📖 **Topic 是怎么创建的？**
>
> 我们从来没有写过"创建 Topic"的代码，Topic 是 Kafka 自动创建的。
>
> 原因在第 12 章 `docker-compose.yml` 里的这一行配置：
>
> ```yaml
> KAFKA_AUTO_CREATE_TOPICS_ENABLE: "true"
> ```
>
> 这告诉 Kafka：**当 Producer 第一次向一个不存在的 Topic 发消息时，自动帮它创建这个 Topic**。
>
> 所以整个 Topic 创建时机是：
> ```
> 第一条 type='error' 的事件上报
>   → kafkajs 调用 producer.send({ topic: 'monitor.error', ... })
>   → Kafka 发现 'monitor.error' 不存在
>   → 自动创建 Topic 'monitor.error'（1个分区，1个副本）
>   → 消息写入成功
> ```
>
> 四个 Topic 各自在第一条对应类型的消息到来时创建，不是同时出现的。

---

### 第五步：消息躺在 Kafka 里等待消费

至此，dsn-server 的工作完成了，返回 `{ code: 0 }` 给 SDK。消息现在安全地存在 Kafka 里。

此时打开 Kafka UI（http://localhost:8081）：

```
Topics
├── monitor.error        Messages: 1   ← 刚才那条错误事件
├── monitor.performance  Messages: 0   （还没有上报）
├── monitor.behavior     Messages: 0
└── monitor.api          Messages: 0
```

点进 `monitor.error` → **Messages 标签**，能看到原始 JSON：

```json
{
  "traceId": "a3f2-...",
  "appId": "vue3-demo",
  "type": "error",
  "payload": { "errorType": "js_error", "message": "Cannot read ..." },
  "timestamp": 1715000000000,
  "page": "http://localhost:5173/",
  "ua": "Mozilla/5.0 ..."
}
```

这就是第 15 章 Consumer 会拿到的原始数据。

---

### 第六步预告：第 15 章如何从 Kafka 读到 ClickHouse

本章到这里就结束了。但故事还没完——消息在 Kafka 里只是"中转站"，最终目的地是 ClickHouse。

下一章做的事情可以用一句话概括：**订阅 Topic，取出消息，按字段映射写入 ClickHouse 对应的表。**

流程如下：

```
Kafka Topics
  │  (Consumer 订阅，持续监听新消息)
  ▼
NestJS Consumer 服务（第 15 章）
  │
  ├── 收到 monitor.error 消息
  │     → 解析 payload 的 errorType / message / stack / filename 等字段
  │     → INSERT INTO error_logs (...) VALUES (...)
  │
  ├── 收到 monitor.performance 消息
  │     → 解析 payload 的 fcp / lcp / cls / ttfb 等字段
  │     → INSERT INTO performance_logs (...) VALUES (...)
  │
  ├── 收到 monitor.behavior 消息
  │     → 解析 payload 的 actionType / element / extra 等字段
  │     → INSERT INTO behavior_logs (...) VALUES (...)
  │
  └── 收到 monitor.api 消息
        → 解析 payload 的 method / url / status / duration 等字段
        → INSERT INTO api_logs (...) VALUES (...)
```

第 13 章我们建的四张 ClickHouse 表，正是为了承接这四路数据。

> 📖 **Kafka 在整个链路中的角色总结**
>
> ```
> 浏览器 SDK
>   ↓ HTTP POST（快速返回，不等数据库）
> dsn-server → Kafka（缓冲，持久化，等待消费）
>                 ↓ Consumer 按 ClickHouse 能处理的速度消费
>            ClickHouse（存储，供查询）
> ```
>
> Kafka 把"接收速度"和"写入速度"解耦开来。dsn-server 只负责收，Consumer 只负责写，两者完全独立，互不阻塞。流量洪峰时 Kafka 先扛着，Consumer 慢慢追。

---

## 14.13 启动服务

### 第一步：准备环境变量

```bash
cp apps/backend/dsn-server/.env.example apps/backend/dsn-server/.env
```

确认 `.env` 内容：

```bash
PORT=3000
KAFKA_BROKERS=localhost:9094
VALID_APP_IDS=           # 留空，跳过 appId 校验（测试方便）
```

### 第二步：确保基础设施已启动

```bash
# Kafka 必须先启动，否则 Producer 连接会失败
pnpm infra:start
```

在 Docker Desktop 中确认 `monitor-kafka` 容器状态为 `Running`。

### 第三步：启动 DSN Server

```bash
# 方式一：使用根目录封装的命令
pnpm dsn-server

# 方式二：直接进入包启动
pnpm --filter @monitor/dsn-server dev
```

正常启动后会看到：

```
[NestApplication] NestApplication dependencies initialized +0ms
[DSN Server] 运行中 → http://localhost:3000
[DSN Server] 上报端点 → POST http://localhost:3000/report
[KafkaService] Kafka Producer 连接成功
```

---

## 14.14 用 Postman 验证接口

### 测试请求

- 方法：`POST`
- URL：`http://localhost:3000/report`
- Headers：`Content-Type: application/json`
- Body（raw JSON）：

```json
{
  "events": [
    {
      "traceId": "test-trace-001",
      "appId": "vue3-demo",
      "type": "error",
      "payload": {
        "errorType": "js_error",
        "message": "Cannot read properties of undefined",
        "stack": "TypeError: ...",
        "filename": "http://localhost:5173/src/App.vue",
        "lineno": 42,
        "colno": 15
      },
      "timestamp": 1715000000000,
      "page": "http://localhost:5173/",
      "ua": "Mozilla/5.0 (Macintosh)"
    }
  ]
}
```

### 预期响应

```json
{ "code": 0, "message": "ok", "data": null }
```

### 在 Kafka UI 中确认消息到达

打开 Kafka UI：http://localhost:8081

1. 点击左侧 **Topics**
2. 找到 `monitor.error`（第一次发送时会自动创建）
3. 点击 **Messages** 标签
4. 可以看到刚刚发送的消息内容

---

## 14.15 更新 SDK 的 DSN 地址

`apps/backend/dsn-server` 启动后，需要将 demos 中的 SDK 配置从临时的 `collect-server` 切换到正式的 `dsn-server`。

### vue3-demo/src/main.ts

```typescript
const monitor = init({
  // 第 14 章更新：DSN 切换到正式的 dsn-server（NestJS）
  // 之前：http://localhost:3001/collect（临时验证用 collect-server）
  // 现在：http://localhost:3000/report（正式的 NestJS 数据接收服务）
  dsn: 'http://localhost:3000/report',
  appId: 'vue3-demo',
  // ... 其余配置不变
})
```

### react-demo/src/main.tsx

```typescript
const monitor = init({
  dsn: 'http://localhost:3000/report',
  appId: 'react-demo',
  // ... 其余配置不变
})
```

---

## 14.16 端到端验证

让整条链路完整跑通：

1. **启动基础设施**：`pnpm infra:start`
2. **启动 DSN Server**：`pnpm dsn-server`
3. **启动 Demo 项目**（任选其一）：
   ```bash
   pnpm --filter vue3-demo dev
   # 或
   pnpm --filter react-demo dev
   ```
4. 打开浏览器，访问 demo 页面，触发一些操作（点击、等待 5 秒让定时批量上报触发）
5. 打开 Kafka UI（http://localhost:8081），查看四个 Topic 是否有消息

### 验证成功标志

- Kafka UI 中 `monitor.error` / `monitor.performance` / `monitor.behavior` / `monitor.api` 四个 Topic 出现
- 各 Topic 的 **Messages** 里能看到 JSON 格式的监控数据
- DSN Server 控制台输出：`写入 Kafka 成功，事件数: N`

---

## 14.17 速率限制说明

`@nestjs/throttler` 已在根模块全局生效，默认配置：
- 时间窗口：10 秒
- 最大请求数：200 次/IP

**什么场景会触发？**
- 同一 IP 在 10 秒内发起超过 200 次请求，返回 `429 Too Many Requests`

**生产环境建议**：
- 根据实际业务量调整阈值
- 针对不同来源（内网/外网）设置不同策略
- 结合 Nginx/API Gateway 在接入层做更早的限流

---

## 14.18 appId 校验的演进路径

> 🏗️ **架构思考**
>
> 本章的 appId 校验用了最简单的方式：读取环境变量 `VALID_APP_IDS`，维护一个内存中的 Set。
>
> **为什么不一步到位接入数据库？**
>
> 因为用户/项目管理系统是第 16 章才实现的（monitor-server），在那之前数据库里没有项目数据，没法查。
>
> **第 16 章后的升级路径：**
>
> ```
> 当前（第 14 章）：Set<string>（内存，来自环境变量）
>      ↓
> 第 16 章：调用 monitor-server 的 ProjectService，
>          查询 PostgreSQL 中的 projects 表，
>          缓存合法 appId 列表（避免每次请求都打数据库）
> ```
>
> 这种分阶段演进的方式，让每一章的代码保持可运行，不依赖未完成的功能。

---

## 本章小结

| 完成项 | 技术点 |
|---|---|
| NestJS 服务骨架 | Module / Controller / Service / DTO 四层结构 |
| POST /report 接口 | class-validator + ValidationPipe 自动校验 |
| appId 白名单校验 | 环境变量配置，第 16 章升级为 DB 查询 |
| 速率限制 | @nestjs/throttler 全局 Guard |
| Kafka Producer | kafkajs，OnModuleInit 自动连接 |
| 按 type 分发 Topic | monitor.error / .performance / .behavior / .api |
| demos DSN 更新 | 从 collect-server 切换到 dsn-server |

### 数据流当前状态

```
SDK（浏览器）
  ↓ POST http://localhost:3000/report
dsn-server（NestJS）✅ 本章完成
  ↓ Kafka Producer
Kafka Topics ✅ 消息可在 Kafka UI 看到
  ↓ [第 15 章]
Consumer → ClickHouse ✅ 表已就绪（第 13 章）
```

下一章（第 15 章）将实现 Kafka Consumer，把消息从 Kafka 取出来写入 ClickHouse，完成整条数据链路的贯通。
