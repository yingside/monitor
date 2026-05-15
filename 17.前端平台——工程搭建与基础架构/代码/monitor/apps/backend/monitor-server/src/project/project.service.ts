import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Project } from './entities/project.entity'
import { CreateProjectDto } from './dto/create-project.dto'
import { UpdateProjectDto } from './dto/update-project.dto'

@Injectable()
export class ProjectService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
  ) {}

  /** 获取当前用户的所有项目 */
  async findAll(ownerId: string): Promise<Project[]> {
    return this.projectRepo.find({
      where: { ownerId },
      order: { createdAt: 'DESC' },
    })
  }

  /** 根据 ID 获取单个项目（校验所有权） */
  async findOne(id: string, ownerId: string): Promise<Project> {
    const project = await this.projectRepo.findOne({ where: { id } })
    if (!project) {
      throw new NotFoundException(`项目不存在（id: ${id}）`)
    }
    if (project.ownerId !== ownerId) {
      throw new ForbiddenException('无权访问该项目')
    }
    return project
  }

  /** 创建新项目 */
  async create(dto: CreateProjectDto, ownerId: string): Promise<Project> {
    // appId 全局唯一性校验
    const existing = await this.projectRepo.findOne({
      where: { appId: dto.appId },
    })
    if (existing) {
      throw new ConflictException(`appId "${dto.appId}" 已被使用，请换一个`)
    }

    const project = this.projectRepo.create({
      appId: dto.appId,
      name: dto.name,
      description: dto.description ?? '',
      platform: dto.platform ?? 'web',
      ownerId,
    })
    return this.projectRepo.save(project)
  }

  /** 更新项目信息（appId 不可修改） */
  async update(
    id: string,
    dto: UpdateProjectDto,
    ownerId: string,
  ): Promise<Project> {
    const project = await this.findOne(id, ownerId)
    Object.assign(project, dto)
    return this.projectRepo.save(project)
  }

  /** 删除项目 */
  async remove(id: string, ownerId: string): Promise<void> {
    const project = await this.findOne(id, ownerId)
    await this.projectRepo.remove(project)
  }
}
