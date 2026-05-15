import { Controller, Get } from '@nestjs/common'

/**
 * 健康检查接口
 *
 * 提供一个简单的 GET /health 端点，
 * 用于确认服务已正常启动（方便本地开发时快速验证）
 */
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok', service: 'consumer-server' }
  }
}
