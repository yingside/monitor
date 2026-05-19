import { Module } from '@nestjs/common'
import { MonitorDataController } from './monitor-data.controller'
import { MonitorDataService } from './monitor-data.service'

@Module({
  controllers: [MonitorDataController],
  providers: [MonitorDataService],
})
export class MonitorDataModule {}
