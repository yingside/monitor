import { Injectable, Logger } from '@nestjs/common'
import { ClickhouseService } from '../../clickhouse/clickhouse.service'
import {
  MonitorEventMessage,
  PerformancePayload,
  WebVitalPayload,
  NavigationTimingPayload,
  toClickHouseDateTime,
} from './event.types'

/**
 * 性能事件 Handler
 *
 * 消费 monitor.performance Topic 的消息，写入 ClickHouse performance_logs 表。
 *
 * SDK 上报的性能数据有两种子类型：
 *
 * 1. web-vital（每条事件只包含一个指标）
 *    SDK 通过 web-vitals 库异步采集，每个指标就绪后单独上报一次。
 *    同一页面可能产生多条 web-vital 事件（FCP 一条、LCP 一条…）
 *
 *    metric → ClickHouse 列映射：
 *      FCP  → fcp 列
 *      LCP  → lcp 列
 *      CLS  → cls 列
 *      INP  → fid 列（INP 是 FID 的替代指标，ClickHouse 表沿用 fid 列名）
 *      TTFB → ttfb 列
 *    未填充的指标列设为 0.0
 *
 * 2. navigation-timing（每条事件包含完整的导航时序数据）
 *    基于 PerformanceNavigationTiming API，页面加载完成后上报一次。
 *    主要填充 ttfb 和 load_time 两个列。
 */
@Injectable()
export class PerformanceHandlerService {
  private readonly logger = new Logger(PerformanceHandlerService.name)

  constructor(private readonly clickhouse: ClickhouseService) {}

  async handle(event: MonitorEventMessage): Promise<void> {
    const payload = event.payload as PerformancePayload
    const mapped = this.mapPayload(payload)

    await this.clickhouse.insert('performance_logs', [
      {
        trace_id: event.traceId,
        app_id: event.appId,
        user_id: event.userId ?? '',
        page: event.page,
        ua: event.ua,
        ...mapped,
        created_at: toClickHouseDateTime(event.timestamp),
      },
    ])

    this.logger.debug(
      `performance_logs 写入成功 [traceId: ${event.traceId}, subType: ${payload.subType}]`,
    )
  }

  private mapPayload(payload: PerformancePayload): {
    fcp: number
    lcp: number
    fid: number
    cls: number
    ttfb: number
    load_time: number
  } {
    // 初始值：全部指标默认为 0，只填充本次上报包含的指标
    const defaults = { fcp: 0, lcp: 0, fid: 0, cls: 0, ttfb: 0, load_time: 0 }

    if (payload.subType === 'web-vital') {
      const p = payload as WebVitalPayload
      switch (p.metric) {
        case 'FCP':  return { ...defaults, fcp: p.value }
        case 'LCP':  return { ...defaults, lcp: p.value }
        case 'CLS':  return { ...defaults, cls: p.value }
        // INP 是 Google 在 2024 年用来替代 FID 的新指标（衡量交互响应速度）
        // 这里映射到 fid 列，保持 ClickHouse 表结构不变
        case 'INP':  return { ...defaults, fid: p.value }
        case 'TTFB': return { ...defaults, ttfb: p.value }
        default:     return defaults
      }
    }

    if (payload.subType === 'navigation-timing') {
      const p = payload as NavigationTimingPayload
      return {
        ...defaults,
        ttfb: p.ttfb,
        load_time: p.loadTime,
      }
    }

    return defaults
  }
}
