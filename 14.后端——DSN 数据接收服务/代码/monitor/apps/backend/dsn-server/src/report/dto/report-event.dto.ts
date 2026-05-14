import { IsString, IsNumber, IsIn, IsOptional, IsArray, ValidateNested, ArrayMinSize } from 'class-validator'
import { Type } from 'class-transformer'

/**
 * 单条监控事件 DTO
 *
 * 字段与 SDK 端 MonitorEvent 接口一一对应
 * class-validator 会自动校验每个字段的类型与合法性
 */
export class ReportEventDto {
  /** 每次上报的唯一追踪 ID（SDK 自动生成的 UUID） */
  @IsString()
  traceId!: string

  /** 项目标识，用于区分不同接入方 */
  @IsString()
  appId!: string

  /** 用户标识（可选，由接入方配置） */
  @IsOptional()
  @IsString()
  userId?: string

  /** 事件类型：error / performance / behavior / api */
  @IsIn(['error', 'performance', 'behavior', 'api'])
  type!: 'error' | 'performance' | 'behavior' | 'api'

  /**
   * 事件具体数据（因各类型结构差异较大，使用 unknown 接收原始数据）
   * Kafka 下游 Consumer 根据 type 再做具体解析和写入 ClickHouse
   *
   * ⚠️ 必须加 @IsOptional()，否则 ValidationPipe(whitelist: true) 会将
   *    没有装饰器的字段视为"额外字段"并直接剥除，导致 payload 丢失
   */
  @IsOptional()
  payload: unknown

  /** 事件发生时的客户端时间戳（毫秒级 Unix 时间戳） */
  @IsNumber()
  timestamp!: number

  /** 事件发生时所在的页面 URL */
  @IsString()
  page!: string

  /** User-Agent 字符串 */
  @IsString()
  ua!: string
}

/**
 * 批量上报请求体 DTO
 *
 * SDK 采用批量上报策略（缓冲队列），单次请求可携带多条事件
 */
export class ReportBatchDto {
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => ReportEventDto)
  events!: ReportEventDto[]
}
