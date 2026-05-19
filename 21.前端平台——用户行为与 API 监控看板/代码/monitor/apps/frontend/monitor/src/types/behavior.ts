/**
 * 用户行为监控相关类型定义
 *
 * 与 monitor-server /monitor/behaviors 接口响应结构对应。
 * 数据最终来源：ClickHouse behavior_logs 表。
 *
 * ─── 字段与 ClickHouse 建表对应关系 ────────────────────────────────────────
 * trace_id     String        — 会话唯一标识
 * app_id       String        — 项目标识
 * user_id      String        — 用户唯一标识
 * page         String        — 当前页面 URL
 * action_type  String        — 行为类型：page_view / click / custom / route_change
 * element      String        — 被点击元素的 CSS 选择器路径（click 类型有值）
 * extra        String        — 自定义埋点附加数据（JSON 字符串，custom 类型有值）
 * ua           String        — User-Agent
 * created_at   DateTime      — 采集时间
 */

/** 时间范围（与性能监控保持一致） */
export type TimeRange = '24h' | '7d' | '30d'

/**
 * PV/UV 每日趋势数据点（用于折线图）
 *
 * PV（Page View）：页面浏览量，每次页面访问计 1 次
 * UV（Unique Visitor）：唯一访客数，同一用户访问多次仍计 1 次
 */
export interface PvUvTrendPoint {
  date: string  // 'YYYY-MM-DD'
  pv: number    // 当日页面浏览量
  uv: number    // 当日唯一访客数
}

/**
 * 热门页面数据项（按 PV 降序，Top 10）
 */
export interface TopPage {
  page: string  // 页面 URL
  pv: number    // 页面浏览量
  uv: number    // 唯一访客数
}

/**
 * GET /monitor/behaviors/stats 响应结构
 *
 *  pvuvTrend — 按天聚合的 PV/UV 趋势（用于双轴折线图）
 *  topPages  — 访问量最多的 Top 10 页面（用于表格）
 */
export interface BehaviorStats {
  pvuvTrend: PvUvTrendPoint[]
  topPages: TopPage[]
}

/**
 * 单条行为日志（来自 ClickHouse behavior_logs 表）
 */
export interface BehaviorLog {
  trace_id: string
  app_id: string
  user_id: string
  page: string
  action_type: string   // 'page_view' | 'click' | 'custom' | 'route_change'
  element: string       // 点击元素路径（click 类型）
  extra: string         // 自定义数据（custom 类型）
  ua: string
  created_at: string
}

/** GET /monitor/behaviors 查询参数 */
export interface BehaviorQueryParams {
  appId: string
  startTime?: string   // ISO 8601
  endTime?: string     // ISO 8601
  page?: number
  pageSize?: number
}

/** GET /monitor/behaviors/stats 查询参数 */
export interface BehaviorStatsParams {
  appId: string
  startTime?: string
  endTime?: string
}
