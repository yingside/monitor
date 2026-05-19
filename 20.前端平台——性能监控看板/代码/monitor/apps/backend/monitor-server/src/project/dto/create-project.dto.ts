import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  MaxLength,
  Matches,
} from 'class-validator'
import { ProjectPlatform } from '../entities/project.entity'

export class CreateProjectDto {
  /**
   * SDK 使用的 appId，只允许字母、数字、中划线、下划线
   * 例：'vue3-demo'、'mobile_app_001'
   */
  @IsString()
  @IsNotEmpty({ message: 'appId 不能为空' })
  @MaxLength(64, { message: 'appId 最多 64 字符' })
  @Matches(/^[a-zA-Z0-9_-]+$/, { message: 'appId 只允许字母、数字、中划线、下划线' })
  appId!: string

  @IsString()
  @IsNotEmpty({ message: '项目名称不能为空' })
  @MaxLength(100, { message: '项目名称最多 100 字符' })
  name!: string

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: '描述最多 500 字符' })
  description?: string

  @IsOptional()
  @IsIn(['web', 'ios', 'android', 'miniprogram', 'react', 'vue', 'angular', 'other'], {
    message: 'platform 必须是 web / ios / android / miniprogram / react / vue / angular / other 之一',
  })
  platform?: ProjectPlatform
}
