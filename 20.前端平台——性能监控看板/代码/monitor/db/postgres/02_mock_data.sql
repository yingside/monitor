-- PostgreSQL 业务数据库 · 初始测试数据
-- 第 16 章：在 DataGrip 中执行，为开发阶段提供测试用户和项目
--
-- 注意：TypeORM synchronize 会自动建表，但不会插入数据，需手动执行此文件。
--
-- 密码说明：以下密码均为明文 "123456" 的 bcrypt(rounds=10) 哈希值
--   可用 node -e "const b=require('bcrypt'); b.hash('123456',10).then(console.log)" 重新生成

-- ── 测试用户 ──────────────────────────────────────────────────────────────────
INSERT INTO users (id, email, password, name) VALUES
  (
    '11111111-1111-1111-1111-111111111111',
    'admin@monitor.dev',
    '$2b$10$K7L1OJ45/4Y2nIvhRVpCe.FSmhDdWoXehVzJptJ/op0lSsvqNu/1u',
    'Admin User'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'dev@monitor.dev',
    '$2b$10$K7L1OJ45/4Y2nIvhRVpCe.FSmhDdWoXehVzJptJ/op0lSsvqNu/1u',
    'Dev User'
  )
ON CONFLICT (email) DO NOTHING;

-- ── 测试项目 ──────────────────────────────────────────────────────────────────
-- app_id 与 ClickHouse 中模拟数据的 app_id 对应（app_001 / app_002）
INSERT INTO projects (app_id, name, description, platform, owner_id) VALUES
  (
    'app_001',
    'Vue3 演示应用',
    '前端监控 SDK Vue3 接入演示项目',
    'web',
    '11111111-1111-1111-1111-111111111111'
  ),
  (
    'app_002',
    'React 演示应用',
    '前端监控 SDK React 接入演示项目',
    'web',
    '11111111-1111-1111-1111-111111111111'
  ),
  (
    'vue3-demo',
    'Vue3 本地调试',
    'demos/vue3-demo 本地开发测试',
    'web',
    '22222222-2222-2222-2222-222222222222'
  )
ON CONFLICT (app_id) DO NOTHING;
