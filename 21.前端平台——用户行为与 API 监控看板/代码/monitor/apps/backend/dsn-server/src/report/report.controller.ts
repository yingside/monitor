import { Controller, Post, Body, HttpCode, HttpStatus, Logger } from '@nestjs/common'
import { ReportService } from './report.service'
import { ReportBatchDto } from './dto/report-event.dto'

@Controller()
export class ReportController {
  private readonly logger = new Logger(ReportController.name)

  constructor(private readonly reportService: ReportService) {}

  /**
   * POST /report
   *
   * SDK 上报数据的统一入口，支持批量（batch）上报
   * sendBeacon 和 fetch POST 两种方式均走这个接口
   *
   * 响应格式：{ code: 0, message: 'ok', data: null }
   */
  @Post('report')
  @HttpCode(HttpStatus.OK)
  async report(@Body() body: ReportBatchDto) {
    this.logger.debug(`收到上报请求，事件数量: ${body.events.length}`)
    await this.reportService.handleReport(body.events)
    return { code: 0, message: 'ok', data: null }
  }

  /**
   * GET /health
   *
   * 健康检查端点（Docker / 负载均衡器探活用）
   */
  @Post('health')
  @HttpCode(HttpStatus.OK)
  health() {
    return { code: 0, message: 'ok', data: { status: 'running' } }
  }
}
