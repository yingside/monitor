import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { UserService } from '../../user/user.service'
import { JwtPayload } from '../../common/decorators/current-user.decorator'

/**
 * JWT 策略（Passport Strategy）
 *
 * 职责：
 *   - 从 HTTP 请求的 Authorization: Bearer <token> 中提取 JWT
 *   - 验证签名和有效期（由 passport-jwt 内部完成）
 *   - 调用 validate() 将 payload 中的 sub（userId）解析为完整用户对象
 *
 * validate() 返回值会被 Passport 挂载到 req.user，
 * 之后通过 @CurrentUser() 装饰器在 Controller 中取用。
 *
 * ⚠️ 课程深度说明：
 *   这里只实现了最基础的 JWT 验证。企业级方案通常还会：
 *   - 将 token 存入 Redis，实现主动注销（Blacklist）
 *   - 引入 Refresh Token 机制延长有效期
 *   本课程不展开这些，聚焦主链路。
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly userService: UserService) {
    super({
      // 从 Bearer token 中提取 JWT
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // 不忽略过期（false = 过期的 token 会报错）
      ignoreExpiration: false,
      // 和签发时使用相同的 secret
      secretOrKey: process.env.JWT_SECRET ?? 'monitor_dev_secret_change_in_production',
    })
  }

  /**
   * 验证通过后，Passport 会自动调用此方法
   * @param payload JWT payload（由签发时写入）
   * @returns 挂载到 req.user 的对象
   */
  async validate(payload: JwtPayload) {
    const user = await this.userService.findById(payload.sub)
    if (!user) {
      throw new UnauthorizedException('用户不存在或 Token 已失效')
    }
    // 返回精简的 payload（避免把整个 user 对象含密码挂到 request 上）
    return { sub: user.id, email: user.email } satisfies JwtPayload
  }
}
