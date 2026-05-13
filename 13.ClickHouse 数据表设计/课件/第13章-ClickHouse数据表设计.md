# 第 13 章：ClickHouse 数据表设计

---

## 本章概要

| 项目 | 说明 |
|---|---|
| **核心目标** | 为四类监控数据在 ClickHouse 中建表，并验证写入与查询 |
| **交付物** | `db/clickhouse/` 目录：建表 SQL + 种子数据 + 查询示例 |
| **重点** | MergeTree 引擎选型逻辑、表结构字段设计依据 |
| **难点** | 理解 `ORDER BY` / `PARTITION BY` 的实际含义和对查询性能的影响 |
| **涉及技术** | ClickHouse MergeTree / SQL DDL / HTTP API / DataGrip |

> ⚠️ **课程深度说明**
>
> 重点是建出能用的表结构，理解 MergeTree 引擎基本逻辑即可。ClickHouse 物化视图、Projection、分布式表、性能调优等进阶内容不展开。

---

## 13.1 ClickHouse 建表语法快速上手

### 最简单的 CREATE TABLE

```sql
CREATE TABLE IF NOT EXISTS monitor.error_logs
(
    trace_id  String,
    app_id    String,
    message   String,
    created_at DateTime
)
ENGINE = MergeTree()
ORDER BY (app_id, created_at);
```

和 MySQL / PostgreSQL 的区别：

| 差异点 | PostgreSQL | ClickHouse |
|---|---|---|
| 主键 | `PRIMARY KEY id` 必须 | 没有传统主键，ORDER BY 代替 |
| 唯一约束 | `UNIQUE`，写入时校验 | 不支持，写入时不校验唯一性 |
| 事务 | 支持 ACID | 不支持（OLAP 场景不需要）|
| 默认引擎 | btree 索引 | 必须显式指定 ENGINE |

> 📖 **术语：ENGINE（存储引擎）**
>
> 白话：ClickHouse 和 MySQL 一样，支持多种存储引擎，每种引擎对应不同的存储方式和查询特性。在建表时必须指定，不像 PostgreSQL 不需要指定。

### 常用数据类型

| 类型 | 说明 | 示例 |
|---|---|---|
| `String` | 变长字符串，不限长度 | URL、用户代理、错误信息 |
| `LowCardinality(String)` | 低基数字符串，内部字典编码，节省空间 | error_type（只有 4 种值）|
| `Int32` / `Int64` | 整数 | 行号、状态码 |
| `Float64` | 浮点数 | 耗时（ms）、CLS 值 |
| `Bool` | 布尔 | success 字段 |
| `DateTime` | 日期时间，精度到秒 | created_at |

> 📖 **术语：LowCardinality**
>
> 白话：如果一个字段只有少量固定值（比如 `error_type` 只有 js_error / resource_error / promise_error / framework_error 四种），用 `LowCardinality(String)` 代替 `String`。ClickHouse 内部会建一个字典，把这几个字符串变成数字存储，查询时按数字比较，极大节省空间和提升过滤速度。

---

## 13.2 MergeTree 系列引擎简介

本课程的四张表全部使用 **MergeTree** 引擎，是最基础也最通用的选择。在了解为什么选它之前，先看看系列家族：

| 引擎 | 适用场景 | 本课程使用 |
|---|---|---|
| **MergeTree** | 时序日志，追加写入，按时间/维度聚合 | ✅ 四张监控表 |
| ReplacingMergeTree | 相同主键的行会在后台合并去重（最终一致） | UV 统计场景（本课程不用）|
| AggregatingMergeTree | 存储聚合中间状态，配合物化视图 | 物化视图高级用法（本课程不展开）|
| SummingMergeTree | 相同主键的数值列自动累加 | 预聚合计数场景（本课程不用）|

> 📖 **术语：MergeTree（合并树）**
>
> 白话：写入数据时，ClickHouse 先把数据写成一小块（part）。后台会定期把多个小块合并成大块（merge），合并过程中顺便做排序、去重等操作。"Merge"指的就是这个后台合并动作。

