-- =============================================================================
-- 前端监控平台 · ClickHouse 模拟数据
-- 说明：
--   - 用于本地开发阶段验证查询 SQL 逻辑
--   - 两个 app_id：app_001（主项目）/ app_002（辅助项目）
--   - 时间范围：近 7 天
--   - 执行前请确保已执行 01_create_tables.sql
-- =============================================================================

-- =============================================================================
-- error_logs 模拟数据（20 条）
-- =============================================================================
INSERT INTO monitor.error_logs
    (trace_id, app_id, user_id, page, ua, error_type, message, stack, filename, lineno, colno, created_at)
VALUES
    ('tr-e001', 'app_001', 'user_001', '/dashboard', 'Mozilla/5.0 Chrome/120', 'js_error',     'Cannot read properties of undefined (reading ''name'')', 'TypeError at app.js:42',     'https://app.example.com/static/app.js',       42,  15, now() - INTERVAL 1 HOUR),
    ('tr-e002', 'app_001', 'user_002', '/dashboard', 'Mozilla/5.0 Chrome/120', 'js_error',     'Cannot read properties of undefined (reading ''name'')', 'TypeError at app.js:42',     'https://app.example.com/static/app.js',       42,  15, now() - INTERVAL 2 HOUR),
    ('tr-e003', 'app_001', 'user_003', '/settings',  'Mozilla/5.0 Safari/17',  'js_error',     'Uncaught ReferenceError: foo is not defined',            'ReferenceError at main.js:88', 'https://app.example.com/static/main.js',      88,  5,  now() - INTERVAL 3 HOUR),
    ('tr-e004', 'app_001', 'user_001', '/projects',  'Mozilla/5.0 Firefox/121','promise_error', 'Network request failed',                                 '',                            '',                                             0,   0,  now() - INTERVAL 4 HOUR),
    ('tr-e005', 'app_001', 'user_004', '/dashboard', 'Mozilla/5.0 Chrome/120', 'resource_error','Failed to load resource',                               '',                            'https://app.example.com/static/vendor.js',    0,   0,  now() - INTERVAL 5 HOUR),
    ('tr-e006', 'app_001', 'user_002', '/projects',  'Mozilla/5.0 Chrome/120', 'js_error',     'Cannot read properties of null (reading ''id'')',         'TypeError at list.js:12',     'https://app.example.com/static/list.js',      12,  8,  now() - INTERVAL 6 HOUR),
    ('tr-e007', 'app_001', 'user_005', '/settings',  'Mozilla/5.0 Chrome/120', 'framework_error','Vue component error: render failed',                   'Error at runtime-core.esm.js', 'https://app.example.com/static/vendor.js',   0,   0,  now() - INTERVAL 7 HOUR),
    ('tr-e008', 'app_001', 'user_001', '/dashboard', 'Mozilla/5.0 Safari/17',  'js_error',     'Cannot read properties of undefined (reading ''name'')', 'TypeError at app.js:42',     'https://app.example.com/static/app.js',       42,  15, now() - INTERVAL 26 HOUR),
    ('tr-e009', 'app_001', 'user_003', '/dashboard', 'Mozilla/5.0 Chrome/120', 'js_error',     'Cannot read properties of undefined (reading ''name'')', 'TypeError at app.js:42',     'https://app.example.com/static/app.js',       42,  15, now() - INTERVAL 50 HOUR),
    ('tr-e010', 'app_001', 'user_002', '/projects',  'Mozilla/5.0 Chrome/120', 'promise_error','Failed to fetch',                                        '',                            '',                                             0,   0,  now() - INTERVAL 51 HOUR),
    ('tr-e011', 'app_001', 'user_004', '/dashboard', 'Mozilla/5.0 Chrome/120', 'js_error',     'Uncaught SyntaxError: Unexpected token',                  'SyntaxError at chunk.js:1',   'https://app.example.com/static/chunk.1a2b.js', 1,  0,  now() - INTERVAL 72 HOUR),
    ('tr-e012', 'app_001', 'user_001', '/settings',  'Mozilla/5.0 Firefox/121','resource_error','Failed to load resource',                               '',                            'https://app.example.com/static/icon.png',     0,   0,  now() - INTERVAL 73 HOUR),
    ('tr-e013', 'app_002', 'user_001', '/',          'Mozilla/5.0 Chrome/120', 'js_error',     'Uncaught TypeError: arr.map is not a function',           'TypeError at index.js:55',    'https://beta.example.com/static/index.js',    55,  18, now() - INTERVAL 2 HOUR),
    ('tr-e014', 'app_002', 'user_006', '/home',      'Mozilla/5.0 Chrome/120', 'js_error',     'Cannot set property ''value'' of null',                  'TypeError at form.js:30',     'https://beta.example.com/static/form.js',     30,  4,  now() - INTERVAL 3 HOUR),
    ('tr-e015', 'app_002', 'user_007', '/profile',   'Mozilla/5.0 Safari/17',  'promise_error','AbortError: The user aborted a request',                 '',                            '',                                             0,   0,  now() - INTERVAL 25 HOUR),
    ('tr-e016', 'app_002', 'user_006', '/',          'Mozilla/5.0 Chrome/120', 'js_error',     'Uncaught TypeError: arr.map is not a function',           'TypeError at index.js:55',    'https://beta.example.com/static/index.js',    55,  18, now() - INTERVAL 48 HOUR),
    ('tr-e017', 'app_002', 'user_008', '/home',      'Mozilla/5.0 Firefox/121','resource_error','Failed to load resource',                               '',                            'https://beta.example.com/static/logo.svg',    0,   0,  now() - INTERVAL 49 HOUR),
    ('tr-e018', 'app_001', 'user_003', '/projects',  'Mozilla/5.0 Chrome/120', 'js_error',     'Maximum call stack size exceeded',                        'RangeError at helper.js:9',   'https://app.example.com/static/helper.js',    9,   12, now() - INTERVAL 96 HOUR),
    ('tr-e019', 'app_001', 'user_005', '/dashboard', 'Mozilla/5.0 Chrome/120', 'framework_error','React: Invalid hook call',                             'Error at react-dom.js:123',   'https://app.example.com/static/vendor.js',    0,   0,  now() - INTERVAL 120 HOUR),
    ('tr-e020', 'app_002', 'user_007', '/profile',   'Mozilla/5.0 Chrome/120', 'js_error',     'Cannot read properties of undefined (reading ''length'')','TypeError at utils.js:77',   'https://beta.example.com/static/utils.js',    77,  20, now() - INTERVAL 144 HOUR);

