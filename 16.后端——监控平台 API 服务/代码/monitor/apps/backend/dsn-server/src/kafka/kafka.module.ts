import { Module, Global } from '@nestjs/common'
import { KafkaService } from './kafka.service'

/**
 * @Global() 装饰器说明：
 * 将此模块设为全局，其他模块（如 ReportModule）无需 import KafkaModule 
 * 即可直接注入 KafkaService，避免每个模块重复 import
 */
@Global()
@Module({
  providers: [KafkaService],
  exports: [KafkaService],
})
export class KafkaModule {}
