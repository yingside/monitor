import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { ProjectService } from './project.service'
import { CreateProjectDto } from './dto/create-project.dto'
import { UpdateProjectDto } from './dto/update-project.dto'
import {
  CurrentUser,
  JwtPayload,
} from '../common/decorators/current-user.decorator'

/**
 * 项目管理 Controller
 *
 * 所有接口均需要 JWT（全局 JwtAuthGuard 已保护）。
 * 数据隔离原则：每个接口都只操作当前登录用户自己的项目。
 *
 * GET    /projects         → 获取我的项目列表
 * POST   /projects         → 创建新项目
 * GET    /projects/:id     → 获取单个项目
 * PATCH  /projects/:id     → 更新项目信息
 * DELETE /projects/:id     → 删除项目
 */
@Controller('projects')
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.projectService.findAll(user.sub)
  }

  @Post()
  create(
    @Body() dto: CreateProjectDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.projectService.create(dto, user.sub)
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.projectService.findOne(id, user.sub)
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProjectDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.projectService.update(id, dto, user.sub)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.projectService.remove(id, user.sub)
  }
}
