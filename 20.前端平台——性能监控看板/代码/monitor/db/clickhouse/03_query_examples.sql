-- =============================================================================
-- 前端监控平台 · ClickHouse 常用查询 SQL
-- 用途：第13章演示聚合查询，后续章节 monitor-server API 接口参考实现
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 错误相关查询
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. 过去 24 小时，错误数按小时趋势（柱状图数据）
SELECT
    toStartOfHour(created_at)  AS hour,
    count()                    AS error_count
FROM monitor.error_logs
WHERE app_id = 'app_001'
  AND created_at >= now() - INTERVAL 24 HOUR
GROUP BY hour
ORDER BY hour;

-- 2. 过去 7 天，按错误类型分组统计（饼图数据）
SELECT
    error_type,
    count() AS cnt
FROM monitor.error_logs
WHERE app_id = 'app_001'
  AND created_at >= now() - INTERVAL 7 DAY
GROUP BY error_type
ORDER BY cnt DESC;

-- 3. 影响用户最多的错误 TOP 5（去重统计受影响 user_id）
SELECT
    message,
    filename,
    lineno,
    count()                      AS occurrence,
    uniqExact(user_id)           AS affected_users
FROM monitor.error_logs
WHERE app_id = 'app_001'
  AND created_at >= now() - INTERVAL 7 DAY
  AND error_type = 'js_error'
GROUP BY message, filename, lineno
ORDER BY affected_users DESC
LIMIT 5;

-- 4. 错误列表（分页，按时间倒序）
SELECT
    trace_id,
    error_type,
    message,
    filename,
    lineno,
    page,
    user_id,
    created_at
FROM monitor.error_logs
WHERE app_id = 'app_001'
ORDER BY created_at DESC
LIMIT 10 OFFSET 0;

-- ─────────────────────────────────────────────────────────────────────────────
-- 性能相关查询
-- ─────────────────────────────────────────────────────────────────────────────

-- 5. Core Web Vitals 平均值（仪表盘概览卡片）
SELECT
    round(avg(fcp),  1) AS avg_fcp_ms,
    round(avg(lcp),  1) AS avg_lcp_ms,
    round(avg(fid),  1) AS avg_fid_ms,
    round(avg(cls),  3) AS avg_cls,
    round(avg(ttfb), 1) AS avg_ttfb_ms
FROM monitor.performance_logs
WHERE app_id = 'app_001'
  AND created_at >= now() - INTERVAL 7 DAY;

-- 6. 各页面平均加载时间 TOP 5（慢页面排查）
SELECT
    page,
    round(avg(load_time), 1) AS avg_load_ms,
    count()                  AS sample_count
FROM monitor.performance_logs
WHERE app_id = 'app_001'
  AND created_at >= now() - INTERVAL 7 DAY
GROUP BY page
ORDER BY avg_load_ms DESC
LIMIT 5;

-- 7. LCP 性能分布（Good/Needs Improvement/Poor，Google 标准）
--    Good: < 2500ms, Needs Improvement: 2500-4000ms, Poor: > 4000ms
SELECT
    multiIf(lcp < 2500, 'Good', lcp < 4000, 'Needs Improvement', 'Poor') AS lcp_level,
    count()  AS cnt,
    round(count() * 100.0 / sum(count()) OVER (), 1) AS pct
FROM monitor.performance_logs
WHERE app_id = 'app_001'
  AND created_at >= now() - INTERVAL 7 DAY
GROUP BY lcp_level
ORDER BY cnt DESC;

-- ─────────────────────────────────────────────────────────────────────────────
-- 用户行为相关查询
-- ─────────────────────────────────────────────────────────────────────────────

-- 8. PV（页面浏览量）/ UV（独立访客数） 近 7 天趋势
SELECT
    toDate(created_at)   AS day,
    count()              AS pv,
    uniqExact(user_id)   AS uv
FROM monitor.behavior_logs
WHERE app_id = 'app_001'
  AND action_type = 'page_view'
  AND created_at >= now() - INTERVAL 7 DAY
GROUP BY day
ORDER BY day;

-- 9. 各页面 PV 排名（热门页面）
SELECT
    page,
    count() AS pv
FROM monitor.behavior_logs
WHERE app_id = 'app_001'
  AND action_type = 'page_view'
  AND created_at >= now() - INTERVAL 7 DAY
GROUP BY page
ORDER BY pv DESC;

-- 10. 自定义埋点事件统计
SELECT
    JSONExtractString(extra, 'event') AS event_name,
    count()                           AS cnt
FROM monitor.behavior_logs
WHERE app_id = 'app_001'
  AND action_type = 'custom'
  AND created_at >= now() - INTERVAL 7 DAY
GROUP BY event_name
ORDER BY cnt DESC;

-- ─────────────────────────────────────────────────────────────────────────────
-- API 请求相关查询
-- ─────────────────────────────────────────────────────────────────────────────

-- 11. API 成功率总览（近 24 小时）
SELECT
    count()                                      AS total,
    countIf(success = true)                      AS success_count,
    round(countIf(success = true) * 100.0 / count(), 2) AS success_rate_pct
FROM monitor.api_logs
WHERE app_id = 'app_001'
  AND created_at >= now() - INTERVAL 24 HOUR;

-- 12. 异常率 TOP 10 接口（按 URL 分组，失败次数/总次数）
SELECT
    url,
    method,
    count()                                            AS total,
    countIf(success = false)                           AS fail_count,
    round(countIf(success = false) * 100.0 / count(), 1) AS fail_rate_pct,
    round(avg(duration), 1)                            AS avg_duration_ms
FROM monitor.api_logs
WHERE app_id = 'app_001'
  AND created_at >= now() - INTERVAL 7 DAY
GROUP BY url, method
HAVING fail_count > 0
ORDER BY fail_rate_pct DESC
LIMIT 10;

-- 13. 慢接口排名（平均耗时 TOP 10）
SELECT
    url,
    method,
    count()                    AS call_count,
    round(avg(duration), 1)    AS avg_ms,
    round(max(duration), 1)    AS max_ms,
    round(quantile(0.95)(duration), 1) AS p95_ms
FROM monitor.api_logs
WHERE app_id = 'app_001'
  AND created_at >= now() - INTERVAL 7 DAY
  AND success = true
GROUP BY url, method
ORDER BY avg_ms DESC
LIMIT 10;

-- 14. HTTP 状态码分布（近 7 天）
SELECT
    status,
    count() AS cnt
FROM monitor.api_logs
WHERE app_id = 'app_001'
  AND created_at >= now() - INTERVAL 7 DAY
GROUP BY status
ORDER BY cnt DESC;
