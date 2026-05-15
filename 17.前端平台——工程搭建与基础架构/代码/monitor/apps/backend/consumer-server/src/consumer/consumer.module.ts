import { Module } from '@nestjs/common'
import { ConsumerService } from './consumer.service'
import { ErrorHandlerService } from './handlers/error.handler'
import { PerformanceHandlerService } from './handlers/performance.handler'
import { BehaviorHandlerService } from './handlers/behavior.handler'
import { ApiHandlerService } from './handlers/api.handler'

@Module({
  providers: [
    ConsumerService,
    ErrorHandlerService,
    PerformanceHandlerService,
    BehaviorHandlerService,
    ApiHandlerService,
  ],
})
export class ConsumerModule {}