### MergeTree 三个关键配置

```sql
ENGINE = MergeTree()
PARTITION BY toYYYYMM(created_at)  -- 按月分区
ORDER BY (app_id, created_at)       -- 排序键（核心！）
TTL created_at + INTERVAL 90 DAY   -- 数据自动过期删除
```

**PARTITION BY（分区键）**

> 📖 **术语：分区（Partition）**
>
> 白话：把数据按某个维度分成独立的"文件夹"分开存储。查询时如果 WHERE 条件能匹配到分区键，ClickHouse 直接跳过不相关的分区，相当于从查 1000 个文件夹缩减到只查 1 个。
>
> `toYYYYMM(created_at)` 表示按年月分区（202505、202506...），监控数据按月查询是常见场景，分区设计匹配查询模式。

**ORDER BY（排序键）**

> 📖 **术语：排序键（Sorting Key）**
>
> 白话：ClickHouse 把数据按这个顺序物理存储到磁盘上。查询时如果 WHERE 条件和 ORDER BY 字段匹配，可以用二分查找跳过大量不相关数据（跳数索引）。
>
> `ORDER BY (app_id, created_at)` 表示：先按项目 ID 排序，同一项目内再按时间排序。这样查"某个项目最近 24 小时的错误"时，app_id 过滤快，created_at 时间范围也快。

> 🏗️ **架构思考**
>
> ORDER BY 的字段顺序很重要。把**基数低**（值少）的字段放前面，**基数高**（值多）的字段放后面。
>
> - `app_id`：通常只有几个到几十个项目，基数低，放前面 → 同一 app 的数据聚集存储
> - `created_at`：每秒都有不同值，基数高，放后面 → 同 app 内按时间有序

**TTL（数据生命周期）**

> 📖 **术语：TTL（Time To Live）**
>
> 白话：数据的"保质期"。设置了 TTL 后，ClickHouse 会在后台自动删除过期数据，不需要手动写定时任务。
>
> `TTL created_at + INTERVAL 90 DAY` 表示数据写入 90 天后自动删除，避免监控数据无限增长。

---

## 13.3 四张监控表结构设计

所有表共享相同的公共字段，来源于 SDK 上报的 `MonitorEvent`：

```typescript
// packages/core 中的上报结构（回顾）
interface MonitorEvent {
  traceId: string       // → trace_id：每条记录唯一标识
  appId: string         // → app_id：区分哪个项目
  userId?: string       // → user_id：区分哪个用户
  page: string          // → page：哪个页面发生的
  ua: string            // → ua：用户的浏览器/设备
  type: string          // → 决定写入哪张表
  payload: unknown      // → 不同表有不同的 payload 字段
  timestamp: number     // → created_at
}
```

### 错误日志表 error_logs

对应 `type = 'error'` 的上报数据，覆盖四种错误来源（第 6-7 章 SDK 采集内容）。

```sql
CREATE TABLE IF NOT EXISTS monitor.error_logs
(
    -- 公共字段
    trace_id     String,
    app_id       String,
    user_id      String,
    page         String,
    ua           String,

    -- 错误专有字段（来自 payload）
    error_type   LowCardinality(String),   -- js_error / resource_error / promise_error / framework_error
    message      String,                   -- Error.message
    stack        String,                   -- Error.stack，可能为空
    filename     String,                   -- 出错脚本或资源 URL
    lineno       Int32,                    -- 行号，无法获取时为 0
    colno        Int32,                    -- 列号，无法获取时为 0

    created_at   DateTime
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(created_at)
ORDER BY (app_id, created_at)
TTL created_at + INTERVAL 90 DAY;
```

### 性能日志表 performance_logs

对应 `type = 'performance'` 的上报数据，覆盖 Core Web Vitals（第 8 章 SDK 采集内容）。

