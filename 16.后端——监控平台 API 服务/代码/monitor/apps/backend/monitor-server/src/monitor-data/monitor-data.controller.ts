import { Controller, Get, Query } from '@nestjs/common'
import { MonitorDataService } from './monitor-data.service'
import { BaseQueryDto, ErrorQueryDto, ApiQueryDto } from './dto/query.dto'

/**
 * 监控数据查询 Controller
 *
 * 路由前缀：/monitor
 * 所有接口均需要 JWT（全局 Guard 保护）
 *
 * ─── 错误日志 ───────────────────────────────────────────────────────────────
 * GET /monitor/errors          → 错误日志列表（分页）
 * GET /monitor/errors/stats    → 错误统计（趋势图 + 类型分布 + TOP10）
 *
 * ─── 性能日志 ───────────────────────────────────────────────────────────────
 * GET /monitor/performance     → 性能日志列表（分页）
 * GET /monitor/performance/stats → 性能指标统计（各指标均值 + LCP 趋势）
 *
 * ─── 行为日志 ───────────────────────────────────────────────────────────────
 * GET /monitor/behaviors       → 行为日志列表（分页）
 * GET /monitor/behaviors/stats → 行为统计（PV/UV 趋势 + TOP 页面）
 *
 * ─── API 日志 ────────────────────────────────────────────────────────────────
 * GET /monitor/apis            → API 日志列表（分页）
 * GET /monitor/apis/stats      → API 统计（成功率 + 耗时趋势 + 慢接口）
 */
@Controller('monitor')
export class MonitorDataController {
  constructor(private readonly monitorDataService: MonitorDataService) {}

  // ── 错误日志 ────────────────────────────────────────────────────────────

  @Get('errors')
  getErrors(@Query() query: ErrorQueryDto) {
    return this.monitorDataService.getErrors(query)
  }

  @Get('errors/stats')
  getErrorStats(@Query() query: BaseQueryDto) {
    return this.monitorDataService.getErrorStats(query)
  }

  // ── 性能日志 ────────────────────────────────────────────────────────────

  @Get('performance')
  getPerformanceLogs(@Query() query: BaseQueryDto) {
    return this.monitorDataService.getPerformanceLogs(query)
  }

  @Get('performance/stats')
  getPerformanceStats(@Query() query: BaseQueryDto) {
    return this.monitorDataService.getPerformanceStats(query)
  }

  // ── 行为日志 ────────────────────────────────────────────────────────────

  @Get('behaviors')
  getBehaviorLogs(@Query() query: BaseQueryDto) {
    return this.monitorDataService.getBehaviorLogs(query)
  }

  @Get('behaviors/stats')
  getBehaviorStats(@Query() query: BaseQueryDto) {
    return this.monitorDataService.getBehaviorStats(query)
  }

  // ── API 日志 ─────────────────────────────────────────────────────────────

  @Get('apis')
  getApiLogs(@Query() query: ApiQueryDto) {
    return this.monitorDataService.getApiLogs(query)
  }

  @Get('apis/stats')
  getApiStats(@Query() query: BaseQueryDto) {
    return this.monitorDataService.getApiStats(query)
  }
}