-- =============================================================================
-- performance_logs 模拟数据（16 条）
-- =============================================================================
INSERT INTO monitor.performance_logs
    (trace_id, app_id, user_id, page, ua, fcp, lcp, fid, cls, ttfb, load_time, created_at)
VALUES
    ('tr-p001', 'app_001', 'user_001', '/dashboard', 'Mozilla/5.0 Chrome/120',  980.5,  2100.3, 45.2, 0.05, 320.1, 3200.8, now() - INTERVAL 1 HOUR),
    ('tr-p002', 'app_001', 'user_002', '/dashboard', 'Mozilla/5.0 Chrome/120',  1200.0, 2800.5, 80.0, 0.12, 450.3, 4100.2, now() - INTERVAL 2 HOUR),
    ('tr-p003', 'app_001', 'user_003', '/projects',  'Mozilla/5.0 Safari/17',   750.3,  1650.8, 20.1, 0.02, 210.5, 2500.0, now() - INTERVAL 3 HOUR),
    ('tr-p004', 'app_001', 'user_004', '/settings',  'Mozilla/5.0 Firefox/121', 890.0,  1900.2, 35.5, 0.08, 280.0, 2800.5, now() - INTERVAL 4 HOUR),
    ('tr-p005', 'app_001', 'user_001', '/projects',  'Mozilla/5.0 Chrome/120',  650.2,  1450.0, 15.0, 0.01, 180.3, 2200.1, now() - INTERVAL 25 HOUR),
    ('tr-p006', 'app_001', 'user_005', '/dashboard', 'Mozilla/5.0 Chrome/120',  3200.5, 6500.0, 300.0,0.45, 1200.0,8000.0, now() - INTERVAL 26 HOUR),
    ('tr-p007', 'app_001', 'user_002', '/',          'Mozilla/5.0 Safari/17',   420.1,  980.5,  12.0, 0.00, 150.2, 1800.3, now() - INTERVAL 50 HOUR),
    ('tr-p008', 'app_001', 'user_003', '/dashboard', 'Mozilla/5.0 Chrome/120',  1050.0, 2350.8, 55.3, 0.09, 350.0, 3600.7, now() - INTERVAL 72 HOUR),
    ('tr-p009', 'app_002', 'user_006', '/',          'Mozilla/5.0 Chrome/120',  520.0,  1200.5, 18.5, 0.03, 160.0, 2000.0, now() - INTERVAL 1 HOUR),
    ('tr-p010', 'app_002', 'user_007', '/home',      'Mozilla/5.0 Safari/17',   680.3,  1550.0, 25.0, 0.04, 220.5, 2400.8, now() - INTERVAL 2 HOUR),
    ('tr-p011', 'app_002', 'user_008', '/profile',   'Mozilla/5.0 Chrome/120',  820.5,  1800.2, 40.0, 0.06, 260.3, 2900.1, now() - INTERVAL 24 HOUR),
    ('tr-p012', 'app_002', 'user_006', '/home',      'Mozilla/5.0 Firefox/121', 2500.0, 5200.5, 200.0,0.38, 980.0, 7000.5, now() - INTERVAL 48 HOUR),
    ('tr-p013', 'app_001', 'user_004', '/dashboard', 'Mozilla/5.0 Chrome/120',  900.0,  1950.0, 42.0, 0.07, 300.5, 3100.0, now() - INTERVAL 96 HOUR),
    ('tr-p014', 'app_001', 'user_001', '/settings',  'Mozilla/5.0 Chrome/120',  780.5,  1720.3, 30.2, 0.04, 240.0, 2700.8, now() - INTERVAL 120 HOUR),
    ('tr-p015', 'app_002', 'user_007', '/',          'Mozilla/5.0 Chrome/120',  610.2,  1380.5, 22.0, 0.03, 190.0, 2150.3, now() - INTERVAL 144 HOUR),
    ('tr-p016', 'app_001', 'user_005', '/projects',  'Mozilla/5.0 Safari/17',   1100.5, 2450.0, 60.5, 0.11, 380.0, 3900.2, now() - INTERVAL 168 HOUR);

