# 第 16 章 · 后端——监控平台 API 服务

> **本章目标**：实现 `monitor-server`，为前端监控平台提供完整的 API 支撑：用户注册/登录（JWT 鉴权）、项目管理（CRUD），以及从 ClickHouse 查询四类监控数据的接口。

---

## 课程元信息

```json
{
  "chapter": 16,
  "title": "后端——监控平台 API 服务",
  "duration": "约 90 分钟",
  "skills": [
    "NestJS 模块体系（Module / Controller / Service / DTO）",
    "@nestjs/passport + passport-jwt + @nestjs/jwt",
    "JwtAuthGuard + @Public() 装饰器 + Reflector",
    "TypeORM forRoot / forFeature / Entity / Repository",
    "bcrypt 密码哈希",
    "class-validator / class-transformer 参数校验",
    "@clickhouse/client query 参数化查询",
    "全局 ResponseInterceptor（统一响应格式）",
    "全局 HttpExceptionFilter（统一异常格式）",
    "PostgreSQL UUID 主键 + 外键级联删除",
    "ClickHouse 聚合函数：count / avg / uniq / quantile / countIf / avgIf"
  ]
}
```

---

## 本章学习地图

> 本章围绕 `monitor-server` 展开，共分 **6 个核心模块**。下表帮你快速定位每个模块的**是什么、重点是什么、对应哪些代码文件**。

| # | 模块名称 | 用一句话说清楚它是干什么的 | 本节重点 | 核心代码文件 |
|---|---------|------------------------|---------|------------|
| 1 | **统一基础设施** | 所有接口都要走的"通道"：统一响应格式 + 全局异常捕获 | 怎么用 Interceptor 和 Filter 把响应格式标准化 | `common/response.interceptor.ts`<br>`common/http-exception.filter.ts` |
| 2 | **JWT 鉴权体系** | 让"没登录的请求"自动被拒，让"已登录的请求"自动识别身份 | Guard + Strategy + @Public() 白名单三件套如何配合 | `common/guards/jwt-auth.guard.ts`<br>`common/decorators/public.decorator.ts`<br>`auth/strategies/jwt.strategy.ts` |
| 3 | **用户认证模块** | 注册账号、登录拿 token、查看自己的信息 | bcrypt 密码哈希 + JWT 签发流程 | `auth/auth.service.ts`<br>`auth/auth.controller.ts`<br>`auth/dto/` |
| 4 | **项目管理模块** | 每个接入监控的应用就是一个"项目"，本模块负责增删改查 | TypeORM Entity 与 Repository 模式，以及按用户隔离数据 | `project/project.service.ts`<br>`project/project.controller.ts`<br>`project/entities/project.entity.ts` |
| 5 | **监控数据查询模块** | 查 ClickHouse，把四类原始数据（错误/性能/行为/API）变成前端图表需要的聚合结果 | 参数化 ClickHouse SQL、多维度聚合统计设计 | `monitor-data/monitor-data.service.ts`<br>`monitor-data/monitor-data.controller.ts`<br>`monitor-data/dto/query.dto.ts` |
| 6 | **ClickHouse 全局模块** | 把 ClickHouse 客户端封装成一个可以在任何模块注入的 Service | @Global() 模块的作用、参数化查询防 SQL 注入 | `clickhouse/clickhouse.service.ts`<br>`clickhouse/clickhouse.module.ts` |

### 各模块之间的调用关系

```
HTTP 请求
  │
  ▼
JwtAuthGuard（全局）
  │  ✓ token 合法
  ▼
Controller（AuthController / ProjectController / MonitorDataController）
  │
  ├─→ AuthService ──────────────────→ UserRepository（PostgreSQL）
  │                                   bcryptjs 密码比对
  │                                   JwtService 签发 token
  │
  ├─→ ProjectService ───────────────→ ProjectRepository（PostgreSQL）
  │
  └─→ MonitorDataService ───────────→ ClickhouseService → ClickHouse
                                        （SELECT 聚合查询）

所有 Controller 返回值
  │
  ▼
ResponseInterceptor（包装为 { code, data, message }）
  │
  ▼
客户端收到统一格式响应
```

