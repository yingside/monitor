import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import { Request, Response } from 'express'

/**
 * 全局 HTTP 异常过滤器
 *
 * 捕获所有 HttpException（含 NestJS 内置的 400/401/403/404/422 等），
 * 统一包装成 { code, data: null, message } 格式返回。
 *
 * code 映射规则：
 *   - 400 → 40000（参数错误）
 *   - 401 → 40100（未登录 / Token 无效）
 *   - 403 → 40300（无权限）
 *   - 404 → 40400（资源不存在）
 *   - 其他 4xx/5xx → 对应 HTTP 状态码 * 100
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name)

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()
    const status = exception.getStatus()

    const exceptionResponse = exception.getResponse()
    let message: string

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse
    } else if (
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null
    ) {
      const resp = exceptionResponse as Record<string, unknown>
      // ValidationPipe 报错时 message 是数组
      if (Array.isArray(resp['message'])) {
        message = (resp['message'] as string[]).join('; ')
      } else {
        message = (resp['message'] as string) ?? exception.message
      }
    } else {
      message = exception.message
    }

    this.logger.warn(`[${request.method}] ${request.url} → ${status}: ${message}`)

    response.status(status).json({
      code: status === HttpStatus.OK ? 0 : status * 100,
      data: null,
      message,
    })
  }
}
