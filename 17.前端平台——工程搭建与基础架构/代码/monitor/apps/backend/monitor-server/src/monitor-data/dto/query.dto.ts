import { IsString, IsNotEmpty, IsOptional, IsInt, Min, Max } from 'class-validator'
import { Type } from 'class-transformer'

/**
 * 通用查询基础 DTO
 *
 * 所有监控数据查询接口共享的分页 + 时间范围参数。
 * startTime / endTime 传 ISO 8601 字符串，如 '2025-01-01T00:00:00Z'
 */
export class BaseQueryDto {
  @IsString()
  @IsNotEmpty({ message: 'appId 不能为空' })
  appId!: string

  @IsOptional()
  @IsString()
  startTime?: string

  @IsOptional()
  @IsString()
  endTime?: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number = 20
}

/**
 * 错误查询 DTO
 */
export class ErrorQueryDto extends BaseQueryDto {
  /** 过滤特定错误类型：js_error / resource_error / promise_error / framework_error */
  @IsOptional()
  @IsString()
  errorType?: string
}

/**
 * API 查询 DTO
 */
export class ApiQueryDto extends BaseQueryDto {
  /** 过滤特定 URL（模糊匹配） */
  @IsOptional()
  @IsString()
  url?: string

  /** 只查失败的请求 */
  @IsOptional()
  @Type(() => Boolean)
  onlyFailed?: boolean
}
