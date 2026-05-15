import { IsString, IsOptional, IsIn, MaxLength } from 'class-validator'
import { ProjectPlatform } from '../entities/project.entity'

/**
 * 更新项目时，appId 不允许修改（避免历史数据孤立），
 * 其余字段全部可选。
 */
export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: '项目名称最多 100 字符' })
  name?: string

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: '描述最多 500 字符' })
  description?: string

  @IsOptional()
  @IsIn(['web', 'ios', 'android', 'miniprogram'], {
    message: 'platform 必须是 web / ios / android / miniprogram 之一',
  })
  platform?: ProjectPlatform
}
