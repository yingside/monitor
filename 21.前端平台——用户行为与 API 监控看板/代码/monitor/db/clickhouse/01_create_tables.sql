-- =============================================================================
-- 前端监控平台 · ClickHouse 建表语句
-- 数据库：monitor
-- 用途：存储四类监控数据（错误 / 性能 / 行为 / API）
-- 执行方式：DataGrip 中逐条执行，或通过 HTTP API 批量执行
-- =============================================================================

-- =============================================================================
-- 1. 错误日志表 error_logs
-- 对应 SDK 上报类型：type = 'error'
-- 覆盖：JS 错误 / 资源加载错误 / Promise 未捕获异常 / Vue/React 框架层错误
-- =============================================================================
CREATE TABLE IF NOT EXISTS monitor.error_logs
(
    -- 公共字段（所有四张表相同）
    trace_id     String                  COMMENT '每次上报的唯一 ID（UUID），用于追踪单条记录',
    app_id       String                  COMMENT '项目标识，来自 MonitorOptions.appId',
    user_id      String                  COMMENT '用户标识，来自 MonitorOptions.userId，未设置为空字符串',
    page         String                  COMMENT '发生错误时的页面 URL',
    ua           String                  COMMENT 'User-Agent，记录设备/浏览器信息',

    -- 错误特有字段
    error_type   LowCardinality(String)  COMMENT '错误类型：js_error / resource_error / promise_error / framework_error',
    message      String                  COMMENT '错误信息（Error.message）',
    stack        String                  COMMENT '错误堆栈（Error.stack），可能为空',
    filename     String                  COMMENT '出错脚本文件 URL，resource_error 时为资源地址',
    lineno       Int32                   COMMENT '行号，无行号时为 0',
    colno        Int32                   COMMENT '列号，无列号时为 0',

    -- 时间字段
    created_at   DateTime                COMMENT '上报时间（服务端接收时间）'
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(created_at)
ORDER BY (app_id, created_at)
TTL created_at + INTERVAL 90 DAY
SETTINGS index_granularity = 8192
COMMENT '前端 JS 错误、资源错误、Promise 未捕获异常日志';

-- =============================================================================
-- 2. 性能日志表 performance_logs
-- 对应 SDK 上报类型：type = 'performance'
-- 覆盖：Core Web Vitals（FCP / LCP / FID / CLS / TTFB）+ 页面完整加载耗时
-- =============================================================================
CREATE TABLE IF NOT EXISTS monitor.performance_logs
(
    -- 公共字段
    trace_id     String                  COMMENT '每次上报的唯一 ID',
    app_id       String                  COMMENT '项目标识',
    user_id      String                  COMMENT '用户标识',
    page         String                  COMMENT '页面 URL',
    ua           String                  COMMENT 'User-Agent',

    -- Core Web Vitals
    fcp          Float64                 COMMENT 'First Contentful Paint，首次内容绘制（ms）',
    lcp          Float64                 COMMENT 'Largest Contentful Paint，最大内容绘制（ms）',
    fid          Float64                 COMMENT 'First Input Delay，首次输入延迟（ms）',
    cls          Float64                 COMMENT 'Cumulative Layout Shift，累计布局偏移（无单位，越小越好）',
    ttfb         Float64                 COMMENT 'Time to First Byte，首字节时间（ms）',

    -- 完整加载耗时
    load_time    Float64                 COMMENT '页面完整加载耗时（ms），loadEventEnd - navigationStart',

    created_at   DateTime                COMMENT '上报时间'
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(created_at)
ORDER BY (app_id, created_at)
TTL created_at + INTERVAL 90 DAY
SETTINGS index_granularity = 8192
COMMENT '前端页面 Core Web Vitals 及加载性能日志';

-- =============================================================================
-- 3. 用户行为表 behavior_logs
-- 对应 SDK 上报类型：type = 'behavior'
-- 覆盖：页面访问（PV）/ 点击事件 / 自定义埋点
-- =============================================================================
CREATE TABLE IF NOT EXISTS monitor.behavior_logs
(
    -- 公共字段
    trace_id     String                  COMMENT '每次上报的唯一 ID',
    app_id       String                  COMMENT '项目标识',
    user_id      String                  COMMENT '用户标识',
    page         String                  COMMENT '页面 URL',
    ua           String                  COMMENT 'User-Agent',

    -- 行为特有字段
    action_type  LowCardinality(String)  COMMENT '行为类型：page_view / click / custom',
    element      String                  COMMENT '被点击元素的 CSS 路径或 data-track 标识，page_view 时为空',
    extra        String                  COMMENT '自定义埋点数据，JSON 字符串；click/page_view 通常为空',

    created_at   DateTime                COMMENT '上报时间'
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(created_at)
ORDER BY (app_id, created_at)
TTL created_at + INTERVAL 90 DAY
SETTINGS index_granularity = 8192
COMMENT '用户行为日志：PV / 点击 / 自定义埋点';

-- =============================================================================
-- 4. API 请求日志表 api_logs
-- 对应 SDK 上报类型：type = 'api'
-- 覆盖：拦截 XMLHttpRequest / fetch 请求，记录耗时和状态码
-- =============================================================================
CREATE TABLE IF NOT EXISTS monitor.api_logs
(
    -- 公共字段
    trace_id      String                  COMMENT '每次上报的唯一 ID',
    app_id        String                  COMMENT '项目标识',
    user_id       String                  COMMENT '用户标识',
    page          String                  COMMENT '页面 URL',
    ua            String                  COMMENT 'User-Agent',

    -- API 特有字段
    method        LowCardinality(String)  COMMENT 'HTTP 方法：GET / POST / PUT / DELETE / PATCH',
    url           String                  COMMENT '请求 URL（完整地址）',
    status        Int32                   COMMENT 'HTTP 状态码，请求失败（网络错误）时为 0',
    duration      Float64                 COMMENT '请求耗时（ms），从发起到收到响应',
    request_size  Int32                   COMMENT '请求体大小（bytes），GET 请求为 0',
    response_size Int32                   COMMENT '响应体大小（bytes），无法获取时为 -1',
    success       Bool                    COMMENT '是否成功：status 在 200-299 区间且无网络错误',

    created_at    DateTime                COMMENT '上报时间'
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(created_at)
ORDER BY (app_id, created_at)
TTL created_at + INTERVAL 90 DAY
SETTINGS index_granularity = 8192
COMMENT 'API 请求监控日志：耗时 / 状态码 / 成功率';

-- 验证建表结果
SELECT
    name AS table_name,
    engine,
    partition_key,
    sorting_key,
    total_rows
FROM system.tables
WHERE database = 'monitor'
  AND name IN ('error_logs', 'performance_logs', 'behavior_logs', 'api_logs')
ORDER BY name;
