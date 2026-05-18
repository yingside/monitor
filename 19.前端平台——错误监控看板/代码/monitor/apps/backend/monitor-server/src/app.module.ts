import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { APP_GUARD } from '@nestjs/core'
import { AuthModule } from './auth/auth.module'
import { UserModule } from './user/user.module'
import { ProjectModule } from './project/project.module'
import { MonitorDataModule } from './monitor-data/monitor-data.module'
import { ClickhouseModule } from './clickhouse/clickhouse.module'
import { JwtAuthGuard } from './common/guards/jwt-auth.guard'
import { User } from './user/entities/user.entity'
import { Project } from './project/entities/project.entity'

@Module({
  imports: [
    // ── PostgreSQL 连接（TypeORM）──────────────────────────────────────────
    // synchronize: true 开发阶段自动同步表结构（生产环境必须改为 false，使用 Migration）
    //
    // ⚠️ 课程深度说明：
    //   TypeORM 的 synchronize 模式会在启动时对比实体类与数据库现有表结构，
    //   自动执行 ALTER TABLE / CREATE TABLE。这在开发阶段非常方便，
    //   但生产环境可能导致意外的列删除，必须换用 Migration。
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.PG_HOST ?? 'localhost',
      port: Number(process.env.PG_PORT ?? 5432),
      database: process.env.PG_DATABASE ?? 'monitor',
      username: process.env.PG_USER ?? 'monitor',
      password: process.env.PG_PASSWORD ?? '123456',
      entities: [User, Project],
      synchronize: true,    // ⚠️ 开发阶段自动同步，生产环境改为 false
      logging: process.env.NODE_ENV !== 'production',
    }),

    // ── ClickHouse（全局模块，查询监控数据）──────────────────────────────
    ClickhouseModule,

    // ── 业务模块 ──────────────────────────────────────────────────────────
    UserModule,
    AuthModule,
    ProjectModule,
    MonitorDataModule,
  ],
  providers: [
    // 将 JwtAuthGuard 注册为全局 Guard
    // 效果：所有路由默认需要 JWT，只有 @Public() 标注的才跳过
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
