import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator'

export class RegisterDto {
  @IsEmail({}, { message: '请输入有效的邮箱地址' })
  email!: string

  @IsString()
  @MinLength(6, { message: '密码最少 6 位' })
  @MaxLength(64, { message: '密码最多 64 位' })
  password!: string

  @IsString()
  @MinLength(1, { message: '用户名不能为空' })
  @MaxLength(50, { message: '用户名最多 50 字符' })
  name!: string
}
