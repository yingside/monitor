-- PostgreSQL 业务数据库 · 常用查询示例
-- 第 16 章：用于 DataGrip 验证 monitor-server 数据

-- ── 基础查询 ──────────────────────────────────────────────────────────────────

-- 查看所有用户（不含密码）
SELECT id, email, name, created_at FROM users ORDER BY created_at;

-- 查看所有项目
SELECT p.id, p.app_id, p.name, p.platform, u.email AS owner_email, p.created_at
FROM projects p
JOIN users u ON p.owner_id = u.id
ORDER BY p.created_at;

-- ── 验证场景 ──────────────────────────────────────────────────────────────────

-- 1. 某用户的所有项目
SELECT * FROM projects WHERE owner_id = '11111111-1111-1111-1111-111111111111';

-- 2. 根据 app_id 查找项目（dsn-server 校验 appId 时使用）
SELECT id, app_id, name, platform FROM projects WHERE app_id = 'app_001';

-- 3. 统计每个用户的项目数量
SELECT u.email, count(p.id) AS project_count
FROM users u
LEFT JOIN projects p ON p.owner_id = u.id
GROUP BY u.id, u.email
ORDER BY project_count DESC;