-- =============================================================================
-- behavior_logs 模拟数据（20 条）
-- =============================================================================
INSERT INTO monitor.behavior_logs
    (trace_id, app_id, user_id, page, ua, action_type, element, extra, created_at)
VALUES
    ('tr-b001', 'app_001', 'user_001', '/dashboard', 'Mozilla/5.0 Chrome/120',  'page_view', '',                                           '',                              now() - INTERVAL 1 HOUR),
    ('tr-b002', 'app_001', 'user_001', '/dashboard', 'Mozilla/5.0 Chrome/120',  'click',     'button#create-project',                       '',                              now() - INTERVAL 1 HOUR),
    ('tr-b003', 'app_001', 'user_001', '/projects',  'Mozilla/5.0 Chrome/120',  'page_view', '',                                           '',                              now() - INTERVAL 1 HOUR),
    ('tr-b004', 'app_001', 'user_002', '/dashboard', 'Mozilla/5.0 Chrome/120',  'page_view', '',                                           '',                              now() - INTERVAL 2 HOUR),
    ('tr-b005', 'app_001', 'user_002', '/settings',  'Mozilla/5.0 Chrome/120',  'click',     'a.nav-link[href="/settings"]',                '',                              now() - INTERVAL 2 HOUR),
    ('tr-b006', 'app_001', 'user_003', '/dashboard', 'Mozilla/5.0 Safari/17',   'page_view', '',                                           '',                              now() - INTERVAL 3 HOUR),
    ('tr-b007', 'app_001', 'user_003', '/dashboard', 'Mozilla/5.0 Safari/17',   'custom',    '',                                           '{"event":"upgrade_clicked","plan":"pro"}', now() - INTERVAL 3 HOUR),
    ('tr-b008', 'app_001', 'user_004', '/projects',  'Mozilla/5.0 Firefox/121', 'page_view', '',                                           '',                              now() - INTERVAL 4 HOUR),
    ('tr-b009', 'app_001', 'user_004', '/projects',  'Mozilla/5.0 Firefox/121', 'click',     'button.delete-btn[data-id="proj-42"]',        '',                              now() - INTERVAL 4 HOUR),
    ('tr-b010', 'app_001', 'user_005', '/settings',  'Mozilla/5.0 Chrome/120',  'page_view', '',                                           '',                              now() - INTERVAL 5 HOUR),
    ('tr-b011', 'app_001', 'user_001', '/dashboard', 'Mozilla/5.0 Chrome/120',  'page_view', '',                                           '',                              now() - INTERVAL 26 HOUR),
    ('tr-b012', 'app_001', 'user_002', '/projects',  'Mozilla/5.0 Chrome/120',  'page_view', '',                                           '',                              now() - INTERVAL 27 HOUR),
    ('tr-b013', 'app_001', 'user_001', '/dashboard', 'Mozilla/5.0 Chrome/120',  'custom',    '',                                           '{"event":"feature_used","name":"alert_rule"}', now() - INTERVAL 28 HOUR),
    ('tr-b014', 'app_001', 'user_003', '/settings',  'Mozilla/5.0 Safari/17',   'page_view', '',                                           '',                              now() - INTERVAL 50 HOUR),
    ('tr-b015', 'app_001', 'user_004', '/dashboard', 'Mozilla/5.0 Chrome/120',  'page_view', '',                                           '',                              now() - INTERVAL 72 HOUR),
    ('tr-b016', 'app_002', 'user_006', '/',          'Mozilla/5.0 Chrome/120',  'page_view', '',                                           '',                              now() - INTERVAL 1 HOUR),
    ('tr-b017', 'app_002', 'user_006', '/',          'Mozilla/5.0 Chrome/120',  'click',     'button#get-started',                          '',                              now() - INTERVAL 1 HOUR),
    ('tr-b018', 'app_002', 'user_007', '/home',      'Mozilla/5.0 Safari/17',   'page_view', '',                                           '',                              now() - INTERVAL 2 HOUR),
    ('tr-b019', 'app_002', 'user_008', '/profile',   'Mozilla/5.0 Firefox/121', 'page_view', '',                                           '',                              now() - INTERVAL 24 HOUR),
    ('tr-b020', 'app_002', 'user_007', '/',          'Mozilla/5.0 Chrome/120',  'custom',    '',                                           '{"event":"signup_started"}',    now() - INTERVAL 25 HOUR);

