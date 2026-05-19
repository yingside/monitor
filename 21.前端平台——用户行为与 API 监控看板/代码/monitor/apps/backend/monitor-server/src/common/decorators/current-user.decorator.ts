import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import { Request } from 'express'

/**
 * JwtPayload 是 jwt.strategy.ts validate() 方法返回值的类型
 * 该对象会被 Passport 挂载到 request.user 上
 */
export interface JwtPayload {
  sub: string    // user.id（UUID）
  email: string
}

/**
 * @CurrentUser() 参数装饰器
 *
 * 从 Request 对象中取出已解析的 JWT Payload（经过 JwtStrategy.validate 处理）。
 *
 * 用法：
 *   @Get('profile')
 *   getProfile(@CurrentUser() user: JwtPayload) {
 *     return user
 *   }
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => {
    const request = ctx.switchToHttp().getRequest<Request>()
    return request.user as JwtPayload
  },
)
