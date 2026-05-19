import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common'
import { Kafka, Producer, Partitioners, logLevel } from 'kafkajs'

/**
 * Kafka Producer 服务
 *
 * 职责：
 *   - 在 NestJS 模块初始化时连接 Kafka（onModuleInit）
 *   - 在模块销毁时优雅断开连接（onModuleDestroy）
 *   - 提供 send 方法向指定 Topic 发送消息
 *
 * 为什么封装成 Service？
 *   - Kafka 连接是有代价的全局资源，应该单例复用
 *   - 通过 @Global() + Module 注入，整个应用共享一个 Producer 实例
 */
@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name)
  private readonly kafka: Kafka
  private producer: Producer

  constructor() {
    // 从环境变量读取 Broker 地址（多个地址逗号分隔）
    // 本地开发：Kafka 容器对宿主机暴露 9094 端口
    const brokers = (process.env.KAFKA_BROKERS ?? 'localhost:9094')
      .split(',')
      .map((b) => b.trim())

    this.kafka = new Kafka({
      clientId: 'dsn-server',
      brokers,
      // 关闭 kafkajs 的内置日志输出，使用 NestJS Logger 替代
      logLevel: logLevel.ERROR,
    })

    this.producer = this.kafka.producer({
      // LegacyPartitioner: 与 Kafka 旧版 Java 客户端分区策略一致
      // 保证同一个 key 的消息落到相同分区（当前单条消息无 key，实际分区随机）
      createPartitioner: Partitioners.LegacyPartitioner,
    })
  }

  async onModuleInit() {
    try {
      await this.producer.connect()
      this.logger.log('Kafka Producer 连接成功')
    } catch (err) {
      // Kafka 连接失败时打印错误但不阻止服务启动
      // 实际发送时会再次抛出，由上层处理
      this.logger.error('Kafka Producer 连接失败，请检查 Kafka 容器是否启动', err)
    }
  }

  async onModuleDestroy() {
    await this.producer.disconnect()
    this.logger.log('Kafka Producer 已断开')
  }

  /**
   * 向指定 Topic 发送一条消息
   *
   * @param topic  - Kafka Topic 名称（如 'monitor.error'）
   * @param message - 消息内容（自动序列化为 JSON 字符串）
   */
  async send(topic: string, message: unknown): Promise<void> {
    await this.producer.send({
      topic,
      messages: [
        {
          // 消息值：JSON 序列化的事件数据
          // 下游 Consumer 接收后 JSON.parse 还原
          value: JSON.stringify(message),
        },
      ],
    })
  }
}
