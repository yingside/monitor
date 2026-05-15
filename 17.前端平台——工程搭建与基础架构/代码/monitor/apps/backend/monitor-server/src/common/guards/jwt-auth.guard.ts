import { Injectable, ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AuthGuard } from '@nestjs/passport'
import { IS_PUBLIC_KEY } from '../decorators/public.decorator'

/**
 * JWT 全局鉴权 Guard
 *
 * 继承 @nestjs/passport 的 AuthGuard('jwt')，
 * 在此基础上增加"白名单跳过"逻辑：
 *   - 路由上有 @Public() 标记 → 直接放行（不校验 Token）
 *   - 没有 @Public() 标记 → 执行 JWT 校验
 *
 * 注册为全局 Guard（AppModule 中配置），所有路由默认受保护，
 * 只有显式标注 @Public() 才跳过鉴权。
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super()
  }

  canActivate(context: ExecutionContext) {
    // 检查该路由 / Controller 是否标注了 @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (isPublic) {
      return true
    }

    // 调用父类的 JWT 验证逻辑
    return super.canActivate(context)
  }
}