```sql
CREATE TABLE IF NOT EXISTS monitor.performance_logs
(
    trace_id     String,
    app_id       String,
    user_id      String,
    page         String,
    ua           String,

    -- Core Web Vitals（来自 PerformanceObserver）
    fcp          Float64,   -- First Contentful Paint，首次内容绘制（ms）
    lcp          Float64,   -- Largest Contentful Paint，最大内容绘制（ms）
    fid          Float64,   -- First Input Delay，首次输入延迟（ms）
    cls          Float64,   -- Cumulative Layout Shift，累计布局偏移（无单位，越小越好）
    ttfb         Float64,   -- Time to First Byte，首字节时间（ms）
    load_time    Float64,   -- 页面完整加载耗时（ms）

    created_at   DateTime
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(created_at)
ORDER BY (app_id, created_at)
TTL created_at + INTERVAL 90 DAY;
```

### 用户行为表 behavior_logs

对应 `type = 'behavior'` 的上报数据，覆盖 PV / 点击 / 自定义埋点（第 9 章 SDK 采集内容）。

```sql
CREATE TABLE IF NOT EXISTS monitor.behavior_logs
(
    trace_id     String,
    app_id       String,
    user_id      String,
    page         String,
    ua           String,

    action_type  LowCardinality(String),   -- page_view / click / custom
    element      String,                   -- 被点击元素的 CSS 路径，page_view 时为空
    extra        String,                   -- 自定义埋点数据（JSON 字符串）

    created_at   DateTime
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(created_at)
ORDER BY (app_id, created_at)
TTL created_at + INTERVAL 90 DAY;
```

### API 请求日志表 api_logs

对应 `type = 'api'` 的上报数据，拦截 XHR / fetch 请求（第 10 章 SDK 采集内容）。

```sql
CREATE TABLE IF NOT EXISTS monitor.api_logs
(
    trace_id      String,
    app_id        String,
    user_id       String,
    page          String,
    ua            String,

    method        LowCardinality(String),   -- GET / POST / PUT / DELETE / PATCH
    url           String,                   -- 请求完整 URL
    status        Int32,                    -- HTTP 状态码，网络错误时为 0
    duration      Float64,                  -- 请求耗时（ms）
    request_size  Int32,                    -- 请求体大小（bytes）
    response_size Int32,                    -- 响应体大小（bytes），无法获取时为 -1
    success       Bool,                     -- status 200-299 且无网络错误

    created_at    DateTime
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(created_at)
ORDER BY (app_id, created_at)
TTL created_at + INTERVAL 90 DAY;
```

### 字段设计总结

> 🏗️ **架构思考**
>
> **为什么没有自增主键 `id`？**
>
> ClickHouse 的设计哲学和关系型数据库不同。它不需要按主键查单条记录，所有查询都是批量扫描 + 聚合。维护自增主键反而消耗资源且毫无意义。用 `trace_id`（UUID）做业务追踪 ID 足够。
>
> **为什么公共字段不单独建表？**
>
> 关系型数据库会把公共字段抽出来做一张表然后 JOIN。但 ClickHouse 的 JOIN 性能远不如聚合查询，"宽表设计"（每行含所有字段，允许冗余）反而是最佳实践。所以把 `app_id` / `user_id` 等公共字段直接冗余到每张表里。

---

## 13.4 在 DataGrip 中执行建表语句

建表语句保存在项目代码的 `db/clickhouse/01_create_tables.sql`。

**步骤：**

1. DataGrip → 已建好的 ClickHouse 连接 → 右键 → **New Query Console**
2. 打开项目中的 `db/clickhouse/01_create_tables.sql` 文件
3. 全选（⌘A）→ 点击 **Execute**（或 ⌘Enter）
4. 四条 `CREATE TABLE` 语句全部成功后，左侧数据库树自动刷新，可以看到四张表

**验证建表结果：**

