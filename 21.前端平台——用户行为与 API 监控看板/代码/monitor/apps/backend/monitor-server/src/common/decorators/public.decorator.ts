import { SetMetadata } from '@nestjs/common'

/**
 * @Public() 装饰器
 *
 * 打了此标记的 Controller 方法不需要 JWT，直接放行。
 * 典型用途：POST /auth/login、POST /auth/register
 *
 * 原理：
 *   JwtAuthGuard 在 canActivate 时检查路由 Metadata 中是否有 IS_PUBLIC_KEY，
 *   有则直接返回 true，跳过 JWT 验证。
 */
export const IS_PUBLIC_KEY = 'isPublic'
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true)
