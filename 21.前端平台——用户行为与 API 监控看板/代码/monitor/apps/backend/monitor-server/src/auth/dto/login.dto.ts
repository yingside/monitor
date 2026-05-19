import { IsEmail, IsString, MinLength } from 'class-validator'

export class LoginDto {
  @IsEmail({}, { message: '请输入有效的邮箱地址' })
  email!: string

  @IsString()
  @MinLength(6, { message: '密码最少 6 位' })
  password!: string
}