### 本章知识点脑图（文字版）

```
monitor-server
├── 基础设施层
│   ├── 统一响应格式（ResponseInterceptor）
│   └── 全局异常捕获（HttpExceptionFilter）
│
├── 鉴权层
│   ├── JWT 策略（JwtStrategy → 解析 token → 注入 req.user）
│   ├── 全局 Guard（JwtAuthGuard → 拦截未认证请求）
│   └── 白名单机制（@Public() 装饰器 → register/login 不校验）
│
├── 业务层
│   ├── 用户认证（register / login / profile）
│   ├── 项目管理（CRUD，按 ownerId 隔离）
│   └── 监控数据查询
│       ├── 列表接口（分页，支持筛选）
│       └── 统计接口（趋势图 + 分布 + TopN）
│
└── 数据层
    ├── PostgreSQL（TypeORM，存用户和项目）
    └── ClickHouse（@clickhouse/client，存四类监控数据）
```

### 课堂讲解建议顺序

> 建议按下面的顺序讲，每一步都有明确的"看得见的效果"，方便现场演示。

1. **先讲基础设施**（第三节）→ 启动服务，直接看到统一格式响应，建立感性认知
2. **再讲鉴权**（第四节）→ 演示不带 token 被拒，带 token 通过，直观理解 Guard
3. **然后讲用户认证**（第五节）→ 演示注册 + 登录全流程，调通 `/auth/login` 拿到 token
4. **接着讲项目管理**（第六节）→ 演示用 token 创建项目、查项目列表
5. **最后讲监控数据**（第七、八节）→ 演示 `/monitor/errors/stats` 返回真实 ClickHouse 数据

---

## 一、本章背景与职责划分

### 当前数据流全景

```
SDK（浏览器）
  ↓ fetch / sendBeacon POST /report
dsn-server（端口 3000）      ← ✅ 第 14 章
  ↓ Kafka Producer
Kafka Topics
  ↓ Kafka Consumer
consumer-server（端口 3001）  ← ✅ 第 15 章
  ↓ @clickhouse/client INSERT
ClickHouse（四张监控表）       ← ✅ 数据已有
PostgreSQL（用户/项目管理）    ← ⬅ 本章新建

monitor-server（端口 3002）   ← 🏗️ 本章实现
  ↑ React 前端平台（第 17-21 章）
```

### monitor-server 的三大职责

| 职责 | 涉及技术 |
|------|---------|
| 用户注册 / 登录 | JWT、bcrypt、Passport |
| 项目管理 CRUD | TypeORM、PostgreSQL |
| 监控数据查询 | @clickhouse/client、ClickHouse SQL |

> 🏗️ **架构思考：为什么独立一个 monitor-server，不复用 dsn-server？**
>
> - **职责隔离**：dsn-server 是"写路径"（高吞吐、无状态），monitor-server 是"读路径"（业务逻辑复杂、需要鉴权）。
> - **独立扩展**：写路径可单独水平扩展应对上报洪峰，不影响平台 API。
> - **安全边界**：dsn-server 暴露给 SDK（公网），monitor-server 只给前端平台（内部用户），安全策略不同。

---

## 二、项目结构

