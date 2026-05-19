import { Controller, Post, Get, Body, HttpCode, HttpStatus } from '@nestjs/common'
import { AuthService } from './auth.service'
import { RegisterDto } from './dto/register.dto'
import { LoginDto } from './dto/login.dto'
import { Public } from '../common/decorators/public.decorator'
import {
  CurrentUser,
  JwtPayload,
} from '../common/decorators/current-user.decorator'

/**
 * 认证 Controller
 *
 * 路由前缀：/auth
 *
 * POST /auth/register  → 注册新用户（公开接口）
 * POST /auth/login     → 登录，返回 JWT（公开接口）
 * GET  /auth/profile   → 获取当前登录用户信息（需要 JWT）
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto)
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto)
  }

  @Get('profile')
  getProfile(@CurrentUser() user: JwtPayload) {
    return this.authService.getProfile(user)
  }
}
