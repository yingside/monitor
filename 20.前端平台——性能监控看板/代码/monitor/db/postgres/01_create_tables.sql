-- PostgreSQL 业务数据库 · 表结构定义
-- 第 16 章：monitor-server 使用的 users 和 projects 表
--
-- 说明：
--   TypeORM synchronize: true 会在服务启动时自动创建这些表，
--   此 SQL 文件作为参考文档，用于 DataGrip 手动查看或在不使用 TypeORM 时手动初始化。
--
-- 执行方式：在 DataGrip 中连接 PostgreSQL（localhost:5432），选择 monitor 数据库，执行此文件。

-- ── 启用 UUID 扩展（PostgreSQL 12+ 内置，通常无需额外操作）───────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── 用户表 ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  email       VARCHAR(255) NOT NULL UNIQUE,
  password    VARCHAR(255) NOT NULL,    -- bcrypt 哈希值，不存明文
  name        VARCHAR(100) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  users          IS '监控平台用户';
COMMENT ON COLUMN users.email    IS '登录邮箱，全局唯一';
COMMENT ON COLUMN users.password IS 'bcrypt 哈希密码，禁止存储明文';

-- ── 项目表 ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  app_id      VARCHAR(64) NOT NULL UNIQUE,   -- SDK 配置的 appId
  name        VARCHAR(100) NOT NULL,
  description VARCHAR(500) NOT NULL DEFAULT '',
  platform    VARCHAR(20)  NOT NULL DEFAULT 'web',  -- web/ios/android/miniprogram
  owner_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  projects         IS '监控平台项目（接入 SDK 的应用）';
COMMENT ON COLUMN projects.app_id  IS 'SDK 配置的 appId，与 ClickHouse 数据中的 app_id 列对应';
COMMENT ON COLUMN projects.platform IS 'web | ios | android | miniprogram';

-- ── 索引 ──────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_app_id   ON projects(app_id);
