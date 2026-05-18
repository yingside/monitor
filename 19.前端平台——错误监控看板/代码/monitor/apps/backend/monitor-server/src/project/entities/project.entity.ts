import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm'
import { User } from '../../user/entities/user.entity'

export type ProjectPlatform = 'web' | 'ios' | 'android' | 'miniprogram' | 'react' | 'vue' | 'angular' | 'other'

/**
 * 项目实体（PostgreSQL 表：projects）
 *
 * 一个"项目"对应一个接入监控的应用，字段 app_id 与 SDK 配置的 appId 对应。
 *
 * 字段说明：
 *   - id：UUID 主键
 *   - appId：接入 SDK 时使用的唯一标识（如 'vue3-demo'），与 ClickHouse 中的 app_id 列对应
 *   - name：项目显示名称
 *   - description：项目描述
 *   - platform：平台类型（web / ios / android / miniprogram）
 *   - ownerId：项目所有者（外键 → users.id）
 */
@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'app_id', unique: true })
  appId!: string

  @Column()
  name!: string

  @Column({ nullable: true, default: '' })
  description!: string

  @Column({
    type: 'varchar',
    length: 20,
    default: 'web',
  })
  platform!: ProjectPlatform

  @Column({ name: 'owner_id' })
  ownerId!: string

  @ManyToOne(() => User, (user) => user.projects, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_id' })
  owner!: User

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date
}
