// 职责（待实现）：
//   - 接收 SDK 通过 HTTP / Beacon API 上报的监控数据
//   - 验证 DSN（Data Source Name）合法性
//   - 数据格式校验与清洗
//   - 写入 Kafka 消息队列（由下游消费者持久化到 ClickHouse）
