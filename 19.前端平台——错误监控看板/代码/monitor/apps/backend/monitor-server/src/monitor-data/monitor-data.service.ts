import { Injectable } from '@nestjs/common'
import { ClickhouseService } from '../clickhouse/clickhouse.service'
import { ErrorQueryDto, ApiQueryDto, BaseQueryDto } from './dto/query.dto'

/**
 * 监控数据查询服务
 *
 * 负责将前端的查询参数转换为 ClickHouse SQL，执行查询并返回结果。
 *
 * 设计原则：
 *   - 使用参数化查询（query_params）防止 SQL 注入
 *   - 所有分页接口同时返回 list 和 total，方便前端渲染分页组件
 *   - stats 类接口返回聚合统计数据（用于图表）
 *   - 时间范围默认为最近 7 天（startTime/endTime 未传时）
 */
@Injectable()
export class MonitorDataService {
  constructor(private readonly clickhouse: ClickhouseService) {}

  // ─────────────────────────────────────────────────────────────────────────
  // 错误日志
  // ─────────────────────────────────────────────────────────────────────────

  /** 错误日志列表（分页） */
  async getErrors(dto: ErrorQueryDto) {
    const { appId, startTime, endTime, errorType, page = 1, pageSize = 20 } = dto
    const { start, end } = this.resolveTimeRange(startTime, endTime)
    const offset = (page - 1) * pageSize

    const params: Record<string, unknown> = {
      appId,
      start,
      end,
      limit: pageSize,
      offset,
    }

    let whereExtra = ''
    if (errorType) {
      whereExtra = `AND error_type = {errorType: String}`
      params['errorType'] = errorType
    }

    const [list, countRows] = await Promise.all([
      this.clickhouse.query<Record<string, unknown>>(
        `SELECT trace_id, app_id, user_id, page, error_type, message, stack,
                filename, lineno, colno, ua, created_at
         FROM error_logs
         WHERE app_id = {appId: String}
           AND created_at >= {start: String}
           AND created_at <= {end: String}
           ${whereExtra}
         ORDER BY created_at DESC
         LIMIT {limit: UInt32} OFFSET {offset: UInt32}`,
        params,
      ),
      this.clickhouse.query<{ total: string }>(
        `SELECT count() AS total
         FROM error_logs
         WHERE app_id = {appId: String}
           AND created_at >= {start: String}
           AND created_at <= {end: String}
           ${whereExtra}`,
        params,
      ),
    ])

    return {
      list,
      total: Number(countRows[0]?.total ?? 0),
      page,
      pageSize,
    }
  }

