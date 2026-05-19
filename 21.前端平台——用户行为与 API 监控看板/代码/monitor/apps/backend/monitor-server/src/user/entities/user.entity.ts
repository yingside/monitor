import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm'
import { Exclude } from 'class-transformer'
import { Project } from '../../project/entities/project.entity'

/**
 * 用户实体（PostgreSQL 表：users）
 *
 * 字段说明：
 *   - id：UUID 主键，由 PostgreSQL uuid_generate_v4() 生成
 *   - email：邮箱，唯一约束，作为登录凭证
 *   - password：bcrypt 哈希后的密码（原始明文不存库）
 *   - name：显示名称
 *   - projects：该用户拥有的项目（一对多关联）
 */
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ unique: true })
  email!: string

  // @Exclude() 配合 ClassSerializerInterceptor 使用，
  // 防止密码字段被序列化到 HTTP 响应中
  @Exclude()
  @Column()
  password!: string

  @Column()
  name!: string

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date

  @OneToMany(() => Project, (project) => project.owner)
  projects!: Project[]
}
