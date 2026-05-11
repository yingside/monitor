// 第 03 章：骨架占位
// DSN 接收服务将在第 14 章用 NestJS 实现
//
// 职责：
//   - 接收 SDK 通过 HTTP / Beacon API 上报的监控数据
//   - 验证 DSN（Data Source Name）合法性
//   - 数据格式校验与清洗
//   - 写入 Kafka 消息队列（由下游消费者持久化到 ClickHouse）
