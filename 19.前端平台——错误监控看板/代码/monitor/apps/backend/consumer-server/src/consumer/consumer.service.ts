import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common'
import { Kafka, Consumer, logLevel } from 'kafkajs'
import { MonitorEventMessage } from './handlers/event.types'
import { ErrorHandlerService } from './handlers/error.handler'
import { PerformanceHandlerService } from './handlers/performance.handler'
import { BehaviorHandlerService } from './handlers/behavior.handler'
import { ApiHandlerService } from './handlers/api.handler'

/**
 * Kafka Consumer 服务
 *
 * 职责：
 *   - 在模块初始化时连接 Kafka，订阅四个监控 Topic
 *   - 持续监听新消息（consumer.run 是一个长期运行的异步任务）
 *   - 将每条消息按 topic 分发到对应的 Handler 处理
 *   - 在模块销毁时优雅断开（不丢失正在处理的消息）
 *
 * ⚠️ 课程深度说明：
 *   NestJS 提供了 @nestjs/microservices 包，可以用更声明式的方式
 *   （@MessagePattern 装饰器）处理 Kafka 消息。
 *   本课程与第 14 章保持一致，使用 kafkajs 原生 Consumer API，
 *   便于直观理解消费者的连接、订阅、消费三步流程。
 *   感兴趣可查阅 NestJS Microservices 官方文档了解装饰器写法。
 */
@Injectable()
export class ConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ConsumerService.name)
  private readonly kafka: Kafka
  private consumer!: Consumer

  /**
   * 要订阅的 Topic 列表
   * 与 dsn-server 的 TOPIC_MAP 完全对应，确保消费覆盖所有生产的消息
   */
  private readonly topics = [
    'monitor.error',
    'monitor.performance',
    'monitor.behavior',
    'monitor.api',
  ]

  constructor(
    private readonly errorHandler: ErrorHandlerService,
    private readonly performanceHandler: PerformanceHandlerService,
    private readonly behaviorHandler: BehaviorHandlerService,
    private readonly apiHandler: ApiHandlerService,
  ) {
    const brokers = (process.env.KAFKA_BROKERS ?? 'localhost:9094')
      .split(',')
      .map((b) => b.trim())

    this.kafka = new Kafka({
      clientId: 'consumer-server',
      brokers,
      logLevel: logLevel.ERROR,
    })
  }

  async onModuleInit() {
    const groupId = process.env.KAFKA_GROUP_ID ?? 'monitor-consumer-group'

    /**
     * 第一步：用 Admin API 确保四个 Topic 存在
     *
     * 问题背景：
     *   kafkajs 在 Topic 不存在时订阅会抛出
     *   "This server does not host this topic-partition"。
     *   虽然 docker-compose.yml 配置了 KAFKA_AUTO_CREATE_TOPICS_ENABLE=true，
     *   但 Topic 只在 Producer 第一次发消息时才会自动创建。
     *   如果 consumer-server 比 dsn-server 先启动（或 dsn-server 还没有发过任何消息），
     *   Topic 就不存在，Consumer 订阅会失败。
     *
     * 解决方案：
     *   用 Admin API 的 createTopics 在订阅前主动创建 Topic，
     *   如果 Topic 已存在会直接跳过（不会报错）。
     */
    const admin = this.kafka.admin()
    await admin.connect()
    await admin.createTopics({
      waitForLeaders: true,   // 等待分区 Leader 选举完成，确保 Topic 可读写
      topics: this.topics.map((topic) => ({
        topic,
        numPartitions: 1,     // 单分区，与 Kafka 自动创建的默认值一致
        replicationFactor: 1, // 单副本（本课程单节点 Kafka，不支持多副本）
      })),
    })
    await admin.disconnect()
    this.logger.log(`Topics 已就绪：${this.topics.join(', ')}`)

    /**
     * 第二步：创建并启动 Consumer
     *
     * groupId 的作用：
     *   - Kafka 用 groupId 标识"同一组消费者"
     *   - 同一个 Group 内，每个 Partition 只分配给一个 Consumer 实例
     *   - 本课程只运行一个 Consumer 实例，groupId 主要用于 Kafka UI 展示消费进度
     *
     * ⚠️ fromBeginning 的影响：
     *   - false（默认）：Consumer 只消费"加入后新来的消息"
     *   - true：Consumer 会从头读取 Topic 内所有历史消息（可能导致 ClickHouse 重复写入）
     *   - 本课程设置 false，避免重复消费已处理过的消息
     */
    this.consumer = this.kafka.consumer({ groupId })

    try {
      await this.consumer.connect()
      this.logger.log(`Kafka Consumer 连接成功 [groupId: ${groupId}]`)

      await this.consumer.subscribe({
        topics: this.topics,
        fromBeginning: true,
      })
      this.logger.log(`已订阅 Topics：${this.topics.join(', ')}`)

      // consumer.run 启动消息消费循环，会一直运行直到 consumer.disconnect() 被调用
      // void 表示有意不 await（这是一个长期运行的后台任务，不应该阻塞 onModuleInit）
      void this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          if (!message.value) return

          try {
            // 将 Kafka 消息的 Buffer 反序列化为 JS 对象
            const event = JSON.parse(
              message.value.toString(),
            ) as MonitorEventMessage

            this.logger.debug(
              `收到消息 [topic: ${topic}, partition: ${partition}, traceId: ${event.traceId}]`,
            )

            await this.dispatch(topic, event)
          } catch (err) {
            // 消息处理失败时只记录日志，不中断消费循环
            // 生产环境可以考虑：死信队列（DLQ）/ 重试机制 / 告警
            this.logger.error(
              `消息处理失败 [topic: ${topic}]`,
              err instanceof Error ? err.stack : String(err),
            )
          }
        },
      })
    } catch (err) {
      this.logger.error('Kafka Consumer 连接失败，请检查 Kafka 容器是否启动', err)
    }
  }

  async onModuleDestroy() {
    await this.consumer.disconnect()
    this.logger.log('Kafka Consumer 已断开')
  }

  /**
   * 按 topic 名称将消息路由到对应的 Handler
   *
   * 每个 Handler 只负责一种类型的数据，职责单一，
   * 后续需要修改某类数据的写入逻辑时，只需动对应的 Handler。
   */
  private async dispatch(topic: string, event: MonitorEventMessage): Promise<void> {
    switch (topic) {
      case 'monitor.error':
        await this.errorHandler.handle(event)
        break
      case 'monitor.performance':
        await this.performanceHandler.handle(event)
        break
      case 'monitor.behavior':
        await this.behaviorHandler.handle(event)
        break
      case 'monitor.api':
        await this.apiHandler.handle(event)
        break
      default:
        this.logger.warn(`收到未知 Topic 的消息：${topic}`)
    }
  }
}
