import { Injectable, BadRequestException, Logger } from '@nestjs/common'
import { KafkaService } from '../kafka/kafka.service'
import { ReportEventDto } from './dto/report-event.dto'

/**
 * 监控事件类型 → Kafka Topic 映射表
 *
 * 按事件类型分发到不同 Topic，下游 Consumer 可以按 Topic 独立消费
 * 相比单一 Topic 的好处：各类监控数据可以独立扩容、独立配置保留策略
 */
const TOPIC_MAP: Record<ReportEventDto['type'], string> = {
  error: 'monitor.error',
  performance: 'monitor.performance',
  behavior: 'monitor.behavior',
  api: 'monitor.api',
}

@Injectable()
export class ReportService {
  private readonly logger = new Logger(ReportService.name)

  /**
   * 合法的 appId 集合
   *
   * 当前实现：从环境变量 VALID_APP_IDS 读取（逗号分隔字符串）
   * 集合为空时跳过校验（开发阶段默认放行，方便调试）
   *
   * ⚠️ 第 16 章升级点：接入 PostgreSQL 项目管理后，
   *   此处替换为数据库查询（ProjectService.findByAppId），
   *   不再依赖环境变量
   */
  private readonly validAppIds: Set<string>

  constructor(private readonly kafkaService: KafkaService) {
    const envIds = process.env.VALID_APP_IDS ?? ''
    this.validAppIds = new Set(
      envIds
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean),
    )

    if (this.validAppIds.size > 0) {
      this.logger.log(`appId 白名单已启用: [${[...this.validAppIds].join(', ')}]`)
    } else {
      this.logger.warn('VALID_APP_IDS 未配置，跳过 appId 校验（开发模式）')
    }
  }

  /**
   * 处理批量上报事件
   *
   * 流程：
   *   1. 校验每条事件的 appId
   *   2. 按事件 type 分发到对应 Kafka Topic
   */
  async handleReport(events: ReportEventDto[]): Promise<void> {
    // 先全量校验 appId，有一个不合法则整批拒绝
    for (const event of events) {
      this.validateAppId(event.appId)
    }

    // 并发写入 Kafka（每条事件单独发送）
    await Promise.all(
      events.map((event) =>
        this.kafkaService.send(TOPIC_MAP[event.type], event),
      ),
    )

    this.logger.debug(`成功写入 Kafka，事件数量: ${events.length}`)
  }

  private validateAppId(appId: string): void {
    // 未配置白名单 → 开发模式，跳过校验
    if (this.validAppIds.size === 0) return

    if (!this.validAppIds.has(appId)) {
      throw new BadRequestException(`非法的 appId: ${appId}`)
    }
  }
}