  /** 错误趋势统计（按天分组，每种 error_type 的数量） */
  async getErrorStats(dto: BaseQueryDto) {
    const { appId, startTime, endTime } = dto
    const { start, end } = this.resolveTimeRange(startTime, endTime)

    const [trendRows, typeRows, topErrors] = await Promise.all([
      // 每日错误数趋势
      this.clickhouse.query<{ date: string; count: string }>(
        `SELECT toDate(created_at) AS date, count() AS count
         FROM error_logs
         WHERE app_id = {appId: String}
           AND created_at >= {start: String}
           AND created_at <= {end: String}
         GROUP BY date
         ORDER BY date`,
        { appId, start, end },
      ),
      // 错误类型分布
      this.clickhouse.query<{ errorType: string; count: string }>(
        `SELECT error_type AS errorType, count() AS count
         FROM error_logs
         WHERE app_id = {appId: String}
           AND created_at >= {start: String}
           AND created_at <= {end: String}
         GROUP BY error_type
         ORDER BY count DESC`,
        { appId, start, end },
      ),
      // TOP 10 高频错误（按 message 聚合）
      this.clickhouse.query<{ message: string; count: string; errorType: string }>(
        `SELECT message, error_type AS errorType, count() AS count
         FROM error_logs
         WHERE app_id = {appId: String}
           AND created_at >= {start: String}
           AND created_at <= {end: String}
         GROUP BY message, error_type
         ORDER BY count DESC
         LIMIT 10`,
        { appId, start, end },
      ),
    ])

    return {
      trend: trendRows.map((r) => ({
        date: r.date,
        count: Number(r.count),
      })),
      typeDistribution: typeRows.map((r) => ({
        errorType: r.errorType,
        count: Number(r.count),
      })),
      topErrors: topErrors.map((r) => ({
        message: r.message,
        errorType: r.errorType,
        count: Number(r.count),
      })),
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 性能日志
  // ─────────────────────────────────────────────────────────────────────────

  /** 性能日志列表（分页） */
  async getPerformanceLogs(dto: BaseQueryDto) {
    const { appId, startTime, endTime, page = 1, pageSize = 20 } = dto
    const { start, end } = this.resolveTimeRange(startTime, endTime)
    const offset = (page - 1) * pageSize

    const params = { appId, start, end, limit: pageSize, offset }

    const [list, countRows] = await Promise.all([
      this.clickhouse.query<Record<string, unknown>>(
        `SELECT trace_id, app_id, user_id, page, fcp, lcp, fid, cls, ttfb, load_time, ua, created_at
         FROM performance_logs
         WHERE app_id = {appId: String}
           AND created_at >= {start: String}
           AND created_at <= {end: String}
         ORDER BY created_at DESC
         LIMIT {limit: UInt32} OFFSET {offset: UInt32}`,
        params,
      ),
      this.clickhouse.query<{ total: string }>(
        `SELECT count() AS total
         FROM performance_logs
         WHERE app_id = {appId: String}
           AND created_at >= {start: String}
           AND created_at <= {end: String}`,
        params,
      ),
    ])

    return {
      list,
      total: Number(countRows[0]?.total ?? 0),
      page,
      pageSize,
    }
  }

  /** 性能指标统计（各指标的 p50 / p75 / p95 平均值） */
  async getPerformanceStats(dto: BaseQueryDto) {
    const { appId, startTime, endTime } = dto
    const { start, end } = this.resolveTimeRange(startTime, endTime)

    const [avgRows, trendRows] = await Promise.all([
      // 各指标均值（排除 0 值，避免未采集的指标拉低均值）
      this.clickhouse.query<Record<string, string>>(
        `SELECT
           round(avgIf(fcp, fcp > 0), 2)       AS avgFcp,
           round(avgIf(lcp, lcp > 0), 2)       AS avgLcp,
           round(avgIf(fid, fid > 0), 2)       AS avgFid,
           round(avgIf(cls, cls > 0), 4)       AS avgCls,
           round(avgIf(ttfb, ttfb > 0), 2)     AS avgTtfb,
           round(avgIf(load_time, load_time > 0), 2) AS avgLoadTime
         FROM performance_logs
         WHERE app_id = {appId: String}
           AND created_at >= {start: String}
           AND created_at <= {end: String}`,
        { appId, start, end },
      ),
      // LCP 按天趋势（最重要的性能指标）
      this.clickhouse.query<{ date: string; avgLcp: string }>(
        `SELECT toDate(created_at) AS date, round(avgIf(lcp, lcp > 0), 2) AS avgLcp
         FROM performance_logs
         WHERE app_id = {appId: String}
           AND created_at >= {start: String}
           AND created_at <= {end: String}
         GROUP BY date
         ORDER BY date`,
        { appId, start, end },
      ),
    ])

    const avg = avgRows[0] ?? {}
    return {
      summary: {
        avgFcp: Number(avg['avgFcp'] ?? 0),
        avgLcp: Number(avg['avgLcp'] ?? 0),
        avgFid: Number(avg['avgFid'] ?? 0),
        avgCls: Number(avg['avgCls'] ?? 0),
        avgTtfb: Number(avg['avgTtfb'] ?? 0),
        avgLoadTime: Number(avg['avgLoadTime'] ?? 0),
      },
      lcpTrend: trendRows.map((r) => ({
        date: r.date,
        avgLcp: Number(r.avgLcp),
      })),
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 行为日志
  // ─────────────────────────────────────────────────────────────────────────

  /** 行为日志列表（分页） */
  async getBehaviorLogs(dto: BaseQueryDto) {
    const { appId, startTime, endTime, page = 1, pageSize = 20 } = dto
    const { start, end } = this.resolveTimeRange(startTime, endTime)
    const offset = (page - 1) * pageSize

    const params = { appId, start, end, limit: pageSize, offset }

    const [list, countRows] = await Promise.all([
      this.clickhouse.query<Record<string, unknown>>(
        `SELECT trace_id, app_id, user_id, page, action_type, element, extra, ua, created_at
         FROM behavior_logs
         WHERE app_id = {appId: String}
           AND created_at >= {start: String}
           AND created_at <= {end: String}
         ORDER BY created_at DESC
         LIMIT {limit: UInt32} OFFSET {offset: UInt32}`,
        params,
      ),
      this.clickhouse.query<{ total: string }>(
        `SELECT count() AS total
         FROM behavior_logs
         WHERE app_id = {appId: String}
           AND created_at >= {start: String}
           AND created_at <= {end: String}`,
        params,
      ),
    ])

    return {
      list,
      total: Number(countRows[0]?.total ?? 0),
      page,
      pageSize,
    }
  }

  /** 行为统计（PV/UV 趋势 + 热门页面） */
  async getBehaviorStats(dto: BaseQueryDto) {
    const { appId, startTime, endTime } = dto
    const { start, end } = this.resolveTimeRange(startTime, endTime)

    const [pvuvTrend, topPages] = await Promise.all([
      // 每日 PV / UV
      this.clickhouse.query<{ date: string; pv: string; uv: string }>(
        `SELECT
           toDate(created_at) AS date,
           count() AS pv,
           uniq(user_id) AS uv
         FROM behavior_logs
         WHERE app_id = {appId: String}
           AND action_type = 'page_view'
           AND created_at >= {start: String}
           AND created_at <= {end: String}
         GROUP BY date
         ORDER BY date`,
        { appId, start, end },
      ),
      // TOP 10 访问页面
      this.clickhouse.query<{ page: string; pv: string; uv: string }>(
        `SELECT
           page,
           count() AS pv,
           uniq(user_id) AS uv
         FROM behavior_logs
         WHERE app_id = {appId: String}
           AND action_type = 'page_view'
           AND created_at >= {start: String}
           AND created_at <= {end: String}
         GROUP BY page
         ORDER BY pv DESC
         LIMIT 10`,
        { appId, start, end },
      ),
    ])

    return {
      pvuvTrend: pvuvTrend.map((r) => ({
        date: r.date,
        pv: Number(r.pv),
        uv: Number(r.uv),
      })),
      topPages: topPages.map((r) => ({
        page: r.page,
        pv: Number(r.pv),
        uv: Number(r.uv),
      })),
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // API 日志
  // ─────────────────────────────────────────────────────────────────────────

  /** API 请求日志列表（分页） */
  async getApiLogs(dto: ApiQueryDto) {
    const { appId, startTime, endTime, url, onlyFailed, page = 1, pageSize = 20 } = dto
    const { start, end } = this.resolveTimeRange(startTime, endTime)
    const offset = (page - 1) * pageSize

    const params: Record<string, unknown> = { appId, start, end, limit: pageSize, offset }
    let whereExtra = ''

    if (url) {
      whereExtra += ` AND url LIKE {urlPattern: String}`
      params['urlPattern'] = `%${url}%`
    }
    if (onlyFailed) {
      whereExtra += ` AND success = false`
    }

    const [list, countRows] = await Promise.all([
      this.clickhouse.query<Record<string, unknown>>(
        `SELECT trace_id, app_id, user_id, page, method, url, status,
                duration, request_size, response_size, success, ua, created_at
         FROM api_logs
         WHERE app_id = {appId: String}
           AND created_at >= {start: String}
           AND created_at <= {end: String}
           ${whereExtra}
         ORDER BY created_at DESC
         LIMIT {limit: UInt32} OFFSET {offset: UInt32}`,
        params,
      ),
      this.clickhouse.query<{ total: string }>(
        `SELECT count() AS total
         FROM api_logs
         WHERE app_id = {appId: String}
           AND created_at >= {start: String}
           AND created_at <= {end: String}
           ${whereExtra}`,
        params,
      ),
    ])

    return {
      list,
      total: Number(countRows[0]?.total ?? 0),
      page,
      pageSize,
    }
  }

  /** API 统计（成功率 + 平均耗时趋势 + 慢接口 TOP 10） */
  async getApiStats(dto: BaseQueryDto) {
    const { appId, startTime, endTime } = dto
    const { start, end } = this.resolveTimeRange(startTime, endTime)

    const [overallRows, trendRows, slowApis] = await Promise.all([
      // 总体成功率 + 平均耗时
      this.clickhouse.query<Record<string, string>>(
        `SELECT
           count() AS total,
           countIf(success = true) AS successCount,
           round(avg(duration), 2) AS avgDuration,
           round(quantile(0.95)(duration), 2) AS p95Duration
         FROM api_logs
         WHERE app_id = {appId: String}
           AND created_at >= {start: String}
           AND created_at <= {end: String}`,
        { appId, start, end },
      ),
      // 每日平均耗时趋势
      this.clickhouse.query<{ date: string; avgDuration: string; errorRate: string }>(
        `SELECT
           toDate(created_at) AS date,
           round(avg(duration), 2) AS avgDuration,
           round(countIf(success = false) / count() * 100, 2) AS errorRate
         FROM api_logs
         WHERE app_id = {appId: String}
           AND created_at >= {start: String}
           AND created_at <= {end: String}
         GROUP BY date
         ORDER BY date`,
        { appId, start, end },
      ),
      // 慢接口 TOP 10（按 p95 耗时排序）
      this.clickhouse.query<{
        url: string
        method: string
        avgDuration: string
        p95Duration: string
        total: string
        errorRate: string
      }>(
        `SELECT
           url,
           method,
           round(avg(duration), 2) AS avgDuration,
           round(quantile(0.95)(duration), 2) AS p95Duration,
           count() AS total,
           round(countIf(success = false) / count() * 100, 2) AS errorRate
         FROM api_logs
         WHERE app_id = {appId: String}
           AND created_at >= {start: String}
           AND created_at <= {end: String}
         GROUP BY url, method
         ORDER BY p95Duration DESC
         LIMIT 10`,
        { appId, start, end },
      ),
    ])

    const overall = overallRows[0] ?? {}
    const total = Number(overall['total'] ?? 0)
    const successCount = Number(overall['successCount'] ?? 0)

    return {
      summary: {
        total,
        successCount,
        errorCount: total - successCount,
        successRate: total > 0 ? Number(((successCount / total) * 100).toFixed(2)) : 100,
        avgDuration: Number(overall['avgDuration'] ?? 0),
        p95Duration: Number(overall['p95Duration'] ?? 0),
      },
      trend: trendRows.map((r) => ({
        date: r.date,
        avgDuration: Number(r.avgDuration),
        errorRate: Number(r.errorRate),
      })),
      slowApis: slowApis.map((r) => ({
        url: r.url,
        method: r.method,
        avgDuration: Number(r.avgDuration),
        p95Duration: Number(r.p95Duration),
        total: Number(r.total),
        errorRate: Number(r.errorRate),
      })),
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 私有工具方法
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * 解析时间范围
   * 若未传则默认取最近 7 天
   * ClickHouse DateTime 格式：'YYYY-MM-DD HH:MM:SS'
   */
  private resolveTimeRange(startTime?: string, endTime?: string) {
    const end = endTime ? new Date(endTime) : new Date()
    const start = startTime
      ? new Date(startTime)
      : new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000)

    return {
      start: this.toClickHouseDateTime(start),
      end: this.toClickHouseDateTime(end),
    }
  }

  private toClickHouseDateTime(date: Date): string {
    return date.toISOString().replace('T', ' ').substring(0, 19)
  }
}