```
apps/backend/monitor-server/
├── src/
│   ├── main.ts                                    应用入口（端口 3002）
│   ├── app.module.ts                              根模块（TypeORM + 全局 JwtAuthGuard）
│   ├── common/
│   │   ├── response.interceptor.ts                统一响应格式 { code, data, message }
│   │   ├── http-exception.filter.ts               全局异常过滤器
│   │   ├── guards/
│   │   │   └── jwt-auth.guard.ts                  JWT 鉴权 Guard（支持 @Public() 白名单）
│   │   └── decorators/
│   │       ├── public.decorator.ts                @Public() — 标记公开路由
│   │       └── current-user.decorator.ts          @CurrentUser() — 获取当前登录用户
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts                     POST /auth/register | /auth/login | GET /auth/profile
│   │   ├── auth.service.ts                        注册、登录、签发 JWT
│   │   ├── strategies/jwt.strategy.ts             passport-jwt Strategy
│   │   └── dto/register.dto.ts & login.dto.ts
│   ├── user/
│   │   ├── user.module.ts
│   │   ├── user.service.ts
│   │   └── entities/user.entity.ts                TypeORM 实体
│   ├── project/
│   │   ├── project.module.ts
│   │   ├── project.controller.ts                  GET/POST/PATCH/DELETE /projects
│   │   ├── project.service.ts
│   │   ├── entities/project.entity.ts
│   │   └── dto/create-project.dto.ts & update-project.dto.ts
│   ├── monitor-data/
│   │   ├── monitor-data.module.ts
│   │   ├── monitor-data.controller.ts             GET /monitor/errors|performance|behaviors|apis
│   │   ├── monitor-data.service.ts                ClickHouse SQL 查询
│   │   └── dto/query.dto.ts
│   └── clickhouse/
│       ├── clickhouse.module.ts                   @Global() 全局 ClickHouse 模块
│       └── clickhouse.service.ts                  封装 query 方法（参数化查询）
├── .env.example
├── nest-cli.json
├── package.json
└── tsconfig.json
```

---

## 三、统一响应格式

### 设计目标

所有接口统一返回：

```json
{
  "code": 0,
  "data": { ... },
  "message": "ok"
}
```

错误时：

```json
{
  "code": 40100,
  "data": null,
  "message": "账号或密码错误"
}
```

> 📖 **术语：ResponseInterceptor（响应拦截器）**
>
> 白话：NestJS 里的"出口加工站"。请求进来后，Controller 返回原始数据（比如一个数组），拦截器在数据"出门"之前把它包装成统一的 `{ code, data, message }` 结构。
> 术语：实现了 `NestInterceptor` 接口的类，配合 RxJS `map` 操作符，对响应流做变换。

**实现思路**：

```typescript
// src/common/response.interceptor.ts
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<...> {
    return next.handle().pipe(
      map((data) => ({ code: 0, data, message: 'ok' }))
    )
  }
}
```

在 `main.ts` 注册为全局拦截器：

```typescript
app.useGlobalInterceptors(new ResponseInterceptor())
app.useGlobalFilters(new HttpExceptionFilter())
```

---

## 四、JWT 鉴权体系

> ⚠️ **课程深度说明**：JWT、Passport、TypeORM 已在专项课程中讲解，本章重点是"如何在监控系统中组合使用"，不重复原理讲解。

### 整体流程

```
客户端请求
  ↓ Authorization: Bearer <token>
JwtAuthGuard.canActivate()
  ├─ 有 @Public() 标记？→ 直接放行
  └─ 调用 PassportStrategy('jwt').validate()
       ↓ 解析 token，取出 { sub, email }
       ↓ 查 PostgreSQL 确认用户存在
       ↓ 将 { sub, email } 挂到 req.user
  ↓ 到达 Controller
  @CurrentUser() user: JwtPayload → 从 req.user 取值
```

### 关键代码：@Public() 白名单机制

```typescript
// public.decorator.ts
export const IS_PUBLIC_KEY = 'isPublic'
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true)

// jwt-auth.guard.ts
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) { super() }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true          // ← 白名单直接放行
    return super.canActivate(context)  // ← 否则走 JWT 验证
  }
}
```

在 `AppModule` 注册为全局 Guard：

```typescript
providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }]
```

> 🏗️ **架构思考：为什么用全局 Guard + @Public() 白名单，而不是在需要鉴权的路由上加 @UseGuards()?**
>
> - **防御性编程**：默认所有接口受保护，新增接口不会因为"忘记加 Guard"而裸露。
> - **更少的重复代码**：只需对少数公开接口加 `@Public()`，而不是对大量受保护接口重复写 `@UseGuards(JwtAuthGuard)`。
> - **Sentry 也采用类似策略**：默认需要 API Key，公开接口显式豁免。

---

## 五、用户模块

### User 实体

