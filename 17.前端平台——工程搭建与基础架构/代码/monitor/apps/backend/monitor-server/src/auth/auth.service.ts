import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcryptjs'
import { UserService } from '../user/user.service'
import { RegisterDto } from './dto/register.dto'
import { LoginDto } from './dto/login.dto'
import { JwtPayload } from '../common/decorators/current-user.decorator'

/**
 * 认证服务
 *
 * 职责：
 *   - register：注册新用户（邮箱唯一性校验 + 密码 bcrypt 加密）
 *   - login：验证账号密码，签发 JWT
 *   - getProfile：返回当前登录用户信息
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    // 邮箱唯一性校验
    const existing = await this.userService.findByEmail(dto.email)
    if (existing) {
      throw new ConflictException('该邮箱已被注册')
    }

    // bcrypt 哈希密码，saltRounds=10 是业界常用值
    // saltRounds 越大越安全但越慢；10 约需 100ms，可抵御暴力破解
    const hashed = await bcrypt.hash(dto.password, 10)

    const user = await this.userService.create({
      email: dto.email,
      password: hashed,
      name: dto.name,
    })

    // 注册成功后直接签发 token，省去再次登录的步骤
    const token = this.signToken({ sub: user.id, email: user.email })

    return {
      token,
      user: { id: user.id, email: user.email, name: user.name },
    }
  }

  async login(dto: LoginDto) {
    const user = await this.userService.findByEmail(dto.email)
    if (!user) {
      // 不暴露"用户不存在"细节，统一返回"账号或密码错误"
      throw new UnauthorizedException('账号或密码错误')
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.password)
    if (!passwordMatch) {
      throw new UnauthorizedException('账号或密码错误')
    }

    const token = this.signToken({ sub: user.id, email: user.email })

    return {
      token,
      user: { id: user.id, email: user.email, name: user.name },
    }
  }

  async getProfile(payload: JwtPayload) {
    const user = await this.userService.findById(payload.sub)
    if (!user) {
      throw new UnauthorizedException('用户不存在')
    }
    return { id: user.id, email: user.email, name: user.name }
  }

  private signToken(payload: JwtPayload): string {
    return this.jwtService.sign(payload)
  }
}