```sql
SELECT
    name     AS table_name,
    engine,
    partition_key,
    sorting_key,
    total_rows
FROM system.tables
WHERE database = 'monitor'
  AND name IN ('error_logs', 'performance_logs', 'behavior_logs', 'api_logs')
ORDER BY name;
```

预期输出：四张表，engine 均为 `MergeTree`，total_rows 为 0（还没有数据）。

---

## 13.5 使用 ClickHouse HTTP API 写入一条数据

ClickHouse 提供 HTTP Interface，可以用 `curl` 直接发 HTTP 请求执行 SQL，这也是后续 `@clickhouse/client` 库底层使用的同一接口。

### FORMAT JSONEachRow 格式

```bash
# 向 error_logs 插入一条数据
# FORMAT JSONEachRow：每行一个 JSON 对象，字段名对应列名
curl -u monitor:123456 \
  'http://localhost:8123/?database=monitor&query=INSERT+INTO+error_logs+FORMAT+JSONEachRow' \
  --data-binary '{"trace_id":"test-001","app_id":"app_001","user_id":"user_001","page":"/dashboard","ua":"Chrome/120","error_type":"js_error","message":"test error","stack":"","filename":"","lineno":0,"colno":0,"created_at":"2026-05-13 10:00:00"}'
```

> 📖 **术语：FORMAT JSONEachRow**
>
> 白话：ClickHouse 支持多种数据传输格式（CSV、TSV、JSON、Parquet 等）。`JSONEachRow` 是最常用的格式之一：每行数据是一个独立的 JSON 对象，多行数据直接换行拼接，不需要外层数组。
>
> 后续章节用 `@clickhouse/client` 的 `insert()` 方法，底层也是用这个格式通过 HTTP 发送数据的。

### 查询验证

```bash
# 用 SELECT 验证写入
curl -u monitor:123456 \
  'http://localhost:8123/?database=monitor&query=SELECT+trace_id,message,created_at+FROM+error_logs+LIMIT+5'
```

---

## 13.6 在 DataGrip 中插入模拟数据

**步骤：**

1. DataGrip → ClickHouse 连接 → 右键 → **New Query Console**
2. 打开项目 `db/clickhouse/02_mock_data.sql` 文件（用编辑器打开，全选复制）
3. 在 Query Console 中粘贴（⌘V），点击 **Execute**
4. 四条 INSERT 语句依次执行，DataGrip 底部 Output 面板显示各条影响行数

**验证写入结果：**

```sql
-- 分别查四张表的行数
SELECT 'error_logs'      AS tbl, count() AS cnt FROM monitor.error_logs
UNION ALL
SELECT 'performance_logs', count() FROM monitor.performance_logs
UNION ALL
SELECT 'behavior_logs',    count() FROM monitor.behavior_logs
UNION ALL
SELECT 'api_logs',         count() FROM monitor.api_logs;
```

预期：四张表分别写入约 16-20 条数据。

---

## 13.7 常用聚合查询 SQL 实践

完整查询示例保存在 `db/clickhouse/03_query_examples.sql`，在 DataGrip 中打开并逐条执行。以下精选几个核心场景演示。

### 错误趋势（按小时分组）

```sql
-- 过去 24 小时，每小时的错误数趋势
SELECT
    toStartOfHour(created_at) AS hour,
    count()                   AS error_count
FROM monitor.error_logs
WHERE app_id = 'app_001'
  AND created_at >= now() - INTERVAL 24 HOUR
GROUP BY hour
ORDER BY hour;
```

> 📖 **术语：toStartOfHour()**
>
> 白话：把一个时间戳取整到小时级别。`toStartOfHour('2026-05-13 09:43:00')` 返回 `2026-05-13 09:00:00`。这样不同分钟的数据就能被 GROUP BY 到同一小时桶里。

### 影响用户最多的错误

```sql
SELECT
    message,
    filename,
    lineno,
    count()              AS occurrence,
    uniqExact(user_id)   AS affected_users
FROM monitor.error_logs
WHERE app_id = 'app_001'
  AND created_at >= now() - INTERVAL 7 DAY
GROUP BY message, filename, lineno
ORDER BY affected_users DESC
LIMIT 5;
```