```typescript
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')  id: string
  @Column({ unique: true })        email: string
  @Exclude()                       // 序列化时自动排除，防止密码泄露
  @Column()                        password: string
  @Column()                        name: string
  @CreateDateColumn()              createdAt: Date
  @OneToMany(() => Project, ...)   projects: Project[]
}
```

### 密码处理

```typescript
// 注册时哈希（saltRounds=10，约 100ms，可抵御暴力破解）
const hashed = await bcrypt.hash(dto.password, 10)

// 登录时验证
const ok = await bcrypt.compare(dto.password, user.password)
```

> 📖 **术语：bcrypt**
>
> 白话：一种专门为密码设计的"慢哈希"算法。普通哈希（MD5/SHA256）运算很快，黑客可以每秒试几百万个密码；bcrypt 故意设计得"慢"（通过 saltRounds 控制），让暴力破解的时间成本极高。
> 同时内置了随机 salt（防止彩虹表攻击），同一密码每次哈希结果都不同。

### Auth 接口

| 方法 | 路径 | 是否公开 | 说明 |
|------|------|---------|------|
| POST | `/auth/register` | ✅ | 注册并返回 JWT |
| POST | `/auth/login` | ✅ | 登录并返回 JWT |
| GET  | `/auth/profile` | ❌ (需 JWT) | 获取当前用户信息 |

**注册请求体**：

```json
{
  "email": "test@example.com",
  "password": "123456",
  "name": "测试用户"
}
```

**登录响应**：

```json
{
  "code": 0,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": { "id": "uuid", "email": "test@example.com", "name": "测试用户" }
  },
  "message": "ok"
}
```

---

## 六、项目管理模块

### Project 实体

```typescript
@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn('uuid')     id: string
  @Column({ unique: true })           appId: string   // 对应 SDK 的 appId
  @Column()                           name: string
  @Column({ nullable: true })         description: string
  @Column({ default: 'web' })         platform: string
  @ManyToOne(() => User, ...)         owner: User
}
```

> 🏗️ **架构思考：appId 为什么全局唯一，而不是"用户内唯一"？**
>
> - ClickHouse 中 `app_id` 列没有用户维度，同一个 `app_id` 在全局唯一可以避免数据被错误的账号查询到。
> - dsn-server 校验 appId 时，无需知道是哪个用户的项目，只需确认 appId 合法即可（第 16 章后可升级 dsn-server 改为数据库查询）。

### CRUD 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/projects` | 获取当前用户的所有项目 |
| POST | `/projects` | 创建新项目 |
| GET | `/projects/:id` | 获取单个项目（校验所有权） |
| PATCH | `/projects/:id` | 更新项目信息（appId 不可修改） |
| DELETE | `/projects/:id` | 删除项目（返回 204 No Content） |

**数据隔离**：每个接口从 `@CurrentUser()` 取 `user.sub`（userId），确保只能操作自己的项目：

```typescript
@Get()
findAll(@CurrentUser() user: JwtPayload) {
  return this.projectService.findAll(user.sub)  // 只查自己的
}
```

**创建项目请求体**：

```json
{
  "appId": "my-app-001",
  "name": "我的应用",
  "description": "描述（可选）",
  "platform": "web"
}
```

---

## 七、监控数据查询模块

### 接口总览

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/monitor/errors` | 错误日志列表（分页） |
| GET | `/monitor/errors/stats` | 错误趋势 + 类型分布 + TOP10 |
| GET | `/monitor/performance` | 性能日志列表（分页） |
| GET | `/monitor/performance/stats` | 性能指标均值 + LCP 趋势 |
| GET | `/monitor/behaviors` | 行为日志列表（分页） |
| GET | `/monitor/behaviors/stats` | PV/UV 趋势 + TOP 页面 |
| GET | `/monitor/apis` | API 日志列表（分页） |
| GET | `/monitor/apis/stats` | 成功率 + 耗时趋势 + 慢接口 TOP10 |

### 公共查询参数

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `appId` | string | ✅ | 项目标识 |
| `startTime` | ISO 8601 | ❌ | 开始时间，默认 7 天前 |
| `endTime` | ISO 8601 | ❌ | 结束时间，默认当前时间 |
| `page` | number | ❌ | 页码，默认 1 |
| `pageSize` | number | ❌ | 每页条数，默认 20，最大 200 |

### ClickHouse 参数化查询

> 📖 **术语：参数化查询（Parameterized Query）**
>
> 白话：把 SQL 中的变量部分用占位符（`{paramName: Type}`）标出，让驱动库在发送请求前统一做转义。直接拼接字符串会有 SQL 注入风险，参数化查询是防御这类风险的标准方法。

```typescript
// ❌ 危险写法（有 SQL 注入风险）
const sql = `SELECT * FROM error_logs WHERE app_id = '${appId}'`