-- =============================================================================
-- api_logs 模拟数据（20 条）
-- =============================================================================
INSERT INTO monitor.api_logs
    (trace_id, app_id, user_id, page, ua, method, url, status, duration, request_size, response_size, success, created_at)
VALUES
    ('tr-a001', 'app_001', 'user_001', '/dashboard', 'Mozilla/5.0 Chrome/120',  'GET',  'https://api.example.com/projects',          200, 235.5,  0,    1240, true,  now() - INTERVAL 1 HOUR),
    ('tr-a002', 'app_001', 'user_001', '/dashboard', 'Mozilla/5.0 Chrome/120',  'GET',  'https://api.example.com/alerts/summary',    200, 180.2,  0,    580,  true,  now() - INTERVAL 1 HOUR),
    ('tr-a003', 'app_001', 'user_002', '/projects',  'Mozilla/5.0 Chrome/120',  'POST', 'https://api.example.com/projects',          201, 320.8,  850,  420,  true,  now() - INTERVAL 2 HOUR),
    ('tr-a004', 'app_001', 'user_003', '/settings',  'Mozilla/5.0 Safari/17',   'PUT',  'https://api.example.com/user/profile',      200, 290.0,  480,  220,  true,  now() - INTERVAL 3 HOUR),
    ('tr-a005', 'app_001', 'user_004', '/projects',  'Mozilla/5.0 Firefox/121', 'GET',  'https://api.example.com/projects/42',       404, 95.3,   0,    180,  false, now() - INTERVAL 3 HOUR),
    ('tr-a006', 'app_001', 'user_002', '/dashboard', 'Mozilla/5.0 Chrome/120',  'GET',  'https://api.example.com/errors?range=24h', 200, 2850.5, 0,    15200,true,  now() - INTERVAL 4 HOUR),
    ('tr-a007', 'app_001', 'user_001', '/dashboard', 'Mozilla/5.0 Chrome/120',  'GET',  'https://api.example.com/performance',       500, 8500.0, 0,    320,  false, now() - INTERVAL 5 HOUR),
    ('tr-a008', 'app_001', 'user_005', '/settings',  'Mozilla/5.0 Chrome/120',  'DELETE','https://api.example.com/projects/15',     403, 88.0,   0,    210,  false, now() - INTERVAL 6 HOUR),
    ('tr-a009', 'app_001', 'user_003', '/dashboard', 'Mozilla/5.0 Safari/17',   'GET',  'https://api.example.com/projects',          200, 310.5,  0,    1580, true,  now() - INTERVAL 25 HOUR),
    ('tr-a010', 'app_001', 'user_001', '/projects',  'Mozilla/5.0 Chrome/120',  'GET',  'https://api.example.com/errors?range=7d',  200, 4200.0, 0,    28000,true,  now() - INTERVAL 26 HOUR),
    ('tr-a011', 'app_001', 'user_004', '/dashboard', 'Mozilla/5.0 Firefox/121', 'GET',  'https://api.example.com/alerts/summary',    200, 155.3,  0,    620,  true,  now() - INTERVAL 48 HOUR),
    ('tr-a012', 'app_001', 'user_002', '/settings',  'Mozilla/5.0 Chrome/120',  'POST', 'https://api.example.com/alerts',            201, 410.8,  720,  380,  true,  now() - INTERVAL 49 HOUR),
    ('tr-a013', 'app_001', 'user_001', '/dashboard', 'Mozilla/5.0 Chrome/120',  'GET',  'https://api.example.com/performance',       0,   0.0,    0,    -1,   false, now() - INTERVAL 72 HOUR),
    ('tr-a014', 'app_002', 'user_006', '/',          'Mozilla/5.0 Chrome/120',  'GET',  'https://api.beta.com/config',               200, 120.5,  0,    880,  true,  now() - INTERVAL 1 HOUR),
    ('tr-a015', 'app_002', 'user_006', '/',          'Mozilla/5.0 Chrome/120',  'POST', 'https://api.beta.com/auth/login',           200, 380.2,  640,  520,  true,  now() - INTERVAL 1 HOUR),
    ('tr-a016', 'app_002', 'user_007', '/home',      'Mozilla/5.0 Safari/17',   'GET',  'https://api.beta.com/feed',                 200, 560.0,  0,    3200, true,  now() - INTERVAL 2 HOUR),
    ('tr-a017', 'app_002', 'user_008', '/profile',   'Mozilla/5.0 Firefox/121', 'GET',  'https://api.beta.com/user/me',              401, 75.5,   0,    180,  false, now() - INTERVAL 24 HOUR),
    ('tr-a018', 'app_002', 'user_006', '/home',      'Mozilla/5.0 Chrome/120',  'GET',  'https://api.beta.com/feed',                 200, 2100.5, 0,    8800, true,  now() - INTERVAL 48 HOUR),
    ('tr-a019', 'app_001', 'user_003', '/projects',  'Mozilla/5.0 Chrome/120',  'GET',  'https://api.example.com/projects',          200, 280.0,  0,    1100, true,  now() - INTERVAL 96 HOUR),
    ('tr-a020', 'app_001', 'user_005', '/dashboard', 'Mozilla/5.0 Safari/17',   'GET',  'https://api.example.com/errors?range=24h', 503, 30000.0,0,    480,  false, now() - INTERVAL 120 HOUR);
