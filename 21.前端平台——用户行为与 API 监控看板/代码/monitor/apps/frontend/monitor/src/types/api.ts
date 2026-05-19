/**
 * 通用 API 响应类型
 *
 * 后端 monitor-server 所有接口统一返回格式：
 * { code: 0, data: T, message: 'ok' }
 * 错误时：{ code: <httpStatus * 100>, data: null, message: '错误描述' }
 */

/** 后端统一响应包装 */
export interface ApiResponse<T = unknown> {
  code: number
  data: T
  message: string
}

/** 分页响应的 data 结构（第 18 章查询接口使用）*/
export interface PaginatedData<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

/** 通用时间范围查询参数 */
export interface TimeRangeParams {
  startTime?: string   // ISO 8601
  endTime?: string     // ISO 8601
}

/** 通用分页参数 */
export interface PaginationParams {
  page?: number
  pageSize?: number
}