// ✅ 安全写法（参数化查询）
const sql = `SELECT * FROM error_logs WHERE app_id = {appId: String}`
await this.clickhouse.query(sql, { appId })
```

`@clickhouse/client` 的 `query_params` 会将参数转义后替换占位符，**占位符语法**：`{参数名: ClickHouse类型}`。

### 错误统计响应示例

```json
{
  "code": 0,
  "data": {
    "trend": [
      { "date": "2025-05-08", "count": 12 },
      { "date": "2025-05-09", "count": 7 }
    ],
    "typeDistribution": [
      { "errorType": "js_error", "count": 15 },
      { "errorType": "promise_error", "count": 4 }
    ],
    "topErrors": [
      { "message": "Cannot read properties of undefined", "errorType": "js_error", "count": 8 }
    ]
  },
  "message": "ok"
}
```

### API 统计响应示例

```json
{
  "code": 0,
  "data": {
    "summary": {
      "total": 150,
      "successCount": 143,
      "errorCount": 7,
      "successRate": 95.33,
      "avgDuration": 234.5,
      "p95Duration": 891.2
    },
    "trend": [...],
    "slowApis": [
      {
        "url": "https://api.example.com/data/list",
        "method": "GET",
        "avgDuration": 1200.5,
        "p95Duration": 3500.0,
        "total": 45,
        "errorRate": 2.22
      }
    ]
  },
  "message": "ok"
}
```

> 🏗️ **架构思考：为什么要提供 stats 和 list 两类接口？**
>
> - **list 接口**：给数据表格用，需要分页 + 详情，但不需要聚合运算。
> - **stats 接口**：给图表看板用，需要趋势/分布/TOP数据，是高成本聚合查询。
> - **分开的好处**：前端可以按需调用（列表页只调 list，看板页只调 stats），避免过度加载数据。ClickHouse 的聚合查询很快，但大 result set 传输有网络开销。

---

## 八、TypeORM 与 PostgreSQL 集成

### 连接配置

```typescript
TypeOrmModule.forRoot({
  type: 'postgres',
  host: process.env.PG_HOST ?? 'localhost',
  port: Number(process.env.PG_PORT ?? 5432),
  database: process.env.PG_DATABASE ?? 'monitor',
  username: process.env.PG_USER ?? 'monitor',
  password: process.env.PG_PASSWORD ?? '123456',
  entities: [User, Project],
  synchronize: true,    // ⚠️ 开发阶段自动同步，生产环境改为 false
  logging: true,
})
```

> 📖 **术语：TypeORM synchronize**
>
> 白话：TypeORM 的"自动建表"模式。打开后，每次服务启动时，TypeORM 会对比你写的实体类和数据库里真实的表结构，如果不一致就自动执行 ALTER TABLE 或 CREATE TABLE。开发时很方便，但生产环境如果不小心改了实体，可能导致真实数据被删列——所以生产必须关掉，改用 Migration。

### 数据库表结构

TypeORM 启动时会自动创建以下两张表（参考 `db/postgres/01_create_tables.sql`）：

**users 表**：id(UUID) / email(唯一) / password(bcrypt哈希) / name / created_at / updated_at

**projects 表**：id(UUID) / app_id(唯一) / name / description / platform / owner_id(FK→users) / created_at / updated_at

---

## 九、环境变量

文件路径：`apps/backend/monitor-server/.env`（从 `.env.example` 复制）

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | 3003 | 服务监听端口 |
| `PG_HOST` | localhost | PostgreSQL 主机 |
| `PG_PORT` | 5432 | PostgreSQL 端口 |
| `PG_DATABASE` | monitor | 数据库名 |
| `PG_USER` | monitor | 用户名 |
| `PG_PASSWORD` | 123456 | 密码 |
| `CLICKHOUSE_HOST` | http://localhost:8123 | ClickHouse 地址 |
| `CLICKHOUSE_DATABASE` | monitor | 数据库名 |
| `CLICKHOUSE_USER` | monitor | 用户名 |
| `CLICKHOUSE_PASSWORD` | 123456 | 密码 |
| `JWT_SECRET` | （见.env.example）| JWT 签名密钥，生产必须替换 |
| `JWT_EXPIRES_IN` | 7d | Token 有效期 |

> ⚠️ **安全提示**：生产环境 `JWT_SECRET` 必须替换为高熵随机字符串（建议 64 字节以上），可用 `openssl rand -hex 64` 生成。

---

## 十、启动方式

### 前置条件

1. 基础设施已运行（第 12 章）：
   ```bash
   pnpm infra:start
   ```

2. 环境变量已配置：
   ```bash
   cp apps/backend/monitor-server/.env.example apps/backend/monitor-server/.env
   ```

3. 启动 monitor-server：
   ```bash
   # 从根目录
   pnpm monitor-server

   # 或单独进入目录
   pnpm --filter @monitor/monitor-server dev
   ```

4. 确认启动成功：
   ```
   [Monitor Server] 运行中 → http://localhost:3003
   ```

---

## 十一、用 Apifox 测试接口

Apifox（国产 Postman 替代品）支持环境变量、前置脚本自动保存 Token，非常适合测试有鉴权的接口序列。

### 测试流程

**Step 1：注册用户**

```
POST http://localhost:3003/auth/register
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "123456",
  "name": "测试用户"
}
```

**Step 2：登录获取 Token**

```
POST http://localhost:3003/auth/login
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "123456"
}
```

在 Apifox 的"后置操作"中提取 Token：

```javascript
// Apifox 后置脚本（JavaScript）
const token = pm.response.json().data.token
pm.environment.set('token', token)
```

**Step 3：创建项目（需要 Token）**

```
POST http://localhost:3003/projects
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "appId": "app_001",
  "name": "Vue3 演示应用",
  "platform": "web"
}
```

**Step 4：查询错误统计**

```
GET http://localhost:3003/monitor/errors/stats?appId=app_001
Authorization: Bearer {{token}}
```

**Step 5：查询 API 慢接口**

```
GET http://localhost:3003/monitor/apis/stats?appId=app_001&startTime=2025-01-01T00:00:00Z
Authorization: Bearer {{token}}
```

---

## 十二、本章小结

| 知识点 | 掌握要点 |
|--------|---------|
| **全局 Guard + @Public()** | 默认拦截所有接口，白名单豁免公开接口 |
| **JWT 鉴权流程** | 签发（AuthService）→ 验证（JwtStrategy）→ 取值（@CurrentUser）|
| **数据隔离** | 所有业务查询携带 `ownerId`，防止越权访问 |
| **统一响应格式** | ResponseInterceptor 包装成功响应，HttpExceptionFilter 包装错误响应 |
| **参数化查询** | `{paramName: Type}` 语法防 SQL 注入 |
| **ClickHouse 聚合** | `countIf` / `avgIf` / `uniq` / `quantile(0.95)` 用于统计看板 |
| **TypeORM synchronize** | 开发阶段便利，生产环境必须关闭改 Migration |

---

## 下一章预告

**第 17 章：前端平台——工程搭建与基础架构**

- 用 Vite + React + shadcn/ui + Tailwind 搭建监控平台前端工程
- 配置全局 Axios 实例（携带 JWT）
- 搭建路由体系（react-router-dom v6）
- 实现 Zustand 全局状态管理（用户信息持久化）