> 📖 **术语：uniqExact()**
>
> 白话：精确统计某一列有多少个不同的值（去重计数）。等同于 `COUNT(DISTINCT user_id)`，但 ClickHouse 中 `uniqExact()` 是专用函数，性能更好。

### Core Web Vitals 平均值

```sql
SELECT
    round(avg(fcp),  1) AS avg_fcp_ms,
    round(avg(lcp),  1) AS avg_lcp_ms,
    round(avg(fid),  1) AS avg_fid_ms,
    round(avg(cls),  3) AS avg_cls,
    round(avg(ttfb), 1) AS avg_ttfb_ms
FROM monitor.performance_logs
WHERE app_id = 'app_001'
  AND created_at >= now() - INTERVAL 7 DAY;
```

### PV / UV 趋势

```sql
SELECT
    toDate(created_at)  AS day,
    count()             AS pv,
    uniqExact(user_id)  AS uv
FROM monitor.behavior_logs
WHERE app_id = 'app_001'
  AND action_type = 'page_view'
  AND created_at >= now() - INTERVAL 7 DAY
GROUP BY day
ORDER BY day;
```

### API 异常率 TOP 10

```sql
SELECT
    url,
    method,
    count()                                               AS total,
    countIf(success = false)                              AS fail_count,
    round(countIf(success = false) * 100.0 / count(), 1) AS fail_rate_pct
FROM monitor.api_logs
WHERE app_id = 'app_001'
  AND created_at >= now() - INTERVAL 7 DAY
GROUP BY url, method
HAVING fail_count > 0
ORDER BY fail_rate_pct DESC
LIMIT 10;
```

---

## 本章小结

### 完成后的 db/ 目录结构

```
monitor/
└── db/
    ├── clickhouse/
    │   ├── 01_create_tables.sql    ← 四张表的 DDL，在 DataGrip 中执行建表
    │   ├── 02_mock_data.sql        ← 模拟数据 INSERT，在 DataGrip 中粘贴执行
    │   └── 03_query_examples.sql   ← 14 条聚合查询示例，在 DataGrip 中逐条执行
    └── postgres/
        └── README.md               ← 第 16 章实现时补充
```

### 四张表总结

| 表名 | 对应 SDK type | 核心字段 |
|---|---|---|
| `error_logs` | `'error'` | error_type / message / stack / filename / lineno |
| `performance_logs` | `'performance'` | fcp / lcp / fid / cls / ttfb / load_time |
| `behavior_logs` | `'behavior'` | action_type / element / extra |
| `api_logs` | `'api'` | method / url / status / duration / success |

### 数据流当前进展

```
SDK（浏览器）
  ↓ 上报 type=error/performance/behavior/api
collect-server（临时，第 14 章替换）
  ↓
Kafka ← 已就绪（第 12 章）
  ↓ 第 15 章实现
Consumer → ClickHouse ← ✅ 四张表已就绪，模拟数据已写入
monitor-server API（第 16 章）← PostgreSQL 已就绪
```

**下一章（第 14 章）**：用 NestJS 创建 `dsn-server`，实现 `/report` 接收端点，把 SDK 上报的数据写入 Kafka 对应的 Topic。

---

## 附录：ClickHouse HTTP API 常用命令参考

```bash
# 查看所有表
curl -u monitor:123456 'http://localhost:8123/?query=SHOW+TABLES+FROM+monitor'

# 查询某表行数
curl -u monitor:123456 'http://localhost:8123/?database=monitor&query=SELECT+count()+FROM+error_logs'

# 查看表结构
curl -u monitor:123456 'http://localhost:8123/?database=monitor&query=DESCRIBE+error_logs'

# 清空某表数据（⚠️ 慎用）
curl -u monitor:123456 'http://localhost:8123/?database=monitor&query=TRUNCATE+TABLE+error_logs'
```
