import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'

/**
 * 统一响应格式拦截器
 *
 * 将所有正常响应包装成：
 * {
 *   "code": 0,
 *   "data": ...,
 *   "message": "ok"
 * }
 *
 * code = 0 表示业务成功，与 HTTP 200 状态码对应。
 * 错误响应（4xx / 5xx）由 HttpExceptionFilter 统一处理，格式相同但 code 不为 0。
 */
@Injectable()
export class ResponseInterceptor<T>
  implements NestInterceptor<T, { code: number; data: T; message: string }>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<{ code: number; data: T; message: string }> {
    return next.handle().pipe(
      map((data) => ({
        code: 0,
        data,
        message: 'ok',
      })),
    )
  }
}
